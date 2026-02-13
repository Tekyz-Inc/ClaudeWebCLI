# Architecture

**Version:** 0.14.1
**Last Updated:** 2026-02-10

---

## 1. System Overview

ClaudeWebCLI is a browser-based interface for Claude Code. It exploits the undocumented `--sdk-url` flag in the Claude Code CLI to bridge a WebSocket connection between the CLI process and a React frontend, with a Hono/Bun server acting as the protocol translator in the middle.

### Stack

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Language | TypeScript | ^5.9.3 | Strict mode, ES2022 target, bundler module resolution |
| Runtime | Bun | >=1.0.0 | Server runtime + dev tooling; native WebSocket via `Bun.serve` |
| Server Framework | Hono | ^4.7.0 | Only production dependency; REST routing + CORS |
| Client Framework | React | ^19.0.0 | With react-dom ^19.0.0 |
| State Management | Zustand | ^5.0.0 | Single store with ~30+ slices; localStorage persistence for select keys |
| Build Tool | Vite | ^6.3.0 | Dev server on :5174 with proxy to backend :3456 |
| CSS | Tailwind CSS | ^4.0.0 | v4 with `@theme` CSS custom properties |
| Code Editor | CodeMirror | ^4.25.4 | Via `@uiw/react-codemirror`; multi-language support |
| Terminal | xterm.js | ^6.0.0 | `@xterm/xterm` + `@xterm/addon-fit` (present in deps, not yet active in main UI) |
| Markdown | react-markdown | ^10.1.0 | With `remark-gfm` for GFM tables/strikethrough |
| Testing | Vitest | ^4.0.18 | Node env for server, jsdom for client via `environmentMatchGlobs` |
| Package Manager | Bun | - | Lockfile: `bun.lock` |

---

## 2. Three-Tier WebSocket Bridge

```
+----------------+    WebSocket (NDJSON)    +------------------+    WebSocket (JSON)    +-------------+
| Claude Code    | <---------------------> |  Bridge Server    | <-------------------> |   Browser    |
|     CLI        |  /ws/cli/:session       |  (Bun + Hono)     |  /ws/browser/:session |  (React +    |
|  --sdk-url     |                         |                   |                       |   Zustand)   |
+----------------+                         +------------------+                        +-------------+
```

- **Left leg (CLI <-> Server):** NDJSON over WebSocket. The CLI is the WebSocket *client*, connecting to the server via `--sdk-url`. This inverts the typical pattern where the server calls an API.
- **Right leg (Server <-> Browser):** Standard JSON over WebSocket. The browser is the client.
- **Bridge Server:** Translates protocols, manages sessions, handles tool approval routing, persists session state to disk.

The CLI is launched with:
```bash
claude --sdk-url ws://localhost:3456/ws/cli/SESSION_ID \
  --print --output-format stream-json --input-format stream-json \
  --verbose -p "placeholder"
```

The `-p "placeholder"` prompt is ignored -- the CLI waits for a `user` message over the WebSocket.

---

## 3. Directory Structure

