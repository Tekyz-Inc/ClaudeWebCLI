import { useState, useEffect, useRef } from "react";
import { useStore } from "../store.js";
import { api } from "../api.js";
import { connectSession } from "../ws.js";
import type { ClaudeSession } from "../types.js";
import { usePollingTick } from "./usePollingTick.js";

/**
 * Fetches native Claude sessions for the active project CWD and auto-resumes
 * the most recent session on tab switch or first load.
 *
 * Uses the shared polling tick — a single module-level 5s timer drives every
 * polling hook. This hook samples every other tick to achieve a 10s cadence
 * without creating its own timer.
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
  const lastFetchTickRef = useRef<number>(-1);
  const activeProjectCwd = useStore((s) => s.activeProjectCwd);
  const currentSessionId = useStore((s) => s.currentSessionId);
  const resumeNativeSession = useStore((s) => s.resumeNativeSession);
  const setCurrentSession = useStore((s) => s.setCurrentSession);
  const tick = usePollingTick();

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
    // Recovery: session was cleared (e.g., stale after server restart) but
    // we still have a project — re-run auto-resume to find/create a session.
    const isRecovery = !currentSessionId && prevCwd === activeProjectCwd;
    let shouldAutoResume = isTabSwitch || isFirstLoad || isRecovery;
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

        // Switch away from old session if it belongs to a different project
        // (but keep its WebSocket alive so the CLI continues running)
        if (store.currentSessionId) {
          const curState = store.sessions.get(store.currentSessionId);
          const curCwd = (curState?.cwd || "").replace(/\\/g, "/");
          if (curCwd && curCwd !== pNorm && !curCwd.startsWith(pNorm + "/")) {
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
        const mappedExists = mappedId ? (store.sessions.has(mappedId) || store.sdkSessions.some((s) => s.sessionId === mappedId)) : false;
        if (mappedId && mappedExists) {
          const mappedState = store.sessions.get(mappedId);
          const mappedSdk = store.sdkSessions.find((s) => s.sessionId === mappedId);
          const mappedCwd = (mappedState?.cwd || mappedSdk?.cwd || "").replace(/\\/g, "/");
          if (mappedCwd && mappedCwd !== pNorm && !mappedCwd.startsWith(pNorm + "/")) {
            console.log("[Sidebar] stale mapping — session", mappedId, "CWD", mappedCwd, "doesn't match project", pNorm);
          } else {
            console.log("[Sidebar] restoring mapped session", mappedId);
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
      } catch (err) {
        // expected: server may not be ready yet during first boot or HMR
        if (import.meta.env.DEV) console.debug("[useAutoResumeSession] fetch error:", err);
      }
    }

    // Throttle tick-driven fetches to every other tick (~10s). State-change
    // effects (tab switch, first load, recovery) always fetch immediately.
    const ticksSinceLast = tick - lastFetchTickRef.current;
    if (!shouldAutoResume && ticksSinceLast > 0 && ticksSinceLast < 2) {
      return () => { active = false; };
    }
    lastFetchTickRef.current = tick;
    fetchNative();
    return () => {
      active = false;
    };
  }, [activeProjectCwd, currentSessionId, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  return { nativeSessions, resumingId };
}
