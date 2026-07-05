import type { ExtractErrorMessage, FeaturesMessage } from "../shared/messages.js";
import { extractPageFeatures } from "./extract.js";

/**
 * Content-script entry, injected via chrome.scripting.executeScript on the
 * user's explicit click (activeTab). Runs once per injection, extracts the
 * feature snapshot and messages it back. Local-only: nothing here talks to
 * any server (§25, §80).
 */

(() => {
  try {
    if (!document.documentElement) {
      const msg: ExtractErrorMessage = { type: "WSE_EXTRACT_ERROR", code: "NO_DOM" };
      void chrome.runtime.sendMessage(msg);
      return;
    }
    const started = performance.now();
    const payload = extractPageFeatures(document, window);
    const elapsed = Math.round(performance.now() - started);
    const msg: FeaturesMessage = { type: "WSE_FEATURES", payload };
    void chrome.runtime.sendMessage(msg);
    // Perf budget note (§75): analysis target 500–1500 ms; typical pages are far below.
    if (elapsed > 1500) console.debug(`[WSE] extraction took ${elapsed}ms`);
  } catch (err) {
    const msg: ExtractErrorMessage = {
      type: "WSE_EXTRACT_ERROR",
      code: "NO_DOM",
      detail: err instanceof Error ? err.message : String(err),
    };
    void chrome.runtime.sendMessage(msg);
  }
})();
