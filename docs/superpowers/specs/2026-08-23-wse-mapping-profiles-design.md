# WSE Mapping Profiles and Presets v1

## Status

Proposed design for review. This is the first Phase 3 sub-project after the
v0.5 low-end mix hardening checkpoint.

## 1. Goal and scope

Add safe, local-only Mapping Profiles and reusable Presets so a user can tune
how existing webpage structure is interpreted and replay the result without
turning WSE into a generic AI composer.

This sub-project covers:

- a validated `MappingProfile` schema for bounded structural emphasis;
- deterministic profile normalization and functional hashing;
- profile-aware score generation and Explain Mode metadata;
- built-in profiles and local user presets;
- popup/demo controls and Visualizer linkage for the selected profile.

The two-page Compare workflow is intentionally a separate follow-up. It needs
its own snapshot/diff contract and must not be smuggled into the profile
storage format.

## 2. Non-negotiable identity and privacy rules

1. The primary pipeline remains:

   `webpage/program → structural features → deterministic identity → score → audio`.

2. A profile can reweight existing structural character signals only. It cannot
   provide a note list, melody text, prompt, uploaded page, external audio, or
   arbitrary instrument graph.

3. The page's `PageFingerprint` remains a site-structure identity. Selecting a
   profile does not silently rewrite the fingerprint formula or the canonical
   feature string.

4. Every generated `NoteEvent` keeps the existing `NoteLayer` provenance. A
   profile may change which existing orchestration branch wins, but it may not
   remove provenance or invent an untraceable source.

5. Profile and preset data are local configuration. No raw `PageFeatures`, URL,
   query string, form value, page text, or DOM snapshot may be stored in a
   preset or sent over the network.

6. Existing callers that omit a profile must produce the current default score.
   The default profile is an identity overlay: all character weights are
   `1.0`, and it must not change the existing RNG draw order or score output.

## 3. Recommended architecture

Keep the existing pure mapping pipeline and add one narrow boundary:

```text
PageFeatures + PageFingerprint
        ↓
resolveMappingProfile(profile input)
        ↓
profile-weighted structural character
        ↓
existing style palette + existing score generator
        ↓
Score(profile metadata + NoteEvent provenance)
        ↓
shared audio / WAV / MIDI / Visualizer
```

`MappingProfile` is mapping configuration, not audio mix. The existing
`TuningOptions.mix` remains a render-level control and is carried separately.
`Preset` is a local named bundle that selects a profile, style, mode, and full
resolved tuning object.

### 3.1 MappingProfile contract

Create a focused mapping-profile module with these public shapes:

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

export function resolveMappingProfile(input?: MappingProfileInput): MappingProfile;
export function canonicalMappingProfile(profile: MappingProfile): string;
export function mappingProfileHash(profile: MappingProfile): string;
```

Validation rules are deterministic and local:

- `version` must be `1`; unsupported versions resolve to the default profile;
- `id` is lowercase ASCII `[a-z0-9][a-z0-9_-]{0,31}`; invalid IDs resolve to
  `balanced` rather than being used as a selector or HTML identifier;
- `label` is trimmed to at most 48 characters and `description` to at most 160
  characters; UI writes them with `textContent`, never `innerHTML`;
- each `characterBias` value must be finite and is clamped to `0.75..1.25`;
- omitted character keys resolve to `1.0` in the fixed order
  `content,navigation,media,form`;
- unknown object keys are ignored;
- the resolver returns a fresh object and never mutates the caller's input.

The built-in profiles are:

| id | character bias | intended use |
|---|---|---|
| `balanced` | all `1.00` | preserve the current mapping |
| `content-forward` | content `1.25`, other characters `0.85` | text/article-led pages |
| `navigation-forward` | navigation `1.25`, other characters `0.85` | link/button-led pages |
| `media-forward` | media `1.25`, other characters `0.85` | image/visual-led pages |
| `form-forward` | form `1.25`, other characters `0.85` | input/control-led pages |

The built-ins remain code-defined and immutable. A user profile is a resolved
copy with a user-selected ID and the same bounded fields.

### 3.2 Deterministic identity without fingerprint drift

`canonicalMappingProfile` serializes only the functional mapping fields in the
fixed schema order; label and description are display metadata and do not
change the functional hash. `mappingProfileHash` uses the existing deterministic
`hash64hex` helper.

`chooseOrchestration` receives the resolved profile and compares the four
existing normalized character signals after multiplying each by its profile
bias. It still returns one of the existing style palette voices. No new
instrument selection mechanism is introduced.

`deriveProfile` resolves the profile once and passes that same resolved object
to both `chooseOrchestration` and `buildExplain`. `generateScore` reuses the
profile metadata produced by `deriveProfile`; it must not independently resolve
or choose a second profile for the same score.

For `balanced`, all multipliers are exactly `1.0`, so the existing character
choice, RNG stream, notes, fingerprint, and exports remain unchanged. For a
non-default profile, the profile hash and ID are recorded in `MusicProfile`,
and the profile may select a different existing orchestration branch. The
fingerprint remains the same page identity and is never replaced by the profile
hash.

Extend the existing optional metadata contracts without breaking hand-built
test fixtures:

```ts
export interface MusicProfile {
  // existing fields...
  mappingProfileId?: string;
  mappingProfileLabel?: string;
  mappingProfileHash?: string;
}

