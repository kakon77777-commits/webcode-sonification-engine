import { describe, expect, it } from "vitest";
import { DEFAULT_LAYER_MIX, resolveLayerMix } from "../src/audio/layer-mix.js";

describe("layer mix tuning", () => {
  it("resolves a conservative low-end default without changing old callers", () => {
    expect(resolveLayerMix()).toEqual({
      lowEnd: 0.72,
      pad: 1,
      melody: 1,
      rhythm: 0.9,
    });
    expect(resolveLayerMix({ lowEnd: 0.4, rhythm: 1.2 })).toEqual({
      lowEnd: 0.4,
      pad: 1,
      melody: 1,
      rhythm: 1.2,
    });
  });

  it("clamps resolved layer mix values to the supported range", () => {
    expect(resolveLayerMix({
      lowEnd: -1,
      pad: 1.5,
      melody: 0.2,
      rhythm: 3,
    })).toEqual({
      lowEnd: 0,
      pad: 1.25,
      melody: 0.2,
      rhythm: 1.25,
    });
  });

  it("returns a fresh object on every resolution", () => {
    const resolved = resolveLayerMix();
    resolved.pad = 0.1;

    expect(resolveLayerMix()).toEqual(DEFAULT_LAYER_MIX);
    expect(resolveLayerMix()).not.toBe(resolved);
  });

  it("preserves the four layer keys across repeated resolution", () => {
    const first = Object.keys(resolveLayerMix({ melody: 0.7 })).sort();
    const second = Object.keys(resolveLayerMix({ rhythm: 1.1 })).sort();

    expect(first).toEqual(["lowEnd", "melody", "pad", "rhythm"]);
    expect(second).toEqual(first);
  });
});
