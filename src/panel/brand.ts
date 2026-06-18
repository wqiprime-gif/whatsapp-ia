import { escapeHtml } from "./layout.js";

export const BRAND_LOGO_SRC = "/brand/whatsapp-logo.svg";

export const FAVICON_LINK = `<link rel="icon" href="${BRAND_LOGO_SRC}" type="image/svg+xml" />`;

/** Logo WhatsApp na sidebar (sem texto BotManager). */
export function brandMarkHtml(subtitle = "") {
  return `<div class="brand-mark brand-mark--wa">
    <img class="brand-logo" src="${BRAND_LOGO_SRC}" alt="WhatsApp" width="44" height="44" />
    ${subtitle ? `<span class="brand-sub">${escapeHtml(subtitle)}</span>` : ""}
  </div>`;
}
