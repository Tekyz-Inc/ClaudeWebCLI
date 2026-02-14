# Tasks: Correction Orchestration

## CO-1: Add correction trigger logic to use-voice-input.ts ✅
**File:** `web/src/hooks/use-voice-input.ts`
**Status:** COMPLETE — Pause-triggered (>= 5s) + forced 10s timer, cancel-previous pattern via `correctionFnRef`.

## CO-2: Update tests for correction orchestration ✅
**File:** `web/src/hooks/use-voice-input.test.ts`
**Status:** COMPLETE — 5 new correction tests added (16 total), all passing. Uses `Date.now` spy instead of fake timers.
