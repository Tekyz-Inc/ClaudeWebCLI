# Tech Debt Register — 2026-02-10

## Summary
- Critical items: 4
- High priority: 6
- Medium priority: 8
- Low priority: 5
- Total estimated effort: Large (multiple milestones)

---

## Critical Priority
Items that pose active risk or block progress.

### TD-001: Command Injection via Shell String Interpolation
- **Category**: security
- **Severity**: CRITICAL
- **Location**: `web/server/git-utils.ts`, `web/server/cli-launcher.ts:185-192`, `web/server/routes.ts:273-287`
- **Description**: All git operations use `execSync()` with string concatenation, allowing shell metacharacter injection. The `claudeBinary` parameter is passed unsanitized to `which`. The git diff route interpolates file paths into shell commands.
- **Impact**: Arbitrary command execution on the server via crafted branch names, file paths, or binary names.
- **Remediation**: Replace all `execSync()` with `execFileSync()` using array-based arguments. Validate `claudeBinary` against an allowlist. Sanitize all user-provided strings used in shell commands.
- **Effort**: medium
- **Milestone candidate**: YES — combine with TD-002 as "Security Hardening"
- **Promoted**: [ ]

### TD-002: Unrestricted Filesystem Access
- **Category**: security
- **Severity**: CRITICAL
- **Location**: `web/server/routes.ts:173-270`
- **Description**: `/api/fs/read`, `/api/fs/write`, `/api/fs/list`, and `/api/fs/tree` accept arbitrary paths with no restriction to session working directories. Any client can read/write any file the server process can access.
- **Impact**: Full filesystem read/write access from any browser on the network. Can read SSH keys, `.env` files, overwrite `.bashrc`, etc.
- **Remediation**: Validate all resolved paths are within the session's `cwd` or a configured allowlist. Reject paths outside boundaries.
- **Effort**: medium
- **Milestone candidate**: YES — combine with TD-001
- **Promoted**: [ ]

### TD-003: No Authentication on Any Endpoint
- **Category**: security
- **Severity**: CRITICAL
- **Location**: `web/server/index.ts`, `web/server/routes.ts`
- **Description**: Zero authentication on HTTP routes and WebSocket upgrades. No CORS restriction (wildcard). No WebSocket origin validation. Vite dev server binds to `0.0.0.0`, exposing everything to the local network.
- **Impact**: Any device on the local network has full access to create sessions, spawn CLI processes, read/write files, and manage environment secrets.
- **Remediation**: Add bearer token auth to API/WebSocket. Validate WebSocket Origin header. Restrict CORS to localhost origins. Bind to `127.0.0.1`.
- **Effort**: large
- **Milestone candidate**: YES — combine with TD-001, TD-002
- **Promoted**: [ ]

### TD-004: Synchronous I/O Blocks Event Loop During Request Handling
- **Category**: performance
- **Severity**: CRITICAL
- **Location**: `web/server/git-utils.ts`, `web/server/ws-bridge.ts:394-427`, `web/server/cli-launcher.ts:188`, `web/server/session-names.ts`, `web/server/env-manager.ts`, `web/server/worktree-tracker.ts`, `web/server/session-store.ts`
- **Description**: 7 server files use `execSync`, `readFileSync`, or `writeFileSync` during active request handling. `git-utils.ts` is worst — every function blocks the event loop. `ws-bridge.ts` blocks up to 12 seconds during session init for git info. This violates the explicit project rule: "NEVER use synchronous I/O in the server."
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
- **Location**: 18+ files over 200-line limit. Worst: `ws-bridge.ts` (743), `HomePage.tsx` (728), `Composer.tsx` (575), `Playground.tsx` (531), `PermissionBanner.tsx` (515), `EditorPanel.tsx` (491), `cli-launcher.ts` (491), `Sidebar.tsx` (488), `store.ts` (510+), `MessageFeed.tsx` (475), `ws.ts` (465+)
- **Description**: 18 files exceed the 200-line project limit. 27 functions exceed the 30-line limit. `handleMessage()` in `ws.ts` is 250 lines (single switch statement). React components like Composer, Sidebar, HomePage are 400-700 lines with no separation of concerns.
- **Impact**: Hard to maintain, test, and reason about. Contributes to test coverage gaps.
- **Remediation**: Extract handlers, hooks, and sub-components. Key targets: `ws.ts` handleMessage → per-type handlers, Composer/HomePage → shared hooks, ws-bridge.ts → separate handler modules.
- **Effort**: large
- **Milestone candidate**: YES — "Code Decomposition"
- **Promoted**: [ ]

