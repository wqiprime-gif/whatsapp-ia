/** TEXTURA-style: preto · branco · verde WhatsApp + raios CSS */
export const premiumStyles = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Instrument+Sans:wght@400;500;600;700&display=swap');

:root {
  --font-display: 'Bricolage Grotesque', system-ui, sans-serif;
  --font: 'Instrument Sans', system-ui, sans-serif;
  --green: #25D366;
  --green-bright: #3de07a;
  --green-glow: rgba(37, 211, 102, 0.5);
}

#panel-scene-canvas {
  position: fixed; inset: 0; width: 100%; height: 100%;
  z-index: 0; pointer-events: none;
}

.light-rays {
  position: fixed; inset: 0; z-index: 0; pointer-events: none;
  overflow: hidden;
  background: #030508;
}
.light-rays::before,
.light-rays::after {
  content: "";
  position: absolute;
  width: 200%; height: 200%;
  top: -50%; left: -50%;
  background: conic-gradient(
    from 0deg at 50% 50%,
    transparent 0deg,
    rgba(37, 211, 102, 0.14) 25deg,
    transparent 50deg,
    rgba(52, 211, 153, 0.08) 90deg,
    transparent 130deg,
    rgba(37, 211, 102, 0.1) 200deg,
    transparent 360deg
  );
  animation: rays-spin 40s linear infinite;
}
.light-rays::after {
  animation-direction: reverse;
  animation-duration: 55s;
  opacity: 0.6;
}
@keyframes rays-spin { to { transform: rotate(360deg); } }
.auth-body .light-rays::before,
.auth-body .light-rays::after { opacity: 0.35; animation-duration: 80s; }
.auth-body #panel-scene-canvas { opacity: 0.35 !important; }

.mesh-blob {
  position: fixed; inset: 0; z-index: 1; pointer-events: none;
  background:
    radial-gradient(ellipse 50% 40% at 20% 10%, rgba(37, 211, 102, 0.25), transparent 55%),
    radial-gradient(ellipse 40% 35% at 85% 20%, rgba(52, 211, 153, 0.12), transparent 50%),
    radial-gradient(ellipse 60% 50% at 50% 100%, rgba(37, 211, 102, 0.08), transparent 60%);
}
.mesh-blob--app { opacity: 0.7; }

