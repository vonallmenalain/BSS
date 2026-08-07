import { useMemo } from 'react'
import { CalendarCheck, ChevronLeft, ChevronRight } from 'lucide-react'
import { AP_KIND_STYLES, apTitle } from '@/components/ap/ApActivityRow'
import { cn } from '@/lib/utils'
import { formatDayMonthYear, WEEKDAYS_SHORT } from '@/lib/dates'
import {
  apCalendarGrid,
  apCalendarShowsToday,
  apCalendarStep,
  apCalendarTitle,
  type ApCalendarDay,
  type ApCalendarMode,
} from '@/lib/apCalendar'
import { AP_ACTIVITY_KIND_LABELS, type ApActivity } from '@/lib/types'

/**
 * Der Aktivitätenplan als Kalender.
 *
 * Liste und Kacheln beantworten «was kommt?». Der Kalender beantwortet «wann
 * ist noch nichts?» – und das ist beim Planen die häufigere Frage. Deshalb
 * steht hier jeder Tag da, auch der leere: Ein Raster zeigt die Lücke, eine
 * Liste überspringt sie.
 *
 * **Woche** stellt die sieben Tage nebeneinander, sobald Platz ist, und
 * untereinander am Telefon – dort ist eine Spalte von fünfzig Pixeln keine
 * Spalte mehr. **Monat** bleibt immer das gewohnte Raster mit sieben
 * Spalten: Ein Monat, der untereinander steht, ist eine Liste.
 *
 * Geblättert wird mit zwei Pfeilen; «Heute» führt zurück und steht still,
 * solange man ohnehin dort ist.
 */