### TD-006: Code Duplication Between Composer and HomePage
- **Category**: quality
- **Severity**: HIGH
- **Location**: `src/components/Composer.tsx` ↔ `src/components/HomePage.tsx`
- **Description**: ~130 lines of identical image handling, file reading, textarea resize, and slash command logic duplicated between these two components. Additional duplication: AssistantAvatar SVG (14 lines x2), ToolBlock diff rendering (~60 lines x2), context usage computation (8 lines x2). Total: ~285 duplicated lines across 7 clusters.
- **Impact**: Bug fixes must be applied in multiple places. Divergence creates inconsistent behavior.
- **Remediation**: Extract shared utilities: `useImageAttachments` hook, `useSlashCommands` hook, `AssistantAvatar` component, `ToolDiffDisplay` component.
- **Effort**: medium
- **Milestone candidate**: NO — fold into TD-005
- **Promoted**: [ ]

### TD-007: Critical Test Coverage Gaps
- **Category**: quality
- **Severity**: HIGH
- **Location**: `src/store.ts` (485 lines), `src/ws.ts` (461 lines), `src/components/Composer.tsx` (460 lines), `src/components/HomePage.tsx` (696 lines), `src/components/Sidebar.tsx` (488 lines)
- **Description**: 14 source files have no test coverage. The 5 highest-risk untested files total ~2,590 lines and form the core user interaction path (state management, WebSocket handling, session creation, input handling).
- **Impact**: Regressions go undetected in the most critical code paths.
- **Remediation**: Add test suites for `store.ts`, `ws.ts`, `Composer.tsx`, `HomePage.tsx`, `Sidebar.tsx`. Prioritize `store.ts` and `ws.ts` as they have the most logic.
- **Effort**: large
- **Milestone candidate**: YES — combine with TD-005 or standalone
- **Promoted**: [ ]

### TD-008: Environment Secrets Exposed in API Responses
- **Category**: security
- **Severity**: HIGH
- **Location**: `web/server/routes.ts:291-331`, `web/server/env-manager.ts`, `web/src/components/EnvManager.tsx`
- **Description**: `/api/envs` returns full environment variable values (API keys, passwords) in plaintext. The UI displays them unmasked. Combined with no auth (TD-003), any network client can read all stored secrets.
- **Remediation**: Mask secret values in API responses. Add reveal toggle in UI. After TD-003, auth will limit access.
- **Effort**: small
- **Milestone candidate**: NO — fold into security milestone
- **Promoted**: [ ]

### TD-009: Session Data in World-Readable Temp Directory
- **Category**: security
- **Severity**: HIGH
- **Location**: `web/server/session-store.ts:19`
- **Description**: Sessions (message history, tool inputs, pending permissions) stored as plain JSON in `$TMPDIR/vibe-sessions/`. Temp directories are world-readable on many systems and subject to OS cleanup.
- **Impact**: Session data (potentially containing secrets, code, conversation history) accessible to other processes. Data loss on reboot.
- **Remediation**: Move to `~/.companion/sessions/` with restricted permissions (0700). Consider encryption at rest.
- **Effort**: small
- **Milestone candidate**: NO — fold into security milestone
- **Promoted**: [ ]

### TD-010: Dangerous Environment Variable Injection
- **Category**: security
- **Severity**: HIGH
- **Location**: `web/server/cli-launcher.ts:233-237`
- **Description**: Custom environment variables from session creation are spread directly into CLI subprocess environment. A client can override `PATH`, `LD_PRELOAD`, `NODE_OPTIONS`, etc.
- **Impact**: Potential for privilege escalation or code execution via environment manipulation.
- **Remediation**: Validate env var keys against a denylist of dangerous variables or use an allowlist.
- **Effort**: small
- **Milestone candidate**: NO — fold into security milestone
- **Promoted**: [ ]

---

## Medium Priority
Items to plan for but not urgent.

### TD-011: Windows Path Compatibility Issues
- **Category**: quality
- **Severity**: MEDIUM
- **Location**: `web/server/git-utils.ts:82`, `web/server/cli-launcher.ts:186`, `web/server/git-utils.test.ts`
- **Description**: 5 test failures due to Windows path separators. Worktree detection uses hardcoded `/worktrees/` (forward slash). Binary resolution uses `startsWith("/")` for absolute path detection, fails on Windows.
- **Impact**: Tests fail on Windows. Worktree features may not work correctly on Windows.
- **Remediation**: Use `path.sep` or `path.join()` consistently. Fix test assertions to normalize paths.
- **Effort**: small
- **Milestone candidate**: NO — quick fix
- **Promoted**: [ ]

