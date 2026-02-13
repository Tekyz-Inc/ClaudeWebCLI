# GSD-T Progress

## Project: ClaudeWebCLI
## Version: 0.3.0
## Current Milestone
None — ready for next milestone

## Completed Milestones
| # | Milestone | Version | Completed | Tag |
|---|-----------|---------|-----------|-----|
| 2 | Smart Voice Dictation | 0.3.0 | 2026-02-12 | v0.3.0 |
| 1 | Foundation — Daily Workflow + Voice + Files | 0.2.0 | 2026-02-11 | v0.2.0 |

## Upcoming
| # | Milestone | Priority | Source |
|---|-----------|----------|--------|
| 2.1 | Fix Windows Path Test Failures | MEDIUM | TD-011 |
| 3 | Local AI Voice — WebLLM In-Browser | future | roadmap |

## Decision Log
- 2026-02-10: Project initialized with GSD-T workflow
- 2026-02-10: Deep codebase scan completed (first scan). Forked from The Vibe Companion v0.14.1. Findings: 7 critical security issues, 4 critical tech debt items, 23 total debt items. 517/522 tests pass (5 Windows path failures). Typecheck clean. Living docs created (architecture, workflows, infrastructure, requirements). Tech debt register at .gsd-t/techdebt.md with 4 suggested milestones.
- 2026-02-10: Milestone 1 "Foundation" defined. Scope adjusted from 10 features to actual new work needed against v0.14.1 fork.
- 2026-02-11: Milestone 1 partitioned, planned, executed (7 tasks, 3 domains), integrated, verified. Version 0.1.0 → 0.2.0.
- 2026-02-11: [quick] Unified HomePage/Composer interfaces, fixed voice streaming duplication, added subscription usage tracking.
- 2026-02-12: Promoted TD-011 (Windows Path Compatibility) to Milestone 2.1.
- 2026-02-12: Milestone 2 "Smart Voice Dictation" — replaced regex punctuation with AI-powered contextual formatting via one-shot Claude CLI. 3 domains, 8 tasks, all verified. 28/28 acceptance criteria PASS. Version 0.2.0 → 0.3.0.
- 2026-02-12: [debug] Fixed 3 voice dictation bugs: (1) Switched model from Sonnet to Haiku for faster formatting, embedded instructions in prompt instead of --system-prompt flag, fixed `which`→`where` on Windows. (2) Increased timeout 5s→15s. (3) Fixed text duplication on keypress by blocking textarea onChange during active voice/formatter state.
- 2026-02-12: [debug] Fixed voice formatting failures: Windows binary resolution prefers .exe, CLI runs from tmpdir to avoid 37K-token project context, removed auto-debounce (format on flush only), increased timeout to 30s, added content-based dedup in SpeechRecognition.
- 2026-02-12: [quick] Moved reconnection/disconnection banners from ChatView (row insertion) to TopBar inline status to prevent disorienting layout shifts.
