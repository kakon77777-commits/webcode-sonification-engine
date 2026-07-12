import { mulberry32 } from "../mapping/deterministic-seed.js";

/**
 * Pure procedural reverb impulse-response generator — no AudioBuffer/
 * AudioContext involved, so this is unit-testable in Node. Same seed →
 * identical samples.
 *
 * Shaped to read as a small room rather than flat decaying noise:
 * - a short pre-delay (silence) before anything arrives, for clarity;
 * - a handful of sparse early reflections just after it;
 * - a diffuse late tail that gets progressively more low-pass filtered as it
 *   decays (air absorption — real rooms lose high frequencies faster than
 *   low ones over distance/time), windowed by a decaying envelope.
 */
export function dampedNoiseSamples(len: number, seed: number): Float32Array {
  const rng = mulberry32(seed);
  const out = new Float32Array(len);

  const preDelay = Math.max(1, Math.floor(len * 0.003)); // ~3ms of silence at 44.1kHz/1.8s
  const erSpan = Math.max(1, Math.floor(len * 0.02));
  const erCount = 6;
  for (let i = 0; i < erCount; i++) {
    const t = preDelay + Math.floor(rng() * erSpan);
    if (t < len) out[t] += (rng() * 2 - 1) * (1 - i / erCount) * 0.6;
  }

  let lp = 0;
  for (let i = preDelay; i < len; i++) {
    const tt = (i - preDelay) / Math.max(1, len - preDelay);
    // One-pole lowpass coefficient: higher = brighter (tracks the raw noise
    // more closely), lower = darker. Starts bright, falls toward dark as the
    // tail progresses, mimicking a real room's high-frequency air absorption.
    const coeff = 0.85 - 0.7 * tt;
    const noise = rng() * 2 - 1;
    lp += coeff * (noise - lp);
    out[i] += lp * Math.pow(1 - tt, 2.2);
  }

  let peak = 0;
  for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(out[i]));
  if (peak > 1e-6) {
    const norm = 0.9 / peak;
    for (let i = 0; i < len; i++) out[i] *= norm;
  }
  return out;
}
