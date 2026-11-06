// Mit Dateiendung, damit sich das Modul auch ohne Bundler ausführen lässt
// (`node --test`). Vite und TypeScript lösen das genauso auf.
import { addDays, isDayKey, standingWaits, type StandingMeeting } from './standing.ts'
import type { AgendaItem } from './types.ts'

/**
 * Verschieben – auf die nächste Sitzung, um ein paar Wochen oder auf einen Tag.
 *
 * «Nicht heute» heisst meistens: in der nächsten Sitzung. Manchmal heisst es
 * aber auch «in drei Wochen, wenn der Bericht da ist» oder «nach Neujahr».
 * Dafür gibt es hier ein Datum – und das Datum ist kein Termin, an dem nichts
 * geschieht (so war das frühere Fälligkeitsdatum), sondern der Tag, ab dem
 * der Punkt wieder in eine Sitzung gehört:
 *
 * - **Ist an oder nach diesem Tag schon eine Sitzung geplant,** steht er
 *   sofort in der ersten davon.
 * - **Sonst wartet er im Sammelkorb** und kommt mit der ersten Sitzung mit,
 *   die an oder nach diesem Tag stattfindet. Einer Sitzung davor wird er
 *   nicht angeboten, und «Pendenzen übernehmen» lässt ihn dort liegen – genau
 *   wie eine ständige Pendenz, die auf ihre nächste Runde wartet
 *   (`standingWaits` in `lib/standing`).
 *
 * Gerechnet wird wie dort auf dem Text «yyyy-MM-dd», ohne Firestore und ohne
 * React; geprüft wird in `tests/defer.test.ts`.
 */

/** Um wie viele Wochen sich ein Punkt mit einem Griff verschieben lässt. */
export const DEFER_WEEKS = [1, 2, 3, 4] as const

/** «1 Woche», «3 Wochen» */
export function weeksLabel(weeks: number): string {
  return `${weeks} ${weeks === 1 ? 'Woche' : 'Wochen'}`
}

/**
 * Ab welchem Tag die Wochen gezählt werden.
 *
 * Ab der Sitzung, in der der Punkt steht, sofern sie noch bevorsteht: Wer
 * einen Punkt der Sitzung von nächster Woche um zwei Wochen verschiebt, meint
 * zwei Wochen nach dieser Sitzung und nicht zwei Wochen nach heute. Liegt sie
 * schon hinter uns (oder ist es die von heute) – oder steht der Punkt in gar
 * keiner –, zählt der heutige Tag. Dieselbe Regel wie beim Takt einer
 * ständigen Pendenz (`nextStandingRound`).
 */
export function deferBase(meetingDay: string | null | undefined, today: string): string {
  return isDayKey(meetingDay) && meetingDay > today ? meetingDay : today
}

/** Der Tag, ab dem der Punkt nach so vielen Wochen wieder dran ist. */
export function deferByWeeks(base: string, weeks: number): string {
  return addDays(base, weeks * 7)
}

/**
 * Die erste Sitzung an oder nach diesem Tag – oder `null`, wenn noch keine
 * geplant ist.
 *
 * «An oder nach»: Wer auf den 13. verschiebt und am 13. tagt, meint diese
 * Sitzung. Die Sitzung, in der der Punkt gerade steht (`exclude`), kommt nicht
 * in Frage – verschoben ist er erst, wenn er woanders steht. Abgeschlossene
 * Sitzungen gehören nicht in die Liste; das ist Sache des Aufrufers.
 */
export function meetingFrom(
  day: string,
  meetings: StandingMeeting[],
  exclude?: string | null,
): StandingMeeting | null {
  const sorted = [...meetings].sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
  )
  return sorted.find((meeting) => meeting.date >= day && meeting.id !== exclude) ?? null
}

/**
 * Wartet dieser Punkt noch auf seinen Tag?
 *
 * Gefragt wird nur am Punkt ohne Sitzung: Steht er in einer, ist der Tag
 * erreicht – oder jemand hat ihn von Hand dorthin gelegt, und dann gilt das.
 */
export function deferWaits(item: Pick<AgendaItem, 'deferredUntil'>, today: string): boolean {
  const until = item.deferredUntil
  return isDayKey(until) && until > today
}

/**
 * Gehört dieser Punkt an diesem Tag noch in keine Sitzung?
 *
 * Zwei Gründe gibt es dafür: eine ständige Pendenz, deren nächste Runde noch
 * nicht begonnen hat, und ein Punkt, der auf einen späteren Tag verschoben
 * wurde. Beide liegen ohne Sitzung im Sammelkorb, beiden fehlt aber keine
 * Sitzung – sie sind schlicht noch nicht dran.
 */
export function itemWaits(
  item: Pick<AgendaItem, 'standing' | 'deferredUntil'>,
  today: string,
): boolean {
  return standingWaits(item, today) || deferWaits(item, today)
}

/**
 * «2026-08-04» als `Date` – zur Mittagsstunde, damit Zeitzone und
 * Zeitumstellung den Tag nicht kippen (siehe `dayKey` in `lib/standing`).
 * Für die Anzeige mit den Formaten aus `lib/dates`.
 */
export function fromDayKey(key: string): Date {
  return new Date(
    Number(key.slice(0, 4)),
    Number(key.slice(5, 7)) - 1,
    Number(key.slice(8, 10)),
    12,
  )
}
