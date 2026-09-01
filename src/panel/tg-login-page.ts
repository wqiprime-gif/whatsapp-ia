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
        <div id="tg-status-box" class="tg-status-box">Carregando status...</div>

        <div id="tg-phase-wait" class="tg-phase" hidden>
          <p class="form-hint" style="margin:0">
            <strong>Aguardando conexão…</strong><br/>
            O Telegram envia o código no <em>app oficial</em> ou por SMS quando o motor estiver pronto.
            Não digite nada até o status mudar para <code>need_code</code>.
          </p>
        </div>

        <div id="tg-phase-code" class="tg-phase" hidden>
          <p class="form-hint" style="margin:0 0 10px">Código recebido no Telegram — digite abaixo:</p>
          <label class="field">Código do Telegram
            <input id="tg-code" inputmode="numeric" autocomplete="one-time-code" placeholder="12345" />
          </label>
          <button type="button" class="btn btn-primary" id="tg-send-code">${icons.zap} Enviar código</button>
        </div>

        <div id="tg-phase-password" class="tg-phase" hidden>
          <p class="form-hint" style="margin:0 0 10px">Sua conta tem verificação em duas etapas:</p>
          <label class="field">Senha 2FA (cloud)
            <input id="tg-password" type="password" autocomplete="current-password" placeholder="Senha cloud do Telegram" />
          </label>
          <button type="button" class="btn btn-secondary" id="tg-send-password">Enviar senha 2FA</button>
        </div>

        <div id="tg-phase-ready" class="tg-phase" hidden>
          <p class="form-hint" style="margin:0;color:#22c55e"><strong>Conectado!</strong> O atendimento no Telegram está ativo.</p>
        </div>

        <details class="form-hint" style="margin:0">
          <summary style="cursor:pointer">Como configurar</summary>
          <ol style="margin:8px 0 0 18px;padding:0">
            <li>Pegue <code>api_id</code> e <code>api_hash</code> em <a href="https://my.telegram.org" target="_blank" rel="noopener">my.telegram.org</a></li>
            <li>Salve telefone + credenciais na <a href="/instances/${bot.id}/edit">edição da instância</a></li>
            <li>Ative a instância e aguarde o código aparecer aqui</li>
          </ol>
        </details>

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
    <style>
      .tg-status-box {
        padding: 10px 12px;
        border-radius: 10px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.08);
        font-size: 0.88rem;
        line-height: 1.45;
      }
      .tg-phase[hidden] { display: none !important; }
    </style>
    <script>
    (function () {
      const statusBox = document.getElementById("tg-status-box");
      const phaseWait = document.getElementById("tg-phase-wait");
      const phaseCode = document.getElementById("tg-phase-code");
      const phasePass = document.getElementById("tg-phase-password");
      const phaseReady = document.getElementById("tg-phase-ready");
      const codeInput = document.getElementById("tg-code");
      const passInput = document.getElementById("tg-password");
      let motorStartAttempts = 0;

      const LABELS = {
        offline: "Motor parado",
        booting: "Preparando motor…",
        starting: "Iniciando motor…",
        connecting: "Conectando aos servidores Telegram…",
        sending_code: "Enviando código — verifique o app Telegram",
        need_code: "Digite o código que chegou no Telegram",
        need_password: "Aguardando senha 2FA",
        authenticating: "Validando credenciais…",
        ready: "Conectado",
        authenticated: "Conectado",
        error: "Erro na conexão",
        logged_out: "Sessão encerrada"
      };

      function setPhase(state) {
        const waitStates = ["offline", "booting", "starting", "connecting", "sending_code", "authenticating", "error", "logged_out"];
        phaseWait.hidden = !waitStates.includes(state);
        phaseCode.hidden = state !== "need_code";
        phasePass.hidden = state !== "need_password";
        phaseReady.hidden = state !== "ready" && state !== "authenticated";
      }

      async function tryStartMotor() {
        if (motorStartAttempts >= 4) return;
        try {
          const r = await fetch("/api/instances/${bot.id}/tg");
          const d = await r.json();
          const state = d.state || "offline";
          if (state === "offline" || state === "error") {
            motorStartAttempts += 1;
            const startRes = await fetch("/api/instances/${bot.id}/tg/start", {
              method: "POST",
              credentials: "same-origin",
              headers: { "content-type": "application/json" }
            });
            const startData = await startRes.json();
            if (!startRes.ok && startData.error) {
              statusBox.innerHTML = "<strong>Erro</strong> · " + escapeHtml(String(startData.error));
            }
          }
        } catch (_) {}
      }

      async function refresh() {
        try {
          const r = await fetch("/api/instances/${bot.id}/tg");
          const d = await r.json();
          const state = d.state || "offline";
          const label = LABELS[state] || state;
          const parts = ["<strong>" + label + "</strong>"];
          if (d.connectedAs) parts.push("Conta: " + escapeHtml(String(d.connectedAs)));
          if (d.pendingCodeHint && state === "need_code") parts.push(escapeHtml(String(d.pendingCodeHint)));
          if (d.error) parts.push('<span style="color:#f87171">' + escapeHtml(String(d.error)) + "</span>");
          if (d.lastMessageError) parts.push('<span style="color:#fb923c" title="Último erro ao responder">Msg: ' + escapeHtml(String(d.lastMessageError).slice(0, 120)) + "</span>");
          statusBox.innerHTML = parts.join(" · ");
          statusBox.style.borderColor =
            state === "ready" || state === "authenticated"
              ? "rgba(34,197,94,0.35)"
              : state === "error"
                ? "rgba(248,113,113,0.35)"
                : "";
          setPhase(state);
          if (state === "offline" || state === "error") void tryStartMotor();
        } catch (e) {
          statusBox.textContent = "Falha ao ler status";
        }
      }

      function escapeHtml(s) {
        return String(s)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");
      }

      const sendCodeBtn = document.getElementById("tg-send-code");
      if (sendCodeBtn) {
        sendCodeBtn.addEventListener("click", async function () {
          const code = (codeInput && codeInput.value || "").trim();
          if (!code) return alert("Digite o código que chegou no Telegram");
          const r = await fetch("/api/instances/${bot.id}/tg/code", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ code })
          });
          const d = await r.json();
          if (!d.ok) alert(d.error || "Falha");
          else { if (codeInput) codeInput.value = ""; refresh(); }
        });
      }

      const sendPassBtn = document.getElementById("tg-send-password");
      if (sendPassBtn) {
        sendPassBtn.addEventListener("click", async function () {
          const password = passInput ? passInput.value || "" : "";
          if (!password) return alert("Digite a senha 2FA");
          const r = await fetch("/api/instances/${bot.id}/tg/password", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ password })
          });
          const d = await r.json();
          if (!d.ok) alert(d.error || "Falha");
          else { if (passInput) passInput.value = ""; refresh(); }
        });
      }

      void tryStartMotor();
      refresh();
      setInterval(refresh, 2500);
    })();
    </script>`;

  return partial ? body : appLayout(`Telegram ${bot.name}`, "instances", body, false, userName);
}
