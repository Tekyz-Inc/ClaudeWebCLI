# Domain: Voice Hook

## Responsibility
Unified voice input hook that replaces both `use-voice-input.ts` (Web Speech API) and `use-dictation-formatter.ts` (Claude CLI formatting). Provides a single interface for voice → formatted text.

## Files Owned
- `web/src/hooks/use-voice-input.ts` (MODIFY — add Whisper path, keep Web Speech API fallback)
- `web/src/hooks/use-dictation-formatter.ts` (DELETE)
- `web/src/hooks/use-dictation-formatter.test.ts` (DELETE)

## Dependencies
- Whisper Engine domain (use-whisper hook)

## Constraints
- Must maintain the same external API shape for Composer integration
- Fallback to Web Speech API + raw text when Whisper unavailable
- No server calls for voice transcription when Whisper is available
