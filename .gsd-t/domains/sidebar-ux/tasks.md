# Tasks: sidebar-ux

## Summary
Extends the Sidebar so that when a project tab is active, it also fetches and displays native Claude sessions (from `GET /api/claude-sessions`) alongside web sessions, with visual distinction and a "Resume" action that calls `resumeNativeSession` from the store.

---

## Tasks

### Task 1: Add `getClaudeSessions` to api.ts + re-export `ClaudeSession` type
- **Files**: `web/src/api.ts`, `web/src/types.ts`
- **Contract refs**: integration-points-m7.md §1 (ClaudeSession type), §2 (GET /api/claude-sessions)
- **Dependencies**: BLOCKED by claude-sessions-api Task 3 (endpoint must exist)
- **What to build**:
  - In `web/src/types.ts`: add `ClaudeSession` interface (copy from contract):
    ```typescript
    export interface ClaudeSession {
      id: string;
      cwd: string;
      firstMessage: string | null;
      createdAt: string;
      lastActiveAt: string;
      isNative: true;
    }
    ```
  - In `web/src/api.ts`:
    - Import `ClaudeSession` from `./types.js`
    - Add to `api` object:
      ```typescript
      getClaudeSessions: (cwd: string) =>
        get<ClaudeSession[]>(`/claude-sessions?cwd=${encodeURIComponent(cwd)}`),
      ```
- **Acceptance criteria**:
  - `api.getClaudeSessions("/some/path")` compiles with correct return type
  - `ClaudeSession` is exported from `types.ts`
  - TypeScript strict mode: no type errors

### Task 2: Fetch native sessions in Sidebar when project is active
- **Files**: `web/src/components/Sidebar.tsx`
- **Contract refs**: integration-points-m7.md §2
- **Dependencies**: Requires Task 1; BLOCKED by session-resume Task 3 (needs `resumeNativeSession` in store)
- **What to build**:
  - Add state: `const [nativeSessions, setNativeSessions] = useState<ClaudeSession[]>([])`
  - Import `ClaudeSession` from `../types.js`
  - Add a `useEffect` that watches `activeProjectCwd`:
    - When `activeProjectCwd` changes to a non-null value, call `api.getClaudeSessions(activeProjectCwd)` and store result in `nativeSessions`
    - When `activeProjectCwd` is null, set `nativeSessions` to `[]`
    - Re-fetch every 10 seconds (same poll pattern as existing session list)
  - Filter out native sessions whose `id` already matches a web session's `cliSessionId` (to avoid showing already-resumed sessions)
    - Use `sdkSessions` array to check: `sdkSessions.some(s => s.cliSessionId === native.id)`
    - Note: `SdkSessionInfo` may not have `cliSessionId` exposed; if not, skip this dedup for now (it's a nice-to-have)
- **Acceptance criteria**:
  - When `activeProjectCwd` is set (project tab selected), native sessions are fetched
  - When `activeProjectCwd` is null, native sessions array is empty
  - Re-fetches every 10 seconds

### Task 3: Render native sessions in the list with visual distinction
- **Files**: `web/src/components/Sidebar.tsx`
- **Contract refs**: integration-points-m7.md §1 (ClaudeSession visual distinction)
- **Dependencies**: Requires Task 2
- **What to build**:
  - Add a `renderNativeSessionItem(s: ClaudeSession)` function inside the component:
    - Shows a small "terminal" icon (use an SVG or text indicator like `⌨` or `CLI`)
    - Shows `firstMessage` truncated to ~50 chars, or `"(no message)"` if null
    - Shows relative time (e.g., "2 days ago") from `lastActiveAt`
    - Has a "Resume" button that calls `resumeNativeSession(s.id, s.cwd)`
    - Styled with `opacity-70` by default, full opacity on hover
    - Does NOT have rename/archive/delete buttons (native sessions are read-only)
  - In the session list JSX (where `filteredActiveSessions` is rendered):
    - After the web sessions section, if `nativeSessions.length > 0`, add a divider with label "Native Sessions" and render `nativeSessions.map(renderNativeSessionItem)`
  - `resumeNativeSession` comes from: `const resumeNativeSession = useStore((s) => s.resumeNativeSession)`
- **Acceptance criteria**:
  - Native sessions appear below web sessions with a section divider
  - Each shows truncated first message and relative time
  - "Resume" button calls `resumeNativeSession(id, cwd)`
  - No rename/archive/delete controls on native sessions
  - Sidebar.tsx stays under 200 lines — extract helper if needed (e.g., `NativeSessionItem` component into same file or nearby file)

### Task 4: Sidebar smoke test update
- **Files**: `web/src/components/Sidebar.test.tsx` (or existing test file)
- **Contract refs**: integration-points-m7.md §1
- **Dependencies**: Requires Tasks 1–3
- **What to build**:
  - Find the existing Sidebar test file; if none exists, create `web/src/components/Sidebar.test.tsx`
  - Mock `useStore` to provide `activeProjectCwd: "/test/project"` and `nativeSessions`
  - Mock `api.getClaudeSessions` to return one fake `ClaudeSession`
  - Assert: native session's `firstMessage` appears in the rendered output
  - Assert: "Resume" button is present
  - Assert: no rename/delete buttons appear on the native session
- **Acceptance criteria**:
  - Tests pass with `bun run test src/components/Sidebar`
  - No regressions in existing tests

## Execution Estimate
- Total tasks: 4
- Independent tasks (no blockers): 0 (all depend on other domains)
- Blocked tasks: 4 (Task 1 waits on claude-sessions-api T3; Task 2 waits on session-resume T3)
- Estimated checkpoints: 1 (after Tasks 1–3, before E2E)
