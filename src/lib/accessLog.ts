// Mit Dateiendung, damit sich das Modul auch ohne Bundler ausführen lässt
// (`node --test`). Vite und TypeScript lösen das genauso auf.
import { toDate } from './dates.ts'
import type { AppUser, ChangeEntry, ChangeOp, LogEntry, Role, SessionEntry } from './types.ts'

/**
 * Das Protokoll in lesbarer Form.
 *
 * Dieses Modul rechnet und benennt, es liest und schreibt nichts. Es steht
 * damit auf beiden Seiten: `lib/audit` benutzt es beim **Schreiben**, um einer
 * Änderung einen Titel zu geben, und die Seite «Zugriffe» beim **Lesen**, um
 * aus Tausenden Einträgen eine Zeile je Konto zu machen.
 *
 * Dass beides dieselben Bezeichnungen verwendet, ist der Sinn der Sache: Was
 * im Protokoll «Traktanden und Pendenzen» heisst, heisst auch in der Ansicht
 * so – und lässt sich in `tests/access-log.test.ts` prüfen, ohne dass eine
 * Datenbank dafür laufen muss.
 */

/* ------------------------------------------------------------------ */
/* Bereiche und Felder benennen                                        */
/* ------------------------------------------------------------------ */

/**
 * Wie eine Firestore-Sammlung im Protokoll heisst.
 *
 * Die Namen sind die der Oberfläche und nicht die der Datenbank: Wer das
 * Protokoll liest, sucht darin die Bereiche, die er in der App anklickt.
 */
export const AREA_LABELS: Record<string, string> = {
  users: 'Benutzer',
  meetings: 'Sitzungen',
  agendaItems: 'Traktanden und Pendenzen',
  monthlyDuties: 'Monatsaufgaben',
  members: 'Mitglieder',
  talks: 'Ansprachen',
  callings: 'Berufungen',
  notes: 'Notizen',
  sacramentMeetings: 'Abendmahlsversammlung',
  prayers: 'Gebete',
  announcementSeries: 'Wiederkehrende Bekanntmachungen',
  hymns: 'Gesangbuch',
  cleaningWeeks: 'Putzplan',
  apActivities: 'Aktivitäten AP',
  apMonths: 'Aktivitäten AP · Leitung',
  calendarFeeds: 'Kalender-Links',
  impulseItems: 'Anti Doom',
  impulseAnswers: 'Anti Doom · Antworten',
  impulseProgress: 'Anti Doom · Fortschritt',
  impulseComments: 'Anti Doom · Frage der Woche',
  impulseSubmissions: 'Anti Doom · Mitmach-Ecke',
  pushTokens: 'Benachrichtigungen · Geräte',
  notificationSettings: 'Benachrichtigungen',
  settings: 'Einstellungen',
}

export function areaLabel(collectionId: string): string {
  return AREA_LABELS[collectionId] ?? collectionId
}

/**
 * Felder, die nichts über die Änderung aussagen.
 *
 * Sie stehen bei praktisch jedem Schreibvorgang mit dabei – wer sie
 * mitschriebe, hätte in jeder Zeile «Zeitpunkt der Änderung» stehen und
 * müsste danach suchen, was wirklich anders ist.
 */
const HOUSEKEEPING = new Set([
  'updatedAt',
  'createdAt',
  'createdBy',
  'createdById',
  'updatedById',
  'editedAt',
])

