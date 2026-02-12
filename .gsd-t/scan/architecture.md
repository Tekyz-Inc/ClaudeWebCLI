# Architecture Analysis: ClaudeWebCLI

**Scan Date:** 2026-02-10
**Scanned By:** Architecture Scan (GSD-T)
**Codebase Root:** `web/`
**Version:** 0.14.1

---

## Stack

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| **Language** | TypeScript | ^5.9.3 | Strict mode, ES2022 target, bundler module resolution |
| **Runtime** | Bun | >=1.0.0 | Used for both server and dev tooling; native WebSocket via `Bun.serve` |
| **Server Framework** | Hono | ^4.7.0 | Only production dependency; REST API routing + CORS |
| **Client Framework** | React | ^19.0.0 | With react-dom ^19.0.0; JSX transform via react-jsx |
| **State Management** | Zustand | ^5.0.0 | Single store with ~30+ slices; localStorage persistence for select keys |
| **Build Tool** | Vite | ^6.3.0 | Dev server on :5174 with proxy to backend :3456 |
| **CSS** | Tailwind CSS | ^4.0.0 | v4 with `@theme` CSS custom properties; `@tailwindcss/vite` plugin |
| **Code Editor** | CodeMirror | ^4.25.4 | Via `@uiw/react-codemirror`; multi-language support |
| **Terminal** | xterm.js | ^6.0.0 | `@xterm/xterm` + `@xterm/addon-fit` (present in deps, not yet actively used in main UI) |
| **Markdown** | react-markdown | ^10.1.0 | With `remark-gfm` for GFM tables/strikethrough |
| **Testing** | Vitest | ^4.0.18 | Node env for server, jsdom for client via `environmentMatchGlobs` |
| **Package Manager** | Bun | - | Lockfile: `bun.lock` |

---

## Structure

```
ClaudeWebCLI/
├── package.json                    # Root monorepo wrapper (v0.14.1), delegates to web/
├── Makefile                        # Single `dev` target: cd web && bun run dev
├── CLAUDE.md                       # Project instructions (architecture, protocol, conventions)
├── .gsd-t/                         # GSD-T workflow state
│   ├── progress.md
│   └── scan/
│       ├── architecture.md         # (this file)
│       └── security.md
│
└── web/                            # All application code lives here
    ├── package.json                # App package (hono prod dep; react/vite/vitest dev deps)
    ├── tsconfig.json               # ES2022, strict, bundler resolution, includes src + server
    ├── vite.config.ts              # React + Tailwind plugins; proxy /api and /ws to :3456
    ├── vitest.config.ts            # Node for server tests, jsdom for client tests
    ├── dev.ts                      # Unified dev script: spawns backend + Vite in parallel
    ├── bin/cli.ts                  # npm package CLI entry point (sets __VIBE_PACKAGE_ROOT)
    ├── CHANGELOG.md                # Release history
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
    │   ├── *.test.ts               # Co-located server tests (9 test files)
    │   └── __tests__/              # Additional test directory
    │
    ├── src/                        # Frontend (React 19 + Zustand + Vite)
    │   ├── main.tsx                # React entry: StrictMode + App render
    │   ├── App.tsx                 # Root layout: Sidebar | Main (ChatView/HomePage/Editor) | TaskPanel
    │   ├── store.ts                # Zustand store (~484 lines, ~30+ slices)
    │   ├── types.ts                # Re-exports server types + client-specific (ChatMessage, TaskItem)
    │   ├── api.ts                  # REST client: typed wrappers for all /api endpoints
    │   ├── ws.ts                   # WebSocket client: connect/disconnect/send with auto-reconnect
    │   ├── index.css               # Tailwind v4 @theme + custom animations + dark mode tokens
    │   ├── test-setup.ts           # jsdom polyfill for matchMedia
    │   │
    │   ├── components/
    │   │   ├── ChatView.tsx        # Composes MessageFeed + PermissionBanner(s) + Composer
    │   │   ├── Composer.tsx        # Input: slash commands, image attach, plan mode, git info
    │   │   ├── MessageBubble.tsx   # Renders messages: markdown, code blocks, tool blocks, thinking
    │   │   ├── MessageFeed.tsx     # Message list: auto-scroll, grouping, subagent nesting, streaming
    │   │   ├── PermissionBanner.tsx # Tool approval UI (Bash/Edit/Write/Read/Glob/Grep/etc.)
    │   │   ├── Sidebar.tsx         # Session list: polling, rename, archive, branch display
    │   │   ├── TopBar.tsx          # Connection status, tab toggle (Chat/Editor), task panel toggle
    │   │   ├── HomePage.tsx        # Session creation: model, permissions, folder, branch, env, worktree
    │   │   ├── ToolBlock.tsx       # Collapsible tool call visualization with per-tool icons
    │   │   ├── TaskPanel.tsx       # Right sidebar: session stats (cost, context, turns) + task list
    │   │   ├── EditorPanel.tsx     # CodeMirror editor: file tree, auto-save, diff view
    │   │   ├── EnvManager.tsx      # Modal: environment variable set CRUD
    │   │   ├── FolderPicker.tsx    # Modal: folder browser with recent dirs
    │   │   └── Playground.tsx      # Dev-only component playground at #/playground
    │   │
    │   └── utils/
    │       ├── names.ts            # Random adjective+noun session name generator
    │       └── recent-dirs.ts      # localStorage recent directories (max 5)
    │
    └── dist/                       # Vite build output (client assets)
```

