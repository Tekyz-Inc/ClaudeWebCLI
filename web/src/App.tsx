import { Component, useEffect, useRef, useSyncExternalStore } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { useStore } from "./store.js";
import { connectSession } from "./ws.js";
import { Sidebar } from "./components/Sidebar.js";
import { ChatView } from "./components/ChatView.js";
import { TopBar } from "./components/TopBar.js";
import { HomePage } from "./components/HomePage.js";
import { TaskPanel } from "./components/TaskPanel.js";
import { EditorPanel } from "./components/EditorPanel.js";
import { Playground } from "./components/Playground.js";
import { ProjectTabBar } from "./components/ProjectTabBar.js";
import { TerminalPanel } from "./components/TerminalPanel.js";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] Render crash:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-[100dvh] flex items-center justify-center bg-cc-bg text-cc-fg p-8">
          <div className="max-w-md text-center space-y-4">
            <h1 className="text-xl font-bold">Something went wrong</h1>
            <p className="text-sm text-cc-fg/60">{this.state.error?.message}</p>
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              onClick={() => {
                // Clear session to avoid re-rendering the crashing component
                useStore.getState().setCurrentSessionId(null);
                this.setState({ hasError: false, error: null });
              }}
            >
              Try Again
            </button>
            <button
              className="px-4 py-2 ml-2 bg-cc-border text-cc-fg rounded hover:bg-cc-border/80"
              onClick={() => window.location.reload()}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function useHash() {
  return useSyncExternalStore(
    (cb) => { window.addEventListener("hashchange", cb); return () => window.removeEventListener("hashchange", cb); },
    () => window.location.hash,
  );
}

export default function App() {
  const darkMode = useStore((s) => s.darkMode);
  const currentSessionId = useStore((s) => s.currentSessionId);
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const taskPanelOpen = useStore((s) => s.taskPanelOpen);
  const homeResetKey = useStore((s) => s.homeResetKey);
  const activeTab = useStore((s) => s.activeTab);
  const terminalOpen = useStore((s) => s.terminalOpen);
  const activeProjectCwd = useStore((s) => s.activeProjectCwd);
  // Lazy-mount: only spawn terminal WebSocket/PTY after first open
  const terminalMountedRef = useRef(false);
  if (terminalOpen) terminalMountedRef.current = true;
  const sdkSessions = useStore((s) => s.sdkSessions);
  const hash = useHash();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  // Auto-connect to restored session on mount
  useEffect(() => {
    const restoredId = useStore.getState().currentSessionId;
    if (restoredId) {
      connectSession(restoredId);
    }
  }, []);

  if (hash === "#/playground") {
    return <Playground />;
  }

  return (
    <ErrorBoundary>
    <div className="h-[100dvh] flex font-sans-ui bg-cc-bg text-cc-fg antialiased">
      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-30 md:hidden"
          onClick={() => useStore.getState().setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — overlay on mobile, inline on desktop */}
      <div
        className={`
          fixed md:relative z-40 md:z-auto
          h-full shrink-0 transition-all duration-200
          ${sidebarOpen ? "w-[260px] translate-x-0" : "w-0 -translate-x-full md:w-0 md:-translate-x-full"}
          overflow-hidden
        `}
      >
        <Sidebar />
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <ProjectTabBar />
        <TopBar />
        <div className="flex-1 overflow-hidden relative">
          {/* Chat tab — visible when activeTab is "chat" or no session */}
          <div className={`absolute inset-0 ${activeTab === "chat" || !currentSessionId ? "" : "hidden"}`}>
            {currentSessionId ? (
              <ChatView sessionId={currentSessionId} />
            ) : (
              <HomePage key={homeResetKey} />
            )}
          </div>

          {/* Editor tab */}
          {currentSessionId && activeTab === "editor" && (
            <div className="absolute inset-0">
              <EditorPanel sessionId={currentSessionId} />
            </div>
          )}
        </div>
      </div>

      {/* Task panel — overlay on mobile, inline on desktop */}
      {currentSessionId && (
        <>
          {/* Mobile overlay backdrop */}
          {taskPanelOpen && (
            <div
              className="fixed inset-0 bg-black/30 z-30 lg:hidden"
              onClick={() => useStore.getState().setTaskPanelOpen(false)}
            />
          )}

          <div
            className={`
              fixed lg:relative z-40 lg:z-auto right-0 top-0
              h-full shrink-0 transition-all duration-200
              ${taskPanelOpen ? "w-[280px] translate-x-0" : "w-0 translate-x-full lg:w-0 lg:translate-x-full"}
              overflow-hidden
            `}
          >
            <TaskPanel sessionId={currentSessionId} />
          </div>
        </>
      )}
      {/* Terminal panel — lazy-mount on first open, then keep mounted to preserve session */}
      {(() => {
        const currentSession = sdkSessions.find((s) => s.sessionId === currentSessionId);
        const termCwd = activeProjectCwd || currentSession?.cwd || undefined;
        return (
          <div
            className={`
              fixed lg:relative z-40 lg:z-auto right-0 top-0
              h-full shrink-0 transition-all duration-200
              ${terminalOpen ? "w-[340px] translate-x-0 overflow-visible" : "w-0 translate-x-full lg:w-0 lg:translate-x-full overflow-hidden"}
            `}
          >
            {terminalMountedRef.current && <TerminalPanel cwd={termCwd} isVisible={terminalOpen} />}
          </div>
        );
      })()}
    </div>
    </ErrorBoundary>
  );
}
