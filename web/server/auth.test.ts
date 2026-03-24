import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { generateToken, createAuthMiddleware, validateWsToken, AUTH_TOKEN } from "./auth.js";

// ─── Token generation ─────────────────────────────────────────────────────────

describe("generateToken", () => {
  it("returns a 64-character hex string", () => {
    const token = generateToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("generates unique tokens on each call", () => {
    const t1 = generateToken();
    const t2 = generateToken();
    expect(t1).not.toBe(t2);
  });
});

describe("AUTH_TOKEN singleton", () => {
  it("is a valid 64-character hex string", () => {
    expect(AUTH_TOKEN).toMatch(/^[0-9a-f]{64}$/);
  });
});

// ─── Auth middleware ──────────────────────────────────────────────────────────

function buildApp(token: string) {
  const app = new Hono();
  app.use("/*", createAuthMiddleware());
  app.get("/test", (c) => c.json({ ok: true }));
  return { app, token };
}

describe("createAuthMiddleware", () => {
  it("blocks requests with no token (401)", async () => {
    const { app } = buildApp(AUTH_TOKEN);
    const res = await app.request("/test");
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json).toEqual({ error: "Unauthorized" });
  });

  it("blocks requests with wrong Bearer token (401)", async () => {
    const { app } = buildApp(AUTH_TOKEN);
    const res = await app.request("/test", {
      headers: { Authorization: "Bearer wrongtoken" },
    });
    expect(res.status).toBe(401);
  });

  it("allows requests with correct Bearer token", async () => {
    const { app } = buildApp(AUTH_TOKEN);
    const res = await app.request("/test", {
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ ok: true });
  });

  it("allows requests with correct ?token= query param", async () => {
    const { app } = buildApp(AUTH_TOKEN);
    const res = await app.request(`/test?token=${AUTH_TOKEN}`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ ok: true });
  });

  it("blocks requests with wrong ?token= query param", async () => {
    const { app } = buildApp(AUTH_TOKEN);
    const res = await app.request("/test?token=badtoken");
    expect(res.status).toBe(401);
  });

  it("allows OPTIONS requests without token (CORS preflight)", async () => {
    const app = new Hono();
    app.use("/*", createAuthMiddleware());
    // OPTIONS falls through auth middleware and lands at Hono's 404 (not 401)
    const res = await app.request("/test", { method: "OPTIONS" });
    expect(res.status).not.toBe(401);
  });
});

// ─── validateWsToken ──────────────────────────────────────────────────────────

describe("validateWsToken", () => {
  it("returns true when token matches", () => {
    const token = "abc123";
    expect(validateWsToken("ws://localhost:3456/ws/browser/s1?token=abc123", token)).toBe(true);
  });

  it("returns false when token does not match", () => {
    expect(validateWsToken("ws://localhost:3456/ws/browser/s1?token=wrong", "abc123")).toBe(false);
  });

  it("returns false when token param is missing", () => {
    expect(validateWsToken("ws://localhost:3456/ws/browser/s1", "abc123")).toBe(false);
  });

  it("returns false for invalid URLs", () => {
    expect(validateWsToken("not-a-url", "abc123")).toBe(false);
  });
});
