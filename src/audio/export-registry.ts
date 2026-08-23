import { downloadEncodedExport } from "./export-download.js";
import { exportFilename, type EncodedExport, type ExportFormat, type ExportOptions, type Score } from "./export-types.js";
import { encodeScoreAsMidi } from "./midi-encode.js";
import { renderScoreOffline } from "./render-offline.js";
import { encodeWav } from "./wav-encode.js";

export async function encodeScore(
  score: Score,
  format: ExportFormat,
  options: ExportOptions = {}
): Promise<EncodedExport> {
  switch (format) {
    case "midi":
      // MIDI stays score-derived only: audio-mix tuning affects WAV rendering,
      // not note generation or MIDI bytes.
      return {
        format: "midi",
        extension: "mid",
        mimeType: "audio/midi",
        filename: exportFilename(score, "midi"),
        bytes: encodeScoreAsMidi(score),
      };
    case "wav": {
      const buffer = await renderScoreOffline(score, options);
      return {
        format: "wav",
        extension: "wav",
        mimeType: "audio/wav",
        filename: exportFilename(score, "wav"),
        bytes: encodeWav(buffer),
      };
    }
    default:
      throw new Error(`Unsupported export format: ${String(format)}`);
  }
}

export async function exportScore(
  score: Score,
  format: ExportFormat,
  options: ExportOptions = {},
  documentRef?: Document
): Promise<void> {
  downloadEncodedExport(await encodeScore(score, format, options), documentRef);
}
