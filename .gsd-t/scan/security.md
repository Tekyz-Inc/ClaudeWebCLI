# Security Audit — 2026-02-10

Auditor: Claude Opus 4.6 (automated)
Scope: All source files under `web/` (server + client)
Risk context: Web UI that bridges Claude Code CLI to browsers via WebSocket. Runs on localhost but binds to `0.0.0.0` in dev mode, potentially exposing all functionality to the local network.

---

## Critical (fix immediately)

- [CRITICAL] **Unrestricted filesystem read via `/api/fs/read` — no path restriction or allowlist** — `web/server/routes.ts`:240-254 — The `GET /api/fs/read` endpoint accepts an arbitrary `path` query parameter, resolves it with `resolve()`, and reads the file contents. There is no validation that the path is within the session's working directory. An attacker (or any browser on the LAN when Vite binds to `0.0.0.0`) can read any file the server process has access to, including `/etc/shadow`, SSH keys, `.env` files, etc. **Remediation:** Validate that `absPath` starts with the session's `cwd` or a configured allowlist. Reject paths containing `..` after resolution.

- [CRITICAL] **Unrestricted filesystem write via `/api/fs/write` — no path restriction** — `web/server/routes.ts`:257-270 — The `PUT /api/fs/write` endpoint accepts an arbitrary file path and content in the JSON body, resolves it, and writes to disk. An attacker can overwrite any file writable by the server process (e.g., `~/.bashrc`, `~/.ssh/authorized_keys`, crontabs). **Remediation:** Validate the resolved path is within a session's `cwd`. Reject writes outside allowed boundaries.

- [CRITICAL] **Unrestricted filesystem browsing via `/api/fs/list` and `/api/fs/tree`** — `web/server/routes.ts`:173-237 — Both `GET /api/fs/list` and `GET /api/fs/tree` accept arbitrary path parameters and enumerate directories recursively (tree goes 10 levels deep). This allows full filesystem enumeration from any client. The `list` endpoint defaults to `homedir()` when no path is given, exposing the user's home directory structure. **Remediation:** Restrict browsable paths to a configured allowlist or session `cwd`. At minimum, block access to sensitive directories.

- [CRITICAL] **No authentication on any API endpoint or WebSocket** — `web/server/index.ts`:1-168, `web/server/routes.ts`:1-443 — There is no authentication middleware, no API key check, no session token validation on any HTTP route or WebSocket upgrade. Anyone who can reach the server (localhost:3456 or over the network in dev mode) has full access to create sessions, spawn CLI processes, read/write files, execute git commands, and manage environment variables containing secrets. **Remediation:** Add at minimum a shared-secret bearer token for API/WebSocket access. Consider binding to `127.0.0.1` only, or add proper auth.

- [CRITICAL] **Command injection via `claudeBinary` parameter in session creation** — `web/server/cli-launcher.ts`:185-192 — The `claudeBinary` field from the request body is passed to `execSync(\`which ${binary}\`)` without any sanitization. A malicious client can send `claudeBinary: "claude; rm -rf /"` to achieve arbitrary command execution. The binary is then used in `Bun.spawn()` which also takes it verbatim. **Remediation:** Validate `claudeBinary` against an allowlist of known binary names (e.g., `claude`, `claude-code`) or restrict to absolute paths only with no shell metacharacters.

- [CRITICAL] **Command injection via `absPath` in git diff route** — `web/server/routes.ts`:273-287 — The `GET /api/fs/diff` endpoint constructs a shell command using string interpolation: `` execSync(`git diff HEAD -- "${absPath}"`) ``. While double-quoted, the path comes directly from user input via `c.req.query("path")`. A path containing `$(...)` or backtick sequences could achieve command injection. **Remediation:** Use `execFileSync` or an array-based spawn instead of shell string interpolation. Alternatively, validate the path contains no shell metacharacters.

