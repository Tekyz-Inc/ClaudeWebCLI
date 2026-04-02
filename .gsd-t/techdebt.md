# Tech Debt Register -- 2026-04-01

## Summary
- Critical items: 0 (all resolved by M8/M9/M2.1)
- High priority: 5 (3 new)
- Medium priority: 10 (6 new)
- Low priority: 5 (1 new)
- Resolved: 16 items from previous register
- Total open: 20
- Total estimated effort: Medium (1-2 milestones)

### Delta from Previous Scan (2026-03-20)
| Change | Items |
|--------|-------|
| RESOLVED | TD-001 (command injection), TD-002 (filesystem access), TD-003 (no auth), TD-004 (sync I/O), TD-005 (monolithic files), TD-006 (code duplication), TD-007 (test regression), TD-008 (secrets exposed), TD-009 (temp dir), TD-010 (env injection), TD-011 (Windows paths), TD-014 (no validation), TD-015 (no CSP), TD-017 (no rate limiting), TD-018 (vite 0.0.0.0), TD-024 (96 test failures) |
| PARTIALLY RESOLVED | TD-001 -> TD-027 (env filter bypass), TD-003 -> TD-028 (WS auth not enforced) |
| STILL OPEN | TD-012 (no ErrorBoundary), TD-013 (empty catches), TD-016 (sidebar polling), TD-019 (unused deps), TD-022 (naming conventions), TD-023 (debounced persistence crash), TD-025 (dual polling -> merged into TD-016), TD-026 (STT worker TODO) |
| NEW | TD-027 through TD-040 |

---

## High Priority

### TD-027: Env Var Filter Bypass via options.env Override
- **Category**: security
- **Severity**: HIGH
- **Location**: `web/server/cli-launcher.ts:233-237`
- **Description**: `filterEnvVars()` removes dangerous keys, but the result is spread with `{ ...filteredBase, ...options.env }`. Client can re-inject filtered keys via session creation request.
- **Impact**: PATH, LD_PRELOAD, NODE_OPTIONS can be overridden by any client.
- **Remediation**: Apply `filterEnvVars()` AFTER merging options.env.
- **Effort**: small
- **Scan ref**: SEC-01

### TD-028: WebSocket Auth Not Enforced
- **Category**: security
- **Severity**: HIGH
- **Location**: `web/server/index.ts:87-110`
- **Description**: `auth.ts` exists with bearer token support, but WebSocket upgrade handlers do not call `validateToken()`. Any connection to WS endpoints is accepted without authentication.
- **Impact**: Bypasses M9 security hardening for the primary communication channel.
- **Remediation**: Call `validateToken()` during WebSocket upgrade, reject unauthenticated connections.
- **Effort**: small
- **Scan ref**: SEC-03

### TD-029: Terminal PTY cwd Not Path-Validated
- **Category**: security
- **Severity**: HIGH
- **Location**: `web/server/terminal-ws.ts:~30`
- **Description**: The `cwd` parameter for terminal PTY creation is NOT validated via `validatePath()`. A client can open a terminal in any directory.
- **Impact**: Terminal can be spawned in system directories, bypassing filesystem access controls.
- **Remediation**: Add `validatePath(cwd, cwd)` check before spawning PTY.
- **Effort**: small
- **Scan ref**: SEC-02

### TD-012: No React ErrorBoundary
- **Category**: quality
- **Severity**: HIGH (upgraded from MEDIUM)
- **Location**: `web/src/App.tsx`
- **Description**: No `ErrorBoundary` component in the React tree. An error in markdown rendering, tool input display, or CodeMirror crashes the entire app with a white screen.
- **Impact**: Complete application crash from a single component error. No recovery without page refresh.
- **Remediation**: Add ErrorBoundary at App level with fallback UI and "Reload" button.
- **Effort**: small
- **Scan ref**: QE-11

### TD-030: sendToSession() Silently Drops Messages
- **Category**: quality
- **Severity**: HIGH
- **Location**: `web/src/ws.ts:206-208`
- **Description**: When WebSocket is reconnecting (not OPEN), `sendToSession()` silently discards the message. The Composer clears, user sees no error.
- **Impact**: Lost user messages with no indication of failure.
- **Remediation**: Queue messages during reconnection, or show error toast when send fails.
- **Effort**: small
- **Scan ref**: QE-01

---

## Medium Priority

