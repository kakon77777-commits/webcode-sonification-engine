import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExportFormat, Score } from "../src/audio/export-types.js";
import { exportFilename } from "../src/audio/export-types.js";
import { encodeScoreAsMidi } from "../src/audio/midi-encode.js";
import * as renderOfflineModule from "../src/audio/render-offline.js";
import * as wavEncodeModule from "../src/audio/wav-encode.js";
import { encodeScore } from "../src/audio/export-registry.js";

const score: Score = {
  version: 1,
  fingerprint: {
    version: 1,
    hash: "1234567890abcdef",
    seed: 42,
  },
  variation: 1,
  profile: {
    key: 0,
    keyName: "C",
    scale: "major",
    bpm: 120,
    style: "ambient",
    mode: "musical",
    lengthSec: 8,
    barCount: 4,
    sections: [],
    character: "content",
    explain: [],
  },
  events: [
    {
      time: 0,
      duration: 0.5,
      pitch: 60,
      velocity: 0.5,
      instrument: "pad",
      pan: 0,
      layer: "pad",
    },
  ],
};

describe("encodeScore", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("encodes MIDI with deterministic bytes and deterministic export metadata", async () => {
    const renderSpy = vi.spyOn(renderOfflineModule, "renderScoreOffline");
    const wavSpy = vi.spyOn(wavEncodeModule, "encodeWav");

    const artifact = await encodeScore(score, "midi");
    const expectedBytes = encodeScoreAsMidi(score);

    expect(artifact).toEqual({
      format: "midi",
      extension: "mid",
      mimeType: "audio/midi",
      filename: exportFilename(score, "midi"),
      bytes: expectedBytes,
    });
    expect(new Uint8Array(artifact.bytes)).toEqual(new Uint8Array(expectedBytes));
    expect(renderSpy).not.toHaveBeenCalled();
    expect(wavSpy).not.toHaveBeenCalled();
  });

  it("encodes WAV via offline rendering and WAV encoding with shared deterministic filenames", async () => {
    const fakeBuffer = { numberOfChannels: 2, sampleRate: 48000, getChannelData: vi.fn() } as unknown as AudioBuffer;
    const wavBytes = new Uint8Array([0x52, 0x49, 0x46, 0x46]).buffer;
    const renderSpy = vi.spyOn(renderOfflineModule, "renderScoreOffline").mockResolvedValue(fakeBuffer);
    const wavSpy = vi.spyOn(wavEncodeModule, "encodeWav").mockReturnValue(wavBytes);

    const artifact = await encodeScore(score, "wav", { brightness: 0.2, reverb: 0.7, sampleRate: 48000 });

    expect(renderSpy).toHaveBeenCalledWith(score, { brightness: 0.2, reverb: 0.7, sampleRate: 48000 });
    expect(wavSpy).toHaveBeenCalledWith(fakeBuffer);
    expect(artifact).toEqual({
      format: "wav",
      extension: "wav",
      mimeType: "audio/wav",
      filename: exportFilename(score, "wav"),
      bytes: wavBytes,
    });
  });

  it("rejects invalid runtime formats with an explicit error", async () => {
    await expect(encodeScore(score, "mp3" as ExportFormat)).rejects.toThrow("Unsupported export format: mp3");
  });

  it("does not allow unsupported formats in the TypeScript union", () => {
    // @ts-expect-error ExportFormat is limited to wav | midi.
    const invalidFormat: ExportFormat = "mp3";

    expect(invalidFormat).toBe("mp3");
  });
});
