import { APP_VERSION } from "../version.js";
import { globalStyles } from "./styles.js";
import { icons } from "./icons.js";
import { panelClientScript } from "./panel-client.js";
import { brandMarkHtml, FAVICON_LINK } from "./brand.js";
import { panelSceneScript } from "./panel-scene.js";

export type NavId =
  | "dashboard"
  | "instances"
  | "new"
  | "settings"
  | "leads"
  | "payments"
  | "products"
  | "media"
  | "gifts"
  | "remarketing";

export function panelUserLabel(input: { name: string; email: string }) {
  const email = input.email?.trim();
  if (email) return email;
  const name = input.name?.trim();
  if (!name || name.startsWith("@")) return "Conta";
  return name;
}

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function navItem(href: string, label: string, icon: string, active: boolean) {
  const cls = active ? "active" : "";
  return `<a href="${href}" class="${cls}" data-nav title="${escapeHtml(label)}">${icon}<span class="nav-text">${label}</span></a>`;
}

export function appLayout(
  title: string,
  active: NavId,
  body: string,
  partial = false,
  userName = "Usuario",
  subtitle = ""
) {
  if (partial) return body;

  const is = (id: NavId) => active === id;

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  ${FAVICON_LINK}
  <title>${escapeHtml(title)} · ZapManager</title>
  <style>${globalStyles}</style>
</head>
<body>
  <div class="light-rays" aria-hidden="true"></div>
  <div id="panel-nav-progress" class="panel-nav-progress" aria-hidden="true"></div>
  <canvas id="panel-scene-canvas" aria-hidden="true"></canvas>
  <div class="mesh-blob mesh-blob--app" aria-hidden="true"></div>
  <div class="ambient" aria-hidden="true"></div>
  <div class="app">
    <aside class="sidebar">
      <div class="sidebar-brand">${brandMarkHtml()}</div>
      <a href="/instances/new" class="btn-new">${icons.plus}<span class="btn-new-label"> Nova Instância</span></a>
      <nav class="nav">
        <div class="nav-section">
          ${navItem("/", "Dashboard", icons.dashboard, is("dashboard"))}
          ${navItem("/instances", "Instâncias", icons.layers, is("instances"))}
          ${navItem("/leads", "Leads", icons.users, is("leads"))}
          ${navItem("/remarketing", "Remarketing", icons.megaphone, is("remarketing"))}
          ${navItem("/gifts", "Pedir presentes", icons.sparkles, is("gifts"))}
          ${navItem("/payments", "Pagamentos", icons.card, is("payments"))}
          ${navItem("/products", "Produtos", icons.box, is("products"))}
          ${navItem("/media", "Mídias", icons.image, is("media"))}
          ${navItem("/settings", "Configurações", icons.settings, is("settings"))}
        </div>
      </nav>
      <div class="sidebar-plan">
        <strong>Seu plano: Pro</strong>
        <span>IA + vendas + remarketing</span>
        <div class="plan-usage">
          <div class="plan-usage-head"><span>Capacidade</span><span class="plan-usage-pct">72%</span></div>
          <div class="plan-usage-bar" role="progressbar" aria-valuenow="72" aria-valuemin="0" aria-valuemax="100"><span style="width:72%"></span></div>
        </div>
        <a href="/settings">Ver configurações</a>
      </div>
      <form method="post" action="/logout" style="margin-top:12px">
        <button type="submit" class="nav-btn" style="width:100%">${icons.logout} Sair</button>
      </form>
    </aside>
    <div class="main-wrap">
      <header class="topbar">
        <div class="topbar-left">
          <h1>${escapeHtml(title)}</h1>
          ${subtitle ? `<p class="topbar-subtitle">${escapeHtml(subtitle)}</p>` : ""}
        </div>
        <div class="topbar-center">
          <div class="topbar-search-wrap">
            <span class="topbar-search-icon" aria-hidden="true">${icons.search}</span>
            <input
              type="search"
              id="panel-global-search"
              class="topbar-search"
              placeholder="Buscar leads, instâncias, campanhas..."
              autocomplete="off"
            />
            <kbd class="topbar-kbd">Ctrl K</kbd>
          </div>
        </div>
        <div class="topbar-right">
          <div class="bell-wrap">
            <button type="button" class="icon-btn bell-btn" aria-label="Notificações">${icons.bell}<span class="bell-badge" style="display:none">!</span></button>
            <div id="bell-menu" class="bell-menu"></div>
          </div>
          <div class="user-pill">
            <div class="user-avatar">${escapeHtml(userName.slice(0, 2).toUpperCase())}</div>
            <div><div class="name">${escapeHtml(userName)}</div><div class="role">Conta ativa</div></div>
          </div>
        </div>
      </header>
      <main class="content">${body}</main>
      <footer class="footer">© 2026 ZapManager · v${APP_VERSION} · <a href="/health" target="_blank" rel="noopener" style="color:var(--muted)">status</a></footer>
    </div>
  </div>
  <div id="panel-toasts" class="panel-toasts"></div>
${panelClientScript}
  <script>${panelSceneScript("app")}</script>
</body>
</html>`;
}

export function alertHtml(message: string, type: "success" | "error" = "success") {
  const cls = type === "error" ? "alert-error" : "alert-success";
  return `<div class="alert ${cls}">${escapeHtml(message)}</div>`;
}

export function botInitials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function botHandle(name: string) {
  const slug = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
  return `@${slug || "bot"}_bot`;
}
