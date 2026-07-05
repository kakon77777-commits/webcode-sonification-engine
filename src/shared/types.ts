/**
 * WebCode Sonification Engine — shared types.
 *
 * Pipeline: W → F(W) → Z → S_W → Θ → Q → A
 * (Webpage → Features → Normalized → Fingerprint → Profile → Score → Audio)
 */

export interface DomFeatures {
  totalNodes: number;
  maxDepth: number;
  avgDepth: number;
  /** Lowercased tag → count. Capped to 64 distinct keys; overflow folded into "other". */
  tagHistogram: Record<string, number>;
  linkCount: number;
  imageCount: number;
  buttonCount: number;
  formCount: number;
  sectionCount: number;
  headingCount: number;
  /** Character count of visible text nodes only. Never includes form values. */
  textLength: number;
  wordCount: number;
  /** True when traversal hit the sampling cap and stopped early. */
  truncated: boolean;
}

export interface StyleFeatures {
  sampledCount: number;
  /** Circular mean hue in degrees [0, 360). */
  avgHue: number;
  /** [0, 1] */
  avgSaturation: number;
  /** [0, 1] */
  avgLightness: number;
  /** px */
  avgFontSize: number;
  fixedCount: number;
  absoluteCount: number;
}

export interface GeometryFeatures {
  viewportWidth: number;
  viewportHeight: number;
  pageHeight: number;
  avgElementArea: number;
  /** 8 buckets of element-center x positions, normalized fractions summing ~1. */
  horizontalDistribution: number[];
}

export interface ScriptFeatures {
  scriptCount: number;
  inlineScriptCount: number;
  externalScriptCount: number;
  moduleScriptCount: number;
  scriptSrcDomainCount: number;
}

export interface PageFeatures {
  version: 1;
  /** Canonical URL: origin + pathname only. Query and hash are stripped for privacy. */
  url: string;
  dom: DomFeatures;
  style: StyleFeatures;
  geometry: GeometryFeatures;
  script: ScriptFeatures;
}

export interface PageFingerprint {
  version: 1;
  /** 16 hex chars derived from canonical URL + structural stats. */
  hash: string;
  /** uint32 deterministic seed. */
  seed: number;
}

export type ScaleName =
  | "major"
  | "minor"
  | "pentatonic"
  | "minorPentatonic"
  | "dorian"
  | "lydian"
  | "mixolydian";
export type StyleName = "ambient" | "piano" | "electronic" | "orchestral" | "eastern";
export type ModeName = "analytical" | "musical" | "hybrid";

export type InstrumentName =
  | "pad"
  | "lowpad"
  | "strings"
  | "piano"
  | "epiano"
  | "pluck"
  | "bell"
  | "mallet"
  | "bass"
  | "brass"
  | "lead"
  | "flute"
  | "xiao"
  | "guitar"
  | "kick"
  | "hihat"
  | "perc"
  | "taiko";

/** Which structural family dominates the page — drives orchestration (§17). */
export type PageCharacter = "content" | "navigation" | "media" | "form";

/** User-adjustable mapping tuning (popup sliders). Part of Θ, fully deterministic. */
export interface TuningOptions {
  /** BPM offset, −30…+30. */
  tempoShift: number;
  /** Note-density multiplier, 0.5…1.5. */
  density: number;
  /** Timbre brightness, 0…1 (0.5 = neutral). */
  brightness: number;
  /** Reverb amount, 0…1 (0.5 = neutral). */
  reverb: number;
}

export const DEFAULT_TUNING: TuningOptions = {
  tempoShift: 0,
  density: 1,
  brightness: 0.5,
  reverb: 0.5,
};

export type SectionName = "intro" | "A" | "B" | "A2" | "outro";

export interface SectionPlan {
  name: SectionName;
  startBar: number;
  bars: number;
}

export interface ExplainItem {
  feature: string;
  value: string;
  effect: string;
}

export interface MusicProfile {
  /** Pitch class 0–11 (0 = C). */
  key: number;
  keyName: string;
  scale: ScaleName;
  bpm: number;
  style: StyleName;
  mode: ModeName;
  lengthSec: number;
  barCount: number;
  sections: SectionPlan[];
  /** Dominant structural family of the page — decides the orchestration lean. */
  character: PageCharacter;
  /** Human-readable mapping explanations ("Why does this page sound like this?"). */
  explain: ExplainItem[];
}

export interface NoteEvent {
  /** Seconds from score start. */
  time: number;
  /** Seconds. */
  duration: number;
  /** MIDI note number. For unpitched percussion this still guides synthesis. */
  pitch: number;
  /** (0, 1] */
  velocity: number;
  instrument: InstrumentName;
  /** [-1, 1] */
  pan: number;
}

export interface Score {
  version: 1;
  fingerprint: PageFingerprint;
  variation: number;
  profile: MusicProfile;
  events: NoteEvent[];
}

export interface GenerateOptions {
  style: StyleName;
  mode: ModeName;
  /** Increments on "Regenerate": H(PageFingerprint, VariationIndex). */
  variation: number;
  /** Slider tuning; defaults to DEFAULT_TUNING when omitted. */
  tuning?: TuningOptions;
}

export const WSE_VERSION = "0.2.0";
