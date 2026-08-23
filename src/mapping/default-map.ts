import type {
  GenerateOptions,
  InstrumentName,
  ModeName,
  MusicProfile,
  NoteEvent,
  PageFeatures,
  PageFingerprint,
  ScaleName,
  Score,
  SectionPlan,
  StyleName,
} from "../shared/types.js";
import { DEFAULT_TUNING } from "../shared/types.js";
import { mixSeed, mulberry32, pick, randInt, clamp, type Rng } from "./deterministic-seed.js";
import { resolveMappingProfile } from "./mapping-profile.js";
import { normalizeFeatures } from "./normalize.js";
import { deriveProfile } from "./profile.js";
import { chooseOrchestration, euclid } from "./orchestration.js";
import { clampMidi, degreeToMidi, quantizePitch, quantizeTime } from "./quantize.js";
import { applyLimits } from "./limits.js";
import { arrangeMusically } from "./arrangement.js";

/**
 * Θ_default — the v0.2 mapping (§16, §17, §47, §69).
 *
 * Layer B (Structure): DOM decides phrases, sections and density.
 * v0.2 differentiation upgrades: the page's structural character picks the
 * voices inside each style palette, Euclidean rhythm signatures replace
 * uniform per-slot probability, seven scales, wider tempo spread, and user
 * tuning sliders (tempo / density / brightness / reverb) join Θ.
 *
 * Still a pure function of (features, fingerprint, variation, style, mode,
 * tuning): all randomness flows from one mulberry32 stream in a fixed draw
 * order (§81).
 */

const PROGRESSIONS: Record<ScaleName, number[][]> = {
  // Scale-degree roots, one chord per bar, cycled.
  major: [
    [0, 4, 5, 3], // I V vi IV
    [0, 3, 4, 3], // I IV V IV
    [5, 3, 0, 4], // vi IV I V
    [0, 5, 3, 4], // I vi IV V
  ],
  minor: [
    [0, 5, 2, 6], // i VI III VII
    [0, 3, 4, 0], // i iv v i
    [0, 6, 5, 6], // i VII VI VII
    [0, 3, 6, 4], // i iv VII v
  ],
  dorian: [
    [0, 3, 0, 6], // i IV i VII — the classic dorian vamp
    [0, 3, 4, 3],
    [0, 6, 3, 4],
  ],
  lydian: [
    [0, 1, 0, 4], // I II I V — floating lydian motion
    [0, 4, 5, 1],
    [0, 1, 4, 0],
  ],
  mixolydian: [
    [0, 6, 3, 0], // I bVII IV I
    [0, 3, 6, 4],
    [0, 6, 0, 4],
  ],
  // Degrees in pentatonic space: stacked thirds become open, quartal voicings.
  pentatonic: [
    [0, 3, 4, 1],
    [0, 2, 3, 1],
    [0, 4, 3, 1],
  ],
  minorPentatonic: [
    [0, 3, 4, 1],
    [0, 2, 4, 3],
    [0, 4, 0, 3],
  ],
};

/** Instrument roles per style profile (§47–48): a profile changes articulation, register and density, not just timbre. */
interface StyleConfig {
  melody: InstrumentName;
  pad: InstrumentName;
  bass: InstrumentName;
  arp: InstrumentName;
  bell: InstrumentName;
  melodyOctave: number;
  padOctave: number;
  bassOctave: number;
  arpOctave: number;
  durScale: number; // articulation: >1 legato, <1 staccato
  melodyDensity: number;
  perc: "none" | "sparse" | "drive" | "cinematic" | "eastern";
}

