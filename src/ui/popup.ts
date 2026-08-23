import { DEFAULT_LAYER_MIX, resolveLayerMix } from "../audio/layer-mix.js";
import { downloadEncodedExport } from "../audio/export-download.js";
import { encodeScore } from "../audio/export-registry.js";
import type { ExportFormat, ExportOptions } from "../audio/export-types.js";
import { generateScore } from "../mapping/default-map.js";
import { computeFingerprint } from "../mapping/fingerprint.js";
import { DEFAULT_MAPPING_PROFILE, resolveMappingProfile } from "../mapping/mapping-profile.js";
import type { DriveMode, PlaybackState, WseErrorCode } from "../shared/messages.js";
import { DEFAULT_TUNING } from "../shared/types.js";
import type {
  MappingProfile,
  MappingProfileInput,
  ModeName,
  PageCharacter,
  PageFeatures,
  Score,
  StyleName,
  TuningOptions,
  WsePreset,
} from "../shared/types.js";
import { PRESET_STORAGE_KEY, readPresetEnvelope, removePreset, serializePresetEnvelope, upsertPreset } from "./presets.js";
import {
  buildProfileChoices,
  CUSTOM_PROFILE_VALUE,
  findProfileChoice,
  markCustomProfileValue,
  presetIdFromLabel,
  PROFILE_CHARACTER_ORDER,
  profileBiasFromValues,
  profileBiasToSliderValues,
  trimPresetLabel,
} from "./profile-controls.js";

/**
 * Popup: Analyze & Play / Stop / Regenerate (§49).
 * The whole pipeline W → F → Z → Θ → Q runs here, locally; only the finished
 * score is handed to the offscreen audio document.
 */

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const CUSTOM_PROFILE_DESCRIPTION = "User-adjusted structural emphasis.";

const analyzeBtn = $<HTMLButtonElement>("analyze");
const visualizeBtn = $<HTMLButtonElement>("visualize");
const stopBtn = $<HTMLButtonElement>("stop");
const regenBtn = $<HTMLButtonElement>("regen");
const exportBtn = $<HTMLButtonElement>("export");
const exportFormat = $<HTMLSelectElement>("export-format");
const exportStatus = $<HTMLParagraphElement>("export-status");
const exportBox = $<HTMLDetailsElement>("export-box");
const modeSel = $<HTMLSelectElement>("mode");
const styleSel = $<HTMLSelectElement>("style");
const playbackSel = $<HTMLSelectElement>("playback");
const mappingProfileSel = $<HTMLSelectElement>("mapping-profile");
const presetNameInput = $<HTMLInputElement>("preset-name");
const savePresetBtn = $<HTMLButtonElement>("save-preset");
const deletePresetBtn = $<HTMLButtonElement>("delete-preset");
const infoBox = $<HTMLDivElement>("info");
const explainBox = $<HTMLDetailsElement>("explain-box");
const explainList = $<HTMLUListElement>("explain");
const errorBox = $<HTMLDivElement>("error");
const statusBox = $<HTMLDivElement>("status");

let lastFeatures: PageFeatures | null = null;
let lastScore: Score | null = null;
let lastTabId: number | null = null;
let variation = 0;
let presets: WsePreset[] = [];

const sliders = {
  tempo: $<HTMLInputElement>("s-tempo"),
  density: $<HTMLInputElement>("s-density"),
  bright: $<HTMLInputElement>("s-bright"),
  reverb: $<HTMLInputElement>("s-reverb"),
  lowEnd: $<HTMLInputElement>("s-low-end"),
  pad: $<HTMLInputElement>("s-pad"),
  melody: $<HTMLInputElement>("s-melody"),
  rhythm: $<HTMLInputElement>("s-rhythm"),
};

const profileSliders: Record<PageCharacter, HTMLInputElement> = {
  content: $<HTMLInputElement>("p-content"),
  navigation: $<HTMLInputElement>("p-navigation"),
  media: $<HTMLInputElement>("p-media"),
  form: $<HTMLInputElement>("p-form"),
};