export function ApCalendar({
  activities,
  mode,
  cursor,
  onCursor,
  today,
  nextId,
  onOpen,
}: {
  /** Bereits nach den gewählten Arten gefiltert (siehe `apVisibleActivities`) */
  activities: ApActivity[]
  mode: ApCalendarMode
  cursor: Date
  onCursor: (next: Date) => void
  /** Heute als «2026-07-08» */
  today: string
  /** Der nächste Termin – bekommt denselben ruhigen Farbton wie in der Liste */
  nextId?: string
  /** Nur im Bearbeitungsmodus gesetzt – ohne bleibt der Kalender reine Anzeige. */
  onOpen?: (activity: ApActivity) => void
}) {
  const weeks = useMemo(() => apCalendarGrid(activities, cursor, mode), [activities, cursor, mode])

  const atToday = apCalendarShowsToday(cursor, mode, new Date(`${today}T12:00:00`))
  const heads = weeks[0]?.days.map((day) => WEEKDAYS_SHORT[day.date.getDay()]) ?? []

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1">
          <button
            type="button"
            className="btn-ghost p-2"
            onClick={() => onCursor(apCalendarStep(cursor, mode, -1))}
            aria-label={mode === 'week' ? 'Vorherige Woche' : 'Vorheriger Monat'}
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            className="btn-ghost p-2"
            onClick={() => onCursor(apCalendarStep(cursor, mode, 1))}
            aria-label={mode === 'week' ? 'Nächste Woche' : 'Nächster Monat'}
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </span>

        <h2 className="min-w-0 text-base font-semibold tracking-tight">
          {apCalendarTitle(cursor, mode)}
        </h2>

        <button
          type="button"
          className="btn-secondary btn-sm ml-auto"
          onClick={() => onCursor(new Date(`${today}T12:00:00`))}
          disabled={atToday}
        >
          <CalendarCheck className="size-3.5" aria-hidden />
          Heute
        </button>
      </div>

      {mode === 'month' ? (
        <div className="card overflow-hidden">
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-[11px] font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
            {heads.map((head) => (
              <span key={head} className="py-1.5">
                {head}
              </span>
            ))}
          </div>
          {/* Der Abstand von einem Pixel auf gefärbtem Grund zieht die Linien
              des Rasters – ohne dass jede Zelle wissen muss, ob sie am Rand
              steht. */}
          <div className="grid grid-cols-7 gap-px bg-slate-200 dark:bg-slate-700">
            {weeks
              .flatMap((week) => week.days)
              .map((day) => (
                <MonthCell key={day.key} day={day} today={today} nextId={nextId} onOpen={onOpen} />
              ))}
          </div>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-7">
          {weeks[0]?.days.map((day) => (
            <WeekCell key={day.key} day={day} today={today} nextId={nextId} onOpen={onOpen} />
          ))}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Ein Tag                                                             */
/* ------------------------------------------------------------------ */

function MonthCell({
  day,
  today,
  nextId,
  onOpen,
}: {
  day: ApCalendarDay
  today: string
  nextId?: string
  onOpen?: (activity: ApActivity) => void
}) {
  const isToday = day.key === today

  return (
    <div
      className={cn(
        'min-h-20 bg-white p-1 dark:bg-slate-900',
        // Die angrenzenden Tage füllen das Raster auf und treten zurück –
        // sie gehören zum Bild, aber nicht zum Monat.
        !day.inRange && 'bg-slate-50/80 dark:bg-slate-900/50',
      )}
    >
      <span
        className={cn(
          'tabular mb-1 inline-flex size-5 items-center justify-center rounded-full text-[11px] font-semibold',
          isToday && 'bg-brand-600 text-white',
          !isToday && day.inRange && 'text-slate-500 dark:text-slate-400',
          !isToday && !day.inRange && 'text-slate-300 dark:text-slate-600',
        )}
      >
        {day.date.getDate()}
      </span>

      {/* Am Telefon reihen sich die Punkte nebeneinander, ab dem Tablet
          stehen die Einträge untereinander wie in jedem Kalender. */}
      <div className="flex flex-wrap items-center gap-0.5 sm:block sm:space-y-0.5">
        {day.activities.map((activity) => (
          <Entry
            key={activity.id}
            activity={activity}
            dayKey={day.key}
            compact
            highlight={activity.id === nextId}
            onOpen={onOpen}
          />
        ))}
      </div>
    </div>
  )
}

function WeekCell({
  day,
  today,
  nextId,
  onOpen,
}: {
  day: ApCalendarDay
  today: string
  nextId?: string
  onOpen?: (activity: ApActivity) => void
}) {
  const isToday = day.key === today

  return (
    <div
      className={cn(
        'card min-h-24 p-2',
        isToday && 'border-brand-300 dark:border-brand-800',
        day.activities.length === 0 && 'opacity-70',
      )}
    >
      <p
        className={cn(
          'tabular mb-1.5 flex items-baseline gap-1.5 text-xs font-semibold',
          isToday ? 'text-brand-700 dark:text-brand-300' : 'text-slate-500 dark:text-slate-400',
        )}
      >
        <span>{WEEKDAYS_SHORT[day.date.getDay()]}</span>
        <span className="font-normal">{day.date.getDate()}.</span>
      </p>

      <div className="space-y-1">
        {day.activities.map((activity) => (
          <Entry
            key={activity.id}
            activity={activity}
            dayKey={day.key}
            highlight={activity.id === nextId}
            onOpen={onOpen}
          />
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Ein Termin im Raster                                                */
/* ------------------------------------------------------------------ */

/**
 * Ein Termin, so klein wie er im Raster sein muss.
 *
 * Der Titel wird abgeschnitten – anders als in der Liste, wo er umbricht: In
 * einer Zelle von zwei Zentimetern Breite ist ein umbrechender Titel die
 * ganze Zelle. Der vollständige Text steht im Tooltip, und ein Klick öffnet
 * den Termin ohnehin.
 *
 * Im Monatsraster am Telefon bleibt nur der farbige Punkt: Eine Spalte von
 * fünfzig Pixeln macht aus «Bouldern» ein «B…», und das ist weniger als
 * nichts. Der Punkt beantwortet die Frage, für die man ein Monatsraster
 * aufschlägt – an welchen Abenden etwas ansteht –, und wer wissen will, was,
 * wechselt auf die Woche.
 *
 * An den Folgetagen eines mehrtägigen Anlasses tritt der Eintrag zurück und
 * lässt die Zeit weg: Das Lager beginnt am Freitag, nicht dreimal.
 */
function Entry({
  activity,
  dayKey,
  compact = false,
  highlight = false,
  onOpen,
}: {
  activity: ApActivity
  /** Der Tag, an dem der Eintrag gerade steht – für mehrtägige Anlässe */
  dayKey: string
  compact?: boolean
  highlight?: boolean
  onOpen?: (activity: ApActivity) => void
}) {
  const style = AP_KIND_STYLES[activity.kind]
  const cancelled = activity.kind === 'cancelled'
  const continued = activity.date !== dayKey
  const time = activity.time?.trim() ?? ''

  const label = [
    AP_ACTIVITY_KIND_LABELS[activity.kind],
    apTitle(activity),
    activity.endDate && activity.endDate !== activity.date
      ? `${formatDayMonthYear(activity.date)} – ${formatDayMonthYear(activity.endDate)}`
      : '',
  ]
    .filter(Boolean)
    .join(' · ')

  const content = (
    <>
      <span
        className={cn(
          'shrink-0 rounded-full',
          style.bar,
          compact ? 'size-2 sm:mt-1 sm:size-1.5' : 'mt-1 size-1.5',
        )}
        aria-hidden
      />
      <span className={cn('min-w-0 flex-1 truncate', compact && 'hidden sm:block')}>
        {time && !continued && <span className="tabular mr-1 opacity-70">{time}</span>}
        <span className={cn(cancelled && 'line-through')}>{apTitle(activity)}</span>
      </span>
    </>
  )

  const shell = cn(
    'flex items-start gap-1 rounded text-left',
    compact
      ? 'p-1 text-[11px] leading-tight sm:w-full sm:px-1 sm:py-0.5'
      : 'w-full px-1 py-0.5 text-xs',
    cancelled || continued
      ? 'text-slate-400 dark:text-slate-500'
      : 'text-slate-700 dark:text-slate-200',
    highlight && 'bg-brand-50 font-medium dark:bg-brand-950/60',
  )

  if (!onOpen) {
    return (
      <span className={shell} title={label} aria-label={label}>
        {content}
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={() => onOpen(activity)}
      title={label}
      aria-label={label}
      className={cn(shell, 'transition hover:bg-slate-100 dark:hover:bg-slate-800')}
    >
      {content}
    </button>
  )
}
