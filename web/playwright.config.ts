import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  retries: 0,
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
    permissions: ["microphone"],
  },
  projects: [
    {
      name: "original",
      use: {
        baseURL: "http://localhost:5174",
      },
    },
    {
      name: "component",
      use: {
        baseURL: "http://localhost:5175",
      },
    },
  ],
});