/** Die geläufigsten Felder auf Deutsch. Unbekannte behalten ihren Namen. */
const FIELD_LABELS: Record<string, string> = {
  active: 'Aktiv',
  announcements: 'Bekanntmachungen',
  askedAt: 'Angefragt am',
  askedById: 'Angefragt von',
  assignees: 'Zuständigkeit',
  attendees: 'Anwesende',
  birthDate: 'Geburtsdatum',
  body: 'Text',
  business: 'Angelegenheiten',
  callingChanges: 'Berufungsänderung',
  closedAt: 'Abschluss',
  closingPrayer: 'Schlussgebet',
  color: 'Farbe',
  completedAt: 'Erledigt am',
  conductingId: 'Leitung',
  date: 'Datum',
  deferCount: 'Verschiebungen',
  description: 'Beschreibung',
  details: 'Erläuterung',
  displayName: 'Name',
  durationMinutes: 'Dauer',
  dutyLeaderId: 'Monatsleitung',
  email: 'E-Mail',
  endDate: 'Ende',
  endTime: 'Ende',
  extendedDate: 'Berufen am',
  group: 'Gruppe',
  history: 'Verlauf',
  hymns: 'Lieder',
  impulse: 'Anti-Doom-Zugang',
  impulseEditor: 'Anti-Doom-Redaktion',
  initials: 'Kürzel',
  kind: 'Art',
  label: 'Bezeichnung',
  layout: 'Darstellung',
  leader: 'Leitung',
  leadership: 'Leitung',
  location: 'Ort',
  meetingId: 'Sitzung',
  memberId: 'Mitglied',
  memberName: 'Mitglied',
  memberRefs: 'Erwähnte Personen',
  musicalNumbers: 'Musikbeiträge',
  note: 'Notiz',
  notes: 'Notizen',
  openingPrayer: 'Anfangsgebet',
  order: 'Reihenfolge',
  organization: 'Organisation',
  phone: 'Telefon',
  position: 'Berufung',
  presidingId: 'Vorsitz',
  programOrder: 'Programm',
  releasedDate: 'Entlassen am',
  responsibleId: 'Zuständigkeit',
  role: 'Rolle',
  setApartDate: 'Eingesetzt am',
  skipDates: 'Ausnahmen',
  slot: 'Platz',
  spiritualThought: 'Geistiger Gedanke',
  startDate: 'Beginn',
  startedAt: 'Beginn',
  status: 'Status',
  sustainedDate: 'Bestätigt am',
  team: 'Team',
  text: 'Text',
  time: 'Zeit',
  title: 'Titel',
  topic: 'Thema',
  visitors: 'Besucher',
  wardName: 'Gemeinde',
  weeks: 'Wochen',
}

/**
 * Welche Felder eine Änderung angefasst hat – benannt und ohne Beiwerk.
 *
 * Firestore kennt verschachtelte Pfade («hymns.opening»); davon interessiert
 * nur der vordere Teil, denn er sagt, worum es ging.
 */
export function fieldLabels(_collectionId: string, data: unknown): string[] {
  if (!data || typeof data !== 'object') return []

  const seen = new Set<string>()
  for (const key of Object.keys(data as Record<string, unknown>)) {
    const root = key.split('.')[0]
    if (HOUSEKEEPING.has(root)) continue
    seen.add(FIELD_LABELS[root] ?? root)
  }
  return [...seen]
}

/* ------------------------------------------------------------------ */
/* Einer Änderung einen Titel geben                                    */
/* ------------------------------------------------------------------ */

/** Nachschlagen, was von einem Datensatz bereits geladen ist. */
export type PeekDoc = (collectionId: string, docId: string) => Record<string, unknown> | null

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** «2026-08-09» → «09.08.2026»; alles andere bleibt, wie es ist. */
function readableDay(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (match) return `${match[3]}.${match[2]}.${match[1]}`
  const month = /^(\d{4})-(\d{2})$/.exec(value)
  return month ? `${month[2]}.${month[1]}` : value
}

/**
 * Woran gearbeitet wurde, in Worten.
 *
 * Zuerst aus dem, was geschrieben wurde – das ist der neueste Stand und beim
 * Anlegen die einzige Quelle. Steht der Titel nicht darin (eine Änderung
 * schreibt nur, was sich ändert), wird im bereits geladenen Bestand
 * nachgeschlagen. Beides kostet nichts: Der Bestand liegt ohnehin im Speicher
 * (siehe `lib/collectionStore`).
 *
 * Bleibt beides ohne Antwort, steht kein Titel da. Das ist besser als eine
 * Dokument-ID, die niemandem etwas sagt – der Bereich allein («eine Ansprache
 * geändert») trägt die Zeile schon.
 */