function currentTuning(): TuningOptions {
  return {
    tempoShift: Number(sliders.tempo.value),
    density: Number(sliders.density.value) / 100,
    brightness: Number(sliders.bright.value) / 100,
    reverb: Number(sliders.reverb.value) / 100,
    mix: resolveLayerMix({
      lowEnd: Number(sliders.lowEnd.value) / 100,
      pad: Number(sliders.pad.value) / 100,
      melody: Number(sliders.melody.value) / 100,
      rhythm: Number(sliders.rhythm.value) / 100,
    }),
  };
}

function currentProfileSliderValues(): Record<PageCharacter, number> {
  return {
    content: Number(profileSliders.content.value),
    navigation: Number(profileSliders.navigation.value),
    media: Number(profileSliders.media.value),
    form: Number(profileSliders.form.value),
  };
}

function currentMappingProfile(): MappingProfile {
  const sliderValues = currentProfileSliderValues();
  const selectedValue = markCustomProfileValue(mappingProfileSel.value, sliderValues, presets);
  const selectedChoice = findProfileChoice(selectedValue, presets);
  if (selectedChoice && selectedChoice.kind !== "custom") {
    return resolveMappingProfile(selectedChoice.profile);
  }

  return resolveMappingProfile({
    id: CUSTOM_PROFILE_VALUE,
    label: "Custom",
    description: CUSTOM_PROFILE_DESCRIPTION,
    characterBias: profileBiasFromValues(sliderValues),
  });
}

function currentRenderOptions(): ExportOptions {
  const tuning = currentTuning();
  return { brightness: tuning.brightness, reverb: tuning.reverb, mix: tuning.mix };
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

function renderSliderValues(): void {
  const tempo = Number(sliders.tempo.value);
  $<HTMLSpanElement>("v-tempo").textContent = `${tempo >= 0 ? "+" : ""}${tempo}`;
  $<HTMLSpanElement>("v-density").textContent = `${sliders.density.value}%`;
  $<HTMLSpanElement>("v-bright").textContent = sliders.bright.value;
  $<HTMLSpanElement>("v-reverb").textContent = sliders.reverb.value;
  $<HTMLSpanElement>("v-low-end").textContent = `${sliders.lowEnd.value}%`;
  $<HTMLSpanElement>("v-pad").textContent = `${sliders.pad.value}%`;
  $<HTMLSpanElement>("v-melody").textContent = `${sliders.melody.value}%`;
  $<HTMLSpanElement>("v-rhythm").textContent = `${sliders.rhythm.value}%`;
}

function renderProfileSliderValues(): void {
  for (const character of PROFILE_CHARACTER_ORDER) {
    $<HTMLSpanElement>(`v-p-${character}`).textContent = `${profileSliders[character].value}%`;
  }
}

function setProfileSelection(value: string): void {
  if ([...mappingProfileSel.options].some((option) => option.value === value)) {
    mappingProfileSel.value = value;
  } else {
    mappingProfileSel.value = CUSTOM_PROFILE_VALUE;
  }
  deletePresetBtn.disabled = !mappingProfileSel.value.startsWith("preset:");
}

function populateProfileOptions(selectedValue: string): void {
  const choices = buildProfileChoices(presets);
  mappingProfileSel.textContent = "";
  for (const choice of choices) {
    const option = document.createElement("option");
    option.value = choice.value;
    option.textContent = choice.label;
    mappingProfileSel.appendChild(option);
  }
  setProfileSelection(selectedValue);
}

function syncProfileSelection(preferredValue?: string): void {
  const selectedValue = preferredValue ?? mappingProfileSel.value;
  const syncedValue = markCustomProfileValue(selectedValue, currentProfileSliderValues(), presets);
  setProfileSelection(syncedValue);
}

function applyTuning(tuning?: TuningOptions): void {
  const resolved = resolvedTuning(tuning);
  const mix = resolveLayerMix(resolved.mix);
  sliders.tempo.value = String(resolved.tempoShift);
  sliders.density.value = String(Math.round(resolved.density * 100));
  sliders.bright.value = String(Math.round(resolved.brightness * 100));
  sliders.reverb.value = String(Math.round(resolved.reverb * 100));
  sliders.lowEnd.value = String(Math.round(mix.lowEnd * 100));
  sliders.pad.value = String(Math.round(mix.pad * 100));
  sliders.melody.value = String(Math.round(mix.melody * 100));
  sliders.rhythm.value = String(Math.round(mix.rhythm * 100));
  renderSliderValues();
}

function applyProfileSliders(profile?: MappingProfileInput): void {
  const values = profileBiasToSliderValues(profile);
  for (const character of PROFILE_CHARACTER_ORDER) {
    profileSliders[character].value = String(values[character]);
  }
  renderProfileSliderValues();
}

function applyBuiltinProfile(profile: MappingProfile): void {
  applyProfileSliders(profile);
  presetNameInput.value = "";
  setProfileSelection(profile.id);
}

function applyPreset(preset: WsePreset): void {
  styleSel.value = preset.style;
  modeSel.value = preset.mode;
  applyTuning(preset.tuning);
  applyProfileSliders(preset.mappingProfile);
  presetNameInput.value = preset.label;
  setProfileSelection(`preset:${preset.id}`);
}

function applyDefaults(): void {
  applyTuning({
    ...DEFAULT_TUNING,
    mix: DEFAULT_LAYER_MIX,
  });
  applyBuiltinProfile(DEFAULT_MAPPING_PROFILE);
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
  lastTabId = tab.id;

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
    mappingProfile: currentMappingProfile(),
  });
}

