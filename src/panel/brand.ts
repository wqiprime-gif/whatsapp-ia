import { escapeHtml } from "./layout.js";
import { brandFaviconDataUri, brandIconSvgHtml } from "./brand-icon.js";

export const BRAND_LOGO_SRC = "/brand/onlychat.svg";
export const BRAND_ICON_PNG = "/brand/onlychat.png";

const faviconData = brandFaviconDataUri();

export const FAVICON_LINK = `<link rel="icon" href="${faviconData}" type="image/svg+xml" />
<link rel="icon" href="${BRAND_ICON_PNG}" type="image/png" sizes="32x32" />
<link rel="apple-touch-icon" href="${BRAND_ICON_PNG}" />`;

export const SUPPORT_WHATSAPP_URL = "https://wa.me/5511913748602";

/** Ícone OnlyChat — SVG inline, fundo transparente. */
export function brandIconHtml(className = "brand-icon", size = 40) {
  return brandIconSvgHtml(className, size);
}

/** Wordmark tipográfico OnlyChat. */
export function brandWordmarkHtml(className = "brand-wordmark") {
  return `<span class="${className}">Only<span class="brand-wordmark-accent">Chat</span></span>`;
}

/** Lockup estilo SharkBot: ícone + ONLYCHAT em caixa alta. */
export function brandLockupHtml(variant: "sidebar" | "login" | "mobile" | "drawer" = "sidebar", subtitle = "") {
  const sizes = { sidebar: 42, login: 48, mobile: 36, drawer: 40 };
  const size = sizes[variant];
  return `<div class="brand-lockup brand-lockup--${variant}">
    ${brandIconHtml("brand-icon", size)}
    <div class="brand-lockup-copy">
      <span class="brand-lockup-text">ONLY<span class="brand-lockup-accent">CHAT</span></span>
      ${subtitle ? `<span class="brand-sub">${escapeHtml(subtitle)}</span>` : ""}
    </div>
  </div>`;
}

/** Marca na sidebar — ícone + texto radical. */
export function brandMarkHtml(subtitle = "") {
  return brandLockupHtml("sidebar", subtitle);
}
