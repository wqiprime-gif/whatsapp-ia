import { APP_VERSION } from "../version.js";
import { globalStyles } from "./styles.js";
import { icons } from "./icons.js";
import { panelClientScript } from "./panel-client.js";
import { brandLockupHtml, brandMarkHtml, FAVICON_LINK, SUPPORT_WHATSAPP_URL } from "./brand.js";
import { mobileDrawerScript } from "./mobile-drawer.js";
import { PWA_HEAD_TAGS } from "./pwa.js";
import { panelSceneScript } from "./panel-scene.js";
import { sidebarPinScript } from "./sidebar-pin.js";

export type NavId =
  | "dashboard"
  | "instances"
  | "maturador"
  | "new"
  | "settings"
  | "leads"
  | "payments"
  | "products"
  | "media"
  | "gifts"
  | "remarketing"
  | "links"
  | "profile"
  | "admin";

export function panelUserLabel(input: { name: string; email?: string; username?: string }) {
  const username = input.username?.trim();
  if (username) return `@${username.replace(/^@/, "")}`;
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

function mobileMenuLink(href: string, label: string, icon: string, active: boolean) {
  const cls = active ? "mobile-menu-link active" : "mobile-menu-link";
  return `<a href="${href}" class="${cls}" data-nav>${icon}<span>${escapeHtml(label)}</span></a>`;
}

export function userAvatarHtml(avatarUrl: string, label: string, large = false, cacheBust = "") {
  const initials = escapeHtml(label.slice(0, 2).toUpperCase());
  const lg = large ? " user-avatar--lg" : "";
  const imgLg = large ? " user-avatar-img--lg" : "";
  const raw = avatarUrl?.trim() ?? "";

  if (!raw) {
    return `<span class="user-avatar-slot"><div class="user-avatar user-avatar-fallback${lg}">${initials}</div></span>`;
  }

  let finalSrc = "";
  if (raw.startsWith("data:")) {
    finalSrc = raw;
  } else if (raw.startsWith("/uploads/") || raw.startsWith("http")) {
    const bust = cacheBust || String(Date.now());
    const sep = raw.includes("?") ? "&" : "?";
    finalSrc = `${raw}${sep}v=${bust}`;
  }

  if (!finalSrc) {
    return `<span class="user-avatar-slot"><div class="user-avatar user-avatar-fallback${lg}">${initials}</div></span>`;
  }

  return `<span class="user-avatar-slot has-avatar"><img class="user-avatar-img${imgLg}" src="${escapeHtml(finalSrc)}" alt="" onerror="this.parentElement.classList.remove('has-avatar');this.remove();" /><div class="user-avatar user-avatar-fallback${lg}">${initials}</div></span>`;
}

export function appLayout(
  title: string,
  active: NavId,
  body: string,
  partial = false,
  userName = "Usuario",
  subtitle = "",
  userAvatar = "",
  topbarLeftHtml = "",
  topbarCenterHtml = "",
  showAdminNav = false
) {
  if (partial) return body;

  const is = (id: NavId) => active === id;
  const topbarCls = topbarLeftHtml || topbarCenterHtml ? " topbar--dash" : " topbar--minimal";
  const topbarLeft = topbarLeftHtml || "";
  const topbarCenter = topbarCenterHtml
    ? `<div class="topbar-center">${topbarCenterHtml}</div>`
    : "";

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  ${FAVICON_LINK}
  ${PWA_HEAD_TAGS}
  <title>X1 BLACK</title>
  <style>${globalStyles}</style>
</head>
<body>
  <div class="light-rays" aria-hidden="true"></div>
  <div id="panel-nav-progress" class="panel-nav-progress" aria-hidden="true"></div>
  <canvas id="panel-scene-canvas" aria-hidden="true"></canvas>
  <div class="mesh-blob mesh-blob--app" aria-hidden="true"></div>
  <div class="ambient" aria-hidden="true"></div>
  <header class="mobile-topbar mobile-topbar--account" aria-label="X1 BLACK">
    ${brandLockupHtml("mobile")}
    <div class="mobile-account-shell">
      <a href="/perfil" class="mobile-account-head" data-nav>
        ${userAvatarHtml(userAvatar, userName)}
        <span class="mobile-account-name">${escapeHtml(userName)}</span>
        <form method="post" action="/logout" class="mobile-account-power" onclick="event.stopPropagation()">
          <button type="submit" aria-label="Sair">${icons.logout}</button>
        </form>
      </a>
      <a href="/perfil" class="mobile-account-manage" data-nav>GERENCIAR CONTA</a>
    </div>
  </header>
  <div id="mobile-drawer-backdrop" class="mobile-drawer-backdrop" aria-hidden="true"></div>
  <aside id="mobile-menu-drawer" class="mobile-menu-drawer" aria-hidden="true" aria-label="Menu X1 BLACK">
    <div class="mobile-menu-head">
      <div class="mobile-menu-brand">
        ${brandLockupHtml("drawer")}
      </div>
      <button type="button" id="mobile-menu-close" class="mobile-menu-close" aria-label="Fechar menu">×</button>
    </div>
    <nav class="mobile-menu-nav">
      <div class="mobile-menu-section">PRINCIPAL</div>
      ${mobileMenuLink("/", "Dashboard", icons.dashboard, is("dashboard"))}
      ${mobileMenuLink("/instances", "Instâncias", icons.layers, is("instances"))}
      ${mobileMenuLink("/maturador", "Maturador", icons.flame, is("maturador"))}
      ${mobileMenuLink("/links", "Gerar links", icons.link, is("links"))}
      ${mobileMenuLink("/leads", "Leads", icons.users, is("leads"))}
      <div class="mobile-menu-section">AUTOMAÇÕES</div>
      ${mobileMenuLink("/remarketing", "Remarketing", icons.megaphone, is("remarketing"))}
      ${mobileMenuLink("/gifts", "Pedir presentes", icons.sparkles, is("gifts"))}
      ${mobileMenuLink("/payments", "Pagamentos", icons.card, is("payments"))}
      ${mobileMenuLink("/products", "Produtos", icons.box, is("products"))}
      ${mobileMenuLink("/media", "Mídias", icons.image, is("media"))}
      ${showAdminNav ? `<div class="mobile-menu-section">ADMIN</div>${mobileMenuLink("/admin/usuarios", "Usuários", icons.crown, is("admin"))}${mobileMenuLink("/admin/maturador", "Maturador", icons.flame, false)}` : ""}
      <div class="mobile-menu-section">CONTA</div>
      ${mobileMenuLink("/perfil", "Minha conta", icons.users, is("profile"))}
      <a href="${SUPPORT_WHATSAPP_URL}" class="mobile-menu-link" target="_blank" rel="noopener">${icons.help}<span>Suporte WhatsApp</span></a>
      <a href="/instances/new" class="mobile-menu-link mobile-menu-link--cta" data-nav>${icons.plus}<span>Nova Instância</span></a>
    </nav>
    <div class="mobile-menu-foot">
      <a href="/perfil" class="mobile-menu-user" data-nav>
        ${userAvatarHtml(userAvatar, userName)}
        <span>${escapeHtml(userName)}</span>
      </a>
      <form method="post" action="/logout">
        <button type="submit" class="mobile-menu-logout">${icons.logout}<span>Sair</span></button>
      </form>
    </div>
  </aside>
  <div class="app">
    <aside class="sidebar">
      <div class="sidebar-brand">${brandMarkHtml()}</div>
      <div class="sidebar-account">
        <div class="sidebar-account-head">
          ${userAvatarHtml(userAvatar, userName)}
          <span class="sidebar-account-name nav-text">${escapeHtml(userName)}</span>
          <form method="post" action="/logout" class="sidebar-account-power">
            <button type="submit" aria-label="Sair" title="Sair">${icons.logout}</button>
          </form>
        </div>
        <a href="/perfil" class="sidebar-account-manage nav-text" data-nav>
          <span>GERENCIAR CONTA</span>${icons.chevronDown}
        </a>
      </div>
      <a href="/instances/new" class="btn-new">${icons.plus}<span class="btn-new-label"> Nova Instância</span></a>
      <nav class="nav">
        <div class="nav-section">
          <div class="nav-section-label nav-text">PRINCIPAL</div>
          ${navItem("/", "Dashboard", icons.dashboard, is("dashboard"))}
          ${navItem("/instances", "Instâncias", icons.layers, is("instances"))}
          ${navItem("/maturador", "Maturador", icons.flame, is("maturador"))}
          ${navItem("/links", "Gerar links", icons.link, is("links"))}
          ${navItem("/leads", "Leads", icons.users, is("leads"))}
          ${navItem("/remarketing", "Remarketing", icons.megaphone, is("remarketing"))}
          ${navItem("/gifts", "Pedir presentes", icons.sparkles, is("gifts"))}
          ${navItem("/payments", "Pagamentos", icons.card, is("payments"))}
          ${navItem("/products", "Produtos", icons.box, is("products"))}
          ${navItem("/media", "Mídias", icons.image, is("media"))}
          ${showAdminNav ? `<div class="nav-section-label nav-text">ADMIN</div>${navItem("/admin/usuarios", "Usuários", icons.crown, is("admin"))}${navItem("/admin/maturador", "Maturador", icons.flame, false)}` : ""}
          ${navItem("/perfil", "Minha conta", icons.users, is("profile"))}
          <a href="${SUPPORT_WHATSAPP_URL}" class="nav-support" target="_blank" rel="noopener">${icons.help}<span class="nav-text"> Suporte WhatsApp</span></a>
        </div>
      </nav>
      <button type="button" class="sidebar-pin" id="sidebar-pin" aria-pressed="false" aria-label="Fixar sidebar" title="Fixar sidebar">
        ${icons.sidebarPanel}<span class="nav-text">Fixar sidebar</span>
      </button>
    </aside>
${sidebarPinScript}
    <div class="main-wrap">
      <header class="topbar${topbarCls}">
        <div class="topbar-left">
          ${topbarLeft}
        </div>
        ${topbarCenter}
        <div class="topbar-right">
          <div class="bell-wrap">
            <button type="button" class="icon-btn bell-btn" aria-label="Notificações">${icons.bell}<span class="bell-badge" style="display:none">!</span></button>
            <div id="bell-menu" class="bell-menu"></div>
          </div>
          <a href="/perfil" class="user-pill user-pill--avatar-only" id="panel-user-pill" title="Minha conta" data-user-label="${escapeHtml(userName)}" data-avatar="${escapeHtml(userAvatar)}">
            ${userAvatarHtml(userAvatar, userName)}
          </a>
        </div>
      </header>
      <main class="content">${body}</main>
      <footer class="footer">X1 BLACK © 2026 · v${APP_VERSION} · <a href="/health" target="_blank" rel="noopener" style="color:var(--muted)">status</a></footer>
    </div>
  </div>
  <nav class="mobile-tabbar" aria-label="Navegação mobile">
    <a href="/" class="mobile-tab${is("dashboard") ? " active" : ""}" data-nav="dashboard">${icons.dashboard}<span>Home</span></a>
    <a href="/instances" class="mobile-tab${is("instances") || is("new") ? " active" : ""}" data-nav="instances">${icons.layers}<span>Bots</span></a>
    <a href="/links" class="mobile-tab${is("links") ? " active" : ""}" data-nav="links">${icons.link}<span>Links</span></a>
    <a href="/leads" class="mobile-tab${is("leads") ? " active" : ""}" data-nav="leads">${icons.users}<span>Leads</span></a>
    <button type="button" class="mobile-tab mobile-tab--more" id="mobile-menu-btn" aria-label="Mais" aria-expanded="false" onclick="if(window.toggleOnlyChatMobileMenu)window.toggleOnlyChatMobileMenu(event)">${icons.menu}<span>Mais</span></button>
  </nav>
  <div id="panel-toasts" class="panel-toasts"></div>
  <div id="sale-popup-root" class="sale-popup-root" aria-live="polite"></div>
${mobileDrawerScript}
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
