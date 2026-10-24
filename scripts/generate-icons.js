import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDir = path.join(__dirname, '..', 'public');

// Function to generate PNG buffer for the user's provided 3-ring logo:
// Ring 1 (outer): Silver / Gray circle (#b0adaa)
// Ring 2 (middle): Golden / Amber vertical oval (#f5b72f)
// Ring 3 (lower inner): Vibrant Green circle (#68ce3b)
// Background: Deep Obsidian / Dark Stone (#1c1917)
function createPng(width, height, isMaskable = false) {
  const bytesPerPixel = 4;
  const rowSize = width * bytesPerPixel;
  const rawData = Buffer.alloc((rowSize + 1) * height);

  const cx = width / 2;
  const cy = height / 2;
  const scale = isMaskable ? 0.78 : 0.92;

  // Geometry parameters scaled
  const outerR = (width * 0.355) * scale;
  const outerThick = Math.max(2, Math.round(width * 0.035 * scale));

  const ovalRx = (width * 0.226) * scale;
  const ovalRy = (height * 0.312) * scale;
  const ovalThick = Math.max(2, Math.round(width * 0.043 * scale));

  const greenR = (width * 0.168) * scale;
  const greenCy = cy + (height * 0.098) * scale;
  const greenThick = Math.max(2, Math.round(width * 0.035 * scale));

  let offset = 0;
  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // Filter byte: 0 (None)

    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const distFromCenter = Math.sqrt(dx * dx + dy * dy);

      // 1. Lower Inner Green Circle
      const greenDy = y - greenCy;
      const distFromGreen = Math.sqrt(dx * dx + greenDy * greenDy);
      const onGreen = Math.abs(distFromGreen - greenR) <= greenThick / 2;

      // 2. Middle Golden Amber Oval
      const ovalNorm = (dx * dx) / (ovalRx * ovalRx) + (dy * dy) / (ovalRy * ovalRy);
      const onOval = Math.abs(Math.sqrt(ovalNorm) - 1.0) <= (ovalThick / (ovalRx * 2));

      // 3. Outer Silver/Gray Circle
      const onOuter = Math.abs(distFromCenter - outerR) <= outerThick / 2;

      if (onGreen) {
        // Vibrant Green (#68ce3b)
        rawData[offset++] = 104; // R
        rawData[offset++] = 206; // G
        rawData[offset++] = 59;  // B
        rawData[offset++] = 255; // A
      } else if (onOval) {
        // Golden Amber (#f5b72f)
        rawData[offset++] = 245; // R
        rawData[offset++] = 183; // G
        rawData[offset++] = 47;  // B
        rawData[offset++] = 255; // A
      } else if (onOuter) {
        // Silver Gray (#b0adaa)
        rawData[offset++] = 176; // R
        rawData[offset++] = 173; // G
        rawData[offset++] = 170; // B
        rawData[offset++] = 255; // A
      } else {
        // Deep Obsidian Background (#1c1917)
        rawData[offset++] = 28;  // R
        rawData[offset++] = 25;  // G
        rawData[offset++] = 23;  // B
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
  ihdrData[8] = 8;
  ihdrData[9] = 6;
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
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

fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), createPng(192, 192, false));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), createPng(512, 512, false));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), createPng(512, 512, true));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), createPng(180, 180, false));

console.log('Successfully generated all brand PWA icons matching provided image!');
