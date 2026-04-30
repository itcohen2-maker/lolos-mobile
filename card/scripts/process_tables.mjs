import sharp from 'sharp';

const srcDir = 'C:/Users/asus/.cursor/projects/c-Users-asus-bmad-card/assets';
const destDir = 'C:/Users/asus/bmad/card/assets';

const tables = [
  {
    src: `${srcDir}/c__Users_asus_AppData_Roaming_Cursor_User_workspaceStorage_21efa850dddde0d32cbc0b558184a7a1_images____-d0e58b0d-5854-4582-a22c-9d9d674dfcaf.png`,
    dest: `${destDir}/table_golden_nobg.png`,
    name: 'Golden Table'
  },
  {
    src: `${srcDir}/c__Users_asus_AppData_Roaming_Cursor_User_workspaceStorage_21efa850dddde0d32cbc0b558184a7a1_images_____-736365d8-7aea-4d43-a154-e2806750d87d.png`,
    dest: `${destDir}/table_royal_nobg.png`,
    name: 'Royal Red Table'
  },
  {
    src: `${srcDir}/c__Users_asus_AppData_Roaming_Cursor_User_workspaceStorage_21efa850dddde0d32cbc0b558184a7a1_images_____-5cc7d83c-a91a-46c7-ab34-3fcdd1af76eb.png`,
    dest: `${destDir}/table_ocean_nobg.png`,
    name: 'Ocean Blue Table'
  }
];

function isBackgroundPixel(r, g, b) {
  // Checkered pattern: white (255,255,255) and light gray (~204,204,204)
  // Both are neutral (R≈G≈B) and bright
  const isNeutral = Math.abs(r - g) < 25 && Math.abs(g - b) < 25 && Math.abs(r - b) < 25;
  return isNeutral && r > 170;
}

function floodFillBackground(pixels, width, height) {
  const visited = new Uint8Array(width * height);
  const transparent = new Uint8Array(width * height);
  const queue = [];

  // Seed from all 4 edges
  for (let x = 0; x < width; x++) {
    queue.push(x, 0);
    queue.push(x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    queue.push(0, y);
    queue.push(width - 1, y);
  }

  let i = 0;
  while (i < queue.length) {
    const x = queue[i++];
    const y = queue[i++];
    const idx = y * width + x;

    if (visited[idx]) continue;
    visited[idx] = 1;

    const px = idx * 3;
    const r = pixels[px], g = pixels[px + 1], b = pixels[px + 2];

    if (!isBackgroundPixel(r, g, b)) continue;

    transparent[idx] = 1;

    if (x > 0)         queue.push(x - 1, y);
    if (x < width - 1) queue.push(x + 1, y);
    if (y > 0)         queue.push(x, y - 1);
    if (y < height - 1) queue.push(x, y + 1);
  }

  return transparent;
}

for (const table of tables) {
  console.log(`Processing: ${table.name}...`);

  const { data, info } = await sharp(table.src)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const pixels = new Uint8Array(data);

  // Flood-fill background from edges
  const transparent = floodFillBackground(pixels, width, height);

  // Build RGBA output with soft edges (partial alpha for near-background border pixels)
  const output = new Uint8Array(width * height * 4);
  for (let idx = 0; idx < width * height; idx++) {
    const r = pixels[idx * 3];
    const g = pixels[idx * 3 + 1];
    const b = pixels[idx * 3 + 2];
    output[idx * 4]     = r;
    output[idx * 4 + 1] = g;
    output[idx * 4 + 2] = b;
    output[idx * 4 + 3] = transparent[idx] ? 0 : 255;
  }

  await sharp(output, {
    raw: { width, height, channels: 4 }
  })
    .png({ compressionLevel: 9 })
    .toFile(table.dest);

  console.log(`  -> Saved: ${table.dest}`);
}

console.log('\nDone! 3 table PNGs with transparent backgrounds saved to assets/');
