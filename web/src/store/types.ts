import type { SessionState, PermissionRequest, ChatMessage, SdkSessionInfo, TaskItem, AgentSpawn, TestRun } from "../types.js";

export interface AppState {
  // Sessions
  sessions: Map<string, SessionState>;
  sdkSessions: SdkSessionInfo[];
  currentSessionId: string | null;

  // Messages per session
  messages: Map<string, ChatMessage[]>;

  // Streaming partial text per session
  streaming: Map<string, string>;

  // Streaming stats: start time + output tokens
  streamingStartedAt: Map<string, number>;
  streamingOutputTokens: Map<string, number>;

  // Pending permissions per session (outer key = sessionId, inner key = request_id)
  pendingPermissions: Map<string, Map<string, PermissionRequest>>;

  // Connection state per session
  connectionStatus: Map<string, "connecting" | "connected" | "disconnected">;
  cliConnected: Map<string, boolean>;

  // Session status
  sessionStatus: Map<string, "idle" | "submitted" | "running" | "compacting" | null>;

  // Plan mode: stores previous permission mode per session so we can restore it
  previousPermissionMode: Map<string, string>;

  // Tasks per session
  sessionTasks: Map<string, TaskItem[]>;

  // Files changed by the agent per session (Edit/Write tool calls)
  changedFiles: Map<string, Set<string>>;

  // Files read per session (Read tool calls)
  filesRead: Map<string, Set<string>>;

  // Commands executed per session (Bash tool calls), most recent first, capped at 20
  commandsExecuted: Map<string, string[]>;

  // Agents spawned per session (Agent tool calls)
  agentsSpawned: Map<string, AgentSpawn[]>;

  // Tests executed per session (test-like Bash commands)
  testsExecuted: Map<string, TestRun[]>;

  // Models invoked per session: model name → cumulative { inputTokens, outputTokens, costUSD }
  modelsInvoked: Map<string, Map<string, { inputTokens: number; outputTokens: number; costUSD: number }>>;

  // Session display names
  sessionNames: Map<string, string>;
  // Track sessions that were just renamed (for animation)
  recentlyRenamed: Set<string>;

  // UI
  darkMode: boolean;
  sidebarOpen: boolean;
  taskPanelOpen: boolean;
  chatExpanded: boolean;
  chatExpandTick: number;
  homeResetKey: number;
  activeTab: "chat" | "editor";
  editorOpenFile: Map<string, string>;
  editorUrl: Map<string, string>;
  editorLoading: Map<string, boolean>;

  // Actions
  setDarkMode: (v: boolean) => void;
  toggleDarkMode: () => void;
  setSidebarOpen: (v: boolean) => void;
  setTaskPanelOpen: (open: boolean) => void;
  setChatExpanded: (expanded: boolean) => void;
  newSession: () => void;
  resumeNativeSession: (cliId: string, cwd: string) => Promise<void>;

  // Session actions
  setCurrentSession: (id: string | null) => void;
  addSession: (session: SessionState) => void;
  updateSession: (sessionId: string, updates: Partial<SessionState>) => void;
  removeSession: (sessionId: string) => void;
  setSdkSessions: (sessions: SdkSessionInfo[]) => void;

  // Message actions
  appendMessage: (sessionId: string, msg: ChatMessage) => void;
  setMessages: (sessionId: string, msgs: ChatMessage[]) => void;
  updateLastAssistantMessage: (sessionId: string, updater: (msg: ChatMessage) => ChatMessage) => void;
  setStreaming: (sessionId: string, text: string | null) => void;
  setStreamingStats: (sessionId: string, stats: { startedAt?: number; outputTokens?: number } | null) => void;

  // Permission actions
  addPermission: (sessionId: string, perm: PermissionRequest) => void;
  removePermission: (sessionId: string, requestId: string) => void;

  // Task actions
  addTask: (sessionId: string, task: TaskItem) => void;
  setTasks: (sessionId: string, tasks: TaskItem[]) => void;
  updateTask: (sessionId: string, taskId: string, updates: Partial<TaskItem>) => void;

  // Changed files actions
  addChangedFile: (sessionId: string, filePath: string) => void;
  clearChangedFiles: (sessionId: string) => void;

  // Activity tracking actions
  addReadFile: (sessionId: string, filePath: string) => void;
  addCommandExecuted: (sessionId: string, cmd: string) => void;
  addAgentSpawned: (sessionId: string, agent: AgentSpawn) => void;
  addTestExecuted: (sessionId: string, test: TestRun) => void;
  mergeModelUsage: (sessionId: string, modelUsage: Record<string, { inputTokens: number; outputTokens: number; costUSD: number }>) => void;

  // Clear-on-result flag (for /clear and /compact commands)
  clearOnNextResult: Set<string>;
  markClearOnNextResult: (sessionId: string) => void;

  // Queued message to send immediately after current result arrives
  queuedMessages: Map<string, { content: string; images?: { media_type: string; data: string }[] }>;
  setQueuedMessage: (sessionId: string, msg: { content: string; images?: { media_type: string; data: string }[] }) => void;
  clearQueuedMessage: (sessionId: string) => void;

  // Session name actions
  setSessionName: (sessionId: string, name: string) => void;
  markRecentlyRenamed: (sessionId: string) => void;
  clearRecentlyRenamed: (sessionId: string) => void;

  // Plan mode actions
  setPreviousPermissionMode: (sessionId: string, mode: string) => void;

  // Connection actions
  setConnectionStatus: (sessionId: string, status: "connecting" | "connected" | "disconnected") => void;
  setCliConnected: (sessionId: string, connected: boolean) => void;
  setSessionStatus: (sessionId: string, status: "idle" | "submitted" | "running" | "compacting" | null) => void;

  // Prompt history per session
  promptHistory: Map<string, string[]>;
  addPromptToHistory: (sessionId: string, prompt: string) => void;

  // Editor actions
  setActiveTab: (tab: "chat" | "editor") => void;
  setEditorOpenFile: (sessionId: string, filePath: string | null) => void;
  setEditorUrl: (sessionId: string, url: string) => void;
  setEditorLoading: (sessionId: string, loading: boolean) => void;

  // Project tab bar
  activeProjectCwd: string | null;
  setActiveProjectCwd: (cwd: string | null) => void;
  hiddenProjects: Set<string>;
  toggleHiddenProject: (path: string) => void;
  // Maps project CWD → last active session ID (survives tab switches)
  projectSessionMap: Map<string, string>;
  setProjectSession: (cwd: string, sessionId: string) => void;

  // Terminal panel
  terminalOpen: boolean;
  setTerminalOpen: (open: boolean) => void;

  reset: () => void;
}
