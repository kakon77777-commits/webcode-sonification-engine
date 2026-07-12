import type { ElementToken, NoteEvent, NoteLayer, Score } from "../shared/types.js";
import { lowerBound } from "../audio/scroll-scheduler.js";

/**
 * Visualizer core (v0.3): shows the process of code becoming music.
 *
 * Left/top: the page's element tokens stream by like subtitles; when a note
 * fires, the token that (structurally) drove it lights up. Bottom: a piano
 * roll scrolls under a fixed playhead.
 *
 * Honest provenance, not decoration: each NoteEvent carries the mapping layer
 * that generated it (arp ← links, bell ← images, perc ← buttons, …), and each
 * layer highlights tokens of the tag family that actually feeds that layer.
 * Pure DOM + canvas; no chrome APIs, so the extension page and the web demo
 * share this module.
 */

export const LAYER_COLORS: Record<NoteLayer, string> = {
  pad: "#38bdf8", // sky      — containers / sections
  bass: "#f59e0b", // amber   — structural roots
  melody: "#a78bfa", // violet — text content
  arp: "#34d399", // emerald  — links
  bell: "#fbbf24", // gold    — images
  perc: "#f472b6", // pink    — buttons / forms
};

export const LAYER_LABELS: Record<NoteLayer, string> = {
  pad: "sections → pad",
  bass: "structure → bass",
  melody: "text → melody",
  arp: "links → arpeggio",
  bell: "images → bells",
  perc: "buttons → percussion",
};

