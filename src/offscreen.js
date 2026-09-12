// offscreen.js
// Runs inside the Offscreen Document. This is the ONLY place in the
// extension allowed to touch the webcam or the ML model — content scripts
// don't get a reliable getUserMedia prompt, and the default MV3 CSP blocks
// loading MediaPipe's WASM/model assets from a CDN. Everything here is
// bundled locally (see README.md at the project root) and shipped as
// offscreen.bundle.js.

import {
  FaceLandmarker,
  FilesetResolver,
  GestureRecognizer,
} from "@mediapipe/tasks-vision";

// --- Tunables -----------------------------------------------------------
const EAR_CLOSED_THRESHOLD = 0.21; // below this, an eye counts as "closed"
const CONSECUTIVE_FRAMES_TO_CONFIRM = 3; // debounce against single-frame noise
const DETECTION_INTERVAL_MS = 66; // ~15 fps is plenty for blink detection

// Classic 6-point EAR landmark sets from the MediaPipe 468-point face mesh.
// Order per eye is [p1, p2, p3, p4, p5, p6] as used in the standard
// Soukupová & Čech eye-aspect-ratio formula.
const LEFT_EYE_IDX = [362, 385, 387, 263, 373, 380]; // subject's right eye
const RIGHT_EYE_IDX = [33, 160, 158, 133, 153, 144]; // subject's left eye

let faceLandmarker = null;
let gestureRecognizer = null;
let lastLoggedGestureCategory = null;
let video = null;
let running = false;
let lastVideoTime = -1;

// Debounce state: current believed state + how many consecutive frames
// agree with a *different* candidate state before we flip.
let eyesCurrentlyClosed = false;
let candidateState = null;
let candidateStreak = 0;

async function init() {
  video = document.getElementById("webcam");
  let filesetResolver;

  // AFTER
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 320, height: 240 },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();
  } catch (err) {
    console.warn("Camera access denied or blocked, requesting setup page.");
    chrome.runtime.sendMessage({ type: "CAMERA_DENIED" });
    return;
  }

  try {
    // Paths are relative to the extension root at runtime; the bundler
    // copies the wasm files into ./wasm/ next to offscreen.bundle.js.
    // See README.md for the exact build step that does this.
    filesetResolver = await FilesetResolver.forVisionTasks("./wasm");

    faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
      baseOptions: {
        modelAssetPath: "./models/face_landmarker.task",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numFaces: 1,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false,
    });
  } catch (err) {
    reportError("MediaPipe FaceLandmarker failed to load: " + err.message);
    return;
  }

  try {
    gestureRecognizer = await GestureRecognizer.createFromOptions(
      filesetResolver,
      {
        baseOptions: {
          modelAssetPath: "./models/gesture_recognizer.task",
          delegate: "CPU",
        },
        runningMode: "VIDEO",
        numHands: 1,
      }
    );
    console.log("[Blink to Scroll] Gesture recognizer loaded");
  } catch (err) {
    console.warn(
      "[Blink to Scroll] Thumb gesture recognition unavailable:",
      err.message
    );
  }

  running = true;
  detectLoop();
}

function detectLoop() {
  if (!running) return;

  if (video.currentTime !== lastVideoTime && faceLandmarker) {
    lastVideoTime = video.currentTime;

    try {
      const result = faceLandmarker.detectForVideo(video, performance.now());
      processResult(result);

      if (gestureRecognizer) {
        const gestureResult = gestureRecognizer.recognizeForVideo(
          video,
          performance.now()
        );
        processGestureResult(gestureResult);
      }
    } catch (err) {
      reportError("Frame detection failed: " + err.message);
    }
  }

  setTimeout(detectLoop, DETECTION_INTERVAL_MS);
}

let handPresent = false;
let handCandidate = null;
let handStreak = 0;
const HAND_FRAMES_TO_CONFIRM = 3;

function processGestureResult(result) {
  const isHandPresent = result.landmarks?.length > 0;

  if (isHandPresent === handCandidate) {
    handStreak += 1;
  } else {
    handCandidate = isHandPresent;
    handStreak = 1;
  }

  if (handStreak >= HAND_FRAMES_TO_CONFIRM && isHandPresent !== handPresent) {
    handPresent = isHandPresent;
    chrome.runtime.sendMessage({
      type: handPresent ? "HAND_PRESENT" : "HAND_ABSENT",
    });
  }
}

function processResult(result) {
  if (!result.faceLandmarks || result.faceLandmarks.length === 0) {
    // No face in frame — don't guess, just don't emit anything new.
    return;
  }

  const landmarks = result.faceLandmarks[0];
  const leftEAR = calculateEAR(landmarks, LEFT_EYE_IDX);
  const rightEAR = calculateEAR(landmarks, RIGHT_EYE_IDX);

  // "Both eyes closed" per the spec — a single open eye must count as open.
  const bothClosedThisFrame =
    leftEAR < EAR_CLOSED_THRESHOLD && rightEAR < EAR_CLOSED_THRESHOLD;

  debounceAndEmit(bothClosedThisFrame);
}

function calculateEAR(landmarks, idx) {
  const [p1, p2, p3, p4, p5, p6] = idx.map((i) => landmarks[i]);

  const vertical1 = dist(p2, p6);
  const vertical2 = dist(p3, p5);
  const horizontal = dist(p1, p4);

  if (horizontal === 0) return 1; // guard divide-by-zero, treat as open

  return (vertical1 + vertical2) / (2 * horizontal);
}

function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = (a.z || 0) - (b.z || 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function debounceAndEmit(bothClosedThisFrame) {
  if (bothClosedThisFrame === eyesCurrentlyClosed) {
    // Consistent with current state — reset any pending flip.
    candidateState = null;
    candidateStreak = 0;
    return;
  }

  if (candidateState === bothClosedThisFrame) {
    candidateStreak += 1;
  } else {
    candidateState = bothClosedThisFrame;
    candidateStreak = 1;
  }

  if (candidateStreak >= CONSECUTIVE_FRAMES_TO_CONFIRM) {
    eyesCurrentlyClosed = bothClosedThisFrame;
    candidateState = null;
    candidateStreak = 0;

    chrome.runtime.sendMessage({
      type: eyesCurrentlyClosed ? "EYES_CLOSED" : "EYES_OPENED",
    });
  }
}

function reportError(message) {
  console.error("[Blink to Scroll / offscreen]", message);
  chrome.runtime.sendMessage({ type: "OFFSCREEN_ERROR", error: message });
}

init();
