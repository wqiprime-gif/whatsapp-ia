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
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <form method="post" action="/instances/${bot.id}/reset-wa-session" style="display:inline" onsubmit="return confirm('Apagar sessão WhatsApp salva e gerar QR novo?')">
          <button type="submit" class="btn btn-danger">Nova sessão (QR)</button>
        </form>
        <form method="post" action="/restart" style="display:inline">
          <button type="submit" class="btn btn-secondary">Reiniciar motor</button>
        </form>
        <a href="/instances/${bot.id}/edit" class="btn btn-secondary">Voltar à edição</a>
      </div>
    </div>
    <div class="card" style="max-width:520px;margin:0 auto;text-align:center;padding:32px">
      ${botAvatarHtml(bot)}
      <div id="wa-qr-wrap" style="margin-top:24px">
        <p class="form-hint">Carregando QR...</p>
      </div>
      <p id="wa-qr-status" class="form-hint" style="margin-top:12px"></p>
      <button type="button" class="btn btn-primary" id="wa-qr-refresh" style="margin-top:16px">Atualizar QR</button>
      <p class="form-hint" style="margin-top:16px">O motor WhatsApp pode levar até 60s para subir o Chromium no servidor.</p>
    </div>
    <script>
      async function loadQr() {
        const wrap = document.getElementById("wa-qr-wrap");
        const status = document.getElementById("wa-qr-status");
        if (!wrap) return;
        try {
          const r = await fetch("/api/instances/${bot.id}/qr");
          const data = await r.json();
          if (data.qr) {
            wrap.innerHTML = '<img src="' + data.qr + '" alt="QR Code" style="max-width:280px;border-radius:12px" /><p class="form-hint" style="margin-top:12px">WhatsApp → Aparelhos conectados → Conectar</p>';
            if (status) status.textContent = "QR disponível — escaneie agora.";
          } else if (data.connected) {
            wrap.innerHTML = '<div style="font-size:3rem">✅</div><p class="form-hint">Instância conectada ao WhatsApp.</p>';
            if (status) status.textContent = "";
          } else if (data.error) {
            wrap.innerHTML = '<div style="font-size:3rem">⚠️</div><p class="form-hint" style="color:var(--warning)">Falha ao iniciar o motor WhatsApp.</p>';
            if (status) status.textContent = data.error;
          } else if (!data.processRunning) {
            wrap.innerHTML = '<div style="font-size:3rem">⏳</div><p class="form-hint">Motor ainda não iniciou. Clique em Reiniciar motor e aguarde.</p>';
            if (status) status.textContent = "Estado: " + (data.state || "offline");
          } else if (data.state === "qr_pending" || data.state === "starting") {
            wrap.innerHTML = '<div style="font-size:3rem">⏳</div><p class="form-hint">Gerando QR Code... aguarde.</p>';
            if (status) status.textContent = "Estado: " + data.state;
          } else {
            wrap.innerHTML = '<div style="font-size:3rem">⏳</div><p class="form-hint">QR ainda não disponível. Aguarde ou reinicie a instância.</p>';
            if (status) status.textContent = "Estado: " + (data.state || "aguardando");
          }
        } catch (e) {
          wrap.innerHTML = '<p class="form-hint">Erro ao carregar QR.</p>';
          if (status) status.textContent = "";
        }
      }
      document.getElementById("wa-qr-refresh")?.addEventListener("click", loadQr);
      loadQr();
      setInterval(loadQr, 5000);
    </script>`;

  return partial ? body : appLayout(`QR ${bot.name}`, "instances", body, false, userName);
}
