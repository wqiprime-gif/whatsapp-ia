/** Client-side navigation, live updates and sale notifications for the panel. */
export const panelClientScript = `
<script>
(function () {
  const main = document.querySelector(".content");
  if (!main) return;

  const NAV_PATHS = [
    ["/", "Dashboard"],
    ["/instances", "Instâncias"],
    ["/leads", "Leads"],
    ["/remarketing", "Remarketing"],
    ["/gifts", "Pedir presentes"],
    ["/payments", "Pagamentos"],
    ["/products", "Produtos"],
    ["/media", "Mídias"],
    ["/settings", "Configurações"],
    ["/perfil", "Minha conta"],
    ["/instances/new", "Nova Instância"]
  ];

  const LS_LAST_SALE = "panelLastSaleId";
  const LS_BELL_SEEN = "panelBellSeenAt";
  const LS_AVATAR = "panelAvatarUrl";
  const LS_AVATAR_PREVIEW = "panelAvatarPreview";
  const pageCache = new Map();
  let navigating = false;
  let fetchCtrl = null;
  const progress = document.getElementById("panel-nav-progress");

  function bindWaInstanceForm(root) {
    const scope = root || document;
    const marker = scope.querySelector("[data-wa-form-init]");
    if (!marker || marker.dataset.waBound) return;
    marker.dataset.waBound = "1";

    const hints = {
      whatsapp_web: "QR Code no celular · Puppeteer · ideal para testes e VPS com disco",
      meta_cloud: "Token permanente · webhook · recomendado para produção e Railway"
    };

    const sel = scope.querySelector("#wa-api-provider");
    const web = scope.querySelector("#wa-web-block");
    const meta = scope.querySelector("#wa-meta-block");
    const hint = scope.querySelector("#wa-api-hint");
    const proxySel = scope.querySelector("#proxy-enabled");
    const proxyBlock = scope.querySelector("#proxy-fields-block");

    function syncApi() {
      const v = sel && sel.value;
      if (web) web.style.display = v === "meta_cloud" ? "none" : "";
      if (meta) meta.style.display = v === "meta_cloud" ? "" : "none";
      if (hint && v) hint.textContent = hints[v] || "";
    }
    function syncProxy() {
      const on = proxySel && proxySel.value === "true";
      if (proxyBlock) {
        proxyBlock.style.opacity = on ? "1" : "0.55";
        proxyBlock.querySelectorAll("input,select").forEach((el) => {
          el.disabled = !on;
        });
      }
    }
    if (sel) { sel.addEventListener("change", syncApi); syncApi(); }
    if (proxySel) { proxySel.addEventListener("change", syncProxy); syncProxy(); }
  }

  function runInlineScripts(root) {
    (root || document).querySelectorAll("script:not([src])").forEach(function (old) {
      if (!old.textContent || !old.textContent.trim()) return;
      var s = document.createElement("script");
      if (old.type) s.type = old.type;
      s.textContent = old.textContent;
      old.parentNode.replaceChild(s, old);
    });
  }

  function bindForms(root) {
    (root || document).querySelectorAll("form").forEach((f) => {
      if (f.dataset.bound) return;
      f.dataset.bound = "1";
      f.addEventListener("submit", () => {
        const b = f.querySelector('button[type="submit"]');
        if (b) { b.disabled = true; b.textContent = "Salvando..."; }
      });
    });
    bindWaInstanceForm(root);
    runInlineScripts(root);
  }

  function pageTitle(path) {
    if (path.startsWith("/instances/new")) return "Nova Instância";
    if (/^\\/instances\\/[^/]+\\/edit$/.test(path)) return "Editar instância";
    const hit = NAV_PATHS.find(([p]) => p === path);
    return hit ? hit[1] : "ZapManager";
  }

  function normPath(p) {
    const s = (p || "/").split("?")[0];
    if (!s || s === "/") return "/";
    return s.replace(/\/$/, "") || "/";
  }

  function setActiveNav(path) {
    const current = normPath(path);
    document.querySelectorAll(".sidebar .nav a[data-nav]").forEach((a) => {
      const href = normPath(a.getAttribute("href") || "");
      let active = href === current;
      if (!active && current.startsWith("/instances") && href === "/instances" && current !== "/instances/new") {
        active = true;
      }
      if (!active && current === "/perfil" && href === "/perfil") {
        active = true;
      }
      a.classList.toggle("active", active);
    });
  }

  function isInternalNavLink(a) {
    if (!a || a.target === "_blank" || a.hasAttribute("download")) return false;
    const href = a.getAttribute("href");
    if (!href || !href.startsWith("/")) return false;
    if (href.startsWith("/uploads")) return false;
    if (a.closest("form")) return false;
    return true;
  }

  function startProgress() {
    if (progress) progress.classList.add("active");
  }
  function stopProgress() {
    if (progress) progress.classList.remove("active");
  }

  function applyContent(html, path) {
    main.innerHTML = html;
    const h = document.querySelector(".topbar h1");
    if (h) h.textContent = pageTitle(path);
    setActiveNav(path);
    bindForms(main);
    if (path === "/perfil" || path.startsWith("/perfil")) pageCache.delete("/perfil");
  }

  async function refreshUserPill() {
    try {
      const res = await fetch("/api/panel/me", { credentials: "same-origin" });
      if (!res.ok) return;
      const me = await res.json();
      const pill = document.getElementById("panel-user-pill");
      if (!pill) return;
      const nameEl = document.getElementById("panel-user-name");
      const label = me.label || me.email || "Conta";
      if (nameEl) nameEl.textContent = label;
      const prev = localStorage.getItem(LS_AVATAR) || "";
      const next = me.avatarUrl || "";
      if (next !== prev) {
        localStorage.setItem(LS_AVATAR, next);
        pageCache.delete("/");
        pageCache.delete("/perfil");
      }
      pill.dataset.avatar = next;
      const info = pill.querySelector(".name");
      const infoWrap = info ? info.parentElement : null;
      pill.querySelectorAll(".user-avatar, .user-avatar-img").forEach((el) => el.remove());
      const initials = label.slice(0, 2).toUpperCase();
      const preview = sessionStorage.getItem(LS_AVATAR_PREVIEW) || "";
      const avatarSrc = next || preview;
      if (avatarSrc) {
        const img = document.createElement("img");
        img.className = "user-avatar user-avatar-img";
        img.src = avatarSrc.indexOf("data:") === 0
          ? avatarSrc
          : avatarSrc + (avatarSrc.includes("?") ? "&" : "?") + "v=" + Date.now();
        img.alt = "";
        const fallback = document.createElement("div");
        fallback.className = "user-avatar";
        fallback.style.display = "none";
        fallback.textContent = initials;
        img.onerror = function () {
          if (preview && img.src !== preview) {
            img.src = preview;
            return;
          }
          img.style.display = "none";
          fallback.style.display = "flex";
        };
        pill.insertBefore(img, infoWrap);
        pill.insertBefore(fallback, infoWrap);
      } else {
        const div = document.createElement("div");
        div.className = "user-avatar";
        div.textContent = initials;
        pill.insertBefore(div, infoWrap);
      }
    } catch (_) {}
  }

  async function fetchPartial(href, signal) {
    const res = await fetch(href, {
      headers: { "X-Panel-Partial": "1" },
      credentials: "same-origin",
      signal
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const html = await res.text();
    const isFullDoc = /<!doctype/i.test(html) || html.includes("<html");
    if (isFullDoc) {
      const doc = new DOMParser().parseFromString(html, "text/html");
      const next = doc.querySelector(".content");
      if (!next) throw new Error("no content");
      const title = doc.querySelector(".topbar h1");
      if (title) {
        const h = document.querySelector(".topbar h1");
        if (h) h.textContent = title.textContent;
      }
      return next.innerHTML;
    }
    return html;
  }

  function prefetch(href) {
    const path = href.split("?")[0];
    if (pageCache.has(path)) return;
    fetchPartial(href).then((html) => pageCache.set(path, html)).catch(() => {});
  }

  async function loadPage(href, push = true) {
    const path = href.split("?")[0];
    if (navigating && path === location.pathname) return;

    const cached = pageCache.get(path);
    if (cached) {
      applyContent(cached, path);
      if (push) history.pushState({ panel: true }, "", href);
      refreshUserPill();
      if (path === "/") refreshLive(true);
      return;
    }

    if (fetchCtrl) fetchCtrl.abort();
    fetchCtrl = new AbortController();
    navigating = true;
    startProgress();
    main.classList.add("content-loading");

    try {
      const html = await fetchPartial(href, fetchCtrl.signal);
      pageCache.set(path, html);
      applyContent(html, path);
      if (push) history.pushState({ panel: true }, "", href);
      refreshUserPill();
      if (path === "/") refreshLive(true);
    } catch (err) {
      if (err && err.name === "AbortError") return;
      window.location.href = href;
    } finally {
      main.classList.remove("content-loading");
      stopProgress();
      navigating = false;
    }
  }

  document.addEventListener("click", (e) => {
    const a = e.target.closest("a");
    if (!isInternalNavLink(a)) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    loadPage(a.getAttribute("href"));
  });

  document.addEventListener("mouseenter", (e) => {
    const a = e.target.closest && e.target.closest("a");
    if (!isInternalNavLink(a)) return;
    prefetch(a.getAttribute("href"));
  }, true);

  window.addEventListener("popstate", () => {
    loadPage(location.pathname + location.search, false);
  });

  bindForms(document);
  refreshUserPill();

  const toastRoot = document.getElementById("panel-toasts");
  const bellBtn = document.querySelector(".icon-btn.bell-btn");
  const bellBadge = document.querySelector(".bell-badge");
  const bellMenu = document.getElementById("bell-menu");

  function showToast(title, body) {
    if (!toastRoot) return;
    const el = document.createElement("div");
    el.className = "panel-toast";
    el.innerHTML = '<strong>' + title + '</strong><span>' + body + '</span><button type="button" aria-label="Fechar">×</button>';
    toastRoot.appendChild(el);
    el.querySelector("button").addEventListener("click", () => el.remove());
    setTimeout(() => el.classList.add("show"), 10);
    setTimeout(() => { el.classList.remove("show"); setTimeout(() => el.remove(), 400); }, 8000);
    if (Notification && Notification.permission === "granted") {
      try { new Notification(title, { body }); } catch (_) {}
    }
  }

  if (bellBtn && bellMenu) {
    bellBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      bellMenu.classList.toggle("open");
      sessionStorage.setItem(LS_BELL_SEEN, String(Date.now()));
      if (bellBadge) bellBadge.style.display = "none";
    });
    document.addEventListener("click", () => bellMenu.classList.remove("open"));
  }

  if (Notification && Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }

  function updateBellMenu(sales) {
    if (!bellMenu) return;
    if (!sales || sales.length === 0) {
      bellMenu.innerHTML = '<div class="bell-empty">Nenhuma venda ainda</div>';
      return;
    }
    bellMenu.innerHTML = sales.slice(0, 8).map((s) =>
      '<div class="bell-item"><strong>' + s.title + '</strong><span>' + s.subtitle + '</span><time>' + s.time + '</time></div>'
    ).join("");
  }

  function money(cents) {
    return "R$ " + (cents / 100).toFixed(2).replace(".", ",");
  }

  function applyLive(data) {
    if (!data) return;
    const stats = data.stats;
    if (stats) {
      document.querySelectorAll("[data-live-stat]").forEach((el) => {
        const key = el.getAttribute("data-live-stat");
        if (key === "leads") el.textContent = String(stats.leads);
        if (key === "messagesTodayVal") el.textContent = String(stats.messagesToday);
        if (key === "salesValue") el.textContent = money(stats.salesTotalCents);
        if (key === "salesCount") el.textContent = stats.salesCount + " venda(s)";
        if (key === "salesCountVal") el.textContent = String(stats.salesCount);
        if (key === "convRate") el.textContent = (stats.convRate || "0,0") + "%";
        if (key === "activeBots") el.textContent = String(stats.activeBots);
      });
    }
    const feed = document.querySelector("[data-live=activity-feed]");
    if (feed && data.activityHtml) {
      const prev = feed.getAttribute("data-feed-sig") || "";
      if (prev !== data.activityHtml) {
        feed.innerHTML = data.activityHtml;
        feed.setAttribute("data-feed-sig", data.activityHtml);
      }
    }
    const top = document.querySelector("[data-live=top-bots]");
    if (top && data.topBotsHtml) top.innerHTML = data.topBotsHtml;
    const topPlayers = document.querySelector("[data-live=top-players]");
    if (topPlayers && data.topPlayersHtml) topPlayers.innerHTML = data.topPlayersHtml;
    const chart = document.querySelector("[data-live=sales-chart]");
    if (chart && data.chartSvg) chart.innerHTML = data.chartSvg;
    const convGauge = document.querySelector("[data-live=conv-gauge]");
    if (convGauge && data.convGaugeHtml) convGauge.innerHTML = data.convGaugeHtml;
    const msgChart = document.querySelector("[data-live=messages-chart]");
    if (msgChart && data.messagesChartSvg) msgChart.innerHTML = data.messagesChartSvg;
    const sparkSales = document.querySelector("[data-live=spark-sales]");
    if (sparkSales && data.sparkSalesHtml) sparkSales.innerHTML = data.sparkSalesHtml;
    const sparkMessages = document.querySelector("[data-live=spark-messages]");
    if (sparkMessages && data.sparkMessagesHtml) sparkMessages.innerHTML = data.sparkMessagesHtml;
    if (data.bellSales) updateBellMenu(data.bellSales);

    const latest = data.latestSale;
    if (latest && latest.id) {
      const prev = localStorage.getItem(LS_LAST_SALE);
      if (prev && prev !== latest.id) {
        showToast("Venda confirmada!", latest.subtitle);
        if (bellBadge) {
          bellBadge.style.display = "flex";
          bellBadge.textContent = "!";
        }
      }
      localStorage.setItem(LS_LAST_SALE, latest.id);
    }

    const bellSeen = Number(sessionStorage.getItem(LS_BELL_SEEN) || 0);
    if (data.latestSaleAt && new Date(data.latestSaleAt).getTime() > bellSeen && bellBadge) {
      bellBadge.style.display = "flex";
      bellBadge.textContent = "!";
    }
  }

  async function refreshLive(silent) {
    if (location.pathname !== "/") return;
    try {
      const res = await fetch("/api/panel/live", { credentials: "same-origin" });
      if (!res.ok) return;
      const data = await res.json();
      applyLive(data);
    } catch (_) {
      if (!silent) console.warn("live refresh failed");
    }
  }

  if (location.pathname === "/") refreshLive(true);
  setInterval(() => {
    if (document.hidden || location.pathname !== "/") return;
    refreshLive(true);
  }, 8000);

  function findNavRoute(q) {
    const query = q.trim().toLowerCase();
    if (!query) return null;
    const exact = NAV_PATHS.find(([path, label]) =>
      label.toLowerCase() === query || path === "/" + query || path.slice(1) === query
    );
    if (exact) return exact[0];
    if (query.length < 3) return null;
    const hit = NAV_PATHS.find(([, label]) => label.toLowerCase().startsWith(query));
    return hit ? hit[0] : null;
  }

  function bindGlobalSearch() {
    const input = document.getElementById("panel-global-search");
    if (!input) return;
    main.addEventListener("pointerdown", () => {
      if (document.activeElement === input) input.blur();
    });
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        input.focus();
        input.select();
      }
    });
    input.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      if (document.activeElement !== input) return;
      const q = input.value.trim().toLowerCase();
      if (!q) return;
      e.preventDefault();
      e.stopPropagation();
      const route = findNavRoute(q);
      if (route) {
        input.value = "";
        input.blur();
        loadPage(route);
        return;
      }
      if (/^\\d|@|lead/.test(q)) loadPage("/leads?q=" + encodeURIComponent(input.value.trim()));
      else loadPage("/instances?q=" + encodeURIComponent(input.value.trim()));
    });
  }
  bindGlobalSearch();
})();
</script>`;
