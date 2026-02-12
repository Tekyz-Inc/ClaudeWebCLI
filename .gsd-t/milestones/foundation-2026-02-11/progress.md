# GSD-T Progress

## Project: ClaudeWebCLI
## Version: 0.1.0
## Status: VERIFIED
## Date: 2026-02-11

## Milestones
| # | Milestone | Status | Domains |
|---|-----------|--------|---------|
| 1 | Foundation — Daily Workflow + Voice + Files | INTEGRATED | input-enhancements, session-config, notifications |

## Domains
| Domain | Status | Tasks | Completed |
|--------|--------|-------|-----------|
| input-enhancements | integrated | 3 | 3 |
| session-config | integrated | 2 | 2 |
| notifications | integrated | 2 | 2 |

## Contracts
- [x] store-contract.md — Zustand store slice ownership per domain
- [x] component-contract.md — Component interfaces, hook APIs, utility signatures
- [x] integration-points.md — Cross-domain dependencies, execution order, verification plan

## Contract Audit — 2026-02-11

### store-contract.md
- `promptHistory: Map<string, string[]>`: ✅ store.ts line 102
- `addPromptToHistory(sessionId, prompt)`: ✅ store.ts lines 420-428
- Persisted to localStorage `cc-prompt-history`: ✅ store.ts line 427
- Max 50 per session: ✅ store.ts lines 423-425
- No existing slices modified: ✅
- Map<string, T> pattern: ✅

### component-contract.md
- `useVoiceInput` hook: ⚠️ Minor deviation — uses callback pattern `onTranscript(text)` instead of `transcript` return field. Better design (avoids stale closures), no functional impact.
- `usePromptHistory` hook: ⚠️ Extra `saveDraft` method returned beyond contract spec. Additive, not a violation.
- `detectProject(dirContents)`: ⚠️ Extra `dirPath` parameter added for name derivation. Additive, not a violation.
- MODES array: ✅ All 4 modes present with values, labels, and descriptions
- ProjectInfo interface: ✅ Matches `{ name, type, markers }` spec
- Notification utility: ✅ All 3 functions match exactly
- TaskPanel threshold: ✅ `contextPct > 60` at line 56
- Voice button in Composer toolbar: ✅ Next to image upload
- Prompt history keyboard navigation: ✅ ArrowUp/Down in handleKeyDown
- Drop zone on Composer: ✅ All 4 drag handlers + visual overlay

### integration-points.md
- Store integration (input-enhancements → store.ts): ✅ Additive only, no existing state modified
- Notification triggers (notifications → ws.ts): ✅ Two sendNotification calls at lines 230 and 248

## Integration Fixes
1. **Notification permission gap**: `requestNotificationPermission()` was defined but never called from UI. Added call in Composer.tsx `handleSend()` — requests permission on first message send (valid user gesture for Chrome). No-op after permission is granted or denied.

## Smoke Test Flows (code tracing)

### Flow: Prompt History (input-enhancements → store → Composer)
1. User types message, presses Enter → `handleSend()` calls `addToHistory(msg)` ✅
2. `addToHistory` → `useStore.getState().addPromptToHistory(sessionId, prompt)` ✅
3. Store persists to localStorage ✅
4. User presses ArrowUp in empty textarea → `navigateUp()` reads from store ✅
5. Previous prompt appears in textarea ✅
Result: PASS

### Flow: Voice Dictation (Web Speech API → Composer)
1. `useVoiceInput` checks `window.SpeechRecognition || window.webkitSpeechRecognition` ✅
2. Mic button hidden if unsupported, visible if supported ✅
3. Click mic → `start()` creates SpeechRecognition instance ✅
4. `onresult` fires `onTranscript(text)` → `handleVoiceTranscript` appends to textarea ✅
5. Click mic again → `stop()` ends recognition ✅
Result: PASS

