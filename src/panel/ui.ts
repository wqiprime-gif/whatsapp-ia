import type { BotConfig } from "../bots.js";
import type { WaLiveStatus } from "../whatsapp-runtime.js";
import type { ActivityItem, BotSalesRank, UserSalesRank } from "../db/events.js";
import { playerTier } from "../db/events.js";
import { botInstanceForm, instancesTableHtml, previewConfigBlock } from "./bot-form.js";
import { icons } from "./icons.js";
import { alertHtml, appLayout, escapeHtml, greetingDisplayName, timeGreeting, dashboardDateLabel } from "./layout.js";
import { brandMarkHtml, FAVICON_LINK } from "./brand.js";
import { salesChartSvgFromData, conversionGaugeSvg, sharkPerformanceChartHtml } from "./charts.js";
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

function sharkIconBox(icon: string, large = false, circle = false) {
  const cls = large ? " shark-icon-box--lg" : circle ? " shark-icon-box--circle" : "";
  return `<span class="shark-icon-box${cls}" aria-hidden="true">${icon}</span>`;
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
  userAvatar = "",
  userEmail = "",
  userDisplayName = ""
) {
  const salesReais = (data.stats.salesTotalCents / 100).toFixed(2).replace(".", ",");
  const convRate =
    data.stats.leads > 0
      ? ((data.stats.salesCount / data.stats.leads) * 100)
      : 0;
  const ticketMedio =
    data.stats.salesCount > 0
      ? (data.stats.salesTotalCents / data.stats.salesCount / 100).toFixed(2).replace(".", ",")
      : "0,00";
  const approvalPct =
    data.stats.leads > 0
      ? Math.round((data.stats.salesCount / data.stats.leads) * 100)
      : 0;
  const fatGoal = 10_000;
  const fatProgress = Math.min(100, Math.round((data.stats.salesTotalCents / 100 / fatGoal) * 100));
  const greetingName = escapeHtml(greetingDisplayName(userDisplayName || userName, userEmail || userName));
  const greet = timeGreeting();
  const dateStr = dashboardDateLabel();

  const topbarFatPill = `
      <div class="shark-fat-pill shark-card dash-glow-card shark-fat-pill--topbar" style="${glowStyle(0)}">
        ${sharkIconBox(icons.dollar, true, true)}
        <div class="shark-fat-body">
          <div class="shark-fat-top">
            <span class="shark-fat-label">Faturamento</span>
            <span class="shark-fat-pct">${fatProgress}%</span>
          </div>
          <div class="shark-fat-bar" role="progressbar" aria-valuenow="${fatProgress}" aria-valuemin="0" aria-valuemax="100">
            <span style="width:${fatProgress}%"></span>
          </div>
          <div class="shark-fat-bottom">
            <div class="shark-fat-value" data-live-stat="salesValue">R$ ${salesReais}</div>
            <span class="shark-fat-meta">/ 10k</span>
          </div>
        </div>
      </div>`;

  const body = `
    <div class="dash-shell shark-dash">
    ${message ? alertHtml(message, isError ? "error" : "success") : ""}

    <div class="shark-dash-head shark-dash-head--greet-only">
      <div class="shark-greeting">
        <h2 class="shark-greeting-title" data-greeting-name="${greetingName}">${greet}, <span class="shark-greeting-name">${greetingName}</span></h2>
        <p class="shark-greeting-date" id="shark-greeting-date">${dateStr}</p>
      </div>
    </div>

    <div class="shark-period-bar shark-period-card">
      <span class="shark-period-label">${icons.calendar} Período</span>
      <div class="shark-period-tabs-wrap">
        <div class="shark-period-tabs" data-period-tabs>
          <button type="button" class="shark-period-tab shark-period-tab--active" data-period="hoje">Hoje</button>
          <button type="button" class="shark-period-tab" data-period="ontem">Ontem</button>
          <button type="button" class="shark-period-tab" data-period="7d">7 dias</button>
          <button type="button" class="shark-period-tab" data-period="30d">30 dias</button>
          <button type="button" class="shark-period-tab" data-period="total">Total</button>
        </div>
      </div>
    </div>

    <div class="shark-main-grid">
      <div class="shark-kpi-grid">
        <div class="shark-kpi-card shark-card dash-glow-card" style="${glowStyle(1)}">
          <div class="shark-kpi-head">
            ${sharkIconBox(icons.dollar)}
            <h3 class="shark-kpi-title">Vendas aprovadas</h3>
          </div>
          <div class="shark-kpi-value" data-live-stat="salesValue">R$ ${salesReais}</div>
          <div class="shark-kpi-foot">
            <div class="shark-mini-bar"><span style="width:${approvalPct}%"></span></div>
            <span>${approvalPct}% Aprov.</span>
          </div>
        </div>
        <div class="shark-kpi-card shark-card dash-glow-card" style="${glowStyle(2)}">
          <div class="shark-kpi-head">
            ${sharkIconBox(icons.trending)}
            <h3 class="shark-kpi-title">Taxa de conversão</h3>
          </div>
          <div data-live="conv-gauge">${conversionGaugeSvg(convRate, `${data.stats.salesCount} pagos de ${data.stats.leads} leads`)}</div>
        </div>
        <div class="shark-kpi-card shark-card dash-glow-card" style="${glowStyle(3)}">
          <div class="shark-kpi-head">
            ${sharkIconBox(icons.zap)}
            <h3 class="shark-kpi-title">Total starts</h3>
          </div>
          <div class="shark-kpi-value" data-live-stat="leads">${data.stats.leads}</div>
          <span class="shark-kpi-sub">leads iniciaram conversa</span>
        </div>
        <div class="shark-kpi-card shark-card dash-glow-card" style="${glowStyle(4)}">
          <div class="shark-kpi-head">
            ${sharkIconBox(icons.receipt)}
            <h3 class="shark-kpi-title">Ticket médio</h3>
          </div>
          <div class="shark-kpi-value">R$ ${ticketMedio}</div>
          <span class="shark-kpi-sub">Vendas: <strong data-live-stat="salesCountVal">${data.stats.salesCount}</strong> · PIX pagos</span>
        </div>
      </div>
      <div class="shark-chart-card shark-card dash-glow-card" style="${glowStyle(5)}">
        <div class="card-head shark-chart-head">
          <div class="shark-card-head-row">
            ${sharkIconBox(icons.activity)}
            <div>
              <h3>Seu desempenho</h3>
              <span class="shark-chart-sub" data-live="chart-period-label">Receita · últimos 7 dias</span>
            </div>
          </div>
          <span class="chart-badge" data-live-stat="salesValue">R$ ${salesReais}</span>
        </div>
        <div class="card-body chart-wrap chart-wrap--hero" data-live="sales-chart">
          ${sharkPerformanceChartHtml(data.chart, { dayCount: 7, endOffset: 0 })}
        </div>
      </div>
    </div>

    <div class="shark-bottom-grid">
      <div class="dash-glow-card shark-card card card-premium card-live-feed shark-log-card" style="${glowStyle(0)}">
        <div class="card-head">
          <div class="shark-card-head-row">
            ${sharkIconBox(icons.activity)}
            <div>
              <h3><span class="live-pulse" aria-hidden="true"></span> Log de atividades</h3>
              <span class="shark-card-sub">Tempo real</span>
            </div>
          </div>
          <span class="live-badge">Ao vivo</span>
        </div>
        <div class="card-body activity-feed-live" data-live="activity-feed">${activityFeed(data.activities)}</div>
      </div>
      <div class="dash-glow-card shark-card card card-premium shark-award-card" style="${glowStyle(1)}">
        <div class="card-head">
          <div class="shark-card-head-row">
            ${sharkIconBox(icons.trophy)}
            <div>
              <h3>Premiações</h3>
              <span class="shark-card-sub">Conquiste novas placas</span>
            </div>
          </div>
        </div>
        <div class="card-body shark-award-body">
          <div class="shark-award-preview">
            <div class="shark-award-lock">${icons.lock}</div>
            <strong>Zap Pro</strong>
            <span class="shark-award-meta">Meta R$ ${salesReais} / R$ 10k</span>
          </div>
        </div>
      </div>
      <div class="dash-glow-card shark-card card card-premium top-players-card shark-players-card" style="${glowStyle(2)}">
        <div class="card-head">
          <div class="shark-card-head-row">
            ${sharkIconBox(icons.crown)}
            <div>
              <h3>Top 5 Players</h3>
              <span class="shark-card-sub">Corrida de faturamento</span>
            </div>
          </div>
        </div>
        <div class="card-body">
          <div class="top-players-tabs">
            <span class="top-players-tab top-players-tab--active">Concurso</span>
            <span class="top-players-tab top-players-tab--muted">Mensal</span>
          </div>
          <div class="top-players-list" data-live="top-players">${topPlayersRankingHtml(data.topPlayers, currentUserId)}</div>
        </div>
      </div>
    </div>
    </div>
    <script>
    (function(){
      var title = document.querySelector(".shark-greeting-title");
      var dateEl = document.getElementById("shark-greeting-date");
      if (!title) return;
      var name = title.getAttribute("data-greeting-name") || "";
      var months = ["JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO","JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO"];
      function spParts() {
        var fmt = new Intl.DateTimeFormat("pt-BR", {
          timeZone: "America/Sao_Paulo",
          hour: "numeric", hour12: false,
          day: "numeric", month: "numeric", year: "numeric"
        });
        var parts = fmt.formatToParts(new Date());
        var get = function(t) {
          var p = parts.find(function(x) { return x.type === t; });
          return p ? Number(p.value) : 0;
        };
        return { hour: get("hour"), day: get("day"), month: get("month"), year: get("year") };
      }
      function greet(h) {
        if (h >= 0 && h < 6) return "Boa madrugada";
        if (h < 12) return "Bom dia";
        if (h < 18) return "Boa tarde";
        return "Boa noite";
      }
      function tick() {
        var p = spParts();
        title.innerHTML = greet(p.hour) + ", <span class=\"shark-greeting-name\">" + name + "</span>";
        if (dateEl) dateEl.textContent = p.day + " DE " + months[p.month - 1] + " DE " + p.year;
      }
      tick();
      setInterval(tick, 60000);
    })();
    </script>`;

  return appLayout("Dashboard", "dashboard", body, partial, userName, "", userAvatar, topbarFatPill);
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

  const rawAvatar = user.avatarUrl?.trim() ?? "";
  const avatarSrc = rawAvatar
    ? rawAvatar.startsWith("data:")
      ? escapeHtml(rawAvatar)
      : `${escapeHtml(rawAvatar)}${rawAvatar.includes("?") ? "&" : "?"}v=${rawAvatar.match(/(\d{13})/)?.[1] ?? "1"}`
    : "";

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
            <form method="post" action="/perfil" enctype="multipart/form-data" class="profile-form" id="profile-form">
              <div class="profile-form-top">
              <label class="profile-avatar-upload" title="Clique para alterar foto">
                <img id="profile-avatar-preview" class="profile-avatar-img" src="${avatarSrc}" alt="" style="${avatarSrc ? "" : "display:none"}" />
                <span class="profile-avatar-placeholder" id="profile-avatar-ph" style="${avatarSrc ? "display:none" : ""}">${escapeHtml(user.name.slice(0, 1).toUpperCase())}</span>
                <span class="profile-avatar-camera">${icons.image}</span>
                <input type="file" name="avatarFile" accept="image/jpeg,image/png,image/webp" />
                <input type="hidden" name="avatarData" id="profile-avatar-data" value="" />
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
    </div>
    <script>
    (function(){
      var inp = document.querySelector('.profile-avatar-upload input[type=file]');
      var img = document.getElementById('profile-avatar-preview');
      var ph = document.getElementById('profile-avatar-ph');
      var form = document.getElementById('profile-form');
      var dataInp = document.getElementById('profile-avatar-data');
      var LS_PREVIEW = 'panelAvatarPreview';
      var LS_AVATAR = 'panelAvatarUrl';
      function pushTopbar(src) {
        if (!src) return;
        window.dispatchEvent(new CustomEvent('panel-sync-avatar', { detail: { src: src } }));
      }
      function showPh() {
        if (img) img.style.display = 'none';
        if (ph) ph.style.display = 'grid';
      }
      function showImg(src) {
        if (!img) return;
        img.src = src;
        img.style.display = 'block';
        if (ph) ph.style.display = 'none';
        pushTopbar(src);
      }
      if (img) {
        img.onerror = function() {
          var cached = sessionStorage.getItem(LS_PREVIEW);
          if (cached && cached !== img.src) showImg(cached);
          else showPh();
        };
        var cached = sessionStorage.getItem(LS_PREVIEW);
        if (cached && (!img.getAttribute('src') || img.naturalWidth === 0)) showImg(cached);
      }
      if (inp && img) {
        inp.addEventListener('change', function(){
          var f = inp.files && inp.files[0];
          if (!f) return;
          var r = new FileReader();
          r.onload = function(){
            showImg(r.result);
            sessionStorage.setItem(LS_PREVIEW, r.result);
            localStorage.setItem(LS_AVATAR, r.result);
          };
          r.readAsDataURL(f);
        });
      }
      if (form) {
        form.addEventListener('submit', function(){
          if (img && img.src && img.src.indexOf('data:') === 0) {
            sessionStorage.setItem(LS_PREVIEW, img.src);
            localStorage.setItem(LS_AVATAR, img.src);
            if (dataInp) dataInp.value = img.src;
            pushTopbar(img.src);
          }
        });
      }
      if (img && img.src && img.style.display !== 'none' && img.src.indexOf('data:') !== 0 && img.naturalWidth > 0) {
        pushTopbar(img.src);
      }
      if (img && img.src && img.src.indexOf('data:') === 0) {
        localStorage.setItem(LS_AVATAR, img.src);
        pushTopbar(img.src);
      }
      if (img && img.src && img.src.indexOf('/uploads/') !== -1 && img.complete && img.naturalWidth > 0) {
        sessionStorage.removeItem(LS_PREVIEW);
      }
    })();
    </script>`;

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
