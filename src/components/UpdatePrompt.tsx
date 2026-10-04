import { RefreshCw, X } from 'lucide-react'
import { useAppUpdate } from '@/contexts/AppUpdateContext'

/**
 * Meldet sich, sobald eine neue Version bereitliegt.
 *
 * Bewusst als Hinweis statt automatischem Neuladen: mitten in der Sitzung
 * soll die App nicht ungefragt neu starten und Eingaben verlieren. Er steht
 * an der Wurzel der App und damit auf jeder Seite – auch auf der Anmeldung
 * (siehe `AppUpdateProvider`).
 */
export function UpdatePrompt() {
  const { needRefresh, applyUpdate, dismiss } = useAppUpdate()

  if (!needRefresh) return null

  return (
    <div className="no-print animate-slide-up fixed inset-x-4 bottom-24 z-50 mx-auto max-w-sm lg:bottom-6">
      <div className="border-brand-200 dark:border-brand-800 dark:bg-brand-950 flex items-center gap-3 rounded-xl border bg-white p-3 shadow-lg">
        <RefreshCw className="text-brand-600 dark:text-brand-300 size-5 shrink-0" aria-hidden />
        <p className="flex-1 text-sm font-medium">Eine neue Version ist verfügbar.</p>
        <button type="button" className="btn-primary btn-sm" onClick={applyUpdate}>
          Aktualisieren
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="-mr-1 rounded-lg p-1 text-slate-400 transition hover:text-slate-600"
          aria-label="Später"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}
