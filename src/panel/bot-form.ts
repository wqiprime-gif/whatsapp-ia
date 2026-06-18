import type { BotConfig } from "../bots.js";
import { env } from "../config.js";
import type { WaLiveStatus } from "../whatsapp-runtime.js";
import { DEFAULT_PROMPT_WHATSAPP } from "../lib/prompt-default.js";
import { WA_API_OPTIONS } from "../lib/wa-api-types.js";
import { PROXY_TYPE_OPTIONS, parseProxyUrl } from "../lib/wa-proxy.js";
import { decryptSecret } from "../lib/crypto.js";
import { icons } from "./icons.js";
import { botInitials, escapeHtml } from "./layout.js";
import { promptTagsSidebar } from "./prompt-tags-block.js";

function delayPartsFromMs(ms: number) {
  const totalSec = Math.max(1, Math.round(ms / 1000));
  return {
    minutes: Math.floor(totalSec / 60),
    seconds: totalSec % 60
  };
}

export function botAvatarHtml(bot: BotConfig) {
  const initials = botInitials(bot.name);
  if (bot.avatarUrl) {
    const url = escapeHtml(bot.avatarUrl);
    return `<div class="bot-av-wrap">
      <img class="bot-av-img" src="${url}" alt="" loading="lazy"
        onerror="this.remove();this.parentElement.querySelector('.bot-av-fallback')?.classList.add('show')" />
      <div class="bot-av bot-av-fallback">${initials}</div>
    </div>`;
  }
  return `<div class="bot-av-wrap"><div class="bot-av bot-av-fallback show">${initials}</div></div>`;
}

function mediaChips(urls: string[], label: string) {
  if (urls.length === 0) return "";
  return `<p style="font-size:0.78rem;color:var(--muted);margin:8px 0 4px">${label} (${urls.length}):</p>
    <div class="media-preview-list">
      ${urls
        .map((url) => {
          const name = url.split("/").pop() || url;
          return `<span class="media-preview-chip">${escapeHtml(name)}</span>`;
        })
        .join("")}
    </div>
    <p style="font-size:0.72rem;color:var(--muted);margin-top:6px">Novos arquivos serão adicionados aos existentes.</p>`;
}

/** Bloco de configuração de prévia gratuita (instância ou Configurações). */
export function previewConfigBlock(bot: BotConfig | undefined, formId = "bot-preview-form") {
  const urls = bot?.previewMediaUrls ?? [];
  const list =
    urls.length === 0
      ? `<p class="form-hint">Nenhuma prévia cadastrada. Envie fotos ou vídeos abaixo.</p>`
      : `<ul class="preview-url-list">
      ${urls
        .map((url, i) => {
          const name = url.split("/").pop() || url;
          return `<li class="preview-url-item">
            <a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="preview-url-link">${escapeHtml(name)}</a>
            <span class="badge badge-online">Mídia</span>
            <label class="audio-remove"><input type="checkbox" form="${formId}" name="removePreviewIndexes" value="${i}" /> Remover</label>
          </li>`;
        })
        .join("")}
    </ul>`;

  return `
    <div class="form-section form-section-preview" id="previa">
      <div class="form-section-head">
        <span class="form-section-icon form-section-icon-cyan">${icons.image}</span>
        <div>
          <h4>Prévia gratuita (amostra)</h4>
          <p>Fotos ou vídeos enviados <strong>uma vez por lead</strong> quando pedir amostra ou a IA usar <code>[[send_amostra_gratis]]</code>.</p>
        </div>
      </div>
      ${list}
      ${urls.length > 0 ? `<p class="form-hint">${urls.length} arquivo(s)</p>` : ""}
      <label class="field">
        <span>Mídias de prévia</span>
        <div class="dropzone">
          <p style="color:var(--muted);margin-bottom:8px">${icons.upload} Imagens ou vídeos (JPG, PNG, MP4)</p>
          <input form="${formId}" name="previewFiles" type="file" accept="image/*,video/*" multiple />
        </div>
      </label>
      <p class="form-hint">Marque &quot;Remover&quot; nos arquivos antigos e envie novos para substituir. Salve o formulário para aplicar.</p>
    </div>`;
}

