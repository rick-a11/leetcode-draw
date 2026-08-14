import { writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const resources = path.join(root, "resources");
const iconSvg = path.join(resources, "icon.svg");
const png = path.join(resources, "icon.png");
const icns = path.join(resources, "icon.icns");

const sizes = [
  [16, "icp4"],
  [32, "icp5"],
  [64, "icp6"],
  [128, "ic07"],
  [256, "ic08"],
  [512, "ic09"],
  [1024, "ic10"]
];

await sharp(iconSvg).resize(1024, 1024).png().toFile(png);

const chunks = await Promise.all(
  sizes.map(async ([size, type]) => {
    const image = await sharp(iconSvg).resize(size, size).png().toBuffer();
    const chunk = Buffer.alloc(8 + image.length);
    chunk.write(type, 0, 4, "ascii");
    chunk.writeUInt32BE(chunk.length, 4);
    image.copy(chunk, 8);
    return chunk;
  })
);

const totalLength = 8 + chunks.reduce((sum, chunk) => sum + chunk.length, 0);
const header = Buffer.alloc(8);
header.write("icns", 0, 4, "ascii");
header.writeUInt32BE(totalLength, 4);

await writeFile(icns, Buffer.concat([header, ...chunks], totalLength));