### Flow: File Drag-and-Drop (browser → Composer)
1. dragEnter → counter increments, overlay shows ✅
2. dragOver → preventDefault (allow drop) ✅
3. drop → processes files through `readFileAsBase64()`, adds to `images` state ✅
4. Non-image files silently ignored (MIME check) ✅
5. dragLeave → counter decrements, overlay hides when 0 ✅
Result: PASS

### Flow: Desktop Notifications (ws.ts → notifications.ts → browser)
1. `requestNotificationPermission()` called on first send in Composer ✅
2. Session completes → ws.ts case "result" → `sendNotification(sessionName — Complete, {body, sessionId})` ✅
3. Permission request → ws.ts case "permission_request" → `sendNotification(sessionName — Permission Needed, {body, sessionId})` ✅
4. `sendNotification` checks: document.hidden, permission granted, API supported ✅
5. Notification click → window.focus + setCurrentSession + notification.close ✅
Result: PASS

### Flow: Permission Modes (HomePage → WebSocket → CLI)
1. Dropdown shows all 4 modes with descriptions ✅
2. Shift+Tab cycles through modes in order ✅
3. Mode selection sends `set_permission_mode` control request ✅
4. Store updates session permissionMode ✅
Result: PASS

### Flow: Project Detection (HomePage → API → project-detector)
1. User selects directory via folder picker ✅
2. Effect calls `api.listDirs(cwd)` ✅
3. Result mapped to names array → `detectProject(names, cwd)` ✅
4. Badge UI shows type, name, and markers ✅
5. Returns null for non-project directories ✅
Result: PASS

## Integration Checkpoints
- [x] All domains complete → full test suite (558 pass, 5 pre-existing Windows path failures) + typecheck clean
- [x] Contract audit complete — all contracts satisfied (3 minor additive deviations documented)
- [x] Integration gap fixed — notification permission request wired to Composer
- [ ] Manual smoke test: voice, history, drag-drop, notifications, permission modes, project detection, context meter

## Decision Log
- 2026-02-10: Project initialized with GSD-T workflow
- 2026-02-10: Deep codebase scan completed (first scan). Forked from The Vibe Companion v0.14.1. Findings: 7 critical security issues, 4 critical tech debt items, 23 total debt items. 517/522 tests pass (5 Windows path failures). Typecheck clean. Living docs created (architecture, workflows, infrastructure, requirements). Tech debt register at .gsd-t/techdebt.md with 4 suggested milestones.
- 2026-02-10: Milestone 1 "Foundation" defined. Scope adjusted from 10 features to actual new work needed against v0.14.1 fork. Already implemented: slash command autocomplete, image paste, basic model selection, multiline editor, cost tracking. New work: voice dictation, desktop notifications, prompt history, full permission modes (4 of 4), project detection, context meter bar, file drag-and-drop enhancement.
- 2026-02-11: Milestone 1 partitioned into 3 domains. Model list already includes Opus 4.6 (no work needed). Context meter already exists with color coding (threshold tweak only: 50→60). File drag-and-drop does NOT exist yet (new build, not enhancement). All features are client-side only — no server changes needed. Domains can execute in parallel with no cross-domain dependencies.
- 2026-02-11: Milestone 1 planned — 7 tasks across 3 domains. All tasks are independent except session-config Task 2 (project detection) which depends on Task 1 (permission modes) since both modify HomePage.tsx. 6 of 7 tasks can start immediately. Recommended execution: solo sequential to minimize file-level conflicts across the 3 input-enhancements tasks that all touch Composer.tsx.
- 2026-02-11: Milestone 1 executed — all 7 tasks complete. 558/563 tests pass (5 pre-existing Windows path failures in git-utils.test.ts). TypeScript typecheck clean.
- 2026-02-11: Integration complete. Contract audit: all 3 contracts satisfied with 3 minor additive deviations (useVoiceInput callback pattern, usePromptHistory extra saveDraft, detectProject extra dirPath param). One integration gap fixed: notification permission request wired into Composer handleSend. Full test suite: 558/563 pass, typecheck clean. TD-005 updated with new file sizes (Composer 575, HomePage 728). Recommend: proceed to verify phase.
