import { describe, it, expect, afterEach } from "vitest";
import { mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { encodeProjectSlug, readClaudeSessionsFromDir } from "./claude-sessions.js";

// ─── encodeProjectSlug ────────────────────────────────────────────────────────

describe("encodeProjectSlug", () => {
  it("converts Windows path with drive letter and backslashes", () => {
    expect(encodeProjectSlug("C:\\Users\\david\\ClaudeWebCLI")).toBe(
      "C--Users-david-ClaudeWebCLI"
    );
  });

  it("converts Unix path", () => {
    expect(encodeProjectSlug("/home/user/project")).toBe("-home-user-project");
  });

  it("replaces spaces with dashes", () => {
    expect(encodeProjectSlug("/my project/foo")).toBe("-my-project-foo");
  });
});

// ─── readClaudeSessionsFromDir ───────────────────────────────────────────────

const CWD = "/test/project";

let tempDir: string;

async function makeTempDir(): Promise<string> {
  tempDir = await mkdtemp(join(tmpdir(), "claude-sessions-test-"));
  return tempDir;
}

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
  }
});

function makeUserLine(opts: {
  id?: string;
  firstMessage?: string;
  timestamp?: string;
  cwd?: string;
  arrayContent?: boolean;
}): string {
  const content = opts.arrayContent
    ? [{ type: "text", text: opts.firstMessage ?? "hello" }]
    : (opts.firstMessage ?? "hello");
  return JSON.stringify({
    type: "user",
    message: { role: "user", content },
    timestamp: opts.timestamp ?? "2024-01-01T00:00:00.000Z",
    cwd: opts.cwd ?? CWD,
  });
}

describe("readClaudeSessionsFromDir", () => {
  it("returns empty array when directory does not exist", async () => {
    const result = await readClaudeSessionsFromDir("/nonexistent/path/xyz", CWD);
    expect(result).toEqual([]);
  });

  it("returns ClaudeSession with correct fields from string content", async () => {
    const dir = await makeTempDir();
    const sessionId = "abc-123-def";
    await writeFile(
      join(dir, `${sessionId}.jsonl`),
      makeUserLine({ firstMessage: "Tell me about TypeScript", timestamp: "2024-06-01T10:00:00.000Z", cwd: CWD })
    );

    const sessions = await readClaudeSessionsFromDir(dir, CWD);
    expect(sessions).toHaveLength(1);
    const s = sessions[0];
    expect(s.id).toBe(sessionId);
    expect(s.firstMessage).toBe("Tell me about TypeScript");
    expect(s.createdAt).toBe("2024-06-01T10:00:00.000Z");
    expect(s.cwd).toBe(CWD);
    expect(s.isNative).toBe(true);
    expect(typeof s.lastActiveAt).toBe("string");
  });

  it("extracts firstMessage from array content block", async () => {
    const dir = await makeTempDir();
    await writeFile(
      join(dir, "session-array.jsonl"),
      makeUserLine({ firstMessage: "Array message", arrayContent: true })
    );

    const sessions = await readClaudeSessionsFromDir(dir, CWD);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].firstMessage).toBe("Array message");
  });

  it("skips malformed lines and still returns valid sessions", async () => {
    const dir = await makeTempDir();
    const content = [
      "not valid json {{{",
      '{"type":"other","message":{"role":"user","content":"skip this"}}',
      makeUserLine({ firstMessage: "Valid message" }),
    ].join("\n");
    await writeFile(join(dir, "session-mixed.jsonl"), content);

    const sessions = await readClaudeSessionsFromDir(dir, CWD);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].firstMessage).toBe("Valid message");
  });

  it("sorts sessions newest-first by lastActiveAt", async () => {
    const dir = await makeTempDir();

    // Write two files — mtime will differ based on write order
    // Use a small delay to ensure different mtimes
    await writeFile(
      join(dir, "session-older.jsonl"),
      makeUserLine({ firstMessage: "older session", timestamp: "2024-01-01T00:00:00.000Z" })
    );

    // Wait briefly so OS mtime is different
    await new Promise((r) => setTimeout(r, 50));

    await writeFile(
      join(dir, "session-newer.jsonl"),
      makeUserLine({ firstMessage: "newer session", timestamp: "2024-06-01T00:00:00.000Z" })
    );

    const sessions = await readClaudeSessionsFromDir(dir, CWD);
    expect(sessions).toHaveLength(2);
    // Newer mtime should come first
    expect(new Date(sessions[0].lastActiveAt).getTime()).toBeGreaterThanOrEqual(
      new Date(sessions[1].lastActiveAt).getTime()
    );
  });

  it("sets firstMessage to null when no user message found", async () => {
    const dir = await makeTempDir();
    await writeFile(
      join(dir, "session-no-user.jsonl"),
      JSON.stringify({ type: "assistant", message: { role: "assistant", content: "hi" } })
    );

    const sessions = await readClaudeSessionsFromDir(dir, CWD);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].firstMessage).toBeNull();
  });

  it("ignores non-jsonl files in the directory", async () => {
    const dir = await makeTempDir();
    await writeFile(join(dir, "not-a-session.txt"), "some content");
    await writeFile(join(dir, "another.json"), "{}");
    await writeFile(
      join(dir, "real-session.jsonl"),
      makeUserLine({ firstMessage: "real" })
    );

    const sessions = await readClaudeSessionsFromDir(dir, CWD);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].firstMessage).toBe("real");
  });
});