- [CRITICAL] **Command injection via branch name in git operations** — `web/server/git-utils.ts`:56-63, 244-270, 302, 358 — The `git()` helper builds shell commands via string concatenation: `` execSync(`git ${cmd}`) ``. Branch names from user input (e.g., `branchName` in `ensureWorktree`, `checkoutBranch`) are interpolated directly into these commands. A branch name like `` `; rm -rf /; ` `` would execute arbitrary commands. **Remediation:** Use `execFileSync('git', [...args])` instead of `execSync()` with string concatenation. Pass arguments as array elements, never interpolated into a shell string.

## High (fix soon)

- [HIGH] **Environment variable secrets exposed to browser clients** — `web/server/routes.ts`:291-331, `web/server/env-manager.ts`:48-76 — The `GET /api/envs` and `GET /api/envs/:slug` endpoints return full environment variable values (API keys, database passwords, etc.) in plaintext JSON to any browser client. The `EnvManager.tsx` component displays these values in the UI. There is no redaction of secret values. **Remediation:** Mask secret values in API responses (show only first/last few chars). Only expose full values in write operations.

- [HIGH] **Session persistence stores sensitive data in world-readable temp directory** — `web/server/session-store.ts`:19 — Sessions (including message history, tool inputs, and pending permission requests) are stored as plain JSON in `os.tmpdir()/vibe-sessions/`. On many systems, `/tmp` is world-readable. Session data may contain secrets, API keys, code, and conversation content. **Remediation:** Store session data in a user-private directory (e.g., `~/.companion/sessions/`) with `0700` permissions. Consider encrypting at rest.

- [HIGH] **No WebSocket origin validation — CSWSH vulnerability** — `web/server/index.ts`:87-110 — WebSocket upgrade requests are accepted without checking the `Origin` header. Any webpage the user visits could establish a WebSocket connection to `ws://localhost:3456/ws/browser/{sessionId}` and interact with active sessions (send prompts, approve tool permissions, read conversation history). This is a Cross-Site WebSocket Hijacking (CSWSH) attack. **Remediation:** Validate the `Origin` header on WebSocket upgrade, rejecting connections from non-localhost origins.

- [HIGH] **CORS configured as wildcard on all API routes** — `web/server/index.ts`:75 — `app.use("/api/*", cors())` with default (permissive) Hono CORS configuration allows any origin to make requests. Combined with the lack of authentication, any website can make cross-origin API calls to the server. **Remediation:** Restrict CORS to `http://localhost:5174` (dev) and `http://localhost:3456` (prod), or require a bearer token.

- [HIGH] **Environment variables injected into CLI subprocess without sanitization** — `web/server/cli-launcher.ts`:233-237 — Custom environment variables from the `env` field in the session creation request are spread directly into the process environment. A client could override security-critical variables like `PATH`, `LD_PRELOAD`, `NODE_OPTIONS`, etc. **Remediation:** Validate environment variable keys against a denylist of dangerous variables (`PATH`, `HOME`, `LD_PRELOAD`, `NODE_OPTIONS`, `PYTHONPATH`, etc.) or use an allowlist approach.

- [HIGH] **Vite dev server binds to `0.0.0.0` — exposes app to local network** — `web/vite.config.ts`:8 — The Vite dev server is configured with `host: "0.0.0.0"`, meaning it listens on all network interfaces. Combined with the proxy that forwards `/api` and `/ws` to the backend, any device on the same network can access the full application with all its unauthenticated capabilities. **Remediation:** Change to `host: "127.0.0.1"` or `host: "localhost"` to bind only to the loopback interface.

- [HIGH] **Session ID guessing enables unauthorized session access** — `web/server/index.ts`:91-109, `web/server/ws-bridge.ts`:148-163 — Session IDs are UUIDs, but there is no session-to-user binding. If an attacker discovers or guesses a session ID, they can connect a browser WebSocket and gain full access to that session (read history, send prompts, approve tool permissions). The `getOrCreateSession()` method even creates sessions on-demand for any UUID. **Remediation:** Add session tokens that must be presented alongside the session ID. Do not auto-create sessions from browser WebSocket connections.

## Medium (plan to fix)

