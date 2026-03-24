# Tech Debt Register — 2026-03-20

## Summary
- Critical items: 4 (unchanged from last scan)
- High priority: 7 (+1 new: TD-024)
- Medium priority: 9 (+1 new: TD-025)
- Low priority: 5 (unchanged)
- New items since last scan: 3 (TD-024, TD-025, TD-026)
- Resolved since last scan: 0
- Total: 27
- Total estimated effort: Large (multiple milestones)

### Delta from Previous Scan (2026-02-10)
| Change | Items |
|--------|-------|
| NEW    | TD-024 (massive test regression), TD-025 (Sidebar native session polling), TD-026 (stt-component worker TODO) |
| WORSE  | TD-005 (file sizes grew: ws-bridge 743→930, store 510→776, ws 465→615), TD-007 (test failures: 5→96), TD-019 (xterm deps now used — no longer unused) |
| BETTER | TD-019 partially resolved (@xterm/xterm and @xterm/addon-fit now used by TerminalPanel.tsx) |
| PROMOTED | TD-011 already promoted to Milestone 2.1 |

---

## Critical Priority
Items that pose active risk or block progress.

### TD-001: Command Injection via Shell String Interpolation
- **Category**: security
- **Severity**: CRITICAL
- **Location**: `web/server/git-utils.ts:57`, `web/server/cli-launcher.ts:209`, `web/server/routes.ts:374,516`, `web/server/ws-bridge.ts:504-527`, `web/server/auto-namer.ts:9`
- **Description**: All git operations use `execSync()` with string concatenation, allowing shell metacharacter injection. The `claudeBinary` parameter is passed unsanitized to `where`/`which`. The git diff route interpolates file paths into shell commands. ws-bridge.ts runs 4 execSync calls during session init with unsanitized cwd.
- **Impact**: Arbitrary command execution on the server via crafted branch names, file paths, or binary names.
- **Remediation**: Replace all `execSync()` with `execFileSync()` using array-based arguments. Validate `claudeBinary` against an allowlist. Sanitize all user-provided strings used in shell commands.
- **Effort**: medium
- **Milestone candidate**: YES — combine with TD-002 as "Security Hardening"
- **Promoted**: [ ]

### TD-002: Unrestricted Filesystem Access
- **Category**: security
- **Severity**: CRITICAL
- **Location**: `web/server/routes.ts:269-366`
- **Description**: `/api/fs/list`, `/api/fs/tree`, `/api/fs/read`, `/api/fs/write` accept arbitrary paths with no restriction to session working directories. Any client can read/write any file the server process can access.
- **Impact**: Full filesystem read/write access from any browser on the network. Can read SSH keys, `.env` files, overwrite `.bashrc`, etc.
- **Remediation**: Validate all resolved paths are within the session's `cwd` or a configured allowlist. Reject paths outside boundaries.
- **Effort**: medium
- **Milestone candidate**: YES — combine with TD-001
- **Promoted**: [ ]

### TD-003: No Authentication on Any Endpoint
- **Category**: security
- **Severity**: CRITICAL
- **Location**: `web/server/index.ts:115,127`, `web/server/routes.ts`, `web/vite.config.ts:15`
- **Description**: Zero authentication on HTTP routes and WebSocket upgrades. Wildcard CORS (`cors()` with no origin restriction at index.ts:115). No WebSocket origin validation. Both Vite dev server (vite.config.ts:15) and Bun server (index.ts:127) bind to `0.0.0.0`, exposing everything to the local network.
- **Impact**: Any device on the local network has full access to create sessions, spawn CLI processes, read/write files, and manage environment secrets.
- **Remediation**: Add bearer token auth to API/WebSocket. Validate WebSocket Origin header. Restrict CORS to localhost origins. Bind to `127.0.0.1`.
- **Effort**: large
- **Milestone candidate**: YES — combine with TD-001, TD-002
- **Promoted**: [ ]

