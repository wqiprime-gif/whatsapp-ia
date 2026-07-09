import type { BotConfig } from "../bots.js";
import type { WaLiveStatus } from "../whatsapp-runtime.js";
import type { WarmSession, BotWarmScore } from "../lib/chip-warmer.js";
import { effectiveDailyGoal } from "../lib/chip-warmer.js";
import { alertHtml, appLayout, escapeHtml, timeGreeting, type NavId } from "./layout.js";
import { icons } from "./icons.js";

function humanPct(n: number) {
  return `${Math.round(n)}%`;
}

function dayProgress(session: WarmSession) {
  return Math.min(100, Math.round((session.dayIndex / Math.max(1, session.totalDays)) * 100));
}

const MATURADOR_STYLES = `
  <style>
    .maturador-shell .dash-hero{background:linear-gradient(135deg,rgba(245,158,11,.12),rgba(34,197,94,.08));border:1px solid rgba(251,191,36,.2);border-radius:16px;padding:20px}
    .maturador-premium-card{border:1px solid rgba(251,191,36,.18);background:linear-gradient(180deg,rgba(251,191,36,.06),rgba(0,0,0,.2));box-shadow:0 0 40px rgba(245,158,11,.06)}
    .warm-progress-bar{height:10px;background:rgba(255,255,255,.08);border-radius:999px;overflow:hidden}
    .warm-progress-fill{height:100%;background:linear-gradient(90deg,#d97706,#fbbf24,#fde68a);border-radius:999px;transition:width .6s ease}
    .warm-chip-row{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.06)}
    .warm-chip-row:last-child{border-bottom:0}
    .warm-instance-card{border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:14px;margin-bottom:10px;display:block;transition:border-color .2s,background .2s}
    .warm-instance-card:has(input:checked){border-color:#fbbf24;background:rgba(251,191,36,.08)}
    .warm-group-card{display:block;border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:12px;margin-bottom:8px}
    .warm-day-timeline{display:flex;gap:6px;flex-wrap:wrap}
    .warm-day-dot{width:36px;height:36px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:0.72rem;background:rgba(255,255,255,.08);color:var(--text-2)}
    .warm-day-dot.done{background:linear-gradient(135deg,#f59e0b,#fbbf24);color:#1a1200;font-weight:700}
    .maturador-config-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin:16px 0}
    .maturador-alert{background:rgba(251,191,36,.1);border:1px solid rgba(251,191,36,.25);border-radius:12px;padding:12px 14px;margin-bottom:16px;font-size:0.88rem}
  </style>`;

function sessionStatusBadge(status: WarmSession["status"]) {
  if (status === "active") return `<span class="badge badge-online">Ativo</span>`;
  if (status === "paused") return `<span class="badge badge-warn">Pausado</span>`;
  return `<span class="badge">Concluído</span>`;
}

function healthBadge(score?: number) {
  const v = score ?? 0;
  const cls = v >= 70 ? "badge-online" : v >= 40 ? "badge-warn" : "badge-offline";
  return `<span class="badge ${cls}">${v > 0 ? humanPct(v) : "—"}</span>`;
}

