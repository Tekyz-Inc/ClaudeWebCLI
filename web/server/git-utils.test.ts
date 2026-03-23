import { vi, describe, it, expect, beforeEach } from "vitest";

// ─── Hoisted mocks ───────────────────────────────────────────────────────────

const mockHomedir = vi.hoisted(() => {
  let dir = "/fake/home";
  return { get: () => dir, set: (d: string) => { dir = d; } };
});

const mockExecFile = vi.hoisted(() => vi.fn());
const mockExistsSync = vi.hoisted(() => vi.fn());
const mockMkdirSync = vi.hoisted(() => vi.fn());

vi.mock("node:os", () => ({ homedir: () => mockHomedir.get() }));
vi.mock("node:util", () => ({
  promisify: (fn: unknown) => {
    // Return mockExecFile for any promisified function (execFile)
    return mockExecFile;
  },
}));
vi.mock("node:child_process", () => ({ execFile: vi.fn() }));
vi.mock("node:fs", () => ({
  existsSync: mockExistsSync,
  mkdirSync: mockMkdirSync,
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Mock execFile (promisified) to match git commands based on argv args array.
 * pattern can be a string (checks args.join(" ")) or RegExp.
 */
function mockGitCommand(pattern: string | RegExp, result: string) {
  mockExecFile.mockImplementation((_bin: string, args: string[]) => {
    const cmd = args.join(" ");
    if (typeof pattern === "string" ? cmd.includes(pattern) : pattern.test(cmd)) {
      return Promise.resolve({ stdout: result, stderr: "" });
    }
    return Promise.reject(new Error(`Unexpected git command: ${cmd}`));
  });
}

function mockGitCommands(map: Record<string, string | Error>) {
  mockExecFile.mockImplementation((_bin: string, args: string[]) => {
    const cmd = args.join(" ");
    for (const [pattern, result] of Object.entries(map)) {
      if (cmd.includes(pattern)) {
        if (result instanceof Error) return Promise.reject(result);
        return Promise.resolve({ stdout: result, stderr: "" });
      }
    }
    return Promise.reject(new Error(`Unmocked git command: ${cmd}`));
  });
}

// ─── Dynamic import with module reset ────────────────────────────────────────

let gitUtils: typeof import("./git-utils.js");

beforeEach(async () => {
  vi.resetModules();
  mockExecFile.mockReset();
  mockExistsSync.mockReset();
  mockMkdirSync.mockReset();
  mockHomedir.set("/fake/home");
  gitUtils = await import("./git-utils.js");
});

// ─── getRepoInfo ─────────────────────────────────────────────────────────────

describe("getRepoInfo", () => {
  it("returns null for a non-git directory", async () => {
    mockExecFile.mockRejectedValue(new Error("fatal: not a git repository"));

    const result = await gitUtils.getRepoInfo("/tmp/not-a-repo");
    expect(result).toBeNull();
  });

  it("returns correct repo info for a standard git repo", async () => {
    mockGitCommands({
      "rev-parse --show-toplevel": "/home/user/my-project",
      "rev-parse --abbrev-ref HEAD": "feat/cool-feature",
      "rev-parse --git-dir": ".git",
      "symbolic-ref refs/remotes/origin/HEAD": "refs/remotes/origin/main",
    });

    const result = await gitUtils.getRepoInfo("/home/user/my-project");
    expect(result).toEqual({
      repoRoot: "/home/user/my-project",
      repoName: "my-project",
      currentBranch: "feat/cool-feature",
      defaultBranch: "main",
      isWorktree: false,
    });
  });

  it("detects worktree when git-dir contains /worktrees/", async () => {
    mockGitCommands({
      "rev-parse --show-toplevel": "/fake/home/.companion/worktrees/proj/feat--x",
      "rev-parse --abbrev-ref HEAD": "feat/x",
      "rev-parse --git-dir": "/home/user/proj/.git/worktrees/feat--x",
      "symbolic-ref refs/remotes/origin/HEAD": "refs/remotes/origin/main",
    });

    const result = await gitUtils.getRepoInfo("/fake/home/.companion/worktrees/proj/feat--x");
    expect(result).not.toBeNull();
    expect(result!.isWorktree).toBe(true);
  });

  it("falls back to 'HEAD' when branch detection fails", async () => {
    mockExecFile.mockImplementation((_bin: string, args: string[]) => {
      const cmd = args.join(" ");
      if (cmd.includes("rev-parse --show-toplevel")) return Promise.resolve({ stdout: "/repo", stderr: "" });
      if (cmd.includes("rev-parse --abbrev-ref HEAD")) return Promise.reject(new Error("detached HEAD"));
      if (cmd.includes("rev-parse --git-dir")) return Promise.resolve({ stdout: ".git", stderr: "" });
      if (cmd.includes("symbolic-ref refs/remotes/origin/HEAD")) return Promise.resolve({ stdout: "refs/remotes/origin/main", stderr: "" });
      return Promise.reject(new Error(`Unmocked: ${cmd}`));
    });

    const result = await gitUtils.getRepoInfo("/repo");
    expect(result).not.toBeNull();
    expect(result!.currentBranch).toBe("HEAD");
  });

  it("resolves default branch via origin HEAD", async () => {
    mockGitCommands({
      "rev-parse --show-toplevel": "/repo",
      "rev-parse --abbrev-ref HEAD": "develop",
      "rev-parse --git-dir": ".git",
      "symbolic-ref refs/remotes/origin/HEAD": "refs/remotes/origin/develop",
    });

    const result = await gitUtils.getRepoInfo("/repo");
    expect(result!.defaultBranch).toBe("develop");
  });

  it("falls back to 'main' when origin HEAD and master are unavailable", async () => {
    mockExecFile.mockImplementation((_bin: string, args: string[]) => {
      const cmd = args.join(" ");
      if (cmd.includes("rev-parse --show-toplevel")) return Promise.resolve({ stdout: "/repo", stderr: "" });
      if (cmd.includes("rev-parse --abbrev-ref HEAD")) return Promise.resolve({ stdout: "feature", stderr: "" });
      if (cmd.includes("rev-parse --git-dir")) return Promise.resolve({ stdout: ".git", stderr: "" });
      if (cmd.includes("symbolic-ref refs/remotes/origin/HEAD")) return Promise.reject(new Error("no origin"));
      if (cmd.includes("branch --list main master")) return Promise.resolve({ stdout: "", stderr: "" });
      return Promise.reject(new Error(`Unmocked: ${cmd}`));
    });

    const result = await gitUtils.getRepoInfo("/repo");
    expect(result!.defaultBranch).toBe("main");
  });

  it("falls back to 'master' when origin HEAD fails and only master exists", async () => {
    mockExecFile.mockImplementation((_bin: string, args: string[]) => {
      const cmd = args.join(" ");
      if (cmd.includes("rev-parse --show-toplevel")) return Promise.resolve({ stdout: "/repo", stderr: "" });
      if (cmd.includes("rev-parse --abbrev-ref HEAD")) return Promise.resolve({ stdout: "feature", stderr: "" });
      if (cmd.includes("rev-parse --git-dir")) return Promise.resolve({ stdout: ".git", stderr: "" });
      if (cmd.includes("symbolic-ref refs/remotes/origin/HEAD")) return Promise.reject(new Error("no origin"));
      if (cmd.includes("branch --list main master")) return Promise.resolve({ stdout: "  master", stderr: "" });
      return Promise.reject(new Error(`Unmocked: ${cmd}`));
    });

    const result = await gitUtils.getRepoInfo("/repo");
    expect(result!.defaultBranch).toBe("master");
  });
});

// ─── listBranches ────────────────────────────────────────────────────────────

describe("listBranches", () => {
  it("parses local branches with current marker", async () => {
    mockExecFile.mockImplementation((_bin: string, args: string[]) => {
      const cmd = args.join(" ");
      if (cmd.includes("worktree list --porcelain")) return Promise.resolve({ stdout: "", stderr: "" });
      if (cmd.includes("for-each-ref") && cmd.includes("refs/heads/")) {
        return Promise.resolve({ stdout: "main\t*\nfeat/login\t ", stderr: "" });
      }
      if (cmd.includes("for-each-ref") && cmd.includes("refs/remotes/origin/")) return Promise.resolve({ stdout: "", stderr: "" });
      if (cmd.includes("rev-list --left-right --count")) return Promise.resolve({ stdout: "0\t0", stderr: "" });
      return Promise.reject(new Error(`Unmocked: ${cmd}`));
    });

    const branches = await gitUtils.listBranches("/repo");
    const main = branches.find((b) => b.name === "main");
    const feat = branches.find((b) => b.name === "feat/login");

    expect(main).toBeDefined();
    expect(main!.isCurrent).toBe(true);
    expect(main!.isRemote).toBe(false);

    expect(feat).toBeDefined();
    expect(feat!.isCurrent).toBe(false);
  });

  it("includes remote-only branches", async () => {
    mockExecFile.mockImplementation((_bin: string, args: string[]) => {
      const cmd = args.join(" ");
      if (cmd.includes("worktree list --porcelain")) return Promise.resolve({ stdout: "", stderr: "" });
      if (cmd.includes("for-each-ref") && cmd.includes("refs/heads/")) {
        return Promise.resolve({ stdout: "main\t*", stderr: "" });
      }
      if (cmd.includes("for-each-ref") && cmd.includes("refs/remotes/origin/")) {
        return Promise.resolve({ stdout: "origin/feat/remote-branch", stderr: "" });
      }
      if (cmd.includes("rev-list --left-right --count")) return Promise.resolve({ stdout: "0\t0", stderr: "" });
      return Promise.reject(new Error(`Unmocked: ${cmd}`));
    });

    const branches = await gitUtils.listBranches("/repo");
    const remote = branches.find((b) => b.name === "feat/remote-branch");

    expect(remote).toBeDefined();
    expect(remote!.isRemote).toBe(true);
    expect(remote!.isCurrent).toBe(false);
    expect(remote!.ahead).toBe(0);
    expect(remote!.behind).toBe(0);
  });

  it("excludes origin/HEAD from remote branches", async () => {
    mockExecFile.mockImplementation((_bin: string, args: string[]) => {
      const cmd = args.join(" ");
      if (cmd.includes("worktree list --porcelain")) return Promise.resolve({ stdout: "", stderr: "" });
      if (cmd.includes("for-each-ref") && cmd.includes("refs/heads/")) return Promise.resolve({ stdout: "", stderr: "" });
      if (cmd.includes("for-each-ref") && cmd.includes("refs/remotes/origin/")) {
        return Promise.resolve({ stdout: "origin/HEAD\norigin/main", stderr: "" });
      }
      if (cmd.includes("rev-list --left-right --count")) return Promise.resolve({ stdout: "0\t0", stderr: "" });
      return Promise.reject(new Error(`Unmocked: ${cmd}`));
    });

    const branches = await gitUtils.listBranches("/repo");
    expect(branches.find((b) => b.name === "HEAD")).toBeUndefined();
    expect(branches.find((b) => b.name === "main")).toBeDefined();
  });

  it("includes ahead/behind counts for local branches", async () => {
    mockExecFile.mockImplementation((_bin: string, args: string[]) => {
      const cmd = args.join(" ");
      if (cmd.includes("worktree list --porcelain")) return Promise.resolve({ stdout: "", stderr: "" });
      if (cmd.includes("for-each-ref") && cmd.includes("refs/heads/")) {
        return Promise.resolve({ stdout: "dev\t ", stderr: "" });
      }
      if (cmd.includes("for-each-ref") && cmd.includes("refs/remotes/origin/")) return Promise.resolve({ stdout: "", stderr: "" });
      if (cmd.includes("rev-list --left-right --count")) return Promise.resolve({ stdout: "3\t5", stderr: "" });
      return Promise.reject(new Error(`Unmocked: ${cmd}`));
    });

    const branches = await gitUtils.listBranches("/repo");
    const dev = branches.find((b) => b.name === "dev");
    expect(dev).toBeDefined();
    // In the source: [behind, ahead] = raw.split(...).map(Number)
    expect(dev!.ahead).toBe(5);
    expect(dev!.behind).toBe(3);
  });

  it("returns empty array on git failure", async () => {
    mockExecFile.mockRejectedValue(new Error("git failed"));

    const branches = await gitUtils.listBranches("/repo");
    expect(branches).toEqual([]);
  });
});

// ─── listWorktrees ───────────────────────────────────────────────────────────

describe("listWorktrees", () => {
  it("parses porcelain output correctly", async () => {
    const porcelain = [
      "worktree /home/user/project",
      "HEAD abc1234567890abcdef1234567890abcdef123456",
      "branch refs/heads/main",
      "",
      "worktree /fake/home/.companion/worktrees/project/feat--x",
      "HEAD def4567890abcdef1234567890abcdef12345678",
      "branch refs/heads/feat/x",
      "",
    ].join("\n");

    mockExecFile.mockImplementation((_bin: string, args: string[]) => {
      const cmd = args.join(" ");
      if (cmd.includes("worktree list --porcelain")) return Promise.resolve({ stdout: porcelain, stderr: "" });
      // isWorktreeDirty calls
      if (cmd.includes("status --porcelain")) return Promise.resolve({ stdout: "", stderr: "" });
      return Promise.reject(new Error(`Unmocked: ${cmd}`));
    });
    mockExistsSync.mockReturnValue(true);

    const worktrees = await gitUtils.listWorktrees("/home/user/project");
    expect(worktrees).toHaveLength(2);
    expect(worktrees[0].path).toBe("/home/user/project");
    expect(worktrees[1].path).toBe("/fake/home/.companion/worktrees/project/feat--x");
  });

  it("marks first worktree as main", async () => {
    const porcelain = [
      "worktree /home/user/project",
      "HEAD abc123",
      "branch refs/heads/main",
      "",
      "worktree /tmp/wt",
      "HEAD def456",
      "branch refs/heads/other",
      "",
    ].join("\n");

    mockExecFile.mockImplementation((_bin: string, args: string[]) => {
      const cmd = args.join(" ");
      if (cmd.includes("worktree list --porcelain")) return Promise.resolve({ stdout: porcelain, stderr: "" });
      if (cmd.includes("status --porcelain")) return Promise.resolve({ stdout: "", stderr: "" });
      return Promise.reject(new Error(`Unmocked: ${cmd}`));
    });
    mockExistsSync.mockReturnValue(true);

    const worktrees = await gitUtils.listWorktrees("/home/user/project");
    expect(worktrees[0].isMainWorktree).toBe(true);
    expect(worktrees[1].isMainWorktree).toBe(false);
  });

  it("strips refs/heads/ from branch names", async () => {
    const porcelain = [
      "worktree /repo",
      "HEAD abc123",
      "branch refs/heads/feat/something",
      "",
    ].join("\n");

    mockExecFile.mockImplementation((_bin: string, args: string[]) => {
      const cmd = args.join(" ");
      if (cmd.includes("worktree list --porcelain")) return Promise.resolve({ stdout: porcelain, stderr: "" });
      if (cmd.includes("status --porcelain")) return Promise.resolve({ stdout: "", stderr: "" });
      return Promise.reject(new Error(`Unmocked: ${cmd}`));
    });
    mockExistsSync.mockReturnValue(true);

    const worktrees = await gitUtils.listWorktrees("/repo");
    expect(worktrees[0].branch).toBe("feat/something");
  });

  it("returns empty array on failure", async () => {
    mockExecFile.mockRejectedValue(new Error("git failed"));

    const worktrees = await gitUtils.listWorktrees("/repo");
    expect(worktrees).toEqual([]);
  });
});

// ─── ensureWorktree ──────────────────────────────────────────────────────────

describe("ensureWorktree", () => {
  it("returns existing worktree without creating a new one", async () => {
    const porcelain = [
      "worktree /repo",
      "HEAD abc123",
      "branch refs/heads/main",
      "",
      "worktree /existing/path",
      "HEAD def456",
      "branch refs/heads/feat/existing",
      "",
    ].join("\n");

    mockExecFile.mockImplementation((_bin: string, args: string[]) => {
      const cmd = args.join(" ");
      if (cmd.includes("worktree list --porcelain")) return Promise.resolve({ stdout: porcelain, stderr: "" });
      if (cmd.includes("status --porcelain")) return Promise.resolve({ stdout: "", stderr: "" });
      return Promise.reject(new Error(`Unmocked: ${cmd}`));
    });
    mockExistsSync.mockReturnValue(true);

    const result = await gitUtils.ensureWorktree("/repo", "feat/existing");
    expect(result.worktreePath).toBe("/existing/path");
    expect(result.branch).toBe("feat/existing");
    expect(result.actualBranch).toBe("feat/existing");
    expect(result.isNew).toBe(false);
    // Should NOT have called worktree add
    const addCalls = mockExecFile.mock.calls.filter((c: unknown[]) =>
      (c[1] as string[]).join(" ").includes("worktree add"),
    );
    expect(addCalls).toHaveLength(0);
  });

  it("creates worktree for an existing local branch", async () => {
    mockExecFile.mockImplementation((_bin: string, args: string[]) => {
      const cmd = args.join(" ");
      // listWorktrees
      if (cmd.includes("worktree list --porcelain")) {
        return Promise.resolve({ stdout: "worktree /repo\nHEAD abc\nbranch refs/heads/main\n", stderr: "" });
      }
      if (cmd.includes("status --porcelain")) return Promise.resolve({ stdout: "", stderr: "" });
      // Branch exists locally
      if (cmd.includes("rev-parse --verify refs/heads/feat/local")) return Promise.resolve({ stdout: "abc123", stderr: "" });
      // worktree add
      if (cmd.includes("worktree add")) return Promise.resolve({ stdout: "", stderr: "" });
      return Promise.reject(new Error(`Unmocked: ${cmd}`));
    });
    // Target path doesn't exist yet (no suffix needed)
    mockExistsSync.mockReturnValue(false);

    const result = await gitUtils.ensureWorktree("/repo", "feat/local");
    expect(result.worktreePath).toBe("/fake/home/.companion/worktrees/repo/feat--local");
    expect(result.actualBranch).toBe("feat/local");
    expect(result.isNew).toBe(false);

    const addCall = mockExecFile.mock.calls.find((c: unknown[]) =>
      (c[1] as string[]).join(" ").includes("worktree add"),
    );
    expect(addCall).toBeDefined();
    // Should NOT have -b flag for existing branch
    expect((addCall![1] as string[])).not.toContain("-b");
  });

  it("creates tracking branch from remote", async () => {
    mockExecFile.mockImplementation((_bin: string, args: string[]) => {
      const cmd = args.join(" ");
      if (cmd.includes("worktree list --porcelain")) {
        return Promise.resolve({ stdout: "worktree /repo\nHEAD abc\nbranch refs/heads/main\n", stderr: "" });
      }
      if (cmd.includes("status --porcelain")) return Promise.resolve({ stdout: "", stderr: "" });
      // Local branch does NOT exist
      if (cmd.includes("rev-parse --verify refs/heads/feat/remote"))
        return Promise.reject(new Error("not found"));
      // Remote branch exists
      if (cmd.includes("rev-parse --verify refs/remotes/origin/feat/remote"))
        return Promise.resolve({ stdout: "def456", stderr: "" });
      // worktree add -b
      if (cmd.includes("worktree add")) return Promise.resolve({ stdout: "", stderr: "" });
      return Promise.reject(new Error(`Unmocked: ${cmd}`));
    });
    // Target path doesn't exist yet
    mockExistsSync.mockReturnValue(false);

    const result = await gitUtils.ensureWorktree("/repo", "feat/remote");
    expect(result.actualBranch).toBe("feat/remote");
    expect(result.isNew).toBe(false);

    const addCall = mockExecFile.mock.calls.find((c: unknown[]) =>
      (c[1] as string[]).join(" ").includes("worktree add") &&
      (c[1] as string[]).includes("-b"),
    );
    expect(addCall).toBeDefined();
    expect((addCall![1] as string[])).toContain("origin/feat/remote");
  });

  it("creates new branch from base when branch does not exist anywhere", async () => {
    mockExecFile.mockImplementation((_bin: string, args: string[]) => {
      const cmd = args.join(" ");
      if (cmd.includes("worktree list --porcelain")) {
        return Promise.resolve({ stdout: "worktree /repo\nHEAD abc\nbranch refs/heads/main\n", stderr: "" });
      }
      if (cmd.includes("status --porcelain")) return Promise.resolve({ stdout: "", stderr: "" });
      // Neither local nor remote branch exists
      if (cmd.includes("rev-parse --verify")) return Promise.reject(new Error("not found"));
      // resolveDefaultBranch
      if (cmd.includes("symbolic-ref refs/remotes/origin/HEAD"))
        return Promise.resolve({ stdout: "refs/remotes/origin/main", stderr: "" });
      // worktree add -b
      if (cmd.includes("worktree add")) return Promise.resolve({ stdout: "", stderr: "" });
      return Promise.reject(new Error(`Unmocked: ${cmd}`));
    });
    // Target path doesn't exist yet
    mockExistsSync.mockReturnValue(false);

    const result = await gitUtils.ensureWorktree("/repo", "feat/new", { baseBranch: "develop" });
    expect(result.isNew).toBe(true);
    expect(result.branch).toBe("feat/new");
    expect(result.actualBranch).toBe("feat/new");

    const addCall = mockExecFile.mock.calls.find((c: unknown[]) =>
      (c[1] as string[]).join(" ").includes("worktree add"),
    );
    expect(addCall).toBeDefined();
    expect((addCall![1] as string[])).toContain("develop");
  });

  it("throws when createBranch=false and branch does not exist", async () => {
    mockExecFile.mockImplementation((_bin: string, args: string[]) => {
      const cmd = args.join(" ");
      if (cmd.includes("worktree list --porcelain")) {
        return Promise.resolve({ stdout: "worktree /repo\nHEAD abc\nbranch refs/heads/main\n", stderr: "" });
      }
      if (cmd.includes("status --porcelain")) return Promise.resolve({ stdout: "", stderr: "" });
      if (cmd.includes("rev-parse --verify")) return Promise.reject(new Error("not found"));
      return Promise.reject(new Error(`Unmocked: ${cmd}`));
    });
    // Target path doesn't exist yet
    mockExistsSync.mockReturnValue(false);

    await expect(
      gitUtils.ensureWorktree("/repo", "feat/missing", { createBranch: false }),
    ).rejects.toThrow('Branch "feat/missing" does not exist and createBranch is false');
  });

  it("calls mkdirSync with recursive option when creating worktree", async () => {
    mockExecFile.mockImplementation((_bin: string, args: string[]) => {
      const cmd = args.join(" ");
      if (cmd.includes("worktree list --porcelain")) {
        return Promise.resolve({ stdout: "worktree /repo\nHEAD abc\nbranch refs/heads/main\n", stderr: "" });
      }
      if (cmd.includes("status --porcelain")) return Promise.resolve({ stdout: "", stderr: "" });
      if (cmd.includes("rev-parse --verify refs/heads/feat/new")) return Promise.resolve({ stdout: "abc", stderr: "" });
      if (cmd.includes("worktree add")) return Promise.resolve({ stdout: "", stderr: "" });
      return Promise.reject(new Error(`Unmocked: ${cmd}`));
    });
    // Target path doesn't exist yet
    mockExistsSync.mockReturnValue(false);

    await gitUtils.ensureWorktree("/repo", "feat/new");

    expect(mockMkdirSync).toHaveBeenCalledWith(
      "/fake/home/.companion/worktrees/repo",
      { recursive: true },
    );
  });

  it("does not reuse the main worktree even when branch matches", async () => {
    // Main worktree is on "main", and we request a worktree for "main"
    const porcelain = [
      "worktree /repo",
      "HEAD abc123",
      "branch refs/heads/main",
      "",
    ].join("\n");

    mockExecFile.mockImplementation((_bin: string, args: string[]) => {
      const cmd = args.join(" ");
      if (cmd.includes("worktree list --porcelain")) return Promise.resolve({ stdout: porcelain, stderr: "" });
      if (cmd.includes("status --porcelain")) return Promise.resolve({ stdout: "", stderr: "" });
      if (cmd.includes("rev-parse HEAD")) return Promise.resolve({ stdout: "abc123", stderr: "" });
      // generateUniqueWorktreeBranch checks for existing branches (random suffix)
      if (/rev-parse --verify refs\/heads\/main-wt-\d{4}/.test(cmd)) return Promise.reject(new Error("not found"));
      if (cmd.includes("worktree add")) return Promise.resolve({ stdout: "", stderr: "" });
      return Promise.reject(new Error(`Unmocked: ${cmd}`));
    });
    // Target path doesn't exist yet
    mockExistsSync.mockReturnValue(false);

    const result = await gitUtils.ensureWorktree("/repo", "main");
    // Should NOT return the main repo path
    expect(result.worktreePath).not.toBe("/repo");
    expect(result.worktreePath).toBe("/fake/home/.companion/worktrees/repo/main");
    expect(result.branch).toBe("main");
    expect(result.actualBranch).toMatch(/^main-wt-\d{4}$/);
    // Should create a branch-tracking worktree
    const addCall = mockExecFile.mock.calls.find((c: unknown[]) =>
      (c[1] as string[]).join(" ").includes("worktree add"),
    );
    expect(addCall).toBeDefined();
    expect((addCall![1] as string[]).join(" ")).toMatch(/main-wt-\d{4}/);
    expect((addCall![1] as string[])).toContain("abc123");
  });

  it("creates unique paths with random suffix when base path exists", async () => {
    mockExecFile.mockImplementation((_bin: string, args: string[]) => {
      const cmd = args.join(" ");
      if (cmd.includes("worktree list --porcelain")) {
        return Promise.resolve({ stdout: "worktree /repo\nHEAD abc\nbranch refs/heads/main\n", stderr: "" });
      }
      if (cmd.includes("status --porcelain")) return Promise.resolve({ stdout: "", stderr: "" });
      if (cmd.includes("rev-parse --verify refs/heads/feat/x")) return Promise.resolve({ stdout: "abc123", stderr: "" });
      if (cmd.includes("worktree add")) return Promise.resolve({ stdout: "", stderr: "" });
      return Promise.reject(new Error(`Unmocked: ${cmd}`));
    });
    // Base path exists, random suffix path does not
    const basePath = "/fake/home/.companion/worktrees/repo/feat--x";
    mockExistsSync.mockImplementation((path: string) => {
      if (path === basePath) return true;
      return false; // Any random-suffixed path is free
    });

    const result = await gitUtils.ensureWorktree("/repo", "feat/x");
    expect(result.worktreePath).toMatch(new RegExp(`^${basePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-\\d{4}$`));
  });

  it("creates branch-tracking worktree when forceNew=true and worktree already exists", async () => {
    const porcelain = [
      "worktree /repo",
      "HEAD abc123",
      "branch refs/heads/main",
      "",
      "worktree /existing/wt",
      "HEAD def456",
      "branch refs/heads/feat/existing",
      "",
    ].join("\n");

    mockExecFile.mockImplementation((_bin: string, args: string[]) => {
      const cmd = args.join(" ");
      if (cmd.includes("worktree list --porcelain")) return Promise.resolve({ stdout: porcelain, stderr: "" });
      if (cmd.includes("status --porcelain")) return Promise.resolve({ stdout: "", stderr: "" });
      if (cmd.includes("rev-parse HEAD")) return Promise.resolve({ stdout: "def456", stderr: "" });
      // generateUniqueWorktreeBranch checks (random suffix)
      if (/rev-parse --verify refs\/heads\/feat\/existing-wt-\d{4}/.test(cmd)) return Promise.reject(new Error("not found"));
      if (cmd.includes("worktree add")) return Promise.resolve({ stdout: "", stderr: "" });
      return Promise.reject(new Error(`Unmocked: ${cmd}`));
    });
    // Target path doesn't exist yet
    mockExistsSync.mockReturnValue(false);

    const result = await gitUtils.ensureWorktree("/repo", "feat/existing", { forceNew: true });
    expect(result.worktreePath).toBe("/fake/home/.companion/worktrees/repo/feat--existing");
    expect(result.branch).toBe("feat/existing");
    expect(result.actualBranch).toMatch(/^feat\/existing-wt-\d{4}$/);

    const addCall = mockExecFile.mock.calls.find((c: unknown[]) =>
      (c[1] as string[]).join(" ").includes("worktree add"),
    );
    expect(addCall).toBeDefined();
    expect((addCall![1] as string[]).join(" ")).toMatch(/feat\/existing-wt-\d{4}/);
  });
});

// ─── generateUniqueWorktreeBranch ────────────────────────────────────────────

describe("generateUniqueWorktreeBranch", () => {
  it("returns branch-wt-{random4digit} when no suffixed branches exist", async () => {
    mockExecFile.mockImplementation((_bin: string, args: string[]) => {
      const cmd = args.join(" ");
      if (cmd.includes("rev-parse --verify refs/heads/main-wt-")) return Promise.reject(new Error("not found"));
      return Promise.reject(new Error(`Unmocked: ${cmd}`));
    });

    const result = await gitUtils.generateUniqueWorktreeBranch("/repo", "main");
    expect(result).toMatch(/^main-wt-\d{4}$/);
  });

  it("retries with a new random suffix on collision", async () => {
    // Mock Math.random to return deterministic values
    const origRandom = Math.random;
    const randomValues = [0.5, 0.7]; // → suffixes 5500, 7300
    let callIdx = 0;
    Math.random = () => randomValues[callIdx++] ?? origRandom();

    mockExecFile.mockImplementation((_bin: string, args: string[]) => {
      const cmd = args.join(" ");
      // First candidate (5500) already exists
      if (cmd.includes("rev-parse --verify refs/heads/feat/x-wt-5500")) return Promise.resolve({ stdout: "abc", stderr: "" });
      // Second candidate (7300) is free
      if (cmd.includes("rev-parse --verify refs/heads/feat/x-wt-7300")) return Promise.reject(new Error("not found"));
      return Promise.reject(new Error(`Unmocked: ${cmd}`));
    });

    const result = await gitUtils.generateUniqueWorktreeBranch("/repo", "feat/x");
    expect(result).toBe("feat/x-wt-7300");

    Math.random = origRandom;
  });
});

// ─── removeWorktree ──────────────────────────────────────────────────────────

describe("removeWorktree", () => {
  it("prunes when worktree path does not exist on disk", async () => {
    mockExistsSync.mockReturnValue(false);
    mockGitCommand("worktree prune", "");

    const result = await gitUtils.removeWorktree("/repo", "/gone/path");
    expect(result.removed).toBe(true);
    expect(result.reason).toBeUndefined();

    const pruneCalls = mockExecFile.mock.calls.filter((c: unknown[]) =>
      (c[1] as string[]).join(" ").includes("worktree prune"),
    );
    expect(pruneCalls).toHaveLength(1);
  });

  it("deletes branchToDelete after pruning a missing worktree", async () => {
    mockExistsSync.mockReturnValue(false);
    mockGitCommands({
      "worktree prune": "",
      "branch -D main-wt-2": "",
    });

    const result = await gitUtils.removeWorktree("/repo", "/gone/path", { branchToDelete: "main-wt-2" });
    expect(result.removed).toBe(true);

    const branchDeleteCalls = mockExecFile.mock.calls.filter((c: unknown[]) =>
      (c[1] as string[]).join(" ").includes("branch -D main-wt-2"),
    );
    expect(branchDeleteCalls).toHaveLength(1);
  });

  it("deletes branchToDelete after successful worktree removal", async () => {
    mockExistsSync.mockReturnValue(true);
    mockExecFile.mockImplementation((_bin: string, args: string[]) => {
      const cmd = args.join(" ");
      if (cmd.includes("status --porcelain")) return Promise.resolve({ stdout: "", stderr: "" });
      if (cmd.includes("worktree remove")) return Promise.resolve({ stdout: "", stderr: "" });
      if (cmd.includes("branch -D feat-wt-3")) return Promise.resolve({ stdout: "", stderr: "" });
      return Promise.reject(new Error(`Unmocked: ${cmd}`));
    });

    const result = await gitUtils.removeWorktree("/repo", "/wt/path", { branchToDelete: "feat-wt-3" });
    expect(result.removed).toBe(true);

    const branchDeleteCalls = mockExecFile.mock.calls.filter((c: unknown[]) =>
      (c[1] as string[]).join(" ").includes("branch -D feat-wt-3"),
    );
    expect(branchDeleteCalls).toHaveLength(1);
  });

  it("refuses to remove dirty worktree without force", async () => {
    mockExistsSync.mockReturnValue(true);
    mockGitCommand("status --porcelain", " M dirty-file.ts");

    const result = await gitUtils.removeWorktree("/repo", "/wt/path");
    expect(result.removed).toBe(false);
    expect(result.reason).toContain("uncommitted changes");
  });

  it("force-removes dirty worktree", async () => {
    // existsSync: first call for removeWorktree check, second for isWorktreeDirty
    mockExistsSync.mockReturnValue(true);
    mockExecFile.mockImplementation((_bin: string, args: string[]) => {
      const cmd = args.join(" ");
      if (cmd.includes("status --porcelain")) return Promise.resolve({ stdout: " M dirty.ts", stderr: "" });
      if (cmd.includes("worktree remove") && args.includes("--force")) return Promise.resolve({ stdout: "", stderr: "" });
      return Promise.reject(new Error(`Unmocked: ${cmd}`));
    });

    const result = await gitUtils.removeWorktree("/repo", "/wt/path", { force: true });
    expect(result.removed).toBe(true);
  });

  it("returns reason on error during removal", async () => {
    mockExistsSync.mockReturnValue(true);
    mockExecFile.mockImplementation((_bin: string, args: string[]) => {
      const cmd = args.join(" ");
      if (cmd.includes("status --porcelain")) return Promise.resolve({ stdout: "", stderr: "" });
      if (cmd.includes("worktree remove"))
        return Promise.reject(new Error("worktree is locked"));
      return Promise.reject(new Error(`Unmocked: ${cmd}`));
    });

    const result = await gitUtils.removeWorktree("/repo", "/wt/path");
    expect(result.removed).toBe(false);
    expect(result.reason).toContain("worktree is locked");
  });
});

// ─── isWorktreeDirty ─────────────────────────────────────────────────────────

describe("isWorktreeDirty", () => {
  it("returns false when path does not exist", async () => {
    mockExistsSync.mockReturnValue(false);

    expect(await gitUtils.isWorktreeDirty("/nonexistent")).toBe(false);
  });

  it("returns false when status is empty", async () => {
    mockExistsSync.mockReturnValue(true);
    mockGitCommand("status --porcelain", "");

    expect(await gitUtils.isWorktreeDirty("/clean/repo")).toBe(false);
  });

  it("returns true when status has output", async () => {
    mockExistsSync.mockReturnValue(true);
    mockGitCommand("status --porcelain", " M file.ts\n?? new-file.ts");

    expect(await gitUtils.isWorktreeDirty("/dirty/repo")).toBe(true);
  });
});

// ─── getBranchStatus ─────────────────────────────────────────────────────────

describe("getBranchStatus", () => {
  it("parses ahead/behind counts correctly", async () => {
    mockGitCommand("rev-list --left-right --count", "7\t12");

    const status = await gitUtils.getBranchStatus("/repo", "feat/branch");
    // Source: [behind, ahead] = raw.split(...).map(Number)
    expect(status.ahead).toBe(12);
    expect(status.behind).toBe(7);
  });

  it("returns 0/0 when there is no upstream", async () => {
    mockExecFile.mockRejectedValue(new Error("no upstream configured"));

    const status = await gitUtils.getBranchStatus("/repo", "local-only");
    expect(status.ahead).toBe(0);
    expect(status.behind).toBe(0);
  });

  it("handles zero ahead/behind", async () => {
    mockGitCommand("rev-list --left-right --count", "0\t0");

    const status = await gitUtils.getBranchStatus("/repo", "main");
    expect(status.ahead).toBe(0);
    expect(status.behind).toBe(0);
  });
});
