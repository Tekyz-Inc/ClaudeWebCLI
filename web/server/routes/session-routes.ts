import type { Hono } from "hono";
import type { CliLauncher } from "../cli-launcher.js";
import type { WsBridge } from "../ws-bridge.js";
import type { SessionStore } from "../session-store.js";
import type { WorktreeTracker } from "../worktree-tracker.js";
import * as envManager from "../env-manager.js";
import * as gitUtils from "../git-utils.js";
import * as sessionNames from "../session-names.js";
import { z } from "zod";
import { CreateSessionBody, PatchSessionNameBody, ArchiveSessionBody } from "./schemas.js";
import { cleanupWorktree } from "./worktree-helper.js";

/** Default permission mode for new sessions when none is specified. */
const DEFAULT_PERMISSION_MODE = "bypassPermissions";

type Deps = {
  launcher: CliLauncher;
  wsBridge: WsBridge;
  sessionStore: SessionStore;
  worktreeTracker: WorktreeTracker;
};

export function registerSessionRoutes(api: Hono, deps: Deps): void {
  const { launcher, wsBridge, sessionStore, worktreeTracker } = deps;

  api.post("/sessions/create", async (c) => {
    const raw = await c.req.json().catch(() => ({}));
    const parsed = CreateSessionBody.safeParse(raw);
    const body = (parsed.success ? parsed.data : raw) as z.infer<typeof CreateSessionBody>;
    try {
      let envVars: Record<string, string> | undefined = body.env;
      if (body.envSlug) {
        const companionEnv = await envManager.getEnv(body.envSlug);
        if (companionEnv) {
          console.log(`[routes] Injecting env "${companionEnv.name}" (${Object.keys(companionEnv.variables).length} vars):`, Object.keys(companionEnv.variables).join(", "));
          envVars = { ...companionEnv.variables, ...body.env };
        } else {
          console.warn(`[routes] Environment "${body.envSlug}" not found, ignoring`);
        }
      }

      let cwd = body.cwd;
      let worktreeInfo: { isWorktree: boolean; repoRoot: string; branch: string; actualBranch: string; worktreePath: string } | undefined;

      if (body.useWorktree && body.branch && cwd) {
        const repoInfo = await gitUtils.getRepoInfo(cwd);
        if (repoInfo) {
          const result = await gitUtils.ensureWorktree(repoInfo.repoRoot, body.branch, {
            baseBranch: repoInfo.defaultBranch,
            createBranch: body.createBranch,
            forceNew: true,
          });
          cwd = result.worktreePath;
          worktreeInfo = {
            isWorktree: true,
            repoRoot: repoInfo.repoRoot,
            branch: body.branch,
            actualBranch: result.actualBranch,
            worktreePath: result.worktreePath,
          };
        }
      } else if (body.branch && cwd) {
        const repoInfo = await gitUtils.getRepoInfo(cwd);
        if (repoInfo && repoInfo.currentBranch !== body.branch) {
          await gitUtils.checkoutBranch(repoInfo.repoRoot, body.branch);
        }
      }

      const permissionMode = body.permissionMode || DEFAULT_PERMISSION_MODE;

      const session = launcher.launch({
        model: body.model,
        permissionMode,
        cwd,
        claudeBinary: body.claudeBinary,
        allowedTools: body.allowedTools,
        env: envVars,
        worktreeInfo,
        resumeCliId: body.resumeCliId,
      });

      // Pin the requested permission mode so CLI can't override it
      wsBridge.setRequestedPermissionMode(session.sessionId, permissionMode);

      if (worktreeInfo) {
        worktreeTracker.addMapping({
          sessionId: session.sessionId,
          repoRoot: worktreeInfo.repoRoot,
          branch: worktreeInfo.branch,
          actualBranch: worktreeInfo.actualBranch,
          worktreePath: worktreeInfo.worktreePath,
          createdAt: Date.now(),
        });
      }

      return c.json(session);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[routes] Failed to create session:", msg);
      return c.json({ error: msg }, 500);
    }
  });

  api.get("/sessions", (c) => {
    const sessions = launcher.listSessions();
    const names = sessionNames.getAllNames();
    const enriched = sessions.map((s) => ({
      ...s,
      name: names[s.sessionId] ?? s.name,
      initReceived: wsBridge.isInitReceived(s.sessionId),
    }));
    return c.json(enriched);
  });

  api.get("/sessions/:id", (c) => {
    const id = c.req.param("id");
    const session = launcher.getSession(id);
    if (!session) return c.json({ error: "Session not found" }, 404);
    return c.json(session);
  });

  api.patch("/sessions/:id/name", async (c) => {
    const id = c.req.param("id");
    const raw = await c.req.json().catch(() => ({}));
    const parsed = PatchSessionNameBody.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "name is required";
      return c.json({ error: msg }, 400);
    }
    const name = parsed.data.name.trim();
    if (!name) return c.json({ error: "name is required" }, 400);
    const session = launcher.getSession(id);
    if (!session) return c.json({ error: "Session not found" }, 404);
    sessionNames.setName(id, name);
    return c.json({ ok: true, name });
  });

  api.post("/sessions/:id/kill", async (c) => {
    const id = c.req.param("id");
    const killed = await launcher.kill(id);
    if (!killed) return c.json({ error: "Session not found or already exited" }, 404);
    return c.json({ ok: true });
  });

  api.post("/sessions/:id/relaunch", async (c) => {
    const id = c.req.param("id");
    const ok = await launcher.relaunch(id);
    if (!ok) return c.json({ error: "Session not found" }, 404);
    return c.json({ ok: true });
  });

  api.delete("/sessions/:id", async (c) => {
    const id = c.req.param("id");
    await launcher.kill(id);
    const worktreeResult = await cleanupWorktree(id, true, worktreeTracker);
    launcher.removeSession(id);
    wsBridge.closeSession(id);
    return c.json({ ok: true, worktree: worktreeResult });
  });

  api.post("/sessions/:id/archive", async (c) => {
    const id = c.req.param("id");
    const raw = await c.req.json().catch(() => ({}));
    const parsed = ArchiveSessionBody.safeParse(raw);
    await launcher.kill(id);
    const worktreeResult = await cleanupWorktree(id, parsed.success ? parsed.data.force : undefined, worktreeTracker);
    launcher.setArchived(id, true);
    await sessionStore.setArchived(id, true);
    return c.json({ ok: true, worktree: worktreeResult });
  });

  api.post("/sessions/:id/unarchive", async (c) => {
    const id = c.req.param("id");
    launcher.setArchived(id, false);
    await sessionStore.setArchived(id, false);
    return c.json({ ok: true });
  });
}
