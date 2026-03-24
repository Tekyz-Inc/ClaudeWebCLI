process.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = "1";

// Suppress async ERR_SOCKET_CLOSED errors from node-pty when terminal WebSocket
// closes while a write is still in-flight — these are harmless but would crash Bun.
process.on("uncaughtException", (err: NodeJS.ErrnoException) => {
  if (err.code === "ERR_SOCKET_CLOSED") return;
  console.error("Uncaught exception:", err);
  process.exit(1);
});

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import { createRoutes } from "./routes.js";
import { CliLauncher } from "./cli-launcher.js";
import { WsBridge } from "./ws-bridge.js";
import { SessionStore } from "./session-store.js";
import { WorktreeTracker } from "./worktree-tracker.js";
import { generateSessionTitle } from "./auto-namer.js";
import * as sessionNames from "./session-names.js";
import type { SocketData } from "./ws-bridge.js";
import { handleTerminalOpen, handleTerminalMessage, handleTerminalClose } from "./terminal-ws.js";
import type { ServerWebSocket } from "bun";
import { AUTH_TOKEN, createAuthMiddleware, validateWsToken } from "./auth.js";
import { createSecurityHeadersMiddleware } from "./security-headers.js";
import { createRateLimiter } from "./rate-limiter.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = process.env.__VIBE_PACKAGE_ROOT || resolve(__dirname, "..");

const port = Number(process.env.PORT) || 3456;
const sessionStore = new SessionStore();
const wsBridge = new WsBridge();
const launcher = new CliLauncher(port);
const worktreeTracker = new WorktreeTracker();

// ── Restore persisted sessions from disk ────────────────────────────────────
wsBridge.setStore(sessionStore);
launcher.setStore(sessionStore);
void launcher.restoreFromDisk();
void wsBridge.restoreFromDisk();

// When the CLI reports its internal session_id, store it for --resume on relaunch
const initTimeoutCounts = new Map<string, number>();
wsBridge.onCLISessionIdReceived((sessionId, cliSessionId) => {
  launcher.setCLISessionId(sessionId, cliSessionId);
  initTimeoutCounts.delete(sessionId); // Reset init retry count on successful init
});

wsBridge.onInterruptCallback((sessionId) => {
  launcher.sendInterrupt(sessionId);
});

// Watchdog: if CLI connects but never sends system/init, kill and relaunch.
// Attempt 1: retry with --resume. Attempt 2: clear resume ID and start fresh.
const MAX_INIT_RETRIES = 2;
wsBridge.onInitTimeoutCallback(async (sessionId) => {
  const info = launcher.getSession(sessionId);
  if (!info || info.archived || info.state === "exited") return;
  const count = (initTimeoutCounts.get(sessionId) || 0) + 1;
  initTimeoutCounts.set(sessionId, count);
  if (count > MAX_INIT_RETRIES) {
    console.error(`[server] Init timeout for session ${sessionId} — gave up after ${MAX_INIT_RETRIES} retries (cwd: ${info.cwd})`);
    return;
  }
  // After the first failed attempt, clear the resume ID so the next relaunch
  // starts fresh. The --resume flag can cause the CLI to hang if the session
  // being resumed has a large conversation history or corrupted state.
  if (count >= 1 && info.cliSessionId) {
    console.warn(`[server] Clearing --resume for session ${sessionId} to retry fresh`);
    info.cliSessionId = undefined;
  }
  console.warn(`[server] Init timeout for session ${sessionId} (cwd: ${info.cwd}), relaunching CLI (attempt ${count}/${MAX_INIT_RETRIES})...`);
  await launcher.relaunch(sessionId);
});

// Auto-relaunch CLI when a browser connects to a session with no CLI
const relaunchingSet = new Set<string>();
wsBridge.onCLIRelaunchNeededCallback(async (sessionId) => {
  if (relaunchingSet.has(sessionId)) return;
  const info = launcher.getSession(sessionId);
  if (info?.archived) return;
  // Already starting up — CLI just hasn't connected its WS yet, do nothing
  if (info?.state === "starting") return;
  if (info) {
    relaunchingSet.add(sessionId);
    console.log(`[server] Auto-relaunching CLI for session ${sessionId}`);
    try {
      await launcher.relaunch(sessionId);
    } finally {
      setTimeout(() => relaunchingSet.delete(sessionId), 5000);
    }
  }
});

// Auto-generate session title after first turn completes
wsBridge.onFirstTurnCompletedCallback(async (sessionId, firstUserMessage) => {
  // Don't overwrite a name that was already set (manual rename or prior auto-name)
  if (sessionNames.getName(sessionId)) return;
  const info = launcher.getSession(sessionId);
  const model = info?.model || "claude-sonnet-4-5-20250929";
  console.log(`[server] Auto-naming session ${sessionId} with model ${model}...`);
  const title = await generateSessionTitle(firstUserMessage, model);
  // Re-check: a manual rename may have occurred while we were generating
  if (title && !sessionNames.getName(sessionId)) {
    console.log(`[server] Auto-named session ${sessionId}: "${title}"`);
    sessionNames.setName(sessionId, title);
    wsBridge.broadcastNameUpdate(sessionId, title);
  }
});

console.log(`[server] Session persistence: ${sessionStore.directory}`);

const app = new Hono();

// ── Security headers — applied to all responses ──────────────────────────────
app.use("/*", createSecurityHeadersMiddleware());

// ── Rate limiters ─────────────────────────────────────────────────────────────
const generalApiLimiter = createRateLimiter(200, 60_000); // 200 req/min per IP
const sessionCreateLimiter = createRateLimiter(10, 60_000); // 10 sessions/min per IP

