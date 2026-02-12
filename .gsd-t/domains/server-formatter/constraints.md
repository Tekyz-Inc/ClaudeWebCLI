# Constraints: server-formatter

## Must Follow
- Async/await for all I/O (no execSync)
- Use `Bun.spawn()` like auto-namer.ts (not execSync)
- TypeScript strict mode, type all function signatures
- Functions under 30 lines
- File under 200 lines
- Use haiku model for formatting (fast + cheap on subscription)
- Timeout: 5 seconds max per format request
- Truncate input to 2000 chars max

## Must Not
- Modify files outside owned scope
- Modify the auto-namer.ts file (reference only)
- Add new dependencies to package.json
- Use synchronous I/O in any server code
- Block the event loop during formatting

## Dependencies
- Depends on: nothing (standalone endpoint)
- Depended on by: client-formatter domain (calls the API endpoint)
