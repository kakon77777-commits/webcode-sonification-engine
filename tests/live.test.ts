import { describe, expect, it } from "vitest";
import { buildAmbientBed, LIVE_MAX_EVENTS_PER_SECOND, LiveRateLimiter, mutationToNote } from "../src/mapping/live.js";
import { scalePitchClasses } from "../src/mapping/quantize.js";
import { mulberry32 } from "../src/mapping/deterministic-seed.js";
import type { ScaleName } from "../src/shared/types.js";

const profile = { key: 2, scale: "minor" as ScaleName };

describe("Mutation Mode note generation (§29–31)", () => {
  it("every generated note lands in Scale(K) — same harmonic guardrail as the static score", () => {
    const classes = scalePitchClasses(profile.key, profile.scale);
    const rng = mulberry32(1);
    for (const kind of ["add", "remove", "attr"] as const) {
      for (const tag of ["a", "img", "button", "div", "p", "unknown-el"]) {
        const note = mutationToNote(kind, tag, profile, rng);
        expect(classes.has(((note.pitch % 12) + 12) % 12)).toBe(true);
      }
    }
  });

  it("maps known tag families to the same layer as the visualizer (links → arp, images → bell, buttons → perc)", () => {
    const rng = mulberry32(1);
    expect(mutationToNote("add", "a", profile, rng).layer).toBe("arp");
    expect(mutationToNote("add", "img", profile, rng).layer).toBe("bell");
    expect(mutationToNote("add", "button", profile, rng).layer).toBe("perc");
    expect(mutationToNote("add", "h2", profile, rng).layer).toBe("melody");
  });

  it("unknown tags still produce a note (falls back to melody, not silence)", () => {
    const rng = mulberry32(1);
    const note = mutationToNote("add", "custom-widget", profile, rng);
    expect(note.layer).toBe("melody");
    expect(note.velocity).toBeGreaterThan(0);
  });

  it("removal reads darker/quieter than addition", () => {
    const rngAdd = mulberry32(42);
    const rngRemove = mulberry32(42); // same stream position for a fair comparison
    const add = mutationToNote("add", "p", profile, rngAdd);
    const remove = mutationToNote("remove", "p", profile, rngRemove);
    expect(remove.velocity).toBeLessThan(add.velocity);
    expect(remove.pitch).toBeLessThanOrEqual(add.pitch + 12); // lower octave, allowing scale snapping
  });

  it("attribute changes are quiet, short blips", () => {
    const rng = mulberry32(7);
    const note = mutationToNote("attr", "div", profile, rng);
    expect(note.velocity).toBeLessThan(0.3);
    expect(note.duration).toBeLessThan(0.15);
  });

  it("velocity, pan and duration always stay within valid ranges", () => {
    const rng = mulberry32(99);
    for (let i = 0; i < 200; i++) {
      const note = mutationToNote(["add", "remove", "attr"][i % 3] as "add" | "remove" | "attr", "span", profile, rng);
      expect(note.velocity).toBeGreaterThan(0);
      expect(note.velocity).toBeLessThanOrEqual(1);
      expect(note.pan).toBeGreaterThanOrEqual(-1);
      expect(note.pan).toBeLessThanOrEqual(1);
      expect(note.duration).toBeGreaterThan(0);
    }
  });
});

describe("ambient bed (§40 Layer C backdrop)", () => {
  it("builds a chord + root bass, all within the scale", () => {
    const classes = scalePitchClasses(profile.key, profile.scale);
    const bed = buildAmbientBed(profile);
    expect(bed.length).toBe(4); // 3 chord tones + bass
    for (const ev of bed) {
      expect(classes.has(((ev.pitch % 12) + 12) % 12)).toBe(true);
      expect(ev.time).toBe(0);
    }
    expect(bed.filter((e) => e.instrument === "bass").length).toBe(1);
    expect(bed.filter((e) => e.instrument === "pad").length).toBe(3);
  });
});

describe("LiveRateLimiter", () => {
  it("admits up to the cap within a window, then drops", () => {
    let now = 0;
    const limiter = new LiveRateLimiter(3, () => now);
    expect(limiter.tryAdmit()).toBe(true);
    expect(limiter.tryAdmit()).toBe(true);
    expect(limiter.tryAdmit()).toBe(true);
    expect(limiter.tryAdmit()).toBe(false); // 4th within the same window
  });

  it("resets after the window elapses", () => {
    let now = 0;
    const limiter = new LiveRateLimiter(2, () => now);
    expect(limiter.tryAdmit()).toBe(true);
    expect(limiter.tryAdmit()).toBe(true);
    expect(limiter.tryAdmit()).toBe(false);
    now = 1001;
    expect(limiter.tryAdmit()).toBe(true);
  });

  it("default cap matches the exported constant", () => {
    expect(LIVE_MAX_EVENTS_PER_SECOND).toBeGreaterThan(0);
    expect(LIVE_MAX_EVENTS_PER_SECOND).toBeLessThanOrEqual(20); // never busier than the static-score density limiter
  });
});
