import { escapeHtml } from "./layout.js";

export const BRAND_LOGO_SRC = "/brand/onlychat.svg";
export const BRAND_ICON_PNG = "/brand/onlychat.png";

export const FAVICON_LINK = `<link rel="icon" href="${BRAND_ICON_PNG}" type="image/png" sizes="32x32" />
<link rel="icon" href="${BRAND_LOGO_SRC}" type="image/svg+xml" />
<link rel="apple-touch-icon" href="${BRAND_ICON_PNG}" />`;

export const SUPPORT_WHATSAPP_URL = "https://wa.me/5511913748602";

const LOGO_HEIGHT: Record<"sidebar" | "login" | "mobile" | "drawer", number> = {
  sidebar: 40,
  login: 48,
  mobile: 36,
  drawer: 40
};

/** Logo OnlyChat (PNG) — substitui o texto tipográfico. */
export function brandLogoImgHtml(
  variant: "sidebar" | "login" | "mobile" | "drawer" = "sidebar",
  subtitle = ""
) {
  const h = LOGO_HEIGHT[variant];
  return `<div class="brand-lockup brand-lockup--${variant} brand-lockup--png">
    <img src="${BRAND_ICON_PNG}" alt="OnlyChat" class="brand-logo-img" height="${h}" decoding="async" />
    ${subtitle ? `<span class="brand-sub">${escapeHtml(subtitle)}</span>` : ""}
  </div>`;
}

/** @deprecated use brandLogoImgHtml — mantido para compat. */
export function brandWordmarkHtml(className = "brand-wordmark") {
  return brandLogoImgHtml("sidebar");
}

/** Marca completa: sua arte onlychat.png (ícone + nome). */
export function brandLockupHtml(
  variant: "sidebar" | "login" | "mobile" | "drawer" = "sidebar",
  subtitle = ""
) {
  return brandLogoImgHtml(variant, subtitle);
}

export function brandMarkHtml(subtitle = "") {
  return brandLogoImgHtml("sidebar", subtitle);
}
