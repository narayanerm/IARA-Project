/**
 * The conversation lives in a store, not in the chat component, so a question can be asked from
 * anywhere (the floating ask bar on the home screen, the chat tab inside a case) and the agent
 * keeps running even if the panel that showed it closes or remounts.
 */
import { create } from 'zustand'
import { useApp, useUi } from '@/lib/store'
import { useI18n } from '@/lib/i18n'
import { routeIntent, type Intent } from '@/components/app/Chatbot/intents'
import { agentEnabled, runAgent, type AgentAction, type ChatMsg } from './agent'
import { agentText } from './labels'

export type AssistantMessage =
  | { id: string; role: 'user'; text: string }
  | { id: string; role: 'assistant'; intent: Intent }
  | { id: string; role: 'assistant'; text: string; actions: AgentAction[] }

interface AssistantState {
  messages: AssistantMessage[]
  thinking: boolean
  /** Tools run so far for the question being answered, shown while thinking. */
  liveActions: AgentAction[]
  send: (text: string) => void
}

let seq = 0
const id = (p: string) => `${p}-${Date.now()}-${seq++}`
// Plain user/assistant text sent to the model as memory of the conversation.
let history: ChatMsg[] = []

export const useAssistant = create<AssistantState>((set, get) => ({
  messages: [],
  thinking: false,
  liveActions: [],
  send: (raw) => {
    const text = raw.trim()
    if (!text || get().thinking) return
    set((s) => ({ messages: [...s.messages, { id: id('u'), role: 'user', text }], thinking: true, liveActions: [] }))
    if (agentEnabled()) void askAgent(text)
    else window.setTimeout(() => answerWithRules(text), 600)
  },
}))

async function askAgent(text: string) {
  const lang = useI18n.getState().lang
  try {
    const res = await runAgent(history, text, (a) => useAssistant.setState((s) => ({ liveActions: [...s.liveActions, a] })))
    const reply = res.text || agentText(res.actions.length ? 'done' : 'empty', lang)
    history = [...history, { role: 'user' as const, content: text }, { role: 'assistant' as const, content: reply }].slice(-24)
    useAssistant.setState((s) => ({
      messages: [...s.messages, { id: id('a'), role: 'assistant', text: reply, actions: res.actions }],
    }))
  } catch (err) {
    // No network, quota or proxy down: the keyword router still answers.
    console.warn('[IARA agent] falling back to rules:', err)
    answerWithRules(text)
    return
  } finally {
    useAssistant.setState({ thinking: false, liveActions: [] })
  }
}

function answerWithRules(text: string) {
  const intent = routeIntent(text)
  applyIntent(intent)
  useAssistant.setState((s) => ({ messages: [...s.messages, { id: id('a'), role: 'assistant', intent }], thinking: false }))
}

/** Side effects of the keyword router (the assistant before the AI agent, kept as fallback). */
function applyIntent(intent: Intent) {
  const st = useApp.getState()
  switch (intent.kind) {
    case 'focus':
      st.setActiveRegion(intent.region)
      break
    case 'focus-ti':
      st.setFocusedTi(intent.tiName)
      st.requestFlyTo(intent.center, intent.zoom)
      break
    case 'timeline':
      if (intent.action === 'start') st.setTimeIndex(0)
      if (intent.action === 'end') st.setTimeIndex(23)
      if (intent.action === 'play') {
        let i = 0
        const int = window.setInterval(() => {
          useApp.getState().setTimeIndex(i)
          i += 1
          if (i > 23) window.clearInterval(int)
        }, 180)
      }
      break
    case 'layer':
      if (intent.action === 'toggle-nasa') st.toggleNasaOverlay()
      if (intent.action === 'toggle-truecolor') st.toggleTrueColorOverlay()
      break
    case 'layer-set':
      st.setActiveLayer(intent.layer)
      break
    case 'nisar':
      if (intent.action === 'show') st.setNisarVisible(true)
      if (intent.action === 'hide') st.setNisarVisible(false)
      if (intent.action === 'toggle') st.setNisarVisible(!st.nisarVisible)
      if (intent.action === 'opacity-up') st.setNisarOpacity(Math.min(1, st.nisarOpacity + 0.15))
      if (intent.action === 'opacity-down') st.setNisarOpacity(Math.max(0.1, st.nisarOpacity - 0.15))
      break
    default:
      break
  }
}

// A question typed in the floating ask bar arrives through the UI store; answer it even when
// the chat tab is not on screen.
let taken = 0
useUi.subscribe((s) => {
  const q = s.askQueue
  if (!q || q.ts === taken) return
  taken = q.ts
  useUi.getState().clearAsk()
  useAssistant.getState().send(q.text)
})
