import { useState } from 'react'
import { Download, Share, Smartphone, X } from 'lucide-react'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { isIos, isStandalone, promptInstall } from '@/lib/install'

/**
 * Der Putzplan als App – ein Hinweis für alle ohne Konto.
 *
 * Wer den QR-Code am Anschlagbrett scannt, hat den Plan im Browser, und der
 * Tab ist bald verschwunden. Als App liegt er auf dem Startbildschirm, einen
 * Fingertipp entfernt – auf dem iPhone ist das zudem die Voraussetzung für
 * die Erinnerung. Installiert wird der Putzplan allein, unter eigenem Namen
 * (`public/putzplan.webmanifest`, eingesetzt von `pages/Cleaning`): ohne
 * Anmeldung, die man ohnehin nicht hat.
 *
 * Wo der Browser einen Knopf erlaubt (Chrome, Edge, Android), gibt es einen.
 * Auf dem iPhone steht, wie es geht. Wer die App schon offen hat oder den
 * Hinweis wegklickt, sieht ihn nicht mehr; das Gerät merkt sich das.
 */
export function CleaningInstallCard() {
  const canPrompt = useInstallPrompt()
  const [dismissed, setDismissed] = useLocalStorage('bss:putzplan:app-hinweis', false)
  const [installed, setInstalled] = useState(false)
  const ios = isIos()

  if (dismissed || installed || isStandalone() || (!canPrompt && !ios)) return null

  const install = async () => {
    if (await promptInstall()) setInstalled(true)
  }

  return (
    <section className="card no-print relative mb-6 flex items-start gap-3 p-4">
      <span className="bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300 grid size-9 shrink-0 place-items-center rounded-lg">
        <Smartphone className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 pr-6">
        <p className="text-sm font-semibold">Den Putzplan als App</p>
        {canPrompt ? (
          <>
            <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
              Auf dem Startbildschirm ist er einen Fingertipp entfernt – ohne Anmeldung.
            </p>
            <button
              type="button"
              className="btn-primary btn-sm mt-3"
              onClick={() => void install()}
            >
              <Download className="size-4" aria-hidden />
              Installieren
            </button>
          </>
        ) : (
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
            Unten in Safari auf das Teilen-Symbol{' '}
            <Share className="inline size-4 align-text-bottom" aria-label="(Teilen)" /> tippen, dann
            «Zum Home-Bildschirm». Auf dem iPhone kommen so auch die Erinnerungen an.
          </p>
        )}
      </div>
      <button
        type="button"
        className="btn-ghost absolute top-2 right-2 p-1.5"
        onClick={() => setDismissed(true)}
        aria-label="Hinweis ausblenden"
        title="Hinweis ausblenden"
      >
        <X className="size-4" aria-hidden />
      </button>
    </section>
  )
}
