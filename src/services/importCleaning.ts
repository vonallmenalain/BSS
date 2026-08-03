// Mit Dateiendung, damit sich das Modul auch ohne Bundler ausführen lässt
// (`node --test`). Vite und TypeScript lösen das genauso auf.
import { isoDate } from './importHistory.ts'

/**
 * Den Putzplan der Gemeinde aus der Tabelle lesen.
 *
 * Der Plan entsteht zweimal im Jahr in Excel und sieht seit Jahren gleich
 * aus: eine Überschrift mit dem Jahr, danach je Woche eine Zeile mit
 * Gruppe, Namen und Zeitraum, dazwischen Leerzeilen. Die Spalten stehen
 * nicht fest – wer die Tabelle pflegt, schiebt sie gelegentlich –, deshalb
 * wird jede Zeile **durchsucht** statt an festen Positionen gelesen:
 *
 *  - eine Zelle wie «Gruppe 7» ist die Gruppe,
 *  - eine Zelle wie «13.7. - 18.7.» ist der Zeitraum,
 *  - die längste übrige Zelle sind die Namen,
 *  - was danach noch kommt, ist die Bemerkung («Generalkonf.»).
 *
 * Ohne Zeitraum ist eine Zeile keine Woche – so fallen Titel, Legenden und
 * Leerzeilen von selbst weg, ohne dass sie aufgezählt werden müssten.
 *
 * Bewusst frei von Firestore: Genau dieses Lesen lässt sich damit ohne
 * Bundler prüfen, und die Jahresgrenze im Dezember ist die Art Detail, die
 * man einmal richtig hinschreibt und danach nie wieder anschaut.
 */

export interface ParsedCleaningWeek {
  /** «2026-06-29» */
  startDate: string
  /** «2026-07-04» */
  endDate: string
  /** «Gruppe 2» */
  group: string
  /** «Bader Roger & Sylvie» */
  team: string
  /** «Generalkonf.» – leer, wenn nichts danebensteht */
  note: string
  /** Zeile in der Tabelle, für die Vorschau */
  row: number
}

export interface ParsedCleaningPlan {
  weeks: ParsedCleaningWeek[]
  /** Jahr aus der Überschrift, sonst das laufende */
  year: number
  /** Stand das Jahr in der Datei, oder wurde es angenommen? */
  yearFromTitle: boolean
  /** Zeilen mit einem Zeitraum, denen die Namen fehlten */
  incomplete: number
}

/** «29.6. - 4.7.», «2.8.–8.8.», «27.12. - 2.1.» */
const RANGE = /(\d{1,2})\s*\.\s*(\d{1,2})\s*\.?\s*[-–—]\s*(\d{1,2})\s*\.\s*(\d{1,2})\s*\.?/

/** «Gruppe 7», «Gruppe 10» */
const GROUP = /^gruppe\s*\d+$/i

/** Erstes vierstelliges Jahr im Text – «Putzplan 2026 Juli – Dezember». */
const YEAR = /\b(20\d{2})\b/

/**
 * Liest die Zeilen der Tabelle.
 *
 * `fallbackYear` gilt nur, wenn in der Datei kein Jahr steht – ein Plan
 * ohne Jahresangabe ist der Ausnahmefall, und das laufende Jahr ist dann
 * die einzig sinnvolle Annahme.
 */
export function parseCleaningSheet(
  rows: string[][],
  fallbackYear = new Date().getFullYear(),
): ParsedCleaningPlan {
  const titleYear = findYear(rows)
  const year = titleYear ?? fallbackYear

  const weeks: ParsedCleaningWeek[] = []
  let incomplete = 0

  /*
   * Der Plan läuft chronologisch, und die Tabelle nennt nur Tag und Monat.
   * Sobald der Monat kleiner wird als beim letzten Eintrag, ist ein Jahr
   * vergangen – so bekommt «27.12. – 2.1.» sein richtiges Datum, und zwar
   * auf beiden Seiten des Bindestrichs getrennt.
   */
  let cursor = { year, month: 0 }

  rows.forEach((cells, index) => {
    const trimmed = cells.map((cell) => (cell ?? '').trim())
    const rangeIndex = trimmed.findIndex((cell) => RANGE.test(cell))
    if (rangeIndex === -1) return

    const match = RANGE.exec(trimmed[rangeIndex])
    if (!match) return

    const [, startDay, startMonth, endDay, endMonth] = match.map(Number)

    cursor = advance(cursor, startMonth)
    const startYear = cursor.year
    cursor = advance(cursor, endMonth)
    const endYear = cursor.year

    const rest = trimmed.filter((cell, position) => cell && position !== rangeIndex)
    const group = rest.find((cell) => GROUP.test(cell)) ?? ''
    // Die Namen sind das, was übrig bleibt – und wo mehreres übrig bleibt,
    // das Längste: «Morales-Römer Oscar & Céleste» gegen ein «x» in einer
    // vergessenen Hilfsspalte.
    const others = rest.filter((cell) => cell !== group)
    const team = others.reduce(
      (longest, cell) => (cell.length > longest.length ? cell : longest),
      '',
    )
    const note = others
      .filter((cell) => cell !== team)
      .join(' ')
      .trim()

    if (!team) {
      incomplete++
      return
    }

    weeks.push({
      startDate: isoDate(startYear, startMonth, startDay),
      endDate: isoDate(endYear, endMonth, endDay),
      group,
      team,
      note,
      row: index + 1,
    })
  })

  return { weeks, year, yearFromTitle: titleYear !== null, incomplete }
}

