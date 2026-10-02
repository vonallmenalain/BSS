// Mit Dateiendung, damit sich das Modul auch ohne Bundler ausführen lässt
// (`node --test` und die Netlify-Functions). Bewusst nicht über
// `cleaningPlan.ts`: Das zöge über die Sonntage Firebase in die Functions.
import { cleaningGroupNumber } from './cleaningGroups.ts'
import {
  DUE_WINDOW_MINUTES,
  NOTIFY_TIMES,
  NOTIFY_TIMEZONE,
  zurichTime,
  type PushMessage,
} from './notifications.ts'

/*
 * Die Erinnerung an die Putzwoche – ohne Konto.
 *
 * Wer den Putzplan liest, will vor allem eines wissen: wann die eigene
 * Gruppe dran ist. Statt jede Woche nachzuschauen, lässt man sich daran
 * erinnern – auf dem Telefon, auch ohne Anmeldung. Deshalb hängt die
 * Erinnerung nicht an einem Konto wie die übrigen Benachrichtigungen,
 * sondern am Gerät: eine Gruppe, ein Tag, eine Uhrzeit.
 *
 * Hier steht nur die Rechnerei – dieselbe für den Browser (der Dialog zeigt,
 * wann die nächste Erinnerung kommt) und für den Versand
 * (`netlify/functions/benachrichtigungen.mts`). Angemeldet wird das Gerät
 * über `netlify/functions/putzplan-erinnerung.mts`.
 */

/**
 * Wann erinnert wird – in Tagen ab dem Sonntag, an dem die Putzwoche
 * beginnt: vom Samstag davor (-1) bis zum Samstag am Ende der Woche (6).
 */
export const CLEANING_REMINDER_DAYS = [-1, 0, 1, 2, 3, 4, 5, 6] as const

export interface CleaningReminderSchedule {
  /** Die Nummer der Gruppe – «Gruppe 5» ist 5. */
  group: number
  /** Tage ab dem Sonntag, an dem die Woche beginnt (siehe `CLEANING_REMINDER_DAYS`). */
  day: number
  /** «18:00» – Schweizer Zeit, in halben Stunden (siehe `NOTIFY_TIMES`). */
  time: string
}

/** Am Samstagabend davor: Dann bleibt der ganze Sonntag, sich abzusprechen. */
export const DEFAULT_CLEANING_REMINDER = { day: -1, time: '18:00' } as const

/** Die höchste Gruppennummer, die der Server annimmt – eine Notbremse, kein Plan. */
export const MAX_CLEANING_GROUP = 99

/**
 * Wie viele Geräte sich höchstens erinnern lassen.
 *
 * Die Anmeldung steht jedem offen, also braucht sie eine Obergrenze – und
 * der Versand liest ohnehin nicht mehr als so viele Dokumente auf einmal.
 * Eine Gemeinde kommt nie in die Nähe.
 */
export const MAX_CLEANING_REMINDERS = 500

const DAY_NAMES = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']

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

/** «Am Samstag davor», «Am Sonntag, wenn die Woche beginnt», «Am Mittwoch». */
export function cleaningReminderDayLabel(day: number): string {
  if (day < 0) return 'Am Samstag davor'
  if (day === 0) return 'Am Sonntag, wenn die Woche beginnt'
  return `Am ${DAY_NAMES[day] ?? 'Samstag'}`
}

/** «Samstag davor, 18:00» – für die Zeile, die sagt, was eingestellt ist. */
export function cleaningReminderLabel(
  schedule: Pick<CleaningReminderSchedule, 'day' | 'time'>,
): string {
  const day =
    schedule.day < 0
      ? 'Samstag davor'
      : schedule.day === 0
        ? 'Sonntag zu Wochenbeginn'
        : `${DAY_NAMES[schedule.day] ?? 'Samstag'} in der Woche`
  return `${day}, ${schedule.time}`
}

/**
 * Eine Einstellung, wie sie vom Gerät kommt – geprüft.
 *
 * Für den Server, der nichts glaubt: Nur was die Auswahl im Dialog auch
 * anbietet, kommt durch. Alles andere ergibt `null`.
 */
