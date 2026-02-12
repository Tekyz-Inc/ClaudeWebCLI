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

### Milestone 3 (future): Local AI Voice — WebLLM In-Browser Formatting
**Goal**: Add in-browser WebLLM as Tier 1 for instant local formatting before server fallback
**Scope**:
- WebLLM integration with small model (Qwen 2.5 0.5B or similar)
- Model loading with progress indicator, IndexedDB caching
- WebGPU detection with graceful fallback to Tier 2
- Tier 1→Tier 2 fallback chain in formatter hook
**Impact on existing**:
- Modifies `use-dictation-formatter.ts` (add WebLLM tier)
- New dependency: `@mlc-ai/web-llm`
- No server changes
**Success criteria**:
- [ ] WebGPU-capable browsers use local model for ~50ms formatting
- [ ] Non-WebGPU browsers gracefully fall back to server formatter
- [ ] Model downloads once, cached in IndexedDB
- [ ] Loading indicator during first model download
- [ ] Formatting quality comparable to server tier
