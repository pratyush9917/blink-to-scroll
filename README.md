# Blink to Scroll (Inverted)

Close both eyes → the page scrolls down. Open even one eye → everything
stops, a disappointed emoji shakes its head at you for two seconds, then
you get teleported straight back to the top.

## Why a build step is required

MV3 extensions ship with a strict default Content Security Policy that
blocks loading scripts or WASM from remote CDNs (`unpkg`, `jsdelivr`,
Google's hosted MediaPipe CDN, etc.). `@mediapipe/tasks-vision` normally
loads its runtime from a CDN in browser tutorials — that will **not**
work here. Instead we install it as an npm package and bundle it locally
with Vite so every byte the offscreen document loads ships inside the
extension folder itself.

## Project layout

```
blink-to-scroll/
├── package.json
├── vite.config.js
├── scripts/
│   └── copy-static.js        # copies manifest/icons/plain scripts + wasm into dist/
├── public/
│   ├── manifest.json
│   └── icons/
├── src/
│   ├── background.js          # service worker — router + lifecycle
│   ├── offscreen.html         # shell loaded into the offscreen document
│   ├── offscreen.js           # webcam + MediaPipe EAR logic (bundled)
│   ├── content.js             # injected into the active tab
│   └── content.css            # overlay + shake animation
└── dist/                      # <- build output, THIS is what you load into Chrome
```

## Build steps

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Download the face and gesture models** (one-time, manual step — the
  `.task` model files are not included in the npm package):

   ```bash
   mkdir -p public/models
   curl -L -o public/models/face_landmarker.task \
     https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
   curl -L -o public/models/gesture_recognizer.task \
     https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task
   ```

  Keep the downloaded file in `public/models/`; Vite copies it to
  `dist/models/` on every build.

3. **Build**

   ```bash
   npm run build
   ```

   This runs `vite build` (bundles only `offscreen.js`, since it's the
   sole file with an npm dependency) and then
   `scripts/copy-static.js`, which:
   - copies `manifest.json` and icons into `dist/`
   - copies `background.js`, `content.js`, `content.css`, and
     `offscreen.html` into `dist/` untouched (they're plain scripts —
     no bundling needed)
   - copies MediaPipe's WASM runtime from
     `node_modules/@mediapipe/tasks-vision/wasm` into `dist/wasm`

   After this, `dist/` is a complete, self-contained extension.

4. **Load into Chrome**

   - Go to `chrome://extensions`
   - Enable **Developer mode** (top right)
   - Click **Load unpacked**
   - Select the `dist/` folder

5. **Use it**

   Click the extension icon on any tab. Chrome will prompt for camera
   permission the first time (granted to the offscreen document, not the
   page). Close both eyes to scroll; open one to get shamed and
   teleported back up.

## Rebuilding during development

Re-run `npm run build` after any change to `src/offscreen.js` (or the
other src files), then hit the refresh icon on the extension's card in
`chrome://extensions`.

## Notes / tuning knobs

- `EAR_CLOSED_THRESHOLD` in `offscreen.js` (default `0.21`) controls how
  closed an eye must be to count as "closed." Lower it if it's
  triggering too easily, raise it if it's not sensitive enough.
- `CONSECUTIVE_FRAMES_TO_CONFIRM` debounces flicker between frames so a
  single bad detection doesn't spam scroll start/stop events.
- The offscreen document is created once and reused — closing/reopening
  a tab and re-clicking the icon does **not** re-prompt for camera
  permission or restart the stream.
