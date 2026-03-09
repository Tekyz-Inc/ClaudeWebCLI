import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useStore } from "../store.js";
import { api } from "../api.js";
import { connectSession, disconnectSession } from "../ws.js";
import { EnvManager } from "./EnvManager.js";
import type { ClaudeSession } from "../types.js";

export function Sidebar() {
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [showEnvManager, setShowEnvManager] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null);
  const [nativeSessions, setNativeSessions] = useState<ClaudeSession[]>([]);
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
  const [resumingId, setResumingId] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const prevCwdRef = useRef<string | null>(null);
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
  const resumeNativeSession = useStore((s) => s.resumeNativeSession);

  // Poll for SDK sessions on mount
  useEffect(() => {
    let active = true;
    async function poll() {
      try {
        const list = await api.listSessions();
        if (active) {
          useStore.getState().setSdkSessions(list);
          // Hydrate session names from server (server is source of truth for auto-generated names)
          const store = useStore.getState();
          for (const s of list) {
            if (s.name && (!store.sessionNames.has(s.sessionId) || /^[A-Z][a-z]+ [A-Z][a-z]+$/.test(store.sessionNames.get(s.sessionId)!))) {
              const currentStoreName = store.sessionNames.get(s.sessionId);
              const hadRandomName = !!currentStoreName && /^[A-Z][a-z]+ [A-Z][a-z]+$/.test(currentStoreName);
              if (currentStoreName !== s.name) {
                store.setSessionName(s.sessionId, s.name);
                if (hadRandomName) {
                  store.markRecentlyRenamed(s.sessionId);
                }
              }
            }
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

  // Fetch native Claude sessions when project tab is active; auto-resume on tab switch
  useEffect(() => {
    if (!activeProjectCwd) {
      setNativeSessions([]);
      prevCwdRef.current = null;
      return;
    }
    // Auto-resume on tab switch, or on first load when there's no existing session.
    // Using `let` so fetchNative can reset it to false after the first auto-resume attempt,
    // preventing the interval from calling resumeNativeSession every 10 seconds.
    const prevCwd = prevCwdRef.current;
    const isTabSwitch = prevCwd !== null && prevCwd !== activeProjectCwd;
    const isFirstLoad = prevCwd === null && !useStore.getState().currentSessionId;
    let shouldAutoResume = isTabSwitch || isFirstLoad;
    prevCwdRef.current = activeProjectCwd;
    let active = true;
    async function fetchNative() {
      try {
        const list = await api.getClaudeSessions(activeProjectCwd!);
        if (active) {
          setNativeSessions(list);
          if (shouldAutoResume && list.length > 0) {
            shouldAutoResume = false; // Reset: never auto-resume again until the next real tab switch
            // Check if we already have a live session for this project — if so, activate it
            // instead of spawning a new CLI process (which would abandon any running work).
            const store = useStore.getState();
            const pNorm = activeProjectCwd!.replace(/\\/g, "/");
            const existingSession = store.sdkSessions.find((s) => {
              if (s.archived || s.state === "exited") return false;
              const sCwd = (s.cwd || "").replace(/\\/g, "/");
              return sCwd === pNorm || sCwd.startsWith(pNorm + "/");
            });
            if (existingSession && store.sessions.has(existingSession.sessionId)) {
              connectSession(existingSession.sessionId);
              setCurrentSession(existingSession.sessionId);
            } else {
              const s = list[0];
              setResumingId(s.id);
              resumeNativeSession(s.id, s.cwd).finally(() => setResumingId(null));
            }
          }
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

  function handleSelectSession(sessionId: string) {
    if (currentSessionId === sessionId) return;
    // Disconnect from old session, connect to new
    if (currentSessionId) {
      disconnectSession(currentSessionId);
    }
    setCurrentSession(sessionId);
    connectSession(sessionId);
    // Close sidebar on mobile
    if (window.innerWidth < 768) {
      useStore.getState().setSidebarOpen(false);
    }
  }

  function handleNewSession() {
    if (currentSessionId) {
      disconnectSession(currentSessionId);
    }
    useStore.getState().newSession();
    if (window.innerWidth < 768) {
      useStore.getState().setSidebarOpen(false);
    }
  }

  // Focus edit input when entering edit mode
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
    // Check if session uses a worktree — if so, ask for confirmation
    const sdkInfo = sdkSessions.find((s) => s.sessionId === sessionId);
    const bridgeState = sessions.get(sessionId);
    const isWorktree = bridgeState?.is_worktree || sdkInfo?.isWorktree || false;
    if (isWorktree) {
      setConfirmArchiveId(sessionId);
      return;
    }
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
    if (confirmArchiveId) {
      doArchive(confirmArchiveId, true);
      setConfirmArchiveId(null);
    }
  }, [confirmArchiveId, doArchive]);

  const cancelArchive = useCallback(() => {
    setConfirmArchiveId(null);
  }, []);

  const handleKillAll = useCallback(async () => {
    const targets = sdkSessions.filter((s) => !s.archived && s.state !== "exited");
    await Promise.all(targets.map((s) => api.killSession(s.sessionId).catch(() => {})));
  }, [sdkSessions]);

  const handleUnarchiveSession = useCallback(async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    try {
      await api.unarchiveSession(sessionId);
    } catch {
      // best-effort
    }
    try {
      const list = await api.listSessions();
      useStore.getState().setSdkSessions(list);
    } catch {
      // best-effort
    }
  }, []);

  // Combine sessions from WsBridge state + SDK sessions list
  const allSessionIds = new Set<string>();
  for (const id of sessions.keys()) allSessionIds.add(id);
  for (const s of sdkSessions) allSessionIds.add(s.sessionId);

  const allSessionList = Array.from(allSessionIds).map((id) => {
    const bridgeState = sessions.get(id);
    const sdkInfo = sdkSessions.find((s) => s.sessionId === id);
    return {
      id,
      model: bridgeState?.model || sdkInfo?.model || "",
      cwd: bridgeState?.cwd || sdkInfo?.cwd || "",
      gitBranch: bridgeState?.git_branch || "",
      isWorktree: bridgeState?.is_worktree || sdkInfo?.isWorktree || false,
      gitAhead: bridgeState?.git_ahead || 0,
      gitBehind: bridgeState?.git_behind || 0,
      linesAdded: bridgeState?.total_lines_added || 0,
      linesRemoved: bridgeState?.total_lines_removed || 0,
      isConnected: cliConnected.get(id) ?? false,
      status: sessionStatus.get(id) ?? null,
      sdkState: sdkInfo?.state ?? null,
      createdAt: sdkInfo?.createdAt ?? 0,
      archived: sdkInfo?.archived ?? false,
    };
  }).sort((a, b) => b.createdAt - a.createdAt);

  const activeSessions = allSessionList.filter((s) => !s.archived);
  const archivedSessions = allSessionList.filter((s) => s.archived);

  const filteredActiveSessions = activeProjectCwd
    ? activeSessions.filter((s) => {
        const cwd = (s.cwd || "").replace(/\\/g, "/");
        const p = activeProjectCwd.replace(/\\/g, "/");
        return cwd === p || cwd.startsWith(p + "/");
      })
    : activeSessions;

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
            setResumingId(s.id);
            resumeNativeSession(s.id, s.cwd).finally(() => setResumingId(null));
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

  function renderSessionItem(s: typeof allSessionList[number], options?: { isArchived?: boolean }) {
    const isActive = currentSessionId === s.id;
    const name = sessionNames.get(s.id);
    const shortId = s.id.slice(0, 8);
    const label = name || s.model || shortId;
    const dirName = s.cwd ? s.cwd.split("/").pop() : "";
    const isRunning = s.status === "running";
    const isCompacting = s.status === "compacting";
    const isEditing = editingSessionId === s.id;
    const permCount = pendingPermissions.get(s.id)?.size ?? 0;
    const archived = options?.isArchived;

    return (
      <div key={s.id} className={`relative group ${archived ? "opacity-60" : ""}`}>
        <button
          onClick={() => handleSelectSession(s.id)}
          onDoubleClick={(e) => {
            e.preventDefault();
            setEditingSessionId(s.id);
            setEditingName(label);
          }}
          className={`w-full px-3 py-2.5 pr-14 text-left rounded-[10px] transition-all duration-100 cursor-pointer ${
            isActive
              ? "bg-cc-active"
              : "hover:bg-cc-hover"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="relative flex shrink-0">
              <span
                className={`w-2 h-2 rounded-full ${
                  archived
                    ? "bg-cc-muted opacity-40"
                    : permCount > 0
                    ? "bg-cc-warning"
                    : s.sdkState === "exited"
                    ? "bg-cc-muted opacity-40"
                    : s.isConnected
                    ? isRunning
                      ? "bg-cc-success"
                      : isCompacting
                      ? "bg-cc-warning"
                      : "bg-cc-success opacity-60"
                    : "bg-cc-muted opacity-40"
                }`}
              />
              {!archived && permCount > 0 && (
                <span className="absolute inset-0 w-2 h-2 rounded-full bg-cc-warning/40 animate-[pulse-dot_1.5s_ease-in-out_infinite]" />
              )}
              {!archived && permCount === 0 && isRunning && s.isConnected && (
                <span className="absolute inset-0 w-2 h-2 rounded-full bg-cc-success/40 animate-[pulse-dot_1.5s_ease-in-out_infinite]" />
              )}
            </span>
            {isEditing ? (
              <input
                ref={editInputRef}
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    confirmRename();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    cancelRename();
                  }
                  e.stopPropagation();
                }}
                onBlur={confirmRename}
                onClick={(e) => e.stopPropagation()}
                onDoubleClick={(e) => e.stopPropagation()}
                className="text-[13px] font-medium flex-1 text-cc-fg bg-transparent border border-cc-border rounded-md px-1 py-0 outline-none focus:border-cc-primary/50 min-w-0"
              />
            ) : (
              <span
                className={`text-[13px] font-medium truncate flex-1 text-cc-fg ${recentlyRenamed.has(s.id) ? "animate-name-appear" : ""}`}
                onAnimationEnd={() => useStore.getState().clearRecentlyRenamed(s.id)}
              >
                {label}
              </span>
            )}
          </div>
          {dirName && (
            <p className="text-[11px] text-cc-muted truncate mt-0.5 ml-4">
              {dirName}
            </p>
          )}
          {s.gitBranch && (
            <div className="flex items-center gap-1.5 mt-0.5 ml-4 text-[11px] text-cc-muted">
              <span className="flex items-center gap-1 truncate">
                {s.isWorktree ? (
                  <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 shrink-0 opacity-60">
                    <path d="M5 3.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm0 2.122a2.25 2.25 0 10-1.5 0v5.256a2.25 2.25 0 101.5 0V5.372zM4.25 12a.75.75 0 100 1.5.75.75 0 000-1.5zm7.5-9.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122V7A2.5 2.5 0 0110 9.5H6a1 1 0 000 2h4a2.5 2.5 0 012.5 2.5v.628a2.25 2.25 0 11-1.5 0V14a1 1 0 00-1-1H6a2.5 2.5 0 01-2.5-2.5V10a2.5 2.5 0 012.5-2.5h4a1 1 0 001-1V5.372a2.25 2.25 0 01-1.5-2.122z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 shrink-0 opacity-60">
                    <path d="M11.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.116.862a2.25 2.25 0 10-.862.862A4.48 4.48 0 007.25 7.5h-1.5A2.25 2.25 0 003.5 9.75v.318a2.25 2.25 0 101.5 0V9.75a.75.75 0 01.75-.75h1.5a5.98 5.98 0 003.884-1.435A2.25 2.25 0 109.634 3.362zM4.25 12a.75.75 0 100 1.5.75.75 0 000-1.5z" />
                  </svg>
                )}
                <span className="truncate">{s.gitBranch}</span>
                {s.isWorktree && (
                  <span className="text-[9px] bg-cc-primary/10 text-cc-primary px-0.5 rounded">wt</span>
                )}
              </span>
              {(s.gitAhead > 0 || s.gitBehind > 0) && (
                <span className="flex items-center gap-0.5 text-[10px]">
                  {s.gitAhead > 0 && <span className="text-green-500">{s.gitAhead}&#8593;</span>}
                  {s.gitBehind > 0 && <span className="text-cc-warning">{s.gitBehind}&#8595;</span>}
                </span>
              )}
              {(s.linesAdded > 0 || s.linesRemoved > 0) && (
                <span className="flex items-center gap-1 shrink-0">
                  <span className="text-green-500">+{s.linesAdded}</span>
                  <span className="text-red-400">-{s.linesRemoved}</span>
                </span>
              )}
            </div>
          )}
        </button>
        {!archived && permCount > 0 && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-cc-warning text-white text-[10px] font-bold leading-none px-1 group-hover:opacity-0 transition-opacity pointer-events-none">
            {permCount}
          </span>
        )}
        {archived ? (
          <>
            {/* Unarchive button */}
            <button
              onClick={(e) => handleUnarchiveSession(e, s.id)}
              className="absolute right-8 top-1/2 -translate-y-1/2 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-cc-border text-cc-muted hover:text-cc-fg transition-all cursor-pointer"
              title="Restore session"
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
                <path d="M8 10V3M5 5l3-3 3 3" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M3 13h10" strokeLinecap="round" />
              </svg>
            </button>
            {/* Delete button */}
            <button
              onClick={(e) => handleDeleteSession(e, s.id)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-cc-border text-cc-muted hover:text-red-400 transition-all cursor-pointer"
              title="Delete permanently"
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </>
        ) : (
          <>
            {/* Edit/rename button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditingSessionId(s.id);
                setEditingName(label);
              }}
              className="absolute right-8 top-1/2 -translate-y-1/2 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-cc-border text-cc-muted hover:text-cc-fg transition-all cursor-pointer"
              title="Rename session"
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
                <path d="M11.5 1.5l3 3L5 14H2v-3z" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M9.5 3.5l3 3" strokeLinecap="round" />
              </svg>
            </button>
            {/* Archive button */}
            <button
              onClick={(e) => handleArchiveSession(e, s.id)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-cc-border text-cc-muted hover:text-cc-fg transition-all cursor-pointer"
              title="Archive session"
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
                <path d="M3 3h10v2H3zM4 5v7a1 1 0 001 1h6a1 1 0 001-1V5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M6.5 8h3" strokeLinecap="round" />
              </svg>
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <aside className="w-[260px] h-full flex flex-col bg-cc-sidebar border-r border-cc-border">

      {/* Worktree archive confirmation */}
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
                <button
                  onClick={cancelArchive}
                  className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-cc-hover text-cc-muted hover:text-cc-fg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmArchive}
                  className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors cursor-pointer"
                >
                  Archive
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Session list — only native (resume) sessions */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {nativeSessions.length === 0 ? (
          <p className="px-3 py-8 text-xs text-cc-muted text-center leading-relaxed">
            {activeProjectCwd ? "No sessions for this project." : "Select a project tab to see sessions."}
          </p>
        ) : (
          <div className="pt-0.5">
            <div className="px-2 py-0.5">
              <span className="text-[9px] font-semibold text-cc-muted uppercase tracking-widest">Resume Sessions</span>
            </div>
            <div>
              {nativeSessions.map((s) => renderNativeSessionItem(s))}
            </div>
          </div>
        )}
      </div>

      {/* Footer — compact icon row */}
      <div className="px-3 py-1.5 border-t border-cc-border flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            onClick={handleKillAll}
            title="Kill all sessions"
            className="p-1.5 rounded-[8px] text-cc-muted hover:text-red-400 hover:bg-cc-hover transition-colors cursor-pointer"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 1.5a5.5 5.5 0 110 11 5.5 5.5 0 010-11zm-2.5 3a.5.5 0 00-.5.5v4a.5.5 0 00.5.5h5a.5.5 0 00.5-.5V6a.5.5 0 00-.5-.5h-5z" />
            </svg>
          </button>
          <button
            onClick={() => setShowEnvManager(true)}
            title="Environments"
            className="p-1.5 rounded-[8px] text-cc-muted hover:text-cc-fg hover:bg-cc-hover transition-colors cursor-pointer"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M8 1a2 2 0 012 2v1h2a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2h2V3a2 2 0 012-2zm0 1.5a.5.5 0 00-.5.5v1h1V3a.5.5 0 00-.5-.5zM4 5.5a.5.5 0 00-.5.5v6a.5.5 0 00.5.5h8a.5.5 0 00.5-.5V6a.5.5 0 00-.5-.5H4z" />
            </svg>
          </button>
          <button
            onClick={toggleDarkMode}
            title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            className="p-1.5 rounded-[8px] text-cc-muted hover:text-cc-fg hover:bg-cc-hover transition-colors cursor-pointer"
          >
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

      {/* Environment manager modal */}
      {showEnvManager && (
        <EnvManager onClose={() => setShowEnvManager(false)} />
      )}

      {/* Instant hover tooltip — rendered via portal to escape overflow:hidden clipping */}
      {tooltip && createPortal(
        <div
          className="fixed z-[9999] bg-cc-card border border-cc-border rounded-lg shadow-lg px-3 py-2 text-[11px] text-cc-fg max-w-[280px] whitespace-pre-wrap pointer-events-none leading-relaxed"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.text}
        </div>,
        document.body
      )}
    </aside>
  );
}
