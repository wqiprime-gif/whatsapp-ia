import { GHOST_BODY, GHOST_EYE_LEFT, GHOST_EYE_RIGHT } from "./brand-icon.js";

/** Favicon + ícone de notificação — fantasma X1 BLACK (branco sobre preto).
 *  A silhueta vem em caixa 120; aqui ela recua um pouco para não encostar
 *  nas bordas do squircle. */
export function x1BlackFaviconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" fill="none">
  <rect width="120" height="120" rx="26" fill="#000000"/>
  <g transform="translate(60 60) scale(0.86) translate(-60 -60)">
    <path fill="#ffffff" d="${GHOST_BODY}"/>
    <path fill="#000000" d="${GHOST_EYE_LEFT}"/>
    <path fill="#000000" d="${GHOST_EYE_RIGHT}"/>
  </g>
</svg>`;
}
