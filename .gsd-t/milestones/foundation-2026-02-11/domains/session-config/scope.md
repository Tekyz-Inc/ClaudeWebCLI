# Domain: session-config

## Responsibility

Session creation configuration enhancements: expanding permission modes from 2 to 4 options, and auto-detecting project context from the selected working directory.

## Features

1. **Full Permission Modes** — Add `acceptEdits` and `default` (manual) modes to the permission mode selector in HomePage. Currently only `bypassPermissions` (Agent) and `plan` (Plan) exist. The server already supports all modes via `set_permission_mode` control requests — this is UI-only.
2. **Project Detection** — When a user selects a working directory, detect project context by checking for `package.json`, `CLAUDE.md`, `.git/`, `.claude/` etc. Display detected project name and type. Use existing `GET /api/dirs` endpoint to check file existence — no new server endpoints needed.

## Owned Files/Directories

- `web/src/components/HomePage.tsx` — MODIFY: add permission modes, integrate project detection
- `web/src/utils/project-detector.ts` — NEW: utility to detect project type from directory listing
- `web/src/components/HomePage.test.tsx` — NEW: tests for new features

## NOT Owned (do not modify)

- `web/src/components/Composer.tsx` — owned by input-enhancements domain
- `web/src/components/TaskPanel.tsx` — owned by notifications domain
- `web/src/ws.ts` — owned by notifications domain
- `web/src/store.ts` — shared; see store-contract.md for allowed modifications
- `web/server/` — no server changes in this domain
