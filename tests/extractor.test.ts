import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { extractPageFeatures } from "../src/content/extract.js";
import { loadFixture } from "./helpers.js";

describe("DOM extractor (known HTML → known features)", () => {
  it("extracts exact structural counts from the blog fixture", () => {
    const { features } = loadFixture("simple-blog.html", "https://blog.example/post");
    expect(features.dom.linkCount).toBe(4); // 3 nav + 1 RSS
    expect(features.dom.imageCount).toBe(0);
    expect(features.dom.buttonCount).toBe(0);
    expect(features.dom.tagHistogram["article"]).toBe(3);
    expect(features.dom.sectionCount).toBe(7); // header + nav + main + 3×article + footer
    expect(features.dom.headingCount).toBe(4); // h1 + 3×h2
    expect(features.dom.totalNodes).toBeGreaterThan(20);
    expect(features.dom.maxDepth).toBeGreaterThanOrEqual(3);
    expect(features.dom.textLength).toBeGreaterThan(400);
    expect(features.url).toBe("https://blog.example/post");
  });

  it("counts buttons and scripts on the dashboard fixture", () => {
    const { features } = loadFixture("dashboard.html", "https://dash.example/app");
    expect(features.dom.buttonCount).toBe(13);
    expect(features.script.scriptCount).toBe(3);
    expect(features.script.inlineScriptCount).toBe(1);
    expect(features.script.externalScriptCount).toBe(2);
    expect(features.script.scriptSrcDomainCount).toBe(1); // both on cdn.example
    expect(features.dom.maxDepth).toBeGreaterThanOrEqual(8);
  });

  it("strips query strings and fragments from the canonical URL", () => {
    const dom = new JSDOM("<main><p>hi</p></main>", {
      url: "https://example.com/path?token=SECRET#frag",
    });
    const win = dom.window as unknown as Window & typeof globalThis;
    const features = extractPageFeatures(win.document, win);
    expect(features.url).toBe("https://example.com/path");
    expect(JSON.stringify(features)).not.toContain("SECRET");
  });

  it("never reads form values or editable content (§26)", () => {
    const secret = "hunter2-super-secret-password-value";
    const dom = new JSDOM(
      `<main>
        <p>visible words here</p>
        <input type="password" value="${secret}">
        <input type="text" value="${secret}">
        <textarea>${secret}</textarea>
        <div contenteditable="true"><p>${secret} inside editable</p></div>
        <select><option>${secret}</option></select>
      </main>`,
      { url: "https://example.com/form" }
    );
    const win = dom.window as unknown as Window & typeof globalThis;
    const features = extractPageFeatures(win.document, win);
    expect(JSON.stringify(features)).not.toContain(secret);
    // Only "visible words here" counts toward text.
    expect(features.dom.textLength).toBe("visible words here".length);
    expect(features.dom.wordCount).toBe(3);
  });

  it("is deterministic: extracting twice yields identical features", () => {
    const a = loadFixture("docs.html", "https://docs.example/guide").features;
    const b = loadFixture("docs.html", "https://docs.example/guide").features;
    expect(a).toEqual(b);
  });
});
