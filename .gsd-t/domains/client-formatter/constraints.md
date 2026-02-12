# Constraints: client-formatter

## Must Follow
- TypeScript strict mode, type all function signatures
- Functions under 30 lines
- Files under 200 lines
- `// @vitest-environment jsdom` directive in test files using React hooks
- Debounce format requests (300-500ms after last speech pause)
- Never lose user input — if formatting fails, keep raw text
- Hook must return formatting state (pending/formatted) for ghost-ux domain

## Must Not
- Modify files outside owned scope
- Add state to Zustand store (hook-local state only)
- Make API calls without debouncing
- Block the UI thread

## Dependencies
- Depends on: server-formatter domain (needs `/api/format-dictation` endpoint)
- Depended on by: ghost-ux domain (consumes the formatter hook)
