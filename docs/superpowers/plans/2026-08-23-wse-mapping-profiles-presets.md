# WSE Mapping Profiles and Presets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement validated structural Mapping Profiles, local reusable Presets, and shared Explain/Visualizer identity for WSE Phase 3 without changing the page-derived music boundary.

**Architecture:** Add a pure mapping-profile resolver beside the existing mapping profile derivation code, then pass one resolved profile through orchestration, score metadata, Explain Mode, and UI. Keep audio mix separate from mapping bias, store only bounded local configuration in versioned presets, and reuse the existing score/audio/export pipeline.

**Tech Stack:** TypeScript, Vitest, the existing Chrome MV3 popup, standalone demo, Chrome storage/localStorage, Web Audio, esbuild, and the current deterministic hashing helpers. No new runtime dependency.

**Spec:** `docs/superpowers/specs/2026-08-23-wse-mapping-profiles-design.md`

## Global Constraints

- Core identity: `webpage/program → structural features → deterministic identity → score → audio` remains the only composition pipeline.
- A profile reweights existing structural character signals only; it cannot provide notes, melody text, prompts, uploaded pages, external audio, or arbitrary instrument graphs.
- `PageFingerprint` and `canonicalFeatureString` do not include profile configuration; profile identity is separate score metadata.
- Every generated `NoteEvent` keeps its existing `NoteLayer` provenance and all existing density/voice caps remain active.
- Existing calls that omit a profile preserve the current default score behavior; the balanced profile uses all character multipliers at `1.0` and does not change the RNG draw order.
- Profile and preset data are local-only; never store or transmit `PageFeatures`, URL, query strings, form values, page text, DOM snapshots, tokens, Score objects, or audio.
- `TuningOptions.mix` remains render-level audio configuration and is never merged into MappingProfile character bias.
- Built-in profiles are immutable and code-defined; user profiles/presets are validated before use and invalid entries are ignored individually.
- No new permissions, network routes, runtime packages, FARHP coupling, FLAC/Opus, deployment, or release-version changes.
- Preserve unrelated dirty files on `main` and keep all implementation in `codex/wse-v05-clean`.

---

## File map

### Existing files to modify

- `src/shared/types.ts` — add MappingProfile and WsePreset contracts; add optional profile input/metadata without breaking existing fixtures.
- `src/mapping/orchestration.ts` — apply bounded character bias before choosing the existing style-palette voices.
- `src/mapping/profile.ts` — resolve one profile for profile derivation and add the profile Explain item/metadata.
- `src/mapping/default-map.ts` — pass the same resolved profile through score generation and preserve note provenance.
- `src/mapping/index.ts` — export the new profile resolver and built-ins.
- `src/ui/popup.html`, `src/ui/popup.css`, `src/ui/popup.ts` — add profile controls, preset actions, local persistence, and GenerateOptions wiring.
- `demo/demo.html`, `demo/demo.ts` — add the same controls and local preset behavior to the standalone page.
- `src/viz/visualizer.html`, `src/viz/visualizer.css`, `src/viz/visualizer.ts` — display the selected profile metadata without a second registry.
- `tests/orchestration.test.ts` — cover profile-weighted character selection.
- `tests/ui-export-contract.test.ts` — extend popup/demo/Visualizer DOM and profile wiring contracts.
- `tests/viz.test.ts` — add score-metadata fixture assertions for profile fields consumed by the Visualizer.
- `README.md` — document only the verified profile/preset behavior after browser smoke.

### New files

- `src/mapping/mapping-profile.ts` — pure resolver, built-in profiles, canonical serialization, and deterministic profile hash.
- `src/ui/profile-controls.ts` — DOM-free profile-bias conversion helpers shared by popup and demo.
- `src/ui/presets.ts` — pure preset envelope validation, list parsing, upsert/delete, tuning resolution, and storage constants.
- `tests/mapping-profile.test.ts` — resolver/hash/built-in profile tests.
- `tests/profile-integration.test.ts` — deterministic score/orchestration/fingerprint/provenance tests.
- `tests/preset-store.test.ts` — malformed-entry isolation, duplicate replacement, cap, reset inputs, and local-only field shape.