const STYLES: Record<StyleName, StyleConfig> = {
  ambient: {
    melody: "epiano",
    pad: "pad",
    bass: "lowpad",
    arp: "pluck",
    bell: "bell",
    melodyOctave: 4,
    padOctave: 3,
    bassOctave: 2,
    arpOctave: 5,
    durScale: 1.6,
    melodyDensity: 0.6,
    perc: "sparse",
  },
  piano: {
    melody: "piano",
    pad: "strings",
    bass: "piano",
    arp: "piano",
    bell: "mallet",
    melodyOctave: 4,
    padOctave: 3,
    bassOctave: 2,
    arpOctave: 5,
    durScale: 1.0,
    melodyDensity: 1.0,
    perc: "none",
  },
  electronic: {
    melody: "lead",
    pad: "pad",
    bass: "subbass",
    arp: "pluck",
    bell: "bell",
    melodyOctave: 4,
    padOctave: 3,
    bassOctave: 1,
    arpOctave: 5,
    durScale: 0.8,
    melodyDensity: 1.1,
    perc: "drive",
  },
  orchestral: {
    melody: "strings",
    pad: "lowpad",
    bass: "bass",
    arp: "pluck",
    bell: "mallet",
    melodyOctave: 4,
    padOctave: 2,
    bassOctave: 1,
    arpOctave: 5,
    durScale: 1.2,
    melodyDensity: 0.9,
    perc: "cinematic",
  },
  eastern: {
    melody: "xiao",
    pad: "strings",
    bass: "bass",
    arp: "pluck",
    bell: "bell",
    melodyOctave: 4,
    padOctave: 3,
    bassOctave: 2,
    arpOctave: 5,
    durScale: 1.3,
    melodyDensity: 0.85,
    perc: "eastern",
  },
};

const SECTION_GAIN: Record<SectionPlan["name"], number> = {
  intro: 0.8,
  A: 1.0,
  B: 0.95,
  A2: 1.05,
  outro: 0.75,
};

/** Breathy winds get grace-note ornaments; keys/strings do not. */
const ORNAMENTED: ReadonlySet<InstrumentName> = new Set(["xiao", "flute"]);

interface Motif {
  /** Sorted eighth-note slots within a 2-bar window (0–15). */
  slots: number[];
  /** Scale-degree offsets relative to the current chord root. */
  degrees: number[];
}

function makeMotif(rng: Rng, phraseLen: number, maxDeg: number): Motif {
  const slotPool = [0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14];
  const slots = new Set<number>([0]);
  while (slots.size < phraseLen) slots.add(pick(rng, slotPool));
  const degrees: number[] = [];
  let deg = randInt(rng, 3);
  for (let i = 0; i < phraseLen; i++) {
    degrees.push(deg);
    const step = pick(rng, [-2, -1, -1, 0, 1, 1, 2, 3]);
    deg = clamp(deg + step, -2, maxDeg);
  }
  return { slots: [...slots].sort((a, b) => a - b), degrees };
}

function round6(x: number): number {
  return Math.round(x * 1e6) / 1e6;
}

function finalizeScoreEvents(
  events: NoteEvent[],
  profile: MusicProfile,
  mode: ModeName
): NoteEvent[] {
  const limited = applyLimits(events);
  return mode === "musical" ? applyLimits(arrangeMusically(limited, profile)) : limited;
}

