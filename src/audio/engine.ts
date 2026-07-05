import type { Score } from "../shared/types.js";
import { LookaheadScheduler } from "./scheduler.js";
import { playNote, type VoiceDestinations } from "./instruments.js";

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

/** 1.8 s decaying-noise impulse response — procedural, no assets. */
function makeImpulseResponse(ctx: BaseAudioContext): AudioBuffer {
  const seconds = 1.8;
  const rate = ctx.sampleRate;
  const len = Math.floor(seconds * rate);
  const buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4);
    }
  }
  return buf;
}

export class WseAudioEngine {
  private ctx: AudioContext | null = null;
  private scheduler: LookaheadScheduler | null = null;
  private master: GainNode | null = null;
  private currentScore: Score | null = null;
  private onEnded: (() => void) | null = null;

  async play(score: Score, opts: PlayOptions = {}): Promise<void> {
    await this.stop();
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.onEnded = opts.onEnded ?? null;

    const master = ctx.createGain();
    master.gain.value = 0.75;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 12;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.01;
    compressor.release.value = 0.2;
    master.connect(compressor);
    compressor.connect(ctx.destination);
    this.master = master;

    const reverb = ctx.createConvolver();
    reverb.buffer = makeImpulseResponse(ctx);
    const reverbReturn = ctx.createGain();
    // Reverb slider: 0 → nearly dry, 0.5 → the v0.1 default, 1 → washy.
    reverbReturn.gain.value = 0.15 + 1.3 * (opts.reverb ?? 0.5);
    reverb.connect(reverbReturn);
    reverbReturn.connect(master);

    const dest: VoiceDestinations = { dry: master, reverb, brightness: opts.brightness ?? 0.5 };

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

  async stop(): Promise<void> {
    this.scheduler?.stop();
    this.scheduler = null;
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
    if (!this.ctx || !this.scheduler) return { playing: false, position: 0 };
    return { playing: true, position: this.scheduler.position() };
  }

  getScore(): Score | null {
    return this.currentScore;
  }
}