```
ClaudeWebCLI/
├── package.json                    # Root monorepo wrapper (v0.14.1), delegates to web/
├── Makefile                        # Single `dev` target: cd web && bun run dev
├── CLAUDE.md                       # Project instructions, conventions, protocol docs
├── .gsd-t/                         # GSD-T workflow state
│
└── web/                            # All application code
    ├── package.json                # App package (hono prod dep; everything else dev)
    ├── tsconfig.json               # ES2022, strict, bundler resolution
    ├── vite.config.ts              # React + Tailwind plugins; proxy /api and /ws to :3456
    ├── vitest.config.ts            # Node for server tests, jsdom for client tests
    ├── dev.ts                      # Unified dev script: spawns backend + Vite in parallel
    ├── bin/cli.ts                  # npm package CLI entry point
    │
    ├── server/                     # Backend (Bun + Hono + native WebSocket)
    │   ├── index.ts                # Entry: Bun.serve with dual WS upgrade paths + Hono fetch
    │   ├── routes.ts               # REST API: sessions, filesystem, git, environments
    │   ├── ws-bridge.ts            # Core bridge: CLI (NDJSON) <-> Browser (JSON) translation
    │   ├── cli-launcher.ts         # Spawns Claude CLI with --sdk-url; manages process lifecycle
    │   ├── session-store.ts        # Disk persistence: JSON files in $TMPDIR/vibe-sessions/
    │   ├── session-types.ts        # All WebSocket protocol types (CLI + Browser messages)
    │   ├── session-names.ts        # Session name persistence (~/.companion/session-names.json)
    │   ├── auto-namer.ts           # One-shot Claude CLI to generate 3-5 word session title
    │   ├── env-manager.ts          # Environment variable sets CRUD (~/.companion/envs/)
    │   ├── git-utils.ts            # Git operations: branches, worktrees, fetch, pull, checkout
    │   ├── worktree-tracker.ts     # Session-to-worktree mapping (~/.companion/worktrees.json)
    │   └── *.test.ts               # Co-located server tests (9 test files)
    │
    ├── src/                        # Frontend (React 19 + Zustand + Vite)
    │   ├── main.tsx                # React entry: StrictMode + App render
    │   ├── App.tsx                 # Root layout: Sidebar | Main (ChatView/HomePage/Editor) | TaskPanel
    │   ├── store.ts                # Zustand store (~484 lines, ~30+ slices)
    │   ├── types.ts                # Re-exports server types + client-specific types
    │   ├── api.ts                  # REST client: typed wrappers for all /api endpoints
    │   ├── ws.ts                   # WebSocket client: connect/disconnect/send with auto-reconnect
    │   ├── index.css               # Tailwind v4 @theme + custom animations + dark mode tokens
    │   │
    │   ├── components/
    │   │   ├── ChatView.tsx        # Message feed + permission banners + composer
    │   │   ├── Composer.tsx        # Input: slash cmds, image, voice, history, drag-drop, plan mode
    │   │   ├── MessageBubble.tsx   # Renders messages: markdown, code blocks, tool blocks, thinking
    │   │   ├── MessageFeed.tsx     # Message list: auto-scroll, grouping, subagent nesting
    │   │   ├── PermissionBanner.tsx # Tool approval UI (Bash/Edit/Write/Read/Glob/Grep/etc.)
    │   │   ├── Sidebar.tsx         # Session list: polling, rename, archive, branch display
    │   │   ├── TopBar.tsx          # Connection status, tab toggle, task panel toggle
    │   │   ├── HomePage.tsx        # Session creation: model, 4 permission modes, folder, project detect, branch, env
    │   │   ├── ToolBlock.tsx       # Collapsible tool call visualization with per-tool icons
    │   │   ├── TaskPanel.tsx       # Right sidebar: session stats (cost, context, turns) + task list
    │   │   ├── EditorPanel.tsx     # CodeMirror editor: file tree, auto-save, diff view
    │   │   ├── EnvManager.tsx      # Modal: environment variable set CRUD
    │   │   ├── FolderPicker.tsx    # Modal: folder browser with recent dirs
    │   │   └── Playground.tsx      # Dev-only component playground at #/playground
    │   │
    │   ├── hooks/
    │   │   ├── use-prompt-history.ts # Terminal-like Up/Down prompt history navigation
    │   │   ├── use-voice-input.ts   # Unified voice hook: Whisper primary + Web Speech API fallback
    │   │   └── use-whisper.ts       # Whisper pipeline management: Web Worker lifecycle, audio capture
    │   │
    │   └── utils/
    │       ├── audio-utils.ts      # Audio capture (getUserMedia) + PCM conversion (16kHz Float32)
    │       ├── names.ts            # Random adjective+noun session name generator
    │       ├── notifications.ts    # Desktop notification API (permission, send, click-to-focus)
    │       ├── project-detector.ts # Detect project type from directory listing
    │       ├── recent-dirs.ts      # localStorage recent directories (max 5)
    │       └── whisper-worker.ts   # Web Worker: Whisper model loading + inference (@huggingface/transformers)
    │
    └── dist/                       # Vite build output (client assets)
```

---

## 4. Data Flow Diagrams

### 4.1 User Message Round-Trip

```
Browser                    Bridge Server                    Claude CLI
  |                            |                               |
  | 1. WS: user_message       |                               |
  | -------------------------> |                               |
  |                            | 2. NDJSON: { type: "user",    |
  |                            |    message: { role: "user",   |
  |                            |    content: [...] } }         |
  |                            | ------------------------------>|
  |                            |                               |
  |                            | 3. NDJSON: stream_event       |
  |                            |    (content_block_delta)      |
  |                            | <------------------------------|
  | 4. WS: stream_event       |                               |
  | <------------------------- |                               |
  |                            |                               |
  |                            | 5. NDJSON: assistant          |
  |                            |    (full response + blocks)   |
  |                            | <------------------------------|
  | 6. WS: assistant          |                               |
  | <------------------------- |                               |
  |                            |                               |
  |                            | 7. NDJSON: result             |
  |                            |    (cost, turns, model usage) |
  |                            | <------------------------------|
  | 8. WS: result             |                               |
  | <------------------------- |                               |
```

