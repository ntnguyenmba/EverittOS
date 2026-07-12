import { writeFileSync, mkdirSync } from 'node:fs';
import { PNG } from 'pngjs';

const BRAND = { r: 36, g: 48, b: 43, a: 255 };
const MASKABLE_BG = { r: 247, g: 246, b: 243, a: 255 };

function writeSolidPng(path, size, color) {
  const png = new PNG({ width: size, height: size });
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const idx = (size * y + x) << 2;
      png.data[idx] = color.r;
      png.data[idx + 1] = color.g;
      png.data[idx + 2] = color.b;
      png.data[idx + 3] = color.a;
    }
  }
  writeFileSync(path, PNG.sync.write(png));
}

mkdirSync('public', { recursive: true });
writeSolidPng('public/icon.png', 512, BRAND);
writeSolidPng('public/icon-maskable.png', 512, MASKABLE_BG);
writeSolidPng('public/apple-icon.png', 180, BRAND);
console.log('Generated theme-color PWA placeholders (replace with approved logo artwork before store submission).');
