# Milestone Complete: Foundation — Daily Workflow + Voice + Files

**Completed**: 2026-02-11
**Duration**: 2026-02-10 → 2026-02-11
**Version**: 0.1.0 → 0.2.0
**Status**: VERIFIED

## What Was Built

Added six new client-side features to improve the daily workflow experience: voice dictation via Web Speech API, terminal-style prompt history with Up/Down arrow navigation, image drag-and-drop onto the Composer, full 4-mode permission control, automatic project type detection from working directory contents, and desktop notifications for background session events. Also tuned the context meter threshold from 50% to 60%.

## Domains

| Domain | Tasks Completed | Key Deliverables |
|--------|-----------------|------------------|
| input-enhancements | 3 | Prompt history hook + store slice, voice dictation hook, drag-and-drop zone on Composer |
| session-config | 2 | Permission modes expanded from 2 to 4, project detection utility + badge UI |
| notifications | 2 | Desktop notification utility + ws.ts integration, context meter threshold tweak |

## Contracts Defined/Updated

- `store-contract.md`: new — defined promptHistory slice ownership
- `component-contract.md`: new — defined hook APIs, utility signatures, UI integration points. Updated during integration to match actual implementations (callback pattern, saveDraft, dirPath param).
- `integration-points.md`: new — mapped cross-domain dependencies and execution order

## Key Decisions

- 2026-02-10: Project initialized with GSD-T workflow
- 2026-02-10: Deep codebase scan completed. Forked from The Vibe Companion v0.14.1. 23 tech debt items identified.
- 2026-02-10: Milestone 1 scope adjusted — 5 features already implemented in fork, 7 new tasks needed.
- 2026-02-11: 3 domains partitioned. All features client-side only, no server changes needed.
- 2026-02-11: Solo sequential execution chosen to minimize file-level conflicts in Composer.tsx.
- 2026-02-11: Integration gap fixed — notification permission request wired into Composer handleSend().
- 2026-02-11: 3 minor additive contract deviations documented and contracts updated to match.

## Issues Encountered

- `useVoiceInput` implemented with callback pattern instead of transcript return field — better design, contracts updated
- `requestNotificationPermission()` was defined but never called from UI — fixed during integration
- 3 code quality warnings found during verification and remediated (unused constant, misleading comment, missing cleanup effect)

## Test Coverage

- Tests added: 41 new tests across 5 new test files
- Tests updated: Composer.test.tsx updated with new mock store fields
- Total suite: 558/563 pass (5 pre-existing Windows path failures in git-utils.test.ts — TD-011)
- TypeScript typecheck: clean (zero errors)

### New Test Files
- `use-prompt-history.test.ts` (7 tests)
- `use-voice-input.test.ts` (9 tests)
- `notifications.test.ts` (11 tests)
- `project-detector.test.ts` (10 tests)
- `HomePage.test.tsx` (4 tests)

## Git Tag

`v0.2.0`

## Files Changed

### Created
- `web/src/hooks/use-prompt-history.ts` — prompt history navigation hook
- `web/src/hooks/use-prompt-history.test.ts` — hook tests
- `web/src/hooks/use-voice-input.ts` — Web Speech API voice dictation hook
- `web/src/hooks/use-voice-input.test.ts` — hook tests
- `web/src/utils/notifications.ts` — desktop notification utility
- `web/src/utils/notifications.test.ts` — utility tests
- `web/src/utils/project-detector.ts` — project type detection utility
- `web/src/utils/project-detector.test.ts` — utility tests
- `web/src/components/HomePage.test.tsx` — HomePage feature tests

### Modified
- `web/src/store.ts` — added promptHistory Map slice + addPromptToHistory action + localStorage persistence
- `web/src/components/Composer.tsx` — integrated prompt history, voice input, drag-and-drop, notification permission (460 → 575 lines)
- `web/src/components/Composer.test.tsx` — updated mock store for new fields
- `web/src/components/HomePage.tsx` — expanded MODES array to 4, added project detection badge (→ 728 lines)
- `web/src/components/TaskPanel.tsx` — context meter threshold 50% → 60%
- `web/src/ws.ts` — added sendNotification calls on result and permission_request
