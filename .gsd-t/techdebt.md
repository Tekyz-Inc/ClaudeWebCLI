# Tech Debt Register — 2026-04-10 (Scan #4)

## Summary
- Critical items: 0
- High priority: 0
- Medium priority: 8
- Low priority: 7
- Total open: 15
- Total estimated effort: Small-to-Medium (1 focused milestone covers most)
- Previous scan archive: `techdebt_2026-04-01.md`

### Delta from Previous Scan (2026-04-01)
| Change | Items |
|--------|-------|
| RESOLVED by M10 | TD-012 (no ErrorBoundary), TD-030 (silent message drops), TD-031 (is_compacting stuck), TD-037 (no unhandledRejection) |
| DOWNGRADED | TD-027 HIGH→MEDIUM, TD-028 HIGH→WONTFIX (intentional per index.ts:194 comment), TD-029 HIGH→MEDIUM — risk is confined to local-only threat model |
| STILL OPEN | TD-019, TD-022, TD-026, TD-027, TD-029, TD-032, TD-034, TD-035, TD-036, TD-038, TD-039, TD-040 |
| NEW | TD-041, TD-042, TD-043 |
| RESOLVED (M11) | TD-013, TD-014, TD-016, TD-023, TD-033, TD-044, TD-045 |
| WONTFIX per feedback memory | Security hardening items (CSP nonce, rate limiter IP, bearer token enforcement) — local-only app |

---

## Medium Priority
Items to plan for; address during next maintenance milestone.

### TD-027: Env Var Filter Bypass via options.env Override
- **Category**: security
- **Severity**: MEDIUM (downgraded from HIGH — local-only threat model)
- **Status**: OPEN
- **Location**: `web/server/cli-launcher.ts:320-324`
- **Description**: `filterEnvVars(baseEnvDefined)` scrubs dangerous env keys, but the result is immediately spread with `{ ...filteredBase, ...options.env }`. A malicious localhost origin can re-inject PATH/LD_PRELOAD/NODE_OPTIONS via session-create body.
- **Impact**: Client can override filtered keys in the spawned CLI environment.
- **Remediation**: Merge first, filter second — `filterEnvVars({...filteredBase, ...options.env})`.
- **Effort**: small (3 lines + test)
- **Milestone candidate**: YES — fold into a "Security polish + contract refresh" milestone
- **Promoted**: [ ]

### TD-029: Terminal PTY cwd Not Path-Validated
- **Category**: security
- **Severity**: MEDIUM (downgraded from HIGH — local-only)
- **Status**: OPEN
- **Location**: `web/server/terminal-ws.ts:30-43`
- **Description**: The `cwd` URL query param is passed straight to the Node.js PTY subprocess with no validation. Bypasses M9 filesystem access controls for shell access.
- **Impact**: Client can spawn shell in any directory the host user has access to.
- **Remediation**: `if (cwd) validatePath(cwd, cwd)` before spawning; reject bad paths.
- **Effort**: small
- **Milestone candidate**: YES — fold into security polish
- **Promoted**: [ ]

### TD-013: ~78 Empty Catch Blocks Across 28 Files
- **Category**: quality
- **Severity**: MEDIUM
- **Status**: [RESOLVED] — M11 Quality Pass (hot-path files annotated/logged: cli-launcher, ws-bridge, session-store, claude-sessions, env-manager, terminal-ws, filesystem-routes, Sidebar, ws.ts)
- **Location**: cli-launcher.ts (11), ws-bridge.ts (8), session-store.ts (7), claude-sessions.ts (7), env-manager.ts (6), Sidebar.tsx (5), terminal-ws.ts (5), filesystem-routes.ts (10), plus 20 other files
- **Description**: Empty or near-empty catch blocks silently swallow errors. Most dangerous: ws.ts:62 (malformed WS message), cli-launcher.ts:174,178 (process kill failures), ws-bridge.ts:317 (NDJSON parse).
- **Impact**: Silent failures make debugging impossible. Some are intentional (JSONL line parsing expects malformed lines); most are not.
- **Remediation**: (a) Categorize: expected-malformed (keep silent with comment) vs unexpected (add log). (b) Add `console.warn` to all currently empty catches. (c) For critical paths (process kill, session persistence), surface to UI or restart logic.
- **Effort**: medium
- **Milestone candidate**: YES — fold into quality pass
- **Promoted**: [x] — Milestone 11: Quality Pass