## Task 1: Add the validated MappingProfile contract

**Files:**

- Modify: `src/shared/types.ts`
- Create: `src/mapping/mapping-profile.ts`
- Modify: `src/mapping/index.ts`
- Create: `tests/mapping-profile.test.ts`

**Interfaces:**

```ts
export type MappingProfileVersion = 1;

export interface MappingProfile {
  version: MappingProfileVersion;
  id: string;
  label: string;
  description: string;
  characterBias: Record<PageCharacter, number>;
}

export interface MappingProfileInput {
  version?: number;
  id?: string;
  label?: string;
  description?: string;
  characterBias?: Partial<Record<PageCharacter, number>>;
}

export const DEFAULT_MAPPING_PROFILE: MappingProfile;
export const BUILTIN_MAPPING_PROFILES: readonly MappingProfile[];
export function resolveMappingProfile(input?: MappingProfileInput): MappingProfile;
export function canonicalMappingProfile(profile: MappingProfile): string;
export function mappingProfileHash(profile: MappingProfile): string;
```

Required behavior:

- fixed character order is `content,navigation,media,form`;
- all omitted/invalid/non-finite bias values resolve to `1.0` and finite values clamp to `0.75..1.25`;
- unsupported versions and invalid IDs resolve to the balanced profile identity;
- IDs match lowercase ASCII `[a-z0-9][a-z0-9_-]{0,31}`;
- labels trim to 48 characters and descriptions trim to 160 characters;
- unknown keys are ignored and callers' objects are never mutated;
- canonical serialization includes only version and functional bias values in fixed order, not label/description;
- hash uses the existing `hash64hex` helper;
- built-ins are `balanced`, `content-forward`, `navigation-forward`, `media-forward`, and `form-forward` with the exact bias values in the spec;
- every resolver call returns a fresh object.

- [ ] **Step 1: Write failing pure tests.**

Add tests for omitted defaults, partial merge, range and non-finite handling,
invalid version/ID, label/description bounds, unknown-key removal, fresh
objects, canonical string stability, display-metadata-independent hashes, and
the five immutable built-ins.

```ts
it("keeps the balanced profile identity-compatible with old callers", () => {
  expect(resolveMappingProfile()).toMatchObject({
    version: 1,
    id: "balanced",
    characterBias: { content: 1, navigation: 1, media: 1, form: 1 },
  });
  expect(resolveMappingProfile({ characterBias: { media: 1.25 } }).characterBias)
    .toEqual({ content: 1, navigation: 1, media: 1.25, form: 1 });
});
```

- [ ] **Step 2: Run focused tests and verify RED.**

Run: `npm test -- --run tests/mapping-profile.test.ts`

Expected: FAIL because the resolver module and shared contracts do not exist.

- [ ] **Step 3: Implement the pure resolver and built-ins.**

Keep this module independent of DOM, Chrome APIs, audio, and UI. Use fixed
field order for both canonical serialization and built-in definitions.

- [ ] **Step 4: Run focused tests and typecheck.**

Run:

```text
npm test -- --run tests/mapping-profile.test.ts
npm run typecheck
```

Expected: focused tests and typecheck pass.

- [ ] **Step 5: Commit the profile contract.**

```text
git add src/shared/types.ts src/mapping/mapping-profile.ts src/mapping/index.ts tests/mapping-profile.test.ts
git commit -m "feat: add WSE mapping profile contract"
```

## Task 2: Integrate profile bias into deterministic mapping

**Files:**

- Modify: `src/shared/types.ts`
- Modify: `src/mapping/orchestration.ts`
- Modify: `src/mapping/profile.ts`
- Modify: `src/mapping/default-map.ts`
- Modify: `src/mapping/index.ts`
- Modify: `tests/orchestration.test.ts`
- Create: `tests/profile-integration.test.ts`

**Interfaces:**

