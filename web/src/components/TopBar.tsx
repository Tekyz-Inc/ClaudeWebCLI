import { useStore } from "../store.js";
import { api } from "../api.js";
import { connectSession, disconnectSession } from "../ws.js";

async function createNewSession(currentSessionId: string | null) {
  const store = useStore.getState();
  if (currentSessionId) disconnectSession(currentSessionId);
  const cwd = store.activeProjectCwd || undefined;
  const permissionMode = store.previousPermissionMode.get(currentSessionId ?? "") || "acceptEdits";
  try {
    const { sessionId } = await api.createSession({ cwd, permissionMode });
    store.setSessionName(sessionId, "New Session");
    store.setCurrentSession(sessionId);
    connectSession(sessionId);
  } catch (e) {
    console.error("[TopBar] Failed to create session", e);
    store.newSession(); // fallback: show HomePage
  }
}

export function TopBar() {
  const currentSessionId = useStore((s) => s.currentSessionId);
  const cliConnected = useStore((s) => s.cliConnected);
  const connectionStatus = useStore((s) => s.connectionStatus);
  const sessionStatus = useStore((s) => s.sessionStatus);
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);
  const taskPanelOpen = useStore((s) => s.taskPanelOpen);
  const setTaskPanelOpen = useStore((s) => s.setTaskPanelOpen);
  const terminalOpen = useStore((s) => s.terminalOpen);
  const setTerminalOpen = useStore((s) => s.setTerminalOpen);
  const activeTab = useStore((s) => s.activeTab);
  const setActiveTab = useStore((s) => s.setActiveTab);
  const chatExpanded = useStore((s) => s.chatExpanded);
  const setChatExpanded = useStore((s) => s.setChatExpanded);

  const isConnected = currentSessionId ? (cliConnected.get(currentSessionId) ?? false) : false;
  const connStatus = currentSessionId ? (connectionStatus.get(currentSessionId) ?? "disconnected") : null;
  const status = currentSessionId ? (sessionStatus.get(currentSessionId) ?? null) : null;

  return (
    <header className="shrink-0 flex items-center justify-between px-2 sm:px-4 py-2 sm:py-2.5 bg-cc-card border-b border-cc-border">
      <div className="flex items-center gap-3">
        {/* Sidebar toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="flex items-center justify-center w-7 h-7 rounded-lg text-cc-muted hover:text-cc-fg hover:bg-cc-hover transition-colors cursor-pointer"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
          </svg>
        </button>

        {/* Connection status */}
        {currentSessionId && (
          <div className="flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                connStatus === "disconnected"
                  ? "bg-cc-warning animate-pulse"
                  : isConnected
                    ? "bg-cc-success"
                    : "bg-cc-warning"
              }`}
            />
            {connStatus === "disconnected" ? (
              <span className="text-[11px] text-cc-warning font-medium hidden sm:inline">
                Reconnecting...
              </span>
            ) : !isConnected ? (
              <button
                onClick={() => currentSessionId && api.relaunchSession(currentSessionId).catch(console.error)}
                className="text-[11px] text-cc-warning hover:text-cc-warning/80 font-medium cursor-pointer hidden sm:inline"
              >
                Reconnect
              </button>
            ) : (
              <span className="text-[11px] text-cc-muted hidden sm:inline">Connected</span>
            )}
          </div>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2 sm:gap-3 text-[12px] text-cc-muted">
        {currentSessionId && status === "compacting" && (
          <span className="text-cc-warning font-medium animate-pulse">Compacting...</span>
        )}

        {currentSessionId && status === "submitted" && (
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-amber-400 font-medium">Waiting...</span>
          </div>
        )}

        {currentSessionId && status === "running" && (
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cc-primary animate-[pulse-dot_1s_ease-in-out_infinite]" />
            <span className="text-cc-primary font-medium">Thinking</span>
          </div>
        )}

        {/* Expand/Collapse chat tool blocks — pill style */}
        <div className={`flex items-center bg-cc-hover rounded-lg p-0.5 ${!currentSessionId ? "opacity-40 pointer-events-none" : ""}`}>
          <button
            onClick={() => setChatExpanded(!chatExpanded)}
            className={`px-2 py-0.5 rounded-md text-[11px] font-barlow-condensed font-medium tracking-wide transition-colors cursor-pointer ${
              chatExpanded
                ? "bg-cc-card text-cc-fg shadow-sm"
                : "text-cc-muted hover:text-cc-fg"
            }`}
          >
            {chatExpanded ? "Collapse" : "Expand"}
          </button>
        </div>

        {/* New Session button */}
        <button
          onClick={() => createNewSession(currentSessionId)}
          title="New session"
          className="flex items-center justify-center w-6 h-6 rounded-md text-cc-muted hover:text-cc-fg hover:bg-cc-hover transition-colors cursor-pointer"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-3.5 h-3.5">
            <path d="M8 3v10M3 8h10" />
          </svg>
        </button>

        {/* Chat / Editor tab toggle */}
        <div className={`flex items-center bg-cc-hover rounded-lg p-0.5 ${!currentSessionId ? "opacity-40 pointer-events-none" : ""}`}>
          <button
            onClick={() => setActiveTab("chat")}
            className={`px-2 py-0.5 rounded-md text-[11px] font-barlow-condensed font-medium tracking-wide transition-colors cursor-pointer ${
              activeTab === "chat"
                ? "bg-cc-card text-cc-fg shadow-sm"
                : "text-cc-muted hover:text-cc-fg"
            }`}
          >
            Chat
          </button>
          <button
            onClick={() => setActiveTab("editor")}
            className={`px-2 py-0.5 rounded-md text-[11px] font-barlow-condensed font-medium tracking-wide transition-colors cursor-pointer ${
              activeTab === "editor"
                ? "bg-cc-card text-cc-fg shadow-sm"
                : "text-cc-muted hover:text-cc-fg"
            }`}
          >
            Editor
          </button>
        </div>

        {/* Terminal toggle */}
        <button
          onClick={() => setTerminalOpen(!terminalOpen)}
          className={`px-2 py-0.5 rounded-lg text-[11px] font-barlow-condensed font-medium tracking-wide transition-colors cursor-pointer border ${
            terminalOpen
              ? "text-cc-primary bg-cc-active border-cc-primary/30"
              : "text-cc-muted border-cc-border hover:text-cc-fg hover:bg-cc-hover"
          }`}
          title="Toggle terminal"
        >
          Terminal
        </button>

        {/* Session panel toggle */}
        <button
          onClick={() => currentSessionId && setTaskPanelOpen(!taskPanelOpen)}
          className={`px-2 py-0.5 rounded-lg text-[11px] font-barlow-condensed font-medium tracking-wide transition-colors border ${
            !currentSessionId
              ? "text-cc-muted border-cc-border opacity-40 cursor-default"
              : taskPanelOpen
                ? "text-cc-primary bg-cc-active border-cc-primary/30 cursor-pointer"
                : "text-cc-muted border-cc-border hover:text-cc-fg hover:bg-cc-hover cursor-pointer"
          }`}
          title="Toggle session panel"
        >
          Session
        </button>
      </div>
    </header>
  );
}
