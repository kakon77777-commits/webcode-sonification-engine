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

const uiSources = [
  ["popup", "src/ui/popup.ts"],
  ["demo", "demo/demo.ts"],
] as const;

const extractionSources = [
  "src/content/extract.ts",
  "src/content/extractor.ts",
  "src/content/dom-features.ts",
] as const;

const expectedMixControls = [
  { id: "s-low-end", label: "Low End", min: "0", max: "100", value: "72", span: "v-low-end" },
  { id: "s-pad", label: "Pads", min: "0", max: "125", value: "100", span: "v-pad" },
  { id: "s-melody", label: "Melody", min: "0", max: "125", value: "100", span: "v-melody" },
  { id: "s-rhythm", label: "Rhythm", min: "0", max: "125", value: "90", span: "v-rhythm" },
] as const;

const expectedProfileControls = [
  { id: "p-content", label: "Content", min: "75", max: "125", value: "100", span: "v-p-content" },
  { id: "p-navigation", label: "Navigation", min: "75", max: "125", value: "100", span: "v-p-navigation" },
  { id: "p-media", label: "Media", min: "75", max: "125", value: "100", span: "v-p-media" },
  { id: "p-form", label: "Form", min: "75", max: "125", value: "100", span: "v-p-form" },
] as const;

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("export UI contract", () => {
  it.each(exportSurfaces)("%s exposes format selection, export button, and live status", (_name, path) => {
    const html = read(path);
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
    const html = read(path);
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

  it.each(tuningSurfaces)("%s exposes the mapping-profile selector, four profile bias sliders, and preset actions", (_name, path) => {
    const html = read(path);
    const document = new JSDOM(html).window.document;

    const profile = document.querySelector<HTMLSelectElement>("select#mapping-profile");
    expect(profile).not.toBeNull();
    const profileLabel = document.querySelector<HTMLLabelElement>('label[for="mapping-profile"]');
    expect(profileLabel).not.toBeNull();
    expect(profileLabel?.textContent?.trim()).toBe("Profile");

    const presetName = document.querySelector<HTMLInputElement>("input#preset-name");
    expect(presetName).not.toBeNull();
    expect(presetName?.getAttribute("type")).toBe("text");
    expect(presetName?.getAttribute("maxlength")).toBe("48");
    const presetNameLabel = document.querySelector<HTMLLabelElement>('label[for="preset-name"]');
    expect(presetNameLabel).not.toBeNull();
    expect(presetNameLabel?.textContent?.trim()).toBe("Preset");

    const savePreset = document.querySelector<HTMLButtonElement>("button#save-preset");
    expect(savePreset).not.toBeNull();
    expect(savePreset?.textContent?.trim()).toBe("Save preset");

    const deletePreset = document.querySelector<HTMLButtonElement>("button#delete-preset");
    expect(deletePreset).not.toBeNull();
    expect(deletePreset?.textContent?.trim()).toBe("Delete preset");

    for (const control of expectedProfileControls) {
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

    expect(document.querySelector("#tune-reset")).not.toBeNull();
    expect(document.querySelector("#mode")).not.toBeNull();
    expect(document.querySelector("#style")).not.toBeNull();
    expect(document.querySelector("#playback")).not.toBeNull();
    expect(document.querySelector("#explain-box, #out")).not.toBeNull();
    expect(document.querySelector("#export")).not.toBeNull();
    expect(document.querySelector("#status, #export-status")).not.toBeNull();
  });

  it.each(uiSources)("%s reset preserves the current style and mode selections", (_name, path) => {
    const source = read(path);
    const resetBody = source.match(/function applyDefaults\(\): void \{([\s\S]*?)\n\}/)?.[1] ?? "";

    expect(resetBody).toContain("applyTuning(");
    expect(resetBody).toContain("applyBuiltinProfile(DEFAULT_MAPPING_PROFILE)");
    expect(resetBody).not.toMatch(/style[^\n]*\.value/);
    expect(resetBody).not.toMatch(/mode[^\n]*\.value/);
  });

  it("demo preset loading fails closed when the preset storage JSON is malformed", () => {
    const source = read("demo/demo.ts");
    const loadPresetsBody = source.match(/function loadPresets\(\): WsePreset\[\] \{([\s\S]*?)\n\}/)?.[1] ?? "";

    expect(loadPresetsBody).toContain("JSON.parse");
    expect(loadPresetsBody).toContain("try {");
    expect(loadPresetsBody).toContain("return [];");
  });

  it.each(uiSources)("%s source wires mappingProfile through GenerateOptions", (_name, path) => {
    const source = read(path);

    expect(source).toContain("mappingProfile:");
    expect(source).toContain("generateScore(");
  });

  it("keeps profile-control ids out of content extraction and fingerprint inputs", () => {
    for (const path of extractionSources) {
      const source = read(path);
      expect(source).not.toContain("mapping-profile");
      expect(source).not.toContain("p-content");
      expect(source).not.toContain("p-navigation");
      expect(source).not.toContain("p-media");
      expect(source).not.toContain("p-form");
      expect(source).not.toContain("preset-name");
      expect(source).not.toContain("save-preset");
      expect(source).not.toContain("delete-preset");
    }
  });

  it("keeps visualizer export driven by payload tuning instead of duplicate slider controls", () => {
    const html = read("src/viz/visualizer.html");
    const document = new JSDOM(html).window.document;
    const visualizerSource = read("src/viz/visualizer.ts");

    expect(document.querySelector("#s-low-end")).toBeNull();
    expect(document.querySelector("#s-pad")).toBeNull();
    expect(document.querySelector("#s-melody")).toBeNull();
    expect(document.querySelector("#s-rhythm")).toBeNull();

    expect(visualizerSource).toContain("mix:");
    expect(visualizerSource).toContain("p.tuning.mix");
    expect(visualizerSource).toContain("encodeScore(payload.score, format, renderOptions(payload))");
  });

  it("visualizer exposes a compact profile metadata target in the existing identity area", () => {
    const html = read("src/viz/visualizer.html");
    const document = new JSDOM(html).window.document;

    const meta = document.querySelector<HTMLDivElement>("#meta");
    expect(meta).not.toBeNull();
    expect(meta?.querySelector("#meta-profile")).not.toBeNull();
    expect(document.querySelectorAll("#mapping-profile")).toHaveLength(0);
  });
});
