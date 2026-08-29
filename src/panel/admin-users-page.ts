import type { PlatformUserSummary } from "../db/users.js";
import { alertHtml, appLayout, escapeHtml, type NavId } from "./layout.js";
import { icons } from "./icons.js";
import { userAvatarHtml } from "./layout.js";

function formatDate(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function adminUsersPage(
  users: PlatformUserSummary[],
  message = "",
  isError = false,
  partial = false,
  userName = "Admin",
  userAvatar = ""
) {
  const total = users.length;
  const withBots = users.filter((u) => u.botCount > 0).length;
  const warmingTotal = users.reduce((a, u) => a + (u.warmingChipCount || 0), 0);

  const rows =
    users.length === 0
      ? `<div class="empty">Nenhum usuário cadastrado ainda.</div>`
      : `<div class="table-scroll" role="region" aria-label="Usuários da plataforma">
      <table class="table admin-users-table">
        <thead>
          <tr>
            <th>Usuário</th>
            <th>Login</th>
            <th>Instâncias</th>
            <th>Maturando</th>
            <th>Cadastro</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${users
            .map((u) => {
              const label = u.name?.trim() || u.username || "User";
              const ownerBadge = u.isOwner
                ? `<span class="badge badge-online" style="margin-left:8px">Admin</span>`
                : "";
              const deleteBtn =
                u.isOwner
                  ? `<span class="form-hint" style="font-size:0.78rem">conta protegida</span>`
                  : `<form method="post" action="/admin/usuarios/${escapeHtml(u.id)}/delete" class="admin-delete-form" onsubmit="return confirm('Excluir permanentemente a conta de ${escapeHtml(label)}? Todas as instâncias e dados serão apagados.');">
                  <button type="submit" class="btn btn-danger btn-sm">${icons.trash} Excluir</button>
                </form>`;
              return `<tr>
            <td>
              <div class="admin-user-cell">
                ${userAvatarHtml(u.avatarUrl ?? "", label)}
                <div>
                  <strong>${escapeHtml(u.name || "—")}</strong>${ownerBadge}
                </div>
              </div>
            </td>
            <td><code style="font-size:0.82rem">@${escapeHtml(u.username || u.email.split("@")[0] || "user")}</code></td>
            <td>${u.botCount}</td>
            <td>${u.warmingChipCount > 0 ? `<strong style="color:#fbbf24">${u.warmingChipCount}</strong>` : "0"}</td>
            <td style="font-size:0.85rem;color:var(--text-2)">${formatDate(u.createdAt)}</td>
            <td class="admin-user-actions">${deleteBtn}</td>
          </tr>`;
            })
            .join("")}
        </tbody>
      </table>
    </div>`;

  const body = `
    <div class="page-shell admin-users-shell">
      ${message ? alertHtml(message, isError ? "error" : "success") : ""}
      <div class="shark-kpi-grid" style="margin-bottom:16px;grid-template-columns:repeat(auto-fit,minmax(160px,1fr))">
        <div class="shark-kpi-card shark-card dash-glow-card">
          <div class="shark-kpi-head"><span class="shark-kpi-label">Total de contas</span>${icons.users}</div>
          <div class="shark-kpi-value">${total}</div>
        </div>
        <div class="shark-kpi-card shark-card dash-glow-card">
          <div class="shark-kpi-head"><span class="shark-kpi-label">Com instâncias</span>${icons.layers}</div>
          <div class="shark-kpi-value">${withBots}</div>
        </div>
        <div class="shark-kpi-card shark-card dash-glow-card">
          <div class="shark-kpi-head"><span class="shark-kpi-label">Chips maturando</span>${icons.flame}</div>
          <div class="shark-kpi-value">${warmingTotal}</div>
        </div>
      </div>
      <div class="card card-premium" style="margin-bottom:16px">
        <div class="card-head">
          <h3>${icons.bell} Aviso para todos os clientes</h3>
          <p class="form-hint" style="margin:0">Envia notificação push no celular/PWA de quem instalou o app e aceitou notificações.</p>
        </div>
        <div class="card-body">
          <form method="post" action="/admin/broadcast" class="form-grid" style="gap:12px">
            <label class="field span-2">Título
              <input name="title" required maxlength="80" placeholder="Ex: Atualização do X1 BLACK" />
            </label>
            <label class="field span-2">Mensagem
              <textarea name="body" required maxlength="240" rows="3" placeholder="Ex: Vamos atualizar o sistema hoje às 22h. Pode ficar offline por alguns minutos."></textarea>
            </label>
            <div class="form-actions-bar" style="margin:0">
              <button type="submit" class="btn btn-primary">Enviar notificação para todos</button>
            </div>
          </form>
        </div>
      </div>
      <div class="card card-premium">
        <div class="card-head">
          <h3>${icons.crown} Usuários da plataforma</h3>
          <p class="form-hint" style="margin:0">Gerencie contas cadastradas. Excluir remove instâncias, bots e dados do usuário. <a href="/admin/maturador">Ver maturador global</a></p>
        </div>
        <div class="card-body card-body--flush">${rows}</div>
      </div>
    </div>`;

  if (partial) return body;
  return appLayout(
    "Admin · Usuários",
    "admin" as NavId,
    body,
    false,
    userName,
    "Gestão de contas da plataforma",
    userAvatar,
    "",
    "",
    true
  );
}
