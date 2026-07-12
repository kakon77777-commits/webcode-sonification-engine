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
});
