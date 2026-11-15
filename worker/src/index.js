/**
 * IARA agent proxy (Cloudflare Worker, free plan).
 *
 * The site is static (GitHub Pages), so it cannot hold an API key. This Worker keeps the keys as
 * secrets and forwards the assistant's chat request to a free model. The body the site sends is
 * already in OpenAI chat-completions format, which Gemini, Groq and OpenRouter all accept, so the
 * Worker only picks the provider, pins the model and caps the request.
 *
 * Providers are tried in order; a provider is skipped when its key is missing, and the next one is
 * tried when one answers 429 (quota) or 5xx.
 *
 * Secrets (wrangler secret put NAME): GEMINI_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY (any subset).
 * Vars (wrangler.toml): ALLOWED_ORIGINS, GEMINI_MODEL, GROQ_MODEL, OPENROUTER_MODEL.
 */

const PROVIDERS = [
  {
    name: 'gemini',
    key: 'GEMINI_API_KEY',
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    model: (env) => env.GEMINI_MODEL || 'gemini-2.5-flash',
  },
  {
    name: 'groq',
    key: 'GROQ_API_KEY',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    model: (env) => env.GROQ_MODEL || 'llama-3.3-70b-versatile',
  },
  {
    name: 'openrouter',
    key: 'OPENROUTER_API_KEY',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    model: (env) => env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free',
  },
]

const MAX_BODY_BYTES = 120_000
const MAX_MESSAGES = 60
const MAX_TOOLS = 30
// Per-IP budget, per Worker instance. Best effort; Cloudflare's rate-limit binding can replace it.
const RATE = { windowMs: 60_000, max: 20 }
const hits = new Map()

function allowedOrigin(origin, env) {
  const list = (env.ALLOWED_ORIGINS || 'https://iara.earth,http://localhost:5173,http://localhost:4173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return list.includes(origin) ? origin : null
}

function cors(origin) {
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    vary: 'origin',
  }
}

function json(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  })
}

function rateLimited(ip) {
  const now = Date.now()
  const rec = hits.get(ip)
  if (!rec || now - rec.start > RATE.windowMs) {
    hits.set(ip, { start: now, n: 1 })
    if (hits.size > 5000) hits.clear()
    return false
  }
  rec.n += 1
  return rec.n > RATE.max
}

export default {
  async fetch(request, env) {
    const origin = allowedOrigin(request.headers.get('origin') || '', env)
    if (!origin) return json(403, { error: 'origin not allowed' })
    const h = cors(origin)

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: h })
    if (request.method !== 'POST') return json(405, { error: 'POST only' }, h)

    const ip = request.headers.get('cf-connecting-ip') || 'unknown'
    if (rateLimited(ip)) return json(429, { error: 'too many requests, wait a minute' }, h)

    const raw = await request.text()
    if (raw.length > MAX_BODY_BYTES) return json(413, { error: 'request too large' }, h)
    let body
    try {
      body = JSON.parse(raw)
    } catch {
      return json(400, { error: 'invalid JSON' }, h)
    }
    if (!Array.isArray(body.messages) || body.messages.length === 0 || body.messages.length > MAX_MESSAGES)
      return json(400, { error: 'messages missing or too many' }, h)

    // Only forward what the assistant needs; the model and limits are fixed here, not by the caller.
    const payload = {
      messages: body.messages,
      tools: Array.isArray(body.tools) ? body.tools.slice(0, MAX_TOOLS) : undefined,
      tool_choice: body.tools ? 'auto' : undefined,
      temperature: typeof body.temperature === 'number' ? Math.min(1, Math.max(0, body.temperature)) : 0.3,
      max_tokens: 700,
      stream: false,
    }

    const errors = []
    for (const p of PROVIDERS) {
      const key = env[p.key]
      if (!key) continue
      try {
        const res = await fetch(p.url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${key}`,
            ...(p.name === 'openrouter' ? { 'http-referer': 'https://iara.earth', 'x-title': 'IARA' } : {}),
          },
          body: JSON.stringify({ ...payload, model: p.model(env) }),
        })
        if (res.status === 429 || res.status >= 500) {
          errors.push(`${p.name} ${res.status}`)
          continue
        }
        const text = await res.text()
        return new Response(text, {
          status: res.status,
          headers: { 'content-type': 'application/json', 'x-iara-provider': p.name, ...h },
        })
      } catch (e) {
        errors.push(`${p.name} ${e instanceof Error ? e.message : 'failed'}`)
      }
    }
    return json(502, { error: errors.length ? `all providers failed: ${errors.join('; ')}` : 'no API key configured' }, h)
  },
}
