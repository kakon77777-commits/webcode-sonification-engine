import type { NoteLayer } from "../shared/types.js";

/**
 * Which tag families feed which mapping layer (mirrors Rules 3–5, §16).
 * Single source of truth shared by the visualizer (token-highlight
 * provenance) and Mutation Mode (live note generation) — both must agree on
 * "what triggers what".
 */
export const LAYER_TAGS: Record<NoteLayer, string[]> = {
  arp: ["a"],
  bell: ["img", "picture", "source", "svg", "figure", "video"],
  perc: ["button", "input", "select", "form", "label", "textarea"],
  melody: [
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "p",
    "li",
    "span",
    "strong",
    "em",
    "blockquote",
    "pre",
    "code",
    "td",
    "th",
  ],
  pad: ["div", "section", "article", "header", "nav", "aside", "figure"],
  bass: ["html", "body", "main", "footer", "table", "ul", "ol"],
};

const TAG_TO_LAYER = new Map<string, NoteLayer>();
for (const [layer, tags] of Object.entries(LAYER_TAGS) as [NoteLayer, string[]][]) {
  for (const tag of tags) TAG_TO_LAYER.set(tag, layer);
}

/** Which layer a lowercased tag name feeds, or null outside the known families. */
export function layerForTag(tag: string): NoteLayer | null {
  return TAG_TO_LAYER.get(tag) ?? null;
}
