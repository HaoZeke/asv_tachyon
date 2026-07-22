import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    // proxy sample fixture during dev
    proxy: {
      "/index.json": "http://127.0.0.1:8765",
      "/graphs": "http://127.0.0.1:8765",
      "/info.json": "http://127.0.0.1:8765",
      "/regressions.json": "http://127.0.0.1:8765",
      "/commits.json": "http://127.0.0.1:8765",
      "/profiles.json": "http://127.0.0.1:8765",
      "/profiles": "http://127.0.0.1:8765",
      "/samples": "http://127.0.0.1:8765",
    },
  },
});