/** Das Jahr aus der Überschrift – geprüft werden nur die ersten Zeilen. */
function findYear(rows: string[][]): number | null {
  for (const cells of rows.slice(0, 5)) {
    for (const cell of cells) {
      const match = YEAR.exec(cell ?? '')
      if (match) return Number(match[1])
    }
  }
  return null
}

/** Rückt den Zeiger auf den nächsten Monat vor – über den Jahreswechsel hinweg. */
function advance(cursor: { year: number; month: number }, month: number) {
  return month < cursor.month ? { year: cursor.year + 1, month } : { year: cursor.year, month }
}

/* ------------------------------------------------------------------ */
/* Text für die Bekanntmachung                                         */
/* ------------------------------------------------------------------ */

/**
 * Die beiden Wochen, um die es an einem Sonntag geht.
 *
 * Am Sonntag wird nach hinten gedankt und nach vorn angekündigt: Eine
 * Putzwoche geht zu Ende, die nächste steht an.
 *
 * Wo genau der Sonntag liegt, ist von Plan zu Plan verschieden – und sogar
 * innerhalb eines Plans: Die Tabelle der Gemeinde zählt zuerst von Montag
 * bis Samstag (der Sonntag liegt dann dazwischen) und ab August von Sonntag
 * bis Samstag (der Sonntag ist dann der erste Tag der neuen Woche). Beides
 * kommt vor, und beides meint dasselbe. Deshalb wird nicht gezählt, sondern
 * verglichen:
 *
 *  - **davor** ist die zuletzt beginnende Woche, die vor dem Sonntag
 *    angefangen hat und spätestens an ihm endet,
 *  - **danach** die erste, die am Sonntag oder später beginnt.
 *
 * Damit stimmt die Aussage auch dann, wenn der Plan eine Lücke hat oder
 * eine Woche wegen der Generalkonferenz doppelt geführt wird.
 */
export interface CleaningAround<T> {
  previous: T | null
  next: T | null
}

export function cleaningAround<T extends { startDate: string; endDate: string }>(
  weeks: T[],
  sundayKey: string,
): CleaningAround<T> {
  let previous: T | null = null
  let next: T | null = null

  for (const week of weeks) {
    // ISO-Daten lassen sich als Text vergleichen.
    if (week.startDate < sundayKey && week.endDate <= sundayKey) {
      if (!previous || week.endDate > previous.endDate) previous = week
    } else if (week.startDate >= sundayKey) {
      if (!next || week.startDate < next.startDate) next = week
    }
  }

  return { previous, next }
}

/**
 * Platzhalter, die in einer Bekanntmachung aus dem Putzplan gefüllt werden.
 *
 * Deutsch und ausgeschrieben, damit sie sich beim Erfassen von selbst
 * erklären – wer den Satz umstellt, soll nicht in einer Anleitung
 * nachschlagen müssen.
 */
export const CLEANING_PLACEHOLDERS: [string, string][] = [
  ['{gruppe-vorher}', 'Gruppe der vergangenen Woche'],
  ['{team-vorher}', 'Putzteam der vergangenen Woche'],
  ['{gruppe-neu}', 'Gruppe der kommenden Woche'],
  ['{team-neu}', 'Putzteam der kommenden Woche'],
]

/** Der vorgeschlagene Wortlaut beim Anlegen einer Putzplan-Bekanntmachung. */
export const CLEANING_DEFAULT_TEXT =
  'Herzlichen Dank an {team-vorher} ({gruppe-vorher}) für das Putzen in der vergangenen Woche. In der kommenden Woche ist {gruppe-neu} an der Reihe: {team-neu}.'

export interface CleaningFacts {
  previousGroup: string
  previousTeam: string
  nextGroup: string
  nextTeam: string
}

/**
 * Setzt die Platzhalter ein.
 *
 * `null`, wenn der Text einen Platzhalter enthält, zu dem der Plan nichts
 * hergibt. Lieber gar keine Bekanntmachung als eine, in der am Sonntag
 * «Herzlichen Dank an ()» vorgelesen wird – die Lücke steht dann im
 * Putzplan und wird dort gemeldet.
 */
export function fillCleaningText(text: string, facts: CleaningFacts): string | null {
  const values: Record<string, string> = {
    '{gruppe-vorher}': facts.previousGroup,
    '{team-vorher}': facts.previousTeam,
    '{gruppe-neu}': facts.nextGroup,
    '{team-neu}': facts.nextTeam,
  }

  let missing = false
  const filled = text.replace(/\{[a-z-]+\}/g, (token) => {
    const value = values[token]
    if (value === undefined) return token
    if (!value) missing = true
    return value
  })

  return missing ? null : filled
}
