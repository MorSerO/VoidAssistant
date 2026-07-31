// Generates resources/icon.ico — a 256x256 PNG-compressed ICO (Vista+ format).
// Void theme: transparent background, dark rounded square, blue radial
// gradient circle with a white core. Pure Node, no dependencies.
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const SIZE = 256;
const PX = Buffer.alloc(SIZE * (SIZE * 4 + 1)); // 1 filter byte per scanline

function putPixel(x, y, r, g, b, a) {
  const row = y * (SIZE * 4 + 1);
  PX[row] = 0; // filter: none
  const off = row + 1 + x * 4;
  PX[off] = r;
  PX[off + 1] = g;
  PX[off + 2] = b;
  PX[off + 3] = a;
}

const cx = SIZE / 2, cy = SIZE / 2;
const outerR = SIZE * 0.44;       // gradient circle radius
const coreR = SIZE * 0.13;        // white core radius
const bgRound = SIZE * 0.20;      // rounded-square corner radius
const bgMargin = SIZE * 0.05;     // dark square margin

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    // Dark rounded square
    const mx = Math.max(Math.abs(x - cx) - (cx - bgMargin - bgRound), 0);
    const my = Math.max(Math.abs(y - cy) - (cy - bgMargin - bgRound), 0);
    const distToSquare = Math.hypot(mx, my);
    const inSquare = (x >= bgMargin && x < SIZE - bgMargin && y >= bgMargin && y < SIZE - bgMargin)
      && (distToSquare <= bgRound);

    // Blue gradient circle
    const d = Math.hypot(x - cx, y - cy);
    const inOuter = d <= outerR;

    if (inSquare) {
      // #0A0A0A base with subtle blue tint at edges
      putPixel(x, y, 10, 12, 18, 255);
      // Anti-alias the square corner edge
      if (distToSquare > bgRound - 1 && distToSquare <= bgRound) {
        const alpha = Math.round((bgRound - distToSquare) * 255);
        putPixel(x, y, 10, 12, 18, alpha);
      }
    }
    if (inOuter) {
      // Radial gradient: #60A5FA center -> #1D4ED8 edge
      const t = Math.min(d / outerR, 1);
      const r = Math.round(0x60A5FA + (0x1D4ED8 - 0x60A5FA) * t);
      const g = Math.round(0xA5 + (0x4E - 0xA5) * t);
      const b = Math.round(0xFA + (0xD8 - 0xFA) * t);
      const a = t > 0.97 ? Math.round((1 - (t - 0.97) / 0.03) * 255) : 255; // soft edge
      putPixel(x, y, r, g, b, a);
    }
    if (d <= coreR) {
      // White core
      const alpha = Math.min(255, Math.round((coreR - d + 1) * 255));
      putPixel(x, y, 255, 255, 255, alpha);
    }
  }
}

// --- PNG encode (8-bit RGBA, no interlace) ---
function crc32(buf) {
  let c, table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xFFFFFFFF;
  for (const byte of buf) crc = table[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8;  // bit depth
ihdr[9] = 6;  // color type RGBA
const idat = zlib.deflateSync(PX, { level: 9 });
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
  chunk('IHDR', ihdr),
  chunk('IDAT', idat),
  chunk('IEND', Buffer.alloc(0)),
]);

// --- ICO container (single 256x256 PNG image) ---
const icondir = Buffer.alloc(6);
icondir.writeUInt16LE(0, 0); // reserved
icondir.writeUInt16LE(1, 2); // type: icon
icondir.writeUInt16LE(1, 4); // count
const entry = Buffer.alloc(16);
entry[0] = 0;  // 256 width
entry[1] = 0;  // 256 height
entry[2] = 0;  // color count
entry[3] = 0;  // reserved
entry.writeUInt16LE(1, 4);  // planes
entry.writeUInt16LE(32, 6); // bit count
entry.writeUInt32LE(png.length, 8);
entry.writeUInt32LE(22, 12); // offset after header
const ico = Buffer.concat([icondir, entry, png]);

const out = path.join(__dirname, '..', 'resources', 'icon.ico');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, ico);
console.log(`Wrote ${out} (${ico.length} bytes)`);
