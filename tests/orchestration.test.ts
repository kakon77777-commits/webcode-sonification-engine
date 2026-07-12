import { describe, expect, it } from "vitest";
import { computeFingerprint } from "../src/mapping/fingerprint.js";
import { generateScore } from "../src/mapping/default-map.js";
import { normalizeFeatures, type NormalizedFeatures } from "../src/mapping/normalize.js";
import { chooseOrchestration, detectCharacter, euclid } from "../src/mapping/orchestration.js";
import { scalePitchClasses } from "../src/mapping/quantize.js";
import { loadFixture, syntheticFeatures } from "./helpers.js";

/** Minimal stub for testing chooseOrchestration in isolation — only the *Lean fields matter. */
function normWithCharacter(dominant: "contentLean" | "navLean" | "mediaLean" | "formLean"): NormalizedFeatures {
  const base: NormalizedFeatures = {
    nodes: 0.5, depth: 0.5, linkDensity: 0.1, imageDensity: 0.1, buttonDensity: 0.1,
    scriptDensity: 0.1, text: 0.5, hue: 0.5, saturation: 0.5, lightness: 0.5,
    fontSize: 0.5, pageLength: 0.5, sectionCount: 0.5, horizontalLean: 0,
    entropy: 0.5, contentLean: 0.05, navLean: 0.05, mediaLean: 0.05, formLean: 0.05,
    complexity: 0.5,
  };
  return { ...base, [dominant]: 0.9 };
}

describe("Orchestra by Web Architecture (§17): structure picks the voices", () => {
  it("detects the dominant structural family", () => {
    const blog = normalizeFeatures(loadFixture("simple-blog.html", "https://blog.example/post").features);
    const dash = normalizeFeatures(loadFixture("dashboard.html", "https://dash.example/app").features);
    const shop = normalizeFeatures(loadFixture("ecommerce.html", "https://shop.example/").features);
    expect(detectCharacter(blog)).toBe("content");
    expect(detectCharacter(dash)).toBe("navigation"); // 13 buttons in 60 nodes
    expect(["navigation", "media"]).toContain(detectCharacter(shop));
  });

  it("different page characters get different lead voices within one style", () => {
    const melodies = new Set(
      (
        [
          ["simple-blog.html", "https://blog.example/post"],
          ["dashboard.html", "https://dash.example/app"],
          ["ecommerce.html", "https://shop.example/"],
          ["docs.html", "https://docs.example/guide"],
        ] as const
      ).map(([name, url]) => {
        const norm = normalizeFeatures(loadFixture(name, url).features);
        return chooseOrchestration(norm, "ambient").melody;
      })
    );
    expect(melodies.size).toBeGreaterThanOrEqual(2);
  });

  it("orchestration choice is deterministic and reflected in the score", () => {
    const f = syntheticFeatures();
    const norm = normalizeFeatures(f);
    const orch = chooseOrchestration(norm, "ambient");
    const score = generateScore(f, computeFingerprint(f), {
      style: "ambient",
      mode: "hybrid",
      variation: 0,
    });
    expect(score.profile.character).toBe(orch.character);
    const used = new Set(score.events.map((e) => e.instrument));
    expect(used.has(orch.melody)).toBe(true);
  });

  it("new instruments (v0.4.1) are reachable through the palettes", () => {
    expect(chooseOrchestration(normWithCharacter("formLean"), "ambient").melody).toBe("choir");
    expect(chooseOrchestration(normWithCharacter("mediaLean"), "piano").melody).toBe("clarinet");
    expect(chooseOrchestration(normWithCharacter("mediaLean"), "orchestral").arp).toBe("marimba");
    expect(chooseOrchestration(normWithCharacter("contentLean"), "orchestral").bell).toBe("marimba");
    expect(chooseOrchestration(normWithCharacter("navLean"), "eastern").arp).toBe("koto");
    expect(chooseOrchestration(normWithCharacter("formLean"), "eastern").melody).toBe("koto");
  });

  it("real fixture pages across all 5 styles keep every pitched note in Scale(K), including any new instrument reached", () => {
    const unpitched = new Set(["kick", "hihat", "perc", "taiko"]);
    const instrumentsSeen = new Set<string>();
    for (const [name, url] of [
      ["simple-blog.html", "https://blog.example/post"],
      ["dashboard.html", "https://dash.example/app"],
      ["ecommerce.html", "https://shop.example/"],
      ["docs.html", "https://docs.example/guide"],
    ] as const) {
      const { features } = loadFixture(name, url);
      const fp = computeFingerprint(features);
      for (const style of ["ambient", "piano", "electronic", "orchestral", "eastern"] as const) {
        const score = generateScore(features, fp, { style, mode: "hybrid", variation: 0 });
        const classes = scalePitchClasses(score.profile.key, score.profile.scale);
        for (const ev of score.events) {
          instrumentsSeen.add(ev.instrument);
          if (unpitched.has(ev.instrument)) continue;
          expect(classes.has(((ev.pitch % 12) + 12) % 12), `${name}/${style}: ${ev.instrument}`).toBe(true);
        }
      }
    }
    // Sanity: this sweep should have exercised at least one of the new v0.4.1 instruments.
    const newOnes = ["clarinet", "marimba", "koto", "subbass", "choir"];
    expect(newOnes.some((i) => instrumentsSeen.has(i))).toBe(true);
  });

  it("euclid distributes k hits over n slots", () => {
    for (const [k, n] of [
      [3, 8],
      [5, 8],
      [7, 16],
      [0, 8],
      [8, 8],
    ] as const) {
      const p = euclid(k, n);
      expect(p.filter(Boolean).length).toBe(k);
      expect(p.length).toBe(n);
    }
    // Rotation preserves the hit count and shifts the pattern.
    const a = euclid(3, 8, 0);
    const b = euclid(3, 8, 2);
    expect(b.filter(Boolean).length).toBe(3);
    expect(a).not.toEqual(b);
  });
});
