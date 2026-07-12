import type { NoteEvent } from "../shared/types.js";

/**
 * Density limiter (§38): hard caps so a huge website cannot explode into noise.
 *   max simultaneous voices = 12
 *   max note events / second = 20
 * Dropping is deterministic: lowest musical priority goes first.
 */

export const MAX_VOICES = 12;
export const MAX_EVENTS_PER_SECOND = 20;

/** Bass and pads anchor the harmony — drop them last. Exported so tests can
 * catch a newly added InstrumentName that's missing an explicit entry here
 * (this map is intentionally Record<string, ...>, not Record<InstrumentName,
 * ...>, so TypeScript alone won't catch that — a forgotten entry silently
 * falls back to the "?? 1" default in keep() instead of erroring). */
export const PRIORITY: Record<string, number> = {
  bass: 5,
  subbass: 5,
  lowpad: 4,
  pad: 4,
  piano: 3,
  epiano: 3,
  strings: 3,
  brass: 3,
  lead: 3,
  flute: 3,
  xiao: 3,
  guitar: 3,
  clarinet: 3,
  choir: 3,
  koto: 3,
  kick: 2,
  taiko: 2,
  bell: 2,
  mallet: 2,
  marimba: 2,
  pluck: 1,
  hihat: 0,
  perc: 0,
};

function keep(a: NoteEvent, b: NoteEvent): number {
  // Higher priority + higher velocity survives. Deterministic tiebreak by time/pitch.
  const pa = (PRIORITY[a.instrument] ?? 1) + a.velocity;
  const pb = (PRIORITY[b.instrument] ?? 1) + b.velocity;
  if (pa !== pb) return pb - pa;
  if (a.time !== b.time) return a.time - b.time;
  return a.pitch - b.pitch;
}

/** Cap events per 1-second bucket at MAX_EVENTS_PER_SECOND. */
export function limitEventRate(events: NoteEvent[]): NoteEvent[] {
  const buckets = new Map<number, NoteEvent[]>();
  for (const ev of events) {
    const b = Math.floor(ev.time);
    let arr = buckets.get(b);
    if (!arr) buckets.set(b, (arr = []));
    arr.push(ev);
  }
  const out: NoteEvent[] = [];
  for (const [, arr] of [...buckets.entries()].sort((x, y) => x[0] - y[0])) {
    arr.sort(keep);
    out.push(...arr.slice(0, MAX_EVENTS_PER_SECOND));
  }
  out.sort((a, b) => a.time - b.time || a.pitch - b.pitch);
  return out;
}

/** Cap simultaneous voices at MAX_VOICES with a sweep over note intervals. */
export function limitVoices(events: NoteEvent[]): NoteEvent[] {
  const sorted = [...events].sort((a, b) => a.time - b.time || keep(a, b));
  const active: NoteEvent[] = [];
  const out: NoteEvent[] = [];
  for (const ev of sorted) {
    for (let i = active.length - 1; i >= 0; i--) {
      if (active[i].time + active[i].duration <= ev.time + 1e-9) active.splice(i, 1);
    }
    if (active.length >= MAX_VOICES) {
      // Compare against the weakest currently-sounding note.
      active.sort(keep);
      const weakest = active[active.length - 1];
      if (keep(ev, weakest) < 0) {
        // New note outranks the weakest: truncate the weakest at this instant.
        weakest.duration = Math.max(0.05, ev.time - weakest.time);
        active.pop();
        active.push(ev);
        out.push(ev);
      }
      // else: drop the new note entirely.
      continue;
    }
    active.push(ev);
    out.push(ev);
  }
  out.sort((a, b) => a.time - b.time || a.pitch - b.pitch);
  return out;
}

export function applyLimits(events: NoteEvent[]): NoteEvent[] {
  return limitVoices(limitEventRate(events));
}

/** Diagnostics used by tests. */
export function maxSimultaneousVoices(events: NoteEvent[]): number {
  let max = 0;
  for (const ev of events) {
    let n = 0;
    for (const other of events) {
      if (other.time < ev.time + 1e-9 && other.time + other.duration > ev.time + 1e-9) n++;
      else if (other === ev) n++;
    }
    max = Math.max(max, n);
  }
  return max;
}

export function maxEventsPerSecond(events: NoteEvent[]): number {
  const buckets = new Map<number, number>();
  for (const ev of events) {
    const b = Math.floor(ev.time);
    buckets.set(b, (buckets.get(b) ?? 0) + 1);
  }
  return Math.max(0, ...buckets.values());
}
