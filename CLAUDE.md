# ClaudeWebCLI

## Branch Guard
**Expected branch**: main

## Project Overview

A web-based CLI interface for Claude Code that leverages the hidden `--sdk-url` flag. Instead of running Claude Code in a terminal, users interact through a browser-based terminal UI that communicates with Claude Code over WebSocket using the NDJSON protocol.

## Autonomy Level
**Level 3 — Full Auto** (only pause for blockers or completion)
Only pause for blockers or project completion. Execute phases continuously.

### Architecture (Three-Tier WebSocket Bridge)

```
+----------------+    WebSocket (NDJSON)    +------------------+    WebSocket (JSON)    +-------------+
| Claude Code    | <---------------------> |  Bridge Server    | <-------------------> |   Browser    |
|     CLI        |  /ws/cli/:session       |  (Node.js)        |  /ws/browser/:session |  (React +    |
|  --sdk-url     |                         |                   |                       |   xterm.js)  |
+----------------+                         +------------------+                        +-------------+
```

- **Left leg (CLI <-> Server):** NDJSON over WebSocket. Claude CLI is the WebSocket client.
- **Right leg (Server <-> Browser):** Standard JSON over WebSocket. Browser is the client.
- **Bridge Server:** Translates protocols, manages sessions, handles tool approval UI, persists session state.

### How `--sdk-url` Works

The CLI is launched with:
```bash
claude --sdk-url ws://localhost:8765 \
  --print \
  --output-format stream-json \
  --input-format stream-json \
  --verbose \
  -p "placeholder"
```

The `-p "placeholder"` prompt is ignored — the CLI waits for a `user` message over the WebSocket. Authentication is sent via `Authorization: Bearer <token>` on the WebSocket upgrade request.

## Where Things Live

| Need to find... | Look here |
|-----------------|-----------|
| Bridge server entry | server/index.ts |
| WebSocket handlers | server/ws/ |
| Session management | server/sessions/ |
| CLI process spawner | server/cli/ |
| Protocol types | shared/types.ts |
| Frontend app | client/src/App.tsx |
| Terminal component | client/src/components/Terminal.tsx |
| Tool approval UI | client/src/components/ToolApproval.tsx |
| WebSocket client hook | client/src/hooks/useWebSocket.ts |
| Static assets | client/public/ |
| Tests | tests/ |
| E2E tests | tests/e2e/ |

## Key Technologies

- TypeScript - Primary language (server + client)
- Node.js - Bridge server runtime
- ws - WebSocket server library
- React - Frontend UI framework
- xterm.js - Terminal emulator in browser
- Vite - Frontend build tool
- Vitest - Unit testing
- Playwright - E2E testing

## The `--sdk-url` WebSocket Protocol

### Connection Lifecycle
1. Server starts listening on a WebSocket port
2. Claude CLI is spawned with `--sdk-url ws://server:port`
3. CLI connects and sends `system/init` message (capabilities, tools, model, session_id)
4. Server sends first `user` message (the actual prompt from the browser)
5. CLI streams responses back as NDJSON messages
6. Tool permission requests arrive as `control_request` — server must respond within 30 seconds
7. After query completes, CLI sends `result` message
8. Multi-turn continues with new `user` messages using the same `session_id`

### Key Message Types (CLI -> Server)
| Type | Purpose |
|------|---------|
| `system` (init) | First message — session ID, tools, model, version |
| `system` (status) | Status changes (processing, waiting, complete) |
| `assistant` | Full assistant response with content blocks |
| `result` | Query complete marker |
| `stream_event` | Token-by-token streaming (requires `--verbose`) |
| `control_request` | Tool permission requests (e.g., `can_use_tool`) |

### Key Message Types (Server -> CLI)
| Type | Purpose |
|------|---------|
| `user` | Send prompts or follow-up messages |
| `control_response` | Respond to tool permission requests |
| `keep_alive` | Keepalive signal |

### Tool Approval Flow
```
CLI sends:   { type: "control_request", request: { subtype: "can_use_tool", request_id: "...", tool_name: "Bash", input: {...} } }
Server sends: { type: "control_response", response: { subtype: "success", request_id: "...", response: { behavior: "allow" } } }
```

### Authentication
Token sources (priority order):
1. `CLAUDE_CODE_SESSION_ACCESS_TOKEN` environment variable
2. Internal session ingress token
3. Token from `CLAUDE_CODE_WEBSOCKET_AUTH_FILE_DESCRIPTOR`

