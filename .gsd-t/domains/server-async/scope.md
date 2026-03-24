# Domain: server-async

## Purpose
Replace all synchronous I/O (execSync, readFileSync, writeFileSync) in server request paths with async equivalents. Fixes TD-004 (perf) and TD-001 (command injection via array args).

## Owned Files
- web/server/git-utils.ts — ALL functions use execSync → execFile async with array args
- web/server/ws-bridge.ts — 4 execSync during session init (lines 504-527)
- web/server/session-store.ts — 5 sync file I/O calls
- web/server/env-manager.ts — 5 sync file I/O calls
- web/server/cli-launcher.ts — execSync binary resolution + sync file writes
- web/server/auto-namer.ts — 1 execSync call

## Constraints
- Use execFile with array-based arguments (no shell string concat — fixes command injection)
- All callers must be updated to await async functions
- Routes that call git-utils must become async handlers
- ws-bridge session init must use await (already in async context)
- session-store debounced writes: async writeFile with error handling
- Maintain identical behavior — same return values, same error handling
- Update corresponding test files to handle async
