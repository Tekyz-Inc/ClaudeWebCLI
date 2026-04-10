# Store Contract (Zustand)

_Last updated: 2026-04-10 (M12 Contract Refresh — auto-generated from `web/src/store.ts` + `web/src/store/types.ts`)_

## Overview

The app uses a **single Zustand store** (`web/src/store.ts`, 488 lines) implementing the `AppState` interface from `web/src/store/types.ts` (159 lines). There is no slice pattern — all state and actions live on a single root object. A few pure helpers live in `web/src/store/`:

- `store/initial-state.ts` — hydrates defaults from `localStorage` / `sessionStorage`
- `store/remove-session.ts` — builds the state delta for session deletion (shared with archive flow)
- `store/resume-session.ts` — async helper for `resumeNativeSession` action

**HMR safety**: the store snapshots itself to `window.__cc_store_state` on `import.meta.hot.dispose()` and rehydrates on re-import, so state survives Vite HMR.

**Persistence keys** (localStorage/sessionStorage):
| Key | Storage | Written by |
|-----|---------|------------|
| `cc-dark-mode` | localStorage | `setDarkMode`, `toggleDarkMode` |
| `cc-session-names` | localStorage | `setSessionName` |
| `cc-prompt-history` | localStorage | `addPromptToHistory` (capped 50/session) |
| `cc-hidden-projects` | localStorage | `toggleHiddenProject` |
| `cc-current-session` | sessionStorage | `setCurrentSession`, `newSession` |

## State Shape

Derived verbatim from `web/src/store/types.ts` — grouped for readability.

### Sessions

| Field | Type | Purpose |
|------|------|---------|
| `sessions` | `Map<string, SessionState>` | Active web-launched sessions keyed by sessionId |
| `sdkSessions` | `SdkSessionInfo[]` | Native Claude CLI sessions discovered via `/api/claude-sessions` |
| `currentSessionId` | `string \| null` | Active session shown in main pane |
| `sessionNames` | `Map<string, string>` | Display names (manual + auto-generated) |
| `recentlyRenamed` | `Set<string>` | Animation hint |

### Messages / Streaming

| Field | Type | Purpose |
|------|------|---------|
| `messages` | `Map<string, ChatMessage[]>` | Full chat history per session |
| `streaming` | `Map<string, string>` | Partial text while assistant is mid-stream |
| `streamingStartedAt` | `Map<string, number>` | Stream start timestamp |
| `streamingOutputTokens` | `Map<string, number>` | Running output-token counter |

### Permissions / Status

| Field | Type | Purpose |
|------|------|---------|
| `pendingPermissions` | `Map<string, Map<string, PermissionRequest>>` | Outer key = sessionId, inner key = request_id |
| `previousPermissionMode` | `Map<string, string>` | Restore point for plan-mode toggle |
| `connectionStatus` | `Map<string, "connecting"\|"connected"\|"disconnected">` | Browser WS state |
| `cliConnected` | `Map<string, boolean>` | Whether the CLI leg is alive |
| `sessionStatus` | `Map<string, "idle"\|"submitted"\|"running"\|"compacting"\| null>` | High-level FSM state |

### Activity Tracking (per session)

| Field | Type | Source |
|------|------|--------|
| `sessionTasks` | `Map<string, TaskItem[]>` | TodoWrite tool calls |
| `changedFiles` | `Map<string, Set<string>>` | Edit/Write tool calls |
| `filesRead` | `Map<string, Set<string>>` | Read tool calls |
| `commandsExecuted` | `Map<string, string[]>` | Bash tool calls (most recent first, capped 20) |
| `agentsSpawned` | `Map<string, AgentSpawn[]>` | Task tool calls |
| `testsExecuted` | `Map<string, TestRun[]>` | Test-like Bash commands |
| `modelsInvoked` | `Map<string, Map<string, {inputTokens, outputTokens, costUSD}>>` | Cumulative per-model usage from `result` messages |

### UI / Layout

| Field | Type | Purpose |
|------|------|---------|
| `darkMode` | `boolean` | Tailwind dark class toggle |
| `sidebarOpen` | `boolean` | Left sidebar visibility (default `false`) |
| `taskPanelOpen` | `boolean` | Right task panel visibility |
| `chatExpanded` | `boolean` | Chat pane collapsed state |
| `chatExpandTick` | `number` | Bump counter to force scroll-to-bottom |
| `homeResetKey` | `number` | Bump to force HomePage remount |
| `activeTab` | `"chat" \| "editor"` | Main-pane tab selector |
| `editorOpenFile` | `Map<string, string>` | Per-session open file path |
| `editorUrl` | `Map<string, string>` | Per-session iframe URL |
| `editorLoading` | `Map<string, boolean>` | Editor iframe load flag |
| `terminalOpen` | `boolean` | Terminal slide-out panel |

