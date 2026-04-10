import { mkdirSync } from "node:fs";
import { readdir, readFile, writeFile, unlink, access } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CompanionEnv {
  name: string;
  slug: string;
  variables: Record<string, string>;
  createdAt: number;
  updatedAt: number;
}

// ─── Paths ──────────────────────────────────────────────────────────────────

const COMPANION_DIR = join(homedir(), ".companion");
const ENVS_DIR = join(COMPANION_DIR, "envs");

function ensureDir(): void {
  mkdirSync(ENVS_DIR, { recursive: true });
}

function filePath(slug: string): string {
  return join(ENVS_DIR, `${slug}.json`);
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// ─── CRUD ───────────────────────────────────────────────────────────────────

export async function listEnvs(): Promise<CompanionEnv[]> {
  ensureDir();
  try {
    const files = (await readdir(ENVS_DIR)).filter((f) => f.endsWith(".json"));
    const envs: CompanionEnv[] = [];
    await Promise.all(
      files.map(async (file) => {
        try {
          const raw = await readFile(join(ENVS_DIR, file), "utf-8");
          envs.push(JSON.parse(raw));
        } catch (err) {
          console.warn(`[env-manager] Skipping corrupt env file ${file}:`, err);
        }
      }),
    );
    envs.sort((a, b) => a.name.localeCompare(b.name));
    return envs;
  } catch {
    // expected: ENVS_DIR may not exist on first boot
    return [];
  }
}

export async function getEnv(slug: string): Promise<CompanionEnv | null> {
  ensureDir();
  try {
    const raw = await readFile(filePath(slug), "utf-8");
    return JSON.parse(raw) as CompanionEnv;
  } catch {
    // expected: env file may not exist
    return null;
  }
}

export async function createEnv(
  name: string,
  variables: Record<string, string> = {},
): Promise<CompanionEnv> {
  if (!name || !name.trim()) throw new Error("Environment name is required");
  const slug = slugify(name.trim());
  if (!slug) throw new Error("Environment name must contain alphanumeric characters");

  ensureDir();
  if (await fileExists(filePath(slug))) {
    throw new Error(`An environment with a similar name already exists ("${slug}")`);
  }

  const now = Date.now();
  const env: CompanionEnv = {
    name: name.trim(),
    slug,
    variables,
    createdAt: now,
    updatedAt: now,
  };
  await writeFile(filePath(slug), JSON.stringify(env, null, 2), "utf-8");
  return env;
}

export async function updateEnv(
  slug: string,
  updates: { name?: string; variables?: Record<string, string> },
): Promise<CompanionEnv | null> {
  ensureDir();
  const existing = await getEnv(slug);
  if (!existing) return null;

  const newName = updates.name?.trim() || existing.name;
  const newSlug = slugify(newName);
  if (!newSlug) throw new Error("Environment name must contain alphanumeric characters");

  // If name changed, check for slug collision with a different env
  if (newSlug !== slug && await fileExists(filePath(newSlug))) {
    throw new Error(`An environment with a similar name already exists ("${newSlug}")`);
  }

  const env: CompanionEnv = {
    name: newName,
    slug: newSlug,
    variables: updates.variables ?? existing.variables,
    createdAt: existing.createdAt,
    updatedAt: Date.now(),
  };

  // If slug changed, delete old file
  if (newSlug !== slug) {
    try { await unlink(filePath(slug)); } catch {
      // expected: old file may already be gone
    }
  }

  await writeFile(filePath(newSlug), JSON.stringify(env, null, 2), "utf-8");
  return env;
}

export async function deleteEnv(slug: string): Promise<boolean> {
  ensureDir();
  if (!await fileExists(filePath(slug))) return false;
  try {
    await unlink(filePath(slug));
    return true;
  } catch (err) {
    console.warn(`[env-manager] unlink failed for ${slug}:`, err);
    return false;
  }
}