export function generateScore(
  features: PageFeatures,
  fingerprint: PageFingerprint,
  options: GenerateOptions
): Score {
  const mappingProfile = resolveMappingProfile(options.mappingProfile);
  const profile = deriveProfile(features, fingerprint, options, mappingProfile);
  const norm = normalizeFeatures(features);
  const tuning = options.tuning ?? DEFAULT_TUNING;
  const seed = mixSeed(fingerprint.seed, options.variation);
  const rng = mulberry32(seed);
  const cfg = STYLES[options.style];
  const { key, scale, bpm } = profile;
  const mode = options.mode;

  // §17: the page's structural character picks the actual voices.
  const baselineOrch = chooseOrchestration(norm, options.style);
  const orch = chooseOrchestration(norm, options.style, mappingProfile);
  const melodyInstr = orch.melody;
  const arpInstr = orch.arp;
  const bellInstr = orch.bell;

  const beat = 60 / bpm;
  const barDur = beat * 4;
  const events: NoteEvent[] = [];

  const progression = pick(rng, PROGRESSIONS[scale]);
  const chordRootAtBar = (bar: number) => progression[bar % progression.length];

  // Phrase length from text statistics (§24), register width from DOM depth (§14).
  const phraseLen = 3 + Math.round(4 * norm.text);
  const maxDeg = 2 + Math.round(6 * norm.depth);
  const motif = makeMotif(rng, phraseLen, maxDeg);

  // Analytical mode: pitch material comes straight from structure, chromatic,
  // bypassing the harmonic guardrail for the melody line (§6.1).
  const analyticalSteps: number[] = [];
  if (mode === "analytical") {
    const tags = Object.keys(features.dom.tagHistogram).sort();
    for (const t of tags.slice(0, 16)) {
      analyticalSteps.push(features.dom.tagHistogram[t] % 24);
    }
    if (analyticalSteps.length === 0) analyticalSteps.push(0);
  }

  // Layer gates from structure (Rules 3–5, §69), scaled by the density slider.
  const dens = clamp(tuning.density, 0.5, 1.5);
  const modeDensity = (mode === "musical" ? 0.85 : 1.0) * dens;
  const arpGate = norm.linkDensity;
  const bellChance = clamp(
    (norm.imageDensity * 1.2 + (options.style === "ambient" ? 0.15 : 0)) * dens,
    0,
    0.8
  );
  const percBoost = norm.buttonDensity;

  const lean = norm.horizontalLean;
  const baseVel = 0.45 + 0.25 * norm.lightness;

  // Per-site groove signatures: Euclidean patterns rotated by the seed.
  const kickPattern = euclid(2 + Math.round(2 * percBoost), 8, seed % 8);
  const hatPattern = euclid(Math.round((3 + 4 * percBoost) * dens), 8, (seed >> 3) % 8);
  const taikoPattern = euclid(2 + Math.round(3 * percBoost), 8, seed % 8);
  const sparsePattern = euclid(1 + Math.round(2 * percBoost), 8, (seed >> 5) % 8);

  let melodyCounter = 0;

  for (const section of profile.sections) {
    const sGain = SECTION_GAIN[section.name];
    const isIntro = section.name === "intro";
    const isOutro = section.name === "outro";
    const isBody = !isIntro && !isOutro;

    for (let b = 0; b < section.bars; b++) {
      const bar = section.startBar + b;
      const barStart = bar * barDur;
      const rootDeg = chordRootAtBar(bar);

      // ---- Pad: one chord per bar, wide stereo (root center, upper voices L/R).
      const padSpread = [0, -0.35, 0.35];
      for (let v = 0; v < 3; v++) {
        events.push({
          time: barStart,
          duration: barDur * clamp(cfg.durScale, 0.9, 2.0),
          pitch: degreeToMidi(key, scale, rootDeg + v * 2, cfg.padOctave),
          velocity: (0.22 + 0.18 * norm.lightness) * sGain,
          instrument: cfg.pad,
          pan: padSpread[v],
          layer: "pad",
        });
      }

      // ---- Bass: root on beat 1; passing note on beat 3 with structure-driven probability.
      events.push({
        time: barStart,
        duration: barDur * 0.9 * cfg.durScale,
        pitch: degreeToMidi(key, scale, rootDeg, cfg.bassOctave),
        velocity: (0.5 + 0.2 * norm.complexity) * sGain,
        instrument: cfg.bass,
        pan: 0,
        layer: "bass",
      });
      if (rng() < (0.25 + 0.4 * percBoost) * dens && !isOutro) {
        events.push({
          time: barStart + 2 * beat,
          duration: beat * 1.5 * cfg.durScale,
          pitch: degreeToMidi(key, scale, rootDeg + (rng() < 0.5 ? 4 : 2), cfg.bassOctave),
          velocity: (0.4 + 0.15 * norm.complexity) * sGain,
          instrument: cfg.bass,
          pan: 0,
          layer: "bass",
        });
      }

      // ---- Melody: motif over 2-bar windows in body sections; A' adds a parallel-third harmony.
      if (isBody && bar % 2 === 0) {
        const windowStart = barStart;
        const transpose = chordRootAtBar(bar);
        const retrograde = section.name === "B";
        for (let i = 0; i < motif.slots.length; i++) {
          if (rng() >= cfg.melodyDensity * modeDensity) continue;
          const slot = motif.slots[i];
          const degIdx = retrograde ? motif.degrees.length - 1 - i : i;
          const t = windowStart + slot * (beat / 2);
          const nextSlot = motif.slots[i + 1] ?? motif.slots[i] + 4;
          const durBeats = clamp(((nextSlot - slot) * 0.5 - 0.05) * cfg.durScale, 0.2, 4);
          let pitch: number;
          if (mode === "analytical") {
            const stepVal = analyticalSteps[melodyCounter % analyticalSteps.length];
            pitch = 12 * (cfg.melodyOctave + 1) + key + (stepVal % (12 + Math.round(24 * norm.depth)));
          } else {
            pitch = degreeToMidi(key, scale, transpose + motif.degrees[degIdx], cfg.melodyOctave);
          }
          melodyCounter++;
          const accent = i === 0 ? 0.12 : 0;
          events.push({
            time: t,
            duration: durBeats * beat,
            pitch,
            velocity: clamp((baseVel + accent) * sGain, 0.05, 1),
            instrument: melodyInstr,
            pan: clamp(lean * 0.2, -0.4, 0.4),
            layer: "melody",
          });
          // Grace-note ornament for breathy winds (蕭/笛): one sixteenth before,
          // one scale degree above, quiet — a signature of the eastern voices.
          if (ORNAMENTED.has(baselineOrch.melody) && mode !== "analytical" && t >= beat / 4) {
            if (rng() < 0.3) {
              events.push({
                time: t - beat / 4,
                duration: 0.12,
                pitch: degreeToMidi(key, scale, transpose + motif.degrees[degIdx] + 1, cfg.melodyOctave),
                velocity: clamp((baseVel - 0.2) * sGain, 0.05, 1),
                instrument: melodyInstr,
                pan: clamp(lean * 0.2, -0.4, 0.4),
                layer: "melody",
              });
            }
          }
          if (section.name === "A2" && mode !== "analytical" && i % 2 === 0) {
            events.push({
              time: t,
              duration: durBeats * beat,
              pitch: degreeToMidi(key, scale, transpose + motif.degrees[degIdx] + 2, cfg.melodyOctave),
              velocity: clamp((baseVel - 0.15) * sGain, 0.05, 1),
              instrument: melodyInstr,
              pan: clamp(lean * 0.2 + 0.2, -0.6, 0.6),
              layer: "melody",
            });
          }
        }
      }

      // ---- Outro: resolve on the tonic, once, held long.
      if (isOutro && b === section.bars - 1) {
        events.push({
          time: barStart,
          duration: barDur * 1.5,
          pitch: degreeToMidi(key, scale, 0, cfg.melodyOctave),
          velocity: 0.5 * sGain,
          instrument: melodyInstr,
          pan: 0,
          layer: "melody",
        });
      }

      // ---- Arpeggio layer: link density drives busyness (Rule 3) through a
      // Euclidean base pattern (the site's pluck signature) plus light jitter.
      if (arpGate > 0.08 && !isOutro) {
        const sixteenth = options.style === "electronic" && arpGate > 0.5;
        const slots = sixteenth ? 16 : 8;
        const stepDur = barDur / slots;
        const arpDegrees = [0, 2, 4, 2 + 5]; // root, 3rd, 5th, octave-ish colour
        const kArp = Math.round(slots * clamp(0.2 + arpGate * 0.6, 0, 0.85) * (isIntro ? 0.5 : 1) * modeDensity);
        const arpPattern = euclid(kArp, slots, (seed >> 7) % slots);
        for (let s = 0; s < slots; s++) {
          const jitter = rng(); // always draw — keeps the stream order fixed
          if (!arpPattern[s] && jitter >= 0.1 * dens) continue;
          events.push({
            time: barStart + s * stepDur,
            duration: stepDur * 0.9 * cfg.durScale,
            pitch: degreeToMidi(key, scale, rootDeg + arpDegrees[s % arpDegrees.length], cfg.arpOctave),
            velocity: clamp((0.28 + 0.2 * arpGate) * sGain, 0.05, 1),
            instrument: arpInstr,
            pan: clamp(lean * 0.6 + (s % 2 === 0 ? -0.15 : 0.15), -1, 1),
            layer: "arp",
          });
        }
      }

      // ---- Bell accents: image density (Rule 4).
      if (rng() < bellChance) {
        const onBeat3 = rng() < 0.5;
        events.push({
          time: barStart + (onBeat3 ? 2 * beat : 0),
          duration: 2 * beat * cfg.durScale,
          pitch: degreeToMidi(key, scale, rootDeg + pick(rng, [4, 6, 7]), 6),
          velocity: 0.32 * sGain,
          instrument: bellInstr,
          pan: clamp((rng() * 2 - 1) * 0.7, -1, 1),
          layer: "bell",
        });
      }

      // ---- Percussion: button density scales the groove (Rule 5); patterns
      // are per-site Euclidean signatures, not uniform grids.
      if (cfg.perc === "drive" && isBody) {
        const fourOnFloor = bpm >= 118 && percBoost > 0.25;
        for (let s = 0; s < 8; s++) {
          const onBeat = s % 2 === 0;
          if ((onBeat && (kickPattern[s] || s === 0)) || (fourOnFloor && onBeat)) {
            events.push({
              time: barStart + s * (beat / 2),
              duration: 0.25,
              pitch: 36,
              velocity: 0.7 * sGain,
              instrument: "kick",
              pan: 0,
              layer: "perc",
            });
          }
          if (hatPattern[s]) {
            events.push({
              time: barStart + s * (beat / 2),
              duration: 0.08,
              pitch: 90,
              velocity: (onBeat ? 0.3 : 0.2) * sGain,
              instrument: "hihat",
              pan: 0.25,
              layer: "perc",
            });
          }
        }
      } else if (cfg.perc === "sparse" && isBody && bar % 2 === 0) {
        for (let s = 0; s < 8; s++) {
          if (!sparsePattern[s]) continue;
          if (rng() >= (0.35 + 0.4 * percBoost) * dens) continue;
          events.push({
            time: barStart + s * (beat / 2),
            duration: 0.4,
            pitch: 48,
            velocity: 0.3 * sGain,
            instrument: "perc",
            pan: -0.2,
            layer: "perc",
          });
        }
      } else if (cfg.perc === "cinematic" && b === 0 && !isIntro) {
        events.push({
          time: barStart,
          duration: 0.6,
          pitch: 33,
          velocity: 0.65 * sGain,
          instrument: "taiko",
          pan: 0,
          layer: "perc",
        });
        if (rng() < (0.3 + 0.5 * percBoost) * dens) {
          events.push({
            time: barStart + 3.5 * beat,
            duration: 0.3,
            pitch: 55,
            velocity: 0.35 * sGain,
            instrument: "perc",
            pan: 0.3,
            layer: "perc",
          });
        }
      } else if (cfg.perc === "eastern" && isBody) {
        for (let s = 0; s < 8; s++) {
          if (!taikoPattern[s]) continue;
          if (rng() >= (0.55 + 0.35 * percBoost) * dens) continue;
          events.push({
            time: barStart + s * (beat / 2),
            duration: 0.5,
            pitch: s === 0 ? 33 : 40,
            velocity: (s === 0 ? 0.6 : 0.4) * sGain,
            instrument: "taiko",
            pan: s % 2 === 0 ? -0.15 : 0.15,
            layer: "perc",
          });
        }
      }
    }
  }

  // ---- Post-pass: rhythm grid (§37), harmonic guardrail (§39), range clamp, density limits (§38).
  const UNPITCHED: ReadonlySet<InstrumentName> = new Set(["kick", "hihat", "perc", "taiko"]);
  const lengthSec = profile.barCount * barDur;
  let processed = events
    .filter((ev) => ev.time < lengthSec - 1e-6)
    .map((ev) => {
      let pitch = ev.pitch;
      if (!UNPITCHED.has(ev.instrument)) {
        const skipGuardrail = mode === "analytical" && ev.instrument === melodyInstr;
        if (!skipGuardrail) pitch = quantizePitch(pitch, key, scale);
        pitch = clampMidi(pitch);
      }
      return {
        ...ev,
        time: round6(quantizeTime(ev.time, bpm)),
        duration: round6(clamp(ev.duration, 0.05, 12)),
        pitch,
        velocity: round6(clamp(ev.velocity, 0.05, 1)),
        pan: round6(clamp(ev.pan, -1, 1)),
      };
    });

  // Musical mode preserves the same page-derived identity, then arranges its
  // mapped material into a clearer sectional performance. Hybrid and
  // Analytical intentionally bypass this pass for backwards-compatible sound
  // signatures and structural audibility.
  processed = finalizeScoreEvents(processed, profile, mode);

  return {
    version: 1,
    fingerprint,
    variation: options.variation,
    profile,
    events: processed,
  };
}
