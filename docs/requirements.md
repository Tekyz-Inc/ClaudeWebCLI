# Requirements: ClaudeWebCLI

**Version:** 0.2.0
**Last Updated:** 2026-02-11
**Source:** Scan of codebase (`web/server/` + `web/src/`) and CLAUDE.md

---

## 1. Functional Requirements

### FR-1: Session Management

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| FR-1.1 | Create new sessions via REST API with configurable model, permission mode, working directory, branch, environment, and worktree | [DONE] | `POST /api/sessions` in `routes.ts`; `HomePage.tsx` exposes all options |
| FR-1.2 | List all sessions with metadata (status, creation time, model, working directory) | [DONE] | `GET /api/sessions` in `routes.ts`; `Sidebar.tsx` polls every 5s |
| FR-1.3 | Rename sessions (manual) | [DONE] | `PATCH /api/sessions/:id/rename` in `routes.ts`; inline rename in `Sidebar.tsx` |
| FR-1.4 | Archive sessions (soft-delete: kills CLI, cleans up worktree, marks archived) | [DONE] | `POST /api/sessions/:id/archive` and `/unarchive` in `routes.ts` |
| FR-1.5 | Delete sessions (hard-delete: kills CLI, closes sockets, removes from store, cleans worktree) | [DONE] | `DELETE /api/sessions/:id` in `routes.ts` |
| FR-1.6 | Relaunch sessions (kill old CLI, spawn new CLI with `--resume` using stored `cliSessionId`) | [DONE] | `POST /api/sessions/:id/relaunch` in `routes.ts`; `cli-launcher.ts` handles `--resume` flag |
| FR-1.7 | Kill CLI process for a session without deleting it | [DONE] | `POST /api/sessions/:id/kill` in `routes.ts` |
| FR-1.8 | Session state machine: `starting -> connected -> running -> exited` | [DONE] | Defined in `cli-launcher.ts`; no formal state machine enforcement -- states are set directly |
| FR-1.9 | Session ID is a cryptographically random UUID | [DONE] | `randomUUID()` in `cli-launcher.ts` |
| FR-1.10 | Session list sorted by creation time (newest first) | [DONE] | Sort in `Sidebar.tsx` |
| FR-1.11 | Current session ID persisted in localStorage across page reloads | [DONE] | `cc-current-session` key in `store.ts` |

### FR-2: WebSocket Bridge (CLI NDJSON <-> Browser JSON)

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| FR-2.1 | Translate NDJSON messages from CLI WebSocket to typed JSON for browser WebSocket | [DONE] | Core logic in `ws-bridge.ts` |
| FR-2.2 | Translate browser JSON messages to NDJSON for CLI WebSocket | [DONE] | `sendToCLI()` in `ws-bridge.ts` appends newline |
| FR-2.3 | Queue messages when CLI is not connected; flush on CLI reconnect | [DONE] | `pendingMessages` queue in `ws-bridge.ts`; flushed in `handleCLIOpen()` |
| FR-2.4 | Persist pending messages to disk so they survive server restarts | [DONE] | `pendingMessages` included in session persistence |
| FR-2.5 | Support multiple concurrent browser connections per session | [DONE] | `browserSockets` is a Set per session in `ws-bridge.ts` |
| FR-2.6 | Send full message history to browser on WebSocket connect | [DONE] | `message_history` sent in `ws-bridge.ts` on browser open |
| FR-2.7 | Silently consume `keep_alive` messages from CLI | [DONE] | Handled in `routeCLIMessage()` |
| FR-2.8 | Forward unknown CLI message types without error | [DONE] | Default no-op in `routeCLIMessage()` |
| FR-2.9 | Parse CLI `system/init` message to extract session_id, tools, model, version | [DONE] | `handleSystemMessage()` in `ws-bridge.ts` |
| FR-2.10 | Track compacting status from CLI system status messages | [DONE] | `is_compacting` flag set on `status === "compacting"` |
| FR-2.11 | Compute context usage percentage from `modelUsage` data | [DONE] | `(inputTokens + outputTokens) / contextWindow * 100` in `ws-bridge.ts` |
| FR-2.12 | Support interrupt (stop generation) via `control_request` with `subtype: "interrupt"` | [DONE] | `handleInterrupt()` in `ws-bridge.ts` |
| FR-2.13 | Support runtime model switching via `set_model` control request | [DONE] | `handleSetModel()` in `ws-bridge.ts` |
| FR-2.14 | Support runtime permission mode switching via `set_permission_mode` control request | [DONE] | `handleSetPermissionMode()` in `ws-bridge.ts` |

