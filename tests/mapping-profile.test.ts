import { describe, expect, it } from "vitest";
import { hash64hex } from "../src/mapping/deterministic-seed.js";
import {
  BUILTIN_MAPPING_PROFILES,
  DEFAULT_MAPPING_PROFILE,
  canonicalMappingProfile,
  mappingProfileHash,
  resolveMappingProfile,
} from "../src/mapping/mapping-profile.js";

describe("mapping profile contract", () => {
  it("keeps the balanced profile identity-compatible with old callers", () => {
    expect(resolveMappingProfile()).toMatchObject({
      version: 1,
      id: "balanced",
      characterBias: { content: 1, navigation: 1, media: 1, form: 1 },
    });
    expect(resolveMappingProfile({ characterBias: { media: 1.25 } }).characterBias).toEqual({
      content: 1,
      navigation: 1,
      media: 1.25,
      form: 1,
    });
  });

  it("merges partial input, clamps finite values, and defaults invalid numbers", () => {
    const input = {
      characterBias: {
        content: 2,
        navigation: 0.1,
        media: Number.NaN,
        form: Number.POSITIVE_INFINITY,
      },
    };

    expect(resolveMappingProfile(input).characterBias).toEqual({
      content: 1.25,
      navigation: 0.75,
      media: 1,
      form: 1,
    });
    expect(input.characterBias).toEqual({
      content: 2,
      navigation: 0.1,
      media: Number.NaN,
      form: Number.POSITIVE_INFINITY,
    });
  });

  it("falls back to the balanced identity for unsupported versions and invalid ids", () => {
    expect(resolveMappingProfile({ version: 2, id: "content-forward" })).toMatchObject({
      version: 1,
      id: "balanced",
      label: "Balanced",
      description: DEFAULT_MAPPING_PROFILE.description,
    });
    expect(resolveMappingProfile({ id: "Not Valid" })).toMatchObject({
      version: 1,
      id: "balanced",
      label: "Balanced",
    });
  });

  it("bounds display metadata and ignores unknown keys", () => {
    const label = `  ${"L".repeat(60)}  `;
    const description = ` ${"D".repeat(170)} `;
    const resolved = resolveMappingProfile({
      id: "custom_profile",
      label,
      description,
      characterBias: { content: 1.1 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...( { extra: "ignored", nested: { nope: true } } as any),
    });

    expect(resolved.id).toBe("custom_profile");
    expect(resolved.label).toBe("L".repeat(48));
    expect(resolved.description).toBe("D".repeat(160));
    expect(Object.keys(resolved).sort()).toEqual([
      "characterBias",
      "description",
      "id",
      "label",
      "version",
    ]);
  });

  it("preserves explicitly supplied whitespace-only display metadata", () => {
    const resolved = resolveMappingProfile({
      id: "content-forward",
      label: "   ",
      description: "\t\n",
    });

    expect(resolved.label).toBe("");
    expect(resolved.description).toBe("");
    expect(resolveMappingProfile({ id: "content-forward" })).toMatchObject({
      label: "Content-forward",
      description: "Emphasize text and article structure.",
    });
    expect(resolveMappingProfile({ id: "content-forward", label: undefined, description: undefined })).toMatchObject({
      label: "Content-forward",
      description: "Emphasize text and article structure.",
    });
  });

  it("returns fresh objects each time", () => {
    const a = resolveMappingProfile();
    const b = resolveMappingProfile();

    expect(a).not.toBe(b);
    expect(a.characterBias).not.toBe(b.characterBias);

    a.characterBias.content = 1.25;
    expect(b.characterBias.content).toBe(1);
  });

  it("serializes only functional fields in fixed character order", () => {
    const profile = resolveMappingProfile({
      id: "custom",
      label: "Ignored label",
      description: "Ignored description",
      characterBias: {
        navigation: 0.9,
        form: 1.2,
        content: 1.1,
        media: 0.8,
      },
    });

    expect(canonicalMappingProfile(profile)).toBe(
      '{"version":1,"characterBias":{"content":1.1,"navigation":0.9,"media":0.8,"form":1.2}}'
    );
  });

  it("keeps hashes stable across display metadata changes", () => {
    const functional = {
      id: "custom",
      characterBias: { content: 1.1, navigation: 0.95, media: 1.05, form: 0.9 },
    } as const;
    const a = resolveMappingProfile({
      ...functional,
      label: "Content bias",
      description: "First label",
    });
    const b = resolveMappingProfile({
      ...functional,
      label: "Another label",
      description: "Another description",
    });

    expect(mappingProfileHash(a)).toBe(hash64hex(canonicalMappingProfile(a)));
    expect(mappingProfileHash(a)).toBe(mappingProfileHash(b));
  });

  it("defines the five immutable built-ins with exact bounded biases", () => {
    expect(BUILTIN_MAPPING_PROFILES).toEqual([
      {
        version: 1,
        id: "balanced",
        label: "Balanced",
        description: "Preserve the current structural mapping.",
        characterBias: { content: 1, navigation: 1, media: 1, form: 1 },
      },
      {
        version: 1,
        id: "content-forward",
        label: "Content-forward",
        description: "Emphasize text and article structure.",
        characterBias: { content: 1.25, navigation: 0.85, media: 0.85, form: 0.85 },
      },
      {
        version: 1,
        id: "navigation-forward",
        label: "Navigation-forward",
        description: "Emphasize link and button structure.",
        characterBias: { content: 0.85, navigation: 1.25, media: 0.85, form: 0.85 },
      },
      {
        version: 1,
        id: "media-forward",
        label: "Media-forward",
        description: "Emphasize image and visual structure.",
        characterBias: { content: 0.85, navigation: 0.85, media: 1.25, form: 0.85 },
      },
      {
        version: 1,
        id: "form-forward",
        label: "Form-forward",
        description: "Emphasize input and control structure.",
        characterBias: { content: 0.85, navigation: 0.85, media: 0.85, form: 1.25 },
      },
    ]);
    expect(Object.isFrozen(BUILTIN_MAPPING_PROFILES)).toBe(true);
    expect(Object.isFrozen(BUILTIN_MAPPING_PROFILES[0])).toBe(true);
    expect(Object.isFrozen(BUILTIN_MAPPING_PROFILES[0].characterBias)).toBe(true);
  });
});
