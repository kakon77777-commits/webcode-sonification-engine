import { describe, expect, it } from "vitest";
import type { NoteEvent } from "../src/shared/types.js";
import { measureScore } from "../src/mapping/score-metrics.js";

describe("measureScore", () => {
  it("returns zeroed metrics for an empty score", () => {
    const metrics = measureScore([], 0);

    expect(metrics).toEqual({
      eventCount: 0,
      durationSec: 0,
      maxEventsPerSecond: 0,
      maxSimultaneousVoices: 0,
      layerCounts: {
        pad: 0,
        bass: 0,
        melody: 0,
        arp: 0,
        bell: 0,
        perc: 0,
      },
      instrumentCounts: {},
    });
  });

  it("counts layers and instruments without mutating events", () => {
    const events: NoteEvent[] = [
      { time: 0, duration: 1, pitch: 60, velocity: 0.5, instrument: "pad", pan: 0, layer: "pad" },
      { time: 0, duration: 0.5, pitch: 48, velocity: 0.5, instrument: "bass", pan: 0, layer: "bass" },
      { time: 1, duration: 0.2, pitch: 72, velocity: 0.5, instrument: "piano", pan: 0, layer: "melody" },
    ];
    const before = structuredClone(events);

    const metrics = measureScore(events, 2);

    expect(metrics.eventCount).toBe(3);
    expect(metrics.durationSec).toBe(2);
    expect(metrics.layerCounts.pad).toBe(1);
    expect(metrics.layerCounts.bass).toBe(1);
    expect(metrics.layerCounts.melody).toBe(1);
    expect(metrics.layerCounts.arp).toBe(0);
    expect(metrics.layerCounts.bell).toBe(0);
    expect(metrics.layerCounts.perc).toBe(0);
    expect(metrics.instrumentCounts.piano).toBe(1);
    expect(metrics.instrumentCounts.pad).toBe(1);
    expect(metrics.instrumentCounts.bass).toBe(1);
    expect(metrics.maxSimultaneousVoices).toBe(2);
    expect(metrics.maxEventsPerSecond).toBe(2);
    expect(events).toEqual(before);
  });

  it("measures overlapping events and a later bucket", () => {
    const events: NoteEvent[] = [
      { time: 0, duration: 2, pitch: 60, velocity: 0.5, instrument: "pad", pan: 0, layer: "pad" },
      { time: 0.5, duration: 1, pitch: 64, velocity: 0.5, instrument: "strings", pan: 0, layer: "melody" },
      { time: 2, duration: 0.25, pitch: 67, velocity: 0.5, instrument: "bell", pan: 0, layer: "bell" },
    ];

    const metrics = measureScore(events, 2.5);

    expect(metrics.eventCount).toBe(3);
    expect(metrics.durationSec).toBe(2.5);
    expect(metrics.maxSimultaneousVoices).toBe(2);
    expect(metrics.maxEventsPerSecond).toBe(2);
    expect(metrics.layerCounts.pad).toBe(1);
    expect(metrics.layerCounts.melody).toBe(1);
    expect(metrics.layerCounts.bell).toBe(1);
    expect(metrics.instrumentCounts.strings).toBe(1);
    expect(metrics.instrumentCounts.bell).toBe(1);
  });
});
