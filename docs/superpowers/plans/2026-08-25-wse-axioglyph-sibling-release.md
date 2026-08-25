# WSE v0.5.0 Axioglyph Sibling Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the WSE v0.5.0 public-release update with reciprocal public links to Axioglyph, synchronized website/demo assets, and a prepared Chrome Web Store update package without coupling either project at runtime.

**Architecture:** WSE remains a local-only browser extension whose score and audio pipeline are independent of Axioglyph. The sibling relationship is represented only by explicit HTTPS footer links in the public WSE homepage/demo and the Axioglyph public landing page; WSE's generated demo remains sourced from the core repository. Release metadata is versioned to 0.5.0 across the extension, README, product site, machine-readable manifest, demo copy, roadmap, and Store submission kit.

**Tech Stack:** TypeScript, Vitest, Node.js build scripts, static HTML, Python `unittest`, Cloudflare Workers Static Assets, Chrome MV3.

**Spec:** `docs/superpowers/specs/2026-08-22-wse-musical-evolution-design.md`

## Global Constraints

- Preserve the core identity: the webpage's accessible computational structure becomes deterministic generative music.
- Keep processing local-only; do not read form values, upload page content, add telemetry, or introduce runtime/storage/auth coupling with Axioglyph.
- Use the verified public Axioglyph URL `https://axioglyph.evemisslab.com/`; do not mention or link the unfinished FARHP WebLab.
- Use public landing pages only; do not link staff dashboards, authenticated research endpoints, or placeholders.
- Keep WAV and MIDI as the implemented export formats; do not claim FLAC, Opus, or MP3 implementation.
- The Chrome Web Store work is an update to the existing listing; local packaging and copy preparation do not claim that a review submission occurred.

---

### Task 1: Lock the sibling-link and release contracts with failing tests

**Files:**
- Create: `tests/sibling-release.test.ts`
- Create: `scripts/verify-sibling-links.mjs` in `D:/Ai/網站群/wse-site`
- Modify: `empsl/v0.4/tests/test_site_content_v0.4.py` in `D:/Ai/work together/FARHP`

**Interfaces:**
- The WSE Vitest contract reads the core `demo/demo.html` and `manifest.json`.
- The WSE site verifier exits non-zero unless the homepage/demo contain the Axioglyph link and version 0.5.0.
- The Axioglyph content test asserts a reciprocal WSE link in the public footer.

- [ ] **Step 1: Add the WSE core contract test** for the exact Axioglyph URL, v0.5.0 manifest version, and MIDI/Presets wording.
- [ ] **Step 2: Add the static WSE site verifier** with exact paths and assertions for homepage, demo, machine-readable manifest, and the reciprocal URL.
- [ ] **Step 3: Extend the Axioglyph site contract test** with the exact WSE URL and public-footer boundary.
- [ ] **Step 4: Run each new test and confirm it fails because the current HTML/metadata is still v0.4.1 and has no sibling link.**

### Task 2: Add reciprocal public links without runtime coupling

**Files:**
- Modify: `demo/demo.html` in `D:/Ai/work together/WebCode Sonification Engine`
- Modify: `public/index.html` in `D:/Ai/網站群/wse-site`
- Modify: `empsl/v0.4/index.html` in `D:/Ai/work together/FARHP`

**Interfaces:**
- WSE homepage and generated demo expose `https://axioglyph.evemisslab.com/` as a public sister-project link.
- Axioglyph exposes `https://wse.evemisstechnology.com/` as a public sister-project link.
- Copy says these are related projects and does not imply a shared engine or research backend.

- [ ] **Step 1: Add the WSE demo footer link** in the source demo so the existing sync script propagates it to `wse-site/public/demo/index.html`.
- [ ] **Step 2: Add the WSE homepage footer link** beside the existing public project links.
- [ ] **Step 3: Add the Axioglyph footer link** to the WSE public landing page.
- [ ] **Step 4: Build Axioglyph's `site/dist` and run its content tests.**

### Task 3: Promote the verified feature set to v0.5.0 release metadata

**Files:**
- Modify: `package.json`, `manifest.json`, `README.md`, `demo/demo.html` in `D:/Ai/work together/WebCode Sonification Engine`
- Modify: `public/index.html`, `public/demo/index.html`, `public/ai/manifest.json`, `public/llms.txt`, `public/privacy/index.html` in `D:/Ai/網站群/wse-site`
- Modify: `store/SUBMISSION.md`, `store/listing-en.md`, `store/listing-zh.md` in `D:/Ai/work together/WebCode Sonification Engine`

**Interfaces:**
- All user-facing WSE release metadata says v0.5.0 where the release is described.
- Release notes distinguish implemented Mapping Profiles, local Presets, low-end/layer mix controls, and MIDI from future compressed encoders.
- Store guidance says upload a higher-version package to the existing listing and does not claim that review has happened.

- [ ] **Step 1: Update extension package and MV3 manifest versions to 0.5.0.**
- [ ] **Step 2: Rewrite the README status, feature summary, changelog entry, and privacy-safe export description from verified implementation facts.**
- [ ] **Step 3: Update the product site, Demo copy, machine-readable manifest, and roadmap to the same v0.5.0 facts.**
- [ ] **Step 4: Update the Store listing kit for an existing-item v0.5.0 update, including MIDI, profiles, presets, and current privacy boundaries.**

### Task 4: Synchronize, package, and verify the release candidate

**Files:**
- Modify: generated `public/demo/index.html`, `public/demo/demo.js`, and icon assets in `D:/Ai/網站群/wse-site`
- Create: `store/wse-v0.5.0-store.zip` as a generated local upload artifact in `D:/Ai/work together/WebCode Sonification Engine`
- Create: a continuation/release evidence note under `docs/superpowers/` in the WSE repository

- [ ] **Step 1: Run `npm test`, `npm run typecheck`, `npm run build`, and `git diff --check` in WSE.**
- [ ] **Step 2: Run `node scripts/sync-demo.mjs` from `wse-site` and verify core demo/bundle hashes match.**
- [ ] **Step 3: Run the static WSE site verifier and inspect the generated diff.**
- [ ] **Step 4: Run Axioglyph's public build and complete site test suite.**
- [ ] **Step 5: Build `dist/`, package the existing Chrome listing update zip, and verify the zip manifest is version 0.5.0 with no remote code.**
- [ ] **Step 6: Perform HTTP GET checks for both public URLs and reciprocal link presence; record any deployment lag separately from local evidence.**

### Task 5: Commit and publish authorized repository updates

- [ ] **Step 1: Review each repo's diff and status, preserving unrelated `.superpowers/` and stash recovery artifacts.**
- [ ] **Step 2: Commit WSE core/release changes and push WSE `main`.**
- [ ] **Step 3: Commit Axioglyph source/build-contract changes and push FARHP `main`.**
- [ ] **Step 4: Commit product-site synchronization changes and push `wse-site` `main`.**
- [ ] **Step 5: Re-read remote heads and report local commits, public-link evidence, and any Cloudflare deployment or Chrome review state that remains external.**
