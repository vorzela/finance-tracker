/**
 * scripts/generate-icons.mjs
 *
 * Renders the whole app icon set from one vector source so every size stays
 * crisp and the Android adaptive layers line up exactly.
 *
 * Run with `npm run icons`.
 *
 * The mark is a wallet holding two cards — one for each person in the
 * household — on the navy brand gradient from `global.css`.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "assets", "images");

const NAVY_LIGHT = "#2f5ba8";
const NAVY_DARK = "#0d1c33";
const GOLD = "#f5a623";
const GREEN = "#3db077";
const WHITE = "#ffffff";
const POCKET = "#dfe7f5";

/**
 * Circular launcher masks keep only a 66% diameter circle of an adaptive layer,
 * so the mark has to fit inside that circle corners and all.
 */
const ADAPTIVE_MARK_SCALE = 0.92;

const gradientDefs = `
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="${NAVY_LIGHT}" />
    <stop offset="55%" stop-color="#1b3560" />
    <stop offset="100%" stop-color="${NAVY_DARK}" />
  </linearGradient>
  <radialGradient id="glow" cx="0.25" cy="0.15" r="0.75">
    <stop offset="0%" stop-color="#ffffff" stop-opacity="0.22" />
    <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
  </radialGradient>
`;

/**
 * The mark, drawn in a 1024x1024 box. `mono` collapses it to a single-colour
 * silhouette for the Android monochrome layer, where overlapping fills of the
 * same colour would otherwise merge into a blob.
 */
/**
 * The mark spans x 252..772 and y 202..764, so it is 28px high of centre in the
 * 1024 box; the wrapping translate puts it back on the canvas midpoint.
 */
function mark({ mono = false, color = WHITE } = {}) {
  const body = mono
    ? // A mask, not stacked fills: the pocket has to be a hole in the alpha
      // channel, since the system tints the whole layer one colour.
      `
      <mask id="silhouette">
        <rect x="344" y="248" width="336" height="200" rx="52" fill="#fff" />
        <rect x="252" y="392" width="520" height="372" rx="96" fill="#fff" />
        <rect x="560" y="520" width="196" height="124" rx="62" fill="#000" />
        <circle cx="658" cy="582" r="30" fill="#fff" />
      </mask>
      <rect width="1024" height="1024" fill="${color}" mask="url(#silhouette)" />
    `
    : `
      <rect x="286" y="236" width="286" height="206" rx="44" fill="${GOLD}"
            transform="rotate(-15 429 339)" />
      <rect x="452" y="236" width="286" height="206" rx="44" fill="${GREEN}"
            transform="rotate(15 595 339)" />
      <rect x="252" y="392" width="520" height="372" rx="96" fill="${color}" />
      <rect x="560" y="520" width="196" height="124" rx="62" fill="${POCKET}" />
      <circle cx="658" cy="582" r="30" fill="${NAVY_DARK}" />
    `;

  return `<g transform="translate(0 28)">${body}</g>`;
}

/** Scales the 1024-box mark about the canvas centre. */
function scaled(inner, scale) {
  const offset = 512 * (1 - scale);
  return `<g transform="translate(${offset} ${offset}) scale(${scale})">${inner}</g>`;
}

function svg(body, { size = 1024 } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">
    <defs>${gradientDefs}</defs>
    ${body}
  </svg>`;
}

const backdrop = `
  <rect width="1024" height="1024" rx="228" fill="url(#bg)" />
  <rect width="1024" height="1024" rx="228" fill="url(#glow)" />
`;

const fullBleedBackdrop = `
  <rect width="1024" height="1024" fill="url(#bg)" />
  <rect width="1024" height="1024" fill="url(#glow)" />
`;

const files = [
  {
    // Square and opaque: iOS and Android apply their own corner mask, and a
    // pre-rounded icon would get double-rounded.
    name: "icon.png",
    size: 1024,
    source: svg(`${fullBleedBackdrop}${scaled(mark(), 1.2)}`),
  },
  {
    name: "android-icon-background.png",
    size: 1024,
    source: svg(fullBleedBackdrop),
  },
  {
    name: "android-icon-foreground.png",
    size: 1024,
    source: svg(scaled(mark(), ADAPTIVE_MARK_SCALE)),
  },
  {
    name: "android-icon-monochrome.png",
    size: 1024,
    source: svg(scaled(mark({ mono: true }), ADAPTIVE_MARK_SCALE)),
  },
  {
    // Sits on the navy splash background, so the wallet stays white.
    name: "splash-icon.png",
    size: 1024,
    source: svg(scaled(mark(), 1.05)),
  },
  {
    name: "favicon.png",
    size: 96,
    source: svg(`${backdrop}${scaled(mark(), 1.2)}`),
  },
  {
    name: "notification-icon.png",
    size: 192,
    // Android tints this to white and discards colour, so ship a silhouette.
    source: svg(scaled(mark({ mono: true, color: "#ffffff" }), 0.92)),
  },
];

await mkdir(OUT, { recursive: true });

for (const file of files) {
  const png = await sharp(Buffer.from(file.source), { density: 192 })
    .resize(file.size, file.size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  await writeFile(join(OUT, file.name), png);
  console.log(`wrote ${file.name} (${file.size}x${file.size})`);
}
