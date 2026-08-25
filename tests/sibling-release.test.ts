import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const demoHtml = readFileSync(resolve(root, "demo/demo.html"), "utf8");
const manifest = JSON.parse(readFileSync(resolve(root, "manifest.json"), "utf8")) as {
  version: string;
};

describe("WSE v0.5.0 sibling release contract", () => {
  it("keeps the public Axioglyph link in the source demo", () => {
    expect(demoHtml).toContain('href="https://axioglyph.evemisslab.com/"');
    expect(demoHtml).toContain("Axioglyph / 理符");
  });

  it("publishes the verified extension version", () => {
    expect(manifest.version).toBe("0.5.0");
  });

  it("describes the shipped score exports and local controls", () => {
    expect(demoHtml).toContain("MIDI");
    expect(demoHtml).toContain('id="mapping-profile"');
    expect(demoHtml).toContain("local-only");
  });
});
