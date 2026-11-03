/* MY TOOL service worker: app shell works offline; data always goes to Google live. */
const V = "mytool-bb60943a3a";
const SHELL = ["./", "index.html", "manifest.webmanifest", "vendor/xlsx.full.min.js", "vendor/jspdf.umd.min.js", "assets/icon-192.png", "assets/icon-512.png", "assets/icon-180.png", "assets/icon-32.png", "vendor/pdfjs/pdf.min.js", "vendor/pdfjs/pdf.worker.min.js", "vendor/exceljs/exceljs.min.js"];
self.addEventListener("install", e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;           // Google APIs, fonts: network only
  if (e.request.mode === "navigate" || u.pathname.endsWith("/") || u.pathname.endsWith("index.html")) {
    e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(V).then(x => x.put("index.html", c)); return r; }).catch(() => caches.match("index.html")));
    return;
  }
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
