// Mit Dateiendung, damit sich das Modul auch ohne Bundler ausführen lässt
// (`node --test` und die Netlify-Function).
import { escapeIcsText, foldIcsLine, icsDay, icsStamp, nextDayKey } from './apIcs.ts'
import { cleaningGroupNumber } from './cleaningGroups.ts'

/*
 * Die Putzwochen einer Gruppe als Kalender (`.ics`).
 *
 * Dieselbe Grundlage wie der Kalender des Aktivitätenplans (`lib/apIcs`):
 * dieselben Bausteine für Zeilen, Daten und Text, dieselbe Unterscheidung
 * zwischen Abo und Datei. Abonniert wird je Gruppe – wer putzt, will die
 * Wochen der eigenen Gruppe im Kalender, nicht den ganzen Plan.
 *
 * Eine Putzwoche steht als **ein ganztägiger Termin von Montag bis Samstag**
 * im Kalender. Der Plan zählt die Woche ab dem Sonntag; am Sonntag selbst
 * wird aber nicht geputzt, und ein Balken, der schon am Sonntag beginnt,
 * sähe aus, als wäre es so.
 *
 * Gebraucht von zwei Seiten: der Netlify-Function, die den Kalender als
 * Abo ausliefert (`putzplan-ics`), und dem Dialog in der App, der dieselben
 * Termine einmalig als Datei herunterlädt. Die UID ist in beiden Fällen
 * dieselbe – Woche und Gruppe –, damit ein Kalender eine Woche wiedererkennt.
 */

/** Wie die Woche gespeichert ist – mit dem, was der Kalender davon braucht. */
export interface IcsCleaningWeek {
  /** Der erste Tag der Putzwoche, meist ein Sonntag – «2026-10-04» */
  startDate: string
  /** Der letzte Tag, ein Samstag – «2026-10-10» */
  endDate: string
  /** «Gruppe 5» */
  group: string
  /** Wer zuständig ist – «Bader Roger & Sylvie» */
  team: string
  note?: string
  updatedAt?: Date | null
}

export interface CleaningIcsOptions {
  /** Die Nummer der Gruppe – nur ihre Wochen kommen in den Kalender */
  group: number
  /** Der Name, unter dem der Kalender erscheint */
  name: string
  /** Der Host der App – steht in der UID hinter dem `@` */
  domain: string
  /** Zeitpunkt der Auslieferung – wird zu `DTSTAMP` */
  now: Date
  /** Die Seite des Putzplans – steht in jedem Termin */
  planUrl?: string
}

/** Die höchste Gruppennummer, die der Kalender annimmt – wie bei der Erinnerung. */
export const MAX_CALENDAR_GROUP = 99

/**
 * Eine Gruppennummer, wie sie in der Adresse steht – geprüft. Nur ganze
 * Zahlen von 1 bis 99, sonst `null`.
 */
export function parseCalendarGroup(value: string | null | undefined): number | null {
  if (!value || !/^\d{1,2}$/.test(value.trim())) return null
  const group = Number(value.trim())
  return group >= 1 && group <= MAX_CALENDAR_GROUP ? group : null
}

function weekday(key: string): number {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

/**
 * Die Tage einer Putzwoche, an denen geputzt wird: vom Montag bis zum
 * letzten Tag der Woche. Beginnt eine Woche am Sonntag, rückt der Anfang
 * um einen Tag; eine Woche aus dem alten Takt (Montag bis Samstag) bleibt,
 * wie sie ist.
 */
export function cleaningWorkdays(week: Pick<IcsCleaningWeek, 'startDate' | 'endDate'>): {
  first: string
  last: string
} {
  const first = weekday(week.startDate) === 0 ? nextDayKey(week.startDate) : week.startDate
  return { first, last: week.endDate < first ? first : week.endDate }
}

/** «putzplan-2026-10-04-gruppe-5@bss.alae.app» – Woche und Gruppe, nie etwas anderes. */
export function cleaningEventUid(
  week: Pick<IcsCleaningWeek, 'startDate'>,
  group: number,
  domain: string,
): string {
  return `putzplan-${week.startDate}-gruppe-${group}@${domain}`
}

/** Die Wochen der Gruppe, nach Datum. */
export function weeksOfGroup<T extends Pick<IcsCleaningWeek, 'startDate' | 'group'>>(
  weeks: readonly T[],
  group: number,
): T[] {
  return weeks
    .filter((week) => cleaningGroupNumber(week.group) === group)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
}

function event(week: IcsCleaningWeek, options: CleaningIcsOptions): string[] {
  const { first, last } = cleaningWorkdays(week)
  const lines = [
    'BEGIN:VEVENT',
    `UID:${cleaningEventUid(week, options.group, options.domain)}`,
    `DTSTAMP:${icsStamp(options.now)}`,
    // Ganztägig, und `DTEND` ist der Tag **danach** – der Sonntag hinter dem
    // Samstag, sonst fehlte der letzte Tag.
    `DTSTART;VALUE=DATE:${icsDay(first)}`,
    `DTEND;VALUE=DATE:${icsDay(nextDayKey(last))}`,
    `SUMMARY:${escapeIcsText(`Putzwoche Gruppe ${options.group}`)}`,
  ]

  const description: string[] = []
  if (week.team.trim()) description.push(`Zuständig: ${week.team.trim()}`)
  if (week.note?.trim()) description.push(`Bemerkung: ${week.note.trim()}`)
  if (options.planUrl) description.push(`Putzplan: ${options.planUrl}`)
  if (description.length > 0) lines.push(`DESCRIPTION:${escapeIcsText(description.join('\n'))}`)

  // Eine Putzwoche belegt keine Zeit: Sonst wäre man die ganze Woche als
  // beschäftigt eingetragen, und keine Terminsuche fände mehr einen Abend.
  lines.push('TRANSP:TRANSPARENT')
  if (week.updatedAt) lines.push(`LAST-MODIFIED:${icsStamp(week.updatedAt)}`)
  lines.push('END:VEVENT')
  return lines
}

/**
 * Die Wochen der Gruppe als Kalenderdatei – als Abo wie als Download.
 *
 * Ohne Zeitzonenblock: Ganztägige Termine haben keine Uhrzeit und damit
 * auch keine Zeitzone, die sich verschieben könnte.
 */
export function buildCleaningIcs(
  weeks: readonly IcsCleaningWeek[],
  options: CleaningIcsOptions,
): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Bischofschaft//Putzplan//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `NAME:${escapeIcsText(options.name)}`,
    `X-WR-CALNAME:${escapeIcsText(options.name)}`,
    'X-WR-TIMEZONE:Europe/Zurich',
    // Der Plan ändert sich selten – alle paar Stunden nachzusehen genügt.
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
    'X-PUBLISHED-TTL:PT6H',
  ]
  for (const week of weeksOfGroup(weeks, options.group)) lines.push(...event(week, options))
  lines.push('END:VCALENDAR')
  return `${lines.map(foldIcsLine).join('\r\n')}\r\n`
}
