# Domain: voice-hooks

## Responsibility
Runtime voice backend switching — wrapper hook that delegates to the selected implementation, full-mode hook for component-only operation, and voice event bus for the speech monitor.

## Owned Files/Directories
- web/src/hooks/use-voice-mode.ts — (NEW) Zustand slice for voice mode + wrapper hook
- web/src/hooks/use-voice-input-full.ts — (NEW) Full component mode (STTEngine handles everything)
- web/src/hooks/voice-events.ts — (NEW) Event bus: VoiceEvent type, emit/subscribe helpers
- web/src/hooks/use-voice-input.ts — (MODIFY) Add event emission to Original mode
- web/src/hooks/use-voice-input-component.ts — (MODIFY) Add event emission to Whisper mode

## NOT Owned (do not modify)
- web/src/components/ — owned by voice-ui domain
- web/dev.ts, web/vite.config.ts — owned by infra domain
- web/src/hooks/use-whisper.ts — existing, no changes needed
- web/src/utils/stt-component-worker.ts — existing, no changes needed
