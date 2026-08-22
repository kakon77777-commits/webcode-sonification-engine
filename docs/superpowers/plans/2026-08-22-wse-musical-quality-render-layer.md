# WSE Musical Quality and Render Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the first independently deliverable WSE evolution phase: a formal Musical-mode arrangement boundary, measurable score/render quality, and layer-aware audio routing without changing WSE's program-to-music identity.

**Architecture:** Keep PageFeatures, PageFingerprint, MusicProfile, NoteEvent, and Score as the semantic contract. Make arrangement a deterministic post-mapping stage, route voices through explicit layer buses, and share the same render graph between live playback and offline rendering. Add an internal browser quality harness so every registered instrument can be rendered and inspected without publishing it as a product feature.

**Tech Stack:** TypeScript, Web Audio API (AudioContext and OfflineAudioContext), Vitest, esbuild, existing Chrome MV3 extension and standalone demo. No new runtime dependency in this phase.

**Spec:** docs/superpowers/specs/2026-08-22-wse-musical-evolution-design.md

## Global Constraints

- **Core identity:** “The program itself becomes music.” The page remains the source of musical identity and explainable musical decisions.
- **Determinism:** A stable page structure, URL, style, mode, tuning, and variation produce a reproducible score.
- **Provenance:** Every audible score event keeps its structural mapping layer.
- **Privacy:** Analysis remains local-only; raw page content, form values, query strings, and user-editable content do not enter the pipeline.
- **Mode boundary:** Hybrid and Analytical preserve structural audibility; Musical may add listenability arrangement without erasing page-derived identity.
- **Audio parity:** Live playback and offline export use the same synthesis graph.
- **Preservation:** Do not overwrite or stage existing uncommitted arrangement work until it has been reviewed in place.
- **FARHP boundary:** This phase adds no FARHP runtime, storage, authentication, or navigation coupling.
- **Dependencies:** Use the existing TypeScript, Vitest, Web Audio API, and esbuild setup; do not add a runtime package.

## Scope decomposition

This is the first sub-project from the approved v0.5 design. It ends with a working, testable music-quality foundation.

Separate plans are required for:

1. WAV hardening, MIDI, and optional FLAC/Opus export.
2. Custom profiles, presets, compare workflow, and Explain/Visualizer extensions.
3. WSE/FARHP public sibling links after the actual FARHP HTTPS route is verified.

## File map

### Existing files to modify

- src/mapping/default-map.ts — make final arrangement explicit without changing the fingerprint or random draw order.
- src/mapping/arrangement.ts — preserve the collaborator implementation and harden only tested invariants.
- src/audio/instruments.ts — route notes to layer buses and expose the voice catalog.
- src/audio/graph.ts — construct layer buses in the shared master graph.
- src/audio/engine.ts — continue using the shared graph for live modes.
- src/audio/render-offline.ts — continue using the shared graph for offline rendering.
- scripts/build.mjs — bundle the internal quality page beside the existing demo.

### New production-support files

- src/mapping/score-metrics.ts — pure score statistics.
- src/audio/render-metrics.ts — pure Float32 channel metrics.
- src/audio/layer-mix.ts — typed layer gains and layer-bus construction.
- src/audio/quality-render.ts — browser-only offline rendering of the complete voice catalog.

### New tests and internal QA files

- tests/score-metrics.test.ts
- tests/render-metrics.test.ts
- tests/layer-mix.test.ts
- tests/quality-render.test.ts
- demo/quality.html
- demo/quality.ts

The existing tests/arrangement.test.ts is extended in place.

## Task 1: Add pure score metrics

**Files:**

- Create: src/mapping/score-metrics.ts
- Create: tests/score-metrics.test.ts

**Interfaces:**

~~~~ts
export interface ScoreMetrics {
  eventCount: number;
  durationSec: number;
  maxEventsPerSecond: number;
  maxSimultaneousVoices: number;
  layerCounts: Record<NoteLayer, number>;
  instrumentCounts: Partial<Record<InstrumentName, number>>;
}

export function measureScore(
  events: readonly NoteEvent[],
  durationSec: number
): ScoreMetrics;
~~~~

- [ ] **Step 1: Write the failing tests.**

Cover an empty score, two overlapping events, a later event, layer counts, instrument counts, event rate, simultaneous voices, and input immutability.

