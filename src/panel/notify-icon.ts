import { GHOST_BODY, GHOST_EYE_LEFT, GHOST_EYE_RIGHT, GOLD_GRADIENT_STOPS } from "./brand-icon.js";

/** Favicon — fantasma dourado sem caixa preta (igual aba do Instablack). */
export function x1BlackFaviconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" fill="none">
  <defs>
    <linearGradient id="x1-fav-gold" x1="60" y1="12" x2="60" y2="108" gradientUnits="userSpaceOnUse">
${GOLD_GRADIENT_STOPS}
    </linearGradient>
    <filter id="x1-fav-glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.8" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <g filter="url(#x1-fav-glow)" transform="translate(60 60) scale(0.92) translate(-60 -60)">
    <path fill="url(#x1-fav-gold)" d="${GHOST_BODY}"/>
    <path fill="#1a1200" d="${GHOST_EYE_LEFT}"/>
    <path fill="#1a1200" d="${GHOST_EYE_RIGHT}"/>
  </g>
</svg>`;
}
