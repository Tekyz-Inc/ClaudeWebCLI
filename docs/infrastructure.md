# Infrastructure

**Last Updated:** 2026-02-10
**Version:** 0.14.1

---

## Quick Reference

```bash
# Dev server (Hono backend on :3456 + Vite HMR on :5174)
cd web && bun run dev
# Or from repo root:
make dev

# Production build
cd web && bun run build && bun run start

# Type checking
cd web && bun run typecheck

# Run tests
cd web && bun run test

# Watch mode (re-runs on file changes)
cd web && bun run test:watch
```

---

## Local Development Setup

### Prerequisites

| Requirement | Minimum Version | Notes |
|-------------|----------------|-------|
| **Bun** | >=1.0.0 | Runtime, package manager, and dev tooling |
| **Claude CLI** | Latest | Must be installed and authenticated (`claude` on PATH) |
| **Git** | Any recent | Required for worktree features |

### Clone, Install, Run

```bash
git clone https://github.com/Tekyz-Inc/ClaudeWebCLI.git
cd ClaudeWebCLI
cd web && bun install
bun run dev
```

The `dev` script (`web/dev.ts`) spawns two processes in parallel:
1. **Backend** -- `bun --watch server/index.ts` (auto-restarts on file changes)
2. **Frontend** -- `vite` dev server with HMR

Ctrl+C kills both. If either process exits unexpectedly, the other is killed automatically.

### Ports

| Port | Service | Configured In |
|------|---------|---------------|
| **3456** | Hono backend (REST API + WebSocket bridge) | `web/server/index.ts` (default, override with `PORT` env var) |
| **5174** | Vite frontend dev server | `web/vite.config.ts` |

During development, the Vite dev server proxies `/api` and `/ws` requests to the backend on `:3456`. In production, the backend serves the built frontend from `web/dist/`.

### Access the App

- **Development:** Open `http://localhost:5174`
- **Production:** Open `http://localhost:3456`

---

## Environment Variables

| Variable | Purpose | Default | Set In |
|----------|---------|---------|--------|
| `PORT` | Override the backend server port | `3456` | `web/server/index.ts` |
| `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` | Enables experimental agent teams feature in the CLI | Force-set to `"1"` at startup | `web/server/index.ts` (line 1) |
| `__VIBE_PACKAGE_ROOT` | Tells the server where to find `dist/` assets in packaged distribution | Auto-resolved from file location | `web/bin/cli.ts`, `web/server/index.ts` |
| `NODE_ENV` | Controls production vs development behavior (static file serving, console output) | `"development"` in dev, `"production"` via `bun run start` | `web/dev.ts`, `web/bin/cli.ts` |

---

## External Persistence Paths

The application persists data to several locations outside the project directory.

| Path | Module | Contents | Notes |
|------|--------|----------|-------|
| `$TMPDIR/vibe-sessions/` | `session-store.ts` | Session JSON files (`{id}.json`) + `launcher.json` | Subject to OS cleanup on reboot |
| `~/.companion/session-names.json` | `session-names.ts` | Maps session IDs to display names | Single JSON file |
| `~/.companion/worktrees.json` | `worktree-tracker.ts` | Array of session-to-worktree mappings | Tracks which sessions own which worktrees |
| `~/.companion/worktrees/` | `git-utils.ts` | Actual git worktree directories | Created per branch/session as needed |
| `~/.companion/envs/` | `env-manager.ts` | Environment variable set JSON files (`{slug}.json`) | One file per named environment profile |

**Note on `$TMPDIR`:** On most systems this resolves to `/tmp` (Linux) or `/private/var/folders/.../T/` (macOS). On Windows, this is the value of `%TEMP%`. Because this is a temporary directory, session state can be lost on reboot or OS cleanup. This is a known concern (see architecture scan AC-4).

---

## Package Scripts

### Root `package.json`

| Script | Command | Purpose |
|--------|---------|---------|
| `dev` | `cd web && bun run dev` | Start both dev servers |
| `build` | `cd web && bun run build` | Build frontend for production |
| `start` | `cd web && bun run start` | Run production server |
| `prepare` | `husky` | Install git hooks on `bun install` |

### `web/package.json`

| Script | Command | Purpose |
|--------|---------|---------|
| `dev` | `bun dev.ts` | Unified dev server (backend + Vite in parallel) |
| `dev:api` | `bun --watch server/index.ts` | Backend only with auto-restart |
| `dev:vite` | `vite` | Frontend Vite dev server only |
| `build` | `vite build` | Build frontend to `web/dist/` |
| `start` | `NODE_ENV=production bun server/index.ts` | Production server (serves built frontend) |
| `prepublishOnly` | `bun run build` | Ensure frontend is built before npm publish |
| `typecheck` | `tsc --noEmit` | TypeScript type checking without emitting files |
| `test` | `vitest run` | Run all tests once |
| `test:watch` | `vitest` | Run tests in watch mode |

---

## Husky Pre-Commit Hooks

A Husky pre-commit hook is configured at `.husky/pre-commit`. It runs the following on every commit:

```bash
cd web && bun run typecheck && bun run test
```

This means every commit must pass:
1. **TypeScript type checking** (`tsc --noEmit`) -- catches type errors
2. **Full test suite** (`vitest run`) -- catches regressions

If either step fails, the commit is rejected.

The hook is installed automatically when running `bun install` at the repo root (via the `prepare` script).

---

## Build Output

Production builds are generated by Vite and output to `web/dist/`. This directory contains the compiled and bundled frontend assets (HTML, JS, CSS).

| Item | Path | Notes |
|------|------|-------|
| Build output | `web/dist/` | Generated by `vite build` |
| Entry point | `web/dist/index.html` | Served by Hono in production mode |

In production (`NODE_ENV=production`), the Hono server serves these static files directly using `hono/bun` `serveStatic`. The `__VIBE_PACKAGE_ROOT` env var ensures the correct path is resolved when running as an installed npm package.

---

## Test Configuration

Tests are configured via `web/vitest.config.ts`:

| Setting | Value | Purpose |
|---------|-------|---------|
| Default environment | `node` | Server-side tests run in Node |
| Client environment | `jsdom` | Files matching `src/**/*.test.ts(x)` use jsdom |
| Test locations | `server/**/*.test.ts`, `src/**/*.test.ts(x)` | Co-located with source files |
| Setup file | `src/test-setup.ts` | Polyfills (e.g., `matchMedia` for jsdom) |
| Globals | `true` | `describe`, `it`, `expect` available without imports |

---

## TypeScript Configuration

Configured in `web/tsconfig.json`:

| Setting | Value |
|---------|-------|
| Target | ES2022 |
| Module | ESNext |
| Module Resolution | Bundler |
| JSX | react-jsx |
| Strict | true |
| No Emit | true (type checking only; Vite handles bundling) |
| Includes | `src/`, `server/` |

---

## Makefile

The repo root contains a minimal Makefile with a single target:

```makefile
dev:
    cd web && bun run dev
```

This is a convenience alias for developers who prefer `make dev` over `npm run dev` or `cd web && bun run dev`.
