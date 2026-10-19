// Generates the Onwan app icon as SVG and PNG at the sizes Google asks for.
//
// The mark is a headline bar above two body-text lines. "عنوان" means headline or title, so the
// mark states the product rather than decorating it. It is built from rectangles only: no font is
// required, so it renders identically everywhere, unlike an Arabic glyph that would break wherever
// Amiri is missing. Colours are the sidebar's own brand variables.
//
// PNG encoding is done by hand with node:zlib rather than adding an image dependency. The artwork
// is flat colour, so this only needs rounded-rectangle coverage and a box downsample for
// antialiasing - both cheap and auditable.
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const out = dirname(fileURLToPath(import.meta.url));
mkdirSync(out, { recursive: true });

const NAVY = [0x14, 0x38, 0x5c];
const GOLD = [0xb7, 0x87, 0x2c];
const CREAM = [0xfa, 0xf6, 0xef];

// Geometry in a 0..1 square, so every size is the same drawing.
const BG_RADIUS = 0.2237; // ~22% - matches the squircle-ish radius Google's UI expects
const BARS = [
  { x: 0.208, y: 0.3, w: 0.5, h: 0.1, r: 0.05, color: GOLD },
  { x: 0.208, y: 0.47, w: 0.584, h: 0.07, r: 0.035, color: CREAM },
  { x: 0.208, y: 0.61, w: 0.584, h: 0.07, r: 0.035, color: CREAM },
  { x: 0.208, y: 0.75, w: 0.35, h: 0.07, r: 0.035, color: CREAM },
];

const hex = ([r, g, b]) =>
  `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" role="img" aria-label="Onwan">
  <rect width="512" height="512" rx="${(BG_RADIUS * 512).toFixed(1)}" fill="${hex(NAVY)}"/>
${BARS.map(
  (b) =>
    `  <rect x="${(b.x * 512).toFixed(1)}" y="${(b.y * 512).toFixed(1)}" width="${(b.w * 512).toFixed(1)}" height="${(b.h * 512).toFixed(1)}" rx="${(b.r * 512).toFixed(1)}" fill="${hex(b.color)}"/>`,
).join("\n")}
</svg>
`;
writeFileSync(join(out, "onwan-icon.svg"), svg, "utf8");

/** Signed distance style coverage test for a rounded rectangle, in unit space. */
function insideRoundedRect(px, py, { x, y, w, h, r }) {
  const cx = Math.min(Math.max(px, x + r), x + w - r);
  const cy = Math.min(Math.max(py, y + r), y + h - r);
  if (px >= x && px <= x + w && py >= y + r && py <= y + h - r) return true;
  if (py >= y && py <= y + h && px >= x + r && px <= x + w - r) return true;
  return (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
}

function render(size, scale = 4) {
  const n = size * scale;
  const acc = new Float64Array(size * size * 4);
  for (let sy = 0; sy < n; sy++) {
    const uy = (sy + 0.5) / n;
    for (let sx = 0; sx < n; sx++) {
      const ux = (sx + 0.5) / n;
      let color = null;
      if (insideRoundedRect(ux, uy, { x: 0, y: 0, w: 1, h: 1, r: BG_RADIUS })) {
        color = NAVY;
        for (const bar of BARS) if (insideRoundedRect(ux, uy, bar)) color = bar.color;
      }
      const di = ((sy / scale) | 0) * size + ((sx / scale) | 0);
      if (color) {
        acc[di * 4] += color[0];
        acc[di * 4 + 1] += color[1];
        acc[di * 4 + 2] += color[2];
        acc[di * 4 + 3] += 255;
      }
    }
  }
  const per = scale * scale;
  const px = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const a = acc[i * 4 + 3] / per;
    // Straight (unpremultiplied) alpha: divide colour by its own coverage, not the sample count.
    const cover = acc[i * 4 + 3] / 255 || 1;
    px[i * 4] = Math.round(acc[i * 4] / cover);
    px[i * 4 + 1] = Math.round(acc[i * 4 + 1] / cover);
    px[i * 4 + 2] = Math.round(acc[i * 4 + 2] / cover);
    px[i * 4 + 3] = Math.round(a);
  }
  return px;
}

const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return (buf) => {
    let c = -1;
    for (const b of buf) c = t[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  };
})();

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(CRC(body));
  return Buffer.concat([len, body, crc]);
}

function png(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // truecolour with alpha
  // Each scanline is prefixed with filter type 0 (None).
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// 32 and 128 are the Marketplace minimums; 120 is the OAuth consent-screen minimum.
const ICON_SIZES = [32, 48, 96, 120, 128, 256, 512];
for (const size of ICON_SIZES) {
  writeFileSync(join(out, `onwan-icon-${size}.png`), png(size, render(size)));
}

/**
 * Marketplace card banner, 220x140. Deliberately wordless: the banner is brand art, and rendering
 * "Onwan / عنوان" would need Amiri present, which is exactly the dependency the icon avoids.
 */
function renderBanner(w, h, scale = 4) {
  const acc = new Float64Array(w * h * 4);
  const iconSpan = 0.62 * h; // icon height relative to the banner
  const ix = (w - iconSpan) / 2;
  const iy = (h - iconSpan) / 2;
  for (let sy = 0; sy < h * scale; sy++) {
    const py = (sy + 0.5) / scale;
    for (let sx = 0; sx < w * scale; sx++) {
      const px = (sx + 0.5) / scale;
      let color = NAVY;
      // Map the pixel into the icon's unit square, then reuse the icon geometry.
      const ux = (px - ix) / iconSpan;
      const uy = (py - iy) / iconSpan;
      if (ux >= 0 && ux <= 1 && uy >= 0 && uy <= 1) {
        for (const bar of BARS) if (insideRoundedRect(ux, uy, bar)) color = bar.color;
      }
      const di = ((sy / scale) | 0) * w + ((sx / scale) | 0);
      acc[di * 4] += color[0];
      acc[di * 4 + 1] += color[1];
      acc[di * 4 + 2] += color[2];
      acc[di * 4 + 3] += 255;
    }
  }
  const per = scale * scale;
  const buf = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    buf[i * 4] = Math.round(acc[i * 4] / per);
    buf[i * 4 + 1] = Math.round(acc[i * 4 + 1] / per);
    buf[i * 4 + 2] = Math.round(acc[i * 4 + 2] / per);
    buf[i * 4 + 3] = Math.round(acc[i * 4 + 3] / per);
  }
  return buf;
}

function pngWH(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

writeFileSync(join(out, "onwan-card-banner-220x140.png"), pngWH(220, 140, renderBanner(220, 140)));

console.log(`wrote onwan-icon.svg, icons at ${ICON_SIZES.join(", ")}, and the 220x140 card banner`);
