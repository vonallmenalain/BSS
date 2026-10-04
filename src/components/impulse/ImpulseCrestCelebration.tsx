import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ImpulseCrestEmblem } from '@/components/impulse/ImpulseCrest'
import type { ImpulseCrestStars } from '@/lib/impulse'
import type { ImpulseCrest } from '@/lib/types'

/**
 * Der Moment, auf den die Woche hinläuft: Das Wappen steht ganz da.
 *
 * Ein Vollbild über allem – auch über dem Feed –, das Wappen gross, mit
 * Glanz, Funken und dem entrollten Band. Darunter, was es heisst: alle
 * Karten geschafft, und wenn es vor Sonntag war, «bereit für Sonntag».
 * Die beiden übrigen Sterne (Wochenziel, Tages-Challenge) stehen als
 * Einladung da, nicht als Mahnung.
 *
 * Gezeigt wird die Feier einmal je Woche und Gerät – die Seite merkt
 * sich, wann sie gefeiert hat (siehe `Impuls`). Ein Tipp daneben, der
 * Knopf oder Escape schliesst sie.
 */
export function ImpulseCrestCelebration({
  open,
  crest,
  week,
  total,
  stars,
  onClose,
}: {
  open: boolean
  crest: ImpulseCrest
  week: string
  total: number
  stars: ImpulseCrestStars
  onClose: () => void
}) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })

  useEffect(() => {
    if (!open) return
    buttonRef.current?.focus({ preventScroll: true })
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null

  const extras = [
    stars.goal === false && 'das Wochenziel',
    stars.challenge === false && 'die Tages-Challenge an allen sieben Tagen',
  ].filter((entry): entry is string => Boolean(entry))

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Wochen-Wappen vollendet"
      className="animate-fade-in fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-slate-950/85 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="animate-imp-pop w-full max-w-sm text-center text-white"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="text-xs font-semibold tracking-[0.25em] text-amber-300 uppercase">
          Wappen vollendet
        </p>
        <div className="mt-5 flex justify-center">
          <ImpulseCrestEmblem
            crest={crest}
            week={week}
            done={total}
            total={total}
            stars={stars}
            celebrate
            size={220}
          />
        </div>
        <h2 className="mt-5 text-2xl leading-tight font-bold text-balance">
          {stars.sunday ? 'Bereit für Sonntag!' : 'Stark – alles geschafft!'}
        </h2>
        <p className="mt-2 text-sm text-slate-300">
          {stars.sunday
            ? 'Alle Karten der Woche geschafft – und das vor Sonntag. Du gehst vorbereitet in die Klasse.'
            : 'Alle Karten der Woche geschafft. Dein Wappen steht – und bleibt in deiner Sammlung.'}
        </p>

        <ul className="mx-auto mt-4 flex max-w-xs flex-col gap-1.5 text-left text-sm">
          <StarLine earned={stars.sunday} label="Vor Sonntag vollendet" />
          {stars.goal !== null && <StarLine earned={stars.goal} label="Wochenziel geschafft" />}
          {stars.challenge !== null && (
            <StarLine earned={stars.challenge} label="Tages-Challenge an allen 7 Tagen" />
          )}
        </ul>
        {extras.length > 0 && (
          <p className="mt-3 text-xs text-slate-400">
            Noch offen: {extras.join(' und ')} – die Woche läuft noch.
          </p>
        )}

        <button
          ref={buttonRef}
          type="button"
          onClick={onClose}
          className="mt-6 inline-flex items-center justify-center rounded-full bg-amber-400 px-7 py-3 text-sm font-semibold text-amber-950 shadow-lg transition hover:bg-amber-300 active:scale-[0.97]"
        >
          Weiter
        </button>
      </div>
    </div>,
    document.body,
  )
}

function StarLine({ earned, label }: { earned: boolean; label: string }) {
  return (
    <li className={cn('flex items-center gap-2', earned ? 'text-amber-200' : 'text-slate-400')}>
      <Star
        className={cn(
          'size-4 shrink-0',
          earned ? 'fill-amber-400 text-amber-400' : 'text-slate-500',
        )}
        aria-hidden
      />
      <span>
        <span className="sr-only">{earned ? 'Erreicht: ' : 'Noch offen: '}</span>
        {label}
      </span>
    </li>
  )
}
