# Code Quality Scan

> Scanned: `web/` (server + client)
> Date: 2026-02-10
> Typecheck: PASS (zero errors)
> Tests: 517 pass / 5 fail (1 file: git-utils.test.ts -- Windows path separator issues)

---

## 1. File Size Violations (>200 lines)

| File | Lines | Severity |
|------|-------|----------|
| `server/ws-bridge.ts` | 743 | HIGH |
| `src/components/HomePage.tsx` | 696 | HIGH |
| `src/components/Playground.tsx` | 531 | HIGH |
| `src/components/PermissionBanner.tsx` | 515 | HIGH |
| `src/components/EditorPanel.tsx` | 491 | HIGH |
| `server/cli-launcher.ts` | 491 | HIGH |
| `src/components/Sidebar.tsx` | 488 | HIGH |
| `src/store.ts` | 485 | HIGH |
| `src/components/MessageFeed.tsx` | 475 | HIGH |
| `src/components/Composer.tsx` | 460 | HIGH |
| `src/ws.ts` | 461 | HIGH |
| `server/routes.ts` | 444 | HIGH |
| `server/git-utils.ts` | 373 | MEDIUM |
| `src/components/MessageBubble.tsx` | 335 | MEDIUM |
| `src/components/EnvManager.tsx` | 293 | MEDIUM |
| `server/session-types.ts` | 239 | LOW |
| `src/components/ToolBlock.tsx` | 211 | LOW |
| `src/api.ts` | 203 | LOW |
| `src/components/FolderPicker.tsx` | 190 | OK (under 200, close) |

**Count: 18 files over 200 lines** (project standard). The worst offender is `ws-bridge.ts` at 743 lines (3.7x over limit).

---

## 2. Function Size Violations (>30 lines)

### Server

| File | Function/Block | ~Lines | Severity |
|------|----------------|--------|----------|
| `server/ws-bridge.ts` | `handleSystemMessage()` | ~80 | HIGH |
| `server/ws-bridge.ts` | `handleResultMessage()` | ~48 | MEDIUM |
| `server/ws-bridge.ts` | `handleUserMessage()` | ~32 | LOW |
| `server/ws-bridge.ts` | `handlePermissionResponse()` | ~38 | MEDIUM |
| `server/ws-bridge.ts` | `handleCLIMessage()` | ~42 | MEDIUM |
| `server/cli-launcher.ts` | `spawnCLI()` | ~90 | HIGH |
| `server/cli-launcher.ts` | `injectWorktreeGuardrails()` | ~56 | MEDIUM |
| `server/routes.ts` | `POST /sessions/create` handler | ~70 | HIGH |
| `server/routes.ts` | `cleanupWorktree()` | ~30 | LOW |
| `server/git-utils.ts` | `ensureWorktree()` | ~80 | HIGH |
| `server/git-utils.ts` | `removeWorktree()` | ~35 | LOW |

### Client

| File | Function/Component | ~Lines | Severity |
|------|-------------------|--------|----------|
| `src/ws.ts` | `handleMessage()` switch | ~250 | CRITICAL |
| `src/ws.ts` | `extractTasksFromBlocks()` | ~57 | MEDIUM |
| `src/store.ts` | `removeSession()` | ~38 | MEDIUM |
| `src/components/Composer.tsx` | `Composer` component body | ~430 | CRITICAL |
| `src/components/Sidebar.tsx` | `Sidebar` component body | ~480 | CRITICAL |
| `src/components/HomePage.tsx` | `HomePage` component body | ~430 | CRITICAL |
| `src/components/HomePage.tsx` | `handleSend()` | ~60 | MEDIUM |
| `src/components/PermissionBanner.tsx` | `AskUserQuestionDisplay()` | ~110 | HIGH |
| `src/components/PermissionBanner.tsx` | `PermissionBanner` body | ~90 | HIGH |
| `src/components/MessageFeed.tsx` | `groupMessages()` | ~38 | MEDIUM |
| `src/components/MessageFeed.tsx` | `ToolMessageGroup()` | ~80 | HIGH |
| `src/components/MessageFeed.tsx` | `MessageFeed` body | ~70 | HIGH |
| `src/components/MessageBubble.tsx` | `MarkdownContent()` | ~100 | HIGH |
| `src/components/MessageBubble.tsx` | `AssistantMessage()` | ~36 | LOW |
| `src/components/EditorPanel.tsx` | `EditorPanel` body | ~180 | CRITICAL |
| `src/components/EnvManager.tsx` | `EnvManager` body | ~135 | HIGH |

