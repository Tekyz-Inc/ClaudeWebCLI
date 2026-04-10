# API Contract

_Last updated: 2026-04-10 (M12 Contract Refresh — auto-generated from route files)_

## Summary

- **Total HTTP endpoints**: 33
- **Total WebSocket endpoints**: 3
- **Base path**: all HTTP routes are mounted under `/api` (see `web/server/index.ts` — `app.route("/api", createRoutes(...))`)
- **Registration entry point**: `web/server/routes.ts` → `createRoutes()` → `web/server/routes/index.ts` (barrel re-export)
- **Auth**: **Not enforced** on any route — 127.0.0.1 bind + CORS origin allowlist (`http(s)://localhost|127.0.0.1(:port)?`) is the trust boundary. The `web/server/auth.ts` module exists but is not wired into Hono middleware (see `web/server/index.ts:34` comment). CLI WebSocket is exempt even by design — only the server itself spawns CLI processes.
- **Rate limiting**:
  - `/api/*` — 200 requests / 60s per IP (`generalApiLimiter`)
  - `/api/sessions/create` — 10 requests / 60s per IP (`sessionCreateLimiter`, stacked)
- **Security headers**: `createSecurityHeadersMiddleware()` applied to `/*` (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy).
- **WebSocket payload cap**: 1 MiB (`maxPayloadLength: 1048576`).
- **Zod schemas**: request bodies validated via `web/server/routes/schemas.ts` where applicable. Query params are checked ad-hoc (not Zod).
- **Error shape** (filesystem routes, after M11 / TD-045): `{ error: string, details?: string }`. Other route groups return `{ error: string }` and are not yet unified.

---

## Session Routes — `web/server/routes/session-routes.ts`

| Method | Path | Request | Response | Notes |
|--------|------|---------|----------|-------|
| POST | /api/sessions/create | body: `CreateSessionBody` (Zod) — `model?`, `permissionMode?`, `cwd?`, `claudeBinary?`, `allowedTools?`, `env?`, `envSlug?`, `useWorktree?`, `branch?`, `createBranch?`, `resumeCliId?` | `SessionInfo` from `launcher.launch()` — includes `sessionId`, `state`, `cwd`, `model`, `permissionMode`, etc. | Rate-limited (10/min). Resolves `envSlug` via `env-manager`, optionally creates/checks-out worktree, pins `permissionMode` on `wsBridge`, records worktree mapping. On failure → `500 {error}`. Default `permissionMode = "bypassPermissions"`. |
| GET | /api/sessions | — | `SessionInfo[]` enriched with `{ name, initReceived }` | Merges `launcher.listSessions()` + `sessionNames.getAllNames()` + `wsBridge.isInitReceived()`. |
| GET | /api/sessions/:id | path: `id` | `SessionInfo` or `404 {error: "Session not found"}` | |
| PATCH | /api/sessions/:id/name | body: `PatchSessionNameBody` — `{ name: string }` (min 1) | `{ ok: true, name }`; `400` on invalid body; `404` if session missing | Persists via `sessionNames.setName()`. |
| POST | /api/sessions/:id/kill | — | `{ ok: true }` or `404` | Calls `launcher.kill(id)`; does not remove session from store. |
| POST | /api/sessions/:id/relaunch | — | `{ ok: true }` or `404` | Re-spawns the CLI for this session (used after crash/init timeout). |
| DELETE | /api/sessions/:id | — | `{ ok: true, worktree }` | Kills + cleans up worktree (force=true) + removes from launcher + closes bridge session. |
| POST | /api/sessions/:id/archive | body: `ArchiveSessionBody` — `{ force?: boolean }` | `{ ok: true, worktree }` | Kills session, optionally force-removes worktree, flips `archived=true`, persists via `sessionStore.setArchived`. |
| POST | /api/sessions/:id/unarchive | — | `{ ok: true }` | Flips `archived=false`. |

---

## Filesystem Routes — `web/server/routes/filesystem-routes.ts`

