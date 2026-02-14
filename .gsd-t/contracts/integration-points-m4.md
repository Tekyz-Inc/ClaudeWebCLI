# Integration Points — Milestone 4: Real-Time Whisper Correction

## Whisper Engine → Correction Orchestration

### Interface
- Correction orchestration calls `transcribeSnapshot()` from the useWhisper hook
- Correction orchestration calls `cancelTranscription()` before each new correction
- Correction orchestration reads `state.isModelLoaded` to gate corrections (no correction if model not loaded)

### Data Flow
```
Speech API pause detected (or 10s timer)
  → correction-orchestration checks: >= 5s since last correction?
  → correction-orchestration calls whisper.cancelTranscription() (cancel stale)
  → correction-orchestration calls whisper.transcribeSnapshot()
  → whisper-engine snapshots audio → resamples → worker transcribes
  → correction-orchestration receives text → replaces interimText
```

### Checkpoints
1. **whisper-engine must complete `snapshotAudio()` + `transcribeSnapshot()` + `cancelTranscription()`** before correction-orchestration can implement timing logic
2. Worker `cancel` message must be functional before correction-orchestration can implement cancel-previous pattern

### Integration Test Criteria
- [ ] `transcribeSnapshot()` returns text while recording continues
- [ ] `cancelTranscription()` aborts in-flight work without affecting next transcription
- [ ] Correction replaces interimText with Whisper output
- [ ] Multiple rapid corrections don't crash or leak (cancel-previous works)
- [ ] Stop after mid-recording correction produces correct final text
