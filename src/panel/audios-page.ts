import type { BotConfig } from "../bots.js";
import { icons } from "./icons.js";
import { escapeHtml } from "./layout.js";
import { alertHtml, appLayout } from "./layout.js";

export function audiosPage(
  bots: BotConfig[],
  selectedBotId: string,
  message = "",
  isError = false,
  partial?: boolean
) {
  const bot = bots.find((b) => b.id === selectedBotId) ?? bots[0];
  const library = bot?.audioLibrary ?? [];

  const botOptions =
    bots.length === 0
      ? `<option value="">Cadastre uma instância</option>`
      : bots
          .map(
            (b) =>
              `<option value="${b.id}" ${b.id === bot?.id ? "selected" : ""}>${escapeHtml(b.name)}</option>`
          )
          .join("");

  const list =
    library.length === 0
      ? `<div class="empty glow-empty">Nenhum áudio ainda. Cadastre abaixo: o que o lead pergunta → o que o áudio responde.</div>`
      : `<div class="audio-grid">
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
            <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener" class="btn btn-secondary btn-sm">Abrir arquivo</a>
            <label class="audio-remove"><input type="checkbox" form="audio-add-form" name="removeAudioIndexes" value="${i}" /> Remover</label>
          </div>
        </article>`
        )
        .join("")}
    </div>`;

  const body = `
    ${message ? alertHtml(message, isError ? "error" : "success") : ""}
    <div class="page-hero neon-hero">
      <div>
        <h2 class="hero-title"><span class="brand-accent">Áudios</span> inteligentes</h2>
        <p class="hero-desc">Lead pergunta <em>"de onde você é?"</em> → o bot envia o áudio <em>"sou de Santa Catarina meu amor"</em>. Cadastre todos os seus áudios aqui.</p>
      </div>
    </div>
    <div class="card card-neon">
      <div class="card-head"><h3>${icons.layers} Instância</h3></div>
      <div class="card-body">
        <form method="get" action="/audios" class="inline-form">
          <label class="field">Escolha o bot
            <select name="botId" onchange="this.form.submit()">${botOptions}</select>
          </label>
        </form>
      </div>
    </div>
    ${bot ? list : ""}
    ${
      bot
        ? `
    <div class="card card-neon" style="margin-top:16px">
      <div class="card-head"><h3>${icons.plus} Novo áudio</h3></div>
      <div class="card-body">
        <form id="audio-add-form" method="post" action="/audios" enctype="multipart/form-data">
          <input type="hidden" name="botId" value="${bot.id}" />
          <div class="audio-add-grid audio-add-grid-3">
            <label class="field">
              O que o áudio <strong>fala</strong>
              <input name="newAudioLabel" required placeholder="eu nao sou fake" />
            </label>
            <label class="field">
              <strong>ID no prompt</strong>
              <input name="newAudioSlug" required placeholder="nao_sou_fake" />
            </label>
            <label class="field">
              Gatilhos do lead <small>(opcional)</small>
              <input name="newAudioTriggers" placeholder="fake, golpe, voce e real" />
            </label>
          </div>
          <p class="form-hint">Ex no prompt: <em>Caso o lead desconfie, use [[audio:nao_sou_fake]]</em></p>
          <label class="field">
            Arquivo (MP3, M4A, OGG)
            <div class="dropzone dropzone-neon">
              <p>${icons.upload} Nota de voz ou áudio gravado</p>
              <input name="newAudioFile" type="file" accept="audio/*,.ogg,.opus" required />
            </div>
          </label>
          <button type="submit" class="btn btn-primary btn-block">Salvar áudio na biblioteca</button>
        </form>
      </div>
    </div>`
        : `<div class="empty">Crie uma instância em <a href="/instances/new">Nova Instância</a>.</div>`
    }`;

  if (partial) return body;
  return appLayout("Áudios", "audios", body, false);
}
