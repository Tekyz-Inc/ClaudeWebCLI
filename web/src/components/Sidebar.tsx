import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useStore } from "../store.js";
import { api } from "../api.js";
import { connectSession, disconnectSession } from "../ws.js";
import { EnvManager } from "./EnvManager.js";
import type { ClaudeSession } from "../types.js";
import { useNativeSessionPoll } from "../hooks/useNativeSessionPoll.js";
import { useAutoResumeSession } from "../hooks/useAutoResumeSession.js";

export function Sidebar() {
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [showEnvManager, setShowEnvManager] = useState(false);
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  const sessions = useStore((s) => s.sessions);
  const sdkSessions = useStore((s) => s.sdkSessions);
  const currentSessionId = useStore((s) => s.currentSessionId);
  const setCurrentSession = useStore((s) => s.setCurrentSession);
  const darkMode = useStore((s) => s.darkMode);
  const toggleDarkMode = useStore((s) => s.toggleDarkMode);
  const cliConnected = useStore((s) => s.cliConnected);
  const sessionStatus = useStore((s) => s.sessionStatus);
  const removeSession = useStore((s) => s.removeSession);
  const sessionNames = useStore((s) => s.sessionNames);
  const recentlyRenamed = useStore((s) => s.recentlyRenamed);
  const pendingPermissions = useStore((s) => s.pendingPermissions);
  const activeProjectCwd = useStore((s) => s.activeProjectCwd);

  // Extracted hooks
  useNativeSessionPoll();
  const { nativeSessions, resumingId } = useAutoResumeSession();

  function handleSelectSession(sessionId: string) {
    if (currentSessionId === sessionId) return;
    if (currentSessionId) disconnectSession(currentSessionId);
    setCurrentSession(sessionId);
    connectSession(sessionId);
    if (window.innerWidth < 768) useStore.getState().setSidebarOpen(false);
  }

  function handleNewSession() {
    if (currentSessionId) disconnectSession(currentSessionId);
    useStore.getState().newSession();
    if (window.innerWidth < 768) useStore.getState().setSidebarOpen(false);
  }

  useEffect(() => {
    if (editingSessionId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingSessionId]);

  function confirmRename() {
    if (editingSessionId && editingName.trim()) {
      useStore.getState().setSessionName(editingSessionId, editingName.trim());
      api.renameSession(editingSessionId, editingName.trim()).catch(() => {});
    }
    setEditingSessionId(null);
    setEditingName("");
  }

  function cancelRename() {
    setEditingSessionId(null);
    setEditingName("");
  }

  const handleDeleteSession = useCallback(async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    try {
      disconnectSession(sessionId);
      await api.deleteSession(sessionId);
    } catch {
      // best-effort
    }
    removeSession(sessionId);
  }, [removeSession]);

  const handleArchiveSession = useCallback((e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    const sdkInfo = sdkSessions.find((s) => s.sessionId === sessionId);
    const bridgeState = sessions.get(sessionId);
    const isWorktree = bridgeState?.is_worktree || sdkInfo?.isWorktree || false;
    if (isWorktree) { setConfirmArchiveId(sessionId); return; }
    doArchive(sessionId);
  }, [sdkSessions, sessions]);

  const doArchive = useCallback(async (sessionId: string, force?: boolean) => {
    try {
      disconnectSession(sessionId);
      await api.archiveSession(sessionId, force ? { force: true } : undefined);
    } catch {
      // best-effort
    }
    if (useStore.getState().currentSessionId === sessionId) {
      useStore.getState().newSession();
    }
    try {
      const list = await api.listSessions();
      useStore.getState().setSdkSessions(list);
    } catch {
      // best-effort
    }
  }, []);

  const confirmArchive = useCallback(() => {
    if (confirmArchiveId) { doArchive(confirmArchiveId, true); setConfirmArchiveId(null); }
  }, [confirmArchiveId, doArchive]);

  const cancelArchive = useCallback(() => { setConfirmArchiveId(null); }, []);

  const handleKillAll = useCallback(async () => {
    const targets = sdkSessions.filter((s) => !s.archived && s.state !== "exited");
    await Promise.all(targets.map((s) => api.killSession(s.sessionId).catch(() => {})));
  }, [sdkSessions]);

  const handleUnarchiveSession = useCallback(async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    try { await api.unarchiveSession(sessionId); } catch { /* best-effort */ }
    try {
      const list = await api.listSessions();
      useStore.getState().setSdkSessions(list);
    } catch { /* best-effort */ }
  }, []);


  function formatRelativeTime(isoString: string): string {
    const diff = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  function renderNativeSessionItem(s: ClaudeSession) {
    const preview = s.firstMessage || "(no message)";
    const timeStr = formatRelativeTime(s.lastActiveAt);
    const isResuming = resumingId === s.id;
    return (
      <div key={s.id}>
        <button
          disabled={isResuming}
          onClick={() => {
            if (isResuming) return;
            useStore.getState().resumeNativeSession(s.id, s.cwd);
          }}
          onMouseEnter={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setTooltip({ text: `${preview}\n${timeStr}`, x: rect.right + 8, y: rect.top });
          }}
          onMouseLeave={() => setTooltip(null)}
          className="w-full px-2 py-px text-left rounded-[6px] hover:bg-cc-hover transition-colors cursor-pointer disabled:cursor-wait"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            {isResuming ? (
              <span className="shrink-0 w-2.5 h-2.5 rounded-full border border-cc-primary border-t-transparent animate-spin" />
            ) : (
              <span className="text-[10px] text-cc-muted shrink-0 whitespace-nowrap">{timeStr}</span>
            )}
            <span className="text-[10px] text-cc-fg/75 truncate">{preview}</span>
          </div>
        </button>
      </div>
    );
  }


  return (
    <aside className="w-[260px] h-full flex flex-col bg-cc-sidebar border-r border-cc-border">
      {confirmArchiveId && (
        <div className="mx-2 mb-1 p-2.5 rounded-[10px] bg-amber-500/10 border border-amber-500/20">
          <div className="flex items-start gap-2">
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 text-amber-500 shrink-0 mt-0.5">
              <path d="M8.982 1.566a1.13 1.13 0 00-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 01-1.1 0L7.1 5.995A.905.905 0 018 5zm.002 6a1 1 0 110 2 1 1 0 010-2z" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-cc-fg leading-snug">
                Archiving will <strong>delete the worktree</strong> and any uncommitted changes.
              </p>
              <div className="flex gap-2 mt-2">
                <button onClick={cancelArchive} className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-cc-hover text-cc-muted hover:text-cc-fg transition-colors cursor-pointer">Cancel</button>
                <button onClick={confirmArchive} className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors cursor-pointer">Archive</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {(() => {
          // Active bridge sessions for the current project (running or recently exited)
          const pNorm = (activeProjectCwd || "").replace(/\\/g, "/");
          const activeBridgeSessions = pNorm
            ? sdkSessions.filter((s) => {
                if (s.archived) return false;
                const sCwd = (s.cwd || "").replace(/\\/g, "/");
                return sCwd === pNorm || sCwd.startsWith(pNorm + "/");
              })
            : [];

          // IDs already shown via native sessions so we don't duplicate
          const nativeIds = new Set(nativeSessions.map((s) => s.id));
          const bridgeOnlyIds = activeBridgeSessions.filter((s) => !nativeIds.has(s.sessionId));

          const hasAnySessions = nativeSessions.length > 0 || bridgeOnlyIds.length > 0;

          if (!hasAnySessions) {
            return (
              <p className="px-3 py-8 text-xs text-cc-muted text-center leading-relaxed">
                {activeProjectCwd ? "No sessions for this project." : "Select a project tab to see sessions."}
              </p>
            );
          }

          return (
            <div className="pt-0.5">
              {bridgeOnlyIds.length > 0 && (
                <>
                  <div className="px-2 py-0.5">
                    <span className="text-[9px] font-semibold text-cc-muted uppercase tracking-widest">Active Sessions</span>
                  </div>
                  <div>
                    {bridgeOnlyIds.map((s) => {
                      const isCurrent = currentSessionId === s.sessionId;
                      const status = sessionStatus.get(s.sessionId);
                      const label = sessionNames.get(s.sessionId) || s.name || s.sessionId.slice(0, 8);
                      return (
                        <button
                          key={s.sessionId}
                          onClick={() => handleSelectSession(s.sessionId)}
                          className={`w-full px-2 py-px text-left rounded-[6px] hover:bg-cc-hover transition-colors cursor-pointer ${isCurrent ? "bg-cc-hover" : ""}`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            {status === "running" ? (
                              <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                            ) : (
                              <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-cc-muted/40" />
                            )}
                            <span className="text-[10px] text-cc-fg/75 truncate">{label}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
              {nativeSessions.length > 0 && (
                <>
                  <div className="px-2 py-0.5">
                    <span className="text-[9px] font-semibold text-cc-muted uppercase tracking-widest">Resume Sessions</span>
                  </div>
                  <div>{nativeSessions.map((s) => renderNativeSessionItem(s))}</div>
                </>
              )}
            </div>
          );
        })()}
      </div>

      <div className="px-3 py-1.5 border-t border-cc-border flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button onClick={handleKillAll} title="Kill all sessions"
            className="p-1.5 rounded-[8px] text-cc-muted hover:text-red-400 hover:bg-cc-hover transition-colors cursor-pointer">
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 1.5a5.5 5.5 0 110 11 5.5 5.5 0 010-11zm-2.5 3a.5.5 0 00-.5.5v4a.5.5 0 00.5.5h5a.5.5 0 00.5-.5V6a.5.5 0 00-.5-.5h-5z" />
            </svg>
          </button>
          <button onClick={() => setShowEnvManager(true)} title="Environments"
            className="p-1.5 rounded-[8px] text-cc-muted hover:text-cc-fg hover:bg-cc-hover transition-colors cursor-pointer">
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M8 1a2 2 0 012 2v1h2a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2h2V3a2 2 0 012-2zm0 1.5a.5.5 0 00-.5.5v1h1V3a.5.5 0 00-.5-.5zM4 5.5a.5.5 0 00-.5.5v6a.5.5 0 00.5.5h8a.5.5 0 00.5-.5V6a.5.5 0 00-.5-.5H4z" />
            </svg>
          </button>
          <button onClick={toggleDarkMode} title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            className="p-1.5 rounded-[8px] text-cc-muted hover:text-cc-fg hover:bg-cc-hover transition-colors cursor-pointer">
            {darkMode ? (
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
              </svg>
            )}
          </button>
        </div>
        <p className="text-[10px] text-cc-muted/40">v0.8.10</p>
      </div>

      {showEnvManager && <EnvManager onClose={() => setShowEnvManager(false)} />}

      {tooltip && createPortal(
        <div
          className="fixed z-[9999] bg-cc-card border border-cc-border rounded-lg shadow-lg px-3 py-2 text-[11px] text-cc-fg max-w-[280px] whitespace-pre-wrap pointer-events-none leading-relaxed"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.text}
        </div>,
        document.body,
      )}
    </aside>
  );
}