### File Count & Size Summary

| Directory | Files | Largest File | Notes |
|-----------|-------|-------------|-------|
| `server/` | 11 source + 9 test | `ws-bridge.ts` (744 lines) | Core logic here |
| `src/` | 5 root + 14 components + 2 utils | `HomePage.tsx` (696 lines) | UI-heavy |
| Config | 5 files | - | Minimal configuration surface |

---

## Data Flow

### Primary Path: User Message Round-Trip

```
Browser                    Bridge Server                    Claude CLI
  │                            │                               │
  │ 1. WS: user_message       │                               │
  │ ─────────────────────────> │                               │
  │                            │ 2. NDJSON: { type: "user",    │
  │                            │    message: { role: "user",   │
  │                            │    content: [...] } }         │
  │                            │ ─────────────────────────────>│
  │                            │                               │
  │                            │ 3. NDJSON: stream_event       │
  │                            │    (content_block_delta)      │
  │                            │ <─────────────────────────────│
  │ 4. WS: stream_event       │                               │
  │ <───────────────────────── │                               │
  │                            │                               │
  │                            │ 5. NDJSON: assistant          │
  │                            │    (full response + blocks)   │
  │                            │ <─────────────────────────────│
  │ 6. WS: assistant          │                               │
  │ <───────────────────────── │                               │
  │                            │                               │
  │                            │ 7. NDJSON: result             │
  │                            │    (cost, turns, model usage) │
  │                            │ <─────────────────────────────│
  │ 8. WS: result             │                               │
  │ <───────────────────────── │                               │
```

### Tool Permission Flow

```
Browser                    Bridge Server                    Claude CLI
  │                            │                               │
  │                            │ 1. NDJSON: control_request    │
  │                            │    { subtype: "can_use_tool", │
  │                            │      tool_name, input,        │
  │                            │      request_id }             │
  │                            │ <─────────────────────────────│
  │ 2. WS: permission_request │                               │
  │ <───────────────────────── │                               │
  │                            │                               │
  │ 3. WS: permission_response│                               │
  │    { request_id,           │                               │
  │      behavior: allow/deny }│                               │
  │ ─────────────────────────> │                               │
  │                            │ 4. NDJSON: control_response   │
  │                            │    { subtype: "success",      │
  │                            │      response: { behavior } } │
  │                            │ ─────────────────────────────>│
```

### Session Creation Flow