const TRACKER_FILE: Partial<Record<DriveMode, string>> = {
  scroll: "scroll-tracker.js",
  live: "mutation-tracker.js",
};
const STATUS_PREFIX: Record<DriveMode, string> = {
  auto: "Playing",
  scroll: "Scroll to play",
  live: "Live — watching the page",
};

function detachTrackers(tabId: number): void {
  chrome.tabs.sendMessage(tabId, { type: "WSE_SCROLL_STOP" }).catch(() => {});
  chrome.tabs.sendMessage(tabId, { type: "WSE_MUTATION_STOP" }).catch(() => {});
}

async function playScore(score: Score): Promise<void> {
  const driveMode = playbackSel.value as DriveMode;
  const res = (await chrome.runtime.sendMessage({
    type: "WSE_PLAY",
    score,
    tuning: currentTuning(),
    driveMode,
  })) as { ok: boolean; code?: WseErrorCode; detail?: string } | undefined;
  if (!res?.ok) {
    showError(res?.code ?? "AUDIO_BLOCKED", res?.detail);
    return;
  }
  stopBtn.disabled = false;
  const trackerFile = TRACKER_FILE[driveMode];
  if (trackerFile && lastTabId !== null) {
    try {
      await chrome.scripting.executeScript({ target: { tabId: lastTabId }, files: [trackerFile] });
    } catch {
      // Page doesn't allow injection (e.g. a chrome:// tab) — this mode just won't advance.
    }
  }
  setStatus(`${STATUS_PREFIX[driveMode]} · ${score.profile.style} · ${score.profile.keyName} · ${score.profile.bpm} BPM`);
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
    lastScore = score;
    renderScore(score, features.dom.totalNodes);
    regenBtn.disabled = false;
    exportBtn.disabled = false;
    exportBox.classList.remove("hidden");
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

async function analyzeAndVisualize(): Promise<void> {
  clearError();
  visualizeBtn.disabled = true;
  setStatus("Analyzing page…");
  try {
    variation = 0;
    const features = await extractFromActiveTab();
    lastFeatures = features;
    const score = buildScore(features);
    lastScore = score;
    await chrome.runtime.sendMessage({ type: "WSE_STOP" });
    if (lastTabId !== null) detachTrackers(lastTabId);
    await chrome.storage.local.set({
      wseVizPayload: {
        score,
        tokens: features.tokens,
        url: features.url,
        tuning: currentTuning(),
      },
    });
    await chrome.tabs.create({ url: chrome.runtime.getURL("visualizer.html") });
    window.close();
  } catch (err) {
    const code = (err as { wseCode?: WseErrorCode }).wseCode ?? "NO_DOM";
    showError(code);
    setStatus("");
  } finally {
    visualizeBtn.disabled = false;
  }
}

async function stop(): Promise<void> {
  await chrome.runtime.sendMessage({ type: "WSE_STOP" });
  if (lastTabId !== null) detachTrackers(lastTabId);
  stopBtn.disabled = true;
  setStatus("Stopped.");
}

async function regenerate(): Promise<void> {
  if (!lastFeatures) return;
  clearError();
  variation++;
  const score = buildScore(lastFeatures);
  lastScore = score;
  renderScore(score, lastFeatures.dom.totalNodes);
  setStatus(`Variation ${variation}…`);
  await playScore(score);
}

async function exportCurrentScore(): Promise<void> {
  if (!lastScore) return;
  clearError();
  exportBtn.disabled = true;
  const format = exportFormat.value as ExportFormat;
  const label = format === "wav" ? "WAV" : "MIDI";
  exportStatus.textContent = format === "wav" ? "Rendering WAV…" : "Encoding MIDI…";
  try {
    const artifact = await encodeScore(lastScore, format, currentRenderOptions());
    downloadEncodedExport(artifact);
    exportStatus.textContent = `${label} downloaded.`;
  } catch (err) {
    showError("AUDIO_BLOCKED", err instanceof Error ? err.message : String(err));
    exportStatus.textContent = `Export failed: ${err instanceof Error ? err.message : String(err)}`;
  } finally {
    exportBtn.disabled = lastScore === null;
  }
}

async function savePresetList(): Promise<void> {
  await chrome.storage.local.set({
    [PRESET_STORAGE_KEY]: serializePresetEnvelope(presets),
  });
}

async function saveSettings(): Promise<void> {
  await chrome.storage.local.set({
    style: styleSel.value,
    mode: modeSel.value,
    playback: playbackSel.value,
    tuning: currentTuning(),
    mappingProfile: currentMappingProfile(),
    mappingProfileSelection: mappingProfileSel.value,
  });
}

async function handleProfileSelectionChange(): Promise<void> {
  const choice = findProfileChoice(mappingProfileSel.value, presets);
  if (!choice) {
    setProfileSelection(CUSTOM_PROFILE_VALUE);
    await saveSettings();
    return;
  }

  if (choice.kind === "preset" && choice.preset) {
    applyPreset(choice.preset);
  } else if (choice.kind === "builtin") {
    applyBuiltinProfile(choice.profile);
  }

  await saveSettings();
}

async function handleProfileSliderChange(): Promise<void> {
  renderProfileSliderValues();
  syncProfileSelection();
  await saveSettings();
}

async function handleSavePreset(): Promise<void> {
  const label = trimPresetLabel(presetNameInput.value);
  presetNameInput.value = label;
  if (!label) {
    setStatus("Preset name required.");
    return;
  }

  const preset: WsePreset = {
    version: 1,
    id: presetIdFromLabel(label),
    label,
    mappingProfile: currentMappingProfile(),
    style: styleSel.value as StyleName,
    mode: modeSel.value as ModeName,
    tuning: currentTuning(),
  };

  presets = upsertPreset(presets, preset);
  populateProfileOptions(`preset:${preset.id}`);
  presetNameInput.value = preset.label;
  await savePresetList();
  await saveSettings();
  setStatus(`Preset saved · ${preset.label}`);
}

function preferredSelectionAfterDelete(): string {
  const currentBias = profileBiasFromValues(currentProfileSliderValues());
  for (const choice of buildProfileChoices(presets)) {
    if (choice.kind === "preset" || choice.kind === "custom") {
      continue;
    }
    const builtinBias = resolveMappingProfile(choice.profile).characterBias;
    if (PROFILE_CHARACTER_ORDER.every((character) => builtinBias[character] === currentBias[character])) {
      return choice.value;
    }
  }
  return CUSTOM_PROFILE_VALUE;
}

async function handleDeletePreset(): Promise<void> {
  const choice = findProfileChoice(mappingProfileSel.value, presets);
  if (!choice?.preset) {
    setStatus("Select a saved preset to delete.");
    return;
  }

  presets = removePreset(presets, choice.preset.id);
  populateProfileOptions(preferredSelectionAfterDelete());
  deletePresetBtn.disabled = true;
  await savePresetList();
  await saveSettings();
  setStatus(`Preset deleted · ${choice.preset.label}`);
}

async function resetControls(): Promise<void> {
  applyDefaults();
  await saveSettings();
  setStatus("Defaults restored.");
}

async function init(): Promise<void> {
  const saved = (await chrome.storage.local.get([
    "style",
    "mode",
    "playback",
    "tuning",
    "mappingProfile",
    "mappingProfileSelection",
    PRESET_STORAGE_KEY,
  ])) as {
    style?: string;
    mode?: string;
    playback?: string;
    tuning?: TuningOptions;
    mappingProfile?: MappingProfileInput;
    mappingProfileSelection?: string;
    [PRESET_STORAGE_KEY]?: unknown;
  };

  presets = readPresetEnvelope(saved[PRESET_STORAGE_KEY]);
  populateProfileOptions(saved.mappingProfileSelection ?? DEFAULT_MAPPING_PROFILE.id);

  if (saved.style) styleSel.value = saved.style;
  if (saved.mode) modeSel.value = saved.mode;
  if (saved.playback) playbackSel.value = saved.playback;
  applyTuning(saved.tuning);
  applyProfileSliders(resolveMappingProfile(saved.mappingProfile));
  syncProfileSelection(saved.mappingProfileSelection ?? DEFAULT_MAPPING_PROFILE.id);

  try {
    const res = (await chrome.runtime.sendMessage({ type: "WSE_GET_STATE" })) as
      | { ok: boolean; state?: PlaybackState }
      | undefined;
    if (res?.state?.playing && res.state.summary) {
      stopBtn.disabled = false;
      const summary = res.state.summary;
      setStatus(`Playing · ${summary.style} · ${summary.keyName} · ${summary.bpm} BPM`);
    }
  } catch {
    // Service worker asleep — idle state.
  }
}

analyzeBtn.addEventListener("click", () => void analyzeAndPlay());
visualizeBtn.addEventListener("click", () => void analyzeAndVisualize());
stopBtn.addEventListener("click", () => void stop());
regenBtn.addEventListener("click", () => void regenerate());
exportBtn.addEventListener("click", () => void exportCurrentScore());
savePresetBtn.addEventListener("click", () => void handleSavePreset());
deletePresetBtn.addEventListener("click", () => void handleDeletePreset());
styleSel.addEventListener("change", () => void saveSettings());
modeSel.addEventListener("change", () => void saveSettings());
playbackSel.addEventListener("change", () => void saveSettings());
mappingProfileSel.addEventListener("change", () => void handleProfileSelectionChange());
presetNameInput.addEventListener("change", () => {
  presetNameInput.value = trimPresetLabel(presetNameInput.value);
});

for (const el of Object.values(sliders)) {
  el.addEventListener("input", () => renderSliderValues());
  el.addEventListener("change", () => void saveSettings());
}

for (const slider of Object.values(profileSliders)) {
  slider.addEventListener("input", () => {
    renderProfileSliderValues();
    syncProfileSelection();
  });
  slider.addEventListener("change", () => void handleProfileSliderChange());
}

$<HTMLButtonElement>("tune-reset").addEventListener("click", () => void resetControls());

void init();