### TD-004: Synchronous I/O Blocks Event Loop During Request Handling
- **Category**: performance
- **Severity**: CRITICAL
- **Location**: `web/server/git-utils.ts` (all functions), `web/server/ws-bridge.ts:504-527` (4 execSync in session init), `web/server/cli-launcher.ts:209,351-362` (binary resolution + file I/O), `web/server/session-names.ts:24,35`, `web/server/env-manager.ts:55,71,99,133`, `web/server/worktree-tracker.ts:38,49`, `web/server/session-store.ts:49,58,72,110,119`, `web/server/auto-namer.ts:9`
- **Description**: 8 server files use `execSync`, `readFileSync`, or `writeFileSync` during active request handling. Count: git-utils.ts (every function), ws-bridge.ts (4 calls during init), cli-launcher.ts (2), session-store.ts (5), env-manager.ts (4), session-names.ts (2), worktree-tracker.ts (2), auto-namer.ts (1). Total: ~20+ synchronous I/O calls in the server. This violates the explicit project rule: "NEVER use synchronous I/O in the server."
- **Impact**: A slow git operation or filesystem access blocks ALL sessions. Single-process architecture means one slow request degrades the entire server.
- **Remediation**: Replace `execSync` with `execFile` (async). Replace `readFileSync`/`writeFileSync` with `readFile`/`writeFile`. Prioritize `git-utils.ts` and `ws-bridge.ts` first as they handle active requests.
- **Effort**: large
- **Milestone candidate**: YES — standalone "Async I/O Migration"
- **Promoted**: [ ]

---

## High Priority
Items that should be addressed in the next 1-2 milestones.

### TD-005: Monolithic Components Exceed Size Limits
- **Category**: quality
- **Severity**: HIGH
- **Location**: 22+ files over 200-line limit (up from 18 at last scan)
- **Description**: Worst offenders (source files only, lines): `ws-bridge.ts` (930), `store.ts` (776), `HomePage.tsx` (692), `Sidebar.tsx` (678), `Composer.tsx` (653), `ws.ts` (615), `cli-launcher.ts` (562), `routes.ts` (561), `Playground.tsx` (530), `PermissionBanner.tsx` (514), `EditorPanel.tsx` (469), `MessageFeed.tsx` (455), `MessageBubble.tsx` (386), `git-utils.ts` (372), `TaskPanel.tsx` (349), `ProjectTabBar.tsx` (295), `EnvManager.tsx` (292), `use-voice-input.ts` (268), `DiffView.tsx` (250), `ToolBlock.tsx` (247), `session-types.ts` (239), `index.ts` (232), `api.ts` (230), `claude-sessions.ts` (224). Files have grown since last scan (ws-bridge +187, store +266, ws +150).
- **Impact**: Hard to maintain, test, and reason about. Contributes to test coverage gaps and test breakage.
- **Remediation**: Extract handlers, hooks, and sub-components. Key targets: `ws.ts` handleMessage → per-type handlers, `store.ts` → split into slice files, `ws-bridge.ts` → separate handler modules, React components → sub-components + hooks.
- **Effort**: large
- **Milestone candidate**: YES — "Code Decomposition"
- **Promoted**: [ ]

### TD-006: Code Duplication Between Composer and HomePage
- **Category**: quality
- **Severity**: HIGH
- **Location**: `src/components/Composer.tsx` ↔ `src/components/HomePage.tsx`
- **Description**: `readFileAsBase64` function duplicated verbatim (both files). Identical image handling, textarea resize, and drag-drop patterns. Total: ~200+ duplicated lines across multiple clusters.
- **Impact**: Bug fixes must be applied in multiple places. Divergence creates inconsistent behavior.
- **Remediation**: Extract shared utilities: `readFileAsBase64` to a utils module, `useImageAttachments` hook, shared drag-drop handler.
- **Effort**: medium
- **Milestone candidate**: NO — fold into TD-005
- **Promoted**: [ ]

### TD-007: Critical Test Coverage Gaps and Regression
- **Category**: quality
- **Severity**: HIGH → **ESCALATED**
- **Location**: Multiple test files
- **Description**: Tests have regressed significantly since last scan. Previous: 517 pass / 5 fail. Current: 496 pass / 96 fail across 11 test files. Failing files: `ws.test.ts` (22/31 fail), `Sidebar.test.tsx` (26/30 fail), `Composer.test.tsx` (19/19 fail), `ToolBlock.test.tsx` (8/47 fail), `MessageFeed.test.tsx` (6/17 fail), `git-utils.test.ts` (5/39 fail), `auto-namer.test.ts` (4/12 fail), `EditorPanel.test.tsx` (2/9 fail), `cli-launcher.test.ts` (2/48 fail), `routes.test.ts` (1/34 fail), `MessageBubble.test.tsx` (1/18 fail). Tests are out of sync with source code changes made during ad-hoc polishing (v0.9-v0.12).
- **Impact**: Test suite is unreliable. 96 failing tests mask real regressions. No confidence in code correctness.
- **Remediation**: Fix all 96 failing tests as a priority. Tests broke because source files were modified without updating corresponding tests. Key: ws.test.ts (store/type changes), Sidebar.test.tsx (native sessions + layout changes), Composer.test.tsx (draft/slash command changes).
- **Effort**: large
- **Milestone candidate**: YES — URGENT standalone or combine with TD-005
- **Promoted**: [ ]

