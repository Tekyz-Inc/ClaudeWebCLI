import type { ContentBlock, TaskItem } from "../types.js";
import { useStore } from "../store.js";

// ─── Shared ID counter ───────────────────────────────────────────────────────
let idCounter = 0;
export function nextId(): string {
  return `msg-${Date.now()}-${++idCounter}`;
}

// ─── Shared text extraction ──────────────────────────────────────────────────
export function extractTextFromBlocks(blocks: ContentBlock[]): string {
  return blocks
    .map((b) => {
      if (b.type === "text") return b.text;
      if (b.type === "thinking") return b.thinking;
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

// ─── Test command regex ──────────────────────────────────────────────────────
export const TEST_CMD_RE =
  /\b(vitest|playwright|jest|npm\s+(?:run\s+)?test|bun\s+(?:run\s+)?test|npx\s+playwright)\b/i;

// ─── Tool extraction helpers ─────────────────────────────────────────────────

export function extractTasksFromBlocks(
  sessionId: string,
  blocks: ContentBlock[],
  taskCounters: Map<string, number>,
  processedToolUseIds: Map<string, Set<string>>,
) {
  const store = useStore.getState();
  let processed = processedToolUseIds.get(sessionId);
  if (!processed) {
    processed = new Set();
    processedToolUseIds.set(sessionId, processed);
  }

  for (const block of blocks) {
    if (block.type !== "tool_use") continue;
    const { name, input, id: toolUseId } = block;

    if (toolUseId) {
      if (processed.has(toolUseId)) continue;
      processed.add(toolUseId);
    }

    if (name === "TodoWrite") {
      const todos = input.todos as { content?: string; status?: string; activeForm?: string }[] | undefined;
      if (Array.isArray(todos)) {
        const tasks: TaskItem[] = todos.map((t, i) => ({
          id: String(i + 1),
          subject: t.content || "Task",
          description: "",
          activeForm: t.activeForm,
          status: (t.status as TaskItem["status"]) || "pending",
        }));
        store.setTasks(sessionId, tasks);
        taskCounters.set(sessionId, tasks.length);
      }
      continue;
    }

    if (name === "TaskCreate") {
      const count = (taskCounters.get(sessionId) || 0) + 1;
      taskCounters.set(sessionId, count);
      store.addTask(sessionId, {
        id: String(count),
        subject: (input.subject as string) || "Task",
        description: (input.description as string) || "",
        activeForm: input.activeForm as string | undefined,
        status: "pending",
      });
      continue;
    }

    if (name === "TaskUpdate") {
      const taskId = input.taskId as string;
      if (taskId) {
        const updates: Partial<TaskItem> = {};
        if (input.status) updates.status = input.status as TaskItem["status"];
        if (input.owner) updates.owner = input.owner as string;
        if (input.activeForm !== undefined) updates.activeForm = input.activeForm as string;
        if (input.addBlockedBy) updates.blockedBy = input.addBlockedBy as string[];
        store.updateTask(sessionId, taskId, updates);
      }
    }
  }
}

export function extractChangedFilesFromBlocks(sessionId: string, blocks: ContentBlock[]) {
  const store = useStore.getState();
  for (const block of blocks) {
    if (block.type !== "tool_use") continue;
    const { name, input } = block;
    if ((name === "Edit" || name === "Write") && typeof input.file_path === "string") {
      store.addChangedFile(sessionId, input.file_path);
    }
  }
}

export function extractActivityFromBlocks(
  sessionId: string,
  blocks: ContentBlock[],
  parentToolUseId?: string | null,
) {
  const store = useStore.getState();
  for (const block of blocks) {
    if (block.type !== "tool_use") continue;
    const { name, input } = block;
    if (name === "Read" && typeof input.file_path === "string") {
      store.addReadFile(sessionId, input.file_path);
    }
    if (name === "Bash" && typeof input.command === "string") {
      if (TEST_CMD_RE.test(input.command)) {
        store.addTestExecuted(sessionId, {
          cmd: input.command,
          source: parentToolUseId ? "agent" : "direct",
          timestamp: Date.now(),
        });
      }
    }
    if (name === "Skill" && typeof input.skill === "string") {
      const args = typeof input.args === "string" && input.args ? ` ${input.args}` : "";
      store.addCommandExecuted(sessionId, `/${input.skill}${args}`);
    }
    if (name === "Agent") {
      store.addAgentSpawned(sessionId, {
        description: (input.description as string) || "Agent",
        subagentType: input.subagent_type as string | undefined,
        name: input.name as string | undefined,
      });
    }
  }
}
