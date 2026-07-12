import { describe, expect, it } from "vitest";
import { encodeWavFromChannels, floatTo16BitPCM } from "../src/audio/wav-encode.js";

describe("WAV encoder (§52 Export)", () => {
  it("quantizes and clamps floats to 16-bit signed samples", () => {
    expect(floatTo16BitPCM(0)).toBe(0);
    expect(floatTo16BitPCM(1)).toBe(0x7fff);
    expect(floatTo16BitPCM(-1)).toBe(-0x8000);
    expect(floatTo16BitPCM(2)).toBe(0x7fff); // clamped
    expect(floatTo16BitPCM(-2)).toBe(-0x8000); // clamped
  });

  it("writes a valid RIFF/WAVE header for mono", () => {
    const samples = new Float32Array([0, 0.5, -0.5, 1, -1]);
    const buf = encodeWavFromChannels([samples], 44100);
    const view = new DataView(buf);
    const ascii = (off: number, len: number) =>
      String.fromCharCode(...new Uint8Array(buf, off, len));

    expect(ascii(0, 4)).toBe("RIFF");
    expect(ascii(8, 4)).toBe("WAVE");
    expect(ascii(12, 4)).toBe("fmt ");
    expect(view.getUint32(16, true)).toBe(16); // PCM fmt chunk size
    expect(view.getUint16(20, true)).toBe(1); // PCM format tag
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(44100);
    expect(view.getUint16(34, true)).toBe(16); // bits per sample
    expect(ascii(36, 4)).toBe("data");

    const dataSize = samples.length * 2;
    expect(view.getUint32(40, true)).toBe(dataSize);
    expect(view.getUint32(4, true)).toBe(36 + dataSize);
    expect(buf.byteLength).toBe(44 + dataSize);
  });

  it("interleaves stereo channels correctly", () => {
    const left = new Float32Array([1, 0]);
    const right = new Float32Array([-1, 0.5]);
    const buf = encodeWavFromChannels([left, right], 48000);
    const view = new DataView(buf);

    expect(view.getUint16(22, true)).toBe(2); // stereo
    expect(view.getUint16(32, true)).toBe(4); // block align = 2ch * 2bytes
    expect(view.getUint32(28, true)).toBe(48000 * 4); // byte rate

    // Frame 0: L=1.0 → 0x7fff, R=-1.0 → 0x8000 (as signed -32768)
    expect(view.getInt16(44, true)).toBe(0x7fff);
    expect(view.getInt16(46, true)).toBe(-0x8000);
    // Frame 1: L=0 → 0, R=0.5 → round(0.5*32767)
    expect(view.getInt16(48, true)).toBe(0);
    expect(view.getInt16(50, true)).toBe(Math.round(0.5 * 0x7fff));
  });

  it("handles empty channel data without throwing", () => {
    const buf = encodeWavFromChannels([new Float32Array(0)], 44100);
    expect(buf.byteLength).toBe(44);
  });

  it("is deterministic: same input → byte-identical output", () => {
    const samples = new Float32Array(1000).map((_, i) => Math.sin(i * 0.1));
    const a = encodeWavFromChannels([samples, samples], 44100);
    const b = encodeWavFromChannels([samples, samples], 44100);
    expect(new Uint8Array(a)).toEqual(new Uint8Array(b));
  });
});
