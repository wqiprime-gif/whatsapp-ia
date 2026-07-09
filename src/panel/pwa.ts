export const PWA_MANIFEST = {
  name: "OnlyChat WhatsApp",
  short_name: "OnlyChat",
  description: "Painel WhatsApp IA — vendas, leads e instâncias",
  start_url: "/",
  scope: "/",
  display: "standalone",
  background_color: "#050505",
  theme_color: "#25D366",
  orientation: "portrait-primary",
  icons: [
    {
      src: "/brand/pwa-192.png",
      sizes: "192x192",
      type: "image/png",
      purpose: "any"
    },
    {
      src: "/brand/pwa-512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "any"
    },
    {
      src: "/brand/pwa-512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "maskable"
    }
  ]
};

export const SERVICE_WORKER_JS = `self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = { title: "OnlyChat", body: "", url: "/", tag: "onlychat" };
  try {
    if (event.data) data = Object.assign(data, event.data.json());
  } catch (_) {}
  event.waitUntil(
    self.registration.showNotification(data.title || "OnlyChat", {
      body: data.body || "",
      tag: data.tag || "onlychat",
      icon: "/brand/pwa-192.png",
      badge: "/brand/pwa-192.png",
      vibrate: [200, 100, 200],
      renotify: true,
      data: { url: data.url || "/" }
    })
  );
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type !== "SHOW_NOTIFICATION") return;
  const title = data.title || "OnlyChat";
  const body = data.body || "";
  const tag = data.tag || "onlychat-alert";
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      icon: "/brand/pwa-192.png",
      badge: "/brand/pwa-192.png",
      vibrate: [180, 90, 180],
      renotify: true,
      data: { url: data.url || "/" }
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
`;

export const PWA_HEAD_TAGS = `
<link rel="manifest" href="/manifest.webmanifest" />
<meta name="theme-color" content="#25D366" />
<meta name="mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="OnlyChat" />
<link rel="apple-touch-icon" href="/brand/pwa-192.png" />
`;