/** Which tag families feed which mapping layer (mirrors Rules 3–5, §16). */
const LAYER_TAGS: Record<NoteLayer, string[]> = {
  arp: ["a"],
  bell: ["img", "picture", "source", "svg", "figure", "video"],
  perc: ["button", "input", "select", "form", "label", "textarea"],
  melody: ["h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "span", "strong", "em", "blockquote", "pre", "code", "td", "th"],
  pad: ["div", "section", "article", "header", "nav", "aside", "figure"],
  bass: ["html", "body", "main", "footer", "table", "ul", "ol"],
};

/**
 * Deterministically assign each event a token index: events of a layer walk
 * round-robin through the tokens of their tag family (document order), so the
 * highlight sweeps across the page's code the way the music sweeps its
 * structure. Exported for tests.
 */
export function assignTokens(events: readonly NoteEvent[], tokens: readonly ElementToken[]): number[] {
  const byLayer: Record<NoteLayer, number[]> = {
    pad: [],
    bass: [],
    melody: [],
    arp: [],
    bell: [],
    perc: [],
  };
  const all: number[] = [];
  tokens.forEach((tok, i) => {
    all.push(i);
    for (const layer of Object.keys(LAYER_TAGS) as NoteLayer[]) {
      if (LAYER_TAGS[layer].includes(tok.tag)) byLayer[layer].push(i);
    }
  });
  const counters: Record<NoteLayer, number> = { pad: 0, bass: 0, melody: 0, arp: 0, bell: 0, perc: 0 };
  let fallback = 0;
  return events.map((ev) => {
    const list = byLayer[ev.layer];
    if (list.length > 0) {
      const idx = list[counters[ev.layer] % list.length];
      counters[ev.layer]++;
      return idx;
    }
    if (all.length === 0) return -1;
    return all[fallback++ % all.length];
  });
}

export interface VizOptions {
  tokensEl: HTMLElement;
  canvas: HTMLCanvasElement;
  score: Score;
  tokens: ElementToken[];
  /** Seconds into the score (drives everything). */
  getPosition: () => number;
  isPlaying: () => boolean;
}

export interface VizHandles {
  /** Begin the rAF loop. Call after playback starts. */
  start(): void;
  /** Halt animation (keeps the rendered state). */
  stop(): void;
  /** Reset lit/played state for a replay. */
  reset(): void;
}

const ROLL_BEHIND = 1.5; // seconds of history left of the playhead
const ROLL_AHEAD = 6.5; // seconds of future right of it

export function mountViz(opts: VizOptions): VizHandles {
  const { tokensEl, canvas, score, tokens, getPosition, isPlaying } = opts;
  const events = score.events;
  const assignment = assignTokens(events, tokens);

  // ---- Code stream: one span per token, colored by the layer that consumes it.
  tokensEl.textContent = "";
  const tokenSpans: HTMLSpanElement[] = tokens.map((tok) => {
    const span = document.createElement("span");
    span.className = "wse-tok";
    span.textContent = `<${tok.tag}>`;
    let owner: NoteLayer | null = null;
    for (const layer of Object.keys(LAYER_TAGS) as NoteLayer[]) {
      if (LAYER_TAGS[layer].includes(tok.tag)) {
        owner = layer;
        break;
      }
    }
    if (owner) span.style.color = LAYER_COLORS[owner] + "88";
    span.style.opacity = String(Math.max(0.45, 1 - tok.depth * 0.03));
    tokensEl.appendChild(span);
    return span;
  });

  const ctx2d = canvas.getContext("2d")!;
  let nextIdx = 0;
  let lastPos = 0;
  let raf = 0;
  let running = false;
  /** onset timestamps (score seconds) for glow decay, per event index. */
  const fired = new Set<number>();
  const litTimeouts: number[] = [];
  let lastScrollAt = 0;

  function lightToken(evIdx: number, layer: NoteLayer): void {
    const tIdx = assignment[evIdx];
    if (tIdx < 0 || !tokenSpans[tIdx]) return;
    const span = tokenSpans[tIdx];
    span.classList.remove("lit");
    // Force reflow so rapid re-hits restart the CSS animation.
    void span.offsetWidth;
    span.style.setProperty("--lit-color", LAYER_COLORS[layer]);
    span.classList.add("lit", "played");
    // Keep the freshly lit token in view; throttled so dense passages don't fight the smooth scroll.
    const now = performance.now();
    if (now - lastScrollAt > 350) {
      lastScrollAt = now;
      const target = span.offsetTop - tokensEl.clientHeight / 2;
      tokensEl.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
    }
    const handle = window.setTimeout(() => span.classList.remove("lit"), 700);
    litTimeouts.push(handle);
  }

  function resizeCanvas(): void {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const pitches = events.map((e) => e.pitch);
  const pitchLo = Math.min(...pitches, 36) - 2;
  const pitchHi = Math.max(...pitches, 84) + 2;
  const barDur = (60 / score.profile.bpm) * 4;

  function drawRoll(pos: number): void {
    resizeCanvas();
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx2d.clearRect(0, 0, w, h);

    const t0 = pos - ROLL_BEHIND;
    const t1 = pos + ROLL_AHEAD;
    const xOf = (t: number) => ((t - t0) / (t1 - t0)) * w;
    const yOf = (p: number) => h - ((p - pitchLo) / (pitchHi - pitchLo)) * (h - 10) - 5;
    const noteH = Math.max(3, (h - 10) / (pitchHi - pitchLo) + 2);

    // Bar grid.
    ctx2d.strokeStyle = "rgba(148, 163, 184, 0.12)";
    ctx2d.lineWidth = 1;
    for (let bar = Math.max(0, Math.floor(t0 / barDur)); bar * barDur < t1; bar++) {
      const x = xOf(bar * barDur);
      ctx2d.beginPath();
      ctx2d.moveTo(x, 0);
      ctx2d.lineTo(x, h);
      ctx2d.stroke();
    }

    // Notes.
    for (const [i, ev] of events.entries()) {
      if (ev.time + ev.duration < t0 || ev.time > t1) continue;
      const x = xOf(ev.time);
      const wNote = Math.max(3, xOf(ev.time + ev.duration) - x - 1);
      const y = yOf(ev.pitch);
      const color = LAYER_COLORS[ev.layer];
      const playing = ev.time <= pos && pos <= ev.time + ev.duration;
      const played = ev.time <= pos;
      ctx2d.globalAlpha = playing ? 1 : played ? 0.55 : 0.3 + 0.45 * ev.velocity;
      ctx2d.fillStyle = color;
      if (playing) {
        ctx2d.shadowColor = color;
        ctx2d.shadowBlur = 12;
      }
      ctx2d.beginPath();
      ctx2d.roundRect(x, y - noteH / 2, wNote, noteH, 2);
      ctx2d.fill();
      ctx2d.shadowBlur = 0;
      // Onset flash ring.
      const age = pos - ev.time;
      if (age >= 0 && age < 0.25 && fired.has(i)) {
        ctx2d.globalAlpha = 1 - age / 0.25;
        ctx2d.strokeStyle = "#ffffff";
        ctx2d.lineWidth = 1.5;
        ctx2d.beginPath();
        ctx2d.roundRect(x - 2, y - noteH / 2 - 2, wNote + 4, noteH + 4, 3);
        ctx2d.stroke();
      }
    }
    ctx2d.globalAlpha = 1;

    // Playhead.
    const px = xOf(pos);
    const grad = ctx2d.createLinearGradient(px, 0, px, h);
    grad.addColorStop(0, "rgba(56, 189, 248, 0.9)");
    grad.addColorStop(1, "rgba(167, 139, 250, 0.9)");
    ctx2d.strokeStyle = grad;
    ctx2d.lineWidth = 2;
    ctx2d.beginPath();
    ctx2d.moveTo(px, 0);
    ctx2d.lineTo(px, h);
    ctx2d.stroke();
  }

  // Position usually only advances (Auto Mode's real-time clock), but Scroll
  // Mode can rewind — scrolling back must not "un-light" anything already
  // played, but scrolling forward past those notes again should relight them.
  // Reuses the exact same lowerBound the audio ScrollScheduler rewinds with,
  // so what you see and what you hear always agree on "what's next".
  function frame(): void {
    if (!running) return;
    const pos = getPosition();
    if (pos > lastPos) {
      while (nextIdx < events.length && events[nextIdx].time <= pos) {
        fired.add(nextIdx);
        lightToken(nextIdx, events[nextIdx].layer);
        nextIdx++;
      }
    } else if (pos < lastPos) {
      nextIdx = lowerBound(events, pos);
    }
    lastPos = pos;
    drawRoll(pos);
    if (!isPlaying() && nextIdx >= events.length) {
      running = false;
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  return {
    start(): void {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(frame);
    },
    stop(): void {
      running = false;
      cancelAnimationFrame(raf);
    },
    reset(): void {
      nextIdx = 0;
      lastPos = 0;
      fired.clear();
      for (const handle of litTimeouts) clearTimeout(handle);
      litTimeouts.length = 0;
      for (const span of tokenSpans) span.classList.remove("lit", "played");
      tokensEl.scrollTo({ top: 0 });
      drawRoll(0);
    },
  };
}
