# Workflows

Living document describing user-facing and technical workflows in ClaudeWebCLI.

**Last Updated:** 2026-02-10
**Version:** 0.14.1

---

## Table of Contents

- [User Workflows](#user-workflows)
  - [UW-1: Session Creation](#uw-1-session-creation)
  - [UW-2: Sending Messages and Receiving Responses](#uw-2-sending-messages-and-receiving-responses)
  - [UW-3: Tool Approval Flow](#uw-3-tool-approval-flow)
  - [UW-4: Session Management](#uw-4-session-management)
  - [UW-5: Plan Mode Toggle](#uw-5-plan-mode-toggle)
  - [UW-6: File Editing](#uw-6-file-editing)
  - [UW-7: Environment Management](#uw-7-environment-management)
- [Technical Workflows](#technical-workflows)
  - [TW-1: CLI Process Lifecycle](#tw-1-cli-process-lifecycle)
  - [TW-2: WebSocket Connection Lifecycle](#tw-2-websocket-connection-lifecycle)
  - [TW-3: Server Restart Recovery](#tw-3-server-restart-recovery)
  - [TW-4: NDJSON Message Routing](#tw-4-ndjson-message-routing)
  - [TW-5: Auto-Naming Flow](#tw-5-auto-naming-flow)
  - [TW-6: Session Persistence](#tw-6-session-persistence)
  - [TW-7: Git Worktree Creation and Cleanup](#tw-7-git-worktree-creation-and-cleanup)
  - [TW-8: Task Extraction from Tool Use Blocks](#tw-8-task-extraction-from-tool-use-blocks)

---

## User Workflows

### UW-1: Session Creation

**Entry Point:** HomePage component (`web/src/components/HomePage.tsx`)

The user creates a new session by configuring several options, then clicking "Start Session."

**Steps:**

1. **Select Model** -- Choose from the available Claude models:
   - `claude-opus-4-6` (default)
   - `claude-sonnet-4-5-20250929`
   - `claude-haiku-4-5-20251001`

2. **Select Permission Mode** -- Choose how tool permissions are handled:
   - **Agent** (`bypassPermissions`) -- CLI runs tools without asking (default)
   - **Plan** (`plan`) -- CLI requests approval for each tool use

3. **Select Working Folder** -- Use the FolderPicker modal to browse directories. Hidden directories (`.git`, `.env`, etc.) are excluded from the listing. Recent directories (up to 5) are stored in localStorage for quick access.

4. **Select Branch (optional)** -- If the folder is a git repo, a branch dropdown appears. Opening the dropdown triggers `git fetch` to refresh remote branches. The list shows local and remote branches with ahead/behind counts and worktree indicators.

5. **Select Environment (optional)** -- Pick a saved environment variable set. The last-used environment is persisted in localStorage under `cc-selected-env`. Environment sets are managed via the EnvManager modal (see UW-7).

6. **Enable Worktree (optional)** -- If a branch is selected, the user can check "Create worktree" to isolate the session in a separate git worktree directory under `~/.companion/worktrees/`.

7. **Submit** -- Browser sends `POST /api/sessions` with `{ model, permMode, cwd, branch, env, worktree, tools }`. The server:
   - Resolves environment variables from the selected env set
   - Creates a worktree if requested (see TW-7)
   - Tracks the worktree mapping in `~/.companion/worktrees.json`
   - Spawns the Claude CLI subprocess with `--sdk-url`
   - Returns `{ sessionId }`

8. **Connect** -- Browser opens a WebSocket to `/ws/browser/{sessionId}` and waits (up to 10 seconds, polling every 50ms) for the connection to establish.

9. **Session Initialized** -- The CLI connects to `/ws/cli/{sessionId}`, sends a `system.init` message with session ID, tools, model, and version. The browser receives `session_init` and is ready for the first prompt.

10. **Random Name Assigned** -- A random "Adjective Noun" name (from a pool of 40x40 = 1600 combinations) is generated client-side, with up to 100 retries to avoid collisions.

```
User selects options -> POST /api/sessions -> Server spawns CLI
  -> Browser connects WS -> CLI connects WS -> system.init
  -> Browser receives session_init -> Ready for first prompt
```

---

### UW-2: Sending Messages and Receiving Responses

**Entry Point:** Composer component (`web/src/components/Composer.tsx`)

1. **Compose Message** -- Type in the Composer textarea. Supports:
   - Plain text prompts
   - Image attachments (drag-and-drop or paste; only `image/*` MIME types accepted client-side)
   - Slash commands (autocomplete when text matches `/^\S*$/` and CLI has provided a command list)

2. **Send** -- Browser sends a `user_message` over WebSocket to the bridge server.

3. **Bridge Forwards** -- The bridge translates the JSON message to NDJSON format: `{ type: "user", message: { role: "user", content: [...] } }` and sends it to the CLI WebSocket. If the CLI is not yet connected, the message is queued in `pendingMessages` (persisted to disk).

4. **Streaming Response** -- The CLI streams back tokens as `stream_event` (content_block_delta) messages. The bridge forwards each to the browser. The browser renders the partial response in real time via the `streaming` Zustand state.

5. **Full Response** -- After streaming completes, the CLI sends an `assistant` message with the complete response content blocks (text, tool_use, thinking). The bridge forwards it to the browser, which adds it to `messages` in the store.

6. **Result** -- The CLI sends a `result` message containing cost, token usage, model usage, and context window data. The bridge forwards it and the browser updates session stats (cost, turns, context usage percentage).

7. **Context Usage** -- Computed as `(inputTokens + outputTokens) / contextWindow * 100` from the last model in the `modelUsage` map.

```
User types prompt -> WS: user_message -> Bridge: NDJSON user
  -> CLI streams: stream_event(s) -> assistant -> result
  -> Browser renders incrementally
```

---

### UW-3: Tool Approval Flow

**Entry Point:** PermissionBanner component (`web/src/components/PermissionBanner.tsx`)

When the CLI is in a permission mode that requires approval (e.g., `plan`), tool use requests trigger the approval UI.

1. **CLI Requests Permission** -- The CLI sends a `control_request` with `subtype: "can_use_tool"` containing `tool_name`, `input`, and `request_id`.

2. **Bridge Stores and Forwards** -- The bridge stores the request in `pendingRequests` (with a timestamp for ordering) and sends a `permission_request` to all connected browser sockets for that session.

3. **Browser Shows Banner** -- The PermissionBanner renders tool-specific approval UI:
   - **Bash**: Shows the command to be executed
   - **Edit/Write**: Shows file path and content preview (truncated at 500 chars for writes)
   - **Read/Glob/Grep**: Shows the target path or pattern
   - Generic display values are truncated at 200 chars

4. **User Decides** -- The user clicks Allow or Deny:
   - **Allow** sends `{ behavior: "allow", updatedInput, updatedPermissions }` back through the bridge as a `control_response`
   - **Deny** sends `{ behavior: "deny", message }` -- note that even denials use `subtype: "success"` per CLI protocol convention

5. **Bridge Forwards to CLI** -- The bridge wraps the response in NDJSON and sends it to the CLI.

6. **Timeout** -- The CLI enforces a 30-second timeout on permission requests. The bridge does NOT enforce this timeout. If the browser never responds, the CLI side times out while the bridge holds a stale pending permission. Stale permissions are cleared when the CLI disconnects.

7. **Cancellation** -- If the CLI disconnects while permissions are pending, the bridge sends `permission_cancelled` to all browser sockets and clears the pending permissions map.

```
CLI: control_request (can_use_tool) -> Bridge stores + forwards
  -> Browser: PermissionBanner shown -> User clicks Allow/Deny
  -> WS: permission_response -> Bridge: control_response -> CLI
```

---

### UW-4: Session Management

**Entry Point:** Sidebar component (`web/src/components/Sidebar.tsx`)

The sidebar displays all sessions sorted by creation time (newest first), polled every 5 seconds via `GET /api/sessions`.

**Rename:**
- Right-click or use the session menu to rename
- `PATCH /api/sessions/:id/rename` validates that the name is a non-empty trimmed string (no length cap)
- Manual renames are protected from auto-naming overwrite: the server checks `sessionNames.getName()` before and after async title generation

**Archive:**
- `POST /api/sessions/:id/archive` kills the CLI process and cleans up the worktree if applicable
- Archived sessions are excluded from auto-relaunch on browser connect
- Archived sessions are excluded from the reconnection watchdog on server restart
- `POST /api/sessions/:id/unarchive` restores the session

**Delete:**
- `DELETE /api/sessions/:id` performs full cleanup:
  1. Kill CLI process (SIGTERM, 5s wait, then SIGKILL if needed)
  2. Clean up worktree (see TW-7)
  3. Remove from launcher's process map
  4. Close all WebSocket connections for the session
  5. Remove from session store on disk

**Relaunch:**
- `POST /api/sessions/:id/relaunch` kills the old CLI and spawns a new one
- Uses `--resume` with the CLI's internal session ID for conversation continuity
- Deduplication via a `relaunchingSet` prevents concurrent relaunches (5-second cooldown)
- Old process gets 2-second SIGTERM timeout (shorter than normal kill) for faster turnaround

**Connection Status:**
- The TopBar shows connection status (connected/disconnected/reconnecting)
- A "Reconnect" button appears when the CLI is disconnected
- The sidebar displays branch name alongside each session

---

### UW-5: Plan Mode Toggle

**Entry Point:** Composer component (`web/src/components/Composer.tsx`)

1. **Toggle** -- Press `Shift+Tab` in the Composer to toggle plan mode on or off.
2. **Enable Plan Mode** -- Stores the current permission mode in `previousPermissionMode`, then switches to `plan` mode. Sends a `set_permission_mode` control request to the CLI via the bridge.
3. **Disable Plan Mode** -- Restores the permission mode from `previousPermissionMode`. Falls back to `acceptEdits` if no previous mode was stored.
4. **Visual Indicator** -- The Composer shows the current mode state so the user knows whether plan mode is active.

```
Shift+Tab -> Store previous mode -> Switch to "plan"
Shift+Tab again -> Restore previous mode (or "acceptEdits")
```

---

### UW-6: File Editing

**Entry Point:** EditorPanel component (`web/src/components/EditorPanel.tsx`)

1. **Switch to Editor Tab** -- Click the "Editor" tab in the TopBar to switch from Chat to Editor view.
2. **File Tree** -- The left pane shows a recursive file tree (max depth 10, hidden files and `node_modules` excluded). Load via `GET /api/tree`.
3. **Open File** -- Click a file in the tree. Contents loaded via `GET /api/file` (max 2MB per read).
4. **Edit** -- CodeMirror editor with multi-language syntax highlighting. Changes are tracked in the `editorDirty` state.
5. **Auto-Save** -- Changes auto-save after 800ms of inactivity (debounced) via `PUT /api/file`. No confirmation dialog before saving.
6. **Changed Files Tracking** -- When Claude uses `Edit` or `Write` tools with a `file_path` input, the browser's WebSocket handler records those paths in the `changedFiles` set for the session. This powers the "changed files" indicator in the editor.
7. **Diff View** -- `GET /api/diff?path={absPath}` returns the `git diff HEAD` output for the file (5-second timeout on the git command).

```
User opens Editor tab -> File tree loads -> Click file -> CodeMirror opens
  -> Edit content -> 800ms idle -> Auto-save via PUT /api/file
  -> Changed files tracked from Claude's Edit/Write tool calls
```

---

### UW-7: Environment Management

**Entry Point:** EnvManager component (`web/src/components/EnvManager.tsx`)

Environment sets store groups of environment variables that are injected into CLI sessions.

**Create:**
1. Open the EnvManager modal from the session creation page
2. Enter a name (must be non-empty; name is slugified for storage)
3. Add key-value pairs for environment variables
4. `POST /api/envs` creates the set as a JSON file at `~/.companion/envs/{slug}.json`
5. Duplicate slug detection prevents name collisions (checked via `existsSync`)

**Update:**
1. Select an existing environment set
2. Modify name or variables
3. `PUT /api/envs/:slug` saves changes
4. If the name changes, the new slug is checked for collisions before renaming

**Delete:**
1. `DELETE /api/envs/:slug` removes the environment set file from disk

**Selection:**
- The selected environment is persisted in localStorage under `cc-selected-env`
- When creating a session, the selected environment's variables are resolved and passed to the CLI process

**Storage:** All environment sets are stored as plaintext JSON in `~/.companion/envs/`. Variables may contain secrets (API keys, tokens) -- they are not encrypted.

---

## Technical Workflows

### TW-1: CLI Process Lifecycle

**Source:** `web/server/cli-launcher.ts`

**States:** `starting` -> `connected` -> `running` -> `exited`

**Spawn:**
1. Session creation triggers `CliLauncher.launch()`
2. Binary is resolved: if the path does not start with `/`, it is resolved via `which`
3. The CLI is spawned with:
   ```
   claude --sdk-url ws://localhost:{port}/ws/cli/{sessionId}
     --print --output-format stream-json --input-format stream-json
     --verbose --model {model} --permission-mode {mode}
     -p "placeholder"
   ```
4. The `-p "placeholder"` prompt is ignored; the CLI waits for a `user` message over WebSocket
5. Environment variables from the selected env set are merged into the process environment
6. `CLAUDECODE: "1"` is set in the spawned process environment
7. If using a worktree, a `CLAUDE.md` guardrails file is injected into `.claude/` within the worktree directory (idempotent via start/end markers)

**Connect:**
1. The CLI opens a WebSocket to `/ws/cli/{sessionId}`
2. On connect, the bridge flushes any `pendingMessages` to the CLI
3. The CLI sends `system.init` with its internal session ID, tools, model, and version
4. The internal `session_id` is stored for `--resume` on future relaunches

**Resume:**
1. Relaunch uses `--resume {cliSessionId}` to restore conversation context
2. If the CLI exits within 5 seconds of a `--resume` launch, `cliSessionId` is cleared to prevent infinite loops -- the next relaunch starts fresh

**Kill:**
1. `kill()` sends SIGTERM and waits 5 seconds
2. If the process is still alive, SIGKILL is sent
3. Relaunch uses a shorter 2-second SIGTERM timeout for faster turnaround

**Relaunch Deduplication:**
- A `relaunchingSet` prevents concurrent relaunch attempts for the same session
- Entries are removed after 5 seconds via `setTimeout`

```
launch() -> spawn CLI with --sdk-url -> CLI connects WS -> system.init
  -> Store cliSessionId for --resume
  ...
relaunch() -> kill old (2s timeout) -> spawn with --resume {cliSessionId}
  -> CLI reconnects -> conversation context restored
  ...
kill() -> SIGTERM -> 5s wait -> SIGKILL if needed -> state = exited
```

---

### TW-2: WebSocket Connection Lifecycle

**Source (server):** `web/server/ws-bridge.ts`, `web/server/index.ts`
**Source (client):** `web/src/ws.ts`

**Browser Connect:**
1. Browser calls `connectSession(sessionId)` which opens a WebSocket to `/ws/browser/{sessionId}`
2. Duplicate connections are prevented: if a socket already exists for the session, the call returns immediately
3. On open, the bridge sends `message_history` with all stored messages so the browser can reconstruct the conversation
4. If the CLI socket is null (process dead or not yet connected), the bridge fires `onCLIRelaunchNeeded` to auto-relaunch

**Browser Auto-Reconnect:**
1. On WebSocket close, `scheduleReconnect` sets a 2-second timer
2. Reconnect only fires if the session is still current or known in the store
3. No exponential backoff -- fixed 2-second delay

**CLI Connect:**
1. The CLI opens a WebSocket to `/ws/cli/{sessionId}` (UUID format validated by regex)
2. On open, the bridge flushes `pendingMessages` to the CLI
3. On close, all pending permissions are cancelled and `permission_cancelled` is sent to browsers

**Connection Wait:**
- `waitForConnection()` polls every 50ms with a 10-second timeout
- Used during initial session creation to ensure the WebSocket is ready before sending the first prompt

```
Browser: connectSession() -> WS open -> receive message_history
  -> WS close -> 2s delay -> reconnect (if session still active)

CLI: spawn -> WS connect -> flush pending messages -> system.init
  -> WS close -> cancel pending permissions -> notify browsers
```

---

### TW-3: Server Restart Recovery

**Source:** `web/server/index.ts`, `web/server/cli-launcher.ts`, `web/server/session-store.ts`

When the server restarts, it must recover existing sessions and reconnect to any surviving CLI processes.

1. **Load Sessions from Disk** -- `SessionStore.loadAll()` reads all `.json` files from `$TMPDIR/vibe-sessions/` (excluding `launcher.json`). Each file contains a full `SessionState`.

2. **Check Process Liveness** -- `CliLauncher.restoreFromDisk()` checks each persisted PID via `process.kill(pid, 0)`:
   - **Alive**: Set state to `starting` (waiting for CLI to reconnect its WebSocket)
   - **Dead**: Set state to `exited`

3. **Reconnection Watchdog** -- After a 10-second grace period (`RECONNECT_GRACE_MS`):
   - Sessions still in `starting` state (CLI never reconnected) are relaunched with `--resume`
   - Archived sessions are excluded from relaunch

4. **CLI Reconnection** -- If a CLI process survived the server restart, it will attempt to reconnect to the same `/ws/cli/{sessionId}` endpoint. The bridge accepts the connection and restores the session.

5. **Browser Reconnection** -- Browsers auto-reconnect after detecting the WebSocket close. On reconnect, they receive the full `message_history` to restore the conversation view.

```
Server starts -> Load sessions from disk -> Check PIDs
  -> Alive? state = starting (wait for reconnect)
  -> Dead? state = exited
  -> 10s grace period -> Relaunch any still-starting sessions with --resume
  -> Browsers auto-reconnect -> Receive message_history
```

---

### TW-4: NDJSON Message Routing

**Source:** `web/server/ws-bridge.ts`

The bridge translates between NDJSON (CLI) and JSON (browser) protocols.

**CLI to Browser (inbound):**
1. CLI sends a WebSocket message containing one or more newline-delimited JSON lines
2. Bridge splits on `\n` and parses each line independently
3. Parse failures are logged as warnings and silently skipped
4. Each parsed message is routed by `type`:
   - `system` (init): Store session info, resolve git repo info (branch, default branch), extract CLI session ID for `--resume`, broadcast `session_init` to browsers
   - `system` (status): Update session status (processing/waiting/complete/compacting), broadcast to browsers
   - `assistant`: Store in message history, broadcast to browsers
   - `result`: Update session stats (cost, turns, context), broadcast to browsers, trigger auto-naming if first turn
   - `stream_event`: Forward directly to browsers (no storage)
   - `control_request` (can_use_tool): Store in `pendingRequests` with timestamp, broadcast as `permission_request` to browsers
   - `keep_alive`: Silently consumed (no action)
   - Unknown types: Silently ignored (no-op)

**Browser to CLI (outbound):**
1. Browser sends a JSON WebSocket message
2. Bridge parses the JSON; parse failures are logged and ignored
3. Message is routed by `type`:
   - `user_message`: Wrap as NDJSON `{ type: "user", message: {...} }`, assign session_id (fallback chain: `msg.session_id || session.state.session_id || ""`), send to CLI or queue in `pendingMessages`
   - `permission_response`: Translate to `control_response` NDJSON, remove from `pendingRequests`
   - `interrupt`: Send `control_request` with `subtype: "interrupt"` to CLI
   - `set_model`: Forward as `control_request` with `subtype: "set_model"` to CLI
   - `set_permission_mode`: Forward as `control_request` with `subtype: "set_permission_mode"` to CLI

**NDJSON Output Format:**
- All messages to the CLI are serialized as JSON + `\n` delimiter: `cliSocket.send(ndjson + "\n")`

```
CLI -> NDJSON lines -> split on \n -> JSON.parse each -> route by type
  -> Store/transform -> JSON -> Browser WS

Browser -> JSON -> parse -> route by type -> transform -> NDJSON + \n -> CLI WS
  (or queue in pendingMessages if CLI not connected)
```

---

### TW-5: Auto-Naming Flow

**Source:** `web/server/auto-namer.ts`, `web/server/ws-bridge.ts`, `web/server/index.ts`

After the first successful turn, the session gets an auto-generated descriptive name.

1. **Trigger** -- When the bridge receives a `result` message that is not an error AND the first user message is found in history AND `autoNamingAttempted` has not been set for this session.

2. **Mark Attempted** -- The session ID is added to the `autoNamingAttempted` Set to prevent duplicate attempts.

3. **Skip if Restored** -- Sessions restored from disk with `num_turns > 0` skip auto-naming.

4. **Check for Manual Name** -- Before generating, check if `sessionNames.getName()` returns a value (user already renamed). If so, skip.

5. **Spawn One-Shot CLI** -- `autoNamer.generateTitle()` spawns a separate Claude CLI process:
   - Uses the same model as the session (falls back to `claude-sonnet-4-5-20250929`)
   - Sends the first user message (truncated to 500 chars) as the prompt
   - 15-second timeout (process killed with SIGTERM if exceeded)
   - The `claude` binary path is cached globally on first resolution

6. **Validate Title** -- The generated title must be non-empty and under 100 characters. Surrounding quotes are stripped. No sanitization of content (control characters, HTML).

7. **Re-check Before Applying** -- After async generation, check `sessionNames.getName()` again to ensure no manual rename happened during generation.

8. **Apply** -- Save the generated name via `sessionNames` and broadcast `session_name_update` to browsers.

9. **Client-Side Acceptance** -- The browser only accepts the auto-generated name if the current name matches the random "Adjective Noun" pattern (regex: `/^[A-Z][a-z]+ [A-Z][a-z]+$/`). Manually-set names are not overwritten. However, any manual name matching this exact pattern (e.g., "Quick Start") would also be overwritten.

```
First result (non-error) -> Check autoNamingAttempted -> Check manual name
  -> Spawn one-shot CLI with truncated prompt -> 15s timeout
  -> Validate title (0 < length < 100) -> Re-check manual name
  -> Save + broadcast session_name_update -> Browser accepts if name is random
```

---

### TW-6: Session Persistence

**Source:** `web/server/session-store.ts`, `web/server/session-names.ts`, `web/server/worktree-tracker.ts`

**Session State (Disk):**
- Location: `$TMPDIR/vibe-sessions/{sessionId}.json`
- Contains: Full `SessionState` including message history, pending messages, session config
- Writes are debounced at 150ms to batch rapid changes during streaming
- No "flush on shutdown" logic exists -- state changes within the 150ms window are lost on crash
- The temp directory may be cleared by the OS on reboot

**Launcher State (Disk):**
- Location: `$TMPDIR/vibe-sessions/launcher.json`
- Contains: PID and configuration for each CLI process
- Excluded from `loadAll()` filtering

**Session Names (Disk):**
- Location: `~/.companion/session-names.json`
- Contains: `{ sessionId: displayName }` mapping
- Lazy-loaded on first access
- Survives server restarts and temp directory cleanup

**Worktree Mappings (Disk):**
- Location: `~/.companion/worktrees.json`
- Contains: Array of `{ sessionId, repoRoot, branch, actualBranch, worktreePath, createdAt }`
- Survives server restarts

**Client-Side Persistence (localStorage):**
- `cc-current-session`: Active session ID (auto-restored on app mount)
- `cc-session-names`: JSON array of session name entries
- `cc-selected-env`: Last-used environment slug
- `cc-dark-mode`: Theme preference (falls back to system `prefers-color-scheme`)

```
State change -> SessionStore.save() -> 150ms debounce -> write JSON to disk
  (names and worktrees written immediately to ~/.companion/)
  (client state in localStorage, restored on page load)
```

---

### TW-7: Git Worktree Creation and Cleanup

**Source:** `web/server/git-utils.ts`, `web/server/worktree-tracker.ts`, `web/server/routes.ts`

**Creation:**
1. User selects a branch and enables "Create worktree" during session creation
2. Server calls `createWorktree()` which runs `git worktree add`
3. Worktree directory: `~/.companion/worktrees/{repo-name}/{branch}`
4. If a worktree already exists for the branch, a new branch `{branch}-wt-{random4digit}` is created
5. Up to 100 random suffix attempts; falls back to timestamp-based suffix
6. The `WorktreeTracker` records the session-to-worktree mapping
7. A `CLAUDE.md` guardrails file is injected into the worktree's `.claude/` directory to prevent Claude from switching branches (uses `WORKTREE_GUARDRAILS_START/END` markers for idempotent updates)
8. Safety check: guardrails are never injected into the main repo root

**Cleanup (on archive or delete):**
1. Check if other sessions are using the same worktree (via `WorktreeTracker`)
2. **Clean worktree (no uncommitted changes):** Auto-removed via `git worktree remove`
3. **Dirty worktree (uncommitted changes):** Only removed if the `force` flag is set in the API call; otherwise preserved to prevent data loss
4. Companion-managed branches (matching the `-wt-N` suffix pattern) are also deleted from git
5. The worktree mapping is removed from `~/.companion/worktrees.json`

**Worktree Detection:**
- Uses `gitDir.includes("/worktrees/")` to detect if a path is inside a worktree
- Known issue: On Windows, this may fail if git returns backslash-separated paths

```
Session create with worktree=true
  -> git worktree add ~/.companion/worktrees/{repo}/{branch}
  -> If branch exists: create {branch}-wt-{random4} variant
  -> Track in worktrees.json -> Inject CLAUDE.md guardrails

Session archive/delete
  -> Check other sessions using this worktree
  -> Clean? auto-remove | Dirty? require force flag
  -> Delete companion-managed branches -> Remove tracking
```

---

### TW-8: Task Extraction from Tool Use Blocks

**Source:** `web/src/ws.ts`

The browser-side WebSocket handler scans every `tool_use` content block in assistant messages and permission requests for task-related tool calls.

**Supported Tools:**

| Tool Name | Behavior |
|-----------|----------|
| `TodoWrite` | Replaces all tasks for the session with the new list from `input.todos` |
| `TaskCreate` | Appends a new task to the session's task list |
| `TaskUpdate` | Patches an existing task (matched by task ID) with updated fields |

**Deduplication:**
- A `processedToolUseIds` Set (per session) tracks which `tool_use` block IDs have been processed
- Prevents duplicate task creation when the same block appears in:
  - Streaming events and the final assistant message
  - Permission requests and the subsequent assistant message
  - Message history replay on browser reconnect

**Task ID Generation:**
- `taskCounters` map maintains an incremental counter per session
- New tasks from `TaskCreate` receive an ID based on this counter
- Counter resets on page reload (uses `Date.now()` seed)

**Changed File Tracking (related):**
- `Edit` and `Write` tool_use blocks with a `file_path` input are tracked in the `changedFiles` set
- Powers the "changed files" indicator in the EditorPanel

```
assistant message received -> scan content blocks for tool_use
  -> TodoWrite? replace all tasks
  -> TaskCreate? append new task (deduplicated by tool_use ID)
  -> TaskUpdate? patch existing task
  -> Edit/Write? add file_path to changedFiles set
```

---

## Cross-Reference: Key Timeouts and Limits

| Parameter | Value | Location | Purpose |
|-----------|-------|----------|---------|
| Session persistence debounce | 150ms | `session-store.ts` | Batch rapid state changes |
| Browser reconnect delay | 2000ms | `ws.ts` | Fixed delay before reconnect |
| Connection wait timeout | 10000ms | `ws.ts` | Max wait for WS to establish |
| Reconnection watchdog grace | 10000ms | `index.ts` | Grace period after server restart |
| Auto-namer timeout | 15000ms | `auto-namer.ts` | Max time for title generation |
| CLI kill SIGTERM wait | 5000ms | `cli-launcher.ts` | Wait before SIGKILL |
| Relaunch SIGTERM wait | 2000ms | `cli-launcher.ts` | Faster kill for relaunches |
| Resume exit threshold | 5000ms | `cli-launcher.ts` | Clear cliSessionId if exit too fast |
| Relaunch dedup cooldown | 5000ms | `index.ts` | Prevent concurrent relaunches |
| Editor auto-save debounce | 800ms | `EditorPanel.tsx` | Wait before saving edits |
| Sidebar poll interval | 5000ms | `Sidebar.tsx` | Session list refresh |
| Git init info timeout | 3000ms | `ws-bridge.ts` | Git commands during init |
| Git utils timeout | 10000ms | `git-utils.ts` | General git operations |
| Git diff timeout | 5000ms | `routes.ts` | File diff generation |
| File read size limit | 2MB | `routes.ts` | Max file size for read API |
| File tree max depth | 10 | `routes.ts` | Recursion limit |
| Auto-namer input truncation | 500 chars | `auto-namer.ts` | Limit prompt size |
| Auto-namer title max length | 100 chars | `auto-namer.ts` | Reject overly long titles |
| Write content preview | 500 chars | `PermissionBanner.tsx` | UI truncation |
| Generic display truncation | 200 chars | `PermissionBanner.tsx` | UI truncation |
| Recent directories max | 5 | `recent-dirs.ts` | Prevent unbounded growth |
| Random name pool | 1600 | `names.ts` | 40 adjectives x 40 nouns |
| Random name retries | 100 | `names.ts` | Collision avoidance |
| Worktree suffix retries | 100 | `git-utils.ts` | Branch name collision avoidance |
