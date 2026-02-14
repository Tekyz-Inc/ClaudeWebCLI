# Constraints: Whisper Engine

## Must Follow
- `snapshotAudio()` must copy current buffer WITHOUT stopping mic or closing AudioContext
- Worker cancellation must abort the current transcription without corrupting the loaded pipeline
- `transcribeSnapshot()` must be callable while recording is active — it snapshots and transcribes without stopping capture
- Return a cancel handle or use a `cancelTranscription()` method so orchestration can abort in-flight work
- Reuse existing `stopRawCapture` resampling logic for snapshot audio (no duplication)

## Must Not
- Modify files outside owned scope (use-voice-input.ts, Composer.tsx, HomePage.tsx)
- Change existing `startRawCapture`/`stopRawCapture` function signatures
- Change existing `startRecording`/`stopRecording`/`cancelRecording` signatures
- Add new dependencies or packages
- Break the existing stop-recording flow (snapshot is additive to the existing API)

## Dependencies
- Depends on: nothing (foundation layer)
- Depended on by: correction-orchestration for `transcribeSnapshot()` and `cancelTranscription()` APIs
