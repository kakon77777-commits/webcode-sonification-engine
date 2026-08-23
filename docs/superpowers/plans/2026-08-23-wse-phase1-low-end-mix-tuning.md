# WSE Phase 1 Low-End and Layer Mix Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Finish the remaining Phase 1 sound-quality requirement by making low-end and structural layer balance user-adjustable, persistent, deterministic, and verified across WSE playback and export surfaces.

**Architecture:** Keep the generated Score unchanged. Extend the existing render tuning path with an optional backward-compatible layer-mix object, resolve defaults at the audio graph boundary, and apply the resolved values to the existing six layer buses. Add low-end, pad, melody, and rhythm controls to the popup and standalone demo; visualizer/export consumes the same tuning object without recomputing music.

**Tech Stack:** TypeScript, Web Audio API, Vitest, JSDOM smoke tests, esbuild, Chrome MV3, and the existing standalone demo. No new runtime dependency.

**Spec:** docs/superpowers/specs/2026-08-22-wse-musical-evolution-design.md

## Global Constraints

- Core identity: “The program itself becomes music.” Mix controls change how the structure-derived Score is heard; they do not create or replace notes.
- Determinism: Same Score plus same tuning/mix values produces the same render configuration and output behavior.
- Compatibility: Existing callers that omit the new optional mix object retain safe defaults.
- Privacy: Settings remain local; no page content, form values, query strings, or network upload is introduced.
- Audio parity: Live playback, offline WAV export, and demo rendering use the same resolved mix values and shared graph.
- Scope: This plan does not add custom mapping profiles, FLAC/Opus, FARHP links, public deployment, or a new synthesis engine.
- Baseline: Preserve the existing 23-voice catalog, six structural layers, deterministic arrangement, and 125-test baseline.
- Dependencies: Use existing TypeScript, Vitest, JSDOM, Web Audio API, and esbuild; do not add a runtime package.

## File map

### Existing files to modify

- src/shared/types.ts — add the optional backward-compatible layer-mix tuning contract and defaults.
- src/audio/layer-mix.ts — resolve defaults and apply user mix multipliers to the six existing buses.
- src/audio/graph.ts — pass mix options into the shared layer-bus graph.
- src/audio/engine.ts — pass mix values through live playback options.
- src/offscreen/offscreen.ts — forward mix values from runtime messages to the engine.
- src/audio/render-offline.ts — pass mix values through offline WAV rendering.
- src/audio/export-types.ts and src/audio/export-registry.ts — carry mix values for WAV export without affecting MIDI.
- src/ui/popup.html, src/ui/popup.css, src/ui/popup.ts — add and persist four layer-mix controls.
- demo/demo.html and demo/demo.ts — add the same four controls and use them for playback/export.
- src/viz/visualizer.ts — pass payload tuning mix to export.
- tests/layer-mix.test.ts — add default, clamp, and multiplier coverage.
- tests/ui-export-contract.test.ts — extend DOM contract coverage for mix controls.
- README.md — document only the verified tuning controls after browser smoke.

### New test file

- tests/mix-tuning.test.ts — pure backward-compatibility and deterministic tuning tests.
- tests/mix-propagation.test.ts — render/export option propagation tests.

## Task 1: Define and test the backward-compatible mix contract

**Files:**

- Modify: src/shared/types.ts
- Modify: src/audio/layer-mix.ts
- Modify: tests/layer-mix.test.ts
- Create: tests/mix-tuning.test.ts

**Interfaces:**

~~~~ts
export interface LayerMixTuning {
  lowEnd: number;
  pad: number;
  melody: number;
  rhythm: number;
}

export const DEFAULT_LAYER_MIX: LayerMixTuning = {
  lowEnd: 0.72,
  pad: 1,
  melody: 1,
  rhythm: 0.9,
};

export function resolveLayerMix(
  value?: Partial<LayerMixTuning>
): LayerMixTuning;
~~~~

Add mix?: Partial<LayerMixTuning> to TuningOptions, not a required field, so old stored settings and existing test literals remain valid.

- [ ] Step 1: Write failing pure tests.

Cover omitted mix, partial merge, clamping to 0..1.25, deterministic repeated resolution, fresh returned objects, and unchanged six layer keys.

