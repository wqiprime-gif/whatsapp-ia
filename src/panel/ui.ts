import type { BotConfig } from "../bots.js";
import type { WaLiveStatus } from "../whatsapp-runtime.js";
import type { ActivityItem, BotSalesRank, UserSalesRank } from "../db/events.js";
import { playerTier } from "../db/events.js";
import { botInstanceForm, instancesTableHtml, previewConfigBlock } from "./bot-form.js";
import { icons } from "./icons.js";
import { alertHtml, appLayout, escapeHtml } from "./layout.js";
import { brandMarkHtml, FAVICON_LINK } from "./brand.js";
import { salesChartSvgFromData, messagesChartSvgFromData, sparklineSvg, chartDayValues, kpiTrendLabel, channelDonutSvg, salesFunnelHtml } from "./charts.js";
import { globalStyles } from "./styles.js";
import { panelSceneScript } from "./panel-scene.js";
import { loginLightningScript } from "./panel-lightning.js";
import { loginParticlesScript } from "./panel-auth-particles.js";
import { AI_PROVIDERS, OPENROUTER_FREE_MODELS, type AIProviderId } from "../lib/ai-providers.js";

export type DashboardData = {
  stats: {
    leads: number;
    salesTotalCents: number;
    salesCount: number;
    messagesToday: number;
  };
  chart: { day: string; totalCents: number }[];
  messagesChart: { day: string; count: number }[];
  activities: ActivityItem[];
  topBots: BotSalesRank[];
  topPlayers: UserSalesRank[];
};

const GLOW_SEQ = [
  { delay: "0.4s", cycle: "6.8s" },
  { delay: "2.3s", cycle: "8.1s" },
  { delay: "1.1s", cycle: "7.4s" },
  { delay: "3.6s", cycle: "9.2s" },
  { delay: "0.8s", cycle: "7.9s" },
  { delay: "4.2s", cycle: "8.6s" }
];
function glowStyle(i: number) {
  const t = GLOW_SEQ[i % GLOW_SEQ.length];
  return `--glow-delay:${t.delay};--glow-cycle:${t.cycle}`;
}

