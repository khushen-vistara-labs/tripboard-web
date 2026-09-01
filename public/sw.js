const CACHE = "tripboard-shell-v4";
const APP_SHELL = ["/", "/today", "/plan", "/money", "/checklist", "/guide", "/more", "/bookings", "/login", "/manifest.webmanifest", "/icon-192.png?v=3", "/icon-512.png?v=3", "/apple-touch-icon.png?v=3"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  // Never cache Vite's source modules: doing so traps localhost on an older UI
  // until the user manually clears all browser storage.
  if (url.pathname.startsWith("/src/") || url.pathname.startsWith("/@vite/") || url.pathname.startsWith("/@id/")) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then((response) => { const copy = response.clone(); caches.open(CACHE).then((cache) => cache.put(request, copy)); return response; }).catch(async () => (await caches.match(request)) || (await caches.match("/today"))));
    return;
  }
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => { if (response.ok) { const copy = response.clone(); caches.open(CACHE).then((cache) => cache.put(request, copy)); } return response; })));
});

self.addEventListener("push", (event) => {
  const payload = event.data?.json() ?? { title: "TripBoard", body: "Open your shared trip for an update.", url: "/today" };
  event.waitUntil(self.registration.showNotification(payload.title, { body: payload.body, icon: "/icon-192.png?v=3", badge: "/favicon.png?v=3", data: { url: payload.url || "/today" }, tag: payload.dedupeKey, renotify: false }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/today", self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    const existing = clients.find((client) => client.url === target && "focus" in client);
    return existing ? existing.focus() : self.clients.openWindow(target);
  }));
});
