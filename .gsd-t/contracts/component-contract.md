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

---

## Milestone 2: Smart Voice Dictation

### useVoiceInput (MODIFIED — client-formatter domain)

Simplified to return raw text only. All regex punctuation processing removed.

```typescript
// Hook interface (unchanged signature, changed behavior)
function useVoiceInput(onTranscript: (text: string) => void): {
  isSupported: boolean;      // false if SpeechRecognition unavailable
  isListening: boolean;      // currently recording
  interimText: string;       // live preview of current speech (raw, unformatted)
  start: () => void;         // begin recording
  stop: () => void;          // stop recording
  error: string | null;      // last error message
}
```

**Behavior change:** `onTranscript` now receives raw text exactly as spoken. No punctuation, capitalization, or number processing. That responsibility moves to `useDictationFormatter`.

### useDictationFormatter (NEW — client-formatter domain)

Orchestrates debounced format requests to the server API.

```typescript
interface FormatterState {
  ghostText: string;       // text currently being formatted (displayed as ghost)
  solidText: string;       // text that has been formatted (displayed as solid)
  isFormatting: boolean;   // true while a format request is in-flight
}

function useDictationFormatter(): {
  state: FormatterState;
  /** Call when voice produces final text. Queues it for formatting. */
  addRawText: (text: string) => void;
  /** Returns the full display text (solid + ghost portions) */
  getDisplayText: () => string;
  /** Resets all state (call on send) */
  reset: () => void;
}
```

**Behavior:**
- `addRawText()` appends to `ghostText` and triggers a debounced format request (300ms)
- When format response arrives, text moves from `ghostText` to `solidText`
- If formatting fails, ghost text still moves to solid (raw, unformatted)
- `getDisplayText()` returns `solidText + " " + ghostText` (trimmed)
- `reset()` clears both ghost and solid text

**Owner:** client-formatter domain
**Consumers:** ghost-ux domain (Composer.tsx, HomePage.tsx)

### Ghost Text UX (ghost-ux domain)

Composer and HomePage textareas display text in two visual states:

- **Ghost text:** Lighter color (`text-cc-muted` or `opacity-50`), currently being processed
- **Solid text:** Normal color (`text-cc-fg`), formatting complete

Since `<textarea>` cannot style partial text, implementation options:
1. **Overlay approach:** Hidden textarea for input + visible div with styled spans
2. **Opacity transition:** Entire textarea transitions from ghost to solid on format complete
3. **CSS class toggle:** Textarea gets `voice-ghost` class while formatting, removed when done

Recommended: **Option 3** (simplest, most maintainable). The entire textarea text transitions from ghost to solid. Users won't notice the brief ghost state on individual words since the 300ms debounce + ~500ms format round-trip is fast.

```css
.voice-ghost {
  color: var(--color-cc-muted);
  transition: color 200ms ease-in;
}
```
