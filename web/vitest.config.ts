import { defineConfig } from "vitest/config";
import pkg from "./package.json" with { type: "json" };

export default defineConfig({
  define: {
    __API_PORT__: JSON.stringify(3456),
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    globals: true,
    environment: "node",
    include: ["server/**/*.test.ts", "src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["**/node_modules/**", "**/.claude/**", "**/worktrees/**"],
    environmentMatchGlobs: [
      ["src/**/*.test.ts", "jsdom"],
      ["src/**/*.test.tsx", "jsdom"],
    ],
    setupFiles: ["src/test-setup.ts"],
  },
});
