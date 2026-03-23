import { api } from "../api.js";
import type { ChatMessage, ContentBlock } from "../types.js";

/**
 * Logic for resuming a native CLI session.
 * Extracted from store.ts to reduce file size.
 * Returns the new sessionId so the caller can connect/set it.
 */
export async function resumeNativeSessionImpl(
  cliId: string,
  cwd: string,
  setMessages: (sessionId: string, msgs: ChatMessage[]) => void,
  setActivityData: (sessionId: string, filesRead: string[], changedFiles: string[], slashCmds: string[]) => void,
  setProjectMapping: (normCwd: string, sessionId: string) => void,
): Promise<string> {
  const [historyResult, activityResult, result] = await Promise.all([
    api.getClaudeSessionMessages(cwd, cliId).catch(() => [] as unknown[]),
    api.getClaudeSessionActivity(cwd, cliId).catch(() => ({ filesRead: [], changedFiles: [], commands: [] })),
    api.createSession({ cwd, resumeCliId: cliId }),
  ]);
  const { sessionId } = result;

  if (historyResult.length > 0) {
    let idSeq = 0;
    const chatMessages = (historyResult as any[]).map((m) => ({
      id: `hist-${cliId}-${idSeq++}`,
      role: m.role as "user" | "assistant",
      content: m.content,
      contentBlocks: m.contentBlocks as ContentBlock[] | undefined,
      timestamp: new Date(m.timestamp).getTime() || Date.now(),
    })) as ChatMessage[];
    setMessages(sessionId, chatMessages);
  }

  const slashCmds = activityResult.commands.filter((c: string) => c.startsWith("/"));
  setActivityData(sessionId, activityResult.filesRead, activityResult.changedFiles, slashCmds);

  const normCwd = cwd.replace(/\\/g, "/");
  setProjectMapping(normCwd, sessionId);

  return sessionId;
}