~~~~ts
it("counts layers and instruments without mutating events", () => {
  const events: NoteEvent[] = [
    { time: 0, duration: 1, pitch: 60, velocity: 0.5, instrument: "pad", pan: 0, layer: "pad" },
    { time: 0, duration: 0.5, pitch: 48, velocity: 0.5, instrument: "bass", pan: 0, layer: "bass" },
    { time: 1, duration: 0.2, pitch: 72, velocity: 0.5, instrument: "piano", pan: 0, layer: "melody" },
  ];
  const before = structuredClone(events);
  const metrics = measureScore(events, 2);
  expect(metrics.eventCount).toBe(3);
  expect(metrics.layerCounts.pad).toBe(1);
  expect(metrics.layerCounts.bass).toBe(1);
  expect(metrics.layerCounts.melody).toBe(1);
  expect(metrics.instrumentCounts.piano).toBe(1);
  expect(metrics.maxSimultaneousVoices).toBe(2);
  expect(events).toEqual(before);
});
~~~~

- [ ] **Step 2: Run the focused test and verify it fails.**

Run: npm test -- --run tests/score-metrics.test.ts

Expected: FAIL because score-metrics.ts and measureScore do not exist.

- [ ] **Step 3: Implement measureScore.**

Initialize all six NoteLayer keys to zero, count instruments with a new object, and delegate event-rate and simultaneous-voice calculations to maxEventsPerSecond and maxSimultaneousVoices from src/mapping/limits.ts. Never sort or mutate the input array.

- [ ] **Step 4: Verify the focused unit.**

Keep score-metrics.ts as an internal diagnostic module for this phase; tests import it directly so the existing collaborator change in src/mapping/index.ts is not staged accidentally. Run:

~~~~text
npm test -- --run tests/score-metrics.test.ts tests/limits.test.ts
npm run typecheck
~~~~

Expected: focused tests and typecheck pass.

- [ ] **Step 5: Commit only this unit.**

~~~~text
git add src/mapping/score-metrics.ts tests/score-metrics.test.ts
git commit -m "feat: add deterministic score quality metrics"
~~~~

Do not add the existing arrangement files in this commit.

## Task 2: Harden the Musical arrangement contract

**Files:**

- Modify: src/mapping/arrangement.ts
- Modify: src/mapping/default-map.ts
- Modify: tests/arrangement.test.ts

**Interfaces:**

- Consumes: the existing NoteEvent[] and MusicProfile inputs to arrangeMusically.
- Produces: a new deterministically sorted NoteEvent[] with valid score bounds and unchanged provenance fields.

- [ ] **Step 1: Add failing invariant tests.**

Update the existing test import to include arrangeMusically from ../src/mapping/arrangement.js. Add tests for input immutability, non-negative/in-range event times, MIDI range 21–108, valid NoteLayer values, and deterministic sort order.

~~~~ts
it("does not mutate the source score", () => {
  const score = musical();
  const before = structuredClone(score.events);
  arrangeMusically(score.events, score.profile);
  expect(score.events).toEqual(before);
});

it("keeps arranged events inside the score range", () => {
  const score = musical();
  const arranged = arrangeMusically(score.events, score.profile);
  expect(arranged.every((event) => event.time >= 0)).toBe(true);
  expect(arranged.every((event) => event.time < score.profile.lengthSec)).toBe(true);
  expect(arranged.every((event) => event.pitch >= 21 && event.pitch <= 108)).toBe(true);
});
~~~~

Use a local comparator for time, pitch, and layer rather than relying on JavaScript array comparison.

- [ ] **Step 2: Run the focused tests before implementation changes.**

Run: npm test -- --run tests/arrangement.test.ts

Expected: the existing arrangement behavior passes; a failure identifies a real invariant gap in the uncommitted collaborator implementation.

- [ ] **Step 3: Make finalization explicit in default-map.ts.**

Extract and use this helper around the current post-pass:

~~~~ts
function finalizeScoreEvents(
  events: NoteEvent[],
  profile: MusicProfile,
  mode: ModeName
): NoteEvent[] {
  const limited = applyLimits(events);
  return mode === "musical"
    ? applyLimits(arrangeMusically(limited, profile))
    : limited;
}
~~~~

