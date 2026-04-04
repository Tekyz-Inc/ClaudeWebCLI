import { create } from "zustand";
import type { AppState } from "./store/types.js";
import {
  getInitialSessionNames,
  getInitialSessionId,
  getInitialPromptHistory,
  getInitialDarkMode,
  getInitialHiddenProjects,
} from "./store/initial-state.js";
import { buildRemoveSessionState } from "./store/remove-session.js";
import { resumeNativeSessionImpl } from "./store/resume-session.js";

export type { AppState };

// ─── HMR-safe store: preserve state across Vite hot-module replacement ──
const WIN_STORE = window as unknown as { __cc_store_state?: Partial<AppState> };

export const useStore = create<AppState>((set) => ({
  // Restore from HMR snapshot if available, otherwise use fresh defaults
  sessions: WIN_STORE.__cc_store_state?.sessions ?? new Map(),
  sdkSessions: WIN_STORE.__cc_store_state?.sdkSessions ?? [],
  currentSessionId: WIN_STORE.__cc_store_state?.currentSessionId ?? getInitialSessionId(),
  messages: WIN_STORE.__cc_store_state?.messages ?? new Map(),
  streaming: WIN_STORE.__cc_store_state?.streaming ?? new Map(),
  streamingStartedAt: WIN_STORE.__cc_store_state?.streamingStartedAt ?? new Map(),
  streamingOutputTokens: WIN_STORE.__cc_store_state?.streamingOutputTokens ?? new Map(),
  pendingPermissions: WIN_STORE.__cc_store_state?.pendingPermissions ?? new Map(),
  connectionStatus: WIN_STORE.__cc_store_state?.connectionStatus ?? new Map(),
  cliConnected: WIN_STORE.__cc_store_state?.cliConnected ?? new Map(),
  sessionStatus: WIN_STORE.__cc_store_state?.sessionStatus ?? new Map(),
  previousPermissionMode: WIN_STORE.__cc_store_state?.previousPermissionMode ?? new Map(),
  sessionTasks: WIN_STORE.__cc_store_state?.sessionTasks ?? new Map(),
  changedFiles: WIN_STORE.__cc_store_state?.changedFiles ?? new Map(),
  filesRead: WIN_STORE.__cc_store_state?.filesRead ?? new Map(),
  commandsExecuted: WIN_STORE.__cc_store_state?.commandsExecuted ?? new Map(),
  agentsSpawned: WIN_STORE.__cc_store_state?.agentsSpawned ?? new Map(),
  testsExecuted: WIN_STORE.__cc_store_state?.testsExecuted ?? new Map(),
  modelsInvoked: WIN_STORE.__cc_store_state?.modelsInvoked ?? new Map(),
  clearOnNextResult: WIN_STORE.__cc_store_state?.clearOnNextResult ?? new Set(),
  queuedMessages: WIN_STORE.__cc_store_state?.queuedMessages ?? new Map(),
  promptHistory: WIN_STORE.__cc_store_state?.promptHistory ?? getInitialPromptHistory(),
  sessionNames: WIN_STORE.__cc_store_state?.sessionNames ?? getInitialSessionNames(),
  recentlyRenamed: WIN_STORE.__cc_store_state?.recentlyRenamed ?? new Set(),
  darkMode: WIN_STORE.__cc_store_state?.darkMode ?? getInitialDarkMode(),
  sidebarOpen: WIN_STORE.__cc_store_state?.sidebarOpen ?? false,
  taskPanelOpen: WIN_STORE.__cc_store_state?.taskPanelOpen ?? false,
  chatExpanded: WIN_STORE.__cc_store_state?.chatExpanded ?? true,
  chatExpandTick: WIN_STORE.__cc_store_state?.chatExpandTick ?? 0,
  homeResetKey: WIN_STORE.__cc_store_state?.homeResetKey ?? 0,
  activeTab: WIN_STORE.__cc_store_state?.activeTab ?? "chat",
  editorOpenFile: WIN_STORE.__cc_store_state?.editorOpenFile ?? new Map(),
  editorUrl: WIN_STORE.__cc_store_state?.editorUrl ?? new Map(),
  editorLoading: WIN_STORE.__cc_store_state?.editorLoading ?? new Map(),
  activeProjectCwd: WIN_STORE.__cc_store_state?.activeProjectCwd ?? null,
  hiddenProjects: WIN_STORE.__cc_store_state?.hiddenProjects ?? getInitialHiddenProjects(),
  projectSessionMap: WIN_STORE.__cc_store_state?.projectSessionMap ?? new Map(),
  terminalOpen: WIN_STORE.__cc_store_state?.terminalOpen ?? false,

  setDarkMode: (v) => {
    localStorage.setItem("cc-dark-mode", String(v));
    set({ darkMode: v });
  },
  toggleDarkMode: () =>
    set((s) => {
      const next = !s.darkMode;
      localStorage.setItem("cc-dark-mode", String(next));
      return { darkMode: next };
    }),
  setSidebarOpen: (v) => set({ sidebarOpen: v }),
  setTaskPanelOpen: (open) => set({ taskPanelOpen: open }),
  setChatExpanded: (expanded) =>
    set((s) => ({ chatExpanded: expanded, chatExpandTick: s.chatExpandTick + 1 })),
  newSession: () => {
    sessionStorage.removeItem("cc-current-session");
    set((s) => ({ currentSessionId: null, homeResetKey: s.homeResetKey + 1 }));
  },

  resumeNativeSession: async (cliId, cwd) => {
    const sessionId = await resumeNativeSessionImpl(
      cliId,
      cwd,
      (sid, msgs) => useStore.getState().setMessages(sid, msgs),
      (sid, filesRead, changedFiles, slashCmds) => {
        set((s) => {
          const fr = new Map(s.filesRead);
          fr.set(sid, new Set(filesRead));
          const cf = new Map(s.changedFiles);
          cf.set(sid, new Set(changedFiles));
          const ce = new Map(s.commandsExecuted);
          ce.set(sid, slashCmds);
          return { filesRead: fr, changedFiles: cf, commandsExecuted: ce };
        });
      },
      (normCwd, sid) => {
        set((s) => {
          const projectSessionMap = new Map(s.projectSessionMap);
          projectSessionMap.set(normCwd, sid);
          return { projectSessionMap };
        });
      },
    );
    const { connectSession } = await import("./ws.js");
    connectSession(sessionId);
    set({ currentSessionId: sessionId });
  },

  setCurrentSession: (id) => {
    if (id) {
      sessionStorage.setItem("cc-current-session", id);
    } else {
      sessionStorage.removeItem("cc-current-session");
    }
    set({ currentSessionId: id });
  },

  addSession: (session) =>
    set((s) => {
      const sessions = new Map(s.sessions);
      sessions.set(session.session_id, session);
      const messages = new Map(s.messages);
      if (!messages.has(session.session_id)) messages.set(session.session_id, []);
      return { sessions, messages };
    }),

  updateSession: (sessionId, updates) =>
    set((s) => {
      const sessions = new Map(s.sessions);
      const existing = sessions.get(sessionId);
      if (existing) sessions.set(sessionId, { ...existing, ...updates });
      return { sessions };
    }),

  removeSession: (sessionId) =>
    set((s) => buildRemoveSessionState(s, sessionId)),

  setSdkSessions: (sessions) => set({ sdkSessions: sessions }),

  appendMessage: (sessionId, msg) =>
    set((s) => {
      const messages = new Map(s.messages);
      const existing = messages.get(sessionId) || [];
      if (msg.id && existing.some((m) => m.id === msg.id)) return s;
      messages.set(sessionId, [...existing, msg]);
      return { messages };
    }),

  setMessages: (sessionId, msgs) =>
    set((s) => {
      const messages = new Map(s.messages);
      messages.set(sessionId, msgs);
      return { messages };
    }),

  updateLastAssistantMessage: (sessionId, updater) =>
    set((s) => {
      const messages = new Map(s.messages);
      const list = [...(messages.get(sessionId) || [])];
      for (let i = list.length - 1; i >= 0; i--) {
        if (list[i].role === "assistant") {
          list[i] = updater(list[i]);
          break;
        }
      }
      messages.set(sessionId, list);
      return { messages };
    }),

  setStreaming: (sessionId, text) =>
    set((s) => {
      const streaming = new Map(s.streaming);
      if (text === null) streaming.delete(sessionId);
      else streaming.set(sessionId, text);
      return { streaming };
    }),

  setStreamingStats: (sessionId, stats) =>
    set((s) => {
      const streamingStartedAt = new Map(s.streamingStartedAt);
      const streamingOutputTokens = new Map(s.streamingOutputTokens);
      if (stats === null) {
        streamingStartedAt.delete(sessionId);
        streamingOutputTokens.delete(sessionId);
      } else {
        if (stats.startedAt !== undefined) streamingStartedAt.set(sessionId, stats.startedAt);
        if (stats.outputTokens !== undefined) streamingOutputTokens.set(sessionId, stats.outputTokens);
      }
      return { streamingStartedAt, streamingOutputTokens };
    }),

  addPermission: (sessionId, perm) =>
    set((s) => {
      const pendingPermissions = new Map(s.pendingPermissions);
      const sessionPerms = new Map(pendingPermissions.get(sessionId) || []);
      sessionPerms.set(perm.request_id, perm);
      pendingPermissions.set(sessionId, sessionPerms);
      return { pendingPermissions };
    }),

  removePermission: (sessionId, requestId) =>
    set((s) => {
      const pendingPermissions = new Map(s.pendingPermissions);
      const sessionPerms = pendingPermissions.get(sessionId);
      if (sessionPerms) {
        const updated = new Map(sessionPerms);
        updated.delete(requestId);
        pendingPermissions.set(sessionId, updated);
      }
      return { pendingPermissions };
    }),

  addTask: (sessionId, task) =>
    set((s) => {
      const sessionTasks = new Map(s.sessionTasks);
      const tasks = [...(sessionTasks.get(sessionId) || []), task];
      sessionTasks.set(sessionId, tasks);
      return { sessionTasks };
    }),

  setTasks: (sessionId, tasks) =>
    set((s) => {
      const sessionTasks = new Map(s.sessionTasks);
      sessionTasks.set(sessionId, tasks);
      return { sessionTasks };
    }),

  updateTask: (sessionId, taskId, updates) =>
    set((s) => {
      const sessionTasks = new Map(s.sessionTasks);
      const tasks = sessionTasks.get(sessionId);
      if (tasks) {
        sessionTasks.set(
          sessionId,
          tasks.map((t) => (t.id === taskId ? { ...t, ...updates } : t)),
        );
      }
      return { sessionTasks };
    }),

  addChangedFile: (sessionId, filePath) =>
    set((s) => {
      const changedFiles = new Map(s.changedFiles);
      const files = new Set(changedFiles.get(sessionId) || []);
      files.add(filePath);
      changedFiles.set(sessionId, files);
      return { changedFiles };
    }),

  clearChangedFiles: (sessionId) =>
    set((s) => {
      const changedFiles = new Map(s.changedFiles);
      changedFiles.delete(sessionId);
      return { changedFiles };
    }),

  addReadFile: (sessionId, filePath) =>
    set((s) => {
      const filesRead = new Map(s.filesRead);
      const files = new Set(filesRead.get(sessionId) || []);
      files.add(filePath);
      filesRead.set(sessionId, files);
      return { filesRead };
    }),

  addCommandExecuted: (sessionId, cmd) =>
    set((s) => {
      const commandsExecuted = new Map(s.commandsExecuted);
      const cmds = commandsExecuted.get(sessionId) || [];
      commandsExecuted.set(sessionId, [cmd, ...cmds].slice(0, 20));
      return { commandsExecuted };
    }),

  addAgentSpawned: (sessionId, agent) =>
    set((s) => {
      const agentsSpawned = new Map(s.agentsSpawned);
      agentsSpawned.set(sessionId, [...(agentsSpawned.get(sessionId) || []), agent]);
      return { agentsSpawned };
    }),

  addTestExecuted: (sessionId, test) =>
    set((s) => {
      const testsExecuted = new Map(s.testsExecuted);
      testsExecuted.set(sessionId, [...(testsExecuted.get(sessionId) || []), test]);
      return { testsExecuted };
    }),

  mergeModelUsage: (sessionId, modelUsage) =>
    set((s) => {
      const modelsInvoked = new Map(s.modelsInvoked);
      const existing = new Map(modelsInvoked.get(sessionId) || []);
      for (const [model, usage] of Object.entries(modelUsage)) {
        const prev = existing.get(model) || { inputTokens: 0, outputTokens: 0, costUSD: 0 };
        existing.set(model, {
          inputTokens: prev.inputTokens + usage.inputTokens,
          outputTokens: prev.outputTokens + usage.outputTokens,
          costUSD: prev.costUSD + usage.costUSD,
        });
      }
      modelsInvoked.set(sessionId, existing);
      return { modelsInvoked };
    }),

  setSessionName: (sessionId, name) =>
    set((s) => {
      const sessionNames = new Map(s.sessionNames);
      sessionNames.set(sessionId, name);
      localStorage.setItem("cc-session-names", JSON.stringify(Array.from(sessionNames.entries())));
      return { sessionNames };
    }),

  markRecentlyRenamed: (sessionId) =>
    set((s) => {
      const recentlyRenamed = new Set(s.recentlyRenamed);
      recentlyRenamed.add(sessionId);
      return { recentlyRenamed };
    }),

  clearRecentlyRenamed: (sessionId) =>
    set((s) => {
      const recentlyRenamed = new Set(s.recentlyRenamed);
      recentlyRenamed.delete(sessionId);
      return { recentlyRenamed };
    }),

  markClearOnNextResult: (sessionId) =>
    set((s) => {
      const clearOnNextResult = new Set(s.clearOnNextResult);
      clearOnNextResult.add(sessionId);
      return { clearOnNextResult };
    }),

  setQueuedMessage: (sessionId, msg) =>
    set((s) => {
      const queuedMessages = new Map(s.queuedMessages);
      queuedMessages.set(sessionId, msg);
      return { queuedMessages };
    }),

  clearQueuedMessage: (sessionId) =>
    set((s) => {
      const queuedMessages = new Map(s.queuedMessages);
      queuedMessages.delete(sessionId);
      return { queuedMessages };
    }),

  addPromptToHistory: (sessionId, prompt) =>
    set((s) => {
      const promptHistory = new Map(s.promptHistory);
      const history = [...(promptHistory.get(sessionId) || []), prompt];
      if (history.length > 50) history.splice(0, history.length - 50);
      promptHistory.set(sessionId, history);
      localStorage.setItem("cc-prompt-history", JSON.stringify(Array.from(promptHistory.entries())));
      return { promptHistory };
    }),

  setPreviousPermissionMode: (sessionId, mode) =>
    set((s) => {
      const previousPermissionMode = new Map(s.previousPermissionMode);
      previousPermissionMode.set(sessionId, mode);
      return { previousPermissionMode };
    }),

  setConnectionStatus: (sessionId, status) =>
    set((s) => {
      const connectionStatus = new Map(s.connectionStatus);
      connectionStatus.set(sessionId, status);
      return { connectionStatus };
    }),

  setCliConnected: (sessionId, connected) =>
    set((s) => {
      const cliConnected = new Map(s.cliConnected);
      cliConnected.set(sessionId, connected);
      return { cliConnected };
    }),

  setSessionStatus: (sessionId, status) =>
    set((s) => {
      const sessionStatus = new Map(s.sessionStatus);
      sessionStatus.set(sessionId, status);
      return { sessionStatus };
    }),

  setActiveTab: (tab) => set({ activeTab: tab }),

  setActiveProjectCwd: (cwd) => {
    const prev = useStore.getState();
    if (prev.activeProjectCwd && prev.currentSessionId) {
      const norm = prev.activeProjectCwd.replace(/\\/g, "/");
      const curState = prev.sessions.get(prev.currentSessionId);
      const sdkInfo = prev.sdkSessions.find((s) => s.sessionId === prev.currentSessionId);
      const curCwd = (curState?.cwd || sdkInfo?.cwd || "").replace(/\\/g, "/");
      if (!curCwd || curCwd === norm || curCwd.startsWith(norm + "/")) {
        console.log("[store] saving project→session mapping:", norm, "→", prev.currentSessionId);
        const projectSessionMap = new Map(prev.projectSessionMap);
        projectSessionMap.set(norm, prev.currentSessionId);
        set({ activeProjectCwd: cwd, projectSessionMap });
      } else {
        console.log("[store] skipping project→session mapping: session CWD", curCwd, "doesn't match project", norm);
        set({ activeProjectCwd: cwd });
      }
    } else {
      set({ activeProjectCwd: cwd });
    }
  },

  setProjectSession: (cwd, sessionId) =>
    set((s) => {
      const projectSessionMap = new Map(s.projectSessionMap);
      projectSessionMap.set(cwd.replace(/\\/g, "/"), sessionId);
      return { projectSessionMap };
    }),

  toggleHiddenProject: (path) =>
    set((s) => {
      const hiddenProjects = new Set(s.hiddenProjects);
      if (hiddenProjects.has(path)) hiddenProjects.delete(path);
      else hiddenProjects.add(path);
      localStorage.setItem("cc-hidden-projects", JSON.stringify([...hiddenProjects]));
      return { hiddenProjects };
    }),

  setTerminalOpen: (open) => set({ terminalOpen: open }),

  setEditorOpenFile: (sessionId, filePath) =>
    set((s) => {
      const editorOpenFile = new Map(s.editorOpenFile);
      if (filePath) editorOpenFile.set(sessionId, filePath);
      else editorOpenFile.delete(sessionId);
      return { editorOpenFile };
    }),

  setEditorUrl: (sessionId, url) =>
    set((s) => {
      const editorUrl = new Map(s.editorUrl);
      editorUrl.set(sessionId, url);
      return { editorUrl };
    }),

  setEditorLoading: (sessionId, loading) =>
    set((s) => {
      const editorLoading = new Map(s.editorLoading);
      editorLoading.set(sessionId, loading);
      return { editorLoading };
    }),

  reset: () =>
    set({
      sessions: new Map(),
      sdkSessions: [],
      currentSessionId: null,
      messages: new Map(),
      streaming: new Map(),
      streamingStartedAt: new Map(),
      streamingOutputTokens: new Map(),
      pendingPermissions: new Map(),
      connectionStatus: new Map(),
      cliConnected: new Map(),
      sessionStatus: new Map(),
      previousPermissionMode: new Map(),
      sessionTasks: new Map(),
      changedFiles: new Map(),
      filesRead: new Map(),
      commandsExecuted: new Map(),
      agentsSpawned: new Map(),
      testsExecuted: new Map(),
      modelsInvoked: new Map(),
      clearOnNextResult: new Set(),
      queuedMessages: new Map(),
      promptHistory: new Map(),
      sessionNames: new Map(),
      recentlyRenamed: new Set(),
      activeTab: "chat" as const,
      editorOpenFile: new Map(),
      editorUrl: new Map(),
      editorLoading: new Map(),
    }),
}));

// Clear the HMR snapshot after store is created (only needed once per HMR cycle)
delete WIN_STORE.__cc_store_state;

// ─── HMR: snapshot store state before module is replaced ────────────────
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    WIN_STORE.__cc_store_state = useStore.getState();
  });
  import.meta.hot.accept();
}