export interface GenerateOptions {
  // existing fields...
  mappingProfile?: MappingProfileInput;
}
```

Generated scores always use a resolved profile internally; the public metadata
fields remain optional so existing callers and serialized v1 fixtures stay
valid.

### 3.3 Explain Mode and Visualizer linkage

`MusicProfile.explain` receives one additional deterministic item near the
front of the existing explanation list:

```text
Mapping profile · Content-forward → content 125%, navigation 85%, media 85%, form 85%
```

The item describes the structural weighting effect, not a claim that the
profile authored notes. Existing feature/effect explanations remain intact.

The popup keeps its current Explain Mode and displays the selected profile
label/hash metadata. The demo and Visualizer consume the same `Score.profile`
metadata; they do not recompute character bias or create a second profile
registry. The Visualizer adds a compact profile label to its existing identity
line/legend, with safe text rendering.

## 4. Presets and local persistence

Create a versioned local preset envelope separate from page analysis:

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
```

The preset resolver uses the existing style/mode allowlists and the existing
tuning/layer-mix resolvers. It stores only the fields above; `PageFeatures`,
`PageFingerprint`, `Score`, tokens, URL, and variation are never persisted in a
preset.

Use one versioned local storage key, `wse.presets.v1`, with a maximum of 12
user presets. Invalid entries are ignored individually; one malformed entry
must not erase valid presets. Duplicate IDs replace the old entry
deterministically. Built-in profiles are always available even if storage is
empty or unavailable.

The popup and demo expose:

- a profile selector containing the five built-ins plus valid saved profiles;
- four bounded character-bias controls for a custom profile;
- the existing style/mode/tuning/mix controls;
- `Save preset`, `Delete preset`, and `Reset` actions;
- visible profile label and explanation status.

Preset names are user configuration, not page input. They are trimmed,
length-limited, rendered with `textContent`, and never sent to the content
script or included in the page fingerprint. Reset restores the balanced
profile, existing default style/mode, existing tuning defaults, and the v0.5
mix defaults.

## 5. Error handling and compatibility

- Storage read failures fall back to built-in profiles and defaults; playback
  remains available.
- Invalid profile/preset data is normalized locally and never throws into the
  audio start path.
- Profile selection changes require a new analysis/play action; changing a
  selector must not mutate an already-generated `Score` in place.
- WAV and MIDI continue to consume the resulting `Score`; MIDI remains
  independent of render mix and profile UI state after the score is generated.
- No new runtime dependency, server endpoint, permission, upload route, or
  cross-project coupling is introduced.

## 6. Verification strategy

Pure profile tests must cover:

- default resolution and identity behavior;
- partial merge, finite clamping, unsupported version, invalid ID, and
  non-finite inputs;
- canonical serialization stability, display-metadata independence, and fresh
  result objects;
- all built-in profiles and bounded character-bias effects.

Mapping tests must cover:

- balanced profile output equals the current default output;
- a non-default profile changes only the intended orchestration choice or
  bounded structural gate;
- the same features, fingerprint, options, and profile resolve identically;
- `NoteEvent.layer` provenance and score density/voice caps remain valid;
- fingerprint remains unchanged when only profile changes.

Preset/UI tests must cover:

- storage envelope versioning, malformed-entry isolation, duplicate replacement,
  twelve-entry cap, reset, and local-only field shape;
- popup/demo selector and four bias-control DOM contracts;
- profile values reach `GenerateOptions.mappingProfile` and do not enter
  `PageFeatures` or fingerprint inputs;
- Visualizer displays the score profile metadata without a second registry.

Browser smoke must verify:

- built-in and saved profile selection changes the displayed profile identity;
- the same page's fingerprint remains stable while the profile metadata and
  structure-derived orchestration explanation change as expected;
- reload restores local presets without network traffic or console errors;
- WAV/MIDI export and existing low-end controls continue to work.

## 7. Non-goals and follow-up boundaries

This design does not authorize:

- free-form note or melody authoring;
- arbitrary JavaScript/JSON rule execution;
- profile data sent to a server or shared with FARHP;
- changing the fingerprint formula;
- changing the 23-instrument catalog or creating a second synthesis engine;
- the two-page Compare workflow (next independent Phase 3 sub-project);
- FLAC/Opus, public deployment, release versioning, or FARHP links.

## 8. Acceptance criteria

The sub-project is accepted when:

1. Existing default calls and balanced-profile calls produce the same score.
2. A non-default profile changes only bounded, explainable existing mapping
   choices and preserves page fingerprint and note provenance.
3. Profiles and presets validate, persist, restore, and reset locally without
   page data or network activity.
4. Popup, Demo, Explain Mode, Visualizer, WAV, and MIDI consume one resolved
   profile/preset path.
5. Existing v0.5 tests plus new profile/preset/UI tests pass, typecheck/build
   pass, and browser smoke records the profile/fingerprint separation.
