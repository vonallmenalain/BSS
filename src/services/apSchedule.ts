// Mit Dateiendung, damit sich das Modul auch ohne Bundler ausführen lässt
// (`node --test`). Vite und TypeScript lösen das genauso auf.
import { isoDate } from './importHistory.ts'
import { isSchoolHoliday } from '../lib/schoolHolidays.ts'
import { AP_CLASS_WEEKLY_FROM, apClassHours, type ApActivityKind } from '../lib/types.ts'

/**
 * Das Grundgerüst eines Aktivitätenplans erzeugen.
 *
 * Der Plan hat einen festen Takt:
 *
 *  - **jeden Mittwochabend** eine Aktivität,
 *  - **ausser am 3. Mittwoch im Monat** – dann ist FHV, und die
 *    AP-Aktivität fällt aus,
 *  - **ausser in den Schulferien** – dann ist die halbe Klasse weg, und es
 *    findet nichts statt (siehe `lib/schoolHolidays`),
 *  - dazu die **AP-Klasse** am Sonntag: bis August 2026 am 2. und 4.
 *    Sonntag von 11 bis 12 Uhr, **ab September 2026 an jedem Sonntag**
 *    von 11:35 bis 12:00 (siehe `AP_CLASS_WEEKLY_FROM`),
 *  - **ausser am 1. Sonntag im April und im Oktober** – dann ist
 *    Generalkonferenz, und in der Gemeinde findet nichts statt.
 *
 * Diese Termine von Hand einzutragen, wäre die halbe Jahresplanung: gut
 * siebzig Zeilen, in denen nichts steht als das Datum. Deshalb legt die
 * App sie an – leer, als Gerüst. Was an einem Abend stattfindet, kommt
 * später dazu; dass an diesem Abend etwas stattfindet, steht schon da.
 *
 * **Die Ferien gehen der FHV vor.** Fällt der 3. Mittwoch in die Ferien,
 * steht dort der Ferienhinweis: Die FHV erklärt eine Lücke, die ohnehin
 * schon erklärt ist, und «Schulferien» ist der Grund, den man sucht.
 *
 * Der ausgefallene Abend wird bewusst **mit** eingetragen statt
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
  /** AP-Klassen an den Sonntagen anlegen, an denen sie stattfinden */
  classes: boolean
  /** Am 3. Mittwoch «FHV – keine Aktivität» eintragen */
  fhv: boolean
  /** An den Mittwochen in den Schulferien «Schulferien Burgdorf …» eintragen */
  holidays: boolean
  /** Am 1. Sonntag im April und im Oktober «Generalkonferenz …» eintragen */
  conference: boolean
}

/**
 * Welche Regel diesen Termin erzeugt hat.
 *
 * Der Dialog zählt damit je Zeile, was sie anlegen würde – drei Arten von
 * Ausfall sehen im Plan gleich aus, kommen aber aus drei Gründen. Das Feld
 * bleibt in der App: Was in Firestore steht, ist der Termin selbst.
 */
export type ApScheduleReason = 'activity' | 'class' | 'fhv' | 'holiday' | 'conference'

export interface ApScheduleEntry {
  date: string
  kind: ApActivityKind
  title: string
  /**
   * «11:35» bis «12:00» bei der Klasse, sonst beides leer.
   *
   * Wann ein Mittwochabend beginnt und wie lange er geht, weiss der Takt
   * nicht – die Klasse aber hat ihre feste Stunde, und die steht dann auch
   * am Termin. Wer sie ausnahmsweise verschiebt, ändert zwei Felder.
   */
  time: string
  endTime: string
  reason: ApScheduleReason
}

/** Wochentage, an denen etwas stattfindet – `Date.getDay()`. */
const WEDNESDAY = 3
const SUNDAY = 0

/** An diesen Sonntagen im Monat war AP-Klasse – bis August 2026. */
export const CLASS_WEEKS = [2, 4]

/** Am wievielten Mittwoch im Monat ist FHV? */
export const FHV_WEEK = 3

export const FHV_TITLE = 'FHV – keine Aktivität'

export const HOLIDAY_TITLE = 'Schulferien Burgdorf – keine Aktivität'

export const CONFERENCE_TITLE = 'Generalkonferenz – keine Klasse'

/**
 * Der 1. Sonntag im April und im Oktober – dann ist Generalkonferenz.
 *
 * An diesen beiden Wochenenden findet in der Gemeinde nichts statt, also
 * auch keine AP-Klasse. Dieselbe Regel gilt für die Abendmahlsversammlung
 * und steht dort ein zweites Mal (`lib/sunday`, `automaticSacramentKind`);
 * sie ist dort auf den ersten Sonntag **des Versammlungswochentags**
 * bezogen und lässt sich deshalb nicht teilen. Der 1. Sonntag ist immer der
 * 1. bis 7. des Monats.
 */
