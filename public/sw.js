self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open("subresell-shell-v1").then((cache) => cache.addAll(["/offline.html"])),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(() => caches.match("/offline.html")));
});

self.addEventListener("push", (event) => {
  const data = event.data
    ? event.data.json()
    : {
        title: "Rappel abonnement",
        body: "Un abonnement arrive a expiration.",
        url: "/",
      };

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      data: { url: data.url || "/" },
      icon: "/window.svg",
      badge: "/window.svg",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(
      (clients) => {
        for (const client of clients) {
          if ("focus" in client) {
            client.focus();
            return;
          }
        }

        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
      },
    ),
  );
});
