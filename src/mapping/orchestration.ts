import type { InstrumentName, MappingProfile, PageCharacter, StyleName } from "../shared/types.js";
import { DEFAULT_MAPPING_PROFILE } from "./mapping-profile.js";
import type { NormalizedFeatures } from "./normalize.js";

/**
 * Orchestra by Web Architecture (§17).
 *
 * v0.1 fixed each style's instruments, so every site sounded like siblings.
 * v0.2: the style picks a *palette*, but the page's dominant structural family
 * (content / navigation / media / form) picks the actual voices from it —
 * a text-heavy blog and a button-farm dashboard get different lead instruments
 * even in the same style. Deterministic: no RNG, features only.
 */

export function detectCharacter(
  norm: NormalizedFeatures,
  profile: MappingProfile = DEFAULT_MAPPING_PROFILE
): PageCharacter {
  const entries: Array<[PageCharacter, number]> = [
    ["content", norm.contentLean * profile.characterBias.content],
    ["navigation", norm.navLean * profile.characterBias.navigation],
    ["media", norm.mediaLean * profile.characterBias.media],
    ["form", norm.formLean * profile.characterBias.form],
  ];
  // Stable priority on ties: content > navigation > media > form.
  let best = entries[0];
  for (const e of entries.slice(1)) {
    if (e[1] > best[1] + 1e-9) best = e;
  }
  return best[0];
}

export interface Orchestration {
  melody: InstrumentName;
  arp: InstrumentName;
  bell: InstrumentName;
  character: PageCharacter;
}

type Pick4 = Record<PageCharacter, InstrumentName>;

interface StylePalette {
  melody: Pick4;
  arp: Pick4;
  bell: Pick4;
}

const PALETTES: Record<StyleName, StylePalette> = {
  ambient: {
    melody: { content: "epiano", navigation: "xiao", media: "flute", form: "choir" },
    arp: { content: "pluck", navigation: "pluck", media: "bell", form: "mallet" },
    bell: { content: "bell", navigation: "mallet", media: "bell", form: "bell" },
  },
  piano: {
    melody: { content: "piano", navigation: "guitar", media: "clarinet", form: "piano" },
    arp: { content: "piano", navigation: "guitar", media: "piano", form: "piano" },
    bell: { content: "mallet", navigation: "mallet", media: "bell", form: "mallet" },
  },
  electronic: {
    melody: { content: "lead", navigation: "pluck", media: "epiano", form: "lead" },
    arp: { content: "pluck", navigation: "pluck", media: "bell", form: "pluck" },
    bell: { content: "bell", navigation: "bell", media: "bell", form: "mallet" },
  },
  orchestral: {
    melody: { content: "strings", navigation: "flute", media: "brass", form: "strings" },
    arp: { content: "pluck", navigation: "pluck", media: "marimba", form: "pluck" },
    bell: { content: "marimba", navigation: "mallet", media: "bell", form: "mallet" },
  },
  eastern: {
    melody: { content: "xiao", navigation: "pluck", media: "flute", form: "koto" },
    arp: { content: "pluck", navigation: "koto", media: "bell", form: "pluck" },
    bell: { content: "bell", navigation: "mallet", media: "bell", form: "bell" },
  },
};

export function chooseOrchestration(
  norm: NormalizedFeatures,
  style: StyleName,
  profile: MappingProfile = DEFAULT_MAPPING_PROFILE
): Orchestration {
  const character = detectCharacter(norm, profile);
  const palette = PALETTES[style];
  return {
    melody: palette.melody[character],
    arp: palette.arp[character],
    bell: palette.bell[character],
    character,
  };
}

/**
 * Euclidean rhythm (Bjorklund): distribute k hits over n slots as evenly as
 * possible, rotated per site. Gives each page a recognizable groove signature
 * instead of uniform per-slot probability.
 */
export function euclid(k: number, n: number, rotation = 0): boolean[] {
  const kk = Math.max(0, Math.min(n, Math.round(k)));
  const out: boolean[] = new Array(n).fill(false);
  if (kk === 0) return out;
  for (let i = 0; i < n; i++) {
    // Bresenham formulation of the Euclidean rhythm.
    out[(i + rotation) % n] = ((i * kk) % n) < kk;
  }
  return out;
}
