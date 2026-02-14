# Constraints: Correction Orchestration

## Must Follow
- Use `transcribeSnapshot()` API from whisper-engine — never call audio-utils or worker directly
- Cancel previous in-flight Whisper transcription before starting a new correction
- Each correction sends ALL audio from start-of-recording to now (full context, no chunking)
- Corrected text replaces the entire streaming preview in-place
- Keep existing `UseVoiceReturn` interface shape — add new fields only if needed
- Timer thresholds: 5s pause trigger, 10s forced trigger (hardcoded constants, not configurable)

## Must Not
- Modify files outside owned scope (audio-utils, whisper-worker, use-whisper)
- Add new dependencies or packages
- Change the existing start/stop flow — correction is additive behavior during recording
- Create separate UI components — text replacement happens via existing interimText state

## Dependencies
- Depends on: whisper-engine for `transcribeSnapshot()` and `cancelTranscription()` APIs
- Depended on by: nothing (top-level orchestrator)
