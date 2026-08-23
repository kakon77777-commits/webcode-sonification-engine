import type { LayerMixTuning, NoteLayer } from "../shared/types.js";
import { DEFAULT_LAYER_MIX } from "../shared/types.js";

export { DEFAULT_LAYER_MIX } from "../shared/types.js";
export type { LayerMixTuning } from "../shared/types.js";

export const LAYER_GAIN: Readonly<Record<NoteLayer, number>> = Object.freeze({
  pad: 0.82,
  bass: 0.78,
  melody: 1,
  arp: 0.72,
  bell: 0.66,
  perc: 0.72,
});

export type LayerBusMap = Readonly<Record<NoteLayer, GainNode>>;

function clampMixValue(value: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(1.25, Math.max(0, value));
}

export function resolveLayerMix(value?: Partial<LayerMixTuning>): LayerMixTuning {
  return {
    lowEnd: clampMixValue(value?.lowEnd ?? DEFAULT_LAYER_MIX.lowEnd, DEFAULT_LAYER_MIX.lowEnd),
    pad: clampMixValue(value?.pad ?? DEFAULT_LAYER_MIX.pad, DEFAULT_LAYER_MIX.pad),
    melody: clampMixValue(value?.melody ?? DEFAULT_LAYER_MIX.melody, DEFAULT_LAYER_MIX.melody),
    rhythm: clampMixValue(value?.rhythm ?? DEFAULT_LAYER_MIX.rhythm, DEFAULT_LAYER_MIX.rhythm),
  };
}

export function createLayerBuses(
  ctx: BaseAudioContext,
  target: AudioNode,
  mix?: Partial<LayerMixTuning>
): LayerBusMap {
  const resolved = resolveLayerMix(mix);
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
    const layerMix =
      layer === "pad"
        ? resolved.pad
        : layer === "bass"
          ? resolved.lowEnd
          : layer === "melody"
            ? resolved.melody
            : resolved.rhythm;
    bus.gain.value = LAYER_GAIN[layer] * layerMix;
    bus.connect(target);
  }

  return Object.freeze(buses);
}