### TD-008: Environment Secrets Exposed in API Responses
- **Category**: security
- **Severity**: HIGH
- **Location**: `web/server/routes.ts:387-425`, `web/server/env-manager.ts`, `web/src/components/EnvManager.tsx`
- **Description**: `/api/envs` returns full environment variable values (API keys, passwords) in plaintext. The UI displays them unmasked. Combined with no auth (TD-003), any network client can read all stored secrets.
- **Remediation**: Mask secret values in API responses. Add reveal toggle in UI. After TD-003, auth will limit access.
- **Effort**: small
- **Milestone candidate**: NO — fold into security milestone
- **Promoted**: [ ]

### TD-009: Session Data in World-Readable Temp Directory
- **Category**: security
- **Severity**: HIGH
- **Location**: `web/server/session-store.ts`
- **Description**: Sessions (message history, tool inputs, pending permissions) stored as plain JSON in `$TMPDIR/vibe-sessions/`. Temp directories are world-readable on many systems and subject to OS cleanup.
- **Impact**: Session data (potentially containing secrets, code, conversation history) accessible to other processes. Data loss on reboot.
- **Remediation**: Move to `~/.companion/sessions/` with restricted permissions (0700). Consider encryption at rest.
- **Effort**: small
- **Milestone candidate**: NO — fold into security milestone
- **Promoted**: [ ]

### TD-010: Dangerous Environment Variable Injection
- **Category**: security
- **Severity**: HIGH
- **Location**: `web/server/cli-launcher.ts`
- **Description**: Custom environment variables from session creation are spread directly into CLI subprocess environment. A client can override `PATH`, `LD_PRELOAD`, `NODE_OPTIONS`, etc.
- **Impact**: Potential for privilege escalation or code execution via environment manipulation.
- **Remediation**: Validate env var keys against a denylist of dangerous variables or use an allowlist.
- **Effort**: small
- **Milestone candidate**: NO — fold into security milestone
- **Promoted**: [ ]

### TD-024: Massive Test Suite Regression (96 failures) **[NEW]**
- **Category**: quality
- **Severity**: HIGH
- **Location**: 11 test files across server and client
- **Description**: Between v0.8.10 and v0.12.10, ad-hoc polishing commits modified source files without updating corresponding tests. Result: 96 test failures (up from 5). Breakdown by root cause: (1) Store shape changes (new fields, renamed actions) broke ws.test.ts, Sidebar.test.tsx, Composer.test.tsx. (2) Component prop/structure changes broke ToolBlock, MessageFeed, MessageBubble, EditorPanel tests. (3) CLI launcher spawn changes broke cli-launcher.test.ts, auto-namer.test.ts. (4) Pre-existing Windows path failures in git-utils.test.ts (5 failures, unchanged).
- **Impact**: Test suite is unreliable — cannot catch regressions. Blocks CI/CD pipeline. Pre-commit hooks may be skipped.
- **Remediation**: Systematic test repair pass: update mocks to match current store shape, update component test expectations to match current DOM, fix spawn mocking for new CLI launcher patterns.
- **Effort**: medium
- **Milestone candidate**: YES — URGENT, should be first priority
- **Promoted**: [ ]

---

## Medium Priority
Items to plan for but not urgent.

