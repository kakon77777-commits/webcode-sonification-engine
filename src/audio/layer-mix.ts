import type { NoteLayer } from "../shared/types.js";

export const LAYER_GAIN: Readonly<Record<NoteLayer, number>> = Object.freeze({
  pad: 0.82,
  bass: 0.78,
  melody: 1,
  arp: 0.72,
  bell: 0.66,
  perc: 0.72,
});

export type LayerBusMap = Readonly<Record<NoteLayer, GainNode>>;

export function createLayerBuses(ctx: BaseAudioContext, target: AudioNode): LayerBusMap {
  const buses = {
    pad: ctx.createGain(),
    bass: ctx.createGain(),
    melody: ctx.createGain(),
    arp: ctx.createGain(),
    bell: ctx.createGain(),
    perc: ctx.createGain(),
  };

  for (const layer of Object.keys(buses) as NoteLayer[]) {
    const bus = buses[layer];
    bus.gain.value = LAYER_GAIN[layer];
    bus.connect(target);
  }

  return Object.freeze(buses);
}