~~~~ts
it("resolves a conservative low-end default without changing old callers", () => {
  expect(resolveLayerMix()).toEqual({
    lowEnd: 0.72,
    pad: 1,
    melody: 1,
    rhythm: 0.9,
  });
  expect(resolveLayerMix({ lowEnd: 0.4, rhythm: 1.2 })).toEqual({
    lowEnd: 0.4,
    pad: 1,
    melody: 1,
    rhythm: 1.2,
  });
});
~~~~

- [ ] Step 2: Run focused tests and verify RED.

Run: npm test -- --run tests/mix-tuning.test.ts tests/layer-mix.test.ts

Expected: FAIL because LayerMixTuning and resolveLayerMix do not exist.

- [ ] Step 3: Implement resolver and bus multipliers.

Keep the existing base LAYER_GAIN values as the structural mix. createLayerBuses(ctx, target, mix?) calls resolveLayerMix and applies pad to pad, lowEnd to bass, melody to melody, and rhythm to arp/bell/perc. Clamp each resolved value to 0..1.25 before constructing GainNodes. This is render-level only and must not change NoteEvent generation or provenance.

- [ ] Step 4: Run focused tests and typecheck.

~~~~text
npm test -- --run tests/mix-tuning.test.ts tests/layer-mix.test.ts
npm run typecheck
~~~~

Expected: focused tests pass and existing layer-bus tests remain green.

- [ ] Step 5: Commit the mix contract.

~~~~text
git add src/shared/types.ts src/audio/layer-mix.ts tests/layer-mix.test.ts tests/mix-tuning.test.ts
git commit -m "feat: add deterministic WSE layer mix tuning"
~~~~

## Task 2: Propagate mix tuning through live, offline, and export paths

**Files:**

- Modify: src/audio/graph.ts
- Modify: src/audio/engine.ts
- Modify: src/offscreen/offscreen.ts
- Modify: src/audio/render-offline.ts
- Modify: src/audio/export-types.ts
- Modify: src/audio/export-registry.ts
- Create: tests/mix-propagation.test.ts

**Interfaces:**

~~~~ts
export interface MasterGraphOptions {
  brightness?: number;
  reverb?: number;
  seed?: number;
  mix?: Partial<LayerMixTuning>;
}

export interface PlayOptions {
  brightness?: number;
  reverb?: number;
  mix?: Partial<LayerMixTuning>;
  onEnded?: () => void;
}

export interface RenderOptions {
  brightness?: number;
  reverb?: number;
  mix?: Partial<LayerMixTuning>;
  sampleRate?: number;
}
~~~~

- [ ] Step 1: Write failing propagation tests.

Assert omitted mix resolves to DEFAULT_LAYER_MIX, partial values preserve unspecified fields, MIDI encoding ignores render mix, and WAV registry accepts mix values.

- [ ] Step 2: Run focused tests and verify RED.

Run: npm test -- --run tests/mix-propagation.test.ts

Expected: FAIL because mix is not part of graph/render/export options.

- [ ] Step 3: Propagate mix through the shared graph.

Add mix to MasterGraphOptions, pass it to createLayerBuses, and keep master/reverb/voice routing unchanged. Add mix to PlayOptions and pass it from WseAudioEngine into buildMasterGraph for Auto, Scroll, and Live. Add mix to RenderOptions and pass it through renderScoreOffline and the WAV registry. Forward it through the offscreen tuning/options object.

- [ ] Step 4: Keep MIDI independent of audio mix.

The MIDI registry branch continues calling encodeScoreAsMidi(score) with no audio graph. Its output must not change when only mix values change.

- [ ] Step 5: Run focused propagation and regression tests.

~~~~text
npm test -- --run tests/mix-propagation.test.ts tests/export-registry.test.ts tests/midi-encode.test.ts tests/graph.test.ts
npm run typecheck
~~~~

Expected: focused tests and typecheck pass.

- [ ] Step 6: Commit propagation.

~~~~text
git add src/audio/graph.ts src/audio/engine.ts src/offscreen/offscreen.ts src/audio/render-offline.ts src/audio/export-types.ts src/audio/export-registry.ts tests/mix-propagation.test.ts
git commit -m "feat: propagate WSE layer mix through render paths"
~~~~

## Task 3: Add user controls and persistence to UI surfaces

**Files:**

- Modify: src/ui/popup.html
- Modify: src/ui/popup.css
- Modify: src/ui/popup.ts
- Modify: demo/demo.html
- Modify: demo/demo.ts
- Modify: src/viz/visualizer.ts
- Modify: tests/ui-export-contract.test.ts

