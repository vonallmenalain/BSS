// Mit Dateiendung, damit sich der Parser auch ohne Bundler ausführen lässt
// (`node --test`). Vite und TypeScript lösen das genauso auf.
import { isoDate } from './importHistory.ts'
import type { ApActivityKind } from '../lib/types.ts'

/**
 * Den Aktivitätenplan der AP aus der Excel-Tabelle lesen.
 *
 * Der Plan wird einmal im Jahr in Excel aufgesetzt und hat einen klaren
 * Aufbau: ein Titel, eine Kopfzeile mit sieben Spalten, danach je Monat
 * eine Zwischenüberschrift («JANUAR – LEITUNG LEHRER») und darunter die
 * Termine.
 *
 * Zwei Dinge machen das Lesen trotzdem heikel, und beide stecken in der
 * Datumsspalte:
 *
 *  1. Excel liefert ein echtes Datum als **Zahl** – 46029 ist der
 *     7. Januar 2026. Ob in der Zelle ein Datum oder eine Zahl steht,
 *     hängt allein am Zellformat.
 *  2. Mehrtägiges wird von Hand hineingeschrieben: «03. April – 06. April
 *     2026», «Freitag + Samstag, 30.01 -31.01.2026». Das ist kein Datum
 *     mehr, sondern ein Satz – aber er meint einen Zeitraum, und der
 *     gehört in den Plan.
 *
 * Deshalb wird die Zelle nicht nach einem Muster gelesen, sondern
 * **durchsucht**: Alles, was wie ein Tagesdatum aussieht, wird
 * eingesammelt; das erste ist der Anfang, das letzte das Ende. Ohne Datum
 * ist eine Zeile kein Termin – so fallen Titel, Kopfzeile und Leerzeilen
 * von selbst weg, ohne dass sie aufgezählt werden müssten.
 *
 * Bewusst frei von Firestore: Genau dieses Lesen lässt sich damit ohne
 * Bundler prüfen.
 */

export interface ParsedApActivity {
  /** «2026-01-07» */
  date: string
  /** Letzter Tag bei mehrtägigen Anlässen, sonst `null` */
  endDate: string | null
  kind: ApActivityKind
  title: string
  location: string
  leader: string
  bishopric: string
  advisor: string
  note: string
  /** Zeile in der Tabelle, für die Vorschau */
  row: number
}

export interface ParsedApMonth {
  /** «2026-01» */
  month: string
  /** «Leitung Lehrer» */
  leadership: string
  row: number
}

export interface ParsedApPlan {
  activities: ParsedApActivity[]
  months: ParsedApMonth[]
  /** Zeilen mit Inhalt, aber ohne lesbares Datum – für die Warnung in der Vorschau */
  skipped: { row: number; text: string }[]
  /** Wurde die Kopfzeile gefunden, oder gilt die Reihenfolge des bisherigen Plans? */
  headerFound: boolean
}

/* ------------------------------------------------------------------ */
/* Spalten                                                             */
/* ------------------------------------------------------------------ */

type Field = 'date' | 'title' | 'location' | 'leader' | 'bishopric' | 'advisor' | 'note'

/**
 * Woran eine Spaltenüberschrift erkannt wird.
 *
 * Die beiden «Teilnahme»-Spalten stehen vor «Leitung / Org», weil beide
 * Male eine Person gemeint ist und nur das erste Wort sie unterscheidet.
 */
const COLUMNS: [Field, RegExp][] = [
  ['date', /^datum/i],
  ['title', /aktivit|klasse|thema/i],
  ['location', /treffpunkt|^ort/i],
  ['bishopric', /teilnahme.*(bss|bischof)/i],
  ['advisor', /teilnahme.*berater/i],
  ['leader', /leitung|organisation|^org/i],
  ['note', /bemerkung|sonstiges|programm/i],
]

/** Spaltenreihenfolge des bisherigen Plans – gilt, wenn keine Kopfzeile dasteht. */
const DEFAULT_ORDER: Field[] = [
  'date',
  'title',
  'location',
  'leader',
  'bishopric',
  'advisor',
  'note',
]

type ColumnMap = Partial<Record<Field, number>>

