/* ATLAS service worker – app-shell caching and honest offline fallback.
 * - Static build assets: cache-first (they are content-hashed).
 * - Pages: network-first, fall back to the cached page or /offline.
 * - /api/data/*: network-first; when offline the last cached response is
 *   returned with the header "x-atlas-offline: 1" so the UI labels it "Cached".
 */
const VERSION = "atlas-v1";
const SHELL = `${VERSION}-shell`;
const STATIC = `${VERSION}-static`;
const API = `${VERSION}-api`;
const PRECACHE = ["/", "/map", "/news", "/tv", "/explore", "/offline", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/apple-touch-icon.png", "/basemap/countries-110m.geojson", "/maplibre/maplibre-gl-worker.mjs"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((c) => Promise.allSettled(PRECACHE.map((u) => c.add(new Request(u, { cache: "reload" })))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms));
}

async function apiNetworkFirst(request) {
  const cache = await caches.open(API);
  try {
    const res = await Promise.race([fetch(request), timeout(15000)]);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch (err) {
    const cached = await cache.match(request);
    if (!cached) throw err;
    const headers = new Headers(cached.headers);
    headers.set("x-atlas-offline", "1");
    return new Response(await cached.blob(), { status: 200, headers });
  }
}

async function pageNetworkFirst(request) {
  const cache = await caches.open(SHELL);
  try {
    const res = await Promise.race([fetch(request), timeout(8000)]);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    return (await cache.match(request, { ignoreSearch: true })) || (await cache.match("/offline")) || Response.error();
  }
}

async function staticCacheFirst(request) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/data/")) return event.respondWith(apiNetworkFirst(request));
  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname.startsWith("/basemap/") || url.pathname.startsWith("/maplibre/")) {
    return event.respondWith(staticCacheFirst(request));
  }
  if (request.mode === "navigate") return event.respondWith(pageNetworkFirst(request));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/alerts";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) if ("focus" in w) return w.focus().then(() => (target.startsWith("/") ? w.navigate(target) : self.clients.openWindow(target)));
      return self.clients.openWindow(target);
    }),
  );
});
