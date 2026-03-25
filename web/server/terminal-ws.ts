import * as pty from "node-pty";
import path from "node:path";
import type { ServerWebSocket } from "bun";
import type { SocketData } from "./ws-bridge.js";

type TermWS = ServerWebSocket<SocketData>;

interface TermEntry {
  proc: pty.IPty;
  ws: TermWS;
}

const processes = new Map<string, TermEntry>();

export function handleTerminalOpen(ws: TermWS): void {
  const data = ws.data;
  if (data.kind !== "terminal") return;
  const { terminalId } = data;
  // Normalize cwd to OS-native path separators — node-pty on Windows
  // requires backslashes, but the browser sends forward-slash paths.
  const cwd = data.cwd ? path.normalize(data.cwd) : undefined;

  // Kill any existing process for this terminal ID before spawning a new one
  const existing = processes.get(terminalId);
  if (existing) {
    try { existing.proc.kill(); } catch {}
    processes.delete(terminalId);
  }

  const isWindows = process.platform === "win32";
  const shell = isWindows ? "powershell.exe" : (process.env.SHELL || "bash");
  const args = isWindows ? ["-NoLogo"] : ["--login"];

  let proc: pty.IPty;
  try {
    proc = pty.spawn(shell, args, {
      name: "xterm-256color",
      cols: 80,
      rows: 24,
      cwd: cwd || undefined,
      env: process.env as Record<string, string>,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    try { ws.send(JSON.stringify({ type: "error", data: `Failed to start terminal: ${msg}` })); } catch {}
    return;
  }

  processes.set(terminalId, { proc, ws });

  proc.onData((chunk) => {
    try { ws.send(JSON.stringify({ type: "output", data: chunk })); } catch {}
  });

  proc.onExit(({ exitCode }) => {
    processes.delete(terminalId);
    try { ws.send(JSON.stringify({ type: "exit", code: exitCode })); } catch {}
  });
}

export function handleTerminalMessage(ws: TermWS, msg: string | Buffer): void {
  const data = ws.data;
  if (data.kind !== "terminal") return;
  const entry = processes.get(data.terminalId);
  if (!entry) return;

  try {
    const parsed = JSON.parse(String(msg)) as { type: string; data?: string; cols?: number; rows?: number };
    if (parsed.type === "input" && parsed.data) {
      try { entry.proc.write(parsed.data); } catch {}
    } else if (parsed.type === "resize" && parsed.cols && parsed.rows) {
      try { entry.proc.resize(parsed.cols, parsed.rows); } catch {}
    }
  } catch {
    try { entry.proc.write(String(msg)); } catch {}
  }
}

export function handleTerminalClose(ws: TermWS): void {
  const data = ws.data;
  if (data.kind !== "terminal") return;
  const entry = processes.get(data.terminalId);
  // Only kill the PTY if this is the same WS that spawned it.
  // React Strict Mode double-invokes effects: WS1 opens, WS2 opens, WS1 closes.
  // Without this guard, WS1's close kills WS2's PTY.
  if (entry && entry.ws === ws) {
    try { entry.proc.kill(); } catch {}
    processes.delete(data.terminalId);
  }
}
