import type { BotConfig } from "../bots.js";
import type { WaLiveStatus } from "../whatsapp-runtime.js";
import { buildWaMeUrl, formatWaPhoneDisplay } from "../lib/wa-links.js";
import { icons } from "./icons.js";
import { appLayout, escapeHtml } from "./layout.js";

export type WaLinkBotRow = {
  bot: BotConfig;
  status: WaLiveStatus;
  phone: string;
  phoneDisplay: string;
  waUrl: string;
};

export function waLinksPage(
  rows: WaLinkBotRow[],
  distUrl: string,
  defaultMessage: string,
  partial = false,
  userName = "Usuario"
) {
  const connected = rows.filter((r) => (r.status === "connected" || r.status === "meta_ready") && r.phone);
  const distWithMsg = defaultMessage.trim()
    ? `${distUrl}${distUrl.includes("?") ? "&" : "?"}text=${encodeURIComponent(defaultMessage.trim())}`
    : distUrl;

  const instanceCards =
    rows.length === 0
      ? `<div class="empty">Nenhuma instância cadastrada. <a href="/instances/new" style="color:var(--primary)">Criar instância</a></div>`
      : rows
          .map((row) => {
            const on = row.status === "connected" || row.status === "meta_ready";
            const hasPhone = Boolean(row.phone);
            const pillCls = on && hasPhone ? "wa-link-pill--on" : on ? "wa-link-pill--warn" : "wa-link-pill--off";
            const pillLabel = on && hasPhone ? "Conectado" : on ? "Sem número" : "Offline";
            const url = row.waUrl || "";
            const disabled = !on || !url;
            return `<div class="wa-link-card">
              <div class="wa-link-card-head">
                <strong>${escapeHtml(row.bot.name)}</strong>
                <span class="wa-link-pill ${pillCls}">${pillLabel}</span>
              </div>
              <p class="form-hint" style="margin:0 0 10px">${row.phoneDisplay ? escapeHtml(row.phoneDisplay) : "Número indisponível — conecte o WhatsApp"}</p>
              <div class="wa-link-field">
                <input type="text" readonly value="${escapeHtml(url)}" placeholder="Conecte a instância para gerar o link" data-wa-link-input ${disabled ? "disabled" : ""}/>
                <button type="button" class="wa-link-copy" data-copy-target="prev" ${disabled ? "disabled" : ""}>Copiar</button>
              </div>
            </div>`;
          })
          .join("");

  const body = `
    <div class="wa-links-page page-shell">
      <p class="wa-links-intro">
        Gere links <strong>wa.me</strong> dos seus números conectados para usar em TikTok, Facebook, Instagram, bio e anúncios.
        O link de distribuição alterna automaticamente entre as instâncias online — ideal para dividir o tráfego.
      </p>

      <label class="field" style="max-width:640px">
        <span class="field-label">Mensagem padrão (opcional)</span>
        <input type="text" id="wa-link-default-msg" placeholder="Ex: Olá! Vim pelo anúncio e quero saber mais" value="${escapeHtml(defaultMessage)}" />
        <span class="form-hint">Será adicionada ao abrir o WhatsApp. Atualize os links abaixo ao mudar o texto.</span>
      </label>

      <div class="wa-dist-card">
        <h3>${icons.link} Link de distribuição</h3>
        <p>Use <strong>um único link</strong> nas campanhas. Cada clique envia o lead para o próximo número conectado (rotação automática).</p>
        <div class="wa-link-field">
          <input type="text" readonly id="wa-dist-link" value="${escapeHtml(distWithMsg)}" data-base-dist="${escapeHtml(distUrl)}" ${connected.length === 0 ? "disabled" : ""}/>
          <button type="button" class="wa-link-copy" data-copy-target="#wa-dist-link" ${connected.length === 0 ? "disabled" : ""}>Copiar</button>
        </div>
        ${connected.length === 0 ? `<p class="form-hint" style="margin-top:10px">Conecte pelo menos uma instância para ativar o link de distribuição.</p>` : `<p class="form-hint" style="margin-top:10px">${connected.length} instância(s) na rotação.</p>`}
      </div>

      <div>
        <h3 style="font-size:1rem;margin:0 0 12px">Links por instância</h3>
        <div class="wa-links-grid">${instanceCards}</div>
      </div>
    </div>
    <script>
    (function () {
      function bindCopy(root) {
        (root || document).querySelectorAll(".wa-link-copy").forEach(function (btn) {
          if (btn.dataset.bound) return;
          btn.dataset.bound = "1";
          btn.addEventListener("click", function () {
            var sel = btn.getAttribute("data-copy-target");
            var input = sel === "prev" ? btn.previousElementSibling : document.querySelector(sel);
            if (!input || !input.value) return;
            navigator.clipboard.writeText(input.value).then(function () {
              btn.textContent = "Copiado!";
              btn.classList.add("wa-link-copy--ok");
              setTimeout(function () {
                btn.textContent = "Copiar";
                btn.classList.remove("wa-link-copy--ok");
              }, 1800);
            }).catch(function () {});
          });
        });
      }
      function refreshDistLink() {
        var msg = document.getElementById("wa-link-default-msg");
        var dist = document.getElementById("wa-dist-link");
        if (!msg || !dist) return;
        var base = dist.getAttribute("data-base-dist") || dist.value.split("?")[0];
        var text = msg.value.trim();
        dist.value = text ? base + "?text=" + encodeURIComponent(text) : base;
        document.querySelectorAll("[data-wa-link-input]").forEach(function (inp) {
          if (inp.disabled) return;
          var u = inp.value.split("?")[0];
          inp.value = text ? u + "?text=" + encodeURIComponent(text) : u;
        });
      }
      var msgInput = document.getElementById("wa-link-default-msg");
      if (msgInput) msgInput.addEventListener("input", refreshDistLink);
      bindCopy(document);
    })();
    </script>`;

  return appLayout("Gerar links", "links", body, partial, userName, "Links wa.me para campanhas");
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
