import { useRegisterSW } from 'virtual:pwa-register/react'
import { RefreshCw, X } from 'lucide-react'

/**
 * Meldet sich, sobald eine neue Version bereitliegt.
 *
 * Bewusst als Hinweis statt automatischem Neuladen: mitten in der Sitzung
 * soll die App nicht ungefragt neu starten und Eingaben verlieren.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Stündlich nach einer neuen Version schauen.
      if (registration) {
        setInterval(() => void registration.update(), 60 * 60 * 1000)
      }
    },
    onRegisterError(error) {
      console.warn('[pwa] Service Worker konnte nicht registriert werden:', error)
    },
  })

  if (!needRefresh) return null

  return (
    <div className="no-print animate-slide-up fixed inset-x-4 bottom-24 z-50 mx-auto max-w-sm lg:bottom-6">
      <div className="border-brand-200 dark:border-brand-800 dark:bg-brand-950 flex items-center gap-3 rounded-xl border bg-white p-3 shadow-lg">
        <RefreshCw className="text-brand-600 dark:text-brand-300 size-5 shrink-0" aria-hidden />
        <p className="flex-1 text-sm font-medium">Eine neue Version ist verfügbar.</p>
        <button
          type="button"
          className="btn-primary btn-sm"
          onClick={() => void updateServiceWorker(true)}
        >
          Aktualisieren
        </button>
        <button
          type="button"
          onClick={() => setNeedRefresh(false)}
          className="-mr-1 rounded-lg p-1 text-slate-400 transition hover:text-slate-600"
          aria-label="Später"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}