**Count: 27 oversized functions/components.** The worst are `handleMessage()` at ~250 lines (a single switch statement) and several React components that are monolithic (Sidebar, Composer, HomePage, EditorPanel all >180 lines of component logic).

---

## 3. Code Duplication

### HIGH severity (exact or near-exact duplication)

| What | File A | File B | ~Duplicated Lines |
|------|--------|--------|-------------------|
| `readFileAsBase64()` helper | `src/components/Composer.tsx:6-13` | `src/components/HomePage.tsx:14-21` | 8 lines |
| `ImageAttachment` interface | `src/components/Composer.tsx:15-18` | `src/components/HomePage.tsx:23-26` | 4 lines |
| Image handling: `handleFileSelect`, `removeImage`, `handlePaste` | `src/components/Composer.tsx:40-75` | `src/components/HomePage.tsx:80-130` | ~50 lines |
| `handleInput` (textarea auto-resize) | `src/components/Composer.tsx:85-91` | `src/components/HomePage.tsx:150-156` | 7 lines |
| `AssistantAvatar` SVG component | `src/components/MessageBubble.tsx:9-22` | `src/components/MessageFeed.tsx:22-36` | ~14 lines |
| Edit/Write tool display (diff rendering) | `src/components/ToolBlock.tsx:25-85` | `src/components/PermissionBanner.tsx:80-145` | ~60 lines |
| Context usage % computation | `server/ws-bridge.ts:478-486` | `src/ws.ts:215-223` | 8 lines |

### MEDIUM severity (structural/pattern duplication)

| What | Locations | ~Lines |
|------|-----------|--------|
| `idCounter + nextId()` pattern | `src/ws.ts:92-95`, `src/components/Composer.tsx`, `src/components/HomePage.tsx` | 4 lines x3 |
| Image thumbnails + remove button JSX | `src/components/Composer.tsx:300-330`, `src/components/HomePage.tsx:450-480` | ~30 lines |
| Slash command autocomplete logic | `src/components/Composer.tsx:95-155`, `src/components/HomePage.tsx:160-220` | ~60 lines |
| `TaskRow` component | `src/components/TaskPanel.tsx:10-50`, `src/components/Playground.tsx:430-470` | ~40 lines |

**Estimated total duplicated code: ~285 lines across 7 major duplication clusters.**

**Recommended extractions:**
- `src/utils/image-helpers.ts` -- `readFileAsBase64`, `ImageAttachment`, `handleFileSelect`, `removeImage`, `handlePaste`
- `src/components/AssistantAvatar.tsx` -- shared SVG avatar
- `src/components/ToolDiffDisplay.tsx` -- shared Edit/Write diff rendering
- `src/components/TaskRow.tsx` -- shared task row component
- `src/utils/id-generator.ts` -- shared ID counter

---

## 4. Dead Code / Unused Code

