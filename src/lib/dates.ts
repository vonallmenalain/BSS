import { Timestamp } from 'firebase/firestore'
import {
  format,
  formatDistanceToNowStrict,
  differenceInCalendarDays,
  differenceInMonths,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  isSameMonth,
  isSameYear,
  addDays,
  addMonths,
  addWeeks,
  nextDay,
  previousDay,
  isSameDay,
  isValid,
  parse,
  type Day,
} from 'date-fns'
import { de } from 'date-fns/locale'

/* ------------------------------------------------------------------ */
/* Konvertierung                                                       */
/* ------------------------------------------------------------------ */

/** Firestore-Timestamp (oder alles Datumsähnliche) in ein Date umwandeln. */
export function toDate(value: Timestamp | Date | string | number | null | undefined): Date | null {
  if (value == null) return null
  if (value instanceof Timestamp) return value.toDate()
  if (value instanceof Date) return isValid(value) ? value : null
  // Firestore liefert im Offline-Fall gelegentlich reine Objekte statt Timestamps
  if (typeof value === 'object' && 'seconds' in value) {
    const seconds = (value as { seconds: number }).seconds
    return new Date(seconds * 1000)
  }
  const parsed = new Date(value)
  return isValid(parsed) ? parsed : null
}

export function toTimestamp(value: Date | string | null | undefined): Timestamp | null {
  if (!value) return null
  const date = typeof value === 'string' ? new Date(value) : value
  return isValid(date) ? Timestamp.fromDate(date) : null
}

/* ------------------------------------------------------------------ */
/* Formatierung (Schweizer Schreibweise)                               */
/* ------------------------------------------------------------------ */

const opts = { locale: de }

/** «14.08.2026» */
export function formatDate(value: Parameters<typeof toDate>[0]): string {
  const date = toDate(value)
  return date ? format(date, 'dd.MM.yyyy', opts) : '–'
}

/** «Fr, 14.08.2026» */
export function formatDateShort(value: Parameters<typeof toDate>[0]): string {
  const date = toDate(value)
  return date ? format(date, 'EE, dd.MM.yyyy', opts) : '–'
}

/** «Freitag, 14. August 2026» */
export function formatDateLong(value: Parameters<typeof toDate>[0]): string {
  const date = toDate(value)
  return date ? format(date, 'EEEE, d. MMMM yyyy', opts) : '–'
}

/** «Fr, 14.08.» – für Zeiträume, in denen das Jahr nur einmal genannt wird */
export function formatDayShort(value: Parameters<typeof toDate>[0]): string {
  const date = toDate(value)
  return date ? format(date, 'EE, dd.MM.', opts) : '–'
}

/** «August 2026» */
export function formatMonth(value: Parameters<typeof toDate>[0]): string {
  const date = toDate(value)
  return date ? format(date, 'MMMM yyyy', opts) : '–'
}

/** «14. August» – ohne Jahr, für Spannen innerhalb desselben Jahres */
export function formatDayMonth(value: Parameters<typeof toDate>[0]): string {
  const date = toDate(value)
  return date ? format(date, 'd. MMMM', opts) : '–'
}

/** «14. August 2026» – wie `formatDateLong`, aber ohne Wochentag */
export function formatDayMonthYear(value: Parameters<typeof toDate>[0]): string {
  const date = toDate(value)
  return date ? format(date, 'd. MMMM yyyy', opts) : '–'
}

/** «Fr, 14.08.2026, 19:30» */
export function formatDateTime(value: Parameters<typeof toDate>[0]): string {
  const date = toDate(value)
  return date ? format(date, 'EE, dd.MM.yyyy, HH:mm', opts) : '–'
}

/** «19:30» */
export function formatTime(value: Parameters<typeof toDate>[0]): string {
  const date = toDate(value)
  return date ? format(date, 'HH:mm', opts) : '–'
}

/** Wert für ein `<input type="date">` */
export function toDateInput(value: Parameters<typeof toDate>[0]): string {
  const date = toDate(value)
  return date ? format(date, 'yyyy-MM-dd') : ''
}

/** Wert für ein `<input type="time">` */
export function toTimeInput(value: Parameters<typeof toDate>[0]): string {
  const date = toDate(value)
  return date ? format(date, 'HH:mm') : ''
}

/** Datum und Zeit aus zwei Formularfeldern zu einem Date verbinden. */
export function fromDateTimeInput(dateStr: string, timeStr: string): Date | null {
  if (!dateStr) return null
  const combined = parse(`${dateStr} ${timeStr || '00:00'}`, 'yyyy-MM-dd HH:mm', new Date())
  return isValid(combined) ? combined : null
}

/** «vor 3 Tagen», «in 2 Monaten» */
export function formatRelative(value: Parameters<typeof toDate>[0]): string {
  const date = toDate(value)
  if (!date) return '–'
  return formatDistanceToNowStrict(date, { locale: de, addSuffix: true })
}

/* ------------------------------------------------------------------ */
/* Terminberechnung                                                    */
/* ------------------------------------------------------------------ */

/**
 * Nächstes Vorkommen eines Wochentags, optional mit Uhrzeit.
 * Fällt der Wochentag auf heute, wird die kommende Woche genommen –
 * so entsteht beim Anlegen der Folgesitzung nie versehentlich das Heute-Datum.
 */
