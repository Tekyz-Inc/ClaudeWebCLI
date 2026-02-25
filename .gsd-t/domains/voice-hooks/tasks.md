# Tasks: voice-hooks

## Task 1: Create voice event bus
**File:** `web/src/hooks/voice-events.ts` (NEW)
**Work:**
- Define `VoiceEvent` type: `{ timestamp, source: "app"|"component", type, detail }`
- Implement module-level event emitter with `emitVoiceEvent()` and `subscribeVoiceEvents()`
- Keep it simple — array of callbacks, no deps
**Acceptance:** Types compile, subscribe/emit work in unit test

## Task 2: Add event emission to Original hook
**File:** `web/src/hooks/use-voice-input.ts` (MODIFY)
- Import `emitVoiceEvent` from `voice-events.ts`
- Emit `{ source: "app", type: "speech-interim" }` on interim results
- Emit `{ source: "app", type: "speech-final" }` on final results
- Emit `{ source: "app", type: "whisper-correction" }` on Whisper corrections
- Emit `{ source: "app", type: "whisper-status" }` on model load/start/stop
**Acceptance:** Events emitted during recording, visible via subscribe

## Task 3: Add event emission to Whisper (component) hook
**File:** `web/src/hooks/use-voice-input-component.ts` (MODIFY)
- Import `emitVoiceEvent` from `voice-events.ts`
- Emit `{ source: "app", type: "speech-interim" }` for app-side Speech API interims
- Emit `{ source: "app", type: "speech-final" }` for app-side Speech API finals
- Emit `{ source: "component", type: "whisper-correction" }` for STTEngine corrections
- Emit `{ source: "component", type: "engine-event" }` for STTEngine status changes
**Acceptance:** Events correctly attribute app vs component sources

## Task 4: Create Full mode hook
**File:** `web/src/hooks/use-voice-input-full.ts` (NEW)
- Import STTEngine from @tekyzinc/stt-component
- No app-level Speech API — component handles everything
- Implement UseVoiceReturn interface
- Emit events with `source: "component"` for all events
- Lazy engine creation pattern (same as component hook)
**Acceptance:** Returns UseVoiceReturn, all events sourced as "component"

## Task 5: Create voice mode wrapper hook
**File:** `web/src/hooks/use-voice-mode.ts` (NEW)
- Zustand store slice: `voiceMode: VoiceMode`, `setVoiceMode()`
- Persist to localStorage `cc-voice-mode`, default `"original"`
- `useVoiceMode()` hook that:
  - Reads mode from store
  - Calls the appropriate backend hook
  - On mode change: stops active recording first
  - Returns `UseVoiceModeReturn` (extends UseVoiceReturn with mode/setMode)
**Acceptance:** Mode persists across page reloads, switching stops active recording

## Dependencies
- Task 1 must complete before Tasks 2, 3, 4
- Task 5 depends on all backends existing (Tasks 2, 3, 4)
