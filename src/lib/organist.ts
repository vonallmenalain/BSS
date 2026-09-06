// Mit Dateiendung, damit sich das Modul auch ohne Bundler ausführen lässt
// (`node --test`). Vite und TypeScript lösen das genauso auf.
import { addMonths, addWeeks, toDate, toDateInput } from './dates.ts'
import { compareNames, normalize } from './utils.ts'
import {
  ACTIVE_CALLING_STATUSES,
  type Calling,
  type HymnChoice,
  type HymnSlot,
  type Member,
  type MusicalNumber,
  type SacramentMeeting,
} from './types.ts'

/**
 * Wer an einem Sonntag die Orgel spielt – und wie sich das auswerten lässt.
 *
 * Die Angabe steht am Sonntag (`SacramentMeeting.organistId` bzw.
 * `organistName`) und gilt für die ganze Versammlung: Eine Person spielt
 * alle Lieder. Daraus folgen drei Fragen, und alle drei werden hier
 * beantwortet – firestore-frei, damit sie sich prüfen lassen
 * (`tests/organist.test.ts`):
 *
 *  - **Wer kommt in Frage?** Die Berufung «Organist» sagt es, und wo sie
 *    nicht gelesen werden darf, sagen es die bisherigen Sonntage.
 *  - **Wer spielt an diesem Sonntag?** Ein Mitglied oder ein Name von Hand –
 *    beides ist dieselbe Auskunft und bekommt deshalb dieselbe Kennung.
 *  - **An welchen Sonntagen spielt diese Person?** Das ist der Filter im
 *    Musikbereich und zugleich der Ausdruck, der den Organisten zugeht.
 */

/* ------------------------------------------------------------------ */
/* Wer spielt – Mitglied oder Name von Hand                            */
/* ------------------------------------------------------------------ */

/**
 * Der Organist eines Sonntags, wie ihn Filter und Ausdruck vergleichen.
 *
 * `key` fasst beide Fälle zusammen: Ein Mitglied wird über seine Kennung
 * wiedererkannt, ein von Hand erfasster Name über den Namen selbst. Ohne
 * diesen gemeinsamen Schlüssel liesse sich «alle Sonntage dieser Person»
 * nur für die eine Hälfte beantworten.
 */
export interface OrganistRef {
  /** «mitglied:abc123» oder «name:hans muster» */
  key: string
  /** `null` bei einem Namen ohne Mitgliedersatz */
  memberId: string | null
  name: string
}

/** Der Schlüssel zu einer Person – dieselbe Person, derselbe Schlüssel. */
export function organistKey(memberId: string | null | undefined, name: string): string {
  return memberId ? `mitglied:${memberId}` : `name:${normalize(name)}`
}

/**
 * Wer an diesem Sonntag spielt – `null`, solange niemand eingetragen ist.
 *
 * Ein Sonntag mit `organistId`, aber ohne Namen, kommt aus einer früheren
 * Fassung oder von einem Gerät, das den Namen nicht kannte: Er bleibt
 * gültig, der Name wird dann aus dem Verzeichnis nachgeschlagen (`resolve`).
 */
export function organistOf(
  meeting: SacramentMeeting | null | undefined,
  resolve?: (memberId: string) => string | undefined,
): OrganistRef | null {
  if (!meeting) return null
  const memberId = meeting.organistId ?? null
  const stored = (meeting.organistName ?? '').trim()
  const name = (memberId ? (resolve?.(memberId) ?? stored) : stored).trim()
  if (!memberId && !name) return null
  return { key: organistKey(memberId, name), memberId, name }
}

/* ------------------------------------------------------------------ */
/* Wer kommt in Frage                                                  */
/* ------------------------------------------------------------------ */

/**
 * Eine Berufung an der Orgel?
 *
 * Gesucht wird nach dem Wortstamm und nicht nach der genauen Bezeichnung:
 * Das LCR schreibt «Organist», «Organistin», in manchen Gemeinden
 * «Musik – Organist». Alle drei meinen dasselbe.
 */
