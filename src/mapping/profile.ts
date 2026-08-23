import type {
  ExplainItem,
  GenerateOptions,
  MappingProfile,
  MusicProfile,
  PageFeatures,
  PageFingerprint,
  PageCharacter,
  ScaleName,
  SectionPlan,
} from "../shared/types.js";
import { DEFAULT_TUNING } from "../shared/types.js";
import { clamp, mixSeed, mulberry32 } from "./deterministic-seed.js";
import { mappingProfileHash } from "./mapping-profile.js";
import { normalizeFeatures, type NormalizedFeatures } from "./normalize.js";
import { chooseOrchestration, type Orchestration } from "./orchestration.js";

/**
 * Layer A — Identity (§40): the site decides key, tempo and seed.
 * Every choice here is a pure function of (features, fingerprint, variation).
 */

const KEY_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export const SCALE_INTERVALS: Record<ScaleName, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
  minorPentatonic: [0, 3, 5, 7, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
};

/** Rule 6 (§69): AverageHue → Key. Falls back to seed when the page is colorless. */
export function deriveKey(norm: NormalizedFeatures, seed: number): number {
  if (norm.saturation < 0.02) return seed % 12;
  return Math.floor(12 * norm.hue) % 12;
}

/**
 * Scale choice, v0.2: seven consonant scales/modes on a lightness × saturation
 * matrix, so palette differences spread across a much wider harmonic space
 * (v0.1's three scales made most bright sites sound like siblings).
 */
export function deriveScale(norm: NormalizedFeatures, seed: number): ScaleName {
  const l = norm.lightness;
  const s = norm.saturation;
  if (l >= 0.62) {
    if (s >= 0.5) return "major";
    if (s >= 0.25) return "lydian";
    return "mixolydian";
  }
  if (l <= 0.38) {
    if (s >= 0.5) return "minor";
    if (s >= 0.25) return "dorian";
    return "minorPentatonic";
  }
  if (s >= 0.45) return "pentatonic";
  if (s >= 0.2) return seed % 2 === 0 ? "dorian" : "mixolydian";
  return seed % 2 === 0 ? "major" : "minor";
}

/**
 * BPM from Complexity(W) (§36), widened in v0.2: tag entropy feeds complexity
 * so real-world sites don't all collapse into the same tempo band, and the
 * user's tempo slider shifts the result.
 */
export function deriveBpm(
  norm: NormalizedFeatures,
  style: GenerateOptions["style"],
  tempoShift = 0
): number {
  const base = 58 + 96 * norm.complexity;
  const styleAdj = { ambient: -12, piano: -5, electronic: 14, orchestral: 0, eastern: -8 }[style];
  return Math.round(clamp(base + styleAdj + tempoShift, 52, 176));
}

/** §72: 30–90 s, scaled by page length and node count. */
export function deriveLengthSec(norm: NormalizedFeatures): number {
  return Math.round(clamp(30 + 40 * norm.pageLength + 20 * norm.nodes, 30, 90));
}

/**
 * §70–71 DOM → Form: header→Intro, main sections→A/B/A', footer→Outro.
 * Bar counts are proportioned to hit the target length.
 */
export function planSections(totalBars: number, hasHeader: boolean, hasFooter: boolean): SectionPlan[] {
  let intro = hasHeader ? Math.max(1, Math.round(totalBars * 0.12)) : 0;
  let outro = hasFooter ? Math.max(1, Math.round(totalBars * 0.12)) : 0;
  let body = totalBars - intro - outro;
  if (body < 3) {
    // Degenerate tiny scores: drop intro/outro, the body wins.
    intro = 0;
    outro = 0;
    body = totalBars;
  }
  const a = Math.max(1, Math.round(body * 0.4));
  const b = Math.max(1, Math.round(body * 0.3));
  const a2 = Math.max(1, body - a - b);
  const plans: SectionPlan[] = [];
  let cursor = 0;
  const push = (name: SectionPlan["name"], bars: number) => {
    if (bars > 0) {
      plans.push({ name, startBar: cursor, bars });
      cursor += bars;
    }
  };
  push("intro", intro);
  push("A", a);
  push("B", b);
  push("A2", a2);
  push("outro", outro);
  return plans;
}

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

const CHARACTER_LABEL: Record<string, string> = {
  content: "content-led (text & articles)",
  navigation: "navigation-led (links & buttons)",
  media: "media-led (images & visuals)",
  form: "form-led (inputs & controls)",
};

const CHARACTER_ORDER: readonly PageCharacter[] = ["content", "navigation", "media", "form"];

function formatBiasPct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function describeMappingProfile(profile: MappingProfile): string {
  return CHARACTER_ORDER.map((character) => `${character} ${formatBiasPct(profile.characterBias[character])}`).join(", ");
}

