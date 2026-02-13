# Milestone 3: Browser-Side Whisper Voice

**Version:** 0.3.0 → 0.4.0
**Completed:** 2026-02-13
**Tag:** v0.4.0

## Goal
Replace the two-step server-dependent voice pipeline (Web Speech API + Claude CLI formatting) with single-step in-browser Whisper transcription that outputs properly punctuated, capitalized text without any server round-trip.

## Domains
1. **whisper-engine** — Web Worker, model pipeline, audio capture utilities
2. **voice-hook** — Unified voice hook with Whisper + Web Speech API fallback
3. **ui-cleanup** — Composer/HomePage integration, legacy code removal

## Tasks Completed (9/9)
- T1: Install @huggingface/transformers v3.8.1
- T2: Create whisper-worker.ts (Web Worker for model loading + inference)
- T3: Create audio-utils.ts (getUserMedia + PCM conversion at 16kHz)
- T4: Create use-whisper.ts (React hook managing Worker lifecycle)
- T5: Rewrite use-voice-input.ts (unified Whisper + Web Speech API fallback)
- T6: Rewrite use-voice-input.test.ts (10 tests, all passing)
- T7: Update Composer.tsx + HomePage.tsx (model loading progress, transcribing states)
- T8: Remove server-side dictation (formatter, route, API method, 4 files deleted)
- T9: Verify Vite worker bundling (native support, no config needed)

## Key Decisions
- whisper-small (quantized q4, ~530MB) chosen for quality/size balance
- WebGPU primary with WASM fallback for broad browser compatibility
- Model cached in IndexedDB after first download
- Web Speech API retained as fallback for unsupported browsers
- stop() returns Promise<string> instead of callback pattern (simpler API)

## Files Created
- web/src/utils/whisper-worker.ts
- web/src/utils/audio-utils.ts
- web/src/hooks/use-whisper.ts

## Files Modified
- web/src/hooks/use-voice-input.ts (complete rewrite)
- web/src/hooks/use-voice-input.test.ts (complete rewrite)
- web/src/components/Composer.tsx
- web/src/components/HomePage.tsx
- web/server/routes.ts
- web/src/api.ts

## Files Deleted
- web/server/dictation-formatter.ts
- web/server/dictation-formatter.test.ts
- web/src/hooks/use-dictation-formatter.ts
- web/src/hooks/use-dictation-formatter.test.ts

## Test Results
- 558/563 tests pass (5 pre-existing Windows path failures in git-utils.test.ts — TD-011)
- TypeScript: clean
- Production build: passes
