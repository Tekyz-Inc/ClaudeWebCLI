import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

export interface ClaudeSession {
  id: string;
  cwd: string;
  firstMessage: string | null;
  createdAt: string;
  lastActiveAt: string;
  isNative: true;
}

export function encodeProjectSlug(cwd: string): string {
  return cwd.replace(/[^a-zA-Z0-9]/g, "-");
}

interface JsonlContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

interface JsonlEntry {
  type?: string;
  message?: {
    role?: string;
    content?: string | JsonlContentBlock[];
  };
  timestamp?: string;
  cwd?: string;
}

function extractFirstMessage(entry: JsonlEntry, fallbackCwd: string): {
  firstMessage: string | null;
  createdAt: string | null;
  sessionCwd: string;
} {
  let firstMessage: string | null = null;
  const content = entry.message?.content;

  if (typeof content === "string") {
    firstMessage = content.trim().slice(0, 200);
  } else if (Array.isArray(content)) {
    const textBlock = content.find((b) => b.type === "text");
    if (textBlock?.text) {
      firstMessage = textBlock.text.trim().slice(0, 200);
    }
  }

  return {
    firstMessage,
    createdAt: entry.timestamp ?? null,
    sessionCwd: entry.cwd ?? fallbackCwd,
  };
}

export async function readClaudeSessionsFromDir(
  baseDir: string,
  cwd: string
): Promise<ClaudeSession[]> {
  let files: string[];
  try {
    const entries = await readdir(baseDir);
    files = entries.filter((f) => f.endsWith(".jsonl"));
  } catch {
    // expected: ~/.claude/projects/<slug> may not exist for this cwd
    return [];
  }

  const sessions: ClaudeSession[] = [];

  for (const file of files) {
    const id = file.replace(/\.jsonl$/, "");
    const filePath = join(baseDir, file);
    try {
      const fileStat = await stat(filePath);
      const lastActiveAt = fileStat.mtime.toISOString();
      const contents = await readFile(filePath, "utf-8");
      const lines = contents.split("\n").filter((l) => l.trim());

      let firstMessage: string | null = null;
      let createdAt = lastActiveAt;
      let sessionCwd = cwd;

      for (const line of lines) {
        try {
          const entry = JSON.parse(line) as JsonlEntry;
          if (entry.type === "user" && entry.message?.role === "user") {
            const extracted = extractFirstMessage(entry, cwd);
            firstMessage = extracted.firstMessage;
            if (extracted.createdAt) createdAt = extracted.createdAt;
            sessionCwd = extracted.sessionCwd;
            break;
          }
        } catch {
          // expected: partial/malformed JSONL line — probe next
          continue;
        }
      }

      sessions.push({ id, cwd: sessionCwd, firstMessage, createdAt, lastActiveAt, isNative: true });
    } catch {
      // expected: individual session file may be unreadable
      continue;
    }
  }

  return sessions.sort(
    (a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime()
  );
}

export async function readClaudeSessions(cwd: string): Promise<ClaudeSession[]> {
  const slug = encodeProjectSlug(cwd);
  const dir = join(homedir(), ".claude", "projects", slug);
  return readClaudeSessionsFromDir(dir, cwd);
}

export interface SessionHistoryContentBlock {
  type: "text" | "tool_use";
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

export interface SessionHistoryMessage {
  role: "user" | "assistant";
  content: string;
  contentBlocks?: SessionHistoryContentBlock[];
  timestamp: string;
}

export interface SessionActivityData {
  filesRead: string[];
  changedFiles: string[];
  commands: string[];
}

export async function readClaudeSessionActivity(
  cwd: string,
  sessionId: string
): Promise<SessionActivityData> {
  const slug = encodeProjectSlug(cwd);
  const filePath = join(homedir(), ".claude", "projects", slug, `${sessionId}.jsonl`);
  let contents: string;
  try {
    contents = await readFile(filePath, "utf-8");
  } catch {
    // expected: session file may not exist (archived, deleted, never written)
    return { filesRead: [], changedFiles: [], commands: [] };
  }
  const filesRead = new Set<string>();
  const changedFiles = new Set<string>();
  const commands: string[] = [];
  for (const line of contents.split("\n").filter((l) => l.trim())) {
    try {
      const entry = JSON.parse(line) as { type?: string; message?: { content?: unknown[] } };
      if (entry.type !== "assistant" || !Array.isArray(entry.message?.content)) continue;
      for (const block of entry.message!.content!) {
        const b = block as { type?: string; name?: string; input?: Record<string, unknown> };
        if (b.type !== "tool_use") continue;
        if (b.name === "Read" && typeof b.input?.file_path === "string") filesRead.add(b.input.file_path);
        if ((b.name === "Edit" || b.name === "Write") && typeof b.input?.file_path === "string") changedFiles.add(b.input.file_path);
        if (b.name === "Bash" && typeof b.input?.command === "string") commands.push(b.input.command);
      }
    } catch {
      // expected: malformed JSONL line — probe next
      continue;
    }
  }
  return { filesRead: Array.from(filesRead), changedFiles: Array.from(changedFiles), commands: commands.slice(-20).reverse() };
}

export async function readClaudeSessionMessages(
  cwd: string,
  sessionId: string
): Promise<SessionHistoryMessage[]> {
  const slug = encodeProjectSlug(cwd);
  const filePath = join(homedir(), ".claude", "projects", slug, `${sessionId}.jsonl`);
  let contents: string;
  try {
    contents = await readFile(filePath, "utf-8");
  } catch {
    // expected: session file may not exist (archived, deleted, never written)
    return [];
  }
  const messages: SessionHistoryMessage[] = [];
  const lines = contents.split("\n").filter((l) => l.trim());
  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as JsonlEntry;
      if (entry.type === "user" && entry.message?.role === "user") {
        const content = entry.message.content;
        let text = "";
        if (typeof content === "string") {
          text = content.trim();
        } else if (Array.isArray(content)) {
          const block = content.find((b) => b.type === "text");
          if (block?.text) text = block.text.trim();
        }
        if (text) messages.push({ role: "user", content: text, timestamp: entry.timestamp ?? new Date().toISOString() });
      } else if (entry.type === "assistant" && entry.message?.role === "assistant") {
        const content = entry.message.content;
        let text = "";
        let contentBlocks: SessionHistoryContentBlock[] | undefined;
        if (typeof content === "string") {
          text = content.trim();
        } else if (Array.isArray(content)) {
          text = content.filter((b) => b.type === "text").map((b) => b.text || "").filter(Boolean).join("\n");
          // Include text + tool_use blocks so the client can render diffs on resume
          const blocks = content.filter((b) => b.type === "text" || b.type === "tool_use");
          if (blocks.length > 0) {
            contentBlocks = blocks.map((b) => ({
              type: b.type as "text" | "tool_use",
              ...(b.type === "text" ? { text: b.text } : { id: b.id, name: b.name, input: b.input }),
            }));
          }
        }
        if (text || contentBlocks) {
          messages.push({ role: "assistant", content: text, contentBlocks, timestamp: entry.timestamp ?? new Date().toISOString() });
        }
      }
    } catch {
      // expected: malformed JSONL line — probe next
      continue;
    }
  }
  return messages;
}