### TD-011: Windows Path Compatibility Issues
- **Category**: quality
- **Severity**: MEDIUM
- **Location**: `web/server/git-utils.ts:82`, `web/server/cli-launcher.ts`, `web/server/git-utils.test.ts`
- **Description**: 5 test failures due to Windows path separators. Worktree detection uses hardcoded `/worktrees/` (forward slash). Binary resolution uses `startsWith("/")` for absolute path detection, fails on Windows.
- **Impact**: Tests fail on Windows. Worktree features may not work correctly on Windows.
- **Remediation**: Use `path.sep` or `path.join()` consistently. Fix test assertions to normalize paths.
- **Effort**: small
- **Milestone candidate**: YES — promoted
- **Promoted**: [x] — Milestone 2.1: Fix Windows Path Test Failures

### TD-012: No React Error Boundary
- **Category**: quality
- **Severity**: MEDIUM
- **Location**: `web/src/App.tsx`
- **Description**: No `ErrorBoundary` component in the React tree. An unhandled error in any component crashes the entire application. Confirmed: grep for "ErrorBoundary" in src/ returns zero results.
- **Impact**: Single component error takes down the whole UI.
- **Remediation**: Add ErrorBoundary at App level and around key sections (ChatView, Editor, Sidebar).
- **Effort**: small
- **Milestone candidate**: NO — quick fix
- **Promoted**: [ ]

### TD-013: Empty Catch Blocks / Swallowed Errors
- **Category**: quality
- **Severity**: MEDIUM
- **Location**: `web/server/ws-bridge.ts:900`, `web/server/cli-launcher.ts:365`, `web/server/session-store.ts:50,111`, `web/src/utils/whisper-worker.ts:45`
- **Description**: While no truly empty catch blocks remain (improved from last scan), several catch blocks log but don't propagate errors. `whisper-worker.ts:45` catches WebGPU errors with only a comment. Routes use `.catch(() => ({}))` on JSON parsing which swallows malformed request bodies silently (routes.ts lines 21, 208, 248, 354, 402, 413, 482, 494, 502, 509).
- **Impact**: Silent failures make debugging difficult. Malformed requests get default empty objects instead of 400 errors.
- **Remediation**: Add proper error responses for JSON parse failures. Propagate errors where appropriate.
- **Effort**: medium
- **Milestone candidate**: NO — fold into quality milestone
- **Promoted**: [ ]

### TD-014: Missing Request Validation (No Schema Validation)
- **Category**: quality
- **Severity**: MEDIUM
- **Location**: `web/server/routes.ts`
- **Description**: REST API does not validate request bodies with schema validation (e.g., Zod). Invalid payloads handled via optional chaining and defaults, leading to silent failures. 10+ routes use `.catch(() => ({}))` for JSON body parsing.
- **Impact**: Invalid requests produce unexpected behavior instead of clear errors.
- **Remediation**: Add Zod schemas for all request bodies. Return 400 with validation errors.
- **Effort**: medium
- **Milestone candidate**: NO — fold into quality milestone
- **Promoted**: [ ]

### TD-015: No Content-Security-Policy or Security Headers
- **Category**: security
- **Severity**: MEDIUM
- **Location**: `web/server/index.ts:119` (production static serving)
- **Description**: No CSP, X-Frame-Options, X-Content-Type-Options, or other security headers set. Static files served without security headers in production.
- **Impact**: Vulnerable to clickjacking, MIME type sniffing, and XSS from inline scripts.
- **Remediation**: Add security header middleware.
- **Effort**: small
- **Milestone candidate**: NO — fold into security milestone
- **Promoted**: [ ]

### TD-016: Sidebar Polls Every 5 Seconds
- **Category**: performance
- **Severity**: MEDIUM
- **Location**: `web/src/components/Sidebar.tsx`
- **Description**: Fixed 5-second polling interval for session list regardless of activity. Creates unnecessary network traffic. Additionally, native session list polls every 10 seconds (new since last scan).
- **Impact**: Wasted bandwidth and server load when nothing is changing.
- **Remediation**: Use WebSocket push notifications for session state changes, or implement long-polling / event-driven updates.
- **Effort**: medium
- **Milestone candidate**: NO — fold into performance milestone
- **Promoted**: [ ]

### TD-017: No Rate Limiting on Session Creation or WebSocket Connections
- **Category**: security
- **Severity**: MEDIUM
- **Location**: `web/server/routes.ts:20-91`, `web/server/index.ts`
- **Description**: No limits on session creation rate or concurrent WebSocket connections. An attacker can rapidly spawn CLI processes consuming system resources and API credits.
- **Impact**: Resource exhaustion, API cost explosion.
- **Remediation**: Add rate limiting (max sessions per minute) and hard cap on concurrent sessions.
- **Effort**: small
- **Milestone candidate**: NO — fold into security milestone
- **Promoted**: [ ]