/** Entrega automática após comprovante aprovado (link e/ou mídias). */
export function deliveryConfigBlock(bot: BotConfig | undefined, formId = "bot-preview-form") {
  const link = bot?.telegramGroupLink ?? "";
  const urls = bot?.deliveryMediaUrls ?? [];
  const list =
    urls.length === 0
      ? `<p class="form-hint">Nenhum arquivo de entrega. Opcional se usar só o link.</p>`
      : `<ul class="preview-url-list">
      ${urls
        .map((url, i) => {
          const name = url.split("/").pop() || url;
          return `<li class="preview-url-item">
            <a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="preview-url-link">${escapeHtml(name)}</a>
            <span class="badge badge-online">Entrega</span>
            <label class="audio-remove"><input type="checkbox" form="${formId}" name="removeDeliveryIndexes" value="${i}" /> Remover</label>
          </li>`;
        })
        .join("")}
    </ul>`;

  return `
    <div class="form-section form-section-preview" id="entrega">
      <div class="form-section-head">
        <span class="form-section-icon form-section-icon-cyan">${icons.box}</span>
        <div>
          <h4>Entrega do produto</h4>
          <p>Enviado <strong>automaticamente</strong> assim que o comprovante Pix for aprovado — mídias primeiro, depois o link.</p>
        </div>
      </div>
      <label class="field span-2">Link de entrega do produto
        <input name="telegramGroupLink" value="${escapeHtml(link)}" placeholder="https://t.me/seugrupo ou link Drive/Canal VIP" />
        <span class="form-hint">Ex: link do Telegram, Google Drive, pasta ou página de acesso.</span>
      </label>
      ${list}
      <label class="field">
        <span>Mídias de entrega (opcional)</span>
        <div class="dropzone">
          <p style="color:var(--muted);margin-bottom:8px">${icons.upload} Arquivos extras enviados junto com o link</p>
          <input form="${formId}" name="deliveryFiles" type="file" accept="image/*,video/*,application/pdf" multiple />
        </div>
      </label>
    </div>`;
}

