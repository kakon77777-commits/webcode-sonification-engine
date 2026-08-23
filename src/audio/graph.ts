import { setNoiseSeed, type VoiceDestinations } from "./instruments.js";
import { dampedNoiseSamples } from "./impulse.js";
import { createLayerBuses, type LayerBusMap, type LayerMixTuning } from "./layer-mix.js";

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
  /** Optional per-layer gain tuning shared by live and offline render paths. */
  mix?: Partial<LayerMixTuning>;
  /**
   * Seeds the reverb impulse response. Pass the score's fingerprint seed so
   * replaying or exporting the same score renders byte-identical audio —
   * without a seed the reverb "room" would differ (Math.random) on every play.
   */
  seed?: number;
}

export interface MasterGraph {
  master: GainNode;
  layerBuses: LayerBusMap;
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

/**
 * A gentle soft-knee clip curve for a WaveShaperNode: exact identity below
 * `threshold` (typical signal levels pass through completely unchanged),
 * tanh-curving only the portion above it (only the loudest peaks get
 * rounded off) — an analog-style "glue" rather than a hard digital ceiling.
 * Pure and deterministic — no AudioContext needed — so it's unit-testable.
 */
export function softClipCurve(threshold = 0.7, samples = 1024): Float32Array {
  const span = 1 - threshold;
  const curve = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1; // -1..1
    const ax = Math.abs(x);
    if (ax < threshold) {
      curve[i] = x;
    } else {
      const sign = x < 0 ? -1 : 1;
      const t = (ax - threshold) / span;
      curve[i] = sign * (threshold + span * Math.tanh(t));
    }
  }
  return curve;
}

export function buildMasterGraph(ctx: BaseAudioContext, opts: MasterGraphOptions = {}): MasterGraph {
  setNoiseSeed(ctx, opts.seed ?? 0);

  const master = ctx.createGain();
  master.gain.value = 0.75;

  // Mastering-style polish pass: warmth (low shelf) + air (high shelf), then
  // a gentle soft-clip that rounds off only the loudest peaks (analog-style
  // glue) before the compressor does its broader leveling.
  const warmth = ctx.createBiquadFilter();
  warmth.type = "lowshelf";
  warmth.frequency.value = 200;
  warmth.gain.value = 1.5;

  const air = ctx.createBiquadFilter();
  air.type = "highshelf";
  air.frequency.value = 9000;
  air.gain.value = 1.8;

  const saturator = ctx.createWaveShaper();
  // WaveShaperNode.curve's DOM type pins the buffer to ArrayBuffer; our plain
  // Float32Array is always ArrayBuffer-backed at runtime, so this cast is safe.
  saturator.curve = softClipCurve() as Float32Array<ArrayBuffer>;
  saturator.oversample = "2x";

  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -18;
  compressor.knee.value = 14;
  compressor.ratio.value = 2.8;
  compressor.attack.value = 0.008;
  compressor.release.value = 0.18;

  master.connect(warmth);
  warmth.connect(air);
  air.connect(saturator);
  saturator.connect(compressor);
  compressor.connect(ctx.destination);

  const reverb = ctx.createConvolver();
  reverb.buffer = makeImpulseResponse(ctx, opts.seed ?? 0);
  const reverbReturn = ctx.createGain();
  // Reverb slider: 0 → nearly dry, 0.5 → the v0.1 default, 1 → washy.
  reverbReturn.gain.value = 0.15 + 1.3 * (opts.reverb ?? 0.5);
  reverb.connect(reverbReturn);
  reverbReturn.connect(master);

  const layerBuses = createLayerBuses(ctx, master, opts.mix);
  const dest: VoiceDestinations = {
    dry: master,
    reverb,
    layerBuses,
    brightness: opts.brightness ?? 0.5,
  };
  return { master, layerBuses, dest };
}
