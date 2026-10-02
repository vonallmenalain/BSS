import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '@/App'
import '@/index.css'
// Lauscht ab dem Start auf das Angebot des Browsers, die App zu installieren –
// es kommt früh, oft bevor die Seite steht, die den Knopf dazu zeigt.
import '@/lib/install'

const container = document.getElementById('root')
if (!container) throw new Error('Element #root nicht gefunden.')

// Platzhalter aus index.html entfernen, bevor React übernimmt.
container.replaceChildren()

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