### TD-012: No React Error Boundary
- **Category**: quality
- **Severity**: MEDIUM
- **Location**: `web/src/App.tsx`
- **Description**: No `ErrorBoundary` component in the React tree. An unhandled error in any component crashes the entire application.
- **Impact**: Single component error takes down the whole UI.
- **Remediation**: Add ErrorBoundary at App level and around key sections (ChatView, Editor, Sidebar).
- **Effort**: small
- **Milestone candidate**: NO — quick fix
- **Promoted**: [ ]

### TD-013: Empty Catch Blocks / Swallowed Errors
- **Category**: quality
- **Severity**: MEDIUM
- **Location**: `ws-bridge.ts` (4 locations), `cli-launcher.ts` (3 locations), `Sidebar.tsx` (4 locations), `recent-dirs.ts`
- **Description**: 8+ empty catch blocks silently swallow errors. Inconsistent error handling between `api.ts` GET vs POST. WebSocket message parsing errors disappear.
- **Impact**: Silent failures make debugging difficult. Issues go unnoticed until they cascade.
- **Remediation**: Add meaningful error logging in catch blocks. Standardize api.ts error handling. Add structured error reporting.
- **Effort**: medium
- **Milestone candidate**: NO — fold into quality milestone
- **Promoted**: [ ]

### TD-014: Missing Request Validation (No Schema Validation)
- **Category**: quality
- **Severity**: MEDIUM
- **Location**: `web/server/routes.ts`
- **Description**: REST API does not validate request bodies with schema validation (e.g., Zod). Invalid payloads handled via optional chaining and defaults, leading to silent failures.
- **Impact**: Invalid requests produce unexpected behavior instead of clear errors.
- **Remediation**: Add Zod schemas for all request bodies. Return 400 with validation errors.
- **Effort**: medium
- **Milestone candidate**: NO — fold into quality milestone
- **Promoted**: [ ]

### TD-015: No Content-Security-Policy or Security Headers
- **Category**: security
- **Severity**: MEDIUM
- **Location**: `web/server/index.ts:73-83`
- **Description**: No CSP, X-Frame-Options, X-Content-Type-Options, or other security headers set. Static files served without security headers in production.
- **Impact**: Vulnerable to clickjacking, MIME type sniffing, and XSS from inline scripts.
- **Remediation**: Add security header middleware.
- **Effort**: small
- **Milestone candidate**: NO — fold into security milestone
- **Promoted**: [ ]

### TD-016: Sidebar Polls Every 5 Seconds
- **Category**: performance
- **Severity**: MEDIUM
- **Location**: `web/src/components/Sidebar.tsx:54-59`
- **Description**: Fixed 5-second polling interval for session list regardless of activity. Creates unnecessary network traffic.
- **Impact**: Wasted bandwidth and server load when nothing is changing.
- **Remediation**: Use WebSocket push notifications for session state changes, or implement long-polling / event-driven updates.
- **Effort**: medium
- **Milestone candidate**: NO — fold into performance milestone
- **Promoted**: [ ]

### TD-017: No Rate Limiting on Session Creation or WebSocket Connections
- **Category**: security
- **Severity**: MEDIUM
- **Location**: `web/server/routes.ts:19-91`, `web/server/index.ts:85-141`
- **Description**: No limits on session creation rate or concurrent WebSocket connections. An attacker can rapidly spawn CLI processes consuming system resources and API credits.
- **Impact**: Resource exhaustion, API cost explosion.
- **Remediation**: Add rate limiting (max sessions per minute) and hard cap on concurrent sessions.
- **Effort**: small
- **Milestone candidate**: NO — fold into security milestone
- **Promoted**: [ ]

### TD-018: No WebSocket Message Size Limits
- **Category**: security
- **Severity**: MEDIUM
- **Location**: `web/server/index.ts:115-141`
- **Description**: Bun WebSocket defaults to 16MB per message. No explicit `maxPayloadLength` configured.
- **Impact**: Memory exhaustion from oversized messages.
- **Remediation**: Set `maxPayloadLength` to 1MB.
- **Effort**: small
- **Milestone candidate**: NO — fold into security milestone
- **Promoted**: [ ]

---

## Low Priority
Nice-to-haves and cleanup.

