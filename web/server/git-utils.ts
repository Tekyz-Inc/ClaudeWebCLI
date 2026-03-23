import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, mkdirSync } from "node:fs";
import { join, basename } from "node:path";
import { homedir } from "node:os";

const execFileAsync = promisify(execFile);

// ─── Types ──────────────────────────────────────────────────────────────────

export interface GitRepoInfo {
  repoRoot: string;
  repoName: string;
  currentBranch: string;
  defaultBranch: string;
  isWorktree: boolean;
}

export interface GitBranchInfo {
  name: string;
  isCurrent: boolean;
  isRemote: boolean;
  worktreePath: string | null;
  ahead: number;
  behind: number;
}

export interface GitWorktreeInfo {
  path: string;
  branch: string;
  head: string;
  isMainWorktree: boolean;
  isDirty: boolean;
}

export interface WorktreeCreateResult {
  worktreePath: string;
  /** The conceptual branch the user selected */
  branch: string;
  /** The actual git branch in the worktree (may be e.g. `main-wt-2` for duplicate sessions) */
  actualBranch: string;
  isNew: boolean;
}

// ─── Paths ──────────────────────────────────────────────────────────────────

const WORKTREES_BASE = join(homedir(), ".companion", "worktrees");

function sanitizeBranch(branch: string): string {
  return branch.replace(/\//g, "--");
}

function worktreeDir(repoName: string, branch: string): string {
  return join(WORKTREES_BASE, repoName, sanitizeBranch(branch));
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function git(args: string[], cwd: string): Promise<string> {
  const { stdout } = await execFileAsync("git", args, {
    cwd,
    timeout: 10_000,
    encoding: "utf-8",
  });
  return stdout.trim();
}

async function gitSafe(args: string[], cwd: string): Promise<string | null> {
  try {
    return await git(args, cwd);
  } catch {
    return null;
  }
}

// ─── Functions ──────────────────────────────────────────────────────────────

export async function getRepoInfo(cwd: string): Promise<GitRepoInfo | null> {
  const repoRoot = await gitSafe(["rev-parse", "--show-toplevel"], cwd);
  if (!repoRoot) return null;

  const currentBranch = await gitSafe(["rev-parse", "--abbrev-ref", "HEAD"], cwd) || "HEAD";
  const gitDir = await gitSafe(["rev-parse", "--git-dir"], cwd) || "";
  // A linked worktree's .git dir is inside the main repo's .git/worktrees/
  const isWorktree = gitDir.includes("/worktrees/");

  const defaultBranch = await resolveDefaultBranch(repoRoot);

  return {
    repoRoot,
    repoName: basename(repoRoot),
    currentBranch,
    defaultBranch,
    isWorktree,
  };
}

async function resolveDefaultBranch(repoRoot: string): Promise<string> {
  // Try origin HEAD
  const originRef = await gitSafe(["symbolic-ref", "refs/remotes/origin/HEAD"], repoRoot);
  if (originRef) {
    return originRef.replace("refs/remotes/origin/", "");
  }
  // Fallback: check if main or master exists
  const branches = await gitSafe(["branch", "--list", "main", "master"], repoRoot) || "";
  if (branches.includes("main")) return "main";
  if (branches.includes("master")) return "master";
  // Last resort
  return "main";
}

export async function listBranches(repoRoot: string): Promise<GitBranchInfo[]> {
  // Get worktree mappings first
  const worktrees = await listWorktrees(repoRoot);
  const worktreeByBranch = new Map<string, string>();
  for (const wt of worktrees) {
    if (wt.branch) worktreeByBranch.set(wt.branch, wt.path);
  }

  const result: GitBranchInfo[] = [];

  // Local branches
  const localRaw = await gitSafe(
    ["for-each-ref", "--format=%(refname:short)\t%(HEAD)", "refs/heads/"],
    repoRoot,
  );
  if (localRaw) {
    for (const line of localRaw.split("\n")) {
      if (!line.trim()) continue;
      const [name, head] = line.split("\t");
      const isCurrent = head?.trim() === "*";
      const { ahead, behind } = await getBranchStatus(repoRoot, name);
      result.push({
        name,
        isCurrent,
        isRemote: false,
        worktreePath: worktreeByBranch.get(name) || null,
        ahead,
        behind,
      });
    }
  }

  // Remote branches (only those without a local counterpart)
  const localNames = new Set(result.map((b) => b.name));
  const remoteRaw = await gitSafe(
    ["for-each-ref", "--format=%(refname:short)", "refs/remotes/origin/"],
    repoRoot,
  );
  if (remoteRaw) {
    for (const line of remoteRaw.split("\n")) {
      const full = line.trim();
      if (!full || full === "origin/HEAD") continue;
      const name = full.replace("origin/", "");
      if (localNames.has(name)) continue;
      result.push({
        name,
        isCurrent: false,
        isRemote: true,
        worktreePath: null,
        ahead: 0,
        behind: 0,
      });
    }
  }

  return result;
}

export async function listWorktrees(repoRoot: string): Promise<GitWorktreeInfo[]> {
  const raw = await gitSafe(["worktree", "list", "--porcelain"], repoRoot);
  if (!raw) return [];

  const worktrees: GitWorktreeInfo[] = [];
  let current: Partial<GitWorktreeInfo> = {};

  for (const line of raw.split("\n")) {
    if (line.startsWith("worktree ")) {
      if (current.path) {
        worktrees.push(current as GitWorktreeInfo);
      }
      current = { path: line.slice(9), isDirty: false, isMainWorktree: false };
    } else if (line.startsWith("HEAD ")) {
      current.head = line.slice(5);
    } else if (line.startsWith("branch ")) {
      current.branch = line.slice(7).replace("refs/heads/", "");
    } else if (line === "bare") {
      current.isMainWorktree = true;
    } else if (line === "") {
      // End of entry — check if main worktree (first one is always main)
      if (worktrees.length === 0 && current.path) {
        current.isMainWorktree = true;
      }
    }
  }
  // Push last entry
  if (current.path) {
    if (worktrees.length === 0) current.isMainWorktree = true;
    worktrees.push(current as GitWorktreeInfo);
  }

  // Check dirty status for each worktree
  await Promise.all(
    worktrees.map(async (wt) => {
      wt.isDirty = await isWorktreeDirty(wt.path);
    }),
  );

  return worktrees;
}

export async function ensureWorktree(
  repoRoot: string,
  branchName: string,
  options?: { baseBranch?: string; createBranch?: boolean; forceNew?: boolean },
): Promise<WorktreeCreateResult> {
  const repoName = basename(repoRoot);

  // Check if a worktree already exists for this branch
  const existing = await listWorktrees(repoRoot);
  const found = existing.find((wt) => wt.branch === branchName);

  if (found && !options?.forceNew) {
    // Don't reuse the main worktree — it's the original repo checkout
    if (!found.isMainWorktree) {
      return { worktreePath: found.path, branch: branchName, actualBranch: branchName, isNew: false };
    }
  }

  // Find a unique path: append random 4-digit suffix if the base path is taken
  const basePath = worktreeDir(repoName, branchName);
  let targetPath = basePath;
  for (let attempt = 0; attempt < 100 && existsSync(targetPath); attempt++) {
    const suffix = Math.floor(1000 + Math.random() * 9000);
    targetPath = `${basePath}-${suffix}`;
  }
  if (existsSync(targetPath)) {
    targetPath = `${basePath}-${Date.now()}`;
  }

  // Ensure parent directory exists
  mkdirSync(join(WORKTREES_BASE, repoName), { recursive: true });

  // A worktree already exists for this branch — create a new uniquely-named
  // branch so multiple sessions can work on the same branch independently.
  if (found) {
    const commitHash = await git(["rev-parse", "HEAD"], found.path);
    const uniqueBranch = await generateUniqueWorktreeBranch(repoRoot, branchName);
    await git(["worktree", "add", "-b", uniqueBranch, targetPath, commitHash], repoRoot);
    return { worktreePath: targetPath, branch: branchName, actualBranch: uniqueBranch, isNew: false };
  }

  // Check if branch already exists locally or on remote
  const branchExists =
    await gitSafe(["rev-parse", "--verify", `refs/heads/${branchName}`], repoRoot) !== null;
  const remoteBranchExists =
    await gitSafe(["rev-parse", "--verify", `refs/remotes/origin/${branchName}`], repoRoot) !== null;

  if (branchExists) {
    // Worktree add with existing local branch
    await git(["worktree", "add", targetPath, branchName], repoRoot);
    return { worktreePath: targetPath, branch: branchName, actualBranch: branchName, isNew: false };
  }

  if (remoteBranchExists) {
    // Create local tracking branch from remote
    await git(["worktree", "add", "-b", branchName, targetPath, `origin/${branchName}`], repoRoot);
    return { worktreePath: targetPath, branch: branchName, actualBranch: branchName, isNew: false };
  }

  if (options?.createBranch !== false) {
    // Create new branch from base
    const base = options?.baseBranch || await resolveDefaultBranch(repoRoot);
    await git(["worktree", "add", "-b", branchName, targetPath, base], repoRoot);
    return { worktreePath: targetPath, branch: branchName, actualBranch: branchName, isNew: true };
  }

  throw new Error(`Branch "${branchName}" does not exist and createBranch is false`);
}

/**
 * Generate a unique branch name for a companion-managed worktree.
 * Pattern: `{branch}-wt-{random4digit}` (e.g. `main-wt-8374`).
 * Uses random suffixes to avoid collisions with leftover branches.
 */
export async function generateUniqueWorktreeBranch(repoRoot: string, baseBranch: string): Promise<string> {
  for (let attempt = 0; attempt < 100; attempt++) {
    const suffix = Math.floor(1000 + Math.random() * 9000);
    const candidate = `${baseBranch}-wt-${suffix}`;
    if (await gitSafe(["rev-parse", "--verify", `refs/heads/${candidate}`], repoRoot) === null) {
      return candidate;
    }
  }
  // Fallback: use timestamp if all random attempts collide (extremely unlikely)
  return `${baseBranch}-wt-${Date.now()}`;
}

export async function removeWorktree(
  repoRoot: string,
  worktreePath: string,
  options?: { force?: boolean; branchToDelete?: string },
): Promise<{ removed: boolean; reason?: string }> {
  if (!existsSync(worktreePath)) {
    // Already gone, clean up git's reference
    await gitSafe(["worktree", "prune"], repoRoot);
    if (options?.branchToDelete) {
      await gitSafe(["branch", "-D", options.branchToDelete], repoRoot);
    }
    return { removed: true };
  }

  if (!options?.force && await isWorktreeDirty(worktreePath)) {
    return {
      removed: false,
      reason: "Worktree has uncommitted changes. Use force to remove anyway.",
    };
  }

  try {
    const removeArgs = options?.force
      ? ["worktree", "remove", "--force", worktreePath]
      : ["worktree", "remove", worktreePath];
    await git(removeArgs, repoRoot);
    // Clean up the companion-managed branch after worktree removal
    if (options?.branchToDelete) {
      await gitSafe(["branch", "-D", options.branchToDelete], repoRoot);
    }
    return { removed: true };
  } catch (e: unknown) {
    return {
      removed: false,
      reason: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function isWorktreeDirty(worktreePath: string): Promise<boolean> {
  if (!existsSync(worktreePath)) return false;
  const status = await gitSafe(["status", "--porcelain"], worktreePath);
  return status !== null && status.length > 0;
}

export async function gitFetch(cwd: string): Promise<{ success: boolean; output: string }> {
  try {
    const output = await git(["fetch", "--prune"], cwd);
    return { success: true, output };
  } catch (e: unknown) {
    return { success: false, output: e instanceof Error ? e.message : String(e) };
  }
}

export async function gitPull(
  cwd: string,
): Promise<{ success: boolean; output: string }> {
  try {
    const output = await git(["pull"], cwd);
    return { success: true, output };
  } catch (e: unknown) {
    return { success: false, output: e instanceof Error ? e.message : String(e) };
  }
}

export async function checkoutBranch(cwd: string, branchName: string): Promise<void> {
  await git(["checkout", branchName], cwd);
}

export async function getBranchStatus(
  repoRoot: string,
  branchName: string,
): Promise<{ ahead: number; behind: number }> {
  const raw = await gitSafe(
    ["rev-list", "--left-right", "--count", `origin/${branchName}...${branchName}`],
    repoRoot,
  );
  if (!raw) return { ahead: 0, behind: 0 };
  const [behind, ahead] = raw.split(/\s+/).map(Number);
  return { ahead: ahead || 0, behind: behind || 0 };
}