```ts
export function detectCharacter(
  norm: NormalizedFeatures,
  profile?: MappingProfile
): PageCharacter;

export function chooseOrchestration(
  norm: NormalizedFeatures,
  style: StyleName,
  profile?: MappingProfile
): Orchestration;

export interface GenerateOptions {
  style: StyleName;
  mode: ModeName;
  variation: number;
  tuning?: TuningOptions;
  mappingProfile?: MappingProfileInput;
}

export interface MusicProfile {
  mappingProfileId?: string;
  mappingProfileLabel?: string;
  mappingProfileHash?: string;
}
```

The profile is resolved once in `generateScore`, passed into `deriveProfile`,
and reused for orchestration and Explain generation. `deriveProfile` must not
resolve a different object for the same call. `default-map.ts` must not add a
new RNG draw for profile resolution; balanced output keeps the existing draw
order. The profile only multiplies the four existing normalized character
signals before `detectCharacter`; it does not add instruments, notes, or a
second mapping path.

- [ ] **Step 1: Write failing integration tests.**

Cover balanced/default event and fingerprint equality, custom profile
character selection, repeated deterministic output, unchanged fingerprint,
unchanged NoteLayer provenance, and existing density/voice caps.

```ts
it("keeps page identity stable while a profile changes mapping emphasis", () => {
  const base = generateScore(features, fingerprint, baseOptions);
  const focused = generateScore(features, fingerprint, {
    ...baseOptions,
    mappingProfile: { id: "content-forward", characterBias: { content: 1.25 } },
  });
  expect(focused.fingerprint).toEqual(base.fingerprint);
  expect(focused.events.every((event) => ["pad", "bass", "melody", "arp", "bell", "perc"].includes(event.layer))).toBe(true);
  expect(focused.profile.mappingProfileId).toBe("content-forward");
});
```

- [ ] **Step 2: Run focused tests and verify RED.**

Run: `npm test -- --run tests/profile-integration.test.ts tests/orchestration.test.ts`

Expected: FAIL because orchestration and GenerateOptions do not accept profile
bias yet.

- [ ] **Step 3: Pass one resolved profile through mapping.**

Update `detectCharacter`/`chooseOrchestration` with an optional profile that
defaults to `DEFAULT_MAPPING_PROFILE`. Update `deriveProfile` and
`buildExplain` so the same resolved profile supplies the profile metadata and
one deterministic explanation item. Update `generateScore` to pass the
resolved profile to both profile derivation and the existing event generation
orchestration lookup without changing the random stream or provenance fields.

- [ ] **Step 4: Run focused integration and regression tests.**

Run:

```text
npm test -- --run tests/mapping-profile.test.ts tests/profile-integration.test.ts tests/orchestration.test.ts tests/determinism.test.ts tests/viz.test.ts
npm run typecheck
```

Expected: all focused files pass and typecheck is clean.

- [ ] **Step 5: Commit deterministic mapping integration.**

```text
git add src/shared/types.ts src/mapping/orchestration.ts src/mapping/profile.ts src/mapping/default-map.ts src/mapping/index.ts tests/orchestration.test.ts tests/profile-integration.test.ts
git commit -m "feat: integrate mapping profiles into WSE scores"
```

## Task 3: Add the versioned local preset store

**Files:**

- Modify: `src/shared/types.ts`
- Create: `src/ui/presets.ts`
- Create: `tests/preset-store.test.ts`

**Interfaces:**

```ts
export interface WsePreset {
  version: 1;
  id: string;
  label: string;
  mappingProfile: MappingProfile;
  style: StyleName;
  mode: ModeName;
  tuning: TuningOptions;
}

export interface WsePresetEnvelope {
  version: 1;
  presets: WsePreset[];
}

export const PRESET_STORAGE_KEY = "wse.presets.v1";
export const MAX_USER_PRESETS = 12;
export function resolveTuningOptions(value?: Partial<TuningOptions>): TuningOptions;
export function normalizePreset(value: unknown): WsePreset | null;
export function readPresetEnvelope(value: unknown): WsePreset[];
export function upsertPreset(list: readonly WsePreset[], preset: WsePreset): WsePreset[];
export function removePreset(list: readonly WsePreset[], id: string): WsePreset[];
export function serializePresetEnvelope(list: readonly WsePreset[]): WsePresetEnvelope;
```