### 4.2 Tool Permission Flow

```
Browser                    Bridge Server                    Claude CLI
  |                            |                               |
  |                            | 1. NDJSON: control_request    |
  |                            |    { subtype: "can_use_tool", |
  |                            |      tool_name, input,        |
  |                            |      request_id }             |
  |                            | <------------------------------|
  | 2. WS: permission_request |                               |
  | <------------------------- |                               |
  |                            |                               |
  | 3. WS: permission_response|                               |
  |    { request_id,           |                               |
  |      behavior: allow/deny }|                               |
  | -------------------------> |                               |
  |                            | 4. NDJSON: control_response   |
  |                            |    { subtype: "success",      |
  |                            |      response: { behavior } } |
  |                            | ------------------------------>|
```

### 4.3 Session Creation Flow

```
Browser                    Bridge Server                    Claude CLI
  |                            |                               |
  | 1. POST /api/sessions      |                               |
  |    { model, permMode,      |                               |
  |      cwd, branch, env }    |                               |
  | -------------------------> |                               |
  |                            | 2. Resolve env vars           |
  |                            | 3. Setup worktree (optional)  |
  |                            | 4. Track worktree mapping     |
  |                            | 5. Spawn CLI subprocess       |
  |                            |    claude --sdk-url ws://     |
  |                            |    localhost:3456/ws/cli/{id}  |
  |                            | ------------------------------>|
  | 6. Response: { sessionId } |                               |
  | <------------------------- |                               |
  |                            |                               |
  | 7. WS connect:             |                               |
  |    /ws/browser/{sessionId} |                               |
  | -------------------------> |                               |
  |                            | 8. CLI connects:              |
  |                            |    /ws/cli/{sessionId}        |
  |                            | <------------------------------|
  |                            |                               |
  |                            | 9. NDJSON: system (init)      |
  |                            |    { session_id, tools,       |
  |                            |      model, version }         |
  |                            | <------------------------------|
  | 10. WS: session_init      |                               |
  | <------------------------- |                               |
  |                            |                               |
  | 11. WS: user_message      |                               |
  |     (first prompt + images)|                               |
  | -------------------------> |                               |
  |                            | 12. NDJSON: user message      |
  |                            | ------------------------------>|
```

---

## 5. REST API Endpoints

All endpoints are served by Hono on the bridge server (default port 3456).

### Session Management

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/sessions` | Create session (model, permMode, cwd, branch, env, worktree, tools) |
| GET | `/api/sessions` | List all sessions |
| GET | `/api/sessions/:id` | Get single session state |
| PATCH | `/api/sessions/:id/rename` | Rename session |
| POST | `/api/sessions/:id/kill` | Kill CLI process |
| POST | `/api/sessions/:id/relaunch` | Relaunch CLI with --resume |
| DELETE | `/api/sessions/:id` | Delete session + cleanup worktree |
| POST | `/api/sessions/:id/archive` | Archive session |
| POST | `/api/sessions/:id/unarchive` | Unarchive session |

### Filesystem

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/dirs` | List directory contents |
| GET | `/api/home` | Get home directory path |
| GET | `/api/tree` | Recursive file tree for editor |
| GET | `/api/file` | Read file contents |
| PUT | `/api/file` | Write file contents |
| GET | `/api/diff` | Git diff for a file |

### Environment Management

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/envs` | List environment sets |
| POST | `/api/envs` | Create environment set |
| PUT | `/api/envs/:slug` | Update environment set |
| DELETE | `/api/envs/:slug` | Delete environment set |

### Git Operations

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/git/repo-info` | Repo root + current/default branch |
| GET | `/api/git/branches` | List branches with ahead/behind + worktree info |
| GET | `/api/git/worktrees` | List git worktrees |
| POST | `/api/git/worktrees` | Create worktree |
| DELETE | `/api/git/worktrees` | Remove worktree |
| POST | `/api/git/fetch` | Git fetch |
| POST | `/api/git/pull` | Git pull (returns new ahead/behind) |

---

## 6. State Management

### 6.1 Server-Side Stores

