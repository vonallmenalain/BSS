import { useMemo, useState } from 'react'
import { CalendarCheck, ChevronLeft, ChevronRight, Info, Pencil } from 'lucide-react'
import { AP_KIND_STYLES, ApDetails, apDateLabel, apTitle } from '@/components/ap/ApActivityRow'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/utils'
import { formatDateLong, formatDateShort, WEEKDAYS, WEEKDAYS_SHORT } from '@/lib/dates'
import { fromIsoDate } from '@/services/importHistory'
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
 * **Woche** stellt die sieben Tage untereinander, einen Tag über die ganze
 * Breite. Nebeneinander wären es sieben Spalten für sieben Termine – viel
 * Raster für wenig Inhalt; untereinander bleibt Platz für Titel, Zeit und
 * Treffpunkt in lesbarer Grösse. **Monat** ist das gewohnte Raster mit
 * sieben Spalten: Ein Monat, der untereinander steht, ist eine Liste.
 *
 * Ein Griff auf einen Tag öffnet ihn – mit allem, was an ihm ansteht. Im
 * Raster ist für die halbe Angabe kein Platz, und eine halbe Angabe ist
 * beim Planen keine: Wer «Bouldern» liest, will wissen, wo und wer.
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

  /*
   * Der geöffnete Tag steht als Schlüssel und nicht als Eintrag.
   *
   * Sonst zeigte das Fenster den Stand von vorhin weiter: Wer darin einen
   * Termin öffnet und ändert, käme zu einem Tag zurück, an dem noch das Alte
   * steht. Verschwindet der Tag – weil geblättert wurde –, schliesst es sich.
   */
  const [openKey, setOpenKey] = useState<string | null>(null)
  const days = useMemo(() => weeks.flatMap((week) => week.days), [weeks])
  const openDay = days.find((day) => day.key === openKey) ?? null

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
            {days.map((day) => (
              <MonthCell
                key={day.key}
                day={day}
                today={today}
                nextId={nextId}
                onSelect={() => setOpenKey(day.key)}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {days.map((day) => (
            <WeekRow
              key={day.key}
              day={day}
              today={today}
              nextId={nextId}
              onSelect={() => setOpenKey(day.key)}
            />
          ))}
        </div>
      )}

      {openDay && (
        <ApDayDialog
          day={openDay}
          onClose={() => setOpenKey(null)}
          onOpen={
            onOpen &&
            ((activity) => {
              setOpenKey(null)
              onOpen(activity)
            })
          }
        />
      )}
    </div>
  )
}

/** «Ein Termin» oder «3 Termine» – für die Beschriftung eines Tages. */
function countLabel(count: number): string {
  return count === 1 ? 'einen Termin' : `${count} Termine`
}

/* ------------------------------------------------------------------ */
/* Ein Tag im Monatsraster                                             */
/* ------------------------------------------------------------------ */

/**
 * Eine Zelle des Monats – die Zahl und, was an dem Tag ansteht.
 *
 * Der ganze Tag ist die Schaltfläche und nicht der einzelne Eintrag: In einer
 * Spalte von fünfzig Pixeln ist ein Eintrag ein Ziel von wenigen Millimetern,
 * und getroffen werden will ohnehin der Tag. Ein leerer Tag bleibt still –
 * ein Fenster, das «hier steht nichts» sagt, ist den Griff nicht wert.
 */
function MonthCell({
  day,
  today,
  nextId,
  onSelect,
}: {
  day: ApCalendarDay
  today: string
  nextId?: string
  onSelect: () => void
}) {
  const isToday = day.key === today
  const busy = day.activities.length > 0

  const content = (
    <>
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

      <span className="block space-y-px sm:space-y-0.5">
        {day.activities.map((activity) => (
          <MonthEntry
            key={activity.id}
            activity={activity}
            dayKey={day.key}
            highlight={activity.id === nextId}
          />
        ))}
      </span>
    </>
  )

  const shell = cn(
    'min-h-20 w-full bg-white p-1 text-left dark:bg-slate-900',
    // Die angrenzenden Tage füllen das Raster auf und treten zurück –
    // sie gehören zum Bild, aber nicht zum Monat.
    !day.inRange && 'bg-slate-50/80 dark:bg-slate-900/50',
  )

  if (!busy) return <div className={shell}>{content}</div>

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(shell, 'transition hover:bg-slate-50 dark:hover:bg-slate-800')}
      aria-label={`${formatDateLong(day.date)} – ${countLabel(day.activities.length)} anzeigen`}
    >
      {content}
    </button>
  )
}