export function formatRelativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function moneyBrl(cents: number) {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

function moneyCompact(cents: number) {
  const v = cents / 100;
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(1).replace(".", ",")}k`;
  return moneyBrl(cents);
}

function userInitials(name: string, email: string) {
  const src = name.replace(/^@/, "").trim() || email.split("@")[0] || "U";
  return src.slice(0, 2).toUpperCase();
}

export function activityFeedHtml(activities: ActivityItem[]) {
  if (activities.length === 0) {
    return `<div class="empty" style="padding:20px 8px;font-size:0.85rem">
      Nenhuma atividade registrada ainda.<br/>
      <small style="color:var(--muted)">Vendas, leads e pagamentos aparecem aqui automaticamente.</small>
    </div>`;
  }

  const iconMap = {
    sale: { cls: "sale", icon: icons.sparkles },
    lead: { cls: "lead", icon: icons.users },
    receipt: { cls: "pay", icon: icons.card }
  } as const;

  return activities
    .map((item) => {
      const meta = iconMap[item.type];
      return `<div class="activity-item">
      <div class="activity-icon ${meta.cls}">${meta.icon}</div>
      <div class="activity-text"><strong>${escapeHtml(item.title)}</strong><br/>${escapeHtml(item.subtitle)}</div>
      <div class="activity-time">${formatRelativeTime(item.at)}</div>
    </div>`;
    })
    .join("");
}

export function topBotsRankingHtml(ranking: BotSalesRank[]) {
  if (ranking.length === 0) {
    return `<div class="empty" style="padding:20px 8px;font-size:0.85rem">
      Nenhuma venda por instância ainda.<br/>
      <small style="color:var(--muted)">O ranking aparece quando a primeira venda for confirmada.</small>
    </div>`;
  }

  const maxTotal = Math.max(...ranking.map((r) => r.totalCents), 1);
  const grandTotal = ranking.reduce((s, r) => s + r.totalCents, 0);

  return ranking
    .map((bot, i) => {
      const pct = Math.round((bot.totalCents / maxTotal) * 100);
      const share = grandTotal > 0 ? Math.round((bot.totalCents / grandTotal) * 100) : 0;
      const rankCls = i === 0 ? "rank-gold" : i === 1 ? "rank-silver" : i === 2 ? "rank-bronze" : "";
      return `<div class="rank-row">
      <div class="rank-header">
        <span class="product-rank ${rankCls}">${i + 1}</span>
        <div class="rank-info">
          <span class="rank-name">${escapeHtml(bot.name)}</span>
          <span class="rank-meta">${bot.salesCount} venda(s) · ${share}% do faturamento</span>
        </div>
        <span class="product-price">${moneyBrl(bot.totalCents)}</span>
      </div>
      <div class="rank-bar"><span style="width:${pct}%"></span></div>
    </div>`;
    })
    .join("");
}

export function topPlayersRankingHtml(ranking: UserSalesRank[], currentUserId?: string) {
  if (ranking.length === 0) {
    return `<div class="empty" style="padding:24px 8px;font-size:0.85rem;text-align:center">
      Nenhum player no ranking ainda.<br/>
      <small style="color:var(--muted)">A corrida começa na primeira venda confirmada na plataforma.</small>
    </div>`;
  }

  return ranking
    .map((player, i) => {
      const rankCls = i === 0 ? "top-player-row--gold" : i === 1 ? "top-player-row--silver" : i === 2 ? "top-player-row--bronze" : "";
      const isMe = currentUserId && player.userId === currentUserId;
      return `<div class="top-player-row ${rankCls}${isMe ? " top-player-row--me" : ""}">
        <div class="top-player-avatar">${escapeHtml(userInitials(player.displayName, player.email))}</div>
        <div>
          <span class="top-player-name">${escapeHtml(player.displayName)}<span class="top-player-rank">#${i + 1}</span>${isMe ? '<span class="top-player-you">você</span>' : ""}</span>
          <span class="top-player-tier">${playerTier(player.totalCents)}</span>
        </div>
        <div class="top-player-revenue">${moneyCompact(player.totalCents)}</div>
      </div>`;
    })
    .join("");
}

function activityFeed(activities: ActivityItem[]) {
  return activityFeedHtml(activities);
}

function topProducts(ranking: BotSalesRank[]) {
  return topBotsRankingHtml(ranking);
}

function connectedDevicesHtml(bots: BotConfig[], statuses: Record<string, WaLiveStatus>) {
  if (bots.length === 0) {
    return `<div class="empty" style="padding:16px 8px;font-size:0.85rem">Nenhuma instância cadastrada.</div>`;
  }
  const connected = bots.filter((b) => statuses[b.id] === "connected" || statuses[b.id] === "meta_ready").length;
  const statusLabel: Record<string, string> = {
    connected: "Conectado",
    paused: "Pausado",
    qr_pending: "Aguardando QR",
    starting: "Iniciando",
    offline: "Offline",
    disconnected: "Desconectado",
    error: "Erro",
    auth_failure: "Falha auth",
    meta_ready: "API Meta",
    meta_missing: "Meta incompleto"
  };
  const rows = bots
    .map((b) => {
      const st = statuses[b.id] || "offline";
      const on = st === "connected" || st === "meta_ready";
      const label = statusLabel[st] || st;
      return `<div class="device-card ${on ? "device-card--on" : "device-card--off"}">
        <div class="device-card-icon">
          <span class="device-card-glyph">${icons.phone}</span>
          <span class="device-card-dot ${on ? "device-card-dot--on" : ""}"></span>
        </div>
        <div class="device-card-body">
          <strong>${escapeHtml(b.name)}</strong>
          <span>WhatsApp Web · ${b.active ? "sessão ativa" : "pausada"}</span>
        </div>
        <div class="device-card-meta">
          <span class="device-pill ${on ? "device-pill--on" : ""}">${label}</span>
          <em>${on ? "online" : "offline"}</em>
        </div>
      </div>`;
    })
    .join("");
  return `<div class="devices-head"><span class="devices-count">${connected} / ${bots.length}</span> dispositivos conectados</div><div class="devices-grid">${rows}</div>`;
}

export function loginPage(message = "") {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  ${FAVICON_LINK}
  <title>Login · WhatsApp IA</title>
  <style>${globalStyles}</style>
</head>
<body class="auth-body">
  <div class="light-rays" aria-hidden="true"></div>
  <canvas id="login-lightning-canvas" aria-hidden="true"></canvas>
  <canvas id="login-particles-canvas" aria-hidden="true"></canvas>
  <canvas id="panel-scene-canvas" aria-hidden="true"></canvas>
  <div class="mesh-blob" aria-hidden="true"></div>
  <main class="login-premium">
    <section class="login-showcase">
      ${brandMarkHtml("Painel WhatsApp")}
      <p class="login-eyebrow">Painel profissional · WhatsApp</p>
      <h1 class="login-title-3d"><span class="text-3d-line">ZapManager</span><span class="text-3d-line accent">Vendas automatizadas com IA</span></h1>
      <p class="login-prose">
        Uma plataforma feita para quem vende no WhatsApp com escala: cada instância roda com
        <strong>prompt próprio</strong>, Pix automático, validação de comprovante,
        remarketing por instância, pedido de presentes e agendamento de campanhas — tudo em um só lugar.
      </p>
      <ul class="login-capabilities">
        <li>Várias instâncias por produto, com pacotes e IA configuráveis</li>
        <li>Remarketing com sequência de mensagens e delay entre envios</li>
        <li>Dashboard com vendas, leads ativos e atividade em tempo real</li>
      </ul>
    </section>
    <section class="login-card-wrap">
      <div class="login-card-glow" aria-hidden="true"></div>
      <div class="login-card-premium login-card-auth">
        <h2>Entrar</h2>
        <p class="sub">Acesse seu painel ZapManager</p>
        ${message ? alertHtml(message, "error") : ""}
        <form method="post" action="/login" class="auth-form">
          <label class="field">
            <span class="field-label">E-mail</span>
            <input name="email" type="email" placeholder="voce@email.com" required autofocus />
          </label>
          <label class="field">
            <span class="field-label">Senha</span>
            <input name="password" type="password" placeholder="Sua senha" required />
          </label>
          <button type="submit" class="btn btn-primary btn-block btn-glow">Entrar no painel</button>
        </form>
        <p class="auth-footer">
          Não tem conta? <a href="/register">Criar conta</a>
        </p>
      </div>
    </section>
  </main>
  <script>${panelSceneScript("auth")}</script>
  <script>${loginParticlesScript()}</script>
  <script>${loginLightningScript()}</script>
</body>
</html>`;
}

