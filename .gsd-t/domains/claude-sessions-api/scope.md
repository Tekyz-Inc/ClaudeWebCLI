# Domain: claude-sessions-api

## Milestone 7 — Session Resume List

## Responsibility
Enumerate Claude Code's native session history for a given project directory by reading `~/.claude/projects/<slug>/*.jsonl` files and exposing the data via a REST endpoint.

## Files Owned
- `web/server/claude-sessions.ts` (new) — session reader logic
- `web/server/routes.ts` — add `GET /api/claude-sessions` endpoint

## Out of Scope
- Writing/deleting native session files
- Listing sessions across multiple projects
- Conversation message history beyond the first user message

## Tasks
- [x] CS-1: Implement `encodeProjectSlug(cwd: string): string` — converts a filesystem path to Claude's `~/.claude/projects/` slug format
- [x] CS-2: Implement `readClaudeSessions(cwd: string): Promise<ClaudeSession[]>` — reads `~/.claude/projects/<slug>/*.jsonl`, extracts session metadata from first user message line
- [x] CS-3: Add `GET /api/claude-sessions?cwd=<path>` endpoint in `routes.ts`
- [x] CS-4: Write unit tests for `encodeProjectSlug` and `readClaudeSessions`
