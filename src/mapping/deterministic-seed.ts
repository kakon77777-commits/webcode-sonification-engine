/**
 * Deterministic hashing and PRNG.
 *
 * Everything downstream of feature extraction must be a pure function of
 * (features, variation index). Same snapshot + same seed → same score (§81).
 */

/** FNV-1a 32-bit over a UTF-16 string (per code unit — deterministic across platforms). */
export function fnv1a32(input: string, seed = 0x811c9dc5): number {
  let h = seed >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** 64 bits of hash as 16 hex chars (two independent FNV streams). */
export function hash64hex(input: string): string {
  const a = fnv1a32(input, 0x811c9dc5);
  const b = fnv1a32(input, 0x9747b28c);
  return a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0");
}

/** splitmix32-style avalanche — used to combine seed with a variation index (§82). */
export function mixSeed(seed: number, variation: number): number {
  let z = (seed ^ Math.imul(variation + 1, 0x9e3779b9)) >>> 0;
  z = Math.imul(z ^ (z >>> 16), 0x21f0aaad) >>> 0;
  z = Math.imul(z ^ (z >>> 15), 0x735a2d97) >>> 0;
  return (z ^ (z >>> 15)) >>> 0;
}

export type Rng = () => number;

/** mulberry32 — small, fast, deterministic PRNG. Returns floats in [0, 1). */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer in [0, n). */
export function randInt(rng: Rng, n: number): number {
  return Math.floor(rng() * n);
}

/** Pick one element deterministically. */
export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[randInt(rng, items.length)];
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}