All paths are sanitized via `validatePath()` from `web/server/security-utils.ts`. Errors use the unified `handleRouteError()` helper (TD-045 fix in M11).

| Method | Path | Request | Response | Notes |
|--------|------|---------|----------|-------|
| GET | /api/fs/list | query: `path?` (default = `os.homedir()`) | `{ path, dirs: [{name, path}], home }` or `400 {error, details, ...}` | Returns only directories, filters hidden (dot) entries. |
| GET | /api/fs/home | — | `{ home, cwd }` | |
| GET | /api/fs/tree | query: `path` (required) | `{ path, tree: TreeNode[] }` where `TreeNode = { name, path, type: "file"\|"directory", children? }` | Recursive, depth-limited to 10, skips dot-files and `node_modules`. |
| GET | /api/fs/read | query: `path` (required) | `{ path, content }` or `413` if file > 2 MiB or `404 {error, details}` | UTF-8 only. |
| PUT | /api/fs/write | body: `WriteFileBody` — `{ path, content }` | `{ ok: true, path }` or `400 {error, details}` | |
| GET | /api/fs/diff | query: `path` (required) | `{ path, diff }` (`diff` = stdout of `git diff HEAD -- <path>`, or empty string on failure) | Best-effort; returns empty string when git unavailable or file untracked. |

---

## Git Routes — `web/server/routes/git-routes.ts`

| Method | Path | Request | Response | Notes |
|--------|------|---------|----------|-------|
| GET | /api/git/repo-info | query: `path` (required) | `RepoInfo` from `gitUtils.getRepoInfo()` — `{ repoRoot, currentBranch, defaultBranch, ... }` or `400 {error}` if not a repo | |
| GET | /api/git/branches | query: `repoRoot` (required) | `BranchInfo[]` via `gitUtils.listBranches()` | `500` on git error. |
| GET | /api/git/worktrees | query: `repoRoot` (required) | `WorktreeInfo[]` via `gitUtils.listWorktrees()` | |
| POST | /api/git/worktree | body: `EnsureWorktreeBody` — `{ repoRoot, branch, baseBranch?, createBranch? }` | `{ worktreePath, actualBranch, ... }` from `gitUtils.ensureWorktree()` | `400` if body invalid; `500` on git error. |
| DELETE | /api/git/worktree | body: `RemoveWorktreeBody` — `{ repoRoot, worktreePath, force? }` | `{ removed: boolean, ... }` from `gitUtils.removeWorktree()` | |
| POST | /api/git/fetch | body: `GitFetchBody` — `{ repoRoot }` | `{ ok, stdout, stderr }` from `gitUtils.gitFetch()` | |
| POST | /api/git/pull | body: `GitPullBody` — `{ cwd }` | `{ ...pullResult, git_ahead, git_behind }` | After pull, runs `git rev-list --left-right --count @{upstream}...HEAD` to compute ahead/behind counters. |

---

## Environment Routes — `web/server/routes/environment-routes.ts`

Env secrets are **masked by default** via `maskSecretValue()` (first 3 chars + `***` for values > 4 chars). Unmasked values only returned by `/reveal`.

| Method | Path | Request | Response | Notes |
|--------|------|---------|----------|-------|
| GET | /api/envs | — | `CompanionEnv[]` (variables masked) | |
| GET | /api/envs/:slug | path: `slug` | `CompanionEnv` (masked) or `404 {error}` | |
| GET | /api/envs/:slug/reveal | path: `slug` | `CompanionEnv` (unmasked) or `404` | No additional auth — relies on localhost trust boundary. |
| POST | /api/envs | body: `{ name, variables? }` (not Zod-validated) | `201 CompanionEnv` or `400 {error}` | |
| PUT | /api/envs/:slug | body: `{ name?, variables? }` | `CompanionEnv` or `404` | |
| DELETE | /api/envs/:slug | — | `{ ok: true }` or `404` | |

