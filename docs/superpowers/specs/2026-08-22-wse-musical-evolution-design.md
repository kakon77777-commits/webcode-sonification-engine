# WSE Musical Evolution v0.5

## Status

Design for review. This document defines the next WSE evolution before implementation begins.

## 1. Product identity and non-negotiable boundaries

WebCode Sonification Engine (WSE) exists to make a webpage's accessible computational structure audible:

> The program itself becomes music.

WSE is not a generic AI music generator that uses a webpage as a decorative prompt. The page remains the source of musical identity and of the explainable decisions that produce the score. Improvements to timbre, arrangement, export, and usability must strengthen that relationship rather than replace it.

The following invariants remain mandatory:

1. The primary pipeline remains `webpage/program → structural features → deterministic identity → score → audio`.
2. A stable page structure, URL, style, mode, tuning, and variation produce a reproducible score.
3. Every audible score event keeps structural provenance through its mapping layer.
4. Analysis remains local-only. Raw page content, form values, query strings, and user-editable content do not enter the pipeline.
5. Hybrid and Analytical modes preserve structural audibility. Musical mode may add a listenability arrangement pass, but it cannot erase the page-derived identity.
6. FARHP is a sister project, not a WSE dependency. The first WSE/FARHP connection is public navigation only: reciprocal links between public project pages, with no shared runtime, storage, authentication, or telemetry.

## 2. Current baseline and preservation rule

The current WSE v0.4.1 baseline already contains:

- DOM, sampled CSS, geometry, script statistics, and runtime mutation/scroll extraction;
- deterministic fingerprints, seven scales, five styles, three score modes, and 23 synthesized instruments;
- Auto, Scroll, and Live playback;
- visualizer provenance and offline 16-bit PCM WAV export;
- local privacy boundaries and density/voice guardrails.

The working tree also contains an uncommitted Musical-mode arrangement experiment in `src/mapping/arrangement.ts`, its integration in `src/mapping/default-map.ts`, and its tests. Those files are preserved as existing collaborator work. The evolution must review and extend this work without overwriting it or staging unrelated changes.

The first implementation slice must begin with a clean inventory and a review of this working-tree delta. It must not assume that generated `demo/demo.js` and the deployed website bundle are synchronized.

## 3. Recommended architecture

The recommended approach is a layered evolution of the current pipeline, not a rewrite and not a permanently parallel second engine.

```text
Webpage / program
      ↓
Feature extraction
      ↓
Structural fingerprint
      ↓
Music profile
      ↓
Structure-derived score
      ↓
Musical arrangement
      ↓
Shared audio render graph
      ↓
WAV / MIDI / optional compressed exports
```

The existing semantic contracts remain the center of the system:

- `PageFeatures` describes the privacy-filtered structural snapshot.
- `PageFingerprint` describes deterministic site identity.
- `MusicProfile` describes key, scale, tempo, form, character, and explanations.
- `NoteEvent` describes a note, its instrument, timing, spatial position, and provenance layer.
- `Score` remains the reproducible semantic artifact passed to playback, visualization, and export.

The new boundaries are:

### 3.1 Arrangement boundary

Score generation continues to derive notes from page structure. A separate arrangement pass may shape sectional energy, voice leading, articulation, cadence, and decorative-layer entry/exit. The pass must be deterministic, preserve provenance, stay inside the score's harmonic and density guardrails, and return a new event list rather than silently changing the source mapping rules.

Musical mode is the first consumer of this pass. Hybrid remains a balance between identity and listenability; Analytical remains the structural evidence mode. Any future arrangement option must be explicit in the mode or profile so users can explain why two outputs differ.

### 3.2 Audio render boundary

Live playback and offline export must continue to use the same synthesis graph. Instrument construction, layer routing, master processing, seeded noise, reverb, and clipping protection belong to the render layer rather than the mapping layer.

The render layer should evolve toward explicit responsibilities:

- a registry of instrument voice builders;
- per-voice articulation and spectral profile;
- per-layer buses for pad, bass, melody, arpeggio, bell, and percussion;
- deterministic mix and dynamics settings;
- a shared master graph for live and offline contexts.

This enables sound-quality improvement without changing the meaning of `NoteEvent`. It also makes it possible to test a voice in isolation and then test the complete score mix.

### 3.3 Encoder boundary

Export must consume the semantic `Score` or the rendered audio artifact through explicit encoders. The current WAV encoder remains the reference implementation.

The recommended order is:

1. Keep deterministic 16-bit PCM WAV as the lossless audio baseline.
2. Add deterministic MIDI export because MIDI preserves the generated score and makes the program-to-music relationship inspectable and editable.
3. Evaluate FLAC or Opus behind capability detection and an isolated encoder module. A compressed format is not accepted merely because a browser API exists; it must be tested for output validity, performance, determinism expectations, bundle cost, and licensing/redistribution constraints.
4. Do not make MP3 the first compressed target. It adds less semantic value than MIDI and should not delay the quality work.

Each encoder must have a stable filename policy, explicit format metadata, conformance tests, and a clear failure message when its runtime capability is unavailable.

## 4. Product evolution phases

