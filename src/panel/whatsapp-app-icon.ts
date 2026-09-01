import { GHOST_BODY, GHOST_EYE_LEFT, GHOST_EYE_RIGHT, GOLD_GRADIENT_STOPS } from "./brand-icon.js";

/** O fantasma ocupa a caixa 120; no squircle recua para não encostar na borda. */
const ICON_GHOST_SCALE = 0.82;

/** Ícone squircle preto com fantasma dourado — PWA e notificações. */
export function x1BlackAppIconSvg(size = 48, className = "x1-app-icon", idSuffix = "x1") {
  const s = idSuffix.replace(/[^a-zA-Z0-9]/g, "");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="${size}" height="${size}" class="${className}" role="img" aria-label="X1 BLACK">
  <defs>
    <clipPath id="x1-sq-${s}"><rect x="6" y="6" width="108" height="108" rx="28"/></clipPath>
    <linearGradient id="x1-pwa-gold-${s}" x1="60" y1="12" x2="60" y2="108" gradientUnits="userSpaceOnUse">
${GOLD_GRADIENT_STOPS}
    </linearGradient>
  </defs>
  <rect x="6" y="6" width="108" height="108" rx="28" fill="#000000"/>
  <g clip-path="url(#x1-sq-${s})" transform="translate(60 60) scale(${ICON_GHOST_SCALE}) translate(-60 -60)">
    <path fill="url(#x1-pwa-gold-${s})" d="${GHOST_BODY}"/>
    <path fill="#1a1200" d="${GHOST_EYE_LEFT}"/>
    <path fill="#1a1200" d="${GHOST_EYE_RIGHT}"/>
  </g>
</svg>`;
}

/** PNG do ícone X1 BLACK — PWA e notificação. */
export async function renderX1BlackAppIconPng(size: number): Promise<Buffer> {
  const { createCanvas, Path2D } = await import("@napi-rs/canvas");
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#000000";
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, size * 0.22);
  ctx.fill();

  const scale = (size / 120) * ICON_GHOST_SCALE;
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.scale(scale, scale);
  ctx.translate(-60, -60);

  const grad = ctx.createLinearGradient(60, 12, 60, 108);
  grad.addColorStop(0, "#f8e9b0");
  grad.addColorStop(0.32, "#e8c547");
  grad.addColorStop(0.58, "#d4af37");
  grad.addColorStop(0.82, "#f5c842");
  grad.addColorStop(1, "#a67c00");
  ctx.fillStyle = grad;
  ctx.fill(new Path2D(GHOST_BODY));
  ctx.fillStyle = "#1a1200";
  ctx.fill(new Path2D(GHOST_EYE_LEFT));
  ctx.fill(new Path2D(GHOST_EYE_RIGHT));
  ctx.restore();

  return canvas.toBuffer("image/png");
}