`resolveTuningOptions` must reuse `resolveLayerMix`, preserve current tuning
defaults, clamp numeric values to the existing UI-safe ranges, and return a
fresh full tuning object. `normalizePreset` validates style/mode allowlists,
normalizes the profile, trims/validates the preset ID and label, and rejects
anything that contains page data or an unsupported version. `readPresetEnvelope`
ignores malformed entries individually. `upsertPreset` replaces duplicate IDs
and keeps the newest 12 entries in stable list order.

- [ ] **Step 1: Write failing pure store tests.**

Cover full tuning defaults, malformed envelope entries, duplicate replacement,
the 12-entry cap, invalid style/mode/profile handling, fresh normalized values,
serialization shape, and the absence of URL/features/tokens/Score fields.

- [ ] **Step 2: Run the focused store test and verify RED.**

Run: `npm test -- --run tests/preset-store.test.ts`

Expected: FAIL because the preset store module and contracts do not exist.

- [ ] **Step 3: Implement pure preset normalization and list operations.**

Do not call Chrome APIs, localStorage, DOM APIs, or network APIs from this
module; popup and demo provide the storage adapters.

- [ ] **Step 4: Run store tests and typecheck.**

Run:

```text
npm test -- --run tests/preset-store.test.ts tests/mapping-profile.test.ts tests/mix-tuning.test.ts
npm run typecheck
```

- [ ] **Step 5: Commit the local preset contract.**

```text
git add src/shared/types.ts src/ui/presets.ts tests/preset-store.test.ts
git commit -m "feat: add local WSE preset store contract"
```

## Task 4: Add popup and demo profile/preset controls

**Files:**

- Create: `src/ui/profile-controls.ts`
- Modify: `src/ui/popup.html`
- Modify: `src/ui/popup.css`
- Modify: `src/ui/popup.ts`
- Modify: `demo/demo.html`
- Modify: `demo/demo.ts`
- Modify: `tests/ui-export-contract.test.ts`

**Interfaces:**

Use these exact controls in both popup and demo:

```html
<select id="mapping-profile"></select>
<input id="p-content" type="range" min="75" max="125" value="100">
<input id="p-navigation" type="range" min="75" max="125" value="100">
<input id="p-media" type="range" min="75" max="125" value="100">
<input id="p-form" type="range" min="75" max="125" value="100">
<input id="preset-name" type="text" maxlength="48">
<button id="save-preset">Save preset</button>
<button id="delete-preset">Delete preset</button>
```

Value spans must be visible and use IDs `v-p-content`, `v-p-navigation`,
`v-p-media`, and `v-p-form`. Existing style/mode/playback, tuning/mix,
Explain, export, and status controls remain intact.

`src/ui/profile-controls.ts` stays DOM-free and exposes fixed character order,
`profileBiasFromValues`, `profileBiasToSliderValues`, and a helper that marks
the profile as `custom` when bias sliders diverge from a selected built-in.
Popup uses Chrome storage; demo uses localStorage, but both store the same
`wse.presets.v1` envelope shape and call the same pure helpers.

- [ ] **Step 1: Extend UI contract tests before implementation.**

Assert both HTML surfaces contain the exact profile selector, four bounded bias
sliders, value spans, preset buttons, existing mix controls, Explain section,
export/status controls, and source-level GenerateOptions mapping-profile
wiring. Assert profile values are not read by content extraction selectors.

- [ ] **Step 2: Run the UI contract test and verify RED.**

Run: `npm test -- --run tests/ui-export-contract.test.ts`

Expected: FAIL because the profile controls and preset actions do not exist.

- [ ] **Step 3: Implement shared profile-control helpers and markup/styles.**

Add the same labels, ranges, defaults, dark/light-visible styling, profile
selector options, name field, and action/status elements to popup and demo.
Use `textContent` for profile/preset labels and never inject user strings as
HTML.

- [ ] **Step 4: Wire popup and demo state.**

Extend current tuning state with `mappingProfile`. Load and normalize stored
preset envelopes individually, populate profile selector options, apply a
selected built-in or saved preset to style/mode/tuning/profile controls, and
save local settings without page data. Slider changes update the current
profile bias only; Save preset writes the current full configuration; Delete
removes only the selected saved preset; Reset restores balanced/defaults.

