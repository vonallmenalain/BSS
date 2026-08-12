import { type ReactNode } from 'react'
import { Award, Check, ChevronRight, Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  IMPULSE_SECTIONS,
  type ImpulseSectionKey,
} from '@/lib/impulseSections'
import { ImpulseRing } from '@/components/impulse/ImpulseRing'
import { GroupCard } from '@/components/impulse/ImpulseProgressCards'
import type { ImpulseItem } from '@/lib/types'
import type { ScreenOrigin } from '@/components/impulse/ImpulseScreen'

/*
 * Das Impuls-Dashboard: eine Kachel pro Bereich statt einer langen
 * Spalte. Jede Kachel trägt die Farbe ihres Bereichs, zeigt den eigenen
 * Stand («Geschafft», «3/7») – und öffnet auf Tipp den Bereich im
 * Vollbild, von der Kachel her (der Klickpunkt wird zum transform-origin
 * des Raums).
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

  return (
    <div className="grid grid-cols-2 gap-3">
      {model.hero ? (
        <HeroTile item={model.hero} delay={nextDelay()} onOpen={onOpen} />
      ) : (
        <section
          className="card animate-imp-rise col-span-2 grid place-items-center rounded-2xl border-dashed px-4 py-10 text-center"
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

      {model.quiz && (
        <Tile
          section="quiz"
          title="Quizfrage"
          sub={model.quiz.item.title}
          chip={model.quiz.answered ? <DoneChip section="quiz" label="Beantwortet" /> : null}
          delay={nextDelay()}
          onOpen={onOpen}
        />
      )}

      {model.goal && (
        <Tile
          section="ziel"
          title="Wochenziel"
          sub={model.goal.item.title}
          chip={model.goal.done ? <DoneChip section="ziel" label="Geschafft" /> : null}
          delay={nextDelay()}
          onOpen={onOpen}
        />
      )}

      {model.challenge && (
        <Tile
          section="challenge"
          title="Tages-Challenge"
          sub={model.challenge.item.title}
          chip={
            model.challenge.done > 0 ? (
              <StatusChip section="challenge" label={`${model.challenge.done}/7`} />
            ) : null
          }
          delay={nextDelay()}
          onOpen={onOpen}
        >
          <DayDots done={model.challenge.done} />
        </Tile>
      )}

      {model.frage && (
        <Tile
          section="frage"
          title="Frage der Woche"
          sub={model.frage.item.title}
          chip={
            model.frage.mine ? (
              <DoneChip section="frage" label="Mitgeredet" />
            ) : model.frage.count > 0 ? (
              <StatusChip
                section="frage"
                label={`${model.frage.count} ${model.frage.count === 1 ? 'Antwort' : 'Antworten'}`}
              />
            ) : null
          }
          delay={nextDelay()}
          onOpen={onOpen}
        />
      )}

      {model.feed && (
        <Tile
          section="feed"
          title="Impuls-Feed"
          sub={`${model.feed.count} ${model.feed.count === 1 ? 'Karte' : 'Karten'} – dann ist Schluss.`}
          chip={model.feed.done ? <DoneChip section="feed" label="Durchgetippt" /> : null}
          delay={nextDelay()}
          onOpen={onOpen}
        />
      )}

      {/* Der eigene Weg – immer da, auch in einer leeren Woche. */}
      <ProgressTile model={model} delay={nextDelay()} onOpen={onOpen} />

      {model.favoritesCount > 0 && (
        <Tile
          section="gemerkt"
          title="Gemerkt"
          sub={model.latestFavorite ?? ''}
          chip={<StatusChip section="gemerkt" label={String(model.favoritesCount)} />}
          delay={nextDelay()}
          onOpen={onOpen}
        />
      )}

      <Tile
        section="mitmachen"
        title="Mitmach-Ecke"
        sub="Dein Vers oder deine Quizidee – auf der Karte steht dein Name."
        chip={
          model.openSubmissions > 0 ? (
            <StatusChip
              section="mitmachen"
              label={`${model.openSubmissions} eingereicht`}
            />
          ) : null
        }
        delay={nextDelay()}
        onOpen={onOpen}
      />

      {model.pastWeeksCount > 0 && (
        <Tile
          section="wochen"
          title="Frühere Wochen"
          sub={`${model.pastWeeksCount} ${model.pastWeeksCount === 1 ? 'Woche' : 'Wochen'} zum Nachlesen.`}
          delay={nextDelay()}
          onOpen={onOpen}
        />
      )}

      {/* Die Gruppenleiste bleibt auf der Übersicht – wer dabei war,
          sieht man im Vorbeigehen, nicht hinter einer Tür. */}
      {!model.loading && !emptyWeek && (
        <div className="animate-imp-rise col-span-2" style={{ animationDelay: nextDelay() }}>
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
        'animate-imp-rise group col-span-2 rounded-2xl border p-5 text-left shadow-xs',
        'border-amber-200/70 bg-gradient-to-br from-amber-100/90 via-amber-50 to-white',
        'dark:border-amber-500/20 dark:from-amber-500/15 dark:via-slate-900 dark:to-slate-900',
        'transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] active:shadow-xs',
      )}
    >
      <span className={cn('flex items-center gap-1.5 text-xs font-medium', theme.text)}>
        <span className={cn('grid size-6 place-items-center rounded-md', theme.iconBox)} aria-hidden>
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