export function chipWarmerDashboardPage(input: {
  userName: string;
  userAvatar: string;
  sessions: WarmSession[];
  bots: BotConfig[];
  statuses: Record<string, WaLiveStatus>;
  scores: Record<string, BotWarmScore>;
  message?: string;
  isError?: boolean;
  partial?: boolean;
  showAdminNav?: boolean;
}) {
  const active = input.sessions.filter((s) => s.status === "active");
  const connected = input.bots.filter((b) => input.statuses[b.id] === "connected");
  const warmingBots = new Set(active.flatMap((s) => s.botIds));
  const msgsToday = active.reduce((a, s) => a + s.messagesToday, 0);

  const maturationCards = active.length
    ? active
        .map((s) => {
          const chips = s.botIds
            .map((id) => {
              const bot = input.bots.find((b) => b.id === id);
              const label = bot?.name || id.slice(0, 10);
              const score = input.scores[id]?.healthScore;
              return `<div class="warm-chip-row">
              <span>${escapeHtml(label)}</span>
              ${healthBadge(score)}
              <span class="form-hint">Dia ${s.dayIndex}/${s.totalDays}</span>
            </div>`;
            })
            .join("");
          return `<div class="card card-premium" style="margin-bottom:12px">
          <div class="card-head"><h3>${escapeHtml(s.name)} ${sessionStatusBadge(s.status)}</h3></div>
          <div class="card-body">
            <div class="warm-progress-bar"><div class="warm-progress-fill" style="width:${dayProgress(s)}%"></div></div>
            <p class="form-hint" style="margin:8px 0 12px">${dayProgress(s)}% do ciclo · meta hoje ${s.messagesToday}/${effectiveDailyGoal(s)}</p>
            ${chips}
            <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
              <a href="/maturador/sessao/${escapeHtml(s.id)}" class="btn btn-secondary btn-sm">Detalhes</a>
              <form method="post" action="/maturador/sessao/${escapeHtml(s.id)}/pausar" style="display:inline">
                <button type="submit" class="btn btn-secondary btn-sm">Pausar</button>
              </form>
            </div>
          </div>
        </div>`;
        })
        .join("")
    : `<div class="empty">Nenhuma sessão ativa. <a href="/maturador/novo">Iniciar maturação</a></div>`;

  const body = `
    <div class="page-shell warm-shell maturador-shell">
      ${input.message ? alertHtml(input.message, input.isError ? "error" : "success") : ""}
      <div class="dash-hero" style="margin-bottom:16px">
        <div>
          <p class="form-hint" style="margin:0">${timeGreeting()}, ${escapeHtml(input.userName.replace(/^@/, ""))}</p>
          <h2 style="margin:4px 0 0">Central do Maturador</h2>
          <p class="form-hint">${active.length ? `${active.length} sessão(ões) em andamento · IA pausada nos chips` : "Maturação automática com comportamento humano"}</p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <a href="/maturador/novo" class="btn btn-primary">${icons.flame} Maturar chips</a>
          <a href="/instances" class="btn btn-secondary">${icons.layers} Meus Chips</a>
        </div>
      </div>

      <div class="maturador-alert">${icons.flame} <strong>Modo maturação:</strong> a IA fica pausada enquanto o chip matura. Ao encerrar, ative a instância manualmente para rodar o x1 automático.</div>

      <div class="shark-kpi-grid" style="margin-bottom:16px">
        <div class="shark-kpi-card shark-card dash-glow-card">
          <div class="shark-kpi-head"><span class="shark-kpi-label">Sessões ativas</span>${icons.activity}</div>
          <div class="shark-kpi-value">${active.length}</div>
          <div class="form-hint">${warmingBots.size} chips em maturação</div>
        </div>
        <div class="shark-kpi-card shark-card dash-glow-card">
          <div class="shark-kpi-head"><span class="shark-kpi-label">Mensagens hoje</span>${icons.chat}</div>
          <div class="shark-kpi-value">${msgsToday}</div>
          <div class="form-hint">enviadas na maturação</div>
        </div>
        <div class="shark-kpi-card shark-card dash-glow-card">
          <div class="shark-kpi-head"><span class="shark-kpi-label">Chips conectados</span>${icons.smartphone}</div>
          <div class="shark-kpi-value">${connected.length}</div>
          <div class="form-hint">de ${input.bots.length} instâncias</div>
        </div>
      </div>

      <div class="card card-premium maturador-premium-card" style="margin-bottom:16px">
        <div class="card-head">
          <h3>${icons.flame} Maturação dos Chips</h3>
          <p class="form-hint" style="margin:0">Textos humanizados · typos · pausas · áudios e reações</p>
        </div>
        <div class="card-body">${maturationCards}</div>
      </div>

      <div class="card card-premium">
        <div class="card-head"><h3>Histórico</h3></div>
        <div class="card-body card-body--flush">
          ${
            input.sessions.length === 0
              ? `<div class="empty">Nenhuma sessão ainda.</div>`
              : `<div class="table-scroll"><table class="table">
              <thead><tr><th>Sessão</th><th>Status</th><th>Dia</th><th>Total</th><th></th></tr></thead>
              <tbody>${input.sessions
                .map(
                  (s) => `<tr>
                <td>${escapeHtml(s.name)}</td>
                <td>${sessionStatusBadge(s.status)}</td>
                <td>${s.dayIndex}/${s.totalDays}</td>
                <td>${s.messagesTotal}</td>
                <td><a href="/maturador/sessao/${escapeHtml(s.id)}">Ver</a></td>
              </tr>`
                )
                .join("")}</tbody></table></div>`
          }
        </div>
      </div>
    </div>
    ${MATURADOR_STYLES}`;

  if (input.partial) return body;
  return appLayout(
    "Maturador",
    "maturador" as NavId,
    body,
    false,
    input.userName,
    "Maturador automático de chips",
    input.userAvatar,
    "",
    "",
    input.showAdminNav
  );
}

