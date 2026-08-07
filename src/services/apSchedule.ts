// Mit Dateiendung, damit sich das Modul auch ohne Bundler ausführen lässt
// (`node --test`). Vite und TypeScript lösen das genauso auf.
import { isoDate } from './importHistory.ts'
import { AP_CLASS_TIME, type ApActivityKind } from '../lib/types.ts'

/**
 * Das Grundgerüst eines Aktivitätenplans erzeugen.
 *
 * Der Plan hat einen festen Takt, und der ist über Jahre derselbe:
 *
 *  - **jeden Mittwochabend** eine Aktivität,
 *  - **ausser am 3. Mittwoch im Monat** – dann ist FHV, und die
 *    AP-Aktivität fällt aus,
 *  - **am 2. und 4. Sonntag** die AP-Klasse, immer von 11 bis 12 Uhr.
 *
 * Diese Termine von Hand einzutragen, wäre die halbe Jahresplanung: gut
 * siebzig Zeilen, in denen nichts steht als das Datum. Deshalb legt die
 * App sie an – leer, als Gerüst. Was an einem Abend stattfindet, kommt
 * später dazu; dass an diesem Abend etwas stattfindet, steht schon da.
 *
 * Der ausgefallene Mittwoch wird bewusst **mit** eingetragen statt
 * ausgelassen: Ein Datum, das im Plan fehlt, sieht aus wie eine Lücke, die
 * noch jemand füllen muss. Steht «FHV – keine Aktivität» da, ist die Frage
 * beantwortet.
 *
 * Bewusst frei von Firestore, damit sich der Takt ohne Bundler prüfen lässt.
 */

export interface ApScheduleOptions {
  /** Erster Tag, «2026-01-01» */
  from: string
  /** Letzter Tag, «2026-12-31» */
  to: string
  /** Mittwochsaktivitäten anlegen */
  activities: boolean
  /** AP-Klassen am 2. und 4. Sonntag anlegen */
  classes: boolean
  /** Am 3. Mittwoch «FHV – keine Aktivität» eintragen */
  fhv: boolean
}

export interface ApScheduleEntry {
  date: string
  kind: ApActivityKind
  title: string
  /**
   * «11:00» bei der Klasse, sonst leer.
   *
   * Wann ein Mittwochabend beginnt, weiss der Takt nicht – die Klasse aber
   * ist immer von 11 bis 12, und das steht dann auch am Termin. Wer sie
   * ausnahmsweise verschiebt, ändert ein Feld.
   */
  time: string
}

/** Wochentage, an denen etwas stattfindet – `Date.getDay()`. */
const WEDNESDAY = 3
const SUNDAY = 0

/** An diesen Sonntagen im Monat ist AP-Klasse. */
export const CLASS_WEEKS = [2, 4]

/** Am wievielten Mittwoch im Monat ist FHV? */
export const FHV_WEEK = 3

export const FHV_TITLE = 'FHV – keine Aktivität'

/**
 * Die Termine des Grundtakts zwischen zwei Daten.
 *
 * `skipDates` sind Tage, an denen bereits etwas im Plan steht – sie
 * bleiben unangetastet. Ein zweiter Durchlauf legt deshalb nichts doppelt
 * an, und ein von Hand geänderter Mittwoch wird nicht wieder auf «leer»
 * zurückgesetzt.
 */
export function generateApSchedule(
  options: ApScheduleOptions,
  skipDates: Iterable<string> = [],
): ApScheduleEntry[] {
  const taken = new Set(skipDates)
  const entries: ApScheduleEntry[] = []

  const [fromYear, fromMonth, fromDay] = options.from.split('-').map(Number)
  const [toYear, toMonth, toDay] = options.to.split('-').map(Number)
  if (!fromYear || !toYear) return entries

  const last = new Date(toYear, toMonth - 1, toDay)
  const cursor = new Date(fromYear, fromMonth - 1, fromDay)

  // Zwei Jahre Vorlauf sind mehr, als je gebraucht wird – die Grenze ist
  // nur da, damit ein vertipptes Enddatum nicht Tausende Termine anlegt.
  const limit = 800

  for (let guard = 0; cursor <= last && guard < limit; guard++) {
    const weekday = cursor.getDay()
    const date = isoDate(cursor.getFullYear(), cursor.getMonth() + 1, cursor.getDate())

    if (!taken.has(date)) {
      const week = Math.floor((cursor.getDate() - 1) / 7) + 1

      if (weekday === WEDNESDAY) {
        if (week === FHV_WEEK) {
          if (options.fhv) entries.push({ date, kind: 'cancelled', title: FHV_TITLE, time: '' })
        } else if (options.activities) {
          entries.push({ date, kind: 'activity', title: '', time: '' })
        }
      } else if (weekday === SUNDAY && CLASS_WEEKS.includes(week) && options.classes) {
        entries.push({ date, kind: 'class', title: '', time: AP_CLASS_TIME })
      }
    }

    cursor.setDate(cursor.getDate() + 1)
  }

  return entries
}

/**
 * Der nächste Termin, an dem üblicherweise etwas stattfindet und noch
 * nichts im Plan steht.
 *
 * Das ist der Vorschlag, mit dem sich das Formular für eine neue Aktivität
 * öffnet: In neun von zehn Fällen ist es genau dieser Mittwoch, und wer
 * einen anderen Tag meint, ändert ein Feld.
 */
export function nextFreeApDate(taken: Iterable<string>, from = new Date()): string {
  const skip = new Set(taken)
  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate())

  for (let guard = 0; guard < 400; guard++) {
    const date = isoDate(cursor.getFullYear(), cursor.getMonth() + 1, cursor.getDate())
    const week = Math.floor((cursor.getDate() - 1) / 7) + 1
    const weekday = cursor.getDay()
    const isSlot =
      (weekday === WEDNESDAY && week !== FHV_WEEK) ||
      (weekday === SUNDAY && CLASS_WEEKS.includes(week))

    if (isSlot && !skip.has(date)) return date
    cursor.setDate(cursor.getDate() + 1)
  }

  return isoDate(from.getFullYear(), from.getMonth() + 1, from.getDate())
}