/** Eine gewöhnliche Kachel: Icon in Bereichsfarbe, Titel, Stand. */
function Tile({
  section,
  title,
  sub,
  chip,
  delay,
  onOpen,
  children,
}: {
  section: ImpulseSectionKey
  title: string
  sub: string
  chip?: ReactNode
  delay: string
  onOpen: (key: ImpulseSectionKey, origin: ScreenOrigin) => void
  children?: ReactNode
}) {
  const theme = IMPULSE_SECTIONS[section]
  return (
    <button
      type="button"
      onClick={(event) => onOpen(section, tileOrigin(event.currentTarget))}
      style={{ animationDelay: delay }}
      className="card animate-imp-rise group flex flex-col items-start p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] active:shadow-xs"
    >
      <span className="flex w-full items-center gap-2">
        <span
          className={cn('grid size-8 shrink-0 place-items-center rounded-lg', theme.iconBox)}
          aria-hidden
        >
          <theme.icon className="size-4.5" />
        </span>
        {chip && <span className="ms-auto">{chip}</span>}
      </span>
      <span className="mt-3 block text-sm font-semibold">{title}</span>
      <span className="mt-0.5 line-clamp-2 block text-xs text-slate-500 dark:text-slate-400">
        {sub}
      </span>
      {children}
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
      className="card animate-imp-rise group col-span-2 flex items-center gap-4 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] active:shadow-xs"
    >
      <ImpulseRing value={current} max={target} size={56} arcClass={theme.ring}>
        <theme.icon className={cn('size-5', current > 0 ? theme.text : 'text-slate-300 dark:text-slate-600')} aria-hidden />
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

/** «Geschafft», «Beantwortet» – der Haken in der Farbe des Bereichs. */
function DoneChip({ section, label }: { section: ImpulseSectionKey; label: string }) {
  const theme = IMPULSE_SECTIONS[section]
  return (
    <span className={cn('badge bg-slate-100/90 dark:bg-slate-800/90', theme.text)}>
      <Check className="size-3.5" aria-hidden />
      {label}
    </span>
  )
}

/** Ein stiller Zählstand – «3/7», «5 Antworten». */
function StatusChip({ section, label }: { section: ImpulseSectionKey; label: string }) {
  const theme = IMPULSE_SECTIONS[section]
  return (
    <span className={cn('badge bg-slate-100/90 tabular dark:bg-slate-800/90', theme.text)}>
      {label}
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
