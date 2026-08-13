import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, ArrowRight, ChevronDown, Inbox } from 'lucide-react'
import { AppMenuButton } from '@/components/AppMenuButton'
import { cn } from '@/lib/utils'
import {
  IMPULSE_SECTIONS,
  type ImpulseDeckSectionKey,
  type ImpulseSection,
  type ImpulseSectionKey,
} from '@/lib/impulseSections'

/*
 * Der Vollbild-Feed des Bereichs «Impuls» – eine Karte, der ganze
 * Bildschirm, sonst nichts als der Menüknopf oben links.
 *
 * Geöffnet wird er mit einem Tipp auf den Wochenimpuls des Dashboards
 * (oder über das Menü, `/impuls/<bereich>`): Alle Kacheln verschwinden,
 * die erste Karte ist der Wochenimpuls. Ein Wisch nach unten bringt die
 * nächste Karte (Quizfrage, Bilderrätsel, Frage der Woche, die
 * Feed-Karten, die Teilen-Aufgabe) – nativer Scroll-Snap, wischen am
 * Telefon, Rad oder Pfeiltasten am Rechner. Kein Endlos-Feed: Nach der
 * letzten Karte ist Schluss.
 *
 * **Vertiefen:** Trägt eine Karte eine Vertiefung, pulst am rechten Rand
 * ein Pfeil («Vertiefen»). Ein Wisch nach links – der Finger fährt von
 * rechts nach links – holt die Vertiefungskarte vom rechten Rand herein;
 * derselbe Weg zurück (oder der Pfeil «Zurück») führt zur Karte. Auch das
 * ist nativer Scroll-Snap, nur quer: zwei Seiten je Karte, und ohne
 * Vertiefung gibt es die zweite Seite gar nicht.
 *
 * Der Feed weiss nichts vom Inhalt der Karten – er bekommt fertige
 * Knoten samt Bereichszuordnung (Farbe, Schleier, Beschriftung) und
 * meldet nach oben, welche Karte gerade im Bild ist (`onActive`, je
 * Karte höchstens einmal in Folge). Wer eine bestimmte Karte
 * aufschlagen will, gibt sie als `initialTarget` (beim Aufbau, ohne
 * Anlauf) oder `target` (später, mit sanfter Fahrt) herein – der Weg
 * des Menüs und der Favoritensammlung.
 */

export interface ImpulseDeckCard {
  /** Eindeutig im Feed – `art-inhaltsId`, z. B. `feed-abc123`. */
  id: string
  section: ImpulseDeckSectionKey
  node: ReactNode
  /** Die Vertiefung der Karte – `null`/`undefined` heisst: keine. */
  deepening?: ReactNode | null
}

export interface ImpulseDeckTarget {
  section: ImpulseSectionKey
  /** Eine bestimmte Karte des Bereichs – sonst die erste. */
  cardId?: string | null
}

/** Wo der öffnende Tipp sass – von dort wächst das Vollbild heran. */
export interface FeedOrigin {
  x: number
  y: number
}

