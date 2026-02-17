import { resolve } from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const isComponent = process.env.VITE_STT_BACKEND === "component";

const vitePort = isComponent ? 5175 : 5174;
const backendPort = isComponent ? 3457 : 3456;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: isComponent
    ? {
        alias: [
          {
            find: /^.*\/use-voice-input\.js$/,
            replacement: resolve(
              __dirname,
              "src/hooks/use-voice-input-component.ts",
            ),
          },
        ],
      }
    : undefined,
  server: {
    host: "0.0.0.0",
    port: vitePort,
    proxy: {
      "/api": `http://localhost:${backendPort}`,
      "/ws": {
        target: `ws://localhost:${backendPort}`,
        ws: true,
      },
    },
  },
});