### TD-016: Three Independent Polling Loops
- **Category**: performance
- **Severity**: MEDIUM
- **Status**: [RESOLVED] — M11 Quality Pass (shared `usePollingTick` hook, single 5s timer)
- **Location**: `Sidebar.tsx` (5s) + `useAutoResumeSession.ts` (10s) + `useNativeSessionPoll.ts`
- **Description**: Three independent polling mechanisms hit the session/claude-session APIs on their own timers.
- **Impact**: Redundant network traffic; potential race conditions on rapid tab switches.
- **Remediation**: Consolidate into a single shared hook, or switch to WebSocket push for session list updates.
- **Effort**: medium
- **Milestone candidate**: YES — quality pass
- **Promoted**: [x] — Milestone 11: Quality Pass

### TD-023: Debounced Persistence With No Flush-on-Shutdown
- **Category**: quality
- **Severity**: MEDIUM
- **Status**: [RESOLVED] — M11 Quality Pass (session-store `flushAll` + SIGTERM/SIGINT handlers)
- **Location**: `web/server/session-store.ts:35-43`
- **Description**: 150ms debounce means state changes within that window are lost on crash/kill. No SIGTERM/SIGINT flush handler.
- **Remediation**: `process.on('SIGTERM', () => flushAll()); process.on('SIGINT', () => flushAll())`.
- **Effort**: small
- **Milestone candidate**: YES — quality pass
- **Promoted**: [x] — Milestone 11: Quality Pass

### TD-033: Stall Detection Resends Without Socket State Check
- **Category**: quality
- **Severity**: MEDIUM
- **Status**: [RESOLVED] — M11 Quality Pass (readyState guard + relaunch trigger in handleResultMessage)
- **Location**: `web/server/ws-bridge.ts:862-896`
- **Description**: Stall watchdog resends `lastUserNdjson` without verifying `session.cliSocket?.readyState === WebSocket.OPEN`.
- **Impact**: Silent no-op at best; exception at worst.
- **Remediation**: Guard with readyState check; if not OPEN, mark session for relaunch instead.
- **Effort**: small
- **Milestone candidate**: YES — quality pass
- **Promoted**: [x] — Milestone 11: Quality Pass

### TD-039: API Contract at 6% Coverage
- **Category**: documentation
- **Severity**: MEDIUM
- **Status**: OPEN (grew — now 36 total endpoints, 2 documented)
- **Location**: `.gsd-t/contracts/api-contract.md`
- **Description**: Covers 2 of 33 HTTP endpoints + 3 WebSocket endpoints (36 total). Violates CLAUDE.md Pre-Commit Gate ("Did I create or change an API endpoint?").
- **Remediation**: Rewrite as a complete endpoint reference — table with method, path, request schema (from Zod), response shape, auth, owner. One pass.
- **Effort**: medium
- **Milestone candidate**: YES — contract refresh
- **Promoted**: [x] — Milestone 12: Contract Refresh

### TD-040: Store Contract at ~10% Coverage
- **Category**: documentation
- **Severity**: MEDIUM
- **Status**: OPEN
- **Location**: `.gsd-t/contracts/store-contract.md`
- **Description**: Covers 2 slices of ~25 actions in current store. ~90% drift.
- **Remediation**: Rewrite from current `store.ts` and `store/types.ts`.
- **Effort**: medium
- **Milestone candidate**: YES — contract refresh
- **Promoted**: [x] — Milestone 12: Contract Refresh

---

## Low Priority
Nice-to-haves and cleanup.

### TD-014: Sidebar Shows Hardcoded Stale Version "v0.8.10"
- **Category**: quality
- **Severity**: LOW
- **Status**: [RESOLVED] — M11 Quality Pass (Vite `__APP_VERSION__` define sourced from package.json)
- **Location**: `web/src/components/Sidebar.tsx:~292`
- **Description**: Version string hardcoded as "v0.8.10"; actual is 0.14.10.
- **Remediation**: Import from `package.json` via Vite define, or add a version constant.
- **Effort**: tiny
- **Promoted**: [x] — Milestone 11: Quality Pass

### TD-019: Unused Dependencies
- **Category**: quality
- **Severity**: LOW
- **Status**: OPEN
- **Location**: `web/package.json`
- **Description**: `react-arborist`, `react-resizable-panels`, `autoprefixer`, `postcss` unused.
- **Remediation**: Remove.
- **Effort**: tiny
- **Promoted**: [ ]

