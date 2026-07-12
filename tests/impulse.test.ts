import { describe, expect, it } from "vitest";
import { dampedNoiseSamples } from "../src/audio/impulse.js";

describe("reverb impulse-response generator (deterministic per seed)", () => {
  it("same seed → identical samples", () => {
    const a = dampedNoiseSamples(2000, 12345);
    const b = dampedNoiseSamples(2000, 12345);
    expect(a).toEqual(b);
  });

  it("different seeds → different samples", () => {
    const a = dampedNoiseSamples(2000, 1);
    const b = dampedNoiseSamples(2000, 2);
    expect(a).not.toEqual(b);
  });

  it("decays toward zero (damped envelope, not flat noise)", () => {
    const samples = dampedNoiseSamples(10000, 7);
    const earlyEnergy = samples.slice(0, 100).reduce((s, x) => s + Math.abs(x), 0);
    const lateEnergy = samples.slice(-100).reduce((s, x) => s + Math.abs(x), 0);
    expect(lateEnergy).toBeLessThan(earlyEnergy);
  });

  it("stays within [-1, 1]", () => {
    const samples = dampedNoiseSamples(5000, 99);
    for (const s of samples) {
      expect(s).toBeGreaterThanOrEqual(-1);
      expect(s).toBeLessThanOrEqual(1);
    }
  });

  it("starts with a short pre-delay before the first reflection arrives", () => {
    const samples = dampedNoiseSamples(10000, 3);
    const first20 = samples.slice(0, 20);
    expect(first20.every((x) => Math.abs(x) < 0.05)).toBe(true);
  });

  it("has non-trivial energy overall (not all silence)", () => {
    const samples = dampedNoiseSamples(10000, 3);
    const total = samples.reduce((s, x) => s + Math.abs(x), 0);
    expect(total).toBeGreaterThan(1);
  });

  it("the tail darkens over time — fewer zero-crossings later (a crude high-frequency-content proxy for air absorption)", () => {
    const samples = dampedNoiseSamples(20000, 11);
    const crossings = (arr: Float32Array | number[]) => {
      let c = 0;
      for (let i = 1; i < arr.length; i++) {
        if (arr[i] !== 0 && Math.sign(arr[i]) !== Math.sign(arr[i - 1])) c++;
      }
      return c;
    };
    const early = samples.slice(1000, 4000);
    const late = samples.slice(-3000);
    expect(crossings(late)).toBeLessThan(crossings(early));
  });
});
