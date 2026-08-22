import type { InstrumentName, NoteEvent, NoteLayer } from "../shared/types.js";
import { maxEventsPerSecond, maxSimultaneousVoices } from "./limits.js";

export interface ScoreMetrics {
  eventCount: number;
  durationSec: number;
  maxEventsPerSecond: number;
  maxSimultaneousVoices: number;
  layerCounts: Record<NoteLayer, number>;
  instrumentCounts: Partial<Record<InstrumentName, number>>;
}

const EMPTY_LAYER_COUNTS: Record<NoteLayer, number> = {
  pad: 0,
  bass: 0,
  melody: 0,
  arp: 0,
  bell: 0,
  perc: 0,
};

export function measureScore(events: readonly NoteEvent[], durationSec: number): ScoreMetrics {
  const layerCounts: Record<NoteLayer, number> = { ...EMPTY_LAYER_COUNTS };
  const instrumentCounts: Partial<Record<InstrumentName, number>> = {};
  const mutableEvents = [...events];

  for (const event of events) {
    layerCounts[event.layer] += 1;
    instrumentCounts[event.instrument] = (instrumentCounts[event.instrument] ?? 0) + 1;
  }

  return {
    eventCount: events.length,
    durationSec,
    maxEventsPerSecond: maxEventsPerSecond(mutableEvents),
    maxSimultaneousVoices: maxSimultaneousVoices(mutableEvents),
    layerCounts,
    instrumentCounts,
  };
}
