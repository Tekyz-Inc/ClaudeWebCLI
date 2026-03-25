#!/usr/bin/env node
/**
 * Terminal bridge — runs under Node.js (not Bun) because node-pty's ConPTY
 * pipes are incompatible with Bun's socket implementation.
 *
 * Communicates with the parent Bun process via stdin/stdout JSON lines.
 * Protocol:
 *   Parent → Child: { type: "input", data: string } | { type: "resize", cols, rows }
 *   Child → Parent: { type: "output", data: string } | { type: "exit", code } | { type: "error", data }
 */
const pty = require("node-pty");
const path = require("path");

const cwd = process.argv[2] || undefined;
const normalizedCwd = cwd ? path.normalize(cwd) : undefined;

const isWindows = process.platform === "win32";
const shell = isWindows ? "powershell.exe" : (process.env.SHELL || "bash");
const args = isWindows ? ["-NoLogo"] : ["--login"];

let proc;
try {
  proc = pty.spawn(shell, args, {
    name: "xterm-256color",
    cols: 80,
    rows: 24,
    cwd: normalizedCwd,
    env: process.env,
  });
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  process.stdout.write(JSON.stringify({ type: "error", data: `Failed to start terminal: ${msg}` }) + "\n");
  process.exit(1);
}

// PTY output → parent
proc.onData((chunk) => {
  process.stdout.write(JSON.stringify({ type: "output", data: chunk }) + "\n");
});

proc.onExit(({ exitCode }) => {
  process.stdout.write(JSON.stringify({ type: "exit", code: exitCode }) + "\n");
  process.exit(0);
});

// Parent input → PTY
let buffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  const lines = buffer.split("\n");
  buffer = lines.pop() || "";
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.type === "input" && msg.data) {
        proc.write(msg.data);
      } else if (msg.type === "resize" && msg.cols && msg.rows) {
        proc.resize(msg.cols, msg.rows);
      }
    } catch {}
  }
});

process.stdin.on("end", () => {
  proc.kill();
  process.exit(0);
});