- [MEDIUM] **No WebSocket message size limits** — `web/server/index.ts`:115-141 — The Bun WebSocket server does not configure `maxPayloadLength`. By default, Bun allows up to 16MB per message. A malicious client could send very large messages to consume server memory. **Remediation:** Set `maxPayloadLength` in the WebSocket configuration to a reasonable limit (e.g., 1MB).

- [MEDIUM] **No rate limiting on session creation** — `web/server/routes.ts`:19-91 — The `POST /api/sessions/create` endpoint spawns a new CLI process on each call with no rate limiting. An attacker could rapidly create sessions, spawning hundreds of Claude CLI processes that consume system resources (RAM, CPU, API credits). **Remediation:** Add rate limiting (e.g., max 10 sessions per minute) and a hard cap on concurrent sessions.

- [MEDIUM] **No rate limiting on WebSocket connections** — `web/server/index.ts`:85-141 — There is no limit on the number of concurrent WebSocket connections per session or per client IP. An attacker could open thousands of WebSocket connections. **Remediation:** Limit concurrent browser connections per session (e.g., max 5) and implement connection rate limiting.

- [MEDIUM] **Git operations accept arbitrary repo paths from client** — `web/server/routes.ts`:335-406 — Git endpoints (`/api/git/repo-info`, `/api/git/branches`, `/api/git/worktrees`, `/api/git/fetch`, `/api/git/pull`) accept arbitrary `path` and `repoRoot` parameters. An attacker can point these at any git repository on the filesystem. **Remediation:** Validate that the provided path is within a known session's working directory.

- [MEDIUM] **Auto-namer passes user content to shell command** — `web/server/auto-namer.ts`:33-45 — The `generateSessionTitle()` function passes the first user message (truncated to 500 chars) as a `-p` argument to `Bun.spawn()`. While `Bun.spawn()` uses array-based arguments (no shell injection), the user content is sent as a prompt to Claude, which could potentially be crafted to extract information via the auto-naming process. **Remediation:** Consider running the auto-namer with minimal permissions or using the API directly instead of spawning a CLI process.

- [MEDIUM] **Env slug used in file path without full sanitization** — `web/server/env-manager.ts`:31-33, 37-43 — The `slugify()` function strips most special characters, but the resulting slug is used to construct a file path: `join(ENVS_DIR, \`${slug}.json\`)`. While the current slugify implementation is fairly restrictive, there is no explicit check against path traversal (e.g., slug being `..`). **Remediation:** Add an explicit check that the slug does not contain `.` or path separators, and verify the resolved path is within `ENVS_DIR`.

- [MEDIUM] **Session store file path uses session ID without validation** — `web/server/session-store.ts`:30-32 — The `filePath()` method constructs a path using the session ID directly: `join(this.dir, \`${sessionId}.json\`)`. Session IDs are generated as UUIDs internally, but if a crafted ID were to reach this code (e.g., via a loaded `launcher.json`), it could cause path traversal. **Remediation:** Validate that session IDs match UUID format before using in file paths.

- [MEDIUM] **Worktree branch names not validated for shell safety** — `web/server/git-utils.ts`:46-48, 244-270 — The `sanitizeBranch()` function only replaces `/` with `--`, but branch names can contain other characters that are dangerous in shell commands (spaces, backticks, semicolons, etc.). These branch names are then interpolated into `git` commands. **Remediation:** Validate branch names against a strict pattern (alphanumeric, hyphens, underscores, dots, slashes only). Reject any branch name with shell metacharacters.

- [MEDIUM] **Error messages may leak sensitive file paths** — `web/server/routes.ts`:87-89, 252, 268, 295, 311, 349 — Error responses include raw `Error.message` strings that may contain absolute file paths, internal server paths, or system-specific information useful for reconnaissance. **Remediation:** Return generic error messages in production mode. Log detailed errors server-side only.

- [MEDIUM] **No Content-Security-Policy (CSP) headers** — `web/server/index.ts`:73-83 — The server does not set any CSP headers. In production mode, it serves the built frontend as static files without any security headers (CSP, X-Frame-Options, X-Content-Type-Options, etc.). **Remediation:** Add security headers via middleware: `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security` (if HTTPS).

