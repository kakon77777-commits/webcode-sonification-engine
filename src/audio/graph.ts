import { setNoiseSeed, type VoiceDestinations } from "./instruments.js";
import { dampedNoiseSamples } from "./impulse.js";

/**
 * Shared master audio graph: master gain → compressor → destination, plus a
 * procedural reverb send. Used by both live playback (AudioContext) and
 * offline WAV rendering (OfflineAudioContext) — both are BaseAudioContext,
 * so the exact same graph-building code produces byte-identical routing.
 */

export interface MasterGraphOptions {
  /** 0…1 timbre brightness (0.5 = neutral). */
  brightness?: number;
  /** 0…1 reverb amount (0.5 = neutral). */
  reverb?: number;
  /**
   * Seeds the reverb impulse response. Pass the score's fingerprint seed so
   * replaying or exporting the same score renders byte-identical audio —
   * without a seed the reverb "room" would differ (Math.random) on every play.
   */
  seed?: number;
}

export interface MasterGraph {
  master: GainNode;
  dest: VoiceDestinations;
}

/** 1.8 s decaying-noise impulse response — procedural, no assets, deterministic per seed. */
function makeImpulseResponse(ctx: BaseAudioContext, seed: number): AudioBuffer {
  const seconds = 1.8;
  const rate = ctx.sampleRate;
  const len = Math.floor(seconds * rate);
  const buf = ctx.createBuffer(2, len, rate);
  // Independent-but-deterministic seeds per channel for a wide stereo image.
  buf.getChannelData(0).set(dampedNoiseSamples(len, seed));
  buf.getChannelData(1).set(dampedNoiseSamples(len, (seed ^ 0x9e3779b9) >>> 0));
  return buf;
}

export function buildMasterGraph(ctx: BaseAudioContext, opts: MasterGraphOptions = {}): MasterGraph {
  setNoiseSeed(ctx, opts.seed ?? 0);

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

  const reverb = ctx.createConvolver();
  reverb.buffer = makeImpulseResponse(ctx, opts.seed ?? 0);
  const reverbReturn = ctx.createGain();
  // Reverb slider: 0 → nearly dry, 0.5 → the v0.1 default, 1 → washy.
  reverbReturn.gain.value = 0.15 + 1.3 * (opts.reverb ?? 0.5);
  reverb.connect(reverbReturn);
  reverbReturn.connect(master);

  const dest: VoiceDestinations = { dry: master, reverb, brightness: opts.brightness ?? 0.5 };
  return { master, dest };
}
