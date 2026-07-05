import type { ModeName, PageFeatures, Score, StyleName, TuningOptions } from "../shared/types.js";
import { DEFAULT_TUNING } from "../shared/types.js";
import type { PlaybackState, WseErrorCode } from "../shared/messages.js";
import { computeFingerprint } from "../mapping/fingerprint.js";
import { generateScore } from "../mapping/default-map.js";

/**
 * Popup: Analyze & Play / Stop / Regenerate (§49).
 * The whole pipeline W → F → Z → Θ → Q runs here, locally; only the finished
 * score is handed to the offscreen audio document.
 */

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const analyzeBtn = $<HTMLButtonElement>("analyze");
const stopBtn = $<HTMLButtonElement>("stop");
const regenBtn = $<HTMLButtonElement>("regen");
const modeSel = $<HTMLSelectElement>("mode");
const styleSel = $<HTMLSelectElement>("style");
const infoBox = $<HTMLDivElement>("info");
const explainBox = $<HTMLDetailsElement>("explain-box");
const explainList = $<HTMLUListElement>("explain");
const errorBox = $<HTMLDivElement>("error");
const statusBox = $<HTMLDivElement>("status");

let lastFeatures: PageFeatures | null = null;
let variation = 0;

/** Tuning sliders — part of Θ, persisted, fully deterministic. */
const sliders = {
  tempo: $<HTMLInputElement>("s-tempo"),
  density: $<HTMLInputElement>("s-density"),
  bright: $<HTMLInputElement>("s-bright"),
  reverb: $<HTMLInputElement>("s-reverb"),
};

function currentTuning(): TuningOptions {
  return {
    tempoShift: Number(sliders.tempo.value),
    density: Number(sliders.density.value) / 100,
    brightness: Number(sliders.bright.value) / 100,
    reverb: Number(sliders.reverb.value) / 100,
  };
}

function renderSliderValues(): void {
  const t = Number(sliders.tempo.value);
  $<HTMLSpanElement>("v-tempo").textContent = `${t >= 0 ? "+" : ""}${t}`;
  $<HTMLSpanElement>("v-density").textContent = `${sliders.density.value}%`;
  $<HTMLSpanElement>("v-bright").textContent = sliders.bright.value;
  $<HTMLSpanElement>("v-reverb").textContent = sliders.reverb.value;
}

const ERROR_TEXT: Record<WseErrorCode, string> = {
  NO_PERMISSION: "Permission denied for this tab.",
  NO_DOM: "Could not read this page's structure.",
  AUDIO_BLOCKED: "Audio could not start. Try again.",
  EXTRACTION_TIMEOUT: "Analysis timed out on this page.",
  PAGE_TOO_LARGE: "Page too large to analyze.",
  UNSUPPORTED_PAGE: "This page cannot be analyzed.",
};

function showError(code: WseErrorCode, detail?: string): void {
  errorBox.textContent = ERROR_TEXT[code] + (detail ? ` (${detail})` : "");
  errorBox.classList.remove("hidden");
}

function clearError(): void {
  errorBox.classList.add("hidden");
  errorBox.textContent = "";
}

function setStatus(text: string): void {
  statusBox.textContent = text;
}

function renderScore(score: Score, nodes: number): void {
  $<HTMLSpanElement>("i-bpm").textContent = `${score.profile.bpm} BPM`;
  $<HTMLSpanElement>("i-key").textContent = score.profile.keyName;
  $<HTMLSpanElement>("i-nodes").textContent = String(nodes);
  $<HTMLSpanElement>("i-length").textContent = `${score.profile.lengthSec}s · ${score.events.length} notes`;
  $<HTMLSpanElement>("i-hash").textContent =
    score.fingerprint.hash + (score.variation > 0 ? ` · var ${score.variation}` : "");
  infoBox.classList.remove("hidden");

  explainList.textContent = "";
  for (const item of score.profile.explain) {
    const li = document.createElement("li");
    const b = document.createElement("b");
    b.textContent = `${item.feature} ${item.value}`;
    li.append(b, ` → ${item.effect}`);
    explainList.appendChild(li);
  }
  explainBox.classList.remove("hidden");
}

