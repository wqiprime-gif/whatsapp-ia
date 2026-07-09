import type { BotConfig } from "../bots.js";
import type { WaLiveStatus } from "../whatsapp-runtime.js";
import { DEFAULT_PROMPT_WHATSAPP, DEFAULT_PROMPT_WHATSAPP_EN } from "../lib/prompt-default.js";
import { SEED_AUDIO_CATALOG } from "../lib/seed-audios.js";
import { AI_PROVIDERS, OPENROUTER_FREE_MODELS, sanitizeAIModel } from "../lib/ai-providers.js";
import { PROXY_TYPE_OPTIONS, parseProxyUrl } from "../lib/wa-proxy.js";
import { decryptSecret, maskApiKey } from "../lib/crypto.js";
import { icons } from "./icons.js";
import { botInitials, escapeHtml } from "./layout.js";
import { promptTagsSidebar } from "./prompt-tags-block.js";
import { promptGeneratorBlock } from "./prompt-generator-block.js";

function delayPartsFromMs(ms: number) {
  const totalSec = Math.max(1, Math.round(ms / 1000));
  return {
    minutes: Math.floor(totalSec / 60),
    seconds: totalSec % 60
  };
}

export function botAvatarHtml(bot: BotConfig) {
  const initials = botInitials(bot.name);
  const url = bot.avatarUrl?.trim();
  const img = url
    ? `<img class="bot-av-img" src="${escapeHtml(url)}" alt="" loading="lazy" decoding="async"
        onerror="this.classList.add('is-broken')" />`
    : "";
  return `<div class="bot-av-wrap">
    <div class="bot-av bot-av-fallback" aria-hidden="true">${initials}</div>
    ${img}
  </div>`;
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
        <div class="dropzone dropzone-neon">
          <p style="color:var(--muted);margin-bottom:8px">${icons.upload} Imagens ou vídeos (JPG, PNG, MP4)</p>
          <input form="${formId}" name="previewFiles" type="file" accept="image/*,video/*" multiple />
        </div>
      </label>
      <p class="form-hint">Marque &quot;Remover&quot; nos arquivos antigos e envie novos para substituir. Salve o formulário para aplicar.</p>
    </div>`;
}

/** Imagem da tabela de pacotes — enviada no lugar do texto quando o lead pede preços. */
export function priceTableConfigBlock(bot: BotConfig | undefined, formId = "bot-preview-form") {
  const url = (bot?.priceTableImageUrl ?? "").trim();
  const current = url
    ? `<div class="price-table-current">
        <a href="${escapeHtml(url)}" target="_blank" rel="noopener"><img src="${escapeHtml(url)}" alt="Tabela de pacotes" class="price-table-thumb" /></a>
        <label class="audio-remove"><input type="checkbox" form="${formId}" name="removePriceTableImage" value="1" /> Remover imagem atual</label>
      </div>`
    : `<p class="form-hint">Nenhuma imagem cadastrada — o bot envia a tabela em texto (gerada dos pacotes do prompt).</p>`;

  return `
    <div class="form-section form-section-preview" id="tabela-pacotes">
      <div class="form-section-head">
        <span class="form-section-icon form-section-icon-cyan">${icons.box}</span>
        <div>
          <h4>Imagem da tabela de pacotes</h4>
          <p>Enviada quando o lead pede os preços (tag <code>[[send_informacoes]]</code>), no lugar do texto. Os <strong>nomes e valores</strong> que a IA usa pra vender e negociar desconto vêm dos pacotes escritos no seu prompt — mantenha a imagem batendo com eles.</p>
        </div>
      </div>
      ${current}
      <label class="field">
        <span>Imagem dos pacotes (JPG/PNG)</span>
        <div class="dropzone dropzone-neon">
          <p style="color:var(--muted);margin-bottom:8px">${icons.upload} Suba a imagem com os pacotes e valores</p>
          <input form="${formId}" name="priceTableImage" type="file" accept="image/*" />
        </div>
      </label>
      <p class="form-hint">Para a IA entender o que vende, escreva os pacotes no prompt em linhas como <code>- GRUPINHO VIP - R$ 19,80</code>. A imagem é só o visual enviado ao lead.</p>
    </div>`;
}

/** Cartões somente-leitura (player) dos áudios padrão, usados como pré-visualização. */
function seedListReadOnly() {
  return `<div class="audio-grid audio-grid-form">
    ${SEED_AUDIO_CATALOG.map(
      (a) => `
      <article class="audio-card">
        <div class="audio-card-head">
          <span class="audio-badge">${icons.audio}</span>
          <div>
            <h4>${escapeHtml(a.label)}</h4>
            <p class="audio-triggers"><code>[[audio:${escapeHtml(a.slug)}]]</code> · ${escapeHtml(a.triggers || "só pela IA no prompt")}</p>
          </div>
        </div>
        <audio controls preload="none" src="${escapeHtml(a.previewUrl)}" class="audio-player"></audio>
      </article>`
    ).join("")}
  </div>`;
}

/** Notas de voz do funil — cadastradas junto com a instância. */
export function audioConfigBlock(bot: BotConfig | undefined, formId = "bot-preview-form", isNew = false) {
  const library = bot?.audioLibrary ?? [];

  const seedList = isNew
    ? `<div class="audio-grid audio-grid-form">
      ${SEED_AUDIO_CATALOG.map(
        (a) => `
        <article class="audio-card">
          <div class="audio-card-head">
            <span class="audio-badge">${icons.audio}</span>
            <div>
              <h4>${escapeHtml(a.label)}</h4>
              <p class="audio-triggers"><code>[[audio:${escapeHtml(a.slug)}]]</code> · ${escapeHtml(a.triggers || "só pela IA no prompt")}</p>
            </div>
          </div>
          <audio controls preload="none" src="${escapeHtml(a.previewUrl)}" class="audio-player"></audio>
        </article>`
      ).join("")}
    </div>
    <p class="form-hint">Esses 5 áudios entram automaticamente ao criar a instância. Depois de salvar, abra a instância para <strong>ouvir, remover ou trocar</strong> cada um.</p>`
    : "";

  const list =
    library.length === 0 && !isNew
      ? `${seedListReadOnly()}<p class="form-hint">Áudios padrão ativos (a IA já usa). Recarregue a página para gerenciá-los individualmente, ou adicione os seus abaixo.</p>`
      : library.length > 0
        ? `<div class="audio-grid audio-grid-form">
      ${library
        .map(
          (item, i) => `
        <article class="audio-card">
          <div class="audio-card-head">
            <span class="audio-badge">${icons.audio}</span>
            <div>
              <h4>${escapeHtml(item.label)}</h4>
              <p class="audio-triggers"><code>[[audio:${escapeHtml(item.slug || item.label.toLowerCase().replace(/\s+/g, "_"))}]]</code> · ${escapeHtml(item.triggers || item.keywords || "só pela IA no prompt")}</p>
            </div>
          </div>
          <audio controls preload="none" src="${escapeHtml(item.url)}" class="audio-player"></audio>
          <div class="audio-card-actions">
            <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener" class="btn btn-secondary btn-sm">Abrir</a>
            <label class="audio-remove"><input type="checkbox" form="${formId}" name="removeAudioIndexes" value="${i}" /> Remover</label>
          </div>
        </article>`
        )
        .join("")}
    </div>`
        : "";

  return `
    <div class="form-section form-section-preview span-2" id="audios-funil">
      <div class="form-section-head">
        <span class="form-section-icon form-section-icon-cyan">${icons.audio}</span>
        <div>
          <h4>Áudios do funil (notas de voz)</h4>
          <p>Gravações enviadas no WhatsApp quando a IA usa <code>[[audio:slug]]</code> ou quando o lead dispara um gatilho.</p>
        </div>
      </div>
      ${isNew ? `<p class="form-hint"><strong>Áudios padrão incluídos na criação:</strong></p>${seedList}` : list}
      <div class="audio-add-grid audio-add-grid-3" style="margin-top:12px">
        <label class="field">
          O que o áudio <strong>fala</strong>
          <input form="${formId}" name="newAudioLabel" placeholder="eu nao sou fake" />
        </label>
        <label class="field">
          <strong>ID no prompt</strong>
          <input form="${formId}" name="newAudioSlug" placeholder="nao_sou_fake" />
        </label>
        <label class="field">
          Gatilhos do lead <small>(opcional)</small>
          <input form="${formId}" name="newAudioTriggers" placeholder="fake, golpe, voce e real" />
        </label>
      </div>
      <label class="field">
        <span>Arquivo de áudio (MP3, M4A, OGG)</span>
        <div class="dropzone dropzone-neon">
          <p style="color:var(--muted);margin-bottom:8px">${icons.upload} Nota de voz ou áudio gravado</p>
          <input form="${formId}" name="newAudioFile" type="file" accept="audio/*,.ogg,.opus" />
        </div>
      </label>
      <p class="form-hint">Preencha nome + ID + arquivo para adicionar um áudio. Salve o formulário da instância para aplicar. Use as tags <code>[[audio:slug]]</code> no prompt.</p>
    </div>`;
}

function platformConnectionBlock(_isEdit: boolean, _bot?: BotConfig) {
  return `<div id="wa-form-init-marker" data-wa-form-init="1" hidden></div>`;
}

/** Entrega automática após comprovante aprovado (link e/ou mídias). */
export function deliveryConfigBlock(bot: BotConfig | undefined, formId = "bot-preview-form") {
  const link = bot?.deliveryLink ?? "";
  const videoCallLink = bot?.videoCallLink ?? "";
  const videoCallVideoUrl = bot?.videoCallVideoUrl ?? "";
  const callerName = bot?.videoCallCallerName ?? bot?.name ?? "";
  const videoName = videoCallVideoUrl ? videoCallVideoUrl.split("/").pop() || videoCallVideoUrl : "";
  const videoPreview = videoCallVideoUrl
    ? `<video src="${escapeHtml(videoCallVideoUrl)}" controls playsinline style="max-width:100%;border-radius:12px;margin-top:8px"></video>`
    : "";
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
        <input name="deliveryLink" value="${escapeHtml(link)}" placeholder="https://drive.google.com/... ou link do canal/página VIP" />
        <span class="form-hint">Pack/fotos — enviado após pagamento de pacote básico ou completo.</span>
      </label>
      <label class="field">Nome na chamada
        <input name="videoCallCallerName" value="${escapeHtml(callerName)}" placeholder="Ex: Bia" />
        <span class="form-hint">Aparece na tela &quot;está te ligando...&quot; do link OnlyChat.</span>
      </label>
      <label class="field span-2">Vídeo da chamada (MP4)
        <div class="dropzone dropzone-neon">
          <p style="color:var(--muted);margin-bottom:8px">${icons.upload} Vídeo em tela cheia após o lead atender</p>
          <input form="${formId}" name="callVideoFile" type="file" accept="video/mp4,video/*" />
        </div>
        ${videoPreview}
        ${videoCallVideoUrl ? `<label class="audio-remove"><input type="checkbox" form="${formId}" name="removeCallVideo" value="1" /> Remover vídeo atual (${escapeHtml(videoName)})</label>` : ""}
        <span class="form-hint">Após o pagamento da chamada, o bot envia um <strong>link OnlyChat</strong> (~10 min) com simulador de ligação.</span>
      </label>
      <label class="field span-2">Link externo da chamada (opcional)
        <input name="videoCallLink" value="${escapeHtml(videoCallLink)}" placeholder="https://meet.google.com/... (só se não usar vídeo MP4 acima)" />
        <span class="form-hint">Se o MP4 estiver configurado, o sistema prioriza o link OnlyChat. Use este campo só para link manual externo.</span>
      </label>
      ${list}
      <label class="field">
        <span>Mídias de entrega (opcional)</span>
        <div class="dropzone dropzone-neon">
          <p style="color:var(--muted);margin-bottom:8px">${icons.upload} Arquivos extras enviados junto com o link</p>
          <input form="${formId}" name="deliveryFiles" type="file" accept="image/*,video/*,application/pdf" multiple />
        </div>
      </label>
    </div>`;
}

