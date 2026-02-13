# GSD-T Progress

## Project: ClaudeWebCLI
## Version: 0.4.0
## Current Milestone
None — ready for next milestone.

## Completed Milestones
| # | Milestone | Version | Completed | Tag |
|---|-----------|---------|-----------|-----|
| 3 | Browser-Side Whisper Voice | 0.4.0 | 2026-02-13 | v0.4.0 |
| 2 | Smart Voice Dictation | 0.3.0 | 2026-02-12 | v0.3.0 |
| 1 | Foundation — Daily Workflow + Voice + Files | 0.2.0 | 2026-02-11 | v0.2.0 |

## Upcoming
| # | Milestone | Priority | Source |
|---|-----------|----------|--------|
| 2.1 | Fix Windows Path Test Failures | MEDIUM | TD-011 |

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
- 2026-02-12: Milestone 3 "Browser-Side Whisper Voice" defined. Replace Web Speech API + Claude CLI formatting with in-browser Whisper (whisper-small, quantized ~530MB) via @huggingface/transformers + WebGPU. Single-step transcription with built-in punctuation/capitalization. Fallback to Web Speech API for non-WebGPU browsers.
- 2026-02-13: Milestone 3 completed. 3 domains, 9 tasks, all verified. Whisper engine (Web Worker + audio capture), unified voice hook (Whisper primary + Web Speech fallback), UI cleanup (Composer/HomePage integration, 4 legacy files deleted, server route removed). Version 0.3.0 → 0.4.0.
- 2026-02-13: [debug] Fixed 3 Whisper voice bugs: (1) Audio capture at forced 16kHz produced garbage — now captures at native rate, resamples via OfflineAudioContext. (2) Race condition where model loading between start/stop caused backend mismatch — added activeBackendRef to track which backend was started. (3) No streaming text with Whisper is by design — Whisper processes post-recording, Web Speech API provides interim text while model downloads.
