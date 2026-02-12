# Milestone Complete: Smart Voice Dictation

**Completed**: 2026-02-12
**Duration**: 2026-02-12 (single day)
**Version**: 0.2.0 → 0.3.0
**Status**: VERIFIED

## What Was Built
Replaced regex-based voice punctuation processing with AI-powered contextual formatting using one-shot Claude CLI. Raw dictation streams in ghost (muted) text, solidifies when formatted. "school period" preserved as words, "head home period" becomes punctuation.

## Domains
| Domain | Tasks Completed | Key Deliverables |
|--------|-----------------|------------------|
| server-formatter | 2 | `dictation-formatter.ts`, `POST /api/format-dictation` endpoint, unit tests |
| client-formatter | 3 | Stripped regex from voice hook, API wrapper, `useDictationFormatter` hook with tests |
| ghost-ux | 3 | Wired formatter into Composer + HomePage, `.voice-ghost` CSS transition |

## Contracts Defined/Updated
- `api-contract.md`: new — POST /api/format-dictation spec
- `component-contract.md`: updated — useVoiceInput (simplified), useDictationFormatter (new), ghost UX
- `integration-points-m2.md`: new — linear dependency chain server → client → UX

## Key Decisions
- Regex punctuation is fundamentally wrong for contextual text — replaced with AI
- Two-tier architecture: Tier 2 (server CLI, this milestone), Tier 1 (WebLLM local, future)
- Both tiers free under Max subscription (CLI uses subscription, WebLLM is local)
- Reused auto-namer pattern for one-shot CLI calls
- 300ms debounce prevents rapid API calls during continuous dictation
- Graceful degradation: formatting failure preserves raw text (never lose input)

## Issues Encountered
- `execSync` initially used for binary resolution — violated async constraint, fixed with `Bun.spawn`
- Tests run in Node (not Bun) — `Bun.spawn` undefined in test env, handled gracefully

## Test Coverage
- Tests added: 12 (8 formatter hook + 4 server formatter)
- Tests updated: 10 (voice input tests simplified)
- Tests removed: 2 (obsolete punctuation regex tests)
- Suite: 571/576 pass (5 pre-existing Windows path failures, TD-011)

## Git Tag
`v0.3.0`

## Files Changed
- **Created**: dictation-formatter.ts, dictation-formatter.test.ts, use-dictation-formatter.ts, use-dictation-formatter.test.ts, api-contract.md, integration-points-m2.md, roadmap.md, 9 domain files
- **Modified**: routes.ts, api.ts, Composer.tsx, HomePage.tsx, use-voice-input.ts, use-voice-input.test.ts, index.css, component-contract.md, progress.md, CLAUDE.md
