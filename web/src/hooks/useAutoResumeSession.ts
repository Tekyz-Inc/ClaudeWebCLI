import { useState, useEffect, useRef } from "react";
import { useStore } from "../store.js";
import { api } from "../api.js";
import { connectSession, disconnectSession } from "../ws.js";
import type { ClaudeSession } from "../types.js";

/**
 * Fetches native Claude sessions for the active project CWD and auto-resumes
 * the most recent session on tab switch or first load.
 *
 * Returns:
 * - nativeSessions: list of native CLI sessions for the active project
 * - resumingId: session ID currently being resumed (or null)
 */
export function useAutoResumeSession(): {
  nativeSessions: ClaudeSession[];
  resumingId: string | null;
} {
  const [nativeSessions, setNativeSessions] = useState<ClaudeSession[]>([]);
  const [resumingId, setResumingId] = useState<string | null>(null);
  // Use a ref outside React's closure to track the last CWD we actually processed.
  // This survives re-renders but resets on unmount — that's fine, because on
  // remount we want to treat the current activeProjectCwd as a "first load".
  const prevCwdRef = useRef<string | null>(null);
  const activeProjectCwd = useStore((s) => s.activeProjectCwd);
  const resumeNativeSession = useStore((s) => s.resumeNativeSession);
  const setCurrentSession = useStore((s) => s.setCurrentSession);

  useEffect(() => {
    if (!activeProjectCwd) {
      setNativeSessions([]);
      prevCwdRef.current = null;
      return;
    }

    const prevCwd = prevCwdRef.current;
    // A tab switch: CWD changed from a known previous value to a new one.
    const isTabSwitch = prevCwd !== null && prevCwd !== activeProjectCwd;
    // First load: no previous CWD known in this mount.
    const isFirstLoad = prevCwd === null;
    // Auto-resume whenever the project changes (tab switch or first mount).
    // We don't gate on currentSessionId here — the resume logic below handles
    // the case where a session already exists for this project.
    let shouldAutoResume = isTabSwitch || isFirstLoad;
    prevCwdRef.current = activeProjectCwd;
    let active = true;

    async function fetchNative() {
      try {
        const list = await api.getClaudeSessions(activeProjectCwd!);
        if (!active) return;
        setNativeSessions(list);

        if (!shouldAutoResume) return;
        shouldAutoResume = false;

        const store = useStore.getState();
        const pNorm = activeProjectCwd!.replace(/\\/g, "/");

        // Disconnect old session if it belongs to a different project
        if (store.currentSessionId) {
          const curState = store.sessions.get(store.currentSessionId);
          const curCwd = (curState?.cwd || "").replace(/\\/g, "/");
          if (curCwd && curCwd !== pNorm && !curCwd.startsWith(pNorm + "/")) {
            disconnectSession(store.currentSessionId);
            setCurrentSession(null);
          }
        }

        console.log("[Sidebar] auto-resume for", pNorm, {
          currentSessionId: store.currentSessionId,
          mappedId: store.projectSessionMap.get(pNorm),
          nativeCount: list.length,
        });

        // 1. Check project→session map (remembers last session for this tab)
        const mappedId = store.projectSessionMap.get(pNorm);
        const mappedMsgs = mappedId ? (store.messages.get(mappedId) || []) : [];
        if (mappedId && mappedMsgs.length > 0) {
          const mappedState = store.sessions.get(mappedId);
          const mappedSdk = store.sdkSessions.find((s) => s.sessionId === mappedId);
          const mappedCwd = (mappedState?.cwd || mappedSdk?.cwd || "").replace(/\\/g, "/");
          if (mappedCwd && mappedCwd !== pNorm && !mappedCwd.startsWith(pNorm + "/")) {
            console.log("[Sidebar] stale mapping — session", mappedId, "CWD", mappedCwd, "doesn't match project", pNorm);
          } else {
            console.log("[Sidebar] restoring mapped session", mappedId, "with", mappedMsgs.length, "messages");
            connectSession(mappedId);
            setCurrentSession(mappedId);
            return;
          }
        }

        // 2. Check bridge sessions (real-time, always up to date)
        let existingId: string | null = null;
        for (const [id, state] of store.sessions) {
          const sCwd = (state.cwd || "").replace(/\\/g, "/");
          if (sCwd === pNorm || sCwd.startsWith(pNorm + "/")) {
            existingId = id;
            break;
          }
        }

        // 3. Fall back to polled SDK sessions
        if (!existingId) {
          const existingSession = store.sdkSessions.find((s) => {
            if (s.archived || s.state === "exited") return false;
            const sCwd = (s.cwd || "").replace(/\\/g, "/");
            return sCwd === pNorm || sCwd.startsWith(pNorm + "/");
          });
          if (existingSession) existingId = existingSession.sessionId;
        }

        if (existingId) {
          console.log("[Sidebar] reconnecting existing session", existingId);
          connectSession(existingId);
          setCurrentSession(existingId);
        } else if (list.length > 0) {
          console.log("[Sidebar] resuming native session", list[0].id);
          const s = list[0];
          setResumingId(s.id);
          resumeNativeSession(s.id, s.cwd).finally(() => setResumingId(null));
        } else {
          console.log("[Sidebar] no session found for project");
        }
      } catch {
        // server not ready
      }
    }

    fetchNative();
    const interval = setInterval(fetchNative, 10000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [activeProjectCwd]); // eslint-disable-line react-hooks/exhaustive-deps

  return { nativeSessions, resumingId };
}
