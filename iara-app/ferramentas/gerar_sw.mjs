// Gera www/sw.js com a lista de arquivos do app, para funcionar sem internet.
// Rode depois de mudar qualquer arquivo em www/:  node ferramentas/gerar_sw.mjs
import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const WWW = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "www");
const FORA = [/^sw\.js$/, /(^|\/)\./, /\.md$/i, /iara-icone-(claro|escuro)-1024\.png$/];

async function listar(dir) {
  const out = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name), rel = path.relative(WWW, abs).split(path.sep).join("/");
    if (FORA.some((r) => r.test(rel))) continue;
    if (e.isDirectory()) out.push(...(await listar(abs))); else out.push(rel);
  }
  return out;
}

const arquivos = (await listar(WWW)).sort();
const h = crypto.createHash("sha256");
for (const f of arquivos) h.update(f).update(await fs.readFile(path.join(WWW, f)));
const versao = h.digest("hex").slice(0, 10);

await fs.writeFile(path.join(WWW, "sw.js"), `// Gerado por ferramentas/gerar_sw.mjs. Não edite à mão.
const CACHE = "iara-${versao}";
const ARQUIVOS = ${JSON.stringify(arquivos)};
self.addEventListener("install", (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting())));
self.addEventListener("activate", (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === "navigate") { e.respondWith(caches.match("index.html").then((r) => r || fetch(req))); return; }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((r) => r || fetch(req)));
});
`);
console.log("sw.js: " + arquivos.length + " arquivos, versão " + versao);
