import { spawn } from "bun";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ServerWebSocket } from "bun";
import type { SocketData } from "./ws-bridge.js";

type TermWS = ServerWebSocket<SocketData>;

interface TermEntry {
  proc: ReturnType<typeof spawn>;
  ws: TermWS;
}

const processes = new Map<string, TermEntry>();

const bridgeScript = resolve(
  fileURLToPath(import.meta.url),
  "..",
  "terminal-node.cjs",
);

export function handleTerminalOpen(ws: TermWS): void {
  const data = ws.data;
  if (data.kind !== "terminal") return;
  const { terminalId, cwd } = data;

  // Kill any existing process for this terminal ID
  const existing = processes.get(terminalId);
  if (existing) {
    existing.proc.kill();
    processes.delete(terminalId);
  }

  const args = ["--no-warnings", bridgeScript];
  if (cwd) args.push(cwd);

  let proc: ReturnType<typeof spawn>;
  try {
    proc = spawn(["node", ...args], {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    try { ws.send(JSON.stringify({ type: "error", data: `Failed to start terminal: ${msg}` })); } catch {}
    return;
  }

  processes.set(terminalId, { proc, ws });

  const stdout = proc.stdout as ReadableStream<Uint8Array>;
  const stderr = proc.stderr as ReadableStream<Uint8Array>;

  // Read stdout and forward to browser
  (async () => {
    try {
      const reader = stdout.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try { ws.send(line); } catch {}
        }
      }
    } catch (err) {
      console.error(`[terminal] stdout read error for ${terminalId}:`, err);
    }
    processes.delete(terminalId);
    try { ws.send(JSON.stringify({ type: "exit", code: proc.exitCode ?? 1 })); } catch {}
  })();

  // Log stderr
  (async () => {
    try {
      const reader = stderr.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        console.error(`[terminal] stderr ${terminalId}:`, decoder.decode(value));
      }
    } catch {}
  })();
}

export function handleTerminalMessage(ws: TermWS, msg: string | Buffer): void {
  const data = ws.data;
  if (data.kind !== "terminal") return;
  const entry = processes.get(data.terminalId);
  if (!entry) {
    console.warn(`[terminal] no process for ${data.terminalId}`);
    return;
  }

  try {
    const writer = entry.proc.stdin as import("bun").FileSink;
    writer.write(String(msg) + "\n");
    writer.flush();
  } catch (err) {
    console.error(`[terminal] stdin write error for ${data.terminalId}:`, err);
  }
}

export function handleTerminalClose(ws: TermWS): void {
  const data = ws.data;
  if (data.kind !== "terminal") return;
  const entry = processes.get(data.terminalId);
  if (entry && entry.ws === ws) {
    entry.proc.kill();
    processes.delete(data.terminalId);
  }
}
