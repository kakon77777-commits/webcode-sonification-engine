import type { NoteEvent } from "../shared/types.js";

/**
 * Scroll-driven playback (§21–23, §45: "Scrolling Page = Vertical Score").
 *
 * Position is driven externally by scroll fraction instead of a real-time
 * clock: scrolling forward triggers any note whose onset falls in
 * (lastTime, newTime]; scrolling back is silent — no retrigger — until you
 * scroll forward past those notes again, like scrubbing a timeline. A single
 * big jump (e.g. "scroll to bottom") is thinned so it can't stack into an
 * instantaneous wall of sound.
 */

/** First index with events[idx].time > time. Events must be sorted by time. */
export function lowerBound(events: readonly NoteEvent[], time: number): number {
  let lo = 0;
  let hi = events.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (events[mid].time <= time) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Evenly thin a burst down to `cap` events — keeps its density's character without stacking. */
export function thinBurst<T>(batch: readonly T[], cap: number): T[] {
  if (batch.length <= cap || cap <= 0) return [...batch];
  const step = batch.length / cap;
  const out: T[] = [];
  for (let i = 0; i < cap; i++) out.push(batch[Math.floor(i * step)]);
  return out;
}

export const SCROLL_BURST_CAP = 24;

export class ScrollScheduler {
  private lastTime = 0;
  private idx = 0;

  constructor(
    /** Must be sorted by time — generateScore's output already is. */
    private readonly events: readonly NoteEvent[],
    private readonly onTrigger: (ev: NoteEvent) => void,
    private readonly burstCap: number = SCROLL_BURST_CAP
  ) {}

  /** Current score-time position, in seconds. */
  position(): number {
    return this.lastTime;
  }

  /** Move to a new score-time position (seconds), triggering any notes crossed while moving forward. */
  setTime(newTime: number): void {
    if (newTime > this.lastTime) {
      const batch: NoteEvent[] = [];
      while (this.idx < this.events.length && this.events[this.idx].time <= newTime) {
        batch.push(this.events[this.idx]);
        this.idx++;
      }
      for (const ev of thinBurst(batch, this.burstCap)) this.onTrigger(ev);
    } else if (newTime < this.lastTime) {
      this.idx = lowerBound(this.events, newTime);
    }
    this.lastTime = newTime;
  }

  reset(): void {
    this.lastTime = 0;
    this.idx = 0;
  }
}

/** Scroll fraction [0, 1] → score-time seconds. */
export function fractionToTime(fraction: number, lengthSec: number): number {
  return Math.max(0, Math.min(1, fraction)) * lengthSec;
}

/** Raw page scroll geometry → fraction [0, 1], safe against non-scrollable pages. */
export function scrollFraction(scrollY: number, scrollHeight: number, clientHeight: number): number {
  const max = Math.max(1, scrollHeight - clientHeight);
  return Math.max(0, Math.min(1, scrollY / max));
}
