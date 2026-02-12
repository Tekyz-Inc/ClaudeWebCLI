# Domain: input-enhancements

## Responsibility

All new input methods and input UX improvements in the Composer component: voice dictation via Web Speech API, prompt history with Up/Down arrow navigation, and file drag-and-drop with preview/remove UI.

## Features

1. **Voice Dictation** — Push-to-talk and continuous modes using the Web Speech API (`SpeechRecognition`). Microphone button in Composer, visual recording indicator, interim/final transcript insertion into the text area.
2. **Prompt History** — Store sent prompts per session. Up/Down arrow keys in the Composer navigate through previous prompts (like terminal history). Stored in Zustand with localStorage persistence.
3. **File Drag-and-Drop** — Drop zone on the Composer and ChatView for files. Image files converted to base64 attachments (reuse existing `readFileAsBase64`). Preview thumbnails with remove buttons before sending.

## Owned Files/Directories

- `web/src/hooks/use-voice-input.ts` — NEW: Web Speech API hook
- `web/src/hooks/use-prompt-history.ts` — NEW: prompt history navigation hook
- `web/src/components/Composer.tsx` — MODIFY: integrate voice button, history navigation, drop zone
- `web/src/store.ts` — MODIFY: add `promptHistory` Map<string, string[]> slice + actions
- `web/src/components/Composer.test.tsx` — NEW: tests for new Composer features

## NOT Owned (do not modify)

- `web/src/components/HomePage.tsx` — owned by session-config domain
- `web/src/components/TaskPanel.tsx` — owned by notifications domain
- `web/src/ws.ts` — owned by notifications domain (for notification triggers)
- `web/server/` — no server changes in this domain
