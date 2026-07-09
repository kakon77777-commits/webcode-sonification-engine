import type { DomFeatures } from "../shared/types.js";

/**
 * DOM traversal + structural statistics (§12–15, §75–76).
 *
 * Privacy rules (§26, §80): we never read element.value, we never descend into
 * [contenteditable] subtrees, and text statistics skip form controls entirely.
 */

export const MAX_DOM_NODES = 5000;
export const MAX_TEXT_CHARS = 200_000;
const MAX_HISTOGRAM_KEYS = 64;

export interface TraversedElement {
  el: Element;
  depth: number;
}

export interface Traversal {
  elements: TraversedElement[];
  truncated: boolean;
}

function isEditable(el: Element): boolean {
  const attr = el.getAttribute("contenteditable");
  return attr !== null && attr.toLowerCase() !== "false";
}

/**
 * Subtrees marked data-wse-ignore are invisible to extraction — used by WSE's
 * own injected UI (e.g. the demo's visualizer panel) so the tool never
 * sonifies itself, and available to site authors as an opt-out.
 */
export const IGNORE_ATTR = "data-wse-ignore";

/** Single capped depth-first walk shared by all extractors. */
export function traverseDom(doc: Document): Traversal {
  const root = doc.documentElement;
  const elements: TraversedElement[] = [];
  let truncated = false;
  if (!root) return { elements, truncated };

  const stack: TraversedElement[] = [{ el: root, depth: 0 }];
  while (stack.length > 0) {
    const item = stack.pop()!;
    if (item.el.hasAttribute(IGNORE_ATTR)) continue;
    elements.push(item);
    if (elements.length >= MAX_DOM_NODES) {
      truncated = stack.length > 0;
      break;
    }
    // Do not walk into user-editable regions — their contents are user data.
    if (isEditable(item.el)) continue;
    const children = item.el.children;
    for (let i = children.length - 1; i >= 0; i--) {
      stack.push({ el: children[i], depth: item.depth + 1 });
    }
  }
  return { elements, truncated };
}

const TEXT_SKIP_PARENTS = new Set(["script", "style", "noscript", "template", "textarea", "select", "option"]);
const BUTTONISH_INPUT_TYPES = new Set(["button", "submit", "reset"]);
const SECTION_TAGS = new Set(["section", "article", "main", "aside", "nav", "header", "footer"]);
const HEADING_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);

export function computeDomFeatures(doc: Document, traversal: Traversal): DomFeatures {
  const histogram: Record<string, number> = {};
  let depthSum = 0;
  let maxDepth = 0;
  let linkCount = 0;
  let imageCount = 0;
  let buttonCount = 0;
  let formCount = 0;
  let sectionCount = 0;
  let headingCount = 0;

  for (const { el, depth } of traversal.elements) {
    const tag = el.tagName.toLowerCase();
    depthSum += depth;
    if (depth > maxDepth) maxDepth = depth;

    if (histogram[tag] !== undefined) {
      histogram[tag]++;
    } else if (Object.keys(histogram).length < MAX_HISTOGRAM_KEYS) {
      histogram[tag] = 1;
    } else {
      histogram["other"] = (histogram["other"] ?? 0) + 1;
    }

    if (tag === "a") linkCount++;
    else if (tag === "img") imageCount++;
    else if (tag === "button") buttonCount++;
    else if (tag === "form") formCount++;
    else if (tag === "input") {
      // Reading the type attribute only — never the value (§26).
      const type = (el.getAttribute("type") ?? "").toLowerCase();
      if (BUTTONISH_INPUT_TYPES.has(type)) buttonCount++;
    }
    if (SECTION_TAGS.has(tag)) sectionCount++;
    if (HEADING_TAGS.has(tag)) headingCount++;
  }

  // Text statistics: visible text nodes only (§24). Never form values.
  let textLength = 0;
  let wordCount = 0;
  const body = doc.body;
  if (body) {
    const walker = doc.createTreeWalker(body, 0x4 /* NodeFilter.SHOW_TEXT */);
    let visited = 0;
    while (textLength < MAX_TEXT_CHARS && visited < MAX_DOM_NODES) {
      const node = walker.nextNode();
      if (!node) break;
      visited++;
      const parent = node.parentElement;
      if (!parent) continue;
      if (TEXT_SKIP_PARENTS.has(parent.tagName.toLowerCase())) continue;
      // Check the ancestor chain, not just the direct parent — text inside
      // <div contenteditable><p>…</p></div> is user data too (§26).
      const editableHost = parent.closest("[contenteditable]");
      if (editableHost && isEditable(editableHost)) continue;
      if (parent.closest(`[${IGNORE_ATTR}]`)) continue;
      const text = node.nodeValue ?? "";
      const trimmed = text.trim();
      if (trimmed.length === 0) continue;
      textLength += trimmed.length;
      wordCount += trimmed.split(/\s+/).length;
    }
  }

  const total = traversal.elements.length;
  return {
    totalNodes: total,
    maxDepth,
    avgDepth: total > 0 ? depthSum / total : 0,
    tagHistogram: histogram,
    linkCount,
    imageCount,
    buttonCount,
    formCount,
    sectionCount,
    headingCount,
    textLength,
    wordCount,
    truncated: traversal.truncated,
  };
}
