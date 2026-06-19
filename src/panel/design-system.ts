/** ZapManager — tema preto + verde (estilo Shark) */
export const designSystem = {
  colors: {
    bgBase: "#000000",
    bgElevated: "#050505",
    bgSidebar: "#000000",
    bgCard: "#050505",
    bgCardSolid: "#050505",
    bgCardHover: "rgba(12, 16, 12, 0.95)",
    border: "rgba(255, 255, 255, 0.06)",
    borderHighlight: "rgba(37, 211, 102, 0.35)",
    primary: "#25D366",
    primaryHover: "#3de07a",
    primaryDim: "rgba(37, 211, 102, 0.14)",
    primaryGlow: "rgba(37, 211, 102, 0.45)",
    accentBlue: "#25D366",
    accentBlueBright: "#3de07a",
    accentBlueDim: "rgba(37, 211, 102, 0.12)",
    accentCyan: "#34d399",
    accentCyanDim: "rgba(52, 211, 153, 0.12)",
    accentViolet: "#6366f1",
    accentVioletDim: "rgba(99, 102, 241, 0.12)",
    accentRose: "#25D366",
    accentRoseDim: "rgba(37, 211, 102, 0.12)",
    accentMint: "#34d399",
    accentMintDim: "rgba(52, 211, 153, 0.12)",
    accentSky: "#4ade80",
    accentSkyDim: "rgba(74, 222, 128, 0.12)",
    text: "#f4fff8",
    textSecondary: "#9cb8a8",
    muted: "#5a6e62",
    success: "#25D366",
    successBg: "rgba(37, 211, 102, 0.12)",
    danger: "#ff4d6d",
    warning: "#fbbf24",
    warningBg: "rgba(251, 191, 36, 0.12)"
  },
  glass: {
    blur: "24px",
    saturate: "1.25",
    shadow:
      "0 1px 0 rgba(255, 255, 255, 0.05) inset, 0 0 0 1px rgba(37, 211, 102, 0.08), 0 28px 80px rgba(0, 0, 0, 0.65)"
  },
  fonts: {
    display: "'Bricolage Grotesque', system-ui, sans-serif",
    sans: "'Instrument Sans', system-ui, sans-serif",
    mono: "'JetBrains Mono', ui-monospace, monospace"
  },
  motion: "320ms cubic-bezier(0.22, 1, 0.36, 1)"
} as const;
