# Tasks: claude-sessions-api

## Summary
Delivers a new `web/server/claude-sessions.ts` module that reads Claude Code's native session history from `~/.claude/projects/<slug>/*.jsonl`, plus a `GET /api/claude-sessions?cwd=<path>` endpoint in `routes.ts` that exposes the data to the frontend.

---

## Tasks

### Task 1: Implement `encodeProjectSlug` and `ClaudeSession` type
- **Files**: `web/server/claude-sessions.ts` (new file)
- **Contract refs**: integration-points-m7.md §1 (ClaudeSession type)
- **Dependencies**: NONE
- **What to build**:
  - Create `web/server/claude-sessions.ts`
  - Export `interface ClaudeSession { id, cwd, firstMessage, createdAt, lastActiveAt, isNative: true }`
  - Export `encodeProjectSlug(cwd: string): string` — replaces every non-alphanumeric character with `-` (e.g., `C:\Users\david\Repo` → `C--Users-david-Repo`)
  - File must be under 200 lines; functions under 30 lines
- **Acceptance criteria**:
  - `encodeProjectSlug("C:\\Users\\david\\ClaudeWebCLI")` returns `"C--Users-david-ClaudeWebCLI"`
  - `encodeProjectSlug("/home/user/project")` returns `"-home-user-project"`
  - `ClaudeSession` type is exported with all fields from the contract
  - TypeScript strict mode: no type errors

### Task 2: Implement `readClaudeSessions`
- **Files**: `web/server/claude-sessions.ts` (continue from Task 1)
- **Contract refs**: integration-points-m7.md §1 (ClaudeSession type), §2 (GET endpoint contract)
- **Dependencies**: Requires Task 1
- **What to build**:
  - Export `readClaudeSessions(cwd: string): Promise<ClaudeSession[]>`
  - Algorithm:
    1. Call `encodeProjectSlug(cwd)` to get the slug
    2. Build path: `path.join(homedir(), ".claude", "projects", slug)`
    3. `readdir` that directory; filter for files ending in `.jsonl`
    4. For each `.jsonl` file, read first two non-empty lines (skip `file-history-snapshot` lines)
    5. Find first line where `type === "user"` and `message.role === "user"`
    6. Extract `firstMessage` from `message.content` (if string, trim to 200 chars; if array, find first `text` block, trim to 200 chars)
    7. Extract `createdAt` from that line's `timestamp`; `lastActiveAt` from file mtime via `stat()`
    8. Extract `id` as the filename without `.jsonl`
    9. Extract `cwd` from the line's `cwd` field
    10. Return array sorted by `lastActiveAt` descending
  - Return `[]` (not throw) if the project directory doesn't exist
  - Skip/ignore malformed JSONL lines (try/catch per line)
- **Acceptance criteria**:
  - Returns `ClaudeSession[]` with correct fields
  - Returns `[]` if project dir doesn't exist (no throw)
  - Skips sessions with no readable user message (sets `firstMessage: null`)
  - Results sorted newest-first by `lastActiveAt`
  - TypeScript strict mode: no type errors

### Task 3: Add `GET /api/claude-sessions` endpoint
- **Files**: `web/server/routes.ts`
- **Contract refs**: integration-points-m7.md §2 (GET /api/claude-sessions)
- **Dependencies**: Requires Tasks 1–2
- **What to build**:
  - Import `readClaudeSessions` from `./claude-sessions.js`
  - Add before the existing `api.get("/sessions", ...)` handler:
    ```
    api.get("/claude-sessions", async (c) => {
      const cwd = c.req.query("cwd");
      if (!cwd) return c.json({ error: "cwd is required" }, 400);
      const sessions = await readClaudeSessions(cwd);
      return c.json(sessions);
    });
    ```
  - Wrap in try/catch, return `{ error: "..." }` with status 500 on failure
- **Acceptance criteria**:
  - `GET /api/claude-sessions?cwd=<path>` returns `ClaudeSession[]` (200)
  - `GET /api/claude-sessions` (no cwd) returns `{ error: "cwd is required" }` (400)
  - Server errors return `{ error: "..." }` (500)

### Task 4: Unit tests
- **Files**: `web/server/claude-sessions.test.ts` (new file)
- **Contract refs**: integration-points-m7.md §1, §2
- **Dependencies**: Requires Tasks 1–2
- **What to build**:
  - Test `encodeProjectSlug`:
    - Windows path with drive letter and backslashes → correct slug
    - Unix path → correct slug
    - Path with spaces → spaces replaced with `-`
  - Test `readClaudeSessions`:
    - Create temp dir with synthetic `.jsonl` files → returns correct `ClaudeSession[]`
    - Non-existent project dir → returns `[]`
    - Malformed JSONL → skips bad lines, still returns valid sessions
  - Use `node:fs/promises` `mkdtemp` + `writeFile` for temp fixtures; clean up in `afterEach`
  - Mock `homedir()` to point at temp dir
- **Acceptance criteria**:
  - All tests pass with `bun run test`
  - At least 6 test cases covering both functions
  - No hardcoded absolute paths in test fixtures

## Execution Estimate
- Total tasks: 4
- Independent tasks (no blockers): 1 (Task 1)
- Blocked tasks: 3 (Tasks 2–4 need Task 1)
- Estimated checkpoints: 1 (after Task 3, before sidebar-ux Task 2)