function aiConfigBlock(isEdit: boolean, bot?: BotConfig) {
  const provider = bot?.aiProvider ?? "openai";
  const model = sanitizeAIModel(provider, bot?.aiModel ?? AI_PROVIDERS[provider].defaultModel);
  const hasKey = Boolean(bot?.aiApiKeyEncrypted);
  let maskedKey = "";
  if (hasKey && bot?.aiApiKeyEncrypted) {
    try {
      maskedKey = maskApiKey(decryptSecret(bot.aiApiKeyEncrypted));
    } catch {
      maskedKey = "•••••••• (salva)";
    }
  }
  const providerOptions = Object.entries(AI_PROVIDERS)
    .map(
      ([id, p]) =>
        `<option value="${id}" ${provider === id ? "selected" : ""}>${escapeHtml(p.label)}</option>`
    )
    .join("");
  const hint = AI_PROVIDERS[provider]?.keyHint ?? "sk-...";
  const freeModelOptions = OPENROUTER_FREE_MODELS.map(
    (m) => `<option value="${escapeHtml(m.id)}">${escapeHtml(m.label)}</option>`
  ).join("");

  return `
    <div class="form-section span-2 form-section-ai" id="ia-instancia">
      <div class="form-section-head">
        <span class="form-section-icon form-section-icon-cyan">${icons.sparkles}</span>
        <div>
          <h4>Inteligência Artificial desta instância</h4>
          <p>Escolha o provedor, modelo e API Key usados para responder os leads desta instância.</p>
        </div>
      </div>
      ${isEdit && hasKey ? `<p class="form-hint" style="color:#3b82f6;margin-bottom:10px">Chave ativa: <code style="color:#93c5fd">${escapeHtml(maskedKey)}</code> — deixe o campo abaixo vazio para manter.</p>` : ""}
      <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:14px">
        <label class="field">
          <span>Provedor de IA</span>
          <select name="aiProvider" id="inst-ai-provider">
            ${providerOptions}
          </select>
        </label>
        <label class="field">
          <span>Modelo IA</span>
          <input name="aiModel" list="inst-ai-models" value="${escapeHtml(model)}" placeholder="${escapeHtml(AI_PROVIDERS[provider].defaultModel)}" />
          <datalist id="inst-ai-models">${freeModelOptions}</datalist>
        </label>
        <label class="field span-2">
          <span>API Key da IA ${isEdit ? "" : "<strong style='color:#EAB308'>(obrigatório)</strong>"}</span>
          <input name="aiApiKey" type="password" placeholder="${isEdit && hasKey ? `Salva: ${escapeHtml(maskedKey)} — vazio para manter` : escapeHtml(hint)}" autocomplete="new-password" ${isEdit ? "" : "required minlength='8'"} />
        </label>
      </div>
    </div>`;
}

