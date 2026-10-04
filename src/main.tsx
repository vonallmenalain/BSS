import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '@/App'
import { UpdatePrompt } from '@/components/UpdatePrompt'
import { AppUpdateProvider } from '@/contexts/AppUpdateContext'
import '@/index.css'
// Lauscht ab dem Start auf das Angebot des Browsers, die App zu installieren –
// es kommt früh, oft bevor die Seite steht, die den Knopf dazu zeigt.
import '@/lib/install'

const container = document.getElementById('root')
if (!container) throw new Error('Element #root nicht gefunden.')

// Platzhalter aus index.html entfernen, bevor React übernimmt.
container.replaceChildren()

/*
 * Die Aktualisierung steht um die ganze App herum und nicht im Layout: Der
 * Hinweis auf eine neue Fassung soll auf jeder Seite erscheinen – auf der
 * Anmeldung, im Wartebereich und auch dann, wenn die App abgestürzt ist
 * (siehe `AppUpdateProvider`).
 */
createRoot(container).render(
  <StrictMode>
    <AppUpdateProvider>
      <App />
      <UpdatePrompt />
    </AppUpdateProvider>
  </StrictMode>,
)
