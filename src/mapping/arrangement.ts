import type { MusicProfile, NoteEvent } from "../shared/types.js";
import { degreeToMidi } from "./quantize.js";

/**
 * Musical-mode arrangement pass.
 *
 * The structural mapping has already chosen the key, scale, tempo, form,
 * instruments, and note provenance when this runs. This pass only shapes the
 * already-derived material into a clearer performance: sparse openings,
 * sectional energy, smoother pad voice-leading, and a definite final cadence.
 * It is deterministic and deliberately used by Musical mode only, so Hybrid
 * and Analytical site signatures retain their existing behaviour.
 */

function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

function barAt(time: number, barDur: number): number {
  return Math.max(0, Math.floor(time / barDur + 1e-6));
}

function sectionAt(bar: number, profile: MusicProfile): MusicProfile["sections"][number]["name"] {
  return profile.sections.find((section) => bar >= section.startBar && bar < section.startBar + section.bars)?.name ?? "A2";
}

function nearestOctave(pitch: number, target: number, floor: number): number {
  const candidates: number[] = [];
  for (let octaves = -3; octaves <= 3; octaves++) {
    const candidate = pitch + octaves * 12;
    if (candidate >= Math.max(30, floor + 1) && candidate <= 96) candidates.push(candidate);
  }
  // The range above is intentionally never empty for the score's 21–108 MIDI
  // guardrail. Keep the fallback for defensive use with future instruments.
  if (candidates.length === 0) return Math.max(floor + 1, Math.min(96, pitch));
  return candidates.reduce((best, candidate) => {
    const candidateCost = Math.abs(candidate - target) + Math.abs(candidate - pitch) * 0.12;
    const bestCost = Math.abs(best - target) + Math.abs(best - pitch) * 0.12;
    return candidateCost < bestCost || (candidateCost === bestCost && candidate < best) ? candidate : best;
  });
}

/** Move each pad voice by the smallest useful interval from the previous bar. */
function voiceLeadPads(events: NoteEvent[], profile: MusicProfile, barDur: number): NoteEvent[] {
  const indicesByBar = new Map<number, number[]>();
  events.forEach((event, index) => {
    if (event.layer !== "pad") return;
    const bar = barAt(event.time, barDur);
    let indices = indicesByBar.get(bar);
    if (!indices) indicesByBar.set(bar, (indices = []));
    indices.push(index);
  });

  const result = events.map((event) => ({ ...event }));
  let previous: number[] | null = null;
  for (let bar = 0; bar < profile.barCount; bar++) {
    const indices = indicesByBar.get(bar);
    if (!indices || indices.length === 0) continue;
    indices.sort((a, b) => result[a].pitch - result[b].pitch);
    const pitches = indices.map((index) => result[index].pitch);
    if (previous) {
      const voiced: number[] = [];
      for (let voice = 0; voice < pitches.length; voice++) {
        const target = previous[Math.min(voice, previous.length - 1)] ?? pitches[voice];
        voiced.push(nearestOctave(pitches[voice], target, voice === 0 ? 29 : voiced[voice - 1]));
      }
      indices.forEach((index, voice) => {
        result[index].pitch = voiced[voice];
      });
      previous = voiced;
    } else {
      previous = pitches;
    }
  }
  return result;
}

/**
 * Retain the web-derived score, but give Musical mode an arrangement arc.
 * The pass removes notes rather than introducing a second source of musical
 * material. That keeps every audible decision traceable to the page score.
 */
export function arrangeMusically(events: NoteEvent[], profile: MusicProfile): NoteEvent[] {
  const barDur = (60 / profile.bpm) * 4;
  const introPadGroups = new Map<number, number[]>();
  events.forEach((event, index) => {
    if (event.layer !== "pad") return;
    const bar = barAt(event.time, barDur);
    if (sectionAt(bar, profile) !== "intro") return;
    let group = introPadGroups.get(bar);
    if (!group) introPadGroups.set(bar, (group = []));
    group.push(index);
  });

  // In the intro, use open root-and-fifth-like spacing by omitting the middle
  // note from the original triad. The notes still carry their original layer.
  const omitIntroPads = new Set<number>();
  for (const indices of introPadGroups.values()) {
    indices.sort((a, b) => events[a].pitch - events[b].pitch);
    if (indices.length >= 3) omitIntroPads.add(indices[Math.floor(indices.length / 2)]);
  }

  let arranged = events
    .filter((event, index) => {
      const section = sectionAt(barAt(event.time, barDur), profile);
      if (section === "intro" && (event.layer === "arp" || event.layer === "bell" || event.layer === "perc")) return false;
      if (section === "outro" && (event.layer === "arp" || event.layer === "bell" || event.layer === "perc")) return false;
      return !omitIntroPads.has(index);
    })
    .map((event) => {
      const section = sectionAt(barAt(event.time, barDur), profile);
      if (section === "B" && event.layer === "melody") {
        // A short call-and-response articulation on B gives the existing
        // retrograde motif a distinct contour without moving it off the grid.
        return { ...event, duration: round6(Math.max(0.05, event.duration * 0.78)), velocity: round6(event.velocity * 0.94) };
      }
      if (section === "A2" && (event.layer === "melody" || event.layer === "arp" || event.layer === "bell")) {
        return { ...event, velocity: round6(Math.min(1, event.velocity + 0.06)) };
      }
      if (section === "outro") return { ...event, velocity: round6(event.velocity * 0.82) };
      return { ...event };
    });

  arranged = voiceLeadPads(arranged, profile, barDur);

  const finalBar = profile.barCount - 1;
  const finalPadIndices = arranged
    .map((event, index) => ({ event, index }))
    .filter(({ event }) => event.layer === "pad" && barAt(event.time, barDur) === finalBar)
    .sort((a, b) => a.event.pitch - b.event.pitch);
  if (finalPadIndices.length > 0) {
    const padOctave = Math.max(1, Math.min(5, Math.floor(finalPadIndices[0].event.pitch / 12) - 1));
    const tonicVoicing = [0, 2, 4].map((degree) => degreeToMidi(profile.key, profile.scale, degree, padOctave));
    finalPadIndices.forEach(({ event, index }, voice) => {
      arranged[index] = { ...event, pitch: tonicVoicing[Math.min(voice, tonicVoicing.length - 1)] };
    });
  }

  arranged = arranged.map((event) => {
    if (event.layer !== "bass" || barAt(event.time, barDur) !== finalBar) return event;
    const octave = Math.max(0, Math.min(4, Math.floor(event.pitch / 12) - 1));
    return { ...event, pitch: degreeToMidi(profile.key, profile.scale, 0, octave) };
  });

  const finalMelodies = arranged
    .map((event, index) => ({ event, index }))
    .filter(({ event }) => event.layer === "melody" && barAt(event.time, barDur) === finalBar);
  if (finalMelodies.length > 0) {
    const final = finalMelodies[finalMelodies.length - 1];
    const octave = Math.max(2, Math.min(6, Math.floor(final.event.pitch / 12) - 1));
    arranged[final.index] = {
      ...final.event,
      pitch: degreeToMidi(profile.key, profile.scale, 0, octave),
      duration: round6(Math.max(final.event.duration, barDur * 0.9)),
      velocity: round6(Math.max(final.event.velocity, 0.38)),
    };
  }

  return arranged.sort((a, b) => a.time - b.time || a.pitch - b.pitch || a.layer.localeCompare(b.layer));
}
