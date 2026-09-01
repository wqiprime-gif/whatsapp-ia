import type { BotConfig } from "../bots.js";
import { giftSlugFromName } from "../lib/gifts.js";
import { icons } from "./icons.js";
import { alertHtml, appLayout, escapeHtml } from "./layout.js";

function mergeGiftItems(
  existing: BotConfig["giftItems"],
  raw: Record<string, string | string[]>
) {
  const names = raw.giftName;
  const messages = raw.giftAsk;
  const nameList = Array.isArray(names) ? names : names ? [names] : [];
  const msgList = Array.isArray(messages) ? messages : messages ? [messages] : [];
  const remove = new Set(
    (Array.isArray(raw.removeGiftIndexes)
      ? raw.removeGiftIndexes
      : raw.removeGiftIndexes
        ? [raw.removeGiftIndexes]
        : []
    ).map((v) => Number(v))
  );

  const kept = (existing ?? []).filter((_, i) => !remove.has(i));
  const added = nameList
    .map((name, i) => ({
      name: String(name || "").trim(),
      askMessage: String(msgList[i] || "").trim()
    }))
    .filter((g) => g.name)
    .map((g) => ({
      ...g,
      slug: giftSlugFromName(g.name),
      askMessage: g.askMessage || `amor, me manda um presentinho? ${g.name} 😘`
    }));

  return [...kept, ...added];
}

