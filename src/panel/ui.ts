import type { BotConfig } from "../bots.js";
import type { WaLiveStatus } from "../whatsapp-runtime.js";
import type { ActivityItem, BotSalesRank } from "../db/events.js";
import { botInstanceForm, instancesTableHtml, previewConfigBlock } from "./bot-form.js";
import { icons } from "./icons.js";
import { alertHtml, appLayout, escapeHtml } from "./layout.js";
import { brandMarkHtml, FAVICON_LINK } from "./brand.js";
import { salesChartSvgFromData, messagesChartSvgFromData } from "./charts.js";
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
};

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

function activityFeed(activities: ActivityItem[]) {
  return activityFeedHtml(activities);
}

function topProducts(ranking: BotSalesRank[]) {
  return topBotsRankingHtml(ranking);
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
  statuses: Record<string, WaLiveStatus> = {}
) {
  const active = bots.filter((b) => b.active).length;
  const previews = bots.reduce((s, b) => s + b.previewMediaUrls.length, 0);
  const salesReais = (data.stats.salesTotalCents / 100).toFixed(2).replace(".", ",");

  const body = `
    <div class="dash-shell">
    ${message ? alertHtml(message, isError ? "error" : "success") : ""}
    <div class="dash-hero-pro">
      <div>
        <p class="eyebrow">Visão geral operacional</p>
        <h2>Central de operação</h2>
        <p>Métricas consolidadas das suas instâncias WhatsApp — leads, conversões e remarketing em um único painel.</p>
      </div>
      <div class="dash-hero-actions">
        <a href="/instances/new" class="btn btn-primary">${icons.plus} Nova instância</a>
        <a href="/remarketing" class="btn btn-secondary">${icons.megaphone} Remarketing</a>
      </div>
    </div>

    <div class="dash-charts-hero">
      <div class="card card-premium chart-card-pro">
        <div class="card-head">
          <h3>${icons.card} Receita — 7 dias</h3>
          <span class="chart-badge" data-live-stat="salesValue">R$ ${salesReais}</span>
        </div>
        <div class="card-body chart-wrap chart-wrap--hero" data-live="sales-chart">
          ${salesChartSvgFromData(data.chart, { tall: true })}
        </div>
      </div>
      <div class="card card-premium chart-card-pro">
        <div class="card-head">
          <h3>${icons.chat} Mensagens — 7 dias</h3>
          <span class="chart-badge" data-live-stat="messagesToday">${data.stats.messagesToday} hoje</span>
        </div>
        <div class="card-body chart-wrap chart-wrap--hero" data-live="messages-chart">
          ${messagesChartSvgFromData(data.messagesChart)}
        </div>
      </div>
    </div>

    <div class="metrics-bento">
      <div class="metric-kpi">
        <div class="stat-icon">${icons.layers}</div>
        <div class="stat-label">Instâncias ativas</div>
        <div class="stat-value accent">${active}</div>
        <div class="stat-delta">${bots.length} cadastrada(s)</div>
      </div>
      <div class="metric-kpi">
        <div class="stat-icon">${icons.users}</div>
        <div class="stat-label">Leads</div>
        <div class="stat-value" data-live-stat="leads">${data.stats.leads}</div>
        <div class="stat-delta" data-live-stat="messagesToday">${data.stats.messagesToday} mensagens hoje</div>
      </div>
      <div class="metric-kpi">
        <div class="stat-icon">${icons.card}</div>
        <div class="stat-label">Receita confirmada</div>
        <div class="stat-value accent" data-live-stat="salesValue">R$ ${salesReais}</div>
        <div class="stat-delta" data-live-stat="salesCount">${data.stats.salesCount} venda(s)</div>
      </div>
      <div class="metric-kpi">
        <div class="stat-icon">${icons.chat}</div>
        <div class="stat-label">Prévias de mídia</div>
        <div class="stat-value">${previews}</div>
        <div class="stat-delta">ativos no funil</div>
      </div>
    </div>

    <div class="dash-bento">
      <div class="card card-premium card--table">
        <div class="card-head">
          <h3>Suas instâncias</h3>
          <form method="post" action="/restart" style="display:inline">
            <button type="submit" class="btn btn-secondary btn-sm">${icons.refresh} Reiniciar</button>
          </form>
        </div>
        <div class="card-body card-body--flush">${instancesTableHtml(bots, statuses)}</div>
        <div class="card-foot">
          <a href="/instances" class="card-link">Ver todas →</a>
        </div>
      </div>
      <div class="card card-premium">
        <div class="card-head"><h3>Atividades recentes</h3></div>
        <div class="card-body" data-live="activity-feed">${activityFeed(data.activities)}</div>
      </div>
    </div>

    <div class="dash-analytics-row dash-analytics-row--2">
      <div class="card card-premium">
        <div class="card-head"><h3>Top instâncias</h3></div>
        <div class="card-body" data-live="top-bots">${topProducts(data.topBots)}</div>
      </div>
      <div class="card card-premium">
        <div class="card-head"><h3>Atalhos</h3></div>
        <div class="card-body">
          <div class="quick-grid">
            <a href="/instances/new" class="quick-item">${icons.sparkles} Prompt IA</a>
            <a href="/remarketing" class="quick-item">${icons.megaphone} Remarketing</a>
            <a href="/settings" class="quick-item">${icons.settings} Provedor IA</a>
            <a href="/leads" class="quick-item">${icons.users} Leads</a>
          </div>
        </div>
      </div>
    </div>
    </div>`;

  return appLayout("Dashboard", "dashboard", body, partial, userName, "Visão geral do seu negócio");
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
          <p class="page-form-desc">Configure persona, Pix, entrega automática, CallHot e prompt da IA.</p>
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
  const statusText = input.configured ? `Conectado · ${escapeHtml(input.providerLabel)}` : "Não configurado";
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
    <div class="grid-2">
      <div class="card card-premium">
        <div class="card-head">
          <h3>${icons.sparkles} Provedor de IA</h3>
          <span class="badge ${statusClass}"><span class="badge-dot"></span> ${statusText}</span>
        </div>
        <div class="card-body">
          ${input.configured ? `<p style="font-family:var(--mono);font-size:0.88rem;color:var(--primary);margin-bottom:16px;padding:12px;background:#0a0c12;border-radius:10px;border:1px solid var(--border)">${escapeHtml(input.maskedKey)}</p>` : ""}
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
      <div class="card">
        <div class="card-head"><h3>${icons.lock} Segurança & Infra</h3></div>
        <div class="card-body" style="color:var(--text-2);line-height:1.7;font-size:0.9rem">
          <p style="margin-bottom:12px">Senha do painel via <code style="background:#0a0c12;padding:2px 6px;border-radius:4px">PANEL_PASSWORD</code> no Railway.</p>
          <p style="margin-bottom:12px">API Key criptografada no PostgreSQL após salvar.</p>
          <p>Use <code style="background:#0a0c12;padding:2px 6px;border-radius:4px">DATABASE_PUBLIC_URL</code> ou <code style="background:#0a0c12;padding:2px 6px;border-radius:4px">DATABASE_URL</code> para persistir dados.</p>
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
