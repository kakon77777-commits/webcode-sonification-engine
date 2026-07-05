import type { ModeName, StyleName, TuningOptions } from "../src/shared/types.js";
import { extractPageFeatures } from "../src/content/extract.js";
import { computeFingerprint } from "../src/mapping/fingerprint.js";
import { generateScore } from "../src/mapping/default-map.js";
import { WseAudioEngine } from "../src/audio/engine.js";

/**
 * Standalone demo: the full extension pipeline running inside a normal page.
 * Exposes window.__wse for automated verification.
 */

const engine = new WseAudioEngine();
let variation = 0;

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

async function play() {
  const { features, fingerprint, score } = analyze();
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
  out.textContent = "stopped";
});

// Expose analysis (without audio) immediately for tests/automation.
(window as any).__wseAnalyze = analyze;
