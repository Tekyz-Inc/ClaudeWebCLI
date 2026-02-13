# Contract: Whisper Engine ↔ Voice Hook

## useWhisper Hook Interface

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
  stopRecording: () => Promise<string>;  // Returns transcribed text
  cancelRecording: () => void;
}
```

## Behavior Contract

1. `loadModel()` — Downloads and initializes the Whisper pipeline
   - Loads `onnx-community/whisper-small` (quantized) in a Web Worker
   - Updates `loadProgress` 0→100 during download
   - Sets `isModelLoaded: true` on success
   - Sets `error` on failure
   - Model is cached in browser storage after first download

2. `startRecording()` — Begins audio capture
   - Uses MediaRecorder API to capture microphone audio
   - Stores audio chunks in memory

3. `stopRecording()` — Stops capture and runs inference
   - Stops MediaRecorder
   - Converts audio to PCM float32 at 16kHz (Whisper requirement)
   - Runs Whisper inference in Web Worker
   - Returns transcribed text with punctuation and capitalization
   - Cleans up tensors after inference

4. `cancelRecording()` — Aborts without transcription
   - Stops MediaRecorder, discards audio chunks

## Voice Hook Contract (consumer-facing)

The voice hook exposes the same shape to Composer:

```typescript
interface UseVoiceReturn {
  isSupported: boolean;      // Whisper OR Web Speech API available
  isListening: boolean;      // Currently recording
  isProcessing: boolean;     // Whisper is transcribing (post-recording)
  interimText: string;       // Live interim text (Web Speech API only)
  error: string | null;
  isModelLoaded: boolean;    // Whisper model ready
  isModelLoading: boolean;   // Whisper model downloading
  loadProgress: number;      // 0-100 download progress
  start: () => void;         // Begin voice input
  stop: () => Promise<string>; // Stop and return transcribed text
  useWhisper: boolean;       // true if using Whisper, false if Web Speech API
}
```

**Owner:** whisper-engine domain (hook), voice-hook domain (integration)
**Consumer:** ui-cleanup domain (Composer)
