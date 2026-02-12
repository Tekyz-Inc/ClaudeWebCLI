# Tasks: session-config

## Summary

Expands session creation with all 4 Claude Code permission modes and auto-detects project context from the selected working directory.

## Tasks

### Task 1: Expand permission modes from 2 to 4

- **Files**:
  - `web/src/components/HomePage.tsx` — MODIFY: expand `MODES` array from 2 entries to 4: `bypassPermissions` (Agent), `acceptEdits` (Accept Edits), `plan` (Plan), `default` (Manual). Add brief description tooltips for each mode.
  - `web/src/components/HomePage.test.tsx` — NEW: tests verifying all 4 modes render and are selectable
- **Contract refs**: component-contract.md (MODES Array Extension)
- **Dependencies**: NONE
- **Acceptance criteria**:
  - MODES array contains exactly: `bypassPermissions`, `acceptEdits`, `plan`, `default`
  - All 4 modes visible in the permission mode selector dropdown/buttons
  - Each mode has a descriptive label: "Agent", "Accept Edits", "Plan", "Manual"
  - Selected mode is sent in `POST /api/sessions` body (existing behavior, just new values)
  - Default selection remains `bypassPermissions` (Agent)
  - Existing localStorage persistence of selected mode still works
  - Tests verify all 4 modes render and can be selected

### Task 2: Project detection from working directory

- **Files**:
  - `web/src/utils/project-detector.ts` — NEW: `detectProject(dirContents: string[]): ProjectInfo | null` utility per component-contract.md. Checks for: `package.json` (node), `pyproject.toml`/`setup.py` (python), `Cargo.toml` (rust), `.git` (generic). Returns project name (directory basename), type, and markers found.
  - `web/src/components/HomePage.tsx` — MODIFY: after folder selection, call `api.listDirs(cwd)` to get directory contents, pass to `detectProject()`, display project info badge below folder picker showing project name + type icon + markers
  - `web/src/utils/project-detector.test.ts` — NEW: unit tests for detectProject
  - `web/src/components/HomePage.test.tsx` — ADD tests for project detection display
- **Contract refs**: component-contract.md (ProjectInfo interface, detectProject function)
- **Dependencies**: Requires Task 1 complete (both modify HomePage.tsx)
- **Acceptance criteria**:
  - `detectProject` correctly identifies: node (package.json), python (pyproject.toml or setup.py), rust (Cargo.toml), generic (.git only)
  - Returns `null` when no project markers found
  - Returns project name from directory basename (not package.json name — avoid extra API call)
  - Project info badge appears below folder picker when project detected
  - Badge shows: project type icon + directory name + marker pills (e.g., "package.json", ".git", "CLAUDE.md")
  - Badge disappears when folder changes to non-project directory
  - Detection uses existing `api.listDirs()` — no new server endpoints
  - All existing HomePage behavior unchanged (session creation, model/mode selection, folder/branch/env pickers)
  - Tests cover: each project type detection, null return for empty dirs, UI badge rendering

## Execution Estimate
- Total tasks: 2
- Independent tasks (no blockers): 1 (Task 1)
- Blocked tasks (waiting within domain): 1 (Task 2 depends on Task 1)
- Blocked tasks (waiting on other domains): 0
- Estimated checkpoints: 0