/**
 * Ein Termin in der Monatszelle.
 *
 * Am Telefon steht nur der Titelanfang, dafür in der Farbe seiner Art: Eine
 * Spalte von fünfzig Pixeln trägt sechs, sieben Zeichen – zu wenig für den
 * ganzen Titel, aber genug, um «Bouldern» von der Klasse zu unterscheiden.
 * Der Punkt davor entfällt dort; er kostete ein Viertel der Zeile, und die
 * Farbe sagt dasselbe.
 *
 * Ab dem Tablet ist Platz für Punkt, Zeit und Titel. An den Folgetagen eines
 * mehrtägigen Anlasses tritt der Eintrag zurück und lässt die Zeit weg: Das
 * Lager beginnt am Freitag, nicht dreimal.
 */
function MonthEntry({
  activity,
  dayKey,
  highlight,
}: {
  activity: ApActivity
  /** Der Tag, an dem der Eintrag gerade steht – für mehrtägige Anlässe */
  dayKey: string
  highlight: boolean
}) {
  const style = AP_KIND_STYLES[activity.kind]
  const cancelled = activity.kind === 'cancelled'
  const continued = activity.date !== dayKey
  const muted = cancelled || continued
  const time = activity.time?.trim() ?? ''

  return (
    <span className={cn('block rounded', highlight && 'bg-brand-50 dark:bg-brand-950/60')}>
      {/* Telefon */}
      <span
        className={cn(
          'block truncate px-0.5 text-[9px] leading-[1.5] font-medium sm:hidden',
          muted ? 'text-slate-400 dark:text-slate-500' : style.text,
          cancelled && 'line-through',
        )}
      >
        {apTitle(activity)}
      </span>

      {/* Ab dem Tablet */}
      <span className="hidden items-start gap-1 px-1 py-0.5 sm:flex">
        <span className={cn('mt-1 size-1.5 shrink-0 rounded-full', style.bar)} aria-hidden />
        <span
          className={cn(
            'min-w-0 flex-1 truncate text-[11px] leading-tight',
            muted ? 'text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-200',
            highlight && 'font-medium',
          )}
        >
          {time && !continued && <span className="tabular mr-1 opacity-70">{time}</span>}
          <span className={cn(cancelled && 'line-through')}>{apTitle(activity)}</span>
        </span>
      </span>
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Ein Tag in der Wochenansicht                                        */
/* ------------------------------------------------------------------ */

/**
 * Ein Tag der Woche über die ganze Breite.
 *
 * Oben der Tag, darunter, was an ihm ansteht – so, wie die Woche am Telefon
 * schon immer stand, nur mit dem Platz eines breiten Bildschirms: Zeit und
 * Titel in Lesegrösse, darunter Treffpunkt und Zuständigkeit. Mehr gehört
 * nicht in eine Übersicht; alles Weitere steht im Fenster, das ein Griff auf
 * den Tag öffnet.
 */
function WeekRow({
  day,
  today,
  nextId,
  onSelect,
}: {
  day: ApCalendarDay
  today: string
  nextId?: string
  onSelect: () => void
}) {
  const isToday = day.key === today
  const busy = day.activities.length > 0

  const content = (
    <>
      <span
        className={cn(
          'tabular mb-1.5 flex items-baseline gap-2 text-sm font-semibold',
          isToday ? 'text-brand-700 dark:text-brand-300' : 'text-slate-500 dark:text-slate-400',
        )}
      >
        <span>{WEEKDAYS[day.date.getDay()]}</span>
        <span className="font-normal">{day.date.getDate()}.</span>
        {isToday && <span className="badge bg-brand-600 text-white">Heute</span>}
      </span>

      {busy ? (
        <span className="block space-y-2">
          {day.activities.map((activity) => (
            <WeekEntry
              key={activity.id}
              activity={activity}
              dayKey={day.key}
              highlight={activity.id === nextId}
            />
          ))}
        </span>
      ) : (
        <span className="block text-sm text-slate-400 dark:text-slate-500">Nichts geplant</span>
      )}
    </>
  )

  const shell = cn(
    'card block w-full p-3 text-left',
    isToday && 'border-brand-300 dark:border-brand-800',
    !busy && 'opacity-70',
  )

  if (!busy) return <div className={shell}>{content}</div>

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(shell, 'card-hover')}
      aria-label={`${formatDateLong(day.date)} – ${countLabel(day.activities.length)} anzeigen`}
    >
      {content}
    </button>
  )
}