/** Explain Mode (§50): why does this page sound like this? */
export function buildExplain(
  f: PageFeatures,
  norm: NormalizedFeatures,
  profile: Pick<MusicProfile, "key" | "keyName" | "scale" | "bpm" | "lengthSec">,
  orchestration: Orchestration,
  mappingProfile: MappingProfile
): ExplainItem[] {
  const items: ExplainItem[] = [
    {
      feature: "Mapping profile",
      value: mappingProfile.label,
      effect: describeMappingProfile(mappingProfile),
    },
    {
      feature: "Structure character",
      value: CHARACTER_LABEL[orchestration.character],
      effect: `lead voice: ${orchestration.melody}, arpeggio voice: ${orchestration.arp}`,
    },
    {
      feature: "Tag diversity",
      value: pct(norm.entropy),
      effect: `feeds complexity ${pct(norm.complexity)} → ${profile.bpm} BPM`,
    },
    {
      feature: "Node count",
      value: String(f.dom.totalNodes),
      effect: `piece density and tempo base`,
    },
    {
      feature: "Average hue",
      value: `${Math.round(f.style.avgHue)}°`,
      effect: `key ${profile.keyName}`,
    },
    {
      feature: "Average lightness",
      value: pct(norm.lightness),
      effect:
        norm.lightness >= 0.62
          ? "bright palette → major scale, brighter timbre"
          : norm.lightness <= 0.38
            ? "dark palette → minor scale, darker timbre"
            : `mid palette → ${profile.scale} scale`,
    },
    {
      feature: "DOM max depth",
      value: String(f.dom.maxDepth),
      effect: `pitch register width ${12 + Math.round(24 * norm.depth)} semitones`,
    },
    {
      feature: "Link density",
      value: `${f.dom.linkCount} links`,
      effect:
        norm.linkDensity > 0.5
          ? "high link density → busy arpeggios"
          : norm.linkDensity > 0.15
            ? "moderate link density → light arpeggios"
            : "few links → sparse arpeggios",
    },
    {
      feature: "Images",
      value: String(f.dom.imageCount),
      effect: norm.imageDensity > 0.1 ? "bell accents enabled" : "few bell accents",
    },
    {
      feature: "Buttons",
      value: String(f.dom.buttonCount),
      effect: norm.buttonDensity > 0.1 ? "denser percussion layer" : "sparse percussion",
    },
    {
      feature: "Page height",
      value: `${f.geometry.pageHeight}px`,
      effect: `piece length ${profile.lengthSec}s`,
    },
    {
      feature: "Sections",
      value: `${f.dom.sectionCount} semantic sections`,
      effect: "song form Intro–A–B–A'–Outro from header/main/footer",
    },
    {
      feature: "Text length",
      value: `${f.dom.textLength} chars`,
      effect: `phrase length ${3 + Math.round(4 * norm.text)} notes`,
    },
  ];
  return items;
}

export function deriveProfile(
  features: PageFeatures,
  fingerprint: PageFingerprint,
  options: GenerateOptions,
  mappingProfile: MappingProfile
): MusicProfile {
  const norm = normalizeFeatures(features);
  const tuning = options.tuning ?? DEFAULT_TUNING;
  const seed = mixSeed(fingerprint.seed, options.variation);
  const rng = mulberry32(seed);
  rng(); // burn one draw so profile and score streams diverge

  const key = deriveKey(norm, seed);
  const scale = deriveScale(norm, seed);
  const bpm = deriveBpm(norm, options.style, tuning.tempoShift);
  const lengthSec = deriveLengthSec(norm);
  const orchestration = chooseOrchestration(norm, options.style, mappingProfile);

  const barDur = (60 / bpm) * 4;
  const barCount = Math.max(4, Math.round(lengthSec / barDur));
  const hist = features.dom.tagHistogram;
  const sections = planSections(barCount, (hist["header"] ?? 0) > 0, (hist["footer"] ?? 0) > 0);
  const actualBars = sections.reduce((a, s) => a + s.bars, 0);

  const partial = {
    key,
    keyName: `${KEY_NAMES[key]} ${scale}`,
    scale,
    bpm,
    lengthSec: Math.round(actualBars * barDur),
  };

  return {
    ...partial,
    style: options.style,
    mode: options.mode,
    barCount: actualBars,
    sections,
    character: orchestration.character,
    mappingProfileId: mappingProfile.id,
    mappingProfileLabel: mappingProfile.label,
    mappingProfileHash: mappingProfileHash(mappingProfile),
    explain: buildExplain(features, norm, partial, orchestration, mappingProfile),
  };
}
