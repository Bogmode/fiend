// Generates placeholder PWA icons (dark bg, chartreuse "F" wordmark) as raw PNGs.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const BG = [0x0D, 0x0D, 0x0F];
const ACCENT = [0xC9, 0xF2, 0x20];

function crc32(buf) {
  let c, table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c;
    }
    return t;
  })());
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

// draws an "F" glyph (rect-based, geometric) into a size x size RGB buffer
function drawF(size, padFrac) {
  const px = Buffer.alloc(size * size * 3);
  for (let i = 0; i < size * size; i++) {
    px[i * 3] = BG[0]; px[i * 3 + 1] = BG[1]; px[i * 3 + 2] = BG[2];
  }
  const set = (x, y) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 3;
    px[i] = ACCENT[0]; px[i + 1] = ACCENT[1]; px[i + 2] = ACCENT[2];
  };
  const rect = (x0f, y0f, x1f, y1f) => {
    const x0 = Math.round(x0f * size), x1 = Math.round(x1f * size);
    const y0 = Math.round(y0f * size), y1 = Math.round(y1f * size);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) set(x, y);
  };
  const p = padFrac; // safe-zone padding for maskable icons
  const span = 1 - 2 * p;
  // F glyph drawn within [p, 1-p] box
  rect(p + 0.18 * span, p + 0.14 * span, p + 0.32 * span, p + 0.86 * span); // vertical stroke
  rect(p + 0.18 * span, p + 0.14 * span, p + 0.78 * span, p + 0.30 * span); // top bar
  rect(p + 0.18 * span, p + 0.44 * span, p + 0.62 * span, p + 0.60 * span); // middle bar
  return px;
}

function writePNG(filename, size, padFrac) {
  const px = drawF(size, padFrac);
  // add filter byte (0 = none) per scanline
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    px.copy(raw, y * (size * 3 + 1) + 1, y * size * 3, (y + 1) * size * 3);
  }
  const idatData = zlib.deflateSync(raw, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type: RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const out = Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idatData),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  fs.writeFileSync(filename, out);
  console.log('wrote', filename, `${size}x${size}`);
}

const dir = path.join(__dirname, '..', 'icons');
fs.mkdirSync(dir, { recursive: true });
writePNG(path.join(dir, 'icon-192.png'), 192, 0.08);
writePNG(path.join(dir, 'icon-512.png'), 512, 0.08);
writePNG(path.join(dir, 'icon-512-maskable.png'), 512, 0.16);
writePNG(path.join(dir, 'apple-touch-icon.png'), 180, 0.08);
