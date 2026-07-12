import { scrollFraction } from "../audio/scroll-scheduler.js";

/**
 * Injected only when Scroll Mode is active (§45, "Scrolling Page = Vertical
 * Score"). Reports scroll position to the offscreen audio engine so the
 * user's own scrolling drives playback. Sends only a single number
 * (fraction 0..1) — never DOM content.
 *
 * Idempotent: re-injecting (e.g. clicking "Analyze & Play" again) attaches
 * only one listener, guarded by a flag on window.
 */
(() => {
  const w = window as unknown as { __wseScrollTrackerActive?: boolean };
  if (w.__wseScrollTrackerActive) return;
  w.__wseScrollTrackerActive = true;

  function report(): void {
    const doc = document.documentElement;
    const fraction = scrollFraction(window.scrollY, doc.scrollHeight, doc.clientHeight);
    try {
      void chrome.runtime.sendMessage({ type: "WSE_SCROLL_POSITION", fraction });
    } catch {
      // Extension context invalidated (e.g. reloaded) — stop listening.
      detach();
    }
  }

  let raf = 0;
  function onScroll(): void {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      report();
    });
  }

  function onMessage(msg: { type?: string }): void {
    if (msg?.type === "WSE_SCROLL_STOP") detach();
  }

  function detach(): void {
    window.removeEventListener("scroll", onScroll);
    chrome.runtime.onMessage.removeListener(onMessage);
    w.__wseScrollTrackerActive = false;
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  chrome.runtime.onMessage.addListener(onMessage);
  report(); // sync to wherever the user already is, immediately
})();
