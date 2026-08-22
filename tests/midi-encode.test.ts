import { describe, expect, it } from "vitest";
import type { Score } from "../src/shared/types.js";
import { encodeScoreAsMidi } from "../src/audio/midi-encode.js";

interface ParsedMidi {
  format: number;
  trackCount: number;
  division: number;
  tracks: ParsedTrack[];
}

interface ParsedTrack {
  length: number;
  events: ParsedEvent[];
}

type ParsedEvent =
  | {
      delta: number;
      absoluteTick: number;
      kind: "meta";
      metaType: number;
      data: Uint8Array;
    }
  | {
      delta: number;
      absoluteTick: number;
      kind: "midi";
      status: number;
      data1: number;
      data2: number;
    };

const TRACK_NAMES = ["WSE", "WSE pad", "WSE bass", "WSE melody", "WSE arp", "WSE bell", "WSE perc"];

const baseScore: Score = {
  version: 1,
  fingerprint: {
    version: 1,
    hash: "1234567890abcdef",
    seed: 42,
  },
  variation: 0,
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
    {
      time: 0.5,
      duration: 0.5,
      pitch: 64,
      velocity: 0.75,
      instrument: "lead",
      pan: 0,
      layer: "pad",
    },
    {
      time: 0,
      duration: 0.25,
      pitch: 36,
      velocity: 1,
      instrument: "bass",
      pan: -0.25,
      layer: "bass",
    },
    {
      time: 2,
      duration: 0.25,
      pitch: 67,
      velocity: 0.6,
      instrument: "bell",
      pan: 0.2,
      layer: "bell",
    },
    {
      time: 0.125,
      duration: 0.125,
      pitch: 72,
      velocity: 0.2,
      instrument: "pluck",
      pan: 0.1,
      layer: "arp",
    },
  ],
};

function ascii(bytes: Uint8Array): string {
  return String.fromCharCode(...bytes);
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
}

