# Domain: Whisper Engine

## Responsibility
Core Whisper model management — loading, audio capture, inference, and resource cleanup.

## Files Owned
- `web/src/hooks/use-whisper.ts` (NEW) — Whisper pipeline management hook
- `web/src/utils/whisper-worker.ts` (NEW) — Web Worker for model loading and inference
- `web/src/utils/audio-utils.ts` (NEW) — Audio capture and PCM conversion utilities

## Dependencies
- `@huggingface/transformers` (NEW dependency)
- Web Audio API / MediaRecorder API (browser built-in)
- WebGPU API (browser built-in, optional)

## Constraints
- Model inference MUST run in a Web Worker to avoid blocking the UI thread
- Tensor cleanup MUST happen after each transcription (memory leak mitigation)
- Model loading state must be exposed for progress indicator
- Must detect WebGPU availability and fall back to WASM
