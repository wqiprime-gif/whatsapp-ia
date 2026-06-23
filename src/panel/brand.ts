import { escapeHtml } from "./layout.js";

export const BRAND_LOGO_SRC = "/brand/onlychat.svg";

export const FAVICON_LINK = `<link rel="icon" href="${BRAND_LOGO_SRC}" type="image/svg+xml" />`;

export const SUPPORT_WHATSAPP_URL = "https://wa.me/5511913748602";

/** Wordmark tipográfico OnlyChat (sem imagem). */
export function brandWordmarkHtml(className = "brand-wordmark") {
  return `<span class="${className}">Only<span class="brand-wordmark-accent">Chat</span></span>`;
}

/** Marca na sidebar — só texto radical. */
export function brandMarkHtml(subtitle = "") {
  return `<div class="brand-mark brand-mark--text">
    ${brandWordmarkHtml()}
    ${subtitle ? `<span class="brand-sub">${escapeHtml(subtitle)}</span>` : ""}
  </div>`;
}
