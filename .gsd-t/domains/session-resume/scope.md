# Domain: session-resume

## Milestone 7 — Session Resume List

## Responsibility
Enable resuming a native Claude CLI session in the web UI. Extends `POST /api/sessions` to accept an optional `resumeCliId` parameter that is passed as `--resume` when spawning the CLI.

## Files Owned
- `web/server/cli-launcher.ts` — add `resumeCliId` to `LaunchOptions`
- `web/server/routes.ts` — accept `resumeCliId` in `POST /api/sessions` body
- `web/src/store.ts` — add `resumeNativeSession(cliId, cwd)` action (creates web session with resumeCliId)

## Out of Scope
- Relaunch of existing web sessions (already handled by POST /api/sessions/:id/relaunch)
- Session migration or data import

## Tasks
- [ ] SR-1: Add `resumeCliId?: string` to `LaunchOptions` in `cli-launcher.ts`; pass it as `--resume <id>` in `spawnCLI` (alongside existing `resumeSessionId` for relaunches)
- [ ] SR-2: Accept `resumeCliId` in `POST /api/sessions` body in `routes.ts`; pass to launcher
- [ ] SR-3: Add `resumeNativeSession(cliId: string, cwd: string)` to Zustand store — calls `api.createSession({ cwd, resumeCliId: cliId })`, switches to new session
- [ ] SR-4: Update `cli-launcher.test.ts` to cover resumeCliId path