## Documentation
- Requirements: docs/requirements.md
- Architecture: docs/architecture.md
- Workflows: docs/workflows.md
- Infrastructure: docs/infrastructure.md

## GSD Workflow Preferences

### Execution
- ALWAYS self-verify work by running verification commands.
- NEVER pause to show verification steps — execute them.
- ONLY stop if verification fails and you can't automatically fix it.
- Upon completing a phase, automatically run /clear and start the next phase.
- ONLY run Discussion phase if truly required.

### Research Policy

Before planning a phase, evaluate whether research is needed:

Run research when:
- Phase involves unfamiliar libraries, APIs, or services
- Architectural decisions are required
- Integrating external systems
- Phase scope is ambiguous or complex

Skip research when:
- Patterns are already established from earlier phases
- Straightforward CRUD, UI, or config work
- Domain is well understood
- Phase builds directly on existing code patterns

If in doubt, skip research and proceed — we can research if execution reveals gaps.

## Testing

### Framework
- Use Vitest for unit tests
- Use Playwright for E2E/integration tests
- Test files live in tests/ directory

### Test File Organization

    tests/
    |-- unit/
    |   |-- server/            # Bridge server unit tests
    |   +-- client/            # React component tests
    |-- integration/
    |   +-- test_websocket.ts  # WebSocket protocol tests
    +-- e2e/
        +-- test_session.ts    # Full browser-to-CLI flows

### Test Naming

    files:     test_<feature>.ts
    functions: test_<action>_<expected_outcome>()

### Running Tests

    npm test                   # Run all unit tests
    npm run test:e2e           # Run Playwright E2E tests
    npx playwright test --headed  # E2E with visible browser

### Test Requirements
- REQUIRED: Every new feature must include tests before marking complete.
- ALWAYS run related tests after code changes and fix any failures.
- ALWAYS include detailed assertions with meaningful error messages.
- ALWAYS update test scripts whenever functionality changes.

## Code Patterns to Follow

- REQUIRED: Type hints / TypeScript strict mode on all code.
- REQUIRED: Async/await for all I/O operations.
- LIMIT: Functions to no more than 30 lines — split up functions that are longer.
- LIMIT: Files to no more than 200 lines — break up files when they grow larger.

### Naming Conventions

    files:      kebab-case        (session-manager.ts)
    classes:    PascalCase        (SessionManager)
    functions:  camelCase         (handleMessage())
    constants:  UPPER_SNAKE_CASE  (MAX_RECONNECT_RETRIES)
    private:    _underscore       (_parseNdjson())
    types:      PascalCase        (CliMessage, ControlRequest)

## Running the App

### Start the server:

    npm run dev

Then open http://localhost:3000

### First-time setup:
1. Clone the repo
2. `npm install`
3. Copy `.env.example` to `.env`
4. Ensure `claude` CLI is installed and authenticated
5. `npm run dev`

## Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| PORT | Bridge server port | 8765 |
| CLIENT_PORT | Frontend dev server port | 3000 |
| CLAUDE_CODE_SESSION_ACCESS_TOKEN | Auth token for CLI WebSocket | (required) |

## Destructive Action Guard (MANDATORY)

**NEVER perform destructive or structural changes without explicit user approval.** This applies at ALL autonomy levels.

Before any of these actions, STOP and ask the user:
- Removing or replacing existing files/modules that contain working functionality
- Replacing an existing architecture pattern
- Removing API endpoints or changing response shapes that existing clients depend on
- Changing the WebSocket protocol message format (breaks CLI compatibility)
- Any change that would require other parts of the system to be rewritten

**Rule: "Adapt new code to existing structures, not the other way around."**

## Don't Do These Things

- NEVER skip TypeScript strict mode or type annotations.
- NEVER use synchronous I/O in the server.
- NEVER store credentials in code — use .env.
- NEVER make changes that touch more than 3 files without pausing to confirm approach.
- NEVER mark a feature complete without tests.
- NEVER write tests that depend on specific data states — use fixtures.
- NEVER modify the NDJSON protocol format without documenting the change in architecture.md.

## Reference Projects

