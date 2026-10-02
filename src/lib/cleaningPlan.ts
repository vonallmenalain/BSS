// Mit Dateiendung, damit sich das Modul auch ohne Bundler ausführen lässt
// (`node --test`). Vite und TypeScript lösen das genauso auf.
import {
  cleaningGroupName,
  cleaningGroupNumber,
  responsibleEntry,
  sortedGroups,
} from './cleaningGroups.ts'
import { sundayProgram, type StoredSunday } from './sunday.ts'
import type { CleaningGroup, CleaningWeek } from './types.ts'

/**
 * Der Putzplan – was sich aus ihm ablesen und wie er sich fortführen lässt.
 *
 *  - **Am Sonntag:** wem gedankt und wer angekündigt wird (`cleaningAround`,
 *    für die wiederkehrende Bekanntmachung).
 *  - **Heute:** wer diese Woche dran ist und wer danach (`cleaningNow`, für
 *    die Ansicht ohne Anmeldung).
 *  - **Generieren:** die Wochen eines Zeitraums, eine Gruppe nach der
 *    anderen (`generateCleaningWeeks`).
 *
 * Bewusst frei von Firestore und React, damit sich das mit `node --test`
 * prüfen lässt.
 */

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
 * Wer jetzt dran ist und wer danach – für die Ansicht ohne Anmeldung.
 *
 * Dort zählt nicht der Sonntag, sondern heute: Wer den QR-Code am
 * Anschlagbrett scannt, will wissen, ob er diese Woche dran ist.
 *
 *  - **current** ist die Woche, in der heute liegt. Liegt heute in keiner –
 *    am Sonntag zwischen zwei Wochen von Montag bis Samstag, in einer Lücke
 *    oder vor dem ersten Eintrag –, bleibt sie leer.
 *  - **next** ist die erste Woche, die danach beginnt.
 *  - **after** die Woche nach `next` – für den Fall ohne laufende Woche, in
 *    dem `next` an ihre Stelle rückt.
 */
export interface CleaningNow<T> {
  current: T | null
  next: T | null
  after: T | null
}

export function cleaningNow<T extends { startDate: string; endDate: string }>(
  weeks: T[],
  todayKey: string,
): CleaningNow<T> {
  const sorted = [...weeks].sort((a, b) => a.startDate.localeCompare(b.startDate))
  const current =
    sorted.find((week) => week.startDate <= todayKey && todayKey <= week.endDate) ?? null
  const upcoming = sorted.filter((week) => week.startDate > (current?.endDate ?? todayKey))
  return { current, next: upcoming[0] ?? null, after: upcoming[1] ?? null }
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

/* ------------------------------------------------------------------ */
/* Generieren                                                          */
/* ------------------------------------------------------------------ */

type PlanWeek = Pick<CleaningWeek, 'startDate' | 'endDate' | 'group' | 'team'> & {
  note?: string
}
type PlanGroup = Pick<CleaningGroup, 'number' | 'entries'>

const DAY = 86_400_000

function dayValue(key: string): number {
  const [year, month, date] = key.split('-').map(Number)
  return Date.UTC(year, month - 1, date)
}

function dayKey(value: number): string {
  return new Date(value).toISOString().slice(0, 10)
}

/** «2026-10-04» plus Tage. */
export function addDays(key: string, days: number): string {
  return dayKey(dayValue(key) + days * DAY)
}

/** Der Sonntag, an dem die Woche dieses Tages beginnt. */
export function sundayOnOrBefore(key: string): string {
  return addDays(key, -new Date(dayValue(key)).getUTCDay())
}

/** Dieser Tag, wenn er ein Sonntag ist – sonst der nächste Sonntag. */
export function sundayOnOrAfter(key: string): string {
  const weekday = new Date(dayValue(key)).getUTCDay()
  return weekday === 0 ? key : addDays(key, 7 - weekday)
}

/** «2026-10-04» plus Monate – am Monatsende auf den letzten Tag gekürzt. */
export function addMonths(key: string, months: number): string {
  const [year, month, date] = key.split('-').map(Number)
  const target = new Date(Date.UTC(year, month - 1 + months, 1))
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(date, last))
  return dayKey(target.getTime())
}

/**
 * Wo es nach dem Plan weitergeht: der erste Sonntag nach seinem letzten Tag –
 * ohne Plan der nächste Sonntag ab heute.
 */
export function nextPlanStart(weeks: readonly Pick<PlanWeek, 'endDate'>[], today: string): string {
  const last = weeks.reduce((latest, week) => (week.endDate > latest ? week.endDate : latest), '')
  return last ? sundayOnOrAfter(addDays(last, 1)) : sundayOnOrAfter(today)
}

/** Die Sonntage von `from` bis `to`, beide eingeschlossen. */
export function sundaysBetween(from: string, to: string): string[] {
  const sundays: string[] = []
  for (let day = sundayOnOrAfter(from); day <= to; day = addDays(day, 7)) sundays.push(day)
  return sundays
}

/**
 * Die Sonntage ohne Versammlung in der Gemeinde – und weshalb.
 *
 * Gefragt wird das Programm des Sonntags (`lib/sunday`): Die Generalkonferenz
 * ergibt sich aus der Regel, eine Pfahlkonferenz und jeder eigene Grund ohne
 * Versammlung aus dem, was unter «Abendmahl» erfasst ist. An solchen
 * Sonntagen wird das Gemeindehaus kaum gebraucht – die Gruppe der Woche davor
 * putzt eine Woche länger.
 */
