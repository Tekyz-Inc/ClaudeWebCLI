# Constraints: infra

## Must Follow
- `bun run dev` must start both backend + Vite on single port set (3456/5174)
- VITE_STT_BACKEND env var no longer needed
- E2E test config (playwright.config.ts) may need port update

## Must Not
- Modify hook files or component files
- Remove @tekyzinc/stt-component from dependencies (still needed at runtime)
- Break existing `bun run build` / `bun run start` commands

## Dependencies
- Independent — can execute in parallel with other domains
- Must be coordinated at integration: after infra removes alias, both hooks must be importable
