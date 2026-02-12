# GSD-T Progress

## Project: ClaudeWebCLI
## Version: 0.2.0
## Current Milestone
**Milestone 2: Smart Voice Dictation** — Phase: EXECUTED (all tasks complete)

## Domains
| Domain | Status | Tasks | Completed |
|--------|--------|-------|-----------|
| server-formatter | complete | 2 | 2 |
| client-formatter | complete | 3 | 3 |
| ghost-ux | complete | 3 | 3 |

## Contracts
- [x] api-contract.md — POST /api/format-dictation
- [x] component-contract.md — useVoiceInput (modified), useDictationFormatter (new), ghost UX
- [x] integration-points-m2.md — linear dependency chain: server → client → UX

## Integration Checkpoints
- [x] server-formatter complete → unblocks client-formatter — PASSED
- [x] client-formatter complete → unblocks ghost-ux — PASSED

## Completed Milestones
| # | Milestone | Version | Completed | Tag |
|---|-----------|---------|-----------|-----|
| 1 | Foundation — Daily Workflow + Voice + Files | 0.2.0 | 2026-02-11 | v0.2.0 |

## Decision Log
- 2026-02-10: Project initialized with GSD-T workflow
- 2026-02-10: Deep codebase scan completed (first scan). Forked from The Vibe Companion v0.14.1. Findings: 7 critical security issues, 4 critical tech debt items, 23 total debt items. 517/522 tests pass (5 Windows path failures). Typecheck clean. Living docs created (architecture, workflows, infrastructure, requirements). Tech debt register at .gsd-t/techdebt.md with 4 suggested milestones.
- 2026-02-10: Milestone 1 "Foundation" defined. Scope adjusted from 10 features to actual new work needed against v0.14.1 fork. Already implemented: slash command autocomplete, image paste, basic model selection, multiline editor, cost tracking. New work: voice dictation, desktop notifications, prompt history, full permission modes (4 of 4), project detection, context meter bar, file drag-and-drop enhancement.
- 2026-02-11: Milestone 1 partitioned into 3 domains. Model list already includes Opus 4.6 (no work needed). Context meter already exists with color coding (threshold tweak only: 50→60). File drag-and-drop does NOT exist yet (new build, not enhancement). All features are client-side only — no server changes needed. Domains can execute in parallel with no cross-domain dependencies.
- 2026-02-11: Milestone 1 planned — 7 tasks across 3 domains. All tasks are independent except session-config Task 2 (project detection) which depends on Task 1 (permission modes) since both modify HomePage.tsx. 6 of 7 tasks can start immediately. Recommended execution: solo sequential to minimize file-level conflicts across the 3 input-enhancements tasks that all touch Composer.tsx.
- 2026-02-11: Milestone 1 executed — all 7 tasks complete. 558/563 tests pass (5 pre-existing Windows path failures in git-utils.test.ts). TypeScript typecheck clean.
- 2026-02-11: Integration complete. Contract audit: all 3 contracts satisfied with 3 minor additive deviations (useVoiceInput callback pattern, usePromptHistory extra saveDraft, detectProject extra dirPath param). One integration gap fixed: notification permission request wired into Composer handleSend. Full test suite: 558/563 pass, typecheck clean. TD-005 updated with new file sizes (Composer 575, HomePage 728). Recommend: proceed to verify phase.
- 2026-02-11: Milestone 1 verified — 33/33 acceptance criteria PASS, security review clean, 3 code quality warnings remediated. Version bumped 0.1.0 → 0.2.0 (minor, feature milestone).
- 2026-02-11: [quick] Unified HomePage and Composer interfaces — mode/model dropdowns replaced with cycle buttons, voice mic added to HomePage, session naming changed to "Pending" until auto-named.
- 2026-02-11: [quick] Fixed voice streaming duplication — separated interim results (live preview) from final results (committed text). Hook now returns `interimText` for display, only calls `onTranscript` on finalized speech. Textarea auto-expands on content change.
- 2026-02-11: [quick] Added subscription usage tracking — TaskPanel now shows enhanced context meter (used %, remaining %, compaction threshold marker), plus localStorage-backed aggregate usage (Today/Week/Month cost and turns) via usage-tracker.ts.
- 2026-02-12: Feature "Smart Voice Dictation" defined, partitioned into 3 domains, and planned with 8 tasks. All 8 tasks executed successfully. server-formatter: dictation-formatter.ts (one-shot Claude CLI) + POST /api/format-dictation endpoint. client-formatter: stripped regex from use-voice-input, added api.formatDictation wrapper, created use-dictation-formatter hook with debounced ghost→solid state. ghost-ux: wired formatter into Composer.tsx and HomePage.tsx, added voice-ghost CSS class. 571/576 tests pass (5 pre-existing Windows path failures). Typecheck clean. Linear dependency: server-formatter (2) → client-formatter (3) → ghost-ux (3). Solo sequential execution recommended — only 8 tasks, heavily interdependent. client-formatter Task 1 (strip regex) is independent and can start immediately alongside server-formatter. Brainstorm identified regex punctuation as fundamentally wrong — replaced with two-tier AI formatting. Tier 2 (Milestone 2): Claude CLI one-shot formatter via auto-namer pattern, ghost→solid text UX. Tier 1 (Milestone 3, future): WebLLM in-browser local AI. Both tiers free under Max subscription. Impact: 8 files across 3 domains, no breaking contract changes.
