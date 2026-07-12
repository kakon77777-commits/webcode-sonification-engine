import type { InstrumentName, NoteEvent } from "../shared/types.js";
import { mulberry32 } from "../mapping/deterministic-seed.js";

/**
 * v0.1 synth voices (§ Task 9): oscillators + gain + filter + simple envelopes.
 * No sample libraries. Each instrument shapes articulation, register and
 * envelope — a profile is not just a different soundfont (§48).
 */

export interface VoiceDestinations {
  dry: AudioNode;
  reverb: AudioNode;
  /** 0…1 timbre brightness from the user slider (0.5 = neutral). */
  brightness?: number;
}

/** Per-instrument reverb send levels. */
const REVERB_SEND: Record<InstrumentName, number> = {
  pad: 0.5,
  lowpad: 0.45,
  strings: 0.4,
  piano: 0.18,
  epiano: 0.25,
  pluck: 0.3,
  bell: 0.6,
  mallet: 0.35,
  bass: 0.05,
  brass: 0.3,
  lead: 0.2,
  flute: 0.35,
  xiao: 0.45,
  guitar: 0.18,
  kick: 0.03,
  hihat: 0.08,
  perc: 0.25,
  taiko: 0.2,
};

/** Brightness slider → filter-cutoff multiplier (0.55×…1.45×). */
function brightScale(dest: VoiceDestinations): number {
  return 0.55 + 0.9 * (dest.brightness ?? 0.5);
}

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

let noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();
let noiseSeeds = new WeakMap<BaseAudioContext, number>();

/**
 * Seeds the shared per-context noise buffer (percussion transients, breath
 * textures) so identical scores render byte-identical audio. Call this
 * before the first playNote() on a given context — buildMasterGraph() does.
 */
export function setNoiseSeed(ctx: BaseAudioContext, seed: number): void {
  noiseSeeds.set(ctx, seed);
}

function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  let buf = noiseCache.get(ctx);
  if (!buf) {
    // XOR with a fixed constant so this noise stream doesn't correlate with
    // the reverb impulse response, which is seeded from the same score seed.
    const rng = mulberry32((noiseSeeds.get(ctx) ?? 0) ^ 0x2545f491);
    buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = rng() * 2 - 1;
    noiseCache.set(ctx, buf);
  }
  return buf;
}

interface VoiceChain {
  out: GainNode;
  stopAt: number;
}

/** Build the shared tail: envelope gain → panner → dry, plus a reverb send. */
function makeOutput(ctx: BaseAudioContext, dest: VoiceDestinations, ev: NoteEvent): GainNode {
  const env = ctx.createGain();
  env.gain.value = 0;
  const panner = ctx.createStereoPanner();
  panner.pan.value = ev.pan;
  env.connect(panner);
  panner.connect(dest.dry);
  const send = ctx.createGain();
  send.gain.value = REVERB_SEND[ev.instrument] ?? 0.2;
  panner.connect(send);
  send.connect(dest.reverb);
  return env;
}

function adsr(
  env: GainNode,
  when: number,
  peak: number,
  attack: number,
  duration: number,
  release: number,
  sustainLevel = 0.7
): number {
  const g = env.gain;
  g.setValueAtTime(0, when);
  g.linearRampToValueAtTime(peak, when + attack);
  const sustainTime = Math.max(when + attack, when + duration);
  g.setValueAtTime(peak * sustainLevel, sustainTime);
  g.linearRampToValueAtTime(0.0001, sustainTime + release);
  return sustainTime + release + 0.05;
}

function expDecay(env: GainNode, when: number, peak: number, decay: number): number {
  const g = env.gain;
  g.setValueAtTime(peak, when);
  g.exponentialRampToValueAtTime(0.0005, when + decay);
  g.linearRampToValueAtTime(0, when + decay + 0.02);
  return when + decay + 0.05;
}

function osc(
  ctx: BaseAudioContext,
  type: OscillatorType,
  freq: number,
  when: number,
  stopAt: number,
  detuneCents = 0
): OscillatorNode {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  if (detuneCents !== 0) o.detune.value = detuneCents;
  o.start(when);
  o.stop(stopAt);
  return o;
}

function lowpass(ctx: BaseAudioContext, cutoff: number, q = 0.8): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = cutoff;
  f.Q.value = q;
  return f;
}

type VoiceBuilder = (
  ctx: BaseAudioContext,
  env: GainNode,
  ev: NoteEvent,
  when: number,
  bright: number
) => VoiceChain;