export function dashboardPage(
  bots: BotConfig[],
  data: DashboardData,
  message = "",
  isError = false,
  partial = false,
  userName = "Usuario",
  statuses: Record<string, WaLiveStatus> = {},
  currentUserId = "",
  userAvatar = ""
) {
  const active = bots.filter((b) => b.active).length;
  const connected = bots.filter((b) => statuses[b.id] === "connected" || statuses[b.id] === "meta_ready").length;
  const previews = bots.reduce((s, b) => s + b.previewMediaUrls.length, 0);
  const salesReais = (data.stats.salesTotalCents / 100).toFixed(2).replace(".", ",");
  const convRate =
    data.stats.leads > 0
      ? ((data.stats.salesCount / data.stats.leads) * 100).toFixed(1).replace(".", ",")
      : "0,0";

  const salesVals = chartDayValues(data.chart, (p) => p.totalCents / 100);
  const msgVals = chartDayValues(data.messagesChart, (p) => p.count);
  const salesTrend = kpiTrendLabel(salesVals);
  const msgTrend = kpiTrendLabel(msgVals);
  const leadsTrend = kpiTrendLabel(msgVals.map((v) => Math.round(v * 0.4)));
  const convTrend = kpiTrendLabel(
    salesVals.map((v, i) => (msgVals[i] > 0 ? (v > 0 ? 1 : 0) : 0))
  );

  const body = `
    <div class="dash-shell">
    ${message ? alertHtml(message, isError ? "error" : "success") : ""}

    <div class="kpi-strip">
      <div class="kpi-card-pro">
        <div class="kpi-card-top">
          <span class="kpi-label">${icons.card} Receita</span>
          <span class="kpi-trend ${salesTrend.positive ? "positive" : "negative"}">${salesTrend.text}</span>
        </div>
        <div class="kpi-value accent" data-live-stat="salesValue">R$ ${salesReais}</div>
        <div data-live="spark-sales">${sparklineSvg(salesVals)}</div>
      </div>
      <div class="kpi-card-pro">
        <div class="kpi-card-top">
          <span class="kpi-label">${icons.chat} Mensagens hoje</span>
          <span class="kpi-trend ${msgTrend.positive ? "positive" : "negative"}">${msgTrend.text}</span>
        </div>
        <div class="kpi-value" data-live-stat="messagesTodayVal">${data.stats.messagesToday}</div>
        <div data-live="spark-messages">${sparklineSvg(msgVals, "#34d399")}</div>
      </div>
      <div class="kpi-card-pro">
        <div class="kpi-card-top">
          <span class="kpi-label">${icons.users} Leads</span>
          <span class="kpi-trend ${leadsTrend.positive ? "positive" : "negative"}">${leadsTrend.text}</span>
        </div>
        <div class="kpi-value" data-live-stat="leads">${data.stats.leads}</div>
        <div data-live="spark-leads">${sparklineSvg(msgVals.map((v) => Math.max(0, Math.round(v * 0.35))), "#4ade80")}</div>
      </div>
      <div class="kpi-card-pro">
        <div class="kpi-card-top">
          <span class="kpi-label">${icons.sparkles} Conversões</span>
          <span class="kpi-trend positive" data-live-stat="salesCount">${data.stats.salesCount} venda(s)</span>
        </div>
        <div class="kpi-value accent" data-live-stat="salesCountVal">${data.stats.salesCount}</div>
        <div data-live="spark-sales">${sparklineSvg(salesVals.map((v) => (v > 0 ? 1 : 0)))}</div>
      </div>
      <div class="kpi-card-pro">
        <div class="kpi-card-top">
          <span class="kpi-label">${icons.layers} Taxa conversão</span>
          <span class="kpi-trend ${convTrend.positive ? "positive" : "negative"}">${convTrend.text}</span>
        </div>
        <div class="kpi-value" data-live-stat="convRate">${convRate}%</div>
        <div>${sparklineSvg(salesVals, "#34d399")}</div>
      </div>
    </div>

    <div class="dash-charts-hero dash-charts-hero--3">
      <div class="dash-glow-card card card-premium chart-card-pro chart-card-pro--wide" style="${glowStyle(0)}">
        <div class="card-head">
          <h3>${icons.card} Evolução da receita</h3>
          <span class="chart-badge" data-live-stat="salesValue">R$ ${salesReais}</span>
        </div>
        <div class="card-body chart-wrap chart-wrap--hero" data-live="sales-chart">
          ${salesChartSvgFromData(data.chart, { tall: true })}
        </div>
      </div>
      <div class="dash-glow-card card card-premium chart-card-pro" style="${glowStyle(1)}">
        <div class="card-head"><h3>${icons.chat} Mensagens por canal</h3></div>
        <div class="card-body">${channelDonutSvg([
          { label: "WhatsApp", value: Math.max(data.stats.messagesToday, 1), color: "#25D366" },
          { label: "Remarketing", value: Math.max(Math.round(data.stats.leads * 0.15), 0), color: "#4ade80" },
          { label: "Manual", value: Math.max(Math.round(data.stats.salesCount * 2), 0), color: "#22c55e" }
        ])}</div>
      </div>
      <div class="dash-glow-card card card-premium chart-card-pro" style="${glowStyle(2)}">
        <div class="card-head"><h3>${icons.sparkles} Funil de vendas</h3></div>
        <div class="card-body">${salesFunnelHtml({ leads: data.stats.leads, sales: data.stats.salesCount, messages: data.stats.messagesToday })}</div>
      </div>
    </div>

    <div class="dash-bottom-pro dash-bottom-pro--3">
      <div class="dash-glow-card card card-premium card--table dash-table-card" style="${glowStyle(3)}">
        <div class="card-head">
          <h3>${icons.layers} Suas instâncias</h3>
          <div class="card-head-actions">
            <a href="/instances/new" class="btn btn-primary btn-sm">${icons.plus} Nova</a>
            <form method="post" action="/restart" style="display:inline">
              <button type="submit" class="btn btn-secondary btn-sm">${icons.refresh}</button>
            </form>
          </div>
        </div>
        <div class="card-body card-body--flush">${instancesTableHtml(bots, statuses)}</div>
        <div class="card-foot">
          <a href="/instances" class="card-link">Gerenciar instâncias →</a>
        </div>
      </div>
      <div class="dash-glow-card card card-premium card-live-feed" style="${glowStyle(4)}">
        <div class="card-head">
          <h3><span class="live-pulse" aria-hidden="true"></span> Atividade em tempo real</h3>
          <span class="live-badge">Ao vivo</span>
        </div>
        <div class="card-body activity-feed-live" data-live="activity-feed">${activityFeed(data.activities)}</div>
      </div>
      <div class="dash-glow-card card card-premium top-players-card" style="${glowStyle(5)}">
        <div class="card-head">
          <div>
            <h3>${icons.trophy} Top 5 Players</h3>
            <div class="top-players-sub">Corrida de faturamento</div>
          </div>
        </div>
        <div class="card-body">
          <div class="top-players-tabs">
            <span class="top-players-tab">Concurso</span>
            <span class="top-players-tab top-players-tab--muted">Mensal</span>
          </div>
          <div class="top-players-list" data-live="top-players">${topPlayersRankingHtml(data.topPlayers, currentUserId)}</div>
        </div>
      </div>
    </div>

    <div class="dash-status-bar" aria-label="Status da operação">
      <div class="dash-status-item dash-status-item--ok"><span class="dash-status-dot"></span> Sistemas operacionais</div>
      <div class="dash-status-item">Dispositivos: <strong>${connected} / ${bots.length}</strong> conectados</div>
      <div class="dash-status-item">Mensagens hoje: <strong data-live-stat="messagesToday">${data.stats.messagesToday}</strong></div>
      <div class="dash-status-item">Leads: <strong data-live-stat="leads">${data.stats.leads}</strong></div>
      <div class="dash-status-item">Vendas: <strong data-live-stat="salesCountVal">${data.stats.salesCount}</strong></div>
      <div class="dash-status-item">Receita: <strong data-live-stat="salesValue">R$ ${salesReais}</strong></div>
    </div>
    </div>`;

  return appLayout("Dashboard", "dashboard", body, partial, userName, "Visão geral do seu negócio", userAvatar);
}

