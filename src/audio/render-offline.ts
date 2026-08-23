import type { Score } from "../shared/types.js";
import { buildMasterGraph } from "./graph.js";
import { playNote } from "./instruments.js";
import type { LayerMixTuning } from "./layer-mix.js";

/**
 * Offline WAV render (v0.4, §52 Export): schedules the exact same score
 * through the exact same voice graph as live playback, but on an
 * OfflineAudioContext, which renders far faster than real time. Reusing
 * buildMasterGraph/playNote guarantees the exported WAV matches what you
 * actually heard, including structural layer-bus routing — no separate
 * "export path" to drift out of sync.
 *
 * Note on determinism: the reverb impulse response and percussion/breath
 * noise textures are seeded from the score's fingerprint (see graph.ts,
 * instruments.ts), so re-exporting the same score reproduces the same
 * musical content and the same "room". Two renders can still differ by ±1
 * of 32768 on a small fraction of samples — floating-point summation order
 * inside the browser's own convolution/filter DSP, not application state —
 * far below the noise floor and not worth chasing further.
 */

export interface RenderOptions {
  /** 0…1 timbre brightness (0.5 = neutral). */
  brightness?: number;
  /** 0…1 reverb amount (0.5 = neutral). */
  reverb?: number;
  /** Optional per-layer gain tuning shared with live playback. */
  mix?: Partial<LayerMixTuning>;
  /** Output sample rate. Defaults to 44100 (standard WAV). */
  sampleRate?: number;
}

const LEAD_IN_SEC = 0.05;
const TAIL_SEC = 3.0; // let the last release/reverb ring out before truncating

export async function renderScoreOffline(score: Score, opts: RenderOptions = {}): Promise<AudioBuffer> {
  const sampleRate = opts.sampleRate ?? 44100;
  const totalSec = score.profile.lengthSec + LEAD_IN_SEC + TAIL_SEC;
  const ctx = new OfflineAudioContext(2, Math.ceil(totalSec * sampleRate), sampleRate);
  const { dest } = buildMasterGraph(ctx, {
    brightness: opts.brightness,
    reverb: opts.reverb,
    mix: opts.mix,
    seed: score.fingerprint.seed,
  });
  for (const ev of score.events) {
    playNote(ctx, dest, ev, ev.time + LEAD_IN_SEC);
  }
  return ctx.startRendering();
}
