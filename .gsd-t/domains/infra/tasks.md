# Tasks: infra

## Task 1: Simplify dev.ts
**File:** `web/dev.ts` (MODIFY)
**Work:**
- Remove `--component` flag parsing
- Remove `isComponent` conditional env vars (VITE_STT_BACKEND, PORT)
- Remove console.log about component mode
- Single env: NODE_ENV=development, no port override
**Acceptance:** `bun run dev` starts on 3456/5174 only, no --component flag

## Task 2: Simplify vite.config.ts
**File:** `web/vite.config.ts` (MODIFY)
**Work:**
- Remove `VITE_STT_BACKEND` env var check
- Remove `resolve.alias` swap for use-voice-input
- Remove dual-port logic (hardcode 5174/3456)
- Keep all other config (react, tailwindcss, proxy)
**Acceptance:** Vite always serves on 5174, no alias swap

## Task 3: Update package.json scripts
**File:** `web/package.json` (MODIFY)
**Work:**
- Remove component-specific E2E test scripts if no longer needed
- Keep `test:e2e` pointing to single project
- Update playwright.config.ts if dual-project setup is obsolete
**Acceptance:** npm scripts work without --component concept

## Dependencies
- Independent — can execute in parallel with voice-hooks
- Must be integrated carefully: both hooks must be importable without alias
