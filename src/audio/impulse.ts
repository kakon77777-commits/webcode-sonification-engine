import { mulberry32 } from "../mapping/deterministic-seed.js";

/**
 * Pure noise-envelope generator for the reverb impulse response — no
 * AudioBuffer/AudioContext involved, so this is unit-testable in Node.
 * Same seed → identical samples; the exponential-ish decay shapes it into a
 * plausible "room" tail rather than flat noise.
 */
export function dampedNoiseSamples(len: number, seed: number): Float32Array {
  const rng = mulberry32(seed);
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    out[i] = (rng() * 2 - 1) * Math.pow(1 - i / len, 2.4);
  }
  return out;
}
