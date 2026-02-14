# Domain: Correction Orchestration

## Responsibility
Mid-recording correction triggers, timing logic, and text replacement — drives periodic Whisper corrections during active dictation.

## Files Owned
- `web/src/hooks/use-voice-input.ts` — add correction trigger logic (pause detection, 5s/10s timers, cancel-previous, text replacement)

## NOT Owned (do not modify)
- `web/src/utils/audio-utils.ts` — owned by whisper-engine
- `web/src/utils/whisper-worker.ts` — owned by whisper-engine
- `web/src/hooks/use-whisper.ts` — owned by whisper-engine
- `web/src/components/Composer.tsx` — UI layer
- `web/src/components/HomePage.tsx` — UI layer

## Constraints
- Must use `transcribeSnapshot()` from whisper-engine — never access audio-utils directly
- Must cancel previous in-flight correction before starting new one
- Correction replaces ALL streaming preview text (full re-transcription, not chunked)
- Must not change existing `start`/`stop` return signatures on UseVoiceReturn
- Timers: >= 5s since last correction on Speech API pause, OR forced every 10s

## Dependencies
- Depends on: whisper-engine for `transcribeSnapshot()` and `cancelTranscription()`
- Depended on by: nothing (top-level consumer)