export function nextWeekday(weekday: number, time = '00:00', from = new Date()): Date {
  const [hours, minutes] = time.split(':').map((n) => Number.parseInt(n, 10))
  const target = nextDay(startOfDay(from), weekday as Day)
  target.setHours(hours || 0, minutes || 0, 0, 0)
  return target
}

/** Alle Sonntage (bzw. beliebiger Wochentag) in den nächsten `weeks` Wochen. */
export function upcomingWeekdays(weekday: number, weeks: number, from = new Date()): Date[] {
  const result: Date[] = []
  let cursor = startOfDay(from)
  // Wenn heute bereits der gesuchte Wochentag ist, gehört heute dazu.
  if (cursor.getDay() !== weekday) {
    cursor = nextDay(cursor, weekday as Day)
  }
  for (let i = 0; i < weeks; i++) {
    result.push(new Date(cursor))
    cursor = addWeeks(cursor, 1)
  }
  return result
}

/**
 * Alle Termine dieses Wochentags im Monat des angegebenen Datums.
 *
 * Für Angaben, die einem ganzen Monat gelten – wer im August für die
 * Abendmahlsversammlung zuständig ist. Der Monat ergibt sich aus dem
 * Datum, nicht aus einer eigenen Angabe: Man legt ihn dort fest, wo man
 * gerade steht.
 */
export function weekdaysInMonth(weekday: number, inMonth: Date): Date[] {
  const cursor = new Date(inMonth.getFullYear(), inMonth.getMonth(), 1, 12, 0, 0, 0)
  while (cursor.getDay() !== weekday) cursor.setDate(cursor.getDate() + 1)

  const result: Date[] = []
  const month = cursor.getMonth()
  while (cursor.getMonth() === month) {
    result.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 7)
  }
  return result
}

/** Der aktuelle bzw. zuletzt vergangene Termin dieses Wochentags. */
export function currentOrPreviousWeekday(weekday: number, from = new Date()): Date {
  const cursor = startOfDay(from)
  return cursor.getDay() === weekday ? cursor : previousDay(cursor, weekday as Day)
}

/**
 * Termine rund um heute: `past` Wochen zurück, `future` Wochen voraus.
 * Damit lässt sich ein Sonntag auswählen, ohne einen Kalender zu öffnen –
 * und ein vergangener bleibt zum Nachtragen erreichbar.
 */
export function weekdaysAround(weekday: number, past = 6, future = 16, from = new Date()): Date[] {
  const anchor = currentOrPreviousWeekday(weekday, from)
  const result: Date[] = []
  for (let i = past; i > 0; i--) result.push(addWeeks(anchor, -i))
  for (let i = 0; i <= future; i++) result.push(addWeeks(anchor, i))
  return result
}

/** Monate seit einem Datum – für «wer war schon lange nicht mehr dran?» */
export function monthsSince(value: Parameters<typeof toDate>[0]): number | null {
  const date = toDate(value)
  if (!date) return null
  return differenceInMonths(new Date(), date)
}

/** Alter in Jahren zum heutigen Tag. */
export function getAge(birthDate: Parameters<typeof toDate>[0]): number | null {
  const date = toDate(birthDate)
  if (!date) return null
  const today = new Date()
  let age = today.getFullYear() - date.getFullYear()
  const monthDiff = today.getMonth() - date.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) age--
  return age >= 0 && age < 130 ? age : null
}

/** Hat das Mitglied in den nächsten `days` Tagen Geburtstag? */
export function hasBirthdaySoon(birthDate: Parameters<typeof toDate>[0], days = 14): boolean {
  const date = toDate(birthDate)
  if (!date) return false
  const today = startOfDay(new Date())
  const thisYear = new Date(today.getFullYear(), date.getMonth(), date.getDate())
  const candidate =
    thisYear < today ? new Date(today.getFullYear() + 1, date.getMonth(), date.getDate()) : thisYear
  const diff = differenceInCalendarDays(candidate, today)
  return diff >= 0 && diff <= days
}

/**
 * Die Woche beginnt am Montag.
 *
 * Nicht die Voreinstellung von `date-fns` – dort beginnt sie am Sonntag.
 * Ein Kalender, in dem das Wochenende auseinandergerissen ist, liest sich
 * hierzulande falsch, und der Sonntag ist der Tag, auf den die Woche
 * zuläuft.
 */
const WEEK_STARTS_ON = 1 as const

/** Montag der Woche, in der dieses Datum liegt. */
export function startOfCalendarWeek(value: Date): Date {
  return startOfWeek(value, { weekStartsOn: WEEK_STARTS_ON })
}

/** Sonntag der Woche, in der dieses Datum liegt. */
export function endOfCalendarWeek(value: Date): Date {
  return endOfWeek(value, { weekStartsOn: WEEK_STARTS_ON })
}

export {
  addDays,
  addMonths,
  addWeeks,
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  isSameDay,
  isSameMonth,
  isSameYear,
  differenceInCalendarDays,
  differenceInMonths,
}

/** Abgekürzte Wochentage für Kalenderköpfe, Index wie bei `WEEKDAYS`. */
export const WEEKDAYS_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'] as const

/** Deutsche Wochentagsnamen, Index entspricht `Date.getDay()`. */
export const WEEKDAYS = [
  'Sonntag',
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag',
] as const
