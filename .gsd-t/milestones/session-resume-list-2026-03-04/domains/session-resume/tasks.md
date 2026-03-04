# Tasks: session-resume

## Summary
Extends `LaunchOptions` with `resumeCliId` so any Claude native session can be resumed as a new web session. Updates `cli-launcher.ts`, `routes.ts` POST body, and adds a `resumeNativeSession` action to the Zustand store.

---

## Tasks

### Task 1: Extend `LaunchOptions` and `spawnCLI` in cli-launcher.ts
- **Files**: `web/server/cli-launcher.ts`
- **Contract refs**: integration-points-m7.md §4 (LaunchOptions extension)
- **Dependencies**: NONE
- **What to build**:
  - Add `resumeCliId?: string` to the `LaunchOptions` interface (lines ~32–47)
  - In `launch()` (lines ~116–140):
    - After creating `info`, if `options.resumeCliId` is set, pre-populate `info.cliSessionId = options.resumeCliId`
  - In `spawnCLI()` (lines ~184+):
    - The function signature is `spawnCLI(sessionId, info, options: LaunchOptions & { resumeSessionId?: string })`
    - Add: `const resumeId = options.resumeSessionId ?? (options as LaunchOptions).resumeCliId;`
    - Use `resumeId` in the existing `if (options.resumeSessionId)` block (lines ~235–236), replacing the direct reference to `options.resumeSessionId`
    - Note: do NOT change the existing `relaunch()` path — it still passes `resumeSessionId` directly
  - Keep all existing behavior intact; this is additive only
- **Acceptance criteria**:
  - `LaunchOptions` now has `resumeCliId?: string`
  - Calling `launcher.launch({ cwd, resumeCliId: "some-uuid" })` stores `cliSessionId = "some-uuid"` on the info object
  - CLI is spawned with `--resume some-uuid` when `resumeCliId` is set
  - All existing tests still pass (`bun run test server/cli-launcher.test.ts`)
  - TypeScript strict mode: no type errors

### Task 2: Accept `resumeCliId` in POST /api/sessions/create
- **Files**: `web/server/routes.ts`
- **Contract refs**: integration-points-m7.md §3 (POST /api/sessions extended)
- **Dependencies**: Requires Task 1
- **What to build**:
  - In the `api.post("/sessions/create", ...)` handler (routes.ts line ~19):
    - Extract `body.resumeCliId` from the request body
    - Pass it to `launcher.launch({ ..., resumeCliId: body.resumeCliId })`
  - Minimal change — one line added to the existing destructuring and one field added to the `launch()` call
- **Acceptance criteria**:
  - `POST /api/sessions/create` with `{ cwd: "...", resumeCliId: "uuid" }` launches CLI with `--resume uuid`
  - `POST /api/sessions/create` without `resumeCliId` behaves exactly as before
  - TypeScript strict mode: no type errors

### Task 3: Add `resumeNativeSession` to Zustand store + `CreateSessionOpts`
- **Files**: `web/src/store.ts`, `web/src/api.ts`
- **Contract refs**: integration-points-m7.md §3 (resumeCliId field)
- **Dependencies**: Requires Task 2
- **What to build**:
  - In `web/src/api.ts`:
    - Add `resumeCliId?: string` to `CreateSessionOpts` interface (lines ~63–73)
  - In `web/src/store.ts`:
    - Add `resumeNativeSession: (cliId: string, cwd: string) => Promise<void>` to the store interface
    - Implement it:
      ```typescript
      resumeNativeSession: async (cliId, cwd) => {
        const result = await api.createSession({ cwd, resumeCliId: cliId });
        const sessionId = result.sessionId;
        connectSession(sessionId);
        set({ currentSessionId: sessionId });
      }
      ```
    - Import `connectSession` from `../ws.js` (already imported in similar patterns)
- **Acceptance criteria**:
  - `useStore.getState().resumeNativeSession("uuid", "/path")` creates a session and switches to it
  - `CreateSessionOpts.resumeCliId` is typed correctly
  - TypeScript strict mode: no type errors

### Task 4: Tests for `resumeCliId` in cli-launcher
- **Files**: `web/server/cli-launcher.test.ts`
- **Contract refs**: integration-points-m7.md §4
- **Dependencies**: Requires Task 1
- **What to build**:
  - Add test: `launch({ cwd, resumeCliId: "test-uuid" })` → `info.cliSessionId === "test-uuid"`
  - Add test: when `resumeCliId` is set, spawned args include `"--resume"` and `"test-uuid"`
  - Follow existing test patterns in `cli-launcher.test.ts` (mock `Bun.spawn`)
- **Acceptance criteria**:
  - New tests pass with `bun run test server/cli-launcher.test.ts`
  - Existing tests still pass (no regressions)

## Execution Estimate
- Total tasks: 4
- Independent tasks (no blockers): 1 (Task 1)
- Blocked tasks: 3 (Tasks 2–4 cascade)
- Estimated checkpoints: 1 (after Task 2, before sidebar-ux Task 3)