export function isGeneralConferenceSunday(date: string): boolean {
  const [year, month, day] = date.split('-').map(Number)
  if (month !== 4 && month !== 10) return false
  if (day > 7) return false
  return new Date(year, month - 1, day).getDay() === SUNDAY
}

/**
 * Ist an diesem Sonntag nach dem Takt AP-Klasse – ohne die Ausnahmen?
 *
 * Bis August 2026 nur am 2. und 4., seit September an jedem. Der Stichtag
 * steht bewusst im Datum und nicht in einer Einstellung: Der Plan reicht
 * über den Wechsel hinweg, und ein Schalter würde die Vergangenheit
 * mitverändern.
 */
function isClassRhythmSunday(date: string, week: number): boolean {
  return date >= AP_CLASS_WEEKLY_FROM || CLASS_WEEKS.includes(week)
}

/**
 * Findet an diesem Sonntag AP-Klasse statt?
 *
 * Der Takt sagt ja – ausser an den beiden Konferenzsonntagen, an denen in
 * der Gemeinde nichts stattfindet. Auch der Themen-Import fragt hier nach
 * und lässt die Lektion dieses Sonntags dann liegen (`apClassSundays`).
 */
export function isApClassSunday(date: string, week: number): boolean {
  return isClassRhythmSunday(date, week) && !isGeneralConferenceSunday(date)
}

/** Der wievielte Sonntag (bzw. Mittwoch) des Monats ist dieser Tag? */
function weekOfMonth(day: number): number {
  return Math.floor((day - 1) / 7) + 1
}

/**
 * Alle Sonntage eines Monats – «2026-11» → fünf Tage.
 *
 * Grundlage für die Themen der Klasse: Die vier Lektionen aus «Für eine
 * starke Jugend» gehen der Reihe nach an den ersten bis vierten Sonntag –
 * gezählt wird über alle Sonntage des Monats, nicht über die
 * Klassentermine (siehe `services/importApTopics`).
 */
export function sundaysOfMonth(month: string): string[] {
  const [year, index] = month.split('-').map(Number)
  if (!year || !index) return []

  const days: string[] = []
  const cursor = new Date(year, index - 1, 1)
  while (cursor.getMonth() === index - 1) {
    if (cursor.getDay() === SUNDAY) days.push(isoDate(year, index, cursor.getDate()))
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

/** Die Sonntage eines Monats, an denen AP-Klasse ist. */
export function apClassSundays(month: string): string[] {
  return sundaysOfMonth(month).filter((date) =>
    isApClassSunday(date, weekOfMonth(Number(date.slice(8)))),
  )
}

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
      const week = weekOfMonth(cursor.getDate())

      if (weekday === WEDNESDAY) {
        // Die Ferien gehen der FHV vor: Sie erklären die Lücke besser.
        if (isSchoolHoliday(date)) {
          if (options.holidays) entries.push(cancelled(date, HOLIDAY_TITLE, 'holiday'))
        } else if (week === FHV_WEEK) {
          if (options.fhv) entries.push(cancelled(date, FHV_TITLE, 'fhv'))
        } else if (options.activities) {
          entries.push({
            date,
            kind: 'activity',
            title: '',
            time: '',
            endTime: '',
            reason: 'activity',
          })
        }
      } else if (weekday === SUNDAY && isClassRhythmSunday(date, week)) {
        // Nur, wo sonst eine Klasse stünde – sonst erklärt der Hinweis nichts.
        if (isGeneralConferenceSunday(date)) {
          if (options.conference) entries.push(cancelled(date, CONFERENCE_TITLE, 'conference'))
        } else if (options.classes) {
          const hours = apClassHours(date)
          entries.push({
            date,
            kind: 'class',
            title: '',
            time: hours.start,
            endTime: hours.end,
            reason: 'class',
          })
        }
      }
    }

    cursor.setDate(cursor.getDate() + 1)
  }

  return entries
}

/** Ein ausgefallener Abend – dreimal dasselbe bis auf den Grund. */
function cancelled(date: string, title: string, reason: ApScheduleReason): ApScheduleEntry {
  return { date, kind: 'cancelled', title, time: '', endTime: '', reason }
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
    const week = weekOfMonth(cursor.getDate())
    const weekday = cursor.getDay()
    const isSlot =
      (weekday === WEDNESDAY && week !== FHV_WEEK && !isSchoolHoliday(date)) ||
      (weekday === SUNDAY && isApClassSunday(date, week))

    if (isSlot && !skip.has(date)) return date
    cursor.setDate(cursor.getDate() + 1)
  }

  return isoDate(from.getFullYear(), from.getMonth() + 1, from.getDate())
}
