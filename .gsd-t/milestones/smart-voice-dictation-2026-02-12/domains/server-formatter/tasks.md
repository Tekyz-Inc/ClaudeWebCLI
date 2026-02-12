# Tasks: server-formatter

## Summary
Delivers a server-side dictation formatting endpoint that spawns a one-shot Claude CLI process to contextually format raw dictated text with punctuation, capitalization, and number formatting.

## Tasks

### Task 1: Create dictation-formatter.ts
- **Files**: `web/server/dictation-formatter.ts` (NEW)
- **Contract refs**: api-contract.md (response shape)
- **Dependencies**: NONE
- **Acceptance criteria**:
  - Function `formatDictation(text: string, model?: string)` exported
  - Uses `Bun.spawn()` with `claude -p` (same pattern as `auto-namer.ts`)
  - Prompt instructs Claude to format dictated text: add punctuation, fix capitalization, format numbers, preserve all words
  - Input truncated to 2000 chars
  - 5-second timeout — returns `null` on timeout
  - Returns `{ formatted: string, changed: boolean }` on success
  - Returns `null` on CLI failure (caller handles graceful degradation)
  - Empty/whitespace input returns `{ formatted: text, changed: false }`
  - Default model: `claude-sonnet-4-5-20250929` (fast, subscription-covered)
  - All functions under 30 lines, file under 200 lines
  - TypeScript strict mode, all types annotated

### Task 2: Add API endpoint and tests
- **Files**: `web/server/routes.ts` (MODIFY — add endpoint), `web/server/dictation-formatter.test.ts` (NEW)
- **Contract refs**: api-contract.md (full endpoint spec)
- **Dependencies**: Requires Task 1
- **Acceptance criteria**:
  - `POST /api/format-dictation` endpoint added to routes
  - Accepts `{ text: string, model?: string }` JSON body
  - Returns `{ formatted: string, changed: boolean }` on success
  - Returns `{ error: string, formatted: null, changed: false }` on failure
  - Returns 400 if `text` is missing or empty
  - Test file covers: empty input, normal formatting call, timeout handling
  - Tests mock `Bun.spawn` to avoid real CLI calls
  - Typecheck clean

## Execution Estimate
- Total tasks: 2
- Independent tasks (no blockers): 1
- Blocked tasks (waiting on other domains): 0
- Estimated checkpoints: 0