export function chipWarmerNewPage(input: {
  userName: string;
  userAvatar: string;
  bots: BotConfig[];
  statuses: Record<string, WaLiveStatus>;
  scores: Record<string, BotWarmScore>;
  message?: string;
  isError?: boolean;
  partial?: boolean;
  showAdminNav?: boolean;
}) {
  const connectedBots = input.bots.filter((b) => input.statuses[b.id] === "connected");

  const instanceCards = connectedBots.length
    ? connectedBots
        .map((b) => {
          const phone = b.waPhoneNumber?.trim() || "—";
          const score = input.scores[b.id]?.healthScore;
          return `<label class="warm-instance-card">
          <input type="checkbox" name="botIds" value="${escapeHtml(b.id)}" form="warm-start-form" />
          <strong>${escapeHtml(b.name)}</strong>
          <div class="form-hint">${escapeHtml(phone)} · Score ${score ? humanPct(score) : "—"}</div>
        </label>`;
        })
        .join("")
    : `<div class="empty">Nenhum chip conectado. Conecte em <a href="/instances">Instâncias</a>.</div>`;

  const body = `
    <div class="page-shell warm-shell maturador-shell">
      ${input.message ? alertHtml(input.message, input.isError ? "error" : "success") : ""}
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px">
        <div>
          <a href="/maturador" class="btn btn-secondary btn-sm">← Voltar</a>
          <h2 style="margin:8px 0 0">${icons.flame} Maturador Premium</h2>
          <p class="form-hint">IA pausada · mensagens humanizadas · anti-ban</p>
        </div>
      </div>

      <div class="maturador-alert">Ao ativar, a <strong>IA para de responder</strong>. Quando encerrar a maturação, ative a instância em Instâncias para rodar o x1.</div>

      <div class="card card-premium maturador-premium-card" style="margin-bottom:16px">
        <div class="card-head"><h3>1 · Instâncias</h3><p class="form-hint" style="margin:0">Selecione pelo menos 2 chips conectados</p></div>
        <div class="card-body">${instanceCards}</div>
      </div>

      <div class="card card-premium maturador-premium-card">
        <div class="card-head"><h3>2 · Configuração & Grupos</h3></div>
        <div class="card-body">
          <form id="warm-discover-form" class="form-stack" onsubmit="return warmDiscoverGroups(event)">
            <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px">
              <label><input type="radio" name="mode" value="groups" checked /> Grupos (recomendado)</label>
              <label><input type="radio" name="mode" value="p2p" /> P2P (privado)</label>
            </div>
            <button type="submit" class="btn btn-secondary" id="warm-discover-btn">${icons.refresh} Buscar grupos em comum</button>
          </form>
          <div id="warm-groups-status" class="form-hint" style="margin:12px 0">Selecione os chips e busque os grupos compartilhados.</div>
          <div id="warm-groups-list"></div>

          <form id="warm-start-form" method="post" action="/maturador/sessao/criar" style="margin-top:16px">
            <input type="hidden" name="mode" id="warm-mode-hidden" value="groups" />
            <input type="hidden" name="groupIds" id="warm-group-ids-hidden" value="" />
            <input type="hidden" name="groupsMeta" id="warm-groups-meta-hidden" value="[]" />
            <div class="form-row" style="margin-bottom:12px">
              <label>Nome da sessão</label>
              <input type="text" name="name" placeholder="Maturação ${new Date().toLocaleDateString("pt-BR")}" class="input" />
            </div>
            <div class="maturador-config-grid">
              <div class="form-row">
                <label>Dias de maturação</label>
                <input type="number" name="totalDays" min="1" max="60" value="10" class="input" />
              </div>
              <div class="form-row">
                <label>Início (hora)</label>
                <input type="number" name="activeHourStart" min="0" max="23" value="10" class="input" />
              </div>
              <div class="form-row">
                <label>Fim (hora)</label>
                <input type="number" name="activeHourEnd" min="1" max="24" value="22" class="input" />
              </div>
            </div>
            <p class="form-hint" style="margin-bottom:12px">Fora do horário o chip "dorme". Mensagens com typos, pausas e delays aleatórios.</p>
            <button type="submit" class="btn btn-primary" id="warm-start-btn" disabled>${icons.flame} Ativar Maturador</button>
          </form>
        </div>
      </div>
    </div>
    <script>
    function warmSelectedBotIds(){
      return Array.from(document.querySelectorAll('input[name="botIds"]:checked')).map((el)=>el.value);
    }
    async function warmDiscoverGroups(ev){
      ev.preventDefault();
      const botIds = warmSelectedBotIds();
      if(botIds.length < 2){ alert('Selecione pelo menos 2 instâncias.'); return false; }
      const mode = document.querySelector('input[name="mode"]:checked')?.value || 'groups';
      document.getElementById('warm-mode-hidden').value = mode;
      const status = document.getElementById('warm-groups-status');
      const list = document.getElementById('warm-groups-list');
      const btn = document.getElementById('warm-discover-btn');
      status.textContent = 'Buscando grupos das instâncias... pode levar até 2 minutos na primeira vez.';
      btn.disabled = true;
      list.innerHTML = '';
      try {
        const res = await fetch('/api/chip-warmer/discover-groups', {
          method:'POST',
          headers:{'content-type':'application/json'},
          body: JSON.stringify({ botIds })
        });
        const data = await res.json();
        if(!data.ok) throw new Error(data.error || 'Falha na busca');
        const common = data.common || [];
        const perBot = data.perBot || {};
        status.textContent = common.length + ' grupo(s) em comum encontrado(s).';
        if(mode === 'p2p'){
          document.getElementById('warm-start-btn').disabled = false;
          document.getElementById('warm-group-ids-hidden').value = '';
          document.getElementById('warm-groups-meta-hidden').value = '[]';
          return false;
        }
        if(common.length === 0){
          document.getElementById('warm-start-btn').disabled = true;
          return false;
        }
        list.innerHTML = common.map((g, idx)=> '<label class="warm-group-card"><input type="checkbox" class="warm-group-pick" data-id="'+g.id+'" data-name="'+g.name.replace(/"/g,'')+'" '+(idx<2?'checked':'')+' /> <strong>'+g.name+'</strong></label>').join('');
        warmSyncGroupSelection();
        document.querySelectorAll('.warm-group-pick').forEach((el)=>el.addEventListener('change', warmSyncGroupSelection));
        document.getElementById('warm-start-btn').disabled = false;
      } catch(err){
        status.textContent = 'Erro: ' + (err.message || err);
        document.getElementById('warm-start-btn').disabled = true;
      } finally {
        btn.disabled = false;
      }
      return false;
    }
    function warmSyncGroupSelection(){
      const picks = Array.from(document.querySelectorAll('.warm-group-pick:checked'));
      document.getElementById('warm-group-ids-hidden').value = picks.map((el)=>el.dataset.id).join(',');
      document.getElementById('warm-groups-meta-hidden').value = JSON.stringify(picks.map((el)=>({id:el.dataset.id,name:el.dataset.name})));
    }
    document.getElementById('warm-start-form').addEventListener('submit', function(ev){
      const botIds = warmSelectedBotIds();
      if(botIds.length < 2){ ev.preventDefault(); alert('Selecione pelo menos 2 instâncias.'); return; }
      botIds.forEach((id)=>{
        const hidden = document.createElement('input');
        hidden.type = 'hidden';
        hidden.name = 'botIds';
        hidden.value = id;
        this.appendChild(hidden);
      });
      const mode = document.getElementById('warm-mode-hidden').value;
      if(mode === 'groups' && !document.getElementById('warm-group-ids-hidden').value){
        ev.preventDefault();
        alert('Selecione pelo menos 1 grupo em comum.');
      }
    });
    </script>
    ${MATURADOR_STYLES}`;

  if (input.partial) return body;
  return appLayout(
    "Novo maturador",
    "maturador" as NavId,
    body,
    false,
    input.userName,
    "Configurar sessão de maturação",
    input.userAvatar,
    "",
    "",
    input.showAdminNav
  );
}

