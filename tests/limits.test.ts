import { describe, expect, it } from "vitest";
import { computeFingerprint } from "../src/mapping/fingerprint.js";
import { generateScore } from "../src/mapping/default-map.js";
import {
  MAX_EVENTS_PER_SECOND,
  MAX_VOICES,
  maxEventsPerSecond,
  maxSimultaneousVoices,
} from "../src/mapping/limits.js";
import { syntheticFeatures } from "./helpers.js";

describe("density limiter (§38, §74): huge sites cannot explode into noise", () => {
  const monster = syntheticFeatures({
    nodes: 500_000,
    depth: 60,
    links: 100_000,
    images: 30_000,
    buttons: 20_000,
    text: 5_000_000,
    pageHeight: 500_000,
  });

  for (const style of ["ambient", "piano", "electronic", "orchestral"] as const) {
    it(`respects voice and event-rate caps for a 500k-node page (${style})`, () => {
      const score = generateScore(monster, computeFingerprint(monster), {
        style,
        mode: "hybrid",
        variation: 0,
      });
      expect(score.events.length).toBeGreaterThan(0);
      expect(maxEventsPerSecond(score.events)).toBeLessThanOrEqual(MAX_EVENTS_PER_SECOND);
      expect(maxSimultaneousVoices(score.events)).toBeLessThanOrEqual(MAX_VOICES);
    });
  }

  it("all event fields stay within valid ranges", () => {
    const score = generateScore(monster, computeFingerprint(monster), {
      style: "electronic",
      mode: "hybrid",
      variation: 0,
    });
    const lengthSec = score.profile.lengthSec;
    for (const ev of score.events) {
      expect(ev.time).toBeGreaterThanOrEqual(0);
      expect(ev.time).toBeLessThan(lengthSec + 0.5);
      expect(ev.duration).toBeGreaterThan(0);
      expect(ev.velocity).toBeGreaterThan(0);
      expect(ev.velocity).toBeLessThanOrEqual(1);
      expect(ev.pan).toBeGreaterThanOrEqual(-1);
      expect(ev.pan).toBeLessThanOrEqual(1);
      expect(ev.pitch).toBeGreaterThanOrEqual(21);
      expect(ev.pitch).toBeLessThanOrEqual(108);
    }
  });

  it("events are sorted by time", () => {
    const score = generateScore(monster, computeFingerprint(monster), {
      style: "ambient",
      mode: "hybrid",
      variation: 0,
    });
    for (let i = 1; i < score.events.length; i++) {
      expect(score.events[i].time).toBeGreaterThanOrEqual(score.events[i - 1].time);
    }
  });
});
