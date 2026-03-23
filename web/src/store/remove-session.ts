import type { AppState } from "./types.js";

/**
 * Produces the next state after removing a session and all its associated data.
 * Extracted from store.ts to reduce file size.
 */
export function buildRemoveSessionState(
  s: AppState,
  sessionId: string,
): Partial<AppState> {
  const sessions = new Map(s.sessions);
  sessions.delete(sessionId);
  const messages = new Map(s.messages);
  messages.delete(sessionId);
  const streaming = new Map(s.streaming);
  streaming.delete(sessionId);
  const streamingStartedAt = new Map(s.streamingStartedAt);
  streamingStartedAt.delete(sessionId);
  const streamingOutputTokens = new Map(s.streamingOutputTokens);
  streamingOutputTokens.delete(sessionId);
  const connectionStatus = new Map(s.connectionStatus);
  connectionStatus.delete(sessionId);
  const cliConnected = new Map(s.cliConnected);
  cliConnected.delete(sessionId);
  const sessionStatus = new Map(s.sessionStatus);
  sessionStatus.delete(sessionId);
  const previousPermissionMode = new Map(s.previousPermissionMode);
  previousPermissionMode.delete(sessionId);
  const pendingPermissions = new Map(s.pendingPermissions);
  pendingPermissions.delete(sessionId);
  const sessionTasks = new Map(s.sessionTasks);
  sessionTasks.delete(sessionId);
  const changedFiles = new Map(s.changedFiles);
  changedFiles.delete(sessionId);
  const filesRead = new Map(s.filesRead);
  filesRead.delete(sessionId);
  const commandsExecuted = new Map(s.commandsExecuted);
  commandsExecuted.delete(sessionId);
  const agentsSpawned = new Map(s.agentsSpawned);
  agentsSpawned.delete(sessionId);
  const testsExecuted = new Map(s.testsExecuted);
  testsExecuted.delete(sessionId);
  const modelsInvoked = new Map(s.modelsInvoked);
  modelsInvoked.delete(sessionId);
  const sessionNames = new Map(s.sessionNames);
  sessionNames.delete(sessionId);
  const recentlyRenamed = new Set(s.recentlyRenamed);
  recentlyRenamed.delete(sessionId);
  const editorOpenFile = new Map(s.editorOpenFile);
  editorOpenFile.delete(sessionId);
  const editorUrl = new Map(s.editorUrl);
  editorUrl.delete(sessionId);
  const editorLoading = new Map(s.editorLoading);
  editorLoading.delete(sessionId);
  localStorage.setItem("cc-session-names", JSON.stringify(Array.from(sessionNames.entries())));
  if (s.currentSessionId === sessionId) {
    sessionStorage.removeItem("cc-current-session");
  }
  return {
    sessions,
    messages,
    streaming,
    streamingStartedAt,
    streamingOutputTokens,
    connectionStatus,
    cliConnected,
    sessionStatus,
    previousPermissionMode,
    pendingPermissions,
    sessionTasks,
    changedFiles,
    filesRead,
    commandsExecuted,
    agentsSpawned,
    testsExecuted,
    modelsInvoked,
    sessionNames,
    recentlyRenamed,
    editorOpenFile,
    editorUrl,
    editorLoading,
    sdkSessions: s.sdkSessions.filter((sdk) => sdk.sessionId !== sessionId),
    currentSessionId: s.currentSessionId === sessionId ? null : s.currentSessionId,
  };
}
