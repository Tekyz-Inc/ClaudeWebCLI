# Domain: sidebar-ux

## Milestone 7 — Session Resume List

## Responsibility
Redesign the left panel (Sidebar) to act as a project-scoped conversation switcher. When a project tab is active, the sidebar shows all sessions for that project — both web-created sessions and native terminal sessions — and allows switching between or resuming any of them.

## Files Owned
- `web/src/components/Sidebar.tsx` — session list UI, native session display
- `web/src/api.ts` — add `getClaudeSessions(cwd)` API wrapper

## Out of Scope
- Session creation (remains on HomePage)
- Session deletion of native sessions
- Search/filter UI

## Tasks
- [x] SB-1: Add `getClaudeSessions(cwd: string): Promise<ClaudeSession[]>` to `api.ts`
- [x] SB-2: Extend Sidebar to fetch native sessions when a project tab is selected (`projectPath` prop or from store)
- [x] SB-3: Merge and sort web sessions + native sessions into a unified list scoped to the active project
- [x] SB-4: Render native sessions with visual distinction (e.g., "native" badge, grayed-out until hovered, Resume button)
- [x] SB-5: Wire resume click → calls `session-resume` domain's `resumeNativeSession(id)` action
- [x] SB-6: Update Sidebar tests
