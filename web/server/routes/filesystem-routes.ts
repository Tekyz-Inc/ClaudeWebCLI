import type { Hono, Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readdir, readFile, writeFile, stat } from "node:fs/promises";
import { resolve, join, dirname } from "node:path";
import { homedir } from "node:os";
import { WriteFileBody } from "./schemas.js";
import { validatePath, PathTraversalError } from "../security-utils.js";

const execFileAsync = promisify(execFile);

interface TreeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: TreeNode[];
}

/**
 * Unified error response helper for filesystem routes.
 * Returns `{ error, details? }` with a status code derived from the error type.
 */
function handleRouteError(
  c: Context,
  err: unknown,
  fallbackMessage: string,
  fallbackStatus: ContentfulStatusCode = 500,
) {
  if (err instanceof PathTraversalError) {
    return c.json({ error: "Access denied", details: err.message }, 403);
  }
  const details = err instanceof Error ? err.message : String(err);
  return c.json({ error: fallbackMessage, details }, fallbackStatus);
}

async function buildTree(dir: string, depth: number): Promise<TreeNode[]> {
  if (depth > 10) return [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const nodes: TreeNode[] = [];
    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        const children = await buildTree(fullPath, depth + 1);
        nodes.push({ name: entry.name, path: fullPath, type: "directory", children });
      } else if (entry.isFile()) {
        nodes.push({ name: entry.name, path: fullPath, type: "file" });
      }
    }
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return nodes;
  } catch (err) {
    console.warn(`[fs-routes] buildTree failed for ${dir}:`, err);
    return [];
  }
}

export function registerFilesystemRoutes(api: Hono): void {
  api.get("/fs/list", async (c) => {
    const rawPath = c.req.query("path") || homedir();
    let basePath: string;
    try {
      basePath = validatePath(rawPath, process.cwd());
    } catch (e) {
      return handleRouteError(c, e, "Invalid path", 400);
    }
    try {
      const entries = await readdir(basePath, { withFileTypes: true });
      const dirs: { name: string; path: string }[] = [];
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith(".")) {
          dirs.push({ name: entry.name, path: join(basePath, entry.name) });
        }
      }
      dirs.sort((a, b) => a.name.localeCompare(b.name));
      return c.json({ path: basePath, dirs, home: homedir() });
    } catch (e) {
      const details = e instanceof Error ? e.message : String(e);
      return c.json({ error: "Cannot read directory", details, path: basePath, dirs: [], home: homedir() }, 400);
    }
  });

  api.get("/fs/home", (c) => {
    return c.json({ home: homedir(), cwd: process.cwd() });
  });

  api.get("/fs/tree", async (c) => {
    const rawPath = c.req.query("path");
    if (!rawPath) return c.json({ error: "path required" }, 400);
    let basePath: string;
    try {
      basePath = validatePath(rawPath, process.cwd());
    } catch (e) {
      return handleRouteError(c, e, "Invalid path", 400);
    }
    const tree = await buildTree(basePath, 0);
    return c.json({ path: basePath, tree });
  });

  api.get("/fs/read", async (c) => {
    const filePath = c.req.query("path");
    if (!filePath) return c.json({ error: "path required" }, 400);
    let absPath: string;
    try {
      absPath = validatePath(filePath, process.cwd());
    } catch (e) {
      return handleRouteError(c, e, "Invalid path", 400);
    }
    try {
      const info = await stat(absPath);
      if (info.size > 2 * 1024 * 1024) {
        return c.json({ error: "File too large (>2MB)" }, 413);
      }
      const content = await readFile(absPath, "utf-8");
      return c.json({ path: absPath, content });
    } catch (e) {
      return handleRouteError(c, e, "Cannot read file", 404);
    }
  });

  api.put("/fs/write", async (c) => {
    const raw = await c.req.json().catch(() => ({}));
    const parsed = WriteFileBody.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: "path and content required", details: parsed.error.message }, 400);
    }
    let absPath: string;
    try {
      absPath = validatePath(parsed.data.path, process.cwd());
    } catch (e) {
      return handleRouteError(c, e, "Invalid path", 400);
    }
    try {
      await writeFile(absPath, parsed.data.content, "utf-8");
      return c.json({ ok: true, path: absPath });
    } catch (e) {
      return handleRouteError(c, e, "Cannot write file", 500);
    }
  });

  api.get("/fs/diff", async (c) => {
    const filePath = c.req.query("path");
    if (!filePath) return c.json({ error: "path required" }, 400);
    let absPath: string;
    try {
      absPath = validatePath(filePath, process.cwd());
    } catch (e) {
      return handleRouteError(c, e, "Invalid path", 400);
    }
    try {
      const { stdout } = await execFileAsync(
        "git", ["diff", "HEAD", "--", absPath],
        { cwd: dirname(absPath), encoding: "utf-8", timeout: 5000 },
      );
      return c.json({ path: absPath, diff: stdout });
    } catch {
      // expected: git may not be available or file may not be tracked —
      // diff endpoint is best-effort and returns empty diff in that case.
      return c.json({ path: absPath, diff: "" });
    }
  });
}
