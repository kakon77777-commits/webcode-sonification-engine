import type { Score } from "../shared/types.js";
import { renderScoreOffline, type RenderOptions } from "./render-offline.js";
import { encodeWav } from "./wav-encode.js";

/** Deterministic filename: identical score → identical filename. */
export function wavFilename(score: Score): string {
  const variant = score.variation > 0 ? `-v${score.variation}` : "";
  return `wse-${score.fingerprint.hash}-${score.profile.style}${variant}.wav`;
}

/**
 * Render a score offline and trigger a browser download of the resulting WAV.
 * Runs entirely client-side (Blob + <a download>) — no chrome.downloads
 * permission needed, so this works identically in the popup, the visualizer
 * tab, and the plain web demo.
 */
export async function exportScoreAsWav(score: Score, opts: RenderOptions = {}): Promise<void> {
  const buffer = await renderScoreOffline(score, opts);
  const wav = encodeWav(buffer);
  const blob = new Blob([wav], { type: "audio/wav" });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = wavFilename(score);
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}
