import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_LAYER_MIX } from "../src/audio/layer-mix.js";
import { buildMasterGraph } from "../src/audio/graph.js";
import { encodeScoreAsMidi } from "../src/audio/midi-encode.js";
import type { Score } from "../src/shared/types.js";

const score: Score = {
  version: 1,
  fingerprint: {
    version: 1,
    hash: "feedfacecafebeef",
    seed: 1234,
  },
  variation: 0,
  profile: {
    key: 0,
    keyName: "C",
    scale: "major",
    bpm: 120,
    style: "ambient",
    mode: "musical",
    lengthSec: 4,
    barCount: 2,
    sections: [],
    character: "content",
    explain: [],
  },
  events: [
    {
      time: 0,
      duration: 0.5,
      pitch: 60,
      velocity: 0.75,
      instrument: "pad",
      pan: 0,
      layer: "pad",
    },
  ],
};

class FakeParam {
  value = 0;
}

class FakeAudioBuffer {
  constructor(
    readonly numberOfChannels: number,
    readonly length: number,
    readonly sampleRate: number
  ) {}

  getChannelData(_channel: number): Float32Array {
    return new Float32Array(this.length);
  }
}

class FakeNode {
  connections: unknown[] = [];

  connect(target: unknown): void {
    this.connections.push(target);
  }
}

class FakeGainNode extends FakeNode {
  gain = new FakeParam();
}

class FakeBiquadFilterNode extends FakeNode {
  type: BiquadFilterType = "lowpass";
  frequency = new FakeParam();
  gain = new FakeParam();
}

class FakeWaveShaperNode extends FakeNode {
  curve: Float32Array<ArrayBuffer> | null = null;
  oversample: OverSampleType = "none";
}

class FakeDynamicsCompressorNode extends FakeNode {
  threshold = new FakeParam();
  knee = new FakeParam();
  ratio = new FakeParam();
  attack = new FakeParam();
  release = new FakeParam();
}

class FakeConvolverNode extends FakeNode {
  buffer: AudioBuffer | null = null;
}

class FakeBaseAudioContext {
  readonly destination = new FakeNode() as unknown as AudioNode;
  readonly sampleRate = 44100;

  createGain(): GainNode {
    return new FakeGainNode() as unknown as GainNode;
  }

  createBiquadFilter(): BiquadFilterNode {
    return new FakeBiquadFilterNode() as unknown as BiquadFilterNode;
  }

  createWaveShaper(): WaveShaperNode {
    return new FakeWaveShaperNode() as unknown as WaveShaperNode;
  }

  createDynamicsCompressor(): DynamicsCompressorNode {
    return new FakeDynamicsCompressorNode() as unknown as DynamicsCompressorNode;
  }

  createConvolver(): ConvolverNode {
    return new FakeConvolverNode() as unknown as ConvolverNode;
  }

  createBuffer(channels: number, length: number, sampleRate: number): AudioBuffer {
    return new FakeAudioBuffer(channels, length, sampleRate) as unknown as AudioBuffer;
  }
}

class FakeOfflineAudioContext extends FakeBaseAudioContext {
  constructor(
    readonly numberOfChannels: number,
    readonly length: number,
    sampleRate: number
  ) {
    super();
    Object.defineProperty(this, "sampleRate", { value: sampleRate });
  }

  startRendering(): Promise<AudioBuffer> {
    return Promise.resolve(
      new FakeAudioBuffer(this.numberOfChannels, this.length, this.sampleRate) as unknown as AudioBuffer
    );
  }
}