/** Ein Termin in der Wochenzeile – Zeit, Titel und die zwei nächstliegenden Angaben. */
function WeekEntry({
  activity,
  dayKey,
  highlight,
}: {
  activity: ApActivity
  dayKey: string
  highlight: boolean
}) {
  const style = AP_KIND_STYLES[activity.kind]
  const cancelled = activity.kind === 'cancelled'
  const continued = activity.date !== dayKey
  const time = activity.time?.trim() ?? ''

  /* Wo und wer – beim Überfliegen die beiden Fragen nach dem Titel. */
  const summary = [activity.location?.trim(), activity.leader?.trim()].filter(Boolean).join(' · ')

  return (
    <span className="flex items-start gap-2">
      <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', style.bar)} aria-hidden />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block text-sm break-words',
            cancelled || continued
              ? 'text-slate-400 dark:text-slate-500'
              : 'font-medium text-slate-800 dark:text-slate-100',
            highlight && !cancelled && !continued && 'text-brand-700 dark:text-brand-300',
          )}
        >
          {time && !continued && (
            <span className="tabular mr-1.5 font-normal text-slate-500 dark:text-slate-400">
              {time}
            </span>
          )}
          <span className={cn(cancelled && 'line-through')}>{apTitle(activity)}</span>
          {/* An den Folgetagen sagt der Eintrag, wie lange es noch geht –
              sonst stünde derselbe Titel dreimal ohne Zusammenhang da. */}
          {continued && (
            <span className="ml-1.5 text-xs">
              · noch bis {formatDateShort(fromIsoDate(activity.endDate ?? activity.date))}
            </span>
          )}
        </span>
        {summary && !continued && (
          <span className="block text-xs text-slate-500 dark:text-slate-400">{summary}</span>
        )}
      </span>
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Der geöffnete Tag                                                   */
/* ------------------------------------------------------------------ */

/**
 * Alles, was an einem Tag ansteht – in voller Länge.
 *
 * Das Raster zeigt, **dass** etwas ist; hier steht, **was**: Art, Titel,
 * Startzeit, Treffpunkt, Zuständigkeit und wer aus Bischofschaft und
 * Beraterschaft dabei ist. Damit ist der Kalender auch am Telefon
 * vollständig, wo in der Zelle nur der halbe Titel Platz hat.
 *
 * Geändert wird hier nichts: Der Knopf «Öffnen» steht nur im
 * Bearbeitungsmodus und führt in das Formular, das den Termin ohnehin führt.
 */
function ApDayDialog({
  day,
  onClose,
  onOpen,
}: {
  day: ApCalendarDay
  onClose: () => void
  onOpen?: (activity: ApActivity) => void
}) {
  const count = day.activities.length

  return (
    <Modal
      open
      onClose={onClose}
      title={formatDateLong(day.date)}
      description={count === 1 ? 'Ein Termin' : `${count} Termine`}
      /* Der Tag trägt bis zu drei Termine mit je fünf Angaben – in einem
         schmalen Fenster stünde jede davon auf zwei Zeilen. */
      size="lg"
      footer={
        <button type="button" className="btn-secondary" onClick={onClose}>
          Schliessen
        </button>
      }
    >
      <div className="space-y-3">
        {day.activities.map((activity) => {
          const style = AP_KIND_STYLES[activity.kind]
          const Icon = style.icon
          const cancelled = activity.kind === 'cancelled'
          const multiDay = Boolean(activity.endDate && activity.endDate !== activity.date)
          const note = activity.note?.trim() ?? ''

          return (
            <div
              key={activity.id}
              className="relative overflow-hidden rounded-xl border border-slate-200 p-3 dark:border-slate-700"
            >
              <span className={cn('absolute inset-y-0 left-0 w-1', style.bar)} aria-hidden />

              <div className="flex flex-wrap items-center gap-2 pl-2">
                <span className={cn('badge', style.chip)}>
                  <Icon className="size-3" aria-hidden />
                  {AP_ACTIVITY_KIND_LABELS[activity.kind]}
                </span>
                {/* Nur bei mehrtägigen Anlässen: Sonst stünde das Datum, das
                    schon im Titel des Fensters steht, ein zweites Mal da. */}
                {multiDay && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {apDateLabel(activity)}
                  </span>
                )}
              </div>

              <p
                className={cn(
                  'mt-2 pl-2 font-semibold break-words',
                  cancelled && 'text-slate-500 line-through dark:text-slate-400',
                  !activity.title.trim() && !cancelled && 'font-normal text-slate-400 italic',
                )}
              >
                {apTitle(activity)}
              </p>

              <ApDetails
                activity={activity}
                className="mt-2 pl-2 text-sm text-slate-600 dark:text-slate-300"
              />

              {note && (
                <p className="mt-2 ml-2 flex items-start gap-2 rounded-lg bg-slate-50 p-2.5 text-sm text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                  <Info className="mt-0.5 size-4 shrink-0 opacity-60" aria-hidden />
                  <span className="break-words whitespace-pre-line">{note}</span>
                </p>
              )}

              {onOpen && (
                <button
                  type="button"
                  className="btn-secondary btn-sm mt-3 ml-2"
                  onClick={() => onOpen(activity)}
                >
                  <Pencil className="size-3.5" aria-hidden />
                  Öffnen
                </button>
              )}
            </div>
          )
        })}
      </div>
    </Modal>
  )
}
