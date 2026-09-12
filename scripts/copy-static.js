// scripts/copy-static.js
// Runs after `vite build`. Vite only bundles src/offscreen.js (the file
// with an npm dependency). Everything else — manifest, icons, the plain
// background/content scripts, offscreen.html, and MediaPipe's WASM
// runtime — just needs to be copied into dist/ so the folder is a
// complete, loadable extension.

import { cpSync, mkdirSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const dist = join(root, "dist");

function copy(from, to) {
  cpSync(from, to, { recursive: true });
  console.log(`copied ${from} -> ${to}`);
}

// 1. Manifest + icons
copy(join(root, "public/manifest.json"), join(dist, "manifest.json"));
copy(join(root, "public/icons"), join(dist, "icons"));

// 2. Plain scripts that don't need bundling
copy(join(root, "src/offscreen.html"), join(dist, "offscreen.html"));
copy(join(root, "src/background.js"), join(dist, "background.js"));
copy(join(root, "src/content.js"), join(dist, "content.js"));
copy(join(root, "src/content.css"), join(dist, "content.css"));

// 3. MediaPipe's WASM runtime ships inside the npm package itself —
//    this is what makes it MV3-CDN-compliant. We just copy it locally.
const wasmSrc = join(root, "node_modules/@mediapipe/tasks-vision/wasm");
const wasmDest = join(dist, "wasm");
if (existsSync(wasmSrc)) {
  copy(wasmSrc, wasmDest);
} else {
  console.warn(
    "⚠️  Could not find @mediapipe/tasks-vision/wasm — did you run `npm install`?"
  );
}

// 4. The .task model file is NOT bundled in the npm package and must be
//    downloaded once manually (see README.md). We just ensure the folder
//    exists so the build doesn't silently produce a broken extension.
const modelsDir = join(dist, "models");
mkdirSync(modelsDir, { recursive: true });
if (!existsSync(join(modelsDir, "face_landmarker.task"))) {
  console.warn(
    "⚠️  dist/models/face_landmarker.task is missing.\n" +
      "   Download it once from Google's model storage and place it there —\n" +
      "   see README.md 'Download the face landmarker model' step.\n" +
      "   The extension will fail to load the model without this file."
  );
}
