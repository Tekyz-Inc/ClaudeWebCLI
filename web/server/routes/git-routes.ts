import type { Hono } from "hono";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as gitUtils from "../git-utils.js";
import { EnsureWorktreeBody, RemoveWorktreeBody, GitFetchBody, GitPullBody } from "./schemas.js";

const execFileAsync = promisify(execFile);

export function registerGitRoutes(api: Hono): void {
  api.get("/git/repo-info", async (c) => {
    const path = c.req.query("path");
    if (!path) return c.json({ error: "path required" }, 400);
    const info = await gitUtils.getRepoInfo(path);
    if (!info) return c.json({ error: "Not a git repository" }, 400);
    return c.json(info);
  });

  api.get("/git/branches", async (c) => {
    const repoRoot = c.req.query("repoRoot");
    if (!repoRoot) return c.json({ error: "repoRoot required" }, 400);
    try {
      return c.json(await gitUtils.listBranches(repoRoot));
    } catch (e: unknown) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  });

  api.get("/git/worktrees", async (c) => {
    const repoRoot = c.req.query("repoRoot");
    if (!repoRoot) return c.json({ error: "repoRoot required" }, 400);
    try {
      return c.json(await gitUtils.listWorktrees(repoRoot));
    } catch (e: unknown) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  });

  api.post("/git/worktree", async (c) => {
    const raw = await c.req.json().catch(() => ({}));
    const parsed = EnsureWorktreeBody.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: "repoRoot and branch required" }, 400);
    }
    const { repoRoot, branch, baseBranch, createBranch } = parsed.data;
    try {
      const result = await gitUtils.ensureWorktree(repoRoot, branch, { baseBranch, createBranch });
      return c.json(result);
    } catch (e: unknown) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  });

  api.delete("/git/worktree", async (c) => {
    const raw = await c.req.json().catch(() => ({}));
    const parsed = RemoveWorktreeBody.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: "repoRoot and worktreePath required" }, 400);
    }
    const { repoRoot, worktreePath, force } = parsed.data;
    const result = await gitUtils.removeWorktree(repoRoot, worktreePath, { force });
    return c.json(result);
  });

  api.post("/git/fetch", async (c) => {
    const raw = await c.req.json().catch(() => ({}));
    const parsed = GitFetchBody.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: "repoRoot required" }, 400);
    }
    return c.json(await gitUtils.gitFetch(parsed.data.repoRoot));
  });

  api.post("/git/pull", async (c) => {
    const raw = await c.req.json().catch(() => ({}));
    const parsed = GitPullBody.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: "cwd required" }, 400);
    }
    const { cwd } = parsed.data;
    const result = await gitUtils.gitPull(cwd);
    let git_ahead = 0, git_behind = 0;
    try {
      const { stdout } = await execFileAsync(
        "git", ["rev-list", "--left-right", "--count", "@{upstream}...HEAD"],
        { cwd, encoding: "utf-8", timeout: 3000 },
      );
      const [behind, ahead] = stdout.trim().split(/\s+/).map(Number);
      git_ahead = ahead || 0;
      git_behind = behind || 0;
    } catch { /* no upstream */ }
    return c.json({ ...result, git_ahead, git_behind });
  });
}
