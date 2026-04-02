# Code Quality & Runtime Edge Cases -- 2026-04-01

Scan focused on runtime problems that tests don't catch.
Version: 0.14.11
Tests: 631/631 pass (clean baseline)

---

## 1. Runtime Edge Cases (WebSocket Lifecycle)

### QE-01: `sendToSession()` Silently Drops Messages When WS Not OPEN
**Location:** `web/src/ws.ts:206-208`
**Scenario:** User sends a message while the WebSocket is reconnecting (state = CONNECTING or CLOSED). The message is silently discarded with no feedback. The user sees no error, the Composer clears, and it appears the message was sent.
**Impact:** Lost user messages with no indication of failure.
**Fix:** Queue messages during reconnection, or show an error toast when send fails.

### QE-02: `is_compacting` Flag Never Explicitly Reset
**Location:** `web/server/ws-bridge.ts:515`
**Scenario:** The `is_compacting` flag is set to `true` when CLI reports `status === "compacting"`, but there is no code that sets it back to `false`. It relies on the next system status message having a different status value. If the CLI crashes during compaction or sends no follow-up status, the session is stuck showing "Compacting..." forever.
**Impact:** Permanent UI stuck state. User must manually reconnect or create new session.
**Fix:** Reset `is_compacting = false` on any non-compacting status, on CLI disconnect, and on result message.

### QE-03: Context Usage % Uses Last Model in Iteration
**Location:** `web/server/ws-bridge.ts:611-618`
**Scenario:** When `modelUsage` contains multiple models (multi-model sessions), the code iterates all entries and the last one with `contextWindow > 0` wins. The displayed context percentage reflects whichever model happens to be last in the Map iteration order, not the primary model.
**Impact:** Incorrect context usage display in multi-model sessions.
**Fix:** Track which model is the "active" model and use its context window, or show per-model context.

### QE-04: Browser Reconnection Creates Race With Message History
**Location:** `web/src/ws.ts` reconnection + `web/server/ws-bridge.ts:276-280`
**Scenario:** When browser reconnects, server sends `message_history` with all stored messages. But if the CLI is actively streaming, new messages may arrive between the history send and the browser processing it. The browser could receive messages out of order or miss messages that arrived during the history replay window.
**Impact:** Duplicate or out-of-order messages after reconnection.
**Fix:** Add a sequence number to messages and use it to deduplicate on the client.

### QE-05: `handleCliDisconnected` Sets Session Status to null
**Location:** `web/src/ws-handlers/session-handler.ts:79`
**Scenario:** When CLI disconnects, `sessionStatus` is set to `null`. If the UI checks `sessionStatus === "running"` vs `sessionStatus === null` vs `sessionStatus === "idle"`, different UI states will render. Setting to `null` instead of `"exited"` or `"idle"` can cause UI flicker or undefined behavior in components that expect a string value.
**Impact:** Brief UI flicker between CLI disconnect and subsequent state update.
**Fix:** Set to a defined state like `"disconnected"` instead of `null`.

---

## 2. Runtime Edge Cases (Session Management)

### QE-06: Debounced Persistence With No Flush-on-Shutdown
**Location:** `web/server/session-store.ts:35-43`
**Scenario:** The 150ms debounce means any state change within the last 150ms before a server crash is lost. During streaming (which generates rapid state updates), the most recent messages and token counts are at risk.
**Impact:** Lost session state on server crash or forced restart.
**Fix:** Add `process.on('SIGTERM', () => flushAll())` that immediately writes all pending debounced state.

### QE-07: Stall Detection Resends Without Checking CLI State
**Location:** `web/server/ws-bridge.ts:862-896`
**Scenario:** The activity watchdog resends `lastUserNdjson` when no activity for 60s. But it doesn't verify the CLI is still connected or that the CLI socket is in OPEN state. If the CLI has disconnected but the watchdog hasn't been cleared yet, the resend will fail silently (or throw if socket is null).
**Impact:** Silent failure of stall recovery, or potential crash.
**Fix:** Check `session.cliSocket?.readyState === WebSocket.OPEN` before resending.

### QE-08: Session Name Collision Grows With Session Count
**Location:** `web/src/utils/names.ts`
**Scenario:** 40 adjectives x 40 nouns = 1,600 unique names. Up to 100 retry attempts on collision. With >40 active sessions, collisions become frequent. With >100 sessions, the retry loop could exhaust all attempts and fail.
**Impact:** Session creation failure or duplicate names at scale.
**Fix:** Add a numeric suffix after retry exhaustion (e.g., "Quick Fox 2").

---

## 3. Runtime Edge Cases (Terminal Panel)

### QE-09: Terminal PTY Process Leak on Rapid Tab Switching
**Location:** `web/src/components/TerminalPanel.tsx`
**Scenario:** Each `useEffect` run creates a fresh terminal ID and WebSocket connection. If the user switches project tabs rapidly, React Strict Mode may fire the effect multiple times. The cleanup function closes the WebSocket, but the server-side PTY process may not receive the close signal in time before a new one is spawned.
**Impact:** Orphaned PTY processes consuming resources.
**Fix:** Add a cleanup delay or process tracking on the server side.

