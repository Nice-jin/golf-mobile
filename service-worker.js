/* ============================================================
 * service-worker.js - 오프라인 지원
 *   앱을 고칠 때마다 CACHE 버전을 올리면 갱신됩니다.
 * ============================================================ */
const CACHE = "golf-20260607_0443";  // 빌드 시 자동 치환

// 빌드 후 실제 존재하는 파일만 (css/js는 index.html에 인라인됨)
const ASSETS = [
  "manifest.webmanifest",
  "manifest.json",
  "vendor/sql-wasm.js",
  "vendor/sql-wasm.wasm",
  "icons/icon-192.png",
  "icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = req.url;

  // index.html / 루트: 항상 네트워크 우선 → 최신 버전 보장
  if (url.endsWith("/") || url.endsWith("index.html")) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // sql.js (WASM): 캐시 우선 (변하지 않음)
  if (url.includes("sql.js") || url.includes("cdnjs.cloudflare.com")) {
    e.respondWith(
      caches.open(CACHE).then((c) =>
        c.match(req).then((hit) => hit || fetch(req).then((res) => {
          c.put(req, res.clone()); return res;
        }))
      )
    );
    return;
  }

  // 나머지(아이콘, manifest 등): 캐시 우선, 없으면 네트워크
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      caches.open(CACHE).then((c) => c.put(req, res.clone())).catch(() => {});
      return res;
    }).catch(() => caches.match("index.html")))
  );
});
