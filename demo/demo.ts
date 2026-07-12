import type { ModeName, Score, StyleName, TuningOptions } from "../src/shared/types.js";
import { extractPageFeatures } from "../src/content/extract.js";
import { computeFingerprint } from "../src/mapping/fingerprint.js";
import { generateScore } from "../src/mapping/default-map.js";
import { WseAudioEngine } from "../src/audio/engine.js";
import { exportScoreAsWav } from "../src/audio/export-wav.js";
import { LAYER_COLORS, LAYER_LABELS, mountViz, type VizHandles } from "../src/viz/viz-core.js";

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
  await engine.play(score, {
    brightness: tuning.brightness,
    reverb: tuning.reverb,
    onEnded: () => {
      out.textContent = "finished";
    },
  });

  // Watch the code become music: same viz core as the extension's visualizer tab.
  $("viz").classList.add("on");
  renderVizLegend();
  viz?.stop();
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

  ($("exportWav") as HTMLButtonElement).disabled = false;
  out.textContent =
    `${score.profile.keyName} · ${score.profile.bpm} BPM · ${score.profile.lengthSec}s · ` +
    `${score.events.length} notes · ${score.profile.character}-led · #${fingerprint.hash}` +
    (variation > 0 ? ` · var ${variation}` : "");
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
  viz?.stop();
  out.textContent = "stopped";
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
