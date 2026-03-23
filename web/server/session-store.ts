import { mkdirSync } from "node:fs";
import { readdir, readFile, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { SessionState, BrowserIncomingMessage, PermissionRequest } from "./session-types.js";

// ─── Serializable session shape ─────────────────────────────────────────────

export interface PersistedSession {
  id: string;
  state: SessionState;
  messageHistory: BrowserIncomingMessage[];
  pendingMessages: string[];
  pendingPermissions: [string, PermissionRequest][];
  archived?: boolean;
}

// ─── Store ──────────────────────────────────────────────────────────────────

const DEFAULT_DIR = join(tmpdir(), "vibe-sessions");

export class SessionStore {
  private dir: string;
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(dir?: string) {
    this.dir = dir || DEFAULT_DIR;
    mkdirSync(this.dir, { recursive: true });
  }

  private filePath(sessionId: string): string {
    return join(this.dir, `${sessionId}.json`);
  }

  /** Debounced write — batches rapid changes (e.g. multiple stream events). */
  save(session: PersistedSession): void {
    const existing = this.debounceTimers.get(session.id);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.debounceTimers.delete(session.id);
      this.saveAsync(session).catch((err) => {
        console.error(`[session-store] Failed to save session ${session.id}:`, err);
      });
    }, 150);
    this.debounceTimers.set(session.id, timer);
  }

  /** Async write — use for critical state changes. */
  async saveAsync(session: PersistedSession): Promise<void> {
    try {
      await writeFile(this.filePath(session.id), JSON.stringify(session), "utf-8");
    } catch (err) {
      console.error(`[session-store] Failed to save session ${session.id}:`, err);
    }
  }

  /** Immediate synchronous alias kept for callers that need fire-and-forget. */
  saveSync(session: PersistedSession): void {
    this.saveAsync(session).catch((err) => {
      console.error(`[session-store] Failed to save session ${session.id}:`, err);
    });
  }

  /** Load a single session from disk. */
  async load(sessionId: string): Promise<PersistedSession | null> {
    try {
      const raw = await readFile(this.filePath(sessionId), "utf-8");
      return JSON.parse(raw) as PersistedSession;
    } catch {
      return null;
    }
  }

  /** Load all sessions from disk. */
  async loadAll(): Promise<PersistedSession[]> {
    const sessions: PersistedSession[] = [];
    try {
      const files = (await readdir(this.dir)).filter(
        (f) => f.endsWith(".json") && f !== "launcher.json",
      );
      await Promise.all(
        files.map(async (file) => {
          try {
            const raw = await readFile(join(this.dir, file), "utf-8");
            sessions.push(JSON.parse(raw));
          } catch {
            // Skip corrupt files
          }
        }),
      );
    } catch {
      // Dir doesn't exist yet
    }
    return sessions;
  }

  /** Set the archived flag on a persisted session. */
  async setArchived(sessionId: string, archived: boolean): Promise<boolean> {
    const session = await this.load(sessionId);
    if (!session) return false;
    session.archived = archived;
    await this.saveAsync(session);
    return true;
  }

  /** Remove a session file from disk. */
  remove(sessionId: string): void {
    const timer = this.debounceTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(sessionId);
    }
    unlink(this.filePath(sessionId)).catch(() => {
      // File may not exist
    });
  }

  /** Persist launcher state (separate file). */
  async saveLauncher(data: unknown): Promise<void> {
    try {
      await writeFile(join(this.dir, "launcher.json"), JSON.stringify(data), "utf-8");
    } catch (err) {
      console.error("[session-store] Failed to save launcher state:", err);
    }
  }

  /** Load launcher state. */
  async loadLauncher<T>(): Promise<T | null> {
    try {
      const raw = await readFile(join(this.dir, "launcher.json"), "utf-8");
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  get directory(): string {
    return this.dir;
  }
}
