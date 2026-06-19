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
  | "remarketing"
  | "profile";

export function panelUserLabel(input: { name: string; email: string }) {
  const email = input.email?.trim();
  if (email) return email;
  const name = input.name?.trim();
  if (!name || name.startsWith("@")) return "Conta";
  return name;
}

export function greetingDisplayName(name: string, email: string) {
  const n = name?.trim();
  if (n && !n.includes("@") && n.toLowerCase() !== "usuario") {
    return n.split(/\s+/)[0]!.toLowerCase();
  }
  return (email.split("@")[0] || "user").toLowerCase();
}

const TZ_SAO_PAULO = "America/Sao_Paulo";

export function saoPauloNowParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ_SAO_PAULO,
    hour: "numeric",
    hour12: false,
    day: "numeric",
    month: "numeric",
    year: "numeric"
  });
  const parts = fmt.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  return {
    hour: Number(get("hour")),
    day: Number(get("day")),
    month: Number(get("month")) - 1,
    year: Number(get("year"))
  };
}

export function timeGreeting(hour?: number) {
  const h = hour ?? saoPauloNowParts().hour;
  if (h >= 0 && h < 6) return "Boa madrugada";
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

const MONTHS_PT = [
  "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
  "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"
];

export function dashboardDateLabel(date = new Date()) {
  const { day, month, year } = saoPauloNowParts(date);
  return `${day} DE ${MONTHS_PT[month]} DE ${year}`;
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

export function userAvatarHtml(avatarUrl: string, label: string, large = false, cacheBust = "") {
  const initials = escapeHtml(label.slice(0, 2).toUpperCase());
  const sizeCls = large ? " user-avatar-img--lg" : "";
  const src = avatarUrl?.trim();
  if (src) {
    const bust = cacheBust || String(Date.now());
    const sep = src.includes("?") ? "&" : "?";
    return `<img class="user-avatar-img${sizeCls}" src="${escapeHtml(src + sep + "v=" + bust)}" alt="" onerror="this.style.display='none';this.nextElementSibling&&(this.nextElementSibling.style.display='grid')" /><div class="user-avatar${large ? " user-avatar--lg" : ""}" style="display:none">${initials}</div>`;
  }
  return `<div class="user-avatar${large ? " user-avatar--lg" : ""}">${initials}</div>`;
}

export function appLayout(
  title: string,
  active: NavId,
  body: string,
  partial = false,
  userName = "Usuario",
  subtitle = "",
  userAvatar = ""
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
          ${navItem("/perfil", "Minha conta", icons.users, is("profile"))}
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
        <button type="submit" class="nav-btn" style="width:100%">${icons.logout}<span class="nav-text"> Sair</span></button>
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
          <a href="/perfil" class="user-pill" id="panel-user-pill" title="Minha conta" data-avatar="${escapeHtml(userAvatar)}">
            ${userAvatarHtml(userAvatar, userName)}
            <div><div class="name" id="panel-user-name">${escapeHtml(userName)}</div><div class="role">Conta ativa</div></div>
          </a>
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
