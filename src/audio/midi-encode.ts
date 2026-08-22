import type { InstrumentName, NoteLayer, Score } from "../shared/types.js";

export interface MidiEncodeOptions {
  ticksPerQuarter?: number;
}

interface TrackEvent {
  tick: number;
  kind: "meta" | "noteOn" | "noteOff";
  pitch?: number;
  velocity?: number;
  instrument?: InstrumentName;
  data: number[];
  order: number;
}

const DEFAULT_PPQ = 480;
const LAYERS: readonly NoteLayer[] = ["pad", "bass", "melody", "arp", "bell", "perc"];
const TRACK_NAME_META = 0x03;
const END_OF_TRACK_META = 0x2f;
const SET_TEMPO_META = 0x51;

export function encodeScoreAsMidi(score: Score, options: MidiEncodeOptions = {}): ArrayBuffer {
  const ticksPerQuarter = normalizePpq(options.ticksPerQuarter);
  const tracks = [buildTempoTrack(score), ...LAYERS.map((layer) => buildLayerTrack(score, layer, ticksPerQuarter))];
  const writer: number[] = [];

  pushAscii(writer, "MThd");
  pushUint32(writer, 6);
  pushUint16(writer, 1);
  pushUint16(writer, tracks.length);
  pushUint16(writer, ticksPerQuarter);

  for (const track of tracks) {
    pushAscii(writer, "MTrk");
    pushUint32(writer, track.length);
    writer.push(...track);
  }

  return Uint8Array.from(writer).buffer;
}

function normalizePpq(value?: number): number {
  if (!Number.isFinite(value) || value === undefined) return DEFAULT_PPQ;
  return Math.max(1, Math.round(value));
}

function buildTempoTrack(score: Score): Uint8Array {
  const tempo = Math.max(1, Math.round(60_000_000 / score.profile.bpm));
  const events: TrackEvent[] = [
    metaEvent(0, TRACK_NAME_META, asciiBytes("WSE"), 0),
    metaEvent(0, SET_TEMPO_META, [(tempo >> 16) & 0xff, (tempo >> 8) & 0xff, tempo & 0xff], 1),
    metaEvent(0, END_OF_TRACK_META, [], 2),
  ];
  return Uint8Array.from(encodeTrack(events));
}

function buildLayerTrack(score: Score, layer: NoteLayer, ticksPerQuarter: number): Uint8Array {
  const events: TrackEvent[] = [metaEvent(0, TRACK_NAME_META, asciiBytes(`WSE ${layer}`), 0)];
  let order = 1;

  for (const note of score.events) {
    if (note.layer !== layer) continue;

    const startTick = secondsToTicks(note.time, score.profile.bpm, ticksPerQuarter);
    const endTick = secondsToTicks(note.time + note.duration, score.profile.bpm, ticksPerQuarter);
    const pitch = clampPitch(note.pitch);
    const velocity = clampVelocity(note.velocity);

    events.push(midiEvent(startTick, "noteOn", pitch, velocity, note.instrument, order++));
    events.push(midiEvent(endTick, "noteOff", pitch, velocity, note.instrument, order++));
  }

  events.sort(compareTrackEvents);
  events.push(metaEvent(events.at(-1)?.tick ?? 0, END_OF_TRACK_META, [], order));
  return Uint8Array.from(encodeTrack(events));
}

function secondsToTicks(timeSeconds: number, bpm: number, ticksPerQuarter: number): number {
  return Math.round(timeSeconds * bpm * ticksPerQuarter / 60);
}

function clampPitch(pitch: number): number {
  return Math.max(0, Math.min(127, Math.round(pitch)));
}

function clampVelocity(velocity: number): number {
  return Math.max(1, Math.min(127, Math.round(velocity * 127)));
}

function metaEvent(tick: number, metaType: number, payload: number[], order: number): TrackEvent {
  return {
    tick,
    kind: "meta",
    data: [0xff, metaType, ...encodeVlq(payload.length), ...payload],
    order,
  };
}

function midiEvent(
  tick: number,
  kind: "noteOn" | "noteOff",
  pitch: number,
  velocity: number,
  instrument: InstrumentName,
  order: number
): TrackEvent {
  const status = kind === "noteOn" ? 0x90 : 0x80;
  return {
    tick,
    kind,
    pitch,
    velocity,
    instrument,
    data: [status, pitch, velocity],
    order,
  };
}

function compareTrackEvents(a: TrackEvent, b: TrackEvent): number {
  if (a.tick !== b.tick) return a.tick - b.tick;
  if (eventRank(a) !== eventRank(b)) return eventRank(a) - eventRank(b);

  const pitchDiff = (a.pitch ?? -1) - (b.pitch ?? -1);
  if (pitchDiff !== 0) return pitchDiff;

  const velocityDiff = (a.velocity ?? -1) - (b.velocity ?? -1);
  if (velocityDiff !== 0) return velocityDiff;

  const instrumentDiff = (a.instrument ?? "").localeCompare(b.instrument ?? "");
  if (instrumentDiff !== 0) return instrumentDiff;

  return a.order - b.order;
}

function eventRank(event: TrackEvent): number {
  switch (event.kind) {
    case "meta":
      return 0;
    case "noteOff":
      return 1;
    case "noteOn":
      return 2;
  }
}

function encodeTrack(events: TrackEvent[]): number[] {
  const bytes: number[] = [];
  let previousTick = 0;

  for (const event of events) {
    const delta = event.tick - previousTick;
    bytes.push(...encodeVlq(delta));
    bytes.push(...event.data);
    previousTick = event.tick;
  }

  return bytes;
}

function encodeVlq(value: number): number[] {
  const clamped = Math.max(0, Math.trunc(value));
  const bytes = [clamped & 0x7f];
  let remaining = clamped >> 7;

  while (remaining > 0) {
    bytes.unshift((remaining & 0x7f) | 0x80);
    remaining >>= 7;
  }

  return bytes;
}

function pushAscii(target: number[], text: string): void {
  target.push(...asciiBytes(text));
}

function asciiBytes(text: string): number[] {
  return Array.from(text, (char) => char.charCodeAt(0) & 0x7f);
}

function pushUint16(target: number[], value: number): void {
  target.push((value >> 8) & 0xff, value & 0xff);
}

function pushUint32(target: number[], value: number): void {
  target.push((value >> 24) & 0xff, (value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff);
}
