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
 * Wer an einem Sonntag die Musik macht – und wie sich das auswerten lässt.
 *
 * Zwei Aufgaben, dieselbe Form: **ein** Organist und **ein** Dirigent je
 * Sonntag, beide für die ganze Versammlung. Sie stehen deshalb am Sonntag
 * (`organistId`/`organistName`, `choristerId`/`choristerName`) und nicht am
 * einzelnen Lied.
 *
 * Weil beide dieselbe Form haben, steht hier alles **einmal** und bekommt
 * die Rolle als Argument. Zwei Sätze derselben Funktionen liefen früher oder
 * später auseinander – und die Frage «an welchen Sonntagen ist diese Person
 * eingeteilt?» ist für den Dirigenten dieselbe wie für den Organisten.
 *
 * Firestore-frei, damit sich das prüfen lässt (`tests/music-roles.test.ts`).
 */

/* ------------------------------------------------------------------ */
/* Die beiden Rollen                                                   */
/* ------------------------------------------------------------------ */

/**
 * `chorister` ist der Dirigent.
 *
 * Der englische Feldname hält ihn von `conductingId` fern – das ist, wer die
 * **Versammlung** leitet, und das ist eine andere Person mit einer anderen
 * Aufgabe (siehe `SacramentMeeting`).
 */
export type MusicRole = 'organist' | 'chorister'

/** Die Reihenfolge zählt: Sie ist die der Felder und der Spalten im Ausdruck. */
export const MUSIC_ROLES: MusicRole[] = ['organist', 'chorister']

export const MUSIC_ROLE_LABELS: Record<MusicRole, string> = {
  organist: 'Organist',
  chorister: 'Dirigent',
}

/** Die Mehrzahl – für Überschriften über einer Auswahl. */
export const MUSIC_ROLE_PLURAL: Record<MusicRole, string> = {
  organist: 'Organisten',
  chorister: 'Dirigenten',
}

/**
 * Was die Person tut – als **Tätigkeit**, für Sätze über einen bestimmten
 * Menschen: «alle Sonntage, an denen Peter Lauener dirigiert».
 *
 * Ein Hauptwort ginge dort nicht: «Peter Lauener als Dirigentin» wäre
 * falsch, «als Dirigent» bei einer Frau ebenso. Die Bezeichnungen oben sind
 * Etiketten über einer Spalte oder einer Auswahl und meinen die Aufgabe,
 * nicht die Person – dort ist das Hauptwort richtig.
 */
export const MUSIC_ROLE_VERB: Record<MusicRole, string> = {
  organist: 'die Orgel spielt',
  chorister: 'dirigiert',
}

/**
 * Woran eine Berufung zu dieser Rolle erkannt wird.
 *
 * Gesucht wird nach dem Wortstamm und nicht nach der genauen Bezeichnung:
 * Das LCR schreibt «Organist», «Organistin», in manchen Gemeinden
 * «Musik – Organist»; beim Dirigenten dasselbe Spiel. Alle meinen dieselbe
 * Aufgabe.
 */
const CALLING_STEM: Record<MusicRole, string> = {
  organist: 'organist',
  chorister: 'dirigent',
}

/** Die Felder am Sonntag, in denen die Rolle steht. */
const FIELDS: Record<MusicRole, { id: keyof SacramentMeeting; name: keyof SacramentMeeting }> = {
  organist: { id: 'organistId', name: 'organistName' },
  chorister: { id: 'choristerId', name: 'choristerName' },
}

/** Die Kennung des Mitglieds bzw. der erfasste Name – roh, wie gespeichert. */
function stored(
  meeting: SacramentMeeting | null | undefined,
  role: MusicRole,
): { memberId: string | null; name: string } {
  const fields = FIELDS[role]
  const memberId = (meeting?.[fields.id] as string | null | undefined) ?? null
  const name = ((meeting?.[fields.name] as string | null | undefined) ?? '').trim()
  return { memberId, name }
}

/** Was `saveSacramentMeeting` für diese Rolle schreiben muss. */
export function musicRoleFields(
  role: MusicRole,
  person: { memberId?: string | null; name?: string } | null,
): Partial<SacramentMeeting> {
  const name = person?.name?.trim() ?? ''
  const memberId = person?.memberId ?? null
  // Ohne Namen und ohne Mitglied ist der Platz frei – beide Felder auf
  // `null`, damit am Sonntag kein halber Eintrag zurückbleibt.
  const empty = !name && !memberId
  const fields = FIELDS[role]
  return {
    [fields.id]: empty ? null : memberId,
    [fields.name]: empty ? null : name,
  } as Partial<SacramentMeeting>
}

