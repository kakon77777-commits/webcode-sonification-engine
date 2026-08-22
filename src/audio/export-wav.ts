import type { Score } from "../shared/types.js";
import { exportFilename } from "./export-types.js";
import { type RenderOptions } from "./render-offline.js";
import { downloadEncodedExport } from "./export-download.js";
import { encodeScore } from "./export-registry.js";

/** Deterministic filename: identical score → identical filename. */
export function wavFilename(score: Score): string {
  return exportFilename(score, "wav");
}

/**
 * Render a score offline and trigger a browser download of the resulting WAV.
 * Runs entirely client-side (Blob + <a download>) — no chrome.downloads
 * permission needed, so this works identically in the popup, the visualizer
 * tab, and the plain web demo.
 */
export async function exportScoreAsWav(score: Score, opts: RenderOptions = {}): Promise<void> {
  downloadEncodedExport(await encodeScore(score, "wav", opts));
}
