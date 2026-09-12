import { defineConfig } from "vite";
import { resolve } from "path";

// Only offscreen.js needs bundling — it's the only file that imports an
// npm package (@mediapipe/tasks-vision). background.js and content.js are
// plain, dependency-free scripts and are copied through untouched by
// scripts/copy-static.js, which avoids Rollup's multi-entry/code-splitting
// restrictions for the IIFE format used by extension scripts.
export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, "src/offscreen.js"),
      name: "BlinkToScrollOffscreen",
      formats: ["iife"],
      fileName: () => "offscreen.bundle.js",
    },
    rollupOptions: {
      output: {
        // Keep everything in one file — no chunk splitting, no externals.
        inlineDynamicImports: true,
      },
    },
  },
});
