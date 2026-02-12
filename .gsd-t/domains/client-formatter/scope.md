# Domain: client-formatter

## Responsibility
Client-side formatting pipeline. Simplifies `use-voice-input.ts` to return raw text only (remove all regex punctuation). Creates a new `use-dictation-formatter.ts` hook that orchestrates debounced format requests to the server API. Adds the API client wrapper.

## Owned Files/Directories
- `web/src/hooks/use-voice-input.ts` — MODIFY: remove regex punctuation, return raw text
- `web/src/hooks/use-voice-input.test.ts` — MODIFY: update tests for raw-only behavior
- `web/src/hooks/use-dictation-formatter.ts` — NEW: formatting orchestration hook
- `web/src/hooks/use-dictation-formatter.test.ts` — NEW: unit tests
- `web/src/api.ts` — MODIFY: add `formatDictation()` method

## NOT Owned (do not modify)
- `web/server/` (server-formatter domain)
- `web/src/components/` (ghost-ux domain)
- `web/src/store.ts`
- `web/src/ws.ts`
- `web/src/index.css`
