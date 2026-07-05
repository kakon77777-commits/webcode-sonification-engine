import type { StyleFeatures } from "../shared/types.js";
import type { TraversedElement } from "./dom-features.js";

/**
 * Computed-style sampling (§18–19, §75): at most 500 elements are inspected via
 * getComputedStyle — no CSS AST parsing in v0.1.
 */

export const MAX_STYLE_SAMPLES = 500;

interface Hsl {
  h: number; // 0–360
  s: number; // 0–1
  l: number; // 0–1
  a: number; // 0–1
}

/** Parse computed color strings: rgb()/rgba()/#hex/transparent. Returns null if unparseable. */
export function parseColor(value: string | null | undefined): Hsl | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (v === "transparent") return { h: 0, s: 0, l: 0, a: 0 };
  let r = 0;
  let g = 0;
  let b = 0;
  let a = 1;
  const rgbMatch = v.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/);
  const spaceMatch = v.match(/^rgba?\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.%]+))?\s*\)$/);
  const m = rgbMatch ?? spaceMatch;
  if (m) {
    r = parseFloat(m[1]);
    g = parseFloat(m[2]);
    b = parseFloat(m[3]);
    if (m[4] !== undefined) a = m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
  } else if (/^#[0-9a-f]{3,8}$/.test(v)) {
    const hex = v.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
      if (hex.length === 4) a = parseInt(hex[3] + hex[3], 16) / 255;
    } else if (hex.length === 6 || hex.length === 8) {
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
      if (hex.length === 8) a = parseInt(hex.slice(6, 8), 16) / 255;
    } else {
      return null;
    }
  } else {
    return null;
  }
  return { ...rgbToHsl(r, g, b), a };
}

function rgbToHsl(r: number, g: number, b: number): Omit<Hsl, "a"> {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
  else if (max === gn) h = ((bn - rn) / d + 2) * 60;
  else h = ((rn - gn) / d + 4) * 60;
  return { h, s, l };
}

export function extractStyleFeatures(
  elements: TraversedElement[],
  win: Window & typeof globalThis
): StyleFeatures {
  const stride = Math.max(1, Math.ceil(elements.length / MAX_STYLE_SAMPLES));
  let sampledCount = 0;
  // Circular mean for hue, weighted by saturation so grays do not pollute it.
  let hueX = 0;
  let hueY = 0;
  let satSum = 0;
  let lightSum = 0;
  let colorSamples = 0;
  let fontSum = 0;
  let fontSamples = 0;
  let fixedCount = 0;
  let absoluteCount = 0;

  for (let i = 0; i < elements.length; i += stride) {
    const el = elements[i].el;
    let cs: CSSStyleDeclaration;
    try {
      cs = win.getComputedStyle(el);
    } catch {
      continue;
    }
    if (cs.display === "none") continue;
    sampledCount++;

    // Backgrounds dominate perceived brightness, so they weigh more than text
    // colors — otherwise light text on a dark site reads as "bright palette".
    for (const [raw, weight] of [
      [cs.backgroundColor, 4],
      [cs.color, 1],
    ] as const) {
      const hsl = parseColor(raw);
      if (!hsl || hsl.a < 0.05) continue;
      const rad = (hsl.h * Math.PI) / 180;
      hueX += Math.cos(rad) * hsl.s * weight;
      hueY += Math.sin(rad) * hsl.s * weight;
      satSum += hsl.s * weight;
      lightSum += hsl.l * weight;
      colorSamples += weight;
    }

    const fs = parseFloat(cs.fontSize);
    if (Number.isFinite(fs) && fs > 0) {
      fontSum += fs;
      fontSamples++;
    }

    if (cs.position === "fixed") fixedCount++;
    else if (cs.position === "absolute") absoluteCount++;
  }

  let avgHue = 0;
  if (colorSamples > 0 && (hueX !== 0 || hueY !== 0)) {
    avgHue = (Math.atan2(hueY, hueX) * 180) / Math.PI;
    if (avgHue < 0) avgHue += 360;
  }

  return {
    sampledCount,
    avgHue,
    avgSaturation: colorSamples > 0 ? satSum / colorSamples : 0,
    avgLightness: colorSamples > 0 ? lightSum / colorSamples : 0.5,
    avgFontSize: fontSamples > 0 ? fontSum / fontSamples : 16,
    fixedCount,
    absoluteCount,
  };
}