- [MEDIUM] **`process.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` set unconditionally** — `web/server/index.ts`:1 — This experimental feature flag is hardcoded to "1" at the top of the server entry point. This may enable experimental/unstable behavior in the Claude CLI. **Remediation:** Make this configurable via environment variable rather than hardcoding.

## Low (nice to have)

- [LOW] **Console logs may expose session data and environment variable keys** — `web/server/routes.ts`:27, `web/server/cli-launcher.ts`:239, `web/server/ws-bridge.ts`:129,212,238 — Various `console.log()` calls include session IDs, environment variable key names, and message content previews. If server logs are stored or forwarded, sensitive data may be leaked. **Remediation:** Reduce log verbosity in production. Never log environment variable names or values.

- [LOW] **Environment variable values displayed in plaintext in UI** — `web/src/components/EnvManager.tsx`:186-193 — The EnvManager component renders environment variable values (which may be API keys, passwords, database URLs) in full plaintext with no masking. **Remediation:** Mask values by default with a toggle to reveal.

- [LOW] **`localStorage` stores session names and preferences without encryption** — `web/src/store.ts`:113, 121-122, 127, 158, 236, 388 — Session names, current session ID, dark mode preference, selected environment slug, and recent directories are stored in `localStorage` in plaintext. While this is client-side, shared machines could allow other users to see session history. **Remediation:** Consider using `sessionStorage` for sensitive identifiers or adding a clear-on-exit option.

- [LOW] **No input length validation on session name, user messages, or model strings** — `web/server/routes.ts`:112-119, `web/server/ws-bridge.ts`:596-631 — The session rename endpoint validates only that name is a non-empty string. User messages and model strings have no length limits. Extremely large payloads could consume memory. **Remediation:** Add maximum length validation for names (e.g., 200 chars), messages (e.g., 1MB), and model identifiers (e.g., 100 chars).

- [LOW] **`dangerouslySetInnerHTML` not used, but `react-markdown` renders user-controlled content** — `web/src/components/MessageBubble.tsx`:135-231 — The `MarkdownContent` component renders assistant messages through `react-markdown`. While `react-markdown` does not use `dangerouslySetInnerHTML` and sanitizes HTML by default, rendering markdown from the CLI could potentially include unexpected content. `remarkGfm` adds autolinks which could be used for phishing. **Remediation:** Consider adding `rehype-sanitize` plugin for additional protection. Ensure links get `rel="noopener noreferrer"` (already done on line 166).

- [LOW] **Reconnection timer has no backoff strategy** — `web/src/ws.ts`:404-415 — The WebSocket reconnection uses a fixed 2-second delay. Under sustained failures, this creates a tight reconnection loop. **Remediation:** Implement exponential backoff (e.g., 1s, 2s, 4s, 8s, up to 30s).

- [LOW] **`.gitignore` covers `.env` but no `.env.example` exists** — Root `.gitignore`:10 — While `.env` is gitignored, there is no `.env.example` documenting expected environment variables, making it easy for developers to accidentally commit a `.env` file with a non-standard name. **Remediation:** Create a `.env.example` with documented (but empty) variables.

- [LOW] **No `Referrer-Policy` header set** — The server does not set `Referrer-Policy` headers, meaning the full URL (including session IDs in paths) could be leaked in `Referer` headers when navigating to external links. **Remediation:** Set `Referrer-Policy: strict-origin-when-cross-origin` or `no-referrer`.

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 7 |
| High | 6 |
| Medium | 11 |
| Low | 8 |

### Top Priority Actions

1. **Add authentication** to all API endpoints and WebSocket connections
2. **Restrict filesystem access** — validate all paths are within session CWD
3. **Fix command injection** — use `execFileSync`/array-based spawning instead of shell string interpolation for git operations and binary resolution
4. **Validate `claudeBinary`** parameter against an allowlist
5. **Bind to localhost only** — change Vite `host` to `127.0.0.1`
6. **Restrict CORS** to expected origins
7. **Validate WebSocket `Origin` header** to prevent CSWSH
