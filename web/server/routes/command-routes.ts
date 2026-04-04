import type { Hono } from "hono";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { readClaudeSessions, readClaudeSessionMessages, readClaudeSessionActivity } from "../claude-sessions.js";

function parseArgumentHint(content: string): string | undefined {
  if (!content.startsWith("---")) return undefined;
  const end = content.indexOf("---", 3);
  if (end === -1) return undefined;
  const fm = content.slice(3, end);
  const match = fm.match(/^argument-hint:\s*["']?(.+?)["']?\s*$/m);
  return match?.[1];
}

async function readCommandDir(dir: string, prefix?: string): Promise<{ names: string[]; hints: Record<string, string> }> {
  const names: string[] = [];
  const hints: Record<string, string> = {};
  try {
    const files = (await readdir(dir)).filter((f) => f.endsWith(".md")).sort();
    for (const f of files) {
      const name = prefix ? `${prefix}${f.slice(0, -3)}` : f.slice(0, -3);
      names.push(name);
      try {
        const content = await readFile(join(dir, f), "utf-8");
        const hint = parseArgumentHint(content);
        if (hint) hints[name] = hint;
      } catch { /* skip unreadable */ }
    }
  } catch { /* dir doesn't exist */ }
  return { names, hints };
}

const BUILTIN_COMMANDS = [
  "help", "clear", "compact", "context", "cost", "config",
  "exit", "quit", "vim", "multiline", "review",
  "init", "doctor", "bug", "login", "logout",
  "resume", "release-notes", "status", "approve", "reject",
  "btw", "model", "memory", "permission", "add-dir",
  "pr-comments", "security-review", "extra-usage", "insights",
];

export function registerCommandRoutes(api: Hono): void {
  api.get("/claude-sessions", async (c) => {
    const cwd = c.req.query("cwd");
    if (!cwd) return c.json({ error: "cwd is required" }, 400);
    try {
      const sessions = await readClaudeSessions(cwd);
      return c.json(sessions);
    } catch (err) {
      return c.json({ error: String(err) }, 500);
    }
  });

  api.get("/claude-sessions/:id/messages", async (c) => {
    const sessionId = c.req.param("id");
    const cwd = c.req.query("cwd");
    if (!cwd) return c.json({ error: "cwd is required" }, 400);
    try {
      const messages = await readClaudeSessionMessages(cwd, sessionId);
      return c.json(messages);
    } catch (err) {
      return c.json({ error: String(err) }, 500);
    }
  });

  api.get("/claude-sessions/:id/activity", async (c) => {
    const sessionId = c.req.param("id");
    const cwd = c.req.query("cwd");
    if (!cwd) return c.json({ error: "cwd is required" }, 400);
    try {
      const activity = await readClaudeSessionActivity(cwd, sessionId);
      return c.json(activity);
    } catch (err) {
      return c.json({ error: String(err) }, 500);
    }
  });

  api.get("/projects", async (c) => {
    const projectsFile = join(homedir(), ".claude", ".gsd-t-projects");
    try {
      const content = await readFile(projectsFile, "utf-8");
      const projects = content
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const parts = line.split("|");
          const path = (parts.length >= 2 ? parts[1] : parts[0]).trim().replace(/\\/g, "/");
          const name = parts.length >= 2 ? parts[0].trim() : (path.split("/").pop() || path);
          return { name, path };
        });
      return c.json({ projects });
    } catch {
      return c.json({ projects: [] });
    }
  });

  /** Return the user's global Claude settings (permission defaults, model, etc.) */
  api.get("/claude-settings", async (c) => {
    const settingsPath = join(homedir(), ".claude", "settings.json");
    try {
      const raw = await readFile(settingsPath, "utf-8");
      const settings = JSON.parse(raw);
      return c.json({
        defaultPermissionMode: "bypassPermissions",
        defaultModel: settings.env?.ANTHROPIC_MODEL ?? null,
      });
    } catch {
      return c.json({ defaultPermissionMode: "default", defaultModel: null });
    }
  });

  api.get("/slash-commands", async (c) => {
    const userCommandsDir = join(homedir(), ".claude", "commands");
    const userResult = await readCommandDir(userCommandsDir, "user:");
    const cwd = c.req.query("cwd");
    const projectResult = cwd
      ? await readCommandDir(join(cwd, ".claude", "commands"))
      : { names: [], hints: {} };
    return c.json({
      commands: BUILTIN_COMMANDS,
      skills: [...userResult.names, ...projectResult.names],
      argumentHints: { ...userResult.hints, ...projectResult.hints },
    });
  });
}
