/* ============================================================
 * service-worker.js - 오프라인 지원
 *   앱 셸 사전 캐시 + sql.js(WASM) 런타임 캐시
 *   앱을 고칠 때마다 CACHE 버전을 올리면 갱신됩니다.
 * ============================================================ */
const CACHE = "golf-mobile-v3";
const ASSETS = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "vendor/sql-wasm.js",
  "vendor/sql-wasm.wasm",
  "icons/icon-192.png",
  "icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS).catch(() => {})).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  // sql.js CDN(wasm/js): 캐시 우선, 없으면 받아서 캐시
  if (req.url.includes("sql.js") || req.url.includes("cdnjs.cloudflare.com")) {
    e.respondWith(
      caches.open(CACHE).then((c) =>
        c.match(req).then((hit) => hit || fetch(req).then((res) => { c.put(req, res.clone()); return res; }))
      )
    );
    return;
  }
  // 앱 셸: 캐시 우선, 네트워크 폴백
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match("index.html")))
  );
});
