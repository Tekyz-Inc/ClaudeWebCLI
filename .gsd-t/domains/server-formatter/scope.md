# Domain: server-formatter

## Responsibility
Server-side dictation formatting endpoint. Spawns a one-shot Claude CLI process (reusing the auto-namer pattern) to contextually format raw dictated text — adding punctuation, capitalization, and number formatting.

## Owned Files/Directories
- `web/server/dictation-formatter.ts` — NEW: one-shot CLI formatter function
- `web/server/dictation-formatter.test.ts` — NEW: unit tests
- `web/server/routes.ts` — MODIFY: add `POST /api/format-dictation` endpoint

## NOT Owned (do not modify)
- `web/server/auto-namer.ts` — reference pattern only, do not modify
- `web/server/ws-bridge.ts`
- `web/server/cli-launcher.ts`
- `web/server/index.ts`
- All `web/src/` files (client-formatter and ghost-ux domains)