### TD-013: 40+ Empty Catch Blocks Across Codebase
- **Category**: quality
- **Severity**: MEDIUM
- **Location**: cli-launcher.ts (10), ws-bridge.ts (8), env-manager.ts (6), claude-sessions.ts (7), ws.ts (1), store/initial-state.ts (3), git-utils.ts (1)
- **Description**: 40+ catch blocks that silently swallow errors. Most dangerous: ws.ts:62 (malformed WS message dropped), cli-launcher.ts:174,178 (process kill failures), ws-bridge.ts:317 (NDJSON parse failure).
- **Impact**: Silent failures make debugging impossible. Phantom processes, lost data.
- **Remediation**: Add logging at minimum. For critical paths, propagate errors or take recovery action.
- **Effort**: medium
- **Scan ref**: QE-12

### TD-031: is_compacting Flag Never Explicitly Reset
- **Category**: quality
- **Severity**: MEDIUM
- **Location**: `web/server/ws-bridge.ts:515`
- **Description**: Set to `true` on `status === "compacting"` but never set to `false`. Relies on implicit status change. If CLI crashes during compaction, flag stays true forever.
- **Impact**: Permanent "Compacting..." UI state requiring manual recovery.
- **Remediation**: Reset on any non-compacting status, CLI disconnect, and result message.
- **Effort**: small
- **Scan ref**: QE-02

### TD-023: Debounced Persistence With No Flush-on-Shutdown
- **Category**: quality
- **Severity**: MEDIUM
- **Location**: `web/server/session-store.ts:35-43`
- **Description**: 150ms debounce means any state change within last 150ms before crash is lost. No `process.on('SIGTERM')` flush handler.
- **Impact**: Lost session state on server crash or forced restart.
- **Remediation**: Add `process.on('SIGTERM', () => flushAll())` for immediate write of pending state.
- **Effort**: small
- **Scan ref**: QE-06

### TD-032: Context Usage % Uses Wrong Model in Multi-Model Sessions
- **Category**: quality
- **Severity**: MEDIUM
- **Location**: `web/server/ws-bridge.ts:611-618`
- **Description**: Iterates all models in `modelUsage`, last one with `contextWindow > 0` wins. In multi-model sessions, displayed context % reflects arbitrary model.
- **Impact**: Incorrect context usage display.
- **Remediation**: Track active model and use its context window.
- **Effort**: small
- **Scan ref**: QE-03

### TD-016: Dual Polling Loops (Sidebar + Auto-Resume)
- **Category**: performance
- **Severity**: MEDIUM
- **Location**: `web/src/components/Sidebar.tsx` (5s) + `web/src/hooks/useAutoResumeSession.ts` (10s)
- **Description**: Two independent polling mechanisms create redundant API calls and potential race conditions.
- **Impact**: Unnecessary network traffic, potential session switching conflicts.
- **Remediation**: Consolidate into single polling mechanism or use WebSocket push.
- **Effort**: medium

### TD-033: Stall Detection Resends Without Checking CLI State
- **Category**: quality
- **Severity**: MEDIUM
- **Location**: `web/server/ws-bridge.ts:862-896`
- **Description**: Activity watchdog resends `lastUserNdjson` without verifying CLI socket is connected and OPEN.
- **Impact**: Silent failure of stall recovery, or potential crash.
- **Remediation**: Check `session.cliSocket?.readyState === WebSocket.OPEN` before resending.
- **Effort**: small
- **Scan ref**: QE-07

### TD-034: Rate Limiter Uses Spoofable X-Forwarded-For
- **Category**: security
- **Severity**: MEDIUM
- **Location**: `web/server/rate-limiter.ts`
- **Description**: IP extraction trusts `X-Forwarded-For`. Since server is localhost-only, all connections share one IP bucket anyway.
- **Impact**: Rate limiting is effectively useless.
- **Remediation**: Use connection source IP. Consider per-session rate limiting.
- **Effort**: small
- **Scan ref**: SEC-04

### TD-035: CSP Allows unsafe-inline for Scripts
- **Category**: security
- **Severity**: MEDIUM
- **Location**: `web/server/security-headers.ts`
- **Description**: `'unsafe-inline'` for scripts reduces XSS protection.
- **Remediation**: Use nonce-based or hash-based CSP for inline scripts.
- **Effort**: medium
- **Scan ref**: SEC-05

### TD-037: No unhandledRejection Handler
- **Category**: quality
- **Severity**: MEDIUM
- **Location**: `web/server/index.ts`
- **Description**: Only `uncaughtException` is handled. Unhandled promise rejections could crash the server.
- **Remediation**: Add `process.on('unhandledRejection', handler)`.
- **Effort**: small
- **Scan ref**: SEC-06, QE-13

