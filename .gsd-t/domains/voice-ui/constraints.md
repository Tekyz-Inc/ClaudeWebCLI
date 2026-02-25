# Constraints: voice-ui

## Must Follow
- Dropdown must be accessible (keyboard navigable, proper ARIA)
- Event monitor must be collapsible/hideable (not always visible)
- Use existing Tailwind/CSS patterns from the app
- Components under 200 lines
- TypeScript strict mode

## Must Not
- Modify hook files (voice-hooks domain owns those)
- Import STTEngine directly (only use wrapper hook)
- Add new npm dependencies for dropdown/monitor UI

## Dependencies
- Depends on: voice-hooks domain for useVoiceMode wrapper hook and voice event bus
- Depends on: voice-hooks domain completing tasks before UI integration