### FR-3: Tool Permission UI

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| FR-3.1 | Display tool permission requests from CLI as approval banners in the browser | [DONE] | `PermissionBanner.tsx` renders per-tool-type approval UI |
| FR-3.2 | Support approve (allow) and deny actions for each tool call | [DONE] | `permission_response` with `behavior: allow/deny` |
| FR-3.3 | Support modified input on approval (updatedInput) | [DONE] | `updatedInput` field in `permission_response` |
| FR-3.4 | Display per-tool-type contextual information (Bash commands, file paths, edit diffs, etc.) | [DONE] | `PermissionBanner.tsx` has per-tool rendering (515 lines) |
| FR-3.5 | Clear pending permissions when CLI disconnects | [DONE] | `handleCLIClose()` cancels pending permissions, sends `permission_cancelled` to browsers |
| FR-3.6 | Store pending permissions with timestamps for ordering | [DONE] | `timestamp: Date.now()` on each request |
| FR-3.7 | Bridge server does not enforce the CLI's 30-second permission timeout | [PARTIAL] | CLI side times out at 30s but bridge holds permissions indefinitely; stale permissions may remain if browser never responds |

### FR-4: Message Streaming

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| FR-4.1 | Stream `content_block_delta` events token-by-token from CLI to browser | [DONE] | `stream_event` forwarded in `ws-bridge.ts` |
| FR-4.2 | Display streaming text in real-time in the message feed | [DONE] | `streaming` Map in Zustand store; `MessageFeed.tsx` renders partial text |
| FR-4.3 | Track streaming start time for generation timing display | [DONE] | `streamingStartedAt` Map in store |
| FR-4.4 | Track output token count during streaming | [DONE] | `streamingOutputTokens` Map in store |
| FR-4.5 | Display final `assistant` message with full content blocks (markdown, code, tool use, thinking) | [DONE] | `MessageBubble.tsx` renders markdown via `react-markdown` + `remark-gfm` |
| FR-4.6 | Display `result` message with cost, turns, and model usage | [DONE] | Result data forwarded to browser; displayed in `TaskPanel.tsx` |

### FR-5: Multi-Session Support

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| FR-5.1 | Support multiple concurrent independent sessions with separate CLI processes | [DONE] | Each session has its own CLI subprocess, WebSocket pair, and state |
| FR-5.2 | Per-session WebSocket connections (browser connects to `/ws/browser/:sessionId`) | [DONE] | Path-based session routing in `index.ts` |
| FR-5.3 | Per-session state isolation (messages, permissions, streaming, tasks, connection status) | [DONE] | All Zustand store slices are keyed by session ID |
| FR-5.4 | Switch between sessions in the sidebar without losing state | [DONE] | `currentSessionId` controls active view; all state persists in Maps |
| FR-5.5 | Auto-reconnect browser WebSocket with 2-second delay on close | [DONE] | `scheduleReconnect()` in `ws.ts` |
| FR-5.6 | Duplicate WebSocket connection prevention (one socket per session) | [DONE] | Guard in `connectSession()` returns if socket already exists |
| FR-5.7 | Auto-relaunch CLI when browser connects to session with dead CLI | [DONE] | `onCLIRelaunchNeeded` callback in `ws-bridge.ts`; archived sessions excluded |

