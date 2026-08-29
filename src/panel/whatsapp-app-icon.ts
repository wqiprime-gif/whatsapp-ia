/** Coordenadas da aranha X1 BLACK num canvas 120x120 — usadas no SVG e no PNG. */
const SPIDER_LEGS = [
  "M51 47 30 23l-4-16",
  "M49 56 19 42 7 31",
  "M49 66 19 68 5 64",
  "M51 74 28 88l-8 17",
  "M69 47 90 23l4-16",
  "M71 56l30-14 12-11",
  "M71 66l30 2 14-4",
  "M69 74l23 14 8 17"
] as const;

const SPIDER_HEAD = "M60 31c4.2 0 7.3 3.1 7.3 7.1 0 3.9-3.1 7.1-7.3 7.1s-7.3-3.2-7.3-7.1c0-4 3.1-7.1 7.3-7.1Z";
const SPIDER_ABDOMEN =
  "M60 46c6.6 0 11.2 6.2 11.2 15 0 9.4-4.4 19.6-11.2 27-6.8-7.4-11.2-17.6-11.2-27C48.8 52.2 53.4 46 60 46Z";
const SPIDER_WEB = ["M12 62a48 48 0 0 1 96 0", "M25 64a35 35 0 0 1 70 0"] as const;

/** A aranha ocupa a caixa 120 inteira; no squircle ela recua para não encostar na borda. */
const ICON_SPIDER_SCALE = 0.8;

/** Ícone squircle preto com aranha branca — PWA e notificações. */
export function x1BlackAppIconSvg(size = 48, className = "x1-app-icon", idSuffix = "x1") {
  const s = idSuffix.replace(/[^a-zA-Z0-9]/g, "");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="${size}" height="${size}" class="${className}" role="img" aria-label="X1 BLACK">
  <defs>
    <clipPath id="x1-sq-${s}"><rect x="6" y="6" width="108" height="108" rx="28"/></clipPath>
  </defs>
  <rect x="6" y="6" width="108" height="108" rx="28" fill="#000000"/>
  <g clip-path="url(#x1-sq-${s})" transform="translate(60 60) scale(${ICON_SPIDER_SCALE}) translate(-60 -60)">
    <g stroke="#ffffff" stroke-opacity="0.26" stroke-width="2.5" fill="none" stroke-linecap="round">
      ${SPIDER_WEB.map((d) => `<path d="${d}"/>`).join("\n      ")}
    </g>
    <g stroke="#ffffff" stroke-width="6.4" stroke-linecap="round" stroke-linejoin="round" fill="none">
      ${SPIDER_LEGS.map((d) => `<path d="${d}"/>`).join("\n      ")}
    </g>
    <path fill="#ffffff" d="${SPIDER_HEAD}"/>
    <path fill="#ffffff" d="${SPIDER_ABDOMEN}"/>
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

  const scale = (size / 120) * ICON_SPIDER_SCALE;
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.scale(scale, scale);
  ctx.translate(-60, -60);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.26)";
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  for (const d of SPIDER_WEB) ctx.stroke(new Path2D(d));

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 6.4;
  ctx.lineJoin = "round";
  for (const d of SPIDER_LEGS) ctx.stroke(new Path2D(d));

  ctx.fillStyle = "#ffffff";
  ctx.fill(new Path2D(SPIDER_HEAD));
  ctx.fill(new Path2D(SPIDER_ABDOMEN));

  ctx.restore();
  return canvas.toBuffer("image/png");
}
