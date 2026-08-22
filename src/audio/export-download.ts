import type { EncodedExport } from "./export-types.js";

export function downloadEncodedExport(artifact: EncodedExport, documentRef?: Document): void {
  const doc = documentRef ?? globalThis.document;
  if (!doc) {
    throw new Error("downloadEncodedExport requires a document");
  }

  const blob = new Blob([artifact.bytes], { type: artifact.mimeType });
  const url = URL.createObjectURL(blob);
  try {
    const anchor = doc.createElement("a");
    anchor.href = url;
    anchor.download = artifact.filename;
    doc.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}
