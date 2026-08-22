# WSE v0.5 Score and Audio Export Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Add a deterministic MIDI export and a shared WAV/MIDI export layer to WSE v0.5 without changing how webpage structure becomes the semantic Score.

**Architecture:** Keep Score as the single source for playback, visualization, WAV rendering, and MIDI encoding. Separate format-neutral export metadata from format-specific encoders, then route popup, visualizer, and demo export controls through one format-aware browser download path. WAV remains the reference audio export; compressed audio formats and custom mapping profiles are separate later sub-projects.

**Tech Stack:** TypeScript, Web Audio API, Vitest, esbuild, Chrome MV3, and the existing standalone demo. No new runtime dependency.

**Spec:** docs/superpowers/specs/2026-08-22-wse-musical-evolution-design.md

## Global Constraints

- **Core identity:** “The program itself becomes music.” Export must preserve the structure-derived Score rather than replace it with unrelated composition.
- **Semantic source:** The same Score used by playback is the source for WAV and MIDI.
- **Determinism:** The same Score and export options produce byte-identical MIDI and deterministic WAV bytes within the existing Web Audio rendering tolerance.
- **Provenance:** MIDI tracks preserve WSE structural layers through deterministic track names and event ordering.
- **Privacy:** No page content, form values, query strings, or network upload is introduced by export.
- **Compatibility:** Existing WAV export callers remain functional while the shared export layer is added.
- **Formats:** This plan implements WAV and MIDI only. FLAC, Opus, and MP3 are not part of this plan.
- **UI:** Export failures are visible in the UI and do not break playback.
- **Scope:** No FARHP links, wse-site changes, custom profiles, or public deployment in this plan.
- **Dependencies:** Use the existing TypeScript, Vitest, Web Audio API, and esbuild setup; do not add a runtime package.

## File map

### New files

- src/audio/export-types.ts — format-neutral export types and options.
- src/audio/midi-encode.ts — deterministic Standard MIDI File encoder.
- src/audio/export-registry.ts — WAV/MIDI format selection and encoding.
- src/audio/export-download.ts — browser-only Blob/download adapter.
- tests/midi-encode.test.ts — MIDI byte/header/event/determinism tests.
- tests/export-contract.test.ts — format-neutral filename/download metadata tests.
- tests/export-registry.test.ts — WAV/MIDI dispatch tests.
- tests/ui-export-contract.test.ts — DOM contract tests for popup, visualizer, and demo export controls.

### Existing files to modify

- src/audio/export-wav.ts — preserve the public WAV wrapper while delegating encoded artifact construction.
- src/audio/wav-encode.ts — no behavior change unless shared artifact typing requires a narrow signature adjustment.
- src/ui/popup.html and src/ui/popup.ts — add WAV/MIDI selection and accessible export status.
- src/viz/visualizer.html and src/viz/visualizer.ts — add the same export selection/status contract.
- demo/demo.html and demo/demo.ts — add the same export selection/status contract.
- scripts/build.mjs — keep all existing entries and generated output rules.
- scripts/serve.mjs — keep the local demo routes (`/`, `/demo/`, `/quality.html`, and their generated bundles) explicit for browser verification.
- README.md — update only after the new export is verified.

## Task 1: Define the format-neutral export contract

**Files:**

- Create: src/audio/export-types.ts
- Create: src/audio/export-download.ts
- Create: tests/export-contract.test.ts

**Interfaces:**

~~~~ts
export type ExportFormat = "wav" | "midi";

export interface ExportOptions {
  brightness?: number;
  reverb?: number;
  sampleRate?: number;
}

export interface EncodedExport {
  format: ExportFormat;
  extension: "wav" | "mid";
  mimeType: "audio/wav" | "audio/midi";
  filename: string;
  bytes: ArrayBuffer;
}

export function exportFilename(
  score: Score,
  format: ExportFormat
): string;

export function downloadEncodedExport(
  artifact: EncodedExport,
  documentRef?: Document
): void;
~~~~

