// Mit Dateiendung, damit sich das Modul auch ohne Bundler ausführen lässt
// (`node --test`). Vite und TypeScript lösen das genauso auf.
import { tablePdf } from '../lib/pdf.ts'
import type { CleaningWeek } from '../lib/types.ts'

/**
 * Der Putzplan als PDF zum Ausdrucken.
 *
 * Bewusst schlicht: je Woche eine Zeile mit der Kalenderwoche, den Tagen,
 * wer an der Reihe ist, und der Gruppe. Bemerkungen und alles Übrige bleiben
 * in der App – der Ausdruck hängt am Anschlagbrett und soll sich im
 * Vorbeigehen lesen lassen.
 *
 * Bewusst frei von Firestore und React, damit sich die Aufbereitung mit
 * `node --test` prüfen lässt.
 */

type Week = Pick<CleaningWeek, 'startDate' | 'endDate' | 'group' | 'team'>

const MONTHS = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
]

/**
 * Die Kalenderwoche nach ISO 8601 – so zählt man sie hierzulande.
 *
 * Gerechnet wird über den Donnerstag derselben Woche: Er entscheidet nach
 * ISO, zu welchem Jahr eine Woche gehört.
 */
export function isoWeek(day: string): number {
  const [year, month, date] = day.split('-').map(Number)
  const value = new Date(Date.UTC(year, month - 1, date))
  const weekday = value.getUTCDay() || 7
  value.setUTCDate(value.getUTCDate() + 4 - weekday)
  const yearStart = Date.UTC(value.getUTCFullYear(), 0, 1)
  return Math.ceil(((value.getTime() - yearStart) / 86_400_000 + 1) / 7)
}

/**
 * Die Kalenderwoche einer Putzwoche.
 *
 * Die Wochen des Plans laufen mal von Montag, mal von Sonntag bis Samstag
 * (siehe README, «Putzplan»). Ein Sonntag gehört nach ISO noch zur Woche
 * davor – gezählt wird deshalb die Mitte der Putzwoche: Sie liegt in beiden
 * Fällen in der Kalenderwoche ihrer Werktage.
 */
export function cleaningWeekNumber(week: Pick<Week, 'startDate' | 'endDate'>): number {
  const day = (key: string) => {
    const [year, month, date] = key.split('-').map(Number)
    return Date.UTC(year, month - 1, date)
  }
  const start = day(week.startDate)
  const days = Math.max(0, Math.round((day(week.endDate) - start) / 86_400_000))
  const middle = new Date(start + Math.floor(days / 2) * 86_400_000)
  return isoWeek(middle.toISOString().slice(0, 10))
}

/** «05.10. – 10.10.2026» – wie in der Liste der App. */
export function cleaningPeriod(week: Pick<Week, 'startDate' | 'endDate'>): string {
  const [, startMonth, startDay] = week.startDate.split('-')
  const [endYear, endMonth, endDay] = week.endDate.split('-')
  return `${startDay}.${startMonth}. – ${endDay}.${endMonth}.${endYear}`
}

/** «Gruppe 2» → «2». Was keine Nummer trägt, bleibt, wie es ist. */
export function groupNumber(group: string): string {
  const match = group.match(/\d+/)
  return match ? match[0] : group.trim()
}

/** «5. Oktober 2026» */
function longDate(day: string): string {
  const [year, month, date] = day.split('-').map(Number)
  return `${date}. ${MONTHS[month - 1]} ${year}`
}

/** «02.10.2026» */
function shortDate(day: string): string {
  const [year, month, date] = day.split('-')
  return `${date}.${month}.${year}`
}

/**
 * Die Wochen, die in den Zeitraum fallen – der Reihe nach.
 *
 * Dazu zählt jede Woche, die ihn berührt: Wer ab Mittwoch druckt, will die
 * laufende Woche noch auf dem Blatt haben.
 */
export function weeksInRange<T extends Week>(weeks: T[], from: string, to: string): T[] {
  return weeks
    .filter((week) => week.startDate <= to && week.endDate >= from)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
}

/** Je Woche eine Zeile: Woche, Datum, wer an der Reihe ist, Gruppe. */
export function cleaningRows(weeks: Week[]): string[][] {
  return weeks.map((week) => [
    String(cleaningWeekNumber(week)),
    cleaningPeriod(week),
    week.team.trim() || '–',
    groupNumber(week.group) || '–',
  ])
}

/** «Putzplan_2026-10-05_bis_2027-03-27.pdf» – sortiert sich im Download-Ordner von selbst. */
export function cleaningPdfFilename(from: string, to: string): string {
  return `Putzplan_${from}_bis_${to}.pdf`
}

export interface CleaningPdfOptions {
  /** Der ganze Plan – ausgewählt wird hier */
  weeks: Week[]
  /** «2026-10-05» */
  from: string
  /** «2027-03-27» */
  to: string
  /** Aus den Einstellungen – erscheint über der Tabelle, sofern gesetzt */
  wardName?: string
  /** Heute als «2026-10-02» – für den Stand unten links */
  today: string
  createdAt?: Date
}

/**
 * Das PDF – oder `null`, wenn im Zeitraum keine Woche liegt.
 *
 * Über der Tabelle steht der Zeitraum, den die Wochen tatsächlich abdecken,
 * nicht bloss der gewählte: Wer «ab 1. Oktober» wählt, bekommt eine Liste ab
 * dem Montag der ersten Woche – und so steht es dann auch darüber.
 */
export function cleaningPdf(options: CleaningPdfOptions): Uint8Array | null {
  const weeks = weeksInRange(options.weeks, options.from, options.to)
  if (weeks.length === 0) return null

  const first = weeks[0].startDate
  const last = weeks.reduce(
    (latest, week) => (week.endDate > latest ? week.endDate : latest),
    first,
  )
  const range = `${longDate(first)} – ${longDate(last)}`
  // «Gemeinde» ist die Voreinstellung und sagt auf dem Blatt nichts.
  const ward = options.wardName?.trim()
  const subtitle = ward && ward !== 'Gemeinde' ? `${ward} · ${range}` : range

  return tablePdf({
    title: 'Putzplan',
    subtitle,
    documentTitle: `Putzplan ${range}`,
    columns: [
      { label: 'Woche', width: 1, align: 'center' },
      { label: 'Datum', width: 2.6 },
      { label: 'An der Reihe', width: 5.2 },
      { label: 'Gruppe', width: 1.2, align: 'center' },
    ],
    rows: cleaningRows(weeks),
    footer: `Stand: ${shortDate(options.today)}`,
    createdAt: options.createdAt,
  })
}
