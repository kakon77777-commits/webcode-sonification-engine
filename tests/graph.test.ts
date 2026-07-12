import { describe, expect, it } from "vitest";
import { softClipCurve } from "../src/audio/graph.js";

describe("master-bus soft-clip curve", () => {
  it("reaches close to ±1 at the extremes", () => {
    const curve = softClipCurve();
    expect(curve[curve.length - 1]).toBeGreaterThan(0.9);
    expect(curve[0]).toBeLessThan(-0.9);
  });

  it("maps the midpoint (silence) to exactly 0", () => {
    const curve = softClipCurve(0.7, 1025); // odd length so a sample lands exactly on 0
    const mid = (curve.length - 1) / 2;
    expect(curve[mid]).toBe(0);
  });

  it("is monotonically increasing (never folds the signal)", () => {
    const curve = softClipCurve();
    for (let i = 1; i < curve.length; i++) {
      expect(curve[i]).toBeGreaterThanOrEqual(curve[i - 1]);
    }
  });

  it("is odd-symmetric: curve(-x) = -curve(x)", () => {
    const curve = softClipCurve(0.7, 1025);
    const n = curve.length;
    for (let i = 0; i < n; i++) {
      expect(curve[i]).toBeCloseTo(-curve[n - 1 - i], 5);
    }
  });

  it("is exact identity below the threshold — typical signal levels pass through unchanged", () => {
    const n = 2049;
    const curve = softClipCurve(0.7, n);
    const idx = Math.round(((0.2 + 1) / 2) * (n - 1));
    const xAtIdx = (idx / (n - 1)) * 2 - 1; // the discretized x this sample actually represents
    expect(curve[idx]).toBe(xAtIdx);
  });

  it("compresses values above the threshold relative to identity", () => {
    const curve = softClipCurve(0.7, 2049);
    const n = curve.length;
    const idx = Math.round(((0.9 + 1) / 2) * (n - 1));
    expect(curve[idx]).toBeLessThan(0.9);
  });

  it("a lower threshold compresses more aggressively", () => {
    const mild = softClipCurve(0.85, 2049); // most of the range is untouched identity
    const heavy = softClipCurve(0.3, 2049); // most of the range gets curved
    const n = mild.length;
    const idx = Math.round(((0.7 + 1) / 2) * (n - 1));
    expect(heavy[idx]).toBeLessThan(mild[idx]);
  });
});
