import { defineConfig } from "@playwright/test";

const PORT = Number(process.env.PORT) || 3457;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  retries: 0,
  use: {
    headless: true,
    baseURL: "http://localhost:5174",
    viewport: { width: 1280, height: 720 },
    permissions: ["microphone"],
  },
  webServer: {
    command: "bun dev.ts",
    env: { PORT: String(PORT) },
    url: "http://localhost:5174",
    reuseExistingServer: true,
    timeout: 30_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
