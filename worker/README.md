# IARA agent proxy (Cloudflare Worker)

O site é estático (GitHub Pages), então não pode guardar chave de API: qualquer coisa no bundle
fica pública. Este Worker guarda a chave como *secret* e repassa o pedido do assistente para um
modelo gratuito. O plano grátis da Cloudflare dá 100 mil requisições por dia.

```
navegador (iara.earth)  ──POST /──▶  Worker (chave secreta)  ──▶  Gemini  (se 429/5xx) ─▶ Groq ─▶ OpenRouter
        ▲                                                                          │
        └──────────── resposta com tool_calls (abrir caso, mover mapa…) ◀──────────┘
```

O navegador executa as ferramentas (é ele que controla o mapa) e devolve o resultado ao modelo
até ele responder em texto. O Worker só escolhe o provedor, fixa o modelo, limita o tamanho do
pedido, aceita só as origens do `ALLOWED_ORIGINS` e segura 20 pedidos por minuto por IP.

## Configurar (uma vez, ~10 min)

1. Pegue uma chave grátis do Gemini em https://aistudio.google.com/apikey
   (opcional: uma do Groq em https://console.groq.com/keys como reserva).
2. Na pasta `worker/`:
   ```bash
   npx wrangler login
   npx wrangler secret put GEMINI_API_KEY
   npx wrangler secret put GROQ_API_KEY   # opcional
   npx wrangler deploy
   ```
   O deploy imprime a URL, algo como `https://iara-agent.<seu-subdominio>.workers.dev`.
3. No GitHub: **Settings → Secrets and variables → Actions → Variables → New variable**,
   nome `IARA_AGENT_URL`, valor = a URL do passo 2. O próximo deploy do Pages já usa o agente.
4. Para testar local: crie `.env.local` na raiz com `VITE_IARA_AGENT_URL=<a URL>` e rode `npm run dev`.

Sem a variável, o assistente continua funcionando com as regras de palavras-chave antigas.
Se o Worker cair ou a cota acabar, ele também volta para as regras sozinho.

## Trocar de modelo

Edite `GEMINI_MODEL` / `GROQ_MODEL` / `OPENROUTER_MODEL` no `wrangler.toml` e rode `npx wrangler deploy`.
Qualquer modelo com *function calling* no formato OpenAI serve.
