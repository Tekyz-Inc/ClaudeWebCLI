import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import pkg from "./package.json" with { type: "json" };

const apiPort = Number(process.env.PORT) || 3456;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __API_PORT__: JSON.stringify(apiPort),
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  optimizeDeps: {
    // Pre-bundle at server start so the Web Worker (stt-component-worker.ts)
    // doesn't trigger a Vite dep-discovery full-page reload on first mic click.
    include: ["@huggingface/transformers"],
  },
  server: {
    host: "0.0.0.0",
    port: 5174,
    watch: {
      ignored: ["**/.gsd-t/**"],
    },
    proxy: {
      "/api": {
        target: `http://localhost:${apiPort}`,
        changeOrigin: false,
      },
      "/ws": {
        target: `ws://localhost:${apiPort}`,
        ws: true,
        changeOrigin: false,
      },
    },
  },
});
