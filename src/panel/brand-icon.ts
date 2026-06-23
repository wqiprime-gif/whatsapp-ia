/** SVG da bolha OnlyChat — inline (fundo transparente, não depende de /brand/). */
export function onlyChatIconSvg(size: number, className = "brand-icon", idSuffix = "a") {
  const s = idSuffix.replace(/[^a-zA-Z0-9]/g, "");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" fill="none" class="${className}" width="${size}" height="${size}" role="img" aria-hidden="true">
  <defs>
    <radialGradient id="oc-shell-${s}" cx="32%" cy="26%" r="72%">
      <stop offset="0%" stop-color="#8aebff"/>
      <stop offset="28%" stop-color="#4db8ff"/>
      <stop offset="58%" stop-color="#2478f5"/>
      <stop offset="100%" stop-color="#0b3f9c"/>
    </radialGradient>
    <linearGradient id="oc-rim-${s}" x1="24" y1="18" x2="88" y2="92" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.78"/>
      <stop offset="38%" stop-color="#ffffff" stop-opacity="0.14"/>
      <stop offset="100%" stop-color="#001a44" stop-opacity="0.22"/>
    </linearGradient>
    <radialGradient id="oc-inner-${s}" cx="48%" cy="38%" r="58%">
      <stop offset="0%" stop-color="#3f8ef0"/>
      <stop offset="55%" stop-color="#1a56c4"/>
      <stop offset="100%" stop-color="#082a66"/>
    </radialGradient>
    <linearGradient id="oc-shine-${s}" x1="38" y1="34" x2="72" y2="58" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.42"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="oc-dot-${s}" cx="50%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#f2fbff"/>
      <stop offset="100%" stop-color="#b8e8ff"/>
    </radialGradient>
    <filter id="oc-shadow-${s}" x="-12%" y="-8%" width="124%" height="130%">
      <feDropShadow dx="0" dy="2.5" stdDeviation="2.5" flood-color="#0a2f7a" flood-opacity="0.35"/>
    </filter>
    <filter id="oc-glow-${s}" x="-18%" y="-18%" width="136%" height="136%">
      <feGaussianBlur stdDeviation="2.2" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <g filter="url(#oc-shadow-${s})">
    <path fill="url(#oc-shell-${s})" d="M60 14c24.3 0 41 16.2 41 37.2 0 14.8-8.2 27.4-21.2 33.2l-4.2 17.6-14.8-11.2C34.8 88.8 19 74.2 19 51.2 19 30.2 35.7 14 60 14Z"/>
    <path fill="url(#oc-rim-${s})" d="M60 14c24.3 0 41 16.2 41 37.2 0 14.8-8.2 27.4-21.2 33.2l-4.2 17.6-14.8-11.2C34.8 88.8 19 74.2 19 51.2 19 30.2 35.7 14 60 14Z"/>
    <ellipse cx="60" cy="50" rx="27" ry="23.5" fill="url(#oc-inner-${s})"/>
    <ellipse cx="50" cy="42" rx="14" ry="8.5" fill="url(#oc-shine-${s})"/>
    <g filter="url(#oc-glow-${s})">
      <circle cx="48.5" cy="52.5" r="4.6" fill="url(#oc-dot-${s})"/>
      <circle cx="60" cy="52.5" r="4.6" fill="url(#oc-dot-${s})"/>
      <circle cx="71.5" cy="52.5" r="4.6" fill="url(#oc-dot-${s})"/>
    </g>
  </g>
</svg>`;
}

let iconSeq = 0;

export function brandIconSvgHtml(className = "brand-icon", size = 40) {
  iconSeq += 1;
  return onlyChatIconSvg(size, className, `i${iconSeq}`);
}

/** Favicon data URI — funciona sem arquivo estático. */
export function brandFaviconDataUri() {
  const raw = onlyChatIconSvg(32, "", "fav").replace(/\s+/g, " ").trim();
  return `data:image/svg+xml,${encodeURIComponent(raw)}`;
}
