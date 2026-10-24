import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDir = path.join(__dirname, '..', 'public');

// Function to generate PNG buffer
function createPng(width, height, isMaskable = false) {
  const bytesPerPixel = 4;
  const rowSize = width * bytesPerPixel;
  const rawData = Buffer.alloc((rowSize + 1) * height);

  const cx = width / 2;
  const cy = height / 2;
  const outerR = isMaskable ? width * 0.32 : width * 0.38;
  const strokeW = Math.max(2, Math.round(width * 0.045));
  const innerRx = isMaskable ? width * 0.13 : width * 0.16;
  const innerRy = isMaskable ? height * 0.18 : height * 0.22;
  const tickTop = isMaskable ? height * 0.18 : height * 0.12;
  const tickBottom = tickTop + (isMaskable ? height * 0.12 : height * 0.15);

  let offset = 0;
  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // Filter byte: 0 (None)

    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const distFromCenter = Math.sqrt(dx * dx + dy * dy);

      // Check outer circle stroke
      const onOuterRing = Math.abs(distFromCenter - outerR) <= strokeW / 2;

      // Check vertical caliber tick at 12 o'clock
      const onTick = Math.abs(x - cx) <= strokeW / 2 && y >= tickTop && y <= tickBottom;

      // Check center zero ellipse stroke
      const ellipseDy = y - (cy + Math.round(height * 0.02));
      const ellipseNorm = (dx * dx) / (innerRx * innerRx) + (ellipseDy * ellipseDy) / (innerRy * innerRy);
      const onInnerZero = Math.abs(Math.sqrt(ellipseNorm) - 1.0) <= (strokeW / (innerRx * 2));

      const isMark = onOuterRing || onTick || onInnerZero;

      if (isMark) {
        // Crisp warm white / stone-100 mark
        rawData[offset++] = 245; // R
        rawData[offset++] = 245; // G
        rawData[offset++] = 244; // B
        rawData[offset++] = 255; // A
      } else {
        // Deep obsidian background: stone-950
        rawData[offset++] = 12;  // R
        rawData[offset++] = 10;  // G
        rawData[offset++] = 9;   // B
        rawData[offset++] = 255; // A
      }
    }
  }

  // PNG Signature
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR Chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdrChunk = createChunk('IHDR', ihdrData);

  // IDAT Chunk
  const compressed = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressed);

  // IEND Chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(12 + len);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);

  const crc = crc32(chunk.subarray(4, 8 + len));
  chunk.writeInt32BE(crc, 8 + len);
  return chunk;
}

// CRC32 table & computation
const crcTable = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : (c >>> 1);
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return c ^ -1;
}

// Generate files
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), createPng(192, 192, false));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), createPng(512, 512, false));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), createPng(512, 512, true));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), createPng(180, 180, false));

// Also write clean public/icon.svg
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="100" fill="#0c0a09"/>
  <circle cx="256" cy="256" r="190" stroke="#f5f5f4" stroke-width="24" fill="none"/>
  <line x1="256" y1="66" x2="256" y2="136" stroke="#f5f5f4" stroke-width="24" stroke-linecap="round"/>
  <ellipse cx="256" cy="266" rx="76" ry="106" stroke="#f5f5f4" stroke-width="24" fill="none"/>
</svg>`;
fs.writeFileSync(path.join(publicDir, 'icon.svg'), svg, 'utf-8');

console.log('Successfully generated all PWA icons in public/ directory!');
