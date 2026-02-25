# Domain: infra

## Responsibility
Remove --component build-time flag and Vite alias swap. Ensure both voice hooks are always bundled. Single port set for dev server.

## Owned Files/Directories
- web/dev.ts — (MODIFY) Remove --component flag and dual-port logic
- web/vite.config.ts — (MODIFY) Remove resolve.alias swap, single port
- web/package.json — (MODIFY) Remove component-specific scripts if any

## NOT Owned (do not modify)
- web/src/hooks/ — owned by voice-hooks domain
- web/src/components/ — owned by voice-ui domain
