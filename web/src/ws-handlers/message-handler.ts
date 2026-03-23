import type { BrowserIncomingMessage, ChatMessage } from "../types.js";
import { useStore } from "../store.js";
import {
  nextId,
  extractTextFromBlocks,
  extractTasksFromBlocks,
  extractChangedFilesFromBlocks,
  extractActivityFromBlocks,
} from "./shared.js";

export function handleAssistant(
  sessionId: string,
  data: Extract<BrowserIncomingMessage, { type: "assistant" }>,
  taskCounters: Map<string, number>,
  processedToolUseIds: Map<string, Set<string>>,
) {
  const store = useStore.getState();
  const msg = data.message;
  const textContent = extractTextFromBlocks(msg.content);
  const chatMsg: ChatMessage = {
    id: msg.id,
    role: "assistant",
    content: textContent,
    contentBlocks: msg.content,
    timestamp: Date.now(),
    parentToolUseId: data.parent_tool_use_id,
    model: msg.model,
    stopReason: msg.stop_reason,
  };
  store.appendMessage(sessionId, chatMsg);
  store.setStreaming(sessionId, null);
  store.setSessionStatus(sessionId, "running");

  if (!store.streamingStartedAt.has(sessionId)) {
    store.setStreamingStats(sessionId, { startedAt: Date.now() });
  }

  if (msg.content?.length) {
    extractTasksFromBlocks(sessionId, msg.content, taskCounters, processedToolUseIds);
    extractChangedFilesFromBlocks(sessionId, msg.content);
    extractActivityFromBlocks(sessionId, msg.content, data.parent_tool_use_id);
  }
}

export function handleStreamEvent(
  sessionId: string,
  data: Extract<BrowserIncomingMessage, { type: "stream_event" }>,
) {
  const store = useStore.getState();
  const evt = data.event as Record<string, unknown>;
  if (!evt || typeof evt !== "object") return;

  if (evt.type === "message_start") {
    store.setSessionStatus(sessionId, "running");
    if (!store.streamingStartedAt.has(sessionId)) {
      store.setStreamingStats(sessionId, { startedAt: Date.now(), outputTokens: 0 });
    }
  }

  if (evt.type === "content_block_delta") {
    const delta = evt.delta as Record<string, unknown> | undefined;
    if (delta?.type === "text_delta" && typeof delta.text === "string") {
      const current = store.streaming.get(sessionId) || "";
      store.setStreaming(sessionId, current + delta.text);
    }
  }

  if (evt.type === "message_delta") {
    const usage = (evt as { usage?: { output_tokens?: number } }).usage;
    if (usage?.output_tokens) {
      store.setStreamingStats(sessionId, { outputTokens: usage.output_tokens });
    }
  }
}

export function handleMessageHistory(
  sessionId: string,
  data: Extract<BrowserIncomingMessage, { type: "message_history" }>,
  taskCounters: Map<string, number>,
  processedToolUseIds: Map<string, Set<string>>,
) {
  const store = useStore.getState();
  const existingMessages = store.messages.get(sessionId) ?? [];
  if (existingMessages.length > 0) return;

  const chatMessages: ChatMessage[] = [];
  for (const histMsg of data.messages) {
    if (histMsg.type === "user_message") {
      chatMessages.push({
        id: nextId(),
        role: "user",
        content: histMsg.content,
        timestamp: histMsg.timestamp,
      });
    } else if (histMsg.type === "assistant") {
      const msg = histMsg.message;
      const textContent = extractTextFromBlocks(msg.content);
      chatMessages.push({
        id: msg.id,
        role: "assistant",
        content: textContent,
        contentBlocks: msg.content,
        timestamp: Date.now(),
        parentToolUseId: histMsg.parent_tool_use_id,
        model: msg.model,
        stopReason: msg.stop_reason,
      });
      if (msg.content?.length) {
        extractTasksFromBlocks(sessionId, msg.content, taskCounters, processedToolUseIds);
        extractChangedFilesFromBlocks(sessionId, msg.content);
        extractActivityFromBlocks(sessionId, msg.content, histMsg.parent_tool_use_id);
      }
    } else if (histMsg.type === "result") {
      const r = histMsg.data;
      if (r.is_error && r.errors?.length) {
        chatMessages.push({
          id: nextId(),
          role: "system",
          content: `Error: ${r.errors.join(", ")}`,
          timestamp: Date.now(),
        });
      }
    }
  }
  if (chatMessages.length > 0) {
    store.setMessages(sessionId, chatMessages);
  }
}