.auth-body { overflow-x: hidden; overflow-y: auto; min-height: 100vh; background: #030508; }
.auth-body .ambient { display: none; }

/* —— LOGIN —— */
.login-premium {
  position: relative; z-index: 3;
  min-height: 100vh;
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  align-items: center;
  gap: 56px;
  padding: 48px 64px;
  max-width: 1400px;
  margin: 0 auto;
  box-sizing: border-box;
}
@media (max-width: 1000px) {
  .login-premium {
    grid-template-columns: 1fr;
    padding: 28px 20px 40px;
    align-items: start;
    justify-items: center;
    min-height: auto;
  }
  .login-showcase { display: none; }
  .login-card-wrap {
    width: 100%;
    max-width: 400px;
    margin: 0 auto;
    align-self: start;
  }
}

.login-showcase .brand-mark { margin-bottom: 8px; }
.login-eyebrow {
  font-size: 0.72rem; font-weight: 700; letter-spacing: 0.2em;
  text-transform: uppercase; color: var(--green-bright);
  margin-bottom: 20px;
}
.login-showcase h1 {
  font-family: var(--font-display);
  font-size: clamp(2.2rem, 4.5vw, 3.2rem);
  font-weight: 800; line-height: 1.08;
  letter-spacing: -0.04em;
  color: #fff;
  margin-bottom: 24px;
}
.login-showcase h1.login-title-3d {
  font-family: var(--font-display);
  font-size: clamp(2.2rem, 4.5vw, 3.2rem);
  font-weight: 800; line-height: 1.08;
  letter-spacing: -0.04em;
  color: #fff;
  margin-bottom: 24px;
}
.text-3d-line {
  display: block;
  transform: perspective(900px) rotateX(10deg) translateZ(0);
  transform-origin: left center;
  background: linear-gradient(180deg, #ffffff 0%, #b8d4ff 45%, #5b9fff 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 2px 0 #0a3080) drop-shadow(0 4px 0 #061840) drop-shadow(0 12px 24px rgba(0,0,0,0.45));
  animation: text3d-float 5s ease-in-out infinite;
}
.text-3d-line.accent {
  font-size: 0.92em;
  background: linear-gradient(180deg, #e8fff0 0%, #4ade80 55%, #25D366 100%);
  -webkit-background-clip: text;
  background-clip: text;
  filter: drop-shadow(0 2px 0 #082060) drop-shadow(0 6px 0 #041030) drop-shadow(0 0 32px rgba(10,92,255,0.4));
}
@keyframes text3d-float {
  0%, 100% { transform: perspective(900px) rotateX(10deg) translateY(0); }
  50% { transform: perspective(900px) rotateX(8deg) translateY(-3px); }
}

.bot-check-grid { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 8px; }
.bot-check {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 14px; border-radius: 10px;
  background: rgba(37, 211, 102, 0.08);
  border: 1px solid rgba(37, 211, 102, 0.22);
  font-size: 0.85rem; cursor: pointer;
}
.bot-check input { width: auto; accent-color: var(--green); }

.rmk-instance-toolbar { display: flex; gap: 8px; margin: 10px 0 4px; flex-wrap: wrap; }
.seq-head-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 16px 0 10px; flex-wrap: wrap; }
.seq-head-row h4 { margin: 0; font-size: 0.9rem; }
.seq-msg-block { margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid rgba(10,92,255,0.12); }
.seq-msg-block .seq-remove { margin-top: 6px; }
.rmk-leads-details { margin: 16px 0; }
.rmk-leads-details summary { cursor: pointer; font-weight: 600; margin-bottom: 10px; color: var(--text); }

.gift-grid { display: grid; gap: 12px; margin-top: 16px; }
.gift-card {
  padding: 14px 16px; border-radius: 12px;
  background: rgba(37, 211, 102, 0.06);
  border: 1px solid rgba(37, 211, 102, 0.2);
}
.gift-card-head { display: flex; gap: 12px; align-items: flex-start; }
.gift-badge { color: var(--green-bright); }
.gift-ask-preview { margin: 10px 0 8px; font-size: 0.9rem; color: var(--muted); line-height: 1.5; }
.gift-add-row {
  display: grid; gap: 10px; margin-bottom: 14px; padding-bottom: 14px;
  border-bottom: 1px dashed rgba(10,92,255,0.2);
}
@media (min-width: 720px) {
  .gift-add-row { grid-template-columns: 1fr 1.4fr auto; align-items: end; }
}
.gift-prompt-field { min-height: 120px; font-size: 0.95rem; line-height: 1.55; }
.schedule-block {
  margin-top: 8px; padding-top: 12px;
  border-top: 1px solid rgba(10,92,255,0.15);
}
.schedule-mode-row { display: flex; flex-wrap: wrap; gap: 10px; }

.form-section-preview {
  border-color: rgba(52, 211, 153, 0.28) !important;
  background: rgba(52, 211, 153, 0.06) !important;
}
.form-section-icon-cyan { color: #34d399; }
.preview-url-list {
  list-style: none; margin: 12px 0 16px; padding: 0;
  display: grid; gap: 8px;
}
.preview-url-item {
  display: flex; flex-wrap: wrap; align-items: center; gap: 10px;
  padding: 10px 12px; border-radius: 10px;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.08);
}
.preview-url-link {
  color: var(--green-bright);
  font-size: 0.85rem;
  font-family: var(--font-mono);
  word-break: break-all;
}
.preview-upload-grid {
  display: grid; gap: 14px;
}
@media (min-width: 720px) {
  .preview-upload-grid { grid-template-columns: 1fr 1fr; }
}

.login-showcase h1 span {
  color: var(--green-bright);
  text-shadow: 0 0 60px var(--green-glow);
}
.login-prose {
  font-size: 1.05rem; line-height: 1.8;
  color: rgba(255, 255, 255, 0.82);
  max-width: 540px;
  margin-bottom: 28px;
  letter-spacing: 0.01em;
}
.login-prose strong { color: #fff; font-weight: 700; }
.login-capabilities {
  list-style: none;
  display: grid; gap: 12px;
  max-width: 520px;
}
.login-capabilities li {
  display: flex; align-items: flex-start; gap: 12px;
  font-size: 0.9rem; color: rgba(255,255,255,0.8);
  line-height: 1.5;
}
.login-capabilities li::before {
  content: "";
  width: 8px; height: 8px; margin-top: 7px; flex-shrink: 0;
  border-radius: 2px;
  background: var(--green);
  box-shadow: 0 0 12px var(--green-glow);
}

.login-card-wrap { position: relative; display: flex; justify-content: center; align-items: center; width: 100%; }
.login-card-glow {
  position: absolute;
  width: min(420px, 92vw); height: min(480px, 90vh);
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  border-radius: 28px;
  background: conic-gradient(from 120deg, #25D366, #34d399, #25D36644, #25D366);
  filter: blur(56px);
  opacity: 0.42;
  animation: glow-spin 14s linear infinite;
  pointer-events: none;
}
@keyframes glow-spin { to { transform: translate(-50%, -50%) rotate(360deg); } }

.login-card-premium {
  position: relative;
  width: min(400px, 92vw);
  padding: 36px 32px 30px;
  border-radius: 22px;
  background: linear-gradient(165deg, rgba(14, 22, 42, 0.94) 0%, rgba(6, 10, 22, 0.98) 55%, rgba(8, 14, 30, 0.96) 100%);
  backdrop-filter: blur(28px) saturate(1.25);
  -webkit-backdrop-filter: blur(28px) saturate(1.25);
  border: 1px solid rgba(37, 211, 102, 0.38);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.07) inset,
    0 28px 72px rgba(0, 0, 0, 0.55),
    0 0 48px rgba(37, 211, 102, 0.18);
  overflow: hidden;
}
.login-card-premium::after {
  content: "";
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 3px;
  background: linear-gradient(90deg, transparent, #25D366, #34d399, #25D366, transparent);
  opacity: 0.85;
}
.login-card-premium h2 {
  font-family: var(--font-display);
  font-size: 1.7rem; font-weight: 800;
  color: #ffffff;
  letter-spacing: -0.03em;
  margin-bottom: 6px;
}
.login-card-premium .sub {
  color: #94a3b8;
  margin-bottom: 26px;
  font-size: 0.9rem;
  line-height: 1.45;
}

.auth-body .login-card-premium label.field {
  color: #c5d2ea !important;
  font-size: 0.78rem !important;
  font-weight: 600 !important;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  gap: 8px !important;
  margin-bottom: 16px !important;
}
.auth-body .login-card-premium .field-label {
  color: #c5d2ea !important;
  font-size: 0.78rem !important;
  font-weight: 600 !important;
  text-transform: uppercase;
  letter-spacing: 0.07em;
}
.auth-body .login-card-premium label.field input,
.auth-body .login-card-premium label.field textarea {
  background: rgba(0, 0, 0, 0.38) !important;
  border: 1px solid rgba(255, 255, 255, 0.14) !important;
  border-radius: 12px !important;
  padding: 14px 16px !important;
  color: #f1f5f9 !important;
  font-size: 0.95rem !important;
  text-transform: none;
  letter-spacing: normal;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2) inset;
}
.auth-body .login-card-premium label.field input::placeholder {
  color: #64748b !important;
  opacity: 1;
}
.auth-body .login-card-premium label.field input:focus {
  border-color: rgba(37, 211, 102, 0.75) !important;
  box-shadow: 0 0 0 3px rgba(37, 211, 102, 0.25), 0 0 24px rgba(37, 211, 102, 0.15) !important;
  outline: none !important;
}
.auth-body .login-card-premium label.field input:-webkit-autofill,
.auth-body .login-card-premium label.field input:-webkit-autofill:hover,
.auth-body .login-card-premium label.field input:-webkit-autofill:focus {
  -webkit-box-shadow: 0 0 0 1000px rgba(0, 0, 0, 0.45) inset !important;
  -webkit-text-fill-color: #f1f5f9 !important;
  caret-color: #f1f5f9;
  border: 1px solid rgba(255, 255, 255, 0.14) !important;
}
.auth-body .login-card-premium .auth-form .field {
  margin-bottom: 12px !important;
}
.auth-body .login-card-premium label.field small {
  display: block;
  margin-top: 6px;
  color: #7d8dab !important;
  font-size: 0.76rem !important;
  text-transform: none;
  letter-spacing: normal;
  font-weight: 500;
}
.auth-body .login-card-premium .alert {
  margin-bottom: 18px;
  font-size: 0.86rem;
}
.auth-footer {
  margin-top: 22px;
  padding-top: 18px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  text-align: center;
  font-size: 0.88rem;
  color: #8b9cb8;
  line-height: 1.5;
}
.auth-footer a {
  color: #5b9fff;
  font-weight: 600;
  text-decoration: none;
  transition: color 0.2s;
}
.auth-footer a:hover { color: #8ec0ff; }

.btn-glow {
  margin-top: 8px;
  padding: 15px 24px !important;
  font-family: var(--font-display) !important;
  font-weight: 700 !important;
  font-size: 0.92rem !important;
  border-radius: 12px !important;
  background: linear-gradient(135deg, #25D366, #3de07a) !important;
  color: #fff !important;
  border: none !important;
  box-shadow: 0 12px 40px rgba(37, 211, 102, 0.45) !important;
  transition: transform 0.2s, box-shadow 0.2s !important;
}
.btn-glow:hover {
  transform: translateY(-2px);
  box-shadow: 0 16px 48px rgba(37, 211, 102, 0.55) !important;
}

/* —— DASHBOARD —— */
.dash-shell { position: relative; z-index: 2; }

.dash-hero-pro {
  position: relative;
  padding: 32px 36px;
  margin-bottom: 28px;
  border-radius: 20px;
  overflow: hidden;
  background: linear-gradient(135deg, rgba(37, 211, 102, 0.18) 0%, rgba(3, 5, 8, 0.95) 45%, rgba(0, 0, 0, 0.6) 100%);
  border: 1px solid rgba(37, 211, 102, 0.28);
  box-shadow: 0 0 80px rgba(37, 211, 102, 0.08), inset 0 1px 0 rgba(255,255,255,0.08);
  display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 24px;
  animation: rise-in 0.6s var(--ease) both;
}
.dash-hero-pro::before {
  content: "";
  position: absolute; inset: 0;
  background: linear-gradient(90deg, transparent, rgba(10,92,255,0.06), transparent);
  animation: shimmer 4s ease-in-out infinite;
}
@keyframes shimmer {
  0%, 100% { opacity: 0.3; transform: translateX(-30%); }
  50% { opacity: 1; transform: translateX(30%); }
}
.dash-hero-pro .eyebrow {
  font-size: 0.68rem; font-weight: 700; letter-spacing: 0.18em;
  text-transform: uppercase; color: var(--green-bright);
  margin-bottom: 8px;
}
.dash-hero-pro h2 {
  font-family: var(--font-display);
  font-size: clamp(1.6rem, 3vw, 2.2rem);
  font-weight: 800; letter-spacing: -0.03em;
  color: #fff; margin-bottom: 8px;
}
.dash-hero-pro p { color: var(--text-2); font-size: 0.92rem; max-width: 560px; line-height: 1.6; }
.dash-hero-actions { display: flex; gap: 10px; flex-wrap: wrap; z-index: 1; }

.metrics-bento {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}
.metric-kpi {
  grid-column: span 3;
  position: relative;
  padding: 24px 22px;
  border-radius: 18px;
  background: rgba(6, 10, 18, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.07);
  backdrop-filter: blur(20px);
  overflow: hidden;
  transition: transform 0.3s, border-color 0.3s, box-shadow 0.3s;
  animation: rise-in 0.55s var(--ease) both;
}
.metric-kpi:nth-child(1) { animation-delay: 0.05s; }
.metric-kpi:nth-child(2) { animation-delay: 0.1s; }
.metric-kpi:nth-child(3) { animation-delay: 0.15s; }
.metric-kpi:nth-child(4) { animation-delay: 0.2s; }
.metric-kpi::before {
  content: "";
  position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
  background: linear-gradient(180deg, var(--green-bright), transparent);
  border-radius: 3px 0 0 3px;
}
.metric-kpi::after {
  content: "";
  position: absolute; top: -40%; right: -20%;
  width: 80%; height: 80%;
  background: radial-gradient(circle, rgba(10,92,255,0.15), transparent 70%);
  pointer-events: none;
}
.metric-kpi:hover {
  transform: translateY(-6px);
  border-color: rgba(37, 211, 102, 0.35);
  box-shadow: 0 24px 60px rgba(37, 211, 102, 0.15);
}
.metric-kpi .stat-label {
  font-size: 0.72rem; font-weight: 600; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--muted);
  margin-bottom: 10px;
}
.metric-kpi .stat-value {
  font-family: var(--font-display) !important;
  font-size: 2.35rem !important;
  font-weight: 800 !important;
  letter-spacing: -0.04em !important;
  color: #fff !important;
  line-height: 1 !important;
  background: none !important;
  -webkit-text-fill-color: #fff !important;
}
.metric-kpi .stat-value.accent { color: var(--green-bright) !important; -webkit-text-fill-color: var(--green-bright) !important; }
.metric-kpi .stat-delta { font-size: 0.78rem; color: var(--text-2); margin-top: 10px; }
.metric-kpi .stat-icon {
  position: absolute; top: 20px; right: 20px;
  width: 44px; height: 44px; border-radius: 12px;
  display: grid; place-items: center;
  background: rgba(37, 211, 102, 0.15);
  border: 1px solid rgba(37, 211, 102, 0.25);
  color: var(--green-bright);
}
@media (max-width: 1100px) {
  .metric-kpi { grid-column: span 6; }
}
@media (max-width: 600px) {
  .metric-kpi { grid-column: span 12; }
}

.dash-bento {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
}
@media (max-width: 1000px) { .dash-bento { grid-template-columns: 1fr; } }

.card-premium {
  border-radius: 18px !important;
  background: rgba(6, 10, 18, 0.82) !important;
  border: 1px solid rgba(255, 255, 255, 0.07) !important;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255,255,255,0.05) !important;
  backdrop-filter: blur(22px) !important;
  animation: rise-in 0.6s var(--ease) 0.15s both;
}
.card-premium .card-head {
  border-bottom: 1px solid rgba(255, 255, 255, 0.06) !important;
  padding: 18px 22px !important;
}
.card-premium .card-head h3 {
  font-family: var(--font-display) !important;
  font-weight: 700 !important;
  font-size: 0.95rem !important;
  letter-spacing: -0.02em !important;
}

.sidebar {
  background: rgba(2, 5, 12, 0.94) !important;
  border-right: 1px solid rgba(37, 211, 102, 0.2) !important;
  box-shadow: 8px 0 48px rgba(0, 0, 0, 0.4) !important;
}
.btn-new {
  background: linear-gradient(135deg, #25D366, #3de07a) !important;
  box-shadow: 0 8px 32px rgba(37, 211, 102, 0.4) !important;
  border: 1px solid rgba(255,255,255,0.15) !important;
}
.nav a.active {
  background: rgba(37, 211, 102, 0.12) !important;
  color: var(--green-bright) !important;
  border-color: rgba(37, 211, 102, 0.35) !important;
  box-shadow: 0 0 24px rgba(37, 211, 102, 0.1) !important;
}
.topbar {
  background: rgba(3, 6, 12, 0.8) !important;
  border-bottom: 1px solid rgba(37, 211, 102, 0.15) !important;
}
.brand-accent { color: var(--green-bright) !important; text-shadow: 0 0 32px var(--green-glow) !important; }

.chart-wrap .chart-svg polyline { stroke: var(--green-bright) !important; }
.chart-wrap .chart-svg path { fill: rgba(37, 211, 102, 0.15) !important; }

/* Telegram chat — verde */
.tg-bubble--out .tg-bubble-text {
  background: linear-gradient(135deg, #25D366, #3de07a) !important;
  box-shadow: 0 8px 28px rgba(37, 211, 102, 0.3) !important;
}
.tg-threads-hint { color: var(--green-bright) !important; }

/* Lightning login */
#login-particles-canvas {
  position: fixed; inset: 0; z-index: 2; pointer-events: none;
  width: 100%; height: 100%;
}
#login-lightning-canvas {
  position: fixed; inset: 0; width: 100%; height: 100%;
  z-index: 2; pointer-events: none;
}
body.thunder-flash .mesh-blob { opacity: 1.2; filter: brightness(1.35); }

/* Nav performance */
.panel-nav-progress {
  position: fixed; top: 0; left: 0; right: 0; height: 3px; z-index: 9999;
  background: transparent; pointer-events: none;
}
.panel-nav-progress::after {
  content: "";
  display: block; height: 100%; width: 0;
  background: linear-gradient(90deg, #25D366, #34d399);
  box-shadow: 0 0 16px rgba(37, 211, 102, 0.8);
  transition: width 0.15s ease;
}
.panel-nav-progress.active::after {
  width: 70%;
  animation: nav-progress 0.8s ease forwards;
}
@keyframes nav-progress {
  to { width: 100%; opacity: 0; }
}
.content.content-loading { opacity: 0.85; transition: opacity 0.12s; }

/* Dashboard charts */
.dash-charts-hero {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 16px;
  margin-bottom: 20px;
}
@media (max-width: 1000px) { .dash-charts-hero { grid-template-columns: 1fr; } }
.chart-card-pro { overflow: hidden; }
.chart-card-pro .card-head {
  display: flex; align-items: center; justify-content: space-between;
}
.chart-badge {
  font-family: var(--font-display);
  font-size: 0.82rem; font-weight: 700;
  color: var(--green-bright);
  padding: 4px 10px; border-radius: 8px;
  background: rgba(37, 211, 102, 0.12);
  border: 1px solid rgba(37, 211, 102, 0.25);
}
.chart-wrap--hero { min-height: 220px; padding: 8px 4px 0 !important; }
.chart-pro { width: 100%; }
.chart-svg--pro { width: 100%; height: auto; display: block; }
.chart-line-anim {
  stroke-dasharray: 800;
  stroke-dashoffset: 800;
  animation: chart-draw 1.2s ease forwards;
}
@keyframes chart-draw { to { stroke-dashoffset: 0; } }
.chart-dot { animation: chart-pop 0.4s ease both; }
@keyframes chart-pop {
  from { opacity: 0; transform: scale(0); }
  to { opacity: 1; transform: scale(1); }
}
.chart-bar-anim {
  transform-origin: bottom;
  animation: bar-rise 0.55s ease both;
}
@keyframes bar-rise {
  from { transform: scaleY(0); opacity: 0.4; }
  to { transform: scaleY(1); opacity: 1; }
}

.dash-analytics-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}
.dash-analytics-row--2 { grid-template-columns: repeat(2, 1fr); }
@media (max-width: 1100px) { .dash-analytics-row { grid-template-columns: 1fr; } }

.src-bars { display: grid; gap: 12px; }
.src-bar-row {
  display: grid;
  grid-template-columns: 88px 1fr 36px;
  align-items: center; gap: 10px;
}
.src-bar-label { font-size: 0.78rem; color: var(--text-2); }
.src-bar-track {
  height: 8px; border-radius: 99px;
  background: rgba(255,255,255,0.06);
  overflow: hidden;
}
.src-bar-fill {
  height: 100%; border-radius: 99px;
  background: linear-gradient(90deg, #25D366, #34d399);
  animation: bar-rise 0.6s ease both;
}
.src-bar-val { font-size: 0.78rem; font-weight: 700; color: #fff; text-align: right; }

/* —— PAGE SHELL (formulários full-width) —— */
.page-form-shell {
  width: 100%;
  max-width: none;
  animation: rise-in 0.5s var(--ease) both;
}
.page-form-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
  margin-bottom: 22px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--border);
}
.page-eyebrow {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--green-bright);
  margin-bottom: 6px;
}
.page-form-title {
  font-family: var(--font-display);
  font-size: clamp(1.35rem, 2.5vw, 1.75rem);
  font-weight: 800;
  letter-spacing: -0.03em;
  margin-bottom: 6px;
}
.page-form-desc {
  font-size: 0.88rem;
  color: var(--text-2);
  max-width: 720px;
  line-height: 1.55;
}
.page-form-shell .field input,
.page-form-shell .field textarea,
.page-form-shell .field select {
  background: rgba(0, 0, 0, 0.45);
  border-color: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
}
.page-form-shell .field input:focus,
.page-form-shell .field textarea:focus,
.page-form-shell .field select:focus {
  border-color: rgba(37, 211, 102, 0.6);
  box-shadow: 0 0 0 3px rgba(37, 211, 102, 0.15), 0 0 24px rgba(37, 211, 102, 0.1);
}
.card-premium {
  border-color: rgba(37, 211, 102, 0.15) !important;
  background: rgba(6, 12, 10, 0.9) !important;
}
.card-premium .card-head {
  background: rgba(0, 0, 0, 0.2);
}

/* —— KPI STRIP + LIVE FEED —— */
.kpi-strip {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 14px;
  margin-bottom: 20px;
}
@media (max-width: 1200px) {
  .kpi-strip { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 700px) {
  .kpi-strip { grid-template-columns: 1fr 1fr; }
}
.kpi-card-pro {
  padding: 18px 18px 14px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: linear-gradient(165deg, rgba(6, 12, 10, 0.95), rgba(0, 0, 0, 0.5));
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
  transition: transform 0.25s, border-color 0.25s;
  animation: rise-in 0.5s var(--ease) both;
}
.kpi-card-pro:hover {
  transform: translateY(-3px);
  border-color: rgba(37, 211, 102, 0.28);
}
.kpi-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.kpi-label {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  display: flex;
  align-items: center;
  gap: 6px;
}
.kpi-label svg { width: 14px; height: 14px; opacity: 0.85; }
.kpi-trend {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 99px;
}
.kpi-trend.positive { color: #6ee7b7; background: rgba(37, 211, 102, 0.12); }
.kpi-trend.negative { color: #fca5a5; background: rgba(255, 77, 109, 0.12); }
.kpi-value {
  font-family: var(--font-display);
  font-size: 1.65rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  margin-bottom: 10px;
  line-height: 1.1;
}
.kpi-value.accent { color: var(--green-bright); }
.kpi-sparkline { width: 100%; height: 36px; display: block; }
.dash-hero-compact {
  padding: 22px 28px !important;
  margin-bottom: 20px !important;
}
.dash-hero-compact h2 { font-size: 1.35rem !important; margin-bottom: 4px !important; }
.dash-hero-compact p { font-size: 0.85rem !important; }
.live-pulse {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--green-bright);
  box-shadow: 0 0 0 0 rgba(37, 211, 102, 0.6);
  animation: live-pulse 1.8s ease infinite;
  margin-right: 8px;
  vertical-align: middle;
}
@keyframes live-pulse {
  0% { box-shadow: 0 0 0 0 rgba(37, 211, 102, 0.55); }
  70% { box-shadow: 0 0 0 8px rgba(37, 211, 102, 0); }
  100% { box-shadow: 0 0 0 0 rgba(37, 211, 102, 0); }
}
.live-badge {
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--green-bright);
  padding: 4px 10px;
  border-radius: 99px;
  background: rgba(37, 211, 102, 0.12);
  border: 1px solid rgba(37, 211, 102, 0.25);
}
.card-live-feed .card-head h3 {
  display: flex;
  align-items: center;
}
.activity-feed-live { max-height: 420px; overflow-y: auto; }
.activity-feed-flash { animation: feed-flash 0.6s ease; }
@keyframes feed-flash {
  from { background: rgba(37, 211, 102, 0.08); }
  to { background: transparent; }
}

.dash-charts-hero--3 {
  grid-template-columns: 1.6fr 1fr 1fr !important;
}
@media (max-width: 1200px) {
  .dash-charts-hero--3 { grid-template-columns: 1fr !important; }
}
.chart-card-pro--wide { min-height: 280px; }
.dash-charts-secondary { margin-bottom: 20px; }
.donut-wrap { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.donut-svg { width: 140px; height: 140px; flex-shrink: 0; }
.donut-legend { display: grid; gap: 8px; flex: 1; min-width: 120px; }
.donut-legend-row { font-size: 0.82rem; color: var(--text-2); display: flex; align-items: center; gap: 8px; }
.donut-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.funnel-stack { display: grid; gap: 10px; padding: 8px 0; }
.funnel-stage {
  margin: 0 auto;
  padding: 12px 16px;
  border-radius: 10px;
  background: linear-gradient(90deg, rgba(37, 211, 102, 0.2), rgba(37, 211, 102, 0.05));
  border: 1px solid rgba(37, 211, 102, 0.2);
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  font-size: 0.85rem;
}
.funnel-stage strong { color: #fff; font-size: 1.1rem; }
.funnel-stage em { color: var(--green-bright); font-style: normal; font-weight: 700; }
.settings-single { max-width: 560px; }

.page-shell { max-width: 100%; }
.page-grid { gap: 20px; }
.table-pro th { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
.table-pro td { font-size: 0.88rem; }

.dash-bottom-pro {
  display: grid;
  grid-template-columns: 1.45fr 1fr;
  gap: 20px;
  margin-bottom: 16px;
  align-items: stretch;
}
@media (max-width: 1100px) { .dash-bottom-pro { grid-template-columns: 1fr; } }
.dash-table-card { min-height: 320px; }
.card-head-actions { display: flex; gap: 8px; align-items: center; }
.dash-status-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 24px;
  align-items: center;
  padding: 14px 20px;
  border-radius: 14px;
  background: rgba(6, 10, 18, 0.9);
  border: 1px solid rgba(37, 211, 102, 0.15);
  font-size: 0.82rem;
  color: var(--text-2);
}
.dash-status-item strong { color: #fff; font-weight: 700; }
.dash-status-item--ok { color: var(--green-bright); font-weight: 600; }
.dash-status-dot {
  display: inline-block;
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--green-bright);
  box-shadow: 0 0 10px rgba(37, 211, 102, 0.8);
  margin-right: 6px;
  animation: live-pulse-dot 2s ease-in-out infinite;
}
.chart-svg--bars { width: 100%; height: auto; max-height: 200px; display: block; }
`;