### TD-019: 6 Unused Dependencies
- **Category**: dependency
- **Severity**: LOW
- **Location**: `web/package.json`
- **Description**: `@xterm/xterm`, `@xterm/addon-fit`, `react-arborist`, `react-resizable-panels`, `autoprefixer`, `postcss` are not imported anywhere.
- **Impact**: Bloated install size, potential security surface.
- **Remediation**: Remove from package.json.
- **Effort**: small
- **Milestone candidate**: NO — quick fix
- **Promoted**: [ ]

### TD-020: Outdated Major Dependencies
- **Category**: dependency
- **Severity**: LOW
- **Location**: `web/package.json`
- **Description**: `vite` (6.4.1 → 7.3.1) and `@vitejs/plugin-react` (4.7.0 → 5.1.4) are a major version behind.
- **Impact**: Missing features, potential security fixes.
- **Remediation**: Test and upgrade to latest major versions.
- **Effort**: medium
- **Milestone candidate**: NO — dependency sprint
- **Promoted**: [ ]

### TD-021: Playground Component in Production Build
- **Category**: quality
- **Severity**: LOW
- **Location**: `web/src/components/Playground.tsx` (531 lines)
- **Description**: Dev-only component with hardcoded mock data included in production builds. Accessible at `#/playground`.
- **Impact**: Unnecessary bundle size. Development tool exposed to users.
- **Remediation**: Lazy-load behind dev flag or remove from production builds.
- **Effort**: small
- **Milestone candidate**: NO — quick fix
- **Promoted**: [ ]

### TD-022: Mixed Case Conventions at Protocol Boundary
- **Category**: quality
- **Severity**: LOW
- **Location**: `web/server/session-types.ts`, `web/src/types.ts`
- **Description**: CLI protocol uses snake_case (`session_id`, `tool_use_id`) while internal code uses camelCase. The boundary is not clean — same data appears in both conventions.
- **Impact**: Confusion about which convention to use. Potential mapping bugs.
- **Remediation**: Add explicit mapping layer at the protocol boundary.
- **Effort**: medium
- **Milestone candidate**: NO
- **Promoted**: [ ]

### TD-023: Debounced Persistence Can Lose Data on Crash
- **Category**: quality
- **Severity**: LOW
- **Location**: `web/server/session-store.ts:42`
- **Description**: 150ms debounce with no flush-on-shutdown. If server crashes within debounce window, state is lost.
- **Impact**: Potential loss of most recent session state changes.
- **Remediation**: Add process signal handler to flush pending writes on shutdown.
- **Effort**: small
- **Milestone candidate**: NO — quick fix
- **Promoted**: [ ]

---

## Dependency Updates
| Package | Current | Latest | Breaking? | Priority |
|---------|---------|--------|-----------|----------|
| vite | 6.4.1 | 7.3.1 | yes | low |
| @vitejs/plugin-react | 4.7.0 | 5.1.4 | yes | low |
| @xterm/xterm | installed | - | n/a (unused) | remove |
| @xterm/addon-fit | installed | - | n/a (unused) | remove |
| react-arborist | installed | - | n/a (unused) | remove |
| react-resizable-panels | installed | - | n/a (unused) | remove |
| autoprefixer | installed | - | n/a (unused) | remove |
| postcss | installed | - | n/a (unused) | remove |

---

## Suggested Tech Debt Milestones

### Suggested: Security Hardening (Critical)
Combines: TD-001, TD-002, TD-003, TD-008, TD-009, TD-010, TD-015, TD-017, TD-018
Estimated effort: Large
Should be prioritized: BEFORE next feature milestone

### Suggested: Async I/O Migration (Critical)
Combines: TD-004
Estimated effort: Large
Should be prioritized: AFTER security hardening

### Suggested: Code Decomposition & Quality (High)
Combines: TD-005, TD-006, TD-007, TD-012, TD-013, TD-014
Estimated effort: Large
Can be scheduled: AFTER async I/O migration

### Suggested: Quick Wins (Low effort)
Combines: TD-011, TD-019, TD-021, TD-023
Estimated effort: Small
Can be scheduled: Any time (independent)

---

## Scan Metadata
- Scan date: 2026-02-10
- Files analyzed: ~40 source files + 20 test files
- Approximate lines of code: ~10,000 (source), ~5,000 (tests)
- Languages: TypeScript
- Runtime: Bun
- Framework: Hono (server), React 19 (client)
- Tests: 517 pass, 5 fail (Windows path issues)
- Typecheck: PASS (zero errors)
- Last scan: first scan
