// Keeps the calculator opening when the restaurant Wi-Fi drops.
// Pages: network first, falling back to the last copy. Build assets: cache first (their names change every deploy).
// Manager pages and APIs are never cached.
const CACHE = "ace-cashout-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/history") || url.pathname.startsWith("/api")) return;

  if (url.pathname.startsWith("/_next/static/") || /\.(png|svg|webp|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
            return res;
          }),
      ),
    );
    return;
  }

  if (req.mode === "navigate" && url.pathname === "/") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) caches.open(CACHE).then((c) => c.put("/", res.clone()));
          return res;
        })
        .catch(() => caches.match("/")),
    );
  }
});
