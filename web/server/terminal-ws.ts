import * as pty from "node-pty";
import type { ServerWebSocket } from "bun";
import type { SocketData } from "./ws-bridge.js";

type TermWS = ServerWebSocket<SocketData>;

const processes = new Map<string, pty.IPty>();

export function handleTerminalOpen(ws: TermWS): void {
  const data = ws.data;
  if (data.kind !== "terminal") return;
  const { terminalId, cwd } = data;

  const isWindows = process.platform === "win32";
  const shell = isWindows ? "powershell.exe" : (process.env.SHELL || "bash");
  const args = isWindows ? ["-NoLogo"] : ["--login"];

  const proc = pty.spawn(shell, args, {
    name: "xterm-256color",
    cols: 80,
    rows: 24,
    cwd: cwd || undefined,
    env: process.env as Record<string, string>,
  });

  processes.set(terminalId, proc);

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
  const proc = processes.get(data.terminalId);
  if (!proc) return;

  try {
    const parsed = JSON.parse(String(msg)) as { type: string; data?: string; cols?: number; rows?: number };
    if (parsed.type === "input" && parsed.data) {
      try { proc.write(parsed.data); } catch {}
    } else if (parsed.type === "resize" && parsed.cols && parsed.rows) {
      try { proc.resize(parsed.cols, parsed.rows); } catch {}
    }
  } catch {
    try { proc.write(String(msg)); } catch {}
  }
}

export function handleTerminalClose(ws: TermWS): void {
  const data = ws.data;
  if (data.kind !== "terminal") return;
  const proc = processes.get(data.terminalId);
  if (proc) {
    proc.kill();
    processes.delete(data.terminalId);
  }
}