export function noMeetingSundays(
  from: string,
  to: string,
  stored: ReadonlyMap<string, StoredSunday>,
): Map<string, string> {
  const reasons = new Map<string, string>()
  for (const key of sundaysBetween(from, to)) {
    const [year, month, date] = key.split('-').map(Number)
    const program = sundayProgram(new Date(year, month - 1, date), stored.get(key) ?? null)
    if (!program.meets) reasons.set(key, program.label)
  }
  return reasons
}

/** Die nächste Gruppe nach `current` – nach der letzten wieder die erste. */
function nextGroup(numbers: readonly number[], current: number | null): number {
  if (current === null) return numbers[0]
  return numbers.find((number) => number > current) ?? numbers[0]
}

/**
 * Mit welcher Gruppe die erste Woche beginnt – und nach welcher Woche.
 *
 * Es geht weiter, wo der Plan steht: nach der Gruppe der letzten Woche vor
 * `from` kommt die nächste. Ist der erste Sonntag einer ohne Versammlung,
 * putzt dieselbe Gruppe weiter. Ohne Plan davor beginnt die erste Gruppe.
 */
export function rotationStart(
  weeks: readonly PlanWeek[],
  groups: readonly PlanGroup[],
  from: string,
  noMeeting: ReadonlyMap<string, string>,
): { previous: PlanWeek | null; group: number | null } {
  const numbers = sortedGroups(groups).map((group) => group.number)
  if (numbers.length === 0) return { previous: null, group: null }
  const previous =
    [...weeks]
      .filter((week) => week.startDate < from)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .at(-1) ?? null
  const before = cleaningGroupNumber(previous?.group)
  if (before === null) return { previous, group: numbers[0] }
  const repeat = noMeeting.has(from) && numbers.includes(before)
  return { previous, group: repeat ? before : nextGroup(numbers, before) }
}

export interface GenerateOptions {
  /** Der Plan, wie er dasteht – für die Gruppe, mit der es weitergeht */
  weeks: readonly PlanWeek[]
  groups: readonly PlanGroup[]
  /** Der erste Sonntag – ein anderer Tag zählt ab dem Sonntag seiner Woche */
  from: string
  /** Bis hier beginnen Wochen */
  to: string
  /** Sonntage ohne Versammlung → Grund (siehe `noMeetingSundays`) */
  noMeeting: ReadonlyMap<string, string>
  /** Mit dieser Gruppe beginnen statt mit der, die der Plan ergibt */
  firstGroup?: number | null
}

export interface GeneratedWeek {
  startDate: string
  endDate: string
  /** «Gruppe 5» */
  group: string
  /** Der zuständige Haushalt – «Morales-Römer Oscar & Céleste» */
  team: string
  /** Der Grund, wenn die Gruppe eine zweite Woche putzt – sonst leer */
  note: string
}

/**
 * Die Wochen eines Zeitraums, eine Gruppe nach der anderen.
 *
 * Jede Woche läuft von Sonntag bis Samstag. Mit jedem Sonntag kommt die
 * nächste Gruppe dran – ausser an einem Sonntag ohne Versammlung: Dann
 * putzt dieselbe Gruppe eine Woche länger, und der Grund steht als Bemerkung
 * an dieser zweiten Woche. Nach der letzten Gruppe beginnt wieder die erste.
 * Unter «An der Reihe» steht der zuständige Haushalt der Gruppe.
 */
export function generateCleaningWeeks(options: GenerateOptions): GeneratedWeek[] {
  const groups = sortedGroups(options.groups)
  const numbers = groups.map((group) => group.number)
  if (numbers.length === 0) return []
  const byNumber = new Map(groups.map((group) => [group.number, group]))

  const from = sundayOnOrBefore(options.from)
  let current =
    options.firstGroup && byNumber.has(options.firstGroup)
      ? options.firstGroup
      : (rotationStart(options.weeks, groups, from, options.noMeeting).group ?? numbers[0])

  const result: GeneratedWeek[] = []
  for (let day = from; day <= options.to; day = addDays(day, 7)) {
    if (result.length > 0 && !options.noMeeting.has(day)) current = nextGroup(numbers, current)
    result.push({
      startDate: day,
      endDate: addDays(day, 6),
      group: cleaningGroupName(current),
      team: responsibleEntry(byNumber.get(current))?.label ?? '',
      note: options.noMeeting.get(day) ?? '',
    })
  }
  return result
}

export type PlanChange = 'new' | 'changed' | 'same'

export interface PlanDiff<T extends PlanWeek = PlanWeek> {
  weeks: { week: GeneratedWeek; change: PlanChange; before: T | null }[]
  /** Wochen im Zeitraum, die es nach dem Generieren nicht mehr gibt */
  removed: T[]
}

/** Was das Generieren am Plan ändert – für die Vorschau. */
export function diffCleaningPlan<T extends PlanWeek>(
  existing: readonly T[],
  generated: readonly GeneratedWeek[],
): PlanDiff<T> {
  if (generated.length === 0) return { weeks: [], removed: [] }
  const from = generated[0].startDate
  const until = generated[generated.length - 1].endDate
  const byStart = new Map(existing.map((week) => [week.startDate, week]))
  const kept = new Set(generated.map((week) => week.startDate))

  const weeks = generated.map((week) => {
    const before = byStart.get(week.startDate) ?? null
    const same =
      before !== null &&
      before.endDate === week.endDate &&
      before.group.trim() === week.group &&
      before.team.trim() === week.team &&
      (before.note ?? '').trim() === week.note
    return { week, change: (before ? (same ? 'same' : 'changed') : 'new') as PlanChange, before }
  })
  const removed = existing.filter(
    (week) => week.startDate >= from && week.startDate <= until && !kept.has(week.startDate),
  )
  return { weeks, removed }
}
