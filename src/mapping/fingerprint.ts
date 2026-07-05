import type { PageFeatures, PageFingerprint } from "../shared/types.js";
import { fnv1a32, hash64hex } from "./deterministic-seed.js";

/**
 * Structural fingerprint (§41–42).
 *
 * Seeded from CanonicalURL + StructuralFingerprint — never URL alone, so a page
 * whose structure changes also changes its music. Floats are rounded before
 * hashing so tiny float jitter cannot flip the identity.
 */

function r3(x: number): number {
  return Math.round(x * 1000) / 1000;
}

/** Canonical, key-sorted, rounded serialization of the structural stats. */
export function canonicalFeatureString(f: PageFeatures): string {
  const tags = Object.keys(f.dom.tagHistogram)
    .sort()
    .map((t) => `${t}:${f.dom.tagHistogram[t]}`)
    .join(",");
  const parts = [
    `v${f.version}`,
    `url=${f.url}`,
    `nodes=${f.dom.totalNodes}`,
    `maxDepth=${f.dom.maxDepth}`,
    `avgDepth=${r3(f.dom.avgDepth)}`,
    `tags=${tags}`,
    `links=${f.dom.linkCount}`,
    `imgs=${f.dom.imageCount}`,
    `buttons=${f.dom.buttonCount}`,
    `forms=${f.dom.formCount}`,
    `sections=${f.dom.sectionCount}`,
    `headings=${f.dom.headingCount}`,
    `text=${f.dom.textLength}`,
    `words=${f.dom.wordCount}`,
    `hue=${r3(f.style.avgHue)}`,
    `sat=${r3(f.style.avgSaturation)}`,
    `light=${r3(f.style.avgLightness)}`,
    `font=${r3(f.style.avgFontSize)}`,
    `fixed=${f.style.fixedCount}`,
    `abs=${f.style.absoluteCount}`,
    `pageH=${f.geometry.pageHeight}`,
    `area=${r3(f.geometry.avgElementArea)}`,
    `hdist=${f.geometry.horizontalDistribution.map(r3).join("|")}`,
    `scripts=${f.script.scriptCount}`,
    `inline=${f.script.inlineScriptCount}`,
    `ext=${f.script.externalScriptCount}`,
    `mod=${f.script.moduleScriptCount}`,
    `dom=${f.script.scriptSrcDomainCount}`,
  ];
  return parts.join(";");
}

export function computeFingerprint(features: PageFeatures): PageFingerprint {
  const canonical = canonicalFeatureString(features);
  return {
    version: 1,
    hash: hash64hex(canonical),
    seed: fnv1a32(canonical),
  };
}
