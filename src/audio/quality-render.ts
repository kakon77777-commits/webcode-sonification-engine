import type { InstrumentName, NoteEvent } from "../shared/types.js";
import { buildMasterGraph } from "./graph.js";
import { INSTRUMENT_CATALOG, playNote } from "./instruments.js";
import {
  isHealthyRender,
  measureRenderedChannels,
  type RenderMetrics,
} from "./render-metrics.js";

export interface VoiceRenderResult {
  instrument: InstrumentName;
  metrics: RenderMetrics;
  healthy: boolean;
}

export interface VoiceRenderOptions {
  sampleRate?: number;
  noteDuration?: number;
}

const DEFAULT_SAMPLE_RATE = 44100;
const DEFAULT_NOTE_DURATION = 0.8;
const NOTE_TIME = 0.05;
const TAIL_SEC = 3.0;
const QUALITY_SEED = 0x57455301;

const PERCUSSION: ReadonlySet<InstrumentName> = new Set(["kick", "hihat", "perc", "taiko"]);
const BASS: ReadonlySet<InstrumentName> = new Set(["bass", "subbass"]);
const PAD: ReadonlySet<InstrumentName> = new Set(["pad", "lowpad", "choir"]);
const ARP: ReadonlySet<InstrumentName> = new Set([
  "pluck",
  "guitar",
  "koto",
  "bell",
  "mallet",
  "marimba",
]);

export function qualityEventForInstrument(instrument: InstrumentName, index: number): NoteEvent {
  void index;
  return {
    time: NOTE_TIME,
    duration: DEFAULT_NOTE_DURATION,
    pitch: 60,
    velocity: 0.65,
    instrument,
    pan: 0,
    layer: PERCUSSION.has(instrument)
      ? "perc"
      : BASS.has(instrument)
        ? "bass"
        : PAD.has(instrument)
          ? "pad"
          : ARP.has(instrument)
            ? "arp"
            : "melody",
  };
}

export async function renderInstrumentCatalog(
  options: VoiceRenderOptions = {}
): Promise<VoiceRenderResult[]> {
  const sampleRate = options.sampleRate ?? DEFAULT_SAMPLE_RATE;
  const noteDuration = options.noteDuration ?? DEFAULT_NOTE_DURATION;
  const totalSec = NOTE_TIME + noteDuration + TAIL_SEC;

  const results: VoiceRenderResult[] = [];
  for (const [index, instrument] of INSTRUMENT_CATALOG.entries()) {
    const ctx = new OfflineAudioContext(2, Math.ceil(totalSec * sampleRate), sampleRate);
    const { dest } = buildMasterGraph(ctx, { seed: QUALITY_SEED + index });
    const event = { ...qualityEventForInstrument(instrument, index), duration: noteDuration };
    playNote(ctx, dest, event, event.time);

    const rendered = await ctx.startRendering();
    const channels = Array.from({ length: rendered.numberOfChannels }, (_, channel) =>
      rendered.getChannelData(channel)
    );
    const metrics = measureRenderedChannels(channels);
    results.push({
      instrument,
      metrics,
      healthy: isHealthyRender(metrics),
    });
  }

  return results;
}
