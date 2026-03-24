# Domain: client-decomposition

## Purpose
Break monolithic client files into focused modules, hooks, and sub-components. Target: no file over 400 lines.

## Owned Files (modify)
- web/src/ws.ts (615 → ~300 lines)
- web/src/store.ts (776 → ~500 lines via slices)
- web/src/components/Sidebar.tsx (678 → ~350 lines)
- web/src/components/Composer.tsx (653 → ~350 lines)
- web/src/components/MessageFeed.tsx (455 → ~320 lines)
- web/src/components/MessageBubble.tsx (386 → ~250 lines)
- web/src/components/HomePage.tsx (692 → ~350 lines)

## New Files (create)
- web/src/ws-handlers/ (6 handler modules extracted from ws.ts)
- web/src/store/ (5-6 slice files extracted from store.ts)
- web/src/hooks/useImageAttachments.ts (shared Composer + HomePage)
- web/src/hooks/useSlashMenu.ts (from Composer)
- web/src/hooks/useDraftPersistence.ts (from Composer)
- web/src/hooks/useAutoResumeSession.ts (from Sidebar)
- web/src/hooks/useNativeSessionPoll.ts (from Sidebar)
- web/src/utils/toolGrouping.ts (unified from MessageFeed + MessageBubble)
- web/src/utils/imageUtils.ts (readFileAsBase64 — eliminates TD-006)

## Constraints
- All existing tests must still pass after decomposition
- No behavior changes — pure refactor (same exports, same APIs)
- Update imports across consuming files
- Keep TypeScript strict mode clean
