import type { Score } from "../shared/types.js";
import { LookaheadScheduler } from "./scheduler.js";
import { ScrollScheduler } from "./scroll-scheduler.js";
import { playNote } from "./instruments.js";
import { buildMasterGraph } from "./graph.js";

/**
 * Audio engine: master chain (gain → compressor → destination) plus a shared
 * procedural reverb. A fresh AudioContext is created per playback and torn
 * down on stop — simple and leak-free.
 */

export interface EngineState {
  playing: boolean;
  position: number;
}

export interface PlayOptions {
  /** 0…1 timbre brightness (0.5 = neutral). */
  brightness?: number;
  /** 0…1 reverb amount (0.5 = neutral). */
  reverb?: number;
  onEnded?: () => void;
}

export class WseAudioEngine {
  private ctx: AudioContext | null = null;
  private scheduler: LookaheadScheduler | null = null;
  private scrollScheduler: ScrollScheduler | null = null;
  private master: GainNode | null = null;
  private currentScore: Score | null = null;
  private onEnded: (() => void) | null = null;

  async play(score: Score, opts: PlayOptions = {}): Promise<void> {
    await this.stop();
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.onEnded = opts.onEnded ?? null;

    const { master, dest } = buildMasterGraph(ctx, {
      brightness: opts.brightness,
      reverb: opts.reverb,
      seed: score.fingerprint.seed,
    });
    this.master = master;

    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    this.currentScore = score;
    const scheduler = new LookaheadScheduler(
      ctx,
      score.events,
      score.profile.lengthSec,
      (ev, when) => playNote(ctx, dest, ev, when),
      () => {
        void this.stop();
        this.onEnded?.();
      }
    );
    this.scheduler = scheduler;
    scheduler.start(ctx.currentTime + 0.15);
  }

  /**
   * Scroll Mode (§45, "Scrolling Page = Vertical Score"): builds the audio
   * graph but does not auto-advance. Drive it with setScrollFraction() as
   * the analyzed page scrolls — the score's own timeline never runs on a
   * real-time clock in this mode.
   */
  async startScrollMode(score: Score, opts: PlayOptions = {}): Promise<void> {
    await this.stop();
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.onEnded = opts.onEnded ?? null;

    const { master, dest } = buildMasterGraph(ctx, {
      brightness: opts.brightness,
      reverb: opts.reverb,
      seed: score.fingerprint.seed,
    });
    this.master = master;

    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    this.currentScore = score;
    this.scrollScheduler = new ScrollScheduler(score.events, (ev) =>
      playNote(ctx, dest, ev, ctx.currentTime + 0.01)
    );
  }

  /** Drive Scroll Mode. fraction is the page's scroll position in [0, 1]. */
  setScrollFraction(fraction: number): void {
    if (!this.scrollScheduler || !this.currentScore) return;
    const clamped = Math.max(0, Math.min(1, fraction));
    this.scrollScheduler.setTime(clamped * this.currentScore.profile.lengthSec);
  }

  async stop(): Promise<void> {
    this.scheduler?.stop();
    this.scheduler = null;
    this.scrollScheduler = null;
    this.currentScore = null;
    const ctx = this.ctx;
    const master = this.master;
    this.ctx = null;
    this.master = null;
    if (ctx) {
      try {
        if (master && ctx.state === "running") {
          // Short fade to avoid a click on stop.
          master.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
          await new Promise((r) => setTimeout(r, 120));
        }
        await ctx.close();
      } catch {
        // Context already closed — fine.
      }
    }
  }

  getState(): EngineState {
    if (this.scrollScheduler) {
      return { playing: this.ctx !== null, position: this.scrollScheduler.position() };
    }
    if (!this.ctx || !this.scheduler) return { playing: false, position: 0 };
    return { playing: true, position: this.scheduler.position() };
  }

  getScore(): Score | null {
    return this.currentScore;
  }
}
