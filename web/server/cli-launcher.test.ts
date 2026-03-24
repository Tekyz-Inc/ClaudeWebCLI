import { vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// ─── Hoisted mocks ──────────────────────────────────────────────────────────

// Mock randomUUID so session IDs are deterministic
vi.mock("node:crypto", () => ({ randomUUID: () => "test-session-id" }));

// Mock execFile (promisified) for `which`/`where` command resolution
const isWin = process.platform === "win32";
const mockClaudePath = isWin ? "C:\\Program Files\\claude.cmd" : "/usr/bin/claude";
const mockExecFile = vi.hoisted(() => vi.fn());
vi.mock("node:child_process", () => ({ execFile: vi.fn() }));
vi.mock("node:util", () => ({
  promisify: (_fn: unknown) => mockExecFile,
}));

// Mock fs operations for worktree guardrails (CLAUDE.md in .claude dirs)
const mockMkdirAsync = vi.hoisted(() => vi.fn((..._args: any[]) => Promise.resolve()));
const mockExistsSync = vi.hoisted(() => vi.fn((..._args: any[]) => false));
const mockReadFileAsync = vi.hoisted(() => vi.fn((..._args: any[]) => Promise.reject(Object.assign(new Error("ENOENT"), { code: "ENOENT" }))));
const mockWriteFileAsync = vi.hoisted(() => vi.fn((..._args: any[]) => Promise.resolve()));
const isMockedPath = vi.hoisted(() => (path: string): boolean => {
  return path.includes(".claude") || path.startsWith("/tmp/worktrees/") || path.startsWith("/tmp/main-repo");
});

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    mkdir: (...args: any[]) => {
      if (typeof args[0] === "string" && isMockedPath(args[0])) {
        return mockMkdirAsync(...args);
      }
      return actual.mkdir(...args);
    },
    readFile: (...args: any[]) => {
      if (typeof args[0] === "string" && isMockedPath(args[0])) {
        return mockReadFileAsync(...args);
      }
      return actual.readFile(...args);
    },
    writeFile: (...args: any[]) => {
      if (typeof args[0] === "string" && isMockedPath(args[0])) {
        return mockWriteFileAsync(...args);
      }
      return actual.writeFile(...args);
    },
  };
});

vi.mock("node:fs", async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    existsSync: (...args: any[]) => {
      if (typeof args[0] === "string" && isMockedPath(args[0])) {
        return mockExistsSync(...args);
      }
      return actual.existsSync(...args);
    },
  };
});

// ─── Imports (after mocks) ───────────────────────────────────────────────────

import { SessionStore } from "./session-store.js";
import { CliLauncher } from "./cli-launcher.js";

// ─── Bun.spawn mock ─────────────────────────────────────────────────────────

let exitResolve: (code: number) => void;

function createMockProc(pid = 12345) {
  let resolve: (code: number) => void;
  const exitedPromise = new Promise<number>((r) => {
    resolve = r;
  });
  exitResolve = resolve!;
  return {
    pid,
    kill: vi.fn(),
    exited: exitedPromise,
    stdout: null,
    stderr: null,
  };
}

const mockSpawn = vi.fn();
vi.stubGlobal("Bun", { spawn: mockSpawn });

// ─── Test setup ──────────────────────────────────────────────────────────────

let tempDir: string;
let store: SessionStore;
let launcher: CliLauncher;