/** Die Zielkarte im Feed – oder −1, wenn es sie nicht (mehr) gibt. */
function targetIndex(cards: ImpulseDeckCard[], target: ImpulseDeckTarget): number {
  if (target.cardId) {
    const exact = cards.findIndex((card) => card.id === target.cardId)
    if (exact >= 0) return exact
  }
  return cards.findIndex((card) => card.section === target.section)
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function ImpulseFeedScreen({
  cards,
  initialTarget,
  target,
  origin,
  onActive,
  onClose,
}: {
  cards: ImpulseDeckCard[]
  /** Wo der Feed aufgeschlagen wird – gesetzt vor dem ersten Bild. */
  initialTarget?: ImpulseDeckTarget | null
  /**
   * Ein späterer Sprung (Menü, Favoriten): Jedes neue Objekt fährt die
   * Zielkarte an – dieselbe Karte erneut gewählt ist ein neues Objekt.
   */
  target?: ImpulseDeckTarget | null
  origin?: FeedOrigin | null
  onActive?: (card: ImpulseDeckCard) => void
  /** Escape schliesst den Feed – der Menüknopf und Zurück tun es auch. */
  onClose: () => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const initialIndex = initialTarget ? Math.max(targetIndex(cards, initialTarget), 0) : 0
  const [index, setIndex] = useState(initialIndex)

  /* Hinter dem Vollbild soll nichts mitrollen – wie in den Räumen. */
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  /* Beim Öffnen den Fokus in den Feed holen – Escape führt hinaus. */
  useEffect(() => {
    containerRef.current?.focus({ preventScroll: true })
  }, [])
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /* Der Einstieg – vor dem ersten Bild gesetzt, nichts rollt. */
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
      behavior: reducedMotion() ? 'auto' : 'smooth',
    })
  }

  /* Sprünge von aussen: jedes neue Zielobjekt fährt seine Karte an. */
  useEffect(() => {
    if (!target) return
    const nextIndex = targetIndex(cards, target)
    if (nextIndex >= 0) jumpTo(nextIndex)
    // Karten wechseln nur zusammen mit einem neuen Feed-Key – das Ziel
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

  return createPortal(
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label="Impuls der Woche"
      data-testid="impulse-feed"
      className="imp-screen fixed inset-0 z-50 overflow-hidden bg-slate-50 outline-none dark:bg-slate-950"
      style={{ transformOrigin: origin ? `${origin.x}px ${origin.y}px` : '50% 40%' }}
    >
      {/* Der einzige Rest der Navigation: der Menüknopf oben links –
          er schwebt über der Karte, die Karten halten ihm Platz frei. */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 pt-safe">
        <div className="flex items-center px-3 py-2">
          <span className="pointer-events-auto rounded-full bg-white/60 backdrop-blur-sm dark:bg-slate-950/50">
            <AppMenuButton />
          </span>
        </div>
      </header>

      {cards.length === 0 ? (
        <div className="grid h-full place-items-center px-6 text-center">
          <div>
            <Inbox className="mx-auto size-6 text-slate-400" aria-hidden />
            <p className="mt-2 text-sm font-medium">Diese Woche ist noch nichts aufgeschaltet</p>
            <p className="hint mx-auto mt-1 max-w-sm">
              Schau später wieder vorbei – der nächste Impuls kommt.
            </p>
          </div>
        </div>
      ) : (
        <div
          ref={containerRef}
          onScroll={onScroll}
          tabIndex={0}
          aria-label="Karten der Woche"
          className="no-scrollbar h-full snap-y snap-mandatory overflow-y-auto outline-none"
        >
          {cards.map((card, cardIndex) => (
            <FeedCard key={card.id} card={card} index={cardIndex} total={cards.length} />
          ))}
        </div>
      )}

      {/* Solange noch etwas kommt: der stille Hinweis nach unten. */}
      {index < cards.length - 1 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 pb-safe">
          <ChevronDown
            className="mx-auto mb-1.5 size-4 text-slate-400/80 dark:text-slate-500/80"
            aria-hidden
          />
        </div>
      )}
    </div>,
    document.body,
  )
}

/* ------------------------------------------------------------------ */
/* Eine Karte des Feeds – mit ihrer Vertiefung als zweiter Seite        */
/* ------------------------------------------------------------------ */

function FeedCard({
  card,
  index,
  total,
}: {
  card: ImpulseDeckCard
  index: number
  total: number
}) {
  const theme = IMPULSE_SECTIONS[card.section]
  const hasDeepening = Boolean(card.deepening)
  const panesRef = useRef<HTMLDivElement>(null)
  const [pane, setPane] = useState(0)

  const onPaneScroll = () => {
    const element = panesRef.current
    if (!element || element.clientWidth === 0) return
    setPane(Math.round(element.scrollLeft / element.clientWidth))
  }

  const goToPane = (nextPane: number) => {
    const element = panesRef.current
    if (!element) return
    element.scrollTo({
      left: nextPane * element.clientWidth,
      behavior: reducedMotion() ? 'auto' : 'smooth',
    })
  }

  return (
    <section
      aria-label={theme.label}
      className="relative h-full snap-start snap-always overflow-hidden"
    >
      {/* Der Farbschleier des Bereichs – dieselbe Sprache wie in den
          Vollbild-Räumen: oben getönt, unten still, hinter dem Inhalt. */}
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 h-44 bg-gradient-to-b to-transparent',
          theme.wash,
        )}
      />

      {hasDeepening ? (
        <div
          ref={panesRef}
          onScroll={onPaneScroll}
          className="no-scrollbar flex h-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
        >
          <div className="h-full w-full shrink-0 snap-start snap-always">
            <CardPane theme={theme} label={theme.label} counter={`${index + 1}/${total}`}>
              {card.node}
            </CardPane>
          </div>
          <div className="h-full w-full shrink-0 snap-start snap-always">
            <CardPane theme={theme} label={`${theme.label} · Vertiefung`}>
              {card.deepening}
            </CardPane>
          </div>
        </div>
      ) : (
        <CardPane theme={theme} label={theme.label} counter={`${index + 1}/${total}`}>
          {card.node}
        </CardPane>
      )}

      {/* Der Wisch-Hinweis: Nur Karten mit Vertiefung zeigen den Pfeil –
          er pulst nach links, die Richtung des Fingers, und ist zugleich
          ein Knopf für alle ohne Wischfläche. */}
      {hasDeepening && pane === 0 && (
        <button
          type="button"
          onClick={() => goToPane(1)}
          className={cn(
            'absolute top-1/2 right-1 z-20 flex -translate-y-1/2 flex-col items-center gap-1 px-1 py-2',
            theme.text,
          )}
          aria-label="Vertiefung öffnen"
        >
          <span
            className="animate-imp-nudge grid size-8 place-items-center rounded-full border border-slate-200/70 bg-white/85 shadow-xs backdrop-blur-sm dark:border-slate-700/70 dark:bg-slate-900/85"
            aria-hidden
          >
            <ArrowLeft className="size-4" />
          </span>
          <span className="text-[10px] font-medium">Vertiefen</span>
        </button>
      )}
      {hasDeepening && pane === 1 && (
        <button
          type="button"
          onClick={() => goToPane(0)}
          className={cn(
            'absolute top-1/2 left-1 z-20 flex -translate-y-1/2 flex-col items-center gap-1 px-1 py-2',
            theme.text,
          )}
          aria-label="Zurück zur Karte"
        >
          <span
            className="grid size-8 place-items-center rounded-full border border-slate-200/70 bg-white/85 shadow-xs backdrop-blur-sm dark:border-slate-700/70 dark:bg-slate-900/85"
            aria-hidden
          >
            <ArrowRight className="size-4" />
          </span>
          <span className="text-[10px] font-medium">Zurück</span>
        </button>
      )}
    </section>
  )
}

