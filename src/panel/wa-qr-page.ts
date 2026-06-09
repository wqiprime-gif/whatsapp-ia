import type { BotConfig } from "../bots.js";
import { appLayout, escapeHtml } from "./layout.js";
import { botAvatarHtml } from "./bot-form.js";

export function waQrPage(bot: BotConfig, partial = false, userName = "Usuario") {
  const body = `
    <div class="page-header">
      <div>
        <h1 class="hero-title">QR Code · ${escapeHtml(bot.name)}</h1>
        <p class="hero-sub">Escaneie com o WhatsApp do celular para conectar a instância.</p>
      </div>
      <a href="/instances/${bot.id}/edit" class="btn btn-secondary">Voltar à edição</a>
    </div>
    <div class="card" style="max-width:480px;margin:0 auto;text-align:center;padding:32px">
      ${botAvatarHtml(bot)}
      <div id="wa-qr-wrap" style="margin-top:24px">
        <p class="form-hint">Carregando QR...</p>
      </div>
      <button type="button" class="btn btn-primary" id="wa-qr-refresh" style="margin-top:16px">Atualizar QR</button>
      <p class="form-hint" style="margin-top:16px">Se não aparecer, reinicie a instância no painel e aguarde ~15s.</p>
    </div>
    <script>
      async function loadQr() {
        const wrap = document.getElementById("wa-qr-wrap");
        if (!wrap) return;
        try {
          const r = await fetch("/api/instances/${bot.id}/qr");
          const data = await r.json();
          if (data.qr) {
            wrap.innerHTML = '<img src="' + data.qr + '" alt="QR Code" style="max-width:280px;border-radius:12px" /><p class="form-hint" style="margin-top:12px">WhatsApp → Aparelhos conectados → Conectar</p>';
          } else if (data.connected) {
            wrap.innerHTML = '<div style="font-size:3rem">✅</div><p class="form-hint">Instância conectada ao WhatsApp.</p>';
          } else {
            wrap.innerHTML = '<div style="font-size:3rem">⏳</div><p class="form-hint">QR ainda não disponível. Aguarde ou reinicie a instância.</p>';
          }
        } catch (e) {
          wrap.innerHTML = '<p class="form-hint">Erro ao carregar QR.</p>';
        }
      }
      document.getElementById("wa-qr-refresh")?.addEventListener("click", loadQr);
      loadQr();
      setInterval(loadQr, 8000);
    </script>`;

  return partial ? body : appLayout(`QR ${bot.name}`, "instances", body, false, userName);
}
