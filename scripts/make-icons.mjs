// Generates extension icons (16/48/128) as PNGs with zero image dependencies:
// dark panel + waveform bars in a teal→violet gradient.
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "icons");
mkdirSync(outDir, { recursive: true });

const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function drawIcon(size) {
  const px = Buffer.alloc(size * size * 4);
  const set = (x, y, r, g, b, a = 255) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
    px[i + 3] = a;
  };

  // Background: vertical gradient #0f172a → #1e293b with rounded corners.
  const radius = Math.max(2, Math.round(size * 0.18));
  for (let y = 0; y < size; y++) {
    const t = y / (size - 1);
    const r = Math.round(lerp(15, 30, t));
    const g = Math.round(lerp(23, 41, t));
    const b = Math.round(lerp(42, 59, t));
    for (let x = 0; x < size; x++) {
      // Corner rounding test.
      const cx = x < radius ? radius - x : x >= size - radius ? x - (size - 1 - radius) : 0;
      const cy = y < radius ? radius - y : y >= size - radius ? y - (size - 1 - radius) : 0;
      if (cx * cx + cy * cy > radius * radius) continue;
      set(x, y, r, g, b);
    }
  }

  // Waveform bars: heights symbolize a site's sound signature.
  const heights = [0.32, 0.62, 0.92, 0.5, 0.74];
  const barW = Math.max(1, Math.round(size * 0.1));
  const gap = Math.max(1, Math.round(size * 0.06));
  const totalW = heights.length * barW + (heights.length - 1) * gap;
  const startX = Math.round((size - totalW) / 2);
  const mid = Math.round(size / 2);
  // Gradient across bars: teal #38bdf8 → violet #a78bfa.
  const c0 = [56, 189, 248];
  const c1 = [167, 139, 250];
  heights.forEach((h, i) => {
    const t = i / (heights.length - 1);
    const r = Math.round(lerp(c0[0], c1[0], t));
    const g = Math.round(lerp(c0[1], c1[1], t));
    const b = Math.round(lerp(c0[2], c1[2], t));
    const barH = Math.max(2, Math.round(h * size * 0.72));
    const x0 = startX + i * (barW + gap);
    for (let y = mid - Math.floor(barH / 2); y < mid + Math.ceil(barH / 2); y++) {
      for (let x = x0; x < x0 + barW; x++) set(x, y, r, g, b);
    }
  });

  return encodePng(size, size, px);
}

for (const size of [16, 48, 128]) {
  writeFileSync(join(outDir, `icon${size}.png`), drawIcon(size));
}
console.log("icons written to", outDir);
