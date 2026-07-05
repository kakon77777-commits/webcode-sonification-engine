import type { GeometryFeatures } from "../shared/types.js";
import type { TraversedElement } from "./dom-features.js";

/**
 * Visual geometry (§21–23): bounding boxes of a bounded element sample.
 * x → pan, y → time, area → prominence (mapped later in the music layer).
 */

export const MAX_GEOMETRY_SAMPLES = 500;
const BUCKETS = 8;

export function extractGeometryFeatures(
  elements: TraversedElement[],
  win: Window & typeof globalThis
): GeometryFeatures {
  const doc = win.document;
  const viewportWidth = win.innerWidth || doc.documentElement?.clientWidth || 0;
  const viewportHeight = win.innerHeight || doc.documentElement?.clientHeight || 0;
  const pageHeight = Math.max(
    doc.documentElement?.scrollHeight ?? 0,
    doc.body?.scrollHeight ?? 0,
    viewportHeight
  );

  const stride = Math.max(1, Math.ceil(elements.length / MAX_GEOMETRY_SAMPLES));
  const buckets = new Array<number>(BUCKETS).fill(0);
  let areaSum = 0;
  let visible = 0;

  for (let i = 0; i < elements.length; i += stride) {
    const el = elements[i].el;
    let rect: DOMRect;
    try {
      rect = el.getBoundingClientRect();
    } catch {
      continue;
    }
    if (rect.width <= 0 || rect.height <= 0) continue;
    visible++;
    areaSum += rect.width * rect.height;
    if (viewportWidth > 0) {
      const center = rect.left + rect.width / 2;
      const idx = Math.min(BUCKETS - 1, Math.max(0, Math.floor((center / viewportWidth) * BUCKETS)));
      buckets[idx]++;
    }
  }

  const total = buckets.reduce((a, b) => a + b, 0);
  const horizontalDistribution =
    total > 0 ? buckets.map((b) => Math.round((b / total) * 1000) / 1000) : buckets;

  return {
    viewportWidth,
    viewportHeight,
    pageHeight,
    avgElementArea: visible > 0 ? Math.round(areaSum / visible) : 0,
    horizontalDistribution,
  };
}
