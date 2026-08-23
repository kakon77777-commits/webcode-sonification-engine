import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";

const exportSurfaces = [
  ["popup", "src/ui/popup.html"],
  ["visualizer", "src/viz/visualizer.html"],
  ["demo", "demo/demo.html"],
] as const;

const tuningSurfaces = [
  ["popup", "src/ui/popup.html"],
  ["demo", "demo/demo.html"],
] as const;

const expectedMixControls = [
  { id: "s-low-end", label: "Low End", min: "0", max: "100", value: "72", span: "v-low-end" },
  { id: "s-pad", label: "Pads", min: "0", max: "125", value: "100", span: "v-pad" },
  { id: "s-melody", label: "Melody", min: "0", max: "125", value: "100", span: "v-melody" },
  { id: "s-rhythm", label: "Rhythm", min: "0", max: "125", value: "90", span: "v-rhythm" },
] as const;

describe("export UI contract", () => {
  it.each(exportSurfaces)("%s exposes format selection, export button, and live status", (_name, path) => {
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

  it.each(tuningSurfaces)("%s exposes the four low-end mix controls with visible value spans", (_name, path) => {
    const html = readFileSync(join(process.cwd(), path), "utf8");
    const document = new JSDOM(html).window.document;

    for (const control of expectedMixControls) {
      const label = document.querySelector<HTMLLabelElement>(`label[for="${control.id}"]`);
      expect(label).not.toBeNull();
      expect(label?.textContent?.trim()).toBe(control.label);

      const input = document.querySelector<HTMLInputElement>(`input#${control.id}`);
      expect(input).not.toBeNull();
      expect(input?.getAttribute("type")).toBe("range");
      expect(input?.getAttribute("min")).toBe(control.min);
      expect(input?.getAttribute("max")).toBe(control.max);
      expect(input?.getAttribute("value")).toBe(control.value);

      const value = document.querySelector<HTMLSpanElement>(`span#${control.span}`);
      expect(value).not.toBeNull();
    }
  });

  it("keeps visualizer export driven by payload tuning instead of duplicate slider controls", () => {
    const html = readFileSync(join(process.cwd(), "src/viz/visualizer.html"), "utf8");
    const document = new JSDOM(html).window.document;
    const visualizerSource = readFileSync(join(process.cwd(), "src/viz/visualizer.ts"), "utf8");

    expect(document.querySelector("#s-low-end")).toBeNull();
    expect(document.querySelector("#s-pad")).toBeNull();
    expect(document.querySelector("#s-melody")).toBeNull();
    expect(document.querySelector("#s-rhythm")).toBeNull();

    expect(visualizerSource).toContain("mix:");
    expect(visualizerSource).toContain("p.tuning.mix");
    expect(visualizerSource).toContain("encodeScore(payload.score, format, renderOptions(payload))");
  });
});
