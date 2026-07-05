import { describe, expect, it } from "vitest";
import { computeFingerprint } from "../src/mapping/fingerprint.js";
import { generateScore } from "../src/mapping/default-map.js";
import type { Score } from "../src/shared/types.js";
import { loadFixture } from "./helpers.js";

/**
 * Integration test (§84): four different kinds of website must produce four
 * different pieces of music — M1 ≠ M2 ≠ M3 ≠ M4.
 */

const FIXTURES = [
  ["simple-blog.html", "https://blog.example/post"],
  ["dashboard.html", "https://dash.example/app"],
  ["ecommerce.html", "https://shop.example/"],
  ["docs.html", "https://docs.example/guide"],
] as const;

function scoreOf(name: string, url: string): Score {
  const { features } = loadFixture(name, url);
  return generateScore(features, computeFingerprint(features), {
    style: "ambient",
    mode: "hybrid",
    variation: 0,
  });
}

describe("four fixture sites → four distinct musical identities", () => {
  const scores = FIXTURES.map(([name, url]) => [name, scoreOf(name, url)] as const);

  it("all four fingerprints are distinct", () => {
    const hashes = scores.map(([, s]) => s.fingerprint.hash);
    expect(new Set(hashes).size).toBe(4);
  });

  it("all four scores are pairwise different", () => {
    for (let i = 0; i < scores.length; i++) {
      for (let j = i + 1; j < scores.length; j++) {
        const a = JSON.stringify(scores[i][1].events);
        const b = JSON.stringify(scores[j][1].events);
        expect(a, `${scores[i][0]} vs ${scores[j][0]}`).not.toBe(b);
      }
    }
  });

  it("every fixture yields a playable, non-trivial score", () => {
    for (const [name, s] of scores) {
      expect(s.events.length, name).toBeGreaterThan(30);
      expect(s.profile.lengthSec, name).toBeGreaterThanOrEqual(25);
    }
  });

  it("same fixture rendered twice → identical music (site sound signature, §4)", () => {
    const a = scoreOf("simple-blog.html", "https://blog.example/post");
    const b = scoreOf("simple-blog.html", "https://blog.example/post");
    expect(a.fingerprint.hash).toBe(b.fingerprint.hash);
    expect(a.events).toEqual(b.events);
  });
});
