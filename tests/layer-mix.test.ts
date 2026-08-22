import { describe, expect, it } from "vitest";
import type { NoteLayer } from "../src/shared/types.js";
import { createLayerBuses, LAYER_GAIN } from "../src/audio/layer-mix.js";

const LAYERS: readonly NoteLayer[] = ["pad", "bass", "melody", "arp", "bell", "perc"];

class FakeGainNode {
  gain = { value: 0 };
  connections: unknown[] = [];

  connect(target: unknown): void {
    this.connections.push(target);
  }
}

class FakeAudioContext {
  gains: FakeGainNode[] = [];

  createGain(): GainNode {
    const gain = new FakeGainNode();
    this.gains.push(gain);
    return gain as unknown as GainNode;
  }
}

describe("layer mix table", () => {
  it("defines finite gains for all structural note layers", () => {
    expect(Object.keys(LAYER_GAIN).sort()).toEqual([...LAYERS].sort());
    for (const layer of LAYERS) {
      expect(Number.isFinite(LAYER_GAIN[layer])).toBe(true);
      expect(LAYER_GAIN[layer]).toBeGreaterThan(0);
      expect(LAYER_GAIN[layer]).toBeLessThanOrEqual(1);
    }
  });

  it("keeps melody at unity gain", () => {
    expect(LAYER_GAIN.melody).toBe(1);
  });

  it("does not allow mutation through a caller-owned reference", () => {
    const alias = LAYER_GAIN as Record<NoteLayer, number>;
    expect(() => {
      alias.pad = 0.1;
    }).toThrow();
    expect(LAYER_GAIN.pad).toBe(0.82);
  });

  it("creates one gain bus per layer with the configured levels and a shared target", () => {
    const ctx = new FakeAudioContext() as unknown as BaseAudioContext;
    const target = { label: "master" } as unknown as AudioNode;
    const buses = createLayerBuses(ctx, target);

    expect(Object.keys(buses).sort()).toEqual([...LAYERS].sort());
    expect(new Set(Object.values(buses)).size).toBe(LAYERS.length);
    expect((ctx as unknown as FakeAudioContext).gains).toHaveLength(LAYERS.length);
    for (const layer of LAYERS) {
      const bus = buses[layer] as unknown as FakeGainNode;
      expect(bus.gain.value).toBe(LAYER_GAIN[layer]);
      expect(bus.connections).toEqual([target]);
    }
  });
});
