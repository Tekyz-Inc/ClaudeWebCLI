# WebSocket Protocol Contract

_Last updated: 2026-04-10 (M12 Contract Refresh — new contract per TD-041)_

## Overview

ClaudeWebCLI uses a **three-tier WebSocket bridge** with two distinct protocols meeting at the bridge server:

```
+--------------+    NDJSON over WS    +------------------+    JSON over WS    +--------------+
| Claude Code  | <------------------> | Bridge Server    | <----------------> |   Browser    |
|     CLI      |  /ws/cli/:sid        | (web/server/*)   |  /ws/browser/:sid  |  (React app) |
| (--sdk-url)  |                      |                  |                    |              |
+--------------+                      +------------------+                    +--------------+
```

Additionally, a third WS endpoint `/ws/terminal/:terminalId` bridges an embedded xterm.js instance to a node-pty PowerShell/bash child process — independent of the CLI protocol.

Authoritative references:
- **Left leg (CLI ↔ server)**: `web/server/session-types.ts` (all message types), `web/server/ws-bridge.ts` (handlers), `WEBSOCKET_PROTOCOL_REVERSED.md` (full reverse-engineered CLI protocol, project root)
- **Right leg (server ↔ browser)**: `web/server/session-types.ts` (`BrowserIncomingMessage` / `BrowserOutgoingMessage`), `web/src/ws.ts` (browser handler), `web/src/ws-handlers/*` (typed dispatch)
- **Terminal leg**: `web/server/terminal-ws.ts`, `web/server/terminal-node.cjs` (Node.js PTY bridge)

## 1. Endpoints

| Path | Client | Server handler | Data kind |
|------|--------|----------------|-----------|
| `/ws/cli/:sessionId` | Claude CLI (launched with `--sdk-url`) | `WsBridge.handleCLIOpen/Message/Close` | `{kind: "cli", sessionId}` |
| `/ws/browser/:sessionId` | React frontend | `WsBridge.handleBrowserOpen/Message/Close` | `{kind: "browser", sessionId}` |
| `/ws/terminal/:terminalId` | React (xterm.js) | `terminal-ws.ts handleTerminalOpen/Message/Close` | `{kind: "terminal", terminalId, cwd?}` |

**Session ID regex**: `/^[a-f0-9-]+$/` (UUID-like).

**Shared server options** (`Bun.serve({ websocket })` in `web/server/index.ts`):
- `idleTimeout: 0` — never auto-close idle sockets
- `maxPayloadLength: 1048576` — 1 MiB per frame

## 2. Authentication

| Leg | Auth model |
|-----|-----------|
| CLI → server | **Exempt**. Only the server itself spawns CLI processes on localhost; the CLI does not know the auth token. See `web/server/index.ts:211` comment. |
| Browser → server | **Not enforced**. Relies on `127.0.0.1` bind + CORS origin allowlist. `auth.ts` exists as dormant infrastructure for a future remote mode. |
| Terminal → server | **Not enforced**. Same rationale. |