export function describeChange(
  collectionId: string,
  docId: string,
  data: unknown,
  peek?: PeekDoc,
): string {
  const written = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>
  const stored = peek && docId ? (peek(collectionId, docId) ?? {}) : {}
  const field = (name: string) => text(written[name]) || text(stored[name])

  switch (collectionId) {
    case 'members':
      return [field('firstName'), field('lastName')].filter(Boolean).join(' ')
    case 'talks':
    case 'prayers':
    case 'callings':
      return field('memberName')
    case 'users':
      return field('displayName') || field('email')
    case 'announcementSeries':
      return field('text')
    case 'apMonths':
      return readableDay(field('month') || docId)
    case 'sacramentMeetings':
      return readableDay(docId)
    case 'cleaningWeeks':
      return field('team') || readableDay(field('startDate') || docId)
    case 'hymns': {
      const number = written.number ?? stored.number
      const title = field('title')
      return [typeof number === 'number' ? `Nr. ${number}` : '', title].filter(Boolean).join(' · ')
    }
    case 'settings':
      return ''
    case 'apActivities': {
      const day = readableDay(field('date'))
      const title = field('title')
      return [day, title].filter(Boolean).join(' · ')
    }
    default:
      return field('title') || field('label') || field('name')
  }
}

/* ------------------------------------------------------------------ */
/* Gerät und Ort                                                       */
/* ------------------------------------------------------------------ */

/**
 * «iPhone · Safari» aus der Browserkennung.
 *
 * Bewusst grob: Die Kennung ist ein historisch gewachsenes Durcheinander, in
 * dem jeder Browser behauptet, mehrere andere zu sein. Für die Frage, die im
 * Protokoll gestellt wird – «war das dasselbe Gerät wie letztes Mal?» –
 * genügen Gerät und Browser; eine Versionsnummer beantwortet sie nicht besser.
 *
 * Die Reihenfolge der Abfragen ist deshalb entscheidend: Edge nennt sich auch
 * Chrome, Chrome auch Safari. Wer zuerst gefragt wird, gewinnt.
 */
export function parseDevice(userAgent: string): string {
  const ua = userAgent || ''

  const device = /iPhone/.test(ua)
    ? 'iPhone'
    : /iPad/.test(ua)
      ? 'iPad'
      : /Android/.test(ua)
        ? 'Android'
        : /Macintosh/.test(ua)
          ? 'Mac'
          : /Windows/.test(ua)
            ? 'Windows'
            : /Linux/.test(ua)
              ? 'Linux'
              : ''

  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\/|Opera/.test(ua)
      ? 'Opera'
      : /Firefox\/|FxiOS/.test(ua)
        ? 'Firefox'
        : /CriOS/.test(ua)
          ? 'Chrome'
          : /Chrome\//.test(ua)
            ? 'Chrome'
            : /Safari\//.test(ua)
              ? 'Safari'
              : ''

  return [device, browser].filter(Boolean).join(' · ')
}

/**
 * Der Ort eines Besuchs, so genau wie er bekannt ist.
 *
 * Die Angabe stammt aus dem Netz, über das zugegriffen wurde (siehe
 * `netlify/functions/whereami`), und ist damit ungefähr: Sie zeigt, wo der
 * Anschluss registriert ist, nicht wo jemand steht. Über ein Mobilnetz kann
 * das ein paar Dutzend Kilometer daneben liegen. Fehlt sie ganz, bleibt die
 * Zeitzone des Geräts – die sagt wenigstens, ob jemand im Land war.
 */
export function formatPlace(entry: SessionEntry): string {
  const place = [entry.city, entry.region, entry.country]
    .map((value) => (value ?? '').trim())
    .filter(Boolean)

  // «Zürich, Zürich, Schweiz» ist keine Auskunft – doppelte Namen fallen weg.
  const unique = place.filter((value, index) => place.indexOf(value) === index)
  if (unique.length > 0) return unique.join(', ')

  return (entry.timezone ?? '').replace(/_/g, ' ')
}

/** Wie lange ein Besuch gedauert hat, in Minuten. */
export function sessionMinutes(entry: SessionEntry): number {
  const from = toDate(entry.at)
  const to = toDate(entry.endedAt ?? entry.at)
  if (!from || !to) return 0
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 60000))
}