### QE-10: Terminal Direct Connect Bypasses Vite Proxy Auth
**Location:** `web/src/components/TerminalPanel.tsx`
**Scenario:** In dev mode, the terminal connects directly to the backend port (`__API_PORT__`) rather than through Vite's proxy. This means any future authentication added to the Vite proxy layer won't protect terminal connections.
**Impact:** Terminal connections are always unauthenticated in dev mode.
**Fix:** Route terminal WS through the same proxy path as other connections.

---

## 4. Runtime Edge Cases (Error Handling)

### QE-11: No React ErrorBoundary
**Location:** `web/src/App.tsx` (no ErrorBoundary wrapper)
**Scenario:** An error in markdown rendering (`MessageBubble.tsx` via react-markdown), malformed tool input display (`ToolBlock.tsx`), or CodeMirror crash (`EditorPanel.tsx`) will crash the entire React tree. The user sees a white screen with no recovery option except refreshing.
**Impact:** Complete application crash from a single rendering error.
**Fix:** Wrap the App in an ErrorBoundary with a fallback UI and "Reload" button.

### QE-12: 40+ Empty Catch Blocks Across Codebase
**Locations:** (categorized)
- `cli-launcher.ts`: 10 empty catches (process kill, which, version, mkdirSync, unlinkSync, log management)
- `ws-bridge.ts`: 8 empty catches (socket close, JSON parse, git exec, permission cancel)
- `env-manager.ts`: 6 empty catches (file read, write, delete operations)
- `claude-sessions.ts`: 7 empty catches (session file parsing, directory reads)
- `ws.ts`: 1 empty catch (JSON parse on received message)
- `store/initial-state.ts`: 3 empty catches (localStorage reads)
- `git-utils.ts`: 1 empty catch

**Scenario:** Any of these swallowed errors can cause silent failures. The most dangerous are:
- `ws.ts:62`: A malformed WebSocket message is silently dropped. If the server sends an invalid JSON frame, the client has no awareness.
- `cli-launcher.ts:174,178`: Process kill failures during relaunch mean the old process may still be running alongside the new one.
- `ws-bridge.ts:317`: NDJSON parse failure in CLI messages means protocol data is silently lost.

**Impact:** Silent data loss, phantom processes, invisible errors.
**Fix:** At minimum, log errors to console. For critical paths (WS message parsing, process lifecycle), propagate errors or take recovery action.

### QE-13: No `unhandledRejection` Handler
**Location:** `web/server/index.ts`
**Scenario:** Server only handles `uncaughtException` (for `ERR_SOCKET_CLOSED`). An unhandled promise rejection (e.g., from an async file operation, a failed DNS lookup during git fetch, or a WebSocket send on a closing connection) will use Node/Bun's default behavior, which may terminate the process.
**Impact:** Server crash from unhandled async errors.
**Fix:** Add `process.on('unhandledRejection', handler)`.

---

## 5. State Management Issues

### QE-14: Sidebar Shows Hardcoded Stale Version "v0.8.10"
**Location:** `web/src/components/Sidebar.tsx:292`
**Scenario:** The version string is hardcoded as "v0.8.10" but the actual project version is 0.14.11. Users see incorrect version information.
**Impact:** Misleading version display.
**Fix:** Import version from package.json or a version constant.

### QE-15: Dual Polling Loops (Sidebar + Auto-Resume)
**Location:** `web/src/components/Sidebar.tsx` (5s interval) + `web/src/hooks/useAutoResumeSession.ts` (10s interval)
**Scenario:** Both `useNativeSessionPoll` and `useAutoResumeSession` independently poll session data. This creates redundant API calls and potential race conditions where auto-resume switches sessions while the sidebar is mid-update.
**Impact:** Unnecessary network traffic, potential session switching conflicts.
**Fix:** Consolidate into a single polling mechanism or use WebSocket-based session updates.

### QE-16: HMR State Restoration Can Lose In-Flight Data
**Location:** `web/src/ws.ts` (window.__ws_state) + `web/src/store.ts` (window.__cc_store_state)
**Scenario:** During HMR, the module is re-executed. If a WebSocket message arrives between the old module teardown and new module initialization, the message is lost. The snapshot/restore mechanism captures state at module eval time, but messages arriving during the transition window are not queued.
**Impact:** Rare message loss during development HMR cycles.
**Fix:** Accept as dev-only risk, or add a message queue that persists across HMR.

---

## 6. File Size Violations (>200 lines)

