# Business Rules -- 2026-04-01

Scan of ClaudeWebCLI codebase (`web/server/` and `web/src/`).
Version: 0.14.11

---

## Session Lifecycle

- **Session ID**: Random UUID via `randomUUID()`. Acts as sole access control token.
- **State machine**: `starting -> connected -> running -> exited`. No formal enforcement; states set directly via property assignment.
- **CLI launch**: `claude --sdk-url ws://localhost:{port}/ws/cli/{id} --print --output-format stream-json --input-format stream-json --verbose -p "placeholder"`. The `-p "placeholder"` is ignored; CLI waits for user message over WS.
- **Resume**: Relaunch uses `--resume` flag with stored `cliSessionId` from CLI's `system/init` message.
- **Quick-exit guard**: If CLI exits within 5s of `--resume` launch, `cliSessionId` is cleared to prevent infinite relaunch loops on corrupt resume state.
- **Relaunch dedup**: `relaunchingSet` (Set<string>) prevents concurrent relaunches; entries expire after 5s via `setTimeout`.
- **Auto-relaunch on browser connect**: When browser connects and CLI socket is null, bridge fires `onCLIRelaunchNeeded`. Archived sessions excluded.
- **Reconnection watchdog**: On server startup, restored sessions get 10s grace period for CLI reconnect. Sessions still in `starting` after grace are relaunched. Stale sessions (no CLI, not starting) marked exited.
- **Process recovery**: `restoreFromDisk()` checks each persisted PID with `process.kill(pid, 0)`. Alive = `starting`; dead = `exited`.
- **Graceful kill**: SIGTERM, wait 5s, SIGKILL if still alive. Relaunch uses shorter 2s SIGTERM timeout.
- **Hard cap**: 5 concurrent CLI processes (`MAX_CONCURRENT_PROCESSES`).
- **Init watchdog**: 90s timeout waiting for CLI `system/init`. Max 2 retries. First retry clears `cliSessionId` for fresh start.

## Stall Detection

- **Activity watchdog**: Fires every 15s checking `lastCliActivityAt`. If no CLI activity for 60s while `awaitingResult`, triggers stall retry.
- **Max retries**: 2 stall retries before giving up.
- **Retry action**: Resends `lastUserNdjson` (last user message).
- **`pendingStallRetry` flag**: Prevents concurrent stall retries.

## Session Persistence

- **Debounced writes**: 150ms debounce coalesces rapid state changes.
- **No flush-on-shutdown**: If server crashes within debounce window, state is lost.
- **Storage location**: `~/.companion/sessions/{id}.json` (migrated from `$TMPDIR` in M9).
- **Session names**: Separate file `~/.companion/session-names.json`.
- **Worktree tracking**: `~/.companion/worktrees.json`.
- **`loadAll()` filter**: Reads .json files excluding `launcher.json`; silently skips corrupt files.

## WebSocket Protocol

- **CLI leg**: NDJSON (newline-delimited JSON). CLI is the WS client.
- **Browser leg**: Standard JSON. Browser is the WS client.
- **Message queuing**: When CLI not connected, messages queued in `pendingMessages` (persisted to disk). Flushed on CLI connect.
- **NDJSON parse failure**: Warning logged, line skipped, session continues.
- **Browser parse failure**: Warning logged, handler returns.
- **Unknown CLI message types**: Default case is no-op (future-proofing).
- **Keep-alives**: Silently consumed.
- **Pending permissions**: No server-side timeout. CLI has 30s timeout. If browser never responds, CLI times out and pending permission becomes stale (cleaned up on CLI disconnect).
- **`sendToSession()` on client**: Silently drops messages if WebSocket is not OPEN. No queuing or retry.

## Tool Approval Flow

