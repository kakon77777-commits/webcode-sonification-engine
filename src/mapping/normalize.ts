import type { PageFeatures } from "../shared/types.js";
import { clamp } from "./deterministic-seed.js";

/**
 * Normalizer (§73–74): every raw feature is squashed into [0, 1] with log
 * scaling and hard caps so outliers (NodeCount = 500000) cannot blow up the
 * music. All downstream musical mapping reads only these values.
 */

export interface NormalizedFeatures {
  nodes: number; // log-capped at 5000 sampled nodes
  depth: number; // maxDepth capped at 32
  linkDensity: number; // links per node, capped at 0.30
  imageDensity: number; // images per node, capped at 0.08
  buttonDensity: number; // buttons per node, capped at 0.05
  scriptDensity: number; // scripts per node, capped at 0.10
  text: number; // log-capped at 100k chars
  hue: number; // avgHue / 360
  saturation: number;
  lightness: number;
  fontSize: number; // 10px..24px → 0..1
  pageLength: number; // log-capped at 30000px
  sectionCount: number; // capped at 12
  /** -1..1 lean of element mass: negative = left-heavy, positive = right-heavy. */
  horizontalLean: number;
  /** Shannon entropy of the tag histogram, normalized to [0, 1]. Diverse markup → high. */
  entropy: number;
  /** Structural family ratios in [0, 1] (capped): what kind of page is this? */
  contentLean: number;
  navLean: number;
  mediaLean: number;
  formLean: number;
  /** Complexity(W) per §36: weighted blend, in [0, 1]. */
  complexity: number;
}

const CONTENT_TAGS = new Set([
  "p", "article", "h1", "h2", "h3", "h4", "h5", "h6",
  "blockquote", "pre", "code", "li", "td", "figcaption", "em", "strong",
]);
const NAV_TAGS = new Set(["a", "nav", "button"]);
const MEDIA_TAGS = new Set(["img", "picture", "video", "audio", "svg", "canvas", "figure"]);
const FORM_TAGS = new Set(["form", "input", "select", "textarea", "label", "option"]);

function logNorm(value: number, cap: number): number {
  if (cap <= 0) return 0;
  return clamp(Math.log(1 + Math.max(0, value)) / Math.log(1 + cap), 0, 1);
}

function ratio(numer: number, denom: number, cap: number): number {
  if (denom <= 0) return 0;
  return clamp(numer / denom / cap, 0, 1);
}

export function normalizeFeatures(f: PageFeatures): NormalizedFeatures {
  const n = f.dom.totalNodes;
  const nodes = logNorm(n, 5000);
  const depth = clamp(f.dom.maxDepth / 32, 0, 1);
  const linkDensity = ratio(f.dom.linkCount, n, 0.3);
  const imageDensity = ratio(f.dom.imageCount, n, 0.08);
  const buttonDensity = ratio(f.dom.buttonCount, n, 0.05);
  const scriptDensity = ratio(f.script.scriptCount, n, 0.1);
  const text = logNorm(f.dom.textLength, 100_000);
  const hue = clamp((f.style.avgHue % 360) / 360, 0, 1);
  const saturation = clamp(f.style.avgSaturation, 0, 1);
  const lightness = clamp(f.style.avgLightness, 0, 1);
  const fontSize = clamp((f.style.avgFontSize - 10) / 14, 0, 1);
  const pageLength = logNorm(f.geometry.pageHeight, 30_000);
  const sectionCount = clamp(f.dom.sectionCount / 12, 0, 1);

  const dist = f.geometry.horizontalDistribution;
  let horizontalLean = 0;
  if (dist.length > 0) {
    const total = dist.reduce((a, b) => a + b, 0);
    if (total > 0) {
      let weighted = 0;
      for (let i = 0; i < dist.length; i++) {
        const center = (i + 0.5) / dist.length; // 0..1
        weighted += (dist[i] / total) * (center * 2 - 1);
      }
      horizontalLean = clamp(weighted, -1, 1);
    }
  }

  // Tag-histogram Shannon entropy: separates uniform div-soup from diverse,
  // semantic markup. This is one of the strongest cross-site differentiators.
  const hist = f.dom.tagHistogram;
  const tags = Object.keys(hist);
  let entropy = 0;
  if (n > 0 && tags.length > 1) {
    let h = 0;
    for (const t of tags) {
      const p = hist[t] / n;
      if (p > 0) h -= p * Math.log(p);
    }
    entropy = clamp(h / Math.log(Math.min(tags.length, 32)), 0, 1);
  }

  // Structural family ratios (§17: Orchestra by Web Architecture).
  let content = 0;
  let nav = 0;
  let media = 0;
  let form = 0;
  for (const t of tags) {
    if (CONTENT_TAGS.has(t)) content += hist[t];
    else if (NAV_TAGS.has(t)) nav += hist[t];
    else if (MEDIA_TAGS.has(t)) media += hist[t];
    else if (FORM_TAGS.has(t)) form += hist[t];
  }
  const contentLean = ratio(content, n, 0.45);
  const navLean = ratio(nav, n, 0.3);
  const mediaLean = ratio(media, n, 0.12);
  const formLean = ratio(form, n, 0.12);

  // Complexity: §36 blend, widened with entropy so real-world sites (which
  // almost all saturate the node cap) still spread across the BPM range.
  const complexity = clamp(
    0.3 * nodes + 0.2 * scriptDensity + 0.15 * linkDensity + 0.35 * entropy,
    0,
    1
  );

  return {
    nodes,
    depth,
    linkDensity,
    imageDensity,
    buttonDensity,
    scriptDensity,
    text,
    hue,
    saturation,
    lightness,
    fontSize,
    pageLength,
    sectionCount,
    horizontalLean,
    entropy,
    contentLean,
    navLean,
    mediaLean,
    formLean,
    complexity,
  };
}
