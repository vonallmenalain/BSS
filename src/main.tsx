import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '@/App'
import { startAppUpdates } from '@/lib/appUpdate'
import '@/index.css'
// Lauscht ab dem Start auf das Angebot des Browsers, die App zu installieren –
// es kommt früh, oft bevor die Seite steht, die den Knopf dazu zeigt.
import '@/lib/install'

const container = document.getElementById('root')
if (!container) throw new Error('Element #root nicht gefunden.')

// Platzhalter aus index.html entfernen, bevor React übernimmt.
container.replaceChildren()

/*
 * Die Suche nach neuen Fassungen läuft neben React und nicht in einer
 * Komponente: Sie soll auf jeder Seite laufen – auf der Anmeldung, im
 * Wartebereich und auch dann, wenn die App abgestürzt ist (siehe
 * `lib/appUpdate`).
 */
startAppUpdates()

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
