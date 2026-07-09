# WebCode Sonification Engine (WSE)

**An open-source experimental browser extension for transforming webpage computational structure into deterministic and generative music.**

> Every webpage already has a structure. We let you hear it.
> **The web was never silent.**

網頁代碼音樂化引擎——讀取目前網頁的 DOM、HTML、CSS 與可存取結構特徵，透過可重現的生成規則把它轉成音樂。

- **Status:** v0.3.0 developer preview (Chrome, Manifest V3)
- **Website:** https://wse.evemisstechnology.com/ (live in-browser demo included)
- **Repository:** https://github.com/kakon77777-commits/webcode-sonification-engine
- **License:** Apache-2.0
- **Privacy:** local-only — nothing ever leaves your browser

---

## What it does

Click the extension icon → **Analyze & Play**. WSE reads the structure of the current tab — DOM topology, tag histogram, sampled computed styles, visual geometry — and turns it into a 30–90 second piece of generative music, synthesized live with the Web Audio API.

```
W → F(W) → Z → S_W → Θ → Q → A
Webpage → Features → Normalized → Fingerprint → Profile → Score → Audio
```

The mapping is **deterministic**: the same page structure always produces the same music. Every site gets its own **Site Sound Signature** — Wikipedia does not sound like GitHub, because their structures differ, not because anyone hard-coded it.

### Default mapping rules (Θ_default)

| Page feature | Musical effect |
| --- | --- |
| Tag diversity (entropy) + node/script/link density | Tempo (52–176 BPM) |
| Average CSS hue | Key (12 pitch classes) |
| Palette lightness × saturation | One of **7 scales**: major, minor, dorian, lydian, mixolydian, both pentatonics |
| Dominant structure family (content / navigation / media / form) | **Lead & arpeggio instruments** within the chosen style palette |
| DOM max depth | Pitch register width |
| Link density | Arpeggio busyness (per-site Euclidean pattern) |
| Image density | Bell accent layer |
| Button density | Percussion groove (per-site Euclidean signature) |
| header / sections / footer | Song form: Intro – A – B – A′ – Outro |
| Text length | Phrase length |
| Element x-positions | Stereo panning |
| Page height | Piece length (30–90 s) |

### Three modes