function waConnectionBlock(isEdit: boolean, bot?: BotConfig) {
  const provider = bot?.waApiProvider ?? "whatsapp_web";
  const isMeta = provider === "meta_cloud";
  const proxyOn = Boolean(bot?.proxyEnabled);
  const webhookBase = env.PUBLIC_BASE_URL || `http://localhost:${env.PORT}`;
  const webhookUrl = bot ? `${webhookBase}/webhooks/meta/${bot.id}` : "";
  let proxyType = "http";
  let proxyHost = "";
  let proxyPort = "";
  let proxyUser = "";
  let proxyPass = "";
  if (isEdit && bot?.proxyUrlEncrypted) {
    try {
      const parsed = parseProxyUrl(decryptSecret(bot.proxyUrlEncrypted));
      if (parsed) {
        proxyType = parsed.type;
        proxyHost = parsed.host;
        proxyPort = parsed.port;
        proxyUser = parsed.username;
        proxyPass = parsed.password;
      }
    } catch {
      // mantém vazio
    }
  }

  const proxyTypeOptions = PROXY_TYPE_OPTIONS.map(
    (o) => `<option value="${o.id}" ${proxyType === o.id ? "selected" : ""}>${escapeHtml(o.label)}</option>`
  ).join("");

  const apiOptions = WA_API_OPTIONS.map(
    (o) =>
      `<option value="${o.id}" ${provider === o.id ? "selected" : ""}>${escapeHtml(o.label)}</option>`
  ).join("");

  return `
        <div class="form-section span-2" id="wa-api-section">
          <div class="form-section-head">
            <span class="form-section-icon form-section-icon-cyan">${icons.layers}</span>
            <div>
              <h4>API do WhatsApp</h4>
              <p>Escolha como esta instância se conecta ao WhatsApp.</p>
            </div>
          </div>
          <label class="field span-2">Provedor
            <select name="waApiProvider" id="wa-api-provider">
              ${apiOptions}
            </select>
          </label>
          <p class="form-hint span-2" id="wa-api-hint">${escapeHtml(WA_API_OPTIONS.find((o) => o.id === provider)?.hint ?? "")}</p>
        </div>

        <div class="form-section span-2" id="wa-web-block" style="${isMeta ? "display:none" : ""}">
          <div class="form-section-head">
            <span class="form-section-icon">${icons.chat}</span>
            <div>
              <h4>WhatsApp Web + QR</h4>
              <p>Conexão via <strong>whatsapp-web.js</strong> (Puppeteer).</p>
            </div>
          </div>
          ${
            isEdit && bot
              ? `<a href="/instances/${bot.id}/qr" class="btn btn-primary btn-sm">Abrir QR Code</a>`
              : `<p class="form-hint">Após salvar, abra a instância e escaneie o QR Code.</p>`
          }
          <div class="form-section span-2 proxy-config-panel" id="proxy-config-panel" style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">
            <h4 style="font-family:var(--font-display);margin-bottom:8px">Proxy por número (isolamento)</h4>
            <p class="form-hint">Use proxy <strong>HTTP, HTTPS ou SOCKS5 residencial</strong> — cada instância com IP diferente reduz risco de ban.</p>
            <label class="field span-2">
              Usar proxy dedicado neste número
              <select name="proxyEnabled" id="proxy-enabled">
                <option value="false" ${!proxyOn ? "selected" : ""}>Não — IP do servidor</option>
                <option value="true" ${proxyOn ? "selected" : ""}>Sim — isolar este número</option>
              </select>
            </label>
            <div class="proxy-fields-block" id="proxy-fields-block">
              <label class="field span-2">
                Tipo de proxy
                <select name="proxyType" id="proxy-type">
                  ${proxyTypeOptions}
                </select>
              </label>
              <label class="field span-2">
                URL completa <small style="color:var(--muted)">(opcional — preenche tudo abaixo)</small>
                <input name="proxyUrl" id="proxy-url-paste" placeholder="socks5://usuario:senha@host.residential:1080" autocomplete="off" />
              </label>
              <p class="form-hint span-2">Ou preencha manualmente:</p>
              <div class="proxy-grid span-2">
                <label class="field">
                  Host / IP
                  <input name="proxyHost" id="proxy-host" value="${escapeHtml(proxyHost)}" placeholder="proxy.residential.com" />
                </label>
                <label class="field">
                  Porta
                  <input name="proxyPort" id="proxy-port" value="${escapeHtml(proxyPort)}" placeholder="1080" />
                </label>
                <label class="field">
                  Usuário
                  <input name="proxyUsername" id="proxy-user" value="${escapeHtml(proxyUser)}" placeholder="login do proxy" autocomplete="off" />
                </label>
                <label class="field">
                  Senha
                  <input name="proxyPassword" id="proxy-pass" type="password" value="${escapeHtml(proxyPass)}" placeholder="${isEdit && proxyUser ? "••••••" : "senha"}" autocomplete="new-password" />
                </label>
              </div>
              ${isEdit && bot?.proxyUrlEncrypted ? `<p class="form-hint span-2">Deixe a senha vazia para manter a atual.</p>` : ""}
            </div>
          </div>
        </div>

        <div class="form-section span-2" id="wa-meta-block" style="${isMeta ? "" : "display:none"}">
          <div class="form-section-head">
            <span class="form-section-icon form-section-icon-cyan">${icons.card}</span>
            <div>
              <h4>API oficial Meta (Cloud API)</h4>
              <p>Credenciais do app em <a href="https://developers.facebook.com" target="_blank" rel="noopener">Meta for Developers</a>.</p>
            </div>
          </div>
          <label class="field">Phone Number ID
            <input name="metaPhoneNumberId" value="${isEdit && bot ? escapeHtml(bot.metaPhoneNumberId ?? "") : ""}" placeholder="Ex: 123456789012345" />
          </label>
          <label class="field">Access Token permanente
            <input name="metaAccessToken" type="password" autocomplete="off"
              placeholder="${isEdit ? "Deixe vazio para manter o token atual" : "EAAxxxx..."}" />
          </label>
          <label class="field span-2">Verify Token (webhook)
            <input name="metaVerifyToken" value="${isEdit && bot ? escapeHtml(bot.metaVerifyToken ?? "") : ""}" placeholder="token-secreto-webhook" />
          </label>
          ${
            isEdit && bot
              ? `<div class="field span-2 card" style="padding:14px">
              <p class="form-hint" style="margin-bottom:8px">Configure no painel Meta → WhatsApp → Configuração → Webhook:</p>
              <p><strong>URL:</strong><br/><code class="tracking-link">${escapeHtml(webhookUrl)}</code></p>
              <p style="margin-top:8px"><strong>Verify token:</strong> o mesmo campo acima</p>
            </div>`
              : `<p class="form-hint span-2">Após salvar, a URL do webhook aparecerá aqui.</p>`
          }
        </div>
        <div id="wa-form-init-marker" data-wa-form-init="1" hidden></div>`;
}