beforeEach(() => {
  vi.clearAllMocks();
  tempDir = mkdtempSync(join(tmpdir(), "launcher-test-"));
  store = new SessionStore(tempDir);
  launcher = new CliLauncher(3456);
  launcher.setStore(store);
  mockSpawn.mockReturnValue(createMockProc());
  mockExecFile.mockResolvedValue({ stdout: mockClaudePath, stderr: "" });
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

// ─── launch ──────────────────────────────────────────────────────────────────

describe("launch", () => {
  it("creates a session with a UUID and starting state", () => {
    const info = launcher.launch({ cwd: "/tmp/project" });

    expect(info.sessionId).toBe("test-session-id");
    expect(info.state).toBe("starting");
    expect(info.cwd).toBe("/tmp/project");
    expect(info.createdAt).toBeGreaterThan(0);
  });

  it("spawns CLI with correct --sdk-url and flags", async () => {
    launcher.launch({ cwd: "/tmp/project" });
    await new Promise((r) => setTimeout(r, 20));

    expect(mockSpawn).toHaveBeenCalledOnce();
    const [cmdAndArgs, options] = mockSpawn.mock.calls[0];

    // Binary should be resolved via execFile (async)
    expect(cmdAndArgs[0]).toBe(mockClaudePath);

    // Core required flags
    expect(cmdAndArgs).toContain("--sdk-url");
    expect(cmdAndArgs).toContain("ws://localhost:3456/ws/cli/test-session-id");
    expect(cmdAndArgs).toContain("--print");
    expect(cmdAndArgs).toContain("--output-format");
    expect(cmdAndArgs).toContain("stream-json");
    expect(cmdAndArgs).toContain("--input-format");
    expect(cmdAndArgs).toContain("--verbose");

    // Headless prompt
    expect(cmdAndArgs).toContain("-p");
    expect(cmdAndArgs).toContain("");

    // Spawn options
    expect(options.cwd).toBe("/tmp/project");
    expect(options.stdout).toBe("pipe");
    expect(options.stderr).toBe("pipe");
  });

  it("passes --model when provided", async () => {
    launcher.launch({ model: "claude-opus-4-20250514", cwd: "/tmp" });
    await new Promise((r) => setTimeout(r, 20));

    const [cmdAndArgs] = mockSpawn.mock.calls[0];
    const modelIdx = cmdAndArgs.indexOf("--model");
    expect(modelIdx).toBeGreaterThan(-1);
    expect(cmdAndArgs[modelIdx + 1]).toBe("claude-opus-4-20250514");
  });

  it("passes --permission-mode when provided", async () => {
    launcher.launch({ permissionMode: "bypassPermissions", cwd: "/tmp" });
    await new Promise((r) => setTimeout(r, 20));

    const [cmdAndArgs] = mockSpawn.mock.calls[0];
    const modeIdx = cmdAndArgs.indexOf("--permission-mode");
    expect(modeIdx).toBeGreaterThan(-1);
    expect(cmdAndArgs[modeIdx + 1]).toBe("bypassPermissions");
  });

  it("passes --allowedTools for each tool", async () => {
    launcher.launch({
      allowedTools: ["Read", "Write", "Bash"],
      cwd: "/tmp",
    });
    await new Promise((r) => setTimeout(r, 20));

    const [cmdAndArgs] = mockSpawn.mock.calls[0];
    // Each tool gets its own --allowedTools flag
    const toolFlags = cmdAndArgs.reduce(
      (acc: string[], arg: string, i: number) => {
        if (arg === "--allowedTools") acc.push(cmdAndArgs[i + 1]);
        return acc;
      },
      [],
    );
    expect(toolFlags).toEqual(["Read", "Write", "Bash"]);
  });

  it("resolves binary path with `which`/`where` when not absolute", async () => {
    launcher.launch({ claudeBinary: "claude-dev", cwd: "/tmp" });
    // Allow async binary resolution to complete
    await new Promise((r) => setTimeout(r, 20));

    const expectedBin = isWin ? "where" : "which";
    expect(mockExecFile).toHaveBeenCalledWith(expectedBin, ["claude-dev"], {
      encoding: "utf-8",
    });
  });

  it("skips `which` resolution when binary path is absolute", async () => {
    launcher.launch({
      claudeBinary: "/opt/bin/claude",
      cwd: "/tmp",
    });
    // Allow async spawn to complete
    await new Promise((r) => setTimeout(r, 20));

    expect(mockExecFile).not.toHaveBeenCalled();
    const [cmdAndArgs] = mockSpawn.mock.calls[0];
    expect(cmdAndArgs[0]).toBe("/opt/bin/claude");
  });

  it("stores worktree metadata when worktreeInfo provided", () => {
    const info = launcher.launch({
      cwd: "/tmp/worktrees/feature-branch",
      worktreeInfo: {
        isWorktree: true,
        repoRoot: "/tmp/main-repo",
        branch: "feature-branch",
        actualBranch: "feature-branch",
        worktreePath: "/tmp/worktrees/feature-branch",
      },
    });

    expect(info.isWorktree).toBe(true);
    expect(info.repoRoot).toBe("/tmp/main-repo");
    expect(info.branch).toBe("feature-branch");
    expect(info.actualBranch).toBe("feature-branch");
  });

  it("injects worktree guardrails when isWorktree=true", async () => {
    // existsSync returns true for the worktree path (it exists on disk)
    mockExistsSync.mockImplementation((path: string) => {
      if (path === "/tmp/worktrees/feature-x") return true;
      if (typeof path === "string" && path.includes(".claude")) return false;
      return false;
    });

    launcher.launch({
      cwd: "/tmp/worktrees/feature-x",
      worktreeInfo: {
        isWorktree: true,
        repoRoot: "/tmp/main-repo",
        branch: "feature-x",
        actualBranch: "feature-x",
        worktreePath: "/tmp/worktrees/feature-x",
      },
    });

    // Allow async guardrails injection to complete
    await new Promise((r) => setTimeout(r, 20));

    // Should create .claude directory
    expect(mockMkdirAsync).toHaveBeenCalledWith(
      join("/tmp/worktrees/feature-x", ".claude"),
      { recursive: true },
    );

    // Should write CLAUDE.md with guardrails content
    expect(mockWriteFileAsync).toHaveBeenCalled();
    const writeCall = mockWriteFileAsync.mock.calls[0];
    expect(writeCall[0]).toBe(
      join("/tmp/worktrees/feature-x", ".claude", "CLAUDE.md"),
    );
    const content = writeCall[1] as string;
    expect(content).toContain("WORKTREE_GUARDRAILS_START");
    expect(content).toContain("feature-x");
    expect(content).toContain("/tmp/main-repo");
    expect(content).toContain("DO NOT run `git checkout`");
  });

  it("injects guardrails with parent branch label when actualBranch differs", async () => {
    mockExistsSync.mockImplementation((path: string) => {
      if (path === "/tmp/worktrees/main-wt-2") return true;
      if (typeof path === "string" && path.includes(".claude")) return false;
      return false;
    });

    launcher.launch({
      cwd: "/tmp/worktrees/main-wt-2",
      worktreeInfo: {
        isWorktree: true,
        repoRoot: "/tmp/main-repo",
        branch: "main",
        actualBranch: "main-wt-2",
        worktreePath: "/tmp/worktrees/main-wt-2",
      },
    });

    // Allow async guardrails injection to complete
    await new Promise((r) => setTimeout(r, 20));

    expect(mockWriteFileAsync).toHaveBeenCalled();
    const content = mockWriteFileAsync.mock.calls[0][1] as string;
    // Should mention the actual branch and the parent branch
    expect(content).toContain("main-wt-2");
    expect(content).toContain("(created from `main`)");
    expect(content).toContain("MUST stay on the `main-wt-2` branch");
  });

  it("does NOT inject guardrails when worktree path equals main repo root", async () => {
    mockExistsSync.mockReturnValue(true);

    launcher.launch({
      cwd: "/tmp/main-repo",
      worktreeInfo: {
        isWorktree: true,
        repoRoot: "/tmp/main-repo",
        branch: "main",
        actualBranch: "main",
        worktreePath: "/tmp/main-repo",
      },
    });

    // Allow async guardrails injection to complete
    await new Promise((r) => setTimeout(r, 20));

    // Should NOT write CLAUDE.md — worktree path is the main repo
    expect(mockWriteFileAsync).not.toHaveBeenCalled();
    expect(mockMkdirAsync).not.toHaveBeenCalled();
  });

  it("does NOT inject guardrails when worktree path does not exist on disk", async () => {
    // Worktree path doesn't exist (git worktree add failed or not yet run)
    mockExistsSync.mockReturnValue(false);

    launcher.launch({
      cwd: "/tmp/worktrees/nonexistent",
      worktreeInfo: {
        isWorktree: true,
        repoRoot: "/tmp/main-repo",
        branch: "feature-y",
        actualBranch: "feature-y",
        worktreePath: "/tmp/worktrees/nonexistent",
      },
    });

    // Allow async guardrails injection to complete
    await new Promise((r) => setTimeout(r, 20));

    // Should NOT write CLAUDE.md — path doesn't exist
    expect(mockWriteFileAsync).not.toHaveBeenCalled();
    expect(mockMkdirAsync).not.toHaveBeenCalled();
  });

  it("sets session pid from spawned process", async () => {
    mockSpawn.mockReturnValue(createMockProc(99999));
    const info = launcher.launch({ cwd: "/tmp" });
    await new Promise((r) => setTimeout(r, 20));
    expect(info.pid).toBe(99999);
  });

  it("strips CLAUDECODE from environment to prevent nested session launch errors", async () => {
    launcher.launch({ cwd: "/tmp" });
    await new Promise((r) => setTimeout(r, 20));

    const [, options] = mockSpawn.mock.calls[0];
    expect(options.env.CLAUDECODE).toBeUndefined();
  });

  it("merges custom env variables", async () => {
    launcher.launch({
      cwd: "/tmp",
      env: { MY_VAR: "hello" },
    });
    await new Promise((r) => setTimeout(r, 20));

    const [, options] = mockSpawn.mock.calls[0];
    expect(options.env.MY_VAR).toBe("hello");
    // CLAUDECODE is stripped to prevent nested session launch errors
    expect(options.env.CLAUDECODE).toBeUndefined();
  });

  it("pre-populates cliSessionId when resumeCliId is provided", () => {
    const info = launcher.launch({ cwd: "/tmp/project", resumeCliId: "native-cli-uuid" });

    expect(info.cliSessionId).toBe("native-cli-uuid");
  });

  it("spawns CLI with --resume when resumeCliId is set", async () => {
    launcher.launch({ cwd: "/tmp/project", resumeCliId: "native-cli-uuid" });
    await new Promise((r) => setTimeout(r, 20));

    const [cmdAndArgs] = mockSpawn.mock.calls[0];
    const resumeIdx = cmdAndArgs.indexOf("--resume");
    expect(resumeIdx).toBeGreaterThan(-1);
    expect(cmdAndArgs[resumeIdx + 1]).toBe("native-cli-uuid");
  });
});

// ─── state management ────────────────────────────────────────────────────────

describe("state management", () => {
  describe("markConnected", () => {
    it("sets state to connected", () => {
      launcher.launch({ cwd: "/tmp" });
      launcher.markConnected("test-session-id");

      const session = launcher.getSession("test-session-id");
      expect(session?.state).toBe("connected");
    });

    it("does nothing for unknown session", () => {
      // Should not throw
      launcher.markConnected("nonexistent");
    });
  });

  describe("setCLISessionId", () => {
    it("stores the CLI session ID", () => {
      launcher.launch({ cwd: "/tmp" });
      launcher.setCLISessionId("test-session-id", "cli-internal-abc");

      const session = launcher.getSession("test-session-id");
      expect(session?.cliSessionId).toBe("cli-internal-abc");
    });

    it("does nothing for unknown session", () => {
      // Should not throw
      launcher.setCLISessionId("nonexistent", "cli-id");
    });
  });

  describe("isAlive", () => {
    it("returns true for non-exited session", () => {
      launcher.launch({ cwd: "/tmp" });
      expect(launcher.isAlive("test-session-id")).toBe(true);
    });

    it("returns false for exited session", async () => {
      launcher.launch({ cwd: "/tmp" });

      // Simulate process exit
      exitResolve(0);
      // Allow the .then callback in spawnCLI to run
      await new Promise((r) => setTimeout(r, 10));

      expect(launcher.isAlive("test-session-id")).toBe(false);
    });

    it("returns false for unknown session", () => {
      expect(launcher.isAlive("nonexistent")).toBe(false);
    });
  });

  describe("listSessions", () => {
    it("returns all sessions", () => {
      // Because randomUUID is mocked to always return the same value,
      // we need to test with a single launch. But we can verify the list.
      launcher.launch({ cwd: "/tmp" });
      const sessions = launcher.listSessions();

      expect(sessions).toHaveLength(1);
      expect(sessions[0].sessionId).toBe("test-session-id");
    });

    it("returns empty array when no sessions exist", () => {
      expect(launcher.listSessions()).toEqual([]);
    });
  });

  describe("getSession", () => {
    it("returns a specific session", () => {
      launcher.launch({ cwd: "/tmp/myproject" });

      const session = launcher.getSession("test-session-id");
      expect(session).toBeDefined();
      expect(session?.cwd).toBe("/tmp/myproject");
    });

    it("returns undefined for unknown session", () => {
      expect(launcher.getSession("nonexistent")).toBeUndefined();
    });
  });

  describe("pruneExited", () => {
    it("removes exited sessions and returns count", async () => {
      launcher.launch({ cwd: "/tmp" });

      // Simulate process exit
      exitResolve(0);
      await new Promise((r) => setTimeout(r, 10));

      expect(launcher.getSession("test-session-id")?.state).toBe("exited");

      const pruned = launcher.pruneExited();
      expect(pruned).toBe(1);
      expect(launcher.listSessions()).toHaveLength(0);
    });

    it("returns 0 when no sessions are exited", () => {
      launcher.launch({ cwd: "/tmp" });
      const pruned = launcher.pruneExited();
      expect(pruned).toBe(0);
      expect(launcher.listSessions()).toHaveLength(1);
    });
  });

  describe("setArchived", () => {
    it("sets the archived flag on a session", () => {
      launcher.launch({ cwd: "/tmp" });
      launcher.setArchived("test-session-id", true);

      const session = launcher.getSession("test-session-id");
      expect(session?.archived).toBe(true);
    });

    it("can unset the archived flag", () => {
      launcher.launch({ cwd: "/tmp" });
      launcher.setArchived("test-session-id", true);
      launcher.setArchived("test-session-id", false);

      const session = launcher.getSession("test-session-id");
      expect(session?.archived).toBe(false);
    });

    it("does nothing for unknown session", () => {
      // Should not throw
      launcher.setArchived("nonexistent", true);
    });
  });

  describe("removeSession", () => {
    it("deletes session from internal maps", () => {
      launcher.launch({ cwd: "/tmp" });
      expect(launcher.getSession("test-session-id")).toBeDefined();

      launcher.removeSession("test-session-id");
      expect(launcher.getSession("test-session-id")).toBeUndefined();
      expect(launcher.listSessions()).toHaveLength(0);
    });

    it("does nothing for unknown session", () => {
      // Should not throw
      launcher.removeSession("nonexistent");
    });
  });
});

// ─── kill ────────────────────────────────────────────────────────────────────

describe("kill", () => {
  it("sends SIGTERM via proc.kill", async () => {
    launcher.launch({ cwd: "/tmp" });
    // Wait for async spawn to complete so mockSpawn.mock.results is populated
    await new Promise((r) => setTimeout(r, 20));

    // Grab the mock proc
    const mockProc = mockSpawn.mock.results[0].value;

    // Resolve the exit promise so kill() doesn't wait on the timeout
    setTimeout(() => exitResolve(0), 5);

    const result = await launcher.kill("test-session-id");

    expect(result).toBe(true);
    expect(mockProc.kill).toHaveBeenCalledWith("SIGTERM");
  });

  it("marks session as exited", async () => {
    launcher.launch({ cwd: "/tmp" });
    // Wait for async spawn to complete
    await new Promise((r) => setTimeout(r, 20));

    setTimeout(() => exitResolve(0), 5);
    await launcher.kill("test-session-id");

    const session = launcher.getSession("test-session-id");
    expect(session?.state).toBe("exited");
    expect(session?.exitCode).toBe(-1);
  });

  it("returns false for unknown session", async () => {
    const result = await launcher.kill("nonexistent");
    expect(result).toBe(false);
  });
});

// ─── relaunch ────────────────────────────────────────────────────────────────

describe("relaunch", () => {
  it("kills old process and spawns new one with --resume", async () => {
    // Create first proc whose exit resolves immediately when killed
    let resolveFirst: (code: number) => void;
    const firstProc = {
      pid: 12345,
      kill: vi.fn(() => { resolveFirst(0); }),
      exited: new Promise<number>((r) => { resolveFirst = r; }),
      stdout: null,
      stderr: null,
    };
    mockSpawn.mockReturnValueOnce(firstProc);

    launcher.launch({ cwd: "/tmp/project", model: "claude-sonnet-4-5-20250929" });
    // Wait for async spawn to complete so the first process is registered
    await new Promise((r) => setTimeout(r, 20));
    launcher.setCLISessionId("test-session-id", "cli-resume-id");

    // Second proc for the relaunch — never exits during test
    const secondProc = createMockProc(54321);
    mockSpawn.mockReturnValueOnce(secondProc);

    const result = await launcher.relaunch("test-session-id");
    expect(result).toBe(true);

    // Old process should have been killed
    expect(firstProc.kill).toHaveBeenCalledWith("SIGTERM");

    // New process should be spawned with --resume
    expect(mockSpawn).toHaveBeenCalledTimes(2);
    const [cmdAndArgs] = mockSpawn.mock.calls[1];
    expect(cmdAndArgs).toContain("--resume");
    expect(cmdAndArgs).toContain("cli-resume-id");

    // Session state should be reset to starting (set by relaunch before spawnCLI)
    // Allow microtask queue to flush
    await new Promise((r) => setTimeout(r, 10));
    const session = launcher.getSession("test-session-id");
    expect(session?.state).toBe("starting");
  });

  it("returns false for unknown session", async () => {
    const result = await launcher.relaunch("nonexistent");
    expect(result).toBe(false);
  });
});

// ─── persistence ─────────────────────────────────────────────────────────────

describe("persistence", () => {
  describe("restoreFromDisk", () => {
    it("recovers sessions from the store", async () => {
      // Manually write launcher data to disk to simulate a previous run
      const savedSessions = [
        {
          sessionId: "restored-1",
          pid: 99999,
          state: "connected" as const,
          cwd: "/tmp/project",
          createdAt: Date.now(),
          cliSessionId: "cli-abc",
        },
      ];
      await store.saveLauncher(savedSessions);

      // Mock process.kill(pid, 0) to succeed (process is alive)
      const origKill = process.kill;
      const killSpy = vi.spyOn(process, "kill").mockImplementation(((
        pid: number,
        signal?: string | number,
      ) => {
        if (signal === 0) return true;
        return origKill.call(process, pid, signal as any);
      }) as any);

      const newLauncher = new CliLauncher(3456);
      newLauncher.setStore(store);
      const recovered = await newLauncher.restoreFromDisk();

      expect(recovered).toBe(1);

      const session = newLauncher.getSession("restored-1");
      expect(session).toBeDefined();
      // Live PIDs get state reset to "starting" awaiting WS reconnect
      expect(session?.state).toBe("starting");
      expect(session?.cliSessionId).toBe("cli-abc");

      killSpy.mockRestore();
    });

    it("marks dead PIDs as exited", async () => {
      const savedSessions = [
        {
          sessionId: "dead-1",
          pid: 11111,
          state: "connected" as const,
          cwd: "/tmp/project",
          createdAt: Date.now(),
        },
      ];
      await store.saveLauncher(savedSessions);

      // Mock process.kill(pid, 0) to throw (process is dead)
      const killSpy = vi.spyOn(process, "kill").mockImplementation(((
        _pid: number,
        signal?: string | number,
      ) => {
        if (signal === 0) throw new Error("ESRCH");
        return true;
      }) as any);

      const newLauncher = new CliLauncher(3456);
      newLauncher.setStore(store);
      const recovered = await newLauncher.restoreFromDisk();

      // Dead sessions don't count as recovered
      expect(recovered).toBe(0);

      const session = newLauncher.getSession("dead-1");
      expect(session).toBeDefined();
      expect(session?.state).toBe("exited");
      expect(session?.exitCode).toBe(-1);

      killSpy.mockRestore();
    });

    it("returns 0 when no store is set", async () => {
      const newLauncher = new CliLauncher(3456);
      // No setStore call
      expect(await newLauncher.restoreFromDisk()).toBe(0);
    });

    it("returns 0 when store has no launcher data", async () => {
      const newLauncher = new CliLauncher(3456);
      newLauncher.setStore(store);
      // Store is empty, no launcher.json file
      expect(await newLauncher.restoreFromDisk()).toBe(0);
    });

    it("preserves already-exited sessions from disk", async () => {
      const savedSessions = [
        {
          sessionId: "already-exited",
          pid: 22222,
          state: "exited" as const,
          exitCode: 0,
          cwd: "/tmp/project",
          createdAt: Date.now(),
        },
      ];
      await store.saveLauncher(savedSessions);

      const newLauncher = new CliLauncher(3456);
      newLauncher.setStore(store);
      const recovered = await newLauncher.restoreFromDisk();

      // Already-exited sessions are loaded but not "recovered"
      expect(recovered).toBe(0);
      const session = newLauncher.getSession("already-exited");
      expect(session).toBeDefined();
      expect(session?.state).toBe("exited");
    });
  });
});

// ─── getStartingSessions ─────────────────────────────────────────────────────

describe("getStartingSessions", () => {
  it("returns only sessions in starting state", () => {
    launcher.launch({ cwd: "/tmp" });

    const starting = launcher.getStartingSessions();
    expect(starting).toHaveLength(1);
    expect(starting[0].state).toBe("starting");
  });

  it("excludes sessions that have been connected", () => {
    launcher.launch({ cwd: "/tmp" });
    launcher.markConnected("test-session-id");

    const starting = launcher.getStartingSessions();
    expect(starting).toHaveLength(0);
  });

  it("returns empty array when no sessions exist", () => {
    expect(launcher.getStartingSessions()).toEqual([]);
  });
});