const padVoice =
  (cutoffBase: number): VoiceBuilder =>
  (ctx, env, ev, when, bright) => {
    const freq = midiToFreq(ev.pitch);
    const attack = Math.min(1.2, ev.duration * 0.3);
    const release = 1.4;
    const stopAt = adsr(env, when, ev.velocity * 0.28, attack, ev.duration, release, 0.8);
    const filter = lowpass(ctx, (cutoffBase + ev.velocity * 2200) * bright);
    filter.connect(env);
    osc(ctx, "sawtooth", freq, when, stopAt, -7).connect(filter);
    osc(ctx, "sawtooth", freq, when, stopAt, +7).connect(filter);
    return { out: env, stopAt };
  };

const VOICES: Record<InstrumentName, VoiceBuilder> = {
  pad: padVoice(700),
  lowpad: padVoice(420),

  strings: (ctx, env, ev, when, bright) => {
    const freq = midiToFreq(ev.pitch);
    const stopAt = adsr(env, when, ev.velocity * 0.3, 0.12, ev.duration, 0.5, 0.85);
    const filter = lowpass(ctx, (1100 + ev.velocity * 1800) * bright, 0.7);
    filter.connect(env);
    const o = osc(ctx, "sawtooth", freq, when, stopAt);
    o.connect(filter);
    // Gentle vibrato.
    const lfo = osc(ctx, "sine", 5, when, stopAt);
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 5; // cents
    lfo.connect(lfoGain);
    lfoGain.connect(o.detune);
    return { out: env, stopAt };
  },

  piano: (ctx, env, ev, when, bright) => {
    const freq = midiToFreq(ev.pitch);
    const decay = Math.min(2.2, 0.5 + ev.duration);
    const stopAt = expDecay(env, when + 0.004, ev.velocity * 0.5, decay);
    const filter = lowpass(ctx, (2200 + ev.velocity * 3000) * bright, 0.5);
    filter.connect(env);
    osc(ctx, "triangle", freq, when, stopAt).connect(filter);
    const partial = ctx.createGain();
    partial.gain.value = 0.18;
    partial.connect(filter);
    osc(ctx, "sine", freq * 2, when, stopAt).connect(partial);
    return { out: env, stopAt };
  },

  epiano: (ctx, env, ev, when) => {
    const freq = midiToFreq(ev.pitch);
    const decay = Math.min(2.5, 0.8 + ev.duration);
    const stopAt = expDecay(env, when + 0.008, ev.velocity * 0.42, decay);
    osc(ctx, "sine", freq, when, stopAt).connect(env);
    const partial = ctx.createGain();
    partial.gain.value = 0.08;
    partial.connect(env);
    osc(ctx, "sine", freq * 3, when, stopAt).connect(partial);
    return { out: env, stopAt };
  },

  pluck: (ctx, env, ev, when, bright) => {
    const freq = midiToFreq(ev.pitch);
    const decay = Math.min(0.5, 0.1 + ev.duration * 0.4);
    const stopAt = expDecay(env, when + 0.003, ev.velocity * 0.4, decay);
    const filter = lowpass(ctx, 2600 * bright, 1);
    filter.connect(env);
    osc(ctx, "triangle", freq, when, stopAt).connect(filter);
    return { out: env, stopAt };
  },

  bell: (ctx, env, ev, when) => {
    const freq = midiToFreq(ev.pitch);
    const decay = 2.4;
    const stopAt = expDecay(env, when + 0.005, ev.velocity * 0.35, decay);
    // Small FM pair — classic bell-ish inharmonicity.
    const carrier = osc(ctx, "sine", freq, when, stopAt);
    const mod = osc(ctx, "sine", freq * 3.53, when, stopAt);
    const modGain = ctx.createGain();
    modGain.gain.setValueAtTime(freq * 2.2, when);
    modGain.gain.exponentialRampToValueAtTime(1, when + decay * 0.6);
    mod.connect(modGain);
    modGain.connect(carrier.frequency);
    carrier.connect(env);
    const shimmer = ctx.createGain();
    shimmer.gain.value = 0.12;
    shimmer.connect(env);
    osc(ctx, "sine", freq * 2.76, when, stopAt).connect(shimmer);
    return { out: env, stopAt };
  },

  mallet: (ctx, env, ev, when) => {
    const freq = midiToFreq(ev.pitch);
    const stopAt = expDecay(env, when + 0.003, ev.velocity * 0.4, 0.5);
    osc(ctx, "sine", freq, when, stopAt).connect(env);
    const click = ctx.createBufferSource();
    click.buffer = noiseBuffer(ctx);
    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(ev.velocity * 0.06, when);
    clickGain.gain.exponentialRampToValueAtTime(0.0005, when + 0.03);
    click.connect(clickGain);
    clickGain.connect(env);
    click.start(when);
    click.stop(when + 0.04);
    return { out: env, stopAt };
  },

  bass: (ctx, env, ev, when) => {
    const freq = midiToFreq(ev.pitch);
    const stopAt = adsr(env, when, ev.velocity * 0.5, 0.015, ev.duration * 0.8, 0.25, 0.6);
    const filter = lowpass(ctx, 480, 0.7);
    filter.connect(env);
    osc(ctx, "triangle", freq, when, stopAt).connect(filter);
    const sub = ctx.createGain();
    sub.gain.value = 0.5;
    sub.connect(filter);
    osc(ctx, "sine", freq / 2, when, stopAt).connect(sub);
    return { out: env, stopAt };
  },

  brass: (ctx, env, ev, when, bright) => {
    const freq = midiToFreq(ev.pitch);
    const stopAt = adsr(env, when, ev.velocity * 0.34, 0.07, ev.duration, 0.3, 0.8);
    const filter = lowpass(ctx, 400, 1.2);
    filter.frequency.setValueAtTime(400, when);
    filter.frequency.linearRampToValueAtTime((1800 + ev.velocity * 1500) * bright, when + 0.1);
    filter.connect(env);
    osc(ctx, "sawtooth", freq, when, stopAt).connect(filter);
    return { out: env, stopAt };
  },

  lead: (ctx, env, ev, when, bright) => {
    const freq = midiToFreq(ev.pitch);
    const stopAt = adsr(env, when, ev.velocity * 0.3, 0.02, ev.duration, 0.18, 0.75);
    const filter = lowpass(ctx, 2800 * bright, 1.1);
    filter.connect(env);
    osc(ctx, "square", freq, when, stopAt, -4).connect(filter);
    osc(ctx, "sawtooth", freq, when, stopAt, +4).connect(filter);
    return { out: env, stopAt };
  },

  flute: (ctx, env, ev, when, bright) => {
    const freq = midiToFreq(ev.pitch);
    const stopAt = adsr(env, when, ev.velocity * 0.32, 0.09, ev.duration, 0.35, 0.85);
    const filter = lowpass(ctx, 3200 * bright, 0.6);
    filter.connect(env);
    const o = osc(ctx, "sine", freq, when, stopAt);
    o.connect(filter);
    // Delayed-onset vibrato — flutes settle into the note first.
    const lfo = osc(ctx, "sine", 5.2, when, stopAt);
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(0, when);
    lfoGain.gain.linearRampToValueAtTime(8, when + 0.35); // cents
    lfo.connect(lfoGain);
    lfoGain.connect(o.detune);
    // Breath: quiet band-passed noise around the fundamental's octave.
    const breath = ctx.createBufferSource();
    breath.buffer = noiseBuffer(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = Math.min(6000, freq * 2);
    bp.Q.value = 2;
    const bGain = ctx.createGain();
    bGain.gain.value = ev.velocity * 0.045;
    breath.connect(bp);
    bp.connect(bGain);
    bGain.connect(env);
    breath.start(when);
    breath.stop(stopAt);
    return { out: env, stopAt };
  },

  // 蕭 — darker, breathier vertical flute: slow attack, pitch scoop, deep vibrato.
  xiao: (ctx, env, ev, when, bright) => {
    const freq = midiToFreq(ev.pitch);
    const stopAt = adsr(env, when, ev.velocity * 0.34, 0.14, ev.duration, 0.5, 0.85);
    const filter = lowpass(ctx, 1900 * bright, 0.7);
    filter.connect(env);
    const o = ctx.createOscillator();
    o.type = "sine";
    // Onset scoop: start slightly flat and slide into pitch.
    o.frequency.setValueAtTime(freq * 0.982, when);
    o.frequency.linearRampToValueAtTime(freq, when + 0.13);
    o.connect(filter);
    o.start(when);
    o.stop(stopAt);
    const body = ctx.createGain();
    body.gain.value = 0.12;
    body.connect(filter);
    osc(ctx, "triangle", freq, when, stopAt).connect(body);
    const lfo = osc(ctx, "sine", 4.4, when, stopAt);
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(0, when);
    lfoGain.gain.linearRampToValueAtTime(11, when + 0.4); // cents — deeper than flute
    lfo.connect(lfoGain);
    lfoGain.connect(o.detune);
    const breath = ctx.createBufferSource();
    breath.buffer = noiseBuffer(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = Math.min(4500, freq * 1.5);
    bp.Q.value = 3;
    const bGain = ctx.createGain();
    bGain.gain.value = ev.velocity * 0.07;
    breath.connect(bp);
    bp.connect(bGain);
    bGain.connect(env);
    breath.start(when);
    breath.stop(stopAt);
    return { out: env, stopAt };
  },

  // Karplus-Strong plucked string: noise burst into a tuned feedback delay.
  guitar: (ctx, env, ev, when, bright) => {
    const freq = midiToFreq(ev.pitch);
    const ringSec = Math.min(2.2, 0.6 + ev.duration);
    const stopAt = when + ringSec + 0.3;
    env.gain.setValueAtTime(ev.velocity * 0.55, when);
    env.gain.setValueAtTime(ev.velocity * 0.55, when + ringSec * 0.7);
    env.gain.linearRampToValueAtTime(0, when + ringSec);

    const burst = ctx.createBufferSource();
    burst.buffer = noiseBuffer(ctx);
    const burstGain = ctx.createGain();
    burstGain.gain.setValueAtTime(1, when);
    burstGain.gain.exponentialRampToValueAtTime(0.001, when + 0.012);
    burst.connect(burstGain);
    burst.start(when);
    burst.stop(when + 0.02);

    const delay = ctx.createDelay(1);
    delay.delayTime.value = 1 / freq;
    const damp = lowpass(ctx, Math.min(6500, freq * 6 * bright), 0.4);
    const feedback = ctx.createGain();
    // Loop gain tuned so the string rings out over ~ringSec, then is killed.
    feedback.gain.setValueAtTime(Math.pow(0.001, 1 / (freq * ringSec)), when);
    feedback.gain.setValueAtTime(0, when + ringSec + 0.05); // break the cycle
    burstGain.connect(delay);
    delay.connect(damp);
    damp.connect(feedback);
    feedback.connect(delay);
    damp.connect(env);
    return { out: env, stopAt };
  },

  // 太鼓 — deep drum: pitch-dropping sine body + low noise thump.
  taiko: (ctx, env, ev, when) => {
    const deep = ev.pitch <= 35;
    const stopAt = expDecay(env, when, ev.velocity * (deep ? 1.0 : 0.7), deep ? 0.55 : 0.35);
    const o = ctx.createOscillator();
    o.type = "sine";
    const base = deep ? 42 : 60;
    o.frequency.setValueAtTime(base * 2.4, when);
    o.frequency.exponentialRampToValueAtTime(base, when + 0.16);
    o.connect(env);
    o.start(when);
    o.stop(stopAt);
    const thump = ctx.createBufferSource();
    thump.buffer = noiseBuffer(ctx);
    const lp = lowpass(ctx, 320, 0.7);
    const tGain = ctx.createGain();
    tGain.gain.setValueAtTime(ev.velocity * 0.35, when);
    tGain.gain.exponentialRampToValueAtTime(0.001, when + 0.07);
    thump.connect(lp);
    lp.connect(tGain);
    tGain.connect(env);
    thump.start(when);
    thump.stop(when + 0.1);
    return { out: env, stopAt };
  },

  kick: (ctx, env, ev, when) => {
    const stopAt = expDecay(env, when, ev.velocity * 0.9, 0.28);
    const o = ctx.createOscillator();
    o.type = "sine";
    const base = ev.pitch <= 34 ? 34 : 45; // orchestral low drum vs. electronic kick
    o.frequency.setValueAtTime(base * 3, when);
    o.frequency.exponentialRampToValueAtTime(base, when + 0.11);
    o.connect(env);
    o.start(when);
    o.stop(stopAt);
    return { out: env, stopAt };
  },

  hihat: (ctx, env, ev, when) => {
    const stopAt = expDecay(env, when, ev.velocity * 0.28, 0.06);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx);
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 7000;
    src.connect(hp);
    hp.connect(env);
    src.start(when);
    src.stop(when + 0.08);
    return { out: env, stopAt };
  },

  perc: (ctx, env, ev, when) => {
    const stopAt = expDecay(env, when, ev.velocity * 0.5, 0.16);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = Math.min(4000, midiToFreq(ev.pitch) * 8);
    bp.Q.value = 1.5;
    src.connect(bp);
    bp.connect(env);
    src.start(when);
    src.stop(when + 0.2);
    return { out: env, stopAt };
  },
};

/** Schedule one NoteEvent at absolute AudioContext time `when`. */
export function playNote(
  ctx: BaseAudioContext,
  dest: VoiceDestinations,
  ev: NoteEvent,
  when: number
): void {
  const env = makeOutput(ctx, dest, ev);
  const builder = VOICES[ev.instrument] ?? VOICES.pluck;
  builder(ctx, env, ev, when, brightScale(dest));
}
