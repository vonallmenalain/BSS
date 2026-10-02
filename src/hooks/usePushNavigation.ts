import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * Wechselt die Seite, wenn eine angetippte Benachrichtigung darum bittet.
 *
 * Der Service Worker der Benachrichtigungen (`public/push-sw.js`) darf ein
 * offenes Fenster nicht selbst umleiten – es gehört dem Service Worker der
 * PWA. Er schickt deshalb eine Nachricht mit der Adresse, und die App
 * erledigt den Rest. Angenommen werden nur Pfade der App selbst: «/putzplan»
 * ja, «//anderswo.example» oder «https://…» nie.
 */
export function usePushNavigation() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: unknown; url?: unknown } | null
      if (data?.type !== 'bss-navigate' || typeof data.url !== 'string') return
      if (!data.url.startsWith('/') || data.url.startsWith('//')) return
      navigate(data.url)
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [navigate])
}
