# Tasks: Whisper Engine

## WE-1: Add `snapshotAudio()` to audio-utils.ts ✅
**File:** `web/src/utils/audio-utils.ts`
**Status:** COMPLETE

## WE-2: Add `resampleAudio()` helper to audio-utils.ts ✅
**File:** `web/src/utils/audio-utils.ts`
**Status:** COMPLETE — Extracted from `stopRawCapture`, refactored to use shared helper.

## WE-3: Add `cancel` message to whisper-worker.ts ✅
**File:** `web/src/utils/whisper-worker.ts`
**Status:** COMPLETE — Uses `cancelledId`/`currentTranscribeId` pattern to silently discard cancelled results.

## WE-4: Add `transcribeSnapshot()` and `cancelTranscription()` to use-whisper.ts ✅
**File:** `web/src/hooks/use-whisper.ts`
**Status:** COMPLETE
