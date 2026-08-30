export function buildPwaManifest(baseUrl = "") {
  const base = (baseUrl || "").replace(/\/$/, "");
  const icon = (size: number) => (base ? `${base}/brand/pwa-${size}.png` : `/brand/pwa-${size}.png`);
  const favicon = base ? `${base}/brand/favicon.svg` : "/brand/favicon.svg";

  return {
    id: base || "/",
    name: "X1 BLACK",
    short_name: "X1 BLACK",
    description: "Painel WhatsApp IA — vendas, leads e instâncias",
    lang: "pt-BR",
    dir: "ltr",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    orientation: "portrait-primary",
    prefer_related_applications: false,
    categories: ["business", "productivity"],
    icons: [
      {
        src: icon(192),
        sizes: "192x192",
        type: "image/png",
        purpose: "any"
      },
      {
        src: icon(512),
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      },
      {
        src: favicon,
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any"
      },
      {
        src: icon(192),
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable"
      },
      {
        src: icon(512),
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      }
    ]
  };
}

export const SERVICE_WORKER_JS = `const SW_VERSION = "x1black-v1.26.1";
// PNG WhatsApp azul (telefone) — mesmo papel do favicon.svg do instablack.
const NOTIFY_ICON = "/brand/pwa-192.png?v=1.26.0";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SW_VERSION).then((cache) =>
      cache.addAll([NOTIFY_ICON, "/brand/favicon.svg", "/brand/pwa-512.png"]).catch(() => undefined)
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== SW_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/brand/")) {
    event.respondWith(
      fetch(event.request).then((res) => {
        if (!res || res.status !== 200) return res;
        const copy = res.clone();
        caches.open(SW_VERSION).then((cache) => cache.put(event.request, copy));
        return res;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  if (event.request.mode === "navigate" && (url.pathname === "/" || url.pathname === "/login")) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(SW_VERSION).then((cache) => cache.put(event.request, copy));
          }
          return res;
        })
        .catch(() => caches.match(event.request).then((c) => c || caches.match("/")))
    );
  }
});

// Mesmo padrão do instablack: icon + badge. Tag única para não apagar notificação anterior.
function uniqueTag(base) {
  var prefix = String(base || "x1black").trim() || "x1black";
  return prefix + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
}

function notifyOptions(body, tag, url) {
  return {
    body: body || "",
    icon: NOTIFY_ICON,
    badge: NOTIFY_ICON,
    tag: tag || uniqueTag("x1black"),
    renotify: true,
    data: { url: url || "/" },
    vibrate: [120, 60, 120]
  };
}

self.addEventListener("push", (event) => {
  let data = { title: "X1 BLACK", body: "", url: "/", tag: "" };
  try {
    if (event.data) data = Object.assign(data, event.data.json());
  } catch (_) {}
  event.waitUntil(
    self.registration.showNotification(
      data.title || "X1 BLACK",
      notifyOptions(data.body, data.tag, data.url)
    )
  );
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type !== "SHOW_NOTIFICATION") return;
  event.waitUntil(
    self.registration.showNotification(
      data.title || "X1 BLACK",
      notifyOptions(data.body, data.tag || "x1black-alert", data.url)
    )
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          return client.focus().then(() => {
            if ("navigate" in client && typeof client.navigate === "function") {
              return client.navigate(target);
            }
          });
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
`;

export const PWA_HEAD_TAGS = `
<link rel="manifest" href="/manifest.webmanifest" />
<meta name="theme-color" content="#000000" />
<meta name="mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="X1 BLACK" />
<link rel="icon" href="/brand/favicon.svg" type="image/svg+xml" />
<link rel="icon" href="/brand/pwa-192.png?v=1.26.0" type="image/png" sizes="192x192" />
<link rel="apple-touch-icon" href="/brand/pwa-192.png?v=1.26.0" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
`;