export function profilePage(
  user: { id: string; name: string; email: string; avatarUrl?: string; createdAt: string },
  stats: { salesTotalCents: number; salesCount: number; rank: number | null },
  message = "",
  isError = false,
  partial = false,
  userLabel = ""
) {
  const memberSince = new Date(user.createdAt).toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
  const rankLabel = stats.rank ? `#${stats.rank}` : "—";
  const salesReais = (stats.salesTotalCents / 100).toFixed(2).replace(".", ",");
  const shortId = user.id.slice(0, 8);

  const body = `
    ${message ? alertHtml(message, isError ? "error" : "success") : ""}
    <div class="profile-shell">
      <div class="page-hero neon-hero profile-hero">
        <div>
          <h2 class="hero-title">Minha <span class="brand-accent">conta</span></h2>
          <p class="hero-desc">Gerencie suas informações pessoais e visualize seu progresso no sistema.</p>
        </div>
      </div>
      <div class="profile-grid">
        <div class="dash-glow-card card card-premium profile-card-main" style="${glowStyle(0)}">
          <div class="card-body profile-identity">
            <form method="post" action="/perfil" enctype="multipart/form-data" class="profile-form">
              <div class="profile-form-top">
              <label class="profile-avatar-upload" title="Alterar foto">
                ${user.avatarUrl?.trim() ? `<img class="profile-avatar-img" src="${escapeHtml(user.avatarUrl)}" alt="" />` : `<span class="profile-avatar-placeholder">${escapeHtml(user.name.slice(0, 1).toUpperCase())}</span>`}
                <span class="profile-avatar-camera">${icons.image}</span>
                <input type="file" name="avatarFile" accept="image/*" />
              </label>
              <div class="profile-identity-info">
                <label class="field">Nome completo<input name="name" value="${escapeHtml(user.name)}" required /></label>
                <p class="profile-email">${escapeHtml(user.email)}</p>
                <span class="profile-rank-badge">${icons.trophy} Ranking ${rankLabel}</span>
              </div>
              </div>
              <div class="profile-meta-row">
                <div><span>Membro desde</span><strong>${memberSince}</strong></div>
                <div><span>ID da conta</span><strong>${shortId}…</strong></div>
                <div><span>Faturamento</span><strong>R$ ${salesReais}</strong></div>
              </div>
              <button type="submit" class="btn btn-primary">Salvar perfil</button>
            </form>
          </div>
        </div>
        <div class="dash-glow-card card card-premium" style="${glowStyle(1)}">
          <div class="card-head"><h3>${icons.card} Seu desempenho</h3></div>
          <div class="card-body profile-stats">
            <div class="profile-stat"><span>Vendas confirmadas</span><strong>${stats.salesCount}</strong></div>
            <div class="profile-stat"><span>Receita total</span><strong class="accent">R$ ${salesReais}</strong></div>
            <div class="profile-stat"><span>Posição global</span><strong>${rankLabel}</strong></div>
          </div>
        </div>
        <div class="dash-glow-card card card-premium" style="${glowStyle(2)}">
          <div class="card-head"><h3>${icons.lock} Segurança</h3></div>
          <div class="card-body">
            <form method="post" action="/perfil/senha" class="profile-security-form">
              <label class="field">Nova senha<input name="password" type="password" minlength="6" placeholder="Mínimo 6 caracteres" /></label>
              <label class="field">Confirmar senha<input name="passwordConfirm" type="password" placeholder="Repita a senha" /></label>
              <button type="submit" class="btn btn-secondary btn-block">Atualizar senha</button>
            </form>
          </div>
        </div>
      </div>
    </div>`;

  return appLayout("Minha conta", "profile", body, partial, userLabel || user.email, "Perfil e preferências", user.avatarUrl ?? "");
}