- [The Vibe Companion](https://github.com/The-Vibe-Company/companion) — Full reverse-engineered `--sdk-url` protocol spec
- [claude-code-web](https://github.com/vultuk/claude-code-web) — PTY bridge approach
- [claude-relay](https://github.com/chadbyte/claude-relay) — Agent SDK bridge approach

# ClaudeWebCLI

## Branch Guard
**Expected branch**: main

## Project Overview

A web-based CLI interface for Claude Code that leverages the hidden `--sdk-url` flag. Instead of running Claude Code in a terminal, users interact through a browser-based terminal UI that communicates with Claude Code over WebSocket using the NDJSON protocol.

### Architecture (Three-Tier WebSocket Bridge)

```
+----------------+    WebSocket (NDJSON)    +------------------+    WebSocket (JSON)    +-------------+
| Claude Code    | <---------------------> |  Bridge Server    | <-------------------> |   Browser    |
|     CLI        |  /ws/cli/:session       |  (Node.js)        |  /ws/browser/:session |  (React +    |
|  --sdk-url     |                         |                   |                       |   xterm.js)  |
+----------------+                         +------------------+                        +-------------+
```

- **Left leg (CLI <-> Server):** NDJSON over WebSocket. Claude CLI is the WebSocket client.
- **Right leg (Server <-> Browser):** Standard JSON over WebSocket. Browser is the client.
- **Bridge Server:** Translates protocols, manages sessions, handles tool approval UI, persists session state.

### How `--sdk-url` Works

The CLI is launched with:
```bash
claude --sdk-url ws://localhost:8765 \
  --print \
  --output-format stream-json \
  --input-format stream-json \
  --verbose \
  -p "placeholder"
```

The `-p "placeholder"` prompt is ignored — the CLI waits for a `user` message over the WebSocket. Authentication is sent via `Authorization: Bearer <token>` on the WebSocket upgrade request.

## Where Things Live

| Need to find... | Look here |
|-----------------|-----------|
| Bridge server entry | server/index.ts |
| WebSocket handlers | server/ws/ |
| Session management | server/sessions/ |
| CLI process spawner | server/cli/ |
| Protocol types | shared/types.ts |
| Frontend app | client/src/App.tsx |
| Terminal component | client/src/components/Terminal.tsx |
| Tool approval UI | client/src/components/ToolApproval.tsx |
| WebSocket client hook | client/src/hooks/useWebSocket.ts |
| Static assets | client/public/ |
| Tests | tests/ |
| E2E tests | tests/e2e/ |

## Key Technologies

- TypeScript - Primary language (server + client)
- Node.js - Bridge server runtime
- ws - WebSocket server library
- React - Frontend UI framework
- xterm.js - Terminal emulator in browser
- Vite - Frontend build tool
- Vitest - Unit testing
- Playwright - E2E testing

## The `--sdk-url` WebSocket Protocol

### Connection Lifecycle
1. Server starts listening on a WebSocket port
2. Claude CLI is spawned with `--sdk-url ws://server:port`
3. CLI connects and sends `system/init` message (capabilities, tools, model, session_id)
4. Server sends first `user` message (the actual prompt from the browser)
5. CLI streams responses back as NDJSON messages
6. Tool permission requests arrive as `control_request` — server must respond within 30 seconds
7. After query completes, CLI sends `result` message
8. Multi-turn continues with new `user` messages using the same `session_id`

### Key Message Types (CLI -> Server)
| Type | Purpose |
|------|---------|
| `system` (init) | First message — session ID, tools, model, version |
| `system` (status) | Status changes (processing, waiting, complete) |
| `assistant` | Full assistant response with content blocks |
| `result` | Query complete marker |
| `stream_event` | Token-by-token streaming (requires `--verbose`) |
| `control_request` | Tool permission requests (e.g., `can_use_tool`) |

### Key Message Types (Server -> CLI)
| Type | Purpose |
|------|---------|
| `user` | Send prompts or follow-up messages |
| `control_response` | Respond to tool permission requests |
| `keep_alive` | Keepalive signal |

### Tool Approval Flow
```
CLI sends:   { type: "control_request", request: { subtype: "can_use_tool", request_id: "...", tool_name: "Bash", input: {...} } }
Server sends: { type: "control_response", response: { subtype: "success", request_id: "...", response: { behavior: "allow" } } }
```

### Authentication
Token sources (priority order):
1. `CLAUDE_CODE_SESSION_ACCESS_TOKEN` environment variable
2. Internal session ingress token
3. Token from `CLAUDE_CODE_WEBSOCKET_AUTH_FILE_DESCRIPTOR`

## Documentation
- Requirements: docs/requirements.md
- Architecture: docs/architecture.md
- Workflows: docs/workflows.md
- Infrastructure: docs/infrastructure.md

## GSD Workflow Preferences

### Execution
- ALWAYS self-verify work by running verification commands.
- NEVER pause to show verification steps — execute them.
- ONLY stop if verification fails and you can't automatically fix it.
- Upon completing a phase, automatically run /clear and start the next phase.
- ONLY run Discussion phase if truly required.

### Research Policy

Before planning a phase, evaluate whether research is needed:

Run research when:
- Phase involves unfamiliar libraries, APIs, or services
- Architectural decisions are required
- Integrating external systems
- Phase scope is ambiguous or complex

Skip research when:
- Patterns are already established from earlier phases
- Straightforward CRUD, UI, or config work
- Domain is well understood
- Phase builds directly on existing code patterns

If in doubt, skip research and proceed — we can research if execution reveals gaps.

## Testing

### Framework
- Use Vitest for unit tests
- Use Playwright for E2E/integration tests
- Test files live in tests/ directory

### Test File Organization

    tests/
    |-- unit/
    |   |-- server/            # Bridge server unit tests
    |   +-- client/            # React component tests
    |-- integration/
    |   +-- test_websocket.ts  # WebSocket protocol tests
    +-- e2e/
        +-- test_session.ts    # Full browser-to-CLI flows

### Test Naming

    files:     test_<feature>.ts
    functions: test_<action>_<expected_outcome>()

### Running Tests

    npm test                   # Run all unit tests
    npm run test:e2e           # Run Playwright E2E tests
    npx playwright test --headed  # E2E with visible browser

### Test Requirements
- REQUIRED: Every new feature must include tests before marking complete.
- ALWAYS run related tests after code changes and fix any failures.
- ALWAYS include detailed assertions with meaningful error messages.
- ALWAYS update test scripts whenever functionality changes.

## Code Patterns to Follow

- REQUIRED: Type hints / TypeScript strict mode on all code.
- REQUIRED: Async/await for all I/O operations.
- LIMIT: Functions to no more than 30 lines — split up functions that are longer.
- LIMIT: Files to no more than 200 lines — break up files when they grow larger.

### Naming Conventions

    files:      kebab-case        (session-manager.ts)
    classes:    PascalCase        (SessionManager)
    functions:  camelCase         (handleMessage())
    constants:  UPPER_SNAKE_CASE  (MAX_RECONNECT_RETRIES)
    private:    _underscore       (_parseNdjson())
    types:      PascalCase        (CliMessage, ControlRequest)

## Running the App

### Start the server:

    npm run dev

Then open http://localhost:3000

### First-time setup:
1. Clone the repo
2. `npm install`
3. Copy `.env.example` to `.env`
4. Ensure `claude` CLI is installed and authenticated
5. `npm run dev`

## Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| PORT | Bridge server port | 8765 |
| CLIENT_PORT | Frontend dev server port | 3000 |
| CLAUDE_CODE_SESSION_ACCESS_TOKEN | Auth token for CLI WebSocket | (required) |

## Destructive Action Guard (MANDATORY)

**NEVER perform destructive or structural changes without explicit user approval.** This applies at ALL autonomy levels.

Before any of these actions, STOP and ask the user:
- Removing or replacing existing files/modules that contain working functionality
- Replacing an existing architecture pattern
- Removing API endpoints or changing response shapes that existing clients depend on
- Changing the WebSocket protocol message format (breaks CLI compatibility)
- Any change that would require other parts of the system to be rewritten

**Rule: "Adapt new code to existing structures, not the other way around."**

## Don't Do These Things

- NEVER skip TypeScript strict mode or type annotations.
- NEVER use synchronous I/O in the server.
- NEVER store credentials in code — use .env.
- NEVER make changes that touch more than 3 files without pausing to confirm approach.
- NEVER mark a feature complete without tests.
- NEVER write tests that depend on specific data states — use fixtures.
- NEVER modify the NDJSON protocol format without documenting the change in architecture.md.

## Reference Projects

- [The Vibe Companion](https://github.com/The-Vibe-Company/companion) — Full reverse-engineered `--sdk-url` protocol spec
- [claude-code-web](https://github.com/vultuk/claude-code-web) — PTY bridge approach
- [claude-relay](https://github.com/chadbyte/claude-relay) — Agent SDK bridge approach

## GSD-T Workflow
This project uses contract-driven development.
- State: .gsd-t/progress.md
- Contracts: .gsd-t/contracts/
- Domains: .gsd-t/domains/

