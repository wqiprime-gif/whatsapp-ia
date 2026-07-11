import { escapeHtml } from "./layout.js";
import { brandIconSvgHtml } from "./brand-icon.js";

export const BRAND_LOGO_SRC = "/brand/onlychat.svg";
export const BRAND_ICON_PNG = "/brand/pwa-192.png";
export const BRAND_FAVICON_SVG = "/brand/favicon.svg";

export const FAVICON_LINK = `<link rel="icon" href="/brand/favicon.svg" type="image/svg+xml" />
<link rel="icon" href="/brand/pwa-192.png?v=1.24.14" type="image/png" sizes="192x192" />
<link rel="apple-touch-icon" href="/brand/pwa-192.png?v=1.24.14" />`;

export const SUPPORT_WHATSAPP_URL = "https://wa.me/5511913748602";

/** Ícone OnlyChat — bolha azul SVG inline. */
export function brandIconHtml(className = "brand-icon", size = 40) {
  return brandIconSvgHtml(className, size);
}

/** Wordmark tipográfico OnlyChat. */
export function brandWordmarkHtml(className = "brand-wordmark") {
  return `<span class="${className}">Only<span class="brand-wordmark-accent">Chat</span></span>`;
}

/** Lockup: ícone azul + ONLYCHAT (texto aparece com sidebar expandida). */
export function brandLockupHtml(
  variant: "sidebar" | "login" | "mobile" | "drawer" = "sidebar",
  subtitle = ""
) {
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

/** Marca na sidebar — ícone azul OnlyChat + wordmark. */
export function brandMarkHtml(subtitle = "") {
  return brandLockupHtml("sidebar", subtitle);
}