function waConnectionBlock(isEdit: boolean, bot?: BotConfig) {
  const proxyOn = Boolean(bot?.proxyEnabled);
  const waPhone = bot?.waPhoneNumber ?? "";
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

  return `
        <input type="hidden" name="waApiProvider" value="whatsapp_web" />

        <div class="form-section span-2" id="wa-web-block">
          <div class="form-section-head">
            <span class="form-section-icon">${icons.chat}</span>
            <div>
              <h4>WhatsApp Web + QR</h4>
              <p>Conexão via <strong>whatsapp-web.js</strong> (Puppeteer).</p>
            </div>
          </div>
          <label class="field span-2">
            <span>Número conectado (DDI+DDD+número)</span>
            <input name="waPhoneNumber" type="tel" inputmode="numeric" autocomplete="tel"
              value="${escapeHtml(waPhone)}" placeholder="5511999999999" />
            <span class="form-hint">Usado automaticamente no <strong>Gerador de links</strong> — não precisa digitar de novo lá.</span>
          </label>
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
        </div>`;
}

export function botInstanceForm(mode: "new" | "edit", bot?: BotConfig) {
  const isEdit = mode === "edit" && !!bot;
  const action = isEdit ? `/instances/${bot.id}` : "/bots";
  const activeTrue = !isEdit || bot.active;
  const delay = delayPartsFromMs(isEdit ? bot.messageDelayMs : 4000);
  const followUpOn = !isEdit || bot.followUpEnabled !== false;
  const followUpMinutes = isEdit ? bot.followUpAfterMinutes ?? 10 : 10;
  const followUpMax = isEdit ? bot.followUpMaxPerLead ?? 2 : 2;
  const followUpSteps = isEdit ? bot.followUpSteps ?? [] : [];
  const botLocale = isEdit ? (bot.locale === "en-US" ? "en-US" : "pt-BR") : "pt-BR";
  const defaultPromptText = botLocale === "en-US" ? DEFAULT_PROMPT_WHATSAPP_EN : DEFAULT_PROMPT_WHATSAPP;
  const followUpStepRows =
    followUpSteps.length > 0
      ? followUpSteps
          .map(
            (step, i) => `<div class="follow-up-row" data-follow-row>
            <span class="follow-up-num">${i + 1}</span>
            <label class="field">Mensagem
              <textarea name="followUpMessage" rows="2" placeholder="Ex: oii amor, esqueceu de mim?">${escapeHtml(step.message)}</textarea>
            </label>
            <label class="field">Esperar (min)
              <input name="followUpMinutes" type="number" min="1" max="180" value="${step.afterMinutes}" />
            </label>
            <button type="button" class="btn btn-secondary btn-sm follow-row-remove">Remover</button>
          </div>`
          )
          .join("")
      : "";
  return `
    <form id="bot-preview-form" method="post" action="${action}" enctype="multipart/form-data">
      <div class="instance-form-layout">
        <div class="instance-form-main">
      <div class="form-grid">
        <label class="field">Nome da instância
          <input name="name" value="${isEdit ? escapeHtml(bot.name) : ""}" placeholder="Ex: MorenaVIP" required />
        </label>
        <label class="field">Idioma do bot
          <select name="locale">
            <option value="pt-BR" ${botLocale === "pt-BR" ? "selected" : ""}>Português (Brasil)</option>
            <option value="en-US" ${botLocale === "en-US" ? "selected" : ""}>English (international)</option>
          </select>
          <span class="form-hint">Use English para tráfego gringo no WhatsApp.</span>
        </label>
        <label class="field">Ligar instância
          <select name="active">
            <option value="true" ${activeTrue ? "selected" : ""}>Ativo (iniciar motor)</option>
            <option value="false" ${!activeTrue ? "selected" : ""}>Pausado</option>
          </select>
          <span class="form-hint">Ativo ≠ conectado ao WhatsApp. A conexão real aparece depois do QR.</span>
        </label>
        ${aiConfigBlock(isEdit, bot)}
        ${platformConnectionBlock(isEdit, bot)}
        <div id="wa-platform-blocks">
        ${waConnectionBlock(isEdit, bot)}
        </div>
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
              <p>Se o lead não responder, o bot manda mensagens de follow-up na ordem abaixo — cada uma após o tempo configurado.</p>
            </div>
          </div>
          <label class="field">
            Ativar follow-up
            <select name="followUpEnabled">
              <option value="true" ${followUpOn ? "selected" : ""}>Sim</option>
              <option value="false" ${!followUpOn ? "selected" : ""}>Não</option>
            </select>
          </label>
          <div id="follow-up-steps" class="follow-up-steps">${followUpStepRows}</div>
          <button type="button" class="btn btn-secondary btn-sm" id="follow-up-add-btn">+ Adicionar mensagem</button>
          <p class="form-hint">Máximo 5 mensagens. O tempo é contado desde a <strong>última mensagem do bot</strong> sem resposta do lead.</p>
          <details class="follow-up-fallback" style="margin-top:14px">
            <summary>Modo automático (sem mensagens cadastradas)</summary>
            <div class="follow-up-fallback-grid">
              <label class="field">
                Esperar (minutos) — IA
                <input name="followUpAfterMinutes" type="number" min="1" max="180" value="${followUpMinutes}" />
              </label>
              <label class="field">
                Máx. por lead — IA
                <input name="followUpMaxPerLead" type="number" min="1" max="5" value="${followUpMax}" />
              </label>
            </div>
            <p class="form-hint">Só entra se você não cadastrar mensagens acima. A IA inventa frases no tom do prompt.</p>
          </details>
        </div>

        ${previewConfigBlock(isEdit ? bot : undefined, "bot-preview-form")}
        ${priceTableConfigBlock(isEdit ? bot : undefined, "bot-preview-form")}
        ${deliveryConfigBlock(isEdit ? bot : undefined, "bot-preview-form")}
        ${audioConfigBlock(isEdit ? bot : undefined, "bot-preview-form", !isEdit)}

        ${promptGeneratorBlock()}

        <label class="field span-2" id="prompt">Prompt / persona da IA
          <div class="prompt-editor">
            <div class="prompt-editor-backdrop" id="prompt-backdrop" aria-hidden="true"></div>
            <textarea name="prompt" id="prompt-textarea" class="prompt-editor-input" spellcheck="false" required>${isEdit ? escapeHtml(bot.prompt) : escapeHtml(defaultPromptText)}</textarea>
          </div>
          <span class="form-hint">Texto livre da IA desta instância. As <strong class="prompt-hint-tag">tags</strong> ficam destacadas em amarelo — clique nas tags à direita para inserir ações automáticas (prévia, Pix, tabela…). Salve sem desconectar o WhatsApp se só alterou prompt, delay ou entrega.</span>
        </label>
      </div>
      <script>
        (function () {
          var ta = document.getElementById("prompt-textarea");
          var bd = document.getElementById("prompt-backdrop");
          if (!ta || !bd) return;
          function esc(s) {
            return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
          }
          function render() {
            var html = esc(ta.value).replace(/\\[\\[.+?\\]\\]/g, function (m) {
              return '<mark class="prompt-tag-hl">' + m + "</mark>";
            });
            bd.innerHTML = html + "\\n";
            bd.scrollTop = ta.scrollTop;
            bd.scrollLeft = ta.scrollLeft;
          }
          ta.addEventListener("input", render);
          ta.addEventListener("scroll", function () {
            bd.scrollTop = ta.scrollTop;
            bd.scrollLeft = ta.scrollLeft;
          });
          window.__refreshPromptHighlight = render;
          render();
        })();
      </script>
      <div class="form-actions-bar">
        <button type="submit" class="btn btn-primary btn-lg">
          ${isEdit ? "Salvar alterações" : "Salvar e ativar instância"}
        </button>
      </div>
        </div>
        ${promptTagsSidebar(isEdit ? bot : undefined)}
      </div>
    </form>
    <script>
    (function () {
      var fuWrap = document.getElementById("follow-up-steps");
      var fuBtn = document.getElementById("follow-up-add-btn");
      function renumberFollowRows() {
        if (!fuWrap) return;
        var rows = fuWrap.querySelectorAll("[data-follow-row]");
        rows.forEach(function (row, idx) {
          var num = row.querySelector(".follow-up-num");
          if (num) num.textContent = String(idx + 1);
        });
      }
      function addFollowRow(msg, mins) {
        if (!fuWrap) return;
        if (fuWrap.querySelectorAll("[data-follow-row]").length >= 5) return;
        var row = document.createElement("div");
        row.className = "follow-up-row";
        row.setAttribute("data-follow-row", "");
        row.innerHTML = '<span class="follow-up-num">1</span>'
          + '<label class="field">Mensagem<textarea name="followUpMessage" rows="2" placeholder="Ex: oii amor, esqueceu de mim?"></textarea></label>'
          + '<label class="field">Esperar (min)<input name="followUpMinutes" type="number" min="1" max="180" value="' + (mins || 10) + '" /></label>'
          + '<button type="button" class="btn btn-secondary btn-sm follow-row-remove">Remover</button>';
        var ta = row.querySelector("textarea");
        if (ta && msg) ta.value = msg;
        row.querySelector(".follow-row-remove").onclick = function () { row.remove(); renumberFollowRows(); };
        fuWrap.appendChild(row);
        renumberFollowRows();
      }
      if (fuBtn && fuWrap) {
        fuBtn.onclick = function () { addFollowRow("", 10); };
        if (!fuWrap.querySelector("[data-follow-row]")) {
          addFollowRow("oii amor, esqueceu de mim?", 10);
          addFollowRow("me deixou no vácuo né kkk", 25);
        } else {
          fuWrap.querySelectorAll(".follow-row-remove").forEach(function (btn) {
            btn.onclick = function () {
              var row = btn.closest("[data-follow-row]");
              if (row) row.remove();
              renumberFollowRows();
            };
          });
        }
      }
    })();
    </script>`;
}

function waStatusBadge(status: WaLiveStatus) {
  switch (status) {
    case "connected":
    case "meta_ready":
      return { cls: "badge-online", label: "Online" };
    case "qr_pending":
      return { cls: "badge-paused", label: "Aguardando QR" };
    case "starting":
      return { cls: "badge-paused", label: "Reconectando..." };
    case "disconnected":
      return { cls: "badge-offline", label: "Offline" };
    case "auth_failure":
      return { cls: "badge-offline", label: "Erro auth" };
    case "error":
      return { cls: "badge-offline", label: "Erro motor" };
    case "meta_missing":
      return { cls: "badge-paused", label: "Meta incompleto" };
    case "offline":
      return { cls: "badge-offline", label: "Offline" };
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
              <div class="sub">${escapeHtml(bot.waApiProvider === "meta_cloud" ? "WhatsApp Web (legado)" : "WhatsApp Web")}${bot.proxyEnabled ? " · Proxy" : ""}${bot.waPhoneNumber ? ` · ${escapeHtml(bot.waPhoneNumber)}` : ""}</div>
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