- [ ] **Step 1: Write failing type/filename tests.**

Test that the same Score creates deterministic names:

~~~~ts
expect(exportFilename(score, "wav")).toBe(
  "wse-" + score.fingerprint.hash + "-" + score.profile.style + ".wav"
);
expect(exportFilename(score, "midi")).toBe(
  "wse-" + score.fingerprint.hash + "-" + score.profile.style + ".mid"
);
expect(exportFilename({ ...score, variation: 2 }, "midi")).toContain("-v2.mid");
~~~~

Test that downloadEncodedExport creates a Blob with the declared MIME type, sets the deterministic download name, clicks one anchor, and revokes the object URL in its cleanup path. Keep this browser adapter test isolated from the encoders.

- [ ] **Step 2: Run the focused test and verify the missing contract failure.**

Run:

~~~~text
npm test -- --run tests/export-contract.test.ts
~~~~

Expected: FAIL because the format-neutral export modules do not exist.

- [ ] **Step 3: Implement the contract and download adapter.**

Move the existing deterministic WAV filename rule into exportFilename without changing its output. downloadEncodedExport must not use chrome.downloads, must not send data anywhere, and must report synchronous Blob/anchor errors to its caller.

- [ ] **Step 4: Run focused tests and typecheck.**

~~~~text
npm test -- --run tests/export-contract.test.ts tests/wav-encode.test.ts
npm run typecheck
~~~~

Expected: all focused tests pass and the existing WAV encoder tests remain green.

- [ ] **Step 5: Commit the contract unit.**

~~~~text
git add src/audio/export-types.ts src/audio/export-download.ts tests/export-contract.test.ts
git commit -m "feat: define shared WSE export artifact contract"
~~~~

## Task 2: Implement deterministic MIDI encoding

**Files:**

- Create: src/audio/midi-encode.ts
- Create: tests/midi-encode.test.ts

**Interfaces:**

~~~~ts
export interface MidiEncodeOptions {
  ticksPerQuarter?: number;
}

export function encodeScoreAsMidi(
  score: Score,
  options?: MidiEncodeOptions
): ArrayBuffer;
~~~~

Use Standard MIDI File format 1 with one tempo/meta track and one track for each of the six WSE NoteLayer values. The default PPQ is 480. The tempo track contains the score BPM as a Set Tempo meta event and a track name identifying WSE. Layer tracks use deterministic names WSE pad, WSE bass, WSE melody, WSE arp, WSE bell, and WSE perc.

Convert seconds to ticks with:

~~~~ts
ticks = Math.round(timeSeconds * score.profile.bpm * ticksPerQuarter / 60);
~~~~

For each NoteEvent, emit note-off before note-on when events share a tick. Clamp MIDI pitch to 0–127 and velocity to 1–127. Use stable ordering by absolute tick, note-off before note-on, pitch, velocity, instrument name. Encode all deltas as standard variable-length quantities. The output must contain no running-status ambiguity.

- [ ] **Step 1: Write failing MIDI tests.**

Cover:

- MThd header, format 1, six-layer-plus-tempo track count, and PPQ 480;
- tempo meta event matching profile BPM;
- layer track names;
- note-on and note-off events at expected ticks;
- deterministic bytes for repeated encoding;
- clamping of out-of-range pitch/velocity;
- empty layer tracks still ending with End of Track;
- valid VLQ encoding for deltas larger than 127 ticks.

~~~~ts
it("encodes the same Score to byte-identical MIDI", () => {
  const a = encodeScoreAsMidi(score);
  const b = encodeScoreAsMidi(score);
  expect(new Uint8Array(a)).toEqual(new Uint8Array(b));
});
~~~~

- [ ] **Step 2: Run focused tests and verify RED.**

Run: npm test -- --run tests/midi-encode.test.ts

Expected: FAIL because midi-encode.ts does not exist.

- [ ] **Step 3: Implement the binary encoder.**

