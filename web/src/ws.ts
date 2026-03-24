import { useStore } from "./store.js";
import { getToken } from "./api.js";
import type { BrowserIncomingMessage, BrowserOutgoingMessage } from "./types.js";
import {
  handleSessionInit,
  handleSessionUpdate,
  handleSessionNameUpdate,
} from "./ws-handlers/session-handler.js";
import {
  handleAssistant,
  handleStreamEvent,
  handleMessageHistory,
} from "./ws-handlers/message-handler.js";
import { handleResult } from "./ws-handlers/result-handler.js";
import {
  handlePermissionRequest,
  handlePermissionCancelled,
  handleStatusChange,
  handleAuthStatus,
  handleError,
  handleCliDisconnected,
  handleCliConnected,
  handleInitTimeout,
} from "./ws-handlers/control-handler.js";

// ─── HMR-safe module state ──────────────────────────────────────────────────
interface WsModuleState {
  sockets: Map<string, WebSocket>;
  reconnectTimers: Map<string, ReturnType<typeof setTimeout>>;
  reconnectDelays: Map<string, number>;
  pingIntervals: Map<string, ReturnType<typeof setInterval>>;
  taskCounters: Map<string, number>;
  processedToolUseIds: Map<string, Set<string>>;
}

const WIN = window as unknown as { __ws_state?: WsModuleState };
if (!WIN.__ws_state) {
  WIN.__ws_state = {
    sockets: new Map(),
    reconnectTimers: new Map(),
    reconnectDelays: new Map(),
    pingIntervals: new Map(),
    taskCounters: new Map(),
    processedToolUseIds: new Map(),
  };
}
const { sockets, reconnectTimers, reconnectDelays, pingIntervals, taskCounters, processedToolUseIds } =
  WIN.__ws_state;

const PING_INTERVAL_MS = 20_000;
const RECONNECT_MIN_MS = 2000;
const RECONNECT_MAX_MS = 30000;

function getWsUrl(sessionId: string): string {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  const token = getToken();
  const tokenParam = token ? `?token=${encodeURIComponent(token)}` : "";
  return `${proto}//${location.host}/ws/browser/${sessionId}${tokenParam}`;
}

function handleMessage(sessionId: string, event: MessageEvent) {
  let data: BrowserIncomingMessage;
  try {
    data = JSON.parse(event.data);
  } catch {
    return;
  }

  switch (data.type) {
    case "session_init":
      handleSessionInit(sessionId, data);
      break;
    case "session_update":
      handleSessionUpdate(sessionId, data);
      break;
    case "assistant":
      handleAssistant(sessionId, data, taskCounters, processedToolUseIds);
      break;
    case "stream_event":
      handleStreamEvent(sessionId, data);
      break;
    case "result":
      handleResult(sessionId, data);
      break;
    case "permission_request":
      handlePermissionRequest(sessionId, data, taskCounters, processedToolUseIds);
      break;
    case "permission_cancelled":
      handlePermissionCancelled(sessionId, data);
      break;
    case "status_change":
      handleStatusChange(sessionId, data);
      break;
    case "auth_status":
      handleAuthStatus(sessionId, data);
      break;
    case "error":
      handleError(sessionId, data);
      break;
    case "cli_disconnected":
      handleCliDisconnected(sessionId);
      break;
    case "cli_connected":
      handleCliConnected(sessionId);
      break;
    case "init_timeout":
      handleInitTimeout(sessionId);
      break;
    case "session_name_update":
      handleSessionNameUpdate(sessionId, data);
      break;
    case "message_history":
      handleMessageHistory(sessionId, data, taskCounters, processedToolUseIds);
      break;
    case "tool_progress":
    case "tool_use_summary":
      // Intentionally ignored
      break;
  }
}

export function connectSession(sessionId: string) {
  if (sockets.has(sessionId)) return;

  const store = useStore.getState();
  store.setConnectionStatus(sessionId, "connecting");

  const ws = new WebSocket(getWsUrl(sessionId));
  sockets.set(sessionId, ws);

  ws.onopen = () => {
    useStore.getState().setConnectionStatus(sessionId, "connected");
    reconnectDelays.delete(sessionId);
    const timer = reconnectTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      reconnectTimers.delete(sessionId);
    }
    const ping = setInterval(() => {
      const sock = sockets.get(sessionId);
      if (sock?.readyState === WebSocket.OPEN) {
        sock.send(JSON.stringify({ type: "ping" }));
      }
    }, PING_INTERVAL_MS);
    pingIntervals.set(sessionId, ping);
  };

  ws.onmessage = (event) => handleMessage(sessionId, event);

  ws.onclose = () => {
    sockets.delete(sessionId);
    const ping = pingIntervals.get(sessionId);
    if (ping) { clearInterval(ping); pingIntervals.delete(sessionId); }
    useStore.getState().setConnectionStatus(sessionId, "disconnected");
    scheduleReconnect(sessionId);
  };

  ws.onerror = () => { ws.close(); };
}

function scheduleReconnect(sessionId: string) {
  if (reconnectTimers.has(sessionId)) return;
  const prev = reconnectDelays.get(sessionId) ?? (RECONNECT_MIN_MS / 2);
  const delay = Math.min(prev * 2, RECONNECT_MAX_MS);
  reconnectDelays.set(sessionId, delay);
  const timer = setTimeout(() => {
    reconnectTimers.delete(sessionId);
    if (useStore.getState().currentSessionId === sessionId) {
      connectSession(sessionId);
    }
  }, delay);
  reconnectTimers.set(sessionId, timer);
}

export function disconnectSession(sessionId: string) {
  const timer = reconnectTimers.get(sessionId);
  if (timer) { clearTimeout(timer); reconnectTimers.delete(sessionId); }
  const ping = pingIntervals.get(sessionId);
  if (ping) { clearInterval(ping); pingIntervals.delete(sessionId); }
  const ws = sockets.get(sessionId);
  if (ws) { ws.close(); sockets.delete(sessionId); }
  processedToolUseIds.delete(sessionId);
  taskCounters.delete(sessionId);
}

export function disconnectAll() {
  for (const [id] of sockets) disconnectSession(id);
}

export function waitForConnection(sessionId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const check = setInterval(() => {
      const ws = sockets.get(sessionId);
      if (ws?.readyState === WebSocket.OPEN) {
        clearInterval(check);
        clearTimeout(timeout);
        resolve();
      }
    }, 50);
    const timeout = setTimeout(() => {
      clearInterval(check);
      reject(new Error("Connection timeout"));
    }, 10000);
  });
}

export function sendToSession(sessionId: string, msg: BrowserOutgoingMessage) {
  const ws = sockets.get(sessionId);
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

// ─── HMR: re-attach message handlers to surviving WebSocket connections ──
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    for (const [sessionId, ws] of sockets) {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.onmessage = (event) => handleMessage(sessionId, event);
      }
    }
    if (import.meta.env.DEV) {
      console.log("[ws] HMR: re-attached handlers to", sockets.size, "socket(s)");
    }
  });
}