| Item | Location | Evidence |
|------|----------|----------|
| `@xterm/xterm` dependency | `package.json:59` | Not imported anywhere in `src/` or `server/` |
| `@xterm/addon-fit` dependency | `package.json:58` | Not imported anywhere in `src/` or `server/` |
| `react-arborist` dependency | `package.json:64` | Not imported anywhere in `src/` or `server/` |
| `react-resizable-panels` dependency | `package.json:67` | Not imported anywhere in `src/` or `server/` |
| `autoprefixer` dependency | `package.json:60` | Not imported; no postcss.config file exists |
| `postcss` dependency | `package.json:62` | Not imported; no postcss.config file exists (Tailwind 4 uses Vite plugin directly) |
| `Playground.tsx` component | `src/components/Playground.tsx` | Development-only mock component (531 lines); contains hardcoded mock data |
| `tool_progress` handler | `src/ws.ts:261-263` | Empty handler body, comment says "ignored for now" |
| `tool_use_summary` handler | `src/ws.ts:266-268` | Empty handler body, comment says "Optional" |
| `toolUseId` parameter | `src/components/ToolBlock.tsx` | Accepted via props/blocks but never rendered or used in logic |

**6 unused dependencies** (could save bundle size / install time).

---

## 5. Error Handling Issues

### Empty catch blocks (swallowed errors)

| File | Line(s) | Context |
|------|---------|---------|
| `server/ws-bridge.ts` | ~192, ~198 | JSON parse failures silently swallowed |
| `server/ws-bridge.ts` | ~406 | `execSync` git command failure swallowed |
| `server/ws-bridge.ts` | ~476 | Permission cancel error swallowed |
| `server/cli-launcher.ts` | ~160 | `which` binary resolution failure swallowed |
| `server/cli-launcher.ts` | ~164 | CLI version detection failure swallowed |
| `server/cli-launcher.ts` | ~476 | Process kill failure swallowed |
| `src/components/Sidebar.tsx` | multiple | At least 4 `catch { /* best-effort */ }` blocks for API calls |
| `src/utils/recent-dirs.ts` | 6 | localStorage parse failure silently returns `[]` |

### Inconsistent error handling patterns

| File | Issue |
|------|-------|
| `src/api.ts` | `get()` function does NOT parse error body, while `post/put/patch/del` all parse JSON error bodies and throw descriptive messages. This means GET failures produce generic "HTTP 500" errors instead of the server's error message. |
| `server/routes.ts` | Some route handlers return `c.json({ error: ... }, 500)` while others throw or don't handle errors at all. |
| `server/ws-bridge.ts` | WebSocket message parsing wraps in try/catch but the catch block is empty, so malformed messages disappear silently. |

### Missing error handling

| File | Issue |
|------|-------|
| `server/auto-namer.ts` | Spawns a CLI process but has no timeout -- if the CLI hangs, the namer process runs forever. |
| `src/ws.ts` | `waitForConnection()` has a 10-second timeout, but callers (`sendToSession`) do not wait for connection and silently drop messages if WebSocket is not OPEN. |
| `server/session-store.ts` | Debounced persist could lose data if the process exits during the debounce window. |

---

## 6. Performance Concerns

| File | Issue | Severity |
|------|-------|----------|
| `src/components/Sidebar.tsx:55` | Polls `api.listSessions()` every 5 seconds via `setInterval`. This runs regardless of whether there is any activity, creating unnecessary network traffic. Should use WebSocket push or event-driven updates. | MEDIUM |
| `src/store.ts` (removeSession) | Creates 15+ new `Map` instances by copying every map in the store. For frequent session removal, this is O(n) per map per call. | LOW |
| `src/components/MessageFeed.tsx` | `groupMessages()` runs on every render when messages change, iterating all messages to build a nested group structure. No memoization at the grouping level. | LOW |
| `server/routes.ts` (buildTree) | Recursive directory tree builder has a depth limit (5) but no file count limit. A directory with thousands of files would produce an enormous response. | MEDIUM |
| `server/git-utils.ts` | Uses `execSync` for ALL git operations, blocking the event loop. Multiple git commands (branch listing, worktree operations, fetch, pull) all block the Node.js thread. | HIGH |
| `server/ws-bridge.ts:394-427` | Uses `execSync` for git branch detection during session init, blocking the event loop during connection setup. | MEDIUM |
| `server/cli-launcher.ts:188` | Uses `execSync` to resolve the Claude binary path, blocking the event loop during session creation. | LOW |
| `server/session-names.ts` | Uses `readFileSync`/`writeFileSync` for session name persistence, blocking I/O on every name change. | LOW |
| `server/env-manager.ts` | Uses `readFileSync`/`writeFileSync`/`readdirSync` for environment management, blocking I/O. | LOW |
| `server/worktree-tracker.ts` | Uses `readFileSync`/`writeFileSync` for worktree mapping persistence, blocking I/O. | LOW |
| `server/session-store.ts` | Uses `readFileSync`/`writeFileSync`/`readdirSync` for session persistence, blocking I/O. | LOW |

