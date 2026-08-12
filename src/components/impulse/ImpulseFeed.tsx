import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bookmark, HandHeart, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { cn } from '@/lib/utils'
import { IMPULSE_SECTIONS } from '@/lib/impulseSections'
import { ContributorLine, SourceLink } from '@/components/impulse/ImpulseCards'
import { markImpulseFeedDone, setImpulseAmen, setImpulseFavorite } from '@/services/impulse'
import type { ImpulseItem, ImpulseProgress } from '@/lib/types'
import type { ScreenOrigin } from '@/components/impulse/ImpulseScreen'

/**
 * Der Impuls-Feed: Karte für Karte, mit dem Daumen – die Form von Reels,
 * gefüllt mit Substanz und **endlich**: Nach der letzten Karte kommt die
 * Schlusskarte, kein Nachschub (Leitgedanke 6). Geblättert wird mit
 * nativem Scroll-Snap – wischen am Telefon, Rad oder Pfeiltasten am
 * Rechner.
 *
 * Zwei stille Knöpfe je Karte: **«Amen»** (die eine Reaktion – darunter
 * stehen Vornamen, keine Zählstände) und **Merken** für die eigene
 * Favoritensammlung. Wer die Schlusskarte erreicht, hat den Feed der
 * Woche durchgetippt – das zählt zur Beteiligung, einmal und still.
 *
 * Im Vorschau-Modus wird nichts gespeichert; Amen und Merken leben nur im
 * Fenster.
 */
