import { spawn } from "bun";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { ServerWebSocket } from "bun";
import type { SocketData } from "./ws-bridge.js";

/** Resolve full path to node binary (NVM-aware). */
let nodeBin = "node";
try {
  const cmd = process.platform === "win32" ? "where" : "which";
  nodeBin = execFileSync(cmd, ["node"], { encoding: "utf-8" }).trim().split("\n")[0];
} catch { /* fallback to bare "node" */ }

type TermWS = ServerWebSocket<SocketData>;

interface TermEntry {
  proc: ReturnType<typeof spawn>;
  ws: TermWS;
}

const processes = new Map<string, TermEntry>();
/** Pending spawn promises keyed by terminalId — serializes rapid reconnects. */
const spawnLocks = new Map<string, Promise<void>>();

const bridgeScript = resolve(
  fileURLToPath(import.meta.url),
  "..",
  "terminal-node.cjs",
);

export function handleTerminalOpen(ws: TermWS): void {
  const data = ws.data;
  if (data.kind !== "terminal") return;
  const { terminalId, cwd } = data;

  // Serialize spawns per terminalId so a rapid reconnect (tab switch, HMR)
  // waits for the previous process to actually exit before starting a new one.
  // This avoids the race where the new process writes to stdout while the old
  // process's exit event is still propagating, causing a "disconnected" flicker.
  const prior = spawnLocks.get(terminalId) ?? Promise.resolve();
  const next = prior.then(() => spawnTerminal(ws, terminalId, cwd)).catch((err) => {
    console.error(`[terminal] spawn chain error for ${terminalId}:`, err);
  });
  spawnLocks.set(terminalId, next);
  void next.finally(() => {
    if (spawnLocks.get(terminalId) === next) spawnLocks.delete(terminalId);
  });
}

async function spawnTerminal(ws: TermWS, terminalId: string, cwd: string | undefined): Promise<void> {
  // Kill any existing process and wait for it to exit before spawning a new one.
  const existing = processes.get(terminalId);
  if (existing) {
    try { existing.proc.kill(); } catch { /* expected: process may already be exiting */ }
    processes.delete(terminalId);
    try {
      await Promise.race([
        existing.proc.exited,
        new Promise((r) => setTimeout(r, 500)),
      ]);
    } catch (err) {
      console.warn(`[terminal] error awaiting prior exit for ${terminalId}:`, err);
    }
  }

  // If the websocket closed while we were waiting, abort the spawn.
  if (ws.readyState !== 1) {
    return;
  }

  const args = ["--no-warnings", bridgeScript];
  if (cwd) args.push(cwd);

  let proc: ReturnType<typeof spawn>;
  try {
    proc = spawn([nodeBin, ...args], {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[terminal] spawn failed for ${terminalId}:`, err);
    try {
      ws.send(JSON.stringify({ type: "error", data: `Failed to start terminal: ${msg}` }));
    } catch {
      // expected: ws may have closed during spawn failure
    }
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
          try { ws.send(line); } catch {
            // expected: ws may close mid-stream; loop ends when reader sees done
          }
        }
      }
    } catch (err) {
      console.error(`[terminal] stdout read error for ${terminalId}:`, err);
    }
    processes.delete(terminalId);
    try { ws.send(JSON.stringify({ type: "exit", code: proc.exitCode ?? 1 })); } catch {
      // expected: ws already closed when process exits
    }
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
    } catch {
      // expected: stderr stream closes when process exits
    }
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