| Store | Source File | Persistence | Contents |
|-------|------------|-------------|----------|
| **WsBridge** | `ws-bridge.ts` | In-memory Maps | `cliSockets`, `browserSockets`, `sessionStates`, `messageQueues`, `pendingRequests`, `autoNameAttempted` |
| **CliLauncher** | `cli-launcher.ts` | In-memory Map + disk | `processes` Map; launcher config persisted alongside session store |
| **SessionStore** | `session-store.ts` | `$TMPDIR/vibe-sessions/{id}.json` | Full `SessionState` per session; debounced writes (150ms) |
| **SessionNames** | `session-names.ts` | `~/.companion/session-names.json` | `{ sessionId: displayName }` mapping |
| **WorktreeTracker** | `worktree-tracker.ts` | `~/.companion/worktrees.json` | `{ sessionId, repoRoot, branch, actualBranch, worktreePath, createdAt }[]` |
| **EnvManager** | `env-manager.ts` | `~/.companion/envs/{slug}.json` | `{ name, slug, variables: Record<string,string> }` |

### 6.2 Client-Side State (Zustand Store)

Single Zustand store in `store.ts` with all state keyed by session ID.

| Slice | Type | Persistence | Purpose |
|-------|------|-------------|---------|
| `sessions` | `Map<string, SessionState>` | No | Session metadata from server |
| `sdkSessions` | `Map<string, SdkSessionInfo>` | No | SDK session info (tools, model, version) |
| `currentSessionId` | `string \| null` | localStorage | Active session |
| `messages` | `Map<string, ChatMessage[]>` | No | Chat history per session |
| `streaming` | `Map<string, string \| null>` | No | In-progress streaming text |
| `streamingStartedAt` | `Map<string, number>` | No | Generation timing |
| `streamingOutputTokens` | `Map<string, number>` | No | Token counter during generation |
| `pendingPermissions` | `Map<string, Map<string, PermissionRequest>>` | No | Awaiting user approval |
| `connectionStatus` | `Map<string, string>` | No | WebSocket state per session |
| `cliConnected` | `Map<string, boolean>` | No | CLI process alive per session |
| `sessionStatus` | `Map<string, string \| null>` | No | idle/running/compacting per session |
| `previousPermissionMode` | `Map<string, string>` | No | For plan mode toggle restore |
| `sessionTasks` | `Map<string, TaskItem[]>` | No | Extracted from TodoWrite/TaskCreate/TaskUpdate |
| `changedFiles` | `Map<string, Set<string>>` | No | Files modified via Edit/Write tools |
| `sessionNames` | `Map<string, string>` | localStorage | Display names for sessions |
| `recentlyRenamed` | `Set<string>` | No | Suppress rename animation flicker |
| `darkMode` | `boolean` | localStorage | Theme toggle |
| `promptHistory` | `Map<string, string[]>` | localStorage | Sent prompts per session (max 50, oldest dropped) |
| `sidebarOpen` | `boolean` | No | Mobile sidebar visibility |
| `taskPanelOpen` | `boolean` | No | Right panel visibility |
| `activeTab` | `"chat" \| "editor"` | No | Main content area tab |
| `editorFile` | `string \| null` | No | Currently open file in editor |
| `editorDirty` | `boolean` | No | Unsaved changes indicator |

### 6.3 WebSocket Client State (Module-Level)

In `ws.ts`, additional state is managed outside Zustand via module-level Maps:

| Map | Purpose |
|-----|---------|
| `sockets` | `Map<string, WebSocket>` -- active WebSocket connections |
| `reconnectTimers` | `Map<string, ReturnType<typeof setTimeout>>` -- pending reconnect timers |
| `taskCounters` | `Map<string, number>` -- incremental task ID counters |
| `processedToolUseIds` | `Map<string, Set<string>>` -- dedup tool_use IDs to prevent duplicate task extraction |

---

## 7. WebSocket Protocol

### 7.1 CLI Side (NDJSON)

The CLI communicates using newline-delimited JSON. Each message is a single JSON object terminated by `\n`.

**CLI -> Server:**

| Type | Purpose |
|------|---------|
| `system` (init) | First message -- session ID, tools, model, version |
| `system` (status) | Status changes (processing, waiting, complete) |
| `assistant` | Full assistant response with content blocks |
| `result` | Query complete marker with cost, turns, model usage |
| `stream_event` | Token-by-token streaming (content_block_delta, etc.) |
| `control_request` | Tool permission requests (subtype: `can_use_tool`) |
| `tool_progress` | Long-running tool progress updates |
| `tool_use_summary` | Summary of tool execution results |
| `keep_alive` | Keepalive signal |

