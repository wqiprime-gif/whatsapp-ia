/** Ícone estilo app (squircle verde WhatsApp) — PWA e sidebar. */
export function whatsappAppIconSvg(size = 48, className = "wa-app-icon", idSuffix = "wa") {
  const s = idSuffix.replace(/[^a-zA-Z0-9]/g, "");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="${size}" height="${size}" class="${className}" role="img" aria-label="OnlyChat WhatsApp">
  <defs>
    <linearGradient id="wa-sq-${s}" x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#3ef07a"/>
      <stop offset="45%" stop-color="#25D366"/>
      <stop offset="100%" stop-color="#128C7E"/>
    </linearGradient>
    <filter id="wa-sh-${s}" x="-8%" y="-6%" width="116%" height="120%">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#064e3b" flood-opacity="0.45"/>
    </filter>
  </defs>
  <g filter="url(#wa-sh-${s})">
    <rect x="3" y="3" width="42" height="42" rx="11" fill="url(#wa-sq-${s})"/>
    <path fill="#fff" d="M33.8 14.2c-2.4-2.4-5.6-3.7-9-3.7-7 0-12.7 5.7-12.7 12.7 0 2.2.6 4.4 1.7 6.3L9.5 35.5l6.5-1.7c1.8.8 3.8 1.3 5.9 1.3h.1c7 0 12.7-5.7 12.7-12.7 0-3.4-1.3-6.6-3.7-9.1zm-9 19.6h-.1c-1.8 0-3.7-.5-5.2-1.4l-.4-.2-3.9 1 1-3.8-.3-.4c-1-1.6-1.6-3.4-1.6-5.3 0-5.5 4.5-10 10-10 2.7 0 5.2 1 7.2 2.9 2 2 3.1 4.5 3.1 7.2 0 5.5-4.5 10-10 10zm5.5-7.4c-.3-.2-1.8-.9-2.1-1-.3-.1-.5-.1-.7.1-.2.2-.8 1-1 1.2-.2.2-.4.2-.6.1-.3-.2-1.2-.4-2.2-1.4-.8-.7-1.4-1.6-1.6-1.9-.2-.3 0-.5.1-.6.1-.1.3-.3.4-.5.1-.1.1-.3.2-.4.1-.2 0-.3 0-.4 0-.1-.6-1.5-.9-2.1-.3-.5-.5-.5-.7-.5h-.5c-.2 0-.5.1-.7.3-.2.2-.8.8-.8 1.9s.8 2.3.9 2.4c.1.2 1.6 2.5 4 3.5.6.3 1 .4 1.4.5.5.2 1.1.2 1.5.1.4-.1 1.4-.5 1.6-1.1.2-.5.2-1 .1-1.1-.1-.1-.3-.2-.5-.3z"/>
  </g>
</svg>`;
}

export async function renderWhatsappAppIconPng(size: number): Promise<Buffer> {
  const { createCanvas, Path2D } = await import("@napi-rs/canvas");
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");

  const r = size * 0.22;
  const pad = size * 0.0625;
  const grd = ctx.createLinearGradient(0, 0, size, size);
  grd.addColorStop(0, "#3ef07a");
  grd.addColorStop(0.5, "#25D366");
  grd.addColorStop(1, "#128C7E");
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
      "M33.8 14.2c-2.4-2.4-5.6-3.7-9-3.7-7 0-12.7 5.7-12.7 12.7 0 2.2.6 4.4 1.7 6.3L9.5 35.5l6.5-1.7c1.8.8 3.8 1.3 5.9 1.3h.1c7 0 12.7-5.7 12.7-12.7 0-3.4-1.3-6.6-3.7-9.1zm-9 19.6h-.1c-1.8 0-3.7-.5-5.2-1.4l-.4-.2-3.9 1 1-3.8-.3-.4c-1-1.6-1.6-3.4-1.6-5.3 0-5.5 4.5-10 10-10 2.7 0 5.2 1 7.2 2.9 2 2 3.1 4.5 3.1 7.2 0 5.5-4.5 10-10 10zm5.5-7.4c-.3-.2-1.8-.9-2.1-1-.3-.1-.5-.1-.7.1-.2.2-.8 1-1 1.2-.2.2-.4.2-.6.1-.3-.2-1.2-.4-2.2-1.4-.8-.7-1.4-1.6-1.6-1.9-.2-.3 0-.5.1-.6.1-.1.3-.3.4-.5.1-.1.1-.3.2-.4.1-.2 0-.3 0-.4 0-.1-.6-1.5-.9-2.1-.3-.5-.5-.5-.7-.5h-.5c-.2 0-.5.1-.7.3-.2.2-.8.8-.8 1.9s.8 2.3.9 2.4c.1.2 1.6 2.5 4 3.5.6.3 1 .4 1.4.5.5.2 1.1.2 1.5.1.4-.1 1.4-.5 1.6-1.1.2-.5.2-1 .1-1.1-.1-.1-.3-.2-.5-.3z"
    )
  );
  ctx.restore();

  return canvas.toBuffer("image/png");
}

/** Botão squircle para sidebar (estilo Instagram do print). */
export function sidebarWhatsappAppButtonHtml() {
  return `<a href="/" class="sidebar-app-btn sidebar-app-btn--wa" data-nav title="OnlyChat WhatsApp">
    ${whatsappAppIconSvg(40)}
    <span class="sidebar-app-label">OnlyChat</span>
  </a>`;
}