export function instancesPage(
  bots: BotConfig[],
  message = "",
  isError = false,
  partial = false,
  userName = "Usuario",
  statuses: Record<string, WaLiveStatus> = {}
) {
  const body = `
    ${message ? alertHtml(message, isError ? "error" : "success") : ""}
    <div class="card card--table" style="margin-bottom:16px">
      <div class="card-head"><h3>Todas as Instâncias (${bots.length})</h3>
        <a href="/instances/new" class="btn btn-primary btn-sm">${icons.plus} Nova</a>
      </div>
      <div class="card-body card-body--flush">${instancesTableHtml(bots, statuses)}</div>
    </div>`;

  return appLayout("Instâncias", "instances", body, partial, userName);
}

export function newInstancePage(
  message = "",
  isError = false,
  partial = false,
  userName = "Usuario"
) {
  const body = `
    ${message ? alertHtml(message, isError ? "error" : "success") : ""}
    <div class="page-form-shell">
      <div class="page-form-head">
        <div>
          <p class="page-eyebrow">Instâncias</p>
          <h2 class="page-form-title">Nova instância</h2>
          <p class="page-form-desc">Configure persona, Pix, entrega automática e prompt da IA.</p>
        </div>
        <a href="/instances" class="btn btn-ghost btn-sm">← Voltar</a>
      </div>
      ${botInstanceForm("new")}
    </div>`;

  return appLayout("Nova Instância", "new", body, partial, userName, "Crie e configure um bot de vendas");
}

