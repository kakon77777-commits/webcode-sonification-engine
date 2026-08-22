import { describe, expect, it } from "vitest";
import { INSTRUMENT_CATALOG } from "../src/audio/instruments.js";
import { isHealthyRender, measureRenderedChannels } from "../src/audio/render-metrics.js";
import type { InstrumentName } from "../src/shared/types.js";

const EXPECTED_INSTRUMENT_CATALOG: readonly InstrumentName[] = [
  "pad",
  "lowpad",
  "strings",
  "choir",
  "piano",
  "epiano",
  "pluck",
  "bell",
  "mallet",
  "marimba",
  "bass",
  "subbass",
  "brass",
  "lead",
  "flute",
  "clarinet",
  "xiao",
  "guitar",
  "koto",
  "taiko",
  "kick",
  "hihat",
  "perc",
];

describe("measureRenderedChannels", () => {
  it("reports empty render metrics for no channels", () => {
    const metrics = measureRenderedChannels([]);

    expect(metrics.frameCount).toBe(0);
    expect(metrics.channelCount).toBe(0);
    expect(metrics.peak).toBe(0);
    expect(metrics.rms).toBe(0);
    expect(metrics.dcOffset).toBe(0);
    expect(metrics.nonFiniteSamples).toBe(0);
    expect(metrics.clippedSamples).toBe(0);
    expect(metrics.channels).toEqual([]);
  });

  it("detects non-finite and clipped samples", () => {
    const metrics = measureRenderedChannels([
      new Float32Array([0, 0.5, 1, Number.NaN]),
      new Float32Array([0, -1, 0.2, Number.POSITIVE_INFINITY]),
    ]);

    expect(metrics.frameCount).toBe(4);
    expect(metrics.channelCount).toBe(2);
    expect(metrics.nonFiniteSamples).toBe(2);
    expect(metrics.clippedSamples).toBe(2);
    expect(isHealthyRender(metrics)).toBe(false);
  });
});

describe("INSTRUMENT_CATALOG", () => {
  it("exports the full authoritative 23-instrument catalog", () => {
    expect(INSTRUMENT_CATALOG).toEqual(EXPECTED_INSTRUMENT_CATALOG);
  });
});
