import { escapeHtml } from "./layout.js";
import { brandIconSvgHtml } from "./brand-icon.js";

export const BRAND_NAME = "X1 BLACK";
export const BRAND_TAGLINE = "AUTOMATION CONTROL CENTER";

export const BRAND_LOGO_SRC = "/brand/logonova.png";
export const BRAND_ICON_PNG = "/brand/pwa-192.png";
export const BRAND_FAVICON_PNG = "/brand/favicon-32.png";

/** Sobe junto com a troca de logo para furar cache de favicon e PWA. */
export const BRAND_ASSET_VERSION = "1.35.2";

export const FAVICON_LINK = `<link rel="icon" href="/brand/favicon-32.png?v=${BRAND_ASSET_VERSION}" type="image/png" sizes="32x32" />
<link rel="icon" href="/brand/logonova.png?v=${BRAND_ASSET_VERSION}" type="image/png" />
<link rel="apple-touch-icon" href="/brand/pwa-192.png?v=${BRAND_ASSET_VERSION}" />`;

export const SUPPORT_WHATSAPP_URL = "https://wa.me/5511913748602";

/** Mark X1 BLACK — render metalico do fantasma. A rota cai no SVG inline
 *  quando o PNG nao existe, entao a imagem nunca fica quebrada. */
export function brandIconHtml(className = "brand-icon", size = 40) {
  return `<img src="${BRAND_LOGO_SRC}?v=${BRAND_ASSET_VERSION}" alt="" aria-hidden="true" width="${size}" height="${size}" class="${className}" decoding="async" />`;
}

/** Versao inline em SVG — para onde nao da para usar <img>. */
export const brandIconInlineHtml = brandIconSvgHtml;

/** Wordmark tipográfico X1 BLACK. */
export function brandWordmarkHtml(className = "brand-wordmark") {
  return `<span class="${className}">X1<span class="brand-wordmark-accent"> BLACK</span></span>`;
}

/** Lockup: fantasma + X1 BLACK (texto aparece com sidebar expandida). */
export function brandLockupHtml(
  variant: "sidebar" | "login" | "mobile" | "drawer" = "sidebar",
  subtitle = BRAND_TAGLINE
) {
  const sizes = { sidebar: 48, login: 88, mobile: 40, drawer: 44 };
  const size = sizes[variant];
  return `<div class="brand-lockup brand-lockup--${variant}">
    ${brandIconHtml("brand-icon", size)}
    <div class="brand-lockup-copy">
      <span class="brand-lockup-text">X1<span class="brand-lockup-accent"> BLACK</span></span>
      ${subtitle ? `<span class="brand-sub">${escapeHtml(subtitle)}</span>` : ""}
    </div>
  </div>`;
}

/** Marca na sidebar — fantasma + wordmark numa linha, sem subtitulo. */
export function brandMarkHtml(subtitle = "") {
  return brandLockupHtml("sidebar", subtitle);
}
