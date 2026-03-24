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
  isVisible?: boolean;
}

export function TerminalPanel({ cwd, isVisible }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const openedRef = useRef(false);
  const idRef = useRef(Math.random().toString(36).slice(2, 10));
  const [connected, setConnected] = useState(false);

  // Create terminal object + WebSocket once on mount.
  // Do NOT call term.open() here — the container is zero-size until the panel
  // first becomes visible, and xterm v6 requires non-zero dimensions at open time.
  useEffect(() => {
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

    return () => {
      observerRef.current?.disconnect();
      ws.close();
      term.dispose();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // When the panel becomes visible: open xterm into the DOM (first time only),
  // fit to container, then focus so keystrokes work immediately.
  useEffect(() => {
    if (!isVisible) return;
    const term = termRef.current;
    const fit = fitRef.current;
    const container = containerRef.current;
    if (!term || !fit || !container) return;

    // Attach xterm to the DOM the very first time the panel is shown
    if (!openedRef.current) {
      openedRef.current = true;
      term.open(container);

      // Watch for resize after first open
      const observer = new ResizeObserver(() => {
        if (!containerRef.current || containerRef.current.clientWidth < 10) return;
        fit.fit();
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
        }
      });
      observer.observe(container);
      observerRef.current = observer;
    }

    // Fit + focus after the CSS slide transition completes (200ms in App.tsx).
    // Focusing before the panel is fully expanded causes the xterm textarea to be
    // clipped by overflow-hidden on the parent, silently swallowing all keystrokes.
    const id = setTimeout(() => {
      fit.fit();
      term.focus();
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
      }
    }, 220);

    return () => clearTimeout(id);
  }, [isVisible]);

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
      {/* xterm container — click to re-focus the terminal */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden"
        style={{ padding: "4px 8px" }}
        onClickCapture={() => termRef.current?.focus()}
      />
    </div>
  );
}
