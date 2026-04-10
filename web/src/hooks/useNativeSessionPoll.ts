import { useEffect, useRef } from "react";
import { useStore } from "../store.js";
import { api } from "../api.js";
import { connectSession } from "../ws.js";
import { usePollingTick } from "./usePollingTick.js";

/**
 * Polls the server for SDK sessions every 5 seconds.
 * Hydrates session names from server responses (server is source of truth).
 * Auto-connects when a new CLI session appears for the current project.
 *
 * Uses the shared polling tick — a single module-level timer drives every
 * polling hook in the app, so we avoid redundant timers and racing fetches.
 */
export function useNativeSessionPoll() {
  const staleCountRef = useRef(0);
  const tick = usePollingTick();

  useEffect(() => {
    let active = true;

    async function poll() {
      try {
        const list = await api.listSessions();
        if (!active) return;
        useStore.getState().setSdkSessions(list);
        const store = useStore.getState();

        // Auto-connect: if no current session, find the newest active session
        // for the current project and connect to it
        if (!store.currentSessionId || !store.cliConnected.get(store.currentSessionId)) {
          const pNorm = (store.activeProjectCwd || "").replace(/\\/g, "/");
          if (pNorm) {
            const match = list.find((s) => {
              if (s.archived || s.state === "exited") return false;
              const sCwd = (s.cwd || "").replace(/\\/g, "/");
              return sCwd === pNorm || sCwd.startsWith(pNorm + "/");
            });
            if (match && match.sessionId !== store.currentSessionId) {
              connectSession(match.sessionId);
              store.setCurrentSession(match.sessionId);
              staleCountRef.current = 0;
            } else if (match && match.sessionId === store.currentSessionId) {
              // Session exists but WS might be stale — ensure it's connected
              connectSession(match.sessionId);
              staleCountRef.current = 0;
            } else if (store.currentSessionId && !match) {
              // No server session found for this project. If the WS is connected
              // but CLI is disconnected, the session is stale (server restarted).
              // After 2 consecutive polls (10s), clear it so auto-resume can recover.
              const wsStatus = store.connectionStatus.get(store.currentSessionId);
              if (wsStatus === "connected") {
                staleCountRef.current++;
                if (staleCountRef.current >= 2) {
                  console.log("[poll] Stale session", store.currentSessionId, "— clearing for recovery");
                  store.setCurrentSession(null);
                  staleCountRef.current = 0;
                }
              } else {
                staleCountRef.current = 0;
              }
            } else {
              staleCountRef.current = 0;
            }
          } else {
            staleCountRef.current = 0;
          }
        } else {
          staleCountRef.current = 0;
        }

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
      } catch (err) {
        // expected: server may not be ready yet during first boot or HMR
        if (import.meta.env.DEV) console.debug("[useNativeSessionPoll] fetch error:", err);
      }
    }

    poll();
    return () => {
      active = false;
    };
  }, [tick]);
}
