import { escapeHtml } from "./layout.js";
import { brandIconSvgHtml } from "./brand-icon.js";

export const BRAND_NAME = "X1 BLACK";
export const BRAND_TAGLINE = "AUTOMATION CONTROL CENTER";

export const BRAND_LOGO_SRC = "/brand/x1black-logo.jpg";
export const BRAND_ICON_PNG = "/brand/pwa-192.png";
export const BRAND_FAVICON_SVG = "/brand/favicon.svg";

export const FAVICON_LINK = `<link rel="icon" href="/brand/favicon.svg" type="image/svg+xml" />
<link rel="icon" href="/brand/pwa-192.png?v=1.26.0" type="image/png" sizes="192x192" />
    <link rel="apple-touch-icon" href="/brand/pwa-192.png?v=1.26.0" />`;

export const SUPPORT_WHATSAPP_URL = "https://wa.me/5511913748602";

/** Mark X1 BLACK — aranha SVG inline. */
export function brandIconHtml(className = "brand-icon", size = 40) {
  return brandIconSvgHtml(className, size);
}

/** Wordmark tipográfico X1 BLACK. */
export function brandWordmarkHtml(className = "brand-wordmark") {
  return `<span class="${className}">X1<span class="brand-wordmark-accent"> BLACK</span></span>`;
}

/** Lockup: aranha + X1 BLACK (texto aparece com sidebar expandida). */
export function brandLockupHtml(
  variant: "sidebar" | "login" | "mobile" | "drawer" = "sidebar",
  subtitle = BRAND_TAGLINE
) {
  const sizes = { sidebar: 44, login: 56, mobile: 34, drawer: 40 };
  const size = sizes[variant];
  return `<div class="brand-lockup brand-lockup--${variant}">
    ${brandIconHtml("brand-icon", size)}
    <div class="brand-lockup-copy">
      <span class="brand-lockup-text">X1<span class="brand-lockup-accent"> BLACK</span></span>
      ${subtitle ? `<span class="brand-sub">${escapeHtml(subtitle)}</span>` : ""}
    </div>
  </div>`;
}

/** Marca na sidebar — aranha X1 BLACK + wordmark. */
export function brandMarkHtml(subtitle = BRAND_TAGLINE) {
  return brandLockupHtml("sidebar", subtitle);
}
