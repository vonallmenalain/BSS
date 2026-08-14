import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, ArrowRight, ChevronDown, Inbox } from 'lucide-react'
import { AppMenuButton } from '@/components/AppMenuButton'
import { cn } from '@/lib/utils'
import { lockScroll } from '@/lib/scrollLock'
import {
  IMPULSE_SECTIONS,
  type ImpulseSection,
  type ImpulseSectionKey,
} from '@/lib/impulseSections'

/*
 * Der Vollbild-Feed des Bereichs «Anti Doom» – eine Karte, der ganze
 * Bildschirm, sonst nichts als der Menüknopf oben links.
 *
 * Geöffnet wird er mit einem Tipp auf das Wochenthema des Dashboards
 * (oder über das Menü, `/anti-doom/<bereich>`): Alle Kacheln verschwinden,
 * die erste Karte ist das Wochenthema. Ein Wisch nach unten bringt die
 * nächste Karte (Quizfrage, Bilderrätsel, Video, Frage der Woche, die
 * Feed-Karten, die Teilen-Aufgabe) – nativer Scroll-Snap, wischen am
 * Telefon, Rad oder Pfeiltasten am Rechner. Kein Endlos-Feed: Nach der
 * letzten Karte gratuliert die Abschlusskarte (`finale`) und zeigt die
 * Wege weiter – noch einmal von vorn, die Mitmach-Ecke, frühere Wochen.
 *
 * **Karten mit Bild oder Video sind zwei Bildschirme hoch.** Der erste
 * gehört allein dem Bild: kein Text, keine Zeile, nichts – so wie man
 * ein Bild anschaut. Der zweite Wisch holt den Text über das Bild, und
 * weil die Bildebene dabei stehen bleibt (`sticky`) und der Text von
 * unten hereinfährt, macht die Bewegung der Browser selbst: keine
 * gerechnete Animation, kein Ruckeln, unterbrechbar in jedem Moment. Das
 * Bild rückt dabei eine Spur näher (`scale`), damit der Wechsel auch
 * dann spürbar ist, wenn der Text kaum Platz braucht.
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

/** Wo eine Karte gerade steht: beim Bild (0) oder beim Text (1). */
export type ImpulseCardStage = 0 | 1

