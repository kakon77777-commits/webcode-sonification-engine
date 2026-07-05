import { describe, expect, it } from "vitest";
import { computeFingerprint } from "../src/mapping/fingerprint.js";
import { syntheticFeatures } from "./helpers.js";

describe("structural fingerprint (§41–42, §81)", () => {
  it("same input → same hash and seed", () => {
    const a = computeFingerprint(syntheticFeatures());
    const b = computeFingerprint(syntheticFeatures());
    expect(a.hash).toBe(b.hash);
    expect(a.seed).toBe(b.seed);
    expect(a.hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it("structural change → different hash (URL alone is not the seed)", () => {
    const base = computeFingerprint(syntheticFeatures());
    const moreNodes = computeFingerprint(syntheticFeatures({ nodes: 801 }));
    expect(moreNodes.hash).not.toBe(base.hash);
  });

  it("different URL, same structure → different hash", () => {
    const a = computeFingerprint(syntheticFeatures({ url: "https://a.example/" }));
    const b = computeFingerprint(syntheticFeatures({ url: "https://b.example/" }));
    expect(a.hash).not.toBe(b.hash);
  });

  it("tag histogram key order does not affect the hash", () => {
    const f1 = syntheticFeatures();
    const f2 = syntheticFeatures();
    // Rebuild histogram in reversed insertion order.
    f2.dom.tagHistogram = Object.fromEntries(Object.entries(f2.dom.tagHistogram).reverse());
    expect(computeFingerprint(f1).hash).toBe(computeFingerprint(f2).hash);
  });
});