The CLI-side `Authorization: Bearer <token>` header described in `WEBSOCKET_PROTOCOL_REVERSED.md` is still accepted by the CLI binary itself (it's how the protocol was designed), but our bridge ignores it. Token sources on the CLI side are documented in `CLAUDE.md → Authentication`.

## 3. Left Leg — CLI ↔ Server (NDJSON)

**Wire format**: newline-delimited JSON — one JSON object per `\n`-terminated line. Partial lines are buffered across frames (see `WsBridge._parseNdjson` in `web/server/ws-bridge.ts`).

**Connection lifecycle** (per `CLAUDE.md § The --sdk-url WebSocket Protocol`):
1. Server spawns CLI with `claude --sdk-url ws://localhost:<port>/ws/cli/<sid> --print --output-format stream-json --input-format stream-json --verbose -p "placeholder"` (see `web/server/cli-launcher.ts`).
2. CLI connects as a WebSocket **client**.
3. Server sends the first `user` message (prompt from the browser).
4. CLI responds with `system/init`, then streams `assistant`/`stream_event`/`result`/`control_request` messages.
5. Server replies to `control_request` with `control_response` within 30 s.
6. Multi-turn continues with new `user` messages keyed by the same `session_id`.

### 3.1 CLI → Server messages

Defined in `web/server/session-types.ts` as the `CLIMessage` union. Dispatched in `WsBridge.routeCLIMessage()` (`ws-bridge.ts:461`).

| `type` | `subtype` | Purpose | Key fields |
|--------|-----------|---------|-----------|
| `system` | `init` | First message after CLI processes the first user prompt. Carries session metadata. | `cwd`, `session_id`, `tools[]`, `mcp_servers[]`, `model`, `permissionMode`, `apiKeySource`, `claude_code_version`, `slash_commands[]`, `agents[]`, `skills[]`, `output_style`, `uuid` |
| `system` | `status` | Status changes (e.g., compacting) | `status: "compacting" \| null`, `permissionMode?`, `session_id`, `uuid` |
| `system` | `hook_response` | Intermediate signal that CLI is alive during slow hook / plugin installation. Server uses it to reset the init timer up to `MAX_INIT_TIMER_RESETS` times. | (opaque) |
| `assistant` | — | Full assistant response block | `message.{id, role, model, content: ContentBlock[], stop_reason, usage}`, `parent_tool_use_id`, `session_id`, `uuid` |
| `result` | `success` / `error_during_execution` / `error_max_turns` / `error_max_budget_usd` / `error_max_structured_output_retries` | Query-complete marker | `is_error`, `result?`, `errors?`, `duration_ms`, `duration_api_ms`, `num_turns`, `total_cost_usd`, `stop_reason`, `usage`, `modelUsage?`, `total_lines_added?`, `total_lines_removed?`, `session_id`, `uuid` |
| `stream_event` | — | Token-by-token streaming (requires `--verbose`) | `event` (opaque Anthropic stream event), `parent_tool_use_id`, `session_id`, `uuid` |
| `tool_progress` | — | Long-running tool progress pings | `tool_use_id`, `tool_name`, `parent_tool_use_id`, `elapsed_time_seconds` |
| `tool_use_summary` | — | Summary of a group of tool calls (e.g., skill execution) | `summary`, `preceding_tool_use_ids[]` |
| `control_request` | `can_use_tool` | Tool permission request — server must respond within 30 s | `request_id`, `request.{subtype, tool_name, input, permission_suggestions?, description?, tool_use_id, agent_id?}` |
| `keep_alive` | — | Heartbeat — silently consumed by server | — |
| `auth_status` | — | Plugin / MCP auth flow status | `isAuthenticating`, `output[]`, `error?`, `session_id`, `uuid` |

**ContentBlock** (used inside `assistant.message.content[]`):
```ts
| { type: "text"; text: string }
| { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
| { type: "tool_result"; tool_use_id: string; content: string | ContentBlock[]; is_error?: boolean }
| { type: "thinking"; thinking: string; budget_tokens?: number }
```

### 3.2 Server → CLI messages

Sent by `WsBridge.sendToCLI()` (`ws-bridge.ts:1042`). All NDJSON-encoded.

| `type` | `request.subtype` / fields | Purpose |
|--------|----------------------------|---------|
| `user` | `message: {role: "user", content: string \| ContentBlock[]}`, `parent_tool_use_id: null`, `session_id` | Send a prompt or follow-up. First `user` message unblocks the CLI's wait loop. May embed images via `{type: "image", source: {type: "base64", media_type, data}}` content blocks (see `handleUserMessage` in ws-bridge.ts:~870). |
| `control_response` | `response.{subtype: "success", request_id, response: {behavior: "allow", updatedInput, updatedPermissions?}}` or `response.{subtype: "success", request_id, response: {behavior: "deny", message}}` | Reply to a `can_use_tool` permission request. Must arrive within 30 s or CLI denies the tool. |
| `control_request` | `request.{subtype: "interrupt"}` | Interrupt current turn. Paired with a direct SIGINT to the process (`onInterrupt?.(sessionId)`). |
| `control_request` | `request.{subtype: "set_model", model}` | Switch model mid-session. |
| `control_request` | `request.{subtype: "set_permission_mode", mode}` | Switch permission mode mid-session. |

**Stall watchdog** (ws-bridge.ts:~750): if no CLI activity for `STALL_TIMEOUT_MS`, the server re-sends `lastUserNdjson` (retry-on-stall) — **guarded** by `readyState === WebSocket.OPEN` since M11 TD-033. On closed socket, triggers a CLI relaunch instead.

**Init watchdog** (ws-bridge.ts:~900): if `system/init` never arrives after the first `user` message, the server fires `onInitTimeout` → `index.ts` kills + relaunches up to `MAX_INIT_RETRIES=2` attempts, clearing `--resume` on the second attempt.

## 4. Right Leg — Server ↔ Browser (JSON)

**Wire format**: single JSON object per WebSocket frame (not NDJSON). Parsed in `web/src/ws.ts:handleMessage()` and typed as `BrowserIncomingMessage` / `BrowserOutgoingMessage` in `session-types.ts`.

### 4.1 Server → Browser messages (`BrowserIncomingMessage`)

Dispatched in `web/src/ws.ts:handleMessage()` to handlers in `web/src/ws-handlers/`.

| `type` | Purpose | Handler | Key fields |
|--------|---------|---------|-----------|
| `session_init` | Full session state pushed when browser first connects or when CLI reconnects | `session-handler.ts:handleSessionInit` | `session: SessionState` |
| `session_update` | Partial session state update | `session-handler.ts:handleSessionUpdate` | `session: Partial<SessionState>` |
| `assistant` | Forwarded CLI assistant block | `message-handler.ts:handleAssistant` | `message: CLIAssistantMessage["message"]`, `parent_tool_use_id` |
| `stream_event` | Forwarded CLI stream event | `message-handler.ts:handleStreamEvent` | `event: unknown`, `parent_tool_use_id` |
| `result` | Forwarded CLI result — triggers clear-on-next-result and queued-message flush | `result-handler.ts:handleResult` | `data: CLIResultMessage` |
| `permission_request` | Tool-approval prompt | `control-handler.ts:handlePermissionRequest` | `request: PermissionRequest` |
| `permission_cancelled` | Pending permission withdrawn (tool aborted) | `control-handler.ts:handlePermissionCancelled` | `request_id` |
| `tool_progress` | Long-tool heartbeat (currently ignored in UI, `ws.ts:114`) | — (no-op) | `tool_use_id`, `tool_name`, `elapsed_time_seconds` |
| `tool_use_summary` | Tool-group summary (currently ignored in UI) | — (no-op) | `summary`, `tool_use_ids[]` |
| `status_change` | Session status transition | `control-handler.ts:handleStatusChange` | `status: "compacting" \| "idle" \| "running" \| null` |
| `auth_status` | MCP / plugin auth status | `control-handler.ts:handleAuthStatus` | `isAuthenticating`, `output[]`, `error?` |
| `error` | Non-fatal error surfaced from the bridge | `control-handler.ts:handleError` | `message: string` |
| `cli_connected` | CLI WS attached | `control-handler.ts:handleCliConnected` | — |
| `cli_disconnected` | CLI WS dropped | `control-handler.ts:handleCliDisconnected` | — |
| `init_timeout` | `system/init` watchdog fired — UI shows retry notice | `control-handler.ts:handleInitTimeout` | — |
| `user_message` | Echo of a user message (used for history replay across browser tabs) | not dispatched — surfaced via `message_history` | `content`, `timestamp` |
| `message_history` | Replay buffer sent after reconnect | `message-handler.ts:handleMessageHistory` | `messages: BrowserIncomingMessage[]` |
| `session_name_update` | Auto-namer or manual rename broadcast | `session-handler.ts:handleSessionNameUpdate` | `name: string` |

### 4.2 Browser → Server messages (`BrowserOutgoingMessage`)

Sent via `sendToSession(sessionId, msg)` in `web/src/ws.ts:208`. Parsed in `WsBridge.routeBrowserMessage()` (`ws-bridge.ts:~839`).

| `type` | Fields | Server action |
|--------|--------|---------------|
| `user_message` | `content: string`, `session_id?`, `images?: {media_type, data}[]` | Translates to a CLI `user` NDJSON message and forwards. Starts init watchdog on first message. |
| `permission_response` | `request_id`, `behavior: "allow" \| "deny"`, `updated_input?`, `updated_permissions?`, `message?` | Translates to a CLI `control_response` and forwards. |
| `interrupt` | — | Sends CLI `control_request {subtype: "interrupt"}` **and** SIGINT to the process. |
| `set_model` | `model: string` | Sends CLI `control_request {subtype: "set_model"}`. |
| `set_permission_mode` | `mode: string` | Sends CLI `control_request {subtype: "set_permission_mode"}`. Also updates the server-side pinned mode via `onPermissionModeChangedCallback`. |

Plus a client-only keepalive: `{type: "ping"}` sent every `PING_INTERVAL_MS = 20_000` (see `web/src/ws.ts:138`). The server does not reply — it is a liveness nudge to defeat intermediate proxies (none in practice since we bind localhost).

### 4.3 SessionState shape

Sent as `session_init.session` and partially via `session_update.session`. Defined in `session-types.ts:192`.

```ts
interface SessionState {
  session_id: string;
  model: string;
  cwd: string;
  tools: string[];
  permissionMode: string;
  claude_code_version: string;
  mcp_servers: { name: string; status: string }[];
  agents: string[];
  slash_commands: string[];
  skills: string[];
  total_cost_usd: number;
  num_turns: number;
  context_used_percent: number;
  is_compacting: boolean;
  git_branch: string;
  is_worktree: boolean;
  repo_root: string;
  git_ahead: number;
  git_behind: number;
  total_lines_added: number;
  total_lines_removed: number;
}
```

### 4.4 PermissionRequest shape

```ts
interface PermissionRequest {
  request_id: string;
  tool_name: string;
  input: Record<string, unknown>;
  permission_suggestions?: PermissionUpdate[];
  description?: string;
  tool_use_id: string;
  agent_id?: string;
  timestamp: number;
}
```

`PermissionUpdate` is a discriminated union covering `addRules`, `replaceRules`, `removeRules`, `setMode`, `addDirectories`, `removeDirectories` — each with a `destination` of `"userSettings" | "projectSettings" | "localSettings" | "session" | "cliArg"`.

## 5. Terminal Leg — Browser ↔ Server ↔ node-pty

Independent of the CLI protocol. The server spawns a Node.js subprocess (`web/server/terminal-node.cjs`) that owns the node-pty instance, because Bun's sockets are incompatible with ConPTY on Windows. The bridge passes line-delimited JSON between the browser WS and the Node subprocess's stdio.

| Direction | Message | Purpose |
|-----------|---------|---------|
| Browser → server | `{type: "input", data: string}` | Keystrokes / paste buffer |
| Browser → server | `{type: "resize", cols: number, rows: number}` | xterm.js fit observer |
| Server → browser | `{type: "output", data: string}` | PTY stdout / stderr (UTF-8, ANSI-coloured) |
| Server → browser | `{type: "exit", code: number}` | Process ended |

Query param `cwd` on the upgrade URL seeds the PTY working directory. **Not path-validated** as of 2026-04-10 (tracked as TD-029 — accepted risk under local-only threat model).

**Spawn-lock** (since M11 TD-044): a promise chain serialises respawn of the same `terminalId`, awaiting the previous PTY exit before starting a new one.

## 6. Reconnection & Resilience

### Browser side (`web/src/ws.ts`)
- Reconnect backoff: `RECONNECT_MIN_MS = 2000` doubling to `RECONNECT_MAX_MS = 30000`.
- On reconnect, the server replays cached history via `message_history`.
- HMR-safe: sockets are tracked on `window.__ws_state`; on module replacement, handlers are re-bound.

### Server side (`web/server/ws-bridge.ts`)
- Per-session activity watchdog (`startActivityWatchdog`) detects stalled CLI output and retries the last `user` NDJSON.
- Init watchdog detects missing `system/init` and triggers a launcher relaunch.
- `flushAll()` on SIGTERM/SIGINT persists `session-store` state to disk (M11 TD-023).
- `CLIRelaunchNeeded` callback: when a browser connects to a session whose CLI is absent or dead, the launcher auto-relaunches it. Sessions recovered from disk without a live launcher entry are reconstructed from bridge state (see `web/server/index.ts:96`).

## 7. Mapping Summary

| User action | Browser msg | Server action | CLI msg |
|-------------|-------------|---------------|---------|
| Type + send prompt | `user_message` | translate + forward | `user` |
| Approve tool | `permission_response` (allow) | translate + forward | `control_response` success/allow |
| Deny tool | `permission_response` (deny) | translate + forward | `control_response` success/deny |
| Stop button | `interrupt` | send CLI interrupt + SIGINT | `control_request` interrupt |
| Change model | `set_model` | forward | `control_request` set_model |
| Plan mode toggle | `set_permission_mode` | forward + update pinned mode | `control_request` set_permission_mode |

| CLI event | CLI msg | Server action | Browser msg |
|-----------|---------|---------------|-------------|
| Session start | `system/init` | cache SessionState, clear init timer, notify launcher | `session_init` |
| Status change | `system/status` | update SessionState | `status_change`, `session_update` |
| Assistant turn | `assistant` | update streaming state, broadcast | `assistant` |
| Stream tokens | `stream_event` | broadcast | `stream_event` |
| Query done | `result` | update totals, flush queued message | `result` |
| Tool permission ask | `control_request` | pend + start 30s timer | `permission_request` |
| CLI dropped connection | (WS close) | mark cli disconnected, start relaunch decision | `cli_disconnected` |
