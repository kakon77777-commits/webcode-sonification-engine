import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { computeFingerprint } from "../src/mapping/fingerprint.js";
import { generateScore } from "../src/mapping/default-map.js";
import { extractPageFeatures } from "../src/content/extract.js";
import { assignTokens } from "../src/viz/viz-core.js";
import type { NoteLayer } from "../src/shared/types.js";
import { loadFixture, syntheticFeatures } from "./helpers.js";

const LAYERS: NoteLayer[] = ["pad", "bass", "melody", "arp", "bell", "perc"];
const VISUALIZER_SOURCE = readFileSync(join(process.cwd(), "src", "viz", "visualizer.ts"), "utf8");

describe("visualizer provenance (v0.3)", () => {
  it("extractor emits document-order tokens with tag + depth only", () => {
    const { features } = loadFixture("simple-blog.html", "https://blog.example/post");
    expect(features.tokens.length).toBeGreaterThan(10);
    expect(features.tokens.length).toBeLessThanOrEqual(360);
    expect(features.tokens[0]).toEqual({ tag: "html", depth: 0 });
    for (const tok of features.tokens) {
      expect(Object.keys(tok).sort()).toEqual(["depth", "tag"]);
      expect(tok.tag).toMatch(/^[a-z0-9-]+$/);
      expect(tok.depth).toBeGreaterThanOrEqual(0);
    }
    expect(features.tokens.some((t) => t.tag === "article")).toBe(true);
  });

  it("tokens are NOT part of the fingerprint — v0.2 hashes are stable", () => {
    const a = syntheticFeatures();
    const b = syntheticFeatures();
    b.tokens = [{ tag: "div", depth: 1 }]; // radically different token sample
    expect(computeFingerprint(a).hash).toBe(computeFingerprint(b).hash);
  });

  it("every note event carries a mapping layer", () => {
    for (const style of ["ambient", "piano", "electronic", "orchestral", "eastern"] as const) {
      const f = syntheticFeatures();
      const score = generateScore(f, computeFingerprint(f), {
        style,
        mode: "hybrid",
        variation: 0,
      });
      for (const ev of score.events) {
        expect(LAYERS).toContain(ev.layer);
      }
      // The synthetic page has links, images and buttons — those layers must exist.
      const present = new Set(score.events.map((e) => e.layer));
      expect(present.has("pad")).toBe(true);
      expect(present.has("bass")).toBe(true);
    }
  });

  it("assignTokens is deterministic and honors tag families", () => {
    const f = syntheticFeatures();
    const score = generateScore(f, computeFingerprint(f), {
      style: "electronic",
      mode: "hybrid",
      variation: 0,
    });
    const a1 = assignTokens(score.events, f.tokens);
    const a2 = assignTokens(score.events, f.tokens);
    expect(a1).toEqual(a2);
    expect(a1.length).toBe(score.events.length);
    // Arp notes must point at <a> tokens (indices 4 and 5 in the synthetic set).
    score.events.forEach((ev, i) => {
      if (ev.layer === "arp") expect([4, 5]).toContain(a1[i]);
      if (ev.layer === "bell") expect(f.tokens[a1[i]].tag).toBe("img");
    });
  });

  it("assignTokens falls back gracefully when no family tokens exist", () => {
    const f = syntheticFeatures();
    const score = generateScore(f, computeFingerprint(f), {
      style: "ambient",
      mode: "hybrid",
      variation: 0,
    });
    const onlyDivs = [{ tag: "custom-el", depth: 1 }, { tag: "custom-el", depth: 2 }];
    const assigned = assignTokens(score.events, onlyDivs);
    for (const idx of assigned) expect([0, 1]).toContain(idx);
    expect(assignTokens(score.events, []).every((i) => i === -1)).toBe(true);
  });

  it("data-wse-ignore subtrees are invisible to extraction", () => {
    const base = loadFixture("simple-blog.html", "https://blog.example/post").features;
    const here = dirname(fileURLToPath(import.meta.url));
    const html = readFileSync(join(here, "fixtures", "simple-blog.html"), "utf8").replace(
      "</body>",
      `<div data-wse-ignore><span>viz</span><span>panel</span><p>ignored words here</p></div></body>`
    );
    const dom = new JSDOM(html, { url: "https://blog.example/post" });
    const win = dom.window as unknown as Window & typeof globalThis;
    const withPanel = extractPageFeatures(win.document, win);
    expect(withPanel.dom.totalNodes).toBe(base.dom.totalNodes);
    expect(computeFingerprint(withPanel).hash).toBe(computeFingerprint(base).hash);
  });

  it("visualizer reads compact mapping profile identity from score metadata only", () => {
    expect(VISUALIZER_SOURCE).toContain("const profileId = pr.mappingProfileId?.trim();");
    expect(VISUALIZER_SOURCE).toContain("mappingProfileLabel");
    expect(VISUALIZER_SOURCE).toContain("mappingProfileHash");
    expect(VISUALIZER_SOURCE).not.toContain("mapping-profile.ts");
    expect(VISUALIZER_SOURCE).not.toContain("BUILTIN_MAPPING_PROFILES");
    expect(VISUALIZER_SOURCE).not.toContain("resolveMappingProfile(");
  });
});