### TD-018: No WebSocket Message Size Limits
- **Category**: security
- **Severity**: MEDIUM
- **Location**: `web/server/index.ts`
- **Description**: Bun WebSocket defaults to 16MB per message. No explicit `maxPayloadLength` configured.
- **Impact**: Memory exhaustion from oversized messages.
- **Remediation**: Set `maxPayloadLength` to 1MB.
- **Effort**: small
- **Milestone candidate**: NO — fold into security milestone
- **Promoted**: [ ]

### TD-025: Native Session Polling Adds Second Polling Loop **[NEW]**
- **Category**: performance
- **Severity**: MEDIUM
- **Location**: `web/src/components/Sidebar.tsx`
- **Description**: Since Milestone 7 (Session Resume List), Sidebar now has TWO independent polling loops: (1) session list every 5s (existing TD-016), (2) native CLI sessions via `GET /api/claude-sessions` every 10s. Both fire regardless of whether the user is actively using the sidebar.
- **Impact**: Doubles the polling overhead. Two independent intervals can cause race conditions in state updates.
- **Remediation**: Consolidate both polls into a single interval, or migrate both to WebSocket push.
- **Effort**: small
- **Milestone candidate**: NO — fold into TD-016
- **Promoted**: [ ]

---

## Low Priority
Nice-to-haves and cleanup.

### TD-019: 4 Unused Dependencies (updated from 6)
- **Category**: dependency
- **Severity**: LOW
- **Location**: `web/package.json`
- **Description**: `react-arborist`, `react-resizable-panels`, `autoprefixer`, `postcss` are not imported anywhere. Note: `@xterm/xterm` and `@xterm/addon-fit` are NOW used by `TerminalPanel.tsx` (resolved since last scan).
- **Impact**: Bloated install size, potential security surface.
- **Remediation**: Remove 4 unused packages from package.json.
- **Effort**: small
- **Milestone candidate**: NO — quick fix
- **Promoted**: [ ]

### TD-020: Outdated Major Dependencies
- **Category**: dependency
- **Severity**: LOW
- **Location**: `web/package.json`
- **Description**: `vite` (^6.3.0 installed) and `@vitejs/plugin-react` (^4.4.0 installed) may have newer major versions available. Verify current latest before upgrading.
- **Impact**: Missing features, potential security fixes.
- **Remediation**: Test and upgrade to latest major versions.
- **Effort**: medium
- **Milestone candidate**: NO — dependency sprint
- **Promoted**: [ ]

### TD-021: Playground Component in Production Build
- **Category**: quality
- **Severity**: LOW
- **Location**: `web/src/components/Playground.tsx` (530 lines)
- **Description**: Dev-only component with hardcoded mock data included in production builds. Accessible at `#/playground`. Still 530 lines (no change).
- **Impact**: Unnecessary bundle size. Development tool exposed to users.
- **Remediation**: Lazy-load behind dev flag or remove from production builds.
- **Effort**: small
- **Milestone candidate**: NO — quick fix
- **Promoted**: [ ]

### TD-022: Mixed Case Conventions at Protocol Boundary
- **Category**: quality
- **Severity**: LOW
- **Location**: `web/server/session-types.ts` (239 lines), `web/src/types.ts`
- **Description**: CLI protocol uses snake_case (`session_id`, `tool_use_id`) while internal code uses camelCase. The boundary is not clean — same data appears in both conventions.
- **Impact**: Confusion about which convention to use. Potential mapping bugs.
- **Remediation**: Add explicit mapping layer at the protocol boundary.
- **Effort**: medium
- **Milestone candidate**: NO
- **Promoted**: [ ]

### TD-023: Debounced Persistence Can Lose Data on Crash
- **Category**: quality
- **Severity**: LOW
- **Location**: `web/server/session-store.ts`
- **Description**: 150ms debounce with no flush-on-shutdown. If server crashes within debounce window, state is lost.
- **Impact**: Potential loss of most recent session state changes.
- **Remediation**: Add process signal handler to flush pending writes on shutdown.
- **Effort**: small
- **Milestone candidate**: NO — quick fix
- **Promoted**: [ ]

