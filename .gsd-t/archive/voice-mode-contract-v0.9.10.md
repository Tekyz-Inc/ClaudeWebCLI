> **DEPRECATED** — Voice mode was removed at v0.9.10 (2026-03-04). Preserved for historical reference.

# Voice Mode Contract

## Voice Mode Type

```typescript
type VoiceMode = "original" | "whisper" | "full";
```

- **original**: App's Web Speech API streaming + App's Whisper (@huggingface/transformers)
- **whisper**: Component's Whisper (STTEngine) + App's Web Speech API streaming preview
- **full**: Component handles everything (Whisper + Web Speech API built into STTEngine)

## useVoiceMode Wrapper Hook

```typescript
interface UseVoiceModeReturn extends UseVoiceReturn {
  mode: VoiceMode;
  setMode: (mode: VoiceMode) => void;
}

function useVoiceMode(): UseVoiceModeReturn;
```

The wrapper hook:
1. Reads the current mode from Zustand store
2. Delegates start/stop/clearState to the active backend's hook
3. Returns the active backend's state merged with mode/setMode
4. On mode change, stops any active recording first

**Owner:** voice-hooks domain
**Consumers:** voice-ui domain (Composer.tsx, HomePage.tsx)

## UseVoiceReturn Interface (UNCHANGED)

```typescript
interface UseVoiceReturn {
  isSupported: boolean;
  isListening: boolean;
  isProcessing: boolean;
  interimText: string;
  correctedText: string;
  error: string | null;
  isModelLoaded: boolean;
  isModelLoading: boolean;
  loadProgress: number;
  useWhisper: boolean;
  start: () => void;
  stop: () => Promise<string>;
  clearState: () => void;
}
```

All three backend hooks must return this exact interface.

## Voice Mode Store (Zustand slice)

```typescript
// Added to app store or standalone store
interface VoiceModeSlice {
  voiceMode: VoiceMode;
  setVoiceMode: (mode: VoiceMode) => void;
}
```

Persisted to localStorage under key `cc-voice-mode`.
Default: `"original"`.

## Voice Event Bus

```typescript
interface VoiceEvent {
  timestamp: number;
  source: "app" | "component";
  type: "speech-interim" | "speech-final" | "whisper-correction" | "whisper-status" | "engine-event";
  detail: string;
}

// Global event emitter (module-level, not React state)
function emitVoiceEvent(event: Omit<VoiceEvent, "timestamp">): void;
function subscribeVoiceEvents(callback: (event: VoiceEvent) => void): () => void;
```

**Owner:** voice-hooks domain
**Consumers:** voice-ui domain (SpeechMonitor.tsx)