export function isOrganistCalling(calling: Calling): boolean {
  return (
    ACTIVE_CALLING_STATUSES.includes(calling.status) &&
    normalize(calling.position ?? '').includes('organist')
  )
}

/**
 * Die Mitglieder mit der Berufung «Organist», alphabetisch.
 *
 * Sie stehen im Feld «Mitglied suchen» als Vorschlag, sobald es angetippt
 * wird – gesucht werden kann trotzdem in der ganzen Gemeinde, und ein Name
 * ohne Mitgliedersatz lässt sich ebenfalls eintragen.
 */
export function organistCandidates(members: Member[], callings: Calling[]): Member[] {
  const ids = new Set(callings.filter(isOrganistCalling).map((calling) => calling.memberId))
  return members
    .filter((member) => ids.has(member.id))
    .sort((a, b) => compareNames(`${a.lastName} ${a.firstName}`, `${b.lastName} ${b.firstName}`))
}

/**
 * Wer bereits eingeteilt war – die zweite Quelle für Vorschläge.
 *
 * Sie ist mehr als ein Notbehelf: Die Assistenz «Musik» darf die
 * Berufungen nicht lesen (dort stehen auch laufende Berufungsvorgänge,
 * siehe `firestore.rules`), sieht die Sonntage aber vollständig. Wer schon
 * einmal gespielt hat, steht ihr damit genauso zur Verfügung – und für den
 * Vollzugriff ergänzt die Liste, wer ohne Berufung einspringt.
 *
 * Zugleich ist es die Auswahl der Filter: «alle Organisten, die eingeteilt
 * sind». Sortiert wird nach Nachnamen, so wie überall in der App.
 */
export function scheduledOrganists(
  meetings: SacramentMeeting[],
  resolve?: (memberId: string) => string | undefined,
): OrganistRef[] {
  const found = new Map<string, OrganistRef>()
  for (const meeting of meetings) {
    const organist = organistOf(meeting, resolve)
    // Der zuletzt gesehene Name gewinnt – er ist der aktuellere.
    if (organist) found.set(organist.key, organist)
  }
  return [...found.values()].sort((a, b) => compareNames(a.name, b.name))
}

/* ------------------------------------------------------------------ */
/* Die Sonntage einer Person                                           */
/* ------------------------------------------------------------------ */

/** Ein Sonntag, wie ihn Filterliste und Ausdruck zeigen. */
export interface MusicRow {
  /** «yyyy-MM-dd» – zugleich die Dokument-ID des Sonntags */
  dateKey: string
  date: Date
  organist: OrganistRef | null
  hymns: Partial<Record<HymnSlot, HymnChoice>>
  numbers: MusicalNumber[]
  /** Der Sonntag selbst – für die Art der Versammlung (siehe `lib/sunday`). */
  meeting: SacramentMeeting | null
}

/** Die Sonntage nach Datum – für Listen, die vorwärts gelesen werden. */
function byDate(a: MusicRow, b: MusicRow): number {
  return a.dateKey.localeCompare(b.dateKey)
}

/** Ein Sonntag aus dem Bestand, auch wenn dafür noch nichts erfasst ist. */
function rowFor(
  date: Date,
  meetings: Map<string, SacramentMeeting>,
  resolve?: (memberId: string) => string | undefined,
): MusicRow {
  const dateKey = toDateInput(date)
  const meeting = meetings.get(dateKey) ?? null
  return {
    dateKey,
    date,
    organist: organistOf(meeting, resolve),
    hymns: meeting?.hymns ?? {},
    numbers: meeting?.musicalNumbers ?? [],
    meeting,
  }
}

/** Die Sonntage nach Datum nachschlagbar machen. */
function byDateKey(meetings: SacramentMeeting[]): Map<string, SacramentMeeting> {
  return new Map(meetings.map((meeting) => [meeting.id, meeting]))
}

