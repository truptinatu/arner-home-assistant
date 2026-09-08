/* Basic offline shell — enough for installability, not a full offline-first app. */
const CACHE = "ha-shell-v1";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./inventory.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-192-maskable.png",
  "./icons/icon-512-maskable.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-32.png",
  "https://cdn.jsdelivr.net/npm/fuse.js@7.0.0/dist/fuse.min.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(SHELL.map(async (url) => {
      try { await cache.add(url); } catch (err) { console.warn("SW skip", url, err); }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.hostname === "api.github.com") return;

  event.respondWith((async () => {
    if (event.request.mode === "navigate") {
      try {
        const fresh = await fetch(event.request);
        const cache = await caches.open(CACHE);
        cache.put("./index.html", fresh.clone());
        return fresh;
      } catch {
        return (await caches.match("./index.html")) || (await caches.match("./"));
      }
    }

    const cached = await caches.match(event.request);
    if (cached) return cached;

    try {
      const fresh = await fetch(event.request);
      if (fresh.ok && url.protocol.startsWith("http")) {
        const cache = await caches.open(CACHE);
        cache.put(event.request, fresh.clone());
      }
      return fresh;
    } catch (err) {
      if (url.pathname.endsWith("/inventory.json")) {
        const fallback = await caches.match("./inventory.json");
        if (fallback) return fallback;
      }
      throw err;
    }
  })());
});
