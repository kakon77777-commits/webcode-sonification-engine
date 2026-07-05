import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import type { PageFeatures } from "../src/shared/types.js";
import { extractPageFeatures } from "../src/content/extract.js";

const here = dirname(fileURLToPath(import.meta.url));

export function loadFixture(name: string, url: string): { dom: JSDOM; features: PageFeatures } {
  const html = readFileSync(join(here, "fixtures", name), "utf8");
  const dom = new JSDOM(html, { url });
  const win = dom.window as unknown as Window & typeof globalThis;
  const features = extractPageFeatures(win.document, win);
  return { dom, features };
}

/** Synthetic features for pure mapping tests — no DOM required. */
export function syntheticFeatures(overrides: Partial<{
  nodes: number;
  depth: number;
  links: number;
  images: number;
  buttons: number;
  text: number;
  hue: number;
  lightness: number;
  saturation: number;
  pageHeight: number;
  url: string;
}> = {}): PageFeatures {
  const o = {
    nodes: 800,
    depth: 14,
    links: 60,
    images: 10,
    buttons: 8,
    text: 12_000,
    hue: 210,
    lightness: 0.3,
    saturation: 0.4,
    pageHeight: 6000,
    url: "https://example.com/",
    ...overrides,
  };
  return {
    version: 1,
    url: o.url,
    dom: {
      totalNodes: o.nodes,
      maxDepth: o.depth,
      avgDepth: o.depth * 0.55,
      tagHistogram: {
        div: Math.round(o.nodes * 0.5),
        a: o.links,
        img: o.images,
        button: o.buttons,
        p: Math.round(o.nodes * 0.1),
        section: 5,
        header: 1,
        footer: 1,
      },
      linkCount: o.links,
      imageCount: o.images,
      buttonCount: o.buttons,
      formCount: 1,
      sectionCount: 7,
      headingCount: 6,
      textLength: o.text,
      wordCount: Math.round(o.text / 6),
      truncated: false,
    },
    style: {
      sampledCount: 300,
      avgHue: o.hue,
      avgSaturation: o.saturation,
      avgLightness: o.lightness,
      avgFontSize: 15,
      fixedCount: 2,
      absoluteCount: 4,
    },
    geometry: {
      viewportWidth: 1280,
      viewportHeight: 800,
      pageHeight: o.pageHeight,
      avgElementArea: 18_000,
      horizontalDistribution: [0.1, 0.15, 0.15, 0.2, 0.15, 0.1, 0.1, 0.05],
    },
    script: {
      scriptCount: 12,
      inlineScriptCount: 4,
      externalScriptCount: 8,
      moduleScriptCount: 2,
      scriptSrcDomainCount: 3,
    },
  };
}