Keep all byte-writing helpers local to midi-encode.ts: big-endian integers, ASCII chunks, VLQ, track assembly, and event sorting. Do not use a third-party MIDI package. Use the Score profile BPM and NoteEvent times/durations; do not regenerate notes or call the audio renderer.

- [ ] **Step 4: Run focused tests and typecheck.**

~~~~text
npm test -- --run tests/midi-encode.test.ts
npm run typecheck
~~~~

Expected: all MIDI tests pass with no output warnings and typecheck succeeds.

- [ ] **Step 5: Commit the MIDI encoder.**

~~~~text
git add src/audio/midi-encode.ts tests/midi-encode.test.ts
git commit -m "feat: add deterministic MIDI score export"
~~~~

## Task 3: Add the WAV/MIDI export registry

**Files:**

- Create: src/audio/export-registry.ts
- Modify: src/audio/export-wav.ts
- Create: tests/export-registry.test.ts

**Interfaces:**

~~~~ts
export async function encodeScore(
  score: Score,
  format: ExportFormat,
  options?: ExportOptions
): Promise<EncodedExport>;
~~~~

- [ ] **Step 1: Add failing registry tests.**

Test encodeScore(score, "midi") for deterministic bytes, .mid extension, and audio/midi MIME type. Test the WAV branch with a mocked render boundary only at the registry seam; keep the existing real WAV encoder tests as the non-mocked binary coverage. Test that an unsupported format cannot be represented by the TypeScript union and that runtime dispatch has an explicit error for an invalid JavaScript value.

- [ ] **Step 2: Run focused tests and verify RED.**

Run: npm test -- --run tests/export-registry.test.ts

Expected: FAIL because export-registry.ts and encodeScore do not exist.

- [ ] **Step 3: Implement the registry.**

The MIDI branch calls encodeScoreAsMidi(score). The WAV branch calls renderScoreOffline(score, options), then encodeWav(buffer), then returns an EncodedExport. Both branches use exportFilename(score, format). Do not make the MIDI branch create an AudioContext, and do not make the WAV branch duplicate MIDI timing logic.

- [ ] **Step 4: Preserve the existing WAV API.**

Keep exportScoreAsWav(score, opts) as a browser-facing compatibility wrapper that calls encodeScore(score, "wav", opts) and downloadEncodedExport. Existing popup, visualizer, and demo callers must continue compiling before UI migration.

- [ ] **Step 5: Run export regression tests.**

~~~~text
npm test -- --run tests/export-registry.test.ts tests/midi-encode.test.ts tests/wav-encode.test.ts
npm run typecheck
~~~~

Expected: all export tests and typecheck pass.

- [ ] **Step 6: Commit the registry.**

~~~~text
git add src/audio/export-registry.ts src/audio/export-wav.ts tests/export-registry.test.ts
git commit -m "feat: unify WSE WAV and MIDI export dispatch"
~~~~

## Task 4: Wire export format selection into all three UI surfaces

**Files:**

- Modify: src/ui/popup.html
- Modify: src/ui/popup.ts
- Modify: src/viz/visualizer.html
- Modify: src/viz/visualizer.ts
- Modify: demo/demo.html
- Modify: demo/demo.ts
- Create: tests/ui-export-contract.test.ts

**Interfaces:**

Use the same visible controls on all three surfaces:

~~~~html
<label class="export-format">
  <span>Format</span>
  <select id="export-format">
    <option value="wav">WAV</option>
    <option value="midi">MIDI</option>
  </select>
</label>
<button id="export" disabled>Export</button>
<p id="export-status" role="status" aria-live="polite"></p>
~~~~

- [ ] **Step 1: Add UI contract tests or DOM smoke assertions.**

For each HTML surface, assert the format select, export button, and live status element exist. Keep the assertions in the existing browser/demo smoke mechanism; do not create a second UI framework.

- [ ] **Step 2: Migrate popup export behavior.**

