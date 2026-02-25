# Domain: voice-ui

## Responsibility
Voice mode dropdown selector, speech event monitor panel, and integration of the wrapper hook into Composer and HomePage components.

## Owned Files/Directories
- web/src/components/VoiceModeSelector.tsx — (NEW) Dropdown: Original / Whisper / Full
- web/src/components/SpeechMonitor.tsx — (NEW) Realtime event log panel
- web/src/components/Composer.tsx — (MODIFY) Replace useVoiceInput with wrapper hook, add dropdown + monitor
- web/src/components/HomePage.tsx — (MODIFY) Replace useVoiceInput with wrapper hook, add dropdown + monitor
- web/src/components/Sidebar.tsx — (MODIFY) Remove/update mode label

## NOT Owned (do not modify)
- web/src/hooks/ — owned by voice-hooks domain
- web/dev.ts, web/vite.config.ts — owned by infra domain
