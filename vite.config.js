import { defineConfig } from "vite";

// Served from GitHub Pages at https://<user>.github.io/format_transceiver/
export default defineConfig({
  base: "./",
  build: {
    target: "esnext",
    sourcemap: false
  },
  worker: {
    format: "es"
  },
  optimizeDeps: {
    exclude: ["@ffmpeg/ffmpeg", "@ffmpeg/util"]
  }
});
