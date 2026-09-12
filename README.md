# Blink to Scroll (Inverted)

Close both eyes to scroll down. Open either eye to stop, show a disappointed
This repository builds a Chrome/Chromium Manifest V3 extension. It is not a
a published store package: you build it locally and load the generated `dist`
folder as an unpacked extension.

## Requirements

- Google Chrome or another Chromium browser with Manifest V3 support
- Node.js 18 or newer (Node.js 20 LTS is recommended)
- npm 9 or newer, included with Node.js
- A webcam and permission to use it

The extension uses Chrome-specific APIs such as `chrome.offscreen`, so Firefox
and Safari are not supported by this project as currently written.

## Install and build

Run these steps from the repository folder, the folder containing
`package.json`.

### macOS, Linux, Git Bash, or WSL

```bash
npm install
mkdir -p public/models
curl -L --fail -o public/models/face_landmarker.task \
  https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
curl -L --fail -o public/models/gesture_recognizer.task \
  https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task
npm run build
```

### Windows PowerShell 7 or Windows PowerShell 5.1

Use `New-Item` and `Invoke-WebRequest` instead of `mkdir -p` and `curl`.
These commands work in both commonly installed PowerShell versions:

```powershell
npm install
New-Item -ItemType Directory -Force -Path public\models | Out-Null
Invoke-WebRequest -Uri "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task" -OutFile "public\models\face_landmarker.task"
Invoke-WebRequest -Uri "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task" -OutFile "public\models\gesture_recognizer.task"
npm run build
```

### Windows Command Prompt (`cmd.exe`)

```bat
npm install
if not exist public\models mkdir public\models
curl.exe -L --fail -o public\models\face_landmarker.task https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
curl.exe -L --fail -o public\models\gesture_recognizer.task https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task
npm run build
```

The model downloads are required once after cloning. They are copied from
`public/models/` into `dist/models/` during the build. Confirm that both files
exist before loading the extension.

## Older Node.js or npm versions

The current Vite dependency requires a modern Node.js runtime. Check your
versions first:

```text
node --version
npm --version
```

If Node.js is older than 18, install a current LTS release from
<https://nodejs.org/> or use a version manager such as `nvm-windows` on
Windows or `nvm` on macOS/Linux. Then open a new terminal and run the build
steps again.

If npm is older but Node.js is already 18 or newer, `npm install` is usually
enough. `npm ci` is also available when you want the exact dependency versions
recorded in `package-lock.json`:

```bash
npm ci
npm run build
```

If your older shell does not provide `curl`, download the two `.task` files in
a browser and place them manually in `public/models/` with the exact filenames
`face_landmarker.task` and `gesture_recognizer.task`.

## Load the extension

1. Open `chrome://extensions` in Chrome or the equivalent extensions page in
  your Chromium browser.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select the repository's `dist` folder, not the repository root.
5. Pin the extension if desired, open a normal `http` or `https` website, and
  click the extension icon to arm it.
6. Allow camera access when prompted. Close both eyes to scroll.

The build output is self-contained: it includes the manifest, extension
scripts, icons, MediaPipe WebAssembly runtime, and the two model files.

## Rebuild after changes

There is no watch script. After changing a source file, run:

```bash
npm run build
```

Then return to `chrome://extensions` and click the extension's **Reload**
button. Reload the page being tested too. If the extension was already using
the camera, clicking its icon again may be necessary to arm the current tab.

## Troubleshooting

- **The extension does not load:** select `dist`, and make sure `dist/manifest.json`
  exists after the build.
- **The model fails to load:** check that both `.task` files are in
  `public/models/` before running `npm run build`, then verify they are also in
  `dist/models/`.
- **The camera does not start:** allow camera access for the browser, use a
  normal website rather than a browser-internal page, and try reloading the
  extension.
- **`npm run build` reports a missing WASM runtime:** remove `node_modules` and
  `package-lock.json`, run `npm install`, and build again. Do this only if the
  normal install did not complete successfully.

## Project layout

```text
blink-to-scroll/
├── package.json
├── vite.config.js
├── scripts/copy-static.js
├── public/
│   ├── manifest.json
│   ├── icons/
│   └── models/                 # downloaded .task files
├── src/
│   ├── background.js           # service worker and message router
│   ├── offscreen.html          # webcam/MediaPipe document shell
│   ├── offscreen.js            # webcam and face/gesture detection
│   ├── content.js              # page behavior
│   └── content.css             # page overlay and animation
└── dist/                       # generated folder loaded by Chrome
```

## Tuning

- `EAR_CLOSED_THRESHOLD` in `src/offscreen.js` controls how closed an eye
  must be before it counts as closed. Lower it for fewer false triggers; raise
  it if closed eyes are not detected reliably.
- `CONSECUTIVE_FRAMES_TO_CONFIRM` reduces flicker by requiring several
  matching frames before changing state.
- The offscreen document is reused while the extension is running, so the
  camera stream normally does not restart for every tab.
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