export function editInstancePage(
  bot: BotConfig,
  message = "",
  isError = false,
  partial = false,
  userName = "Usuario"
) {
  const body = `
    ${message ? alertHtml(message, isError ? "error" : "success") : ""}
    <div class="page-form-shell">
      <div class="page-form-head">
        <div>
          <p class="page-eyebrow">Instâncias</p>
          <h2 class="page-form-title">Editar — ${escapeHtml(bot.name)}</h2>
          <p class="page-form-desc">Alterações em prompt, delay e entrega não desconectam o WhatsApp.</p>
        </div>
        <a href="/instances" class="btn btn-ghost btn-sm">← Voltar</a>
      </div>
      ${botInstanceForm("edit", bot)}
    </div>`;

  return appLayout(`Editar ${bot.name}`, "instances", body, partial, userName, "Ajuste persona, vendas e integrações");
}

export function registerPage(message = "") {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  ${FAVICON_LINK}
  <title>Criar conta · WhatsApp IA</title>
  <style>${globalStyles}</style>
</head>
<body class="auth-body">
  <div class="light-rays" aria-hidden="true"></div>
  <canvas id="login-lightning-canvas" aria-hidden="true"></canvas>
  <canvas id="login-particles-canvas" aria-hidden="true"></canvas>
  <canvas id="panel-scene-canvas" aria-hidden="true"></canvas>
  <div class="mesh-blob" aria-hidden="true"></div>
  <main class="login-premium">
    <section class="login-showcase">
      ${brandMarkHtml("Painel WhatsApp")}
      <p class="login-eyebrow">Comece em minutos</p>
      <h1 class="login-title-3d"><span class="text-3d-line">Criar conta</span><span class="text-3d-line accent">ZapManager</span></h1>
      <p class="login-prose">
        Crie sua conta para configurar instâncias, conectar o WhatsApp e acompanhar
        vendas, leads e conversas com o mesmo nível de controle do painel operacional.
      </p>
    </section>
    <section class="login-card-wrap">
      <div class="login-card-glow" aria-hidden="true"></div>
      <div class="login-card-premium login-card-auth">
        <h2>Criar conta</h2>
        <p class="sub">Comece em menos de 1 minuto</p>
        ${message ? alertHtml(message, "error") : ""}
        <form method="post" action="/register" class="auth-form">
          <label class="field">
            <span class="field-label">Seu nome</span>
            <input name="name" placeholder="Como quer ser chamado" required />
          </label>
          <label class="field">
            <span class="field-label">E-mail</span>
            <input name="email" type="email" placeholder="voce@email.com" required />
          </label>
          <label class="field">
            <span class="field-label">Senha</span>
            <input name="password" type="password" minlength="6" placeholder="Mínimo 6 caracteres" required />
          </label>
          <label class="field">
            <span class="field-label">Código de convite</span>
            <input name="inviteCode" required placeholder="Ex: BOT2026" autocomplete="off" />
            <small>Conta liberada apenas com convite válido.</small>
          </label>
          <button type="submit" class="btn btn-primary btn-block btn-glow">Criar conta</button>
        </form>
        <p class="auth-footer">
          Já tem conta? <a href="/login">Entrar</a>
        </p>
      </div>
    </section>
  </main>
  <script>${panelSceneScript("auth")}</script>
  <script>${loginParticlesScript()}</script>
  <script>${loginLightningScript()}</script>
</body>
</html>`;
}

export function settingsPage(
  input: {
    message?: string;
    messageIsError?: boolean;
    maskedKey: string;
    configured: boolean;
    source: string;
    model: string;
    provider: AIProviderId;
    providerLabel: string;
  },
  bots: BotConfig[] = [],
  previewBotId = "",
  partial = false,
  userName = "Usuario"
) {
  const previewBot = bots.find((b) => b.id === previewBotId) ?? bots[0];
  const previewBotOptions =
    bots.length === 0
      ? `<option value="">Crie uma instância primeiro</option>`
      : bots
          .map(
            (b) =>
              `<option value="${b.id}" ${b.id === previewBot?.id ? "selected" : ""}>${escapeHtml(b.name)}</option>`
          )
          .join("");
  const statusClass = input.configured ? "badge-online" : "badge-paused";
  const statusText = input.configured
    ? input.source === "painel"
      ? "Conectado · sua chave salva"
      : `Conectado · ${escapeHtml(input.providerLabel)}`
    : "Configure sua API Key abaixo";
  const providerOptions = Object.entries(AI_PROVIDERS)
    .map(
      ([id, p]) =>
        `<option value="${id}" ${input.provider === id ? "selected" : ""}>${escapeHtml(p.label)}</option>`
    )
    .join("");
  const hint = AI_PROVIDERS[input.provider]?.keyHint ?? "sk-...";
  const freeModelOptions =
    input.provider === "openrouter"
      ? OPENROUTER_FREE_MODELS.map(
          (m) => `<option value="${escapeHtml(m.id)}">${escapeHtml(m.label)}</option>`
        ).join("")
      : "";
  const modelField =
    input.provider === "openrouter"
      ? `<label class="field">Modelo (grátis no OpenRouter)
              <input name="openaiModel" list="openrouter-models" value="${escapeHtml(input.model)}" placeholder="openrouter/free" />
              <datalist id="openrouter-models">${freeModelOptions}</datalist>
              <span class="form-hint">Crie conta em <a href="https://openrouter.ai/" target="_blank" rel="noopener">openrouter.ai</a> e use API Key <code>sk-or-v1-...</code>. Modelos com <code>:free</code> não cobram créditos.</span>
            </label>`
      : `<label class="field">Modelo
              <input name="openaiModel" value="${escapeHtml(input.model)}" placeholder="${escapeHtml(AI_PROVIDERS[input.provider].defaultModel)}" />
            </label>`;

  const body = `
    ${input.message ? alertHtml(input.message, input.messageIsError ? "error" : "success") : ""}
    <div class="settings-single">
      <div class="card card-premium">
        <div class="card-head">
          <h3>${icons.sparkles} Provedor de IA</h3>
          <span class="badge ${statusClass}"><span class="badge-dot"></span> ${statusText}</span>
        </div>
        <div class="card-body">
          <p class="form-hint" style="margin-bottom:16px">Cada conta usa <strong>sua própria</strong> API Key. A chave do dono da plataforma não é compartilhada com outros usuários.</p>
          <form method="post" action="/settings" id="ai-settings-form">
            <label class="field">Provedor
              <select name="aiProvider" id="ai-provider-select">
                ${providerOptions}
              </select>
            </label>
            <label class="field">API Key
              <input name="openaiApiKey" type="password" placeholder="${escapeHtml(hint)}" autocomplete="new-password" />
              <small style="color:var(--muted)">Deixe vazio para manter a chave atual.</small>
            </label>
            ${modelField}
            <button type="submit" class="btn btn-primary btn-block">Salvar configurações</button>
          </form>
          <p class="form-hint" style="margin-top:14px">OpenRouter, OpenAI, DeepSeek, Gemini e Claude. Para IA grátis use <strong>OpenRouter</strong> + modelos <code>:free</code>.</p>
        </div>
      </div>
    </div>

    <div class="card card-premium" style="margin-top:18px" id="previa">
      <div class="card-head">
        <h3>${icons.image} Prévia gratuita (amostra)</h3>
        <span class="badge badge-online">Por instância</span>
      </div>
      <div class="card-body">
        <p class="form-hint" style="margin-bottom:14px">
          Configure as mídias que o bot manda de graça quando o lead pede amostra. Também disponível em
          <a href="/instances" style="color:var(--primary)">Instâncias → Editar</a>.
        </p>
        <form method="get" action="/settings" class="inline-form" style="margin-bottom:16px">
          <label class="field">Instância
            <select name="botId" onchange="this.form.submit()">${previewBotOptions}</select>
          </label>
        </form>
        ${
          previewBot
            ? `<form id="settings-preview-form" method="post" action="/settings/previews" enctype="multipart/form-data">
            <input type="hidden" name="botId" value="${previewBot.id}" />
            ${previewConfigBlock(previewBot, "settings-preview-form")}
            <button type="submit" class="btn btn-primary" style="margin-top:12px">Salvar prévias</button>
          </form>`
            : `<p class="form-hint"><a href="/instances/new">Criar instância</a> para cadastrar prévias.</p>`
        }
      </div>
    </div>`;

  return appLayout("Configurações", "settings", body, partial, userName);
}
