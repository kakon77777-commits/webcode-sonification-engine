import type { ModeName, Score, StyleName, TuningOptions } from "../src/shared/types.js";
import { DEFAULT_TUNING } from "../src/shared/types.js";
import { extractPageFeatures } from "../src/content/extract.js";
import { computeFingerprint } from "../src/mapping/fingerprint.js";
import { generateScore } from "../src/mapping/default-map.js";
import { WseAudioEngine } from "../src/audio/engine.js";
import { DEFAULT_LAYER_MIX, resolveLayerMix } from "../src/audio/layer-mix.js";
import { downloadEncodedExport } from "../src/audio/export-download.js";
import { encodeScore } from "../src/audio/export-registry.js";
import type { ExportFormat, ExportOptions } from "../src/audio/export-types.js";
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
const SETTINGS_KEY = "wse-demo-settings-v1";

const $ = (id: string) => document.getElementById(id)!;
const out = $("out");

function currentTuning(): TuningOptions {
  const v = (id: string) => Number(($(id) as HTMLInputElement).value);
  return {
    tempoShift: v("s-tempo"),
    density: v("s-density") / 100,
    brightness: v("s-bright") / 100,
    reverb: v("s-reverb") / 100,
    mix: resolveLayerMix({
      lowEnd: v("s-low-end") / 100,
      pad: v("s-pad") / 100,
      melody: v("s-melody") / 100,
      rhythm: v("s-rhythm") / 100,
    }),
  };
}

function currentRenderOptions(): ExportOptions {
  const tuning = currentTuning();
  return { brightness: tuning.brightness, reverb: tuning.reverb, mix: tuning.mix };
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

function resolvedTuning(tuning?: TuningOptions): TuningOptions {
  return {
    tempoShift: Number.isFinite(tuning?.tempoShift) ? tuning!.tempoShift : DEFAULT_TUNING.tempoShift,
    density: Number.isFinite(tuning?.density) ? tuning!.density : DEFAULT_TUNING.density,
    brightness: Number.isFinite(tuning?.brightness) ? tuning!.brightness : DEFAULT_TUNING.brightness,
    reverb: Number.isFinite(tuning?.reverb) ? tuning!.reverb : DEFAULT_TUNING.reverb,
    mix: resolveLayerMix(tuning?.mix),
  };
}

function applyTuning(tuning?: TuningOptions): void {
  const resolved = resolvedTuning(tuning);
  const mix = resolveLayerMix(resolved.mix);
  ($("s-tempo") as HTMLInputElement).value = String(resolved.tempoShift);
  ($("s-density") as HTMLInputElement).value = String(Math.round(resolved.density * 100));
  ($("s-bright") as HTMLInputElement).value = String(Math.round(resolved.brightness * 100));
  ($("s-reverb") as HTMLInputElement).value = String(Math.round(resolved.reverb * 100));
  ($("s-low-end") as HTMLInputElement).value = String(Math.round(mix.lowEnd * 100));
  ($("s-pad") as HTMLInputElement).value = String(Math.round(mix.pad * 100));
  ($("s-melody") as HTMLInputElement).value = String(Math.round(mix.melody * 100));
  ($("s-rhythm") as HTMLInputElement).value = String(Math.round(mix.rhythm * 100));
  renderSliderValues();
}

function renderSliderValues(): void {
  const tempo = Number(($("s-tempo") as HTMLInputElement).value);
  $("v-tempo").textContent = `${tempo >= 0 ? "+" : ""}${tempo}`;
  $("v-density").textContent = `${($("s-density") as HTMLInputElement).value}%`;
  $("v-bright").textContent = ($("s-bright") as HTMLInputElement).value;
  $("v-reverb").textContent = ($("s-reverb") as HTMLInputElement).value;
  $("v-low-end").textContent = `${($("s-low-end") as HTMLInputElement).value}%`;
  $("v-pad").textContent = `${($("s-pad") as HTMLInputElement).value}%`;
  $("v-melody").textContent = `${($("s-melody") as HTMLInputElement).value}%`;
  $("v-rhythm").textContent = `${($("s-rhythm") as HTMLInputElement).value}%`;
}

function saveSettings(): void {
  const settings = {
    style: ($("style") as HTMLSelectElement).value,
    mode: ($("mode") as HTMLSelectElement).value,
    playback: ($("playback") as HTMLSelectElement).value,
    tuning: currentTuning(),
  };
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function loadSettings(): void {
  const raw = window.localStorage.getItem(SETTINGS_KEY);
  if (!raw) {
    applyTuning({
      ...DEFAULT_TUNING,
      mix: DEFAULT_LAYER_MIX,
    });
    return;
  }

  try {
    const saved = JSON.parse(raw) as {
      style?: string;
      mode?: string;
      playback?: string;
      tuning?: TuningOptions;
    };
    if (saved.style) ($("style") as HTMLSelectElement).value = saved.style;
    if (saved.mode) ($("mode") as HTMLSelectElement).value = saved.mode;
    if (saved.playback) ($("playback") as HTMLSelectElement).value = saved.playback;
    applyTuning(saved.tuning);
  } catch {
    applyTuning({
      ...DEFAULT_TUNING,
      mix: DEFAULT_LAYER_MIX,
    });
  }
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
    await engine.startScrollMode(score, { brightness: tuning.brightness, reverb: tuning.reverb, mix: tuning.mix });
    attachScrollListener();
    engine.setScrollFraction(currentScrollFraction()); // sync to wherever the user already is
  } else if (driveMode === "live") {
    await engine.startLiveMode(score, { brightness: tuning.brightness, reverb: tuning.reverb, mix: tuning.mix });
    $("liveLog").textContent = "";
    $("liveFeed").classList.add("on");
    startLiveObserver();
  } else {
    await engine.play(score, {
      brightness: tuning.brightness,
      reverb: tuning.reverb,
      mix: tuning.mix,
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

  ($("export") as HTMLButtonElement).disabled = false;
  $("export-status").textContent = "";
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
$("export").addEventListener("click", async () => {
  if (!lastScore) return;
  const btn = $("export") as HTMLButtonElement;
  const status = $("export-status");
  const format = ($("export-format") as HTMLSelectElement).value as ExportFormat;
  const label = format === "wav" ? "WAV" : "MIDI";
  btn.disabled = true;
  status.textContent = format === "wav" ? "Rendering WAV…" : "Encoding MIDI…";
  try {
    const artifact = await encodeScore(lastScore, format, currentRenderOptions());
    downloadEncodedExport(artifact);
    status.textContent = `${label} downloaded.`;
  } catch (err) {
    status.textContent = `Export failed: ${err instanceof Error ? err.message : String(err)}`;
  } finally {
    btn.disabled = lastScore === null;
  }
});

for (const id of ["style", "mode", "playback"] as const) {
  $(id).addEventListener("change", () => saveSettings());
}

for (const id of ["s-tempo", "s-density", "s-bright", "s-reverb", "s-low-end", "s-pad", "s-melody", "s-rhythm"] as const) {
  $(id).addEventListener("input", () => {
    renderSliderValues();
    saveSettings();
  });
}

loadSettings();

// Expose analysis (without audio) immediately for tests/automation.
(window as any).__wseAnalyze = analyze;
