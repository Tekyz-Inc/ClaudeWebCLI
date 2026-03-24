import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import { createRateLimiter } from "./rate-limiter.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildApp(maxRequests: number, windowMs: number, ip = "127.0.0.1") {
  const app = new Hono();
  app.use("/*", createRateLimiter(maxRequests, windowMs));
  app.get("/test", (c) => c.json({ ok: true }));
  return { app, ip };
}

function makeRequest(app: Hono, ip: string) {
  return app.request("/test", {
    method: "GET",
    headers: { "x-forwarded-for": ip },
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("createRateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests under the limit", async () => {
    const { app } = buildApp(5, 60_000);
    for (let i = 0; i < 5; i++) {
      const res = await makeRequest(app, "1.2.3.4");
      expect(res.status).toBe(200);
    }
  });

  it("returns 429 when limit is exceeded", async () => {
    const { app } = buildApp(3, 60_000);
    for (let i = 0; i < 3; i++) {
      await makeRequest(app, "1.2.3.5");
    }
    const res = await makeRequest(app, "1.2.3.5");
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json).toEqual({ error: "Too Many Requests" });
  });

  it("includes Retry-After header on 429", async () => {
    const { app } = buildApp(1, 60_000);
    await makeRequest(app, "1.2.3.6");
    const res = await makeRequest(app, "1.2.3.6");
    expect(res.status).toBe(429);
    const retryAfter = res.headers.get("Retry-After");
    expect(retryAfter).toBeTruthy();
    expect(Number(retryAfter)).toBeGreaterThan(0);
  });

  it("resets the window after windowMs elapses", async () => {
    const { app } = buildApp(2, 5_000);
    await makeRequest(app, "1.2.3.7");
    await makeRequest(app, "1.2.3.7");
    let res = await makeRequest(app, "1.2.3.7");
    expect(res.status).toBe(429);

    // Advance time past the window
    vi.advanceTimersByTime(6_000);

    res = await makeRequest(app, "1.2.3.7");
    expect(res.status).toBe(200);
  });

  it("tracks different IPs independently", async () => {
    const { app } = buildApp(2, 60_000);
    // Exhaust IP A
    await makeRequest(app, "10.0.0.1");
    await makeRequest(app, "10.0.0.1");
    const resA = await makeRequest(app, "10.0.0.1");
    expect(resA.status).toBe(429);

    // IP B is unaffected
    const resB = await makeRequest(app, "10.0.0.2");
    expect(resB.status).toBe(200);
  });

  it("falls back to 'localhost' key when x-forwarded-for is absent", async () => {
    const { app } = buildApp(1, 60_000);
    // First request from unknown IP — succeeds
    const res1 = await app.request("/test", { method: "GET" });
    expect(res1.status).toBe(200);
    // Second request from unknown IP — rate limited
    const res2 = await app.request("/test", { method: "GET" });
    expect(res2.status).toBe(429);
  });
});