/** Sucht die Kopfzeile und ordnet die Spalten zu. */
function findColumns(rows: string[][]): { columns: ColumnMap; headerRow: number } | null {
  for (let index = 0; index < Math.min(rows.length, 20); index++) {
    const cells = (rows[index] ?? []).map((cell) => (cell ?? '').trim())
    if (!cells.some((cell) => /^datum/i.test(cell))) continue

    const columns: ColumnMap = {}
    cells.forEach((cell, position) => {
      if (!cell) return
      const hit = COLUMNS.find(
        ([field, pattern]) => pattern.test(cell) && columns[field] === undefined,
      )
      if (hit) columns[hit[0]] = position
    })

    if (columns.date !== undefined) return { columns, headerRow: index }
  }
  return null
}

/**
 * Ersatz, wenn keine Kopfzeile dasteht: ab der ersten Spalte, in der ein
 * Datum steht, in der Reihenfolge des bisherigen Plans.
 */
function guessColumns(rows: string[][]): ColumnMap {
  let start = 0
  for (const cells of rows) {
    const index = (cells ?? []).findIndex((cell) => parseApDate((cell ?? '').trim(), null) !== null)
    if (index !== -1) {
      start = index
      break
    }
  }

  const columns: ColumnMap = {}
  DEFAULT_ORDER.forEach((field, offset) => {
    columns[field] = start + offset
  })
  return columns
}

/* ------------------------------------------------------------------ */
/* Monatsüberschriften                                                 */
/* ------------------------------------------------------------------ */

const MONTH_NAMES = [
  'januar',
  'februar',
  'märz',
  'april',
  'mai',
  'juni',
  'juli',
  'august',
  'september',
  'oktober',
  'november',
  'dezember',
]

/** «JANUAR - LEITUNG LEHRER» → Monat 1, «Leitung Lehrer» */
export function parseApMonthHeading(text: string): { month: number; leadership: string } | null {
  const match = /^([A-Za-zÄÖÜäöüéè]+)\s*(?:[-–—:]\s*(.*))?$/.exec((text ?? '').trim())
  if (!match) return null

  const month = MONTH_NAMES.indexOf(match[1].toLowerCase())
  if (month === -1) return null

  return { month: month + 1, leadership: titleCase((match[2] ?? '').trim()) }
}

/** «LEITUNG LEHRER» → «Leitung Lehrer»; gemischt Geschriebenes bleibt, wie es ist. */
function titleCase(text: string): string {
  if (!text || text !== text.toUpperCase()) return text
  return text
    .toLowerCase()
    .replace(
      /(^|[\s/-])([a-zäöü])/g,
      (_, prefix: string, letter: string) => prefix + letter.toUpperCase(),
    )
}

/* ------------------------------------------------------------------ */
/* Datum                                                               */
/* ------------------------------------------------------------------ */

/** Excel zählt die Tage ab dem 30. Dezember 1899. */
const EXCEL_EPOCH = Date.UTC(1899, 11, 30)

/** Plausibler Bereich für ein Excel-Datum: etwa 1990 bis 2090. */
const SERIAL_MIN = 32874
const SERIAL_MAX = 69400

export interface ApDateRange {
  start: string
  /** `null`, wenn die Zelle nur einen Tag nennt */
  end: string | null
  /** Stand die Jahreszahl in der Zelle, oder kam sie von aussen? */
  yearStated: boolean
}

interface DayPart {
  day: number
  month: number
  year: number | null
  /** Stelle im Text – die beiden Schreibweisen werden getrennt gesucht */
  at: number
}

/**
 * Liest ein Datum oder einen Zeitraum aus einer Zelle.
 *
 * Erkannt werden, in dieser Reihenfolge:
 *
 *  - die Excel-Zahl («46029»),
 *  - das ISO-Datum («2026-01-07»),
 *  - jede Folge von Tagesangaben im Text – «30.01 -31.01.2026»,
 *    «03. April - 06. April 2026», «30. Oktober - 1. November 2026».
 *
 * Fehlt die Jahreszahl, gilt `fallbackYear`. Steht sie nur einmal am Ende
 * («30.01 -31.01.2026»), gilt sie für die ganze Zelle; ein Zeitraum über
 * den Jahreswechsel wird daran erkannt, dass der Monat kleiner wird.
 */
