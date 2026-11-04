// Génère les icônes PWA en PNG pur (sans dépendances)
// Crée un PNG monochrome avec fond sombre et cercle violet

import { writeFileSync, mkdirSync } from 'fs';
import { deflateSync } from 'zlib';

const outDir = './src/public/static/icons';
mkdirSync(outDir, { recursive: true });

function crc32(buf: Uint8Array): number {
  const table = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[i] = c;
    }
    return t;
  })();
  let crc = 0xFFFFFFFF;
  for (const b of buf) crc = table[(crc ^ b) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function u32be(n: number): Uint8Array {
  return new Uint8Array([(n >>> 24) & 0xFF, (n >>> 16) & 0xFF, (n >>> 8) & 0xFF, n & 0xFF]);
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const crcInput = new Uint8Array(typeBytes.length + data.length);
  crcInput.set(typeBytes); crcInput.set(data, typeBytes.length);
  const crc = u32be(crc32(crcInput));
  const len = u32be(data.length);
  const chunk = new Uint8Array(4 + 4 + data.length + 4);
  chunk.set(len, 0);
  chunk.set(typeBytes, 4);
  chunk.set(data, 8);
  chunk.set(crc, 8 + data.length);
  return chunk;
}

function generateIcon(size: number) {
  // Créer les pixels RGBA
  const pixels = new Uint8Array(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.42;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= r) {
        // Cercle violet dégradé
        const t = dist / r;
        pixels[idx]   = Math.round(99 + (55 - 99) * t);    // R: 99→55
        pixels[idx+1] = Math.round(102 + (48 - 102) * t);  // G: 102→48
        pixels[idx+2] = Math.round(241 + (163 - 241) * t); // B: 241→163
        pixels[idx+3] = 255;
      } else {
        // Fond sombre #0f1117
        pixels[idx]   = 15;
        pixels[idx+1] = 17;
        pixels[idx+2] = 23;
        pixels[idx+3] = 255;
      }
    }
  }

  // Dessiner l'éclair ⚡ (forme géométrique simplifiée)
  const bolt = [
    // Polygone éclair centré
    [0.55, 0.10], [0.30, 0.50], [0.50, 0.50],
    [0.45, 0.90], [0.70, 0.45], [0.50, 0.45], [0.55, 0.10]
  ].map(([px, py]) => [Math.round(px * size), Math.round(py * size)]);

  // Remplir le polygone éclair en blanc
  for (let y = 0; y < size; y++) {
    let inside = false;
    let intersections: number[] = [];
    for (let i = 0; i < bolt.length - 1; i++) {
      const [x1, y1] = bolt[i];
      const [x2, y2] = bolt[i + 1];
      if ((y1 <= y && y < y2) || (y2 <= y && y < y1)) {
        const xi = x1 + (y - y1) * (x2 - x1) / (y2 - y1);
        intersections.push(xi);
      }
    }
    intersections.sort((a, b) => a - b);
    for (let i = 0; i < intersections.length - 1; i += 2) {
      const xStart = Math.round(intersections[i]);
      const xEnd = Math.round(intersections[i + 1]);
      for (let x = xStart; x <= xEnd; x++) {
        if (x >= 0 && x < size) {
          const idx = (y * size + x) * 4;
          pixels[idx]   = 255;
          pixels[idx+1] = 255;
          pixels[idx+2] = 255;
          pixels[idx+3] = 255;
        }
      }
    }
  }

  // Encoder en PNG
  // PNG signature
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR: width, height, bit depth, color type (2=RGB, 6=RGBA)
  const ihdr = new Uint8Array(13);
  ihdr.set(u32be(size), 0);
  ihdr.set(u32be(size), 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // Raw image data (ajouter filtre 0 au début de chaque ligne)
  const rawData = new Uint8Array(size * (1 + size * 4));
  for (let y = 0; y < size; y++) {
    rawData[y * (1 + size * 4)] = 0; // filtre None
    rawData.set(pixels.slice(y * size * 4, (y + 1) * size * 4), y * (1 + size * 4) + 1);
  }

  const compressed = deflateSync(rawData);
  const idat = new Uint8Array(compressed);
  const iend = new Uint8Array(0);

  const chunks = [
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', iend),
  ];

  const totalLen = signature.length + chunks.reduce((s, c) => s + c.length, 0);
  const png = new Uint8Array(totalLen);
  let offset = 0;
  png.set(signature, offset); offset += signature.length;
  for (const chunk of chunks) { png.set(chunk, offset); offset += chunk.length; }

  writeFileSync(`${outDir}/icon-${size}.png`, png);
  console.log(`✓ icon-${size}.png (${size}x${size})`);
}

generateIcon(192);
generateIcon(512);
console.log('Icônes PWA générées dans', outDir);
