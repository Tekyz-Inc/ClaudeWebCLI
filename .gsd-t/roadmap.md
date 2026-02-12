# ClaudeWebCLI Roadmap

---

## Feature: Smart Voice Dictation
**Added**: 2026-02-12
**Context**: Regex-based spoken punctuation processing is fundamentally flawed — "period" is contextual (noun vs. punctuation command). Replace with AI-powered formatting.

### Milestone 2: Smart Voice Dictation — Server-Side AI Formatting
**Goal**: Replace regex punctuation with Claude CLI-based contextual formatting + ghost-to-solid text UX
**Scope**:
- Server: one-shot CLI formatter (`dictation-formatter.ts`) reusing auto-namer pattern
- API: `POST /api/format-dictation` endpoint
- Client: formatter hook orchestrating debounced format requests
- UX: ghost (light color) text while raw, solid when formatted
- Remove all regex punctuation processing from `use-voice-input.ts`
**Impact on existing**:
- Modifies `use-voice-input.ts` (simplify — remove regex)
- Modifies `Composer.tsx` and `HomePage.tsx` (ghost text styling)
- Adds to `routes.ts` (new endpoint) and `api.ts` (client wrapper)
- No contract breaking changes
**Success criteria**:
- [ ] "The last school period is 8:00" — "period" preserved as word
- [ ] "Once school ends I'll head home period" — "period" becomes "."
- [ ] Raw text appears in ghost style, solidifies when formatted
- [ ] Numbers formatted contextually ("8 colon zero zero" → "8:00")
- [ ] Capitalization auto-corrected after sentence enders
- [ ] Formatting uses subscription (CLI one-shot), no API key needed
- [ ] Graceful degradation: if formatter fails, raw text is kept
- [ ] All existing voice tests updated, new formatter tests pass
- [ ] Typecheck clean

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