export function botInstanceForm(mode: "new" | "edit", bot?: BotConfig) {
  const isEdit = mode === "edit" && !!bot;
  const action = isEdit ? `/instances/${bot.id}` : "/bots";
  const activeTrue = !isEdit || bot.active;
  const paymentPix = !isEdit || bot.paymentMethod !== "laranjinha";
  const delay = delayPartsFromMs(isEdit ? bot.messageDelayMs : 4000);
  const followUpOn = !isEdit || bot.followUpEnabled !== false;
  const followUpMinutes = isEdit ? bot.followUpAfterMinutes ?? 10 : 10;
  const followUpMax = isEdit ? bot.followUpMaxPerLead ?? 2 : 2;
  return `
    <form id="bot-preview-form" method="post" action="${action}" enctype="multipart/form-data">
      <div class="instance-form-layout">
        <div class="instance-form-main">
      <div class="form-grid">
        <label class="field">Nome da instância
          <input name="name" value="${isEdit ? escapeHtml(bot.name) : ""}" placeholder="Ex: MorenaVIP" required />
        </label>
        <label class="field">Ligar instância
          <select name="active">
            <option value="true" ${activeTrue ? "selected" : ""}>Ativo (iniciar motor)</option>
            <option value="false" ${!activeTrue ? "selected" : ""}>Pausado</option>
          </select>
          <span class="form-hint">Ativo ≠ conectado ao WhatsApp. A conexão real aparece depois do QR.</span>
        </label>
        ${waConnectionBlock(isEdit, bot)}
        <label class="field span-2">Foto de perfil do bot
          <div class="dropzone">
            ${isEdit && bot.avatarUrl ? `<div style="margin-bottom:10px">${botAvatarHtml(bot)}</div>` : ""}
            <p style="color:var(--muted);margin-bottom:8px">${icons.upload} ${isEdit ? "Trocar foto (opcional)" : "Imagem quadrada (JPG/PNG)"}</p>
            <input name="avatarFile" type="file" accept="image/*" />
          </div>
        </label>
        <label class="field">Chave Pix
          <input name="pixKey" value="${isEdit ? escapeHtml(bot.pixKey) : ""}" placeholder="CPF, email ou telefone" required />
        </label>
        <label class="field">Nome do recebedor Pix
          <input name="pixRecipientName" value="${isEdit ? escapeHtml(bot.pixRecipientName) : ""}" placeholder="Nome no comprovante" />
        </label>
        <div class="form-section span-2">
          <div class="form-section-head">
            <span class="form-section-icon">${icons.chat}</span>
            <div>
              <h4>Comportamento humano</h4>
              <p>Pausa entre <strong>cada mensagem</strong> no WhatsApp (texto, áudio, foto).</p>
            </div>
          </div>
          <div class="delay-grid">
            <label class="field">
              Minutos
              <input name="messageDelayMinutes" type="number" min="0" max="30" value="${delay.minutes}" />
            </label>
            <label class="field">
              Segundos
              <input name="messageDelaySeconds" type="number" min="0" max="59" value="${delay.seconds}" />
            </label>
          </div>
          <p class="form-hint">Ex: 0 min + 5 seg = resposta rápida. 1 min + 30 seg = ~90s entre cada bolha e antes de responder.</p>
        </div>

        <div class="form-section span-2">
          <div class="form-section-head">
            <span class="form-section-icon form-section-icon-cyan">💬</span>
            <div>
              <h4>Reengajar lead parado</h4>
              <p>Se o lead não responder depois da sua última mensagem, a IA manda um puxão de conversa no tom do prompt.</p>
            </div>
          </div>
          <label class="field">
            Ativar follow-up
            <select name="followUpEnabled">
              <option value="true" ${followUpOn ? "selected" : ""}>Sim</option>
              <option value="false" ${!followUpOn ? "selected" : ""}>Não</option>
            </select>
          </label>
          <label class="field">
            Esperar (minutos)
            <input name="followUpAfterMinutes" type="number" min="1" max="180" value="${followUpMinutes}" />
          </label>
          <label class="field">
            Máx. por lead
            <input name="followUpMaxPerLead" type="number" min="1" max="5" value="${followUpMax}" />
          </label>
          <p class="form-hint span-2">Exemplos no prompt: "oii amor, esqueceu de mim?", "me deixou no vácuo né kkk". O motor escolhe variação no seu tom.</p>
        </div>

        ${previewConfigBlock(isEdit ? bot : undefined, "bot-preview-form")}

        ${deliveryConfigBlock(isEdit ? bot : undefined, "bot-preview-form")}

        <label class="field span-2" id="prompt">Prompt / persona da IA
          <textarea name="prompt" required>${isEdit ? escapeHtml(bot.prompt) : escapeHtml(DEFAULT_PROMPT_WHATSAPP)}</textarea>
          <span class="form-hint">Texto livre da IA desta instância. Use as <strong>tags à direita</strong> para ações automáticas (prévia, Pix, tabela…). Salve sem desconectar o WhatsApp se só alterou prompt, delay ou entrega.</span>
        </label>
        <label class="field">Forma de pagamento
          <select name="paymentMethod">
            <option value="pix" ${paymentPix ? "selected" : ""}>Pix manual (chave)</option>
            <option value="laranjinha" ${!paymentPix ? "selected" : ""}>Gateway Laranjinha</option>
          </select>
        </label>
        <label class="field">API Key Laranjinha <small style="color:var(--muted)">se gateway</small>
          <input name="laranjinhaApiKey" type="password" placeholder="${isEdit ? "Deixe vazio para manter a atual" : "sua chave API"}" autocomplete="off" />
        </label>
      </div>
      <button type="submit" class="btn btn-primary btn-block" style="margin-top:12px">
        ${isEdit ? "Salvar alterações" : "Salvar e ativar instância"}
      </button>
        </div>
        ${promptTagsSidebar()}
      </div>
    </form>`;
}

