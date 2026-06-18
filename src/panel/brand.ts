import { escapeHtml } from "./layout.js";

export const BRAND_LOGO_SRC = "/brand/whatsapp-logo.svg";

export const FAVICON_LINK = `<link rel="icon" href="${BRAND_LOGO_SRC}" type="image/svg+xml" />`;

/** Logo WhatsApp + ZapManager na sidebar. */
export function brandMarkHtml(subtitle = "") {
  return `<div class="brand-mark">
    <img class="brand-logo" src="${BRAND_LOGO_SRC}" alt="WhatsApp" width="44" height="44" />
    <div class="brand-copy">
      <span class="brand-title"><span class="brand-accent">Zap</span>Manager</span>
      ${subtitle ? `<span class="brand-sub">${escapeHtml(subtitle)}</span>` : ""}
    </div>
  </div>`;
}
