/**
 * Tool grouping utilities shared by MessageFeed and MessageBubble.
 * Extracted from the components to reduce file sizes.
 */

import type { ChatMessage, ContentBlock } from "../types.js";

// ─── MessageBubble: content block grouping ──────────────────────────────────

export interface ToolGroupItem {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export type GroupedBlock =
  | { kind: "content"; block: ContentBlock }
  | { kind: "tool_group"; name: string; items: ToolGroupItem[] };

/**
 * Groups consecutive tool_use blocks of the same name within a message's content blocks.
 */
export function groupContentBlocks(blocks: ContentBlock[]): GroupedBlock[] {
  const groups: GroupedBlock[] = [];

  for (const block of blocks) {
    if (block.type === "tool_use") {
      const last = groups[groups.length - 1];
      if (last?.kind === "tool_group" && last.name === block.name) {
        last.items.push({ id: block.id, name: block.name, input: block.input });
      } else {
        groups.push({
          kind: "tool_group",
          name: block.name,
          items: [{ id: block.id, name: block.name, input: block.input }],
        });
      }
    } else {
      groups.push({ kind: "content", block });
    }
  }

  return groups;
}

// ─── MessageFeed: message-level grouping ────────────────────────────────────

export interface ToolItem {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolMsgGroup {
  kind: "tool_msg_group";
  toolName: string;
  items: ToolItem[];
  firstId: string;
}

export interface SubagentGroup {
  kind: "subagent";
  taskToolUseId: string;
  description: string;
  agentType: string;
  children: FeedEntry[];
}

export type FeedEntry =
  | { kind: "message"; msg: ChatMessage }
  | ToolMsgGroup
  | SubagentGroup;

/**
 * Returns the dominant tool name if the message is "tool-only" (all tool_use blocks of same name).
 * Returns null if it has text/thinking content or mixed tool types.
 */
export function getToolOnlyName(msg: ChatMessage): string | null {
  if (msg.role !== "assistant") return null;
  const blocks = msg.contentBlocks;
  if (!blocks || blocks.length === 0) return null;

  let toolName: string | null = null;
  for (const b of blocks) {
    if (b.type === "text" && b.text.trim()) return null;
    if (b.type === "thinking") return null;
    if (b.type === "tool_use") {
      if (toolName === null) toolName = b.name;
      else if (toolName !== b.name) return null;
    }
  }
  return toolName;
}

export function extractToolItems(msg: ChatMessage): ToolItem[] {
  const blocks = msg.contentBlocks || [];
  return blocks
    .filter(
      (b): b is ContentBlock & { type: "tool_use"; id: string; name: string; input: Record<string, unknown> } =>
        b.type === "tool_use",
    )
    .map((b) => ({ id: b.id, name: b.name, input: b.input }));
}

/** Get Task tool_use IDs from a feed entry */
export function getTaskIdsFromEntry(entry: FeedEntry): string[] {
  if (entry.kind === "message") {
    const blocks = entry.msg.contentBlocks || [];
    return blocks
      .filter((b): b is Extract<ContentBlock, { type: "tool_use" }> => b.type === "tool_use")
      .filter((b) => b.name === "Task")
      .map((b) => b.id);
  }
  if (entry.kind === "tool_msg_group" && entry.toolName === "Task") {
    return entry.items.map((item) => item.id);
  }
  return [];
}

/** Group consecutive same-tool messages */
export function groupToolMessages(messages: ChatMessage[]): FeedEntry[] {
  const entries: FeedEntry[] = [];

  for (const msg of messages) {
    const toolName = getToolOnlyName(msg);

    if (toolName) {
      const last = entries[entries.length - 1];
      if (last?.kind === "tool_msg_group" && last.toolName === toolName) {
        last.items.push(...extractToolItems(msg));
        continue;
      }
      entries.push({
        kind: "tool_msg_group",
        toolName,
        items: extractToolItems(msg),
        firstId: msg.id,
      });
    } else {
      entries.push({ kind: "message", msg });
    }
  }

  return entries;
}

function buildEntries(
  messages: ChatMessage[],
  taskInfo: Map<string, { description: string; agentType: string }>,
  childrenByParent: Map<string, ChatMessage[]>,
): FeedEntry[] {
  const grouped = groupToolMessages(messages);
  const result: FeedEntry[] = [];

  for (const entry of grouped) {
    result.push(entry);
    const taskIds = getTaskIdsFromEntry(entry);
    for (const taskId of taskIds) {
      const children = childrenByParent.get(taskId);
      if (children && children.length > 0) {
        const info = taskInfo.get(taskId) || { description: "Subagent", agentType: "" };
        const childEntries = buildEntries(children, taskInfo, childrenByParent);
        result.push({
          kind: "subagent",
          taskToolUseId: taskId,
          description: info.description,
          agentType: info.agentType,
          children: childEntries,
        });
      }
    }
  }

  return result;
}

/**
 * Top-level grouping function for MessageFeed.
 * Groups messages with subagent nesting and consecutive tool collapsing.
 */
export function groupMessages(messages: ChatMessage[]): FeedEntry[] {
  const taskInfo = new Map<string, { description: string; agentType: string }>();
  for (const msg of messages) {
    if (!msg.contentBlocks) continue;
    for (const b of msg.contentBlocks) {
      if (b.type === "tool_use" && b.name === "Task") {
        const { input, id } = b;
        taskInfo.set(id, {
          description: String(input?.description || "Subagent"),
          agentType: String(input?.subagent_type || ""),
        });
      }
    }
  }

  if (taskInfo.size === 0) {
    return groupToolMessages(messages);
  }

  const childrenByParent = new Map<string, ChatMessage[]>();
  const topLevel: ChatMessage[] = [];

  for (const msg of messages) {
    if (msg.parentToolUseId && taskInfo.has(msg.parentToolUseId)) {
      let arr = childrenByParent.get(msg.parentToolUseId);
      if (!arr) { arr = []; childrenByParent.set(msg.parentToolUseId, arr); }
      arr.push(msg);
    } else {
      topLevel.push(msg);
    }
  }

  return buildEntries(topLevel, taskInfo, childrenByParent);
}
