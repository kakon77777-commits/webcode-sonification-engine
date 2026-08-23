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

function createCharacterBias(values: Partial<Record<PageCharacter, number>> = {}): Record<PageCharacter, number> {
  return {
    content: normalizeBias(values.content),
    navigation: normalizeBias(values.navigation),
    media: normalizeBias(values.media),
    form: normalizeBias(values.form),
  };
}

function normalizeBias(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_BIAS;
  }

  const finiteValue = value as number;
  return Math.min(MAX_BIAS, Math.max(MIN_BIAS, finiteValue));
}

function clampText(value: string | undefined, limit: number): string {
  return (value ?? "").trim().slice(0, limit);
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
  if (input?.version !== undefined && input.version !== MAPPING_PROFILE_VERSION) {
    return cloneProfile(DEFAULT_MAPPING_PROFILE);
  }

  if (input?.id !== undefined && !ID_PATTERN.test(input.id)) {
    return cloneProfile(DEFAULT_MAPPING_PROFILE);
  }

  const id = input?.id ?? DEFAULT_MAPPING_PROFILE.id;
  const builtin = BUILTIN_BY_ID.get(id) ?? DEFAULT_MAPPING_PROFILE;

  return {
    version: MAPPING_PROFILE_VERSION,
    id,
    label: clampText(input?.label, LABEL_LIMIT) || builtin.label,
    description: clampText(input?.description, DESCRIPTION_LIMIT) || builtin.description,
    characterBias: createCharacterBias(input?.characterBias ?? builtin.characterBias),
  };
}

export function canonicalMappingProfile(profile: MappingProfile): string {
  const resolved = resolveMappingProfile(profile);
  const parts = CHARACTER_ORDER.map((character) => `"${character}":${resolved.characterBias[character]}`);
  return `{"version":${resolved.version},"characterBias":{${parts.join(",")}}}`;
}

export function mappingProfileHash(profile: MappingProfile): string {
  return hash64hex(canonicalMappingProfile(profile));
}
