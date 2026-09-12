# Blink to Scroll (Inverted) 🎯

## Basic Details

### Team Name: Orion

### Team Members

- Team Lead: Pratyush - Cochin University College of Engineering Kuttanad
- Member 2: Rishik Kumar - Cochin University College of Engineering Kuttanad

### Project Description
Blink to Scroll is a Chrome/Chromium extension that uses a webcam and MediaPipe
face tracking to control webpage scrolling with eye gestures. Closing both
eyes scrolls down, while opening the eyes triggers a reset animation.

### The Problem (that doesn't exist)
People are forced to use their hands to scroll through webpages, even when
those hands are perfectly available for more important things.

### The Solution (that nobody asked for)
Blink to Scroll turns looking away from normal interaction into a control
system. Close both eyes to scroll, open them to face consequences, and raise a
hand to trigger the anti-cheating response.

## Technical Details

### Technologies/Components Used
For Software:

- JavaScript
- Chrome Extension Manifest V3
- Vite
- MediaPipe Tasks Vision
- Chrome Offscreen Documents API
- Chrome Storage and Alarms APIs
- Web APIs: `getUserMedia`, DOM, timers, and scrolling
- Chrome or another Chromium-based browser
- Node.js and npm

For Hardware:

- Webcam
- Computer capable of running a Chromium-based browser

### Implementation
For Software:

- `src/offscreen.js` captures webcam frames and detects faces, eye states, and hands.
- `src/background.js` manages the service worker, offscreen document, tab state, and message routing.
- `src/content.js` controls scrolling, progress display, and feedback overlays in the active page.
- `src/content.css` styles the progress bar, overlays, emoji animations, and hand animation.
- `scripts/copy-static.js` assembles the generated `dist/` folder with the manifest, static files, models, and MediaPipe WebAssembly runtime.

# Installation
[]installation)
Run these commands from the repository folder containing `package.json`.

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

### Windows PowerShell 5.1 or 7

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

Node.js 18 or newer is recommended. If Node.js is older than 18, install a
current LTS version from <https://nodejs.org/> or use a version manager.

# Run
1. Open `chrome://extensions` in Chrome or another Chromium browser.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the generated `dist/` folder.
5. Open a normal `http` or `https` website and click the extension icon.
6. Allow camera access when prompted.
7. Close both eyes to scroll. Open the eyes to stop and show the normal penalty animation.

After source changes, run `npm run build`, click **Reload** on the extension card,
and refresh the test page.

### Project Documentation
For Software:

- [Source code](src/)
- [Manifest](public/manifest.json)
- [Build script](scripts/copy-static.js)
- [Generated extension](dist/)
- [Additional documentation or report link]

# Screenshots (Add at least 3)
![Screenshot1](Add screenshot 1 here with proper name) *Add caption explaining what this shows*

![Screenshot2](Add screenshot 2 here with proper name) *Add caption explaining what this shows*

![Screenshot3](Add screenshot 3 here with proper name) *Add caption explaining what this shows*

# Diagrams
![Workflow](Add your workflow/architecture diagram here) *Add caption explaining your workflow*


# Build Photos
![Components](Add photo of your components here) *List out all components shown*

![Build](Add photos of build process here) *Explain the build steps*

![Final](Add photo of final product here) *Explain the final build*

### Project Demo

# Video
[Add your demo video link here] *Explain what the video demonstrates*

# Additional Demos
[Add any extra demo materials/links]

## Team Contributions

- [Name 1]: [Specific contributions]
- [Name 2]: [Specific contributions]
- [Name 3]: [Specific contributions]
