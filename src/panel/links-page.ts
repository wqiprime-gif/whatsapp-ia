import type { WaRedirectLink, WaRedirectTarget } from "../lib/wa-redirect-links.js";
import { redirectUrl } from "../lib/wa-redirect-links.js";
import { icons } from "./icons.js";
import { alertHtml, appLayout, escapeHtml } from "./layout.js";

export type WaLinkAiInfo = {
  provider: string;
  providerLabel: string;
  model: string;
};

function targetRow(target: WaRedirectTarget | null, index: number, removable: boolean) {
  const id = target?.id ?? "";
  const label = target?.label ?? "";
  const phone = target?.phone ?? "";
  return `<div class="wa-target-row" data-target-row>
    <input type="hidden" name="target_id_${index}" value="${escapeHtml(id)}" />
    <label class="wa-target-field">
      <span class="field-label">Nome</span>
      <input type="text" name="target_label_${index}" value="${escapeHtml(label)}" placeholder="Ex: Atendente 1" maxlength="40" />
    </label>
    <label class="wa-target-field wa-target-field--phone">
      <span class="field-label">WhatsApp (DDI)</span>
      <input type="tel" name="target_phone_${index}" value="${escapeHtml(phone)}" placeholder="5511999999999" inputmode="numeric" autocomplete="tel" />
    </label>
    ${removable ? `<button type="button" class="wa-target-remove" title="Remover" aria-label="Remover número">&times;</button>` : ""}
  </div>`;
}

function targetsBlock(targets: WaRedirectTarget[], minRows = 2) {
  const rows = targets.length > 0 ? targets : Array.from({ length: minRows }, () => null);
  const padded = rows.length < minRows ? [...rows, ...Array(minRows - rows.length).fill(null)] : rows;
  return `<div class="wa-targets-list" data-targets-list>
    ${padded.map((t, i) => targetRow(t, i, padded.length > 1)).join("")}
  </div>
  <button type="button" class="btn btn-ghost wa-target-add">+ Adicionar número</button>`;
}

function linkCard(link: WaRedirectLink, baseUrl: string) {
  const url = redirectUrl(baseUrl, link.slug);
  const totalClicks = Object.values(link.clickCounts).reduce((s, n) => s + n, 0);
  const configured = link.targets.length;
  return `<article class="wa-rand-card dash-glow-card shark-card" id="link-${escapeHtml(link.id)}">
    <div class="wa-rand-card-head">
      <div class="wa-rand-card-title">
        <span class="wa-rand-card-icon">${icons.link}</span>
        <h3>${escapeHtml(link.name)}</h3>
      </div>
      <span class="wa-rand-clicks">${totalClicks} cliques · ${configured} número(s)</span>
    </div>
    <div class="wa-link-field wa-rand-url">
      <input type="text" readonly value="${escapeHtml(url)}" id="url-${escapeHtml(link.id)}" />
      <button type="button" class="wa-link-copy" data-copy-target="#url-${escapeHtml(link.id)}">Copiar</button>
    </div>
    <form method="post" action="/links/${escapeHtml(link.id)}" class="wa-rand-form">
      <div class="wa-rand-grid-2">
        <label class="field">
          <span class="field-label">Nome da campanha</span>
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
        <span class="field-label">Números no rodízio</span>
        ${targetsBlock(link.targets, 1)}
        <span class="form-hint">Digite os números manualmente — não dependem de instância conectada.</span>
      </div>
      <div class="wa-rand-actions">
        <button type="submit" class="btn btn-primary">Salvar</button>
        <button type="submit" formaction="/links/${escapeHtml(link.id)}/reset" formmethod="post" class="btn btn-ghost">Zerar contadores</button>
        <button type="submit" formaction="/links/${escapeHtml(link.id)}/delete" formmethod="post" class="btn btn-danger" onclick="return confirm('Excluir este link?')">Excluir</button>
      </div>
    </form>
  </article>`;
}