### TD-026: STT Component Worker TODO **[NEW]**
- **Category**: quality
- **Severity**: LOW
- **Location**: `web/src/utils/stt-component-worker.ts:8`
- **Description**: Contains a TODO comment: "Remove once @tekyzinc/stt-component ships the worker as a separate file." This is a workaround for a third-party package limitation.
- **Impact**: Extra maintenance burden. Should be cleaned up when upstream package updates.
- **Remediation**: Monitor @tekyzinc/stt-component releases and remove workaround when worker is shipped separately.
- **Effort**: small
- **Milestone candidate**: NO — monitor
- **Promoted**: [ ]

---

## Dependency Updates
| Package                   | Current  | Status           | Priority |
|---------------------------|----------|------------------|----------|
| react-arborist            | ^3.4.3   | unused — remove  | remove   |
| react-resizable-panels    | ^4.6.2   | unused — remove  | remove   |
| autoprefixer              | ^10.4.21 | unused — remove  | remove   |
| postcss                   | ^8.5.3   | unused — remove  | remove   |
| vite                      | ^6.3.0   | check for major  | low      |
| @vitejs/plugin-react      | ^4.4.0   | check for major  | low      |

---

## Suggested Tech Debt Milestones

### Suggested: Test Suite Repair (URGENT)
Combines: TD-024, TD-007
Estimated effort: Medium
Should be prioritized: IMMEDIATELY — before any feature work
Rationale: 96 failing tests make the test suite useless as a safety net.

### Suggested: Security Hardening (Critical)
Combines: TD-001, TD-002, TD-003, TD-008, TD-009, TD-010, TD-015, TD-017, TD-018
Estimated effort: Large
Should be prioritized: AFTER test repair

### Suggested: Async I/O Migration (Critical)
Combines: TD-004
Estimated effort: Large
Should be prioritized: AFTER security hardening

### Suggested: Code Decomposition & Quality (High)
Combines: TD-005, TD-006, TD-012, TD-013, TD-014
Estimated effort: Large
Can be scheduled: AFTER async I/O migration

### Suggested: Quick Wins (Low effort)
Combines: TD-019, TD-021, TD-023, TD-025
Estimated effort: Small
Can be scheduled: Any time (independent)

---

## Contract Compliance

### Contracts Inventory (10 files)
| Contract | Last Updated | Status |
|----------|-------------|--------|
| api-contract.md            | unknown | needs review — routes.ts has new endpoints since M7 |
| component-contract.md      | unknown | needs review — new components (CopyButton, tool-utils) |
| store-contract.md          | unknown | needs review — store grew from ~510 to 776 lines, many new fields |
| whisper-contract.md        | M3      | OK — voice pipeline stable |
| voice-mode-contract.md     | M5      | STALE — voice modes unified to single STTEngine in v0.6.0 |
| integration-points.md      | M1      | STALE — predates M2-M7 changes |
| integration-points-m2.md   | M2      | archived |
| integration-points-m4.md   | M4      | archived |
| integration-points-m5.md   | M5      | archived |
| integration-points-m7.md   | M7      | OK |

### Contract Drift
- `voice-mode-contract.md` references 3 voice modes (Original, Whisper, Full) — these were unified into a single STTEngine mode in v0.6.0. Contract is stale.
- `store-contract.md` likely missing new fields: `filesRead`, `commandsExecuted`, `agentSpawned`, `testExecuted`, `modelUsage`, `chatExpanded`, `activeProjectCwd`, `resumeNativeSession`.
- `api-contract.md` likely missing endpoints added since M7: `/api/claude-sessions/:id/activity`, `/api/slash-commands`.

---

## Scan Metadata
- Scan date: 2026-03-20
- Previous scan: 2026-02-10
- Files analyzed: 30 source files + 19 test files (49 total)
- Approximate lines of code: ~13,200 (source), ~11,000 (tests)
- Growth since last scan: +3,200 source lines, +6,000 test lines
- Languages: TypeScript
- Runtime: Bun
- Framework: Hono (server), React 19 (client)
- Tests: 496 pass, 96 fail (REGRESSION from 517/5)
- Typecheck: PASS (zero errors)
- Version: 0.12.10 (was 0.14.1-fork at first scan, now 0.12.10)