### FR-6: Git Integration

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| FR-6.1 | Detect repository root and current/default branch | [DONE] | `GET /api/git/repo-info` in `routes.ts`; `getRepoInfo()` in `git-utils.ts` |
| FR-6.2 | List branches with ahead/behind counts and worktree status | [DONE] | `GET /api/git/branches` in `routes.ts` |
| FR-6.3 | Create git worktrees for branch isolation across sessions | [DONE] | `POST /api/git/worktrees`; `ensureWorktree()` in `git-utils.ts` |
| FR-6.4 | Worktree branch naming with unique suffix (`-wt-{random4}`) to avoid collisions | [DONE] | Up to 100 random attempts, then timestamp fallback |
| FR-6.5 | Track session-to-worktree mapping persistently | [DONE] | `worktree-tracker.ts` persists to `~/.companion/worktrees.json` |
| FR-6.6 | Clean up worktrees on session archive/delete (with dirty-check guard) | [DONE] | `cleanupWorktree()` in `routes.ts`; only force-removes if `force` flag set |
| FR-6.7 | Prevent concurrent sessions from deleting shared worktrees | [DONE] | `WorktreeTracker` checks if other sessions use the worktree |
| FR-6.8 | Inject worktree guardrails as CLAUDE.md to prevent branch switching inside worktrees | [DONE] | `injectWorktreeGuardrails()` in `cli-launcher.ts` with idempotent markers |
| FR-6.9 | Git fetch (refresh remote branches) | [DONE] | `POST /api/git/fetch` in `routes.ts` |
| FR-6.10 | Git pull with updated ahead/behind counts | [DONE] | `POST /api/git/pull` in `routes.ts` |
| FR-6.11 | Default branch resolution: `origin/HEAD` -> `main` -> `master` -> fallback `main` | [DONE] | `getDefaultBranch()` in `git-utils.ts` |
| FR-6.12 | Git fetch triggered when branch dropdown opens in UI | [DONE] | `api.gitFetch` called on dropdown open in `HomePage.tsx` |
| FR-6.13 | Worktree detection uses forward-slash check (`gitDir.includes("/worktrees/")`) | [PARTIAL] | Fails on Windows where git may return backslash-separated paths |

### FR-7: Environment Management

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| FR-7.1 | Create named environment variable sets | [DONE] | `POST /api/envs` in `routes.ts`; `createEnv()` in `env-manager.ts` |
| FR-7.2 | List all environment sets | [DONE] | `GET /api/envs` in `routes.ts` |
| FR-7.3 | Update environment sets (rename, modify variables) | [DONE] | `PUT /api/envs/:slug` in `routes.ts` |
| FR-7.4 | Delete environment sets | [DONE] | `DELETE /api/envs/:slug` in `routes.ts` |
| FR-7.5 | Persist environment sets to disk (`~/.companion/envs/{slug}.json`) | [DONE] | `env-manager.ts` handles file I/O |
| FR-7.6 | Slugify environment names for filesystem-safe keys | [DONE] | `slugify()` in `env-manager.ts` |
| FR-7.7 | Duplicate slug detection on create and rename | [DONE] | `existsSync()` check (note: race condition possible) |
| FR-7.8 | Inject selected environment variables into CLI subprocess on session creation | [DONE] | `env` spread into process env in `cli-launcher.ts` |
| FR-7.9 | Environment management modal UI | [DONE] | `EnvManager.tsx` component |
| FR-7.10 | Selected environment persisted in localStorage | [DONE] | `cc-selected-env` key in `HomePage.tsx` |

### FR-8: File System Browsing and Editing

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| FR-8.1 | Browse directory contents via REST API | [DONE] | `GET /api/dirs` in `routes.ts`; hidden entries excluded |
| FR-8.2 | Recursive file tree for editor (depth limit: 10 levels) | [DONE] | `GET /api/tree` in `routes.ts`; `node_modules` and hidden files excluded |
| FR-8.3 | Read file contents via REST API (2MB size limit) | [DONE] | `GET /api/file` in `routes.ts` |
| FR-8.4 | Write file contents via REST API | [DONE] | `PUT /api/file` in `routes.ts` |
| FR-8.5 | Git diff view for files | [DONE] | `GET /api/diff` in `routes.ts` |
| FR-8.6 | CodeMirror editor with multi-language support | [DONE] | `EditorPanel.tsx` uses `@uiw/react-codemirror` |
| FR-8.7 | File tree sidebar in editor panel | [DONE] | Tree view in `EditorPanel.tsx` |
| FR-8.8 | Auto-save with 800ms debounce | [DONE] | Debounced write in `EditorPanel.tsx` |
| FR-8.9 | Unsaved changes indicator (dirty flag) | [DONE] | `editorDirty` in Zustand store |
| FR-8.10 | Track files changed by Claude (via Edit/Write tool calls) | [DONE] | `changedFiles` Map in store; extracted from `tool_use` blocks in `ws.ts` |
| FR-8.11 | Folder picker modal with recent directories (max 5) | [DONE] | `FolderPicker.tsx`; `recent-dirs.ts` uses localStorage |
| FR-8.12 | Home directory path resolution | [DONE] | `GET /api/home` in `routes.ts` |

