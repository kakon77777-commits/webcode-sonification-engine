import type { EncodedExport } from "./export-types.js";

export function downloadEncodedExport(artifact: EncodedExport, documentRef?: Document): void {
  const doc = documentRef ?? globalThis.document;
  if (!doc) {
    throw new Error("downloadEncodedExport requires a document");
  }

  const blob = new Blob([artifact.bytes], { type: artifact.mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = doc.createElement("a");
  try {
    anchor.href = url;
    anchor.download = artifact.filename;
    doc.body.appendChild(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}