- [ ] **Step 5: Pass profile to score generation and preserve current flows.**

Pass `mappingProfile: currentMappingProfile()` into popup/demo
`generateScore` options. Do not alter feature extraction, fingerprint input,
variation handling, live/scroll mode selection, audio mix propagation, or
export registry calls. A profile change takes effect only on the next
Analyze/Play action.

- [ ] **Step 6: Run focused UI tests, typecheck, and build.**

Run:

```text
npm test -- --run tests/ui-export-contract.test.ts tests/preset-store.test.ts tests/profile-integration.test.ts
npm run typecheck
npm run build
```

- [ ] **Step 7: Commit popup/demo profile controls.**

```text
git add src/ui/profile-controls.ts src/ui/popup.html src/ui/popup.css src/ui/popup.ts demo/demo.html demo/demo.ts tests/ui-export-contract.test.ts
git commit -m "feat: add WSE mapping profile controls"
```

## Task 5: Link Visualizer metadata and complete verification

**Files:**

- Modify: `src/viz/visualizer.html`
- Modify: `src/viz/visualizer.css`
- Modify: `src/viz/visualizer.ts`
- Modify: `tests/viz.test.ts`
- Modify: `tests/ui-export-contract.test.ts`
- Modify: `README.md`

**Interfaces:**

The Visualizer reads `Score.profile.mappingProfileId`,
`mappingProfileLabel`, and `mappingProfileHash` from the payload already
stored by popup/demo. It must not import the profile registry to recompute
character bias. Add a compact `Profile` identity span to the existing meta
line and render it with `textContent`.

- [ ] **Step 1: Add failing Visualizer metadata tests.**

Assert the Visualizer HTML contains a profile metadata target and the source
uses score profile metadata, not a second profile selector/registry.

- [ ] **Step 2: Run focused Visualizer tests and verify RED.**

Run: `npm test -- --run tests/viz.test.ts tests/ui-export-contract.test.ts`

Expected: FAIL because the Visualizer has no profile metadata target.

- [ ] **Step 3: Implement payload metadata display.**

Add the profile label/hash to `renderMeta`, preserve the existing identity line,
export controls, token provenance, playback, and low-end render options. Add
only the minimum CSS required for readable light/dark profile metadata.

- [ ] **Step 4: Update README after code behavior is verified.**

Document bounded Mapping Profiles, five built-ins, local Presets, the fact that
profiles reweight existing webpage structure, and that fingerprints remain page
identity. Do not claim Compare, FARHP, arbitrary rules, or remote storage.

- [ ] **Step 5: Run the complete automated gate.**

Run:

```text
npm test -- --reporter=dot
npm run typecheck
npm run build
git diff --check
```

Expected: all tests pass, bundles build, and no whitespace errors occur.

- [ ] **Step 6: Run browser smoke and quality regression.**

Start the existing local server from the clean worktree and inspect
`http://localhost:8735/demo/` and `http://localhost:8735/quality.html` in the
in-app browser. Verify:

- Balanced profile defaults load with the existing v0.5 summary/fingerprint.
- Selecting Content-forward changes profile label/hash and the explain item,
  while the page fingerprint stays unchanged.
- Saving/reloading a preset restores local settings with no external requests,
  console errors, or page data in storage fields.
- WAV/MIDI export and Low End/Pads/Melody/Rhythm controls still work.
- Quality page remains `23/23` with finite, non-silent, non-clipped output.

Record exact observed summary, profile metadata, console/resource evidence, and
quality min/max metrics in the SDD ledger. Do not modify thresholds or deploy.

- [ ] **Step 7: Commit verified Visualizer/docs and handoff.**

```text
git add src/viz/visualizer.html src/viz/visualizer.css src/viz/visualizer.ts tests/viz.test.ts tests/ui-export-contract.test.ts README.md
git commit -m "feat: complete WSE mapping profile and preset surfaces"
```

After the final branch review, keep Compare as the next independent Phase 3
sub-project and keep the existing MIDI PPQ hardening follow-up separate.
