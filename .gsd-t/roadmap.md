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

### Milestone 3: Browser-Side Whisper Voice [ACTIVE]
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
