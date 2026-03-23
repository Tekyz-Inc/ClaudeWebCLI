import type { BrowserIncomingMessage } from "../types.js";
import { useStore } from "../store.js";
import { sendNotification } from "../utils/notifications.js";
import { nextId, extractTasksFromBlocks, extractChangedFilesFromBlocks } from "./shared.js";

export function handlePermissionRequest(
  sessionId: string,
  data: Extract<BrowserIncomingMessage, { type: "permission_request" }>,
  taskCounters: Map<string, number>,
  processedToolUseIds: Map<string, Set<string>>,
) {
  const store = useStore.getState();
  store.addPermission(sessionId, data.request);

  const permSessionName = store.sessionNames.get(sessionId) || "Session";
  sendNotification(`${permSessionName} — Permission Needed`, {
    body: `${data.request.tool_name}: approve or deny`,
    sessionId,
  });

  const req = data.request;
  if (req.tool_name && req.input) {
    const permBlocks = [{
      type: "tool_use" as const,
      id: req.tool_use_id,
      name: req.tool_name,
      input: req.input,
    }];
    extractTasksFromBlocks(sessionId, permBlocks, taskCounters, processedToolUseIds);
    extractChangedFilesFromBlocks(sessionId, permBlocks);
  }
}

export function handlePermissionCancelled(
  sessionId: string,
  data: Extract<BrowserIncomingMessage, { type: "permission_cancelled" }>,
) {
  useStore.getState().removePermission(sessionId, data.request_id);
}

export function handleStatusChange(
  sessionId: string,
  data: Extract<BrowserIncomingMessage, { type: "status_change" }>,
) {
  if (data.status === "compacting") {
    useStore.getState().setSessionStatus(sessionId, "compacting");
  }
}

export function handleAuthStatus(
  sessionId: string,
  data: Extract<BrowserIncomingMessage, { type: "auth_status" }>,
) {
  if (data.error) {
    useStore.getState().appendMessage(sessionId, {
      id: nextId(),
      role: "system",
      content: `Auth error: ${data.error}`,
      timestamp: Date.now(),
    });
  }
}

export function handleError(
  sessionId: string,
  data: Extract<BrowserIncomingMessage, { type: "error" }>,
) {
  useStore.getState().appendMessage(sessionId, {
    id: nextId(),
    role: "system",
    content: data.message,
    timestamp: Date.now(),
  });
}

export function handleCliDisconnected(sessionId: string) {
  const store = useStore.getState();
  store.setCliConnected(sessionId, false);
  store.setSessionStatus(sessionId, null);
}

export function handleCliConnected(sessionId: string) {
  useStore.getState().setCliConnected(sessionId, true);
}

export function handleInitTimeout(sessionId: string) {
  useStore.getState().appendMessage(sessionId, {
    id: nextId(),
    role: "system",
    content: "Session stalled — CLI connected but never initialized. Auto-relaunching...",
    timestamp: Date.now(),
  });
}
