import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "public", "brand");
mkdirSync(outDir, { recursive: true });

const candidates = [
  path.join(outDir, "logonova.png"),
  path.join(root, "public", "brand", "x1black-ghost.png"),
  path.join(root, "..", "logonova.png")
];
const source = candidates.find((p) => existsSync(p));

if (!source) {
  console.warn("[pwa] logonova.png não encontrado — mantendo ícones existentes");
  process.exit(0);
}

const { createCanvas, loadImage } = await import("@napi-rs/canvas");
const img = await loadImage(source);

async function writeSized(size: number, name: string) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, size, size);

  const pad = size * 0.08;
  const side = size - pad * 2;
  const scale = Math.min(side / img.width, side / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  const x = (size - w) / 2;
  const y = (size - h) / 2;
  ctx.drawImage(img, x, y, w, h);

  const file = path.join(outDir, name);
  const buf = canvas.toBuffer("image/png");
  writeFileSync(file, buf);
  console.log(`[pwa] ${file} (${buf.length} bytes)`);
}

for (const size of [32, 192, 512] as const) {
  const name = size === 32 ? "favicon-32.png" : `pwa-${size}.png`;
  await writeSized(size, name);
}
