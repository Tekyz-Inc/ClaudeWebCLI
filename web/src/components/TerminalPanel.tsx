import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

const DARK_THEME = {
  background: "#0d0d14",
  foreground: "#e2e8f0",
  cursor: "#a78bfa",
  selectionBackground: "#4a5568",
  black: "#0d0d14",    brightBlack: "#4a5568",
  red: "#fc8181",       brightRed: "#fc8181",
  green: "#68d391",     brightGreen: "#68d391",
  yellow: "#fbbf24",    brightYellow: "#f6e05e",
  blue: "#63b3ed",      brightBlue: "#7f9cf5",
  magenta: "#b794f4",   brightMagenta: "#e879f9",
  cyan: "#4fd1c5",      brightCyan: "#38bdf8",
  white: "#e2e8f0",     brightWhite: "#f8fafc",
};

interface Props {
  cwd?: string;
}

export function TerminalPanel({ cwd }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const idRef = useRef(Math.random().toString(36).slice(2, 10));
  const [connected, setConnected] = useState(false);

  // Initialize once — terminal + WS persist across open/close
  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cols: 80,
      rows: 24,
      cursorBlink: true,
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.4,
      theme: DARK_THEME,
      scrollback: 5000,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    // Don't fit immediately — container may be hidden (0px); ResizeObserver handles it
    termRef.current = term;
    fitRef.current = fit;

    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const cwdParam = cwd ? `?cwd=${encodeURIComponent(cwd)}` : "";
    const ws = new WebSocket(`${proto}//${location.host}/ws/terminal/${idRef.current}${cwdParam}`);
    wsRef.current = ws;

    ws.onopen = () => { setConnected(true); };
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as { type: string; data?: string; code?: number };
        if (msg.type === "output" && msg.data) term.write(msg.data);
        else if (msg.type === "exit") term.writeln(`\r\n\x1b[33m● Exited (${msg.code})\x1b[0m`);
      } catch {}
    };
    ws.onclose = () => { setConnected(false); term.writeln("\r\n\x1b[31m● Disconnected\x1b[0m"); };

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "input", data }));
      }
    });

    // Auto-refit when container resizes, then notify server of new dimensions
    const observer = new ResizeObserver(() => {
      const el = containerRef.current;
      if (!el || el.clientWidth < 10) return;
      fit.fit();
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
      }
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      ws.close();
      term.dispose();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cwdLabel = cwd ? cwd.replace(/\\/g, "/").split("/").pop() : undefined;

  return (
    <div className="h-full flex flex-col" style={{ background: DARK_THEME.background }}>
      {/* Header */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-white/10">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5 text-white/50 shrink-0">
          <polyline points="3 11 6 8 3 5" />
          <line x1="8" y1="11" x2="13" y2="11" />
        </svg>
        <span className="text-[11px] text-white/60 font-mono">Terminal</span>
        {cwdLabel && (
          <span className="text-[11px] text-white/30 font-mono truncate">— {cwdLabel}</span>
        )}
        <span className={`ml-auto text-[10px] font-medium ${connected ? "text-green-400" : "text-white/30"}`}>
          {connected ? "● Connected" : "● Disconnected"}
        </span>
      </div>
      {/* xterm container */}
      <div ref={containerRef} className="flex-1 overflow-hidden" style={{ padding: "4px 8px" }} />
    </div>
  );
}
