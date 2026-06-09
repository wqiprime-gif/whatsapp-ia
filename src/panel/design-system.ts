/** BotManager WhatsApp — preto, branco, verde WhatsApp */
export const designSystem = {
  colors: {
    bgBase: "#030508",
    bgElevated: "#060a0c",
    bgSidebar: "rgba(2, 6, 4, 0.92)",
    bgCard: "rgba(6, 12, 10, 0.88)",
    bgCardSolid: "rgba(4, 10, 8, 0.98)",
    bgCardHover: "rgba(10, 20, 16, 0.95)",
    border: "rgba(255, 255, 255, 0.08)",
    borderHighlight: "rgba(37, 211, 102, 0.45)",
    primary: "#25D366",
    primaryHover: "#3de07a",
    primaryDim: "rgba(37, 211, 102, 0.14)",
    primaryGlow: "rgba(37, 211, 102, 0.55)",
    accentCyan: "#34d399",
    accentCyanDim: "rgba(52, 211, 153, 0.12)",
    accentViolet: "#10b981",
    accentVioletDim: "rgba(16, 185, 129, 0.12)",
    accentRose: "#25D366",
    accentRoseDim: "rgba(37, 211, 102, 0.12)",
    accentMint: "#25D366",
    accentMintDim: "rgba(37, 211, 102, 0.12)",
    text: "#ffffff",
    textSecondary: "#a8c4b8",
    muted: "#6b8a7a",
    success: "#25D366",
    successBg: "rgba(37, 211, 102, 0.12)",
    danger: "#ff4d6d",
    warning: "#fbbf24",
    warningBg: "rgba(251, 191, 36, 0.12)"
  },
  glass: {
    blur: "24px",
    saturate: "1.2",
    shadow:
      "0 1px 0 rgba(255, 255, 255, 0.06) inset, 0 0 0 1px rgba(37, 211, 102, 0.12), 0 28px 80px rgba(0, 0, 0, 0.55)"
  },
  fonts: {
    display: "'Bricolage Grotesque', system-ui, sans-serif",
    sans: "'Instrument Sans', system-ui, sans-serif",
    mono: "'JetBrains Mono', ui-monospace, monospace"
  },
  motion: "320ms cubic-bezier(0.22, 1, 0.36, 1)"
} as const;
