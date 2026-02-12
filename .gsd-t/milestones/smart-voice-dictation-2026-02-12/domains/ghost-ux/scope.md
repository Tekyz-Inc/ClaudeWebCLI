# Domain: ghost-ux

## Responsibility
Visual ghost-to-solid text treatment in the Composer and HomePage textareas. Raw/pending text appears in a lighter "ghost" style, then solidifies (transitions to normal styling) when formatting completes. Wire up the dictation formatter hook from client-formatter domain.

## Owned Files/Directories
- `web/src/components/Composer.tsx` — MODIFY: integrate formatter hook, ghost text styling
- `web/src/components/HomePage.tsx` — MODIFY: integrate formatter hook, ghost text styling
- `web/src/index.css` — MODIFY: add ghost-to-solid CSS transition/animation

## NOT Owned (do not modify)
- `web/server/` (server-formatter domain)
- `web/src/hooks/` (client-formatter domain)
- `web/src/api.ts` (client-formatter domain)
- `web/src/store.ts`
- `web/src/ws.ts`