export function chipWarmerSessionPage(input: {
  userName: string;
  userAvatar: string;
  session: WarmSession;
  bots: BotConfig[];
  scores: Record<string, BotWarmScore>;
  message?: string;
  isError?: boolean;
  partial?: boolean;
  showAdminNav?: boolean;
}) {
  const s = input.session;
  const goal = effectiveDailyGoal(s);
  const humanization = Math.min(
    99,
    Math.round(
      ((s.stats.reactions + s.stats.audios + s.stats.quotes) / Math.max(1, s.messagesTotal)) * 100 + 40
    )
  );

  const daysHtml = Array.from({ length: s.totalDays }, (_, i) => {
    const d = i + 1;
    const done = d <= s.dayIndex;
    return `<span class="warm-day-dot ${done ? "done" : ""}">D${d}</span>`;
  }).join("");

  const logs = s.lastLog ? `<div class="form-hint" style="margin-top:12px">Última ação: ${escapeHtml(s.lastLog)}</div>` : "";

  const body = `
    <div class="page-shell warm-shell maturador-shell">
      ${input.message ? alertHtml(input.message, input.isError ? "error" : "success") : ""}
      <div style="margin-bottom:16px">
        <a href="/maturador" class="btn btn-secondary btn-sm">← Central</a>
        <h2 style="margin:8px 0 0">${escapeHtml(s.name)} ${sessionStatusBadge(s.status)}</h2>
        <p class="form-hint">Horário ativo: ${s.activeHourStart}h às ${s.activeHourEnd}h · IA pausada neste chip</p>
      </div>

      <div class="shark-kpi-grid" style="margin-bottom:16px">
        <div class="shark-kpi-card shark-card dash-glow-card">
          <div class="shark-kpi-head"><span class="shark-kpi-label">Ciclo</span>${icons.calendar}</div>
          <div class="shark-kpi-value">Dia ${s.dayIndex}/${s.totalDays}</div>
          <div class="warm-progress-bar" style="margin-top:8px"><div class="warm-progress-fill" style="width:${dayProgress(s)}%"></div></div>
        </div>
        <div class="shark-kpi-card shark-card dash-glow-card">
          <div class="shark-kpi-head"><span class="shark-kpi-label">Meta diária</span>${icons.chat}</div>
          <div class="shark-kpi-value">${s.messagesToday}/${goal}</div>
        </div>
        <div class="shark-kpi-card shark-card dash-glow-card">
          <div class="shark-kpi-head"><span class="shark-kpi-label">Humanização</span>${icons.sparkles}</div>
          <div class="shark-kpi-value">${humanPct(humanization)}</div>
        </div>
      </div>

      <div class="card card-premium" style="margin-bottom:16px">
        <div class="card-body">
          <div class="warm-day-timeline">${daysHtml}</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;margin-top:16px">
            <div><span class="form-hint">Textos</span><strong>${s.stats.texts}</strong></div>
            <div><span class="form-hint">Áudios</span><strong>${s.stats.audios}</strong></div>
            <div><span class="form-hint">Reações</span><strong>${s.stats.reactions}</strong></div>
            <div><span class="form-hint">Imagens</span><strong>${s.stats.images}</strong></div>
            <div><span class="form-hint">Localização</span><strong>${s.stats.locations}</strong></div>
            <div><span class="form-hint">Citações</span><strong>${s.stats.quotes}</strong></div>
          </div>
          ${logs}
        </div>
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${
          s.status === "active"
            ? `<form method="post" action="/maturador/sessao/${escapeHtml(s.id)}/pausar"><button class="btn btn-secondary">Pausar</button></form>`
            : s.status === "paused"
              ? `<form method="post" action="/maturador/sessao/${escapeHtml(s.id)}/retomar"><button class="btn btn-primary">Retomar</button></form>`
              : ""
        }
        <form method="post" action="/maturador/sessao/${escapeHtml(s.id)}/encerrar" onsubmit="return confirm('Encerrar maturação? A IA será liberada — ative a instância manualmente para vender.');">
          <button class="btn btn-danger">Encerrar maturação</button>
        </form>
      </div>
    </div>
    ${MATURADOR_STYLES}`;

  if (input.partial) return body;
  return appLayout(
    s.name,
    "maturador" as NavId,
    body,
    false,
    input.userName,
    "Detalhes da sessão",
    input.userAvatar,
    "",
    "",
    input.showAdminNav
  );
}

