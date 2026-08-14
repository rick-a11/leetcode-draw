import { readFile } from "node:fs/promises";
import path from "node:path";

const preloadPath = path.join(process.cwd(), "dist-electron", "preload.cjs");
const preload = await readFile(preloadPath, "utf8");

if (!preload.includes("contextBridge.exposeInMainWorld(\"leetcodeDraw\"")) {
  throw new Error("Packaged preload must expose the LeetCode Draw bridge.");
}

if (/^import\s/m.test(preload)) {
  throw new Error("Sandboxed Electron preload must compile to CommonJS, not an ES module.");
}
