/** ZapManager — tema azul + verde premium */
export const designSystem = {
  colors: {
    bgBase: "#020408",
    bgElevated: "#050a14",
    bgSidebar: "rgba(3, 8, 18, 0.94)",
    bgCard: "rgba(6, 14, 28, 0.88)",
    bgCardSolid: "rgba(4, 10, 22, 0.98)",
    bgCardHover: "rgba(10, 22, 42, 0.95)",
    border: "rgba(255, 255, 255, 0.08)",
    borderHighlight: "rgba(0, 180, 255, 0.4)",
    primary: "#25D366",
    primaryHover: "#3de07a",
    primaryDim: "rgba(37, 211, 102, 0.14)",
    primaryGlow: "rgba(37, 211, 102, 0.45)",
    accentBlue: "#0a5cff",
    accentBlueBright: "#00b4ff",
    accentBlueDim: "rgba(10, 92, 255, 0.14)",
    accentCyan: "#00d4ff",
    accentCyanDim: "rgba(0, 212, 255, 0.12)",
    accentViolet: "#6366f1",
    accentVioletDim: "rgba(99, 102, 241, 0.12)",
    accentRose: "#25D366",
    accentRoseDim: "rgba(37, 211, 102, 0.12)",
    accentMint: "#34d399",
    accentMintDim: "rgba(52, 211, 153, 0.12)",
    accentSky: "#00b4ff",
    accentSkyDim: "rgba(0, 180, 255, 0.12)",
    text: "#f0f6ff",
    textSecondary: "#94a8c4",
    muted: "#5a7090",
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
      "0 1px 0 rgba(255, 255, 255, 0.06) inset, 0 0 0 1px rgba(0, 180, 255, 0.1), 0 28px 80px rgba(0, 0, 0, 0.55)"
  },
  fonts: {
    display: "'Bricolage Grotesque', system-ui, sans-serif",
    sans: "'Instrument Sans', system-ui, sans-serif",
    mono: "'JetBrains Mono', ui-monospace, monospace"
  },
  motion: "320ms cubic-bezier(0.22, 1, 0.36, 1)"
} as const;
