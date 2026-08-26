import { escapeHtml, appLayout } from "./layout.js";
import { icons } from "./icons.js";
import type { BotConfig } from "../bots.js";

export function telegramLoginPage(bot: BotConfig, userName = "", partial = false) {
  const body = `
    <div class="card card-premium" style="max-width:560px;margin:0 auto">
      <div class="card-head">
        <div>
          <h2>Conectar Telegram</h2>
          <p class="form-hint" style="margin:0">Conta <strong>real</strong> via MTProto (não é Bot API) — ${escapeHtml(bot.name)}</p>
        </div>
      </div>
      <div class="card-body" style="display:flex;flex-direction:column;gap:14px">
        <div id="tg-status-box" class="form-hint">Carregando status...</div>
        <p class="form-hint">1) Pegue <code>api_id</code> e <code>api_hash</code> em <a href="https://my.telegram.org" target="_blank" rel="noopener">my.telegram.org</a><br/>
        2) Salve telefone + credenciais na edição da instância<br/>
        3) Quando pedir código, digite abaixo (e 2FA se tiver)</p>

        <label class="field">Código do Telegram
          <input id="tg-code" inputmode="numeric" autocomplete="one-time-code" placeholder="12345" />
        </label>
        <button type="button" class="btn btn-primary" id="tg-send-code">${icons.zap} Enviar código</button>

        <label class="field">Senha 2FA (só se pedir)
          <input id="tg-password" type="password" autocomplete="current-password" placeholder="Senha cloud do Telegram" />
        </label>
        <button type="button" class="btn btn-secondary" id="tg-send-password">Enviar senha 2FA</button>

        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
          <form method="post" action="/instances/${bot.id}/tg/restart" style="display:inline">
            <button type="submit" class="btn btn-secondary btn-sm">Reiniciar motor</button>
          </form>
          <form method="post" action="/instances/${bot.id}/tg/logout" style="display:inline" onsubmit="return confirm('Encerrar sessão deste Telegram?')">
            <button type="submit" class="btn btn-ghost btn-sm">Desconectar</button>
          </form>
          <a href="/instances/${bot.id}/edit" class="btn btn-ghost btn-sm">Voltar à edição</a>
        </div>
      </div>
    </div>
    <script>
    (function () {
      const statusBox = document.getElementById("tg-status-box");
      const codeInput = document.getElementById("tg-code");
      const passInput = document.getElementById("tg-password");
      async function refresh() {
        try {
          const r = await fetch("/api/instances/${bot.id}/tg");
          const d = await r.json();
          const state = d.state || "offline";
          const parts = ["Estado: " + state];
          if (d.connectedAs) parts.push("Conta: " + d.connectedAs);
          if (d.pendingCodeHint) parts.push(d.pendingCodeHint);
          if (d.error) parts.push("Erro: " + d.error);
          statusBox.textContent = parts.join(" · ");
          statusBox.style.color = state === "ready" || state === "authenticated" ? "#22c55e" : "";
        } catch (e) {
          statusBox.textContent = "Falha ao ler status";
        }
      }
      document.getElementById("tg-send-code").addEventListener("click", async function () {
        const code = (codeInput.value || "").trim();
        if (!code) return alert("Digite o código");
        const r = await fetch("/api/instances/${bot.id}/tg/code", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code })
        });
        const d = await r.json();
        if (!d.ok) alert(d.error || "Falha");
        else { codeInput.value = ""; refresh(); }
      });
      document.getElementById("tg-send-password").addEventListener("click", async function () {
        const password = passInput.value || "";
        if (!password) return alert("Digite a senha 2FA");
        const r = await fetch("/api/instances/${bot.id}/tg/password", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ password })
        });
        const d = await r.json();
        if (!d.ok) alert(d.error || "Falha");
        else { passInput.value = ""; refresh(); }
      });
      refresh();
      setInterval(refresh, 2500);
    })();
    </script>`;

  return partial ? body : appLayout(`Telegram ${bot.name}`, "instances", body, false, userName);
}