```
Browser                    Bridge Server                    Claude CLI
  │                            │                               │
  │ 1. POST /api/sessions      │                               │
  │    { model, permMode,      │                               │
  │      cwd, branch, env }    │                               │
  │ ─────────────────────────> │                               │
  │                            │ 2. Resolve env vars           │
  │                            │ 3. Setup worktree (optional)  │
  │                            │ 4. Track worktree mapping     │
  │                            │ 5. Spawn CLI subprocess       │
  │                            │    claude --sdk-url ws://     │
  │                            │    localhost:3456/ws/cli/{id}  │
  │                            │ ─────────────────────────────>│
  │ 6. Response: { sessionId } │                               │
  │ <───────────────────────── │                               │
  │                            │                               │
  │ 7. WS connect:             │                               │
  │    /ws/browser/{sessionId} │                               │
  │ ─────────────────────────> │                               │
  │                            │ 8. CLI connects:              │
  │                            │    /ws/cli/{sessionId}        │
  │                            │ <─────────────────────────────│
  │                            │                               │
  │                            │ 9. NDJSON: system (init)      │
  │                            │    { session_id, tools,       │
  │                            │      model, version }         │
  │                            │ <─────────────────────────────│
  │ 10. WS: session_init      │                               │
  │ <───────────────────────── │                               │
  │                            │                               │
  │ 11. WS: user_message      │                               │
  │     (first prompt + images)│                               │
  │ ─────────────────────────> │                               │
  │                            │ 12. NDJSON: user message      │
  │                            │ ─────────────────────────────>│
```

### REST API Endpoints

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
| GET | `/api/dirs` | List directory contents |
| GET | `/api/home` | Get home directory path |
| GET | `/api/tree` | Recursive file tree for editor |
| GET | `/api/file` | Read file contents |
| PUT | `/api/file` | Write file contents |
| GET | `/api/diff` | Git diff for a file |
| GET | `/api/envs` | List environment sets |
| POST | `/api/envs` | Create environment set |
| PUT | `/api/envs/:slug` | Update environment set |
| DELETE | `/api/envs/:slug` | Delete environment set |
| GET | `/api/git/repo-info` | Repo root + current/default branch |
| GET | `/api/git/branches` | List branches with ahead/behind + worktree info |
| GET | `/api/git/worktrees` | List git worktrees |
| POST | `/api/git/worktrees` | Create worktree |
| DELETE | `/api/git/worktrees` | Remove worktree |
| POST | `/api/git/fetch` | Git fetch |
| POST | `/api/git/pull` | Git pull (returns new ahead/behind) |

---

## State Management

### Server-Side State

| Store | Location | Persistence | Contents |
|-------|----------|-------------|----------|
| **WsBridge** (in-memory) | `ws-bridge.ts` | In-memory Maps | `cliSockets`, `browserSockets`, `sessionStates`, `messageQueues`, `pendingRequests`, `autoNameAttempted` |
| **CliLauncher** (in-memory) | `cli-launcher.ts` | In-memory Map + disk | `processes` Map; launcher config persisted alongside session store |
| **SessionStore** (disk) | `session-store.ts` | `$TMPDIR/vibe-sessions/{id}.json` | Full `SessionState` per session; debounced writes (150ms) |
| **SessionNames** (disk) | `session-names.ts` | `~/.companion/session-names.json` | `{ sessionId: displayName }` |
| **WorktreeTracker** (disk) | `worktree-tracker.ts` | `~/.companion/worktrees.json` | `{ sessionId, repoRoot, branch, actualBranch, worktreePath, createdAt }[]` |
| **EnvManager** (disk) | `env-manager.ts` | `~/.companion/envs/{slug}.json` | `{ name, slug, variables: Record<string,string> }` |

### Client-Side State (Zustand Store)

