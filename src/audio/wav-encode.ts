/**
 * Pure 16-bit PCM WAV encoder (§52 Export). No Web Audio types here — only
 * Float32Array + numbers — so this is fully unit-testable in Node without a
 * browser or an OfflineAudioContext.
 */

/** Clamp to [-1, 1] and quantize to a 16-bit signed sample. */
export function floatTo16BitPCM(sample: number): number {
  const s = Math.max(-1, Math.min(1, sample));
  return s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff);
}

function writeAscii(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}

/** Encode interleaved 16-bit PCM WAV from per-channel float samples in [-1, 1]. */
export function encodeWavFromChannels(channels: Float32Array[], sampleRate: number): ArrayBuffer {
  const numChannels = Math.max(1, channels.length);
  const numFrames = channels[0]?.length ?? 0;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numFrames * blockAlign;

  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true); // PCM fmt chunk size
  view.setUint16(20, 1, true); // audio format 1 = PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // byte rate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // bits per sample
  writeAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      view.setInt16(offset, floatTo16BitPCM(channels[ch][i] ?? 0), true);
      offset += 2;
    }
  }
  return buffer;
}

/** Convenience wrapper for a rendered AudioBuffer (browser-only; not unit-tested directly). */
export function encodeWav(buffer: AudioBuffer): ArrayBuffer {
  const channels: Float32Array[] = [];
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) channels.push(buffer.getChannelData(ch));
  return encodeWavFromChannels(channels, buffer.sampleRate);
}
