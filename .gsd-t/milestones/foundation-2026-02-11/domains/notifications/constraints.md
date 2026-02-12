# Constraints: notifications

## Must Follow

- TypeScript strict mode on all new code
- Functions under 30 lines
- Files under 200 lines
- kebab-case file names, camelCase functions, PascalCase types
- Use existing Tailwind theme tokens for any UI additions
- Notification utility must be a pure module with no side effects on import
- Only send notifications when `document.hidden === true` (tab not focused)
- Graceful degradation: check `"Notification" in window` before using API
- All new features must include tests
- Minimal changes to ws.ts — add notification calls alongside existing message handling, do not restructure

## Must Not

- Modify files outside owned scope
- Add new npm dependencies (Notification API is browser-native)
- Change existing WebSocket message handling logic in ws.ts
- Remove or modify any existing tests

## Dependencies

- Depends on: none (Notification API is browser-native)
- Depended on by: none
