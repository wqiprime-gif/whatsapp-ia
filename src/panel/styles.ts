import { designSystem as ds } from "./design-system.js";
import { premiumStyles } from "./premium-styles.js";

export const globalStyles = `
${premiumStyles}

:root {
  --bg: ${ds.colors.bgBase};
  --bg-elevated: ${ds.colors.bgElevated};
  --sidebar: ${ds.colors.bgSidebar};
  --card: ${ds.colors.bgCard};
  --card-solid: ${ds.colors.bgCardSolid};
  --glass-blur: ${ds.glass.blur};
  --glass-shadow: ${ds.glass.shadow};
  --border: ${ds.colors.border};
  --border-hi: ${ds.colors.borderHighlight};
  --primary: ${ds.colors.primary};
  --primary-hover: ${ds.colors.primaryHover};
  --primary-dim: ${ds.colors.primaryDim};
  --primary-glow: ${ds.colors.primaryGlow};
  --accent-violet: ${ds.colors.accentViolet};
  --accent-violet-dim: ${ds.colors.accentVioletDim};
  --accent-rose: ${ds.colors.accentRose};
  --accent-rose-dim: ${ds.colors.accentRoseDim};
  --accent-mint: ${ds.colors.accentMint};
  --accent-mint-dim: ${ds.colors.accentMintDim};
  --accent-sky: ${ds.colors.accentCyan};
  --accent-sky-dim: ${ds.colors.accentCyanDim};
  --text: ${ds.colors.text};
  --text-2: ${ds.colors.textSecondary};
  --muted: ${ds.colors.muted};
  --success: ${ds.colors.success};
  --success-bg: ${ds.colors.successBg};
  --danger: ${ds.colors.danger};
  --warning: ${ds.colors.warning};
  --warning-bg: ${ds.colors.warningBg};
  --font-display: ${ds.fonts.display};
  --font: ${ds.fonts.sans};
  --font-mono: ${ds.fonts.mono};
  --ease: ${ds.motion};
  --radius: 14px;
  --radius-lg: 20px;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

html { scroll-behavior: smooth; scrollbar-gutter: stable; }

/* Scroll invisível — estilo Shark (funciona, não aparece) */
* {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
*::-webkit-scrollbar {
  width: 0;
  height: 0;
  display: none;
  background: transparent;
}

body {
  font-family: var(--font);
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

/* Ambiente: grid sutil preto puro */
.ambient {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background-color: #000;
  background-image:
    linear-gradient(rgba(37, 211, 102, 0.015) 1px, transparent 1px),
    linear-gradient(90deg, rgba(37, 211, 102, 0.015) 1px, transparent 1px);
  background-size: 56px 56px, 56px 56px;
}
.ambient::after { display: none; }
.brand-mark { display: flex; align-items: center; gap: 12px; }
.brand-mark--wa {
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding: 4px 0 8px;
}
.brand-logo {
  width: 44px; height: 44px; border-radius: 14px;
  object-fit: cover;
  box-shadow: 0 0 24px var(--primary-glow), 0 0 0 1px rgba(255,255,255,0.12);
}
.brand-copy { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.brand-title {
  font-family: var(--font-display);
  font-weight: 800; font-size: 1.1rem; letter-spacing: -0.03em; line-height: 1.1;
}
.brand-accent { color: var(--primary); text-shadow: 0 0 28px var(--primary-glow); }
.brand-sub { font-size: 0.68rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; }
.page-hero { margin-bottom: 20px; }
.neon-hero .hero-title {
  font-family: var(--font-display);
  font-size: clamp(1.5rem, 3vw, 2rem);
  font-weight: 800;
  letter-spacing: -0.04em;
  margin-bottom: 8px;
}
.hero-desc { color: var(--text-2); line-height: 1.55; max-width: 640px; font-size: 0.92rem; }
.card-neon {
  border-color: rgba(37, 211, 102, 0.25) !important;
  box-shadow: 0 0 40px rgba(37, 211, 102, 0.06), var(--glass-shadow);
}
.dropzone-neon { border-color: rgba(37, 211, 102, 0.45) !important; background: var(--primary-dim) !important; }
.audio-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; margin-bottom: 8px; }
.audio-card {
  padding: 16px; border-radius: var(--radius);
  background: rgba(255,255,255,0.03);
  border: 1px solid var(--border);
  transition: border-color var(--ease), box-shadow var(--ease);
}
.audio-card:hover { border-color: rgba(10,92,255,0.4); box-shadow: 0 0 24px rgba(10,92,255,0.08); }
.audio-card-head { display: flex; gap: 12px; margin-bottom: 12px; }
.audio-card-head h4 { font-size: 0.9rem; font-weight: 700; }
.audio-triggers { font-size: 0.75rem; color: var(--muted); margin-top: 4px; }
.audio-badge {
  width: 36px; height: 36px; border-radius: 10px;
  display: grid; place-items: center;
  background: var(--primary-dim); color: var(--primary);
}
.audio-player { width: 100%; margin: 8px 0; border-radius: 8px; }
.audio-card-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.glow-empty { border: 1px dashed rgba(10,92,255,0.3); border-radius: var(--radius); }
.muted-sm { font-size: 0.72rem; color: var(--muted); }
.remarketing-table-wrap { margin: 16px 0; }
.remarketing-msg {
  width: 100%; min-height: 56px; resize: vertical;
  background: rgba(0,0,0,0.35) !important;
  border: 1px solid var(--border) !important;
  color: var(--text) !important;
}
.remarketing-table td:last-child { min-width: 280px; }
.empty-cell { text-align: center; color: var(--muted); padding: 24px !important; }

a { color: inherit; text-decoration: none; }
button, input, textarea, select { font-family: inherit; }

.app {
  display: flex;
  min-height: 100vh;
  position: relative;
  z-index: 1;
}

@keyframes rise-in {
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: translateY(0); }
}

.content > * {
  animation: rise-in 0.55s var(--ease) both;
}
.content > *:nth-child(1) { animation-delay: 0.04s; }
.content > *:nth-child(2) { animation-delay: 0.1s; }
.content > *:nth-child(3) { animation-delay: 0.16s; }
.content > *:nth-child(4) { animation-delay: 0.22s; }

/* Sidebar — colapsa, expande no hover e empurra o conteúdo */
.sidebar {
  width: 72px;
  background: #000;
  border-right: 1px solid rgba(255, 255, 255, 0.04);
  display: flex;
  flex-direction: column;
  padding: 22px 12px;
  position: fixed;
  top: 0; left: 0; bottom: 0;
  z-index: 35;
  overflow-y: auto;
  overflow-x: hidden;
  transition: width 0.28s cubic-bezier(0.22, 1, 0.36, 1);
  contain: layout style;
}
.sidebar:hover {
  width: 280px;
}
.sidebar:not(:hover) .nav-text,
.sidebar:not(:hover) .brand-copy,
.sidebar:not(:hover) .btn-new-label,
.sidebar:not(:hover) .sidebar-plan,
.sidebar:not(:hover) > form {
  display: none;
}
.sidebar:not(:hover) .sidebar-brand {
  display: flex;
  justify-content: center;
  padding: 2px 0 16px;
}
.sidebar:not(:hover) .brand-mark {
  align-items: center;
}
.sidebar:not(:hover) .btn-new {
  width: 44px;
  height: 44px;
  min-width: 44px;
  padding: 0;
  margin: 0 auto 16px;
  border-radius: 12px;
  font-size: inherit;
}
.sidebar:not(:hover) .btn-new svg {
  width: 20px;
  height: 20px;
}
.sidebar:not(:hover) .nav a,
.sidebar:not(:hover) .nav button.nav-btn {
  width: 44px;
  height: 44px;
  min-width: 44px;
  padding: 0;
  margin: 3px auto;
  justify-content: center;
  border: none;
  box-shadow: none;
}
.sidebar:not(:hover) .nav a.active {
  background: rgba(37, 211, 102, 0.14);
  border: none;
  box-shadow: none;
}
.sidebar:not(:hover) .nav a svg,
.sidebar:not(:hover) .nav button.nav-btn svg {
  margin: 0;
}
.sidebar:hover .nav-text,
.sidebar:hover .brand-copy,
.sidebar:hover .btn-new-label,
.sidebar:hover .sidebar-plan,
.sidebar:hover > form {
  display: revert;
}
.sidebar:hover .btn-new {
  width: 100%;
  height: auto;
  padding: 13px;
  margin: 0 0 22px;
  border-radius: var(--radius);
}
.sidebar:hover .nav a,
.sidebar:hover .nav button.nav-btn {
  width: 100%;
  height: auto;
  margin: 0;
  justify-content: flex-start;
  padding: 11px 12px;
}
.sidebar:hover .nav a.active {
  border: 1px solid rgba(37, 211, 102, 0.25);
  box-shadow: inset 3px 0 0 var(--primary), 0 0 24px rgba(37, 211, 102, 0.08);
}
.sidebar .nav a, .sidebar .nav button.nav-btn {
  justify-content: center;
  padding: 11px 10px;
}
.sidebar .nav-text {
  white-space: nowrap;
  margin-left: 2px;
}
.sidebar-brand { padding: 2px 6px 22px; }
.btn-new {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  width: 100%; padding: 13px;
  background: linear-gradient(135deg, var(--primary) 0%, #3de07a 100%);
  color: #fff; border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: var(--radius);
  font-family: var(--font-display);
  font-weight: 700; font-size: 0.88rem;
  cursor: pointer; margin-bottom: 22px;
  box-shadow: 0 8px 32px var(--primary-glow), inset 0 1px 0 rgba(255, 255, 255, 0.25);
  transition: transform var(--ease), box-shadow var(--ease);
  text-decoration: none;
}
.btn-new:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 40px var(--primary-glow);
}

.nav-section { margin-bottom: 8px; }
.nav-label {
  font-size: 0.65rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.12em; color: var(--muted);
  padding: 8px 12px 6px;
}
.nav a, .nav button.nav-btn {
  display: flex; align-items: center; gap: 10px;
  padding: 11px 12px; border-radius: 11px;
  color: var(--text-2); font-weight: 600; font-size: 0.86rem;
  border: 1px solid transparent; background: transparent;
  width: 100%; text-align: left; cursor: pointer;
  transition: all var(--ease);
}
.nav a:hover, .nav button.nav-btn:hover {
  background: rgba(255, 255, 255, 0.04);
  color: var(--text);
  border-color: rgba(255, 255, 255, 0.06);
}
.nav a.active {
  background: linear-gradient(90deg, rgba(37, 211, 102, 0.18), rgba(37, 211, 102, 0.04));
  color: var(--primary);
  border-color: rgba(37, 211, 102, 0.25);
  box-shadow: inset 3px 0 0 var(--primary), 0 0 24px rgba(37, 211, 102, 0.08);
}
.nav svg { width: 18px; height: 18px; flex-shrink: 0; opacity: 0.9; }

.sidebar-plan {
  margin-top: auto;
  padding: 16px;
  background: var(--card);
  backdrop-filter: blur(20px);
  border: 1px solid var(--border-hi);
  border-radius: var(--radius);
  box-shadow: var(--glass-shadow);
}
.sidebar-plan strong {
  display: block; font-family: var(--font-display);
  font-size: 0.88rem; margin-bottom: 4px;
}
.sidebar-plan span { font-size: 0.74rem; color: var(--muted); display: block; margin-bottom: 10px; }
.plan-usage { margin: 10px 0 12px; }
.plan-usage-head {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 0.68rem; color: var(--muted); margin-bottom: 6px;
}
.plan-usage-pct { color: var(--primary); font-weight: 700; }
.plan-usage-bar {
  height: 6px; border-radius: 99px;
  background: rgba(255, 255, 255, 0.06);
  overflow: hidden;
}
.plan-usage-bar span {
  display: block; height: 100%; margin: 0;
  border-radius: 99px;
  background: linear-gradient(90deg, var(--primary), #3de07a);
  box-shadow: 0 0 12px var(--primary-glow);
}
.sidebar-plan a {
  display: block; margin-top: 12px; text-align: center;
  padding: 9px; border-radius: 10px; font-size: 0.78rem; font-weight: 600;
  background: rgba(37, 211, 102, 0.1); color: var(--primary);
  border: 1px solid rgba(37, 211, 102, 0.2);
}
.sidebar-plan a:hover { background: rgba(37, 211, 102, 0.18); }

/* Main — empurrado pela sidebar ao expandir */
.main-wrap {
  flex: 1;
  margin-left: 72px;
  transition: margin-left 0.28s cubic-bezier(0.22, 1, 0.36, 1);
  display: flex; flex-direction: column; min-height: 100vh;
  background: #000;
}
.app:has(.sidebar:hover) .main-wrap {
  margin-left: 280px;
}
.topbar {
  height: 68px; border-bottom: 1px solid var(--border);
  display: grid;
  grid-template-columns: minmax(160px, 1fr) minmax(200px, 2fr) auto;
  align-items: center;
  gap: 16px;
  padding: 0 24px;
  background: #000;
  position: sticky; top: 0; z-index: 30;
}
.topbar-left h1 {
  font-family: var(--font-display);
  font-size: 1.35rem; font-weight: 800;
  letter-spacing: -0.04em;
  line-height: 1.15;
}
.topbar-subtitle {
  font-size: 0.82rem;
  color: var(--muted);
  margin-top: 2px;
  font-weight: 500;
}
.topbar-center { min-width: 0; }
.topbar-search-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: rgba(0, 0, 0, 0.35);
  transition: border-color var(--ease), box-shadow var(--ease);
}
.topbar-search-wrap:focus-within {
  border-color: rgba(37, 211, 102, 0.45);
  box-shadow: 0 0 0 3px rgba(37, 211, 102, 0.1);
}
.topbar-search-icon { color: var(--muted); display: flex; flex-shrink: 0; }
.topbar-search {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  color: var(--text);
  font-size: 0.88rem;
  outline: none;
}
.topbar-search::placeholder { color: var(--muted); }
.topbar-kbd {
  font-size: 0.65rem;
  padding: 3px 7px;
  border-radius: 6px;
  border: 1px solid var(--border);
  color: var(--muted);
  background: rgba(255, 255, 255, 0.04);
  font-family: var(--font-mono);
  flex-shrink: 0;
}
@media (max-width: 900px) {
  .topbar { grid-template-columns: 1fr auto; }
  .topbar-center { display: none; }
}
.topbar-right { display: flex; align-items: center; gap: 12px; }
.icon-btn {
  width: 42px; height: 42px; border-radius: 13px;
  border: 1px solid var(--border);
  background: rgba(14, 28, 46, 0.6);
  backdrop-filter: blur(14px);
  color: var(--text-2); cursor: pointer;
  display: grid; place-items: center;
  transition: all var(--ease);
}
.icon-btn:hover {
  border-color: rgba(61, 200, 255, 0.4);
  color: var(--primary);
  box-shadow: 0 0 20px rgba(61, 200, 255, 0.15);
}
.user-pill {
  display: flex; align-items: center; gap: 10px;
  padding: 6px 14px 6px 6px;
  background: rgba(8, 12, 8, 0.85);
  backdrop-filter: blur(14px);
  border: 1px solid rgba(37, 211, 102, 0.2);
  border-radius: 999px;
  text-decoration: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.user-pill:hover {
  border-color: rgba(37, 211, 102, 0.45);
  box-shadow: 0 0 20px rgba(37, 211, 102, 0.12);
}
.user-avatar {
  width: 34px; height: 34px; border-radius: 50%;
  background: linear-gradient(135deg, var(--primary), #5ee4a8);
  display: grid; place-items: center;
  font-size: 0.68rem; font-weight: 800; color: #041018;
  flex-shrink: 0;
  object-fit: cover;
}
.user-avatar--lg { width: 96px; height: 96px; font-size: 1.5rem; }
.user-avatar-img { border: 2px solid rgba(37, 211, 102, 0.35); }
.user-pill .name { font-weight: 700; font-size: 0.84rem; }
.user-pill .role { font-size: 0.7rem; color: var(--muted); }

.content { padding: 22px 28px 44px; flex: 1; width: 100%; max-width: none; transition: opacity 0.2s var(--ease); }
.content:has(.page-form-shell),
.content:has(.dash-shell) { padding: 20px 24px 40px; }

/* Stats */
.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 18px; margin-bottom: 22px;
}
@media (max-width: 1100px) { .stats-row { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 600px) { .stats-row { grid-template-columns: 1fr; } }

.stat-card {
  background: var(--card);
  backdrop-filter: blur(var(--glass-blur)) saturate(1.15);
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(1.15);
  border: 1px solid var(--border-hi);
  border-radius: var(--radius-lg);
  padding: 20px 22px;
  display: flex; align-items: flex-start; gap: 16px;
  box-shadow: var(--glass-shadow);
  transition: border-color var(--ease), transform var(--ease), box-shadow var(--ease);
  position: relative;
  overflow: hidden;
}
.stat-card::before {
  content: "";
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(61, 200, 255, 0.5), transparent);
  opacity: 0.6;
}
.stat-card:hover {
  border-color: rgba(61, 200, 255, 0.35);
  transform: translateY(-2px);
  box-shadow: var(--glass-shadow), 0 0 40px rgba(61, 200, 255, 0.08);
}
.stat-icon {
  width: 46px; height: 46px; border-radius: 14px;
  display: grid; place-items: center; flex-shrink: 0;
}
.stat-icon.purple { background: var(--accent-violet-dim); color: var(--accent-violet); }
.stat-icon.green { background: var(--accent-mint-dim); color: var(--accent-mint); }
.stat-icon.blue { background: var(--accent-sky-dim); color: var(--accent-sky); }
.stat-icon.orange { background: var(--primary-dim); color: var(--primary); }
.stat-label { font-size: 0.78rem; color: var(--muted); font-weight: 500; text-transform: uppercase; letter-spacing: 0.06em; }
.stat-value {
  font-family: var(--font-display);
  font-size: 1.75rem; font-weight: 800;
  letter-spacing: -0.04em; margin: 6px 0 2px;
}
.stat-delta { font-size: 0.74rem; color: var(--success); font-weight: 600; }

/* Cards */
.card {
  background: var(--card);
  backdrop-filter: blur(var(--glass-blur)) saturate(1.12);
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(1.12);
  border: 1px solid var(--border-hi);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--glass-shadow);
}
.card--table { overflow: visible; }
.card-head {
  padding: 18px 22px;
  border-bottom: 1px solid var(--border);
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; flex-wrap: wrap;
}
.card-head h3 {
  font-family: var(--font-display);
  font-size: 1.02rem; font-weight: 700;
  letter-spacing: -0.02em;
}
.card-body { padding: 18px 22px; }
.card-body--flush { padding: 0; }
.card-foot {
  padding: 14px 22px;
  border-top: 1px solid var(--border);
}
.card-link { font-size: 0.82rem; color: var(--primary); font-weight: 600; }
.card-link:hover { text-decoration: underline; }

.grid-2 { display: grid; grid-template-columns: 1.45fr 1fr; gap: 18px; margin-bottom: 18px; }
.grid-3 { display: grid; grid-template-columns: 1fr 1.25fr 1fr; gap: 18px; }
@media (max-width: 1200px) {
  .grid-2, .grid-3 { grid-template-columns: 1fr; }
  .sidebar { transform: translateX(-100%); }
  .main-wrap { margin-left: 0; }
}

/* Table — scroll + ações fixas (corrige corte dos botões) */
.table-scroll {
  overflow-x: auto;
  overflow-y: visible;
  -webkit-overflow-scrolling: touch;
  max-width: 100%;
}
.table {
  width: 100%;
  border-collapse: collapse;
  min-width: 720px;
}
.table th {
  text-align: left;
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
  font-weight: 700;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}
.table td {
  padding: 16px;
  border-bottom: 1px solid var(--border);
  vertical-align: middle;
}
.table tr:last-child td { border-bottom: none; }
.table tr:hover td { background: rgba(61, 200, 255, 0.03); }

.table-instances .th-actions,
.table-instances .td-actions {
  text-align: right;
  min-width: 220px;
  width: 220px;
}
.table-instances .td-actions {
  position: sticky;
  right: 0;
  z-index: 2;
  background: linear-gradient(90deg, transparent 0%, var(--card-solid) 28%);
  box-shadow: -16px 0 32px rgba(5, 10, 18, 0.85);
}

.bot-cell { display: flex; align-items: center; gap: 12px; min-width: 180px; }
.bot-av-wrap {
  position: relative;
  width: 42px; height: 42px;
  flex-shrink: 0;
}
.bot-av-fallback {
  position: absolute; inset: 0;
  z-index: 1;
}
.bot-av-img {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  object-fit: cover;
  border-radius: 50%;
  z-index: 2;
  border: 2px solid rgba(0, 180, 255, 0.5);
  box-shadow: 0 0 16px rgba(0, 180, 255, 0.2);
  background: transparent;
}
.bot-av-img.is-broken { display: none !important; }
.bot-av {
  width: 42px; height: 42px; border-radius: 50%;
  background: linear-gradient(135deg, #0a5cff, #25D366);
  display: grid; place-items: center;
  font-weight: 800; font-size: 0.78rem; color: #fff;
  flex-shrink: 0; overflow: hidden;
  border: 2px solid rgba(255, 255, 255, 0.12);
}
.bot-cell .title { font-weight: 700; font-size: 0.9rem; }
.bot-cell .sub { font-size: 0.76rem; color: var(--muted); font-family: var(--font-mono); }

.badge {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 5px 11px; border-radius: 999px;
  font-size: 0.7rem; font-weight: 700;
  white-space: nowrap;
}
.badge-online { background: var(--success-bg); color: var(--success); border: 1px solid rgba(94, 228, 168, 0.25); }
.badge-paused { background: var(--warning-bg); color: var(--warning); border: 1px solid rgba(255, 200, 87, 0.25); }
.badge-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }

.metric { font-weight: 600; font-size: 0.88rem; font-variant-numeric: tabular-nums; }

.row-actions {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}
.row-actions form { display: inline-flex; margin: 0; }

.action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 10px;
  font-size: 0.74rem;
  font-weight: 700;
  white-space: nowrap;
  flex-shrink: 0;
  border: 1px solid var(--border-hi);
  background: rgba(14, 28, 46, 0.85);
  color: var(--text-2);
  cursor: pointer;
  transition: all var(--ease);
  text-decoration: none;
}
.action-btn__icon { display: flex; width: 16px; height: 16px; }
.action-btn__icon svg { width: 16px; height: 16px; }
.action-btn:hover {
  border-color: rgba(61, 200, 255, 0.45);
  color: var(--primary);
  background: rgba(61, 200, 255, 0.12);
  box-shadow: 0 0 16px rgba(61, 200, 255, 0.12);
}
.action-btn--ghost {
  background: transparent;
  border-color: var(--border);
}
.action-btn--danger {
  padding: 8px 10px;
  border-color: rgba(255, 107, 107, 0.25);
  color: var(--danger);
}
.action-btn--danger:hover {
  background: rgba(255, 107, 107, 0.12);
  border-color: rgba(255, 107, 107, 0.45);
  color: #ff8a8a;
  box-shadow: none;
}

@media (max-width: 900px) {
  .action-btn__label { display: none; }
  .action-btn { padding: 8px 10px; }
  .table-instances .th-actions,
  .table-instances .td-actions { min-width: 140px; width: 140px; }
}

/* Activity */
.activity-item {
  display: flex; gap: 12px; padding: 12px 0;
  border-bottom: 1px solid var(--border);
}
.activity-item:last-child { border-bottom: none; }
.activity-icon {
  width: 38px; height: 38px; border-radius: 12px;
  display: grid; place-items: center; flex-shrink: 0;
}
.activity-icon.pay { background: var(--success-bg); color: var(--success); }
.activity-icon.lead { background: rgba(61, 200, 255, 0.12); color: var(--primary); }
.activity-icon.sale { background: rgba(94, 228, 168, 0.1); color: #5ee4a8; }
.activity-text { flex: 1; font-size: 0.85rem; line-height: 1.45; }
.activity-text strong { color: var(--text); }
.activity-time { font-size: 0.72rem; color: var(--muted); white-space: nowrap; }

.quick-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;
}
@media (max-width: 600px) { .quick-grid { grid-template-columns: repeat(2, 1fr); } }
.quick-item {
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  padding: 18px 12px; border-radius: var(--radius);
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.02);
  color: var(--text-2); font-size: 0.76rem; font-weight: 600;
  text-align: center; transition: all var(--ease); cursor: pointer;
}
.quick-item:hover {
  border-color: rgba(61, 200, 255, 0.45);
  color: var(--primary);
  background: var(--primary-dim);
  transform: translateY(-2px);
}
.quick-item svg { width: 22px; height: 22px; color: var(--primary); }

.chart-wrap { height: 180px; position: relative; }
.chart-svg { width: 100%; height: 100%; }

.product-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 0; border-bottom: 1px solid var(--border);
}
.product-row:last-child { border-bottom: none; }
.product-left { display: flex; align-items: center; gap: 10px; }
.product-rank {
  width: 28px; height: 28px; border-radius: 8px;
  background: var(--primary-dim); color: var(--primary);
  display: grid; place-items: center; font-size: 0.75rem; font-weight: 800;
}
.product-price { font-weight: 700; color: var(--success); font-size: 0.88rem; }

.alert {
  padding: 14px 18px; border-radius: var(--radius); margin-bottom: 18px;
  font-size: 0.88rem; font-weight: 500;
}
.alert-success { background: var(--success-bg); border: 1px solid rgba(94, 228, 168, 0.35); color: #9ef0c8; }
.alert-error { background: rgba(255, 107, 107, 0.12); border: 1px solid rgba(255, 107, 107, 0.35); color: #ffb4b4; }

.field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
.field label, .field > span:first-child { font-size: 0.8rem; font-weight: 600; color: var(--text-2); }
.field input, .field textarea, .field select {
  background: rgba(5, 10, 18, 0.8);
  border: 1px solid var(--border);
  border-radius: 11px; padding: 12px 14px; color: var(--text);
  font-size: 0.9rem; outline: none;
  transition: border-color var(--ease), box-shadow var(--ease);
}
.field input:focus, .field textarea:focus, .field select:focus {
  border-color: rgba(37, 211, 102, 0.55);
  box-shadow: 0 0 0 3px var(--primary-dim), 0 0 20px rgba(37, 211, 102, 0.15);
}
.field textarea { min-height: 110px; resize: vertical; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.form-grid .span-2,
.form-grid .form-section { grid-column: 1 / -1; }
@media (min-width: 1280px) {
  .instance-form-main .form-grid { grid-template-columns: repeat(3, 1fr); }
  .instance-form-main .form-grid .span-2,
  .instance-form-main .form-grid .form-section { grid-column: 1 / -1; }
}
.form-section {
  padding: 20px 22px;
  border-radius: 16px;
  border: 1px solid rgba(37, 211, 102, 0.18);
  background: linear-gradient(165deg, rgba(37, 211, 102, 0.06) 0%, rgba(0, 0, 0, 0.25) 100%);
  margin-bottom: 4px;
}
.form-section-head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 14px;
}
.form-section-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: rgba(61, 200, 255, 0.15);
  color: var(--primary);
  flex-shrink: 0;
}
.form-section-icon svg { width: 20px; height: 20px; }
.form-section h4 {
  font-family: var(--font-display);
  font-size: 0.95rem;
  font-weight: 700;
  margin-bottom: 4px;
}
.form-section p { font-size: 0.8rem; color: var(--text-2); line-height: 1.45; }
.form-hint {
  font-size: 0.76rem;
  color: var(--muted);
  margin-top: 8px;
  line-height: 1.4;
}
.delay-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.prompt-tag-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}
.prompt-tag-chip {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.03);
  color: var(--text);
  cursor: pointer;
  font: inherit;
  text-align: left;
  transition: border-color 0.15s, background 0.15s;
}
.prompt-tag-chip:hover {
  border-color: var(--primary);
  background: var(--primary-dim);
}
.prompt-tag-chip code {
  font-size: 0.72rem;
  color: var(--primary);
  font-weight: 600;
}
.prompt-tag-chip span {
  font-size: 0.75rem;
  color: var(--muted);
}
.prompt-gen-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-bottom: 14px;
}
.prompt-gen-grid .span-2 { grid-column: 1 / -1; }
@media (min-width: 1100px) {
  .prompt-gen-grid { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 700px) {
  .prompt-gen-grid { grid-template-columns: 1fr; }
  .prompt-gen-grid .span-2 { grid-column: span 1; }
}
.form-actions-bar {
  margin-top: 20px;
  padding-top: 18px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
.instance-form-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(300px, 380px);
  gap: 24px;
  align-items: start;
  width: 100%;
}
.instance-form-main { min-width: 0; }
.instance-form-aside {
  position: sticky;
  top: 12px;
  max-height: calc(100vh - 120px);
  overflow-y: auto;
}
.prompt-tags-panel {
  border: 1px solid rgba(37, 211, 102, 0.2);
  border-radius: 16px;
  background: rgba(6, 12, 10, 0.85);
  padding: 18px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.35);
}
.prompt-tags-panel-head {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
}
.prompt-tags-panel-head h4 { margin: 0 0 4px; font-size: 0.95rem; }
.prompt-tags-panel-head p { margin: 0; font-size: 0.78rem; color: var(--muted); }
.prompt-tags-panel-icon { font-size: 1.25rem; }
.prompt-tags-panel-tip { margin: 0 0 12px; font-size: 0.72rem; }
.prompt-tag-doc-list { display: grid; gap: 10px; }
.prompt-tag-doc {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px;
  background: rgba(0, 0, 0, 0.15);
}
.prompt-tag-doc-head {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  width: 100%;
  padding: 0;
  margin: 0 0 6px;
  border: none;
  background: none;
  color: inherit;
  cursor: pointer;
  text-align: left;
  font: inherit;
}
.prompt-tag-doc-head:hover code { color: var(--primary); }
.prompt-tag-doc-head code {
  font-size: 0.72rem;
  color: #34d399;
  font-weight: 700;
}
.prompt-tag-doc-label { font-size: 0.82rem; font-weight: 600; }
.prompt-tag-doc-when { margin: 0; font-size: 0.74rem; color: var(--muted); line-height: 1.4; }
.prompt-tag-doc-ex { margin: 6px 0 0; font-size: 0.72rem; color: var(--muted); }
.prompt-tags-panel-foot {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
  font-size: 0.72rem;
  color: var(--muted);
  display: grid;
  gap: 6px;
}
@media (max-width: 1100px) {
  .instance-form-layout { grid-template-columns: 1fr; }
  .instance-form-aside { position: static; max-height: none; }
}
.dropzone-audio {
  border-color: rgba(167, 139, 250, 0.4);
  background: var(--accent-violet-dim);
}
.form-section-icon-violet {
  background: var(--accent-violet-dim);
  color: var(--accent-violet);
}
.form-section-audio { border-color: rgba(167, 139, 250, 0.25); }
.audio-library-list {
  list-style: none;
  margin: 0 0 14px;
  padding: 0;
  display: grid;
  gap: 8px;
}
.audio-library-list li {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border);
}
.audio-library-label { font-weight: 700; font-size: 0.85rem; flex: 1; }
.audio-remove { font-size: 0.72rem; color: var(--muted); display: flex; align-items: center; gap: 4px; }
.proxy-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 8px; }
.proxy-fields-block { margin-top: 12px; padding: 16px; border-radius: 12px; border: 1px solid rgba(37, 211, 102, 0.22); background: rgba(37, 211, 102, 0.04); }
.proxy-config-panel .form-hint { margin-bottom: 8px; }
@media (max-width: 700px) { .proxy-grid { grid-template-columns: 1fr; } }
.audio-add-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.audio-add-grid-3 { grid-template-columns: 1fr 1fr 1fr; }
.audio-slug-tag {
  font-size: 0.72rem; padding: 2px 8px; border-radius: 6px;
  background: var(--primary-dim); color: var(--primary);
  font-family: var(--font-mono);
}
@media (max-width: 900px) { .audio-add-grid-3 { grid-template-columns: 1fr; } }
@media (max-width: 700px) { .audio-add-grid { grid-template-columns: 1fr; } }
.card-accent-rose { border-color: rgba(244, 114, 182, 0.3); }
.card-accent-gold { border-color: rgba(232, 184, 77, 0.35); background: var(--primary-dim); }
.btn-primary {
  background: linear-gradient(135deg, var(--primary), #3de07a);
  color: #fff;
}
@media (max-width: 700px) {
  .form-grid { grid-template-columns: 1fr; }
  .form-grid .span-2,
  .form-grid .form-section { grid-column: span 1; }
  .delay-grid { grid-template-columns: 1fr; }
}

.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  padding: 11px 20px; border-radius: 11px;
  font-family: var(--font-display);
  font-weight: 700; font-size: 0.86rem;
  border: none; cursor: pointer; transition: all var(--ease);
}
.btn-sm { padding: 8px 14px; font-size: 0.78rem; border-radius: 10px; }
.btn-primary {
  background: linear-gradient(135deg, var(--primary), #3de07a);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.18);
  box-shadow: 0 6px 28px var(--primary-glow), inset 0 1px 0 rgba(255, 255, 255, 0.2);
}
.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 12px 36px var(--primary-glow);
}
.btn-secondary {
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-2);
  border: 1px solid var(--border-hi);
}
.btn-secondary:hover {
  background: rgba(37, 211, 102, 0.08);
  border-color: rgba(37, 211, 102, 0.35);
  color: var(--text);
}
.btn-ghost {
  background: transparent;
  color: var(--text-2);
  border: 1px solid var(--border);
}
.btn-ghost:hover {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(37, 211, 102, 0.3);
  color: var(--text);
}
.btn-lg {
  padding: 14px 28px;
  font-size: 0.92rem;
  border-radius: 14px;
}
.btn-block { width: 100%; }

.dropzone {
  border: 1px dashed rgba(61, 200, 255, 0.4);
  border-radius: var(--radius);
  padding: 22px;
  text-align: center;
  background: rgba(61, 200, 255, 0.05);
  cursor: pointer;
  transition: border-color var(--ease), background var(--ease);
}
.dropzone:hover { border-color: rgba(61, 200, 255, 0.65); background: rgba(61, 200, 255, 0.1); }

.media-preview-list { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.media-preview-chip {
  font-size: 0.72rem; padding: 4px 10px; border-radius: 999px;
  background: var(--primary-dim);
  border: 1px solid rgba(61, 200, 255, 0.28);
  color: var(--text-2);
  font-family: var(--font-mono);
}
.dropzone input { margin-top: 8px; width: 100%; }

.footer {
  text-align: center; padding: 22px;
  font-size: 0.76rem; color: var(--muted);
  border-top: 1px solid var(--border);
}

/* Login 3D */
.panel-scene-wrap {
  position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden;
}
#panel-scene-canvas {
  width: 100%; height: 100%; display: block;
  opacity: 0.55;
  mask-image: radial-gradient(ellipse 70% 60% at 30% 40%, black 20%, transparent 72%);
}
@media (prefers-reduced-motion: reduce) {
  .login-box { transform: none !important; }
  #panel-scene-canvas { display: none; }
}

/* Origem dos leads */
.source-badge {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 0.72rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.05em; padding: 4px 10px; border-radius: 999px;
  border: 1px solid var(--border-hi);
  background: rgba(255, 255, 255, 0.04);
}
.source-badge.tiktok { border-color: rgba(0, 242, 234, 0.45); color: #5eead4; }
.source-badge.instagram { border-color: rgba(236, 72, 153, 0.45); color: #f9a8d4; }
.source-badge.twitter { border-color: rgba(56, 189, 248, 0.45); color: #7dd3fc; }
.source-badge.youtube { border-color: rgba(248, 113, 113, 0.45); color: #fca5a5; }
.source-stat-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 10px;
}
.source-stat {
  padding: 14px 12px; border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--card);
  text-align: center;
  transition: transform 0.25s var(--ease), border-color 0.25s;
}
.source-stat:hover {
  transform: translateY(-3px) scale(1.02);
  border-color: var(--border-hi);
}
.source-stat strong { display: block; font-size: 1.35rem; font-family: var(--font-display); }
.source-stat span { font-size: 0.72rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; }
.tracking-links { display: grid; gap: 8px; margin-top: 12px; }
.tracking-link {
  font-family: var(--font-mono); font-size: 0.75rem;
  padding: 10px 12px; border-radius: 10px;
  background: rgba(0,0,0,0.45); border: 1px solid var(--border);
  word-break: break-all; color: var(--accent-sky);
}

/* Login */
.login-page {
  min-height: 100vh; display: grid; grid-template-columns: 1.15fr 1fr;
  position: relative; z-index: 1;
}
.login-page::before {
  content: "";
  position: fixed; inset: 0; z-index: 0; pointer-events: none;
  background:
    linear-gradient(rgba(37, 211, 102, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(37, 211, 102, 0.05) 1px, transparent 1px);
  background-size: 40px 40px;
}
@media (max-width: 900px) {
  .login-page { grid-template-columns: 1fr; }
  .login-hero { display: none; }
}
.login-hero {
  padding: 56px 48px;
  display: flex; flex-direction: column; justify-content: center;
  border-right: 1px solid rgba(37, 211, 102, 0.15);
  position: relative; z-index: 1;
}
.login-hero h1 {
  font-family: var(--font-display);
  font-size: clamp(2rem, 4vw, 2.85rem);
  font-weight: 800; letter-spacing: -0.04em;
  margin-bottom: 16px; line-height: 1.08;
}
.login-hero h1 .brand-accent { color: var(--primary); text-shadow: 0 0 40px var(--primary-glow); }
.login-pills {
  display: flex; flex-wrap: wrap; gap: 8px; margin-top: 24px;
}
.login-pill {
  font-size: 0.7rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.06em; padding: 6px 12px; border-radius: 999px;
  border: 1px solid rgba(37, 211, 102, 0.35);
  color: var(--primary);
  background: var(--primary-dim);
  box-shadow: 0 0 20px rgba(37, 211, 102, 0.15);
}
.login-form {
  display: flex; align-items: center; justify-content: center;
  padding: 40px 32px; position: relative; z-index: 1;
}
.login-box {
  width: min(440px, 100%);
  padding: 40px 36px;
  background: rgba(8, 8, 12, 0.92);
  border: 1px solid rgba(37, 211, 102, 0.28);
  border-radius: var(--radius-lg);
  box-shadow: 0 0 60px rgba(37, 211, 102, 0.12), var(--glass-shadow);
  backdrop-filter: blur(var(--glass-blur));
  transform: perspective(900px) rotateY(-4deg) rotateX(2deg);
  transition: transform 0.45s var(--ease), box-shadow 0.45s var(--ease);
}
.login-box:hover {
  transform: perspective(900px) rotateY(-1deg) rotateX(0deg) translateY(-4px);
  box-shadow: 0 0 80px rgba(37, 211, 102, 0.2), 0 32px 80px rgba(0, 0, 0, 0.55), var(--glass-shadow);
}
.login-box h2 {
  font-family: var(--font-display);
  font-size: 1.65rem; font-weight: 800;
  letter-spacing: -0.03em; margin-bottom: 8px;
}
.login-box .field input {
  background: rgba(0, 0, 0, 0.5) !important;
  border-color: rgba(255, 255, 255, 0.12) !important;
  color: var(--text) !important;
}
.login-box .field input:focus {
  border-color: var(--primary) !important;
  box-shadow: 0 0 0 3px var(--primary-dim), 0 0 24px rgba(37, 211, 102, 0.2);
}
.empty { text-align: center; padding: 36px; color: var(--muted); }

/* Live panel */
.panel-toasts {
  position: fixed; top: 84px; right: 24px; z-index: 9999;
  display: flex; flex-direction: column; gap: 10px; pointer-events: none;
}
.panel-toast {
  pointer-events: auto; min-width: 280px; max-width: 360px;
  padding: 14px 16px; border-radius: var(--radius);
  background: var(--card-solid);
  border: 1px solid rgba(61, 200, 255, 0.45);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
  transform: translateX(120%); opacity: 0;
  transition: all 0.35s var(--ease);
  display: grid; gap: 4px; position: relative;
}
.panel-toast.show { transform: translateX(0); opacity: 1; }
.panel-toast strong { color: var(--success); font-size: 0.88rem; }
.panel-toast span { color: var(--text-2); font-size: 0.82rem; line-height: 1.4; }
.panel-toast button {
  position: absolute; top: 8px; right: 10px; border: none; background: transparent;
  color: var(--muted); cursor: pointer; font-size: 1.1rem;
}

.bell-wrap { position: relative; }
.bell-badge {
  position: absolute; top: -4px; right: -4px;
  width: 16px; height: 16px; border-radius: 50%;
  background: var(--danger); color: #fff;
  font-size: 0.65rem; font-weight: 800;
  display: none; align-items: center; justify-content: center;
}
.bell-menu {
  display: none; position: absolute; top: calc(100% + 8px); right: 0;
  width: min(320px, 90vw); max-height: 360px; overflow-y: auto;
  background: var(--card-solid);
  border: 1px solid var(--border-hi);
  border-radius: var(--radius);
  box-shadow: 0 20px 56px rgba(0, 0, 0, 0.55);
  z-index: 100;
}
.bell-menu.open { display: block; }
.bell-item {
  padding: 12px 14px; border-bottom: 1px solid var(--border);
  display: grid; gap: 4px;
}
.bell-item strong { font-size: 0.82rem; color: var(--success); }
.bell-item span { font-size: 0.78rem; color: var(--text-2); }
.bell-item time { font-size: 0.7rem; color: var(--muted); }
.bell-empty { padding: 20px; text-align: center; color: var(--muted); font-size: 0.85rem; }

.rank-row { margin-bottom: 14px; }
.rank-row:last-child { margin-bottom: 0; }
.rank-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.rank-info { flex: 1; min-width: 0; }
.rank-name { display: block; font-weight: 700; font-size: 0.88rem; }
.rank-meta { display: block; font-size: 0.72rem; color: var(--muted); margin-top: 2px; }
.rank-bar {
  height: 6px; border-radius: 999px;
  background: rgba(255, 255, 255, 0.06); overflow: hidden;
}
.rank-bar span {
  display: block; height: 100%; border-radius: 999px;
  background: linear-gradient(90deg, var(--primary), #5ee4a8);
  transition: width 0.5s var(--ease);
}
.product-rank.rank-gold { background: rgba(255, 200, 87, 0.2); color: #ffc857; }
.product-rank.rank-silver { background: rgba(148, 163, 184, 0.15); color: #cbd5e1; }
.product-rank.rank-bronze { background: rgba(255, 140, 80, 0.15); color: #fdba74; }

/* 3D glass — painel */
.panel-scene-wrap--app { opacity: 0.35; mask-image: radial-gradient(ellipse 80% 70% at 70% 20%, black, transparent 75%); }
.glass-3d {
  background: rgba(8, 8, 14, 0.72);
  border: 1px solid rgba(37, 211, 102, 0.22);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.06) inset,
    0 24px 80px rgba(0, 0, 0, 0.55),
    0 0 40px rgba(37, 211, 102, 0.08);
  backdrop-filter: blur(22px) saturate(1.2);
  transform-style: preserve-3d;
}
.content:has(.tg-workspace) { padding: 12px 16px 8px; max-width: none; }

/* Telegram inbox */
.tg-workspace {
  display: grid;
  grid-template-columns: minmax(280px, 340px) 1fr;
  gap: 14px;
  height: calc(100vh - 148px);
  min-height: 480px;
}
@media (max-width: 900px) {
  .tg-workspace { grid-template-columns: 1fr; height: auto; }
  .tg-chat { min-height: 420px; }
}
.tg-threads {
  display: flex; flex-direction: column;
  border-radius: var(--radius-lg);
  overflow: hidden;
  min-height: 0;
}
.tg-threads-head {
  padding: 16px 18px 10px;
  display: flex; align-items: baseline; justify-content: space-between; gap: 8px;
  border-bottom: 1px solid var(--border);
}
.tg-threads-head h2 { font-family: var(--font-display); font-size: 1.1rem; display: flex; align-items: center; gap: 8px; }
.tg-threads-hint { font-size: 0.68rem; color: var(--accent-sky); text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; }
.tg-search-wrap { padding: 10px 12px; border-bottom: 1px solid var(--border); }
.tg-search-wrap input {
  width: 100%; padding: 10px 14px; border-radius: 12px;
  border: 1px solid var(--border);
  background: rgba(0, 0, 0, 0.45);
  color: var(--text);
}
.tg-thread-list { flex: 1; overflow-y: auto; min-height: 0; }
.tg-thread {
  width: 100%; text-align: left; border: none; cursor: pointer;
  display: flex; gap: 12px; align-items: flex-start;
  padding: 14px 16px;
  background: transparent;
  color: var(--text);
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  transition: background 0.2s var(--ease), transform 0.2s;
}
.tg-thread:hover { background: rgba(37, 211, 102, 0.08); }
.tg-thread.is-active {
  background: linear-gradient(90deg, rgba(37, 211, 102, 0.18), transparent);
  box-shadow: inset 3px 0 0 var(--primary);
}
.tg-avatar {
  width: 44px; height: 44px; border-radius: 50%; flex-shrink: 0;
  display: grid; place-items: center;
  font-weight: 800; font-size: 0.85rem;
  background: linear-gradient(135deg, var(--primary), var(--accent-violet));
  box-shadow: 0 8px 24px rgba(37, 211, 102, 0.35);
}
.tg-avatar--lg { width: 52px; height: 52px; font-size: 1rem; }
.tg-thread-body { flex: 1; min-width: 0; }
.tg-thread-top { display: flex; justify-content: space-between; gap: 8px; align-items: center; }
.tg-thread-top strong { font-size: 0.92rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tg-thread-top time { font-size: 0.68rem; color: var(--muted); flex-shrink: 0; }
.tg-thread-sub { font-size: 0.72rem; color: var(--muted); margin-top: 2px; }
.tg-thread-preview { font-size: 0.8rem; color: var(--text-2); margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tg-you { color: var(--accent-sky); }
.tg-badge {
  font-size: 0.65rem; font-weight: 800; padding: 3px 7px; border-radius: 999px;
  background: var(--primary); color: #fff; align-self: center;
}
.tg-chat {
  display: flex; flex-direction: column;
  border-radius: var(--radius-lg);
  overflow: hidden;
  min-height: 0;
}
.tg-chat-head {
  padding: 14px 18px;
  border-bottom: 1px solid var(--border);
  background: rgba(0, 0, 0, 0.35);
}
.tg-chat-head-active, .tg-chat-head-placeholder {
  display: flex; align-items: center; gap: 14px;
}
.tg-chat-head-active span, .tg-chat-head-placeholder span { display: block; font-size: 0.8rem; color: var(--muted); margin-top: 2px; }
.tg-messages {
  flex: 1; overflow-y: auto; min-height: 0;
  padding: 20px 18px;
  display: flex; flex-direction: column; gap: 10px;
  background:
    radial-gradient(ellipse 50% 40% at 100% 0%, rgba(0, 212, 255, 0.06), transparent),
    radial-gradient(ellipse 40% 30% at 0% 100%, rgba(37, 211, 102, 0.08), transparent),
    repeating-linear-gradient(0deg, transparent, transparent 28px, rgba(255,255,255,0.02) 28px, rgba(255,255,255,0.02) 29px);
}
.tg-empty-chat {
  flex: 1; display: grid; place-items: center; text-align: center;
  color: var(--muted); padding: 40px;
  position: relative;
}
.tg-empty-orbit {
  width: 120px; height: 120px; border-radius: 50%;
  border: 2px solid rgba(37, 211, 102, 0.25);
  box-shadow: 0 0 60px rgba(37, 211, 102, 0.2);
  animation: tg-spin 8s linear infinite;
  margin-bottom: 16px;
}
@keyframes tg-spin { to { transform: rotate(360deg); } }
.tg-loading { padding: 24px; text-align: center; color: var(--muted); font-size: 0.88rem; }
.tg-bubble { max-width: 78%; display: flex; flex-direction: column; gap: 4px; animation: tg-in 0.25s var(--ease); }
@keyframes tg-in { from { opacity: 0; transform: translateY(8px); } }
.tg-bubble--in { align-self: flex-start; }
.tg-bubble--out { align-self: flex-end; }
.tg-bubble--system { align-self: center; max-width: 92%; }
.tg-bubble--system span {
  font-size: 0.72rem; color: var(--muted); padding: 6px 12px;
  background: rgba(255, 255, 255, 0.05); border-radius: 999px;
}
.tg-bubble-meta { font-size: 0.68rem; color: var(--muted); padding: 0 6px; }
.tg-bubble-text {
  padding: 10px 14px; border-radius: 16px; font-size: 0.9rem; line-height: 1.45;
  word-break: break-word;
}
.tg-bubble--in .tg-bubble-text {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-bottom-left-radius: 4px;
}
.tg-bubble--out .tg-bubble-text {
  background: linear-gradient(135deg, rgba(37, 211, 102, 0.9), rgba(52, 211, 153, 0.75));
  border-bottom-right-radius: 4px;
  box-shadow: 0 8px 28px rgba(37, 211, 102, 0.25);
}
`;
