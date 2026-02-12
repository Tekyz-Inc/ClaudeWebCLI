# Business Rules -- 2026-02-10

Scan of the ClaudeWebCLI codebase (`web/server/` and `web/src/`).

---

## Authentication & Authorization

- **No authentication on HTTP API or WebSocket endpoints**: `web/server/routes.ts` and `web/server/index.ts` -- All API routes (`/api/*`) use only CORS middleware. No auth middleware protects session creation, filesystem access, git operations, or environment management. Any client on the network can create sessions, read/write arbitrary files, and execute CLI processes. Assessment: **critical security gap** for any non-localhost deployment.

- **No authentication on WebSocket upgrade**: `web/server/index.ts:91-110` -- Both CLI and browser WebSocket paths (`/ws/cli/:sessionId` and `/ws/browser/:sessionId`) accept any connection without checking credentials. Session IDs are UUID-based but guessable via the `/api/sessions` listing endpoint. Assessment: any client that knows (or enumerates) a session ID can connect and send messages.

- **CLI auth token set as environment variable `CLAUDECODE=1`**: `web/server/cli-launcher.ts:233-237` -- The spawned CLI process receives `CLAUDECODE: "1"` in its environment. The actual Anthropic auth token is inherited from the server's `process.env`. Assessment: the token is never explicitly managed by this codebase; it relies on the host machine's auth state.

- **Session ID is the sole access control**: `web/server/ws-bridge.ts:228-229` -- All CLI and browser message routing is keyed on session ID extracted from `ws.data`. No per-session tokens or user identity checks exist. Assessment: session ID acts as a bearer token with no revocation mechanism.

- **Environment variables stored in plaintext on disk**: `web/server/env-manager.ts:99` -- Companion environments (which may contain API keys, secrets) are written as unencrypted JSON to `~/.companion/envs/`. Assessment: any process with read access to the home directory can read all stored environment secrets.

- **Filesystem read/write API has no path sandboxing**: `web/server/routes.ts:240-270` -- The `/api/fs/read` and `/api/fs/write` endpoints accept arbitrary absolute paths resolved via `resolve()`. There is no check that the path is within the session's `cwd` or any allowed directory. Assessment: **arbitrary file read/write** on the server's filesystem.

- **File size limit for reads: 2MB**: `web/server/routes.ts:246` -- `info.size > 2 * 1024 * 1024` returns 413. Assessment: only validation on the read endpoint; no validation on write size.

---

## Data Validation

- **Session name must be a non-empty trimmed string**: `web/server/routes.ts:113` -- `PATCH /sessions/:id/name` validates `typeof body.name !== "string" || !body.name.trim()` returns 400. Assessment: minimal validation, no length cap.

- **Environment name must contain alphanumeric characters after slugification**: `web/server/env-manager.ts:82-84` -- `createEnv()` requires non-empty name, slugifies it, rejects if slug is empty. Duplicate slug detection via `existsSync()`. Assessment: race condition possible if two creates happen simultaneously for the same slug.

- **Slug collision check on environment rename**: `web/server/env-manager.ts:116-118` -- `updateEnv()` checks if the new slug already exists when the name changes. Assessment: same race condition as above.

- **NDJSON parse failure is silently skipped**: `web/server/ws-bridge.ts:235-239` -- If a CLI message line fails `JSON.parse`, a warning is logged and that line is skipped. The session continues processing. Assessment: malformed messages from CLI are silently dropped; no error propagated to browser.

- **Browser message parse failure silently returns**: `web/server/ws-bridge.ts:305-309` -- If a browser message fails `JSON.parse`, a warning is logged and the handler returns. Assessment: invalid browser messages are silently ignored.

- **Auto-namer title length constraint: 0 < length < 100**: `web/server/auto-namer.ts:66` -- Generated titles are rejected if empty or >= 100 chars. Surrounding quotes are stripped. Assessment: reasonable, but no sanitization of title content (e.g., control characters, HTML).