export function ImpulseFeed({
  week,
  cards,
  progressDocs,
  feedDone,
  preview = false,
  initialItemId,
  origin,
  onClose,
}: {
  week: string
  cards: ImpulseItem[]
  progressDocs: ImpulseProgress[]
  /** Schon einmal bis zur Schlusskarte gekommen – dann wird nichts mehr geschrieben. */
  feedDone: boolean
  preview?: boolean
  /** Bei dieser Karte einsteigen – der Weg von «Gemerkt» zurück zur Karte. */
  initialItemId?: string | null
  /** Wo der öffnende Tipp sass – von dort wächst der Feed heran. */
  origin?: ScreenOrigin | null
  onClose: () => void
}) {
  const { profile } = useAuth()
  const toast = useToast()
  const containerRef = useRef<HTMLDivElement>(null)
  const [closing, setClosing] = useState(false)
  const marked = useRef(feedDone)

  /*
   * Der Einstieg: normal bei der ersten Karte – oder direkt bei der
   * gemerkten, ohne Anlauf (vor dem ersten Bild gesetzt, nichts rollt).
   */
  const initialIndex = initialItemId
    ? Math.max(
        cards.findIndex((card) => card.id === initialItemId),
        0,
      )
    : 0
  const [index, setIndex] = useState(initialIndex)
  useLayoutEffect(() => {
    const element = containerRef.current
    if (!element || initialIndex === 0) return
    element.scrollTop = initialIndex * element.clientHeight
    // Nur beim Öffnen – danach führt der Daumen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [previewAmens, setPreviewAmens] = useState<ReadonlySet<string>>(new Set())
  const [previewFavorites, setPreviewFavorites] = useState<ReadonlySet<string>>(new Set())

  const uid = profile?.id ?? ''
  const mine = progressDocs.find((progress) => progress.uid === uid)
  const myAmens = preview ? previewAmens : new Set(mine?.amens ?? [])
  const myFavorites = preview ? previewFavorites : new Set(mine?.favorites ?? [])

  /** Wer zu dieser Karte «Amen» gesagt hat – Vornamen, alphabetisch. */
  const amenNames = (itemId: string): string[] =>
    preview
      ? []
      : progressDocs
          .filter((progress) => progress.amens?.includes(itemId))
          .map((progress) => progress.firstName || '–')
          .sort((a, b) => a.localeCompare(b, 'de'))

  const total = cards.length

  /* Hinter dem Feed soll nichts mitrollen. */
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  /*
   * Schliessen mit kurzem Abgang (150 ms), wie die Vollbild-Räume der
   * anderen Bereiche – Escape schliesst, wie ein Fenster. Bei reduzierter
   * Bewegung geht es sofort.
   */
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })
  const closingRef = useRef(false)
  const close = () => {
    if (closingRef.current) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      closeRef.current()
      return
    }
    closingRef.current = true
    setClosing(true)
    window.setTimeout(() => closeRef.current(), 150)
  }
  const closeHandler = useRef(close)
  useEffect(() => {
    closeHandler.current = close
  })
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeHandler.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /*
   * Die Schlusskarte erreicht: einmal festhalten, still. Kein Toast –
   * die Karte selbst ist die Belohnung, und der Einstieg zeigt danach
   * «durchgetippt».
   */
  useEffect(() => {
    if (preview || marked.current || !profile || total === 0) return
    if (index >= total) {
      marked.current = true
      markImpulseFeedDone({ uid: profile.id, displayName: profile.displayName }, week).catch(
        (error) => {
          console.error(error)
          marked.current = false
        },
      )
    }
  }, [index, total, preview, profile, week])

  const onScroll = () => {
    const element = containerRef.current
    if (!element || element.clientHeight === 0) return
    setIndex(Math.round(element.scrollTop / element.clientHeight))
  }

  const toggleAmen = async (item: ImpulseItem) => {
    if (preview) {
      setPreviewAmens((current) => {
        const next = new Set(current)
        if (next.has(item.id)) next.delete(item.id)
        else next.add(item.id)
        return next
      })
      return
    }
    if (!profile) return
    try {
      await setImpulseAmen(
        { uid: profile.id, displayName: profile.displayName },
        item.id,
        !myAmens.has(item.id),
      )
    } catch (error) {
      console.error(error)
      toast.error('Das konnte nicht gespeichert werden.')
    }
  }

  const toggleFavorite = async (item: ImpulseItem) => {
    if (preview) {
      setPreviewFavorites((current) => {
        const next = new Set(current)
        if (next.has(item.id)) next.delete(item.id)
        else next.add(item.id)
        return next
      })
      return
    }
    if (!profile) return
    try {
      await setImpulseFavorite(
        { uid: profile.id, displayName: profile.displayName },
        item.id,
        !myFavorites.has(item.id),
      )
    } catch (error) {
      console.error(error)
      toast.error('Das konnte nicht gespeichert werden.')
    }
  }

  return createPortal(
    <div
      data-closing={closing || undefined}
      className="imp-screen fixed inset-0 z-50 flex flex-col bg-slate-50 dark:bg-slate-950"
      style={{ transformOrigin: origin ? `${origin.x}px ${origin.y}px` : '50% 40%' }}
    >
      {/* Der Schleier des Feeds – dieselbe Sprache wie die anderen Räume. */}
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b to-transparent',
          IMPULSE_SECTIONS.feed.wash,
        )}
      />
      <header className="relative flex items-center gap-3 px-4 py-2.5 pt-safe">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400" aria-live="polite">
          {preview && 'Vorschau · '}
          {index < total ? `${index + 1} von ${total}` : 'Geschafft'}
        </p>
        <button
          type="button"
          className="btn-ghost ms-auto rounded-full p-2 active:scale-95"
          onClick={close}
          aria-label="Feed schliessen"
        >
          <X className="size-5" aria-hidden />
        </button>
      </header>

      <div
        ref={containerRef}
        onScroll={onScroll}
        className="relative flex-1 snap-y snap-mandatory overflow-y-auto overscroll-contain"
      >
        {cards.map((card) => {
          const names = amenNames(card.id)
          const amen = myAmens.has(card.id)
          const favorite = myFavorites.has(card.id)
          return (
            <section
              key={card.id}
              className="flex h-full snap-start flex-col items-center justify-center gap-6 px-6 py-8"
            >
              <div className="w-full max-w-md text-center">
                <h2 className="text-2xl leading-snug font-semibold text-balance">{card.title}</h2>
                {card.body && (
                  <p className="mt-3 text-sm whitespace-pre-line text-slate-600 dark:text-slate-300">
                    {card.body}
                  </p>
                )}
                <div className="mt-4 flex flex-col items-center">
                  <SourceLink item={card} />
                  <ContributorLine item={card} />
                </div>
              </div>

              <div className="w-full max-w-md text-center">
                <div className="flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => void toggleAmen(card)}
                    aria-pressed={amen}
                    className={cn(
                      'btn-secondary',
                      amen &&
                        'border-brand-500 bg-brand-50 text-brand-800 dark:border-brand-500 dark:bg-brand-950 dark:text-brand-200',
                    )}
                  >
                    <HandHeart className={cn('size-4', amen && 'fill-current')} aria-hidden />
                    Amen
                  </button>
                  <button
                    type="button"
                    onClick={() => void toggleFavorite(card)}
                    aria-pressed={favorite}
                    className={cn(
                      'btn-secondary',
                      favorite &&
                        'border-brand-500 bg-brand-50 text-brand-800 dark:border-brand-500 dark:bg-brand-950 dark:text-brand-200',
                    )}
                  >
                    <Bookmark className={cn('size-4', favorite && 'fill-current')} aria-hidden />
                    {favorite ? 'Gemerkt' : 'Merken'}
                  </button>
                </div>
                {names.length > 0 && (
                  <p className="hint mt-2">Amen von {names.join(', ')}</p>
                )}
              </div>
            </section>
          )
        })}

        {/* Die Schlusskarte – der Feed ist endlich, und genau das ist die
            Botschaft: Das Telefon kann auch auftanken statt absaugen. */}
        <section className="flex h-full snap-start flex-col items-center justify-center px-6 text-center">
          <p className="text-2xl font-semibold text-balance">Das war’s für diese Woche.</p>
          <p className="mt-2 max-w-sm text-sm text-slate-600 dark:text-slate-300">
            Stark, dass du da warst – hier kommt nichts mehr nach. Der nächste Feed wartet am
            Montag.
          </p>
          <button type="button" className="btn-primary mt-6 active:scale-[0.98]" onClick={close}>
            Zurück zum Impuls
          </button>
        </section>
      </div>
    </div>,
    document.body,
  )
}
