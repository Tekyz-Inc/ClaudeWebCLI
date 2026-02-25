# Constraints: voice-hooks

## Must Follow
- UseVoiceReturn interface must remain unchanged (all 3 backends return same shape)
- Event emission must not affect transcription performance
- Hooks must be side-effect free when not active (no mic access, no workers)
- TypeScript strict mode
- Functions under 30 lines

## Must Not
- Modify files outside owned scope
- Break the existing UseVoiceReturn contract
- Import from component files (Composer, HomePage, etc.)
- Change the @tekyzinc/stt-component package itself

## Dependencies
- Depends on: @tekyzinc/stt-component for STTEngine (external package)
- Depends on: use-whisper.ts for Whisper engine (existing, unchanged)
- Depended on by: voice-ui domain for wrapper hook and event bus