/* ------------------------------------------------------------------ */
/* Wer eingeteilt ist – Mitglied oder Name von Hand                    */
/* ------------------------------------------------------------------ */

/**
 * Eine eingeteilte Person, wie Filter und Ausdruck sie vergleichen.
 *
 * `key` fasst drei Fälle zusammen: Ein Mitglied wird über seine Kennung
 * wiedererkannt, ein von Hand erfasster Name über den Namen selbst – und die
 * Rolle steht davor, damit dieselbe Person als Organistin und als Dirigentin
 * zwei verschiedene Einträge im Filter ergibt. Genau das will man dort: Man
 * sucht die Sonntage, an denen sie **spielt**, oder die, an denen sie
 * **dirigiert**.
 */
export interface MusicPersonRef {
  /** «organist:mitglied:abc123» oder «chorister:name:hans muster» */
  key: string
  role: MusicRole
  /** `null` bei einem Namen ohne Mitgliedersatz */
  memberId: string | null
  name: string
}

/** Der Schlüssel zu einer Person in einer Rolle – dieselbe Wahl, derselbe Schlüssel. */
export function musicPersonKey(
  role: MusicRole,
  memberId: string | null | undefined,
  name: string,
): string {
  return `${role}:${memberId ? `mitglied:${memberId}` : `name:${normalize(name)}`}`
}

/**
 * Wer an diesem Sonntag in dieser Rolle eingeteilt ist – `null`, wenn niemand.
 *
 * Ein Sonntag mit Kennung, aber ohne Namen, kommt aus einer früheren Fassung
 * oder von einem Gerät, das den Namen nicht kannte: Er bleibt gültig, der
 * Name wird dann aus dem Verzeichnis nachgeschlagen (`resolve`).
 */
export function musicPersonOf(
  meeting: SacramentMeeting | null | undefined,
  role: MusicRole,
  resolve?: (memberId: string) => string | undefined,
): MusicPersonRef | null {
  if (!meeting) return null
  const { memberId, name: written } = stored(meeting, role)
  const name = (memberId ? (resolve?.(memberId) ?? written) : written).trim()
  if (!memberId && !name) return null
  return { key: musicPersonKey(role, memberId, name), role, memberId, name }
}

/* ------------------------------------------------------------------ */
/* Wer in Frage kommt                                                  */
/* ------------------------------------------------------------------ */

/** Eine laufende Berufung für diese Rolle? */
export function isMusicCalling(calling: Calling, role: MusicRole): boolean {
  return (
    ACTIVE_CALLING_STATUSES.includes(calling.status) &&
    normalize(calling.position ?? '').includes(CALLING_STEM[role])
  )
}

/**
 * Die Mitglieder mit der passenden Berufung, alphabetisch.
 *
 * Sie stehen im Feld «Mitglied suchen» als Vorschlag, sobald es angetippt
 * wird – gesucht werden kann trotzdem in der ganzen Gemeinde, und ein Name
 * ohne Mitgliedersatz lässt sich ebenfalls eintragen.
 */
export function musicCandidates(members: Member[], callings: Calling[], role: MusicRole): Member[] {
  const ids = new Set(
    callings.filter((calling) => isMusicCalling(calling, role)).map((calling) => calling.memberId),
  )
  return members
    .filter((member) => ids.has(member.id))
    .sort((a, b) => compareNames(`${a.lastName} ${a.firstName}`, `${b.lastName} ${b.firstName}`))
}

/**
 * Wer bereits eingeteilt war – die zweite Quelle für Vorschläge.
 *
 * Sie ist mehr als ein Notbehelf: Die Assistenz «Musik» darf die Berufungen
 * nicht lesen (dort stehen auch laufende Berufungsvorgänge, siehe
 * `firestore.rules`), sieht die Sonntage aber vollständig. Wer schon einmal
 * dran war, steht ihr damit genauso zur Verfügung – und für den Vollzugriff
 * ergänzt die Liste, wer ohne Berufung einspringt.
 *
 * Zugleich ist es die Auswahl der Filter. Ohne `roles` kommen beide Rollen,
 * jede für sich: Der Filter zeigt Organisten und Dirigenten in zwei Gruppen.
 */