### TD-022: Mixed Naming Conventions at Protocol Boundary
- **Category**: quality
- **Severity**: MEDIUM
- **Location**: `web/server/session-types.ts`
- **Description**: Protocol types mix snake_case (from CLI: `session_id`, `tool_use_id`) and camelCase (internal: `modelUsage`, `inputTokens`). Same data appears in both conventions.
- **Impact**: Confusing code, potential mapping bugs.
- **Remediation**: Normalize at protocol boundary with explicit mapping functions.
- **Effort**: medium

---

## Low Priority

### TD-014: Sidebar Shows Hardcoded Stale Version "v0.8.10"
- **Category**: quality
- **Severity**: LOW
- **Location**: `web/src/components/Sidebar.tsx:292`
- **Description**: Version string hardcoded as "v0.8.10", actual version is 0.14.11.
- **Remediation**: Import from package.json or a version constant.
- **Effort**: tiny
- **Scan ref**: QE-14

### TD-019: Unused Dependencies
- **Category**: quality
- **Severity**: LOW
- **Location**: `web/package.json`
- **Description**: `react-arborist`, `react-resizable-panels`, `autoprefixer`, `postcss` are unused.
- **Remediation**: Remove unused packages.
- **Effort**: tiny

### TD-026: STT Worker TODO
- **Category**: quality
- **Severity**: LOW
- **Location**: `web/src/utils/stt-component-worker.ts:8`
- **Description**: "TODO: Remove once @tekyzinc/stt-component ships the worker as a..."
- **Remediation**: Remove when upstream package ships built worker.
- **Effort**: tiny

### TD-036: 7 eslint-disable react-hooks/exhaustive-deps Suppressions
- **Category**: quality
- **Severity**: LOW
- **Location**: FolderPicker.tsx, HomePage.tsx, TerminalPanel.tsx, ProjectTabBar.tsx, useAutoResumeSession.ts, useDraftPersistence.ts, useSlashMenu.ts
- **Description**: Each suppression is a potential stale closure bug where effects capture outdated values.
- **Remediation**: Add missing dependencies or restructure effects.
- **Effort**: medium

### TD-038: ws-bridge.ts at 947 Lines (4.7x limit)
- **Category**: quality
- **Severity**: LOW (accepted as core complexity)
- **Location**: `web/server/ws-bridge.ts`
- **Description**: Despite M8 decomposition of other files, ws-bridge grew from 744 to 947 lines.
- **Remediation**: Extract handlers by message direction (CLI handlers, browser handlers, state management).
- **Effort**: large

---

## Contract Drift

### TD-039: API Contract Massively Outdated
- **Category**: documentation
- **Severity**: MEDIUM
- **Location**: `.gsd-t/contracts/api-contract.md`
- **Description**: Contract covers 2 of ~37 endpoints (5% coverage).
- **Remediation**: Rewrite with all endpoints, request/response schemas, and auth requirements.
- **Effort**: medium
- **Scan ref**: contract-drift.md

### TD-040: Store Contract Massively Outdated
- **Category**: documentation
- **Severity**: MEDIUM
- **Location**: `.gsd-t/contracts/store-contract.md`
- **Description**: Contract covers 2 of ~25 store slices (<5% coverage).
- **Remediation**: Rewrite with all slices, types, persistence, and ownership.
- **Effort**: medium
- **Scan ref**: contract-drift.md

---

## Resolved Items (from previous registers)

| ID | Title | Resolved By |
|----|-------|-------------|
| TD-001 | Command injection via shell interpolation | M8 (execFile) + M9 (validateBinary) |
| TD-002 | Unrestricted filesystem access | M9 (validatePath) |
| TD-003 | No authentication on any endpoint | M9 (auth.ts, CORS, 127.0.0.1) |
| TD-004 | Synchronous I/O blocks event loop | M8 (async migration) |
| TD-005 | Monolithic components exceed size limits | M8 (decomposition) |
| TD-006 | Code duplication Composer/HomePage | M8 (hook extraction) |
| TD-007 | Critical test coverage gaps | M8 (test repair) |
| TD-008 | Environment secrets exposed | M9 (secret masking) |
| TD-009 | Session data in temp directory | M9 (~/.companion/sessions/) |
| TD-010 | Dangerous env var injection | M9 (filterEnvVars) |
| TD-011 | Windows path compatibility | M2.1 (path normalization) |
| TD-014 | Missing request validation | M8 (Zod schemas) |
| TD-015 | No CSP or security headers | M9 (security-headers.ts) |
| TD-017 | No rate limiting | M9 (rate-limiter.ts) |
| TD-018 | Vite binds to 0.0.0.0 | M9 (127.0.0.1) |
| TD-024 | Massive test regression (96 failures) | M8 (test repair) |
