import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("../env-manager.js", () => ({
  listEnvs: vi.fn(async () => []),
  getEnv: vi.fn(async () => null),
  createEnv: vi.fn(async () => null),
  updateEnv: vi.fn(async () => null),
  deleteEnv: vi.fn(async () => false),
}));

import { Hono } from "hono";
import { registerEnvironmentRoutes } from "./environment-routes.js";
import { maskSecretValue } from "./environment-routes.js";
import * as envManager from "../env-manager.js";

function buildApp() {
  const app = new Hono();
  registerEnvironmentRoutes(app);
  return app;
}

// ─── maskSecretValue unit tests ───────────────────────────────────────────────

describe("maskSecretValue", () => {
  it("shows full value when length <= 4", () => {
    expect(maskSecretValue("")).toBe("");
    expect(maskSecretValue("ab")).toBe("ab");
    expect(maskSecretValue("abcd")).toBe("abcd");
  });

  it("masks values longer than 4 chars to first 3 + '***'", () => {
    expect(maskSecretValue("abcde")).toBe("abc***");
    expect(maskSecretValue("supersecret")).toBe("sup***");
    expect(maskSecretValue("sk-ant-12345678")).toBe("sk-***");
  });

  it("handles exactly 5 chars", () => {
    expect(maskSecretValue("hello")).toBe("hel***");
  });
});

// ─── Route integration tests ──────────────────────────────────────────────────

describe("GET /envs", () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = buildApp();
  });

  it("masks variable values in the list response", async () => {
    vi.mocked(envManager.listEnvs).mockResolvedValue([
      {
        name: "Prod",
        slug: "prod",
        variables: { SHORT: "hi", LONG: "supersecret" },
        createdAt: 1,
        updatedAt: 1,
      },
    ]);

    const res = await app.request("/envs");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json[0].variables.SHORT).toBe("hi");       // ≤ 4 chars — visible
    expect(json[0].variables.LONG).toBe("sup***");    // > 4 chars — masked
  });
});

describe("GET /envs/:slug", () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = buildApp();
  });

  it("masks variable values for a single env", async () => {
    vi.mocked(envManager.getEnv).mockResolvedValue({
      name: "Dev",
      slug: "dev",
      variables: { API_KEY: "sk-ant-abcdefgh" },
      createdAt: 1,
      updatedAt: 1,
    });

    const res = await app.request("/envs/dev");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.variables.API_KEY).toBe("sk-***");
  });

  it("returns 404 when env not found", async () => {
    vi.mocked(envManager.getEnv).mockResolvedValue(null);
    const res = await app.request("/envs/missing");
    expect(res.status).toBe(404);
  });
});

describe("GET /envs/:slug/reveal", () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = buildApp();
  });

  it("returns unmasked variable values", async () => {
    vi.mocked(envManager.getEnv).mockResolvedValue({
      name: "Dev",
      slug: "dev",
      variables: { API_KEY: "sk-ant-abcdefgh" },
      createdAt: 1,
      updatedAt: 1,
    });

    const res = await app.request("/envs/dev/reveal");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.variables.API_KEY).toBe("sk-ant-abcdefgh");
  });

  it("returns 404 when env not found", async () => {
    vi.mocked(envManager.getEnv).mockResolvedValue(null);
    const res = await app.request("/envs/missing/reveal");
    expect(res.status).toBe(404);
  });
});
