import type { NoteEvent } from "../shared/types.js";

/**
 * Lookahead scheduler (§ Task 8): a JS timer walks the sorted event list and
 * hands anything inside the lookahead horizon to the audio clock. The horizon
 * is generous (2.5 s) so even a throttled 1 Hz timer in a hidden document
 * never underruns.
 */

const TICK_MS = 400;
const HORIZON_SEC = 2.5;
const TAIL_SEC = 3.0; // let releases/reverb ring out before declaring the end

export class LookaheadScheduler {
  private idx = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private endTimer: ReturnType<typeof setTimeout> | null = null;
  private startCtxTime = 0;

  constructor(
    private readonly ctx: BaseAudioContext,
    private readonly events: readonly NoteEvent[],
    private readonly lengthSec: number,
    private readonly onEvent: (ev: NoteEvent, when: number) => void,
    private readonly onEnd?: () => void
  ) {}

  start(atCtxTime: number): void {
    this.startCtxTime = atCtxTime;
    this.tick();
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  /** Seconds into the score. */
  position(): number {
    return Math.max(0, this.ctx.currentTime - this.startCtxTime);
  }

  private tick(): void {
    const horizon = this.ctx.currentTime + HORIZON_SEC;
    while (this.idx < this.events.length) {
      const ev = this.events[this.idx];
      const when = this.startCtxTime + ev.time;
      if (when >= horizon) break;
      // Never schedule in the past (e.g. after heavy throttling).
      this.onEvent(ev, Math.max(when, this.ctx.currentTime + 0.01));
      this.idx++;
    }
    if (this.idx >= this.events.length && this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
      const remaining = this.startCtxTime + this.lengthSec + TAIL_SEC - this.ctx.currentTime;
      this.endTimer = setTimeout(() => this.onEnd?.(), Math.max(0, remaining * 1000));
    }
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    if (this.endTimer !== null) clearTimeout(this.endTimer);
    this.timer = null;
    this.endTimer = null;
  }
}