### Project Tab Bar

| Field | Type | Purpose |
|------|------|---------|
| `activeProjectCwd` | `string \| null` | Selected project in ProjectTabBar |
| `hiddenProjects` | `Set<string>` | User-hidden project paths |
| `projectSessionMap` | `Map<string, string>` | CWD → last-active sessionId (survives tab switches) |

### Misc

| Field | Type | Purpose |
|------|------|---------|
| `clearOnNextResult` | `Set<string>` | Marks sessions that should wipe messages on next `result` (`/clear`, `/compact`) |
| `queuedMessages` | `Map<string, { content, images? }>` | Message to auto-send after current result |
| `promptHistory` | `Map<string, string[]>` | Up/down arrow history, capped 50 per session |

## Actions

All actions live on the same root store. Grouped here by concern. **Mutates** column lists the primary state fields written.

### UI Toggles

| Action | Signature | Mutates |
|--------|-----------|---------|
| `setDarkMode` | `(v: boolean) => void` | `darkMode` + localStorage |
| `toggleDarkMode` | `() => void` | `darkMode` + localStorage |
| `setSidebarOpen` | `(v: boolean) => void` | `sidebarOpen` |
| `setTaskPanelOpen` | `(open: boolean) => void` | `taskPanelOpen` |
| `setChatExpanded` | `(expanded: boolean) => void` | `chatExpanded`, `chatExpandTick` |
| `setTerminalOpen` | `(open: boolean) => void` | `terminalOpen` |
| `setActiveTab` | `(tab: "chat"\|"editor") => void` | `activeTab` |

### Session Lifecycle

| Action | Signature | Mutates |
|--------|-----------|---------|
| `newSession` | `() => void` | clears `currentSessionId`, bumps `homeResetKey`, clears sessionStorage |
| `resumeNativeSession` | `(cliId, cwd) => Promise<void>` | Calls `/api/claude-sessions/:id/messages` + `/activity` in parallel, seeds `messages`, `filesRead`, `changedFiles`, `commandsExecuted`, `projectSessionMap`, then calls `connectSession(sid)` |
| `setCurrentSession` | `(id: string\|null) => void` | `currentSessionId` + sessionStorage |
| `addSession` | `(session: SessionState) => void` | `sessions`, initialises empty `messages` bucket |
| `updateSession` | `(sessionId, updates: Partial<SessionState>) => void` | `sessions` (shallow merge) |
| `removeSession` | `(sessionId) => void` | delegates to `buildRemoveSessionState()` — wipes all per-session Maps/Sets for that id |
| `setSdkSessions` | `(sessions: SdkSessionInfo[]) => void` | `sdkSessions` |

### Messages

| Action | Signature | Mutates |
|--------|-----------|---------|
| `appendMessage` | `(sessionId, msg) => void` | `messages` (dedupe by `msg.id`) |
| `setMessages` | `(sessionId, msgs) => void` | `messages` |
| `updateLastAssistantMessage` | `(sessionId, updater) => void` | `messages` (last assistant entry only) |
| `setStreaming` | `(sessionId, text: string\|null) => void` | `streaming` |
| `setStreamingStats` | `(sessionId, {startedAt?, outputTokens?} \| null) => void` | `streamingStartedAt`, `streamingOutputTokens` |

### Permissions

| Action | Signature | Mutates |
|--------|-----------|---------|
| `addPermission` | `(sessionId, perm: PermissionRequest) => void` | `pendingPermissions` |
| `removePermission` | `(sessionId, requestId) => void` | `pendingPermissions` |
| `setPreviousPermissionMode` | `(sessionId, mode) => void` | `previousPermissionMode` |

### Tasks & Activity

