# Architecture Analysis — 2026-04-01

## Stack
- Language: TypeScript 5.9.3 (strict mode)
- Runtime: Bun >=1.0.0 (server), Vite 6.3.0 (client dev/build)
- Framework: Hono 4.7.0 (HTTP server), React 19.0.0 (client)
- State: Zustand 5.0.0 (client-side global store)
- Terminal: node-pty 1.1.0 via terminal-node.cjs bridge (Node.js subprocess — Bun+node-pty incompatible)
- WebSocket: Bun.serve built-in (server), native WebSocket (client)
- Testing: Vitest 4.0.18 (unit), Playwright 1.58.2 (E2E)
- Styling: Tailwind CSS 4.0.0 via @tailwindcss/vite
- Code Editor: CodeMirror (react-codemirror 4.25.4)
- Voice: @huggingface/transformers 3.8.1 (Whisper), @tekyzinc/stt-component 0.3.3
- Build: Vite 6.3.0 with React plugin
- Package: Forked from "the-vibe-companion" v0.12.11

## Metrics
- **Source files**: 82 (non-test .ts/.tsx)
- **Test files**: 33 (.test.ts/.tsx + .spec.ts)
- **Source lines**: ~13,892 (non-test)
- **Test lines**: ~10,949
- **Test ratio**: 79% (lines of test code vs source)

## Structure

```
web/
├── server/                     # Bridge server (Bun runtime)
│   ├── index.ts (257 lines)    # Entry: Hono app, WS upgrade, CORS, rate limiting
│   ├── ws-bridge.ts (947!)     # Core: CLI↔Browser message routing, session state, watchdogs
│   ├── cli-launcher.ts (582!)  # Process management: spawn/kill/relaunch Claude CLI
│   ├── session-store.ts (177)  # Persistence: JSON files in ~/.companion/sessions/
│   ├── session-types.ts (239)  # Type definitions: CLI NDJSON + Browser JSON protocols
│   ├── terminal-ws.ts (119)    # Terminal: PTY via Node.js bridge subprocess
│   ├── claude-sessions.ts (224)# Read native CLI sessions from ~/.claude/projects/
│   ├── git-utils.ts (378)      # Git: branch, worktree, diff utilities
│   ├── env-manager.ts (151)    # Environment variable management
│   ├── auto-namer.ts (81)      # AI-generated session titles
│   ├── security-utils.ts (155) # Path traversal guard, binary validation
│   ├── auth.ts (44)            # Bearer token middleware (not enforced)
│   ├── rate-limiter.ts (58)    # In-memory rate limiting
│   ├── security-headers.ts (17)# CSP, X-Frame, etc.
│   ├── session-names.ts (67)   # Session name store (in-memory)
│   ├── worktree-tracker.ts (84)# Git worktree lifecycle tracking
│   └── routes/                 # Modularized API routes (post-M8 refactor)
│       ├── index.ts (5)        # Re-exports
│       ├── schemas.ts (67)     # Zod validation schemas
│       ├── session-routes.ts (170)
│       ├── filesystem-routes.ts (150)
│       ├── git-routes.ts (93)
│       ├── environment-routes.ts (76)
│       ├── command-routes.ts (112)
│       └── worktree-helper.ts (34)
├── src/                        # React client (Vite build)
│   ├── App.tsx (138)           # Root: layout, routing, terminal mount
│   ├── store.ts (488!)         # Zustand store (38 maps, 50+ actions)
│   ├── ws.ts (223)             # WebSocket client: connect, reconnect, dispatch
│   ├── api.ts (240)            # REST API client
│   ├── types.ts (71)           # Shared client types
│   ├── main.tsx (10)           # React entry
│   ├── globals.d.ts (1)        # __API_PORT__ type
│   ├── store/                  # Store decomposition (post-M8)
│   │   ├── types.ts (159)      # AppState interface
│   │   ├── initial-state.ts (43)
│   │   ├── remove-session.ts (85)
│   │   └── resume-session.ts (42)
│   ├── ws-handlers/            # WS message handlers (post-M8)
│   │   ├── shared.ts (137)     # extractActivityFromBlocks, tool parsing
│   │   ├── session-handler.ts (48)
│   │   ├── message-handler.ts (128)
│   │   ├── result-handler.ts (86)
│   │   └── control-handler.ts (93)
│   ├── components/             # React UI components
│   │   ├── PermissionBanner.tsx (514!)
│   │   ├── Playground.tsx (530!)
│   │   ├── EditorPanel.tsx (469!)
│   │   ├── HomePage.tsx (416!)
│   │   ├── MessageBubble.tsx (355)
│   │   ├── Composer.tsx (353)
│   │   ├── TaskPanel.tsx (349)
│   │   ├── Sidebar.tsx (308)
│   │   ├── ProjectTabBar.tsx (295)
│   │   ├── MessageFeed.tsx (289)
│   │   ├── EnvManager.tsx (292)
│   │   ├── ToolBlock.tsx (272)
│   │   ├── DiffView.tsx (250)
│   │   ├── TerminalPanel.tsx (207)
│   │   ├── TopBar.tsx (187)
│   │   ├── FolderPicker.tsx (189)
│   │   ├── BranchPicker.tsx (150)
│   │   ├── SpeechMonitor.tsx (101)
│   │   ├── EnvSelector.tsx (85)
│   │   ├── tool-utils.ts (48)
│   │   ├── ChatView.tsx (33)
│   │   ├── CopyButton.tsx (32)
│   │   └── linkify.tsx (38)
│   ├── hooks/                  # React hooks
│   │   ├── use-voice-input.ts (268)
│   │   ├── useSlashMenu.ts (174)
│   │   ├── use-whisper.ts (161)
│   │   ├── useAutoResumeSession.ts (139)
│   │   ├── useImageAttachments.ts (112)
│   │   ├── voice-events.ts (92)
│   │   ├── use-prompt-history.ts (61)
│   │   ├── useDraftPersistence.ts (44)
│   │   └── useNativeSessionPoll.ts (42)
│   └── utils/                  # Shared utilities
│       ├── toolGrouping.ts (214)
│       ├── stt-component-worker.ts (148)
│       ├── whisper-worker.ts (111)
│       ├── audio-utils.ts (105)
│       ├── project-detector.ts (48)
│       ├── notifications.ts (39)
│       ├── names.ts (27)
│       ├── imageUtils.ts (22)
│       └── recent-dirs.ts (15)
├── tests/                      # E2E tests
│   ├── e2e/
│   │   ├── app.spec.ts (524)
│   │   └── functional.spec.ts (339)
│   └── global-teardown.ts
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
└── playwright.config.ts
```

