import type { VizPayload } from "../shared/types.js";
import { WseAudioEngine } from "../audio/engine.js";
import { resolveLayerMix } from "../audio/layer-mix.js";
import { downloadEncodedExport } from "../audio/export-download.js";
import { encodeScore } from "../audio/export-registry.js";
import type { ExportFormat, ExportOptions } from "../audio/export-types.js";
import { LAYER_COLORS, LAYER_LABELS, mountViz, type VizHandles } from "./viz-core.js";

/**
 * Extension visualizer page: opened by the popup's "Analyze & Visualize".
 * Reads the payload from chrome.storage.local, plays the score in-page
 * (extension pages are exempt from autoplay restrictions) and drives the
 * shared viz core off the audio clock. Refreshing the tab replays.
 */

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const engine = new WseAudioEngine();
let viz: VizHandles | null = null;
let payload: VizPayload | null = null;
const exportBtn = $<HTMLButtonElement>("export");
const exportFormat = $<HTMLSelectElement>("export-format");
const exportStatus = $<HTMLParagraphElement>("export-status");
const metaIdentity = $<HTMLSpanElement>("meta-identity");
const metaProfile = $<HTMLSpanElement>("meta-profile");
const metaFinished = $<HTMLSpanElement>("meta-finished");

function renderOptions(p: VizPayload): ExportOptions {
  return { brightness: p.tuning.brightness, reverb: p.tuning.reverb, mix: resolveLayerMix(p.tuning.mix) };
}

function renderLegend(): void {
  const legend = $<HTMLDivElement>("legend");
  legend.textContent = "";
  for (const layer of Object.keys(LAYER_LABELS) as (keyof typeof LAYER_LABELS)[]) {
    const key = document.createElement("span");
    key.className = "key";
    const dot = document.createElement("span");
    dot.className = "dot";
    dot.style.background = LAYER_COLORS[layer];
    key.append(dot, LAYER_LABELS[layer]);
    legend.appendChild(key);
  }
}

function renderMeta(p: VizPayload): void {
  const pr = p.score.profile;
  let host = p.url;
  try {
    host = new URL(p.url).host + new URL(p.url).pathname;
  } catch {
    // Keep raw URL.
  }
  metaIdentity.textContent =
    `${host} · ${pr.keyName} · ${pr.bpm} BPM · ${pr.lengthSec}s · ` +
    `${p.score.events.length} notes · ${pr.style} · #${p.score.fingerprint.hash}`;
  metaFinished.textContent = "";
  const profileId = pr.mappingProfileId?.trim();
  const profileLabel = pr.mappingProfileLabel?.trim();
  const profileHash = pr.mappingProfileHash?.trim();
  const profileParts = [
    profileLabel || profileId,
    profileLabel && profileId ? `(${profileId})` : undefined,
    profileHash,
  ].filter((part): part is string => Boolean(part));
  if (profileParts.length > 0) {
    metaProfile.textContent = `Profile ${profileParts.join(" · ")}`;
    metaProfile.classList.remove("hidden");
  } else {
    metaProfile.textContent = "";
    metaProfile.classList.add("hidden");
  }
}

async function startPlayback(p: VizPayload): Promise<void> {
  viz?.reset();
  // If autoplay is blocked, engine.play() stalls on AudioContext.resume() —
  // surface the Start overlay; its click restarts with real user activation.
  const overlayTimer = window.setTimeout(() => $("overlay").classList.remove("hidden"), 1200);
  try {
    await engine.play(p.score, {
      brightness: p.tuning.brightness,
      reverb: p.tuning.reverb,
      mix: resolveLayerMix(p.tuning.mix),
      onEnded: () => {
        metaFinished.textContent = " · finished";
      },
    });
  } catch {
    // A stalled context that was later closed by the overlay restart — ignore.
    return;
  }
  clearTimeout(overlayTimer);
  $("overlay").classList.add("hidden");
  viz?.start();
}

async function init(): Promise<void> {
  renderLegend();
  const stored = (await chrome.storage.local.get("wseVizPayload")) as {
    wseVizPayload?: VizPayload;
  };
  payload = stored.wseVizPayload ?? null;
  if (!payload) {
    $("empty").classList.remove("hidden");
    metaIdentity.textContent = "no score";
    metaProfile.textContent = "";
    metaProfile.classList.add("hidden");
    metaFinished.textContent = "";
    return;
  }
  renderMeta(payload);
  exportBtn.disabled = false;
  viz = mountViz({
    tokensEl: $("tokens"),
    canvas: $("roll") as unknown as HTMLCanvasElement,
    score: payload.score,
    tokens: payload.tokens,
    getPosition: () => engine.getState().position,
    isPlaying: () => engine.getState().playing,
  });
  await startPlayback(payload);
}

$("replay").addEventListener("click", () => {
  if (payload) void startPlayback(payload);
});
$("stopBtn").addEventListener("click", () => {
  void engine.stop();
  viz?.stop();
});
$("overlay-start").addEventListener("click", async () => {
  // Autoplay was blocked — restart with this click's user activation.
  if (!payload) return;
  await engine.stop();
  await startPlayback(payload);
});
$<HTMLButtonElement>("export").addEventListener("click", async () => {
  if (!payload) return;
  const format = exportFormat.value as ExportFormat;
  const label = format === "wav" ? "WAV" : "MIDI";
  exportBtn.disabled = true;
  exportStatus.textContent = format === "wav" ? "Rendering WAV…" : "Encoding MIDI…";
  try {
    const artifact = await encodeScore(payload.score, format, renderOptions(payload));
    downloadEncodedExport(artifact);
    exportStatus.textContent = `${label} downloaded.`;
  } catch (err) {
    exportStatus.textContent = `Export failed: ${err instanceof Error ? err.message : String(err)}`;
  } finally {
    exportBtn.disabled = payload === null;
  }
});

void init();
