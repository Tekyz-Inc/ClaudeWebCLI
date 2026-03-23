import type { BrowserIncomingMessage } from "../types.js";
import { useStore } from "../store.js";
import { generateUniqueSessionName } from "../utils/names.js";

export function handleSessionInit(
  sessionId: string,
  data: Extract<BrowserIncomingMessage, { type: "session_init" }>,
) {
  const store = useStore.getState();
  if (import.meta.env.DEV) {
    console.log("[ws] session_init slash_commands:", data.session.slash_commands, "skills:", data.session.skills);
  }
  if (store.sessions.has(sessionId)) {
    store.updateSession(sessionId, data.session);
  } else {
    store.addSession(data.session);
  }
  store.setCliConnected(sessionId, true);
  const existingStatus = store.sessionStatus.get(sessionId);
  if (existingStatus !== "submitted" && existingStatus !== "running") {
    store.setSessionStatus(sessionId, "idle");
  }
  if (!store.sessionNames.has(sessionId)) {
    const existingNames = new Set(store.sessionNames.values());
    const name = generateUniqueSessionName(existingNames);
    store.setSessionName(sessionId, name);
  }
}

export function handleSessionUpdate(
  sessionId: string,
  data: Extract<BrowserIncomingMessage, { type: "session_update" }>,
) {
  useStore.getState().updateSession(sessionId, data.session);
}

export function handleSessionNameUpdate(
  sessionId: string,
  data: Extract<BrowserIncomingMessage, { type: "session_name_update" }>,
) {
  const store = useStore.getState();
  const currentName = store.sessionNames.get(sessionId);
  const isRandomName = currentName && /^[A-Z][a-z]+ [A-Z][a-z]+$/.test(currentName);
  if (!currentName || isRandomName) {
    store.setSessionName(sessionId, data.name);
    store.markRecentlyRenamed(sessionId);
  }
}
