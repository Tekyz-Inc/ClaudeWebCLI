import type { BrowserIncomingMessage } from "../types.js";
import { useStore } from "../store.js";
import { sendNotification } from "../utils/notifications.js";
import { nextId } from "./shared.js";
import { sendToSession } from "../ws.js";

export function handleResult(
  sessionId: string,
  data: Extract<BrowserIncomingMessage, { type: "result" }>,
) {
  const store = useStore.getState();
  const r = data.data;

  const sessionUpdates: Partial<{
    total_cost_usd: number;
    num_turns: number;
    context_used_percent: number;
    total_lines_added: number;
    total_lines_removed: number;
  }> = {
    total_cost_usd: r.total_cost_usd,
    num_turns: r.num_turns,
  };

  if (typeof r.total_lines_added === "number") {
    sessionUpdates.total_lines_added = r.total_lines_added;
  }
  if (typeof r.total_lines_removed === "number") {
    sessionUpdates.total_lines_removed = r.total_lines_removed;
  }

  if (r.modelUsage) {
    for (const usage of Object.values(r.modelUsage)) {
      if (usage.contextWindow > 0) {
        sessionUpdates.context_used_percent = Math.round(
          ((usage.inputTokens + usage.outputTokens) / usage.contextWindow) * 100,
        );
      }
    }
    store.mergeModelUsage(sessionId, r.modelUsage);
  }

  store.updateSession(sessionId, sessionUpdates);
  store.setStreaming(sessionId, null);
  store.setStreamingStats(sessionId, null);
  store.setSessionStatus(sessionId, "idle");

  // Fire any message queued while we were finishing
  const queued = store.queuedMessages.get(sessionId);
  if (queued) {
    const sent = sendToSession(sessionId, {
      type: "user_message",
      content: queued.content,
      session_id: sessionId,
      images: queued.images,
    });
    if (sent) {
      store.clearQueuedMessage(sessionId);
      store.setSessionStatus(sessionId, "submitted");
    } else {
      // Keep queued message — it will be retried on next result
      console.warn(`[result-handler] Queued message not sent for ${sessionId}, keeping in queue`);
    }
    if (/^\/(clear|compact)\b/i.test(queued.content)) {
      store.markClearOnNextResult(sessionId);
    }
  }

  // /clear or /compact was sent — wipe the chat now that the turn is complete
  if (store.clearOnNextResult.has(sessionId)) {
    store.setMessages(sessionId, []);
    const clearOnNextResult = new Set(store.clearOnNextResult);
    clearOnNextResult.delete(sessionId);
    useStore.setState({ clearOnNextResult });
  }

  const sessionName = store.sessionNames.get(sessionId) || "Session";
  sendNotification(`${sessionName} — Complete`, {
    body: `Cost: $${r.total_cost_usd.toFixed(4)} · ${r.num_turns} turns`,
    sessionId,
  });

  if (r.is_error && r.errors?.length) {
    store.appendMessage(sessionId, {
      id: nextId(),
      role: "system",
      content: `Error: ${r.errors.join(", ")}`,
      timestamp: Date.now(),
    });
  }
}
