import { afterEach, describe, expect, it, vi } from "vitest";
import type { Score, EncodedExport } from "../src/audio/export-types.js";
import { exportFilename } from "../src/audio/export-types.js";
import { downloadEncodedExport } from "../src/audio/export-download.js";

const originalBlob = globalThis.Blob;
const originalURL = globalThis.URL;

const score: Score = {
  version: 1,
  fingerprint: {
    version: 1,
    hash: "deadbeefcafe1234",
    seed: 1234567890,
  },
  variation: 0,
  profile: {
    key: 0,
    keyName: "C",
    scale: "major",
    bpm: 120,
    style: "ambient",
    mode: "musical",
    lengthSec: 30,
    barCount: 8,
    sections: [],
    character: "content",
    explain: [],
  },
  events: [],
};

describe("exportFilename", () => {
  it("is deterministic for wav exports", () => {
    expect(exportFilename(score, "wav")).toBe("wse-deadbeefcafe1234-ambient.wav");
  });

  it("is deterministic for midi exports", () => {
    expect(exportFilename(score, "midi")).toBe("wse-deadbeefcafe1234-ambient.mid");
  });

  it("includes the variation suffix when the score varies", () => {
    expect(exportFilename({ ...score, variation: 2 }, "midi")).toContain("-v2.mid");
  });
});

describe("downloadEncodedExport", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("creates a blob download with the declared MIME type and cleans up the URL", () => {
    vi.useFakeTimers();
    const blobCalls: Array<{ parts: BlobPart[]; options?: BlobPropertyBag }> = [];
    class FakeBlob {
      parts: BlobPart[];
      options?: BlobPropertyBag;

      constructor(parts: BlobPart[], options?: BlobPropertyBag) {
        this.parts = parts;
        this.options = options;
        blobCalls.push({ parts, options });
      }
    }
    const anchor = {
      href: "",
      download: "",
      click: vi.fn(),
      remove: vi.fn(),
    } as unknown as HTMLAnchorElement;
    const createElement = vi.fn(() => anchor);
    const appendChild = vi.fn();
    const revokeObjectURL = vi.fn();
    const createObjectURL = vi.fn(() => "blob:encoded-export");
    const documentRef = {
      createElement,
      body: {
        appendChild,
      },
    } as unknown as Document;

    vi.stubGlobal("Blob", FakeBlob);
    vi.stubGlobal("URL", {
      createObjectURL,
      revokeObjectURL,
    });

    const artifact: EncodedExport = {
      format: "midi",
      extension: "mid",
      mimeType: "audio/midi",
      filename: "wse-deadbeefcafe1234-ambient.mid",
      bytes: new ArrayBuffer(4),
    };

    downloadEncodedExport(artifact, documentRef);

    expect(blobCalls).toHaveLength(1);
    expect(blobCalls[0]).toEqual({ parts: [artifact.bytes], options: { type: "audio/midi" } });
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(createElement).toHaveBeenCalledWith("a");
    expect(anchor.href).toBe("blob:encoded-export");
    expect(anchor.download).toBe(artifact.filename);
    expect(appendChild).toHaveBeenCalledWith(anchor);
    expect(anchor.click).toHaveBeenCalledTimes(1);
    expect(anchor.remove).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).not.toHaveBeenCalled();

    vi.advanceTimersByTime(10_000);
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it("restores globals after the download test", () => {
    expect(globalThis.Blob).toBe(originalBlob);
    expect(globalThis.URL).toBe(originalURL);
  });

  it("removes the temporary anchor when click throws", () => {
    vi.useFakeTimers();
    class FakeBlob {
      constructor(_parts: BlobPart[], _options?: BlobPropertyBag) {}
    }
    const anchor = {
      href: "",
      download: "",
      click: vi.fn(() => {
        throw new Error("click blocked");
      }),
      remove: vi.fn(),
    } as unknown as HTMLAnchorElement;
    const documentRef = {
      createElement: vi.fn(() => anchor),
      body: { appendChild: vi.fn() },
    } as unknown as Document;
    vi.stubGlobal("Blob", FakeBlob);
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:throwing-export"),
      revokeObjectURL: vi.fn(),
    });

    expect(() => downloadEncodedExport({
      format: "wav",
      extension: "wav",
      mimeType: "audio/wav",
      filename: "throw.wav",
      bytes: new ArrayBuffer(1),
    }, documentRef)).toThrow("click blocked");
    expect(anchor.remove).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(10_000);
  });
});