The single Zustand store in `store.ts` (~484 lines) manages all client state:

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
| `sidebarOpen` | `boolean` | No | Mobile sidebar visibility |
| `taskPanelOpen` | `boolean` | No | Right panel visibility |
| `activeTab` | `"chat" \| "editor"` | No | Main content area tab |
| `editorFile` | `string \| null` | No | Currently open file in editor |
| `editorDirty` | `boolean` | No | Unsaved changes indicator |

### WebSocket Client State (Module-Level)

In `ws.ts`, additional state is managed outside Zustand via module-level Maps:

| Map | Purpose |
|-----|---------|
| `sockets` | `Map<string, WebSocket>` - active WebSocket connections |
| `reconnectTimers` | `Map<string, ReturnType<typeof setTimeout>>` - pending reconnect timers |
| `taskCounters` | `Map<string, number>` - incremental task ID counters |
| `processedToolUseIds` | `Map<string, Set<string>>` - dedup tool_use IDs to prevent duplicate task extraction |

---

## Configuration

| File | Purpose | Key Settings |
|------|---------|-------------|
| `web/package.json` | Dependencies + scripts | `engines: { bun: ">=1.0.0" }` |
| `web/tsconfig.json` | TypeScript config | `strict: true`, `ES2022`, `bundler` resolution |
| `web/vite.config.ts` | Vite dev server | Port 5174, proxy `/api` + `/ws` to `:3456` |
| `web/vitest.config.ts` | Test config | `jsdom` for `src/**`, `node` for `server/**` |
| `web/dev.ts` | Dev orchestrator | Parallel backend + frontend spawning |
| `web/bin/cli.ts` | Package CLI | Sets `__VIBE_PACKAGE_ROOT` for asset resolution |

### Ports

| Port | Service | Configured In |
|------|---------|--------------|
| 3456 | Bridge server (Hono + WebSocket) | `server/index.ts` (default) |
| 5174 | Vite dev server (frontend) | `vite.config.ts` |

### Environment Variables

| Variable | Used In | Purpose |
|----------|---------|---------|
| `PORT` | `server/index.ts` | Override server port (default: 3456) |
| `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` | `server/index.ts` | Force-enabled to `1` at startup |
| `__VIBE_PACKAGE_ROOT` | `server/index.ts`, `bin/cli.ts` | Locate static assets in packaged distribution |

### External Persistence Paths

| Path | Module | Contents |
|------|--------|----------|
| `$TMPDIR/vibe-sessions/` | `session-store.ts` | Session JSON files + launcher.json |
| `~/.companion/session-names.json` | `session-names.ts` | Session ID to display name mapping |
| `~/.companion/worktrees.json` | `worktree-tracker.ts` | Session-to-worktree mapping array |
| `~/.companion/worktrees/` | `git-utils.ts` | Actual git worktree directories |
| `~/.companion/envs/` | `env-manager.ts` | Environment variable set JSON files |

---

## Patterns Observed

### 1. Three-Tier WebSocket Bridge (Core Architecture)

The system is fundamentally a protocol bridge between two WebSocket connections:
- **Left leg (CLI <-> Server):** NDJSON (newline-delimited JSON) over WebSocket. The Claude CLI is the WebSocket *client*, connecting to the server via `--sdk-url`.
- **Right leg (Server <-> Browser):** Standard JSON over WebSocket. The browser is the client.
- **Bridge logic** in `ws-bridge.ts` translates between the two protocols, managing message routing, queuing, and session state.

This is an inversion of the typical pattern where the server calls an API. Here, the server *receives* the CLI as a connecting client.

### 2. Flat Module Architecture

Both server and client use a flat directory structure with no deep nesting. Server modules are organized by responsibility (bridge, launcher, store, names, git, env) at a single level. Client components are all in `src/components/` without subdirectories. This keeps navigation simple but some files have grown large (`ws-bridge.ts` at 744 lines, `HomePage.tsx` at 696 lines, `Playground.tsx` at 531 lines, `PermissionBanner.tsx` at 515 lines).

### 3. Co-located Tests

