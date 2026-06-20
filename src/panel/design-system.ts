/** ZapManager — tema preto + azul (estilo Shark) */
export const designSystem = {
  colors: {
    bgBase: "#050505",
    bgElevated: "#0a0a0a",
    bgSidebar: "#050505",
    bgCard: "#0a0a0a",
    bgCardSolid: "#0a0a0a",
    bgCardHover: "rgba(8, 12, 24, 0.95)",
    border: "rgba(255, 255, 255, 0.06)",
    borderHighlight: "rgba(10, 92, 255, 0.35)",
    primary: "#0a5cff",
    primaryHover: "#3b82f6",
    primaryDim: "rgba(10, 92, 255, 0.14)",
    primaryGlow: "rgba(10, 92, 255, 0.45)",
    accentBlue: "#0a5cff",
    accentBlueBright: "#3b82f6",
    accentBlueDim: "rgba(10, 92, 255, 0.12)",
    accentCyan: "#00b4ff",
    accentCyanDim: "rgba(0, 180, 255, 0.12)",
    accentViolet: "#6366f1",
    accentVioletDim: "rgba(99, 102, 241, 0.12)",
    accentRose: "#0a5cff",
    accentRoseDim: "rgba(10, 92, 255, 0.12)",
    accentMint: "#60a5fa",
    accentMintDim: "rgba(96, 165, 250, 0.12)",
    accentSky: "#00b4ff",
    accentSkyDim: "rgba(0, 180, 255, 0.12)",
    text: "#f4f8ff",
    textSecondary: "#9cb0c8",
    muted: "#5a6e82",
    success: "#3b82f6",
    successBg: "rgba(59, 130, 246, 0.12)",
    danger: "#ff4d6d",
    warning: "#fbbf24",
    warningBg: "rgba(251, 191, 36, 0.12)"
  },
  glass: {
    blur: "24px",
    saturate: "1.25",
    shadow:
      "0 1px 0 rgba(255, 255, 255, 0.05) inset, 0 0 0 1px rgba(10, 92, 255, 0.08), 0 28px 80px rgba(0, 0, 0, 0.65)"
  },
  fonts: {
    display: "'Bricolage Grotesque', system-ui, sans-serif",
    sans: "'Instrument Sans', system-ui, sans-serif",
    mono: "'JetBrains Mono', ui-monospace, monospace"
  },
  motion: "320ms cubic-bezier(0.22, 1, 0.36, 1)"
} as const;