---

## Command / Session-History Routes — `web/server/routes/command-routes.ts`

Reads native Claude CLI session history from `~/.claude/projects/<slug>/*.jsonl`.

| Method | Path | Request | Response | Notes |
|--------|------|---------|----------|-------|
| GET | /api/claude-sessions | query: `cwd` (required) | `SdkSessionInfo[]` via `readClaudeSessions()` | `400` if `cwd` missing. |
| GET | /api/claude-sessions/:id/messages | query: `cwd`; path: `id` | `SessionHistoryMessage[]` — `{ role, content, timestamp? }[]` via `readClaudeSessionMessages()` | Used by `store.resumeNativeSession()` to pre-populate chat history. |
| GET | /api/claude-sessions/:id/activity | query: `cwd`; path: `id` | `{ filesRead, changedFiles, commands }` via `readClaudeSessionActivity()` | Parses `tool_use` blocks from `.jsonl`. |
| GET | /api/projects | — | `{ projects: { name, path }[] }` | Reads `~/.claude/.gsd-t-projects` (pipe-delimited). Missing file → empty array. |
| GET | /api/claude-settings | — | `{ defaultPermissionMode, defaultModel }` | Reads `~/.claude/settings.json`. Falls back to `{ defaultPermissionMode: "default", defaultModel: null }` on failure. |
| GET | /api/slash-commands | query: `cwd?` | `{ commands: string[], skills: string[], argumentHints: Record<string, string> }` | `commands` = built-in list (32 entries). `skills` = merged `~/.claude/commands/*.md` (prefixed `user:`) + `<cwd>/.claude/commands/*.md`. `argumentHints` parsed from YAML front-matter `argument-hint:` field. |

---

## WebSocket Endpoints — `web/server/index.ts`

Not mounted under `/api`. Paths are matched directly by `Bun.serve({ fetch })` before the Hono app sees the request.

| Path | Data Shape | Purpose | Source |
|------|------------|---------|--------|
| `/ws/cli/:sessionId` | `{ kind: "cli", sessionId }` | Claude CLI connects here via `--sdk-url`. NDJSON protocol. Exempt from auth. Handled by `WsBridge.handleCLIOpen/Message/Close`. | `web/server/index.ts:208`, `web/server/ws-bridge.ts` |
| `/ws/browser/:sessionId` | `{ kind: "browser", sessionId }` | Browser client subscribes to a specific session. JSON envelope protocol (see `ws-protocol-contract.md`). | `web/server/index.ts:221`, `web/server/ws-bridge.ts` |
| `/ws/terminal/:terminalId?cwd=<path>` | `{ kind: "terminal", terminalId, cwd? }` | Embedded xterm.js ↔ node-pty bridge (powershell/bash). JSON messages: `{type: "input", data}`, `{type: "resize", cols, rows}`, `{type: "output", data}`, `{type: "exit", code}`. | `web/server/index.ts:233`, `web/server/terminal-ws.ts`, `web/server/terminal-node.cjs` |

**Session ID pattern**: `/^[a-f0-9-]+$/` (UUID-like). Terminal IDs are opaque strings.

**Shared WebSocket options** (`Bun.serve({ websocket })`):
- `idleTimeout: 0` — never close idle connections (browsers + CLI).
- `maxPayloadLength: 1048576` — 1 MiB cap per frame.

---

## Notes on Coverage

- Every HTTP route registered in `web/server/routes/*.ts` is listed above (verified against `.get(`, `.post(`, `.put(`, `.delete(`, `.patch(` grep on 2026-04-10).
- Every WebSocket upgrade path in `web/server/index.ts` is listed above.
- `auth.ts` is imported/defined but **not** wired into the middleware chain — kept as infrastructure for a future "remote mode" milestone. Treat as dormant code, not part of the live contract.
- No OpenAPI / Swagger document is generated (see `CLAUDE.md` → "API Documentation Waiver"). This file is the authoritative surface reference.