**Interfaces:**

Use these exact control IDs and ranges in popup and demo:

~~~~html
<label for="s-low-end">Low End</label>
<input id="s-low-end" type="range" min="0" max="100" value="72">
<label for="s-pad">Pads</label>
<input id="s-pad" type="range" min="0" max="125" value="100">
<label for="s-melody">Melody</label>
<input id="s-melody" type="range" min="0" max="125" value="100">
<label for="s-rhythm">Rhythm</label>
<input id="s-rhythm" type="range" min="0" max="125" value="90">
~~~~

- [ ] Step 1: Write failing DOM contract tests.

Extend tests/ui-export-contract.test.ts to assert popup and demo contain all four controls, value spans, and existing export/status controls. Assert visualizer export still exists and receives tuning from payload; do not require visualizer to duplicate popup sliders.

- [ ] Step 2: Run focused DOM test and verify RED.

Run: npm test -- --run tests/ui-export-contract.test.ts

Expected: FAIL because the four controls do not exist.

- [ ] Step 3: Implement currentTuning and persistence.

In popup.ts and demo.ts, read the four sliders into TuningOptions.mix. Extend saved settings with mix, merge missing fields through resolveLayerMix, update labels on input, and preserve reset behavior. Keep controls local-only and deterministic.

- [ ] Step 4: Wire playback/export options.

Pass resolved mix through popup playback, demo playback, visualizer WAV export, and export registry options. Do not change Score generation, fingerprints, variation, modes, or page extraction.

- [ ] Step 5: Style controls with existing CSS patterns.

Reuse current popup and demo tuning control styles. Keep labels and status visible in light/dark modes.

- [ ] Step 6: Run UI tests, typecheck, and build.

~~~~text
npm test -- --run tests/ui-export-contract.test.ts tests/mix-tuning.test.ts
npm run typecheck
npm run build
~~~~

Expected: tests, typecheck, extension, demo, and quality bundles pass.

- [ ] Step 7: Commit UI tuning surface.

~~~~text
git add src/ui/popup.html src/ui/popup.css src/ui/popup.ts demo/demo.html demo/demo.ts src/viz/visualizer.ts tests/ui-export-contract.test.ts
git commit -m "feat: add WSE low-end and layer mix controls"
~~~~

## Task 4: Verify low-end behavior and update Phase 1 documentation

**Files:**

- Modify: README.md
- Test: full suite, browser demo smoke, quality harness, and local route checks.

- [ ] Step 1: Run full automated gate.

~~~~text
npm test -- --reporter=dot
npm run typecheck
npm run build
git diff --check
~~~~

Expected: tests, typecheck/build pass and no whitespace errors.

- [ ] Step 2: Run demo in WebAudio-capable browser.

Start node scripts/serve.mjs and open http://localhost:8735/demo/ in installed Chrome/CDP. Verify default Low End 72%; lowering Low End changes resolved bass-layer gain but not score summary, fingerprint, event count, or structural tokens; Pads/Melody/Rhythm change only render mix; WAV uses selected mix; MIDI bytes remain identical when only mix changes; console errors and external requests are empty. Stop server and Chrome.

- [ ] Step 3: Run 23-voice quality harness.

Open http://localhost:8735/quality.html and verify 23/23 finite, non-silent, non-clipped output with default mix. Record min/max RMS/peak and do not change health thresholds.

- [ ] Step 4: Update README accurately.

Document four local mix controls, conservative Low End default, deterministic persistence, and that mix controls alter rendering rather than structural Score generation. Keep WAV/MIDI/privacy accurate; do not claim custom profiles or FARHP links.

- [ ] Step 5: Commit verified documentation.

~~~~text
git add README.md
git commit -m "docs: document WSE layer mix tuning"
~~~~

- [ ] Step 6: Run final Phase 1 tuning checkpoint.

~~~~text
npm test -- --reporter=dot
npm run typecheck
npm run build
git diff --check
git status --short --branch
~~~~

Do not stage package-lock.json, generated bundles, SDD reports, wse-site, or FARHP files. Record final score identity invariants and browser mix evidence in the SDD ledger.

## Handoff

After this plan is cleanly reviewed, Phase 1 low-end hardening is complete. Continue with the previously approved Phase 3 custom mapping profiles, presets, compare, Explain, and richer Visualizer plan. Keep MIDI PPQ hardening as a separate non-blocking follow-up.

