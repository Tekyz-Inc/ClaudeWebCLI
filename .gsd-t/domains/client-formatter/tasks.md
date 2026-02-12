# Tasks: client-formatter

## Summary
Simplifies the voice input hook to return raw text (removing regex punctuation), creates a new dictation formatter hook that orchestrates debounced format requests to the server API, and adds the client API wrapper.

## Tasks

### Task 1: Strip regex from use-voice-input.ts
- **Files**: `web/src/hooks/use-voice-input.ts` (MODIFY), `web/src/hooks/use-voice-input.test.ts` (MODIFY)
- **Contract refs**: component-contract.md (updated useVoiceInput interface)
- **Dependencies**: NONE
- **Acceptance criteria**:
  - Remove `SAFE_PUNCTUATION`, `MID_SENTENCE_PUNCTUATION` arrays
  - Remove `applyPunctuation()` function
  - `onTranscript` receives raw unprocessed text from speech recognition
  - `interimText` state returns raw unprocessed text
  - Hook signature unchanged: `useVoiceInput(onTranscript) → { isSupported, isListening, interimText, error, start, stop }`
  - Update test file: remove all punctuation-related tests
  - Add test: raw text passed through without modification
  - File stays under 100 lines (was 141, removing ~35 lines of regex)
  - Typecheck clean, all updated tests pass

### Task 2: Add formatDictation() to api.ts
- **Files**: `web/src/api.ts` (MODIFY)
- **Contract refs**: api-contract.md (request/response shape)
- **Dependencies**: BLOCKED by server-formatter Task 2 (endpoint must exist)
- **Acceptance criteria**:
  - `api.formatDictation(text: string, model?: string)` method added to api object
  - Calls `POST /api/format-dictation` with `{ text, model }` body
  - Returns `{ formatted: string, changed: boolean }` on success
  - Throws on HTTP error (consistent with other api methods)
  - Response type interface `FormatDictationResult` exported
  - One-line addition to api object, plus interface

### Task 3: Create use-dictation-formatter.ts hook
- **Files**: `web/src/hooks/use-dictation-formatter.ts` (NEW), `web/src/hooks/use-dictation-formatter.test.ts` (NEW)
- **Contract refs**: component-contract.md (useDictationFormatter interface)
- **Dependencies**: Requires Task 2 (needs api.formatDictation)
- **Acceptance criteria**:
  - Hook `useDictationFormatter()` exported
  - Returns `{ state: FormatterState, addRawText, getDisplayText, reset }`
  - `FormatterState`: `{ ghostText: string, solidText: string, isFormatting: boolean }`
  - `addRawText(text)`: appends to ghostText, triggers debounced format (300ms)
  - When format succeeds: ghostText moves to solidText (formatted version)
  - When format fails: ghostText moves to solidText (raw, unformatted — never lose input)
  - `getDisplayText()`: returns trimmed `solidText + " " + ghostText`
  - `reset()`: clears all state (solid, ghost, pending requests)
  - Debounce prevents rapid API calls during continuous dictation
  - In-flight request tracking: new request cancels/ignores previous if still pending
  - Test file with jsdom environment directive
  - Tests mock `api.formatDictation` — test debounce, success, failure, reset
  - File under 200 lines, functions under 30 lines
  - Typecheck clean, all tests pass

## Execution Estimate
- Total tasks: 3
- Independent tasks (no blockers): 1
- Blocked tasks (waiting on other domains): 1 (Task 2 blocked by server-formatter)
- Estimated checkpoints: 1 (after server-formatter completes)
