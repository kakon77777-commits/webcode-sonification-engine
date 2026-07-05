import { describe, expect, it } from "vitest";
import { computeFingerprint } from "../src/mapping/fingerprint.js";
import { generateScore } from "../src/mapping/default-map.js";
import { SCALE_INTERVALS } from "../src/mapping/profile.js";
import { quantizePitch, scalePitchClasses, quantizeTime } from "../src/mapping/quantize.js";
import type { ScaleName } from "../src/shared/types.js";
import { syntheticFeatures } from "./helpers.js";

const UNPITCHED = new Set(["kick", "hihat", "perc", "taiko"]);
const ALL_SCALES = Object.keys(SCALE_INTERVALS) as ScaleName[];

describe("harmonic guardrail + rhythm grid (§37, §39)", () => {
  it("quantizePitch always lands inside the scale (all 7 scales)", () => {
    for (let key = 0; key < 12; key++) {
      for (const scale of ALL_SCALES) {
        const classes = scalePitchClasses(key, scale);
        for (let p = 28; p <= 103; p++) {
          expect(classes.has(quantizePitch(p, key, scale) % 12)).toBe(true);
        }
      }
    }
  });

  it("every pitched note in hybrid/musical scores is in Scale(K)", () => {
    for (const mode of ["hybrid", "musical"] as const) {
      for (const style of ["ambient", "piano", "electronic", "orchestral", "eastern"] as const) {
        const f = syntheticFeatures();
        const score = generateScore(f, computeFingerprint(f), { style, mode, variation: 0 });
        const classes = scalePitchClasses(score.profile.key, score.profile.scale);
        for (const ev of score.events) {
          if (UNPITCHED.has(ev.instrument)) continue;
          expect(classes.has(((ev.pitch % 12) + 12) % 12)).toBe(true);
        }
      }
    }
  });

  it("every event time sits on the 1/16 grid", () => {
    const f = syntheticFeatures();
    const score = generateScore(f, computeFingerprint(f), {
      style: "electronic",
      mode: "hybrid",
      variation: 0,
    });
    const step = 60 / score.profile.bpm / 4;
    for (const ev of score.events) {
      const slots = ev.time / step;
      expect(Math.abs(slots - Math.round(slots))).toBeLessThan(1e-4);
    }
  });

  it("quantizeTime snaps to sixteenths", () => {
    expect(quantizeTime(0.51, 120)).toBeCloseTo(0.5, 9); // sixteenth at 120bpm = 0.125s
    expect(quantizeTime(0.57, 120)).toBeCloseTo(0.625, 9);
  });
});
