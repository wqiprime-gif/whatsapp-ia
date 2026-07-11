/** Ícone squircle azul OnlyChat (bolha + 3 pontos) — PWA e notificações. */
export function whatsappAppIconSvg(size = 48, className = "wa-app-icon", idSuffix = "wa") {
  const s = idSuffix.replace(/[^a-zA-Z0-9]/g, "");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="${size}" height="${size}" class="${className}" role="img" aria-label="OnlyChat">
  <defs>
    <linearGradient id="oc-sq-${s}" x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#4db8ff"/>
      <stop offset="45%" stop-color="#2478f5"/>
      <stop offset="100%" stop-color="#0b3f9c"/>
    </linearGradient>
    <filter id="oc-sh-${s}" x="-8%" y="-6%" width="116%" height="120%">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#0a2f7a" flood-opacity="0.45"/>
    </filter>
  </defs>
  <g filter="url(#oc-sh-${s})">
    <rect x="3" y="3" width="42" height="42" rx="11" fill="url(#oc-sq-${s})"/>
    <path fill="#fff" fill-opacity="0.96" d="M24 12c-7.4 0-13.2 5.2-13.2 11.8 0 4.1 2.3 7.7 5.8 9.8l-1.5 5.4 5.8-3.4c1 .3 2 .4 3.1.4 7.4 0 13.2-5.2 13.2-11.8S31.4 12 24 12z"/>
    <circle cx="18.2" cy="23.6" r="2.1" fill="#1a56c4"/>
    <circle cx="24" cy="23.6" r="2.1" fill="#1a56c4"/>
    <circle cx="29.8" cy="23.6" r="2.1" fill="#1a56c4"/>
  </g>
</svg>`;
}

/** PNG do ícone OnlyChat (bolha + 3 pontos) — usado em PWA e notificação. */
export async function renderWhatsappAppIconPng(size: number): Promise<Buffer> {
  const { createCanvas } = await import("@napi-rs/canvas");
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");

  const pad = size * 0.0625;
  const r = size * 0.22;
  const grd = ctx.createLinearGradient(0, 0, size, size);
  grd.addColorStop(0, "#4db8ff");
  grd.addColorStop(0.5, "#2478f5");
  grd.addColorStop(1, "#0b3f9c");
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.roundRect(pad, pad, size - pad * 2, size - pad * 2, r);
  ctx.fill();

  // Bolha branca
  const cx = size * 0.5;
  const cy = size * 0.46;
  const brx = size * 0.28;
  const bry = size * 0.24;
  ctx.fillStyle = "rgba(255,255,255,0.96)";
  ctx.beginPath();
  ctx.ellipse(cx, cy, brx, bry, 0, 0, Math.PI * 2);
  ctx.fill();
  // Cauda da bolha
  ctx.beginPath();
  ctx.moveTo(cx - brx * 0.35, cy + bry * 0.55);
  ctx.lineTo(cx - brx * 0.7, cy + bry * 1.55);
  ctx.lineTo(cx + brx * 0.05, cy + bry * 0.75);
  ctx.closePath();
  ctx.fill();

  // 3 pontos
  const dotR = size * 0.045;
  const dy = cy + size * 0.01;
  ctx.fillStyle = "#1a56c4";
  for (const dx of [-size * 0.12, 0, size * 0.12]) {
    ctx.beginPath();
    ctx.arc(cx + dx, dy, dotR, 0, Math.PI * 2);
    ctx.fill();
  }

  return canvas.toBuffer("image/png");
}