Test files sit alongside their source files (`*.test.ts` next to `*.ts`). The vitest config uses `environmentMatchGlobs` to assign the correct test environment (node vs jsdom) based on file path. This keeps tests discoverable but mixes concerns in directory listings.

### 4. Shared Type System

`web/src/types.ts` re-exports types from `web/server/session-types.ts`, creating a shared type vocabulary between server and client. Client-specific types (`ChatMessage`, `TaskItem`, `SdkSessionInfo`) are defined only in the client types file. This avoids duplication but creates a compile-time dependency from client to server.

### 5. Module-Level Singletons

Server modules use class instances as singletons (`WsBridge`, `CliLauncher`, `SessionStore`, `WorktreeTracker`) created once in `index.ts` and wired together via constructor injection. The `EnvManager` and `SessionNames` modules use module-level state (plain objects/maps) with exported functions rather than classes.

### 6. Debounced Disk Persistence

`SessionStore` debounces writes with a 150ms delay to coalesce rapid state changes into single disk operations. This prevents I/O thrashing during streaming when session state updates on every token.

### 7. Reconnection Resilience

Multiple reconnection mechanisms operate at different levels:
- **Browser WebSocket:** Auto-reconnects with 2s delay on close (`ws.ts` `scheduleReconnect`)
- **CLI Reconnection Watchdog:** On server startup, checks for existing session files and relaunches CLI processes with `--resume` after a 10s grace period (`index.ts`)
- **Browser-Triggered Relaunch:** When a browser connects to a session with a dead CLI, the server automatically relaunches the CLI (`index.ts`)
- **Manual Relaunch:** UI shows "Reconnect" button when CLI is disconnected (`ChatView.tsx`)

### 8. Task Extraction from Tool Calls

The client-side `ws.ts` module scans every `tool_use` content block for `TodoWrite`, `TaskCreate`, and `TaskUpdate` tool calls, extracting task state into the Zustand store. A deduplication mechanism using `processedToolUseIds` prevents duplicate task creation when the same tool_use block is seen in both streaming and final messages, or in permission requests.

### 9. Auto-Naming via One-Shot CLI

Session titles are generated by spawning a *separate* Claude CLI process (via `auto-namer.ts`) that receives the first user message and returns a 3-5 word title. This runs asynchronously after the first turn completes and uses the same model as the session. A 15s timeout prevents hanging.

### 10. Git Worktree Isolation

When users select a branch for a session, the system can create a git worktree (in `~/.companion/worktrees/`) so multiple sessions can work on the same repository simultaneously without conflicts. Worktree branches get a unique suffix (`-wt-{random4}`) to avoid name collisions. The `WorktreeTracker` prevents deleting worktrees still in use by other sessions.

### 11. Theme System via CSS Custom Properties

Instead of Tailwind's built-in dark mode utilities, the app defines a custom theme layer using CSS custom properties (`--color-cc-bg`, `--color-cc-fg`, etc.) in `@theme` blocks. The `.dark` class overrides these properties. Components reference theme tokens (e.g., `bg-cc-bg`, `text-cc-fg`) rather than hardcoded colors.

### 12. Hash-Based Routing (Minimal)

The app uses `window.location.hash` for minimal routing (`#/playground` for the dev playground). The main app is a single-page view with conditional rendering based on `currentSessionId` state rather than URL routing.

---

## Architecture Concerns

### AC-1: Large Files Exceeding Guidelines

Several files significantly exceed the 200-line guideline documented in CLAUDE.md:

| File | Lines | Responsibility |
|------|-------|---------------|
| `server/ws-bridge.ts` | 744 | Protocol translation + session state + message routing + NDJSON parsing |
| `src/components/HomePage.tsx` | 696 | Session creation wizard with model/branch/env/worktree configuration |
| `src/components/Playground.tsx` | 531 | Mock data + component previews (dev-only) |
| `src/components/PermissionBanner.tsx` | 515 | Per-tool-type approval UI rendering |
| `server/cli-launcher.ts` | 491 | Process spawning + lifecycle + persistence + CLAUDE.md injection |
| `src/store.ts` | 484 | All application state (30+ slices) |
| `src/ws.ts` | 461 | WebSocket client + message handling + task extraction |