/* ------------------------------------------------------------------ */
/* Eine Zeile je Konto                                                 */
/* ------------------------------------------------------------------ */

export interface AccountRow {
  uid: string
  name: string
  email: string
  /** Steht das Konto noch in der Benutzerverwaltung? */
  known: boolean
  role: Role | null
  /** Alles zu diesem Konto, neueste zuerst */
  entries: LogEntry[]
  sessions: SessionEntry[]
  changes: ChangeEntry[]
  /** Anzahl Besuche im gewählten Zeitraum */
  visits: number
  /** Anzahl Änderungen; zusammengefasste zählen mit ihrer Menge */
  changeCount: number
  /** Zuletzt gesehen – auch wenn das die Änderung und nicht der Besuch war */
  lastAt: Date | null
  firstAt: Date | null
  /** Summe aller Besuchsdauern in Minuten */
  minutes: number
  /** Gerät und Ort des letzten Besuchs */
  device: string
  place: string
  /** Besuche je Tag, ältester zuerst – die Balkenreihe in der Zeile */
  perDay: number[]
}

function entryAt(entry: LogEntry): Date | null {
  return toDate(entry.at)
}

/** Mitternacht – der Tag, in den ein Zeitpunkt fällt. */
function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

/**
 * Aus Einträgen und Konten wird die Liste, die die Seite zeigt.
 *
 * Enthalten sind **alle** registrierten Konten, auch die ohne einen einzigen
 * Eintrag: «war noch nie da» ist die Antwort, wegen der man eine solche Liste
 * aufschlägt. Dazu kommen Konten, die es nicht mehr gibt, aber im Protokoll
 * stehen – sie tragen den Namen, der beim Zugriff galt.
 */
export function buildRows(
  entries: LogEntry[],
  users: AppUser[],
  options: { days: number; now?: Date } = { days: 30 },
): AccountRow[] {
  const now = options.now ?? new Date()
  const days = Math.max(1, options.days)

  const rows = new Map<string, AccountRow>()

  const blank = (uid: string, name: string, email: string, user?: AppUser): AccountRow => ({
    uid,
    name: user?.displayName || name || email || 'Unbekannt',
    email: user?.email || email,
    known: Boolean(user),
    role: user?.role ?? null,
    entries: [],
    sessions: [],
    changes: [],
    visits: 0,
    changeCount: 0,
    lastAt: null,
    firstAt: null,
    minutes: 0,
    device: '',
    place: '',
    perDay: Array.from({ length: Math.min(days, 30) }, () => 0),
  })

  for (const user of users) rows.set(user.id, blank(user.id, user.displayName, user.email, user))

  /*
   * Die Tagesbalken zählen rückwärts von heute: Feld 0 ist der älteste
   * gezeigte Tag, das letzte Feld ist heute. Mehr als dreissig Balken passen
   * in eine Tabellenzeile ohnehin nicht.
   */
  const buckets = Math.min(days, 30)
  const index = new Map<string, number>()
  for (let back = 0; back < buckets; back += 1) {
    const day = new Date(now)
    day.setHours(0, 0, 0, 0)
    day.setDate(day.getDate() - back)
    index.set(dayKey(day), buckets - 1 - back)
  }

  const since = new Date(now)
  since.setHours(0, 0, 0, 0)
  since.setDate(since.getDate() - (days - 1))

  for (const entry of entries) {
    const at = entryAt(entry)
    if (!at || at < since) continue

    let row = rows.get(entry.uid)
    if (!row) {
      row = blank(entry.uid, entry.displayName, entry.email)
      rows.set(entry.uid, row)
    }

    row.entries.push(entry)
    if (!row.lastAt || at > row.lastAt) row.lastAt = at
    if (!row.firstAt || at < row.firstAt) row.firstAt = at

    if (entry.kind === 'session') {
      row.sessions.push(entry)
      row.visits += 1
      row.minutes += sessionMinutes(entry)
      const slot = index.get(dayKey(at))
      if (slot !== undefined) row.perDay[slot] += 1
    } else {
      row.changes.push(entry)
      row.changeCount += Math.max(1, entry.count ?? 1)
    }
  }

  for (const row of rows.values()) {
    row.entries.sort((a, b) => (entryAt(b)?.getTime() ?? 0) - (entryAt(a)?.getTime() ?? 0))
    row.sessions.sort((a, b) => (entryAt(b)?.getTime() ?? 0) - (entryAt(a)?.getTime() ?? 0))

    const latest = row.sessions[0]
    if (latest) {
      row.device = latest.device ?? ''
      row.place = formatPlace(latest)
    }
  }

  return [...rows.values()]
}

