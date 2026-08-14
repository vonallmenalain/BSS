import { useState } from 'react'
import { Check, HeartHandshake } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { cn } from '@/lib/utils'
import { ContributorLine, SourceLink } from '@/components/impulse/ImpulseCards'
import { ImpulseCardActions } from '@/components/impulse/ImpulseCardActions'
import { setImpulseWeekShare } from '@/services/impulse'
import type { ImpulseItem, ImpulseProgress } from '@/lib/types'

/**
 * Die Teilen-Aufgabe – die Einladung, das Wochenthema aus der App
 * hinauszutragen: ein Gespräch mit der Familie, eine Frage an einen
 * Freund, ein Erlebnis erzählen. Sie ist bewusst die letzte Karte des
 * Vollbild-Feeds – erst lesen, dann weitergeben.
 *
 * Ein Haken wie beim Wochenziel: Selbstauskunft, umhakbar, gespeichert am
 * eigenen Fortschrittsdokument (`weeks[week].share`) – und er zählt als
 * Beteiligung der Woche. Im Vorschau-Modus lebt der Haken nur im Fenster.
 */
export function ImpulseShareCard({
  item,
  week,
  done,
  preview = false,
  plain = false,
  progressDocs,
}: {
  item: ImpulseItem
  week: string
  done: boolean
  preview?: boolean
  /** Ohne Bereichszeile – im Vollbild steht der Bereich schon im Kopf. */
  plain?: boolean
  /** Mit Fortschrittsbestand trägt auch das Teilen «Amen» und «Merken». */
  progressDocs?: ImpulseProgress[]
}) {
  const { profile } = useAuth()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [previewDone, setPreviewDone] = useState(false)
  /* Wie beim Wochenziel: Nur der eben gesetzte Haken springt herein –
     eine schon besprochene Aufgabe steht beim Öffnen still da. */
  const [celebrate, setCelebrate] = useState(false)

  const isDone = preview ? previewDone : done

  const toggle = async () => {
    setCelebrate(!isDone)
    if (preview) {
      setPreviewDone((value) => !value)
      return
    }
    if (!profile || busy) return
    setBusy(true)
    try {
      const outcome = await setImpulseWeekShare(
        { uid: profile.id, displayName: profile.displayName },
        week,
        !done,
      )
      toast.saved(!done ? 'Schön, dass ihr gesprochen habt!' : 'Haken zurückgenommen.', outcome)
    } catch (error) {
      console.error(error)
      toast.error('Das konnte nicht gespeichert werden.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={plain ? undefined : 'card p-5'}>
      {!plain && (
        <p className="hint flex items-center gap-1.5 font-medium">
          <HeartHandshake className="size-4" aria-hidden />
          Teilen
        </p>
      )}
      <h2
        className={plain ? 'text-lg font-semibold text-balance' : 'mt-2 text-lg font-semibold text-balance'}
      >
        {item.title}
      </h2>
      {item.body && (
        <p className="mt-2 text-sm whitespace-pre-line text-slate-600 dark:text-slate-300">
          {item.body}
        </p>
      )}
      {item.source?.label && (
        <div className="mt-3">
          <SourceLink item={item} />
        </div>
      )}
      <ContributorLine item={item} />

      {/* Der Haken der Aufgabe – dieselbe Sprache wie das Wochenziel:
          Selbstauskunft, kein Nachfragen, und der Moment darf springen. */}
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={busy}
        aria-pressed={isDone}
        className={cn(
          'mt-4 flex w-full items-center gap-2.5 rounded-lg border p-3 text-left text-sm font-medium transition active:scale-[0.98]',
          isDone
            ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
            : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60',
        )}
      >
        <span
          className={cn(
            'grid size-5 shrink-0 place-items-center rounded-md border',
            isDone
              ? 'border-emerald-600 bg-emerald-600 text-white'
              : 'border-slate-300 dark:border-slate-600',
          )}
          aria-hidden
        >
          {isDone && <Check className={cn('size-3.5', celebrate && 'animate-scale-in')} />}
        </span>
        {isDone ? (
          <span className={celebrate ? 'animate-fade-in' : undefined}>Besprochen!</span>
        ) : (
          'Besprochen? Hier abhaken.'
        )}
      </button>

      {progressDocs && (
        <ImpulseCardActions
          item={item}
          progressDocs={progressDocs}
          preview={preview}
          centered={false}
        />
      )}
    </section>
  )
}
