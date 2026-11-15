import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { useI18n } from './lib/i18n'
import './index.css'

document.documentElement.lang = useI18n.getState().lang
const unsubscribe = useI18n.subscribe(({ lang }) => {
  document.documentElement.lang = lang
})
import.meta.hot?.dispose(unsubscribe)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
