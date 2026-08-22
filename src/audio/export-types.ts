import type { Score } from "../shared/types.js";

export type { Score } from "../shared/types.js";

export type ExportFormat = "wav" | "midi";

export interface ExportOptions {
  brightness?: number;
  reverb?: number;
  sampleRate?: number;
}

export interface EncodedExport {
  format: ExportFormat;
  extension: "wav" | "mid";
  mimeType: "audio/wav" | "audio/midi";
  filename: string;
  bytes: ArrayBuffer;
}

export function exportFilename(score: Score, format: ExportFormat): string {
  const variant = score.variation > 0 ? `-v${score.variation}` : "";
  const extension = format === "wav" ? "wav" : "mid";
  return `wse-${score.fingerprint.hash}-${score.profile.style}${variant}.${extension}`;
}
