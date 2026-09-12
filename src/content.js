// content.js
// Injected into the active page by background.js. Never touches the
// webcam directly — it only reacts to EYES_CLOSED / EYES_OPENED messages
// forwarded from the offscreen document via the service worker.

(() => {
  // Guard against double-injection if the icon is clicked twice on the
  // same tab.
  if (window.__blinkToScrollInjected) return;
  window.__blinkToScrollInjected = true;

  console.log("[Blink to Scroll] Content script armed on", location.href);

  const SCROLL_STEP_PX = 10;
  const SCROLL_INTERVAL_MS = 16; // ~60fps smooth scroll while eyes are closed
  const TELEPORT_DELAY_MS = 1000; // matches the 1s head-shake animation
  const HAND_RESET_DELAY_MS = 1000;

  let isScrolling = false;
  let scrollTimerId = null;
  let overlayEl = null;
  let progressEl = null;
  let progressFillEl = null;
  let progressPointerEl = null;
  let handEl = null;
  let teleportTimeoutId = null;
  let resetTimeoutId = null;
  let extensionEnabled = true;

  createProgressBar();

  chrome.runtime.onMessage.addListener((message) => {
    if (!message || !message.type) return;

    console.log("[Blink to Scroll] Received", message.type);

    if (message.type === "EYES_CLOSED") {
      handleEyesClosed();
    } else if (message.type === "EYES_OPENED") {
      handleEyesOpened();
    } else if (message.type === "TAB_STATE") {
      setExtensionEnabled(message.enabled);
    }
  });

  function setExtensionEnabled(enabled) {
    extensionEnabled = enabled;
    progressEl.classList.toggle("blink-to-scroll-disabled", !enabled);

    if (!enabled) {
      stopScrolling();
    }
  }

  function handleEyesClosed() {
    if (!extensionEnabled) return;
    if (isScrolling) return; // already scrolling, nothing to do

    // If a "shame" overlay/teleport sequence was mid-flight, cancel it —
    // the user closed their eyes again before it finished.
    cancelPendingTeleport();
    hideOverlay();

    isScrolling = true;
    scrollTimerId = window.setInterval(() => {
      window.scrollBy(0, SCROLL_STEP_PX);
      updateProgress();
    }, SCROLL_INTERVAL_MS);
    updateProgress();
  }

  function handleEyesOpened() {
    if (!extensionEnabled) return;
    const wasScrolling = isScrolling;

    // Immediately stop scrolling regardless of prior state.
    stopScrolling();

    if (!wasScrolling) return; // eyes were already open — nothing to punish

    showDisappointedOverlay();

    teleportTimeoutId = window.setTimeout(() => {
      moveHandToPointer();
      handEl.classList.add("blink-to-scroll-hand-grab");

      resetTimeoutId = window.setTimeout(() => {
        window.scrollTo({ top: 0, behavior: "auto" }); // instant teleport
        updateProgress();
        hideOverlay();
        teleportTimeoutId = null;
        resetTimeoutId = null;
      }, HAND_RESET_DELAY_MS);
    }, TELEPORT_DELAY_MS);
  }

  function createProgressBar() {
    progressEl = document.createElement("div");
    progressEl.className = "blink-to-scroll-progress";

    const track = document.createElement("div");
    track.className = "blink-to-scroll-progress-track";

    progressFillEl = document.createElement("div");
    progressFillEl.className = "blink-to-scroll-progress-fill";

    progressPointerEl = document.createElement("div");
    progressPointerEl.className = "blink-to-scroll-progress-pointer";

    track.appendChild(progressFillEl);
    track.appendChild(progressPointerEl);
    progressEl.appendChild(track);
    document.documentElement.appendChild(progressEl);
    updateProgress();
  }

  function stopScrolling() {
    if (scrollTimerId !== null) {
      clearInterval(scrollTimerId);
      scrollTimerId = null;
    }
    isScrolling = false;
  }

  function updateProgress() {
    if (!progressEl) return;

    const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = scrollableHeight > 0 ? window.scrollY / scrollableHeight : 0;
    const percentage = Math.max(0, Math.min(1, progress)) * 100;

    progressFillEl.style.width = `${percentage}%`;
    progressPointerEl.style.left = `${percentage}%`;
  }

  window.addEventListener("scroll", updateProgress, { passive: true });

  function createHand() {
    handEl = document.createElement("div");
    handEl.className = "blink-to-scroll-hand";
    handEl.textContent = "🤚";
    overlayEl.appendChild(handEl);
  }

  function moveHandToPointer() {
    const pointerRect = progressPointerEl.getBoundingClientRect();
    handEl.style.setProperty("--hand-target-x", `${pointerRect.left + 9}px`);
    handEl.style.setProperty("--hand-target-y", `${pointerRect.top + 6}px`);
  }

  function showDisappointedOverlay() {
    if (overlayEl) return; // already showing

    overlayEl = document.createElement("div");
    overlayEl.className = "blink-to-scroll-overlay";

    const emoji = document.createElement("div");
    emoji.className = "blink-to-scroll-emoji";
    emoji.textContent = "😞";

    const caption = document.createElement("div");
    caption.className = "blink-to-scroll-caption";
    caption.textContent = "I saw that.";

    overlayEl.appendChild(emoji);
    overlayEl.appendChild(caption);
    document.documentElement.appendChild(overlayEl);
    createHand();
  }

  function hideOverlay() {
    if (overlayEl && overlayEl.parentNode) {
      overlayEl.parentNode.removeChild(overlayEl);
    }
    overlayEl = null;
    handEl = null;
  }

  function cancelPendingTeleport() {
    if (teleportTimeoutId !== null) {
      clearTimeout(teleportTimeoutId);
      teleportTimeoutId = null;
    }
    if (resetTimeoutId !== null) {
      clearTimeout(resetTimeoutId);
      resetTimeoutId = null;
    }
  }
})();