## File Size Violations (>200 line limit)

| File | Lines | Over By |
|------|-------|---------|
| server/ws-bridge.ts | 947 | 747 |
| server/cli-launcher.ts | 582 | 382 |
| src/components/Playground.tsx | 530 | 330 |
| src/components/PermissionBanner.tsx | 514 | 314 |
| src/store.ts | 488 | 288 |
| src/components/EditorPanel.tsx | 469 | 269 |
| src/components/HomePage.tsx | 416 | 216 |
| server/git-utils.ts | 378 | 178 |
| src/components/MessageBubble.tsx | 355 | 155 |
| src/components/Composer.tsx | 353 | 153 |
| src/components/TaskPanel.tsx | 349 | 149 |
| src/components/Sidebar.tsx | 308 | 108 |
| src/components/ProjectTabBar.tsx | 295 | 95 |
| src/components/EnvManager.tsx | 292 | 92 |
| src/components/MessageFeed.tsx | 289 | 89 |
| src/components/ToolBlock.tsx | 272 | 72 |
| src/hooks/use-voice-input.ts | 268 | 68 |
| src/components/DiffView.tsx | 250 | 50 |
| src/api.ts | 240 | 40 |
| server/session-types.ts | 239 | 39 |
| src/ws.ts | 223 | 23 |
| server/claude-sessions.ts | 224 | 24 |
| src/utils/toolGrouping.ts | 214 | 14 |
| src/components/TerminalPanel.tsx | 207 | 7 |

**24 files exceed the 200-line limit.** ws-bridge.ts is nearly 5x the limit.

## Three-Tier WebSocket Architecture

```
+-------------------+    WS (NDJSON)     +-------------------+     WS (JSON)     +-----------+
|  Claude Code CLI  | <~~~~~~~~~~~~~~~~ |   Bridge Server   | <~~~~~~~~~~~~~~~~> |  Browser   |
|  (--sdk-url flag) |  /ws/cli/:session  |   (Bun + Hono)    |  /ws/browser/:id  |  (React)   |
+-------------------+                    +-------------------+                    +-----------+
         |                                      |                                      |
    Spawned by                             Translates                             Connects via
    CliLauncher                            NDJSON<->JSON                           native WS
         |                                      |
         +-------- CLI connects BACK -----------+
                   to bridge server
```

### Connection Flow
1. Browser POST /api/sessions/create -> CliLauncher.launch() -> spawns CLI process
2. CLI process connects back to `/ws/cli/:sessionId` via --sdk-url
3. CLI sends `system/init` NDJSON message -> WsBridge routes to browsers
4. Browser sends `user_message` -> WsBridge wraps as NDJSON `user` -> sends to CLI
5. CLI streams responses -> WsBridge translates and broadcasts to all connected browsers

### Three WebSocket Types
- **CLI WS** (`/ws/cli/:sessionId`): NDJSON protocol, one-to-one, managed by WsBridge
- **Browser WS** (`/ws/browser/:sessionId`): JSON protocol, one-to-many (multiple tabs), managed by WsBridge
- **Terminal WS** (`/ws/terminal/:terminalId`): JSON protocol, PTY data via Node.js bridge subprocess

## Data Flow