describe("mix propagation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("uses default layer mix gains when mix is omitted", () => {
    const ctx = new FakeBaseAudioContext() as unknown as BaseAudioContext;
    const { layerBuses } = buildMasterGraph(ctx);

    expect((layerBuses.pad as unknown as FakeGainNode).gain.value).toBeCloseTo(0.82 * DEFAULT_LAYER_MIX.pad);
    expect((layerBuses.bass as unknown as FakeGainNode).gain.value).toBeCloseTo(0.78 * DEFAULT_LAYER_MIX.lowEnd);
    expect((layerBuses.melody as unknown as FakeGainNode).gain.value).toBeCloseTo(1 * DEFAULT_LAYER_MIX.melody);
    expect((layerBuses.arp as unknown as FakeGainNode).gain.value).toBeCloseTo(0.72 * DEFAULT_LAYER_MIX.rhythm);
  });

  it("preserves unspecified layer mix values while applying partial overrides", () => {
    const ctx = new FakeBaseAudioContext() as unknown as BaseAudioContext;
    const { layerBuses } = buildMasterGraph(ctx, { mix: { lowEnd: 0.5 } });

    expect((layerBuses.bass as unknown as FakeGainNode).gain.value).toBeCloseTo(0.78 * 0.5);
    expect((layerBuses.pad as unknown as FakeGainNode).gain.value).toBeCloseTo(0.82 * DEFAULT_LAYER_MIX.pad);
    expect((layerBuses.melody as unknown as FakeGainNode).gain.value).toBeCloseTo(1 * DEFAULT_LAYER_MIX.melody);
    expect((layerBuses.perc as unknown as FakeGainNode).gain.value).toBeCloseTo(0.72 * DEFAULT_LAYER_MIX.rhythm);
  });

  it("forwards mix into offline rendering", async () => {
    vi.stubGlobal("OfflineAudioContext", FakeOfflineAudioContext);
    const graphModule = await import("../src/audio/graph.js");
    const buildSpy = vi.spyOn(graphModule, "buildMasterGraph").mockReturnValue({
      master: new FakeGainNode() as unknown as GainNode,
      layerBuses: {} as ReturnType<typeof buildMasterGraph>["layerBuses"],
      dest: { dry: {}, reverb: {}, layerBuses: {}, brightness: 0.5 } as ReturnType<typeof buildMasterGraph>["dest"],
    });
    vi.spyOn(await import("../src/audio/instruments.js"), "playNote").mockImplementation(() => {});
    const { renderScoreOffline } = await import("../src/audio/render-offline.js");

    await renderScoreOffline(score, { mix: { lowEnd: 0.55, rhythm: 0.8 } });

    expect(buildSpy).toHaveBeenCalledWith(
      expect.any(FakeOfflineAudioContext),
      expect.objectContaining({
        seed: score.fingerprint.seed,
        mix: { lowEnd: 0.55, rhythm: 0.8 },
      })
    );
  });

  it("passes mix through the WAV export path but leaves MIDI bytes unchanged", async () => {
    const { encodeScore } = await import("../src/audio/export-registry.js");
    const midiWithoutMix = await encodeScore(score, "midi");
    const midiWithMix = await encodeScore(score, "midi", { mix: { lowEnd: 0.4, pad: 1.1 } });
    const expectedMidi = encodeScoreAsMidi(score);
    const renderSpy = vi
      .spyOn(await import("../src/audio/render-offline.js"), "renderScoreOffline")
      .mockResolvedValue(new FakeAudioBuffer(2, 32, 44100) as unknown as AudioBuffer);
    const wavSpy = vi.spyOn(await import("../src/audio/wav-encode.js"), "encodeWav").mockReturnValue(new ArrayBuffer(16));

    await encodeScore(score, "wav", { mix: { lowEnd: 0.4, pad: 1.1 }, sampleRate: 48000 });

    expect(new Uint8Array(midiWithoutMix.bytes)).toEqual(new Uint8Array(expectedMidi));
    expect(new Uint8Array(midiWithMix.bytes)).toEqual(new Uint8Array(expectedMidi));
    expect(renderSpy).toHaveBeenCalledWith(
      score,
      expect.objectContaining({ mix: { lowEnd: 0.4, pad: 1.1 }, sampleRate: 48000 })
    );
    expect(wavSpy).toHaveBeenCalledTimes(1);
  });

  it("passes mix through engine auto, scroll, and live play modes", async () => {
    vi.stubGlobal(
      "AudioContext",
      class {
        state: AudioContextState = "running";
        currentTime = 0;

        resume(): Promise<void> {
          return Promise.resolve();
        }

        close(): Promise<void> {
          return Promise.resolve();
        }
      }
    );
    vi.doMock("../src/audio/scheduler.js", () => ({
      LookaheadScheduler: class {
        start(): void {}
        stop(): void {}
        position(): number {
          return 0;
        }
      },
    }));
    vi.doMock("../src/audio/scroll-scheduler.js", () => ({
      ScrollScheduler: class {
        setTime(): void {}
        position(): number {
          return 0;
        }
      },
    }));
    vi.doMock("../src/audio/instruments.js", () => ({
      playNote: vi.fn(),
    }));

    const graphModule = await import("../src/audio/graph.js");
    const buildSpy = vi.spyOn(graphModule, "buildMasterGraph").mockReturnValue({
      master: {
        gain: { setTargetAtTime: vi.fn() },
      } as unknown as GainNode,
      layerBuses: {} as ReturnType<typeof buildMasterGraph>["layerBuses"],
      dest: { dry: {}, reverb: {}, layerBuses: {}, brightness: 0.5 } as ReturnType<typeof buildMasterGraph>["dest"],
    });
    const { WseAudioEngine } = await import("../src/audio/engine.js");
    const engine = new WseAudioEngine();
    const mix = { lowEnd: 0.45, rhythm: 0.88 };

    await engine.play(score, { mix });
    await engine.startScrollMode(score, { mix });
    await engine.startLiveMode(score, { mix });

    expect(buildSpy).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({ seed: score.fingerprint.seed, mix })
    );
    expect(buildSpy).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({ seed: score.fingerprint.seed, mix })
    );
    expect(buildSpy).toHaveBeenNthCalledWith(
      3,
      expect.anything(),
      expect.objectContaining({ seed: score.fingerprint.seed, mix })
    );
  });

  it("forwards mix from offscreen play messages into the engine", async () => {
    const calls: Array<{ mode: "auto" | "scroll" | "live"; mix: unknown }> = [];
    const listenerHolder: { listener?: (msg: unknown, sender: unknown, sendResponse: (value: unknown) => void) => unknown } = {};

    vi.stubGlobal("chrome", {
      runtime: {
        onMessage: {
          addListener(listener: typeof listenerHolder.listener): void {
            listenerHolder.listener = listener;
          },
        },
      },
    });
    vi.doMock("../src/audio/engine.js", () => ({
      WseAudioEngine: class {
        play(_score: Score, opts: { mix?: unknown }): Promise<void> {
          calls.push({ mode: "auto", mix: opts.mix });
          return Promise.resolve();
        }

        startScrollMode(_score: Score, opts: { mix?: unknown }): Promise<void> {
          calls.push({ mode: "scroll", mix: opts.mix });
          return Promise.resolve();
        }

        startLiveMode(_score: Score, opts: { mix?: unknown }): Promise<void> {
          calls.push({ mode: "live", mix: opts.mix });
          return Promise.resolve();
        }

        getState(): { playing: boolean; position: number } {
          return { playing: false, position: 0 };
        }

        getScore(): Score | null {
          return score;
        }

        stop(): Promise<void> {
          return Promise.resolve();
        }

        setScrollFraction(): void {}
        triggerMutations(): void {}
      },
    }));

    await import("../src/offscreen/offscreen.js");

    const send = (driveMode: "auto" | "scroll" | "live") =>
      new Promise<void>((resolve, reject) => {
        if (!listenerHolder.listener) {
          reject(new Error("offscreen listener missing"));
          return;
        }

        listenerHolder.listener(
          {
            target: "wse-offscreen",
            type: "WSE_OFFSCREEN_PLAY",
            score,
            driveMode,
            tuning: { brightness: 0.5, reverb: 0.5, mix: { pad: 1.05, rhythm: 0.77 } },
          },
          {},
          () => resolve()
        );
      });

    await send("auto");
    await send("scroll");
    await send("live");

    expect(calls).toEqual([
      { mode: "auto", mix: { pad: 1.05, rhythm: 0.77 } },
      { mode: "scroll", mix: { pad: 1.05, rhythm: 0.77 } },
      { mode: "live", mix: { pad: 1.05, rhythm: 0.77 } },
    ]);
  });
});
