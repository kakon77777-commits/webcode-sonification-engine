import { describe, expect, it } from "vitest";
import { computeFingerprint } from "../src/mapping/fingerprint.js";
import { generateScore } from "../src/mapping/default-map.js";
import { normalizeFeatures } from "../src/mapping/normalize.js";
import { chooseOrchestration, detectCharacter, euclid } from "../src/mapping/orchestration.js";
import { loadFixture, syntheticFeatures } from "./helpers.js";

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