export function scheduledMusicPeople(
  meetings: SacramentMeeting[],
  roles: MusicRole[] = MUSIC_ROLES,
  resolve?: (memberId: string) => string | undefined,
): MusicPersonRef[] {
  const found = new Map<string, MusicPersonRef>()
  for (const meeting of meetings) {
    for (const role of roles) {
      const person = musicPersonOf(meeting, role, resolve)
      // Der zuletzt gesehene Name gewinnt – er ist der aktuellere.
      if (person) found.set(person.key, person)
    }
  }
  return [...found.values()].sort(
    (a, b) =>
      MUSIC_ROLES.indexOf(a.role) - MUSIC_ROLES.indexOf(b.role) || compareNames(a.name, b.name),
  )
}

/* ------------------------------------------------------------------ */
/* Die Sonntage einer Person                                           */
/* ------------------------------------------------------------------ */

/** Ein Sonntag, wie ihn Filterliste und Ausdruck zeigen. */
export interface MusicRow {
  /** «yyyy-MM-dd» – zugleich die Dokument-ID des Sonntags */
  dateKey: string
  date: Date
  /** Wer in welcher Rolle eingeteilt ist – `null`, wo niemand steht. */
  people: Record<MusicRole, MusicPersonRef | null>
  hymns: Partial<Record<HymnSlot, HymnChoice>>
  numbers: MusicalNumber[]
  /** Der Sonntag selbst – für die Art der Versammlung (siehe `lib/sunday`). */
  meeting: SacramentMeeting | null
}

/** Die Sonntage nach Datum – für Listen, die vorwärts gelesen werden. */
function byDate(a: MusicRow, b: MusicRow): number {
  return a.dateKey.localeCompare(b.dateKey)
}

/** Beide Rollen eines Sonntags auf einmal. */
function peopleOf(
  meeting: SacramentMeeting | null,
  resolve?: (memberId: string) => string | undefined,
): Record<MusicRole, MusicPersonRef | null> {
  return {
    organist: musicPersonOf(meeting, 'organist', resolve),
    chorister: musicPersonOf(meeting, 'chorister', resolve),
  }
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
    people: peopleOf(meeting, resolve),
    hymns: meeting?.hymns ?? {},
    numbers: meeting?.musicalNumbers ?? [],
    meeting,
  }
}

/** Die Sonntage nach Datum nachschlagbar machen. */
function byDateKey(meetings: SacramentMeeting[]): Map<string, SacramentMeeting> {
  return new Map(meetings.map((meeting) => [meeting.id, meeting]))
}

/** Ist an diesem Sonntag eine der gesuchten Personen eingeteilt? */
function matches(row: MusicRow, keys: Set<string>): boolean {
  return MUSIC_ROLES.some((role) => {
    const person = row.people[role]
    return person !== null && keys.has(person.key)
  })
}

/**
 * Alle Sonntage, an denen eine bestimmte Person eingeteilt ist.
 *
 * Ohne Zeitfenster: Der Filter im Musikbereich beantwortet «wann ist diese
 * Person eingeteilt?», und diese Frage endet nicht am Monatsende. Was vorbei
 * ist, bleibt in der Liste – die Reihenfolge sagt ohnehin, was noch kommt.
 */
export function sundaysOf(
  meetings: SacramentMeeting[],
  keys: string[],
  resolve?: (memberId: string) => string | undefined,
): MusicRow[] {
  const wanted = new Set(keys)
  if (wanted.size === 0) return []
  const rows: MusicRow[] = []
  for (const meeting of meetings) {
    const date = toDate(meeting.date)
    if (!date) continue
    const row: MusicRow = {
      dateKey: meeting.id,
      date,
      people: peopleOf(meeting, resolve),
      hymns: meeting.hymns ?? {},
      numbers: meeting.musicalNumbers ?? [],
      meeting,
    }
    if (matches(row, wanted)) rows.push(row)
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
 * soll – gerade wenn das Blatt weitergereicht wird.
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
 * `keys` schränkt auf einzelne Personen ein; leer heisst «alle». Ein Sonntag,
 * an dem niemand von ihnen eingeteilt ist, steht nur im Ausdruck über alle –
 * wer nach Personen fragt, meint deren Sonntage und nicht die offenen.
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
  return rows.filter((row) => matches(row, wanted))
}