**Note on synchronous I/O:** The CLAUDE.md explicitly states "NEVER use synchronous I/O in the server." There are at least **7 server files** that use synchronous filesystem or process operations. While some (like startup-time reads) are acceptable, the `execSync` calls in `git-utils.ts` and `ws-bridge.ts` run during active request handling and block the event loop.

---

## 7. Naming Inconsistencies

### Mixed case conventions in types/interfaces

The protocol types in `server/session-types.ts` mix snake_case and camelCase:

| Pattern | Examples |
|---------|----------|
| snake_case (from CLI protocol) | `session_id`, `tool_use_id`, `parent_tool_use_id`, `stop_reason`, `request_id`, `tool_name`, `is_error`, `total_cost_usd`, `num_turns` |
| camelCase (internal) | `modelUsage`, `inputTokens`, `outputTokens`, `contextWindow`, `stopReason` |

This is partially justified since the CLI protocol uses snake_case, but the boundary is not clean -- the same data sometimes appears in both conventions (e.g., `stop_reason` in the protocol vs `stopReason` in `ChatMessage`).

### File naming

All source files follow kebab-case convention correctly. Test files use `.test.ts` suffix consistently.

### Component naming

All React components use PascalCase correctly. All function exports use camelCase correctly.

---

## 8. TODO / FIXME / HACK / XXX / TEMP Comments

**No TODO, FIXME, HACK, XXX, or TEMP comments found in source code.**

The only matches were in test mock data (`Playground.tsx` and test files) where "TODO" appears as literal search pattern examples, not as actual task markers.

---

## 9. Test Coverage Gaps

### Test results summary

