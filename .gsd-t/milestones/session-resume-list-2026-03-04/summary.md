# Milestone Complete: Session Resume List

**Completed**: 2026-03-04
**Duration**: 2026-03-04 → 2026-03-04
**Status**: VERIFIED

## What Was Built

The left panel sidebar was transformed from a flat session list into a project-scoped conversation switcher. When a project tab is active, the sidebar now shows both web-created sessions AND native Claude terminal sessions for that project — unified in one sorted list. Any native session (even one started in the terminal) can be opened in the web UI by clicking "Resume".

## Domains

| Domain              | Tasks Completed | Key Deliverables |
|---------------------|-----------------|------------------|
| claude-sessions-api | 4/4             | `claude-sessions.ts` — reads `~/.claude/projects/<slug>/*.jsonl`, `GET /api/claude-sessions?cwd=` endpoint |
| session-resume      | 4/4             | `LaunchOptions.resumeCliId`, `--resume` flag forwarding, `store.resumeNativeSession()` |
| sidebar-ux          | 4/4             | Native sessions section in Sidebar, CLI badge, relative time, Resume button, 10s poll |

## Contracts Defined/Updated

- `integration-points-m7.md`: new — `ClaudeSession` type, endpoint spec, `resumeCliId` POST body extension, wave execution groups

## Key Decisions

- **encodeProjectSlug**: non-alphanum chars replaced with `-` (matches Claude's actual directory naming: `C--Users-david-Project`)
- **No client-side dedup of native sessions**: `cliSessionId` not exposed in `SdkSessionInfo`, so resumed sessions appear in list until next poll refresh — acceptable trade-off
- **Dynamic import in `resumeNativeSession`**: avoids `ws.ts ↔ store.ts` circular dependency; `import("./ws.js")` inside async function body
- **Wave 1 parallel safety**: `claude-sessions-api` and `session-resume` both touch `routes.ts` but at different route handlers (GET vs POST body) — no merge conflict risk
- **Empty-state condition**: updated to `filteredActiveSessions.length === 0 && archivedSessions.length === 0 && nativeSessions.length === 0` so native sessions don't get hidden behind empty-state prompt

## Issues Encountered

- **bun test vs bun run test**: `bun test` runs Bun's native test runner (no `vi.*` support); correct command is `bun run test` (runs Vitest via npm script)
- **E2E port conflict**: Port 3457 occupied by stale dev server during verify; ran E2E on port 3458 — 28/28 pass
- **Circular import**: `store.ts` → `ws.ts` → `store.ts` — fixed with dynamic import in `resumeNativeSession`
- **Sidebar empty-state hiding native sessions**: native sessions JSX was inside the `else` branch — fixed by updating the condition

## Test Coverage

- Tests added: 20 (10 claude-sessions-api + 2 session-resume + 8 sidebar-ux)
- Total: 587/592 (5 pre-existing TD-011 Windows path failures)
- E2E: 28/28 Playwright specs pass

## Git Tag

`v0.8.10`

## Files Changed

### New Files
- `web/server/claude-sessions.ts` — session history reader
- `web/server/claude-sessions.test.ts` — 10 unit tests
- `.gsd-t/contracts/integration-points-m7.md` — M7 contracts
- `.gsd-t/domains/claude-sessions-api/` — scope, constraints, tasks
- `.gsd-t/domains/session-resume/` — scope, tasks
- `.gsd-t/domains/sidebar-ux/` — scope, tasks
- `.gsd-t/verify-report.md` — verification results
- `.gsd-t/token-log.md` — observability log

### Modified Files
- `web/server/routes.ts` — added `GET /api/claude-sessions`, added `resumeCliId` to POST handler
- `web/server/cli-launcher.ts` — added `resumeCliId` to `LaunchOptions`, pre-populate `cliSessionId`, use `resumeId` in spawn
- `web/src/api.ts` — added `resumeCliId` to `CreateSessionOpts`, added `getClaudeSessions(cwd)`
- `web/src/types.ts` — exported `ClaudeSession` interface
- `web/src/store.ts` — added `resumeNativeSession(cliId, cwd)` action
- `web/src/components/Sidebar.tsx` — native sessions section, 10s poll, CLI badge, Resume button
- `web/src/components/Sidebar.test.tsx` — 8 new tests
- `docs/requirements.md` — FR-18.x added and marked [DONE], traceability table updated
- `docs/architecture.md` — `claude-sessions.ts` added to directory structure
- `README.md` — session resume feature added to Features list, version bumped to 0.8.10
