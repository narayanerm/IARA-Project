/**
 * IARA agent loop. The site is static, so the model is reached through a small proxy
 * (see /worker) that holds the API key. The proxy speaks the OpenAI chat-completions format,
 * which Gemini, Groq and OpenRouter all accept, so the provider can change without touching this.
 *
 * Flow per question: send history + tools → if the model asks for tools, run them on the site
 * and send the results back → repeat until it answers in text (at most MAX_STEPS rounds).
 */
import { TOOL_SPECS, READ_ONLY_TOOLS, runTool, siteSnapshot, caseCatalog } from './tools'

export const AGENT_URL: string = (import.meta.env.VITE_IARA_AGENT_URL as string | undefined)?.trim() ?? ''
export const agentEnabled = () => AGENT_URL.length > 0

const MAX_STEPS = 6
const HISTORY_TURNS = 12
const TIMEOUT_MS = 30_000

export type ChatMsg =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string }

interface ToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export interface AgentAction {
  name: string
  args: string
  ok: boolean
}

export interface AgentResult {
  text: string
  actions: AgentAction[]
}

function systemPrompt(): string {
  return [
    'You are IARA, the assistant of the IARA website (iara.earth): a NASA Space Apps project that uses',
    'radar satellites (SAR: NISAR, Sentinel-1) and optical imagery to show three Amazon case studies:',
    'illegal gold mining in the Yanomami land (YANO), the 2021 flood in Manaus (ENCH) and the 2023-24 drought',
    'in Manaquiri (SECA), with yearly series, risk zones and forecasts.',
    '',
    'You can control the site with tools. When the person asks to see, open, show, compare, go to or turn on',
    'something, DO it with tools first, then reply. Chain several tools when needed (e.g. open_case, then',
    'focus_hotspot). For factual questions about a case, call get_case_details and answer only from it;',
    'if the data does not say, say you do not know. Never invent numbers.',
    '',
    'Reply in the site language (pt = Brazilian Portuguese, en = English) unless the person writes in the other',
    'one. Keep replies short: 1 to 4 sentences, plain text, you may use **bold**. Say what you changed on screen.',
    '',
    'Cases and ids:',
    JSON.stringify(caseCatalog()),
  ].join('\n')
}

async function callModel(messages: ChatMsg[], signal: AbortSignal) {
  const res = await fetch(AGENT_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages, tools: TOOL_SPECS, tool_choice: 'auto', temperature: 0.3 }),
    signal,
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`agent proxy ${res.status}: ${body.slice(0, 200)}`)
  }
  const data = await res.json()
  const msg = data?.choices?.[0]?.message
  if (!msg) throw new Error('agent proxy returned no message')
  return msg as { content?: string | null; tool_calls?: ToolCall[] }
}

/** `history` holds only plain user/assistant text from earlier turns, never tool round-trips. */
export async function runAgent(history: ChatMsg[], userText: string, onAction?: (a: AgentAction) => void): Promise<AgentResult> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  const actions: AgentAction[] = []
  const user: ChatMsg = {
    role: 'user',
    content: `${userText}\n\n[site state: ${JSON.stringify(siteSnapshot())}]`,
  }
  const turn: ChatMsg[] = [user]
  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      const messages: ChatMsg[] = [{ role: 'system', content: systemPrompt() }, ...history.slice(-HISTORY_TURNS * 2), ...turn]
      const msg = await callModel(messages, ctrl.signal)
      const calls = (msg.tool_calls ?? []).filter((c) => c?.function?.name)
      if (!calls.length) {
        const text = (msg.content ?? '').trim()
        turn.push({ role: 'assistant', content: text })
        return { text, actions }
      }
      // Some providers require an id on every call; make sure there is one.
      const withIds = calls.map((c, i) => ({
        id: c.id || `call_${step}_${i}`,
        type: 'function' as const,
        function: {
          name: c.function.name,
          arguments: typeof c.function.arguments === 'string' ? c.function.arguments : JSON.stringify(c.function.arguments ?? {}),
        },
      }))
      turn.push({ role: 'assistant', content: msg.content ?? '', tool_calls: withIds })
      // Run in order: "open the case, then the alerts tab" depends on the first finishing.
      for (const c of withIds) {
        const result = await runTool(c.function.name, c.function.arguments)
        const ok = !(result && typeof result === 'object' && 'error' in result)
        if (!READ_ONLY_TOOLS.has(c.function.name)) {
          const a = { name: c.function.name, args: c.function.arguments, ok }
          actions.push(a)
          onAction?.(a)
        }
        turn.push({ role: 'tool', tool_call_id: c.id, content: JSON.stringify(result) })
      }
    }
    return { text: '', actions }
  } finally {
    clearTimeout(timer)
  }
}
