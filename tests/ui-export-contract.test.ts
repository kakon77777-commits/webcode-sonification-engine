import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";

const surfaces = [
  ["popup", "src/ui/popup.html"],
  ["visualizer", "src/viz/visualizer.html"],
  ["demo", "demo/demo.html"],
] as const;

describe("export UI contract", () => {
  it.each(surfaces)("%s exposes format selection, export button, and live status", (_name, path) => {
    const html = readFileSync(join(process.cwd(), path), "utf8");
    const document = new JSDOM(html).window.document;

    const format = document.querySelector<HTMLSelectElement>("label.export-format > select#export-format");
    expect(format).not.toBeNull();
    expect(format?.value).toBe("wav");
    expect([...format!.options].map((option) => option.value)).toEqual(["wav", "midi"]);

    const button = document.querySelector<HTMLButtonElement>("button#export");
    expect(button).not.toBeNull();
    expect(button?.disabled).toBe(true);

    const status = document.querySelector<HTMLParagraphElement>("p#export-status");
    expect(status).not.toBeNull();
    expect(status?.getAttribute("role")).toBe("status");
    expect(status?.getAttribute("aria-live")).toBe("polite");
  });
});
