import { describe, expect, it, vi } from "vitest";
import {
  presetIdFromLabel,
  readStorageOr,
  readStorageOrAsync,
  tryStorageWrite,
  tryStorageWriteAsync,
} from "../src/ui/profile-controls.js";

describe("profile control persistence boundaries", () => {
  it("creates deterministic distinct valid IDs for non-Latin-only preset labels", () => {
    const first = presetIdFromLabel("夜の航路");
    const second = presetIdFromLabel("星の航路");

    expect(first).toMatch(/^[a-z0-9][a-z0-9_-]{0,31}$/);
    expect(second).toMatch(/^[a-z0-9][a-z0-9_-]{0,31}$/);
    expect(first).not.toBe(second);
    expect(presetIdFromLabel("夜の航路")).toBe(first);
  });

  it("falls back on throwing reads and reports synchronous write failures", () => {
    const failure = new Error("storage unavailable");
    expect(readStorageOr(() => { throw failure; }, "fallback")).toBe("fallback");
    expect(tryStorageWrite(() => { throw failure; })).toBe(false);

    const write = vi.fn();
    expect(tryStorageWrite(write)).toBe(true);
    expect(write).toHaveBeenCalledOnce();
  });

  it("falls back on rejected reads and reports asynchronous write failures", async () => {
    const failure = new Error("storage unavailable");
    await expect(readStorageOrAsync(() => Promise.reject(failure), { defaults: true }))
      .resolves.toEqual({ defaults: true });
    await expect(tryStorageWriteAsync(() => Promise.reject(failure))).resolves.toBe(false);

    const write = vi.fn().mockResolvedValue(undefined);
    await expect(tryStorageWriteAsync(write)).resolves.toBe(true);
    expect(write).toHaveBeenCalledOnce();
  });
});
