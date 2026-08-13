import { type ReactNode } from 'react'
import { Award, Check, ChevronRight, Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'
import { IMPULSE_SECTIONS, type ImpulseSectionKey } from '@/lib/impulseSections'
import { ImpulseRing } from '@/components/impulse/ImpulseRing'
import { GroupCard } from '@/components/impulse/ImpulseProgressCards'
import type { ImpulseItem } from '@/lib/types'
import type { ScreenOrigin } from '@/components/impulse/ImpulseScreen'

/*
 * Das Impuls-Dashboard: eine Kachel pro Bereich, gelegt wie eine
 * Fotocollage. Jede Kachel trägt die Farbe ihres Bereichs, zeigt den
 * eigenen Stand («Geschafft», «3/7») – und öffnet auf Tipp den Bereich im
 * Vollbild, von der Kachel her (der Klickpunkt wird zum transform-origin
 * des Raums).
 *
 * Die Collage: Das Raster hat sechs Spalten, und für jede Anzahl Kacheln
 * gibt es ein Muster, dessen Zeilen sich exakt auf sechs summieren
 * (`collagePattern`). So bekommt die Fläche unterschiedliche Grössen –
 * eine hohe Kachel neben zwei gestapelten, eine breite neben einer
 * schmalen – und bleibt doch immer lückenlos, egal was die Woche gerade
 * hergibt. Ein halb leerer Rest, wie ihn ein starres Zweierraster bei
 * ungerader Zahl liesse, kann gar nicht entstehen.
 *
 * Bewegung: Beim ersten Aufbau treten die Kacheln gestaffelt an (45 ms
 * Versatz – Dekoration, die nie blockiert), beim Drücken geben sie nach
 * (scale 0.98), auf Geräten mit Maus heben sie sich leicht. Mehr nicht:
 * Das Dashboard wird täglich geöffnet, es soll begrüssen, nicht turnen.
 */

export interface ImpulseDashboardModel {
  loading: boolean
  hero: ImpulseItem | null
  quiz: { item: ImpulseItem; answered: boolean } | null
  goal: { item: ImpulseItem; done: boolean } | null
  challenge: { item: ImpulseItem; done: number } | null
  frage: { item: ImpulseItem; mine: boolean; count: number } | null
  feed: { count: number; done: boolean } | null
  streak: { current: number; best: number }
  badgeCount: number
  badgeTotal: number
  favoritesCount: number
  latestFavorite: string | null
  openSubmissions: number
  pastWeeksCount: number
  participants: { uid: string; firstName: string }[]
  participantsTotal: number
}

/* ------------------------------------------------------------------ */
/* Die Collage                                                         */
/* ------------------------------------------------------------------ */

/** Die Grössen, aus denen die Collage baut – Spannweiten im Sechserraster. */
type TileSize = 'full' | 'wide' | 'half' | 'compact' | 'tall'

/* Ausgeschriebene Klassen, keine gebauten – Tailwind sammelt Klassennamen
   aus dem Quelltext ein und fände zusammengesetzte nie. */
const TILE_SPAN: Record<TileSize, string> = {
  full: 'col-span-6',
  wide: 'col-span-4',
  half: 'col-span-3',
  compact: 'col-span-2',
  tall: 'col-span-3 row-span-2',
}

/**
 * Wie n Kacheln lückenlos in die Collage finden.
 *
 * Jede Zeile summiert sich auf sechs Spalten; die «tall»-Kachel spannt
 * zwei Zeilen und bekommt rechts zwei gestapelte Nachbarn – der Blockbau
 * einer Fotocollage. Die erste Kachel der Gruppe erhält den grössten
 * Platz: Sie ist in der Lesereihenfolge die wichtigste.
 */
function collagePattern(count: number): TileSize[] {
  switch (count) {
    case 0:
      return []
    case 1:
      return ['full']
    case 2:
      return ['wide', 'compact']
    case 3:
      return ['tall', 'half', 'half']
    case 4:
      return ['wide', 'compact', 'compact', 'wide']
    default:
      return ['tall', 'half', 'half', 'wide', 'compact']
  }
}

/** Der eigene Stand auf einer Kachel – Haken oder Zählstand. */
interface TileState {
  label: string
  /** Kurzform für die schmalste Kachel («5» statt «5 Antworten»). */
  short?: string
  /** Erledigt – dann trägt die Kachel den Haken statt des Zählers. */
  done?: boolean
}

/** Alles, was eine Kachel zeigt – die Grösse kommt aus dem Muster dazu. */
interface TileSpec {
  section: ImpulseSectionKey
  title: string
  sub: string
  state?: TileState | null
  children?: ReactNode
}

export function ImpulseDashboard({
  model,
  onOpen,
}: {
  model: ImpulseDashboardModel
  onOpen: (key: ImpulseSectionKey, origin: ScreenOrigin) => void
}) {
  /*
   * Die Staffel zählt über alle sichtbaren Kacheln durch – eine lokale
   * Variable genügt: Sie lebt nur während dieses Renders und beginnt
   * beim nächsten von vorn.
   */
  let stagger = 0
  const nextDelay = () => `${Math.min(stagger++, 9) * 45}ms`

  const emptyWeek =
    !model.loading &&
    !model.hero &&
    !model.quiz &&
    !model.goal &&
    !model.challenge &&
    !model.frage &&
    !model.feed

  /* Die Kacheln der laufenden Woche – nur, was es diese Woche gibt. */
  const weekTiles: TileSpec[] = []
  if (model.quiz)
    weekTiles.push({
      section: 'quiz',
      title: 'Quizfrage',
      sub: model.quiz.item.title,
      state: model.quiz.answered ? { label: 'Beantwortet', done: true } : null,
    })
  if (model.goal)
    weekTiles.push({
      section: 'ziel',
      title: 'Wochenziel',
      sub: model.goal.item.title,
      state: model.goal.done ? { label: 'Geschafft', done: true } : null,
    })
  if (model.challenge)
    weekTiles.push({
      section: 'challenge',
      title: 'Tages-Challenge',
      sub: model.challenge.item.title,
      state: model.challenge.done > 0 ? { label: `${model.challenge.done}/7` } : null,
      children: <DayDots done={model.challenge.done} />,
    })
  if (model.frage)
    weekTiles.push({
      section: 'frage',
      title: 'Frage der Woche',
      sub: model.frage.item.title,
      state: model.frage.mine
        ? { label: 'Mitgeredet', done: true }
        : model.frage.count > 0
          ? {
              label: `${model.frage.count} ${model.frage.count === 1 ? 'Antwort' : 'Antworten'}`,
              short: String(model.frage.count),
            }
          : null,
    })
  if (model.feed)
    weekTiles.push({
      section: 'feed',
      title: 'Impuls-Feed',
      sub: `${model.feed.count} ${model.feed.count === 1 ? 'Karte' : 'Karten'} – dann ist Schluss.`,
      state: model.feed.done ? { label: 'Durchgetippt', done: true } : null,
    })
  const weekSizes = collagePattern(weekTiles.length)

  /* Der eigene Weg – die Kacheln unterhalb der Fortschritts-Zeile. */
  const ownTiles: TileSpec[] = []
  if (model.favoritesCount > 0)
    ownTiles.push({
      section: 'gemerkt',
      title: 'Gemerkt',
      sub: model.latestFavorite ?? '',
      state: { label: String(model.favoritesCount) },
    })
  ownTiles.push({
    section: 'mitmachen',
    title: 'Mitmach-Ecke',
    sub: 'Dein Vers oder deine Quizidee – auf der Karte steht dein Name.',
    state:
      model.openSubmissions > 0
        ? {
            label: `${model.openSubmissions} eingereicht`,
            short: String(model.openSubmissions),
          }
        : null,
  })
  if (model.pastWeeksCount > 0)
    ownTiles.push({
      section: 'wochen',
      title: 'Frühere Wochen',
      sub: `${model.pastWeeksCount} ${model.pastWeeksCount === 1 ? 'Woche' : 'Wochen'} zum Nachlesen.`,
    })
  /* Die Mitmach-Ecke lebt von ihrem Untertitel – steht «Gemerkt» vor ihr,
     nimmt darum das Gemerkt-Kärtchen die schmale Grösse. */
  let ownSizes = collagePattern(ownTiles.length)
  if (ownTiles.length === 2 && ownTiles[0].section === 'gemerkt') ownSizes = ['compact', 'wide']

  return (
    <div className="grid grid-cols-6 gap-3">
      {model.hero ? (
        <HeroTile item={model.hero} delay={nextDelay()} onOpen={onOpen} />
      ) : (
        <section
          className="card animate-imp-rise col-span-6 grid place-items-center rounded-2xl border-dashed px-4 py-10 text-center"
          style={{ animationDelay: nextDelay() }}
        >
          <Inbox className="size-6 text-slate-400" aria-hidden />
          <p className="mt-2 text-sm font-medium">
            {model.loading ? 'Wird geladen …' : 'Diese Woche ist noch nichts aufgeschaltet'}
          </p>
          {!model.loading && (
            <p className="hint max-w-sm">
              Schau später wieder vorbei – der nächste Impuls kommt. Dein Fortschritt und der
              Rückblick sind trotzdem da.
            </p>
          )}
        </section>
      )}

      {weekTiles.map((tile, index) => (
        <Tile
          key={tile.section}
          {...tile}
          size={weekSizes[index] ?? 'half'}
          delay={nextDelay()}
          onOpen={onOpen}
        />
      ))}

      {/* Der eigene Weg – immer da, auch in einer leeren Woche. */}
      <ProgressTile model={model} delay={nextDelay()} onOpen={onOpen} />

      {ownTiles.map((tile, index) => (
        <Tile
          key={tile.section}
          {...tile}
          size={ownSizes[index] ?? 'half'}
          delay={nextDelay()}
          onOpen={onOpen}
        />
      ))}

      {/* Die Gruppenleiste bleibt auf der Übersicht – wer dabei war,
          sieht man im Vorbeigehen, nicht hinter einer Tür. */}
      {!model.loading && !emptyWeek && (
        <div className="animate-imp-rise col-span-6" style={{ animationDelay: nextDelay() }}>
          <GroupCard participants={model.participants} total={model.participantsTotal} />
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Die Kacheln                                                         */
/* ------------------------------------------------------------------ */

/** Der Klickpunkt einer Kachel – von dort wächst der Vollbild-Raum. */
function tileOrigin(element: HTMLElement): ScreenOrigin {
  const rect = element.getBoundingClientRect()
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
}

/**
 * Die Hero-Kachel: der Wochenimpuls, das Herzstück – volle Breite, der
 * warme Ton des Bereichs, der Titel gross. Sie lädt zum Lesen ein; der
 * ganze Text wartet im Vollbild.
 */
function HeroTile({
  item,
  delay,
  onOpen,
}: {
  item: ImpulseItem
  delay: string
  onOpen: (key: ImpulseSectionKey, origin: ScreenOrigin) => void
}) {
  const theme = IMPULSE_SECTIONS.woche
  return (
    <button
      type="button"
      onClick={(event) => onOpen('woche', tileOrigin(event.currentTarget))}
      style={{ animationDelay: delay }}
      className={cn(
        'animate-imp-rise group col-span-6 rounded-2xl border p-5 text-left shadow-xs',
        'border-amber-200/70 bg-gradient-to-br from-amber-100/90 via-amber-50 to-white',
        'dark:border-amber-500/20 dark:from-amber-500/15 dark:via-slate-900 dark:to-slate-900',
        'transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] active:shadow-xs',
      )}
    >
      <span className={cn('flex items-center gap-1.5 text-xs font-medium', theme.text)}>
        <span
          className={cn('grid size-6 place-items-center rounded-md', theme.iconBox)}
          aria-hidden
        >
          <theme.icon className="size-3.5" />
        </span>
        Wochenimpuls
      </span>
      <span className="mt-3 block text-xl leading-snug font-semibold text-balance">
        {item.title}
      </span>
      {item.body && (
        <span className="mt-2 line-clamp-2 block text-sm text-slate-600 dark:text-slate-300">
          {item.body}
        </span>
      )}
      <span className="mt-3 flex items-center text-xs text-slate-500 dark:text-slate-400">
        {item.source?.label && <span className="truncate">{item.source.label}</span>}
        <span className={cn('ms-auto flex items-center gap-0.5 font-medium', theme.text)}>
          Lesen
          <ChevronRight
            className="size-3.5 transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </span>
      </span>
    </button>
  )
}

/**
 * Eine Kachel der Collage: Icon in Bereichsfarbe, Titel, Stand – und ihre
 * Grösse aus dem Muster. Die hohe Kachel nutzt ihren Raum (grösseres
 * Icon, mehr Zeilen, unten der Öffnen-Pfeil als Anker), die schmalste
 * kürzt, was nicht hineinpasst: Der Untertitel darf eine Zeile mehr, das
 * Etikett schrumpft auf Haken oder Zahl.
 */
function Tile({
  section,
  title,
  sub,
  state,
  size = 'half',
  delay,
  onOpen,
  children,
}: TileSpec & {
  size?: TileSize
  delay: string
  onOpen: (key: ImpulseSectionKey, origin: ScreenOrigin) => void
}) {
  const theme = IMPULSE_SECTIONS[section]
  const compact = size === 'compact'
  const tall = size === 'tall'
  return (
    <button
      type="button"
      onClick={(event) => onOpen(section, tileOrigin(event.currentTarget))}
      style={{ animationDelay: delay }}
      className={cn(
        'card animate-imp-rise group flex flex-col items-start text-left transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] active:shadow-xs',
        TILE_SPAN[size],
        compact ? 'p-3.5' : 'p-4',
      )}
    >
      <span className="flex w-full items-center gap-2">
        <span
          className={cn(
            'grid shrink-0 place-items-center rounded-lg',
            theme.iconBox,
            tall ? 'size-9' : 'size-8',
          )}
          aria-hidden
        >
          <theme.icon className={tall ? 'size-5' : 'size-4.5'} />
        </span>
        {state && (
          <span className="ms-auto">
            <StateChip state={state} section={section} compact={compact} />
          </span>
        )}
      </span>
      <span className={cn('mt-3 block font-semibold', tall ? 'text-base' : 'text-sm')}>
        {title}
      </span>
      <span
        className={cn(
          'mt-0.5 block text-xs text-slate-500 dark:text-slate-400',
          tall ? 'line-clamp-5' : compact ? 'line-clamp-3' : 'line-clamp-2',
        )}
      >
        {sub}
      </span>
      {children}
      {tall && (
        <span
          className={cn('mt-auto flex items-center gap-0.5 pt-3 text-xs font-medium', theme.text)}
        >
          Öffnen
          <ChevronRight
            className="size-3.5 transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </span>
      )}
    </button>
  )
}

/**
 * Die Fortschritts-Kachel: Serie als Ring, Abzeichen als Zahl – und
 * dahinter die ganze Statistik. Der Ring misst den Weg zum nächsten
 * Serien-Meilenstein (4 bzw. 8 Wochen).
 */
function ProgressTile({
  model,
  delay,
  onOpen,
}: {
  model: ImpulseDashboardModel
  delay: string
  onOpen: (key: ImpulseSectionKey, origin: ScreenOrigin) => void
}) {
  const theme = IMPULSE_SECTIONS.fortschritt
  const { current, best } = model.streak
  const target = current < 4 ? 4 : 8
  return (
    <button
      type="button"
      onClick={(event) => onOpen('fortschritt', tileOrigin(event.currentTarget))}
      style={{ animationDelay: delay }}
      className="card animate-imp-rise group col-span-6 flex items-center gap-4 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] active:shadow-xs"
    >
      <ImpulseRing value={current} max={target} size={56} arcClass={theme.ring}>
        <theme.icon
          className={cn('size-5', current > 0 ? theme.text : 'text-slate-300 dark:text-slate-600')}
          aria-hidden
        />
      </ImpulseRing>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">Mein Fortschritt</span>
        <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
          {current > 0 ? (
            <>
              {current} {current === 1 ? 'Woche' : 'Wochen'} in Folge
              {best > current && ` · beste ${best}`}
            </>
          ) : (
            'Deine Serie beginnt mit dem ersten Haken.'
          )}
        </span>
        <span className="mt-1.5 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
          <Award className="size-3.5 text-amber-500" aria-hidden />
          {model.badgeCount} von {model.badgeTotal} Abzeichen
        </span>
      </span>
      <ChevronRight
        className="size-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5"
        aria-hidden
      />
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Kleinteile                                                          */
/* ------------------------------------------------------------------ */

/**
 * Der Stand auf der Kachel. In voller Grösse ein beschriftetes Etikett –
 * der Haken («Beantwortet», «Geschafft») oder der stille Zählstand
 * («3/7», «5 Antworten»). Auf der schmalsten Kachel bleibt vom Haken nur
 * der Kreis und vom Zähler die Kurzform: Mehr Breite gibt es dort nicht,
 * und ein abgeschnittenes Etikett sagt weniger als ein ganzes Zeichen.
 */
function StateChip({
  state,
  section,
  compact,
}: {
  state: TileState
  section: ImpulseSectionKey
  compact: boolean
}) {
  const theme = IMPULSE_SECTIONS[section]

  if (state.done) {
    return compact ? (
      <span
        className={cn(
          'grid size-6 place-items-center rounded-full bg-slate-100/90 dark:bg-slate-800/90',
          theme.text,
        )}
      >
        <Check className="size-3.5" aria-hidden />
        <span className="sr-only">{state.label}</span>
      </span>
    ) : (
      <span className={cn('badge bg-slate-100/90 dark:bg-slate-800/90', theme.text)}>
        <Check className="size-3.5" aria-hidden />
        {state.label}
      </span>
    )
  }

  const text = compact ? (state.short ?? state.label) : state.label
  return (
    <span className={cn('badge bg-slate-100/90 tabular dark:bg-slate-800/90', theme.text)}>
      {text === state.label ? (
        text
      ) : (
        <>
          <span aria-hidden>{text}</span>
          <span className="sr-only">{state.label}</span>
        </>
      )}
    </span>
  )
}

/** Sieben Punkte für sieben Tage – der Wochenstand in einer Zeile. */
function DayDots({ done }: { done: number }) {
  const theme = IMPULSE_SECTIONS.challenge
  return (
    <span className="mt-2.5 flex gap-1" aria-hidden>
      {Array.from({ length: 7 }, (_, index) => (
        <span
          key={index}
          className={cn(
            'size-1.5 rounded-full',
            index < done ? theme.bar : 'bg-slate-200 dark:bg-slate-700',
          )}
        />
      ))}
    </span>
  )
}