- **Auto-namer input truncated to 500 chars**: `web/server/auto-namer.ts:33` -- `firstUserMessage.slice(0, 500)` before sending to Claude for title generation. Assessment: prevents excessive prompt size.

- **File tree recursion depth limit: 10 levels**: `web/server/routes.ts:211` -- `buildTree()` stops at `depth > 10`. Assessment: prevents runaway recursion on deeply nested filesystems.

- **Hidden files and `node_modules` excluded from tree**: `web/server/routes.ts:216` -- Files starting with `.` and `node_modules` directories are skipped. Assessment: prevents accidental exposure of `.env` files in tree listing, but they are still readable via `/api/fs/read`.

- **Directory listing excludes hidden directories**: `web/server/routes.ts:180` -- `entry.name.startsWith(".")` entries are filtered out. Assessment: consistent with tree behavior.

- **Git command timeout: 3000ms for init info, 10000ms for git-utils, 5000ms for diff**: `web/server/ws-bridge.ts:398` (3s), `web/server/git-utils.ts:61` (10s), `web/server/routes.ts:282` (5s). Assessment: prevents hanging on slow git operations.

- **Write content preview truncated at 500 chars in permission UI**: `web/src/components/PermissionBanner.tsx:398` -- `content.length > 500 ? content.slice(0, 500) + "..."`. Assessment: UI-only truncation, full content is in the request.

- **Generic display value truncated at 200 chars**: `web/src/components/PermissionBanner.tsx:502` -- Strings > 200 chars get `"..."` suffix. Assessment: UI display only.

