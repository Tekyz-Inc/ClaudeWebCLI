import { Hono } from "hono";
import type { CliLauncher } from "./cli-launcher.js";
import type { WsBridge } from "./ws-bridge.js";
import type { SessionStore } from "./session-store.js";
import type { WorktreeTracker } from "./worktree-tracker.js";
import {
  registerSessionRoutes,
  registerFilesystemRoutes,
  registerGitRoutes,
  registerEnvironmentRoutes,
  registerCommandRoutes,
} from "./routes/index.js";

export function createRoutes(
  launcher: CliLauncher,
  wsBridge: WsBridge,
  sessionStore: SessionStore,
  worktreeTracker: WorktreeTracker,
): Hono {
  const api = new Hono();

  registerSessionRoutes(api, { launcher, wsBridge, sessionStore, worktreeTracker });
  registerFilesystemRoutes(api);
  registerGitRoutes(api);
  registerEnvironmentRoutes(api);
  registerCommandRoutes(api);

  return api;
}
