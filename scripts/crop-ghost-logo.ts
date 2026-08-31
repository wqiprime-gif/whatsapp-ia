/** Recorta o render do fantasma no seu bounding box e grava um PNG quadrado.
 *  O arquivo original vem em retrato com muita margem preta, o que deixaria a
 *  logo minuscula dentro de um icone de 30px ou do squircle do PWA.
 *
 *  Uso: npx tsx scripts/crop-ghost-logo.ts <entrada> <saida> */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";

const [, , inArg, outArg] = process.argv;
const input = path.resolve(inArg ?? "public/brand/x1black-ghost.png");
const output = path.resolve(outArg ?? "public/brand/x1black-ghost.png");

/** Acima disso o pixel conta como parte da logo (fundo e quase preto). */
const LUMA_THRESHOLD = 26;
/** Respiro em volta, como fracao do lado maior do recorte. */
const PADDING_RATIO = 0.06;

const img = await loadImage(input);
const probe = createCanvas(img.width, img.height);
const pctx = probe.getContext("2d");
pctx.drawImage(img, 0, 0);
const { data } = pctx.getImageData(0, 0, img.width, img.height);

let minX = img.width;
let minY = img.height;
let maxX = -1;
let maxY = -1;

for (let y = 0; y < img.height; y += 1) {
  for (let x = 0; x < img.width; x += 1) {
    const i = (y * img.width + x) * 4;
    const luma = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    if (luma < LUMA_THRESHOLD || data[i + 3] < 8) continue;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
}

if (maxX < 0) throw new Error("nada acima do threshold: a imagem parece toda preta");

const w = maxX - minX + 1;
const h = maxY - minY + 1;
const side = Math.round(Math.max(w, h) * (1 + PADDING_RATIO * 2));

const out = createCanvas(side, side);
const ctx = out.getContext("2d");
ctx.drawImage(img, minX, minY, w, h, (side - w) / 2, (side - h) / 2, w, h);

// Fundo preto vira transparente: sem isso a logo aparece como uma caixa
// escura quando fica pequena sobre a sidebar, que nao e preto puro.
const ALPHA_LO = 10;
const ALPHA_HI = 62;
const frame = ctx.getImageData(0, 0, side, side);
for (let i = 0; i < frame.data.length; i += 4) {
  const luma =
    0.2126 * frame.data[i] + 0.7152 * frame.data[i + 1] + 0.0722 * frame.data[i + 2];
  const t = (luma - ALPHA_LO) / (ALPHA_HI - ALPHA_LO);
  frame.data[i + 3] = Math.round(Math.min(1, Math.max(0, t)) * 255);
}
ctx.putImageData(frame, 0, 0);

writeFileSync(output, out.toBuffer("image/png"));
console.log(
  `[crop] ${img.width}x${img.height} -> caixa ${w}x${h} em (${minX},${minY}) -> ${side}x${side}`
);
console.log(`[crop] gravado em ${output}`);