**Server -> CLI:**

| Type | Purpose |
|------|---------|
| `user` | Send prompts or follow-up messages |
| `control_response` | Respond to tool permission requests |
| `control_request` | Server-initiated control (interrupt, set_model, set_permission_mode) |

### 7.2 Browser Side (JSON)

Standard JSON messages over WebSocket. The bridge translates between NDJSON (CLI) and JSON (browser), mapping message types and extracting relevant fields.

**Browser -> Server:**

| Type | Purpose |
|------|---------|
| `user_message` | User prompt (text + optional images) |
| `permission_response` | Tool approval/denial (request_id + behavior) |

**Server -> Browser:**

| Type | Purpose |
|------|---------|
| `session_init` | Session initialized (tools, model, version) |
| `stream_event` | Streaming token deltas |
| `assistant` | Full assistant response |
| `result` | Query complete with stats |
| `permission_request` | Tool approval needed |
| `cli_status` | CLI connection/disconnection events |
| `system_status` | Processing state changes |

### 7.3 Tool Approval

```
CLI sends:   { type: "control_request", request: { subtype: "can_use_tool",
               request_id: "...", tool_name: "Bash", input: {...} } }

Server sends to browser:  permission_request with tool details

Browser sends: { type: "permission_response", request_id: "...", behavior: "allow" }

Server sends to CLI: { type: "control_response", response: { subtype: "success",
                       request_id: "...", response: { behavior: "allow" } } }
```

---

## 8. Session Lifecycle

### 8.1 Creation

1. Browser sends `POST /api/sessions` with model, permission mode, working directory, optional branch, optional environment set, optional worktree flag.
2. Server resolves environment variables from the specified env set.
3. If a branch is specified and worktree mode is on, the server creates a git worktree in `~/.companion/worktrees/` and tracks it.
4. Server spawns `claude --sdk-url ws://localhost:3456/ws/cli/{sessionId}` as a subprocess.
5. Server returns `{ sessionId }` to the browser.
6. Browser opens WebSocket to `/ws/browser/{sessionId}`.
7. CLI connects to `/ws/cli/{sessionId}`.
8. CLI sends `system` init message (session_id, tools, model, version).
9. Browser sends first `user_message` with the actual prompt.

### 8.2 Persistence

- Session state is written to `$TMPDIR/vibe-sessions/{id}.json` via debounced writes (150ms coalescing).
- Session display names are stored in `~/.companion/session-names.json`.
- Worktree mappings are tracked in `~/.companion/worktrees.json`.
- Message history and pending permissions are kept in the bridge's in-memory Maps.

### 8.3 Reconnection

Multiple reconnection mechanisms operate at different levels:

| Mechanism | Trigger | Behavior |
|-----------|---------|----------|
| Browser WebSocket auto-reconnect | WebSocket close event | Reconnects after 2s delay (`ws.ts` `scheduleReconnect`) |
| CLI reconnection watchdog | Server startup | Checks existing session files, relaunches CLI with `--resume` after 10s grace period |
| Browser-triggered relaunch | Browser connects to session with dead CLI | Server auto-relaunches CLI for that session |
| Manual relaunch | User clicks "Reconnect" button | UI button in `ChatView.tsx` triggers relaunch API call |

### 8.4 Resume

When a CLI process dies or the server restarts:
1. Server checks for existing session files in `$TMPDIR/vibe-sessions/`.
2. For sessions with live PIDs, it gives a 10s grace period for the CLI to reconnect its WebSocket.
3. If the CLI does not reconnect, the server kills the stale PID and relaunches with `claude --resume` using the CLI's internal session ID.
4. The resumed CLI reconnects to the same WebSocket path and the conversation continues.

### 8.5 Archival and Deletion

- **Archive:** `POST /api/sessions/:id/archive` marks a session as archived (hidden from default list, preservable).
- **Unarchive:** `POST /api/sessions/:id/unarchive` restores it.
- **Delete:** `DELETE /api/sessions/:id` kills the CLI process, removes the session store file, and cleans up the associated worktree if no other sessions use it.

---

## 9. Configuration

### 9.1 Ports

| Port | Service | Configured In |
|------|---------|--------------|
| 3456 | Bridge server (Hono + WebSocket) | `server/index.ts` (default), overridable via `PORT` env var |
| 5174 | Vite dev server (frontend) | `vite.config.ts` |

### 9.2 Environment Variables

