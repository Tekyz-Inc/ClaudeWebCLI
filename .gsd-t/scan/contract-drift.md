# Contract Drift Analysis -- 2026-04-01

Compares `.gsd-t/contracts/` against actual implementation.
Version: 0.14.11

---

## api-contract.md

**Status: MASSIVELY OUTDATED**

The contract only documents 2 endpoints from Milestone 2:
1. `POST /api/format-dictation` -- Still exists in `command-routes.ts`
2. `GET /api/claude-sessions/:id/messages` -- Still exists in `command-routes.ts`

**Missing from contract (37 endpoints):**

| Endpoint | Route File | Added In |
|----------|-----------|----------|
| POST /api/sessions/create | session-routes.ts | M1 |
| GET /api/sessions | session-routes.ts | M1 |
| GET /api/sessions/:id | session-routes.ts | M1 |
| PATCH /api/sessions/:id/rename | session-routes.ts | M1 |
| POST /api/sessions/:id/kill | session-routes.ts | M1 |
| POST /api/sessions/:id/relaunch | session-routes.ts | M1 |
| DELETE /api/sessions/:id | session-routes.ts | M1 |
| POST /api/sessions/:id/archive | session-routes.ts | M1 |
| POST /api/sessions/:id/unarchive | session-routes.ts | M1 |
| GET /api/fs/list | filesystem-routes.ts | M1 |
| GET /api/fs/tree | filesystem-routes.ts | M1 |
| GET /api/fs/read | filesystem-routes.ts | M1 |
| PUT /api/fs/write | filesystem-routes.ts | M1 |
| GET /api/fs/diff | filesystem-routes.ts | M1 |
| GET /api/home | filesystem-routes.ts | M1 |
| GET /api/envs | environment-routes.ts | M5 |
| GET /api/envs/:slug | environment-routes.ts | M5 |
| POST /api/envs | environment-routes.ts | M5 |
| PUT /api/envs/:slug | environment-routes.ts | M5 |
| DELETE /api/envs/:slug | environment-routes.ts | M5 |
| GET /api/git/repo-info | git-routes.ts | M5 |
| GET /api/git/branches | git-routes.ts | M5 |
| GET /api/git/worktrees | git-routes.ts | M5 |
| POST /api/git/worktrees | git-routes.ts | M5 |
| DELETE /api/git/worktrees | git-routes.ts | M5 |
| POST /api/git/fetch | git-routes.ts | M5 |
| POST /api/git/pull | git-routes.ts | M5 |
| GET /api/claude-sessions | command-routes.ts | M7 |
| GET /api/claude-sessions/:id/activity | command-routes.ts | M7 |
| POST /api/sessions/:id/send | session-routes.ts | M1 |
| POST /api/sessions/:id/respond-permission | session-routes.ts | M1 |
| POST /api/sessions/:id/interrupt | session-routes.ts | M1 |
| POST /api/sessions/:id/set-model | session-routes.ts | M1 |
| POST /api/sessions/:id/set-permission-mode | session-routes.ts | M1 |
| POST /api/format-dictation | command-routes.ts | M2 |
| GET /api/dirs | filesystem-routes.ts | M1 |
| GET /api/tree | filesystem-routes.ts | M1 |

**Drift severity: CRITICAL** -- Contract covers 5% of actual API surface.

---

## store-contract.md

**Status: MASSIVELY OUTDATED**

The contract only documents M1 additions:
- `promptHistory: Map<string, string[]>` -- Still exists
- `addPromptToHistory(sessionId, prompt)` -- Still exists

**Missing from contract (25+ slices added since M1):**

| Slice | Type | Added In |
|-------|------|----------|
| `sdkSessions` | `Map<string, SdkSessionInfo>` | M1 |
| `streaming` | `Map<string, string \| null>` | M1 |
| `streamingStartedAt` | `Map<string, number>` | M1 |
| `streamingOutputTokens` | `Map<string, number>` | M1 |
| `pendingPermissions` | `Map<string, Map<string, PermissionRequest>>` | M1 |
| `connectionStatus` | `Map<string, string>` | M1 |
| `cliConnected` | `Map<string, boolean>` | M1 |
| `sessionStatus` | `Map<string, string \| null>` | M1 |
| `previousPermissionMode` | `Map<string, string>` | M1 |
| `sessionTasks` | `Map<string, TaskItem[]>` | M1 |
| `changedFiles` | `Map<string, Set<string>>` | M1 |
| `sessionNames` | `Map<string, string>` | M1 |
| `recentlyRenamed` | `Set<string>` | M1 |
| `darkMode` | `boolean` | M1 |
| `sidebarOpen` | `boolean` | M1 |
| `taskPanelOpen` | `boolean` | M1 |
| `activeTab` | `"chat" \| "editor"` | M6 |
| `editorFile` | `string \| null` | M6 |
| `editorDirty` | `boolean` | M6 |
| `activeProjectCwd` | `string \| null` | M7 |
| `projectSessionMap` | `Record<string, string>` | M7 |
| `nativeClaudeSessions` | `Map<string, NativeSession[]>` | M7 |
| `terminalOpen` | `boolean` | M6 |

**Drift severity: CRITICAL** -- Contract covers <5% of actual store surface.

---

## component-contract.md

**Status: UNKNOWN** -- Not read during this scan. Based on pattern, likely equally outdated.

---

## voice-mode-contract.md, whisper-contract.md

**Status: LIKELY CURRENT** -- These were created for M3/M4 (voice features) which have not been significantly modified since.

---

## integration-points-m*.md

**Status: HISTORICAL** -- These document integration points for completed milestones (M2, M4, M5, M7, M8, M9). They are accurate as historical records but not maintained as living documents.

---

## WebSocket Protocol Contract

**Status: NOT DOCUMENTED**

There is no contract file for the WebSocket protocol despite it being the core of the architecture. The protocol is implicitly documented in:
- `CLAUDE.md` (high-level)
- `server/session-types.ts` (TypeScript types)
- `server/ws-bridge.ts` (implementation)
- `src/ws-handlers/` (client handling)

**Missing contract items:**
- CLI -> Server message types and schemas
- Server -> Browser message types and schemas
- Browser -> Server message types and schemas
- Connection lifecycle (connect, init, resume, disconnect)
- Message ordering guarantees
- Error/retry semantics
- Stall detection protocol

**Drift severity: HIGH** -- Core protocol has no contract.

---

## Summary

| Contract | Status | Drift Severity |
|----------|--------|---------------|
| api-contract.md | Covers 2 of ~37 endpoints | CRITICAL |
| store-contract.md | Covers 2 of ~25 slices | CRITICAL |
| component-contract.md | Unknown | UNKNOWN |
| voice-mode-contract.md | Likely current | LOW |
| whisper-contract.md | Likely current | LOW |
| WebSocket protocol | Does not exist | HIGH |
| integration-points-m*.md | Historical, not maintained | N/A |

### Recommended Actions

1. **Rewrite api-contract.md** with all 37+ endpoints, request/response schemas, and auth requirements
2. **Rewrite store-contract.md** with all store slices, their types, persistence behavior, and ownership
3. **Create ws-protocol-contract.md** documenting the full WebSocket message protocol for CLI, Browser, and Terminal connections
4. **Archive or mark historical** the milestone-specific integration-points files
5. **Audit component-contract.md** for similar drift