Preserve the current order: normalization, initial limits, Musical arrangement, final limits. Do not change the fingerprint, profile, random draw order, or Hybrid/Analytical path.

- [ ] **Step 4: Run the mapping regression suite.**

~~~~text
npm test -- --run tests/arrangement.test.ts tests/determinism.test.ts tests/quantize.test.ts tests/limits.test.ts tests/orchestration.test.ts
npm run typecheck
~~~~

Expected: all mapping tests pass and same inputs/options produce the same profile and events.

- [ ] **Step 5: Commit the reviewed arrangement unit.**

The existing index export is part of the arrangement collaborator change and must be included only after Task 2's tests approve the arrangement. Confirm git diff --name-only contains only src/mapping/default-map.ts, src/mapping/index.ts, src/mapping/arrangement.ts, and tests/arrangement.test.ts. Then run:

~~~~text
git add src/mapping/default-map.ts src/mapping/index.ts src/mapping/arrangement.ts tests/arrangement.test.ts
git commit -m "feat: formalize musical arrangement stage"
~~~~

## Task 3: Add pure render metrics and the authoritative voice catalog

**Files:**

- Create: src/audio/render-metrics.ts
- Create: tests/render-metrics.test.ts
- Modify: src/audio/instruments.ts

**Interfaces:**

~~~~ts
export interface ChannelRenderMetrics {
  peak: number;
  rms: number;
  dcOffset: number;
  nonZeroSamples: number;
  clippedSamples: number;
}

export interface RenderMetrics {
  frameCount: number;
  channelCount: number;
  peak: number;
  rms: number;
  dcOffset: number;
  nonFiniteSamples: number;
  clippedSamples: number;
  channels: ChannelRenderMetrics[];
}

export function measureRenderedChannels(
  channels: readonly Float32Array[],
  clipThreshold?: number
): RenderMetrics;

export function isHealthyRender(
  metrics: RenderMetrics,
  minimumRms?: number
): boolean;
~~~~

- [ ] **Step 1: Write failing sample tests.**

Test empty channels, silence, a known finite signal, NaN/Infinity, and samples at or above the clipping threshold.

~~~~ts
it("detects non-finite and clipped samples", () => {
  const metrics = measureRenderedChannels([
    new Float32Array([0, 0.5, 1, Number.NaN]),
    new Float32Array([0, -1, 0.2, Number.POSITIVE_INFINITY]),
  ]);
  expect(metrics.frameCount).toBe(4);
  expect(metrics.channelCount).toBe(2);
  expect(metrics.nonFiniteSamples).toBe(2);
  expect(metrics.clippedSamples).toBe(2);
  expect(isHealthyRender(metrics)).toBe(false);
});
~~~~

- [ ] **Step 2: Run the focused test and verify it fails.**

Run: npm test -- --run tests/render-metrics.test.ts

Expected: FAIL because render-metrics.ts does not exist.

- [ ] **Step 3: Implement one-pass channel metrics.**

Scan each channel once. Count non-finite samples separately and treat them as zero for peak/RMS accumulation. Compute DC offset from finite samples, count finite non-zero samples, and count abs(sample) >= 0.999 by default. Use the shortest channel length as frameCount and document that behavior.

isHealthyRender returns true only when nonFiniteSamples is zero, clippedSamples is zero, and rms is at least 1e-5 by default.

- [ ] **Step 4: Export and test the 23-voice catalog.**

After the VOICES table in src/audio/instruments.ts, export:

~~~~ts
export const INSTRUMENT_CATALOG: readonly InstrumentName[] = Object.freeze(
  Object.keys(VOICES) as InstrumentName[]
);
~~~~

Add a test that the catalog has exactly 23 unique names and includes every instrument listed in tests/limits.test.ts. Run:

~~~~text
npm test -- --run tests/render-metrics.test.ts tests/limits.test.ts
npm run typecheck
~~~~

- [ ] **Step 5: Commit the pure metrics and catalog.**

~~~~text
git add src/audio/render-metrics.ts src/audio/instruments.ts tests/render-metrics.test.ts
git commit -m "feat: add rendered audio metrics and voice catalog"
~~~~

## Task 4: Route audio through structural layer buses

**Files:**