- **Permission requests**: CLI sends `control_request` with `subtype: "can_use_tool"`, including `request_id`, `tool_name`, `input`.
- **Approval**: Server forwards to browser as `permission_request`. Browser response forwarded back as `control_response`.
- **Deny format**: Uses `subtype: "success"` wrapper (CLI protocol convention, even for denials).
- **Cleanup**: All pending permissions cancelled on CLI disconnect (`permission_cancelled` sent to browsers).
- **Interrupt**: Browser can send interrupt as `control_request` with `subtype: "interrupt"`.

## Auto-Naming

- **Trigger**: After first successful result (non-error), if `autoNamingAttempted` not set.
- **Method**: Spawns separate Claude CLI process with truncated (500 char) first user message.
- **Timeout**: 15s.
- **Validation**: Title must be 0 < length < 100. Surrounding quotes stripped.
- **Manual rename protection**: Checks `sessionNames.getName()` before and after async generation to avoid overwriting manual renames.
- **Client-side override guard**: Regex `/^[A-Z][a-z]+ [A-Z][a-z]+$/` identifies auto-generated names. Only auto-generated names are overwritten. Risk: manually set names matching this pattern (e.g., "Quick Start") will be overwritten.

## Terminal PTY

- **Architecture**: Node.js subprocess bridge (Bun + node-pty incompatible).
- **Connection**: Direct WebSocket to backend port, not through Vite proxy in dev.
- **Lifecycle**: Fresh terminal ID per `useEffect` run (React Strict Mode protection).
- **Resize**: `fit.fit()` guarded by ResizeObserver checking `clientWidth > 10` (prevents crash when container hidden).
- **`cwd` parameter**: NOT validated via `validatePath()` -- security gap.

## Context & Model

- **Context usage %**: `(inputTokens + outputTokens) / contextWindow * 100`. Uses last model in `modelUsage` iteration.
- **`is_compacting` flag**: Set to true on `status === "compacting"` but never explicitly reset to false. Relies on implicit status change.
- **Model change**: Browser can send `set_model` control request at runtime.
- **Permission mode change**: Browser can send `set_permission_mode` at runtime.

## Git Integration

- **Worktree isolation**: Optional worktree in `~/.companion/worktrees/` for branch-per-session.
- **Branch suffix**: `-wt-{random4}` for collision avoidance (100 attempts, then `Date.now()` fallback).
- **Cleanup**: On archive/delete, checks if other sessions use worktree. Dirty worktrees only force-removed with `force` flag.
- **CLAUDE.md injection**: Worktree guardrails injected into `.claude/CLAUDE.md` with idempotent markers.
- **Default branch priority**: `refs/remotes/origin/HEAD` -> `main` -> `master` -> fallback `main`.

## Security (M9)

- **Server binding**: `127.0.0.1` only (localhost).
- **CORS**: Restricted to `http://localhost:*` origins.
- **Path validation**: `validatePath()` resolves symlinks, checks within base or home dir, blocks system prefixes.
- **Binary validation**: Only allows "claude" or paths ending in `/claude[.cmd|.exe]`.
- **Env var filtering**: Removes `PATH`, `LD_PRELOAD`, `NODE_OPTIONS`, etc. But `{ ...filteredBase, ...options.env }` allows override.
- **Rate limiting**: 200 req/min general, 10 sessions/min creation. IP-based via `X-Forwarded-For` (spoofable).
- **CSP**: Has `'unsafe-inline'` for scripts and styles.
- **Auth**: Bearer token module exists but not enforced on WS endpoints.
- **WS payload limit**: Configured (Bun `maxPayloadLength`).
- **Secret masking**: Environment API masks values in responses.

## Client State

- **HMR-safe**: WebSocket state via `window.__ws_state`, Zustand via `window.__cc_store_state` snapshot/restore.
- **Reconnection**: Exponential backoff 2s -> 30s. Only reconnects for `currentSessionId`.
- **Session polling**: Sidebar polls `GET /api/sessions` every 5s.
- **Auto-resume**: `useAutoResumeSession` hook polls every 10s, auto-resumes most recent session on tab switch or first load.
- **Version display**: Sidebar shows hardcoded "v0.8.10" (stale).
