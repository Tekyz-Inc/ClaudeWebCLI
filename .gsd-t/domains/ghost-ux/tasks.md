# Tasks: ghost-ux

## Summary
Wires the dictation formatter hook into Composer and HomePage, adding ghost-to-solid text styling so raw dictation appears lighter and solidifies when formatting completes.

## Tasks

### Task 1: Wire formatter into Composer.tsx
- **Files**: `web/src/components/Composer.tsx` (MODIFY)
- **Contract refs**: component-contract.md (useDictationFormatter interface)
- **Dependencies**: BLOCKED by client-formatter Task 3 (formatter hook must exist)
- **Acceptance criteria**:
  - Import and use `useDictationFormatter` hook
  - Replace current `handleVoiceTranscript` callback to use `addRawText()` instead of `setText()`
  - Replace `displayText` computation to use `formatter.getDisplayText()` for voice content
  - Typed text (non-voice) still managed via `setText()` directly (no formatting)
  - Textarea gets `voice-ghost` CSS class when `formatter.state.isFormatting` is true
  - `handleSend()` calls `formatter.reset()` alongside existing `setText("")`
  - Voice stop also commits any pending ghost text to solid
  - Existing non-voice behavior unchanged (slash commands, prompt history, image paste, drag-drop)
  - Typecheck clean

### Task 2: Wire formatter into HomePage.tsx
- **Files**: `web/src/components/HomePage.tsx` (MODIFY)
- **Contract refs**: component-contract.md (useDictationFormatter interface)
- **Dependencies**: BLOCKED by client-formatter Task 3; can run parallel with ghost-ux Task 1
- **Acceptance criteria**:
  - Same integration pattern as Composer.tsx (Task 1)
  - Import and use `useDictationFormatter` hook
  - Replace voice transcript handling to use `addRawText()`
  - Replace `displayText` for voice content
  - Textarea gets `voice-ghost` class when formatting
  - Send handler calls `formatter.reset()`
  - Existing non-voice behavior unchanged
  - Typecheck clean

### Task 3: Add ghost-to-solid CSS transition
- **Files**: `web/src/index.css` (MODIFY)
- **Contract refs**: component-contract.md (ghost text UX spec)
- **Dependencies**: NONE (can start anytime, but logically completes the domain)
- **Acceptance criteria**:
  - `.voice-ghost` CSS class defined using theme tokens
  - Ghost state: `color: var(--color-cc-muted)` (lighter text)
  - Transition: `color 200ms ease-in` for smooth solidification
  - Works in both light and dark mode (uses theme variables)
  - No impact on non-voice textarea behavior

## Execution Estimate
- Total tasks: 3
- Independent tasks (no blockers): 1 (Task 3)
- Blocked tasks (waiting on other domains): 2 (Tasks 1-2 blocked by client-formatter)
- Estimated checkpoints: 1 (after client-formatter completes)
