import type { BotConfig } from "../bots.js";
import type { WaRedirectLink } from "../lib/wa-redirect-links.js";
import { redirectUrl } from "../lib/wa-redirect-links.js";
import type { WaLiveStatus } from "../whatsapp-runtime.js";
import { buildWaMeUrl, formatWaPhoneDisplay } from "../lib/wa-links.js";
import { icons } from "./icons.js";
import { alertHtml, appLayout, escapeHtml } from "./layout.js";

export type WaLinkBotRow = {
  bot: BotConfig;
  status: WaLiveStatus;
  phone: string;
  phoneDisplay: string;
  waUrl: string;
};

export type WaLinkAiInfo = {
  provider: string;
  providerLabel: string;
  model: string;
};

function instancePickList(rows: WaLinkBotRow[], selectedIds: string[], fieldName: string, aiInfo?: WaLinkAiInfo) {
  if (rows.length === 0) {
    return `<p class="form-hint">Nenhuma instância cadastrada. <a href="/instances/new" style="color:var(--green-bright)">Criar instância</a></p>`;
  }
  return rows
    .map((row) => {
      const on = row.status === "connected" || row.status === "meta_ready";
      const hasPhone = Boolean(row.phone);
      const online = on && hasPhone;
      const checked = selectedIds.includes(row.bot.id) ? "checked" : "";
      const dotCls = online ? "wa-inst-dot--on" : "wa-inst-dot--off";
      const meta = online ? row.phoneDisplay : on ? "sem número — reinicie ou limpe sessão" : "offline";
      const aiTag =
        online && aiInfo
          ? `<span class="wa-inst-ai">${escapeHtml(aiInfo.providerLabel)} · ${escapeHtml(aiInfo.model)}</span>`
          : "";
      return `<label class="wa-inst-pick">
        <input type="checkbox" name="${fieldName}" value="${escapeHtml(row.bot.id)}" ${checked} ${!online ? "" : ""} />
        <span class="wa-inst-dot ${dotCls}" aria-hidden="true"></span>
        <span class="wa-inst-pick-label">
          ${escapeHtml(row.bot.name)} <em>(${escapeHtml(meta)})</em>
          ${aiTag}
        </span>
      </label>`;
    })
    .join("");
}

function linkCard(link: WaRedirectLink, rows: WaLinkBotRow[], baseUrl: string, aiInfo?: WaLinkAiInfo) {
  const url = redirectUrl(baseUrl, link.slug);
  const totalClicks = Object.values(link.clickCounts).reduce((s, n) => s + n, 0);
  return `<article class="wa-rand-card dash-glow-card shark-card" id="link-${escapeHtml(link.id)}">
    <div class="wa-rand-card-head">
      <h3>${escapeHtml(link.name)}</h3>
      <span class="wa-rand-clicks">${totalClicks} clique(s)</span>
    </div>
    <div class="wa-link-field wa-rand-url">
      <input type="text" readonly value="${escapeHtml(url)}" id="url-${escapeHtml(link.id)}" />
      <button type="button" class="wa-link-copy" data-copy-target="#url-${escapeHtml(link.id)}">Copiar</button>
    </div>
    <form method="post" action="/links/${escapeHtml(link.id)}" class="wa-rand-form">
      <div class="wa-rand-grid-2">
        <label class="field">
          <span class="field-label">Nome</span>
          <input type="text" name="name" value="${escapeHtml(link.name)}" required maxlength="80" />
        </label>
        <label class="field">
          <span class="field-label">Slug (URL)</span>
          <input type="text" name="slug" value="${escapeHtml(link.slug)}" required maxlength="48" pattern="[a-z0-9-]+" />
        </label>
      </div>
      <label class="field">
        <span class="field-label">Mensagem inicial (opcional)</span>
        <textarea name="initialMessage" rows="2" placeholder="Texto que já vem digitado no WhatsApp do lead">${escapeHtml(link.initialMessage)}</textarea>
      </label>
      <div class="wa-rand-instances">
        <span class="field-label">Instâncias no rodízio</span>
        <div class="wa-inst-pick-list">${instancePickList(rows, link.botIds, "botIds", aiInfo)}</div>
        <span class="form-hint">Instâncias offline ou sem número são <strong>ignoradas no redirect</strong> — o lead só vai para WhatsApp online.</span>
      </div>
      <div class="wa-rand-actions">
        <button type="submit" class="btn btn-primary">Salvar</button>
        <button type="submit" formaction="/links/${escapeHtml(link.id)}/reset" formmethod="post" class="btn btn-ghost">📊 Zerar contadores</button>
        <button type="submit" formaction="/links/${escapeHtml(link.id)}/delete" formmethod="post" class="btn btn-danger" onclick="return confirm('Excluir este link?')">🗑 Excluir</button>
      </div>
    </form>
  </article>`;
}