async function extractFromActiveTab(): Promise<PageFeatures> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw Object.assign(new Error("no tab"), { wseCode: "UNSUPPORTED_PAGE" });

  const featuresPromise = new Promise<PageFeatures>((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.runtime.onMessage.removeListener(listener);
      reject(Object.assign(new Error("timeout"), { wseCode: "EXTRACTION_TIMEOUT" }));
    }, 5000);
    const listener = (msg: { type?: string; payload?: PageFeatures; code?: WseErrorCode }) => {
      if (msg?.type === "WSE_FEATURES" && msg.payload) {
        clearTimeout(timeout);
        chrome.runtime.onMessage.removeListener(listener);
        resolve(msg.payload);
      } else if (msg?.type === "WSE_EXTRACT_ERROR") {
        clearTimeout(timeout);
        chrome.runtime.onMessage.removeListener(listener);
        reject(Object.assign(new Error("extract"), { wseCode: msg.code ?? "NO_DOM" }));
      }
    };
    chrome.runtime.onMessage.addListener(listener);
  });

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content-extractor.js"],
    });
  } catch (err) {
    throw Object.assign(err instanceof Error ? err : new Error(String(err)), {
      wseCode: "UNSUPPORTED_PAGE",
    });
  }
  return featuresPromise;
}

function buildScore(features: PageFeatures): Score {
  const fingerprint = computeFingerprint(features);
  return generateScore(features, fingerprint, {
    style: styleSel.value as StyleName,
    mode: modeSel.value as ModeName,
    variation,
    tuning: currentTuning(),
  });
}

async function playScore(score: Score): Promise<void> {
  const res = (await chrome.runtime.sendMessage({
    type: "WSE_PLAY",
    score,
    tuning: currentTuning(),
  })) as { ok: boolean; code?: WseErrorCode; detail?: string } | undefined;
  if (!res?.ok) {
    showError(res?.code ?? "AUDIO_BLOCKED", res?.detail);
    return;
  }
  stopBtn.disabled = false;
  setStatus(`Playing · ${score.profile.style} · ${score.profile.keyName} · ${score.profile.bpm} BPM`);
}

async function analyzeAndPlay(): Promise<void> {
  clearError();
  analyzeBtn.disabled = true;
  setStatus("Analyzing page…");
  try {
    variation = 0;
    const features = await extractFromActiveTab();
    lastFeatures = features;
    const score = buildScore(features);
    renderScore(score, features.dom.totalNodes);
    regenBtn.disabled = false;
    setStatus("Starting audio…");
    await playScore(score);
  } catch (err) {
    const code = (err as { wseCode?: WseErrorCode }).wseCode ?? "NO_DOM";
    showError(code);
    setStatus("");
  } finally {
    analyzeBtn.disabled = false;
  }
}

async function stop(): Promise<void> {
  await chrome.runtime.sendMessage({ type: "WSE_STOP" });
  stopBtn.disabled = true;
  setStatus("Stopped.");
}

async function regenerate(): Promise<void> {
  if (!lastFeatures) return;
  clearError();
  variation++;
  const score = buildScore(lastFeatures);
  renderScore(score, lastFeatures.dom.totalNodes);
  setStatus(`Variation ${variation}…`);
  await playScore(score);
}

async function saveSettings(): Promise<void> {
  await chrome.storage.local.set({
    style: styleSel.value,
    mode: modeSel.value,
    tuning: currentTuning(),
  });
}

function applyTuning(t: TuningOptions): void {
  sliders.tempo.value = String(t.tempoShift);
  sliders.density.value = String(Math.round(t.density * 100));
  sliders.bright.value = String(Math.round(t.brightness * 100));
  sliders.reverb.value = String(Math.round(t.reverb * 100));
  renderSliderValues();
}

async function init(): Promise<void> {
  const saved = (await chrome.storage.local.get(["style", "mode", "tuning"])) as {
    style?: string;
    mode?: string;
    tuning?: TuningOptions;
  };
  if (saved.style) styleSel.value = saved.style;
  if (saved.mode) modeSel.value = saved.mode;
  applyTuning(saved.tuning ?? DEFAULT_TUNING);

  // Reflect ongoing playback if the popup was reopened.
  try {
    const res = (await chrome.runtime.sendMessage({ type: "WSE_GET_STATE" })) as
      | { ok: boolean; state?: PlaybackState }
      | undefined;
    if (res?.state?.playing && res.state.summary) {
      stopBtn.disabled = false;
      const s = res.state.summary;
      setStatus(`Playing · ${s.style} · ${s.keyName} · ${s.bpm} BPM`);
    }
  } catch {
    // Service worker asleep — idle state.
  }
}

analyzeBtn.addEventListener("click", () => void analyzeAndPlay());
stopBtn.addEventListener("click", () => void stop());
regenBtn.addEventListener("click", () => void regenerate());
styleSel.addEventListener("change", () => void saveSettings());
modeSel.addEventListener("change", () => void saveSettings());
for (const el of Object.values(sliders)) {
  el.addEventListener("input", () => renderSliderValues());
  el.addEventListener("change", () => void saveSettings());
}
$<HTMLButtonElement>("tune-reset").addEventListener("click", () => {
  applyTuning(DEFAULT_TUNING);
  void saveSettings();
});

void init();
