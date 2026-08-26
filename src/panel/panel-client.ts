/** Client-side navigation, live updates and sale notifications for the panel. */
export const panelClientScript = `
<script>
(function () {
  const main = document.querySelector(".content");
  if (!main) return;

  const NAV_PATHS = [
    ["/", "Dashboard"],
    ["/instances", "Instâncias"],
    ["/maturador", "Maturador"],
    ["/links", "Gerar links"],
    ["/leads", "Leads"],
    ["/remarketing", "Remarketing"],
    ["/gifts", "Pedir presentes"],
    ["/payments", "Pagamentos"],
    ["/products", "Produtos"],
    ["/media", "Mídias"],
    ["/admin/usuarios", "Admin"],
    ["/perfil", "Minha conta"],
    ["/instances/new", "Nova Instância"]
  ];

  const LS_LAST_SALE = "panelLastSaleId";
  const LS_SALE_INIT = "panelSaleInitDone";
  const LS_BELL_SEEN = "panelBellSeenAt";
  const LS_BELL_CLEARED = "panelBellClearedAt";
  const LS_AVATAR = "panelAvatarUrl";
  const LS_AVATAR_PREVIEW = "panelAvatarPreview";
  const LS_DASH_PERIOD = "dashPeriod";
  const LS_EXTRA_BELL = "panelExtraBellItems";
  const LS_WA_STATUS = "panelWaStatusMap";
  const LS_SEEN_EVENTS = "panelSeenEventIds";
  const LS_DAILY_SUMMARY = "panelDailySummaryDate";
  const LS_NOTIFY_PREFS = "panelNotifyPrefs";
  let memoryExtraBell = [];
  let lastBellItems = [];
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
      swRegisterPromise = navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => null);
    }
    return swRegisterPromise;
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(base64);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  async function ensurePushSubscription() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null;
    const reg = await ensureServiceWorker();
    if (!reg) return null;
    const keyRes = await fetch("/api/push/vapid-public-key", { credentials: "same-origin" });
    if (!keyRes.ok) return null;
    const keyData = await keyRes.json();
    if (!keyData.configured || !keyData.publicKey) return null;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyData.publicKey)
      });
    }
    const json = sub.toJSON();
    await fetch("/api/push/subscribe", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth }
      })
    });
    return sub;
  }

  async function pushSystemNotify(title, body, tag, url) {
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        await Notification.requestPermission();
      }
      const reg = await ensureServiceWorker();
      if (reg && Notification.permission === "granted") {
        // Mesmo padrão do instablack: SVG compacto em icon + badge.
        await reg.showNotification(title, {
          body: body,
          icon: "/brand/pwa-192.png?v=1.24.15",
          badge: "/brand/pwa-192.png?v=1.24.15",
          tag: (tag || "onlychat") + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
          renotify: true,
          data: { url: url || "/" },
          vibrate: [120, 60, 120]
        });
        return true;
      }
    } catch (_) {}
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      try {
        new Notification(title, { body: body, icon: "/brand/pwa-192.png?v=1.24.15" });
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
        await ensureServiceWorker();
        let pushResult = null;
        try {
          await ensurePushSubscription();
          const res = await fetch("/api/push/test", { method: "POST", credentials: "same-origin" });
          pushResult = await res.json();
        } catch (_) {}
        const localOk = await pushSystemNotify(
          "OnlyChat — teste OK",
          "Notificações no celular funcionando!",
          "onlychat-test",
          "/perfil"
        );
        if (pushResult && pushResult.ok && pushResult.sent > 0) {
          showToast("Push enviado!", "Verifique a bandeja do celular (" + pushResult.sent + " dispositivo(s)).", "sale", true);
        } else if (pushResult && !pushResult.ok && pushResult.error) {
          showToast("Push: " + pushResult.error, localOk ? "Notificação local OK." : "Instale o app e aceite notificações.", "daily", true);
        } else if (pushResult && pushResult.ok && pushResult.sent === 0) {
          showToast("Nenhum dispositivo", "Instale o app na tela inicial e aceite notificações, depois teste de novo.", "daily", true);
        } else if (localOk) {
          showToast("Notificação local OK", "Para push com app fechado, instale o app (Perfil) e aceite notificações.", "daily", true);
        } else if (Notification && Notification.permission === "denied") {
          showToast("Permissão bloqueada", "Ative notificações nas configurações do navegador/celular.", "daily", true);
        } else {
          showToast("Teste parcial", "Ative notificações do navegador e instale o app na tela inicial.", "daily", true);
        }
      } finally {
        btn.disabled = false;
        btn.textContent = prev;
      }
    });
  }

  let deferredPwaPrompt = null;
  function bindPwaInstall(root) {
    const scope = root || document;
    for (const btn of scope.querySelectorAll("#btn-pwa-install-profile")) {
      if (!btn || btn.dataset.bound) continue;
      btn.dataset.bound = "1";
      btn.addEventListener("click", async function () {
        if (deferredPwaPrompt) {
          deferredPwaPrompt.prompt();
          await deferredPwaPrompt.userChoice;
          deferredPwaPrompt = null;
          return;
        }
        showToast("Instalar app", "Chrome: menu ⋮ → Instalar app / Adicionar à tela inicial.", "daily", true);
      });
    }
  }

  function bindAudioReplace(root) {
    const scope = root || document;
    scope.querySelectorAll("[data-audio-replace]").forEach(function (input) {
      if (input.dataset.bound) return;
      input.dataset.bound = "1";
      input.addEventListener("change", function () {
        const card = input.closest("[data-audio-card]");
        if (!card) return;
        const file = input.files && input.files[0];
        const nameEl = card.querySelector("[data-audio-replace-name]");
        const player = card.querySelector("[data-audio-player]");
        if (!file) return;
        if (nameEl) {
          nameEl.style.display = "block";
          nameEl.textContent = "Novo arquivo: " + file.name + " (salve a instância para aplicar)";
        }
        if (player) {
          try {
            const url = URL.createObjectURL(file);
            player.src = url;
            player.load();
          } catch (_) {}
        }
      });
    });
  }

  function bindCallLinkGenerator(root) {
    const scope = root || document;
    const box = scope.querySelector("[data-call-link-box]");
    if (!box || box.dataset.bound) return;
    box.dataset.bound = "1";
    const out = scope.querySelector("#call-link-output") || document.getElementById("call-link-output");
    const genBtn = scope.querySelector("#btn-generate-call-link") || document.getElementById("btn-generate-call-link");
    const copyBtn = scope.querySelector("#btn-copy-call-link") || document.getElementById("btn-copy-call-link");
    const openBtn = scope.querySelector("#btn-open-call-link") || document.getElementById("btn-open-call-link");
    const linkField = scope.querySelector("#videoCallLink") || document.getElementById("videoCallLink");
    if (!genBtn || !out) return;

    function setLink(url) {
      out.value = url || "";
      if (openBtn) {
        if (url) {
          openBtn.href = url;
          openBtn.style.display = "inline-flex";
        } else {
          openBtn.style.display = "none";
        }
      }
      if (linkField && url) linkField.value = url;
    }

    async function uploadSelectedVideo() {
      const fileInput = scope.querySelector('input[name="callVideoFile"]') || document.getElementById("callVideoFile");
      const file = fileInput && fileInput.files && fileInput.files[0];
      if (!file) return box.getAttribute("data-saved-video") || "";
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/panel/call-video-upload", {
        method: "POST",
        credentials: "same-origin",
        body: fd
      });
      const data = await res.json();
      if (!res.ok || !data.ok || !data.videoUrl) {
        throw new Error(data.error || "Falha no upload do vídeo");
      }
      box.setAttribute("data-saved-video", data.videoUrl);
      box.setAttribute("data-has-video", "1");
      return data.videoUrl;
    }

    async function uploadSelectedAvatar() {
      const fileInput = scope.querySelector('input[name="callAvatarFile"]') || document.getElementById("callAvatarFile");
      const hidden = scope.querySelector('input[name="videoCallAvatarUrl"]') || document.getElementById("videoCallAvatarUrl");
      const file = fileInput && fileInput.files && fileInput.files[0];
      if (!file) {
        return (hidden && hidden.value) || box.getAttribute("data-saved-avatar") || "";
      }
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/panel/call-avatar-upload", {
        method: "POST",
        credentials: "same-origin",
        body: fd
      });
      const data = await res.json();
      if (!res.ok || !data.ok || !data.avatarUrl) {
        throw new Error(data.error || "Falha no upload da foto");
      }
      box.setAttribute("data-saved-avatar", data.avatarUrl);
      if (hidden) hidden.value = data.avatarUrl;
      return data.avatarUrl;
    }

    genBtn.addEventListener("click", async function () {
      genBtn.disabled = true;
      const prev = genBtn.textContent;
      let elapsed = 0;
      genBtn.textContent = "Gerando... 0s";
      const timer = setInterval(function () {
        elapsed += 1;
        genBtn.textContent = "Gerando... " + elapsed + "s";
      }, 1000);
      try {
        const botId = box.getAttribute("data-bot-id") || "";
        const caller = (document.querySelector('input[name="videoCallCallerName"]') || {}).value || "";
        const locale = (document.querySelector('select[name="locale"]') || {}).value || "pt-BR";
        let videoUrl = "";
        let avatarUrl = "";
        showToast("Gerando link", "Enviando mídia e montando a chamada...", "daily", true);
        try {
          avatarUrl = await uploadSelectedAvatar();
        } catch (err) {
          showToast("Foto", err.message || "Falha ao enviar a foto de perfil.", "daily", true);
          return;
        }
        try {
          videoUrl = await uploadSelectedVideo();
        } catch (err) {
          showToast("Vídeo", err.message || "Selecione o MP4 da chamada.", "daily", true);
          return;
        }
        if (!videoUrl && !botId) {
          showToast("Selecione o MP4", "Escolha o vídeo da chamada e clique em Gerar link.", "daily", true);
          return;
        }
        const res = await fetch("/api/panel/call-preview", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            botId: botId || undefined,
            callerName: caller,
            locale: locale,
            videoUrl: videoUrl || undefined,
            avatarUrl: avatarUrl || undefined
          })
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          showToast("Não gerou", data.error || "Selecione o MP4 e tente de novo.", "daily", true);
          return;
        }
        setLink(data.url);
        showToast("Link pronto! (" + elapsed + "s)", "Copie e abra no celular para testar a chamada.", "sale", true);
      } catch (_) {
        showToast("Erro", "Falha ao gerar o link da chamada.", "daily", true);
      } finally {
        clearInterval(timer);
        genBtn.disabled = false;
        genBtn.textContent = prev;
      }
    });

    if (copyBtn) {
      copyBtn.addEventListener("click", async function () {
        const url = out.value.trim();
        if (!url) {
          showToast("Sem link", "Gere o link primeiro.", "daily", true);
          return;
        }
        try {
          await navigator.clipboard.writeText(url);
          showToast("Copiado!", url, "sale", true);
        } catch (_) {
          out.select();
          document.execCommand("copy");
          showToast("Copiado!", url, "sale", true);
        }
      });
    }

    if (out.value) setLink(out.value);
  }
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredPwaPrompt = e;
    const btn = document.getElementById("btn-pwa-install-profile");
    if (btn) btn.textContent = "Instalar app agora";
  });
  let dashPeriod = localStorage.getItem(LS_DASH_PERIOD) || "hoje";
  const pageCache = new Map();
  let navigating = false;
  let fetchCtrl = null;
  const progress = document.getElementById("panel-nav-progress");

  function bindWaInstanceForm(root) {
    const scope = root || document;
    const marker = scope.querySelector("[data-wa-form-init]");
    if (!marker || marker.dataset.waBound) return;
    marker.dataset.waBound = "1";

    const proxySel = scope.querySelector("#proxy-enabled");
    const proxyBlock = scope.querySelector("#proxy-fields-block");
    const platformSel = scope.querySelector("#bot-platform-select");
    const waBlocks = scope.querySelector("#wa-platform-blocks");
    const tgBlocks = scope.querySelector("#tg-platform-blocks");

    function syncPlatform() {
      const isTg = platformSel && platformSel.value === "telegram";
      if (waBlocks) waBlocks.style.display = isTg ? "none" : "";
      if (tgBlocks) tgBlocks.style.display = isTg ? "" : "none";
    }
    if (platformSel) {
      platformSel.addEventListener("change", syncPlatform);
      syncPlatform();
    } else if (tgBlocks) {
      tgBlocks.style.display = "none";
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
    if (proxySel) { proxySel.addEventListener("change", syncProxy); syncProxy(); }
  }

  function runInlineScripts(root) {
    if (!root || root === document) return;
    root.querySelectorAll("script:not([src]):not([data-inline-ran])").forEach(function (old) {
      if (!old.textContent || !old.textContent.trim()) return;
      if (old.type && (old.type.indexOf("json") >= 0 || old.type.indexOf("ld+json") >= 0)) return;
      var s = document.createElement("script");
      if (old.type) s.type = old.type;
      s.textContent = old.textContent;
      s.setAttribute("data-inline-ran", "1");
      try { old.parentNode.replaceChild(s, old); } catch (_) {}
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
    if (s.length > 1 && s.endsWith("/")) return s.slice(0, -1);
    return s;
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
    document.querySelectorAll(".mobile-tab[data-nav]").forEach((a) => {
      const href = normPath(a.getAttribute("href") || "");
      let active = href === current;
      if (!active && current.startsWith("/instances") && href === "/instances" && current !== "/instances/new") {
        active = true;
      }
      a.classList.toggle("active", active);
    });
    document.querySelectorAll(".mobile-menu-link[data-nav]").forEach((a) => {
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

  function syncDashboardTopbar(root) {
    const scope = root || document;
    const sync = scope.querySelector("#dash-topbar-sync");
    const topbar = document.querySelector(".topbar");
    if (!topbar) return;
    const left = topbar.querySelector(".topbar-left");
    let center = topbar.querySelector(".topbar-center");
    if (!sync) {
      topbar.classList.remove("topbar--dash");
      if (left) left.innerHTML = "";
      if (center) center.innerHTML = "";
      return;
    }
    topbar.classList.add("topbar--dash");
    const leftSrc = sync.querySelector("[data-topbar-left]");
    const centerSrc = sync.querySelector("[data-topbar-center]");
    if (left && leftSrc) left.innerHTML = leftSrc.innerHTML;
    if (centerSrc) {
      const html = centerSrc.innerHTML;
      if (!center) {
        const right = topbar.querySelector(".topbar-right");
        const block = '<div class="topbar-center">' + html + "</div>";
        if (right) right.insertAdjacentHTML("beforebegin", block);
        else topbar.insertAdjacentHTML("beforeend", block);
      } else {
        center.innerHTML = html;
      }
    }
    sync.remove();
  }

  function applyContent(html, path) {
    main.innerHTML = html;
    document.title = "OnlyChat";
    setActiveNav(path);
    syncDashboardTopbar(main);
    bindForms(main);
    bindAudioReplace(main);
    bindCallLinkGenerator(main);
    if (path === "/perfil" || path.startsWith("/perfil")) {
      pageCache.delete("/perfil");
      bindTestNotify(main);
      bindPwaInstall(main);
    }
    if (path === "/") {
      bindPeriodTabs(main);
      bindSharkCharts(main);
      bindDashCardGlow(main);
      refreshLive(true);
    }
    syncTopbarFromProfilePreview();
  }

  const AVATAR_MISSING_MARK = "panelAvatarMissing";
  function resolveAvatarSrc(preview, cached, serverSrc, apiAvatar) {
    const cachedData = cached.indexOf("data:") === 0 ? cached : "";
    if (preview) return preview;
    if (cachedData) return cachedData;
    if (serverSrc && serverSrc.indexOf("data:") === 0) return serverSrc;
    if (serverSrc && serverSrc.indexOf("/uploads/") === 0) return serverSrc;
    if (serverSrc && serverSrc.indexOf("http") === 0) return serverSrc;
    if (apiAvatar && sessionStorage.getItem(AVATAR_MISSING_MARK) !== "1") return "/api/panel/avatar";
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
    img.onerror = function () {
      img.hidden = true;
      fb.classList.remove("user-avatar-fallback--hidden");
      if (apiAvatar && img.src.indexOf("/api/panel/avatar") >= 0) {
        sessionStorage.setItem(AVATAR_MISSING_MARK, "1");
      }
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
    };
    img.onload = function () {
      if (apiAvatar) sessionStorage.removeItem(AVATAR_MISSING_MARK);
      img.hidden = false;
      fb.classList.add("user-avatar-fallback--hidden");
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
      const avatarSrc = resolveAvatarSrc(preview, cached, next, Boolean(next && next.trim()));
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
      document.title = "OnlyChat";
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
  if (location.pathname === "/") {
    const syncOnly = document.querySelector("#dash-topbar-sync");
    if (syncOnly) syncOnly.remove();
  }
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
    const src = resolveAvatarSrc(preview, cached, serverSrc, Boolean(serverSrc && serverSrc.trim()) || slot.getAttribute("data-avatar-api") === "1");
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
      const fromLs = JSON.parse(localStorage.getItem(LS_EXTRA_BELL) || "[]");
      if (Array.isArray(fromLs) && fromLs.length) {
        const cleaned = dedupeBellItems(fromLs);
        memoryExtraBell = cleaned;
        if (cleaned.length !== fromLs.length) {
          try { localStorage.setItem(LS_EXTRA_BELL, JSON.stringify(cleaned)); } catch (_) {}
        }
        return cleaned.slice();
      }
    } catch (_) {}
    return dedupeBellItems(memoryExtraBell).slice();
  }

  function saveExtraBell(items) {
    memoryExtraBell = dedupeBellItems(items || []).slice(0, 24);
    try {
      localStorage.setItem(LS_EXTRA_BELL, JSON.stringify(memoryExtraBell));
    } catch (_) {}
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

  function showToast(title, body, kind, force, skipBell) {
    if (!force && !canNotify(kind || "sale")) return;
    if (!toastRoot) return;
    const el = document.createElement("div");
    el.className = "panel-toast" + (kind ? " panel-toast--" + kind : "");
    el.innerHTML = '<strong>' + title + '</strong><span>' + body + '</span><button type="button" aria-label="Fechar">×</button>';
    toastRoot.appendChild(el);
    el.querySelector("button").addEventListener("click", () => el.remove());
    setTimeout(() => el.classList.add("show"), 10);
    setTimeout(() => { el.classList.remove("show"); setTimeout(() => el.remove(), 400); }, 8000);
    // Toast de UI NÃO entra no sino (evita spam de "Nenhum dispositivo", "Copiado!", etc.).
    // Eventos reais usam prependExtraBell / bellItems do servidor.
    if (skipBell === false) {
      pushBellBadge();
      prependExtraBell({
        id: "toast-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
        kind: kind || "daily",
        title: title,
        subtitle: body || "",
        time: "agora",
        at: new Date().toISOString()
      });
    }
  }

  function isEphemeralBellItem(item) {
    if (!item) return true;
    const id = String(item.id || "");
    if (id.indexOf("toast-") === 0) return true;
    const t = String(item.title || "").trim();
    if (!t) return true;
    if (/^(Nenhum dispositivo|Gerando link|Copiado!|Selecione o MP4|Sem link|Limpo|Instalar app|Notificação local OK|Permissão bloqueada|Teste parcial|Push enviado!|Não gerou|Foto|Vídeo|Erro)$/i.test(t)) {
      return true;
    }
    if (/^Push:/i.test(t) || /^Link pronto!/i.test(t)) return true;
    return false;
  }

  function dedupeBellItems(items) {
    const out = [];
    const seenKey = new Set();
    const seenId = new Set();
    for (const item of items || []) {
      if (!item || isEphemeralBellItem(item)) continue;
      const id = String(item.id || "");
      if (id && seenId.has(id)) continue;
      const key = (String(item.title || "") + "|" + String(item.subtitle || "")).toLowerCase();
      if (seenKey.has(key)) continue;
      if (id) seenId.add(id);
      seenKey.add(key);
      out.push(item);
    }
    return out;
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
    const title = saleNotifyTitle(sale);
    const subtitle = sale.subtitle || sale.productName || "Nova venda confirmada";
    const el = document.createElement("div");
    el.className = "sale-popup";
    el.innerHTML =
      '<div class="sale-popup-glow" aria-hidden="true"></div>' +
      '<div class="sale-popup-icon" aria-hidden="true">' + SALE_ICON + '</div>' +
      '<div class="sale-popup-body">' +
        '<div class="sale-popup-title">' + title + '</div>' +
        '<div class="sale-popup-amount">' + amount + '</div>' +
        '<div class="sale-popup-sub">' + subtitle + '</div>' +
      '</div>' +
      '<button type="button" class="sale-popup-close" aria-label="Fechar">×</button>';
    salePopupRoot.querySelectorAll(".sale-popup").forEach((p) => dismissSalePopup(p));
    salePopupRoot.appendChild(el);
    el.querySelector(".sale-popup-close").addEventListener("click", () => dismissSalePopup(el));
    setTimeout(() => el.classList.add("show"), 16);
    setTimeout(() => dismissSalePopup(el), 7000);
    showToast(title, subtitle, "sale");
    desktopNotify(title, subtitle, "sale");
    if (sale.id) markSaleSeen(sale.id);
  }

  function handleLatestSale(latest) {
    if (!latest || !latest.id) return;
    const prev = localStorage.getItem(LS_LAST_SALE);
    const initDone = sessionStorage.getItem(LS_SALE_INIT);
    if (!initDone) {
      sessionStorage.setItem(LS_SALE_INIT, "1");
      localStorage.setItem(LS_LAST_SALE, latest.id);
      return;
    }
    if (prev !== latest.id) {
      showSalePopup(latest);
      pushBellBadge();
      markSaleSeen(latest.id);
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
    updateBellMenu(loadExtraBell().concat(lastBellItems));
    bellBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const opening = !bellMenu.classList.contains("open");
      bellMenu.classList.toggle("open");
      if (opening) {
        const current = filterBellItems(loadExtraBell().concat(lastBellItems));
        updateBellMenu(current);
        // Sempre atualiza do servidor (PC e celular na mesma conta)
        fetchBellFeed();
      }
    });
    document.addEventListener("click", (e) => {
      if (bellMenu.contains(e.target) || bellBtn.contains(e.target)) return;
      bellMenu.classList.remove("open");
    });
  }

  async function fetchBellFeed() {
    try {
      const res = await fetch("/api/panel/live?period=hoje", { credentials: "same-origin" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.bellItems && data.bellItems.length) {
        const spamOnServer = (data.bellItems || []).filter(isEphemeralBellItem);
        lastBellItems = dedupeBellItems(data.bellItems);
        // Limpa spam antigo gravado no banco (toasts de UI) sem apagar o resto.
        if (spamOnServer.length && spamOnServer.length === data.bellItems.length) {
          fetch("/api/panel/bell", { method: "DELETE", credentials: "same-origin" }).catch(function () {});
          lastBellItems = [];
        }
        const localOnly = loadExtraBell().filter(function (x) {
          return !(lastBellItems || []).some(function (s) { return s && x && s.id === x.id; });
        });
        updateBellMenu(localOnly.concat(lastBellItems).slice(0, 16));
      } else if (data.bellSales && data.bellSales.length) {
        lastBellItems = data.bellSales.map(function (s) { return Object.assign({ kind: "sale" }, s); });
        updateBellMenu(loadExtraBell().concat(lastBellItems).slice(0, 12));
      } else {
        updateBellMenu(loadExtraBell());
      }
    } catch (_) {
      updateBellMenu(loadExtraBell());
    }
  }

  // Carrega sino em qualquer página (não só na dashboard)
  fetchBellFeed();

  if (Notification && Notification.permission === "default" && canDesktopNotify()) {
    ensureServiceWorker().then(() =>
      Notification.requestPermission().then((p) => {
        if (p === "granted") ensurePushSubscription().catch(() => {});
      }).catch(() => {})
    );
  }
  setTimeout(function () {
    if (canDesktopNotify() && typeof Notification !== "undefined" && Notification.permission === "default") {
      ensureServiceWorker().then(() =>
        Notification.requestPermission().then((p) => {
          if (p === "granted") ensurePushSubscription().catch(() => {});
        }).catch(() => {})
      );
    }
  }, 2500);

  function getBellClearedAt() {
    return Number(sessionStorage.getItem(LS_BELL_CLEARED) || 0);
  }

  function filterBellItems(items) {
    const clearedAt = getBellClearedAt();
    if (!clearedAt) return items || [];
    return (items || []).filter(function (s) {
      if (!s || !s.at) return true;
      const t = new Date(s.at).getTime();
      return !t || t > clearedAt;
    });
  }

  function updateBellMenu(items) {
    if (!bellMenu) return;
    const merged = dedupeBellItems(filterBellItems(items || [])).slice(0, 12);
    if (merged.length === 0) {
      bellMenu.innerHTML =
        '<div class="bell-menu-head"><strong>Notificações</strong></div>' +
        '<div class="bell-empty">Nenhuma notificação ainda</div>';
      return;
    }
    const listHtml = merged.map((s) => {
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
    bellMenu.innerHTML =
      '<div class="bell-menu-head">' +
        '<strong>Notificações</strong>' +
        '<button type="button" class="btn btn-secondary btn-sm" id="btn-clear-bell">Limpar</button>' +
      '</div>' +
      listHtml;
    const clearBtn = bellMenu.querySelector("#btn-clear-bell");
    if (clearBtn) {
      clearBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        const now = String(Date.now());
        sessionStorage.setItem(LS_BELL_SEEN, now);
        sessionStorage.setItem(LS_BELL_CLEARED, now);
        localStorage.setItem(LS_EXTRA_BELL, "[]");
        memoryExtraBell = [];
        lastBellItems = [];
        if (bellBadge) bellBadge.style.display = "none";
        updateBellMenu([]);
        fetch("/api/panel/bell", { method: "DELETE", credentials: "same-origin" }).catch(function () {});
        showToast("Limpo", "Notificações do sino removidas.", "daily", true, true);
      });
    }
  }

  function prependExtraBell(item) {
    const extra = loadExtraBell();
    extra.unshift(item);
    saveExtraBell(extra.slice(0, 24));
    updateBellMenu(extra.concat(lastBellItems).slice(0, 12));
    // Persiste no servidor para aparecer no celular (mesma conta)
    fetch("/api/panel/bell", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: item.id,
        kind: item.kind || "daily",
        title: item.title || "",
        subtitle: item.subtitle || ""
      })
    }).catch(function () {});
  }

  function processLiveNotifications(data) {
    if (!data) return;
    const seen = loadSeenEvents();
    const extra = loadExtraBell();

    if (data.bellItems) {
      for (const item of data.bellItems) {
        if (!item || !item.id) continue;
        if (seen.has(item.id)) continue;
        // 1ª carga: só marca como visto (não notifica histórico).
        // Depois: todo evento novo dispara toast + notificação nativa.
        if (!liveNotificationsReady) {
          seen.add(item.id);
          continue;
        }
        seen.add(item.id);
        if (item.kind === "lead" && canNotify("lead")) {
          showToast("Nova conversa", item.subtitle, "lead");
          desktopNotify("Nova conversa", item.subtitle, "lead");
          pushBellBadge();
        }
        if (item.kind === "sale" && canNotify("sale")) {
          const saleId = item.saleId || item.id;
          if (saleId && isSaleAlreadySeen(saleId)) continue;
          const saleTitle = item.amountCents != null
            ? "Venda: " + money(Number(item.amountCents))
            : (item.title || "Venda confirmada!");
          showToast(saleTitle, item.subtitle, "sale");
          desktopNotify(saleTitle, item.subtitle, "sale");
          if (saleId) markSaleSeen(saleId);
          pushBellBadge();
        }
        if (item.kind === "receipt" && canNotify("sale")) {
          showToast("Pagamento confirmado", item.subtitle, "receipt");
          desktopNotify("Pagamento confirmado", item.subtitle, "receipt");
          pushBellBadge();
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
            const upKey = "wa-up-" + id;
            if (!seen.has(upKey)) {
              showToast("Instância online", name + " reconectou", "wa_up");
              prependExtraBell({
                id: upKey,
                kind: "wa_up",
                title: "Instância online",
                subtitle: name + " reconectou",
                time: "agora"
              });
              seen.add(upKey);
            }
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

  function saleNotifyTitle(sale) {
    const cents = sale && sale.amountCents != null ? Number(sale.amountCents) : null;
    if (cents != null && !isNaN(cents)) return "Venda: " + money(cents);
    if (sale && sale.amount) return "Venda: " + sale.amount;
    return "Venda confirmada!";
  }

  function normalizeSaleId(id) {
    if (!id) return "";
    return String(id).replace(/^sale-/, "");
  }

  function markSaleSeen(saleId) {
    const id = normalizeSaleId(saleId);
    if (!id) return;
    localStorage.setItem(LS_LAST_SALE, id);
    const seen = loadSeenEvents();
    seen.add("sale-" + id);
    seen.add(id);
    saveSeenEvents(seen);
  }

  function isSaleAlreadySeen(saleId) {
    const id = normalizeSaleId(saleId);
    if (!id) return false;
    if (localStorage.getItem(LS_LAST_SALE) === id) return true;
    const seen = loadSeenEvents();
    return seen.has("sale-" + id) || seen.has(id);
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
    if (document.hidden) return;
    const now = Date.now();
    if (refreshLive._lastAt && now - refreshLive._lastAt < 2000) return;
    refreshLive._lastAt = now;
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

  ensureServiceWorker().then(function () {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      ensurePushSubscription().catch(function () {});
    }
  });
  bindTestNotify(document);
  bindPwaInstall(document);
  bindAudioReplace(document);
  bindCallLinkGenerator(document);

  function injectAdminNav() {
    if (document.querySelector('[data-nav-admin-injected]')) return;
    fetch("/api/panel/me", { credentials: "same-origin" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (me) {
        if (!me || !me.isPlatformOwner) return;
        var crown = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z"></path><path d="M5 21h14"></path></svg>';
        var sidebar = document.querySelector(".sidebar .nav-section");
        if (sidebar && !sidebar.querySelector('[href="/admin/usuarios"]')) {
          var a = document.createElement("a");
          a.href = "/admin/usuarios";
          a.className = location.pathname.startsWith("/admin") ? "active" : "";
          a.setAttribute("data-nav", "");
          a.setAttribute("data-nav-admin-injected", "1");
          a.title = "Admin";
          a.innerHTML = crown + '<span class="nav-text"> Admin</span>';
          var profile = sidebar.querySelector('a[href="/perfil"]');
          if (profile) sidebar.insertBefore(a, profile);
          else sidebar.appendChild(a);
        }
        var mobileNav = document.querySelector(".mobile-menu-nav");
        if (mobileNav && !mobileNav.querySelector('[href="/admin/usuarios"]')) {
          var ma = document.createElement("a");
          ma.href = "/admin/usuarios";
          ma.className = "mobile-menu-link" + (location.pathname.startsWith("/admin") ? " active" : "");
          ma.setAttribute("data-nav", "");
          ma.setAttribute("data-nav-admin-injected", "1");
          ma.innerHTML = crown + "<span>Admin</span>";
          var mProfile = mobileNav.querySelector('a[href="/perfil"]');
          if (mProfile) mobileNav.insertBefore(ma, mProfile);
          else mobileNav.appendChild(ma);
        }
      })
      .catch(function () {});
  }
  injectAdminNav();
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
  let salePollMs = 3000;
  setInterval(function () {
    if (document.hidden) return;
    checkNewSales();
  }, salePollMs);
  document.addEventListener("visibilitychange", function () {
    salePollMs = document.hidden ? 8000 : 3000;
    if (!document.hidden) {
      checkNewSales();
      if (location.pathname === "/") refreshLive(true);
    }
  });
  setInterval(() => {
    if (document.hidden) return;
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

  bindGlobalSearch();
})();
</script>`;
