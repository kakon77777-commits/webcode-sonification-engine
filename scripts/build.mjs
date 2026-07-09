// Bundles the extension into dist/ (load dist/ as the unpacked extension)
// and the standalone demo into demo/demo.js.
import { build } from "esbuild";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

const common = {
  bundle: true,
  format: "iife",
  target: "chrome110",
  logLevel: "info",
  legalComments: "none",
};

await build({
  ...common,
  entryPoints: {
    background: join(root, "src/background/service-worker.ts"),
    "content-extractor": join(root, "src/content/extractor.ts"),
    popup: join(root, "src/ui/popup.ts"),
    offscreen: join(root, "src/offscreen/offscreen.ts"),
    visualizer: join(root, "src/viz/visualizer.ts"),
  },
  outdir: dist,
});

await build({
  ...common,
  entryPoints: { demo: join(root, "demo/demo.ts") },
  outdir: join(root, "demo"),
  allowOverwrite: true,
});

// Static assets.
cpSync(join(root, "manifest.json"), join(dist, "manifest.json"));
cpSync(join(root, "src/ui/popup.html"), join(dist, "popup.html"));
cpSync(join(root, "src/ui/popup.css"), join(dist, "popup.css"));
cpSync(join(root, "src/offscreen/offscreen.html"), join(dist, "offscreen.html"));
cpSync(join(root, "src/viz/visualizer.html"), join(dist, "visualizer.html"));
cpSync(join(root, "src/viz/visualizer.css"), join(dist, "visualizer.css"));
cpSync(join(root, "icons"), join(dist, "icons"), { recursive: true });

console.log("extension built into dist/");
