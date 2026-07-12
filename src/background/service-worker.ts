import type { PlaybackState } from "../shared/messages.js";

/**
 * MV3 service worker: routes popup requests to the offscreen audio document
 * and manages that document's lifecycle. No page data passes through here —
 * only the generated score (§54: seeds and scores, never raw DOM).
 */

const OFFSCREEN_URL = "offscreen.html";
let creating: Promise<void> | null = null;

async function hasOffscreen(): Promise<boolean> {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT" as chrome.runtime.ContextType],
  });
  return contexts.length > 0;
}

async function ensureOffscreen(): Promise<void> {
  if (await hasOffscreen()) return;
  if (!creating) {
    creating = chrome.offscreen
      .createDocument({
        url: OFFSCREEN_URL,
        reasons: ["AUDIO_PLAYBACK" as chrome.offscreen.Reason],
        justification:
          "Plays generative music synthesized from the structure of the analyzed page.",
      })
      .finally(() => {
        creating = null;
      });
  }
  await creating;
}

async function closeOffscreenIfAny(): Promise<void> {
  if (await hasOffscreen()) {
    try {
      await chrome.offscreen.closeDocument();
    } catch {
      // Already gone.
    }
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || typeof msg.type !== "string") return undefined;

  if (msg.type === "WSE_PLAY") {
    (async () => {
      await ensureOffscreen();
      const res = await chrome.runtime.sendMessage({
        type: "WSE_OFFSCREEN_PLAY",
        target: "wse-offscreen",
        score: msg.score,
        tuning: msg.tuning,
        driveMode: msg.driveMode,
      });
      sendResponse(res ?? { ok: false, code: "AUDIO_BLOCKED" });
    })().catch((err: unknown) => {
      sendResponse({ ok: false, code: "AUDIO_BLOCKED", detail: String(err) });
    });
    return true;
  }

  if (msg.type === "WSE_SCROLL_POSITION") {
    // Fire-and-forget relay from the content script's scroll-tracker to the
    // offscreen engine. Only meaningful while Scroll Mode playback is active;
    // the offscreen document silently ignores it otherwise.
    void chrome.runtime
      .sendMessage({ type: "WSE_OFFSCREEN_SCROLL", target: "wse-offscreen", fraction: msg.fraction })
      .catch(() => {
        // No offscreen document (nothing playing) — nothing to do.
      });
    return undefined;
  }

  if (msg.type === "WSE_STOP") {
    (async () => {
      if (await hasOffscreen()) {
        await chrome.runtime.sendMessage({ type: "WSE_OFFSCREEN_STOP", target: "wse-offscreen" });
      }
      await closeOffscreenIfAny();
      sendResponse({ ok: true });
    })().catch(() => sendResponse({ ok: true }));
    return true;
  }

  if (msg.type === "WSE_GET_STATE") {
    (async () => {
      if (!(await hasOffscreen())) {
        const idle: PlaybackState = { playing: false, position: 0 };
        sendResponse({ ok: true, state: idle });
        return;
      }
      const res = await chrome.runtime.sendMessage({
        type: "WSE_OFFSCREEN_GET_STATE",
        target: "wse-offscreen",
      });
      sendResponse(res ?? { ok: true, state: { playing: false, position: 0 } });
    })().catch(() => sendResponse({ ok: true, state: { playing: false, position: 0 } }));
    return true;
  }

  return undefined;
});
