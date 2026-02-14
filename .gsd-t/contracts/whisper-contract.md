# Contract: Whisper Engine ↔ Correction Orchestration

## useWhisper Hook Interface (Milestone 4 — Extended)

```typescript
interface WhisperState {
  isModelLoaded: boolean;
  isModelLoading: boolean;
  loadProgress: number;       // 0-100
  isSupported: boolean;       // WebGPU or WASM available
  isTranscribing: boolean;
  error: string | null;
}

interface UseWhisperReturn {
  state: WhisperState;
  loadModel: () => Promise<void>;
  startRecording: () => void;
  stopRecording: () => Promise<string>;     // Returns transcribed text
  cancelRecording: () => void;
  // NEW in M4:
  transcribeSnapshot: () => Promise<string>; // Mid-recording transcription (copies audio, doesn't stop capture)
  cancelTranscription: () => void;           // Cancel in-flight transcription (pipeline stays loaded)
}
```

## New Method Contracts (M4)

### `transcribeSnapshot()` — Mid-recording transcription
- Snapshots ALL captured audio from start to current moment
- Does NOT stop the microphone or close AudioContext
- Resamples snapshot to 16kHz (reuses stopRawCapture logic)
- Sends to Worker for transcription
- Returns transcribed text with punctuation/capitalization
- Can be called multiple times during a single recording session
- If called while another transcription is in-flight, the previous is cancelled first

### `cancelTranscription()` — Cancel in-flight work
- Aborts the current Worker transcription (if any)
- Does NOT affect model state (pipeline stays loaded and ready)
- Does NOT stop audio capture
- No-op if nothing is in-flight
- Used by correction-orchestration to cancel stale corrections before triggering new ones

## snapshotAudio() (audio-utils.ts — internal)

```typescript
function snapshotAudio(capture: RawCapture): Float32Array[]
```

- Returns a COPY of the current samples array
- Does NOT modify the original capture
- Does NOT stop the processor or close AudioContext
- Called by `transcribeSnapshot()` internally

## Output Filtering (MANDATORY)

The Whisper worker MUST strip all non-speech artifacts before returning text.
Only actual spoken/sung words may reach the prompt field. No annotations, no
sound labels, no hallucination text.

**Bracketed annotations** — Always non-speech. Strip all `[...]` patterns:
`[Music]`, `[BLANK_AUDIO]`, `[Applause]`, `[Laughter]`, `[Silence]`, etc.

**Parenthesized annotations** — Strip when matching sound keywords:
`(typing)`, `(clicking)`, `(silence)`, `(music)`, `(applause)`, `(laughter)`,
`(coughing)`, `(breathing)`, `(sighing)`, `(sneezing)`, etc.

If new annotation patterns are discovered, add them to the filter in
`whisper-worker.ts` immediately. The prompt field must never contain
Whisper metadata artifacts.

## Worker Protocol Extension (M4)

Existing messages:
- `{ type: "load" }` → `{ type: "ready" }` or `{ type: "error" }`
- `{ type: "transcribe", audio: Float32Array }` → `{ type: "result", data: string }` or `{ type: "error" }`

New message:
- `{ type: "cancel" }` → Aborts current transcription, no response (next transcribe starts fresh)

## Voice Hook Contract (consumer-facing — unchanged interface)

```typescript
interface UseVoiceReturn {
  isSupported: boolean;
  isListening: boolean;
  isProcessing: boolean;
  interimText: string;        // Updated during recording by corrections
  error: string | null;
  isModelLoaded: boolean;
  isModelLoading: boolean;
  loadProgress: number;
  start: () => void;
  stop: () => Promise<string>;
  useWhisper: boolean;
}
```

**Owner:** whisper-engine domain (hook + worker + audio-utils)
**Consumer:** correction-orchestration domain (use-voice-input.ts)