function waStatusBadge(status: WaLiveStatus) {
  switch (status) {
    case "connected":
      return { cls: "badge-online", label: "Conectado" };
    case "qr_pending":
      return { cls: "badge-paused", label: "Aguardando QR" };
    case "starting":
      return { cls: "badge-paused", label: "Reconectando..." };
    case "disconnected":
      return { cls: "badge-paused", label: "Desconectado" };
    case "auth_failure":
      return { cls: "badge-paused", label: "Erro auth" };
    case "error":
      return { cls: "badge-paused", label: "Erro motor" };
    case "meta_ready":
      return { cls: "badge-online", label: "Meta API" };
    case "meta_missing":
      return { cls: "badge-paused", label: "Meta incompleto" };
    case "offline":
      return { cls: "badge-paused", label: "Offline" };
    case "paused":
    default:
      return { cls: "badge-paused", label: "Pausado" };
  }
}

export function instancesTableHtml(bots: BotConfig[], statuses: Record<string, WaLiveStatus> = {}) {
  if (bots.length === 0) {
    return `<div class="empty">Nenhuma instância ainda. <a href="/instances/new" style="color:var(--primary)">Criar primeira instância</a></div>`;
  }

  return `<div class="table-scroll" role="region" aria-label="Lista de instâncias">
    <table class="table table-instances">
    <thead><tr>
      <th>Bot</th><th>Status</th><th>Leads</th><th>Prévias</th>
      <th class="th-actions">Ações</th>
    </tr></thead>
    <tbody>
    ${bots
      .map((bot) => {
        const live = statuses[bot.id] ?? (bot.active ? "starting" : "paused");
        const badge = waStatusBadge(live);
        const showQr =
          bot.waApiProvider !== "meta_cloud" &&
          bot.active &&
          (live === "qr_pending" ||
            live === "starting" ||
            live === "disconnected" ||
            live === "auth_failure" ||
            live === "error");
        return `
      <tr>
        <td>
          <div class="bot-cell">
            ${botAvatarHtml(bot)}
            <div>
              <div class="title">${escapeHtml(bot.name)}</div>
              <div class="sub">${escapeHtml(bot.waApiProvider === "meta_cloud" ? "Meta API" : "WhatsApp Web")}${bot.proxyEnabled ? " · Proxy" : ""}</div>
            </div>
          </div>
        </td>
        <td>
          <span class="badge ${badge.cls}">
            <span class="badge-dot"></span>
            ${badge.label}
          </span>
        </td>
        <td><span class="metric">—</span></td>
        <td><span class="metric">${bot.previewMediaUrls.length}</span></td>
        <td class="td-actions">
          <div class="row-actions">
            ${
              showQr
                ? `<a href="/instances/${bot.id}/qr" class="action-btn" title="Escanear QR Code">
              <span class="action-btn__label">QR Code</span>
            </a>`
                : ""
            }
            <a href="/instances/${bot.id}/edit" class="action-btn" title="Editar configuração">
              <span class="action-btn__icon">${icons.edit}</span>
              <span class="action-btn__label">Editar</span>
            </a>
            <form method="post" action="/bots/${bot.id}/toggle">
              <button type="submit" class="action-btn action-btn--ghost" title="${bot.active ? "Pausar bot" : "Ativar bot"}">
                <span class="action-btn__label">${bot.active ? "Pausar" : "Ativar"}</span>
              </button>
            </form>
            <form method="post" action="/bots/${bot.id}/delete" onsubmit="return confirm('Remover esta instância?')">
              <button type="submit" class="action-btn action-btn--danger" title="Remover">${icons.trash}</button>
            </form>
          </div>
        </td>
      </tr>`;
      })
      .join("")}
    </tbody>
    </table>
  </div>`;
}