- Create: src/audio/layer-mix.ts
- Create: tests/layer-mix.test.ts
- Modify: src/audio/instruments.ts
- Modify: src/audio/graph.ts
- Modify: src/audio/engine.ts
- Modify: src/audio/render-offline.ts

**Interfaces:**

~~~~ts
export const LAYER_GAIN: Readonly<Record<NoteLayer, number>> = Object.freeze({
  pad: 0.82,
  bass: 0.78,
  melody: 1,
  arp: 0.72,
  bell: 0.66,
  perc: 0.72,
});

export type LayerBusMap = Readonly<Record<NoteLayer, GainNode>>;

export function createLayerBuses(
  ctx: BaseAudioContext,
  target: AudioNode
): LayerBusMap;
~~~~

- [ ] **Step 1: Write pure layer-table tests.**

Assert all six NoteLayer keys exist, all gains are finite and in (0, 1], melody is unity, and the exported table cannot be changed through a caller-owned reference.

- [ ] **Step 2: Run the focused test and verify it fails.**

Run: npm test -- --run tests/layer-mix.test.ts

Expected: FAIL because layer-mix.ts does not exist.

- [ ] **Step 3: Implement layer-bus construction.**

Create one GainNode per NoteLayer, set its gain from LAYER_GAIN, connect each bus to the supplied target, and return a new six-key map. Do not create another compressor or reverb graph.

- [ ] **Step 4: Extend VoiceDestinations without breaking callers.**

Add optional layerBuses?: LayerBusMap to VoiceDestinations. In makeOutput, route dry audio to dest.layerBuses?.[ev.layer] ?? dest.dry. Keep the existing reverb send and brightness behavior.

- [ ] **Step 5: Attach the same buses to the shared graph.**

Extend MasterGraph with layerBuses: LayerBusMap. In buildMasterGraph, create the buses after the master node exists and pass them through dest.layerBuses. Keep the current master chain unchanged:

~~~~text
master → warmth → air → saturator → compressor → destination
~~~~

- [ ] **Step 6: Verify live/offline parity.**

Run:

~~~~text
npm test -- --run tests/layer-mix.test.ts tests/graph.test.ts tests/impulse.test.ts tests/wav-encode.test.ts
npm run typecheck
~~~~

Inspect src/audio/engine.ts and src/audio/render-offline.ts to confirm both still call buildMasterGraph and pass its dest to playNote. Do not add a live-only or offline-only routing path.

- [ ] **Step 7: Commit the shared routing.**

~~~~text
git add src/audio/layer-mix.ts src/audio/instruments.ts src/audio/graph.ts src/audio/engine.ts src/audio/render-offline.ts tests/layer-mix.test.ts
git commit -m "feat: route WSE audio through structural layer buses"
~~~~

## Task 5: Add the internal browser voice-quality harness

**Files:**

- Create: src/audio/quality-render.ts
- Create: tests/quality-render.test.ts
- Create: demo/quality.html
- Create: demo/quality.ts
- Modify: scripts/build.mjs

**Interfaces:**

~~~~ts
export interface VoiceRenderResult {
  instrument: InstrumentName;
  metrics: RenderMetrics;
  healthy: boolean;
}

export interface VoiceRenderOptions {
  sampleRate?: number;
  noteDuration?: number;
}

export async function renderInstrumentCatalog(
  options?: VoiceRenderOptions
): Promise<VoiceRenderResult[]>;

export function qualityEventForInstrument(
  instrument: InstrumentName,
  index: number
): NoteEvent;
~~~~

- [ ] **Step 1: Write the failing deterministic scheduling test.**

Test that qualityEventForInstrument returns a stable event for the same instrument/index, uses pitch 60, velocity 0.65, pan 0, time 0.05, duration 0.8, and maps percussion, bass, pad, arp, and melody layers exactly as specified below.

- [ ] **Step 2: Run the focused test and verify it fails.**

Run: npm test -- --run tests/quality-render.test.ts

Expected: FAIL because qualityEventForInstrument does not exist.

- [ ] **Step 3: Implement the helper and deterministic offline rendering.**

For each INSTRUMENT_CATALOG entry, create an OfflineAudioContext with two channels, default sample rate 44100, note duration 0.8 seconds, and a three-second tail. Build the shared master graph with seed 0x57455301 + catalog index, schedule one note at 0.05 seconds, render, collect both channels, and call measureRenderedChannels.

