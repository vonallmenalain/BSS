import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  IMPULSE_SECTIONS,
  type ImpulseDeckSectionKey,
  type ImpulseSectionKey,
} from '@/lib/impulseSections'

/*
 * Der Wischstapel des Bereichs «Impuls» – die Hauptseite in Kartenform.
 *
 * Eine Karte, ein Inhalt: oben liegt der Wochenimpuls, ein Wisch nach
 * unten bringt die nächste Karte (Quizfrage, Wochenziel, …), und nach der
 * letzten kommt nichts nach – der Stapel ist endlich, wie der Feed es
 * vorgemacht hat. Geblättert wird mit nativem Scroll-Snap: wischen am
 * Telefon, Rad oder Pfeiltasten am Rechner. Rechts eine stille
 * Punktleiste als Landkarte (tippbar), unten ein kleiner Pfeil, solange
 * noch etwas kommt.
 *
 * Der Stapel weiss nichts vom Inhalt der Karten – er bekommt fertige
 * Knoten samt Bereichszuordnung (Farbe, Schleier, Beschriftung) und
 * meldet nach oben, welche Karte gerade im Bild ist (`onActive`, je
 * Karte höchstens einmal in Folge). Wer eine bestimmte Karte
 * aufschlagen will, gibt sie als `initialTarget` (beim Aufbau, ohne
 * Anlauf) oder `target` (später, mit sanfter Fahrt) herein – der Weg
 * des Menüs und der Favoritensammlung.
 */

export interface ImpulseDeckCard {
  /** Eindeutig im Stapel – `art-inhaltsId`, z. B. `feed-abc123`. */
  id: string
  section: ImpulseDeckSectionKey
  node: ReactNode
}

export interface ImpulseDeckTarget {
  section: ImpulseSectionKey
  /** Eine bestimmte Karte des Bereichs – sonst die erste. */
  cardId?: string | null
}

/** Die Zielkarte im Stapel – oder −1, wenn es sie nicht (mehr) gibt. */
function targetIndex(cards: ImpulseDeckCard[], target: ImpulseDeckTarget): number {
  if (target.cardId) {
    const exact = cards.findIndex((card) => card.id === target.cardId)
    if (exact >= 0) return exact
  }
  return cards.findIndex((card) => card.section === target.section)
}

export function ImpulseDeck({
  cards,
  initialTarget,
  target,
  onActive,
}: {
  cards: ImpulseDeckCard[]
  /** Wo der Stapel aufgeschlagen wird – gesetzt vor dem ersten Bild. */
  initialTarget?: ImpulseDeckTarget | null
  /**
   * Ein späterer Sprung (Menü, Favoriten): Jedes neue Objekt fährt die
   * Zielkarte an – dieselbe Karte erneut gewählt ist ein neues Objekt.
   */
  target?: ImpulseDeckTarget | null
  onActive?: (card: ImpulseDeckCard) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const initialIndex = initialTarget ? Math.max(targetIndex(cards, initialTarget), 0) : 0
  const [index, setIndex] = useState(initialIndex)

  /* Der Einstieg – vor dem ersten Bild gesetzt, nichts rollt (wie im
     alten Feed-Vollbild). */
  useLayoutEffect(() => {
    const element = containerRef.current
    if (!element || initialIndex === 0) return
    element.scrollTop = initialIndex * element.clientHeight
    // Nur beim Aufbau – danach führt der Daumen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const jumpTo = (nextIndex: number) => {
    const element = containerRef.current
    if (!element) return
    element.scrollTo({
      top: nextIndex * element.clientHeight,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    })
  }

  /* Sprünge von aussen: jedes neue Zielobjekt fährt seine Karte an. */
  useEffect(() => {
    if (!target) return
    const nextIndex = targetIndex(cards, target)
    if (nextIndex >= 0) jumpTo(nextIndex)
    // Karten wechseln nur zusammen mit einem neuen Stapel-Key – das Ziel
    // allein soll den Sprung auslösen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target])

  /* Welche Karte im Bild ist – und die Meldung nach oben, entprellt. */
  const announced = useRef<string | null>(null)
  const active = cards[Math.min(index, cards.length - 1)]
  useEffect(() => {
    if (!active || announced.current === active.id) return
    announced.current = active.id
    onActive?.(active)
  })

  const onScroll = () => {
    const element = containerRef.current
    if (!element || element.clientHeight === 0) return
    setIndex(Math.round(element.scrollTop / element.clientHeight))
  }

  if (cards.length === 0) return null

  return (
    <div className="relative">
      <div
        ref={containerRef}
        onScroll={onScroll}
        tabIndex={0}
        role="region"
        aria-label="Karten der Woche"
        className="no-scrollbar h-[min(60dvh,34rem)] min-h-80 snap-y snap-mandatory overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 shadow-xs dark:border-slate-800 dark:bg-slate-950"
      >
        {cards.map((card, cardIndex) => {
          const theme = IMPULSE_SECTIONS[card.section]
          return (
            <section
              key={card.id}
              aria-label={theme.label}
              className="relative h-full snap-start snap-always overflow-hidden"
            >
              {/* Der Farbschleier des Bereichs – dieselbe Sprache wie in
                  den Vollbild-Räumen: oben getönt, unten still. */}
              <div
                aria-hidden
                className={cn(
                  'pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b to-transparent',
                  theme.wash,
                )}
              />
              <div className="relative flex h-full flex-col overflow-y-auto px-4 pt-3 pb-7 sm:px-6">
                <p className={cn('flex items-center gap-1.5 text-xs font-medium', theme.text)}>
                  <span
                    className={cn(
                      'grid size-6 shrink-0 place-items-center rounded-md',
                      theme.iconBox,
                    )}
                    aria-hidden
                  >
                    <theme.icon className="size-3.5" />
                  </span>
                  {theme.label}
                  <span className="tabular ms-auto font-normal text-slate-400 dark:text-slate-500">
                    {cardIndex + 1}/{cards.length}
                  </span>
                </p>
                {/* `m-auto` statt `justify-center`: zentriert, solange die
                    Karte Luft hat – und rollt sauber, sobald der Inhalt
                    höher ist als die Karte. */}
                <div className="mx-auto my-auto w-full max-w-xl py-3">{card.node}</div>
              </div>
            </section>
          )
        })}
      </div>

      {/* Die Punktleiste: wo man steht, was noch kommt – tippbar. */}
      {cards.length > 1 && (
        <div className="absolute inset-y-0 right-0.5 flex flex-col items-center justify-center">
          {cards.map((card, cardIndex) => (
            <button
              key={card.id}
              type="button"
              onClick={() => jumpTo(cardIndex)}
              aria-label={`Karte ${cardIndex + 1}: ${IMPULSE_SECTIONS[card.section].label}`}
              aria-current={cardIndex === index || undefined}
              className="group grid place-items-center p-1"
            >
              <span
                aria-hidden
                className={cn(
                  'rounded-full transition-all',
                  cardIndex === index
                    ? cn('h-4 w-1.5', IMPULSE_SECTIONS[card.section].bar)
                    : 'size-1.5 bg-slate-300 group-hover:bg-slate-400 dark:bg-slate-700 dark:group-hover:bg-slate-500',
                )}
              />
            </button>
          ))}
        </div>
      )}

      {/* Solange noch etwas kommt: der stille Hinweis nach unten. */}
      {index < cards.length - 1 && (
        <ChevronDown
          className="pointer-events-none absolute bottom-1.5 left-1/2 size-4 -translate-x-1/2 text-slate-400/80 dark:text-slate-500/80"
          aria-hidden
        />
      )}
    </div>
  )
}