export interface ImpulseDeckCard {
  /** Eindeutig im Feed – `art-inhaltsId`, z. B. `feed-abc123`. */
  id: string
  /** Die Inhalts-ID hinter der Karte – für das Vermerken «angeschaut». */
  itemId?: string
  /*
   * Im Feed der AP's liegen nur Feed-Bereiche; die Vorschau der
   * Redaktion zeigt zusätzlich Wochenziel und Tages-Challenge als
   * Karten – deshalb der breitere Schlüssel.
   */
  section: ImpulseSectionKey
  node: ReactNode
  /**
   * Die Fläche hinter der Karte – ein Bild oder ein Video.
   *
   * Als Funktion und nicht als fertiger Knoten, weil ein Video wissen
   * muss, ob es dran ist: `active` sagt, dass die Karte im Bild steht,
   * `stage`, ob der Text schon darüberliegt. Wer eine Fläche mitgibt,
   * bekommt die zweistufige Karte – erst das Bild allein, dann der Text.
   */
  media?: ((state: { active: boolean; stage: ImpulseCardStage }) => ReactNode) | null
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

/** Wie viele Bildschirme eine Karte einnimmt – mit Bild oder Video zwei. */
function screensOf(card: ImpulseDeckCard): number {
  return card.media ? 2 : 1
}

/** Der Bildschirm, auf dem jede Karte beginnt – und wie viele es sind. */
function screenOffsets(cards: ImpulseDeckCard[]): { offsets: number[]; total: number } {
  const offsets: number[] = []
  let total = 0
  for (const card of cards) {
    offsets.push(total)
    total += screensOf(card)
  }
  return { offsets, total }
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function ImpulseFeedScreen({
  cards,
  initialTarget,
  target,
  origin,
  onActive,
  onDeepening,
  onClose,
  finale,
  banner,
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
  /** Die Vertiefung einer Karte ist ins Bild gerollt – der Wisch nach links. */
  onDeepening?: (card: ImpulseDeckCard) => void
  /** Escape schliesst den Feed – der Menüknopf und Zurück tun es auch. */
  onClose: () => void
  /**
   * Die Abschlusskarte nach der letzten Karte – «alles durchgeschaut».
   * Ihren Inhalt (Glückwunsch, Neustart, Mitmach-Ecke, frühere Wochen)
   * baut die Seite; «noch einmal von vorn» läuft dort über das
   * `target`-Ziel. Ohne `finale` endet der Feed mit der letzten Karte.
   */
  finale?: ReactNode
  /**
   * Eine Leiste über dem Feed – der Vorschau-Modus der Redaktion.
   *
   * Mit Leiste verschwindet der Menüknopf, die Leiste steht im Fluss
   * (der Feed rollt darunter), und die Karten rücken nach oben auf:
   * Der Platz, den sonst der schwebende Menüknopf braucht, gehört dann
   * der Leiste.
   */
  banner?: ReactNode
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const { offsets, total: cardScreens } = screenOffsets(cards)
  const initialCard = initialTarget ? Math.max(targetIndex(cards, initialTarget), 0) : 0
  const [index, setIndex] = useState(initialCard)
  /* Beim Bild (0) oder beim Text (1) – nur Karten mit Fläche kennen die 1. */
  const [stage, setStage] = useState<ImpulseCardStage>(0)
  /* Die Anzahl Bilder im Rollcontainer – die Abschlusskarte zählt mit. */
  const totalScreens = cardScreens + (finale && cards.length > 0 ? 1 : 0)
  const [screen, setScreen] = useState(offsets[initialCard] ?? 0)
  /*
   * Einmal unten angekommen, bleibt gefeiert: Der Überschwung der
   * Abschlusskarte (`imp-pop`) tritt an, wenn sie zum ersten Mal ins
   * Bild rollt – und wiederholt sich beim Zurückblättern nicht.
   * Gesetzt wird das im Scroll-Handler, dort entsteht der Stand ohnehin.
   */
  const [celebrated, setCelebrated] = useState(false)

  /* Hinter dem Vollbild soll nichts mitrollen – wie in den Räumen. */
  useEffect(() => lockScroll(), [])

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
    const start = offsets[initialCard] ?? 0
    if (!element || start === 0) return
    element.scrollTop = start * element.clientHeight
    // Nur beim Aufbau – danach führt der Daumen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const jumpTo = (cardIndex: number) => {
    const element = containerRef.current
    if (!element) return
    element.scrollTo({
      top: (offsets[cardIndex] ?? 0) * element.clientHeight,
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
    const next = Math.round(element.scrollTop / element.clientHeight)
    setScreen(next)
    /* Vom Bildschirm zur Karte: Die letzte Karte, die nicht später
       beginnt, ist die im Bild – und der Abstand dazu die Bühne. */
    let cardIndex = 0
    for (let i = 0; i < offsets.length; i += 1) {
      if (offsets[i] <= next) cardIndex = i
      else break
    }
    setIndex(cardIndex)
    setStage(next - (offsets[cardIndex] ?? 0) >= 1 ? 1 : 0)
    if (finale && cards.length > 0 && next >= cardScreens) setCelebrated(true)
  }

  return createPortal(
    /* z-40, eine Ebene unter der Navigations-Schublade der Hülle (z-50):
       Der Menüknopf unten öffnet sie, und sie muss über dem Feed liegen –
       als Portal käme der Feed sonst später im DOM und deckte sie zu.
       Die Vorschau (mit Leiste) dagegen muss ÜBER allem liegen – sie
       wird auch aus den Vollbild-Räumen (z-50) heraus geöffnet, und ohne
       Menüknopf gibt es unter ihr nichts mehr zu erreichen. */
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label="Anti Doom – die Karten der Woche"
      data-testid="impulse-feed"
      className={cn(
        'imp-screen fixed inset-0 flex flex-col overflow-hidden bg-slate-50 outline-none dark:bg-slate-950',
        banner ? 'z-[55]' : 'z-40',
      )}
      style={{ transformOrigin: origin ? `${origin.x}px ${origin.y}px` : '50% 40%' }}
    >
      {banner ? (
        /* Der Vorschau-Modus: die Leiste steht im Fluss und nimmt dem
           Feed ihre Höhe weg – nichts verschwindet hinter ihr. */
        <div className="relative z-20 shrink-0">{banner}</div>
      ) : (
        /* Der einzige Rest der Navigation: der Menüknopf oben links – ohne
           hinterlegte Fläche, transparent über dem Farbschleier; erst der
           Hover des Knopfs selbst zeichnet seinen Kreis. */
        <header className="pointer-events-none absolute inset-x-0 top-0 z-20 pt-safe">
          <div className="flex items-center px-3 py-2">
            <span className="pointer-events-auto">
              <AppMenuButton />
            </span>
          </div>
        </header>
      )}

      {cards.length === 0 ? (
        <div className="grid min-h-0 flex-1 place-items-center px-6 text-center">
          <div>
            <Inbox className="mx-auto size-6 text-slate-400" aria-hidden />
            <p className="mt-2 text-sm font-medium">Diese Woche ist noch nichts aufgeschaltet</p>
            <p className="hint mx-auto mt-1 max-w-sm">
              Schau später wieder vorbei – das nächste Wochenthema kommt.
            </p>
          </div>
        </div>
      ) : (
        <div
          ref={containerRef}
          onScroll={onScroll}
          tabIndex={0}
          aria-label="Karten der Woche"
          className="no-scrollbar min-h-0 flex-1 snap-y snap-mandatory overflow-y-auto outline-none"
        >
          {cards.map((card, cardIndex) => (
            <FeedCard
              key={card.id}
              card={card}
              index={cardIndex}
              total={cards.length}
              flush={Boolean(banner)}
              active={cardIndex === index}
              stage={cardIndex === index ? stage : 0}
              onDeepening={onDeepening ? () => onDeepening(card) : undefined}
            />
          ))}

          {/* Die Abschlusskarte: nach der letzten Karte ist nicht einfach
              Schluss – sie gratuliert und zeigt die Wege weiter. */}
          {finale && cards.length > 0 && (
            <section
              aria-label="Geschafft"
              className="relative h-full snap-start snap-always overflow-hidden"
            >
              <div
                aria-hidden
                className={cn(
                  'pointer-events-none absolute inset-x-0 top-0 h-3/4 bg-gradient-to-b to-transparent',
                  IMPULSE_SECTIONS.ziel.wash,
                )}
              />
              <CardPane theme={IMPULSE_SECTIONS.ziel} label="Geschafft" flush={Boolean(banner)}>
                {/* Der eine Überschwung des Bereichs – einmal pro Besuch,
                    wenn die Karte zum ersten Mal ins Bild rollt. */}
                <div className={cn(celebrated && 'animate-imp-pop')}>{finale}</div>
              </CardPane>
            </section>
          )}
        </div>
      )}

      {/* Solange noch etwas kommt: der stille Hinweis nach unten. */}
      {screen < totalScreens - 1 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 pb-safe">
          <ChevronDown
            className="mx-auto mb-1.5 size-4 text-slate-500/80 drop-shadow-sm dark:text-slate-400/80"
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
  flush = false,
  active,
  stage,
  onDeepening,
}: {
  card: ImpulseDeckCard
  index: number
  total: number
  /** Vorschau-Modus mit Leiste: kein Menüknopf, dem die Karte Platz liesse. */
  flush?: boolean
  /** Steht diese Karte im Bild? */
  active: boolean
  /** Beim Bild (0) oder beim Text (1)? */
  stage: ImpulseCardStage
  /** Meldet, dass die Vertiefungsseite ins Bild gerollt ist. */
  onDeepening?: () => void
}) {
  const theme = IMPULSE_SECTIONS[card.section]
  const hasDeepening = Boolean(card.deepening)
  const panesRef = useRef<HTMLDivElement>(null)
  const [pane, setPane] = useState(0)

  const onPaneScroll = () => {
    const element = panesRef.current
    if (!element || element.clientWidth === 0) return
    const next = Math.round(element.scrollLeft / element.clientWidth)
    if (next === 1 && pane !== 1) onDeepening?.()
    setPane(next)
  }

  const goToPane = (nextPane: number) => {
    const element = panesRef.current
    if (!element) return
    element.scrollTo({
      left: nextPane * element.clientWidth,
      behavior: reducedMotion() ? 'auto' : 'smooth',
    })
  }

  /* Die beiden Seiten einer Karte – die Karte selbst und ihre
     Vertiefung – samt der Pfeile, die den Wisch anbieten. */
  const body = (over = false) => (
    <>
      {hasDeepening ? (
        <div
          ref={panesRef}
          onScroll={onPaneScroll}
          className="no-scrollbar flex h-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
        >
          <div className="h-full w-full shrink-0 snap-start snap-always">
            <CardPane
              theme={theme}
              label={theme.label}
              counter={`${index + 1}/${total}`}
              flush={flush}
              over={over}
            >
              {card.node}
            </CardPane>
          </div>
          <div className="h-full w-full shrink-0 snap-start snap-always">
            <CardPane theme={theme} label={`${theme.label} · Vertiefung`} flush={flush} over={over}>
              {card.deepening}
            </CardPane>
          </div>
        </div>
      ) : (
        <CardPane
          theme={theme}
          label={theme.label}
          counter={`${index + 1}/${total}`}
          flush={flush}
          over={over}
        >
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
    </>
  )

  /*
   * Die Karte mit Fläche: zwei Bildschirme hoch.
   *
   * Der erste gehört dem Bild allein, der zweite holt den Text darüber.
   * Die Bildebene steht im Fluss und klebt oben (`sticky`) – sie bleibt
   * also stehen, während die Textseite darunter hervorkommt und sich
   * darüberschiebt. Kein `overflow-hidden` am Abschnitt: Das machte ihn
   * zum eigenen Rollbereich, und «sticky» hätte nichts, woran es kleben
   * könnte.
   */
  if (card.media) {
    return (
      <section aria-label={theme.label} className="relative h-[200%] snap-start snap-always">
        <div className="sticky top-0 h-1/2 overflow-hidden">
          <div
            className={cn(
              'absolute inset-0 transition-transform duration-700 ease-out',
              stage === 1 && 'scale-[1.06]',
            )}
          >
            {card.media({ active, stage })}
          </div>
        </div>

        {/* Die Textseite: Sie fährt von unten über das Bild – und bringt
            ihren Schleier mit, damit die Schrift auf jedem Bild steht.
            Unten deckt er, oben läuft er aus: So bleibt vom Bild sichtbar,
            was der Text nicht braucht – beim Bilderrätsel die halbe
            Miete. Der Farbschleier des Bereichs bleibt hier weg; die
            Farbe bringt das Bild selbst mit. */}
        <div className="relative h-1/2 snap-start snap-always">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-white from-45% via-white/80 via-70% to-transparent dark:from-slate-950 dark:via-slate-950/80"
          />
          {body(true)}
        </div>
      </section>
    )
  }

  return (
    <section
      aria-label={theme.label}
      className="relative h-full snap-start snap-always overflow-hidden"
    >
      {/* Der Farbschleier des Bereichs – dieselbe Sprache wie in den
          Vollbild-Räumen: oben satt, unten still, hinter dem Inhalt.
          Seit die Karten ohne Kachel dastehen, reicht er weiter herunter
          und trägt das Bild allein. */}
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 h-3/4 bg-gradient-to-b to-transparent',
          theme.wash,
        )}
      />
      {body()}
    </section>
  )
}

/**
 * Eine Seite einer Karte: Bereichszeile oben (mit Platz für den
 * Menüknopf), der Inhalt in der Mitte – und eigenes, senkrechtes Rollen,
 * falls er höher ist als der Bildschirm.
 *
 * Über einem Bild (`over`) rückt der Inhalt nach unten und die
 * Bereichszeile bekommt eine getönte Kapsel: Über einem hellen Himmel
 * wäre blasse Schrift sonst nicht zu lesen.
 */
function CardPane({
  theme,
  label,
  counter,
  flush = false,
  over = false,
  children,
}: {
  theme: ImpulseSection
  label: string
  counter?: string
  /** Unter einer Vorschau-Leiste: ohne Notch-Luft und ohne Menüknopf-Platz. */
  flush?: boolean
  /** Liegt die Seite über einem Bild oder Video? */
  over?: boolean
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'relative flex h-full flex-col overflow-y-auto px-4 pb-10 sm:px-6',
        flush ? 'pt-1' : 'pt-safe',
      )}
    >
      <p
        className={cn(
          'mt-2.5 flex shrink-0 items-center gap-1.5 text-xs font-medium',
          !flush && 'ps-11',
          over && 'ps-0',
          theme.text,
        )}
      >
        <span
          className={cn(
            'flex min-w-0 items-center gap-1.5',
            over && 'rounded-full bg-white/70 px-2.5 py-1 backdrop-blur-sm dark:bg-slate-950/55',
            over && !flush && 'ms-11',
          )}
        >
          <span
            className={cn('grid size-6 shrink-0 place-items-center rounded-md', theme.iconBox)}
            aria-hidden
          >
            <theme.icon className="size-3.5" />
          </span>
          <span className="truncate">{label}</span>
        </span>
        {counter && (
          <span
            className={cn(
              'tabular ms-auto font-normal text-slate-400 dark:text-slate-500',
              over && 'rounded-full bg-white/70 px-2 py-1 backdrop-blur-sm dark:bg-slate-950/55',
            )}
          >
            {counter}
          </span>
        )}
      </p>
      {/* `m-auto` statt `justify-center`: zentriert, solange die Karte
          Luft hat – und rollt sauber, sobald der Inhalt höher ist. Über
          einem Bild sitzt der Text unten: Oben soll das Bild bleiben. */}
      <div className={cn('mx-auto w-full max-w-xl py-4', over ? 'mt-auto' : 'my-auto')}>
        {children}
      </div>
    </div>
  )
}
