import { execFile } from 'node:child_process';
import { mkdir, rm, stat } from 'node:fs/promises';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const svgPath = path.join(__dirname, 'icon.svg');
const png512Path = path.join(__dirname, 'icon.png');
const png1024Path = path.join(__dirname, 'icon-1024.png');
const iconsetPath = path.join(__dirname, 'icon.iconset');
const icnsPath = path.join(__dirname, 'icon.icns');

const iconsetFiles = [
  ['icon_16x16.png', 16],
  ['icon_16x16@2x.png', 32],
  ['icon_32x32.png', 32],
  ['icon_32x32@2x.png', 64],
  ['icon_128x128.png', 128],
  ['icon_128x128@2x.png', 256],
  ['icon_256x256.png', 256],
  ['icon_256x256@2x.png', 512],
  ['icon_512x512.png', 512],
  ['icon_512x512@2x.png', 1024],
];

async function fileSize(filePath) {
  const { size } = await stat(filePath);
  if (size <= 0) {
    throw new Error(`${filePath} exists but is empty`);
  }
  return size;
}

async function run(command, args) {
  await execFileAsync(command, args, { cwd: __dirname });
}

await rm(iconsetPath, { recursive: true, force: true });
await rm(icnsPath, { force: true });
await mkdir(iconsetPath, { recursive: true });

await sharp(svgPath)
  .resize(1024, 1024)
  .png()
  .toFile(png1024Path);

await sharp(svgPath)
  .resize(512, 512)
  .png()
  .toFile(png512Path);

for (const [fileName, size] of iconsetFiles) {
  const outputPath = path.join(iconsetPath, fileName);
  await run('sips', ['-z', String(size), String(size), png1024Path, '--out', outputPath]);
}

await run('iconutil', ['-c', 'icns', '-o', icnsPath, iconsetPath]);

const outputs = [svgPath, png512Path, png1024Path, icnsPath];
for (const output of outputs) {
  const size = await fileSize(output);
  console.log(`${path.basename(output)} ${size} bytes`);
}
