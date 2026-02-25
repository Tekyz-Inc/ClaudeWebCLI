# Tasks: voice-ui

## Task 1: Create VoiceModeSelector dropdown
**File:** `web/src/components/VoiceModeSelector.tsx` (NEW)
**Work:**
- Simple dropdown with 3 options: Original, Whisper, Full
- Props: `{ mode: VoiceMode, onModeChange: (mode: VoiceMode) => void }`
- Styled to match existing UI (Tailwind, cc-* color vars)
- Compact — sits near the mic button
- Disabled while recording (can't switch mid-recording)
**Acceptance:** Renders 3 options, fires onModeChange, disabled during recording

## Task 2: Create SpeechMonitor panel
**File:** `web/src/components/SpeechMonitor.tsx` (NEW)
**Work:**
- Subscribes to voice event bus via `subscribeVoiceEvents()`
- Renders scrolling log of events with:
  - Timestamp (HH:MM:SS.ms)
  - Source badge: "APP" (blue) or "COMPONENT" (green)
  - Event type and detail
- Collapsible panel (toggle button)
- Max ~100 events in buffer (ring buffer)
- Clear button
**Acceptance:** Shows events in real-time, source attribution visible, collapsible

## Task 3: Integrate into Composer.tsx
**File:** `web/src/components/Composer.tsx` (MODIFY)
- Replace `import { useVoiceInput }` with `import { useVoiceMode }`
- Replace `const voice = useVoiceInput()` with `const voice = useVoiceMode()`
- Add VoiceModeSelector near mic button
- Add SpeechMonitor below the composer (or as overlay)
**Acceptance:** Dropdown switches mode, monitor shows events, all voice features work

## Task 4: Integrate into HomePage.tsx
**File:** `web/src/components/HomePage.tsx` (MODIFY)
- Same changes as Composer.tsx
- Replace useVoiceInput with useVoiceMode
- Add VoiceModeSelector and SpeechMonitor
**Acceptance:** Same behavior as Composer integration

## Task 5: Update Sidebar.tsx
**File:** `web/src/components/Sidebar.tsx` (MODIFY)
- Remove the hardcoded mode label ("original"/"component" text)
- Optionally show current voice mode from store
**Acceptance:** No more build-time mode label

## Dependencies
- All tasks depend on voice-hooks domain completing first (wrapper hook + event bus)
- Task 3, 4 depend on Tasks 1, 2 (need dropdown and monitor components)