### TD-022: Mixed Naming Conventions at Protocol Boundary
- **Category**: quality
- **Severity**: LOW (accepted as protocol hygiene)
- **Status**: OPEN
- **Location**: `web/server/session-types.ts`
- **Description**: Protocol types mix snake_case (CLI side: `session_id`, `tool_use_id`) and camelCase (internal: `modelUsage`, `inputTokens`). Same data in both conventions.
- **Remediation**: Normalize at protocol boundary with explicit mapper functions. Non-trivial due to widespread usage.
- **Effort**: medium
- **Promoted**: [ ]

### TD-026: STT Worker TODO
- **Category**: quality
- **Severity**: LOW
- **Status**: OPEN
- **Location**: `web/src/utils/stt-component-worker.ts:8`
- **Description**: `TODO: Remove once @tekyzinc/stt-component ships the worker as…`
- **Remediation**: Remove when upstream package ships built worker.
- **Effort**: tiny
- **Promoted**: [ ]

### TD-036: 7 eslint-disable react-hooks/exhaustive-deps Suppressions
- **Category**: quality
- **Severity**: LOW
- **Status**: OPEN
- **Location**: FolderPicker.tsx, HomePage.tsx, TerminalPanel.tsx, ProjectTabBar.tsx, useAutoResumeSession.ts, useDraftPersistence.ts, useSlashMenu.ts
- **Description**: Each suppression is a potential stale closure bug.
- **Remediation**: Audit each, add missing deps or restructure with refs where truly intentional.
- **Effort**: medium
- **Promoted**: [ ]

### TD-038: ws-bridge.ts at 1068 Lines (5.3× limit)
- **Category**: quality
- **Severity**: LOW (accepted as core complexity but growing)
- **Status**: OPEN — grew from 947 to 1068 lines (+121) since scan #3
- **Location**: `web/server/ws-bridge.ts`
- **Description**: Single class concentrates session FSM, init/stall/permission timers, compaction tracking, message history, auto-naming trigger, broadcast logic.
- **Remediation**: Extract modules: `stall-watchdog.ts`, `permission-timer.ts`, `message-history.ts`, `cli-message-dispatch.ts`, `browser-message-dispatch.ts`. Keep session FSM in ws-bridge.
- **Effort**: large
- **Promoted**: [ ]

### TD-032: Context Usage % Uses Last-Iterated Model
- **Category**: quality
- **Severity**: LOW
- **Status**: OPEN
- **Location**: `web/server/ws-bridge.ts:611-618`
- **Description**: Iterates modelUsage map; last model with contextWindow>0 wins.
- **Remediation**: Track active model explicitly; use its window.
- **Effort**: small
- **Promoted**: [ ]

---

## Contract Drift (documentation)