### Phase 0 — Baseline, contracts, and evidence

Deliverables:

- review the uncommitted arrangement delta;
- record current score statistics for the four fixtures, five styles, and three modes;
- identify all generated bundles and the website synchronization path;
- add a small quality-baseline harness without changing playback behavior;
- document the invariants listed in this specification as testable rules.

Exit gate: the current score pipeline is reproducible, the dirty collaborator work is understood, and no baseline file is overwritten.

### Phase 1 — Musical quality

Deliverables:

- formalize the Musical-mode arrangement stage;
- improve sectional energy and final cadence while keeping page provenance;
- introduce layer-aware mixing and frequency/density protection;
- refine attack, release, filter movement, reverb, low-frequency balance, and master dynamics;
- verify all 23 instruments through non-silent, non-clipping offline renders;
- retain the existing Hybrid and Analytical behavior unless a change is explicitly justified by a structural-fidelity test.

Exit gate: representative pages sound less flat or crowded, while their structural explanation, fingerprint, and deterministic score behavior remain stable.

### Phase 2 — Score and audio exports

Deliverables:

- introduce the encoder abstraction;
- preserve and harden WAV export;
- implement MIDI export from the same `Score` used by playback;
- add format selection and clear export status in the popup and demo;
- keep encoder-specific failures isolated from playback failures.

Exit gate: WAV and MIDI exports are valid, repeatable for the same semantic input, and visibly distinguishable in the UI.

### Phase 3 — Usefulness without concept drift

Deliverables:

- custom mapping profiles with schema validation and local persistence;
- reusable style/mode/tuning presets;
- stronger Explain Mode and visualizer linkage between page layers and notes;
- a deterministic compare workflow for two page snapshots or two site identities.

The compare workflow may compare derived features, profiles, scores, or exports, but it must not upload page data or turn WSE into a cloud analysis service.

Exit gate: users can understand, reproduce, tune, and export a page's sound without losing the fact that the page generated it.

### Phase 4 — WSE/FARHP sister-project connection

Deliverables:

- add a visible sister-project link in the WSE homepage footer and Demo footer;
- add a reciprocal WSE link to the public FARHP WebLab entry when FARHP's actual HTTPS URL is verified;
- use public WebLab landing pages, not staff dashboards or authenticated research endpoints;
- keep the copy accurate: WSE and FARHP are related sound/research projects, not one combined engine;
- sync and verify the deployed WSE bundle after the link is added.

The FARHP public URL is an external prerequisite. The implementation must verify the final URL and route before writing it into the site; the repository's example domain is not an acceptable deployment target.

Exit gate: both projects can discover each other through public links, and neither project gains a runtime or data dependency on the other.

### Phase 5 — Release and continuity

Deliverables:

- update README, machine-readable manifest, product site, Demo copy, and roadmap;
- publish a release note that separates implemented features from future format evaluations;
- verify core bundle → website demo synchronization;
- run the full validation matrix and perform a manual listening review;
- preserve a continuation card describing the exact release head, open risks, and the FARHP URL used for the sibling link.

## 5. Verification strategy

The existing unit suite and typecheck remain mandatory gates. New checks must cover:

### Semantic and deterministic checks

- identical feature snapshot and options produce identical profiles and events;
- variation changes the composition without changing the intended site identity fields;
- arrangement preserves event provenance, scale/range rules, and density/voice caps;
- Hybrid and Analytical modes retain their intended structural distinctions.

### Audio checks

- every instrument renders non-trivial energy;
- no rendered output contains NaN, sustained silence, or uncontrolled clipping;
- per-layer and master peak/dynamic metrics stay within defined limits;
- the same score uses the same seeded noise/reverb inputs;
- the live and offline paths use the same graph construction.

### Encoder checks

- WAV headers, PCM samples, channel layout, and deterministic filenames;
- MIDI track structure, tempo, note timing, pitch, velocity, and deterministic ordering;
- optional compressed encoders are tested independently and are never required for core playback.

### Browser and release checks

- Demo playback, stop, regenerate, modes, sliders, visualizer, and export;
- no console errors or failed asset loads;
- privacy behavior remains local-only;
- the deployed Demo contains the same pipeline as the reviewed core bundle;
- WSE/FARHP links resolve to the verified public routes and do not expose authenticated surfaces.

## 6. Non-goals

This design does not authorize:

- replacing structural sonification with an unrelated AI composer;
- sending page snapshots or audio to a server;
- merging FARHP's phase engine into WSE during this release;
- silently changing the fingerprint formula or existing privacy boundary;
- broad unrelated UI redesign;
- deploying a FARHP link before its public destination is verified.

## 7. Acceptance criteria

The first WSE evolution is accepted when:

1. The page remains the identifiable source of the music.
2. Musical mode is audibly more coherent without erasing structural provenance.
3. Hybrid and Analytical modes remain explainable and deterministic.
4. WAV remains reliable and MIDI is available as the first new export.
5. Representative voices and complete scores pass objective render checks and manual listening review.
6. Existing privacy, reproducibility, and guardrail tests remain green.
7. WSE and FARHP have accurate public sibling links without runtime coupling.

