// background.js — MV3 service worker
// Responsibilities:
//   1. React to the toolbar icon click to "arm" a tab.
//   2. Own the single Offscreen Document (webcam + MediaPipe live here,
//      because content scripts can't reliably use getUserMedia and a normal
//      MV3 CSP will refuse to load ML models inline).
//   3. Inject content.js / content.css into the active tab.
//   4. Route EYES_CLOSED / EYES_OPENED events from the offscreen document
//      to the tab that's currently armed.

const OFFSCREEN_DOCUMENT_PATH = "offscreen.html";
const INACTIVITY_TIMEOUT_MINUTES = 1;
const INACTIVITY_ALARM_PREFIX = "blink-to-scroll-inactivity-";

// Track which tab is currently "armed" (has the content script + is
// listening for blink events). Only one tab is active at a time in this
// simple design — the last tab the user clicked the icon on.
let armedTabId = null;
let activeTabId = null;
let pausedTabId = null;

chrome.runtime.onInstalled.addListener(async () => {
  const state = await chrome.storage.session.get(["armedTabId", "pausedTabId"]);
  armedTabId = state.armedTabId ?? null;
  pausedTabId = state.pausedTabId ?? null;
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name.startsWith(INACTIVITY_ALARM_PREFIX)) return;

  const tabId = Number(alarm.name.slice(INACTIVITY_ALARM_PREFIX.length));
  const state = await chrome.storage.session.get("armedTabId");
  const currentArmedTabId = armedTabId ?? state.armedTabId ?? null;
  if (!Number.isInteger(tabId) || tabId !== currentArmedTabId) return;

  armedTabId = null;
  activeTabId = null;
  pausedTabId = null;
  await chrome.storage.session.remove(["armedTabId", "pausedTabId"]);
  sendTabState(tabId, false);
  console.log(`[Blink to Scroll] Disarmed tab ${tabId} after inactivity`);
});

chrome.runtime.onMessage.addListener(async (message, sender) => {
  if (message?.type === "SET_TAB_ENABLED") {
    const tabId = Number(message.tabId);
    if (!Number.isInteger(tabId)) return;

    pausedTabId = message.enabled ? null : tabId;
    if (message.enabled) {
      await chrome.storage.session.remove("pausedTabId");
    } else {
      await chrome.storage.session.set({ pausedTabId: tabId });
    }
    sendTabState(tabId, message.enabled);
    return;
  }

  if (message?.type === "HAND_PRESENT" || message?.type === "HAND_ABSENT") {
    const state = await chrome.storage.session.get("armedTabId");
    armedTabId ??= state.armedTabId ?? null;
    const enabled = message.type === "HAND_ABSENT";

    pausedTabId = enabled ? null : armedTabId;
    if (enabled) {
      await chrome.storage.session.remove("pausedTabId");
    } else if (armedTabId !== null) {
      await chrome.storage.session.set({ pausedTabId: armedTabId });
    }

    if (armedTabId !== null) {
      resetInactivityAlarm(armedTabId);
      if (!enabled) {
        chrome.tabs
          .sendMessage(armedTabId, { type: "HAND_RAISED" })
          .catch(() => {});
      }
      sendTabState(armedTabId, enabled);
    }
    return;
  }
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;

  await armTab(tab.id, tab.url);
});

async function armTab(tabId, url) {
  if (!Number.isInteger(tabId)) return;

  if (url === undefined) {
    const tab = await chrome.tabs.get(tabId);
    url = tab.url;
  }

  if (!isSupportedPage(url)) {
    console.warn(
      "[Blink to Scroll] Open a normal website before clicking the extension icon."
    );
    return;
  }

  try {
    await injectContentScript(tabId);
    armedTabId = tabId;
    activeTabId = tabId;
    await resetInactivityAlarm(tabId);
    const state = await chrome.storage.session.get("pausedTabId");
    pausedTabId = state.pausedTabId ?? null;
    await chrome.storage.session.set({ armedTabId });
    await ensureOffscreenDocument();
    sendTabState(tabId, pausedTabId !== tabId);
    console.log(`[Blink to Scroll] Armed tab ${tabId}`);
  } catch (err) {
    console.error("[Blink to Scroll] Failed to arm tab:", err);
  }
}

function isSupportedPage(url) {
  return typeof url === "string" && /^(https?|file):\/\//i.test(url);
}

// If the armed tab is closed, forget it so we stop trying to message it.
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.alarms.clear(getInactivityAlarmName(tabId));

  if (tabId === armedTabId) {
    armedTabId = null;
    chrome.storage.session.remove("armedTabId");
  }
});

chrome.tabs.onActivated.addListener(({ tabId, previousTabId }) => {
  activeTabId = tabId;

  if (previousTabId === armedTabId) {
    sendTabState(previousTabId, false);
  }
  if (tabId === armedTabId) {
    sendTabState(tabId, pausedTabId !== tabId);
  }
});

function sendTabState(tabId, enabled) {
  chrome.tabs
    .sendMessage(tabId, { type: "TAB_STATE", enabled })
    .catch(() => {
      // The tab may not have a content script yet or may be protected.
    });
}

function getInactivityAlarmName(tabId) {
  return `${INACTIVITY_ALARM_PREFIX}${tabId}`;
}

async function resetInactivityAlarm(tabId) {
  const alarmName = getInactivityAlarmName(tabId);
  await chrome.alarms.clear(alarmName);
  await chrome.alarms.create(alarmName, {
    delayInMinutes: INACTIVITY_TIMEOUT_MINUTES,
  });
}


async function ensureOffscreenDocument() {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
  });

  if (existingContexts.length > 0) {
    return; // Already running — webcam stream stays alive between arms.
  }

  await chrome.offscreen.createDocument({
    url: OFFSCREEN_DOCUMENT_PATH,
    reasons: ["USER_MEDIA"],
    justification:
      "Reading the webcam feed to detect eye blinks via MediaPipe FaceLandmarker.",
  });
}

async function injectContentScript(tabId) {
  await chrome.scripting.insertCSS({
    target: { tabId },
    files: ["content.css"],
  });

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content.js"],
  });
}

// Message router: offscreen document -> background -> armed content script.
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (!message || !message.type) return;

  if (message.type === "SET_TAB_ENABLED") return;
  
  // 1. Log every message the background script receives
  console.log("Background received:", message.type);

  if (
    message.type === "EYES_CLOSED" ||
    message.type === "EYES_OPENED" ||
    message.type === "EYES_NOT_DETECTED"
  ) {
    const storedState = await chrome.storage.session.get("armedTabId");
    const targetTabId = armedTabId ?? storedState.armedTabId ?? null;
    armedTabId = targetTabId;

    if (targetTabId !== null && targetTabId === activeTabId) {
      if (message.type === "EYES_CLOSED") {
        chrome.alarms.clear(getInactivityAlarmName(targetTabId));
      } else {
        resetInactivityAlarm(targetTabId);
      }
      
      // 2. Log that we are attempting to forward it
      console.log("Forwarding to tab ID:", targetTabId);
      
      chrome.tabs.sendMessage(targetTabId, message).catch((err) => {
        console.warn("[Blink to Scroll] Could not deliver event to tab:", err);
      });
    } else if (targetTabId === null) {
      console.log("Background dropped message: No armed tab");
    }
    return;
  }

  if (message.type === "OFFSCREEN_ERROR") {
    console.error("[Blink to Scroll] Offscreen error:", message.error);
  }
});