export function waLinksPage(
  rows: WaLinkBotRow[],
  links: WaRedirectLink[],
  baseUrl: string,
  aiInfo: WaLinkAiInfo,
  partial = false,
  userName = "Usuario",
  flash?: { message: string; ok: boolean }
) {
  const onlineCount = rows.filter(
    (r) => (r.status === "connected" || r.status === "meta_ready") && r.phone
  ).length;

  const savedLinks =
    links.length === 0
      ? `<div class="empty wa-rand-empty">Nenhum link criado ainda. Use o formulário acima para gerar seu primeiro randomizador.</div>`
      : links.map((l) => linkCard(l, rows, baseUrl, aiInfo)).join("");

  const body = `
    <div class="wa-rand-page page-shell">
      ${flash ? alertHtml(flash.message, flash.ok ? "success" : "error") : ""}

      <p class="wa-rand-intro">
        <strong>Randomizador</strong> — crie links que distribuem tráfego entre seus WhatsApps conectados.
        Cada clique manda o lead para a próxima instância <strong>online</strong> (rodízio justo por contador).
        ${onlineCount > 0 ? `<span class="wa-rand-online">${onlineCount} instância(s) pronta(s) agora.</span>` : `<span class="wa-rand-warn">Nenhuma instância com número online — conecte o WhatsApp e configure a IA em Configurações.</span>`}
      </p>

      <div class="wa-rand-ai-banner">
        <span class="wa-rand-ai-label">IA configurada no painel</span>
        <strong>${escapeHtml(aiInfo.providerLabel)}</strong>
        <code>${escapeHtml(aiInfo.model)}</code>
        <a href="/settings" class="wa-rand-ai-link">Alterar em Configurações →</a>
      </div>

      <section class="wa-rand-create dash-glow-card shark-card">
        <h3 class="wa-rand-section-title">${icons.link} Novo link de redirecionamento</h3>
        <form method="post" action="/links" class="wa-rand-form">
          <div class="wa-rand-grid-2">
            <label class="field">
              <span class="field-label">Nome</span>
              <input type="text" name="name" placeholder="Ex: Campanha Junho" required maxlength="80" />
            </label>
            <label class="field">
              <span class="field-label">Slug (URL)</span>
              <input type="text" name="slug" placeholder="Ex: junho" maxlength="48" pattern="[a-zA-Z0-9-]+" />
              <span class="form-hint">Fica: ${escapeHtml(baseUrl)}/r/<strong>seu-slug</strong></span>
            </label>
          </div>
          <label class="field">
            <span class="field-label">Mensagem inicial (opcional)</span>
            <textarea name="initialMessage" rows="2" placeholder="Texto que já vem digitado no WhatsApp do lead"></textarea>
          </label>
          <div class="wa-rand-instances">
            <span class="field-label">Instâncias no rodízio</span>
            <div class="wa-inst-pick-list">${instancePickList(rows, rows.filter((r) => r.phone && (r.status === "connected" || r.status === "meta_ready")).map((r) => r.bot.id), "botIds", aiInfo)}</div>
          </div>
          <div class="wa-rand-create-foot">
            <button type="submit" class="btn btn-primary btn-lg wa-rand-create-btn">${icons.sparkles} Criar link</button>
          </div>
        </form>
      </section>

      <section class="wa-rand-list">
        <h3 class="wa-rand-section-title">Seus links (${links.length})</h3>
        ${savedLinks}
      </section>

      <details class="wa-rand-direct">
        <summary>Links diretos wa.me por instância</summary>
        <div class="wa-links-grid" style="margin-top:14px">
          ${rows
            .map((row) => {
              const on = row.status === "connected" || row.status === "meta_ready";
              const hasPhone = Boolean(row.phone);
              const url = row.waUrl || "";
              const disabled = !on || !url;
              return `<div class="wa-link-card">
                <div class="wa-link-card-head">
                  <strong>${escapeHtml(row.bot.name)}</strong>
                  <span class="wa-link-pill ${on && hasPhone ? "wa-link-pill--on" : on ? "wa-link-pill--warn" : "wa-link-pill--off"}">${on && hasPhone ? "Online" : on ? "Sem número" : "Offline"}</span>
                </div>
                <div class="wa-link-field">
                  <input type="text" readonly value="${escapeHtml(url)}" ${disabled ? "disabled" : ""} />
                  <button type="button" class="wa-link-copy" data-copy-target="prev" ${disabled ? "disabled" : ""}>Copiar</button>
                </div>
              </div>`;
            })
            .join("")}
        </div>
      </details>
    </div>
    <script>
    (function () {
      document.querySelectorAll(".wa-link-copy").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var sel = btn.getAttribute("data-copy-target");
          var input = sel === "prev" ? btn.previousElementSibling : document.querySelector(sel);
          if (!input || !input.value) return;
          navigator.clipboard.writeText(input.value).then(function () {
            btn.textContent = "Copiado!";
            btn.classList.add("wa-link-copy--ok");
            setTimeout(function () { btn.textContent = "Copiar"; btn.classList.remove("wa-link-copy--ok"); }, 1800);
          }).catch(function () {});
        });
      });
    })();
    </script>`;

  return appLayout(
    "Gerar links",
    "links",
    body,
    partial,
    userName,
    "Randomizador — links rotativos de WhatsApp"
  );
}

export function buildWaLinkRows(
  bots: BotConfig[],
  statuses: Record<string, WaLiveStatus>,
  phones: Record<string, string | null>,
  defaultMessage = ""
): WaLinkBotRow[] {
  return bots.map((bot) => {
    const status = statuses[bot.id] || "offline";
    const phone = phones[bot.id] || "";
    const waUrl = phone ? buildWaMeUrl(phone, defaultMessage) : "";
    return {
      bot,
      status,
      phone,
      phoneDisplay: phone ? formatWaPhoneDisplay(phone) : "",
      waUrl
    };
  });
}
