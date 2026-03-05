import { useStore } from "../store.js";
import { api } from "../api.js";

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

        {currentSessionId && status === "running" && (
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cc-primary animate-[pulse-dot_1s_ease-in-out_infinite]" />
            <span className="text-cc-primary font-medium">Thinking</span>
          </div>
        )}

        {/* Chat / Editor tab toggle */}
        <div className={`flex items-center bg-cc-hover rounded-lg p-0.5 ${!currentSessionId ? "opacity-40 pointer-events-none" : ""}`}>
          <button
            onClick={() => setActiveTab("chat")}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
              activeTab === "chat"
                ? "bg-cc-card text-cc-fg shadow-sm"
                : "text-cc-muted hover:text-cc-fg"
            }`}
          >
            Chat
          </button>
          <button
            onClick={() => setActiveTab("editor")}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
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
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
            terminalOpen
              ? "text-cc-primary bg-cc-active"
              : "text-cc-muted hover:text-cc-fg hover:bg-cc-hover"
          }`}
          title="Toggle terminal"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3 h-3 shrink-0">
            <polyline points="3 11 6 8 3 5" />
            <line x1="8" y1="11" x2="13" y2="11" />
          </svg>
          Terminal
        </button>

        {/* Session panel toggle */}
        <button
          onClick={() => currentSessionId && setTaskPanelOpen(!taskPanelOpen)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
            !currentSessionId
              ? "text-cc-muted opacity-40 cursor-default"
              : taskPanelOpen
                ? "text-cc-primary bg-cc-active cursor-pointer"
                : "text-cc-muted hover:text-cc-fg hover:bg-cc-hover cursor-pointer"
          }`}
          title="Toggle session panel"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 shrink-0">
            <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2H6zm1 3a1 1 0 000 2h6a1 1 0 100-2H7zm0 4a1 1 0 000 2h6a1 1 0 100-2H7zm0 4a1 1 0 000 2h4a1 1 0 100-2H7z" clipRule="evenodd" />
          </svg>
          Session
        </button>
      </div>
    </header>
  );
}
