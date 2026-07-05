import type { PageFeatures, ScriptFeatures } from "../shared/types.js";
import { computeDomFeatures, traverseDom } from "./dom-features.js";
import { extractStyleFeatures } from "./style-features.js";
import { extractGeometryFeatures } from "./geometry-features.js";

/**
 * Full feature extraction — pure with respect to (document, window), no chrome
 * APIs, so the same code runs in the content script, the demo page and tests.
 */

const MAX_SCRIPTS = 300;

export function extractScriptFeatures(doc: Document): ScriptFeatures {
  const scripts = doc.scripts;
  const total = scripts.length;
  let inline = 0;
  let external = 0;
  let moduleCount = 0;
  const domains = new Set<string>();
  const n = Math.min(total, MAX_SCRIPTS);
  for (let i = 0; i < n; i++) {
    const s = scripts[i];
    const src = s.getAttribute("src");
    if (src) {
      external++;
      try {
        domains.add(new URL(src, doc.baseURI).hostname);
      } catch {
        // Unparseable src — ignore.
      }
    } else {
      inline++;
    }
    if ((s.getAttribute("type") ?? "").toLowerCase() === "module") moduleCount++;
  }
  return {
    scriptCount: total,
    inlineScriptCount: inline,
    externalScriptCount: external,
    moduleScriptCount: moduleCount,
    scriptSrcDomainCount: domains.size,
  };
}

/** Canonical URL: origin + pathname only — query strings and fragments never leave the page (§25). */
export function canonicalUrl(loc: Pick<Location, "origin" | "pathname">): string {
  return `${loc.origin}${loc.pathname}`;
}

export function extractPageFeatures(doc: Document, win: Window & typeof globalThis): PageFeatures {
  const traversal = traverseDom(doc);
  return {
    version: 1,
    url: canonicalUrl(win.location),
    dom: computeDomFeatures(doc, traversal),
    style: extractStyleFeatures(traversal.elements, win),
    geometry: extractGeometryFeatures(traversal.elements, win),
    script: extractScriptFeatures(doc),
  };
}