### CLI -> Browser (primary path)
```
CLI NDJSON -> ws-bridge.handleCLIMessage()
  -> routeCLIMessage() switch:
    system/init   -> session state update -> broadcastToBrowsers()
    system/status -> is_compacting flag -> broadcastToBrowsers()
    assistant     -> messageHistory.push() -> broadcastToBrowsers() -> persist
    result        -> cost/turns update -> broadcastToBrowsers() -> persist -> auto-name trigger
    stream_event  -> broadcastToBrowsers() (no persist -- ephemeral)
    control_req   -> pendingPermissions.set() -> broadcastToBrowsers()
    tool_progress -> broadcastToBrowsers()
    keep_alive    -> consumed silently
```

### Browser -> CLI
```
Browser JSON -> ws-bridge.handleBrowserMessage()
  -> routeBrowserMessage() switch:
    user_message        -> wrap as NDJSON user msg -> sendToCLI() + persist + start watchdog
    permission_response -> wrap as NDJSON control_response -> sendToCLI() + clear pending
    interrupt           -> fire onInterrupt callback -> CliLauncher.sendInterrupt()
    set_model           -> wrap as NDJSON set_model -> sendToCLI()
    set_permission_mode -> wrap as NDJSON set_permission_mode -> sendToCLI()
```

### Client -> Store -> UI
```
ws.ts handleMessage() -> dispatch by msg.type:
  session_init     -> store.addSession() + store.updateSession()
  assistant        -> extractActivityFromBlocks() -> store.appendMessage() + tool tracking
  stream_event     -> token counting -> store.setStreaming()
  result           -> store.setSessionStatus("idle") + clearOnNextResult handling
  permission_req   -> store.addPermission()
  status_change    -> store.setSessionStatus()
  cli_disconnected -> store.setCliConnected(false)
```

## State Management

### Server-Side State (3 layers)
1. **WsBridge.sessions** (Map<string, Session>): In-memory session state + WS refs + message history + watchdog timers
2. **CliLauncher.sessions** (Map<string, SdkSessionInfo>): CLI process state + PIDs + cwd + model
3. **SessionStore** (~/.companion/sessions/): JSON file persistence (debounced 150ms writes)

### Client-Side State (Zustand)
- 38+ Map instances in single store (sessions, messages, streaming, permissions, etc.)
- HMR-safe: snapshot stored on `window.__cc_store_state` for Vite hot-reload
- Store actions are plain functions (no middleware)
- No persistence (except localStorage for dark mode, prompt history, session names)

### WebSocket Client State (ws.ts)
- Module-level Maps on `window.__ws_state` for HMR safety
- Reconnection with exponential backoff (2s -> 30s)
- Ping interval (20s keepalive)
- Per-session processedToolUseIds dedup set

## Configuration

| Setting | Source | Default |
|---------|--------|---------|
| Server port | `PORT` env var | 3456 |
| API target | `__API_PORT__` Vite define | matches PORT |
| Vite HMR port | hardcoded | 5174 |
| Session persistence | hardcoded | ~/.companion/sessions/ |
| Log dir | hardcoded | .webcli-logs/ |
| Max CLI processes | constant | 5 |
| Hostname | hardcoded | 127.0.0.1 |
| Rate limit (API) | constant | 200 req/min |
| Rate limit (sessions) | constant | 10/min |
| WS payload max | constant | 1 MB |
| WS idle timeout | constant | 0 (never) |
| Init timeout | constant | 90s |
| Stall timeout | constant | 60s |
| Reconnect grace | constant | 10s |

## Architecture Concerns

1. **ws-bridge.ts is a monolith** (947 lines): Contains session management, CLI message routing, browser message routing, watchdog timers, stall detection, git info resolution, and session persistence -- all in one class. This is the hardest file to reason about and the most likely source of bugs.

2. **Dual session state**: CLI process state lives in CliLauncher.sessions, bridge state in WsBridge.sessions, and persisted state in SessionStore -- three sources of truth that must stay in sync. No transactional guarantee across them.

3. **In-memory rate limiter**: Rate limit state resets on server restart, making it ineffective for persistent attack or rapid restart scenarios.

4. **No graceful shutdown**: The server has no SIGINT/SIGTERM handler. SessionStore.save() uses a 150ms debounce -- a crash loses any pending writes.

5. **Terminal cwd unvalidated**: The terminal WS accepts a `cwd` query parameter passed directly to the Node.js bridge subprocess without path validation. security-utils.ts path traversal guard is only applied to HTTP API routes, not WebSocket upgrades.

6. **Auth disabled**: The auth module (auth.ts) is imported but explicitly not enforced -- relying solely on 127.0.0.1 binding + CORS. This is fine for local dev but means any local process can access the API.

7. **Client store complexity**: 38+ Maps in a single Zustand store with 50+ actions makes it difficult to reason about state transitions. Session state is duplicated between `sessions` (server state) and multiple per-session Maps (messages, streaming, permissions, etc.).
