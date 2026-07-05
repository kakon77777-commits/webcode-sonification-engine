import { describe, expect, it } from "vitest";
import { computeFingerprint } from "../src/mapping/fingerprint.js";
import { generateScore } from "../src/mapping/default-map.js";
import type { GenerateOptions } from "../src/shared/types.js";
import { syntheticFeatures } from "./helpers.js";

const OPTS: GenerateOptions = { style: "ambient", mode: "hybrid", variation: 0 };

describe("deterministic score generation (§81–82)", () => {
  it("same features + same seed → identical score", () => {
    const f = syntheticFeatures();
    const fp = computeFingerprint(f);
    const a = generateScore(f, fp, OPTS);
    const b = generateScore(f, fp, OPTS);
    expect(a.events).toEqual(b.events);
    expect(a.profile).toEqual(b.profile);
  });

  it("variation index produces a different score but keeps site identity (key, bpm)", () => {
    const f = syntheticFeatures();
    const fp = computeFingerprint(f);
    const v0 = generateScore(f, fp, OPTS);
    const v1 = generateScore(f, fp, { ...OPTS, variation: 1 });
    expect(v1.events).not.toEqual(v0.events);
    expect(v1.profile.key).toBe(v0.profile.key); // hue-derived key survives regeneration
    expect(v1.profile.bpm).toBe(v0.profile.bpm);
  });

  it("each style produces a distinct orchestration", () => {
    const f = syntheticFeatures();
    const fp = computeFingerprint(f);
    const instruments = (style: GenerateOptions["style"]) =>
      [...new Set(generateScore(f, fp, { ...OPTS, style }).events.map((e) => e.instrument))]
        .sort()
        .join(",");
    const sets = new Set(
      (["ambient", "piano", "electronic", "orchestral", "eastern"] as const).map(instruments)
    );
    expect(sets.size).toBe(5);
  });

  it("all three modes generate non-empty scores", () => {
    const f = syntheticFeatures();
    const fp = computeFingerprint(f);
    for (const mode of ["hybrid", "musical", "analytical"] as const) {
      const s = generateScore(f, fp, { ...OPTS, mode });
      expect(s.events.length).toBeGreaterThan(20);
    }
  });

  it("score length stays within 30–90 s (§72)", () => {
    for (const overrides of [{ pageHeight: 400, nodes: 30 }, {}, { pageHeight: 200_000, nodes: 100_000 }]) {
      const f = syntheticFeatures(overrides);
      const s = generateScore(f, computeFingerprint(f), OPTS);
      expect(s.profile.lengthSec).toBeGreaterThanOrEqual(25); // bar rounding tolerance
      expect(s.profile.lengthSec).toBeLessThanOrEqual(95);
      expect(s.profile.bpm).toBeGreaterThanOrEqual(52);
      expect(s.profile.bpm).toBeLessThanOrEqual(176);
    }
  });

  describe("tuning sliders are part of Θ (deterministic, effective)", () => {
    const f = syntheticFeatures();
    const fp = computeFingerprint(f);
    const base = { ...OPTS };

    it("same tuning → identical score", () => {
      const t = { tempoShift: 12, density: 1.3, brightness: 0.7, reverb: 0.2 };
      const a = generateScore(f, fp, { ...base, tuning: t });
      const b = generateScore(f, fp, { ...base, tuning: t });
      expect(a.events).toEqual(b.events);
    });

    it("tempo slider shifts BPM by the requested amount", () => {
      const b0 = generateScore(f, fp, base).profile.bpm;
      const b20 = generateScore(f, fp, {
        ...base,
        tuning: { tempoShift: 20, density: 1, brightness: 0.5, reverb: 0.5 },
      }).profile.bpm;
      expect(b20).toBe(b0 + 20);
    });

    it("density slider changes note count in the right direction", () => {
      const lo = generateScore(f, fp, {
        ...base,
        tuning: { tempoShift: 0, density: 0.5, brightness: 0.5, reverb: 0.5 },
      }).events.length;
      const hi = generateScore(f, fp, {
        ...base,
        tuning: { tempoShift: 0, density: 1.5, brightness: 0.5, reverb: 0.5 },
      }).events.length;
      expect(hi).toBeGreaterThan(lo);
    });
  });
});
