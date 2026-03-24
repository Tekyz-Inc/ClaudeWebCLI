import type { MiddlewareHandler } from "hono";

// ─── Types ───────────────────────────────────────────────────────────────────

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Creates a simple in-memory rate limiter middleware.
 * Keys by IP address. Resets on server restart.
 */
export function createRateLimiter(
  maxRequests: number,
  windowMs: number,
): MiddlewareHandler {
  const store = new Map<string, RateLimitEntry>();

  // Auto-clean expired entries every minute
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (entry.resetAt <= now) {
        store.delete(key);
      }
    }
  }, 60_000);

  // Allow GC to collect this timer when the process exits
  if (cleanupInterval.unref) cleanupInterval.unref();

  return async (c, next) => {
    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "localhost";
    const now = Date.now();

    const entry = store.get(ip);
    if (!entry || entry.resetAt <= now) {
      store.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count++;
    if (entry.count > maxRequests) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      return c.json(
        { error: "Too Many Requests" },
        429,
        { "Retry-After": String(retryAfter) },
      );
    }

    return next();
  };
}