### TD-041: No WebSocket Protocol Contract
- **Category**: documentation
- **Severity**: MEDIUM
- **Status**: NEW (scan #4)
- **Location**: `.gsd-t/contracts/` (missing file)
- **Description**: No formal contract for CLI↔server NDJSON protocol or server↔browser JSON protocol. M10 stability work touched both without contract updates. Reference material exists in `WEBSOCKET_PROTOCOL_REVERSED.md` (project root) and `session-types.ts` but nothing in the contracts dir.
- **Remediation**: Create `ws-protocol-contract.md` consolidating both legs. Include init/user/result/control_request/stream_event and permission flow.
- **Effort**: medium
- **Milestone candidate**: YES — contract refresh
- **Promoted**: [x] — Milestone 12: Contract Refresh

### TD-042: Voice/Whisper Contracts Stale
- **Category**: documentation
- **Severity**: LOW
- **Status**: NEW (scan #4)
- **Location**: `.gsd-t/contracts/voice-mode-contract.md`, `.gsd-t/contracts/whisper-contract.md`
- **Description**: Voice mode was removed at v0.9.10 (2026-03-04). Contracts still present in live contracts dir.
- **Remediation**: Move to `.gsd-t/archive/` or mark `[DEPRECATED]`.
- **Effort**: tiny
- **Promoted**: [x] — Milestone 12: Contract Refresh

### TD-043: No Swagger/OpenAPI — Violates Global CLAUDE.md
- **Category**: documentation
- **Severity**: LOW (local-only app, enforcement is soft)
- **Status**: NEW (scan #4)
- **Location**: server-wide
- **Description**: Global CLAUDE.md API Documentation Guard requires Swagger/OpenAPI for every endpoint. None exists. Hono + Zod schemas already in `routes/schemas.ts` could drive `@hono/zod-openapi` for auto-generated docs.
- **Remediation**: Either adopt `@hono/zod-openapi` and expose `/api-docs`, or add an exemption note in project CLAUDE.md justifying the waiver for local-only mode.
- **Effort**: medium (adoption) / tiny (waiver)
- **Promoted**: [x] — Milestone 12: Contract Refresh

### TD-044: Terminal WS Race on Rapid Reconnect
- **Category**: quality
- **Severity**: LOW
- **Status**: [RESOLVED] — M11 Quality Pass (spawn-lock promise chain serializes respawn, awaits prior exit)
- **Location**: `web/server/terminal-ws.ts:35-40`
- **Description**: When a new terminal WS opens with same terminalId, existing process is killed synchronously. Rapid tab switch or HMR reconnect can race and cause spurious disconnect flicker.
- **Remediation**: Debounce 50ms; or key terminals per-tab; or wait for existing process to exit before respawn.
- **Effort**: small
- **Promoted**: [x] — Milestone 11: Quality Pass

### TD-045: filesystem-routes Inconsistent Error Shapes
- **Category**: quality
- **Severity**: LOW
- **Status**: [RESOLVED] — M11 Quality Pass (shared `handleRouteError` helper, unified `{error, details?}` shape)
- **Location**: `web/server/routes/filesystem-routes.ts`
- **Description**: 10 catch sites across 7 handlers; some return 500 with no body, others return 400 swallowing the error. Inconsistent surface for the UI.
- **Remediation**: Extract a shared `handleRouteError` helper; unify to `{error: string, details?: string}` shape.
- **Effort**: small
- **Promoted**: [x] — Milestone 11: Quality Pass

---

## WONTFIX (local-only threat model)

Per feedback memory, these are accepted as-is for a local-only, single-user app. Do NOT promote unless going remote:

- **TD-028** — WebSocket auth not enforced. Intentional per index.ts:194 comment. 127.0.0.1 + CORS sufficient.
- **TD-034** — Rate limiter X-Forwarded-For spoof. Localhost-only anyway; one bucket.
- **TD-035** — CSP allows unsafe-inline. Security hardening out of scope.

---

## Dependency Updates
Not audited this scan. Key deps (React 19, Zustand 5, Vite 6.3, Vitest 4, Hono 4.7) are current as of scan date. Recommend `bun outdated` as routine sweep; TD-019 unused deps still open.

---

## Scan Metadata
- Scan date: 2026-04-10
- Scan number: 4
- Files analyzed: 84 source files (+ 220 test files)
- Source LOC: ~14,389
- Test baseline: 631 unit + 47 E2E (per progress.md, not re-run this scan)
- Languages: TypeScript, TSX, CommonJS (1 .cjs bridge file)
- Previous scan archive: `techdebt_2026-04-01.md`

---

## Suggested Tech Debt Milestones

### Suggested: Maintenance Sweep (Medium — 1 milestone)
Combines: **TD-027, TD-029, TD-013, TD-016, TD-023, TD-033, TD-032, TD-014, TD-019, TD-026, TD-044, TD-045**
Estimated effort: medium (1 focused milestone, ~2-4 domains)
Should be prioritized: Before any net-new feature work
Rationale: Small, well-understood fixes clustered around known hotspots. Zero architecture changes.

### Suggested: Contract Refresh (Medium — 1 milestone)
Combines: **TD-039, TD-040, TD-041, TD-042, TD-043**
Estimated effort: medium (could be solo domain)
Should be prioritized: Before the next M# that touches API or store shape
Rationale: Contracts are the team's shared source of truth. At current drift (~90%), they actively mislead rather than help. One contract-rewrite pass clears the debt.

### Suggested: ws-bridge.ts Decomposition (Large — optional)
Combines: **TD-038, TD-022 (partial)**
Estimated effort: large (multi-wave, requires test safety net)
Should be scheduled: Only if a feature milestone forces deep ws-bridge changes
Rationale: Current size is painful but stable. Refactor carries regression risk — defer until a concrete trigger.
