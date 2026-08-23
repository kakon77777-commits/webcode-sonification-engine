import { describe, expect, it } from "vitest";
import {
  MAX_USER_PRESETS,
  PRESET_STORAGE_KEY,
  normalizePreset,
  readPresetEnvelope,
  removePreset,
  resolveTuningOptions,
  serializePresetEnvelope,
  upsertPreset,
} from "../src/ui/presets.js";

function rawPreset(id: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    version: 1,
    id,
    label: `Preset ${id}`,
    mappingProfile: { version: 1, id: "balanced" },
    style: "ambient",
    mode: "hybrid",
    tuning: {},
    ...overrides,
  };
}

describe("preset store contract", () => {
  it("resolves full tuning defaults and clamps supported numeric ranges", () => {
    expect(resolveTuningOptions()).toEqual({
      tempoShift: 0,
      density: 1,
      brightness: 0.5,
      reverb: 0.5,
      mix: {
        lowEnd: 0.72,
        pad: 1,
        melody: 1,
        rhythm: 0.9,
      },
    });

    expect(resolveTuningOptions({
      tempoShift: 999,
      density: -4,
      brightness: Number.NaN,
      reverb: 3,
      mix: {
        lowEnd: Number.NaN,
        pad: 1.5,
        melody: -1,
        rhythm: 0.4,
      },
    })).toEqual({
      tempoShift: 30,
      density: 0.5,
      brightness: 0.5,
      reverb: 1,
      mix: {
        lowEnd: 0.72,
        pad: 1.25,
        melody: 0,
        rhythm: 0.4,
      },
    });
  });

  it("normalizes a valid preset into a fresh local-only contract", () => {
    const raw = {
      version: 1,
      id: "  article-focus  ",
      label: "  Article Focus  ",
      mappingProfile: {
        version: 1,
        id: "content-forward",
        label: "Content-forward",
        description: "Emphasize text and article structure.",
        characterBias: { content: 1.25, navigation: 0.85, media: 0.85, form: 0.85 },
      },
      style: "ambient",
      mode: "hybrid",
      tuning: {
        tempoShift: 6,
        density: 1.2,
        brightness: 0.7,
        reverb: 0.3,
        mix: { melody: 0.8 },
      },
    };

    const preset = normalizePreset(raw);
    expect(preset).toEqual({
      version: 1,
      id: "article-focus",
      label: "Article Focus",
      mappingProfile: {
        version: 1,
        id: "content-forward",
        label: "Content-forward",
        description: "Emphasize text and article structure.",
        characterBias: { content: 1.25, navigation: 0.85, media: 0.85, form: 0.85 },
      },
      style: "ambient",
      mode: "hybrid",
      tuning: {
        tempoShift: 6,
        density: 1.2,
        brightness: 0.7,
        reverb: 0.3,
        mix: {
          lowEnd: 0.72,
          pad: 1,
          melody: 0.8,
          rhythm: 0.9,
        },
      },
    });
    expect(preset).not.toBe(raw);
    expect(preset?.mappingProfile).not.toBe(raw.mappingProfile);
    expect(preset?.tuning).not.toBe(raw.tuning);
    expect(Object.keys(preset ?? {}).sort()).toEqual([
      "id",
      "label",
      "mappingProfile",
      "mode",
      "style",
      "tuning",
      "version",
    ]);
  });

  it("rejects invalid version, style, mode, profile, ids, labels, and page-data fields", () => {
    expect(normalizePreset({
      version: 2,
      id: "preset",
      label: "Preset",
      mappingProfile: { id: "balanced" },
      style: "ambient",
      mode: "hybrid",
      tuning: {},
    })).toBeNull();

    expect(normalizePreset({
      version: 1,
      id: "preset",
      label: "Preset",
      mappingProfile: { version: 1, id: "balanced" },
      style: "techno",
      mode: "hybrid",
      tuning: {},
    })).toBeNull();

    expect(normalizePreset({
      version: 1,
      id: "preset",
      label: "Preset",
      mappingProfile: { version: 1, id: "balanced" },
      style: "ambient",
      mode: "freeform",
      tuning: {},
    })).toBeNull();

    expect(normalizePreset({
      version: 1,
      id: "preset",
      label: "Preset",
      mappingProfile: { version: 1, id: "Not Valid" },
      style: "ambient",
      mode: "hybrid",
      tuning: {},
    })).toBeNull();

    expect(normalizePreset({
      version: 1,
      id: "   ",
      label: "Preset",
      mappingProfile: { version: 1, id: "balanced" },
      style: "ambient",
      mode: "hybrid",
      tuning: {},
    })).toBeNull();

    expect(normalizePreset({
      version: 1,
      id: "preset",
      label: "   ",
      mappingProfile: { version: 1, id: "balanced" },
      style: "ambient",
      mode: "hybrid",
      tuning: {},
    })).toBeNull();

    expect(normalizePreset({
      version: 1,
      id: "preset",
      label: "Preset",
      mappingProfile: { version: 1, id: "balanced" },
      style: "ambient",
      mode: "hybrid",
      tuning: {},
      url: "https://example.com",
    })).toBeNull();

    expect(normalizePreset({
      version: 1,
      id: "preset",
      label: "Preset",
      mappingProfile: { version: 1, id: "balanced" },
      style: "ambient",
      mode: "hybrid",
      tuning: {},
      features: {},
    })).toBeNull();

    expect(normalizePreset({
      version: 1,
      id: "preset",
      label: "Preset",
      mappingProfile: { version: 1, id: "balanced" },
      style: "ambient",
      mode: "hybrid",
      tuning: {},
      tokens: [],
    })).toBeNull();

    expect(normalizePreset({
      version: 1,
      id: "preset",
      label: "Preset",
      mappingProfile: { version: 1, id: "balanced" },
      style: "ambient",
      mode: "hybrid",
      tuning: {},
      score: {},
    })).toBeNull();
  });

  it("rejects URL and query-derived field families", () => {
    for (const field of ["href", "query", "queryString", "queryParams", "search"]) {
      expect(normalizePreset({ ...rawPreset("forbidden-query"), [field]: "page-derived" }), field).toBeNull();
    }
  });

  it("rejects form and page-text field families", () => {
    for (const field of [
      "form",
      "formValue",
      "formValues",
      "text",
      "content",
      "html",
      "rawPage",
      "pageContent",
      "pageText",
    ]) {
      expect(normalizePreset({ ...rawPreset("forbidden-page"), [field]: "page-derived" }), field).toBeNull();
    }
  });

  it("rejects DOM, score, variation, and audio field families", () => {
    for (const field of [
      "dom",
      "pageFeatures",
      "domSnapshot",
      "variation",
      "audio",
      "audioData",
      "audioBuffer",
      "wav",
      "midi",
      "renderedAudio",
      "blob",
    ]) {
      expect(normalizePreset({ ...rawPreset("forbidden-runtime"), [field]: {} }), field).toBeNull();
    }
  });

  it("rejects exact PageFeatures and Score field spellings", () => {
    expect(normalizePreset({
      ...rawPreset("pascal-page-features"),
      PageFeatures: {},
    })).toBeNull();

    expect(normalizePreset({
      ...rawPreset("pascal-score"),
      Score: {},
    })).toBeNull();
  });

  it("keeps valid entries when the envelope contains malformed neighbors", () => {
    expect(readPresetEnvelope({
      version: 1,
      presets: [
        {
          version: 1,
          id: "balanced-default",
          label: "Balanced Default",
          mappingProfile: { version: 1, id: "balanced" },
          style: "piano",
          mode: "analytical",
          tuning: { density: 1.1 },
        },
        {
          version: 1,
          id: "bad-style",
          label: "Bad Style",
          mappingProfile: { version: 1, id: "balanced" },
          style: "invalid",
          mode: "hybrid",
          tuning: {},
        },
        {
          version: 1,
          id: "bad-page-data",
          label: "Bad Page Data",
          mappingProfile: { version: 1, id: "balanced" },
          style: "ambient",
          mode: "hybrid",
          tuning: {},
          url: "https://example.com",
        },
        {
          version: 1,
          id: "nav-pass",
          label: "Nav Pass",
          mappingProfile: { version: 1, id: "navigation-forward" },
          style: "electronic",
          mode: "musical",
          tuning: { tempoShift: -8, mix: { lowEnd: 0.4 } },
        },
      ],
    })).toEqual([
      {
        version: 1,
        id: "balanced-default",
        label: "Balanced Default",
        mappingProfile: {
          version: 1,
          id: "balanced",
          label: "Balanced",
          description: "Preserve the current structural mapping.",
          characterBias: { content: 1, navigation: 1, media: 1, form: 1 },
        },
        style: "piano",
        mode: "analytical",
        tuning: {
          tempoShift: 0,
          density: 1.1,
          brightness: 0.5,
          reverb: 0.5,
          mix: { lowEnd: 0.72, pad: 1, melody: 1, rhythm: 0.9 },
        },
      },
      {
        version: 1,
        id: "nav-pass",
        label: "Nav Pass",
        mappingProfile: {
          version: 1,
          id: "navigation-forward",
          label: "Navigation-forward",
          description: "Emphasize link and button structure.",
          characterBias: { content: 0.85, navigation: 1.25, media: 0.85, form: 0.85 },
        },
        style: "electronic",
        mode: "musical",
        tuning: {
          tempoShift: -8,
          density: 1,
          brightness: 0.5,
          reverb: 0.5,
          mix: { lowEnd: 0.4, pad: 1, melody: 1, rhythm: 0.9 },
        },
      },
    ]);

    expect(readPresetEnvelope({ version: 2, presets: [] })).toEqual([]);
    expect(readPresetEnvelope({ version: 1, presets: "nope" })).toEqual([]);
    expect(readPresetEnvelope(undefined)).toEqual([]);
  });

  it("replaces duplicates by id, keeps stable order, and caps the newest twelve entries", () => {
    const seed = Array.from({ length: MAX_USER_PRESETS }, (_, index) =>
      normalizePreset({
        version: 1,
        id: `preset-${index + 1}`,
        label: `Preset ${index + 1}`,
        mappingProfile: { version: 1, id: "balanced" },
        style: "ambient",
        mode: "hybrid",
        tuning: { tempoShift: index },
      })
    );

    expect(seed.every(Boolean)).toBe(true);

    const list = seed as NonNullable<(typeof seed)[number]>[];
    const replaced = upsertPreset(list, normalizePreset({
      version: 1,
      id: "preset-4",
      label: "Preset Four Updated",
      mappingProfile: { version: 1, id: "media-forward" },
      style: "orchestral",
      mode: "musical",
      tuning: { reverb: 0.8 },
    })!);

    expect(replaced).toHaveLength(MAX_USER_PRESETS);
    expect(replaced.map((preset) => preset.id)).toEqual([
      "preset-1",
      "preset-2",
      "preset-3",
      "preset-5",
      "preset-6",
      "preset-7",
      "preset-8",
      "preset-9",
      "preset-10",
      "preset-11",
      "preset-12",
      "preset-4",
    ]);
    expect(replaced.at(-1)).toMatchObject({
      id: "preset-4",
      label: "Preset Four Updated",
      mappingProfile: { id: "media-forward" },
      style: "orchestral",
      mode: "musical",
    });

    const capped = upsertPreset(replaced, normalizePreset({
      version: 1,
      id: "preset-13",
      label: "Preset 13",
      mappingProfile: { version: 1, id: "form-forward" },
      style: "eastern",
      mode: "analytical",
      tuning: { brightness: 0.2 },
    })!);

    expect(capped).toHaveLength(MAX_USER_PRESETS);
    expect(capped.map((preset) => preset.id)).toEqual([
      "preset-2",
      "preset-3",
      "preset-5",
      "preset-6",
      "preset-7",
      "preset-8",
      "preset-9",
      "preset-10",
      "preset-11",
      "preset-12",
      "preset-4",
      "preset-13",
    ]);
  });

  it("canonicalizes envelope duplicates and caps the newest twelve entries before serialization", () => {
    const entries = Array.from({ length: MAX_USER_PRESETS + 1 }, (_, index) =>
      rawPreset(`entry-${index + 1}`)
    );
    entries.push(
      rawPreset("entry-4", {
        label: "Entry Four Updated",
        mappingProfile: { version: 1, id: "media-forward" },
      })
    );

    const canonical = readPresetEnvelope({ version: 1, presets: entries });

    expect(canonical.map((preset) => preset.id)).toEqual([
      "entry-2",
      "entry-3",
      "entry-5",
      "entry-6",
      "entry-7",
      "entry-8",
      "entry-9",
      "entry-10",
      "entry-11",
      "entry-12",
      "entry-13",
      "entry-4",
    ]);
    expect(canonical.at(-1)).toMatchObject({
      id: "entry-4",
      label: "Entry Four Updated",
      mappingProfile: { id: "media-forward" },
    });

    const serialized = serializePresetEnvelope(canonical);
    expect(readPresetEnvelope(serialized)).toEqual(canonical);
    expect(serializePresetEnvelope(readPresetEnvelope(serialized))).toEqual(serialized);
  });

  it("keeps the existing list unchanged when a runtime candidate fails normalization", () => {
    const existing = readPresetEnvelope({
      version: 1,
      presets: [rawPreset("existing")],
    });
    const invalidCandidate = {
      ...rawPreset("replacement"),
      pageText: "must not enter the store",
    } as unknown as Parameters<typeof upsertPreset>[1];

    expect(upsertPreset(existing, invalidCandidate)).toEqual(existing);
  });

  it("removes presets by id without disturbing the rest of the list", () => {
    const list = readPresetEnvelope({
      version: 1,
      presets: [
        {
          version: 1,
          id: "one",
          label: "One",
          mappingProfile: { version: 1, id: "balanced" },
          style: "ambient",
          mode: "hybrid",
          tuning: {},
        },
        {
          version: 1,
          id: "two",
          label: "Two",
          mappingProfile: { version: 1, id: "media-forward" },
          style: "piano",
          mode: "musical",
          tuning: {},
        },
      ],
    });

    expect(removePreset(list, "one").map((preset) => preset.id)).toEqual(["two"]);
    expect(removePreset(list, "missing").map((preset) => preset.id)).toEqual(["one", "two"]);
  });

  it("serializes the versioned preset envelope with only normalized presets", () => {
    const list = readPresetEnvelope({
      version: 1,
      presets: [
        {
          version: 1,
          id: "save-me",
          label: "Save Me",
          mappingProfile: { version: 1, id: "form-forward" },
          style: "eastern",
          mode: "analytical",
          tuning: { tempoShift: -3, mix: { pad: 0.8 } },
        },
      ],
    });

    expect(PRESET_STORAGE_KEY).toBe("wse.presets.v1");
    expect(serializePresetEnvelope(list)).toEqual({
      version: 1,
      presets: [
        {
          version: 1,
          id: "save-me",
          label: "Save Me",
          mappingProfile: {
            version: 1,
            id: "form-forward",
            label: "Form-forward",
            description: "Emphasize input and control structure.",
            characterBias: { content: 0.85, navigation: 0.85, media: 0.85, form: 1.25 },
          },
          style: "eastern",
          mode: "analytical",
          tuning: {
            tempoShift: -3,
            density: 1,
            brightness: 0.5,
            reverb: 0.5,
            mix: { lowEnd: 0.72, pad: 0.8, melody: 1, rhythm: 0.9 },
          },
        },
      ],
    });
  });
});
