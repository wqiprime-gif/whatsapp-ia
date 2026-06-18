import type { BotConfig } from "../bots.js";
import type { ScheduledCampaign } from "../lib/scheduled-campaigns.js";
import { sourceEmoji, sourceLabel } from "../lib/lead-source.js";
import { alertHtml, appLayout, escapeHtml, type NavId } from "./layout.js";
import { icons } from "./icons.js";

function wrap(title: string, nav: NavId, body: string, partial?: boolean, subtitle = "") {
  if (partial) return `${body}`;
  const shell = `<div class="page-shell">${body}</div>`;
  return appLayout(title, nav, shell, false, "Usuario", subtitle);
}

function formatMoney(cents: number) {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

function formatDate(value: string | Date) {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function leadsPage(rows: Record<string, unknown>[], partial?: boolean) {
  const list =
    rows.length === 0
      ? `<div class="empty">Nenhum lead ainda. Quando alguem falar com o bot, aparece aqui.</div>`
      : `<table class="table"><thead><tr><th>Lead</th><th>Origem</th><th>Bot</th><th>Chat ID</th><th>Ultima msg</th></tr></thead><tbody>
      ${rows
        .map(
          (r) => {
            const src = String(r.source || "unknown");
            return `<tr>
          <td><strong>${escapeHtml(String(r.display_name || r.username || "Lead"))}</strong><br/><span style="color:var(--muted);font-size:0.8rem">@${escapeHtml(String(r.username || "—"))}</span></td>
          <td><span class="source-badge ${escapeHtml(src)}">${sourceEmoji(src)} ${escapeHtml(sourceLabel(src))}</span></td>
          <td>${escapeHtml(String(r.bot_name || "—"))}</td>
          <td><code>${r.chat_id}</code></td>
          <td>${formatDate(String(r.last_message_at || r.lastMessageAt))}</td>
        </tr>`;
          }
        )
        .join("")}
      </tbody></table>`;

  const body = `<div class="card card-premium"><div class="card-head"><h3>${icons.users} Leads (${rows.length})</h3></div><div class="card-body card-body--flush">${list}</div></div>`;
  return wrap("Leads", "leads", body, partial, "Todos os contatos do funil");
}

export function paymentsPage(rows: Record<string, unknown>[], partial?: boolean) {
  const list =
    rows.length === 0
      ? `<div class="empty">Nenhum comprovante enviado ainda.</div>`
      : `<table class="table"><thead><tr><th>Status</th><th>Bot</th><th>Confianca</th><th>Motivo</th><th>Data</th></tr></thead><tbody>
      ${rows
        .map((r) => {
          const paid = Boolean(r.paid);
          return `<tr>
            <td><span class="badge ${paid ? "badge-online" : "badge-paused"}">${paid ? "Aprovado" : "Revisao"}</span></td>
            <td>${escapeHtml(String(r.bot_name || "—"))}</td>
            <td>${Math.round(Number(r.confidence || 0) * 100)}%</td>
            <td style="max-width:280px;font-size:0.85rem">${escapeHtml(String(r.reason || "").slice(0, 120))}</td>
            <td>${formatDate(String(r.created_at || r.createdAt))}</td>
          </tr>`;
        })
        .join("")}
      </tbody></table>`;

  const body = `<div class="card card-premium"><div class="card-head"><h3>${icons.card} Comprovantes / Pagamentos</h3></div><div class="card-body card-body--flush">${list}</div></div>`;
  return wrap("Pagamentos", "payments", body, partial, "Comprovantes e aprovações");
}

export function productsPage(
  bots: BotConfig[],
  products: import("../db/events.js").Product[],
  message?: string,
  partial?: boolean
) {
  const halfPriceCount = products.filter((p) => p.allowHalfPrice).length;
  const body = `
    ${message ? alertHtml(message) : ""}
    <div class="card card-premium card-accent-gold" style="margin-bottom:16px">
      <div class="card-body" style="font-size:0.88rem;color:var(--text-2);line-height:1.6">
        <strong>Sincronizado com o prompt.</strong> Pacotes com <code>R$</code> no prompt aparecem aqui automaticamente.
        ${halfPriceCount > 0 ? `<br/><span class="badge-discount-on" style="margin-top:8px;display:inline-flex">✓ Oferta 50% ativa em ${halfPriceCount} produto(s) — o bot oferece metade quando o lead diz que não consegue pagar</span>` : `<br/><small>Marque &quot;Oferta 50%&quot; ao cadastrar ou salve o prompt com pacotes.</small>`}
        <form method="post" action="/products/sync" style="margin-top:12px">
          <button type="submit" class="btn btn-secondary btn-sm">${icons.refresh} Sincronizar do prompt agora</button>
        </form>
      </div>
    </div>
    <div class="grid-2 page-grid">
      <div class="card card-premium">
        <div class="card-head"><h3>${icons.plus} Adicionar manualmente</h3></div>
        <div class="card-body">
          <form method="post" action="/products">
            <label class="field">Instância<select name="botId" required>
              ${bots.map((b) => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join("")}
            </select></label>
            <label class="field">Nome<input name="name" placeholder="Pacote Básico" required /></label>
            <label class="field">Preço (R$)<input name="price" type="number" step="0.01" min="1" placeholder="10.00" required /></label>
            <label class="field" style="flex-direction:row;align-items:center;gap:10px;margin-top:8px">
              <input type="checkbox" name="allowHalfPrice" value="true" style="width:auto" />
              <span>Oferta 50% se lead não conseguir pagar</span>
            </label>
            <label class="field">Desconto máximo (%)
              <input name="halfPricePercent" type="number" min="10" max="90" value="50" />
            </label>
            <button type="submit" class="btn btn-primary btn-block">Salvar produto</button>
          </form>
        </div>
      </div>
      <div class="card card-premium">
        <div class="card-head"><h3>${icons.box} Produtos do prompt (${products.length})</h3></div>
        <div class="card-body" style="padding:0">
          ${
            products.length === 0
              ? `<div class="empty">Nenhum produto ainda.<br/><small>Salve a instância com pacotes no prompt ou clique em Sincronizar.</small></div>`
              : `<div class="product-list-pro">
              ${products
                .map(
                  (p) => `<div class="product-row-pro">
                  <div class="product-row-main">
                    <strong>${escapeHtml(p.name)}</strong>
                    <span>${escapeHtml(p.botName || "—")}</span>
                  </div>
                  <div class="product-row-price">${formatMoney(p.priceCents)}</div>
                  <div class="product-row-offer">${p.allowHalfPrice ? `<span class="badge-discount-on">✓ Oferta ${p.halfPricePercent}% ativa</span>` : `<span class="badge-discount-off">50% desligado</span>`}</div>
                </div>`
                )
                .join("")}
              </div>`
          }
        </div>
      </div>
    </div>`;

  return wrap("Produtos", "products", body, partial, "Catálogo sincronizado com o prompt");
}

function remarketingBlocksScript() {
  return `
(function(){
  var wrap = document.getElementById("seq-messages");
  var addBtn = document.getElementById("seq-add-btn");
  var form = document.getElementById("rmk-form");
  var idx = wrap ? wrap.querySelectorAll(".seq-msg-block").length : 0;
  function renumber(){
    if (!wrap) return;
    wrap.querySelectorAll(".seq-msg-block").forEach(function(el, i){
      var lab = el.querySelector(".seq-label");
      if (lab) lab.textContent = "Mensagem " + (i + 1);
      var ta = el.querySelector("textarea");
      if (ta) ta.name = "seq_" + i;
    });
    idx = wrap.querySelectorAll(".seq-msg-block").length;
  }
  function addBlock(val){
    if (!wrap) return;
    var block = document.createElement("div");
    block.className = "seq-msg-block";
    block.innerHTML = '<label class="field"><span class="seq-label">Mensagem ' + (idx + 1) + '</span>'
      + '<textarea name="seq_' + idx + '" rows="2" class="remarketing-msg" placeholder="Digite a mensagem..."></textarea></label>'
      + '<button type="button" class="btn btn-secondary btn-sm seq-remove">Remover</button>';
    var ta = block.querySelector("textarea");
    if (val && ta) ta.value = val;
    block.querySelector(".seq-remove").onclick = function(){ block.remove(); renumber(); };
    wrap.appendChild(block);
    idx++;
  }
  if (addBtn) addBtn.onclick = function(){ addBlock(""); };
  document.getElementById("rmk-select-all")?.addEventListener("click", function(e){
    e.preventDefault();
    document.querySelectorAll('input[name="botIds"]').forEach(function(c){ c.checked = true; });
  });
  document.getElementById("rmk-select-none")?.addEventListener("click", function(e){
    e.preventDefault();
    document.querySelectorAll('input[name="botIds"]').forEach(function(c){ c.checked = false; });
  });
  var modeNow = document.getElementById("send-mode-now");
  var modeSched = document.getElementById("send-mode-schedule");
  var schedWrap = document.getElementById("schedule-at-wrap");
  var schedInput = document.querySelector('[name="scheduledAt"]');
  var schedHint = document.getElementById("schedule-tz-hint");
  var submitBtn = document.getElementById("rmk-submit-btn");
  function pad(n){ return String(n).padStart(2, "0"); }
  function minScheduleLocal(){
    var d = new Date(Date.now() + 60 * 1000);
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate())
      + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }
  function syncSchedule(){
    var sched = modeSched && modeSched.checked;
    if (schedWrap) {
      schedWrap.style.display = sched ? "grid" : "none";
      schedWrap.classList.toggle("is-open", !!sched);
    }
    if (schedHint) schedHint.style.display = sched ? "block" : "none";
    if (submitBtn) submitBtn.textContent = sched ? "Agendar disparo" : "Enviar agora";
    if (sched && schedInput) {
      if (!schedInput.min) schedInput.min = minScheduleLocal();
      schedInput.required = true;
    } else if (schedInput) {
      schedInput.required = false;
    }
    if (sched) renderCal();
  }
  modeNow?.addEventListener("change", syncSchedule);
  modeSched?.addEventListener("change", syncSchedule);

  /* Calendário visual */
  var calEl = document.getElementById("rmk-calendar");
  var calMonth = document.getElementById("rmk-cal-month");
  var calPrev = document.getElementById("rmk-cal-prev");
  var calNext = document.getElementById("rmk-cal-next");
  var calTime = document.getElementById("rmk-cal-time");
  var viewDate = new Date();
  var selectedDay = null;
  var monthNames = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  function renderCal(){
    if (!calEl) return;
    var y = viewDate.getFullYear(), m = viewDate.getMonth();
    if (calMonth) calMonth.textContent = monthNames[m] + " " + y;
    var first = new Date(y, m, 1).getDay();
    var days = new Date(y, m + 1, 0).getDate();
    var today = new Date(); today.setHours(0,0,0,0);
    var html = ["D","S","T","Q","Q","S","S"].map(function(d){ return '<div class="rmk-cal-dow">'+d+'</div>'; }).join("");
    for (var i = 0; i < first; i++) html += '<div class="rmk-cal-spacer"></div>';
    for (var d = 1; d <= days; d++) {
      var dt = new Date(y, m, d); dt.setHours(0,0,0,0);
      var cls = "rmk-cal-day";
      if (+dt === +today) cls += " is-today";
      if (dt < today) cls += " is-past";
      if (selectedDay && +selectedDay === +dt) cls += " is-selected";
      html += '<button type="button" class="'+cls+'" data-day="'+d+'">'+d+'</button>';
    }
    calEl.innerHTML = html;
    calEl.querySelectorAll(".rmk-cal-day").forEach(function(btn){
      btn.onclick = function(){
        var day = Number(btn.getAttribute("data-day"));
        selectedDay = new Date(y, m, day);
        renderCal();
        syncCalToInput();
      };
    });
  }
  function syncCalToInput(){
    if (!selectedDay || !schedInput) return;
    var t = calTime && calTime.value ? calTime.value : "10:00";
    var parts = t.split(":");
    var h = Number(parts[0]) || 10, min = Number(parts[1]) || 0;
    selectedDay.setHours(h, min, 0, 0);
    schedInput.value = selectedDay.getFullYear()+"-"+pad(selectedDay.getMonth()+1)+"-"+pad(selectedDay.getDate())+"T"+pad(h)+":"+pad(min);
    if (modeSched) { modeSched.checked = true; syncSchedule(); }
  }
  calPrev?.addEventListener("click", function(){ viewDate.setMonth(viewDate.getMonth()-1); renderCal(); });
  calNext?.addEventListener("click", function(){ viewDate.setMonth(viewDate.getMonth()+1); renderCal(); });
  calTime?.addEventListener("change", syncCalToInput);
  renderCal();
  syncSchedule();

  if (form) {
    form.addEventListener("submit", function(e){
      var sub = e.submitter;
      if (sub && sub.getAttribute("formmethod") === "get") return;
      var sched = modeSched && modeSched.checked;
      if (!sched) return;
      if (!schedInput || !schedInput.value) {
        e.preventDefault();
        alert("Informe data e hora do agendamento.");
        return;
      }
      var picked = new Date(schedInput.value);
      if (Number.isNaN(picked.getTime()) || picked.getTime() <= Date.now() + 30 * 1000) {
        e.preventDefault();
        alert("Agende para pelo menos 1 minuto no futuro.");
        return;
      }
      var hidden = form.querySelector('[name="scheduledAtIso"]');
      if (!hidden) {
        hidden = document.createElement("input");
        hidden.type = "hidden";
        hidden.name = "scheduledAtIso";
        form.appendChild(hidden);
      }
      hidden.value = picked.toISOString();
    });
  }
})();
`.trim();
}

function formatScheduleBr(iso: string) {
  try {
    return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function remarketingPage(
  bots: BotConfig[],
  selectedBotIds: string[],
  leads: { botId: string; chatId: number; username?: string; displayName?: string }[],
  scheduled: ScheduledCampaign[] = [],
  message = "",
  isError = false,
  partial?: boolean,
  audience: "all" | "no_purchase" = "no_purchase",
  leadCountAll = 0,
  leadCountNoPurchase = 0
) {
  const botNameById = new Map(bots.map((b) => [b.id, b.name]));
  const botChecks =
    bots.length === 0
      ? `<p class="form-hint">Nenhuma instância ainda. <a href="/instances/new" style="color:var(--green)">Criar instância</a></p>`
      : `<div class="rmk-instance-toolbar">
          <button type="button" class="btn btn-secondary btn-sm" id="rmk-select-all">Marcar todas</button>
          <button type="button" class="btn btn-secondary btn-sm" id="rmk-select-none">Desmarcar</button>
        </div>
        <div class="bot-check-grid">
          ${bots
            .map(
              (b) => `<label class="bot-check">
              <input type="checkbox" name="botIds" value="${b.id}" ${selectedBotIds.includes(b.id) ? "checked" : ""} />
              <span>${escapeHtml(b.name)}</span>
            </label>`
            )
            .join("")}
        </div>
        <p class="form-hint">Marque quantas instâncias quiser. Clique em &quot;Aplicar seleção&quot; para carregar os leads.</p>`;

  const leadRows =
    leads.length === 0
      ? `<tr><td colspan="4" class="empty-cell">Nenhum lead nas instâncias selecionadas.</td></tr>`
      : leads
          .map((lead) => {
            const name = lead.displayName || lead.username || `Chat ${lead.chatId}`;
            const handle = lead.username ? `@${lead.username}` : `ID ${lead.chatId}`;
            const botName = botNameById.get(lead.botId) || "Bot";
            return `<tr>
            <td><span class="badge badge-online">${escapeHtml(botName)}</span></td>
            <td><strong>${escapeHtml(name)}</strong><br/><span class="muted-sm">${escapeHtml(handle)}</span></td>
            <td><code>${lead.chatId}</code></td>
            <td>
              <textarea name="msg_${lead.botId}_${lead.chatId}" rows="2" class="remarketing-msg"
                placeholder="Extra opcional para ${escapeHtml(name)}..."></textarea>
            </td>
          </tr>`;
          })
          .join("");

  const scheduledRows =
    scheduled.length === 0
      ? `<p class="form-hint">Nenhum disparo agendado.</p>`
      : `<table class="table"><thead><tr><th>Quando</th><th>Status</th><th>Instâncias</th><th></th></tr></thead><tbody>
      ${scheduled
        .map((c) => {
          const statusLabel =
            c.status === "pending"
              ? "Aguardando"
              : c.status === "done"
                ? "Enviado"
                : c.status === "running"
                  ? "Enviando..."
                  : "Falhou";
          const cancel =
            c.status === "pending"
              ? `<form method="post" action="/remarketing/cancel" style="display:inline">
              <input type="hidden" name="id" value="${c.id}" />
              <button type="submit" class="btn btn-secondary btn-sm">Cancelar</button>
            </form>`
              : `<span class="muted-sm">${escapeHtml(c.resultSummary ?? "—")}</span>`;
          return `<tr>
            <td>${formatScheduleBr(c.scheduledAt)}</td>
            <td><span class="badge badge-online">${statusLabel}</span></td>
            <td>${c.botIds.length} bot(s) · ${c.sequence.length} msg(s)</td>
            <td>${cancel}</td>
          </tr>`;
        })
        .join("")}
      </tbody></table>`;

  const body = `
    ${message ? alertHtml(message, isError ? "error" : "success") : ""}
    <div class="page-hero neon-hero">
      <div>
        <h2 class="hero-title"><span class="brand-accent">Remarketing</span> inteligente</h2>
        <p class="hero-desc">Agende disparos com <strong>calendário</strong>, foque em leads <strong>sem compra</strong> e randomize delays para parecer humano.</p>
      </div>
    </div>
    <form method="post" action="/remarketing" id="rmk-form" class="card card-premium card-neon">
      <div class="card-head"><h3>${icons.megaphone} Campanha</h3></div>
      <div class="card-body">
        <label class="field">Instâncias
          ${botChecks}
        </label>
        <div class="rmk-audience-row">
          <label class="bot-check"><input type="radio" name="audience" value="no_purchase" ${audience === "no_purchase" ? "checked" : ""} /> Só leads sem compra (${leadCountNoPurchase})</label>
          <label class="bot-check"><input type="radio" name="audience" value="all" ${audience === "all" ? "checked" : ""} /> Todos os leads (${leadCountAll})</label>
        </div>
        <button type="submit" class="btn btn-secondary btn-sm" formaction="/remarketing" formmethod="get" style="margin:8px 0 16px" ${bots.length === 0 ? "disabled" : ""}>
          Aplicar seleção
        </button>
        <div class="seq-block">
          <div class="seq-head-row">
            <h4>Sequência de mensagens</h4>
            <button type="button" class="btn btn-secondary btn-sm" id="seq-add-btn">${icons.plus} Nova mensagem</button>
          </div>
          <div id="seq-messages">
            <div class="seq-msg-block">
              <label class="field"><span class="seq-label">Mensagem 1</span>
                <textarea name="seq_0" rows="2" class="remarketing-msg" placeholder="Oi amor, sumiu? 😘"></textarea>
              </label>
            </div>
          </div>
          <label class="field">Delay entre mensagens (segundos)
            <input name="seqDelaySec" type="number" min="0" max="300" value="10" />
          </label>
          <label class="field" style="flex-direction:row;align-items:center;gap:10px;margin-top:8px">
            <input type="checkbox" name="randomize" value="true" checked style="width:auto" />
            <span>Randomizar ordem dos leads e delays (anti-bot)</span>
          </label>
          <div class="grid-2" style="margin-top:8px">
            <label class="field">Delay mín. random (s)<input name="randomDelayMinSec" type="number" min="3" max="120" value="8" /></label>
            <label class="field">Delay máx. random (s)<input name="randomDelayMaxSec" type="number" min="5" max="300" value="25" /></label>
          </div>
        </div>
        ${
          leads.length > 0
            ? `<details class="rmk-leads-details" open>
          <summary>Mensagem extra por lead (opcional)</summary>
          <div class="table-scroll remarketing-table-wrap" role="region">
            <table class="table remarketing-table">
              <thead><tr><th>Instância</th><th>Lead</th><th>Chat</th><th>Extra</th></tr></thead>
              <tbody>${leadRows}</tbody>
            </table>
          </div>
        </details>`
            : `<p class="form-hint">Selecione instâncias e clique em &quot;Aplicar seleção&quot; para ver leads e personalizar.</p>`
        }
        <div class="schedule-block">
          <h4 style="margin:20px 0 10px;font-size:0.9rem">Quando disparar?</h4>
          <div class="schedule-mode-row">
            <label class="bot-check"><input type="radio" name="sendMode" id="send-mode-now" value="now" checked /> Enviar agora</label>
            <label class="bot-check"><input type="radio" name="sendMode" id="send-mode-schedule" value="schedule" /> Agendar no calendário</label>
          </div>
          <div class="rmk-calendar-wrap" id="schedule-at-wrap">
            <div class="rmk-calendar-panel">
              <div class="rmk-cal-head">
                <button type="button" class="btn btn-secondary btn-sm" id="rmk-cal-prev">‹</button>
                <span id="rmk-cal-month"></span>
                <button type="button" class="btn btn-secondary btn-sm" id="rmk-cal-next">›</button>
              </div>
              <div class="rmk-calendar" id="rmk-calendar" aria-label="Calendário de agendamento"></div>
            </div>
            <div class="rmk-calendar-side">
              <label class="field">Horário do disparo
                <input type="time" id="rmk-cal-time" value="10:00" step="60" />
              </label>
              <label class="field">Data e hora confirmada
                <input type="datetime-local" name="scheduledAt" step="60" />
              </label>
              <p class="form-hint" id="schedule-tz-hint">Clique em um dia no calendário e escolha o horário.</p>
            </div>
          </div>
        </div>
        <button type="submit" id="rmk-submit-btn" class="btn btn-primary btn-block" ${bots.length === 0 ? "disabled" : ""}>
          Enviar agora
        </button>
      </div>
    </form>
    <div class="card card-premium" style="margin-top:16px">
      <div class="card-head"><h3>${icons.doc} Agendamentos</h3></div>
      <div class="card-body">${scheduledRows}</div>
    </div>
    <script>${remarketingBlocksScript()}</script>`;

  return wrap("Remarketing", "remarketing", body, partial, "Calendário e leads sem compra");
}

export function mediaPage(bots: BotConfig[], partial?: boolean) {
  const items: { bot: string; type: string; url: string }[] = [];
  for (const bot of bots) {
    for (const url of bot.previewMediaUrls) {
      items.push({ bot: bot.name, type: "Prévia", url });
    }
    for (const url of bot.deliveryMediaUrls) {
      items.push({ bot: bot.name, type: "Entrega", url });
    }
  }

  const list =
    items.length === 0
      ? `<div class="empty">Nenhuma midia enviada. Use upload em Nova Instância.</div>`
      : `<table class="table"><thead><tr><th>Bot</th><th>Tipo</th><th>Arquivo</th></tr></thead><tbody>
      ${items
        .map(
          (i) => `<tr>
          <td>${escapeHtml(i.bot)}</td>
          <td><span class="badge badge-online">${i.type}</span></td>
          <td><a href="${escapeHtml(i.url)}" target="_blank" style="color:var(--primary)">${escapeHtml(i.url)}</a></td>
        </tr>`
        )
        .join("")}
      </tbody></table>`;

  const body = `<div class="card card-premium"><div class="card-head"><h3>${icons.image} Midias (upload)</h3></div><div class="card-body card-body--flush">${list}</div></div>`;
  return wrap("Mídias", "media", body, partial, "Arquivos enviados pelo painel");
}

export { salesChartSvgFromData, messagesChartSvgFromData, leadSourcesBarSvg } from "./charts.js";
