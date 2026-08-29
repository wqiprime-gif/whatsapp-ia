import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderX1BlackAppIconPng } from "../src/panel/whatsapp-app-icon.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "public", "brand");
mkdirSync(outDir, { recursive: true });

for (const size of [192, 512] as const) {
  const buf = await renderX1BlackAppIconPng(size);
  const file = path.join(outDir, `pwa-${size}.png`);
  writeFileSync(file, buf);
  console.log(`[pwa] ${file} (${buf.length} bytes)`);
}