export function parseCleaningReminder(input: unknown): CleaningReminderSchedule | null {
  if (!input || typeof input !== 'object') return null
  const { group, day, time } = input as Record<string, unknown>
  if (typeof group !== 'number' || !Number.isInteger(group)) return null
  if (group < 1 || group > MAX_CLEANING_GROUP) return null
  if (typeof day !== 'number' || !(CLEANING_REMINDER_DAYS as readonly number[]).includes(day)) {
    return null
  }
  if (typeof time !== 'string' || !NOTIFY_TIMES.includes(time)) return null
  return { group, day, time }
}

/**
 * Sieht das aus wie die Adresse eines Geräts bei Cloud Messaging?
 *
 * Nur die Form: Buchstaben, Ziffern und `-_:`. Ob es die Adresse wirklich
 * gibt, fragt der Server danach bei Cloud Messaging selbst nach.
 */
export function validPushToken(token: unknown): token is string {
  return typeof token === 'string' && /^[\w:-]{20,4096}$/.test(token)
}

/* ------------------------------------------------------------------ */
/* Zeit                                                                */
/* ------------------------------------------------------------------ */

const DAY = 86_400_000

function dayValue(key: string): number {
  const [year, month, date] = key.split('-').map(Number)
  return Date.UTC(year, month - 1, date)
}

function addDays(key: string, days: number): string {
  return new Date(dayValue(key) + days * DAY).toISOString().slice(0, 10)
}

/**
 * Welche Wochen der Versand am Tag `today` ansehen muss.
 *
 * Erinnert wird frühestens am Samstag davor und spätestens am Samstag am
 * Ende der Woche – fällig sein kann also nur eine Woche, die zwischen sechs
 * Tagen vor und einem Tag nach heute beginnt (der Nachlauf über Mitternacht
 * eingerechnet). Dazu die Woche davor: Sie sagt, ob eine Woche eine
 * Verlängerung ist (`continuesCleaningWeek`).
 */
export function cleaningReminderRange(today: string): { from: string; to: string } {
  return { from: addDays(today, -14), to: addDays(today, 1) }
}

/** Wann die Erinnerung für die Woche ab `startDate` kommt – Zürcher Wanduhr. */
export function cleaningReminderAt(
  startDate: string,
  schedule: Pick<CleaningReminderSchedule, 'day' | 'time'>,
): Date {
  return zurichTime(addDays(startDate, schedule.day), schedule.time)
}

/**
 * Ist die Erinnerung jetzt fällig?
 *
 * Erreicht und höchstens zwei Stunden vorbei – derselbe Nachlauf wie bei
 * den übrigen Erinnerungen (`DUE_WINDOW_MINUTES`). Was länger her ist, kommt
 * nicht mehr: Wer am Mittwoch einschaltet, bekommt nicht nachträglich die
 * Erinnerung vom Samstag davor.
 */
export function cleaningReminderDue(at: Date, now: Date): boolean {
  const minutes = (now.getTime() - at.getTime()) / 60_000
  return minutes >= 0 && minutes < DUE_WINDOW_MINUTES
}

/**
 * Die Marke, die eine Erinnerung einmalig hält: «5:2026-10-04».
 *
 * Mit der Gruppe darin: Wer auf eine andere Gruppe wechselt, deren Woche
 * gerade ansteht, bekommt ihre Erinnerung trotzdem.
 */
export function cleaningReminderMark(group: number, startDate: string): string {
  return `${group}:${startDate}`
}

export interface ReminderWeek {
  startDate: string
  endDate: string
  group: string
  team: string
  note?: string
}

/** Die Wochen der Gruppe, nach Datum. */
function weeksOf<T extends ReminderWeek>(weeks: readonly T[], group: number): T[] {
  return weeks
    .filter((week) => cleaningGroupNumber(week.group) === group)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
}

/**
 * Die Woche, an die jetzt zu erinnern ist – oder `null`.
 *
 * `lastMark` ist die Marke der zuletzt verschickten Erinnerung: Eine
 * Woche, für die schon erinnert wurde, kommt kein zweites Mal.
 */
