# Component Contract

## Composer.tsx Interface (input-enhancements domain)

### Existing Props (unchanged)
```typescript
interface ComposerProps {
  sessionId: string;
}
```

### New Internal Elements

**Voice Button** — Rendered next to existing image attach button in the Composer toolbar area. Toggles between idle/recording states. Uses `useVoiceInput` hook.

```typescript
// Hook interface (callback pattern — onTranscript fires with final text)
function useVoiceInput(onTranscript: (text: string) => void): {
  isSupported: boolean;      // false if SpeechRecognition unavailable
  isListening: boolean;      // currently recording
  start: () => void;         // begin recording
  stop: () => void;          // stop recording
  error: string | null;      // last error message
}
```

**Prompt History** — Integrated into existing keyboard handler. Up arrow (when cursor at start of empty/single-line input) navigates to previous prompt. Down arrow navigates forward.

```typescript
// Hook interface
function usePromptHistory(sessionId: string): {
  navigateUp: () => string | null;    // returns previous prompt or null
  navigateDown: () => string | null;  // returns next prompt or null
  addToHistory: (prompt: string) => void;
  resetNavigation: () => void;        // reset to latest position
  saveDraft: (text: string) => void;  // save current text before navigating
}
```

**Drop Zone** — `onDragOver`, `onDragEnter`, `onDragLeave`, `onDrop` handlers on the Composer wrapper div. Visual overlay when dragging files over the area.

## HomePage.tsx Interface (session-config domain)

### MODES Array Extension

```typescript
const MODES = [
  { value: "bypassPermissions", label: "Agent" },
  { value: "acceptEdits", label: "Accept Edits" },
  { value: "plan", label: "Plan" },
  { value: "default", label: "Manual" },
];
```

### Project Detection Display

Project info rendered below the folder picker when a directory is selected and detected as a project. Shows project name (from package.json `name` field or directory basename) and project markers found.

```typescript
// Utility interface
interface ProjectInfo {
  name: string;           // project name
  type: string;           // "node" | "python" | "rust" | "generic"
  markers: string[];      // e.g. ["package.json", ".git", "CLAUDE.md"]
}

function detectProject(dirContents: string[], dirPath: string): ProjectInfo | null;
```

## TaskPanel.tsx Interface (notifications domain)

No props changes. Only internal threshold change:
- Line 53: `contextPct > 50` → `contextPct > 60`

## Notification Utility (notifications domain)

```typescript
// Module interface
function requestNotificationPermission(): Promise<NotificationPermission>;
function sendNotification(title: string, options?: { body?: string; sessionId?: string }): void;
function isNotificationSupported(): boolean;
```

The `sendNotification` function checks `document.hidden` internally — only fires when tab is not focused. The `sessionId` option, when provided, switches to that session on notification click.
