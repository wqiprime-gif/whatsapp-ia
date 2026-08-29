/** X1 BLACK — tema monocromático (preto absoluto + branco) */
export const designSystem = {
  colors: {
    bgBase: "#000000",
    bgElevated: "#0a0a0a",
    bgSidebar: "#040404",
    bgCard: "#0b0b0b",
    bgCardSolid: "#0b0b0b",
    bgCardHover: "rgba(20, 20, 20, 0.95)",
    border: "rgba(255, 255, 255, 0.09)",
    borderHighlight: "rgba(255, 255, 255, 0.22)",
    primary: "#ffffff",
    primaryHover: "#d4d4d4",
    primaryDim: "rgba(255, 255, 255, 0.09)",
    primaryGlow: "rgba(255, 255, 255, 0.18)",
    /** Texto/ícone sobre superfície branca (botão primário). */
    onPrimary: "#000000",
    accentBlue: "#ffffff",
    accentBlueBright: "#d4d4d4",
    accentBlueDim: "rgba(255, 255, 255, 0.08)",
    accentCyan: "#e5e5e5",
    accentCyanDim: "rgba(255, 255, 255, 0.08)",
    accentViolet: "#bdbdbd",
    accentVioletDim: "rgba(255, 255, 255, 0.07)",
    accentRose: "#ffffff",
    accentRoseDim: "rgba(255, 255, 255, 0.08)",
    accentMint: "#d4d4d4",
    accentMintDim: "rgba(255, 255, 255, 0.07)",
    accentSky: "#e5e5e5",
    accentSkyDim: "rgba(255, 255, 255, 0.08)",
    text: "#ffffff",
    textSecondary: "#a1a1a1",
    muted: "#6b6b6b",
    /** Semânticos preservados (Ativo / Pausado / alerta). */
    success: "#22c55e",
    successBg: "rgba(34, 197, 94, 0.12)",
    danger: "#ef4444",
    warning: "#f5c518",
    warningBg: "rgba(245, 197, 24, 0.12)"
  },
  glass: {
    blur: "24px",
    saturate: "1.05",
    shadow:
      "0 1px 0 rgba(255, 255, 255, 0.05) inset, 0 0 0 1px rgba(255, 255, 255, 0.06), 0 28px 80px rgba(0, 0, 0, 0.85)"
  },
  fonts: {
    display: "'Bricolage Grotesque', system-ui, sans-serif",
    sans: "'Instrument Sans', system-ui, sans-serif",
    mono: "'JetBrains Mono', ui-monospace, monospace"
  },
  motion: "320ms cubic-bezier(0.22, 1, 0.36, 1)"
} as const;
