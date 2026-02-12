# Constraints: session-config

## Must Follow

- TypeScript strict mode on all new code
- Functions under 30 lines
- Files under 200 lines — HomePage.tsx is already 696 lines (way over limit); extract helper components/hooks, do NOT increase
- kebab-case file names, camelCase functions, PascalCase types
- Use existing `api.listDirs()` for project detection (no new server endpoints)
- Use existing Tailwind theme tokens for all UI
- Permission mode values must match what the CLI expects: `bypassPermissions`, `acceptEdits`, `plan`, `default`
- All new features must include tests

## Must Not

- Modify files outside owned scope
- Add new npm dependencies
- Change the `POST /api/sessions` request format — the server already accepts any permission mode string
- Remove or modify existing MODELS or MODES behavior, only extend
- Remove or modify any existing tests

## Dependencies

- Depends on: none
- Depended on by: none