/**
 * Alle Sonntage, an denen eine bestimmte Person spielt.
 *
 * Ohne Zeitfenster: Der Filter im Musikbereich beantwortet «wann ist diese
 * Person eingeteilt?», und diese Frage endet nicht am Monatsende. Was
 * vorbei ist, bleibt in der Liste – die Reihenfolge sagt ohnehin, was noch
 * kommt.
 */
export function sundaysOf(
  meetings: SacramentMeeting[],
  keys: string[],
  resolve?: (memberId: string) => string | undefined,
): MusicRow[] {
  const wanted = new Set(keys)
  const rows: MusicRow[] = []
  for (const meeting of meetings) {
    const organist = organistOf(meeting, resolve)
    if (!organist || !wanted.has(organist.key)) continue
    const date = toDate(meeting.date)
    if (!date) continue
    rows.push({
      dateKey: meeting.id,
      date,
      organist,
      hymns: meeting.hymns ?? {},
      numbers: meeting.musicalNumbers ?? [],
      meeting,
    })
  }
  return rows.sort(byDate)
}

/* ------------------------------------------------------------------ */
/* Der Ausdruck                                                        */
/* ------------------------------------------------------------------ */

/**
 * Wie weit der Ausdruck reicht.
 *
 * Vom gewählten Sonntag an vorwärts – das ist die Frage, die der Ausdruck
 * beantwortet: «Was kommt auf dich zu?». Ein Blatt über die Vergangenheit
 * schickt niemand einem Organisten.
 */
export type ExportRange = 'week' | 'month' | 'quarter' | 'halfyear' | 'year'

export const EXPORT_RANGES: ExportRange[] = ['week', 'month', 'quarter', 'halfyear', 'year']

export const EXPORT_RANGE_LABELS: Record<ExportRange, string> = {
  week: 'Nur dieser Sonntag',
  month: '1 Monat',
  quarter: '3 Monate',
  halfyear: '6 Monate',
  year: '12 Monate',
}

/** Bis wohin ein Ausschnitt reicht – der erste Tag, der nicht mehr dazugehört. */
export function rangeEnd(start: Date, range: ExportRange): Date {
  switch (range) {
    case 'week':
      return addWeeks(start, 1)
    case 'month':
      return addMonths(start, 1)
    case 'quarter':
      return addMonths(start, 3)
    case 'halfyear':
      return addMonths(start, 6)
    case 'year':
      return addMonths(start, 12)
  }
}

/**
 * Die Sonntage eines Ausschnitts – vom gewählten an, Woche für Woche.
 *
 * Gerechnet und nicht aus dem Bestand gelesen: Ein Sonntag, für den noch
 * nichts erfasst ist, gehört auf das Blatt. Er ist die Lücke, die auffallen
 * soll – gerade wenn das Blatt dem Organisten zugeht.
 */
export function sundaysInRange(start: Date, range: ExportRange): Date[] {
  const end = rangeEnd(start, range)
  const dates: Date[] = []
  for (let cursor = start; cursor < end; cursor = addWeeks(cursor, 1)) {
    dates.push(cursor)
  }
  return dates
}

/**
 * Die Zeilen des Ausdrucks.
 *
 * `keys` schränkt auf einzelne Organisten ein; leer heisst «alle». Ein
 * Sonntag ohne Organist steht nur im Ausdruck über alle – wer nach einer
 * Person fragt, meint deren Sonntage und nicht die offenen.
 */
export function exportRows(
  start: Date,
  range: ExportRange,
  meetings: SacramentMeeting[],
  keys: string[] = [],
  resolve?: (memberId: string) => string | undefined,
): MusicRow[] {
  const lookup = byDateKey(meetings)
  const rows = sundaysInRange(start, range).map((date) => rowFor(date, lookup, resolve))
  if (keys.length === 0) return rows
  const wanted = new Set(keys)
  return rows.filter((row) => row.organist !== null && wanted.has(row.organist.key))
}
