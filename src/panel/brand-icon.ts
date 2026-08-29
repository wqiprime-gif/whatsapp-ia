/** Mark X1 BLACK — aranha monocromática inline (sem depender de /brand/). */
export function x1SpiderSvg(size: number, className = "brand-icon", idSuffix = "a") {
  const s = idSuffix.replace(/[^a-zA-Z0-9]/g, "");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" fill="none" class="${className}" width="${size}" height="${size}" role="img" aria-hidden="true">
  <defs>
    <linearGradient id="x1-metal-${s}" x1="60" y1="16" x2="60" y2="104" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="62%" stop-color="#e8e8e8"/>
      <stop offset="100%" stop-color="#9a9a9a"/>
    </linearGradient>
    <filter id="x1-glow-${s}" x="-25%" y="-25%" width="150%" height="150%">
      <feGaussianBlur stdDeviation="1.6" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <g stroke="#ffffff" stroke-opacity="0.28" stroke-width="2" fill="none" stroke-linecap="round">
    <path d="M12 62a48 48 0 0 1 96 0"/>
    <path d="M25 64a35 35 0 0 1 70 0"/>
  </g>
  <g filter="url(#x1-glow-${s})">
    <g stroke="url(#x1-metal-${s})" stroke-width="5.6" stroke-linecap="round" stroke-linejoin="round" fill="none">
      <path d="M51 47 30 23l-4-16"/>
      <path d="M49 56 19 42 7 31"/>
      <path d="M49 66 19 68 5 64"/>
      <path d="M51 74 28 88l-8 17"/>
      <path d="M69 47 90 23l4-16"/>
      <path d="M71 56l30-14 12-11"/>
      <path d="M71 66l30 2 14-4"/>
      <path d="M69 74l23 14 8 17"/>
    </g>
    <path fill="url(#x1-metal-${s})" d="M60 30c4.6 0 8 3.4 8 7.8 0 4.3-3.4 7.8-8 7.8s-8-3.5-8-7.8c0-4.4 3.4-7.8 8-7.8Z"/>
    <path fill="url(#x1-metal-${s})" d="M60 46c7.4 0 12.6 6.6 12.6 15.6 0 9.4-4.8 19.4-12.6 26.4-7.8-7-12.6-17-12.6-26.4C47.4 52.6 52.6 46 60 46Z"/>
  </g>
</svg>`;
}

let iconSeq = 0;

export function brandIconSvgHtml(className = "brand-icon", size = 40) {
  iconSeq += 1;
  return x1SpiderSvg(size, className, `i${iconSeq}`);
}

/** Favicon data URI — funciona sem arquivo estático. */
export function brandFaviconDataUri() {
  const raw = x1SpiderSvg(32, "", "fav").replace(/\s+/g, " ").trim();
  return `data:image/svg+xml,${encodeURIComponent(raw)}`;
}