app.use("/api/*", cors({
  origin: (origin) => {
    if (!origin) return origin;
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
    return null;
  },
}));
app.use("/api/*", generalApiLimiter);
app.use("/api/sessions/create", sessionCreateLimiter);
app.use("/api/*", createAuthMiddleware());
app.route("/api", createRoutes(launcher, wsBridge, sessionStore, worktreeTracker));

// In production, serve built frontend using absolute path (works when installed as npm package)
if (process.env.NODE_ENV === "production") {
  const distDir = resolve(packageRoot, "dist");
  app.use("/*", serveStatic({ root: distDir }));
  app.get("/*", serveStatic({ path: resolve(distDir, "index.html") }));
}

const server = Bun.serve<SocketData>({
  port,
  hostname: "127.0.0.1",
  reusePort: true,
  async fetch(req, server) {
    const url = new URL(req.url);

    // ── CLI WebSocket — Claude Code CLI connects here via --sdk-url ────
    // CLI connections are authenticated via the Authorization header (Bearer token)
    const cliMatch = url.pathname.match(/^\/ws\/cli\/([a-f0-9-]+)$/);
    if (cliMatch) {
      const sessionId = cliMatch[1];
      // CLI WebSocket is exempt from auth — only our own server spawns CLI processes
      // and they connect back on localhost. The CLI doesn't know the auth token.
      const upgraded = server.upgrade(req, {
        data: { kind: "cli" as const, sessionId },
      });
      if (upgraded) return undefined;
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    // ── Browser WebSocket — connects to a specific session ─────────────
    const browserMatch = url.pathname.match(/^\/ws\/browser\/([a-f0-9-]+)$/);
    if (browserMatch) {
      const sessionId = browserMatch[1];
      if (!validateWsToken(req.url, AUTH_TOKEN)) {
        return new Response("Unauthorized", { status: 401 });
      }
      const upgraded = server.upgrade(req, {
        data: { kind: "browser" as const, sessionId },
      });
      if (upgraded) return undefined;
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    // ── Terminal WebSocket — embedded PowerShell/shell terminal ─────────
    const terminalMatch = url.pathname.match(/^\/ws\/terminal\/([^/]+)$/);
    if (terminalMatch) {
      const terminalId = terminalMatch[1];
      if (!validateWsToken(req.url, AUTH_TOKEN)) {
        return new Response("Unauthorized", { status: 401 });
      }
      const cwd = url.searchParams.get("cwd") || undefined;
      const upgraded = server.upgrade(req, {
        data: { kind: "terminal" as const, terminalId, cwd },
      });
      if (upgraded) return undefined;
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    // Hono handles the rest
    return app.fetch(req, server);
  },
  websocket: {
    idleTimeout: 0, // Never close idle browser/CLI connections
    maxPayloadLength: 1048576, // 1 MB — reject oversized messages
    open(ws: ServerWebSocket<SocketData>) {
      const data = ws.data;
      if (data.kind === "cli") {
        wsBridge.handleCLIOpen(ws, data.sessionId);
        launcher.markConnected(data.sessionId);
      } else if (data.kind === "browser") {
        wsBridge.handleBrowserOpen(ws, data.sessionId);
      } else if (data.kind === "terminal") {
        handleTerminalOpen(ws);
      }
    },
    message(ws: ServerWebSocket<SocketData>, msg: string | Buffer) {
      const data = ws.data;
      if (data.kind === "cli") {
        wsBridge.handleCLIMessage(ws, msg);
      } else if (data.kind === "browser") {
        wsBridge.handleBrowserMessage(ws, msg);
      } else if (data.kind === "terminal") {
        handleTerminalMessage(ws, msg);
      }
    },
    close(ws: ServerWebSocket<SocketData>) {
      const data = ws.data;
      if (data.kind === "cli") {
        wsBridge.handleCLIClose(ws);
      } else if (data.kind === "browser") {
        wsBridge.handleBrowserClose(ws);
      } else if (data.kind === "terminal") {
        handleTerminalClose(ws);
      }
    },
  },
});

console.log(`Server running on http://localhost:${server.port}`);
console.log(`  CLI WebSocket:     ws://localhost:${server.port}/ws/cli/:sessionId`);
console.log(`  Browser WebSocket: ws://localhost:${server.port}/ws/browser/:sessionId`);

const devPort = 5174;
const openUrl = process.env.NODE_ENV !== "production"
  ? `http://localhost:${devPort}?token=${AUTH_TOKEN}`
  : `http://localhost:${server.port}?token=${AUTH_TOKEN}`;

console.log(`\n  ➜  Open: ${openUrl}\n`);

// ── Reconnection watchdog ────────────────────────────────────────────────────
// After a server restart, restored CLI processes may not reconnect their
// WebSocket. Give them a grace period, then kill + relaunch any that are
// still in "starting" state (alive but no WS connection).
const RECONNECT_GRACE_MS = 10_000;
const starting = launcher.getStartingSessions();
if (starting.length > 0) {
  console.log(`[server] Waiting ${RECONNECT_GRACE_MS / 1000}s for ${starting.length} CLI process(es) to reconnect...`);
  setTimeout(async () => {
    const stale = launcher.getStartingSessions().filter((s) => !s.archived);
    if (stale.length > 0) {
      // Don't mass-relaunch — just mark them exited. They'll relaunch on-demand when a browser connects.
      console.log(`[server] ${stale.length} CLI process(es) did not reconnect. Marking as exited (will relaunch on demand).`);
      for (const info of stale) {
        info.state = "exited";
        info.exitCode = -1;
      }
    }
  }, RECONNECT_GRACE_MS);
}
