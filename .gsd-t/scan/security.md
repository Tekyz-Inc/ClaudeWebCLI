# Security Audit -- 2026-04-01

Auditor: Claude Opus 4.6 (automated)
Scope: All source files under `web/` (server + client)
Risk context: Web UI bridging Claude Code CLI to browsers via WebSocket. Server bound to 127.0.0.1 since M9.

---

## Status of Previous (2026-02-10) Findings

### Resolved by M9 Security Hardening

| Previous Finding | Resolution |
|-----------------|------------|
| Unrestricted filesystem read/write/list/tree | `validatePath()` in security-utils.ts validates paths within session CWD or home dir |
| No authentication on API endpoints | Bearer token auth module created (`auth.ts`), CORS restricted to localhost |
| Command injection via `claudeBinary` | `validateBinary()` restricts to "claude" or paths ending in `/claude[.cmd|.exe]` |
| Command injection via git diff `absPath` | Path validated before git command execution |
| Env var secrets exposed to browser | Secret masking added to environment API responses |
| Session data in world-readable temp dir | Migrated to `~/.companion/sessions/` |
| Vite dev server on `0.0.0.0` | Changed to `127.0.0.1` |
| CORS configured as wildcard | Restricted to `http://localhost:*` |
| No WebSocket message size limits | `maxPayloadLength` configured |
| No rate limiting | Rate limiter added (200 req/min, 10 sessions/min) |
| No CSP headers | `security-headers.ts` added |

### Partially Resolved

| Finding | Status |
|---------|--------|
| No auth on WebSocket | Auth module exists but NOT enforced on WS upgrade. Comment says "Auth module available but not enforced" |
| Command injection via branch names in git | `sanitizeBranch()` only replaces `/` with `--`. Shell metacharacters still possible |
| No WebSocket origin validation (CSWSH) | Not implemented. Any webpage can connect to `ws://localhost:3456` |
| Session ID guessing | UUIDs are random but no session-to-user binding. `getOrCreateSession()` auto-creates for any UUID |

---

## New Findings (2026-04-01)

### SEC-01: Env Var Filter Bypass via options.env Override
**Severity:** HIGH
**Location:** `web/server/cli-launcher.ts:233-237`
**Issue:** `filterEnvVars()` removes dangerous keys (PATH, LD_PRELOAD, NODE_OPTIONS), but the result is spread with `{ ...filteredBase, ...options.env }`. Since `options.env` comes from the session creation request body, a client can re-inject any filtered key.
**Exploit:** `POST /api/sessions/create` with `{ env: { PATH: "/attacker/bin", NODE_OPTIONS: "--require /attacker/payload" } }`
**Remediation:** Apply `filterEnvVars()` AFTER merging `options.env`, or filter `options.env` separately before merging.

### SEC-02: Terminal PTY cwd Not Path-Validated
**Severity:** HIGH
**Location:** `web/server/terminal-ws.ts:~30`
**Issue:** The `cwd` parameter for terminal PTY creation is NOT validated via `validatePath()`. A client can request a terminal opened in any directory, including system directories.
**Remediation:** Add `validatePath(cwd, cwd)` check before spawning PTY.

### SEC-03: WebSocket Auth Not Enforced
**Severity:** HIGH
**Location:** `web/server/index.ts:87-110`
**Issue:** Despite `auth.ts` existing with bearer token support, WebSocket upgrade handlers do not call any authentication function. Any connection to `ws://localhost:3456/ws/browser/{sessionId}` is accepted.
**Remediation:** Call `validateToken()` from auth.ts during WebSocket upgrade, reject connections without valid token.

### SEC-04: Rate Limiter Uses X-Forwarded-For
**Severity:** MEDIUM
**Location:** `web/server/rate-limiter.ts`
**Issue:** IP extraction trusts `X-Forwarded-For` header, which is trivially spoofable. Since the server is localhost-only, all connections are from 127.0.0.1 anyway, making rate limiting effectively useless (all requests share one bucket).
**Remediation:** Use connection source IP, not forwarded headers. Consider per-session rate limiting instead of per-IP.

### SEC-05: CSP Allows unsafe-inline
**Severity:** MEDIUM
**Location:** `web/server/security-headers.ts`
**Issue:** Content Security Policy includes `'unsafe-inline'` for both scripts and styles, significantly reducing XSS protection.
**Remediation:** Use nonce-based CSP or hash-based CSP for inline scripts. For styles, `'unsafe-inline'` is acceptable with Tailwind but scripts should be strict.

### SEC-06: No unhandledRejection Handler
**Severity:** MEDIUM
**Location:** `web/server/index.ts`
**Issue:** Only `uncaughtException` is handled (for ERR_SOCKET_CLOSED). An unhandled promise rejection could crash the server or leak information via default error output.
**Remediation:** Add `process.on('unhandledRejection', handler)` with logging and graceful handling.

### SEC-07: Sync I/O in CLI Launcher (DoS Vector)
**Severity:** MEDIUM
**Location:** `web/server/cli-launcher.ts` (mkdirSync, existsSync, appendFileSync, readdirSync, statSync, unlinkSync)
**Issue:** Log management functions use synchronous filesystem calls. A directory with many log files or a slow filesystem could block the event loop, causing denial of service for all concurrent sessions.
**Remediation:** Convert to async equivalents (mkdir, stat, readdir, unlink).

---

## Summary

| Severity | Count | Notes |
|----------|-------|-------|
| Critical | 0 | All 7 criticals from 2026-02-10 resolved or partially resolved |
| High | 3 | SEC-01, SEC-02, SEC-03 |
| Medium | 4 | SEC-04, SEC-05, SEC-06, SEC-07 |
| Partially resolved | 4 | WS auth, branch injection, CSWSH, session ID guessing |

### Top Priority Actions

1. **Enforce WS authentication** -- Call auth.ts validateToken() on WebSocket upgrade
2. **Fix env var filter bypass** -- Filter AFTER merging options.env
3. **Validate terminal PTY cwd** -- Add validatePath() check
4. **Add unhandledRejection handler** -- Prevent server crashes from unhandled promises