export function giftsPage(
  bots: BotConfig[],
  selectedBotId: string,
  message = "",
  isError = false,
  partial?: boolean,
  showAdminNav = false
) {
  const bot = bots.find((b) => b.id === selectedBotId) ?? bots[0];
  const items = bot?.giftItems ?? [];
  const canSave = Boolean(bot);

  const botOptions =
    bots.length === 0
      ? `<option value="">— Crie uma instância primeiro —</option>`
      : bots
          .map(
            (b) =>
              `<option value="${b.id}" ${b.id === bot?.id ? "selected" : ""}>${escapeHtml(b.name)}</option>`
          )
          .join("");

  const list =
    !bot
      ? `<p class="form-hint">Selecione ou crie uma instância acima para ver os presentes salvos.</p>`
      : items.length === 0
        ? `<div class="empty glow-empty">Nenhum presente cadastrado. Use o botão abaixo para adicionar.</div>`
        : `<div class="gift-grid">
      ${items
        .map((item, i) => {
          const slug = item.slug || giftSlugFromName(item.name);
          return `<article class="gift-card">
          <div class="gift-card-head">
            <span class="gift-badge">${icons.sparkles}</span>
            <div>
              <h4>${escapeHtml(item.name)}</h4>
              <p class="muted-sm"><code>[[pedir_presente:${escapeHtml(slug)}]]</code></p>
            </div>
          </div>
          <p class="gift-ask-preview">${escapeHtml(item.askMessage)}</p>
          <label class="audio-remove"><input type="checkbox" form="gift-save-form" name="removeGiftIndexes" value="${i}" /> Remover</label>
        </article>`;
        })
        .join("")}
    </div>`;

  const body = `
    ${message ? alertHtml(message, isError ? "error" : "success") : ""}
    <div class="page-hero neon-hero">
      <div>
        <h2 class="hero-title"><span class="brand-accent">Pedir presentes</span></h2>
        <p class="hero-desc">Defina o <strong>prompt</strong> de quando pedir mimos e cadastre os presentes. No prompt da instância use <code>[[pedir_presente]]</code>.</p>
      </div>
    </div>
    <div class="card card-neon">
      <div class="card-head"><h3>${icons.layers} Instância</h3></div>
      <div class="card-body">
        <form method="get" action="/gifts" class="inline-form">
          <label class="field">Escolha o bot
            <select name="botId" onchange="this.form.submit()">${botOptions}</select>
          </label>
        </form>
        ${bots.length === 0 ? `<p class="form-hint" style="margin-top:12px"><a href="/instances/new">+ Criar primeira instância</a></p>` : ""}
      </div>
    </div>

    <div class="card card-neon" style="margin-top:16px">
      <div class="card-head"><h3>${icons.doc} Prompt da IA</h3></div>
      <div class="card-body">
        <form id="gift-save-form" method="post" action="/gifts">
          <input type="hidden" name="botId" value="${bot?.id ?? ""}" />
          <label class="field">Instruções — quando e como pedir presente
            <textarea name="giftPrompt" rows="5" class="gift-prompt-field" placeholder="Ex: Depois que o lead elogiar, demonstrar carinho ou perguntar como ajudar, peça um mimo com leveza. Nunca na primeira mensagem. Use [[pedir_presente]] na resposta." ${canSave ? "" : "disabled"}>${escapeHtml(bot?.giftPrompt ?? "")}</textarea>
          </label>
          <p class="form-hint">Este texto entra no contexto da IA junto com os presentes cadastrados abaixo.</p>

          <div class="post-sale-panel" style="margin-top:24px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.08)">
            <h4 class="post-sale-title">Pós-venda automático</h4>
            <p class="form-hint">Depois de uma compra, o bot volta a conversar com naturalidade e pede presente (ex: açaí).</p>
            <label class="toggle-row" style="margin:14px 0">
              <input type="checkbox" name="postSaleEnabled" form="gift-save-form" value="on" ${bot?.postSaleEnabled ? "checked" : ""} ${canSave ? "" : "disabled"} />
              <span>Ativar reengajamento pós-venda</span>
            </label>
            <div class="post-sale-grid">
              <label class="field">Esperar quantos dias após a compra?
                <input type="range" name="postSaleWaitDays" form="gift-save-form" min="1" max="7" value="${bot?.postSaleWaitDays ?? 2}" ${canSave ? "" : "disabled"} oninput="this.nextElementSibling.textContent=this.value+' dias'" />
                <span class="range-val">${bot?.postSaleWaitDays ?? 2} dias</span>
              </label>
              <label class="field">Mensagens de conversa antes do pedido
                <input type="number" name="postSaleWarmupReplies" form="gift-save-form" min="1" max="5" value="${bot?.postSaleWarmupReplies ?? 2}" ${canSave ? "" : "disabled"} />
              </label>
              <label class="field">Minutos até pedir presente
                <input type="number" name="postSaleGiftDelayMinutes" form="gift-save-form" min="5" max="240" value="${bot?.postSaleGiftDelayMinutes ?? 45}" ${canSave ? "" : "disabled"} />
              </label>
            </div>
            <label class="field">Como reabrir a conversa (IA)
              <textarea name="postSaleOpenerPrompt" form="gift-save-form" rows="3" placeholder="Ex: Puxe assunto leve, pergunte como ele tá, sem falar de venda." ${canSave ? "" : "disabled"}>${escapeHtml(bot?.postSaleOpenerPrompt ?? "")}</textarea>
            </label>
            <div class="post-sale-timeline">
              <span>Dia N → conversa → pede presente → continua conversando</span>
            </div>
          </div>

          <div class="post-sale-panel" style="margin-top:24px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.08)">
            <h4 class="post-sale-title">Upsell de pacote</h4>
            <p class="form-hint">Depois da compra, oferece upgrade para um pacote maior. Use regras ou deixe vazio para subir automaticamente para o próximo pacote mais caro.</p>
            <label class="toggle-row" style="margin:14px 0">
              <input type="checkbox" name="upsellEnabled" form="gift-save-form" value="on" ${bot?.upsellEnabled ? "checked" : ""} ${canSave ? "" : "disabled"} />
              <span>Ativar upsell após compra</span>
            </label>
            <div class="post-sale-grid">
              <label class="field">Minutos após entrega (imediato)
                <input type="number" name="upsellDelayMinutes" form="gift-save-form" min="0" max="60" value="${bot?.upsellDelayMinutes ?? 2}" ${canSave ? "" : "disabled"} />
              </label>
              <label class="toggle-row" style="align-self:end">
                <input type="checkbox" name="upsellInPostSale" form="gift-save-form" value="on" ${bot?.upsellInPostSale !== false ? "checked" : ""} ${canSave ? "" : "disabled"} />
                <span>Também no pós-venda (antes do presente)</span>
              </label>
            </div>
            <label class="field">Instruções para a IA (upsell)
              <textarea name="upsellPrompt" form="gift-save-form" rows="3" placeholder="Ex: Ofereça o pacote maior com naturalidade. Se aceitar, mande o Pix da diferença." ${canSave ? "" : "disabled"}>${escapeHtml(bot?.upsellPrompt ?? "")}</textarea>
            </label>
            <p class="form-hint">Placeholders nas mensagens: <code>{from}</code> <code>{to}</code> <code>{price}</code> <code>{diff}</code></p>
          </div>
        </form>
      </div>
    </div>

    <div class="card card-neon" style="margin-top:16px">
      <div class="card-head"><h3>${icons.sparkles} Regras de upsell</h3></div>
      <div class="card-body">
        ${
          !bot
            ? `<p class="form-hint">Selecione uma instância acima.</p>`
            : (bot.upsellRules ?? []).length === 0
              ? `<div class="empty glow-empty">Nenhuma regra — o bot usa o próximo pacote mais caro automaticamente.</div>`
              : `<div class="gift-grid">
          ${(bot.upsellRules ?? [])
            .map((rule, i) => {
              return `<article class="gift-card">
              <div class="gift-card-head">
                <span class="gift-badge">${icons.layers}</span>
                <div>
                  <h4>${escapeHtml(rule.fromProduct || "Qualquer")} → ${escapeHtml(rule.toProduct)}</h4>
                </div>
              </div>
              <p class="gift-ask-preview">${escapeHtml(rule.message)}</p>
              <label class="audio-remove"><input type="checkbox" form="gift-save-form" name="removeUpsellIndexes" value="${i}" /> Remover</label>
            </article>`;
            })
            .join("")}
        </div>`
        }
        <div id="upsell-new-blocks" class="seq-block" style="margin-top:16px"></div>
        <button type="button" class="btn btn-secondary btn-sm" id="upsell-add-btn" ${canSave ? "" : "disabled"}>${icons.plus} Adicionar regra</button>
      </div>
    </div>

    <div class="card card-neon" style="margin-top:16px">
      <div class="card-head"><h3>${icons.sparkles} Presentes cadastrados</h3></div>
      <div class="card-body">
        ${list}
        <div id="gift-new-blocks" class="seq-block" style="margin-top:16px"></div>
        <button type="button" class="btn btn-secondary btn-sm" id="gift-add-btn" ${canSave ? "" : "disabled"}>${icons.plus} Adicionar presente</button>
        <button type="submit" form="gift-save-form" class="btn btn-primary" style="margin-left:8px" ${canSave ? "" : "disabled"}>
          Salvar tudo
        </button>
      </div>
    </div>
    <script>${giftBlocksScript(canSave)}</script>
    <script>${upsellBlocksScript(canSave)}</script>`;

  return appLayout("Pedir presentes", "gifts", body, partial, "Usuario", "", "", "", "", showAdminNav);
}