Use pitch 60, velocity 0.65, pan 0. Map kick/hihat/perc/taiko to perc, bass/subbass to bass, pad/lowpad/choir to pad, pluck/guitar/koto/bell/mallet/marimba to arp, and all remaining voices to melody.

- [ ] **Step 4: Build the quality page.**

demo/quality.html contains a heading, Run voice render button, status element, and a table with Instrument, Peak, RMS, Clipped, Non-finite, and Status columns. demo/quality.ts runs the catalog, fills the table, shows a final PASS/FAIL summary, and never downloads or transmits audio.

- [ ] **Step 5: Add the quality bundle entry.**

Change the second esbuild entryPoints in scripts/build.mjs to include both existing demo and quality:

~~~~js
entryPoints: {
  demo: join(root, "demo/demo.ts"),
  quality: join(root, "demo/quality.ts"),
},
~~~~

Keep demo/demo.js behavior unchanged. The quality page is internal QA and is not copied into public wse-site by the existing sync script.

- [ ] **Step 6: Build and run the harness over HTTP.**

~~~~text
npm run build
node scripts/serve.mjs
~~~~

Open http://localhost:8735/quality.html, click Run voice render, and verify exactly 23 catalog entries, finite samples, non-zero RMS, zero clipped samples, final PASS, and no browser console errors. If a voice fails, fix the voice or routing; do not weaken the health thresholds.

- [ ] **Step 7: Commit the internal QA harness.**

~~~~text
git add src/audio/quality-render.ts tests/quality-render.test.ts demo/quality.html demo/quality.ts scripts/build.mjs
git commit -m "test: add browser voice render quality harness"
~~~~

## Task 6: Full regression and Phase 1 checkpoint

**Files:**

- Modify: README.md only when the verified Phase 1 behavior changes the public feature description.
- Test: all existing tests, the score matrix, and demo/quality.html.

**Interfaces:**

- Consumes: completed arrangement, score metrics, render metrics, layer buses, and quality harness.
- Produces: a verified Phase 1 checkpoint. It does not claim MIDI, compressed formats, custom profiles, or FARHP links.

- [ ] **Step 1: Run all automated checks.**

~~~~text
npm test -- --reporter=dot
npm run typecheck
git diff --check
~~~~

Expected: all tests pass, typecheck succeeds, and no whitespace errors are reported.

- [ ] **Step 2: Run the score matrix.**

Use simple-blog.html, dashboard.html, ecommerce.html, and docs.html across all five styles and three modes. For every score, measure ScoreMetrics and assert:

~~~~ts
expect(metrics.eventCount).toBeGreaterThan(0);
expect(metrics.maxEventsPerSecond).toBeLessThanOrEqual(MAX_EVENTS_PER_SECOND);
expect(metrics.maxSimultaneousVoices).toBeLessThanOrEqual(MAX_VOICES);
~~~~

Do not require equal event counts; structural diversity is required.

- [ ] **Step 3: Repeat the browser voice harness.**

Rebuild, serve over HTTP, and rerun http://localhost:8735/quality.html. Record the final summary and any corrected instrument in the handoff. Do not commit generated dist or demo bundles unless repository tracking rules require them.

- [ ] **Step 4: Update only verified public documentation.**

If Phase 1 changes user-visible behavior, update README.md with the exact behavior verified by tests and the browser harness. Do not claim MIDI, FLAC, Opus, custom profiles, or FARHP links in this phase.

- [ ] **Step 5: Inspect and commit the checkpoint.**

Confirm no wse-site or FARHP files changed and unrelated collaborator files are not staged. Then run:

~~~~text
git status --short --branch
git diff --stat origin/main...HEAD
git add README.md
git commit -m "feat: complete WSE musical quality foundation"
~~~~

## Handoff to later plans

After this plan is verified, create separate plans for:

1. WSE score/audio export layer — WAV hardening, MIDI, and optional compressed encoding.
2. WSE usefulness layer — custom profiles, presets, compare workflow, and Explain/Visualizer improvements.
3. WSE/FARHP sister links — exact public URL verification, reciprocal navigation, site synchronization, and browser link checks.

All later plans must consume the stable score/render contracts produced here and must keep the WSE core identity rule unchanged.
