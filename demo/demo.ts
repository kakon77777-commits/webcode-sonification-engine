import type { ModeName, Score, StyleName, TuningOptions } from "../src/shared/types.js";
import { extractPageFeatures } from "../src/content/extract.js";
import { computeFingerprint } from "../src/mapping/fingerprint.js";
import { generateScore } from "../src/mapping/default-map.js";
import { WseAudioEngine } from "../src/audio/engine.js";
import { exportScoreAsWav } from "../src/audio/export-wav.js";
import { scrollFraction } from "../src/audio/scroll-scheduler.js";
import type { MutationBatch } from "../src/mapping/live.js";
import { layerForTag } from "../src/mapping/layer-tags.js";
import { LAYER_COLORS, LAYER_LABELS, mountViz, type VizHandles } from "../src/viz/viz-core.js";

type DriveMode = "auto" | "scroll" | "live";

/**
 * Standalone demo: the full extension pipeline running inside a normal page.
 * Exposes window.__wse for automated verification.
 */

const engine = new WseAudioEngine();
let variation = 0;
let lastScore: Score | null = null;

const $ = (id: string) => document.getElementById(id)!;
const out = $("out");

function currentTuning(): TuningOptions {
  const v = (id: string) => Number(($(id) as HTMLInputElement).value);
  return {
    tempoShift: v("s-tempo"),
    density: v("s-density") / 100,
    brightness: v("s-bright") / 100,
    reverb: v("s-reverb") / 100,
  };
}

function currentOptions(): {
  style: StyleName;
  mode: ModeName;
  variation: number;
  tuning: TuningOptions;
} {
  return {
    style: ($("style") as HTMLSelectElement).value as StyleName,
    mode: ($("mode") as HTMLSelectElement).value as ModeName,
    variation,
    tuning: currentTuning(),
  };
}

function analyze() {
  // Keep the status line constant during extraction — otherwise the previous
  // status text changes textLength and (correctly, but confusingly) shifts
  // the page's own fingerprint between plays.
  out.textContent = "idle";
  const features = extractPageFeatures(document, window);
  const fingerprint = computeFingerprint(features);
  const score = generateScore(features, fingerprint, currentOptions());
  return { features, fingerprint, score };
}

let viz: VizHandles | null = null;
let scrollListenerAttached = false;

function currentScrollFraction(): number {
  const doc = document.documentElement;
  return scrollFraction(window.scrollY, doc.scrollHeight, doc.clientHeight);
}

function attachScrollListener(): void {
  if (scrollListenerAttached) return;
  scrollListenerAttached = true;
  window.addEventListener("scroll", onDemoScroll, { passive: true });
}

function detachScrollListener(): void {
  if (!scrollListenerAttached) return;
  scrollListenerAttached = false;
  window.removeEventListener("scroll", onDemoScroll);
}

function onDemoScroll(): void {
  engine.setScrollFraction(currentScrollFraction());
}

// ---- Live Mode (Mutation Mode): direct MutationObserver, same document, no messaging needed.
let mutationObserver: MutationObserver | null = null;
let liveFlushTimer = 0;
let liveAdded: string[] = [];
let liveRemoved: string[] = [];
let liveAttrChanged: string[] = [];

function ignoredForLive(node: Node): boolean {
  const el = node instanceof Element ? node : node.parentElement;
  return !!el?.closest("[data-wse-ignore]");
}

function pushLiveTag(list: string[], el: Element, cap = 30): void {
  if (list.length >= cap) return;
  list.push(el.tagName.toLowerCase());
}

function logLiveEvent(kind: "add" | "remove" | "attr", tag: string): void {
  const log = $("liveLog");
  const layer = layerForTag(tag) ?? "melody";
  const chip = document.createElement("span");
  chip.style.borderColor = LAYER_COLORS[layer];
  chip.textContent = `${kind === "add" ? "+" : kind === "remove" ? "−" : "~"} <${tag}>`;
  log.appendChild(chip);
  while (log.children.length > 40) log.firstElementChild?.remove();
  setTimeout(() => chip.remove(), 4000);
}

function flushLiveBatch(): void {
  liveFlushTimer = 0;
  if (liveAdded.length === 0 && liveRemoved.length === 0 && liveAttrChanged.length === 0) return;
  const batch: MutationBatch = { added: liveAdded, removed: liveRemoved, attrChanged: liveAttrChanged };
  liveAdded = [];
  liveRemoved = [];
  liveAttrChanged = [];
  engine.triggerMutations(batch);
  for (const tag of batch.added) logLiveEvent("add", tag);
  for (const tag of batch.removed) logLiveEvent("remove", tag);
  for (const tag of batch.attrChanged) logLiveEvent("attr", tag);
}

