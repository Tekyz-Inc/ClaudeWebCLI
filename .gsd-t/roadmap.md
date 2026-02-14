# ClaudeWebCLI Roadmap

---

## Feature: Smart Voice Dictation
**Added**: 2026-02-12
**Context**: Regex-based spoken punctuation processing is fundamentally flawed — "period" is contextual (noun vs. punctuation command). Replace with AI-powered formatting.

### Milestone 2: Smart Voice Dictation — Server-Side AI Formatting [COMPLETE v0.3.0]
**Completed**: 2026-02-12
**Goal**: Replace regex punctuation with Claude CLI-based contextual formatting + ghost-to-solid text UX
**Success criteria**: All 28 acceptance criteria PASS. 571/576 tests pass (5 pre-existing TD-011).

### Milestone 2.1: Fix Windows Path Test Failures — Tech Debt
**Source**: Promoted from tech debt scan (2026-02-12)
**Items**: TD-011
**Goal**: All 576 tests pass on Windows (zero failures)
**Scope**:
- Fix `ensureWorktree` path assertions in `git-utils.test.ts` to use `path.join()` or normalize separators
- Fix hardcoded `/worktrees/` detection in `git-utils.ts:82` to use `path.sep`
- Fix `startsWith("/")` absolute path check in `cli-launcher.ts:186` to handle Windows drive letters
**Success criteria**:
- [ ] All 5 currently-failing `ensureWorktree` tests pass on Windows
- [ ] No regressions on POSIX (tests still pass with forward slashes)
- [ ] Typecheck clean
**Estimated effort**: small (< 1 hour)
**Priority**: MEDIUM — next available slot

### Milestone 4: Real-Time Whisper Correction
**Goal**: Whisper continuously corrects streaming Speech API text during recording — re-processes all audio on each trigger, replacing raw preview with punctuated/capitalized text while user is still speaking.
**Scope**:
- `snapshotAudio()` — copy current audio buffer without stopping capture
- Correction trigger: Speech API pause (>= 5s since last correction) OR 10s timer (forced, for non-stop speakers)
- Each correction sends ALL audio from start to now (full context, no chunking)
- Corrected text replaces streaming preview in-place
- Cancel in-flight Whisper when new trigger arrives (always freshest audio)
- Final correction on stop is fast (most audio already corrected)
**NOT in scope**:
- Word-level Whisper streaming (not supported by transformers.js)
- Multilingual support
- Configurable timing thresholds (hardcoded 5s/10s)
**Success criteria**:
- [ ] Text auto-corrects while user is still speaking
- [ ] Correction triggers on pauses (>= 5s since last) or forced every 10s
- [ ] Correction latency < 2s for dictation under 1 minute
- [ ] No audio glitches or mic interruption during correction
- [ ] Stop produces final corrected text within 1s
- [ ] All existing voice tests still pass
**Impact on existing**:
- New: `snapshotAudio()` in `audio-utils.ts`
- Modified: `whisper-worker.ts` (cancellation support)
- Modified: `use-whisper.ts` (mid-recording transcription)
- Modified: `use-voice-input.ts` (correction triggers, timer, text replacement)
**Estimated effort**: Medium (2-3 domains, ~6-8 tasks)

### Milestone 3: Browser-Side Whisper Voice [COMPLETE v0.4.0]
**Goal**: Replace Web Speech API + Claude CLI formatting with in-browser Whisper via @huggingface/transformers + WebGPU. Single-step transcription produces properly punctuated, capitalized text with no server round-trip.
**Scope**:
- In-browser Whisper (whisper-small, quantized ~530MB) via @huggingface/transformers
- WebGPU acceleration with WASM fallback
- Audio capture via MediaRecorder/Web Audio API → Whisper inference
- Model download with progress indicator, IndexedDB caching (automatic)
- Graceful fallback to Web Speech API for browsers without WebGPU/WASM support
- Remove Claude CLI dictation formatter and server endpoint
- Remove use-dictation-formatter hook (formatting built into transcription)
**NOT in scope**:
- Multilingual support (English-only model for smaller download)
- Real-time word-by-word streaming (Whisper processes in chunks)
- Model size selection UI (hardcoded to whisper-small)
**Known risks**:
- WebGPU memory leak (transformers.js Issue #860) — needs manual tensor cleanup
- ~530MB first-time download — must have progress indicator and be cached
- Whisper processes chunks, not real-time — UX is "speak → pause → text appears"
**Impact on existing**:
- Replaces `use-voice-input.ts` (Web Speech API → Whisper)
- Removes `use-dictation-formatter.ts` + server `dictation-formatter.ts` + `/api/format-dictation` route
- Modifies `Composer.tsx` voice integration
- New dependency: `@huggingface/transformers`
**Success criteria**:
- [ ] Voice transcription produces punctuated, capitalized text without server call
- [ ] Transcription completes in <3s for typical dictation (10-30 words)
- [ ] Model downloads once, cached in IndexedDB, instant on subsequent loads
- [ ] Progress indicator during first model download
- [ ] Graceful fallback to Web Speech API when WebGPU/WASM unavailable
- [ ] No memory leaks after repeated transcription sessions
- [ ] All existing voice-related tests updated and passing