export function dueCleaningWeek<T extends ReminderWeek>(
  weeks: readonly T[],
  schedule: CleaningReminderSchedule,
  now: Date,
  lastMark: string,
): T | null {
  for (const week of weeksOf(weeks, schedule.group)) {
    if (cleaningReminderMark(schedule.group, week.startDate) === lastMark) continue
    if (cleaningReminderDue(cleaningReminderAt(week.startDate, schedule), now)) return week
  }
  return null
}

/** Die nächste Erinnerung ab jetzt – für die Vorschau im Dialog. */
export function nextCleaningReminder<T extends ReminderWeek>(
  weeks: readonly T[],
  schedule: CleaningReminderSchedule,
  now: Date,
): { week: T; at: Date } | null {
  for (const week of weeksOf(weeks, schedule.group)) {
    const at = cleaningReminderAt(week.startDate, schedule)
    if (at.getTime() > now.getTime()) return { week, at }
  }
  return null
}

/**
 * Putzt die Gruppe schon die Woche davor?
 *
 * So ist es um einen Sonntag ohne Versammlung (siehe
 * `generateCleaningWeeks`): Die zweite Woche ist keine neue, sondern eine
 * Verlängerung – und die Erinnerung sagt das.
 */
export function continuesCleaningWeek(weeks: readonly ReminderWeek[], week: ReminderWeek): boolean {
  const before = addDays(week.startDate, -7)
  const group = cleaningGroupNumber(week.group)
  return weeks.some(
    (other) => other.startDate === before && cleaningGroupNumber(other.group) === group,
  )
}

/* ------------------------------------------------------------------ */
/* Texte                                                               */
/* ------------------------------------------------------------------ */

/** «4.–10. Oktober», «27. September – 3. Oktober», über Neujahr mit Jahr. */
export function cleaningWeekSpan(week: Pick<ReminderWeek, 'startDate' | 'endDate'>): string {
  const [startYear, startMonth, startDay] = week.startDate.split('-').map(Number)
  const [endYear, endMonth, endDay] = week.endDate.split('-').map(Number)
  if (startYear !== endYear) {
    return `${startDay}. ${MONTHS[startMonth - 1]} ${startYear} – ${endDay}. ${MONTHS[endMonth - 1]} ${endYear}`
  }
  if (startMonth !== endMonth) {
    return `${startDay}. ${MONTHS[startMonth - 1]} – ${endDay}. ${MONTHS[endMonth - 1]}`
  }
  return `${startDay}.–${endDay}. ${MONTHS[endMonth - 1]}`
}

const whenFormat = new Intl.DateTimeFormat('de-CH', {
  timeZone: NOTIFY_TIMEZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** «Samstag, 3. Oktober um 18:00» – ein Zeitpunkt, wie ihn die Vorschau nennt. */
export function cleaningReminderWhen(at: Date): string {
  const parts = whenFormat.formatToParts(at)
  const find = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  return `${find('weekday')}, ${find('day')}. ${find('month')} um ${find('hour')}:${find('minute')}`
}

/**
 * Die Nachricht: wer putzt, welche Woche, wer zuständig ist.
 *
 * Vor dem Sonntag heisst es «ab morgen», danach «diese Woche». Und die
 * zweite Woche um einen Sonntag ohne Versammlung sagt, dass es eine
 * Verlängerung ist, samt Grund – sonst sähe sie aus wie ein Versehen.
 */
export function cleaningReminderMessage(
  week: ReminderWeek,
  schedule: Pick<CleaningReminderSchedule, 'day'>,
  continued = false,
): PushMessage {
  const group = cleaningGroupNumber(week.group)
  const name = group === null ? week.group.trim() || 'Die Gruppe' : `Gruppe ${group}`
  const before = schedule.day < 0
  const title = continued
    ? before
      ? `${name} putzt noch eine Woche`
      : `${name} putzt auch diese Woche`
    : before
      ? `Ab morgen putzt ${name}`
      : `Diese Woche putzt ${name}`

  const note = week.note?.trim()
  const span = note ? `${cleaningWeekSpan(week)} (${note})` : cleaningWeekSpan(week)
  const team = week.team.trim()
  return { title, body: team ? `${span} · zuständig: ${team}` : span }
}
