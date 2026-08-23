import type {
  MappingProfile,
  MappingProfileInput,
  MappingProfileVersion,
  PageCharacter,
} from "../shared/types.js";
import { hash64hex } from "./deterministic-seed.js";

const MAPPING_PROFILE_VERSION: MappingProfileVersion = 1;
const CHARACTER_ORDER: readonly PageCharacter[] = ["content", "navigation", "media", "form"];
const DEFAULT_BIAS = 1;
const MIN_BIAS = 0.75;
const MAX_BIAS = 1.25;
const ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,31}$/;
const LABEL_LIMIT = 48;
const DESCRIPTION_LIMIT = 160;

function freezeProfile(profile: MappingProfile): Readonly<MappingProfile> {
  Object.freeze(profile.characterBias);
  return Object.freeze(profile);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function createCharacterBias(values: unknown = {}): Record<PageCharacter, number> {
  const record = isRecord(values) ? values : {};
  return {
    content: normalizeBias(record.content),
    navigation: normalizeBias(record.navigation),
    media: normalizeBias(record.media),
    form: normalizeBias(record.form),
  };
}

function normalizeBias(value: unknown): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_BIAS;
  }

  const finiteValue = value as number;
  return Math.min(MAX_BIAS, Math.max(MIN_BIAS, finiteValue));
}

function resolveDisplayText(value: unknown, fallback: string, limit: number): string {
  if (value === undefined || typeof value !== "string") {
    return fallback;
  }

  return value.trim().slice(0, limit);
}

function profileTemplate(
  id: string,
  label: string,
  description: string,
  characterBias: Partial<Record<PageCharacter, number>>
): MappingProfile {
  return {
    version: MAPPING_PROFILE_VERSION,
    id,
    label,
    description,
    characterBias: createCharacterBias(characterBias),
  };
}

export const DEFAULT_MAPPING_PROFILE: MappingProfile = freezeProfile(
  profileTemplate("balanced", "Balanced", "Preserve the current structural mapping.", {})
) as MappingProfile;

export const BUILTIN_MAPPING_PROFILES: readonly MappingProfile[] = Object.freeze([
  DEFAULT_MAPPING_PROFILE,
  freezeProfile(
    profileTemplate(
      "content-forward",
      "Content-forward",
      "Emphasize text and article structure.",
      { content: 1.25, navigation: 0.85, media: 0.85, form: 0.85 }
    )
  ),
  freezeProfile(
    profileTemplate(
      "navigation-forward",
      "Navigation-forward",
      "Emphasize link and button structure.",
      { content: 0.85, navigation: 1.25, media: 0.85, form: 0.85 }
    )
  ),
  freezeProfile(
    profileTemplate("media-forward", "Media-forward", "Emphasize image and visual structure.", {
      content: 0.85,
      navigation: 0.85,
      media: 1.25,
      form: 0.85,
    })
  ),
  freezeProfile(
    profileTemplate("form-forward", "Form-forward", "Emphasize input and control structure.", {
      content: 0.85,
      navigation: 0.85,
      media: 0.85,
      form: 1.25,
    })
  ),
]);

const BUILTIN_BY_ID = new Map(BUILTIN_MAPPING_PROFILES.map((profile) => [profile.id, profile] as const));

function cloneProfile(profile: MappingProfile): MappingProfile {
  return {
    version: profile.version,
    id: profile.id,
    label: profile.label,
    description: profile.description,
    characterBias: { ...profile.characterBias },
  };
}

export function resolveMappingProfile(input?: MappingProfileInput): MappingProfile {
  try {
    if (input === undefined) {
      return cloneProfile(DEFAULT_MAPPING_PROFILE);
    }

    if (!isRecord(input)) {
      return cloneProfile(DEFAULT_MAPPING_PROFILE);
    }

    if (input.version !== undefined && input.version !== MAPPING_PROFILE_VERSION) {
      return cloneProfile(DEFAULT_MAPPING_PROFILE);
    }

    if (input.id !== undefined && (typeof input.id !== "string" || !ID_PATTERN.test(input.id))) {
      return cloneProfile(DEFAULT_MAPPING_PROFILE);
    }

    const id = typeof input.id === "string" ? input.id : DEFAULT_MAPPING_PROFILE.id;
    const builtin = BUILTIN_BY_ID.get(id) ?? DEFAULT_MAPPING_PROFILE;
    const characterBias =
      input.characterBias === undefined || !isRecord(input.characterBias)
        ? builtin.characterBias
        : input.characterBias;

    return {
      version: MAPPING_PROFILE_VERSION,
      id,
      label: resolveDisplayText(input.label, builtin.label, LABEL_LIMIT),
      description: resolveDisplayText(input.description, builtin.description, DESCRIPTION_LIMIT),
      characterBias: createCharacterBias(characterBias),
    };
  } catch {
    return cloneProfile(DEFAULT_MAPPING_PROFILE);
  }
}

export function canonicalMappingProfile(profile: MappingProfile): string {
  const resolved = resolveMappingProfile(profile);
  const parts = CHARACTER_ORDER.map((character) => `"${character}":${resolved.characterBias[character]}`);
  return `{"version":${resolved.version},"characterBias":{${parts.join(",")}}}`;
}

export function mappingProfileHash(profile: MappingProfile): string {
  return hash64hex(canonicalMappingProfile(profile));
}
