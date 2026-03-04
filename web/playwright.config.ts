import { defineConfig } from "@playwright/test";

// Test runs always use port 3458 — separate from dev ports (3456/3457)
// so tests never conflict with a running dev server.
const TEST_PORT = 3458;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  retries: 0,
  globalTeardown: "./tests/global-teardown",
  use: {
    headless: true,
    baseURL: "http://localhost:5174",
    viewport: { width: 1280, height: 720 },
    permissions: ["microphone"],
  },
  webServer: {
    command: "bun dev.ts",
    env: { PORT: String(TEST_PORT) },
    url: "http://localhost:5174",
    reuseExistingServer: true,
    timeout: 30_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
