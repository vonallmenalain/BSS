import {
  addDays,
  addMonths,
  addWeeks,
  endOfCalendarWeek,
  endOfMonth,
  formatDayMonth,
  formatDayMonthYear,
  formatMonth,
  isSameMonth,
  isSameYear,
  startOfCalendarWeek,
  startOfDay,
  startOfMonth,
  toDateInput,
} from './dates.ts'
import { apStartTime, type ApActivity } from './types.ts'

/**
 * Der Aktivitätenplan als Kalender – eine Woche oder ein ganzer Monat.
 *
 * Liste und Kacheln zeigen, was im Plan steht. Ein Kalender zeigt zusätzlich,
 * was **nicht** darin steht: Ein Raster aus Wochentagen macht den leeren
 * dritten Mittwoch sichtbar, den eine Liste stillschweigend überspringt.
 * Genau darum geht es beim Planen – die Lücken zu finden.
 *
 * Firestore-frei wie `lib/sunday` und `lib/talkCandidates`, damit sich die
 * Rasterbildung prüfen lässt (`tests/ap-calendar.test.ts`). Gerechnet wird
 * mit Tagesschlüsseln «2026-07-08», genau wie sie am Termin stehen: Ein
 * Vergleich als Text kommt ohne Zeitzonen aus.
 */

export type ApCalendarMode = 'week' | 'month'

export interface ApCalendarDay {
  /** «2026-07-08» – zugleich der Schlüssel für React */
  key: string
  date: Date
  /**
   * Gehört der Tag zum gezeigten Monat?
   *
   * In der Monatsansicht füllen die angrenzenden Tage die erste und letzte
   * Zeile auf – sie stehen blass da. In der Wochenansicht gehören alle sieben
   * Tage dazu.
   */
  inRange: boolean
  /** Was an diesem Tag ansteht, nach Startzeit geordnet */
  activities: ApActivity[]
}

export interface ApCalendarWeek {
  /** Der Montag als «2026-07-06» */
  key: string
  days: ApCalendarDay[]
}

/** Letzter Tag eines Termins – mehrtägige Anlässe tragen `endDate`. */
function endKey(activity: Pick<ApActivity, 'date' | 'endDate'>): string {
  return activity.endDate || activity.date
}

/**
 * Innerhalb eines Tages nach Startzeit, dann nach Titel.
 *
 * Gerechnet wird mit der Zeit, die auch angezeigt wird – bei der Klasse also
 * mit ihren 11:00, selbst wenn am Termin nichts erfasst ist. Sonst stünde sie
 * über einem Anlass, der um 09:00 beginnt.
 *
 * Termine, für die auch das keine Zeit ergibt, stehen zuoberst: Für sie gilt
 * die übliche Zeit, und die ist die frühe. Ein Lager ohne Zeitangabe hinter
 * der Klasse zu finden, wäre die falsche Reihenfolge.
 */
function byTime(a: ApActivity, b: ApActivity): number {
  const timeA = apStartTime(a)
  const timeB = apStartTime(b)
  if (timeA !== timeB) return timeA.localeCompare(timeB)
  return a.title.localeCompare(b.title)
}

/**
 * Das Raster zum angezeigten Zeitpunkt – Wochen von Montag bis Sonntag.
 *
 * Die Monatsansicht beginnt am Montag vor dem Monatsersten und endet am
 * Sonntag nach dem Monatsletzten: Ein Kalender mit angebrochenen Zeilen wäre
 * kein Raster mehr.
 *
 * Ein mehrtägiger Anlass steht an jedem Tag, den er belegt. Ein Lager von
 * Freitag bis Sonntag nur am Freitag zu zeigen, hiesse, den Samstag als frei
 * auszugeben – und genau das liest man aus einem Kalender heraus.
 */
export function apCalendarGrid(
  activities: ApActivity[],
  cursor: Date,
  mode: ApCalendarMode,
): ApCalendarWeek[] {
  const first = startOfCalendarWeek(mode === 'week' ? cursor : startOfMonth(cursor))
  const last = endOfCalendarWeek(mode === 'week' ? cursor : endOfMonth(cursor))

  const weeks: ApCalendarWeek[] = []
  let day = startOfDay(first)

  while (day <= last) {
    const days: ApCalendarDay[] = []
    for (let index = 0; index < 7; index++) {
      const key = toDateInput(day)
      days.push({
        key,
        date: day,
        inRange: mode === 'week' || isSameMonth(day, cursor),
        activities: activities
          .filter((activity) => activity.date <= key && endKey(activity) >= key)
          .sort(byTime),
      })
      day = addDays(day, 1)
    }
    weeks.push({ key: days[0].key, days })
  }

  return weeks
}

/** «6. – 12. Juli 2026», «29. Juni – 5. Juli 2026» oder «Juli 2026». */
export function apCalendarTitle(cursor: Date, mode: ApCalendarMode): string {
  if (mode === 'month') return formatMonth(cursor)

  const start = startOfCalendarWeek(cursor)
  const end = endOfCalendarWeek(cursor)

  // Der gemeinsame Teil steht nur einmal – «6. – 12. Juli 2026» liest sich
  // als eine Spanne, «6. Juli 2026 – 12. Juli 2026» als zwei Daten.
  if (isSameMonth(start, end)) return `${start.getDate()}. – ${formatDayMonthYear(end)}`
  if (isSameYear(start, end)) return `${formatDayMonth(start)} – ${formatDayMonthYear(end)}`
  return `${formatDayMonthYear(start)} – ${formatDayMonthYear(end)}`
}

/** Eine Woche bzw. einen Monat vor oder zurück. */
export function apCalendarStep(cursor: Date, mode: ApCalendarMode, delta: number): Date {
  return mode === 'week' ? addWeeks(cursor, delta) : addMonths(cursor, delta)
}

/**
 * Zeigt das Raster den heutigen Tag schon?
 *
 * Dann hat der Knopf «Heute» nichts zu tun und steht deshalb ruhig da.
 */
export function apCalendarShowsToday(cursor: Date, mode: ApCalendarMode, today: Date): boolean {
  if (mode === 'month') return isSameMonth(cursor, today)
  const start = startOfCalendarWeek(cursor)
  return toDateInput(start) === toDateInput(startOfCalendarWeek(today))
}
