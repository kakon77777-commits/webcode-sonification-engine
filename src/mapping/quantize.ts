import type { ScaleName } from "../shared/types.js";
import { SCALE_INTERVALS } from "./profile.js";

/**
 * Harmonic guardrail (§39): every raw pitch is quantized into Scale(K).
 * Rhythm quantization (§37): every event time snaps to a 1/16-note grid.
 * Structure controls variation; music grammar controls listenability.
 */

/** Set of allowed pitch classes for key+scale. */
export function scalePitchClasses(key: number, scale: ScaleName): Set<number> {
  return new Set(SCALE_INTERVALS[scale].map((i) => (key + i) % 12));
}

/** Snap a MIDI pitch to the nearest pitch in the scale (ties resolve downward). */
export function quantizePitch(pitch: number, key: number, scale: ScaleName): number {
  const classes = scalePitchClasses(key, scale);
  const rounded = Math.round(pitch);
  for (let d = 0; d <= 6; d++) {
    if (classes.has((((rounded - d) % 12) + 12) % 12)) return rounded - d;
    if (classes.has((((rounded + d) % 12) + 12) % 12)) return rounded + d;
  }
  return rounded; // unreachable: every scale has ≥5 classes
}

/** MIDI note for scale degree `degree` (may exceed the octave) above `key`, octave 0 = C-1 base. */
export function degreeToMidi(key: number, scale: ScaleName, degree: number, octave: number): number {
  const intervals = SCALE_INTERVALS[scale];
  const n = intervals.length;
  const oct = Math.floor(degree / n);
  const idx = ((degree % n) + n) % n;
  return 12 * (octave + 1 + oct) + key + intervals[idx];
}

/** Snap seconds onto a 1/16-note grid for the given bpm. */
export function quantizeTime(timeSec: number, bpm: number, gridDiv = 4): number {
  const step = 60 / bpm / gridDiv; // gridDiv=4 → sixteenth notes
  return Math.round(timeSec / step) * step;
}

export function clampMidi(pitch: number, lo = 28, hi = 103): number {
  let p = pitch;
  while (p < lo) p += 12;
  while (p > hi) p -= 12;
  return p;
}
