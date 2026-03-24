import type { Hono } from "hono";
import * as envManager from "../env-manager.js";
import type { CompanionEnv } from "../env-manager.js";

// ─── Secret masking ──────────────────────────────────────────────────────────

/**
 * Mask a secret value: show first 3 chars + "***" for values longer than 4 chars.
 * Short values (≤ 4 chars) are returned as-is.
 */
export function maskSecretValue(value: string): string {
  if (value.length <= 4) return value;
  return `${value.slice(0, 3)}***`;
}

function maskEnvVariables(env: CompanionEnv): CompanionEnv {
  const masked: Record<string, string> = {};
  for (const [key, val] of Object.entries(env.variables)) {
    masked[key] = maskSecretValue(val);
  }
  return { ...env, variables: masked };
}

// ─── Routes ──────────────────────────────────────────────────────────────────

export function registerEnvironmentRoutes(api: Hono): void {
  api.get("/envs", async (c) => {
    try {
      const envs = await envManager.listEnvs();
      return c.json(envs.map(maskEnvVariables));
    } catch (e: unknown) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  });

  api.get("/envs/:slug", async (c) => {
    const env = await envManager.getEnv(c.req.param("slug"));
    if (!env) return c.json({ error: "Environment not found" }, 404);
    return c.json(maskEnvVariables(env));
  });

  // Reveal endpoint — returns unmasked values. Auth is already enforced globally.
  api.get("/envs/:slug/reveal", async (c) => {
    const env = await envManager.getEnv(c.req.param("slug"));
    if (!env) return c.json({ error: "Environment not found" }, 404);
    return c.json(env);
  });

  api.post("/envs", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    try {
      const env = await envManager.createEnv(body.name, body.variables || {});
      return c.json(env, 201);
    } catch (e: unknown) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 400);
    }
  });

  api.put("/envs/:slug", async (c) => {
    const slug = c.req.param("slug");
    const body = await c.req.json().catch(() => ({}));
    try {
      const env = await envManager.updateEnv(slug, { name: body.name, variables: body.variables });
      if (!env) return c.json({ error: "Environment not found" }, 404);
      return c.json(env);
    } catch (e: unknown) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 400);
    }
  });

  api.delete("/envs/:slug", async (c) => {
    const deleted = await envManager.deleteEnv(c.req.param("slug"));
    if (!deleted) return c.json({ error: "Environment not found" }, 404);
    return c.json({ ok: true });
  });
}
