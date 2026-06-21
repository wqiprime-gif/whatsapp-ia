/** Client-side navigation, live updates and sale notifications for the panel. */
export const panelClientScript = `
<script>
(function () {
  const main = document.querySelector(".content");
  if (!main) return;

  const NAV_PATHS = [
    ["/", "Dashboard"],
    ["/instances", "Instâncias"],
    ["/links", "Gerar links"],
    ["/leads", "Leads"],
    ["/remarketing", "Remarketing"],
    ["/gifts", "Pedir presentes"],
    ["/payments", "Pagamentos"],
    ["/products", "Produtos"],
    ["/media", "Mídias"],
    ["/perfil", "Minha conta"],
    ["/instances/new", "Nova Instância"]
  ];

  const LS_LAST_SALE = "panelLastSaleId";
  const LS_BELL_SEEN = "panelBellSeenAt";
  const LS_AVATAR = "panelAvatarUrl";
  const LS_AVATAR_PREVIEW = "panelAvatarPreview";
  const LS_DASH_PERIOD = "dashPeriod";
  const LS_WA_STATUS = "panelWaStatusMap";
  const LS_SEEN_EVENTS = "panelSeenEventIds";
  const LS_DAILY_SUMMARY = "panelDailySummaryDate";
  const LS_EXTRA_BELL = "panelExtraBellItems";
  const LS_NOTIFY_PREFS = "panelNotifyPrefs";
  let notifyPrefs = {
    enabled: true,
    sales: true,
    leads: true,
    instances: true,
    dailySummary: true,
    desktop: true
  };

  function loadNotifyPrefs() {
    try {
      const raw = localStorage.getItem(LS_NOTIFY_PREFS);
      if (raw) notifyPrefs = JSON.parse(raw);
    } catch (_) {}
  }

  function saveNotifyPrefs(prefs) {
    if (!prefs) return;
    notifyPrefs = prefs;
    localStorage.setItem(LS_NOTIFY_PREFS, JSON.stringify(prefs));
  }

  function canNotify(kind) {
    if (!notifyPrefs || notifyPrefs.enabled === false) return false;
    if (kind === "sale") return notifyPrefs.sales !== false;
    if (kind === "lead") return notifyPrefs.leads !== false;
    if (kind === "wa_down" || kind === "wa_up") return notifyPrefs.instances !== false;
    if (kind === "daily") return notifyPrefs.dailySummary !== false;
    return true;
  }

  function canDesktopNotify() {
    return notifyPrefs && notifyPrefs.enabled !== false && notifyPrefs.desktop !== false;
  }

  loadNotifyPrefs();

  let swRegisterPromise = null;

  async function ensureServiceWorker() {
    if (!("serviceWorker" in navigator)) return null;
    if (!swRegisterPromise) {
      swRegisterPromise = navigator.serviceWorker.register("/sw.js").catch(() => null);
    }
    return swRegisterPromise;
  }

  async function pushSystemNotify(title, body, tag, url) {
    try {
      await ensureServiceWorker();
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.active) {
        reg.active.postMessage({
          type: "SHOW_NOTIFICATION",
          title: title,
          body: body,
          tag: tag || "zapmanager",
          url: url || "/"
        });
        return true;
      }
    } catch (_) {}
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      try {
        new Notification(title, { body: body, icon: "/brand/whatsapp-logo.svg" });
        return true;
      } catch (_) {}
    }
    return false;
  }

  function bindTestNotify(root) {
    const btn = (root || document).querySelector("#btn-test-notify");
    if (!btn || btn.dataset.bound) return;
    btn.dataset.bound = "1";
    btn.addEventListener("click", async function () {
      btn.disabled = true;
      const prev = btn.textContent;
      btn.textContent = "Enviando...";
      try {
        if (typeof Notification !== "undefined" && Notification.permission === "default") {
          await Notification.requestPermission();
        }
        const ok = await pushSystemNotify(
          "Teste OnlyChat",
          "Notificação de teste — se viu isso, alertas no celular funcionam!",
          "zap-test",
          "/"
        );
        if (ok) {
          showToast("Teste enviado!", "Verifique a bandeja de notificações do celular.", "daily");
        } else {
          showToast("Permissão necessária", "Ative notificações nas configurações do navegador/celular.", "daily");
        }
      } finally {
        btn.disabled = false;
        btn.textContent = prev;
      }
    });
  }
  let dashPeriod = localStorage.getItem(LS_DASH_PERIOD) || "hoje";
  const pageCache = new Map();
  let navigating = false;
  let fetchCtrl = null;
  const progress = document.getElementById("panel-nav-progress");

  function bindPlatformForm(root) {
    const scope = root || document;
    const platformSel = scope.querySelector("#instance-platform");
    if (!platformSel || platformSel.dataset.platformBound) return;
    platformSel.dataset.platformBound = "1";

    const tgBlock = scope.querySelector("#telegram-token-block");
    const waBlocks = scope.querySelector("#wa-platform-blocks");
    const tgTokenInput = scope.querySelector('input[name="telegramBotToken"]');

    function syncPlatform() {
      const isTg = platformSel.value === "telegram";
      if (tgBlock) tgBlock.style.display = isTg ? "" : "none";
      if (waBlocks) waBlocks.style.display = isTg ? "none" : "";
      if (tgTokenInput) {
        tgTokenInput.required = Boolean(isTg && !(tgTokenInput.placeholder || "").includes("Atual:"));
      }
    }
    platformSel.addEventListener("change", syncPlatform);
    syncPlatform();
  }

  function bindWaInstanceForm(root) {
    const scope = root || document;
    const marker = scope.querySelector("[data-wa-form-init]");
    if (!marker || marker.dataset.waBound) return;
    marker.dataset.waBound = "1";

    const proxySel = scope.querySelector("#proxy-enabled");
    const proxyBlock = scope.querySelector("#proxy-fields-block");

    function syncProxy() {
      const on = proxySel && proxySel.value === "true";
      if (proxyBlock) {
        proxyBlock.style.opacity = on ? "1" : "0.55";
        proxyBlock.querySelectorAll("input,select").forEach((el) => {
          el.disabled = !on;
        });
      }
    }
    if (proxySel) { proxySel.addEventListener("change", syncProxy); syncProxy(); }
  }

  function runInlineScripts(root) {
    (root || document).querySelectorAll("script:not([src])").forEach(function (old) {
      if (!old.textContent || !old.textContent.trim()) return;
      if (old.type && (old.type.indexOf("json") >= 0 || old.type.indexOf("ld+json") >= 0)) return;
      var s = document.createElement("script");
      if (old.type) s.type = old.type;
      s.textContent = old.textContent;
      old.parentNode.replaceChild(s, old);
    });
  }

  function parseChartPoints(chart) {
    try {
      const b64 = chart.getAttribute("data-chart-json") || "";
      if (b64) return JSON.parse(atob(b64));
      const dataEl = chart.querySelector(".shark-chart-data");
      if (dataEl && dataEl.textContent) return JSON.parse(dataEl.textContent);
      const raw = chart.getAttribute("data-chart-points") || "";
      if (raw.indexOf("%") >= 0) return JSON.parse(decodeURIComponent(raw));
      if (raw) return JSON.parse(raw.replace(/&#39;/g, "'"));
    } catch (_) {}
    return [];
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
    bindPlatformForm(root);
    bindWaInstanceForm(root);
    runInlineScripts(root);
  }

  function pageTitle(path) {
    if (path.startsWith("/instances/new")) return "Nova Instância";
    if (/^\\/instances\\/[^/]+\\/edit$/.test(path)) return "Editar instância";
    const hit = NAV_PATHS.find(([p]) => p === path);
    return hit ? hit[1] : "OnlyChat";
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
    if (path === "/perfil" || path.startsWith("/perfil")) {
      pageCache.delete("/perfil");
      bindTestNotify(main);
    }
    if (path === "/") {
      bindPeriodTabs(main);
      bindSharkCharts(main);
      bindDashCardGlow(main);
      refreshLive(true);
    }
    syncTopbarFromProfilePreview();
  }

  function resolveAvatarSrc(preview, cached, serverSrc, apiAvatar) {
    const cachedData = cached.indexOf("data:") === 0 ? cached : "";
    if (preview) return preview;
    if (cachedData) return cachedData;
    if (serverSrc && serverSrc.indexOf("data:") === 0) return serverSrc;
    if (serverSrc && serverSrc.indexOf("/uploads/") === 0) return serverSrc;
    if (serverSrc && serverSrc.indexOf("http") === 0) return serverSrc;
    if (apiAvatar) return "/api/panel/avatar";
    return serverSrc || "";
  }

  function hydrateAvatarSlot(slot, src, initials) {
    if (!slot) return;
    let img = slot.querySelector(".user-avatar-img");
    let fb = slot.querySelector(".user-avatar-fallback");
    if (!fb) {
      fb = document.createElement("div");
      fb.className = "user-avatar user-avatar-fallback";
      slot.appendChild(fb);
    }
    fb.textContent = initials;
    if (!img) {
      img = document.createElement("img");
      img.className = "user-avatar-img";
      img.alt = "";
      slot.insertBefore(img, fb);
    }
    const preview = sessionStorage.getItem(LS_AVATAR_PREVIEW) || "";
    const cached = localStorage.getItem(LS_AVATAR) || "";
    const apiAvatar = slot.getAttribute("data-avatar-api") === "1";
    const dataSrc = img.getAttribute("data-avatar-src") || "";
    const trySrc = resolveAvatarSrc(preview, cached, src || dataSrc, apiAvatar);
    if (!trySrc) {
      img.hidden = true;
      fb.classList.remove("user-avatar-fallback--hidden");
      return;
    }
    img.hidden = true;
    fb.classList.remove("user-avatar-fallback--hidden");
    img.onload = function () {
      img.hidden = false;
      fb.classList.add("user-avatar-fallback--hidden");
    };
    img.onerror = function () {
      img.hidden = true;
      fb.classList.remove("user-avatar-fallback--hidden");
      if (preview && img.src !== preview) {
        img.src = preview;
        return;
      }
      const cachedData = (localStorage.getItem(LS_AVATAR) || "").indexOf("data:") === 0
        ? localStorage.getItem(LS_AVATAR)
        : "";
      if (cachedData && img.src !== cachedData) {
        img.src = cachedData;
        return;
      }
      if (apiAvatar && img.src.indexOf("/api/panel/avatar") >= 0) {
        const prof = document.getElementById("profile-avatar-preview");
        if (prof && prof.src && prof.style.display !== "none") {
          img.src = prof.src;
        }
      }
    };
    if (trySrc.indexOf("data:") === 0) {
      img.src = trySrc;
    } else if (trySrc.indexOf("/api/panel/avatar") === 0) {
      img.src = trySrc.split("?")[0] + "?v=" + Date.now();
    } else {
      img.src = trySrc.split("?")[0] + "?v=" + Date.now();
    }
  }

  function syncTopbarFromProfilePreview() {
    const preview = sessionStorage.getItem(LS_AVATAR_PREVIEW) || "";
    const profileImg = document.getElementById("profile-avatar-preview");
    const profileSrc =
      profileImg && profileImg.style.display !== "none" && profileImg.src
        ? profileImg.src
        : "";
    const src = profileSrc || preview;
    if (!src) return;
    const pill = document.getElementById("panel-user-pill");
    if (!pill) return;
    const label = (pill && pill.dataset.userLabel) || (document.getElementById("panel-user-name") || {}).textContent || "KA";
    const slot = pill.querySelector(".user-avatar-slot");
    hydrateAvatarSlot(slot, src, label.slice(0, 2).toUpperCase());
  }

  function bindPeriodTabs(root) {
    const scope = root || document;
    scope.querySelectorAll("[data-period-tabs] .shark-period-tab").forEach((btn) => {
      if (btn.dataset.bound) return;
      btn.dataset.bound = "1";
      const p = btn.getAttribute("data-period");
      if (p === dashPeriod) {
        btn.classList.add("shark-period-tab--active");
      }
      btn.addEventListener("click", () => {
        const period = btn.getAttribute("data-period");
        if (!period) return;
        dashPeriod = period;
        localStorage.setItem(LS_DASH_PERIOD, period);
        scope.querySelectorAll("[data-period-tabs] .shark-period-tab").forEach((t) => {
          t.classList.toggle("shark-period-tab--active", t === btn);
        });
        refreshLive(true);
      });
    });
  }

  function bindSharkCharts(root) {
    const scope = root || document;
    scope.querySelectorAll(".shark-perf-chart").forEach((chart) => {
      if (chart.dataset.chartBound === "1") return;
      const points = parseChartPoints(chart);
      const stage = chart.querySelector(".shark-chart-stage");
      const svg = chart.querySelector(".shark-chart-svg");
      const tooltip = chart.querySelector(".shark-chart-tooltip");
      if (!stage || !svg || !tooltip || points.length === 0) return;
      chart.dataset.chartBound = "1";
      const cursor = svg.querySelector(".shark-chart-cursor");
      const hoverLayer = chart.querySelector(".shark-chart-hover-layer");

      const curve = svg.querySelector(".shark-chart-curve");
      if (curve && typeof curve.getTotalLength === "function") {
        try {
          const len = curve.getTotalLength();
          curve.style.setProperty("--chart-path-len", String(len));
        } catch (_) {}
      }

      const vbW = Number(chart.getAttribute("data-chart-w") || 879);
      const vbH = Number(chart.getAttribute("data-chart-h") || 220);

      function showTip(i) {
        const p = points[i];
        if (!p) return;
        const dayEl = tooltip.querySelector(".shark-chart-tooltip-day");
        const valEl = tooltip.querySelector(".shark-chart-tooltip-val");
        const label = p.label || p.short || "";
        if (dayEl) dayEl.textContent = label;
        if (valEl) valEl.textContent = money(p.cents);
        tooltip.removeAttribute("hidden");
        tooltip.style.display = "block";
        stage.classList.add("shark-chart-stage--hover");
        svg.querySelectorAll(".shark-chart-dot").forEach((d) => {
          const active = d.getAttribute("data-idx") === String(i);
          d.setAttribute("r", active ? "6" : "0");
          d.setAttribute("opacity", active ? "1" : "0");
        });
        const cx = p.cx != null ? String(p.cx) : null;
        const cy = p.cy != null ? String(p.cy) : null;
        const dot = svg.querySelector('.shark-chart-dot[data-idx="' + i + '"]');
        const lineX = cx || (dot && dot.getAttribute("cx"));
        if (cursor && lineX) {
          cursor.setAttribute("x1", lineX);
          cursor.setAttribute("x2", lineX);
          cursor.setAttribute("opacity", "1");
        }
        const stageRect = stage.getBoundingClientRect();
        const px = Number(lineX || 0);
        const py = Number(cy || (dot && dot.getAttribute("cy")) || 0);
        const left = (px / vbW) * stageRect.width - 74;
        const top = Math.max(4, (py / vbH) * stageRect.height - 58);
        tooltip.style.left = Math.min(Math.max(left, 6), stageRect.width - 160) + "px";
        tooltip.style.top = top + "px";
      }

      function hideTip() {
        tooltip.setAttribute("hidden", "");
        tooltip.style.display = "none";
        stage.classList.remove("shark-chart-stage--hover");
        if (cursor) cursor.setAttribute("opacity", "0");
        svg.querySelectorAll(".shark-chart-dot").forEach((d) => {
          d.setAttribute("r", "0");
          d.setAttribute("opacity", "0");
        });
      }

      function pickIdx(clientX) {
        const rect = (hoverLayer || stage).getBoundingClientRect();
        const rel = Math.max(0, Math.min(points.length - 1, Math.round(((clientX - rect.left) / rect.width) * (points.length - 1))));
        return rel;
      }

      function bindPointer(el) {
        el.addEventListener("mousemove", (e) => showTip(pickIdx(e.clientX)));
        el.addEventListener("touchstart", (e) => {
          if (e.touches[0]) showTip(pickIdx(e.touches[0].clientX));
        }, { passive: true });
        el.addEventListener("touchmove", (e) => {
          if (e.touches[0]) showTip(pickIdx(e.touches[0].clientX));
        }, { passive: true });
      }

      if (hoverLayer) {
        hoverLayer.querySelectorAll(".shark-chart-col").forEach((col) => {
          const idx = Number(col.getAttribute("data-idx"));
          col.addEventListener("mouseenter", () => showTip(idx));
          col.addEventListener("mousemove", () => showTip(idx));
        });
        bindPointer(hoverLayer);
      } else {
        bindPointer(stage);
      }
      stage.addEventListener("mouseleave", hideTip);
      stage.addEventListener("touchend", hideTip);
    });
  }

  async function refreshUserPill() {
    try {
      const res = await fetch("/api/panel/me", { credentials: "same-origin" });
      if (!res.ok) return;
      const me = await res.json();
      const pill = document.getElementById("panel-user-pill");
      if (!pill) return;
      const label = me.label || me.email || "Conta";
      pill.dataset.userLabel = label;
      const prev = localStorage.getItem(LS_AVATAR) || "";
      const next = me.avatarUrl || "";
      if (next !== prev) {
        localStorage.setItem(LS_AVATAR, next);
        pageCache.delete("/");
        pageCache.delete("/perfil");
      }
      pill.dataset.avatar = next;
      const initials = label.slice(0, 2).toUpperCase();
      if (me.notificationPrefs) saveNotifyPrefs(me.notificationPrefs);
      const preview = sessionStorage.getItem(LS_AVATAR_PREVIEW) || "";
      const cached = localStorage.getItem(LS_AVATAR) || "";
      const avatarSrc = resolveAvatarSrc(preview, cached, next, true);
      if (next.indexOf("data:") === 0) localStorage.setItem(LS_AVATAR, next);
      let slot = pill.querySelector(".user-avatar-slot");
      if (!slot) {
        pill.querySelectorAll(".user-avatar, .user-avatar-img, .user-avatar-slot").forEach((el) => el.remove());
        slot = document.createElement("span");
        slot.className = "user-avatar-slot";
        slot.setAttribute("data-avatar-api", "1");
        pill.insertBefore(slot, pill.firstChild);
      }
      hydrateAvatarSlot(slot, avatarSrc, initials);
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

  window.addEventListener("panel-sync-avatar", function (e) {
    const src = e.detail && e.detail.src;
    if (!src) return;
    const pill = document.getElementById("panel-user-pill");
    if (!pill) return;
    const label = (pill && pill.dataset.userLabel) || (document.getElementById("panel-user-name") || {}).textContent || "KA";
    const slot = pill.querySelector(".user-avatar-slot");
    if (src.indexOf("data:") === 0) {
      sessionStorage.setItem(LS_AVATAR_PREVIEW, src);
      localStorage.setItem(LS_AVATAR, src);
    }
    hydrateAvatarSlot(slot, src, label.slice(0, 2).toUpperCase());
  });

  bindForms(document);
  document.querySelectorAll(".user-avatar-slot").forEach((slot) => {
    const pill = slot.closest(".user-pill");
    const img = slot.querySelector(".user-avatar-img");
    const label = (pill && pill.dataset.userLabel) || (document.getElementById("panel-user-name") || {}).textContent || "KA";
    const preview = sessionStorage.getItem(LS_AVATAR_PREVIEW) || "";
    const cached = localStorage.getItem(LS_AVATAR) || "";
    const serverSrc =
      (img && img.getAttribute("data-avatar-src")) ||
      (img && img.getAttribute("src")) ||
      (pill && pill.dataset.avatar) ||
      "";
    const src = resolveAvatarSrc(preview, cached, serverSrc, slot.getAttribute("data-avatar-api") === "1");
    hydrateAvatarSlot(slot, src, label.slice(0, 2).toUpperCase());
  });
  refreshUserPill().then(() => syncTopbarFromProfilePreview());

  const toastRoot = document.getElementById("panel-toasts");
  const salePopupRoot = document.getElementById("sale-popup-root");
  const bellBtn = document.querySelector(".icon-btn.bell-btn");
  const bellBadge = document.querySelector(".bell-badge");
  const bellMenu = document.getElementById("bell-menu");

  const SALE_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>';
  const BELL_ICONS = {
    sale: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    lead: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>',
    receipt: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>',
    wa_down: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h.01"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/><path d="M5 12.859a10 10 0 0 1 5.17-2.69"/><path d="M19 12.859a10 10 0 0 0-2.007-1.523"/><path d="M2 8.82a15 15 0 0 1 4.177-2.643"/><path d="M22 8.82a15 15 0 0 0-11.288-3.764"/><path d="m2 2 20 20"/></svg>',
    wa_up: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h.01"/><path d="M2 8.82a15 15 0 0 1 20 0"/><path d="M5 12.859a10 10 0 0 1 14 0"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/></svg>',
    daily: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>'
  };

  let liveNotificationsReady = false;
  let lastBellItems = [];

  function loadSeenEvents() {
    try {
      return new Set(JSON.parse(localStorage.getItem(LS_SEEN_EVENTS) || "[]"));
    } catch (_) {
      return new Set();
    }
  }

  function saveSeenEvents(set) {
    localStorage.setItem(LS_SEEN_EVENTS, JSON.stringify(Array.from(set).slice(-120)));
  }

  function loadExtraBell() {
    try {
      return JSON.parse(localStorage.getItem(LS_EXTRA_BELL) || "[]");
    } catch (_) {
      return [];
    }
  }

  function saveExtraBell(items) {
    localStorage.setItem(LS_EXTRA_BELL, JSON.stringify(items.slice(0, 24)));
  }

  function waConnected(status) {
    return status === "connected" || status === "meta_ready";
  }

  function pushBellBadge() {
    if (bellBadge) {
      bellBadge.style.display = "flex";
      bellBadge.textContent = "!";
    }
  }

  function showToast(title, body, kind) {
    if (!canNotify(kind || "sale")) return;
    if (!toastRoot) return;
    const el = document.createElement("div");
    el.className = "panel-toast" + (kind ? " panel-toast--" + kind : "");
    el.innerHTML = '<strong>' + title + '</strong><span>' + body + '</span><button type="button" aria-label="Fechar">×</button>';
    toastRoot.appendChild(el);
    el.querySelector("button").addEventListener("click", () => el.remove());
    setTimeout(() => el.classList.add("show"), 10);
    setTimeout(() => { el.classList.remove("show"); setTimeout(() => el.remove(), 400); }, 8000);
    pushBellBadge();
  }

  function desktopNotify(title, body, kind) {
    if (!canDesktopNotify() || !canNotify(kind || "sale")) return;
    pushSystemNotify(title, body, kind || "alert", "/");
  }

  function dismissSalePopup(el) {
    if (!el) return;
    el.classList.remove("show");
    el.classList.add("leaving");
    setTimeout(() => el.remove(), 450);
  }

  function showSalePopup(sale) {
    if (!salePopupRoot || !sale || !canNotify("sale")) return;
    const amount = sale.amountCents != null
      ? money(Number(sale.amountCents))
      : (sale.amount || "");
    const subtitle = sale.subtitle || sale.productName || "Nova venda confirmada";
    const el = document.createElement("div");
    el.className = "sale-popup";
    el.innerHTML =
      '<div class="sale-popup-glow" aria-hidden="true"></div>' +
      '<div class="sale-popup-icon" aria-hidden="true">' + SALE_ICON + '</div>' +
      '<div class="sale-popup-body">' +
        '<div class="sale-popup-title">Venda confirmada!</div>' +
        '<div class="sale-popup-amount">' + amount + '</div>' +
        '<div class="sale-popup-sub">' + subtitle + '</div>' +
      '</div>' +
      '<button type="button" class="sale-popup-close" aria-label="Fechar">×</button>';
    salePopupRoot.querySelectorAll(".sale-popup").forEach((p) => dismissSalePopup(p));
    salePopupRoot.appendChild(el);
    el.querySelector(".sale-popup-close").addEventListener("click", () => dismissSalePopup(el));
    setTimeout(() => el.classList.add("show"), 16);
    setTimeout(() => dismissSalePopup(el), 7000);
    showToast("Venda confirmada!", subtitle, "sale");
    desktopNotify("Venda confirmada!", amount + " · " + subtitle, "sale");
  }

  function handleLatestSale(latest) {
    if (!latest || !latest.id) return;
    const prev = localStorage.getItem(LS_LAST_SALE);
    if (prev !== latest.id) {
      if (prev) {
        showSalePopup(latest);
        if (bellBadge) {
          bellBadge.style.display = "flex";
          bellBadge.textContent = "!";
        }
      }
      localStorage.setItem(LS_LAST_SALE, latest.id);
    }
  }

  async function checkNewSales() {
    try {
      const res = await fetch("/api/panel/sale-ping", { credentials: "same-origin" });
      if (!res.ok) return;
      const data = await res.json();
      handleLatestSale(data.latestSale);
      const bellSeen = Number(sessionStorage.getItem(LS_BELL_SEEN) || 0);
      if (data.latestSaleAt && new Date(data.latestSaleAt).getTime() > bellSeen && bellBadge) {
        bellBadge.style.display = "flex";
        bellBadge.textContent = "!";
      }
    } catch (_) {}
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

  if (Notification && Notification.permission === "default" && canDesktopNotify()) {
    ensureServiceWorker().then(() => Notification.requestPermission().catch(() => {}));
  }

  function updateBellMenu(items) {
    if (!bellMenu) return;
    const merged = (items || []).slice(0, 12);
    if (merged.length === 0) {
      bellMenu.innerHTML = '<div class="bell-empty">Nenhuma notificação ainda</div>';
      return;
    }
    bellMenu.innerHTML = merged.map((s) => {
      const kind = s.kind || "sale";
      const icon = BELL_ICONS[kind] || BELL_ICONS.sale;
      return '<div class="bell-item bell-item--' + kind + '">' +
        '<span class="bell-item-icon" aria-hidden="true">' + icon + '</span>' +
        '<div class="bell-item-body">' +
          '<strong>' + s.title + '</strong>' +
          '<span>' + s.subtitle + '</span>' +
          '<time>' + (s.time || "") + '</time>' +
        '</div>' +
      '</div>';
    }).join("");
  }

  function prependExtraBell(item) {
    const extra = loadExtraBell();
    extra.unshift(item);
    saveExtraBell(extra.slice(0, 24));
    updateBellMenu(extra.concat(lastBellItems).slice(0, 12));
  }

  function processLiveNotifications(data) {
    if (!data) return;
    const seen = loadSeenEvents();
    const extra = loadExtraBell();

    if (data.bellItems) {
      for (const item of data.bellItems) {
        if (!item || !item.id) continue;
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        if (liveNotificationsReady && item.kind === "lead" && canNotify("lead")) {
          showToast("Nova conversa", item.subtitle, "lead");
          desktopNotify("Nova conversa", item.subtitle, "lead");
        }
      }
      lastBellItems = data.bellItems;
      updateBellMenu(extra.concat(data.bellItems).slice(0, 12));
    } else if (data.bellSales) {
      lastBellItems = data.bellSales.map((s) => Object.assign({ kind: "sale" }, s));
      updateBellMenu(extra.concat(lastBellItems).slice(0, 12));
    }

    if (data.waStatuses && data.botNames) {
      let prev = {};
      try { prev = JSON.parse(localStorage.getItem(LS_WA_STATUS) || "{}"); } catch (_) {}
      Object.keys(data.waStatuses).forEach((id) => {
        const st = data.waStatuses[id];
        const was = prev[id];
        const name = data.botNames[id] || "Instância";
        const eventKey = "wa-" + id + "-" + st;
        if (liveNotificationsReady && was !== undefined && was !== st) {
          if (waConnected(was) && !waConnected(st) && canNotify("wa_down")) {
            if (!seen.has(eventKey)) {
              showToast("Instância caiu", name + " desconectou", "wa_down");
              desktopNotify("Instância offline", name + " desconectou", "wa_down");
              prependExtraBell({
                id: eventKey,
                kind: "wa_down",
                title: "Instância offline",
                subtitle: name + " desconectou",
                time: "agora"
              });
              seen.add(eventKey);
            }
          } else if (!waConnected(was) && waConnected(st) && canNotify("wa_up")) {
            showToast("Instância online", name + " reconectou", "wa_up");
            prependExtraBell({
              id: "wa-up-" + id + "-" + Date.now(),
              kind: "wa_up",
              title: "Instância online",
              subtitle: name + " reconectou",
              time: "agora"
            });
          }
        }
      });
      localStorage.setItem(LS_WA_STATUS, JSON.stringify(data.waStatuses));
    }

    if (liveNotificationsReady && data.todayStats) {
      const day = new Date().toDateString();
      const hour = new Date().getHours();
      if (hour >= 22 && localStorage.getItem(LS_DAILY_SUMMARY) !== day) {
        const total = money(data.todayStats.salesTotalCents || 0);
        const count = data.todayStats.salesCount || 0;
        const summaryKey = "daily-" + day;
        if (!seen.has(summaryKey) && canNotify("daily")) {
          showToast("Faturamento do dia", total + " · " + count + " venda(s)", "daily");
          desktopNotify("Faturamento do dia", total + " · " + count + " venda(s)", "daily");
          prependExtraBell({
            id: summaryKey,
            kind: "daily",
            title: "Faturamento do dia",
            subtitle: total + " · " + count + " venda(s)",
            time: "hoje"
          });
          seen.add(summaryKey);
          localStorage.setItem(LS_DAILY_SUMMARY, day);
        }
      }
    }

    saveSeenEvents(seen);
    if (!liveNotificationsReady) liveNotificationsReady = true;
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
        if (key === "ticketMedio") {
          el.textContent = stats.ticketMedioCents > 0 ? money(stats.ticketMedioCents) : "R$ 0,00";
        }
        if (key === "fatPct") el.textContent = (stats.fatProgress || 0) + "%";
        if (key === "fatBar") el.style.width = (stats.fatProgress || 0) + "%";
      });
      document.querySelectorAll(".shark-kpi-foot span:last-child").forEach((el) => {
        if (el.closest(".shark-kpi-card") && el.textContent && el.textContent.includes("Aprov")) {
          const pct = stats.leads > 0 ? Math.round((stats.salesCount / stats.leads) * 100) : 0;
          el.textContent = pct + "% Aprov.";
        }
      });
      document.querySelectorAll(".shark-mini-bar span").forEach((el) => {
        const pct = stats.leads > 0 ? Math.round((stats.salesCount / stats.leads) * 100) : 0;
        el.style.width = pct + "%";
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
    const instances = document.querySelector("[data-live=instances-card]");
    if (instances && data.instancesHtml) instances.innerHTML = data.instancesHtml;
    const top = document.querySelector("[data-live=top-bots]");
    if (top && data.topBotsHtml) top.innerHTML = data.topBotsHtml;
    const topPlayers = document.querySelector("[data-live=top-players]");
    if (topPlayers && data.topPlayersHtml) topPlayers.innerHTML = data.topPlayersHtml;
    const chart = document.querySelector("[data-live=sales-chart]");
    if (chart && data.chartSvg) {
      const fp = data.chartFingerprint || data.chartSvg;
      if (chart.getAttribute("data-chart-fp") !== fp) {
        chart.innerHTML = data.chartSvg;
        chart.setAttribute("data-chart-fp", fp);
        bindSharkCharts(chart);
        window.dispatchEvent(new Event("shark-charts-refresh"));
      }
    }
    const periodLbl = document.querySelector("[data-live=chart-period-label]");
    if (periodLbl && data.periodLabel) {
      periodLbl.textContent = String(data.periodLabel).toLowerCase();
    }
    const convGauge = document.querySelector("[data-live=conv-gauge]");
    if (convGauge && data.convGaugeHtml) convGauge.innerHTML = data.convGaugeHtml;
    const msgChart = document.querySelector("[data-live=messages-chart]");
    if (msgChart && data.messagesChartSvg) msgChart.innerHTML = data.messagesChartSvg;
    const sparkSales = document.querySelector("[data-live=spark-sales]");
    if (sparkSales && data.sparkSalesHtml) sparkSales.innerHTML = data.sparkSalesHtml;
    const sparkMessages = document.querySelector("[data-live=spark-messages]");
    if (sparkMessages && data.sparkMessagesHtml) sparkMessages.innerHTML = data.sparkMessagesHtml;
    processLiveNotifications(data);
  }

  async function refreshLive(silent) {
    if (location.pathname !== "/") return;
    try {
      const res = await fetch("/api/panel/live?period=" + encodeURIComponent(dashPeriod), {
        credentials: "same-origin"
      });
      if (!res.ok) return;
      const data = await res.json();
      applyLive(data);
    } catch (_) {
      if (!silent) console.warn("live refresh failed");
    }
  }

  function bindDashCardGlow(root) {
    const scope = root || document;
    scope.querySelectorAll(".shark-dash .dash-glow-card:not(.shark-fat-pill--topbar)").forEach((card) => {
      if (card.dataset.glowBound) return;
      card.dataset.glowBound = "1";
      if (!card.querySelector(".shark-edge-glow")) {
        const ring = document.createElement("div");
        ring.className = "shark-edge-glow";
        ring.setAttribute("aria-hidden", "true");
        ring.innerHTML =
          '<span class="shark-edge-glow--t"></span>' +
          '<span class="shark-edge-glow--r"></span>' +
          '<span class="shark-edge-glow--b"></span>' +
          '<span class="shark-edge-glow--l"></span>';
        card.insertBefore(ring, card.firstChild);
      }
      if (!card.querySelector(".dash-mouse-glow")) {
        const spot = document.createElement("div");
        spot.className = "dash-mouse-glow";
        spot.setAttribute("aria-hidden", "true");
        card.insertBefore(spot, card.firstChild);
        card.addEventListener("mousemove", (e) => {
          const rect = card.getBoundingClientRect();
          spot.style.setProperty("--mx", (e.clientX - rect.left) + "px");
          spot.style.setProperty("--my", (e.clientY - rect.top) + "px");
        });
      }
    });
  }

  ensureServiceWorker();
  bindTestNotify(document);
  if (location.pathname === "/") {
    bindPeriodTabs(document);
    bindSharkCharts(document);
    bindDashCardGlow(document);
    requestAnimationFrame(function () { bindSharkCharts(document); });
    setTimeout(function () { bindSharkCharts(document); }, 400);
    refreshLive(true);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) refreshLive(true);
    });
  }
  checkNewSales();
  setInterval(() => {
    if (document.hidden) return;
    checkNewSales();
    if (location.pathname !== "/") return;
    refreshLive(true);
  }, 1500);

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

  function bindGlobalSearch() {}
  bindGlobalSearch();
})();
</script>`;
