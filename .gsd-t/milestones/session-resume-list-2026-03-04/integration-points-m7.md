# Integration Points — Milestone 7: Session Resume List

## Domain Interfaces

### 1. ClaudeSession type (claude-sessions-api → sidebar-ux)

```typescript
// web/server/claude-sessions.ts (exported)
// web/src/types.ts (re-exported for client use)
export interface ClaudeSession {
  id: string;          // UUID — the .jsonl filename without extension
  cwd: string;         // Working directory (from JSONL message)
  firstMessage: string | null;  // First user message text (trimmed, max 200 chars)
  createdAt: string;   // ISO timestamp of the first JSONL entry
  lastActiveAt: string; // ISO timestamp of the last JSONL entry (mtime fallback)
  isNative: true;      // Discriminator — distinguishes from web SessionState
}
```

### 2. GET /api/claude-sessions (claude-sessions-api)

```
GET /api/claude-sessions?cwd=<path>
Response 200: ClaudeSession[]
Response 400: { error: "cwd is required" }
Response 500: { error: "..." }
```

### 3. POST /api/sessions extended (session-resume → routes.ts)

New optional field in request body:
```typescript
{
  model?: string;
  permissionMode?: string;
  cwd: string;
  branch?: string;
  env?: string;
  useWorktree?: boolean;
  allowedTools?: string[];
  resumeCliId?: string;  // NEW — native Claude session ID to --resume
}
```
When `resumeCliId` is set:
- `cliSessionId` is pre-populated in the session store with this value
- CLI is spawned with `--resume <resumeCliId>`

### 4. LaunchOptions extension (session-resume → cli-launcher.ts)

```typescript
export interface LaunchOptions {
  // ... existing fields ...
  resumeCliId?: string;  // NEW — spawns with --resume <id>
}
```

## Dependency Order

```
claude-sessions-api  ──→  sidebar-ux
session-resume       ──→  sidebar-ux (provides resumeNativeSession action)
```

`claude-sessions-api` and `session-resume` can be built in parallel.
`sidebar-ux` depends on both being complete.

## Wave Execution Groups

### Wave 1 — Independent (parallel)
- `claude-sessions-api`: Tasks 1–4
- `session-resume`: Tasks 1–4
- **Shared files**: NONE — `claude-sessions.ts` and `cli-launcher.ts` have no overlap
- **routes.ts note**: Both domains touch `routes.ts`. Execute sequentially within each domain, but the two domains can be worked on in separate focused sessions without conflict (different route handlers, different sections of the file)
- **Completes when**: Both domain test suites pass

### CHECKPOINT — Wave 1 → Wave 2
- Verify `GET /api/claude-sessions?cwd=...` returns correct `ClaudeSession[]`
- Verify `POST /api/sessions/create` with `resumeCliId` launches CLI with `--resume`
- Verify `resumeNativeSession` action exists in store

### Wave 2 — Sidebar (sequential within domain)
- `sidebar-ux`: Tasks 1 → 2 → 3 → 4
- **Completes when**: Native sessions appear in sidebar, Resume button works end-to-end

## Execution Order (solo mode)
1. `claude-sessions-api` Tasks 1–4 (can interleave with session-resume)
2. `session-resume` Tasks 1–4 (can interleave with claude-sessions-api)
3. CHECKPOINT: verify wave 1 contracts
4. `sidebar-ux` Tasks 1–4 (sequential)
5. INTEGRATION + VERIFY

## File Boundary Rules

| Domain | May Write To | Must NOT Write To |
|--------|-------------|-------------------|
| claude-sessions-api | claude-sessions.ts, routes.ts (GET only) | src/, store.ts |
| sidebar-ux | Sidebar.tsx, api.ts | server/, store.ts (read only) |
| session-resume | cli-launcher.ts, routes.ts (POST body), store.ts | claude-sessions.ts, Sidebar.tsx |
