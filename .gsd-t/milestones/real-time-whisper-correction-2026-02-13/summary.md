# Milestone 4: Real-Time Whisper Correction

**Completed:** 2026-02-13
**Version:** 0.4.1 → 0.5.0

## What Was Built
Whisper continuously corrects streaming Speech API text during recording. Each correction re-processes ALL audio from start to now, replacing raw preview with punctuated/capitalized text.

## Domains
- **whisper-engine** (4 tasks): `snapshotAudio()` in audio-utils, `resampleAudio()` helper, worker cancellation via ID-based discard, `transcribeSnapshot()` + `cancelTranscription()` in use-whisper
- **correction-orchestration** (2 tasks): Pause-triggered corrections (>= 5s since last), forced 10s timer, cancel-previous pattern, text replacement

## Key Design Decisions
- **correctionFnRef pattern**: `onend` closure in Speech API calls correction via ref to avoid circular useCallback deps
- **ID-based cancellation**: Worker assigns incrementing IDs to transcriptions; `cancel` message sets `cancelledId`, any result with ID <= cancelledId is silently discarded
- **Full re-transcription**: Each correction processes ALL audio from start (no chunking), giving Whisper full context for best quality
- **Date.now spy in tests**: Avoided fake timers (infinite loop with setInterval) by mocking `Date.now` to control threshold checks

## Files Changed
- `web/src/utils/audio-utils.ts` — Added `snapshotAudio()`, `resampleAudio()`, refactored `stopRawCapture`
- `web/src/utils/whisper-worker.ts` — Added `cancel` message, ID-based transcription tracking
- `web/src/hooks/use-whisper.ts` — Added `transcribeSnapshot()`, `cancelTranscription()`
- `web/src/hooks/use-voice-input.ts` — Added correction triggers (pause + forced timer), `correctionFnRef`
- `web/src/hooks/use-voice-input.test.ts` — 5 new correction tests (16 total)

## Test Results
- 563/568 tests pass (5 pre-existing Windows path failures TD-011)
- Typecheck clean
- 5 new correction tests: pause trigger, threshold gating, cancel-previous, model-not-loaded guard, stop cleanup
