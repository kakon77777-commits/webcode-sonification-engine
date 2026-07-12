import { describe, expect, it } from "vitest";
import {
  fractionToTime,
  lowerBound,
  ScrollScheduler,
  scrollFraction,
  thinBurst,
} from "../src/audio/scroll-scheduler.js";
import type { NoteEvent } from "../src/shared/types.js";

function ev(time: number): NoteEvent {
  return { time, duration: 0.2, pitch: 60, velocity: 0.5, instrument: "pluck", pan: 0, layer: "arp" };
}

describe("scroll-driven scheduler (§45, Scrolling Page = Vertical Score)", () => {
  const events = [0, 1, 2, 3, 4, 5].map(ev);

  it("scrolling forward triggers notes in (lastTime, newTime]", () => {
    const triggered: number[] = [];
    const s = new ScrollScheduler(events, (e) => triggered.push(e.time));
    s.setTime(2.5);
    expect(triggered).toEqual([0, 1, 2]);
    s.setTime(4);
    expect(triggered).toEqual([0, 1, 2, 3, 4]);
  });

  it("scrolling backward triggers nothing", () => {
    const triggered: number[] = [];
    const s = new ScrollScheduler(events, (e) => triggered.push(e.time));
    s.setTime(4);
    triggered.length = 0;
    s.setTime(1);
    expect(triggered).toEqual([]);
    expect(s.position()).toBe(1);
  });

  it("scrolling forward again after rewinding re-triggers crossed notes (scrubbing)", () => {
    const triggered: number[] = [];
    const s = new ScrollScheduler(events, (e) => triggered.push(e.time));
    s.setTime(4);
    s.setTime(1); // rewind
    triggered.length = 0;
    s.setTime(3.5);
    expect(triggered).toEqual([2, 3]);
  });

  it("never retriggers a note within a single monotonic forward sweep", () => {
    const triggered: number[] = [];
    const s = new ScrollScheduler(events, (e) => triggered.push(e.time));
    for (const t of [0.5, 1.5, 1.6, 2.5, 5]) s.setTime(t);
    expect(triggered).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("reset() clears position and replays from the start", () => {
    const triggered: number[] = [];
    const s = new ScrollScheduler(events, (e) => triggered.push(e.time));
    s.setTime(3);
    s.reset();
    expect(s.position()).toBe(0);
    triggered.length = 0;
    s.setTime(1.5);
    expect(triggered).toEqual([0, 1]);
  });

  it("thins a big forward jump to the burst cap", () => {
    const dense = Array.from({ length: 100 }, (_, i) => ev(i * 0.01));
    const triggered: number[] = [];
    const s = new ScrollScheduler(dense, (e) => triggered.push(e.time), 10);
    s.setTime(1);
    expect(triggered.length).toBe(10);
  });

  it("does not thin when the batch is within the cap", () => {
    const triggered: number[] = [];
    const s = new ScrollScheduler(events, (e) => triggered.push(e.time), 24);
    s.setTime(10);
    expect(triggered.length).toBe(6);
  });
});

describe("lowerBound", () => {
  const events = [0, 1, 2, 3].map(ev);
  it("finds the first index strictly after `time`", () => {
    expect(lowerBound(events, -1)).toBe(0);
    expect(lowerBound(events, 0)).toBe(1);
    expect(lowerBound(events, 1.5)).toBe(2);
    expect(lowerBound(events, 3)).toBe(4);
    expect(lowerBound(events, 100)).toBe(4);
  });
});

describe("thinBurst", () => {
  it("passes short batches through unchanged", () => {
    expect(thinBurst([1, 2, 3], 10)).toEqual([1, 2, 3]);
  });
  it("evenly samples down to cap, preserving order and endpoints coverage", () => {
    const out = thinBurst(Array.from({ length: 50 }, (_, i) => i), 5);
    expect(out.length).toBe(5);
    expect(out[0]).toBe(0);
    for (let i = 1; i < out.length; i++) expect(out[i]).toBeGreaterThan(out[i - 1]);
  });
});

describe("fractionToTime / scrollFraction", () => {
  it("maps fraction to score time, clamped", () => {
    expect(fractionToTime(0, 80)).toBe(0);
    expect(fractionToTime(0.5, 80)).toBe(40);
    expect(fractionToTime(1, 80)).toBe(80);
    expect(fractionToTime(-1, 80)).toBe(0);
    expect(fractionToTime(2, 80)).toBe(80);
  });

  it("computes safe scroll fraction, guarding non-scrollable pages", () => {
    expect(scrollFraction(0, 1000, 800)).toBeCloseTo(0, 5);
    expect(scrollFraction(100, 1000, 800)).toBeCloseTo(0.5, 5);
    expect(scrollFraction(200, 1000, 800)).toBeCloseTo(1, 5);
    // Non-scrollable page (scrollHeight <= clientHeight): no divide-by-zero, fraction stays 0.
    expect(scrollFraction(0, 500, 800)).toBe(0);
  });
});