function startLiveObserver(): void {
  stopLiveObserver();
  mutationObserver = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "childList") {
        // Removed nodes are already detached by the time the record fires —
        // their own ancestor chain is gone, so .closest() on the node itself
        // can no longer see a data-wse-ignore ancestor. record.target (the
        // still-attached container the removal happened in) is the only
        // reliable thing to check for removals.
        const containerIgnored = ignoredForLive(record.target);
        for (const node of record.addedNodes) {
          if (node instanceof Element && !ignoredForLive(node)) pushLiveTag(liveAdded, node);
        }
        for (const node of record.removedNodes) {
          if (node instanceof Element && !containerIgnored) pushLiveTag(liveRemoved, node);
        }
      } else if (record.type === "attributes" && record.target instanceof Element && !ignoredForLive(record.target)) {
        pushLiveTag(liveAttrChanged, record.target);
      }
    }
    if (!liveFlushTimer) liveFlushTimer = window.setTimeout(flushLiveBatch, 120);
  });
  mutationObserver.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
}

function stopLiveObserver(): void {
  mutationObserver?.disconnect();
  mutationObserver = null;
  if (liveFlushTimer) {
    clearTimeout(liveFlushTimer);
    liveFlushTimer = 0;
  }
  liveAdded = [];
  liveRemoved = [];
  liveAttrChanged = [];
}

function renderVizLegend(): void {
  const legend = $("viz-legend");
  if (legend.childElementCount > 0) return;
  for (const layer of Object.keys(LAYER_LABELS) as (keyof typeof LAYER_LABELS)[]) {
    const key = document.createElement("span");
    const dot = document.createElement("span");
    dot.className = "dot";
    dot.style.background = LAYER_COLORS[layer];
    key.append(dot, LAYER_LABELS[layer]);
    legend.appendChild(key);
  }
}

async function play() {
  const { features, fingerprint, score } = analyze();
  lastScore = score;
  (window as any).__wse = {
    features,
    fingerprint,
    score,
    engine,
    eventCount: score.events.length,
  };
  const tuning = currentTuning();
  const driveMode = ($("playback") as HTMLSelectElement).value as DriveMode;
  detachScrollListener();
  stopLiveObserver();
  $("liveFeed").classList.remove("on");
  viz?.stop();
  $("viz").classList.remove("on");

  if (driveMode === "scroll") {
    await engine.startScrollMode(score, { brightness: tuning.brightness, reverb: tuning.reverb });
    attachScrollListener();
    engine.setScrollFraction(currentScrollFraction()); // sync to wherever the user already is
  } else if (driveMode === "live") {
    await engine.startLiveMode(score, { brightness: tuning.brightness, reverb: tuning.reverb });
    $("liveLog").textContent = "";
    $("liveFeed").classList.add("on");
    startLiveObserver();
  } else {
    await engine.play(score, {
      brightness: tuning.brightness,
      reverb: tuning.reverb,
      onEnded: () => {
        out.textContent = "finished";
      },
    });
  }

  // Watch the code become music: same viz core as the extension's visualizer tab.
  // Live Mode has no fixed score.events being played, so it gets the liveFeed instead.
  if (driveMode !== "live") {
    $("viz").classList.add("on");
    renderVizLegend();
    viz = mountViz({
      tokensEl: $("tokens"),
      canvas: $("roll") as HTMLCanvasElement,
      score,
      tokens: features.tokens,
      getPosition: () => engine.getState().position,
      isPlaying: () => engine.getState().playing,
    });
    (window as any).__wseViz = viz;
    viz.start();
  }

  ($("exportWav") as HTMLButtonElement).disabled = false;
  const modeSuffix = driveMode === "scroll" ? " · scroll to play" : driveMode === "live" ? " · live — change the page" : "";
  out.textContent =
    `${score.profile.keyName} · ${score.profile.bpm} BPM · ${score.profile.lengthSec}s · ` +
    `${score.events.length} notes · ${score.profile.character}-led · #${fingerprint.hash}` +
    (variation > 0 ? ` · var ${variation}` : "") +
    modeSuffix;
}

$("play").addEventListener("click", () => {
  variation = 0;
  void play();
});
$("regen").addEventListener("click", () => {
  variation++;
  void play();
});
$("stop").addEventListener("click", () => {
  void engine.stop();
  detachScrollListener();
  stopLiveObserver();
  $("liveFeed").classList.remove("on");
  viz?.stop();
  out.textContent = "stopped";
});

// Percussion buttons double as real DOM mutation triggers for Live Mode:
// clicking one adds a genuine (invisible) <button>, clicking it again removes it.
document.querySelectorAll<HTMLButtonElement>(".mutate-btn").forEach((btn, i) => {
  btn.addEventListener("click", () => {
    const slots = $("mutateSlots");
    const existing = slots.querySelector<HTMLElement>(`[data-slot="${i}"]`);
    if (existing) {
      existing.remove();
      return;
    }
    const el = document.createElement("button");
    el.setAttribute("data-slot", String(i));
    el.setAttribute("aria-hidden", "true");
    el.tabIndex = -1;
    el.style.cssText = "width:1px;height:1px;padding:0;margin:0;border:0;opacity:0;position:absolute;pointer-events:none;";
    slots.appendChild(el);
  });
});
$("exportWav").addEventListener("click", async () => {
  if (!lastScore) return;
  const btn = $("exportWav") as HTMLButtonElement;
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Rendering…";
  try {
    const tuning = currentTuning();
    await exportScoreAsWav(lastScore, { brightness: tuning.brightness, reverb: tuning.reverb });
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
});

// Expose analysis (without audio) immediately for tests/automation.
(window as any).__wseAnalyze = analyze;
