# Tasks: input-enhancements

## Summary

Adds three new input capabilities to the Composer: prompt history navigation (Up/Down arrows), voice dictation via Web Speech API, and file drag-and-drop with preview thumbnails.

## Tasks

### Task 1: Prompt history — store slice, hook, and Composer integration

- **Files**:
  - `web/src/store.ts` — ADD `promptHistory: Map<string, string[]>` slice + `addPromptToHistory` action (per store-contract.md)
  - `web/src/hooks/use-prompt-history.ts` — NEW: hook implementing `navigateUp`, `navigateDown`, `addToHistory`, `resetNavigation` (per component-contract.md)
  - `web/src/components/Composer.tsx` — MODIFY: call `addToHistory` in `handleSend()`, add Up/Down arrow handling in `handleKeyDown()` (only when slash menu is closed and textarea has empty/single-line content)
  - `web/src/store.test.ts` — ADD tests for promptHistory slice
  - `web/src/hooks/use-prompt-history.test.ts` — NEW: unit tests for the hook
  - `web/src/components/Composer.test.tsx` — ADD tests for prompt history keyboard navigation
- **Contract refs**: store-contract.md (promptHistory slice), component-contract.md (usePromptHistory hook interface)
- **Dependencies**: NONE
- **Acceptance criteria**:
  - `promptHistory` Map exists in store with `addPromptToHistory` action
  - History capped at 50 entries per session (oldest dropped)
  - History persisted to localStorage under key `cc-prompt-history`
  - Up arrow in empty/single-line textarea recalls previous prompt
  - Down arrow navigates forward through history
  - Navigation resets when user types or sends a new message
  - Up/Down arrows do NOT interfere with slash menu navigation (slash menu takes priority)
  - Up/Down arrows do NOT interfere with multi-line cursor movement (only trigger at start/end of content)
  - All existing Composer tests still pass
  - New tests cover: store slice operations, hook navigation, Composer keyboard integration

### Task 2: Voice dictation — hook and Composer integration

- **Files**:
  - `web/src/hooks/use-voice-input.ts` — NEW: Web Speech API hook implementing `isSupported`, `isListening`, `transcript`, `start`, `stop`, `error` (per component-contract.md)
  - `web/src/components/Composer.tsx` — MODIFY: add microphone button next to image upload button in toolbar, wire voice hook to append transcript to textarea
  - `web/src/hooks/use-voice-input.test.ts` — NEW: unit tests (mock SpeechRecognition)
  - `web/src/components/Composer.test.tsx` — ADD test for voice button rendering (hidden when unsupported, visible when supported)
- **Contract refs**: component-contract.md (useVoiceInput hook interface)
- **Dependencies**: NONE (can run in parallel with Task 1)
- **Acceptance criteria**:
  - Microphone button appears in Composer toolbar next to image upload button
  - Button hidden if `SpeechRecognition` API unavailable (graceful degradation)
  - Button toggles between idle (mic icon) and recording (red pulsing indicator) states
  - Interim transcript appended to current textarea content
  - Final transcript replaces interim text
  - Clicking mic button while recording stops it
  - Hook tests mock `window.SpeechRecognition` and verify lifecycle
  - All existing Composer tests still pass

### Task 3: File drag-and-drop — Composer drop zone with preview

- **Files**:
  - `web/src/components/Composer.tsx` — MODIFY: add `onDragOver`, `onDragEnter`, `onDragLeave`, `onDrop` handlers to the outer wrapper div; reuse existing `readFileAsBase64()` for image processing; add visual drop overlay state
  - `web/src/components/Composer.test.tsx` — ADD tests for drag-and-drop behavior
- **Contract refs**: component-contract.md (Drop Zone section)
- **Dependencies**: NONE (can run in parallel with Tasks 1-2)
- **Acceptance criteria**:
  - Dragging files over Composer shows a visual drop overlay (dashed border + "Drop files here" text)
  - Dropping image files adds them to the existing `images` state (reuses `readFileAsBase64`)
  - Dropped non-image files are silently ignored (image/* MIME check)
  - Drop overlay disappears after drop or when dragging leaves the area
  - Existing image preview thumbnails and remove buttons work for dropped images (already implemented)
  - Drag events don't interfere with text selection or other interactions
  - All existing Composer tests still pass
  - New tests verify: drop overlay appears on dragEnter, disappears on dragLeave/drop, images added on drop

## Execution Estimate
- Total tasks: 3
- Independent tasks (no blockers): 3
- Blocked tasks (waiting on other domains): 0
- Estimated checkpoints: 0
