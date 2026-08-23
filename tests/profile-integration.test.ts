import { describe, expect, it } from "vitest";
import { generateScore } from "../src/mapping/default-map.js";
import { canonicalFeatureString, computeFingerprint } from "../src/mapping/fingerprint.js";
import { MAX_EVENTS_PER_SECOND, MAX_VOICES, maxEventsPerSecond, maxSimultaneousVoices } from "../src/mapping/limits.js";
import { mappingProfileHash, resolveMappingProfile } from "../src/mapping/mapping-profile.js";
import type { NoteEvent } from "../src/shared/types.js";
import { syntheticFeatures } from "./helpers.js";

const BASE_OPTIONS = {
  style: "ambient",
  mode: "hybrid",
  variation: 0,
} as const;

function structuralSignature(events: NoteEvent[]) {
  return events.map(({ time, duration, pitch, velocity, pan, layer }) => ({
    time,
    duration,
    pitch,
    velocity,
    pan,
    layer,
  }));
}

function expectEventContracts(events: NoteEvent[]) {
  expect(
    events.every((event) => ["pad", "bass", "melody", "arp", "bell", "perc"].includes(event.layer))
  ).toBe(true);
  expect(maxEventsPerSecond(events)).toBeLessThanOrEqual(MAX_EVENTS_PER_SECOND);
  expect(maxSimultaneousVoices(events)).toBeLessThanOrEqual(MAX_VOICES);
}

describe("mapping profile integration at generateScore", () => {
  it("keeps the default balanced score identical when the profile is omitted or explicitly balanced", () => {
    const features = syntheticFeatures();
    const fingerprint = computeFingerprint(features);

    const omitted = generateScore(features, fingerprint, BASE_OPTIONS);
    const balanced = generateScore(features, fingerprint, {
      ...BASE_OPTIONS,
      mappingProfile: { id: "balanced" },
    });

    expect(balanced.fingerprint).toEqual(omitted.fingerprint);
    expect(balanced.profile.character).toBe(omitted.profile.character);
    expect(balanced.profile.explain).toEqual(omitted.profile.explain);
    expect(balanced.events).toEqual(omitted.events);
  });

  it("changes only the mapping emphasis metadata and orchestration choice for a deterministic custom profile", () => {
    const features = syntheticFeatures();
    const fingerprint = computeFingerprint(features);
    const canonical = canonicalFeatureString(features);
    const resolved = resolveMappingProfile({
      id: "reader-focus",
      label: "  Reader Focus  ",
      description: "   ",
      characterBias: { content: 1.25, navigation: 0.85, media: 0.85, form: 0.85 },
    });

    const base = generateScore(features, fingerprint, BASE_OPTIONS);
    const focused = generateScore(features, fingerprint, {
      ...BASE_OPTIONS,
      mappingProfile: {
        id: "reader-focus",
        label: "  Reader Focus  ",
        description: "   ",
        characterBias: { content: 1.25, navigation: 0.85, media: 0.85, form: 0.85 },
      },
    });
    const focusedAgain = generateScore(features, fingerprint, {
      ...BASE_OPTIONS,
      mappingProfile: {
        id: "reader-focus",
        label: "  Reader Focus  ",
        description: "   ",
        characterBias: { content: 1.25, navigation: 0.85, media: 0.85, form: 0.85 },
      },
    });

    expect(base.fingerprint).toEqual(focused.fingerprint);
    expect(canonicalFeatureString(features)).toBe(canonical);
    expect(base.profile.character).toBe("navigation");
    expect(focused.profile.character).toBe("content");
    expect(focused.profile.mappingProfileId).toBe("reader-focus");
    expect(focused.profile.mappingProfileLabel).toBe("Reader Focus");
    expect(focused.profile.mappingProfileHash).toBe(mappingProfileHash(resolved));
    expect(focused.profile.explain[0]).toEqual({
      feature: "Mapping profile",
      value: "Reader Focus",
      effect: "content 125%, navigation 85%, media 85%, form 85%",
    });
    expect(base.profile.explain[0]).toEqual({
      feature: "Mapping profile",
      value: "Balanced",
      effect: "content 100%, navigation 100%, media 100%, form 100%",
    });
    expect(base.profile.explain[1]).toEqual({
      feature: "Structure character",
      value: "navigation-led (links & buttons)",
      effect: "lead voice: xiao, arpeggio voice: pluck",
    });
    expect(focused.profile.explain[1]).toEqual({
      feature: "Structure character",
      value: "content-led (text & articles)",
      effect: "lead voice: epiano, arpeggio voice: pluck",
    });
    expect(focused.profile.explain.slice(2)).toEqual(base.profile.explain.slice(2));
    expect(focused.events).toHaveLength(base.events.length);
    expect(structuralSignature(focused.events)).toEqual(structuralSignature(base.events));
    expect(focused.events).toEqual(focusedAgain.events);
    expect(focused.profile).toEqual(focusedAgain.profile);
    expectEventContracts(base.events);
    expectEventContracts(focused.events);
  });
});