| Action | Signature | Mutates |
|--------|-----------|---------|
| `addTask` | `(sessionId, task: TaskItem) => void` | `sessionTasks` |
| `setTasks` | `(sessionId, tasks: TaskItem[]) => void` | `sessionTasks` |
| `updateTask` | `(sessionId, taskId, updates) => void` | `sessionTasks` |
| `addChangedFile` | `(sessionId, filePath) => void` | `changedFiles` |
| `clearChangedFiles` | `(sessionId) => void` | `changedFiles` |
| `addReadFile` | `(sessionId, filePath) => void` | `filesRead` |
| `addCommandExecuted` | `(sessionId, cmd) => void` | `commandsExecuted` (caps at 20, most recent first) |
| `addAgentSpawned` | `(sessionId, agent: AgentSpawn) => void` | `agentsSpawned` |
| `addTestExecuted` | `(sessionId, test: TestRun) => void` | `testsExecuted` |
| `mergeModelUsage` | `(sessionId, modelUsage) => void` | `modelsInvoked` (accumulates per-model tokens + cost) |

### Session Names

| Action | Signature | Mutates |
|--------|-----------|---------|
| `setSessionName` | `(sessionId, name) => void` | `sessionNames` + localStorage |
| `markRecentlyRenamed` | `(sessionId) => void` | `recentlyRenamed` |
| `clearRecentlyRenamed` | `(sessionId) => void` | `recentlyRenamed` |

### Clear / Queue

| Action | Signature | Mutates |
|--------|-----------|---------|
| `markClearOnNextResult` | `(sessionId) => void` | `clearOnNextResult` |
| `setQueuedMessage` | `(sessionId, msg) => void` | `queuedMessages` |
| `clearQueuedMessage` | `(sessionId) => void` | `queuedMessages` |

### Connection State

| Action | Signature | Mutates |
|--------|-----------|---------|
| `setConnectionStatus` | `(sessionId, "connecting"\|"connected"\|"disconnected") => void` | `connectionStatus` |
| `setCliConnected` | `(sessionId, boolean) => void` | `cliConnected` |
| `setSessionStatus` | `(sessionId, status) => void` | `sessionStatus` |

### Prompt History

| Action | Signature | Mutates |
|--------|-----------|---------|
| `addPromptToHistory` | `(sessionId, prompt) => void` | `promptHistory` + localStorage (capped 50/session) |

### Editor

| Action | Signature | Mutates |
|--------|-----------|---------|
| `setEditorOpenFile` | `(sessionId, filePath: string\|null) => void` | `editorOpenFile` |
| `setEditorUrl` | `(sessionId, url) => void` | `editorUrl` |
| `setEditorLoading` | `(sessionId, loading) => void` | `editorLoading` |

### Project Tabs

| Action | Signature | Mutates |
|--------|-----------|---------|
| `setActiveProjectCwd` | `(cwd: string\|null) => void` | `activeProjectCwd`, conditionally `projectSessionMap` (only if current session cwd matches) |
| `setProjectSession` | `(cwd, sessionId) => void` | `projectSessionMap` (normalizes path separators) |
| `toggleHiddenProject` | `(path) => void` | `hiddenProjects` + localStorage |

### Nuclear Option

| Action | Signature | Mutates |
|--------|-----------|---------|
| `reset` | `() => void` | Wipes every Map/Set, resets `activeTab` to `"chat"`. Does not touch UI booleans (`darkMode`, `sidebarOpen`). Intended for test setup. |

## Conventions

1. **All per-session state uses `Map<string, T>`** keyed by sessionId. New state must follow this convention.
2. **Actions are immutable updates** — every `set` call clones the outer Map/Set before mutating (`new Map(s.field)`).
3. **Action naming**: `verbNoun` camelCase. `set*` for straight assignment, `add*/remove*/clear*` for collection edits, `mark*/unmark*` for flag sets.
4. **Persistence** is action-local — actions that need to survive reload write to localStorage inline (see `cc-*` keys above). Do not add persistence at the store level.
5. **HMR snapshot** requires every field to be serializable. Avoid holding DOM nodes, WebSocket instances, timers, or promise references in the store. Those live in `web/src/ws.ts` module state (`WIN.__ws_state`).
6. **No selectors / derived state helpers** — components call `useStore((s) => s.field)` directly. Keep this for consistency.

## Files

- `web/src/store.ts` — implementation (488 LOC, single `create<AppState>()`)
- `web/src/store/types.ts` — `AppState` interface (159 LOC)
- `web/src/store/initial-state.ts` — localStorage/sessionStorage hydration helpers
- `web/src/store/remove-session.ts` — `buildRemoveSessionState()` pure helper
- `web/src/store/resume-session.ts` — `resumeNativeSessionImpl()` async helper
