/* MY TOOL service worker: app shell works offline; data always goes to Google live. */
const V = "mytool-ee3fbd35e5";
const SHELL = ["./", "index.html", "manifest.webmanifest", "vendor/xlsx.full.min.js", "vendor/jspdf.umd.min.js", "assets/icon-192.png", "assets/icon-512.png", "assets/icon-180.png", "assets/icon-32.png", "vendor/pdfjs/pdf.min.js", "vendor/pdfjs/pdf.worker.min.js", "vendor/exceljs/exceljs.min.js"];
self.addEventListener("install", e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  /* "Share → MY TOOL" on Android (WhatsApp, WeChat, Gallery, Files…): the shared files and text are kept in this browser
     until the app has opened and the person is signed in; then the app shows them. Nothing leaves the phone here. */
  if (e.request.method === "POST" && u.origin === location.origin && u.pathname.endsWith("/share-in")) {
    e.respondWith((async () => {
      try {
        const fd = await e.request.formData(); const c = await caches.open("mytool-share"); const id = Date.now().toString(36);
        const files = fd.getAll("files").filter(f => f && typeof f === "object" && f.size); const meta = { id, at: new Date().toISOString(), title: String(fd.get("title") || ""), text: String(fd.get("text") || ""), url: String(fd.get("url") || ""), files: [] };
        let i = 0; for (const f of files.slice(0, 20)) { const k = "share/" + id + "/" + (i++); await c.put(k, new Response(f, { headers: { "Content-Type": f.type || "application/octet-stream", "X-Name": encodeURIComponent(f.name || "file"), "X-Size": String(f.size) } })); meta.files.push({ k, name: f.name || "file", type: f.type || "", size: f.size }); }
        await c.put("share/" + id + "/meta", new Response(JSON.stringify(meta), { headers: { "Content-Type": "application/json" } }));
      } catch (err) { /* the app opens anyway and says nothing arrived */ }
      return Response.redirect("./?shared=1", 303);
    })());
    return;
  }
  if (e.request.method !== "GET" || u.origin !== location.origin) return;           // Google APIs, fonts: network only
  if (u.pathname.endsWith("upload.html")) return;                                    // the supplier upload page is its own page: never the app shell, never cached as it
  if (e.request.mode === "navigate" || u.pathname.endsWith("/") || u.pathname.endsWith("index.html")) {
    e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(V).then(x => x.put("index.html", c)); return r; }).catch(() => caches.match("index.html")));
    return;
  }
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
