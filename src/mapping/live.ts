import type { InstrumentName, MusicProfile, NoteEvent, NoteLayer } from "../shared/types.js";
import { layerForTag } from "./layer-tags.js";
import { clampMidi, degreeToMidi, quantizePitch } from "./quantize.js";
import type { Rng } from "./deterministic-seed.js";

/**
 * Mutation Mode (§29–31, §40 Layer C "Performance"): a live website becomes a
 * performer. Node added → onset, node removed → a darker release cue,
 * attribute changed → a quiet modulation blip. Structure (Layer B) already
 * decided key/scale/tempo when the page was first analyzed; this layer only
 * adds runtime variation on top — it does not need snapshot-style
 * reproducibility (§31: this is explicitly a live performance, not a replay).
 *
 * Privacy: callers pass tag names only — never attribute names, values, or
 * text content (same class as the tag histogram / visualizer tokens).
 */

export type MutationKind = "add" | "remove" | "attr";

export interface MutationBatch {
  added: string[];
  removed: string[];
  attrChanged: string[];
}

/** Kept light and percussive — the sustained pad/bass bed carries the harmony. */
const LIVE_INSTRUMENT: Record<NoteLayer, InstrumentName> = {
  arp: "pluck",
  bell: "bell",
  perc: "perc",
  melody: "mallet",
  pad: "pluck",
  bass: "mallet",
};

const BASE_VELOCITY: Record<MutationKind, number> = {
  add: 0.55,
  remove: 0.3,
  attr: 0.15,
};

const DURATION: Record<MutationKind, number> = {
  add: 0.22,
  remove: 0.35,
  attr: 0.08,
};

/**
 * One deterministic-given-rng-state note for a single mutation. `time` is
 * always 0 — Mutation Mode has no fixed timeline, the caller schedules it at
 * "now" — kept only because NoteEvent requires the field.
 */
export function mutationToNote(
  kind: MutationKind,
  tag: string,
  profile: Pick<MusicProfile, "key" | "scale">,
  rng: Rng
): NoteEvent {
  const layer = layerForTag(tag) ?? "melody"; // unknown tags still make a sound — something changed
  const instrument = LIVE_INSTRUMENT[layer];
  const degree = Math.floor(rng() * 8) - 2; // -2..5 scale degrees around the tonic
  const octave = kind === "remove" ? 3 : 4; // removal reads darker/lower
  const raw = degreeToMidi(profile.key, profile.scale, degree, octave);
  const pitch = clampMidi(quantizePitch(raw, profile.key, profile.scale));
  return {
    time: 0,
    duration: DURATION[kind],
    pitch,
    velocity: BASE_VELOCITY[kind] * (0.7 + 0.3 * rng()),
    instrument,
    pan: rng() * 2 - 1,
    layer,
  };
}

/**
 * The "stage is set" ambient bed: one sustained chord + root, looped once per
 * bar while Mutation Mode is idle, so a quiet page never reads as broken.
 * Pure — times are relative to the start of a bar.
 */
export function buildAmbientBed(profile: Pick<MusicProfile, "key" | "scale">): NoteEvent[] {
  const chordDegrees = [0, 2, 4];
  const pads: NoteEvent[] = chordDegrees.map((deg, i) => ({
    time: 0,
    duration: 3.6,
    pitch: degreeToMidi(profile.key, profile.scale, deg, 3),
    velocity: 0.16,
    instrument: "pad",
    pan: (i - 1) * 0.3,
    layer: "pad",
  }));
  const bass: NoteEvent = {
    time: 0,
    duration: 3.6,
    pitch: degreeToMidi(profile.key, profile.scale, 0, 1),
    velocity: 0.32,
    instrument: "bass",
    pan: 0,
    layer: "bass",
  };
  return [...pads, bass];
}

/** Sliding-window rate limiter: caps how many live events sound per second. */
export class LiveRateLimiter {
  private windowStart = 0;
  private count = 0;

  constructor(
    private readonly maxPerSecond: number,
    private readonly nowMs: () => number = () => Date.now()
  ) {}

  /** Returns true (and records the event) if under the cap; false if it should be dropped. */
  tryAdmit(): boolean {
    const now = this.nowMs();
    if (now - this.windowStart >= 1000) {
      this.windowStart = now;
      this.count = 0;
    }
    if (this.count >= this.maxPerSecond) return false;
    this.count++;
    return true;
  }
}

export const LIVE_MAX_EVENTS_PER_SECOND = 10;
