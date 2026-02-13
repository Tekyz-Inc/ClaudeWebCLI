# Domain: UI + Cleanup

## Responsibility
Composer integration with new voice system, model download progress UI, and removal of server-side dictation formatter.

## Files Owned
- `web/src/components/Composer.tsx` (MODIFY — integrate new voice hook, add model loading indicator)
- `web/server/dictation-formatter.ts` (DELETE)
- `web/server/dictation-formatter.test.ts` (DELETE)
- `web/server/routes.ts` (MODIFY — remove /api/format-dictation endpoint)
- `web/src/api.ts` (MODIFY — remove formatDictation method)

## Dependencies
- Voice Hook domain (unified hook interface)

## Constraints
- Must not break Composer functionality for non-voice features
- Server route removal must be clean (no orphaned imports)
