/** Silhueta do fantasma X1 BLACK numa caixa 120x120.
 *  Fonte unica das coordenadas: usada no SVG inline, no favicon e no PNG do PWA.
 *  O logo "de verdade" (render metalico) e o /brand/x1black-ghost.png; este
 *  vetor e a versao que sobrevive em 16px e sem arquivo estatico. */
export const GHOST_BODY =
  "M60 15c-19.3 0-33.5 15.2-33.5 35.5V95c0 4.2 4.8 6.4 7.9 3.6l5.1-4.6c2-1.8 5-1.7 6.9.2l4.6 4.6c2 2 5.2 2 7.2 0l4.6-4.6c1.9-1.9 4.9-2 6.9-.2l5.1 4.6c3.1 2.8 7.9.6 7.9-3.6V50.5C93.5 30.2 79.3 15 60 15Z";

/** Olhos: duas gotas espelhadas que se encontram no centro. */
export const GHOST_EYE_LEFT =
  "M60 55C52 43 38 38 32 43c-5 4.5 2 12 12 15.5 6 2 12 .5 16-3.5Z";
export const GHOST_EYE_RIGHT =
  "M60 55C68 43 82 38 88 43c5 4.5-2 12-12 15.5-6 2-12 .5-16-3.5Z";

/** Mark X1 BLACK — fantasma branco/preto inline (sem depender de /brand/). */
export function x1GhostSvg(size: number, className = "brand-icon", idSuffix = "a") {
  const s = idSuffix.replace(/[^a-zA-Z0-9]/g, "");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" fill="none" class="${className}" width="${size}" height="${size}" role="img" aria-hidden="true">
  <defs>
    <linearGradient id="x1-metal-${s}" x1="60" y1="15" x2="60" y2="104" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="48%" stop-color="#dcdcdc"/>
      <stop offset="100%" stop-color="#8f8f8f"/>
    </linearGradient>
    <filter id="x1-glow-${s}" x="-25%" y="-25%" width="150%" height="150%">
      <feGaussianBlur stdDeviation="1.6" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <g filter="url(#x1-glow-${s})">
    <path fill="url(#x1-metal-${s})" d="${GHOST_BODY}"/>
    <path fill="#000000" d="${GHOST_EYE_LEFT}"/>
    <path fill="#000000" d="${GHOST_EYE_RIGHT}"/>
  </g>
</svg>`;
}

let iconSeq = 0;

export function brandIconSvgHtml(className = "brand-icon", size = 40) {
  iconSeq += 1;
  return x1GhostSvg(size, className, `i${iconSeq}`);
}

/** Favicon data URI — funciona sem arquivo estático. */
export function brandFaviconDataUri() {
  const raw = x1GhostSvg(32, "", "fav").replace(/\s+/g, " ").trim();
  return `data:image/svg+xml,${encodeURIComponent(raw)}`;
}