export function parseApDate(text: string, fallbackYear: number | null): ApDateRange | null {
  const trimmed = (text ?? '').trim()
  if (!trimmed) return null

  // Excel-Zahl
  if (/^\d+(\.0+)?$/.test(trimmed)) {
    const serial = Math.round(Number(trimmed))
    if (serial < SERIAL_MIN || serial > SERIAL_MAX) return null
    const date = new Date(EXCEL_EPOCH + serial * 86_400_000)
    return { start: date.toISOString().slice(0, 10), end: null, yearStated: true }
  }

  // ISO-Datum – so kommt es an, wenn die Tabelle als CSV vorliegt
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed)
  if (iso) return { start: `${iso[1]}-${iso[2]}-${iso[3]}`, end: null, yearStated: true }

  const parts = collectDayParts(trimmed)
  if (parts.length === 0) return null

  // Eine Jahreszahl irgendwo in der Zelle gilt für die ganze Zelle.
  const stated = parts.find((part) => part.year !== null)?.year ?? null
  const base = stated ?? fallbackYear
  if (base === null) return null

  let year = base
  let previousMonth = 0
  const dates = parts.map((part) => {
    // «27.12. – 2.1.» – wird der Monat kleiner, ist ein Jahr vergangen.
    if (previousMonth && part.month < previousMonth) year++
    previousMonth = part.month
    return isoDate(part.year ?? year, part.month, part.day)
  })

  return {
    start: dates[0],
    end: dates.length > 1 ? dates[dates.length - 1] : null,
    yearStated: stated !== null,
  }
}

/** «30.01 -31.01.2026» und «03. April - 06. April 2026» in ihre Tage zerlegen. */
function collectDayParts(text: string): DayPart[] {
  const parts: DayPart[] = []

  // «30.01.2026», «6.7.», «13.7.2026»
  for (const match of text.matchAll(/(\d{1,2})\s*\.\s*(\d{1,2})\s*\.?\s*(\d{4})?/g)) {
    const day = Number(match[1])
    const month = Number(match[2])
    if (day < 1 || day > 31 || month < 1 || month > 12) continue
    parts.push({ day, month, year: match[3] ? Number(match[3]) : null, at: match.index })
  }

  // «03. April 2026», «1. November»
  const named = new RegExp(`(\\d{1,2})\\s*\\.?\\s*(${MONTH_NAMES.join('|')})\\s*(\\d{4})?`, 'gi')
  for (const match of text.matchAll(named)) {
    const day = Number(match[1])
    if (day < 1 || day > 31) continue
    parts.push({
      day,
      month: MONTH_NAMES.indexOf(match[2].toLowerCase()) + 1,
      year: match[3] ? Number(match[3]) : null,
      at: match.index,
    })
  }

  return parts.sort((a, b) => a.at - b.at)
}

/* ------------------------------------------------------------------ */
/* Art des Termins                                                     */
/* ------------------------------------------------------------------ */

/** «FHV – keine Aktivität», «Ferien - keine Aktivität», «keine Klasse» */
const CANCELLED = /keine\s+(aktivit|klasse)|f[äa]llt\s+aus|abgesagt/i

/**
 * Welche Art von Termin das ist.
 *
 * Der Takt des Plans steckt in den Wochentagen: Mittwoch ist Aktivität,
 * Sonntag ist Klasse, alles Übrige und alles Mehrtägige ist besonders.
 * Ein Titel, der das Ausfallen ankündigt, gewinnt gegen beides – ein
 * ausgefallener Mittwoch bleibt im Plan stehen, damit niemand ihn ein
 * zweites Mal verplant.
 */
export function apActivityKind(
  date: string,
  endDate: string | null,
  title: string,
): ApActivityKind {
  if (CANCELLED.test(title ?? '')) return 'cancelled'
  if (endDate && endDate !== date) return 'special'

  const [year, month, day] = date.split('-').map(Number)
  const weekday = new Date(year, month - 1, day).getDay()
  if (weekday === 3) return 'activity'
  if (weekday === 0) return 'class'
  return 'special'
}

/* ------------------------------------------------------------------ */
/* Lesen                                                               */
/* ------------------------------------------------------------------ */