export function adminWarmOverviewPage(input: {
  users: { id: string; name: string; username: string; warmingChips: number; activeSessions: number }[];
  totalWarming: number;
  totalSessions: number;
  userName: string;
  userAvatar: string;
  message?: string;
  isError?: boolean;
}) {
  const rows = input.users
    .filter((u) => u.warmingChips > 0 || u.activeSessions > 0)
    .map(
      (u) => `<tr>
      <td>${escapeHtml(u.name || u.username)}</td>
      <td><code>@${escapeHtml(u.username)}</code></td>
      <td>${u.activeSessions}</td>
      <td><strong>${u.warmingChips}</strong></td>
    </tr>`
    )
    .join("");

  const body = `
    <div class="page-shell">
      ${input.message ? alertHtml(input.message, input.isError ? "error" : "success") : ""}
      <div class="shark-kpi-grid" style="margin-bottom:16px">
        <div class="shark-kpi-card shark-card dash-glow-card">
          <div class="shark-kpi-head"><span class="shark-kpi-label">Chips maturando</span>${icons.flame}</div>
          <div class="shark-kpi-value">${input.totalWarming}</div>
        </div>
        <div class="shark-kpi-card shark-card dash-glow-card">
          <div class="shark-kpi-head"><span class="shark-kpi-label">Sessões ativas</span>${icons.activity}</div>
          <div class="shark-kpi-value">${input.totalSessions}</div>
        </div>
      </div>
      <div class="card card-premium">
        <div class="card-head"><h3>${icons.flame} Maturador por usuário</h3></div>
        <div class="card-body card-body--flush">
          ${
            rows
              ? `<div class="table-scroll"><table class="table"><thead><tr><th>Usuário</th><th>Login</th><th>Sessões</th><th>Chips</th></tr></thead><tbody>${rows}</tbody></table></div>`
              : `<div class="empty">Nenhum chip em maturação no momento.</div>`
          }
        </div>
      </div>
      <p style="margin-top:12px"><a href="/admin/usuarios">← Voltar para usuários</a></p>
    </div>`;

  return appLayout(
    "Admin · Maturador",
    "admin" as NavId,
    body,
    false,
    input.userName,
    "Chips em maturação na plataforma",
    input.userAvatar,
    "",
    "",
    true
  );
}
