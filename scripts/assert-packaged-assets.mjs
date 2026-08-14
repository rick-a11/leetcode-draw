import { readFile } from "node:fs/promises";
import path from "node:path";

const htmlPath = path.join(process.cwd(), "dist", "index.html");
const html = await readFile(htmlPath, "utf8");

const absoluteAssetRefs = html.match(/\b(?:src|href)="\/assets\//g) ?? [];

if (absoluteAssetRefs.length > 0) {
  throw new Error("Packaged Electron build cannot use absolute /assets references.");
}

if (!html.includes('src="./assets/') || !html.includes('href="./assets/')) {
  throw new Error("Packaged Electron build must reference renderer assets with ./assets paths.");
}