### FR-9: Auto-Naming

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| FR-9.1 | Generate 3-5 word session title from first user message | [DONE] | `auto-namer.ts` spawns one-shot Claude CLI |
| FR-9.2 | Auto-naming triggered once per session after first successful result | [DONE] | `autoNamingAttempted` Set prevents duplicates |
| FR-9.3 | 15-second timeout on auto-namer process | [DONE] | `timeoutMs` default 15000 in `auto-namer.ts` |
| FR-9.4 | Title length constraint: 0 < length < 100 characters | [DONE] | Validation in `auto-namer.ts` |
| FR-9.5 | Input truncated to 500 characters before sending to namer | [DONE] | `.slice(0, 500)` in `auto-namer.ts` |
| FR-9.6 | Auto-name does not overwrite manual renames | [DONE] | Check in `index.ts` before and after async generation |
| FR-9.7 | Client-side: only overwrite "random" names matching `Adjective Noun` pattern | [PARTIAL] | Regex `/^[A-Z][a-z]+ [A-Z][a-z]+$/` is fragile; manually-set names matching this pattern get overwritten |
| FR-9.8 | Random session names: Adjective + Noun (40x40 = 1600 combinations, up to 100 collision retries) | [DONE] | `names.ts` utility |
| FR-9.9 | Fallback model for auto-namer: Sonnet if session model unknown | [DONE] | Fallback in `index.ts` |

### FR-10: Plan Mode Toggle

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| FR-10.1 | Toggle plan mode via Shift+Tab in composer | [DONE] | `Composer.tsx` keyboard handler |
| FR-10.2 | Store previous permission mode for restore on toggle-off | [DONE] | `previousPermissionMode` Map in store |
| FR-10.3 | Fallback to `acceptEdits` if no previous mode stored | [DONE] | Default in `Composer.tsx` |
| FR-10.4 | Send `set_permission_mode` control request to CLI on toggle | [DONE] | Via `ws-bridge.ts` |

### FR-11: Task Extraction and Display

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| FR-11.1 | Extract tasks from `TodoWrite` tool calls (replaces all tasks) | [DONE] | `extractTasksFromBlocks()` in `ws.ts` |
| FR-11.2 | Extract tasks from `TaskCreate` tool calls (appends) | [DONE] | In `ws.ts` |
| FR-11.3 | Extract tasks from `TaskUpdate` tool calls (patches existing) | [DONE] | In `ws.ts` |
| FR-11.4 | Deduplicate task extraction via `processedToolUseIds` | [DONE] | Prevents duplicates from streaming + final messages + permission requests |
| FR-11.5 | Display tasks in right-side TaskPanel with session stats (cost, context, turns) | [DONE] | `TaskPanel.tsx` |
| FR-11.6 | Incremental task ID counters per session | [DONE] | `taskCounters` Map in `ws.ts` |

### FR-12: Dark Mode / Theme System

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| FR-12.1 | Dark mode toggle persisted in localStorage | [DONE] | `cc-dark-mode` key in `store.ts` |
| FR-12.2 | Default to system preference (`prefers-color-scheme: dark`) | [DONE] | Fallback in `store.ts` |
| FR-12.3 | Theme via CSS custom properties (`--color-cc-bg`, `--color-cc-fg`, etc.) in `@theme` blocks | [DONE] | `index.css`; `.dark` class overrides properties |
| FR-12.4 | Components reference theme tokens (`bg-cc-bg`, `text-cc-fg`) not hardcoded colors | [DONE] | Tailwind utility classes use theme tokens |

### FR-13: Session Persistence and Recovery

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| FR-13.1 | Persist session state to disk as JSON (debounced 150ms writes) | [DONE] | `session-store.ts` writes to `$TMPDIR/vibe-sessions/{id}.json` |
| FR-13.2 | Restore sessions from disk on server restart | [DONE] | `restoreFromDisk()` in `cli-launcher.ts` |
| FR-13.3 | Detect alive CLI processes by PID on restart | [DONE] | `process.kill(pid, 0)` check |
| FR-13.4 | Reconnection watchdog: 10-second grace period for CLI processes to reconnect after server restart | [DONE] | `RECONNECT_GRACE_MS = 10_000` in `index.ts` |
| FR-13.5 | Auto-relaunch sessions still in `starting` state after grace period | [DONE] | Watchdog in `index.ts`; archived sessions excluded |
| FR-13.6 | Store CLI `session_id` for `--resume` support across CLI restarts | [DONE] | `cliSessionId` mapped on `system.init` |
| FR-13.7 | Clear `cliSessionId` if CLI exits within 5 seconds of `--resume` launch (prevents infinite relaunch loops) | [DONE] | Guard in `cli-launcher.ts` |
| FR-13.8 | Relaunch deduplication via `relaunchingSet` with 5-second cooldown | [DONE] | `Set<string>` in `index.ts` |
| FR-13.9 | Browser shows "Reconnect" button when CLI is disconnected | [DONE] | In `ChatView.tsx` |
| FR-13.10 | Session names persisted separately in `~/.companion/session-names.json` (survives temp dir cleanup) | [DONE] | `session-names.ts` |
| FR-13.11 | Graceful kill: SIGTERM then SIGKILL after 5 seconds | [DONE] | Two-phase termination in `cli-launcher.ts` |
| FR-13.12 | Pending messages persisted to disk for delivery after CLI reconnects | [DONE] | `pendingMessages` in session store |

