import { describe, expect, it } from "vitest";
import { computeFingerprint } from "../src/mapping/fingerprint.js";
import { maxEventsPerSecond, maxSimultaneousVoices, MAX_EVENTS_PER_SECOND, MAX_VOICES } from "../src/mapping/limits.js";
import { arrangeMusically } from "../src/mapping/arrangement.js";
import { generateScore } from "../src/mapping/default-map.js";
import { syntheticFeatures } from "./helpers.js";
import type { NoteEvent, NoteLayer } from "../src/shared/types.js";

const features = syntheticFeatures();
const fingerprint = computeFingerprint(features);
const musical = () => generateScore(features, fingerprint, { style: "ambient", mode: "musical", variation: 0 });

function barAt(time: number, bpm: number): number {
  return Math.floor(time / ((60 / bpm) * 4) + 1e-6);
}

function compareEvents(a: NoteEvent, b: NoteEvent): number {
  return a.time - b.time || a.pitch - b.pitch || a.layer.localeCompare(b.layer);
}

const VALID_LAYERS: ReadonlySet<NoteLayer> = new Set(["pad", "bass", "melody", "arp", "bell", "perc"]);

describe("Musical-mode arrangement", () => {
  it("is deterministic", () => {
    expect(musical().events).toEqual(musical().events);
  });

  it("does not mutate the source score", () => {
    const score = musical();
    const before = structuredClone(score.events);

    arrangeMusically(score.events, score.profile);

    expect(score.events).toEqual(before);
  });

  it("keeps arranged events inside the score range", () => {
    const score = musical();
    const arranged = arrangeMusically(score.events, score.profile);

    expect(arranged.every((event) => event.time >= 0)).toBe(true);
    expect(arranged.every((event) => event.time < score.profile.lengthSec)).toBe(true);
    expect(arranged.every((event) => event.pitch >= 21 && event.pitch <= 108)).toBe(true);
  });

  it("keeps valid layers and a deterministic sort order", () => {
    const score = musical();
    const arranged = arrangeMusically(score.events, score.profile);

    expect(arranged.every((event) => VALID_LAYERS.has(event.layer))).toBe(true);
    for (let index = 1; index < arranged.length; index++) {
      expect(compareEvents(arranged[index - 1], arranged[index])).toBeLessThanOrEqual(0);
    }
  });

  it("does not create a replacement cadence event when the final bar has no melody", () => {
    const score = musical();
    const finalBar = score.profile.barCount - 1;
    const withoutFinalMelody = score.events.filter(
      (event) => !(event.layer === "melody" && barAt(event.time, score.profile.bpm) === finalBar)
    );
    const arranged = arrangeMusically(withoutFinalMelody, score.profile);

    expect(arranged.length).toBeLessThanOrEqual(withoutFinalMelody.length);
    expect(arranged.some((event) => event.layer === "melody" && barAt(event.time, score.profile.bpm) === finalBar)).toBe(false);
    expect(
      arranged.every((event) =>
        withoutFinalMelody.some(
          (source) =>
            source.time === event.time &&
            source.instrument === event.instrument &&
            source.pan === event.pan &&
            source.layer === event.layer
        )
      )
    ).toBe(true);
  });

  it("opens sparsely and leaves decorative layers out of the intro", () => {
    const score = musical();
    const intro = score.profile.sections.find((section) => section.name === "intro");
    expect(intro).toBeDefined();
    const introEvents = score.events.filter((event) => barAt(event.time, score.profile.bpm) < (intro?.bars ?? 0));
    expect(introEvents.some((event) => event.layer === "arp" || event.layer === "bell" || event.layer === "perc")).toBe(false);
    expect(introEvents.filter((event) => event.layer === "pad" && barAt(event.time, score.profile.bpm) === 0)).toHaveLength(2);
  });

  it("lands on a tonic cadence in its final bar", () => {
    const score = musical();
    const finalBar = score.profile.barCount - 1;
    const endings = score.events.filter((event) => barAt(event.time, score.profile.bpm) === finalBar);
    const tonic = (pitch: number) => ((pitch % 12) + 12) % 12 === score.profile.key;
    expect(endings.filter((event) => event.layer === "bass").every((event) => tonic(event.pitch))).toBe(true);
    expect(endings.some((event) => event.layer === "melody" && tonic(event.pitch))).toBe(true);
  });

  it("keeps the existing density guardrails across every style", () => {
    for (const style of ["ambient", "piano", "electronic", "orchestral", "eastern"] as const) {
      const score = generateScore(features, fingerprint, { style, mode: "musical", variation: 0 });
      expect(maxEventsPerSecond(score.events), style).toBeLessThanOrEqual(MAX_EVENTS_PER_SECOND);
      expect(maxSimultaneousVoices(score.events), style).toBeLessThanOrEqual(MAX_VOICES);
    }
  });
});
