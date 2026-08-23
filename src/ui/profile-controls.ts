import { BUILTIN_MAPPING_PROFILES, DEFAULT_MAPPING_PROFILE, resolveMappingProfile } from "../mapping/mapping-profile.js";
import { hash64hex } from "../mapping/deterministic-seed.js";
import type { MappingProfile, MappingProfileInput, PageCharacter, WsePreset } from "../shared/types.js";

export const PROFILE_CHARACTER_ORDER: readonly PageCharacter[] = ["content", "navigation", "media", "form"];
export const CUSTOM_PROFILE_VALUE = "custom";

export interface ProfileSliderValues extends Record<PageCharacter, number> {}

export interface ProfileChoice {
  value: string;
  label: string;
  kind: "builtin" | "preset" | "custom";
  profile: MappingProfile;
  preset?: WsePreset;
}

function clampSliderValue(value: unknown): number {
  const numeric = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(numeric)) {
    return 100;
  }

  return Math.min(125, Math.max(75, Math.round(numeric as number)));
}

function profileBiasKey(profile: Pick<MappingProfile, "characterBias">): string {
  return PROFILE_CHARACTER_ORDER.map((character) => profile.characterBias[character].toFixed(2)).join("|");
}

export function profileBiasFromValues(values: Partial<Record<PageCharacter, number | string>>): Record<PageCharacter, number> {
  return resolveMappingProfile({
    id: CUSTOM_PROFILE_VALUE,
    characterBias: {
      content: clampSliderValue(values.content) / 100,
      navigation: clampSliderValue(values.navigation) / 100,
      media: clampSliderValue(values.media) / 100,
      form: clampSliderValue(values.form) / 100,
    },
  }).characterBias;
}

export function profileBiasToSliderValues(profile?: MappingProfileInput): ProfileSliderValues {
  const resolved = resolveMappingProfile(profile);
  return {
    content: Math.round(resolved.characterBias.content * 100),
    navigation: Math.round(resolved.characterBias.navigation * 100),
    media: Math.round(resolved.characterBias.media * 100),
    form: Math.round(resolved.characterBias.form * 100),
  };
}

export function buildProfileChoices(presets: readonly WsePreset[]): ProfileChoice[] {
  const seenPresetIds = new Set<string>();
  const choices: ProfileChoice[] = BUILTIN_MAPPING_PROFILES.map((profile) => ({
    value: profile.id,
    label: profile.label,
    kind: "builtin",
    profile,
  }));

  for (const preset of presets) {
    if (seenPresetIds.has(preset.id)) {
      continue;
    }
    seenPresetIds.add(preset.id);
    choices.push({
      value: `preset:${preset.id}`,
      label: `Preset · ${preset.label}`,
      kind: "preset",
      profile: resolveMappingProfile(preset.mappingProfile),
      preset,
    });
  }

  choices.push({
    value: CUSTOM_PROFILE_VALUE,
    label: "Custom",
    kind: "custom",
    profile: DEFAULT_MAPPING_PROFILE,
  });

  return choices;
}

export function findProfileChoice(value: string, presets: readonly WsePreset[]): ProfileChoice | undefined {
  return buildProfileChoices(presets).find((choice) => choice.value === value);
}

export function markCustomProfileValue(
  selectedValue: string,
  sliderValues: Partial<Record<PageCharacter, number | string>>,
  presets: readonly WsePreset[]
): string {
  const selected = findProfileChoice(selectedValue, presets);
  if (!selected) {
    return CUSTOM_PROFILE_VALUE;
  }

  const currentBias = profileBiasFromValues(sliderValues);
  return profileBiasKey({ characterBias: currentBias }) === profileBiasKey(selected.profile)
    ? selectedValue
    : CUSTOM_PROFILE_VALUE;
}

export function trimPresetLabel(value: string): string {
  return value.trim().slice(0, 48);
}

export function readStorageOr<T>(read: () => T, fallback: T): T {
  try {
    return read();
  } catch {
    return fallback;
  }
}

export async function readStorageOrAsync<T>(read: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await read();
  } catch {
    return fallback;
  }
}

export function tryStorageWrite(write: () => void): boolean {
  try {
    write();
    return true;
  } catch {
    return false;
  }
}

export async function tryStorageWriteAsync(write: () => Promise<void>): Promise<boolean> {
  try {
    await write();
    return true;
  } catch {
    return false;
  }
}

export function presetIdFromLabel(label: string): string {
  const normalized = label
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);

  return normalized || `preset-${hash64hex(label.trim())}`;
}
