# Integration Points — Milestone 5

## voice-hooks → voice-ui
- voice-ui imports `useVoiceMode` wrapper hook from voice-hooks
- voice-ui imports `subscribeVoiceEvents` from voice-hooks event bus
- Checkpoint: voice-hooks must complete wrapper hook + event bus before voice-ui integrates

## voice-hooks internal
- `use-voice-input-full.ts` imports STTEngine from @tekyzinc/stt-component
- `use-voice-mode.ts` conditionally imports all 3 backend hooks
- Each backend hook calls `emitVoiceEvent` from voice-events.ts

## infra (independent)
- No cross-domain dependencies
- Can execute in parallel
- After integration: Vite must bundle both hooks (no alias swap)

## Integration Order
1. voice-hooks + infra (parallel)
2. voice-ui (depends on voice-hooks)
3. Final integration test: all 3 modes work from single dev server