**Risk:** Harder to maintain, test, and reason about. `ws-bridge.ts` and `cli-launcher.ts` each handle multiple concerns that could be separated.

### AC-2: Dual State Systems (Zustand + Module Maps)

Client-side state is split between the Zustand store (reactive, component-accessible) and module-level Maps in `ws.ts` (non-reactive, imperative). The `sockets`, `reconnectTimers`, `taskCounters`, and `processedToolUseIds` maps are invisible to React components and can only be managed through the exported functions. This creates two sources of truth for connection state and makes cleanup coordination more complex.

### AC-3: No Authentication Layer

The bridge server has no authentication mechanism. The REST API and WebSocket endpoints are open to any connection on the network. The Vite dev config binds to `0.0.0.0` (all interfaces), meaning the server is accessible from other machines on the local network. Authentication is only present in the CLI-to-server direction (via `CLAUDE_CODE_SESSION_ACCESS_TOKEN`), not browser-to-server.

### AC-4: Temp Directory for Session Persistence

Session state is stored in `$TMPDIR/vibe-sessions/`. Temporary directories are subject to OS cleanup (e.g., on reboot, disk pressure, or scheduled cleanup). This means session state can be silently lost. Long-lived sessions or sessions containing important conversation history are at risk.

### AC-5: No Error Boundary in React

The React component tree has no `ErrorBoundary` component. An unhandled error in any component (particularly in complex rendering paths like `MessageBubble.tsx` markdown parsing or `ToolBlock.tsx` input rendering) will crash the entire application.

### AC-6: Tight Coupling Between Server Modules

`WsBridge` receives `CliLauncher` as a constructor parameter and calls methods on it directly. `CliLauncher` receives `WsBridge` references through launcher state callbacks. `index.ts` wires them together with cross-references. This creates a circular dependency in logic flow (bridge needs launcher for relaunch, launcher needs bridge for message delivery) that makes testing and module isolation difficult.

### AC-7: Polling for Session List

The sidebar polls `GET /api/sessions` every 5 seconds to update the session list. This works but creates unnecessary network traffic when nothing has changed. A WebSocket-based notification when sessions are created, deleted, or status-changed would be more efficient.

### AC-8: Client Directly Imports Server Types

`web/src/types.ts` imports from `../server/session-types.ts`. While this works with the bundler module resolution, it creates a compile-time dependency from the frontend to the backend source. If the server were ever separated into its own package or deployed independently, this import path would break. A shared types package or generated types would be more maintainable.

### AC-9: No Request Validation

The REST API in `routes.ts` does not validate request bodies (no schema validation library like Zod). Invalid payloads are handled via optional chaining and defaults, which can lead to silent failures or unexpected behavior rather than clear error responses.

### AC-10: Single-Process Architecture

The entire server (HTTP, WebSocket bridge, CLI process management, file operations, git operations) runs in a single Bun process. There is no worker separation, no process isolation, and no horizontal scaling path. A misbehaving CLI process or expensive git operation could block the event loop for all sessions.

### AC-11: Missing Cleanup on Session Delete

When a session is deleted via the REST API, the CLI process is killed and the session store file is removed, but the `processedToolUseIds` and `taskCounters` maps in the browser's `ws.ts` are only cleaned up when `disconnectSession` is called from the browser side. If the browser is not connected when a session is deleted server-side, these maps will leak until the browser tab is closed.

### AC-12: Hardcoded Claude CLI Path

`cli-launcher.ts` defaults to looking for `claude` on the system PATH. The binary path can be overridden per-session via the creation API, but there is no global configuration for the Claude binary location. In environments where the CLI is installed in a non-standard location, every session creation must specify the path.