/**
 * Eine Seite einer Karte: Bereichszeile oben (mit Platz für den
 * Menüknopf), der Inhalt in der Mitte – und eigenes, senkrechtes Rollen,
 * falls er höher ist als der Bildschirm.
 */
function CardPane({
  theme,
  label,
  counter,
  children,
}: {
  theme: ImpulseSection
  label: string
  counter?: string
  children: ReactNode
}) {
  return (
    <div className="relative flex h-full flex-col overflow-y-auto px-4 pt-safe pb-10 sm:px-6">
      <p
        className={cn(
          'mt-2.5 flex shrink-0 items-center gap-1.5 ps-11 text-xs font-medium',
          theme.text,
        )}
      >
        <span
          className={cn('grid size-6 shrink-0 place-items-center rounded-md', theme.iconBox)}
          aria-hidden
        >
          <theme.icon className="size-3.5" />
        </span>
        <span className="truncate">{label}</span>
        {counter && (
          <span className="tabular ms-auto font-normal text-slate-400 dark:text-slate-500">
            {counter}
          </span>
        )}
      </p>
      {/* `m-auto` statt `justify-center`: zentriert, solange die Karte
          Luft hat – und rollt sauber, sobald der Inhalt höher ist. */}
      <div className="mx-auto my-auto w-full max-w-xl py-4">{children}</div>
    </div>
  )
}
