import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '@/App'
import '@/index.css'

const container = document.getElementById('root')
if (!container) throw new Error('Element #root nicht gefunden.')

// Platzhalter aus index.html entfernen, bevor React übernimmt.
container.replaceChildren()

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