/* ------------------------------------------------------------------ */
/* Sortieren                                                           */
/* ------------------------------------------------------------------ */

export type SortKey = 'last' | 'visits' | 'changes' | 'minutes' | 'name'

export const SORT_LABELS: Record<SortKey, string> = {
  last: 'Letzter Zugriff',
  visits: 'Anzahl Zugriffe',
  changes: 'Änderungen',
  minutes: 'Verweildauer',
  name: 'Name',
}

/**
 * Sortiert die Zeilen.
 *
 * Wer noch nie da war, steht immer am Ende – egal wonach sortiert wird. Nach
 * «letzter Zugriff» stünde er sonst zuoberst (nichts ist älter als nie), und
 * das ist genau verkehrt herum: Die Liste soll mit den Konten beginnen, über
 * die es etwas zu sagen gibt.
 */
export function sortRows(rows: AccountRow[], key: SortKey): AccountRow[] {
  const byName = (a: AccountRow, b: AccountRow) => a.name.localeCompare(b.name, 'de')

  return [...rows].sort((a, b) => {
    if (key !== 'name') {
      const aEmpty = a.entries.length === 0
      const bEmpty = b.entries.length === 0
      if (aEmpty !== bEmpty) return aEmpty ? 1 : -1
    }

    switch (key) {
      case 'visits':
        return b.visits - a.visits || byName(a, b)
      case 'changes':
        return b.changeCount - a.changeCount || byName(a, b)
      case 'minutes':
        return b.minutes - a.minutes || byName(a, b)
      case 'name':
        return byName(a, b)
      default:
        return (b.lastAt?.getTime() ?? 0) - (a.lastAt?.getTime() ?? 0) || byName(a, b)
    }
  })
}

/* ------------------------------------------------------------------ */
/* Der Zeitstrahl einer Zeile                                          */
/* ------------------------------------------------------------------ */

export interface LogDay {
  /** Mitternacht des Tages – zum Beschriften */
  date: Date
  entries: LogEntry[]
}

/**
 * Die Einträge eines Kontos nach Tagen gebündelt, neuester Tag zuerst.
 *
 * Ein Zeitstrahl ohne diese Bündelung liest sich als endlose Reihe von
 * Uhrzeiten, in der man das Datum jedes Mal mitlesen muss. Mit Tagesüberschrift
 * beantwortet er die Frage, die man an ihn stellt – «was war am Dienstag?».
 */
export function groupByDay(entries: LogEntry[]): LogDay[] {
  const days = new Map<string, LogDay>()

  for (const entry of entries) {
    const at = entryAt(entry)
    if (!at) continue
    const midnight = new Date(at)
    midnight.setHours(0, 0, 0, 0)
    const key = dayKey(midnight)

    const day = days.get(key)
    if (day) day.entries.push(entry)
    else days.set(key, { date: midnight, entries: [entry] })
  }

  return [...days.values()].sort((a, b) => b.date.getTime() - a.date.getTime())
}

/** Wie eine Änderung in einer Zeile steht: «3 Mitglieder geändert». */
export function changeSummary(entry: ChangeEntry, opLabels: Record<ChangeOp, string>): string {
  const count = Math.max(1, entry.count ?? 1)
  const area = areaLabel(entry.collectionId)
  const verb = opLabels[entry.op]

  return count > 1 ? `${count} × ${area} ${verb}` : `${area} ${verb}`
}