| File | Lines | Trend vs 2026-02-10 |
|------|-------|---------------------|
| `server/ws-bridge.ts` | 947 | UP from 744 (+203) |
| `server/cli-launcher.ts` | 582 | UP from 491 (+91) |
| `src/components/Playground.tsx` | 530 | Same (dev-only) |
| `src/components/PermissionBanner.tsx` | 514 | Same |
| `src/store.ts` | 488 | Same |
| `src/components/EditorPanel.tsx` | 469 | DOWN from 491 (-22) |
| `src/components/HomePage.tsx` | 416 | DOWN from 696 (-280) |
| `src/components/MessageBubble.tsx` | 355 | UP from 335 (+20) |
| `src/components/Composer.tsx` | 353 | DOWN from 460 (-107) |
| `src/components/TaskPanel.tsx` | 349 | New |
| `server/git-utils.ts` | 378 | Same |
| `src/components/Sidebar.tsx` | 308 | DOWN from 488 (-180) |
| `src/components/ProjectTabBar.tsx` | 295 | New |
| `src/components/EnvManager.tsx` | 292 | Same |
| `src/components/MessageFeed.tsx` | 289 | DOWN from 475 (-186) |
| `src/ws.ts` | 224 | DOWN from 461 (-237) |
| `src/components/TerminalPanel.tsx` | 207 | New |

**20 files over 200 lines.** M8 decomposition reduced several files (ws.ts -237, HomePage -280, Sidebar -180, MessageFeed -186) but ws-bridge.ts grew by 203 lines. Net improvement in average file size, but ws-bridge.ts is now the clear outlier at 4.7x limit.

---

## 7. eslint-disable Suppressions

| Location | Rule | Risk |
|----------|------|------|
| `FolderPicker.tsx:35` | react-hooks/exhaustive-deps | Missing deps in useEffect |
| `HomePage.tsx:70` | react-hooks/exhaustive-deps | Missing deps in useEffect |
| `TerminalPanel.tsx:112` | react-hooks/exhaustive-deps | Missing deps in useEffect for cwd |
| `ProjectTabBar.tsx:172` | react-hooks/exhaustive-deps | Missing deps in useEffect |
| `useAutoResumeSession.ts:136` | react-hooks/exhaustive-deps | Missing deps causing stale closures |
| `useDraftPersistence.ts:41` | react-hooks/exhaustive-deps | Missing deps |
| `useSlashMenu.ts:90` | react-hooks/exhaustive-deps | Missing deps |

**7 exhaustive-deps suppressions.** Each one is a potential source of stale closure bugs where the effect captures an outdated value of a dependency. The most dangerous is `useAutoResumeSession.ts` which polls every 10s and may use stale `activeProjectCwd` or session data.

---

## 8. TODOs and FIXMEs

Only 1 TODO found in source code:
- `src/utils/stt-component-worker.ts:8` -- "TODO: Remove once @tekyzinc/stt-component ships the worker as a..."

---

## 9. Test Coverage Summary

| Category | Covered | Untested |
|----------|---------|----------|
| Server modules | ws-bridge, cli-launcher, routes, session-store, auto-namer, session-types, env-manager, git-utils, session-names, worktree-tracker, security-utils, rate-limiter, environment-routes | index.ts, terminal-ws.ts, auth.ts, security-headers.ts, claude-sessions.ts |
| Client modules | store.ts, ws.ts, MessageBubble, PermissionBanner, ToolBlock, TopBar, TaskPanel, Composer, EditorPanel, MessageFeed | App.tsx, api.ts, ChatView, Sidebar, HomePage, FolderPicker, EnvManager, ProjectTabBar, TerminalPanel, Playground |
| Hooks | use-voice-input | useAutoResumeSession, useDraftPersistence, useSlashMenu |
| ws-handlers | (tested via ws.test.ts) | - |

**M8 added tests for:** store.ts, ws.ts, Composer, EditorPanel, MessageFeed -- major improvement from 2026-02-10 scan.

**Still untested high-risk:** Sidebar (308 lines, polling logic), HomePage (416 lines, session creation), terminal-ws.ts (PTY management), useAutoResumeSession (auto-resume logic).

---

## Summary

| Category | Count |
|----------|-------|
| Runtime edge cases (WebSocket) | 5 (QE-01 through QE-05) |
| Runtime edge cases (Sessions) | 3 (QE-06 through QE-08) |
| Runtime edge cases (Terminal) | 2 (QE-09, QE-10) |
| Runtime edge cases (Error handling) | 3 (QE-11 through QE-13) |
| State management issues | 3 (QE-14 through QE-16) |
| File size violations | 20 files |
| eslint-disable suppressions | 7 |
| Empty catch blocks | 40+ |
| Untested high-risk files | 4 |

### Top 5 Runtime Risks

1. **QE-01: Silent message drops** -- User sends message during WS reconnection, message is lost with no feedback
2. **QE-02: is_compacting stuck forever** -- CLI crash during compaction leaves permanent "Compacting..." UI
3. **QE-11: No ErrorBoundary** -- Single component render error crashes entire app
4. **QE-06: No flush-on-shutdown** -- Server crash loses last 150ms of session state
5. **QE-12: 40+ empty catches** -- Silent failures across the entire codebase, making debugging impossible
