# Domain: Whisper Engine

## Responsibility
Audio snapshot capability and worker-level cancellation — enables mid-recording transcription without stopping capture.

## Files Owned
- `web/src/utils/audio-utils.ts` — add `snapshotAudio()` function
- `web/src/utils/whisper-worker.ts` — add cancellation support for in-flight transcriptions
- `web/src/hooks/use-whisper.ts` — add `transcribeSnapshot()` method for mid-recording correction

## NOT Owned (do not modify)
- `web/src/hooks/use-voice-input.ts` — owned by correction-orchestration
- `web/src/components/Composer.tsx` — UI layer
- `web/src/components/HomePage.tsx` — UI layer

## Constraints
- `snapshotAudio()` must NOT stop the mic or close the AudioContext
- Worker cancellation must not corrupt model state (pipeline stays loaded)
- `transcribeSnapshot()` must be callable while recording is active
- Must not change existing `startRawCapture`/`stopRawCapture` signatures
- Must not change existing `startRecording`/`stopRecording`/`cancelRecording` signatures

## Dependencies
- Depends on: nothing (foundation layer)
- Depended on by: correction-orchestration for `transcribeSnapshot()` API
