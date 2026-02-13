# GSD-T Progress

## Project: ClaudeWebCLI
## Version: 0.4.1
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
- 2026-02-13: [debug] Fixed Whisper voice pipeline: (1) MediaRecorder encode/decode roundtrip corrupted audio causing "you" hallucinations — replaced with raw PCM capture via ScriptProcessorNode, proper resampling via OfflineAudioContext. (2) Race condition where model loading between start/stop caused backend mismatch — added activeBackendRef. (3) No streaming text — now runs Web Speech API simultaneously with Whisper capture for live preview, Whisper result replaces preview on stop.
- 2026-02-13: [debug] Fixed Speech API streaming preview not showing text during Whisper recording: (1) setInterimText("") cleared accumulated text on each final result — now shows full accumulated text. (2) onerror killed recognitionRef in whisper mode — now non-fatal. (3) onend cleared preview and stopped — now auto-restarts Speech API to keep streaming.
- 2026-02-13: [debug] Fixed Whisper not correcting text on stop: start() only used Whisper path when model was already loaded. On first mic click after page load, speech-only mode had no raw capture → no Whisper correction. Now always uses whisper path (raw capture + Speech API preview) when Whisper is supported. On stop, corrects with Whisper if model loaded, otherwise falls back to Speech API text. Also fixed orphaned SpeechRecognition restart by clearing recognitionRef before .stop().
- 2026-02-13: [debug] Fixed useEffect cleanup killing recording on every re-render: useEffect depended on [whisper] but whisper is a new object each render. Cleanup ran on EVERY re-render, aborting SpeechRecognition and cancelling raw capture mid-recording. Fix: whisperRef + empty deps for unmount-only cleanup. Also added stale instance guards (recognitionRef.current !== recognition) on all SpeechRecognition handlers to prevent race conditions between old callbacks and new sessions.