- **20 test files**, **522 tests total**
- **517 pass**, **5 fail**
- All 5 failures are in `server/git-utils.test.ts` due to Windows path separator issues (`\` vs `/`)

### Files with test coverage

| Source File | Test File | Tests |
|-------------|-----------|-------|
| `server/ws-bridge.ts` | `server/ws-bridge.test.ts` | Comprehensive |
| `server/cli-launcher.ts` | `server/cli-launcher.test.ts` | Comprehensive |
| `server/routes.ts` | `server/routes.test.ts` | Comprehensive |
| `server/session-store.ts` | `server/session-store.test.ts` | Comprehensive |
| `server/auto-namer.ts` | `server/auto-namer.test.ts` | Comprehensive |
| `server/session-types.ts` | `server/session-types.test.ts` | Comprehensive |
| `server/env-manager.ts` | `server/env-manager.test.ts` | Comprehensive |
| `server/git-utils.ts` | `server/git-utils.test.ts` | Comprehensive (5 Windows failures) |
| `server/session-names.ts` | `server/session-names.test.ts` | Comprehensive |
| `server/worktree-tracker.ts` | `server/worktree-tracker.test.ts` | Comprehensive |
| `src/utils/names.ts` | `src/utils/names.test.ts` | Comprehensive |
| `src/components/MessageBubble.tsx` | `src/components/MessageBubble.test.tsx` | Comprehensive |
| `src/components/PermissionBanner.tsx` | `src/components/PermissionBanner.test.tsx` | Comprehensive |
| `src/components/ToolBlock.tsx` | `src/components/ToolBlock.test.tsx` | Comprehensive |
| `src/components/TopBar.tsx` | `src/components/TopBar.test.tsx` | Comprehensive |
| `src/components/TaskPanel.tsx` | `src/components/TaskPanel.test.tsx` | Comprehensive |

### Files WITHOUT test coverage

| Source File | Lines | Risk |
|-------------|-------|------|
| `server/index.ts` | 169 | MEDIUM -- server startup, WebSocket upgrade, watchdog |
| `src/store.ts` | 485 | HIGH -- core state management, 30+ actions |
| `src/ws.ts` | 461 | HIGH -- WebSocket client, all message handling |
| `src/api.ts` | 203 | MEDIUM -- HTTP client wrapper |
| `src/App.tsx` | 114 | LOW -- routing, layout |
| `src/components/ChatView.tsx` | 63 | LOW -- composition only |
| `src/components/Composer.tsx` | 460 | HIGH -- complex input logic, slash commands, images |
| `src/components/Sidebar.tsx` | 488 | HIGH -- session management UI, polling, actions |
| `src/components/HomePage.tsx` | 696 | HIGH -- session creation, form state, git integration |
| `src/components/MessageFeed.tsx` | 475 | MEDIUM -- message grouping, sub-agent rendering |
| `src/components/EditorPanel.tsx` | 491 | MEDIUM -- file editor, tree browser |
| `src/components/EnvManager.tsx` | 293 | LOW -- CRUD modal |
| `src/components/FolderPicker.tsx` | 190 | LOW -- directory browser |
| `src/components/Playground.tsx` | 531 | NONE (dev-only) |
| `src/utils/recent-dirs.ts` | 16 | LOW |
| `dev.ts` | 69 | NONE (dev-only) |
| `bin/cli.ts` | 13 | LOW |

**14 source files have no tests.** The highest risk untested files are `store.ts` (485 lines, core state), `ws.ts` (461 lines, all WebSocket handling), `Composer.tsx` (460 lines, complex user input), and `HomePage.tsx` (696 lines, session creation).

### Test quality issue: Windows compatibility

The 5 failing tests in `git-utils.test.ts` all expect Unix-style forward-slash paths (`/fake/home/.companion/worktrees/repo/...`) but the production code uses `path.join()` which produces backslashes on Windows (`\fake\home\.companion\worktrees\repo\...`). The tests should normalize paths or use `path.join()` in expected values to be cross-platform.

---

## 10. Stale / Unused Dependencies

### Unused dependencies (not imported anywhere)

| Package | In `package.json` | Evidence |
|---------|--------------------|----------|
| `@xterm/xterm` | devDependencies | Zero imports in `src/` or `server/`. Likely a remnant from a removed terminal component. |
| `@xterm/addon-fit` | devDependencies | Zero imports. Paired with `@xterm/xterm`. |
| `react-arborist` | devDependencies | Zero imports. Likely replaced by custom tree in `EditorPanel.tsx`. |
| `react-resizable-panels` | devDependencies | Zero imports. Likely replaced by custom layout. |
| `autoprefixer` | devDependencies | Zero imports, no postcss.config file. Tailwind 4 uses `@tailwindcss/vite` plugin directly. |
| `postcss` | devDependencies | Zero imports, no postcss.config file. Same reason as autoprefixer. |

### Outdated dependencies (major version behind)

| Package | Current | Latest | Notes |
|---------|---------|--------|-------|
| `@vitejs/plugin-react` | 4.7.0 | 5.1.4 | Major version behind (v4 -> v5) |
| `vite` | 6.4.1 | 7.3.1 | Major version behind (v6 -> v7) |

### Dependency count

- **1 production dependency** (hono)
- **25 dev dependencies** (6 unused)

---

## 11. Complexity Hotspots

### Cyclomatic complexity (estimated high complexity)

| File | Function | Issue |
|------|----------|-------|
| `src/ws.ts` | `handleMessage()` | 15-case switch statement spanning ~250 lines, with nested conditionals in each case. This is the single most complex function in the codebase. |
| `server/ws-bridge.ts` | `handleCLIMessage()` | Multi-level switch on message type and subtype, with nested object construction and error handling. |
| `server/ws-bridge.ts` | `handleSystemMessage()` | Heavy branching on `subtype` with multiple optional field accesses. |
| `server/cli-launcher.ts` | `spawnCLI()` | 90+ lines with nested conditionals for worktree mode, environment setup, argument construction, and error handling. |
| `server/routes.ts` | `POST /sessions/create` | 70+ lines of option extraction, validation, and conditional construction. |
| `server/git-utils.ts` | `ensureWorktree()` | 80+ lines with multiple early returns, conditional branch creation, collision resolution, and error handling. |
| `src/components/Composer.tsx` | Component body | 430+ lines mixing UI state, keyboard handlers, slash command matching, image processing, git status, and mode switching. |
| `src/components/Sidebar.tsx` | Component body | 480+ lines mixing polling, session management, context menus, drag behavior, and rendering logic. |
| `src/components/HomePage.tsx` | Component body | 430+ lines with form state, API calls, git integration, environment management, and complex conditional rendering. |

### Recommended decomposition targets

1. **`src/ws.ts` handleMessage()** -- Extract each case into its own handler function (e.g., `handleSessionInit()`, `handleAssistant()`, `handleStreamEvent()`, etc.)
2. **`src/components/Composer.tsx`** -- Extract: slash command hook, image handling hook, git status component, mode toggle component
3. **`src/components/Sidebar.tsx`** -- Extract: session list item component, session actions menu, polling hook
4. **`src/components/HomePage.tsx`** -- Extract: session config form, git branch selector, environment selector, image attachment section
5. **`server/ws-bridge.ts`** -- Extract handler functions into separate modules by message direction (CLI handlers, browser handlers)
6. **`server/cli-launcher.ts` spawnCLI()** -- Extract argument builder, environment setup, and process lifecycle into separate functions

---

## Summary

| Category | Count | Severity |
|----------|-------|----------|
| File size violations (>200 lines) | 18 | HIGH |
| Function size violations (>30 lines) | 27 | HIGH |
| Code duplication clusters | 7 major, 4 minor | MEDIUM |
| Unused dependencies | 6 | LOW |
| Outdated dependencies (major version) | 2 | LOW |
| Dead code items | 4 (beyond dependencies) | LOW |
| Empty catch blocks | 8+ locations | MEDIUM |
| Inconsistent error handling | 3 patterns | MEDIUM |
| Missing error handling | 3 cases | MEDIUM |
| Performance concerns | 11 items | MEDIUM |
| Synchronous I/O in server | 7 files | HIGH (violates project standard) |
| Naming inconsistencies | 1 pattern (protocol boundary) | LOW |
| TODO/FIXME comments | 0 | NONE |
| Untested source files | 14 | HIGH |
| Failing tests | 5 (Windows path separators) | MEDIUM |

### Top 5 Priority Items

1. **Synchronous I/O in server** -- 7 server files use `execSync`, `readFileSync`, or `writeFileSync` during request handling, violating the project's explicit "NEVER use synchronous I/O in the server" rule. `git-utils.ts` is the worst offender with every function blocking the event loop.

2. **Monolithic components** -- Composer (460), Sidebar (488), HomePage (696), and EditorPanel (491) are each 2-3x over the 200-line limit and contain no separation of concerns. Extracting custom hooks and sub-components would improve maintainability significantly.

3. **Code duplication between Composer and HomePage** -- ~130 lines of image handling, file reading, textarea resize, and slash command logic are duplicated between these two components. A shared `useImageAttachments` hook and `useSlashCommands` hook would eliminate this.

4. **Test coverage gaps** -- `store.ts`, `ws.ts`, `Composer.tsx`, and `HomePage.tsx` together represent ~2,100 lines of untested, high-complexity code that forms the core user interaction path.

5. **ws.ts handleMessage()** -- A single 250-line switch statement handling all 15 WebSocket message types. This is the most complex function in the codebase and has no test coverage.