- **Only image/* MIME types accepted for attachments**: `web/src/components/Composer.tsx:195` and `web/src/components/HomePage.tsx:152` -- `file.type.startsWith("image/")` check. Assessment: client-side only; no server-side validation of image data.

---

## Session Management

- **Session ID is a random UUID**: `web/server/cli-launcher.ts:117` -- `randomUUID()` generates the session ID. Assessment: cryptographically random, low collision risk.

- **Session state machine: `starting -> connected -> running -> exited`**: `web/server/cli-launcher.ts:11` -- Four states. `markConnected()` only transitions from `starting` or `connected` to `connected`. Assessment: no formal state machine enforcement; states are set directly.

- **CLI session ID mapping for `--resume`**: `web/server/cli-launcher.ts:356-361` and `web/server/index.ts:34-36` -- When CLI reports its internal `session_id` via `system.init`, it is stored on the launcher info so that relaunches can use `--resume` to restore conversation context. Assessment: critical for session continuity across CLI process restarts.

- **Immediate exit after `--resume` clears `cliSessionId`**: `web/server/cli-launcher.ts:265-268` -- If the CLI exits within 5 seconds of a `--resume` launch, the `cliSessionId` is cleared so the next relaunch starts fresh. Assessment: prevents infinite relaunch loops on corrupt resume state.

- **Relaunch deduplication via `relaunchingSet`**: `web/server/index.ts:39-52` -- A `Set<string>` prevents concurrent relaunch attempts for the same session. Entries are removed after 5 seconds via `setTimeout`. Assessment: prevents race conditions but the 5-second cooldown is hardcoded with no backoff.

- **Auto-relaunch on browser connect**: `web/server/ws-bridge.ts:289-294` and `web/server/index.ts:40-53` -- When a browser connects and the CLI socket is null, the bridge fires `onCLIRelaunchNeeded`, which triggers the launcher to relaunch. Archived sessions are excluded. Assessment: seamless reconnection experience, but could cause unexpected CLI spawns.

- **Reconnection watchdog on server restart**: `web/server/index.ts:152-168` -- After restoring sessions from disk, a 10-second grace period (`RECONNECT_GRACE_MS = 10_000`) allows CLI processes to reconnect. Sessions still in `starting` state after the grace period are relaunched. Assessment: handles server restart scenarios; archived sessions are excluded.

- **Process recovery on server restart**: `web/server/cli-launcher.ts:89-104` -- `restoreFromDisk()` checks each persisted PID with `process.kill(pid, 0)`. Alive processes get `starting` state; dead ones get `exited`. Assessment: robust recovery mechanism.

- **Graceful kill with timeout then SIGKILL**: `web/server/cli-launcher.ts:367-392` -- `kill()` sends SIGTERM, waits 5 seconds, then SIGKILL if still alive. Assessment: standard two-phase termination.

- **Relaunch kills old process with 2-second SIGTERM timeout**: `web/server/cli-launcher.ts:154-159` -- Uses `Promise.race` with 2-second timeout before proceeding. Also kills by PID for processes from previous server instances. Assessment: shorter timeout than `kill()` for faster relaunches.

- **Session persistence via debounced writes**: `web/server/session-store.ts:35-43` -- `save()` debounces at 150ms to batch rapid changes. Assessment: reduces disk I/O during streaming but could lose state on server crash within the debounce window.

- **Session persistence directory**: `web/server/session-store.ts:19` -- Defaults to `os.tmpdir()/vibe-sessions`. Assessment: temporary directory may be cleared on reboot, losing session state.

- **Session names persisted in `~/.companion/session-names.json`**: `web/server/session-names.ts:12` -- Separate file from session store, lazy-loaded. Assessment: survives server restarts and temp directory cleanup.

- **Worktree tracking persisted in `~/.companion/worktrees.json`**: `web/server/worktree-tracker.ts:24` -- Maps session IDs to worktree paths. Assessment: survives restarts.

- **Archive kills the CLI process**: `web/server/routes.ts:151-162` -- Archiving a session first kills its CLI, then cleans up the worktree if applicable. Assessment: archive is destructive for the running process.

- **Delete kills CLI, closes all sockets, removes from store**: `web/server/routes.ts:137-148` -- Full cleanup chain: kill -> cleanup worktree -> remove from launcher -> close WS session. Assessment: thorough cleanup.

- **Session restored from disk skips auto-naming if `num_turns > 0`**: `web/server/ws-bridge.ts:123-125` -- Prevents re-triggering auto-naming for already-named sessions. Assessment: correctly handles restore scenario.

- **Auto-naming triggered once per session after first successful result**: `web/server/ws-bridge.ts:496-511` -- Uses `autoNamingAttempted` Set. Only fires if result is not an error and the first user message is found in history. Assessment: race condition guard with re-check after async generation.

- **Auto-name does not overwrite manual renames**: `web/server/index.ts:58,64` -- Checks `sessionNames.getName()` before and after async title generation. Assessment: prevents overwrite race.

- **Client-side auto-name acceptance only for random "Adj Noun" names**: `web/src/ws.ts:316` -- Regex `/^[A-Z][a-z]+ [A-Z][a-z]+$/` determines if a name is "random" and can be overwritten. Assessment: fragile regex; manually-set names matching this pattern would be overwritten.

- **Client-side session name persistence in localStorage**: `web/src/store.ts:113,388` -- Session names stored under `cc-session-names` as JSON array of entries. Assessment: survives page reloads but not browser data clears.

- **Current session ID persisted in localStorage**: `web/src/store.ts:121,174-180` -- `cc-current-session` key. Auto-restored on app mount. Assessment: auto-reconnects to last session.

- **Recent directories limited to 5**: `web/src/utils/recent-dirs.ts:14` -- `dirs.slice(0, 5)` after unshift. Assessment: prevents unbounded growth.

---

## WebSocket Protocol

- **CLI WebSocket path pattern**: `web/server/index.ts:91` -- `/ws/cli/[a-f0-9-]+` regex validates session ID format as UUID. Assessment: prevents arbitrary path injection.

- **Browser WebSocket path pattern**: `web/server/index.ts:102` -- `/ws/browser/[a-f0-9-]+` same UUID validation. Assessment: consistent with CLI path.

- **NDJSON protocol: newline-delimited JSON from CLI**: `web/server/ws-bridge.ts:231-242` -- Messages split on `\n`, each line parsed independently. Assessment: standard NDJSON handling; partial lines within a single WebSocket frame would be handled correctly since WebSocket is message-based.

- **NDJSON output: newline appended**: `web/server/ws-bridge.ts:712` -- `session.cliSocket.send(ndjson + "\n")` ensures NDJSON delimiter. Assessment: required by Claude CLI protocol.

- **Message queuing when CLI not connected**: `web/server/ws-bridge.ts:704-708` -- Messages are pushed to `session.pendingMessages` and flushed when CLI connects (`handleCLIOpen`, lines 216-222). Assessment: ensures messages sent during CLI startup are not lost.

- **Pending messages persisted to disk**: `web/server/ws-bridge.ts:119,143` -- `pendingMessages` included in session persistence. Assessment: survives server restarts.

- **CLI keepalives silently consumed**: `web/server/ws-bridge.ts:361` -- `keep_alive` messages are handled with no action. Assessment: prevents them from being logged as unknown messages.

- **Unknown CLI message types forwarded silently**: `web/server/ws-bridge.ts:365-366` -- Default case in `routeCLIMessage` is a no-op. Assessment: future-proofs against new message types but provides no visibility.

- **Permission requests stored with timestamp**: `web/server/ws-bridge.ts:532` -- `timestamp: Date.now()` added to each permission request. Assessment: used for ordering in UI but no timeout enforcement.

- **No timeout on pending permissions**: All server-side code -- The CLI's 30-second tool permission timeout is documented in CLAUDE.md but not enforced by the bridge server. The server holds permissions indefinitely until the browser responds. Assessment: **if the browser never responds, the CLI side will time out and the pending permission will remain stale on the bridge**. The bridge does clear pending permissions on CLI disconnect (`handleCLIClose`, line 254-258).

- **Pending permissions cleared on CLI disconnect**: `web/server/ws-bridge.ts:254-258` -- All pending permissions are cancelled and `permission_cancelled` sent to browsers. Assessment: prevents stale permission state after CLI process death.

- **Permission response format**: `web/server/ws-bridge.ts:641-671` -- Allow sends `{ behavior: "allow", updatedInput, updatedPermissions }`. Deny sends `{ behavior: "deny", message }`. Both wrapped in `control_response` with `subtype: "success"`. Assessment: even denials use `subtype: "success"` (this is the Claude CLI protocol convention).

- **Interrupt sends `control_request` with `subtype: "interrupt"`**: `web/server/ws-bridge.ts:674-681` -- Uses a fresh `randomUUID()` as request_id. Assessment: allows the browser to interrupt CLI processing.

- **Model change via `set_model` control request**: `web/server/ws-bridge.ts:683-689` -- Forwarded to CLI as a control request. Assessment: allows runtime model switching.

- **Permission mode change via `set_permission_mode` control request**: `web/server/ws-bridge.ts:691-698` -- Forwarded to CLI. Assessment: allows switching between modes (e.g., `plan`, `acceptEdits`, `bypassPermissions`).

- **Context usage percentage computed from `modelUsage`**: `web/server/ws-bridge.ts:478-486` -- `(inputTokens + outputTokens) / contextWindow * 100`. Assessment: last model in the `modelUsage` map wins (iterates all values).

- **Compacting status derived from system status message**: `web/server/ws-bridge.ts:439` -- `is_compacting` set when `status === "compacting"`. Assessment: drives the "Compacting..." UI indicator.

- **Browser receives full message history on connect**: `web/server/ws-bridge.ts:276-280` -- `message_history` message sent with all stored messages. Assessment: allows browser to reconstruct conversation after page reload.

- **Browser reconnection with 2-second delay**: `web/src/ws.ts:404-415` -- `scheduleReconnect` uses `setTimeout(cb, 2000)`. Only reconnects if the session is still current or known. Assessment: simple fixed-delay reconnect with no exponential backoff.

- **Connection wait timeout: 10 seconds**: `web/src/ws.ts:448-452` -- `waitForConnection()` polls every 50ms with a 10-second timeout. Assessment: used during initial session creation flow.

- **Duplicate WebSocket prevention**: `web/src/ws.ts:373` -- `connectSession()` returns immediately if a socket already exists for the session. Assessment: prevents double connections.

- **Tool use ID deduplication**: `web/src/ws.ts:28-32` -- `processedToolUseIds` Set per session prevents duplicate task creation from replayed messages. Assessment: critical for history replay correctness.

---

## Business Logic

- **Three available Claude models**: `web/src/components/HomePage.tsx:31-34` -- `claude-opus-4-6`, `claude-sonnet-4-5-20250929`, `claude-haiku-4-5-20251001`. Assessment: hardcoded model list; must be updated when new models are released.

- **Two permission modes at session creation**: `web/src/components/HomePage.tsx:36-39` -- `bypassPermissions` (Agent) and `plan` (Plan). Assessment: the CLI supports more modes but only two are exposed in the UI.

- **Default model is Opus**: `web/src/components/HomePage.tsx:46` -- `useState(MODELS[0].value)` where MODELS[0] is Opus. Assessment: most expensive model as default.

- **Default mode is bypassPermissions (Agent)**: `web/src/components/HomePage.tsx:47` -- `useState(MODES[0].value)`. Assessment: most permissive mode as default.

- **Fallback model for auto-namer**: `web/server/index.ts:60` -- `info?.model || "claude-sonnet-4-5-20250929"`. Assessment: uses Sonnet as fallback if model unknown.

- **Auto-namer timeout: 15 seconds**: `web/server/auto-namer.ts:30` -- Default `timeoutMs` of 15000. Process is killed with SIGTERM on timeout. Assessment: prevents auto-naming from blocking indefinitely.

- **Session name generation: Adjective + Noun**: `web/src/utils/names.ts:15-19` -- 40 adjectives x 40 nouns = 1600 unique combinations. Up to 100 retries to avoid collisions. Assessment: collision risk grows as sessions accumulate; at ~40 active sessions, collisions become frequent.

- **Plan mode toggle via Shift+Tab**: `web/src/components/Composer.tsx:168-170,224-236` -- Toggles between `plan` and the previous mode (stored in `previousPermissionMode`). Assessment: falls back to `acceptEdits` if no previous mode stored.

- **Slash command autocomplete**: `web/src/components/Composer.tsx:65-73` -- Filters commands and skills from session data. Opens when text matches `/^\S*$/` and session has commands. Assessment: relies on CLI providing command list in `system.init`.

- **Task extraction from tool_use blocks**: `web/src/ws.ts:20-79` -- Intercepts `TodoWrite`, `TaskCreate`, and `TaskUpdate` tool calls to populate the task panel. `TodoWrite` replaces all tasks; `TaskCreate` appends; `TaskUpdate` patches. Assessment: tightly coupled to Claude Code's internal tool names.

- **Changed file tracking from Edit/Write tool calls**: `web/src/ws.ts:81-90` -- `Edit` and `Write` tool_use blocks with `file_path` input are tracked. Assessment: enables the editor's "changed files" indicator.

- **Worktree creation with unique branch names**: `web/server/git-utils.ts:241-246` -- When a worktree already exists for a branch, a new branch `{branch}-wt-{random4digit}` is created. Up to 100 random attempts, then falls back to timestamp. Assessment: supports multiple sessions on the same branch.

- **Worktree cleanup on archive/delete**: `web/server/routes.ts:411-440` -- Checks if other sessions use the worktree. If clean, auto-removes. If dirty, only force-removes if `force` flag set. Also deletes companion-managed branches (`-wt-N`). Assessment: prevents data loss from dirty worktrees.

- **Worktree guardrails injected as CLAUDE.md**: `web/server/cli-launcher.ts:282-338` -- A `CLAUDE.md` file is injected into the worktree's `.claude/` directory with rules preventing branch switching. Uses markers (`WORKTREE_GUARDRAILS_START/END`) for idempotent updates. Safety checks: never injects into main repo root, only into existing worktree paths. Assessment: creative approach to prevent Claude from switching branches in worktrees.

- **Default branch resolution priority**: `web/server/git-utils.ts:95-107` -- 1) `refs/remotes/origin/HEAD`, 2) check for `main`, 3) check for `master`, 4) fallback `main`. Assessment: standard heuristic.

- **Git fetch triggered when branch dropdown opens**: `web/src/components/HomePage.tsx:424-428` -- `api.gitFetch` called on dropdown open to refresh remote branches. Assessment: ensures fresh branch list but adds latency.

- **Sidebar polls sessions every 5 seconds**: `web/src/components/Sidebar.tsx:54-59` -- `setInterval(poll, 5000)`. Assessment: fixed polling interval; no WebSocket-based session list updates.

- **Session list sorted by creation time (newest first)**: `web/src/components/Sidebar.tsx:200` -- `.sort((a, b) => b.createdAt - a.createdAt)`. Assessment: natural ordering.

- **Experimental agent teams enabled globally**: `web/server/index.ts:1` -- `process.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = "1"` set unconditionally at server startup. Assessment: enables experimental feature for all sessions.

- **Editor auto-save with 800ms debounce**: `web/src/components/EditorPanel.tsx:254-263` -- Changes are auto-saved to server after 800ms of inactivity. Assessment: no confirmation before saving; could cause issues with rapid changes.

- **Selected environment persisted in localStorage**: `web/src/components/HomePage.tsx:54` -- `cc-selected-env` key. Assessment: remembers last-used environment across sessions.

- **Dark mode persistence**: `web/src/store.ts:124-129` -- `cc-dark-mode` in localStorage. Falls back to system preference (`prefers-color-scheme: dark`). Assessment: standard dark mode implementation.

- **Sidebar auto-open on desktop, closed on mobile**: `web/src/store.ts:149` -- `window.innerWidth >= 768`. Task panel threshold: `window.innerWidth >= 1024`. Assessment: responsive defaults.

- **CLI binary resolution**: `web/server/cli-launcher.ts:186-190` -- If binary doesn't start with `/`, resolves via `which`. Assessment: allows both absolute and PATH-relative binary specification.

- **Server port default: 3456**: `web/server/index.ts:21` -- `Number(process.env.PORT) || 3456`. Assessment: differs from CLAUDE.md which states 8765; the actual code uses 3456.

- **Playground accessible at `#/playground`**: `web/src/App.tsx:40-42` -- Hash-based routing for component playground. Assessment: development tool exposed in production builds.

---

## Undocumented Rules (logic with no comments or docs)

- **`web/server/index.ts:1`** -- `process.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = "1"` -- Enables experimental agent teams feature globally. Risk: removing this line silently disables multi-agent functionality; no documentation explains why this is needed or what it enables.

- **`web/server/ws-bridge.ts:316`** (`session_name_update` handler in `web/src/ws.ts:316`) -- Regex `/^[A-Z][a-z]+ [A-Z][a-z]+$/` determines if a session name is "auto-generated" (random Adj+Noun). Risk: any manually-set name matching this exact pattern (e.g., "Quick Start") will be overwritten by auto-naming.

- **`web/server/ws-bridge.ts:372-378`** -- The canonical session ID is always the launcher-assigned UUID, not the CLI's internal `session_id` from `system.init`. The CLI session ID is stored separately only for `--resume`. Risk: if this mapping is broken, `--resume` stops working and sessions start fresh after CLI restart.

- **`web/server/ws-bridge.ts:627-628`** -- `session_id` in user messages falls back to `msg.session_id || session.state.session_id || ""`. The empty string fallback means a message could be sent with no session context. Risk: the CLI might not associate the message with the correct conversation.

- **`web/server/cli-launcher.ts:265-268`** -- If a CLI process exits within 5000ms of a `--resume` launch, `cliSessionId` is cleared. Risk: changing this timeout could cause either infinite relaunch loops (too short) or unnecessary fresh starts (too long).

- **`web/server/ws-bridge.ts:439`** -- `is_compacting` is only set to true when `status === "compacting"`, but never explicitly set back to false. It relies on the implicit behavior that `status` changes to something else. Risk: if no follow-up status message arrives, `is_compacting` stays true indefinitely.

- **`web/server/ws-bridge.ts:479-486`** -- Context usage calculation iterates all model entries in `modelUsage` and the last one with `contextWindow > 0` overwrites previous values. Risk: in multi-model scenarios, the "wrong" model's context percentage could be displayed.

- **`web/server/session-store.ts:69`** -- `loadAll()` filters for files ending in `.json` but excludes `launcher.json`. Risk: any other non-session JSON file in the session directory would be parsed as a session and could crash the server.

- **`web/server/session-store.ts:42`** -- Debounce timer is 150ms. Risk: if the server crashes within 150ms of a state change, that state is lost. No "flush on shutdown" logic exists.

- **`web/server/git-utils.ts:228-234`** -- Worktree path uniqueness uses random 4-digit suffixes with up to 100 attempts, then falls back to `Date.now()`. Risk: in automated/test scenarios creating many worktrees rapidly, path collisions are possible though unlikely.

- **`web/server/git-utils.ts:82`** -- Worktree detection uses `gitDir.includes("/worktrees/")` (forward slash). Risk: on Windows, this check may fail since git could return backslash-separated paths.

- **`web/server/cli-launcher.ts:186`** -- `if (!binary.startsWith("/"))` uses forward-slash check for absolute path detection. Risk: on Windows, this will always try to `which` the binary even if an absolute Windows path (e.g., `C:\...`) is provided.

- **`web/server/routes.ts:180`** -- Directory listing hides entries starting with `.`. Risk: users cannot navigate to `.git`, `.env`, or `.vscode` directories through the folder picker, but these are still accessible via manual path entry or the `/api/fs/read` endpoint.

- **`web/src/ws.ts:93-95`** -- Message ID generation uses `Date.now()` + counter. Risk: after page reload, the counter resets to 0 and IDs could collide with previous session messages if they have identical timestamps.

- **`web/server/index.ts:19`** -- `process.env.__VIBE_PACKAGE_ROOT` is used to locate the `dist/` directory. This is set by `bin/cli.ts` for production but falls back to `resolve(__dirname, "..")` in dev. Risk: if the environment variable is incorrectly set, static file serving breaks silently.

- **`web/server/routes.ts:278`** -- Git diff command uses shell interpolation: `` `git diff HEAD -- "${absPath}"` ``. Risk: path traversal or injection if `absPath` contains shell metacharacters (mitigated by `resolve()` but not fully escaped).

- **`web/server/auto-namer.ts:3-13`** -- `resolvedBinary` is cached globally on first call. Risk: if the `claude` binary location changes during server uptime (e.g., after an update), the stale path is used until server restart.

- **`web/server/ws-bridge.ts:394-427`** -- Git info resolution on `system.init` uses synchronous `execSync` calls. Risk: blocks the event loop for up to 12 seconds (4 x 3000ms timeout) in the worst case. This happens on the WebSocket message handler path.

- **`web/src/store.ts:237-239`** -- When removing a session, if it is the current session, `currentSessionId` is set to null and `cc-current-session` is removed from localStorage. Risk: if another tab has the same session active, their state becomes stale.

- **`web/server/worktree-tracker.ts:54`** -- `addMapping()` removes any existing mapping for the same session ID before adding. Risk: if a session's worktree changes (theoretically shouldn't happen), the old mapping is silently replaced.
