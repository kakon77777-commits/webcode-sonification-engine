import { resolveLayerMix } from "../audio/layer-mix.js";
import { resolveMappingProfile } from "../mapping/mapping-profile.js";
import { DEFAULT_TUNING } from "../shared/types.js";
import type {
  MappingProfile,
  ModeName,
  StyleName,
  TuningOptions,
  WsePreset,
  WsePresetEnvelope,
} from "../shared/types.js";

export const PRESET_STORAGE_KEY = "wse.presets.v1";
export const MAX_USER_PRESETS = 12;

const STYLE_NAMES: readonly StyleName[] = ["ambient", "piano", "electronic", "orchestral", "eastern"];
const MODE_NAMES: readonly ModeName[] = ["analytical", "musical", "hybrid"];
const STYLE_NAME_SET = new Set<string>(STYLE_NAMES);
const MODE_NAME_SET = new Set<string>(MODE_NAMES);
const PRESET_VERSION = 1;
const PRESET_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,31}$/;
const PRESET_LABEL_LIMIT = 48;
const LOCAL_ONLY_FORBIDDEN_KEYS = new Set([
  "url",
  "href",
  "query",
  "queryString",
  "queryParams",
  "search",
  "form",
  "formValue",
  "formValues",
  "text",
  "content",
  "html",
  "rawPage",
  "pageContent",
  "pageText",
  "dom",
  "pageFeatures",
  "domSnapshot",
  "tokens",
  "features",
  "score",
  "variation",
  "audio",
  "audioData",
  "audioBuffer",
  "wav",
  "midi",
  "renderedAudio",
  "blob",
].map((key) => key.toLowerCase()));

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, value as number));
}

function trimBoundedString(value: unknown, limit: number): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim().slice(0, limit);
  return trimmed.length > 0 ? trimmed : null;
}

function hasForbiddenLocalFields(value: Record<string, unknown>): boolean {
  return Object.keys(value).some((key) => LOCAL_ONLY_FORBIDDEN_KEYS.has(key.toLowerCase()));
}

function normalizeStyleName(value: unknown): StyleName | null {
  return typeof value === "string" && STYLE_NAME_SET.has(value) ? (value as StyleName) : null;
}

function normalizeModeName(value: unknown): ModeName | null {
  return typeof value === "string" && MODE_NAME_SET.has(value) ? (value as ModeName) : null;
}

function normalizeMappingProfile(value: unknown): MappingProfile | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (record.version !== PRESET_VERSION) {
    return null;
  }

  if (typeof record.id !== "string" || !PRESET_ID_PATTERN.test(record.id)) {
    return null;
  }

  if (record.label !== undefined && typeof record.label !== "string") {
    return null;
  }

  if (record.description !== undefined && typeof record.description !== "string") {
    return null;
  }

  if (
    record.characterBias !== undefined &&
    (!record.characterBias || typeof record.characterBias !== "object" || Array.isArray(record.characterBias))
  ) {
    return null;
  }

  const resolved = resolveMappingProfile(record);
  return resolved.id === record.id ? resolved : null;
}

export function resolveTuningOptions(value?: Partial<TuningOptions>): TuningOptions {
  return {
    tempoShift: clampNumber(value?.tempoShift, DEFAULT_TUNING.tempoShift, -30, 30),
    density: clampNumber(value?.density, DEFAULT_TUNING.density, 0.5, 1.5),
    brightness: clampNumber(value?.brightness, DEFAULT_TUNING.brightness, 0, 1),
    reverb: clampNumber(value?.reverb, DEFAULT_TUNING.reverb, 0, 1),
    mix: resolveLayerMix(value?.mix),
  };
}

function normalizePresetValue(value: unknown): WsePreset | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (record.version !== PRESET_VERSION || hasForbiddenLocalFields(record)) {
    return null;
  }

  const id = trimBoundedString(record.id, 32);
  const label = trimBoundedString(record.label, PRESET_LABEL_LIMIT);
  const style = normalizeStyleName(record.style);
  const mode = normalizeModeName(record.mode);
  const mappingProfile = normalizeMappingProfile(record.mappingProfile);

  if (!id || !PRESET_ID_PATTERN.test(id) || !label || !style || !mode || !mappingProfile) {
    return null;
  }

  const tuningInput =
    record.tuning && typeof record.tuning === "object" && !Array.isArray(record.tuning)
      ? (record.tuning as Partial<TuningOptions>)
      : undefined;

  return {
    version: PRESET_VERSION,
    id,
    label,
    mappingProfile,
    style,
    mode,
    tuning: resolveTuningOptions(tuningInput),
  };
}

export function normalizePreset(value: unknown): WsePreset | null {
  try {
    return normalizePresetValue(value);
  } catch {
    return null;
  }
}

function readPresetEnvelopeValue(value: unknown): WsePreset[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  const record = value as Record<string, unknown>;
  if (record.version !== PRESET_VERSION || !Array.isArray(record.presets)) {
    return [];
  }

  let presets: WsePreset[] = [];
  for (const entry of record.presets) {
    const normalized = normalizePreset(entry);
    if (normalized) {
      presets = upsertPreset(presets, normalized);
    }
  }
  return presets;
}

export function readPresetEnvelope(value: unknown): WsePreset[] {
  try {
    return readPresetEnvelopeValue(value);
  } catch {
    return [];
  }
}

export function upsertPreset(list: readonly WsePreset[], preset: WsePreset): WsePreset[] {
  const normalized = normalizePreset(preset);
  if (!normalized) {
    return [...list];
  }

  const next = list.filter((entry) => entry.id !== normalized.id);
  next.push(normalized);
  return next.slice(-MAX_USER_PRESETS);
}

export function removePreset(list: readonly WsePreset[], id: string): WsePreset[] {
  return list.filter((entry) => entry.id !== id);
}

export function serializePresetEnvelope(list: readonly WsePreset[]): WsePresetEnvelope {
  return {
    version: PRESET_VERSION,
    presets: list
      .map((entry) => normalizePreset(entry))
      .filter((entry): entry is WsePreset => entry !== null),
  };
}