export function waLinksPage(
  links: WaRedirectLink[],
  baseUrl: string,
  aiInfo: WaLinkAiInfo,
  partial = false,
  userName = "Usuario",
  flash?: { message: string; ok: boolean }
) {
  const totalNumbers = links.reduce((n, l) => n + l.targets.length, 0);
  const totalClicks = links.reduce(
    (n, l) => n + Object.values(l.clickCounts).reduce((s, c) => s + c, 0),
    0
  );

  const savedLinks =
    links.length === 0
      ? `<div class="empty wa-rand-empty">Nenhum link criado. Use o painel ao lado para gerar seu primeiro randomizador.</div>`
      : links.map((l) => linkCard(l, baseUrl)).join("");

  const body = `
    <div class="wa-rand-page page-shell">
      ${flash ? alertHtml(flash.message, flash.ok ? "success" : "error") : ""}

      <header class="wa-rand-hero dash-glow-card shark-card">
        <div class="wa-rand-hero-text">
          <p class="wa-rand-eyebrow">Randomizador premium</p>
          <h2 class="wa-rand-hero-title">Distribua tráfego entre seus WhatsApps</h2>
          <p class="wa-rand-hero-sub">Um link, vários números. Cada clique rotaciona entre os WhatsApps que você cadastrar — ideal para campanhas e anúncios.</p>
        </div>
        <div class="wa-rand-hero-stats">
          <div class="wa-rand-stat">
            <span class="wa-rand-stat-val">${links.length}</span>
            <span class="wa-rand-stat-lbl">Links</span>
          </div>
          <div class="wa-rand-stat">
            <span class="wa-rand-stat-val">${totalNumbers}</span>
            <span class="wa-rand-stat-lbl">Números</span>
          </div>
          <div class="wa-rand-stat">
            <span class="wa-rand-stat-val">${totalClicks}</span>
            <span class="wa-rand-stat-lbl">Cliques</span>
          </div>
        </div>
      </header>

      <div class="wa-rand-ai-banner">
        <span class="wa-rand-ai-label">IA do painel</span>
        <strong>${escapeHtml(aiInfo.providerLabel)}</strong>
        <code>${escapeHtml(aiInfo.model)}</code>
        <a href="/settings" class="wa-rand-ai-link">Configurações</a>
      </div>

      <div class="wa-rand-layout">
        <section class="wa-rand-create dash-glow-card shark-card">
          <h3 class="wa-rand-section-title">${icons.sparkles} Novo link</h3>
          <form method="post" action="/links" class="wa-rand-form">
            <div class="wa-rand-grid-2">
              <label class="field">
                <span class="field-label">Nome da campanha</span>
                <input type="text" name="name" placeholder="Ex: Campanha Junho" required maxlength="80" />
              </label>
              <label class="field">
                <span class="field-label">Slug (URL)</span>
                <input type="text" name="slug" placeholder="junho" maxlength="48" pattern="[a-zA-Z0-9-]+" />
                <span class="form-hint">${escapeHtml(baseUrl)}/r/<strong>seu-slug</strong></span>
              </label>
            </div>
            <label class="field">
              <span class="field-label">Mensagem inicial (opcional)</span>
              <textarea name="initialMessage" rows="2" placeholder="Texto pré-preenchido no WhatsApp"></textarea>
            </label>
            <div class="wa-rand-instances">
              <span class="field-label">Números no rodízio</span>
              ${targetsBlock([], 2)}
            </div>
            <div class="wa-rand-create-foot">
              <button type="submit" class="btn btn-primary btn-lg wa-rand-create-btn">${icons.link} Criar link</button>
            </div>
          </form>
        </section>

        <section class="wa-rand-list">
          <h3 class="wa-rand-section-title">Seus links <span class="wa-rand-count">${links.length}</span></h3>
          ${savedLinks}
        </section>
      </div>
    </div>
    <script>
    (function () {
      function reindexRows(list) {
        var rows = list.querySelectorAll("[data-target-row]");
        rows.forEach(function (row, i) {
          row.querySelectorAll("input, textarea").forEach(function (inp) {
            var n = inp.getAttribute("name");
            if (!n) return;
            inp.setAttribute("name", n.replace(/_\\d+$/, "_" + i));
          });
          var rm = row.querySelector(".wa-target-remove");
          if (rm) rm.style.display = rows.length > 1 ? "" : "none";
        });
      }
      function bindList(list) {
        if (!list || list.dataset.bound) return;
        list.dataset.bound = "1";
        var addBtn = list.parentElement && list.parentElement.querySelector(".wa-target-add");
        if (addBtn) {
          addBtn.addEventListener("click", function () {
            var i = list.querySelectorAll("[data-target-row]").length;
            var div = document.createElement("div");
            div.className = "wa-target-row";
            div.setAttribute("data-target-row", "");
            div.innerHTML = '<input type="hidden" name="target_id_' + i + '" value="" />' +
              '<label class="wa-target-field"><span class="field-label">Nome</span><input type="text" name="target_label_' + i + '" placeholder="Ex: Atendente" maxlength="40" /></label>' +
              '<label class="wa-target-field wa-target-field--phone"><span class="field-label">WhatsApp (DDI)</span><input type="tel" name="target_phone_' + i + '" placeholder="5511999999999" inputmode="numeric" /></label>' +
              '<button type="button" class="wa-target-remove" title="Remover">&times;</button>';
            list.appendChild(div);
            reindexRows(list);
          });
        }
        list.addEventListener("click", function (e) {
          var btn = e.target.closest(".wa-target-remove");
          if (!btn) return;
          var row = btn.closest("[data-target-row]");
          if (!row || list.querySelectorAll("[data-target-row]").length <= 1) return;
          row.remove();
          reindexRows(list);
        });
      }
      document.querySelectorAll("[data-targets-list]").forEach(bindList);
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
