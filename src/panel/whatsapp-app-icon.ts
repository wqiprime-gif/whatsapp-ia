/** Ícone squircle azul estilo WhatsApp (telefone) — PWA e notificações. */
export function whatsappAppIconSvg(size = 48, className = "wa-app-icon", idSuffix = "wa") {
  const s = idSuffix.replace(/[^a-zA-Z0-9]/g, "");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="${size}" height="${size}" class="${className}" role="img" aria-label="OnlyChat">
  <defs>
    <linearGradient id="oc-sq-${s}" x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#4db8ff"/>
      <stop offset="45%" stop-color="#2478f5"/>
      <stop offset="100%" stop-color="#0b3f9c"/>
    </linearGradient>
  </defs>
  <rect x="3" y="3" width="42" height="42" rx="11" fill="url(#oc-sq-${s})"/>
  <path fill="#fff" fill-opacity="0.95" d="M24 11c-7.2 0-13 5.4-13 12.1 0 2.1.6 4.1 1.6 5.9L10 37l8.2-2.2c1.7.9 3.6 1.4 5.6 1.4h.1c7.2 0 13-5.4 13-12.1S31.2 11 24 11zm-1.2 22.8h-.1c-1.5 0-3-.4-4.3-1.2l-.3-.2-4.9 1.3 1.3-4.8-.2-.3c-.9-1.4-1.4-3-1.4-4.7 0-4.9 4.1-8.9 9.1-8.9 2.4 0 4.7.9 6.4 2.6 1.7 1.7 2.6 4 2.6 6.4 0 4.9-4.1 8.9-9.2 8.9zm4.9-6.6c-.3-.2-1.8-.9-2.1-1-.3-.1-.5-.1-.7.1-.2.2-.8 1-1 1.2-.2.2-.4.2-.6.1-.3-.2-1.2-.4-2.2-1.4-.8-.7-1.4-1.6-1.6-1.9-.2-.3 0-.5.1-.6.1-.1.3-.3.4-.5.1-.1.1-.3.2-.4.1-.2 0-.3 0-.4 0-.1-.6-1.5-.9-2.1-.3-.5-.5-.5-.7-.5h-.5c-.2 0-.5.1-.7.3-.2.2-.8.8-.8 1.9s.8 2.3.9 2.4c.1.2 1.6 2.5 4 3.5.6.3 1 .4 1.4.5.5.2 1.1.2 1.5.1.4-.1 1.4-.5 1.6-1.1.2-.5.2-1 .1-1.1-.1-.1-.3-.2-.5-.3z"/>
</svg>`;
}

/** PNG do ícone WhatsApp azul (telefone) — PWA e notificação. */
export async function renderWhatsappAppIconPng(size: number): Promise<Buffer> {
  const { createCanvas, Path2D } = await import("@napi-rs/canvas");
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");

  const r = size * 0.22;
  const pad = size * 0.0625;
  const grd = ctx.createLinearGradient(0, 0, size, size);
  grd.addColorStop(0, "#4db8ff");
  grd.addColorStop(0.5, "#2478f5");
  grd.addColorStop(1, "#0b3f9c");
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.roundRect(pad, pad, size - pad * 2, size - pad * 2, r);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.save();
  ctx.translate(size * 0.5, size * 0.48);
  ctx.scale(size / 48, size / 48);
  ctx.translate(-24, -24);
  ctx.fill(
    new Path2D(
      "M24 11c-7.2 0-13 5.4-13 12.1 0 2.1.6 4.1 1.6 5.9L10 37l8.2-2.2c1.7.9 3.6 1.4 5.6 1.4h.1c7.2 0 13-5.4 13-12.1S31.2 11 24 11zm-1.2 22.8h-.1c-1.5 0-3-.4-4.3-1.2l-.3-.2-4.9 1.3 1.3-4.8-.2-.3c-.9-1.4-1.4-3-1.4-4.7 0-4.9 4.1-8.9 9.1-8.9 2.4 0 4.7.9 6.4 2.6 1.7 1.7 2.6 4 2.6 6.4 0 4.9-4.1 8.9-9.2 8.9zm4.9-6.6c-.3-.2-1.8-.9-2.1-1-.3-.1-.5-.1-.7.1-.2.2-.8 1-1 1.2-.2.2-.4.2-.6.1-.3-.2-1.2-.4-2.2-1.4-.8-.7-1.4-1.6-1.6-1.9-.2-.3 0-.5.1-.6.1-.1.3-.3.4-.5.1-.1.1-.3.2-.4.1-.2 0-.3 0-.4 0-.1-.6-1.5-.9-2.1-.3-.5-.5-.5-.7-.5h-.5c-.2 0-.5.1-.7.3-.2.2-.8.8-.8 1.9s.8 2.3.9 2.4c.1.2 1.6 2.5 4 3.5.6.3 1 .4 1.4.5.5.2 1.1.2 1.5.1.4-.1 1.4-.5 1.6-1.1.2-.5.2-1 .1-1.1-.1-.1-.3-.2-.5-.3z"
    )
  );
  ctx.restore();

  return canvas.toBuffer("image/png");
}
