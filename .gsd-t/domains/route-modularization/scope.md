# Domain: route-modularization

## Purpose
Split monolithic routes.ts (561 lines) into focused route modules and add request validation via Zod.

## Owned Files (modify)
- web/server/routes.ts → reduced to orchestrator (~50 lines)

## New Files (create)
- web/server/routes/session-routes.ts (~120 lines)
- web/server/routes/filesystem-routes.ts (~120 lines)
- web/server/routes/git-routes.ts (~80 lines)
- web/server/routes/environment-routes.ts (~80 lines)
- web/server/routes/command-routes.ts (~50 lines)
- web/server/routes/index.ts (re-exports)

## Constraints
- Install zod as dependency
- Add Zod schemas for all request bodies
- Replace .catch(() => ({})) JSON parsing with proper validation + 400 errors
- Keep all route paths identical
- Keep all response shapes identical
- routes.ts becomes thin orchestrator importing sub-modules
- Update routes.test.ts imports if needed
