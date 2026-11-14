// Gerado por ferramentas/gerar_sw.mjs. Não edite à mão.
const CACHE = "iara-f227105a45";
const ARQUIVOS = ["css/app.css","dados/deter.js","dados/focos.js","dados/risco.js","dados/territorios.js","img/apple-touch-icon.png","img/faixa.svg","img/icone-192.png","img/icone-512.png","img/icone-maskable-512.png","img/logo-claro.svg","img/logo-escuro.svg","img/og.png","img/radar-cheia.jpg","img/radar-seca.jpg","img/simbolo.svg","index.html","js/app.js","js/base.js","manifest.webmanifest","vendor/fontes/bricolage-grotesque-latin-ext-wght-normal.woff2","vendor/fontes/bricolage-grotesque-latin-wght-normal.woff2","vendor/fontes/geist-latin-ext-wght-normal.woff2","vendor/fontes/geist-latin-wght-italic.woff2","vendor/fontes/geist-latin-wght-normal.woff2","vendor/fontes/geist-mono-latin-400-normal.woff2","vendor/fontes/geist-mono-latin-500-normal.woff2","vendor/leaflet/images/layers-2x.png","vendor/leaflet/images/layers.png","vendor/leaflet/images/marker-icon-2x.png","vendor/leaflet/images/marker-icon.png","vendor/leaflet/images/marker-shadow.png","vendor/leaflet/leaflet.css","vendor/leaflet/leaflet.js","vendor/phosphor/Phosphor.woff2","vendor/phosphor/style.css"];
self.addEventListener("install", (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting())));
self.addEventListener("activate", (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === "navigate") { e.respondWith(caches.match("index.html").then((r) => r || fetch(req))); return; }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((r) => r || fetch(req)));
});
