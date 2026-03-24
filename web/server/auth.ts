import { randomBytes } from "node:crypto";
import type { MiddlewareHandler } from "hono";

export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

// Singleton token — generated once on import
export const AUTH_TOKEN = generateToken();

export function createAuthMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    // Skip OPTIONS (CORS preflight)
    if (c.req.method === "OPTIONS") {
      return next();
    }

    // Check Authorization header
    const authHeader = c.req.header("Authorization");
    if (authHeader) {
      const parts = authHeader.split(" ");
      if (parts.length === 2 && parts[0] === "Bearer" && parts[1] === AUTH_TOKEN) {
        return next();
      }
    }

    // Check ?token= query param
    const tokenParam = new URL(c.req.url).searchParams.get("token");
    if (tokenParam === AUTH_TOKEN) {
      return next();
    }

    return c.json({ error: "Unauthorized" }, 401);
  };
}

export function validateWsToken(url: string, token: string): boolean {
  try {
    const params = new URL(url).searchParams;
    return params.get("token") === token;
  } catch {
    return false;
  }
}