Replace the WAV-only click handler with a format-aware handler that calls encodeScore(lastScore, selectedFormat, currentRenderOptions), then downloadEncodedExport. Keep the button disabled until analysis creates lastScore. Status text must distinguish Rendering WAV…, Encoding MIDI…, WAV downloaded., MIDI downloaded., and failure text. A failed export must leave playback state unchanged.

- [ ] **Step 3: Migrate visualizer export behavior.**

Use the score in the existing VizPayload and the same format/status contract. The visualizer must not recompute the score or perform page extraction for export.

- [ ] **Step 4: Migrate standalone demo export behavior.**

Use the existing lastScore from the demo. Keep current default format WAV so existing users see no behavior change until they select MIDI. Do not change the demo's mapping, playback, visualizer, or privacy behavior.

- [ ] **Step 5: Run build and UI typecheck.**

~~~~text
npm run typecheck
npm run build
~~~~

Expected: extension, demo, and quality bundles build successfully, with no generated bundles staged.

- [ ] **Step 6: Commit the UI wiring.**

~~~~text
git add src/ui/popup.html src/ui/popup.ts src/viz/visualizer.html src/viz/visualizer.ts demo/demo.html demo/demo.ts tests/ui-export-contract.test.ts
git commit -m "feat: add WAV and MIDI export controls"
~~~~

## Task 5: Verify exports and update v0.5 documentation

**Files:**

- Modify: README.md
- Modify: scripts/serve.mjs
- Test: all existing tests, MIDI/export tests, and local browser export smoke.

- [ ] **Step 1: Run the complete automated suite.**

~~~~text
npm test -- --reporter=dot
npm run typecheck
git diff --check
~~~~

Expected: all tests pass, typecheck succeeds, and diff check reports no whitespace errors.

- [ ] **Step 2: Run the standalone demo over HTTP.**

~~~~text
npm run build
node scripts/serve.mjs
~~~~

Open http://localhost:8735/demo/ and verify:

- analyze/play still creates the structure-derived score;
- Export defaults to WAV;
- selecting MIDI triggers a .mid download with a deterministic filename;
- selecting WAV still triggers .wav;
- status text is visible and no console error occurs;
- the page remains local-only.

Use the same browser/CDP route that passed Phase 1; stop the server after verification.

- [ ] **Step 3: Validate binary outputs independently.**

For a fixed fixture Score, verify:

~~~~ts
expect(new Uint8Array(await encodeScore(score, "midi"))).toEqual(
  new Uint8Array(await encodeScore(score, "midi"))
);
expect((await encodeScore(score, "midi")).extension).toBe("mid");
expect((await encodeScore(score, "wav")).extension).toBe("wav");
~~~~

Use the existing WAV header tests and the MIDI parser assertions; do not judge correctness only by a download click.

- [ ] **Step 4: Update README with verified v0.5 scope.**

Document WAV plus MIDI export, deterministic MIDI track layers, the exact export controls, and the fact that FLAC/Opus/custom profiles/FARHP links remain separate future plans. Do not change the core slogan or privacy claim.

- [ ] **Step 5: Commit the verified documentation.**

~~~~text
git add README.md
git commit -m "docs: document WSE v0.5 WAV and MIDI export"
~~~~

- [ ] **Step 6: Run final export checkpoint.**

~~~~text
npm test -- --reporter=dot
npm run typecheck
npm run build
git diff --check
git status --short --branch
~~~~

Do not stage package-lock.json, generated demo/quality.js, dist output, SDD reports, wse-site, or FARHP files. Record the final test count, export smoke result, branch head, and any remaining external prerequisite in the SDD ledger.

## Handoff

After this plan is cleanly reviewed, Phase 2 is complete. The next independent plans are custom mapping profiles/compare workflow and WSE/FARHP sibling links. The WSE v0.5 version bump and public wse-site sync happen only after those scoped plans are either completed or explicitly separated from the release candidate.
