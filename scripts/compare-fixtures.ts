// Dev utility: print the musical identity of each test fixture side by side,
// to eyeball cross-site differentiation. Run via `node scripts/compare.mjs`
// after bundling (see package.json "compare").
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { JSDOM } from "jsdom";
import { extractPageFeatures } from "../src/content/extract.js";
import { computeFingerprint } from "../src/mapping/fingerprint.js";
import { generateScore } from "../src/mapping/default-map.js";

function loadFixture(name: string, url: string) {
  const html = readFileSync(join(process.cwd(), "tests", "fixtures", name), "utf8");
  const dom = new JSDOM(html, { url });
  const win = dom.window as unknown as Window & typeof globalThis;
  return { features: extractPageFeatures(win.document, win) };
}

const FIXTURES = [
  ["simple-blog.html", "https://blog.example/post"],
  ["dashboard.html", "https://dash.example/app"],
  ["ecommerce.html", "https://shop.example/"],
  ["docs.html", "https://docs.example/guide"],
] as const;

for (const style of ["ambient", "piano", "eastern"] as const) {
  console.log(`\n=== style: ${style} ===`);
  for (const [name, url] of FIXTURES) {
    const { features } = loadFixture(name, url);
    const s = generateScore(features, computeFingerprint(features), {
      style,
      mode: "hybrid",
      variation: 0,
    });
    const instr = [...new Set(s.events.map((e) => e.instrument))].sort().join("+");
    console.log(
      `${name.padEnd(18)} ${s.profile.keyName.padEnd(16)} ${String(s.profile.bpm).padStart(3)}bpm ` +
        `${String(s.profile.lengthSec).padStart(2)}s ${String(s.events.length).padStart(3)}ev ` +
        `${s.profile.character.padEnd(10)} [${instr}]`
    );
  }
}