### FR-14: Additional UI Features

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| FR-14.1 | Sidebar with session list, polling, rename, archive, branch display | [DONE] | `Sidebar.tsx` |
| FR-14.2 | Top bar with connection status, tab toggle (Chat/Editor), task panel toggle | [DONE] | `TopBar.tsx` |
| FR-14.3 | Responsive layout: sidebar auto-open on desktop (>=768px), closed on mobile | [DONE] | Width check in `store.ts` |
| FR-14.4 | Task panel auto-open on wide screens (>=1024px) | [DONE] | Width check in `store.ts` |
| FR-14.5 | Slash command autocomplete in composer | [DONE] | `Composer.tsx` filters commands from session data |
| FR-14.6 | Image attachment support (image/* MIME types only, client-side validation) | [DONE] | In `Composer.tsx` and `HomePage.tsx` |
| FR-14.7 | Collapsible tool call visualization with per-tool icons | [DONE] | `ToolBlock.tsx` |
| FR-14.8 | Markdown rendering with GFM support (tables, strikethrough, autolinks) | [DONE] | `react-markdown` + `remark-gfm` in `MessageBubble.tsx` |
| FR-14.9 | Thinking block display (expandable) | [DONE] | Rendered in `MessageBubble.tsx` |
| FR-14.10 | Sub-agent message nesting in message feed | [DONE] | Grouping in `MessageFeed.tsx` |
| FR-14.11 | Component playground at `#/playground` (dev-only) | [DONE] | `Playground.tsx` with hash-based routing in `App.tsx` |
| FR-14.12 | Session creation wizard: model, permissions, folder, branch, env, worktree configuration | [DONE] | `HomePage.tsx` |
| FR-14.13 | Experimental agent teams enabled globally | [DONE] | `process.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = "1"` at server startup |

### FR-15: Foundation — Input Enhancements (Milestone 1)

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| FR-15.1 | Prompt history: store sent prompts per session with Up/Down arrow navigation | [DONE] | `use-prompt-history.ts` hook + `promptHistory` store slice. 50-entry cap, localStorage persistence. |
| FR-15.2 | Prompt history: slash menu takes priority over history navigation | [DONE] | Keyboard handler ordering in `Composer.tsx` |
| FR-15.3 | Voice dictation via Web Speech API with mic button in Composer toolbar | [DONE] | `use-voice-input.ts` hook. Hidden when API unsupported. Callback pattern for transcript. |
| FR-15.4 | Voice dictation: toggle between idle and recording states with visual indicator | [DONE] | Pulsing red indicator on mic button during recording |
| FR-15.5 | File drag-and-drop: drop zone overlay on Composer with image attachment | [DONE] | Drag handlers on wrapper div. Images via `readFileAsBase64`. Non-images ignored. |

### FR-16: Foundation — Session Configuration (Milestone 1)

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| FR-16.1 | Full permission modes: all 4 modes (Agent, Accept Edits, Plan, Manual) in dropdown | [DONE] | MODES array in `HomePage.tsx` with descriptive labels |
| FR-16.2 | Shift+Tab cycles through permission modes | [DONE] | Keyboard handler in `Composer.tsx` |
| FR-16.3 | Project detection: auto-detect project type from working directory listing | [DONE] | `project-detector.ts` detects node, python, rust, generic |
| FR-16.4 | Project detection: badge UI showing type, name, and markers below folder picker | [DONE] | In `HomePage.tsx` |

### FR-17: Foundation — Notifications (Milestone 1)

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| FR-17.1 | Desktop notifications when session completes while tab is hidden | [DONE] | `notifications.ts` + `ws.ts` integration on "result" message |
| FR-17.2 | Desktop notifications when permission request arrives while tab is hidden | [DONE] | `ws.ts` integration on "permission_request" message |
| FR-17.3 | Notification click: focus window and switch to relevant session | [DONE] | `setCurrentSession` + `window.focus()` in click handler |
| FR-17.4 | Notification permission requested on first message send (user gesture) | [DONE] | `requestNotificationPermission()` called in Composer `handleSend()` |
| FR-17.5 | Context meter threshold: green 0-60%, yellow 61-80%, red 81%+ | [DONE] | TaskPanel.tsx threshold changed from 50% to 60% |

---

## 2. Technical Requirements

### TR-1: Language and Runtime

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| TR-1.1 | TypeScript with strict mode enabled | [DONE] | `tsconfig.json`: `strict: true`, ES2022 target, bundler resolution |
| TR-1.2 | Bun runtime (>=1.0.0) for server and dev tooling | [DONE] | `engines: { bun: ">=1.0.0" }` in `package.json` |
| TR-1.3 | Hono framework for REST API routing and CORS | [DONE] | Only production dependency |
| TR-1.4 | Native Bun WebSocket via `Bun.serve` (no `ws` library) | [DONE] | Dual WS upgrade paths in `index.ts` |

### TR-2: Frontend Stack

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| TR-2.1 | React 19 with react-dom | [DONE] | `react: ^19.0.0` |
| TR-2.2 | Zustand for state management | [DONE] | Single store with ~30 slices in `store.ts` |
| TR-2.3 | Vite for frontend build and dev server | [DONE] | Dev server on :5174 with proxy to :3456 |
| TR-2.4 | Tailwind CSS v4 with `@theme` CSS custom properties | [DONE] | `@tailwindcss/vite` plugin |
| TR-2.5 | CodeMirror for file editing (`@uiw/react-codemirror`) | [DONE] | Multi-language support in `EditorPanel.tsx` |
| TR-2.6 | xterm.js for terminal emulation | [TODO] | Dependencies present (`@xterm/xterm`, `@xterm/addon-fit`) but not imported or used anywhere |

### TR-3: Testing

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| TR-3.1 | Vitest for unit testing | [DONE] | Node env for server tests, jsdom for client tests |
| TR-3.2 | Co-located test files (`*.test.ts` next to source) | [DONE] | 20 test files, 522 tests total |
| TR-3.3 | Tests required for all features | [PARTIAL] | 16 source files have tests; **14 source files have no tests** (including `store.ts`, `ws.ts`, `Composer.tsx`, `HomePage.tsx` -- ~2,100 lines of high-complexity untested code) |
| TR-3.4 | Husky pre-commit hook runs typecheck and tests | [DONE] | Configured in project |
| TR-3.5 | Playwright for E2E testing | [TODO] | No E2E tests exist yet |
| TR-3.6 | Cross-platform test compatibility | [PARTIAL] | 5 tests in `git-utils.test.ts` fail on Windows due to path separator issues (`\` vs `/`) |

### TR-4: Code Quality Standards

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| TR-4.1 | Functions limited to 30 lines | [PARTIAL] | **27 functions/components exceed 30 lines**; worst: `handleMessage()` at ~250 lines, several React components at 400+ lines |
| TR-4.2 | Files limited to 200 lines | [PARTIAL] | **18 files exceed 200 lines**; worst: `ws-bridge.ts` at 743 lines (3.7x limit) |
| TR-4.3 | Async/await for all server I/O operations | [PARTIAL] | **7 server files use synchronous I/O** (`execSync`, `readFileSync`, `writeFileSync`). `git-utils.ts` is the worst offender -- every function blocks the event loop. `ws-bridge.ts` uses `execSync` during WebSocket message handling. Violates explicit project rule: "NEVER use synchronous I/O in the server." |
| TR-4.4 | Kebab-case file naming | [DONE] | All source files follow convention |
| TR-4.5 | PascalCase for classes, types, and React components | [DONE] | Consistent across codebase |
| TR-4.6 | camelCase for functions | [DONE] | Consistent across codebase |
| TR-4.7 | UPPER_SNAKE_CASE for constants | [DONE] | Consistent across codebase |
| TR-4.8 | Shared type system between server and client | [DONE] | `src/types.ts` re-exports from `server/session-types.ts` |
| TR-4.9 | No unused dependencies | [PARTIAL] | **6 unused dev dependencies**: `@xterm/xterm`, `@xterm/addon-fit`, `react-arborist`, `react-resizable-panels`, `autoprefixer`, `postcss` |
| TR-4.10 | No code duplication | [PARTIAL] | **~285 lines duplicated** across 7 major clusters (image handling, avatar SVG, diff rendering, ID generation between Composer and HomePage) |

### TR-5: Build and Configuration

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| TR-5.1 | Single production dependency (Hono) | [DONE] | Minimal dependency footprint |
| TR-5.2 | Vite build output to `dist/` | [DONE] | Standard Vite configuration |
| TR-5.3 | Dev orchestrator runs backend + frontend in parallel | [DONE] | `dev.ts` |
| TR-5.4 | CLI entry point for package distribution | [DONE] | `bin/cli.ts` sets `__VIBE_PACKAGE_ROOT` |
| TR-5.5 | Server port configurable via `PORT` env var (default: 3456) | [DONE] | In `index.ts` |

---

## 3. Non-Functional Requirements

### NFR-1: Performance

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| NFR-1.1 | Real-time token-by-token streaming with minimal latency | [DONE] | Direct WebSocket forwarding of `stream_event` messages |
| NFR-1.2 | Debounced session persistence (150ms) to prevent I/O thrashing during streaming | [DONE] | `session-store.ts` |
| NFR-1.3 | Server event loop must not be blocked by I/O operations | [PARTIAL] | `git-utils.ts` uses `execSync` for all git operations, blocking the event loop for up to 10s per call. `ws-bridge.ts` uses `execSync` for git detection during session init (up to 12s worst case with 4 x 3s timeouts). Multiple other server files use synchronous filesystem I/O. |
| NFR-1.4 | File tree recursion limited to 10 levels to prevent runaway I/O | [DONE] | Depth limit in `routes.ts` |
| NFR-1.5 | Git command timeouts: 3s for init info, 5s for diff, 10s for git-utils | [DONE] | Prevents hanging on slow git operations |
| NFR-1.6 | Session list polling should be replaced with WebSocket push notifications | [TODO] | Currently polls every 5 seconds (`Sidebar.tsx`) regardless of activity |
| NFR-1.7 | Auto-save debounce at 800ms to coalesce rapid editor changes | [DONE] | `EditorPanel.tsx` |

### NFR-2: Reliability

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| NFR-2.1 | Sessions survive server restarts (state restored from disk, CLI processes reconnected or relaunched) | [DONE] | Multi-layer recovery: PID detection, watchdog, auto-relaunch |
| NFR-2.2 | Browser WebSocket auto-reconnects on disconnect (2s delay) | [DONE] | Fixed-delay reconnect in `ws.ts` |
| NFR-2.3 | Exponential backoff on WebSocket reconnection | [TODO] | Currently fixed 2s delay; tight reconnection loop under sustained failures |
| NFR-2.4 | Session names survive temp directory cleanup | [DONE] | Stored in `~/.companion/session-names.json`, not in `$TMPDIR` |
| NFR-2.5 | Session state should survive OS temp directory cleanup | [PARTIAL] | Session state in `$TMPDIR/vibe-sessions/` is subject to OS cleanup on reboot or disk pressure. Worktree mappings and env configs survive in `~/.companion/` but conversation data does not. |
| NFR-2.6 | React error boundary to prevent full app crash on component errors | [TODO] | No `ErrorBoundary` component exists; unhandled errors in `MessageBubble.tsx` markdown parsing or `ToolBlock.tsx` rendering crash the entire app |
| NFR-2.7 | Graceful process termination (SIGTERM + 5s timeout + SIGKILL) | [DONE] | Two-phase kill in `cli-launcher.ts` |
| NFR-2.8 | Debounced writes should flush on server shutdown to prevent data loss | [TODO] | No "flush on shutdown" logic; state changes within the 150ms debounce window are lost on crash |

### NFR-3: Security

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| NFR-3.1 | Authentication on all API endpoints and WebSocket connections | [TODO] | **No authentication exists.** All routes are open. Any client on the network has full access. |
| NFR-3.2 | Filesystem access restricted to session working directory | [TODO] | **Arbitrary file read/write** via `/api/fs/read` and `/api/fs/write` with no path sandboxing |
| NFR-3.3 | Command injection prevention (use array-based spawning, not shell string interpolation) | [TODO] | `git-utils.ts` and `routes.ts` use `execSync` with string interpolation. `claudeBinary` parameter passed unsanitized to `execSync(\`which ${binary}\`)` |
| NFR-3.4 | CORS restricted to expected origins | [TODO] | Currently wildcard CORS on all `/api/*` routes |
| NFR-3.5 | WebSocket origin validation to prevent CSWSH | [TODO] | No `Origin` header check on WebSocket upgrade |
| NFR-3.6 | Bind to localhost only (not `0.0.0.0`) | [TODO] | Vite dev server binds to `0.0.0.0`, exposing app to local network |
| NFR-3.7 | Environment variable secrets masked in API responses | [TODO] | Full plaintext values returned to any browser client |
| NFR-3.8 | Security headers (CSP, X-Frame-Options, X-Content-Type-Options) | [TODO] | No security headers set |
| NFR-3.9 | Request body validation (schema validation) | [TODO] | No schema validation library; invalid payloads handled via optional chaining and defaults |
| NFR-3.10 | Rate limiting on session creation and WebSocket connections | [TODO] | No rate limits; attacker could spawn unlimited CLI processes |
| NFR-3.11 | WebSocket message size limits | [TODO] | Default Bun 16MB limit; no explicit configuration |
| NFR-3.12 | Session data stored in user-private directory (not world-readable temp) | [TODO] | Currently in `$TMPDIR` which may be world-readable |

### NFR-4: Cross-Platform Compatibility

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| NFR-4.1 | Windows path handling in git operations | [PARTIAL] | `git-utils.ts:82` uses `gitDir.includes("/worktrees/")` (forward slash only) -- fails on Windows. `cli-launcher.ts:186` uses `!binary.startsWith("/")` for absolute path detection -- fails for Windows paths like `C:\...` |
| NFR-4.2 | Cross-platform test compatibility | [PARTIAL] | 5 tests fail on Windows due to path separator issues in expected values |
| NFR-4.3 | Cross-platform process management | [PARTIAL] | SIGTERM/SIGKILL semantics differ on Windows; `process.kill(pid, 0)` for alive-check may behave differently |

### NFR-5: Maintainability

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| NFR-5.1 | No empty catch blocks (all errors must be handled or logged) | [PARTIAL] | **8+ locations** with swallowed errors across server code |
| NFR-5.2 | Consistent error handling patterns | [PARTIAL] | `api.ts` `get()` does not parse error bodies while `post/put/patch/del` do; `routes.ts` mixes error return styles |
| NFR-5.3 | No dead code or unused dependencies | [PARTIAL] | 6 unused dependencies, 4 dead code items beyond dependencies, `Playground.tsx` (531 lines dev-only component in production builds) |
| NFR-5.4 | Single state management system (no dual state) | [PARTIAL] | Client state split between Zustand store (reactive) and module-level Maps in `ws.ts` (non-reactive: `sockets`, `reconnectTimers`, `taskCounters`, `processedToolUseIds`) |
| NFR-5.5 | Protocol types cleanly separated at snake_case/camelCase boundary | [PARTIAL] | Mixed conventions in `session-types.ts`; same data appears in both conventions |

---

## 4. Requirement Status Summary

| Category | DONE | PARTIAL | TODO | Total |
|----------|------|---------|------|-------|
| Functional Requirements | 97 | 3 | 0 | 100 |
| Technical Requirements | 18 | 7 | 2 | 27 |
| Non-Functional Requirements | 10 | 11 | 14 | 35 |
| **Total** | **125** | **21** | **16** | **162** |

### Top Priority Gaps

1. **Security (NFR-3):** Zero authentication, arbitrary filesystem access, command injection vectors, no CORS restriction, no origin validation. All 12 security requirements are [TODO].
2. **Synchronous I/O (TR-4.3 / NFR-1.3):** 7 server files violate the explicit "NEVER use synchronous I/O in the server" rule. `git-utils.ts` blocks the event loop on every call.
3. **Test coverage (TR-3.3):** 14 source files (~2,100 lines of high-complexity code) have no tests. Core interaction paths (`store.ts`, `ws.ts`, `Composer.tsx`, `HomePage.tsx`) are untested.
4. **Code size violations (TR-4.1 / TR-4.2):** 18 files over 200 lines, 27 functions over 30 lines. The worst offenders are 3-4x over their respective limits.
5. **Windows compatibility (NFR-4):** Path handling uses Unix-specific checks in multiple locations. 5 tests fail on Windows.
6. **Reliability gaps (NFR-2):** No React error boundary, no exponential backoff on reconnect, session state in temp directory subject to OS cleanup, no flush-on-shutdown for debounced writes.