/** Verschiebt ein ISO-Datum um ein Jahr nach hinten. */
function nextYearOf(date: string): string {
  return `${Number(date.slice(0, 4)) + 1}${date.slice(4)}`
}

/**
 * Liest die Zeilen der Tabelle.
 *
 * `fallbackYear` greift nur, wenn im ganzen Plan keine Jahreszahl steht –
 * in der Praxis kommt das nicht vor, weil Excel die Datumszellen mit Jahr
 * liefert.
 */
export function parseApSheet(
  rows: string[][],
  fallbackYear = new Date().getFullYear(),
): ParsedApPlan {
  const found = findColumns(rows)
  const columns = found?.columns ?? guessColumns(rows)
  const startRow = found ? found.headerRow + 1 : 0

  const activities: ParsedApActivity[] = []
  const months: ParsedApMonth[] = []
  const skipped: { row: number; text: string }[] = []

  const cellAt = (cells: string[], field: Field) => {
    const index = columns[field]
    return index === undefined ? '' : (cells[index] ?? '').trim()
  }

  /*
   * Das Jahr steht in keiner Überschrift, sondern nur in den Datumszellen.
   * Eine Monatsüberschrift bekommt es deshalb erst vom nächsten Termin
   * darunter – bis dahin bleibt sie liegen. Nennt dieser Termin einen
   * kleineren Monat als die Überschrift, liegt dazwischen ein
   * Jahreswechsel, und die Überschrift gehört ins Jahr davor.
   */
  let openHeadings: { month: number; leadership: string; row: number }[] = []
  let cursorYear: number | null = null
  let lastMonth = 0

  const flushHeadings = (year: number, month: number) => {
    for (const heading of openHeadings) {
      const headingYear = heading.month > month ? year - 1 : year
      months.push({
        month: `${headingYear}-${String(heading.month).padStart(2, '0')}`,
        leadership: heading.leadership,
        row: heading.row,
      })
    }
    openHeadings = []
  }

  for (let index = startRow; index < rows.length; index++) {
    const cells = (rows[index] ?? []).map((cell) => (cell ?? '').trim())
    const filled = cells.filter(Boolean)
    if (filled.length === 0) continue

    // Monatsüberschrift: eine einzige gefüllte Zelle, und sie nennt einen Monat.
    if (filled.length === 1) {
      const heading = parseApMonthHeading(filled[0])
      if (heading) {
        openHeadings.push({ ...heading, row: index + 1 })
        continue
      }
    }

    const range = parseApDate(cellAt(cells, 'date'), cursorYear ?? fallbackYear)
    if (!range) {
      skipped.push({ row: index + 1, text: filled.join(' · ').slice(0, 120) })
      continue
    }

    /*
     * Nennt die Zelle kein Jahr und springt der Monat zurück, ist seit dem
     * letzten Termin ein Jahr vergangen – ein Plan, der über den
     * Jahreswechsel läuft.
     */
    let { start, end } = range
    if (!range.yearStated && cursorYear !== null && Number(start.slice(5, 7)) < lastMonth) {
      start = nextYearOf(start)
      end = end ? nextYearOf(end) : null
    }

    cursorYear = Number(start.slice(0, 4))
    lastMonth = Number(start.slice(5, 7))
    flushHeadings(cursorYear, lastMonth)

    const title = cellAt(cells, 'title')
    activities.push({
      date: start,
      endDate: end,
      kind: apActivityKind(start, end, title),
      title,
      location: cellAt(cells, 'location'),
      leader: cellAt(cells, 'leader'),
      bishopric: cellAt(cells, 'bishopric'),
      advisor: cellAt(cells, 'advisor'),
      note: cellAt(cells, 'note'),
      row: index + 1,
    })
  }

  // Überschriften ganz am Schluss, unter denen kein Termin mehr steht.
  if (openHeadings.length > 0) {
    flushHeadings(cursorYear ?? fallbackYear, openHeadings[0].month)
  }

  activities.sort((a, b) => a.date.localeCompare(b.date) || a.row - b.row)
  months.sort((a, b) => a.month.localeCompare(b.month))

  return { activities, months, skipped, headerFound: found !== null }
}