function readUint16(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readVlq(bytes: Uint8Array, offset: number): { value: number; next: number; raw: number[] } {
  let value = 0;
  let next = offset;
  const raw: number[] = [];
  while (next < bytes.length) {
    const current = bytes[next++];
    raw.push(current);
    value = (value << 7) | (current & 0x7f);
    if ((current & 0x80) === 0) return { value, next, raw };
  }
  throw new Error(`Unterminated VLQ at ${offset}`);
}

function parseMidi(buffer: ArrayBuffer): ParsedMidi {
  const bytes = new Uint8Array(buffer);
  expect(ascii(bytes.subarray(0, 4))).toBe("MThd");
  expect(readUint32(bytes, 4)).toBe(6);

  const trackCount = readUint16(bytes, 10);
  const tracks: ParsedTrack[] = [];
  let offset = 14;
  for (let i = 0; i < trackCount; i++) {
    expect(ascii(bytes.subarray(offset, offset + 4))).toBe("MTrk");
    const length = readUint32(bytes, offset + 4);
    const trackBytes = bytes.subarray(offset + 8, offset + 8 + length);
    tracks.push(parseTrack(trackBytes, length));
    offset += 8 + length;
  }
  expect(offset).toBe(bytes.length);

  return {
    format: readUint16(bytes, 8),
    trackCount,
    division: readUint16(bytes, 12),
    tracks,
  };
}

function parseTrack(trackBytes: Uint8Array, length: number): ParsedTrack {
  const events: ParsedEvent[] = [];
  let offset = 0;
  let absoluteTick = 0;

  while (offset < trackBytes.length) {
    const { value: delta, next } = readVlq(trackBytes, offset);
    offset = next;
    absoluteTick += delta;

    const status = trackBytes[offset];
    expect(status).toBeGreaterThanOrEqual(0x80);
    offset++;

    if (status === 0xff) {
      const metaType = trackBytes[offset++];
      const { value: lengthValue, next: dataStart } = readVlq(trackBytes, offset);
      offset = dataStart;
      const data = trackBytes.slice(offset, offset + lengthValue);
      offset += lengthValue;
      events.push({ delta, absoluteTick, kind: "meta", metaType, data });
      continue;
    }

    if (status === 0xf0 || status === 0xf7) {
      throw new Error("Unexpected sysex event in test fixture");
    }

    const command = status & 0xf0;
    const data1 = trackBytes[offset++];
    const data2 = command === 0xc0 || command === 0xd0 ? 0 : trackBytes[offset++];
    events.push({ delta, absoluteTick, kind: "midi", status, data1, data2 });
  }

  return { length, events };
}

function trackName(track: ParsedTrack): string {
  const nameEvent = track.events.find((event): event is Extract<ParsedEvent, { kind: "meta" }> => event.kind === "meta" && event.metaType === 0x03);
  expect(nameEvent).toBeDefined();
  return ascii(nameEvent!.data);
}

function noteEvents(track: ParsedTrack): Array<Extract<ParsedEvent, { kind: "midi" }>> {
  return track.events.filter((event): event is Extract<ParsedEvent, { kind: "midi" }> => event.kind === "midi");
}

describe("MIDI encoder (§52 Export)", () => {
  it("writes a format-1 header with one tempo track plus six layer tracks at PPQ 480", () => {
    const midi = parseMidi(encodeScoreAsMidi(baseScore));

    expect(midi.format).toBe(1);
    expect(midi.trackCount).toBe(7);
    expect(midi.division).toBe(480);
    expect(midi.tracks).toHaveLength(7);
  });

  it("writes the WSE tempo track with track name, set tempo, and end-of-track", () => {
    const midi = parseMidi(encodeScoreAsMidi(baseScore));
    const tempoTrack = midi.tracks[0];
    const metaEvents = tempoTrack.events.filter((event): event is Extract<ParsedEvent, { kind: "meta" }> => event.kind === "meta");

    expect(trackName(tempoTrack)).toBe("WSE");
    const tempoEvent = metaEvents.find((event) => event.metaType === 0x51);
    expect(tempoEvent?.absoluteTick).toBe(0);
    expect(Array.from(tempoEvent?.data ?? [])).toEqual([0x07, 0xa1, 0x20]);
    expect(metaEvents.at(-1)?.metaType).toBe(0x2f);
    expect(Array.from(metaEvents.at(-1)?.data ?? [])).toEqual([]);
  });

  it("uses deterministic layer track names in layer order", () => {
    const midi = parseMidi(encodeScoreAsMidi(baseScore));
    const names = midi.tracks.map((track) => trackName(track));

    expect(names).toEqual(TRACK_NAMES);
  });

  it("encodes note-on and note-off events at the expected ticks with note-off before note-on on the same tick", () => {
    const midi = parseMidi(encodeScoreAsMidi(baseScore));
    const padTrack = midi.tracks[1];
    const padNotes = noteEvents(padTrack).map((event) => ({
      absoluteTick: event.absoluteTick,
      status: event.status,
      pitch: event.data1,
      velocity: event.data2,
    }));

    expect(padNotes).toEqual([
      { absoluteTick: 0, status: 0x90, pitch: 60, velocity: 64 },
      { absoluteTick: 480, status: 0x80, pitch: 60, velocity: 64 },
      { absoluteTick: 480, status: 0x90, pitch: 64, velocity: 95 },
      { absoluteTick: 960, status: 0x80, pitch: 64, velocity: 95 },
    ]);

    const bellTrack = midi.tracks[5];
    const bellNotes = noteEvents(bellTrack);
    expect(bellNotes[0]?.absoluteTick).toBe(1920);
    expect(bellNotes[1]?.absoluteTick).toBe(2160);
  });

  it("clamps pitch to 0..127 and velocity to 1..127", () => {
    const midi = parseMidi(
      encodeScoreAsMidi({
        ...baseScore,
        events: [
          {
            time: 0,
            duration: 0.25,
            pitch: -12,
            velocity: 0,
            instrument: "pad",
            pan: 0,
            layer: "pad",
          },
          {
            time: 0.5,
            duration: 0.25,
            pitch: 200,
            velocity: 2,
            instrument: "lead",
            pan: 0,
            layer: "pad",
          },
        ],
      })
    );

    const padNotes = noteEvents(midi.tracks[1]);
    expect(padNotes).toEqual([
      expect.objectContaining({ status: 0x90, data1: 0, data2: 1 }),
      expect.objectContaining({ status: 0x80, data1: 0, data2: 1 }),
      expect.objectContaining({ status: 0x90, data1: 127, data2: 127 }),
      expect.objectContaining({ status: 0x80, data1: 127, data2: 127 }),
    ]);
  });

  it("keeps empty layer tracks with only track name and end-of-track meta events", () => {
    const midi = parseMidi(
      encodeScoreAsMidi({
        ...baseScore,
        events: baseScore.events.filter((event) => event.layer === "pad"),
      })
    );

    for (let trackIndex = 2; trackIndex < midi.tracks.length; trackIndex++) {
      const track = midi.tracks[trackIndex];
      const metaTypes = track.events.filter((event): event is Extract<ParsedEvent, { kind: "meta" }> => event.kind === "meta").map((event) => event.metaType);
      expect(metaTypes).toEqual([0x03, 0x2f]);
      expect(noteEvents(track)).toHaveLength(0);
    }
  });

  it("encodes deltas larger than 127 ticks as standard VLQs", () => {
    const bytes = new Uint8Array(
      encodeScoreAsMidi({
        ...baseScore,
        events: [
          {
            time: 2,
            duration: 0.25,
            pitch: 67,
            velocity: 0.5,
            instrument: "bell",
            pan: 0,
            layer: "bell",
          },
        ],
      })
    );

    const bellTrackIndex = 5;
    let offset = 14;
    for (let i = 0; i < bellTrackIndex; i++) {
      offset += 8 + readUint32(bytes, offset + 4);
    }
    expect(ascii(bytes.subarray(offset, offset + 4))).toBe("MTrk");
    const length = readUint32(bytes, offset + 4);
    const trackBytes = bytes.subarray(offset + 8, offset + 8 + length);

    const nameVlq = readVlq(trackBytes, 0);
    expect(nameVlq.raw).toEqual([0x00]);
    expect(trackBytes[1]).toBe(0xff);
    expect(trackBytes[2]).toBe(0x03);
    const nameLength = readVlq(trackBytes, 3);
    const longDeltaOffset = nameLength.next + nameLength.value;
    const noteDelta = readVlq(trackBytes, longDeltaOffset);

    expect(noteDelta.value).toBe(1920);
    expect(noteDelta.raw).toEqual([0x8f, 0x00]);
  });

  it("encodes the same Score to byte-identical MIDI", () => {
    const a = encodeScoreAsMidi(baseScore);
    const b = encodeScoreAsMidi(baseScore);

    expect(new Uint8Array(a)).toEqual(new Uint8Array(b));
  });
});
