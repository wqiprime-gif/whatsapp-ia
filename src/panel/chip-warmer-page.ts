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
  return Math.min(100, Math.round((session.dayIndex / 10) * 100));
}

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
              <span class="form-hint">Dia ${s.dayIndex}/10</span>
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
              <a href="/aquecimento/sessao/${escapeHtml(s.id)}" class="btn btn-secondary btn-sm">Detalhes</a>
              <form method="post" action="/aquecimento/sessao/${escapeHtml(s.id)}/pausar" style="display:inline">
                <button type="submit" class="btn btn-secondary btn-sm">Pausar</button>
              </form>
            </div>
          </div>
        </div>`;
        })
        .join("")
    : `<div class="empty">Nenhuma sessão ativa. <a href="/aquecimento/novo">Iniciar aquecimento</a></div>`;

  const body = `
    <div class="page-shell warm-shell">
      ${input.message ? alertHtml(input.message, input.isError ? "error" : "success") : ""}
      <div class="dash-hero" style="margin-bottom:16px">
        <div>
          <p class="form-hint" style="margin:0">${timeGreeting()}, ${escapeHtml(input.userName.replace(/^@/, ""))}</p>
          <h2 style="margin:4px 0 0">Central de Aquecimento</h2>
          <p class="form-hint">${active.length ? `${active.length} sessão(ões) em andamento` : "Maturação automática em 10 dias"}</p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <a href="/aquecimento/novo" class="btn btn-primary">${icons.zap} Aquecer</a>
          <a href="/instances" class="btn btn-secondary">${icons.layers} Meus Chips</a>
        </div>
      </div>

      <div class="shark-kpi-grid" style="margin-bottom:16px">
        <div class="shark-kpi-card shark-card dash-glow-card">
          <div class="shark-kpi-head"><span class="shark-kpi-label">Sessões ativas</span>${icons.activity}</div>
          <div class="shark-kpi-value">${active.length}</div>
          <div class="form-hint">${warmingBots.size} chips em maturação</div>
        </div>
        <div class="shark-kpi-card shark-card dash-glow-card">
          <div class="shark-kpi-head"><span class="shark-kpi-label">Mensagens hoje</span>${icons.chat}</div>
          <div class="shark-kpi-value">${msgsToday}</div>
          <div class="form-hint">enviadas no aquecimento</div>
        </div>
        <div class="shark-kpi-card shark-card dash-glow-card">
          <div class="shark-kpi-head"><span class="shark-kpi-label">Chips conectados</span>${icons.smartphone}</div>
          <div class="shark-kpi-value">${connected.length}</div>
          <div class="form-hint">de ${input.bots.length} instâncias</div>
        </div>
      </div>

      <div class="card card-premium" style="margin-bottom:16px">
        <div class="card-head">
          <h3>${icons.zap} Maturação dos Chips</h3>
          <p class="form-hint" style="margin:0">Ciclo de 10 dias · áudios, reações, menções e respostas citadas</p>
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
                <td>${s.dayIndex}/10</td>
                <td>${s.messagesTotal}</td>
                <td><a href="/aquecimento/sessao/${escapeHtml(s.id)}">Ver</a></td>
              </tr>`
                )
                .join("")}</tbody></table></div>`
          }
        </div>
      </div>
    </div>
    <style>
      .warm-progress-bar{height:8px;background:rgba(255,255,255,.08);border-radius:999px;overflow:hidden}
      .warm-progress-fill{height:100%;background:linear-gradient(90deg,#f59e0b,#fbbf24);border-radius:999px}
      .warm-chip-row{display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.06)}
      .warm-chip-row:last-child{border-bottom:0}
      .warm-instance-card{border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:12px;margin-bottom:8px;cursor:pointer}
      .warm-instance-card.selected{border-color:#22c55e;background:rgba(34,197,94,.08)}
      .warm-instance-card input{margin-right:8px}
      .warm-group-card{border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:10px;margin-bottom:8px}
    </style>`;

  if (input.partial) return body;
  return appLayout(
    "Aquecimento",
    "aquecimento" as NavId,
    body,
    false,
    input.userName,
    "Aquecedor automático de chips",
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
    <div class="page-shell warm-shell">
      ${input.message ? alertHtml(input.message, input.isError ? "error" : "success") : ""}
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px">
        <div>
          <a href="/aquecimento" class="btn btn-secondary btn-sm">← Voltar</a>
          <h2 style="margin:8px 0 0">${icons.zap} Aquecedor de Chip</h2>
          <p class="form-hint">Automático · Intervalos naturais · Anti-ban</p>
        </div>
      </div>

      <div class="card card-premium" style="margin-bottom:16px">
        <div class="card-head"><h3>1 · Instâncias</h3><p class="form-hint" style="margin:0">Selecione pelo menos 2 chips conectados</p></div>
        <div class="card-body">${instanceCards}</div>
      </div>

      <div class="card card-premium">
        <div class="card-head"><h3>2 · Modo & Grupos</h3></div>
        <div class="card-body">
          <form id="warm-discover-form" class="form-stack" onsubmit="return warmDiscoverGroups(event)">
            <input type="hidden" name="botIdsJson" id="warm-bot-ids-json" value="[]" />
            <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px">
              <label><input type="radio" name="mode" value="groups" checked /> Grupos (recomendado)</label>
              <label><input type="radio" name="mode" value="p2p" /> P2P (privado)</label>
            </div>
            <button type="submit" class="btn btn-secondary" id="warm-discover-btn">${icons.refresh} Buscar grupos em comum</button>
          </form>
          <div id="warm-groups-status" class="form-hint" style="margin:12px 0">Selecione os chips e busque os grupos compartilhados.</div>
          <div id="warm-groups-list"></div>

          <form id="warm-start-form" method="post" action="/aquecimento/sessao/criar" style="margin-top:16px">
            <input type="hidden" name="mode" id="warm-mode-hidden" value="groups" />
            <input type="hidden" name="groupIds" id="warm-group-ids-hidden" value="" />
            <input type="hidden" name="groupsMeta" id="warm-groups-meta-hidden" value="[]" />
            <div class="form-row" style="margin-bottom:12px">
              <label>Nome da sessão</label>
              <input type="text" name="name" placeholder="Aquecimento ${new Date().toLocaleDateString("pt-BR")}" class="input" />
            </div>
            <button type="submit" class="btn btn-primary" id="warm-start-btn" disabled>${icons.zap} Ativar Aquecimento</button>
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
    <style>
      .warm-instance-card{border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:12px;margin-bottom:8px;display:block}
      .warm-instance-card.selected,.warm-instance-card:has(input:checked){border-color:#22c55e;background:rgba(34,197,94,.08)}
      .warm-group-card{display:block;border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:10px;margin-bottom:8px}
    </style>`;

  if (input.partial) return body;
  return appLayout(
    "Novo aquecimento",
    "aquecimento" as NavId,
    body,
    false,
    input.userName,
    "Configurar sessão de aquecimento",
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

  const daysHtml = Array.from({ length: 10 }, (_, i) => {
    const d = i + 1;
    const done = d <= s.dayIndex;
    return `<span class="warm-day-dot ${done ? "done" : ""}">D${d}</span>`;
  }).join("");

  const logs = s.lastLog ? `<div class="form-hint" style="margin-top:12px">Última ação: ${escapeHtml(s.lastLog)}</div>` : "";

  const body = `
    <div class="page-shell warm-shell">
      ${input.message ? alertHtml(input.message, input.isError ? "error" : "success") : ""}
      <div style="margin-bottom:16px">
        <a href="/aquecimento" class="btn btn-secondary btn-sm">← Central</a>
        <h2 style="margin:8px 0 0">${escapeHtml(s.name)} ${sessionStatusBadge(s.status)}</h2>
      </div>

      <div class="shark-kpi-grid" style="margin-bottom:16px">
        <div class="shark-kpi-card shark-card dash-glow-card">
          <div class="shark-kpi-head"><span class="shark-kpi-label">Ciclo</span>${icons.calendar}</div>
          <div class="shark-kpi-value">Dia ${s.dayIndex}/10</div>
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
            ? `<form method="post" action="/aquecimento/sessao/${escapeHtml(s.id)}/pausar"><button class="btn btn-secondary">Pausar</button></form>`
            : s.status === "paused"
              ? `<form method="post" action="/aquecimento/sessao/${escapeHtml(s.id)}/retomar"><button class="btn btn-primary">Retomar</button></form>`
              : ""
        }
        <form method="post" action="/aquecimento/sessao/${escapeHtml(s.id)}/encerrar" onsubmit="return confirm('Encerrar esta sessão?');">
          <button class="btn btn-danger">Encerrar</button>
        </form>
      </div>
    </div>
    <style>
      .warm-progress-bar{height:8px;background:rgba(255,255,255,.08);border-radius:999px;overflow:hidden}
      .warm-progress-fill{height:100%;background:linear-gradient(90deg,#22c55e,#86efac);border-radius:999px}
      .warm-day-timeline{display:flex;gap:6px;flex-wrap:wrap}
      .warm-day-dot{width:34px;height:34px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:0.72rem;background:rgba(255,255,255,.08);color:var(--text-2)}
      .warm-day-dot.done{background:#22c55e;color:#041007;font-weight:700}
    </style>`;

  if (input.partial) return body;
  return appLayout(
    s.name,
    "aquecimento" as NavId,
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
          <div class="shark-kpi-head"><span class="shark-kpi-label">Chips aquecendo</span>${icons.zap}</div>
          <div class="shark-kpi-value">${input.totalWarming}</div>
        </div>
        <div class="shark-kpi-card shark-card dash-glow-card">
          <div class="shark-kpi-head"><span class="shark-kpi-label">Sessões ativas</span>${icons.activity}</div>
          <div class="shark-kpi-value">${input.totalSessions}</div>
        </div>
      </div>
      <div class="card card-premium">
        <div class="card-head"><h3>${icons.zap} Aquecimento por usuário</h3></div>
        <div class="card-body card-body--flush">
          ${
            rows
              ? `<div class="table-scroll"><table class="table"><thead><tr><th>Usuário</th><th>Login</th><th>Sessões</th><th>Chips</th></tr></thead><tbody>${rows}</tbody></table></div>`
              : `<div class="empty">Nenhum chip em aquecimento no momento.</div>`
          }
        </div>
      </div>
      <p style="margin-top:12px"><a href="/admin/usuarios">← Voltar para usuários</a></p>
    </div>`;

  return appLayout(
    "Admin · Aquecimento",
    "admin" as NavId,
    body,
    false,
    input.userName,
    "Chips em aquecimento na plataforma",
    input.userAvatar,
    "",
    "",
    true
  );
}