function giftBlocksScript(canSave: boolean) {
  return `
(function(){
  var wrap = document.getElementById("gift-new-blocks");
  var btn = document.getElementById("gift-add-btn");
  if (!wrap || !btn) return;
  var enabled = ${canSave ? "true" : "false"};
  function add(){
    if (!enabled) return;
    var row = document.createElement("div");
    row.className = "gift-add-row";
    row.innerHTML = '<label class="field">Nome do presente<input name="giftName" form="gift-save-form" placeholder="Ex: Pix de R$ 10" /></label>'
      + '<label class="field">Mensagem ao pedir<textarea name="giftAsk" form="gift-save-form" rows="2" placeholder="amor, me manda um pixinho de 10? 🥺"></textarea></label>'
      + '<button type="button" class="btn btn-secondary btn-sm gift-row-remove">Remover</button>';
    row.querySelector(".gift-row-remove").onclick = function(){ row.remove(); };
    wrap.appendChild(row);
  }
  if (enabled) {
    btn.onclick = add;
    add();
  }
})();
`.trim();
}

function upsellBlocksScript(canSave: boolean) {
  return `
(function(){
  var wrap = document.getElementById("upsell-new-blocks");
  var btn = document.getElementById("upsell-add-btn");
  if (!wrap || !btn) return;
  var enabled = ${canSave ? "true" : "false"};
  function add(){
    if (!enabled) return;
    var row = document.createElement("div");
    row.className = "gift-add-row";
    row.innerHTML = '<label class="field">Comprou (vazio = qualquer)<input name="upsellFrom" form="gift-save-form" placeholder="Ex: Básico" /></label>'
      + '<label class="field">Oferecer upgrade<input name="upsellTo" form="gift-save-form" placeholder="Ex: Completo" /></label>'
      + '<label class="field">Mensagem<textarea name="upsellMessage" form="gift-save-form" rows="2" placeholder="amor, gostou? o {to} sai por R$ {diff} a mais"></textarea></label>'
      + '<button type="button" class="btn btn-secondary btn-sm gift-row-remove">Remover</button>';
    row.querySelector(".gift-row-remove").onclick = function(){ row.remove(); };
    wrap.appendChild(row);
  }
  if (enabled) {
    btn.onclick = add;
  }
})();
`.trim();
}

export { mergeGiftItems };
