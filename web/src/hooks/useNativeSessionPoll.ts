import { useEffect } from "react";
import { useStore } from "../store.js";
import { api } from "../api.js";

/**
 * Polls the server for SDK sessions every 5 seconds.
 * Hydrates session names from server responses (server is source of truth).
 */
export function useNativeSessionPoll() {
  useEffect(() => {
    let active = true;

    async function poll() {
      try {
        const list = await api.listSessions();
        if (!active) return;
        useStore.getState().setSdkSessions(list);
        const store = useStore.getState();
        for (const s of list) {
          if (!s.name) continue;
          const currentName = store.sessionNames.get(s.sessionId);
          const hasRandomName = !!currentName && /^[A-Z][a-z]+ [A-Z][a-z]+$/.test(currentName);
          const needsUpdate = !currentName || hasRandomName;
          if (!needsUpdate) continue;
          if (currentName !== s.name) {
            store.setSessionName(s.sessionId, s.name);
            if (hasRandomName) store.markRecentlyRenamed(s.sessionId);
          }
        }
      } catch {
        // server not ready
      }
    }

    poll();
    const interval = setInterval(poll, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);
}