- **Hybrid** (default) — website identity + musical constraints
- **Musical** — maximal listenability (tighter quantization and density)
- **Analytical** — maximal structural fidelity (chromatic melody straight from structure; may not be pretty — that's the point)

### Five instrument profiles

Ambient · Piano · Electronic · Orchestral · **Eastern 東方** — each changes articulation, register, rhythm role and density, not just timbre. A style is a *palette*: the page's structural character picks the actual voices inside it, so a text-heavy blog and a button-farm dashboard sound different even in the same style.

All sounds are synthesized (oscillators + filters + envelopes + procedural reverb); there are no sample libraries. The v0.2 instrument set includes breath-modeled **蕭 (xiao)** and **笛 (flute)**, a Karplus-Strong **guitar**, and **太鼓 (taiko)** drums alongside pads, strings, pianos, bells, plucks and the electronic kit.

### Customize sliders

The popup exposes four deterministic tuning sliders — **Tempo** (±30 BPM), **Density** (50–150 %), **Brightness**, **Reverb**. They are part of the mapping profile Θ, persisted across sessions, and never break reproducibility: same page + same sliders → same music.

### Music grammar guardrails

Raw data mapping ≠ good music, so every score passes through: scale quantization, a 1/16-note rhythm grid, chord progressions, and hard density limits (≤ 12 simultaneous voices, ≤ 20 note events/second). A 500,000-node page cannot explode into noise — outliers are log-scaled and clamped.

### Deterministic identity

```
Seed = Hash(CanonicalURL, StructuralFingerprint)
```

Never the URL alone — if a site's structure changes, its music changes too. **Regenerate** mixes a variation index into the seed: a new piece that keeps the site's key and tempo identity.

---

## Install (developer mode)

1. `npm install && npm run build`
2. Open `chrome://extensions`, enable **Developer mode**
3. **Load unpacked** → select the `dist/` folder
4. Open any normal webpage, click the WSE icon → **Analyze & Play**

Permissions: `activeTab`, `scripting`, `storage`, `offscreen` — analysis runs only when you click, only on the active tab. There is no host permission and no background reading of your browsing.

### Try it without installing

```
node scripts/serve.mjs
# → http://localhost:8735/  (demo page running the exact same pipeline in-page)
```

## Privacy by default

- All processing is local. No server, no telemetry, no uploads.
- The canonical URL is `origin + pathname` only — query strings and fragments are never read into the pipeline.
- Form values are never read: `input`, `textarea`, `select`, `[contenteditable]` contents are excluded from traversal and text statistics (including nested elements inside editable regions).
- Only aggregate text statistics (length, word count) are used — never the text itself.
- No remote code, no page-script execution.

## Visualizer — watch the code become music

**Analyze & Visualize** (v0.3) opens a full-tab visualizer that shows the sonification *as it happens*:

- the page's element tokens (`<div>` `<a>` `<img>` …, tag + depth only) stream by like subtitles, and the token that structurally drove each note **lights up the instant it sounds** — links flash when the arpeggio plucks, images flash on bells, buttons flash on percussion;
- below, a **piano-roll score scrolls under a fixed playhead**, colored by mapping layer, with onset flashes on every note.

This is honest provenance, not decoration: every `NoteEvent` carries the mapping layer that generated it, and each layer highlights exactly the tag family that feeds it (Rules 3–5). The same visualizer runs in the live demo on the website.

## Explain Mode

The popup answers *“Why does this page sound like this?”* — e.g. *“high link density → busy arpeggios”, “dark palette → minor scale”*. Structure in, explanation out.

## Development

```
npm test          # 28 tests: determinism, scale guardrail, density caps, privacy, 4-fixture identity
npm run typecheck
npm run build     # → dist/ (extension) + demo/demo.js
```

Integration fixtures (`tests/fixtures/`): a blog, a dashboard, an e-commerce grid and a docs site — the suite asserts **M₁ ≠ M₂ ≠ M₃ ≠ M₄** and that the same fixture always renders the identical score.

### Architecture

```
src/
  content/     extractor (DOM / style / geometry / script features)
  mapping/     fingerprint · normalizer · music profile · score generator · quantizer · limits
  audio/       synth instruments · lookahead scheduler · engine (offscreen Web Audio)
  background/  MV3 service worker (offscreen lifecycle + message routing)
  ui/          popup
  shared/      types · messages
```

Audio plays in an **offscreen document** (MV3 service workers have no DOM), created on demand with the `AUDIO_PLAYBACK` reason and torn down on stop.

## Prior art & acknowledgments

HTML → music is not a new proposition. The **Synesthesia Add-on: a Tool for HTML Sonification** (Brazilian Symposium on Computer Music, 2017) already treated HTML pages as musical scores in a browser add-on: [github.com/rppbodo/synesthesia-addon](https://github.com/rppbodo/synesthesia-addon).

**Special thanks to its author.** WSE was designed independently and is not an equivalent system — but creating anything is easier when a pioneer has already shown the direction is possible. Knowing that HTML sonification had been built and published told us this was feasible before we wrote a line of code. Prior art matters; thank you. 🙏

特別感謝 Synesthesia Add-on 的作者。WSE 是獨立設計、也不完全等同的系統，但正因為有先行者證明過「HTML 頁面可以作為樂譜」，我們在創作時得以相對確信這個方向可行。

WSE deliberately claims a narrower, different thing:

> A webpage's accessible computational structure may define a **reproducible generative musical identity**.

## Research questions (v0.1+)

- RQ1 — Do different websites form recognizable sound signatures?
- RQ2 — Can users identify website *types* from music alone?
- RQ3 — How much structural fidelity does musicalization cost?
- RQ4 — Which page features drive perceived musical quality?
- RQ5 — Are site redesigns audible?

## Changelog

- **v0.3.0** — Visualizer: full-tab "watch the code become music" view (token stream + karaoke-style highlights + scrolling piano roll), note provenance layers, `data-wse-ignore` extraction opt-out, 41 tests
- **v0.2.0** — cross-site differentiation overhaul: structure-driven orchestration (§17 "Orchestra by Web Architecture"), 7 scales, tag-entropy tempo spread, Euclidean rhythm signatures; new instruments 蕭/笛/guitar/太鼓; Eastern style; customize sliders (tempo/density/brightness/reverb); product site at wse.evemisstechnology.com
- **v0.1.0** — MVP per the technical whitepaper: MV3 extension, deterministic pipeline, 4 styles, offscreen Web Audio, 28 tests

## Roadmap

- **v0.4** — Scroll Mode (viewport as playhead), Mutation Mode (live DOM performance), WAV export
- **v0.5** — custom mapping profiles, MIDI export, advanced instruments
- **v1.0** — Firefox, public mapping SDK, research dataset

## Authorship

**Concept and project direction: Neo.K** (EveMissLab).
See `AUTHORS`, `NOTICE` and `CITATION.cff`. If this work is useful in research, please cite it rather than only starring it.

## License

Apache-2.0 — see `LICENSE`.

---

### 中文摘要

WSE 是一個開源實驗性 Chrome 擴充功能：點擊「Analyze & Play」後，它讀取目前分頁的 DOM 結構、抽樣 computed style 與版面幾何，經過確定性種子（Hash(CanonicalURL, StructuralFingerprint)）生成 30–90 秒的生成式音樂，全部在本機以 Web Audio 合成播放。同一網頁結構永遠生成同一首曲子——每個網站都有自己的「聲音指紋」。網站不是播背景音樂，而是**網站自己的結構決定它成為什麼音樂**。所有分析僅在本機執行，絕不上傳頁面內容，絕不讀取表單值。

> **每一個網頁本來就有結構。我們只是讓你聽見它。**
> **網路從來不是無聲的。**
