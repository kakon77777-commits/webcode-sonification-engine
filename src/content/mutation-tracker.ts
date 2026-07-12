/**
 * Injected only when Mutation Mode is active (§29–31, "Live Website
 * Performance"). Watches the page with a MutationObserver and reports
 * batches of TAG NAMES ONLY — never attribute names, values, or text
 * content — so the live engine can turn DOM activity into music.
 *
 * Idempotent (guarded like scroll-tracker.ts) and privacy-symmetric with
 * static extraction: subtrees under [data-wse-ignore] are skipped, and
 * [contenteditable] regions are never inspected.
 */
(() => {
  const w = window as unknown as { __wseMutationTrackerActive?: boolean };
  if (w.__wseMutationTrackerActive) return;
  w.__wseMutationTrackerActive = true;

  const MAX_TAGS_PER_BATCH = 30;
  const FLUSH_MS = 120;

  let added: string[] = [];
  let removed: string[] = [];
  let attrChanged: string[] = [];
  let flushTimer = 0;

  function ignored(node: Node): boolean {
    const el = node instanceof Element ? node : node.parentElement;
    return !!el?.closest("[data-wse-ignore]");
  }

  function pushTag(list: string[], el: Element): void {
    if (list.length >= MAX_TAGS_PER_BATCH) return;
    list.push(el.tagName.toLowerCase());
  }

  function scheduleFlush(): void {
    if (flushTimer) return;
    flushTimer = window.setTimeout(flush, FLUSH_MS);
  }

  function flush(): void {
    flushTimer = 0;
    if (added.length === 0 && removed.length === 0 && attrChanged.length === 0) return;
    const batch = { added, removed, attrChanged };
    added = [];
    removed = [];
    attrChanged = [];
    try {
      void chrome.runtime.sendMessage({ type: "WSE_MUTATION_BATCH", batch });
    } catch {
      detach();
    }
  }

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "childList") {
        // Removed nodes are already detached by the time the record fires —
        // their own ancestor chain is gone, so .closest() on the node itself
        // can no longer see a data-wse-ignore ancestor. record.target (the
        // still-attached container the removal happened in) is the only
        // reliable thing to check for removals.
        const containerIgnored = ignored(record.target);
        for (const node of record.addedNodes) {
          if (node instanceof Element && !ignored(node)) pushTag(added, node);
        }
        for (const node of record.removedNodes) {
          if (node instanceof Element && !containerIgnored) pushTag(removed, node);
        }
      } else if (record.type === "attributes" && record.target instanceof Element) {
        if (!ignored(record.target)) pushTag(attrChanged, record.target);
      }
    }
    scheduleFlush();
  });

  function onMessage(msg: { type?: string }): void {
    if (msg?.type === "WSE_MUTATION_STOP") detach();
  }

  function detach(): void {
    observer.disconnect();
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = 0;
    }
    chrome.runtime.onMessage.removeListener(onMessage);
    w.__wseMutationTrackerActive = false;
  }

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
  });
  chrome.runtime.onMessage.addListener(onMessage);
})();