| Variable | Used In | Purpose | Default |
|----------|---------|---------|---------|
| `PORT` | `server/index.ts` | Override bridge server port | 3456 |
| `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` | `server/index.ts` | Force-enabled to `1` at startup | (set automatically) |
| `__VIBE_PACKAGE_ROOT` | `server/index.ts`, `bin/cli.ts` | Locate static assets in packaged distribution | (unset) |

### 9.3 External Persistence Paths

| Path | Module | Contents |
|------|--------|----------|
| `$TMPDIR/vibe-sessions/` | `session-store.ts` | Session JSON files + launcher.json |
| `~/.companion/session-names.json` | `session-names.ts` | Session ID to display name mapping |
| `~/.companion/worktrees.json` | `worktree-tracker.ts` | Session-to-worktree mapping array |
| `~/.companion/worktrees/` | `git-utils.ts` | Actual git worktree directories |
| `~/.companion/envs/` | `env-manager.ts` | Environment variable set JSON files |

### 9.4 Build and Dev Configuration Files

| File | Purpose |
|------|---------|
| `web/package.json` | Dependencies + scripts; `engines: { bun: ">=1.0.0" }` |
| `web/tsconfig.json` | `strict: true`, ES2022, bundler module resolution |
| `web/vite.config.ts` | Port 5174, proxy `/api` + `/ws` to `:3456`, React + Tailwind plugins |
| `web/vitest.config.ts` | `jsdom` for `src/**` tests, `node` for `server/**` tests |
| `web/dev.ts` | Parallel backend + Vite dev server spawning |

---

## 10. Key Patterns

### 10.1 Co-located Tests

Test files sit alongside their source files (`*.test.ts` next to `*.ts`). The vitest config uses `environmentMatchGlobs` to assign the correct test environment (node vs jsdom) based on file path.

### 10.2 Shared Type System

`web/src/types.ts` re-exports types from `web/server/session-types.ts`, creating a shared type vocabulary between server and client. Client-specific types (`ChatMessage`, `TaskItem`, `SdkSessionInfo`) are defined only in the client types file.

### 10.3 Module-Level Singletons

Server modules use class instances as singletons (`WsBridge`, `CliLauncher`, `SessionStore`, `WorktreeTracker`) created once in `index.ts` and wired together via constructor injection. `EnvManager` and `SessionNames` use module-level state with exported functions.

### 10.4 Debounced Disk Persistence

`SessionStore` debounces writes with a 150ms delay to coalesce rapid state changes into single disk operations, preventing I/O thrashing during streaming.

### 10.5 Reconnection Resilience

Four layers of reconnection: browser auto-reconnect (2s delay), server startup watchdog (10s grace), browser-triggered CLI relaunch, and manual relaunch button. See Section 8.3 for details.

### 10.6 Git Worktree Isolation

Sessions can use git worktrees (in `~/.companion/worktrees/`) so multiple sessions can work on the same repository simultaneously without conflicts. Worktree branches get a unique suffix (`-wt-{random4}`) to avoid name collisions. `WorktreeTracker` prevents deleting worktrees still in use by other sessions.

### 10.7 Task Extraction from Tool Calls

The client-side `ws.ts` scans every `tool_use` content block for `TodoWrite`, `TaskCreate`, and `TaskUpdate` tool calls, extracting task state into the Zustand store. Deduplication via `processedToolUseIds` prevents duplicate task creation from streaming + final messages.

### 10.8 Auto-Naming via One-Shot CLI

Session titles are generated by spawning a separate Claude CLI process (`auto-namer.ts`) that receives the first user message and returns a 3-5 word title. Runs asynchronously after the first turn, with a 15s timeout.

### 10.9 Theme System via CSS Custom Properties

The app defines a custom theme layer using CSS custom properties (`--color-cc-bg`, `--color-cc-fg`, etc.) in Tailwind v4 `@theme` blocks. The `.dark` class overrides these properties. Components use theme tokens (`bg-cc-bg`, `text-cc-fg`) rather than hardcoded colors.

### 10.10 Hash-Based Routing

Minimal routing via `window.location.hash` (`#/playground` for the dev playground). The main app uses conditional rendering based on `currentSessionId` state rather than URL routing.

### 10.11 Sidebar Session Polling

The sidebar polls `GET /api/sessions` every 5 seconds to update the session list.

---

## 11. Design Decisions

_This section tracks architectural decisions and their rationale. Add entries as decisions are made._

| ID | Date | Decision | Rationale |
|----|------|----------|-----------|
| | | | |
