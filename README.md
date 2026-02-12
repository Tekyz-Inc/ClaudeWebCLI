# ClaudeWebCLI

**Version:** 0.2.0
**Forked from:** [The Vibe Companion](https://github.com/The-Vibe-Company/companion) v0.14.1

Claude Code in your browser. We reverse-engineered the undocumented WebSocket protocol hidden inside the CLI and built a web UI on top of it. No API key needed — it runs on your existing Claude Code subscription.

```bash
bunx the-vibe-companion
```

Open [localhost:3456](http://localhost:3456). That's it.

## Features

- **Multiple sessions.** Run several Claude Code instances side by side. Each gets its own process, model, and permission settings.
- **Streaming.** Responses render token by token. You see what the agent is writing as it writes it.
- **Tool call visibility.** Every Bash command, file read, edit, grep — visible in collapsible blocks with syntax highlighting.
- **Subagent nesting.** When an agent spawns sub-agents, their work renders hierarchically.
- **Permission control.** Four modes: Agent (auto-approve), Accept Edits, Plan, and Manual.
- **Session persistence.** Sessions save to disk and auto-recover with `--resume` after server restarts or CLI crashes.
- **Environment profiles.** Store API keys and config per-project in `~/.companion/envs/`.
- **Voice dictation.** Push-to-talk via Web Speech API — speak your prompts instead of typing.
- **Prompt history.** Up/Down arrow keys navigate through previous prompts, like a terminal.
- **Drag-and-drop images.** Drop image files onto the composer to attach them.
- **Project detection.** Auto-detects project type (Node, Python, Rust) from working directory.
- **Desktop notifications.** Get notified when sessions complete or need permission while the tab is in the background.
- **Context meter.** Visual indicator of context window usage with color-coded thresholds.

## How it works

The Claude Code CLI has a hidden `--sdk-url` flag. When set, it connects to a WebSocket server instead of running in a terminal. The protocol is NDJSON (newline-delimited JSON).

```
+--------------+    WebSocket (NDJSON)    +-----------------+    WebSocket (JSON)    +-------------+
| Claude Code  | <---------------------> |   Bun + Hono    | <-------------------> |   Browser   |
|     CLI      |  /ws/cli/:session       |     Server      |  /ws/browser/:session |   (React)   |
+--------------+                         +-----------------+                       +-------------+
```

1. You type a prompt in the browser
2. Server spawns `claude --sdk-url ws://localhost:3456/ws/cli/SESSION_ID`
3. CLI connects back over WebSocket
4. Messages flow both ways: your prompts to the CLI, streaming responses back
5. Tool calls show up as approval prompts in the browser

Full protocol documentation: [`WEBSOCKET_PROTOCOL_REVERSED.md`](WEBSOCKET_PROTOCOL_REVERSED.md).

## Development

```bash
git clone https://github.com/Tekyz-Inc/ClaudeWebCLI.git
cd ClaudeWebCLI/web
bun install
bun run dev       # backend + Vite HMR on :5174
```

Production: `bun run build && bun run start` serves everything on `:3456`.

## Tech stack

Bun runtime, Hono server, React 19, Zustand, Tailwind v4, Vite.

## Testing

```bash
cd web
bun run test          # Run all tests
bun run test:watch    # Watch mode
bun run typecheck     # TypeScript strict mode check
```

## Documentation

- [Requirements](docs/requirements.md)
- [Architecture](docs/architecture.md)
- [Workflows](docs/workflows.md)
- [Infrastructure](docs/infrastructure.md)

## License

MIT
