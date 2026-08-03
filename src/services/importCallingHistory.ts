// Mit Dateiendung, damit sich der Parser auch ohne Bundler ausführen lässt
// (`node --test`). Vite und TypeScript lösen das genauso auf.
import { isoDate } from './importHistory.ts'
import type { RawSheet, SheetCell } from './importHistory.ts'
import type { Organization } from '../lib/types.ts'

/**
 * Die Berufungshistorie aus der bisherigen Berufungsliste einlesen.
 *
 * Vor dieser App wurde jede Berufung und jede Entlassung in einer
 * Excel-Tabelle festgehalten – ein Blatt je Zeitabschnitt, eine Zeile je
 * Vorgang:
 *
 *     Nr.  Organisation  Amt            Name     Vorname  …  B/E
 *     001  GML           Gemeindemissionarin  Römer  Celeste  …  B
 *     002  Anderes       Genealogie-Beauftragte  Burri  Mares  …  E
 *
 * Eine Zeile ist deshalb **kein** Berufungsdatensatz, sondern ein
 * Ereignis: «B» beruft, «E» entlässt. Erst beide zusammen ergeben, was die
 * App unter einer Berufung versteht – eine Aufgabe mit Anfang und Ende.
 * Genau das leistet dieser Parser: Er liest die Ereignisse und fügt sie
 * paarweise zusammen.
 *
 * Der Aufbau ist über die Jahre gewachsen und nicht überall streng:
 *
 *  - **Das Kennzeichen B/E gibt es erst seit 2016.** Im ältesten Blatt
 *    verrät sich eine Entlassung daran, dass «eingesetzt am» und
 *    «eingesetzt von» durchgestrichen sind – so hält es die Legende im
 *    Kopf der Tabelle fest.
 *  - **Datumsangaben stehen in drei Schreibweisen** nebeneinander: als
 *    echtes Datum, als «24.03.13» und als «3/26/2017». Was sich nicht
 *    sicher lesen lässt, bleibt leer, statt geraten zu werden.
 *  - **Dieselbe Aufgabe heisst nicht immer gleich.** «1. Ratgeberin JD»
 *    und «1. Ratgeberin» meinen dasselbe, «Leherin» ist «Lehrerin». Für
 *    das Zusammenfügen wird deshalb verglichen, was übrig bleibt, wenn man
 *    Organisationskürzel, Füllwörter und die weibliche Form abzieht.
 *
 * Bewusst ohne Abhängigkeiten zur Firestore-Schicht, damit sich der Parser
 * mit `node --test` direkt ausführen lässt.
 */

/* ------------------------------------------------------------------ */
/* Zellen lesen                                                        */
/* ------------------------------------------------------------------ */

function text(cell: SheetCell | undefined): string {
  if (cell === null || cell === undefined) return ''
  if (cell instanceof Date) return isoDate(cell.getFullYear(), cell.getMonth() + 1, cell.getDate())
  return String(cell).replace(/\s+/g, ' ').trim()
}

/** Kleinbuchstaben, Umlaute ausgeschrieben, nur noch Buchstaben und Ziffern. */
function fold(value: string): string {
  return value
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Ein durchgestrichenes Feld.
 *
 * «////////» in «eingesetzt am» und «eingesetzt von» ist im ältesten Blatt
 * das einzige Merkmal einer Entlassung: Wer entlassen wird, wird nicht
 * eingesetzt, und die Lücke wurde von Hand zugestrichen.
 */
function isStruck(cell: SheetCell | undefined): boolean {
  const value = text(cell)
  return value.length > 0 && /^[/\\\-–—\s]+$/.test(value)
}

/**
 * Ein Datum, das eine Berufung meinen kann.
 *
 * Den Tag muss es im Monat wirklich geben – «31. Februar» soll nicht
 * durchrutschen –, und das Jahr muss in Reichweite einer Gemeindegeschichte
 * liegen. Die Grenze nach oben ist keine Förmlichkeit: In der Liste steckt
 * eine Zelle, die Excel als Tag Nummer 6 684 974 führt und damit als Jahr
 * 20202 liest – ein Vertipper von 2013. Ungeprüft käme sie bis in die
 * Datenbank und liesse den ganzen Import scheitern.
 */
function isRealDate(year: number, month: number, day: number): boolean {
  if (year < 1900 || year > 2200) return false
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

/**
 * Liest ein Datum aus einer Zelle – «2017-03-26», sonst `null`.
 *
 * Drei Schreibweisen kommen vor: das echte Datum (dann ist die Zelle als
 * Datum formatiert), «24.03.13» aus der Schweizer Tastatur – gelegentlich
 * mit Komma statt Punkt getippt – und «3/26/2017» aus der amerikanischen
 * Oberfläche des LCR. Die beiden Textformen unterscheiden sich am
 * Trennzeichen; steht beim Schrägstrich vorne eine Zahl über zwölf, war
 * doch der Tag gemeint.
 *
 * Alles andere – «????», «längst», «######» – bleibt ungelesen, und ebenso
 * ein Datum aus einer Zeit, in der es die Gemeinde nicht gab. Ein geratenes
 * Datum wäre schlimmer als gar keines.
 */
export function parseListDate(cell: SheetCell | undefined): string | null {
  if (cell instanceof Date) {
    const year = cell.getFullYear()
    const month = cell.getMonth() + 1
    const day = cell.getDate()
    return isRealDate(year, month, day) ? isoDate(year, month, day) : null
  }

  const raw = text(cell)
  if (!raw) return null

  const value = raw.replace(/,/g, '.').replace(/\s+/g, '')
  const parts = value.match(/^(\d{1,2})([./])(\d{1,2})\2(\d{2,4})$/)
  if (!parts) return null

  const [, first, separator, second, yearText] = parts
  const year = Number(yearText) + (yearText.length <= 2 ? 2000 : 0)

  // Punkt: Tag zuerst (Schweiz). Schrägstrich: Monat zuerst (LCR) – es sei
  // denn, die vordere Zahl kann kein Monat sein.
  const swiss = separator === '.' || Number(first) > 12
  const day = Number(swiss ? first : second)
  const month = Number(swiss ? second : first)

  return isRealDate(year, month, day) ? isoDate(year, month, day) : null
}

/* ------------------------------------------------------------------ */
/* Organisationen                                                      */
/* ------------------------------------------------------------------ */

/**
 * Die Kürzel der Tabelle, auf die Organisationen der App abgebildet.
 *
 * Geschrieben wurde über die Jahre, was gerade zur Hand war – «SoSch»,
 * «Soschu», «Sonntagschule». Verglichen wird deshalb die gefaltete Form.
 *
 * Zwei Zuordnungen verdienen eine Bemerkung: Die Hohepriestergruppe gibt
 * es seit 2018 nicht mehr, ihre Aufgaben liegen beim Ältestenkollegium –
 * dort steht sie deshalb auch hier. Und das Aaronische Priestertum führt
 * die App unter «Junge Männer», wie schon der LCR-Import.
 */
const ORGANIZATIONS: Record<string, Organization> = {
  bischofschaft: 'bishopric',
  'aeltesten k': 'elders_quorum',
  aeltestenkollegium: 'elders_quorum',
  aekol: 'elders_quorum',
  ae: 'elders_quorum',
  'hp gruppe': 'elders_quorum',
  ap: 'young_men',
  jm: 'young_men',
  'junge maenner': 'young_men',
  diakonskollg: 'young_men',
  lehrerkollg: 'young_men',
  jd: 'young_women',
  'junge damen': 'young_women',
  fhv: 'relief_society',
  pv: 'primary',
  sosch: 'sunday_school',
  soschu: 'sunday_school',
  sonntagschule: 'sunday_school',
  sonntagsschule: 'sunday_school',
  gml: 'missionary',
  musik: 'music',
  tempel: 'temple_family_history',
  genealogie: 'temple_family_history',
  gemeinde: 'ward',
  jae: 'other',
  anderes: 'other',
  seminar: 'other',
  pfahl: 'other',
}

/** Bezeichnungen, hinter denen eine Aufgabe ausserhalb der Gemeinde steht. */
const OUT_OF_UNIT = /\b(pfahl|seminar|institut)/

/* ------------------------------------------------------------------ */
/* Ämter vergleichbar machen                                           */
/* ------------------------------------------------------------------ */

/** Füllwörter und Organisationskürzel, die im Amt nichts unterscheiden. */
const NOISE = new Set([
  'in',
  'im',
  'der',
  'die',
  'das',
  'den',
  'des',
  'fuer',
  'und',
  'zum',
  'zur',
  'pv',
  'fhv',
  'jd',
  'jm',
  'ap',
  'sosch',
  'soschu',
  'sonntagschule',
  'sonntagsschule',
  'gml',
  'jae',
  'hp',
  'aekol',
  'gemeinde',
])

/**
 * Schreibweisen, die dieselbe Aufgabe meinen.
 *
 * Die männliche Form wird auf die weibliche gezogen und die Ziffer auf das
 * Wort – nicht aus Vorliebe, sondern weil es eine Richtung braucht: «1.
 * Ratgeber» und «Erste Ratgeberin» sollen zusammenfinden. Die Tippfehler
 * stehen daneben, weil sie in der Tabelle häufig genug vorkommen, um
 * sonst Paare zu zerreissen.
 */
const SAME_WORD: Record<string, string> = {
  '1': 'erste',
  '2': 'zweite',
  '3': 'dritte',
  erster: 'erste',
  zweiter: 'zweite',
  dritter: 'dritte',
  ratgeber: 'ratgeberin',
  lehrer: 'lehrerin',
  leher: 'lehrerin',
  leherin: 'lehrerin',
  lehrering: 'lehrerin',
  praesident: 'praesidentin',
  leiter: 'leiterin',
  sekretaer: 'sekretaerin',
  beauftragter: 'beauftragte',
  verantwortlicher: 'verantwortliche',
  betreuer: 'betreuerin',
  assistent: 'assistentin',
  dirigent: 'dirigentin',
  pianist: 'pianistin',
  organist: 'organistin',
  berater: 'beraterin',
}

function positionTokens(position: string): string[] {
  return fold(position)
    .split(' ')
    .filter((word) => word && !NOISE.has(word))
    .map((word) => SAME_WORD[word] ?? word)
}

/** Vergleichsform eines Amtes – Reihenfolge und Wiederholungen zählen nicht. */
function positionKey(position: string): string {
  return [...new Set(positionTokens(position))].sort().join(' ')
}

/* ------------------------------------------------------------------ */
/* Aufbau eines Blattes                                                */
/* ------------------------------------------------------------------ */

/** Spalten, die gelesen werden – erkannt an der Überschrift. */
interface Columns {
  organization: number
  position: number
  lastName: number
  firstName: number
  calledBy: number
  decided: number
  sustained: number
  setApart: number
  setApartBy: number
  /** Spalte «B/E»; -1 in den Blättern, die sie noch nicht kennen */
  kind: number
}

/**
 * Welche Überschrift welche Spalte meint.
 *
 * Geprüft wird in dieser Reihenfolge, und jede Spalte wird nur einmal
 * vergeben – «eingesetzt am» und «eingesetzt von» unterscheiden sich sonst
 * erst im letzten Wort.
 */
const HEADINGS: [keyof Columns, RegExp][] = [
  ['organization', /^organisation/],
  ['position', /^amt/],
  ['lastName', /^name/],
  ['firstName', /^vorname/],
  ['calledBy', /folgt durch/],
  ['sustained', /bestaetigt/],
  ['setApart', /gesetzt am/],
  ['setApartBy', /gesetzt von/],
  ['decided', /^berufen/],
  ['kind', /\bb e$/],
]

/**
 * Sucht die Kopfzeile und ordnet ihr die Spalten zu.
 *
 * Ohne Name, Vorname und Amt ist ein Blatt keine Berufungsliste – das
 * Blatt mit den Auswahlwerten für die Organisationen fällt so von selbst
 * weg, ohne dass es beim Namen genannt werden müsste.
 */
function readHeader(data: SheetCell[][]): { row: number; columns: Columns } | null {
  const limit = Math.min(data.length, 10)

  for (let index = 0; index < limit; index++) {
    const found = new Map<keyof Columns, number>()

    ;(data[index] ?? []).forEach((cell, column) => {
      const heading = fold(text(cell))
      if (!heading) return
      for (const [field, pattern] of HEADINGS) {
        if (found.has(field) || !pattern.test(heading)) continue
        found.set(field, column)
        return
      }
    })

    if (!found.has('lastName') || !found.has('firstName') || !found.has('position')) continue

    const at = (field: keyof Columns) => found.get(field) ?? -1
    return {
      row: index,
      columns: {
        organization: at('organization'),
        position: at('position'),
        lastName: at('lastName'),
        firstName: at('firstName'),
        calledBy: at('calledBy'),
        decided: at('decided'),
        sustained: at('sustained'),
        setApart: at('setApart'),
        setApartBy: at('setApartBy'),
        kind: at('kind'),
      },
    }
  }

  return null
}

/* ------------------------------------------------------------------ */
/* Ereignisse                                                          */
/* ------------------------------------------------------------------ */

export type CallingEventKind = 'call' | 'release'

/** Eine gelesene Zeile: eine Berufung oder eine Entlassung. */
export interface CallingEvent {
  kind: CallingEventKind
  /** «Nachname, Vorname» – dieselbe Schreibweise wie beim LCR-Abgleich */
  fullName: string
  position: string
  organization: Organization
  /** Kürzel, wie es in der Tabelle steht */
  organizationLabel: string
  outOfUnit: boolean
  /** «berufen/entlassen am» */
  decidedDate: string | null
  /** «bestätigt» bzw. «Danke für Dienst am» */
  sustainedDate: string | null
  /** «eingesetzt am» */
  setApartDate: string | null
  calledBy: string
  setApartBy: string
  sheet: string
  /** Zeilennummer im Blatt, wie sie Excel anzeigt */
  row: number
  /** Kennung der Quellzeile, z. B. «2017-042» */
  ref: string
}

/** Eine Berufung mit Anfang und – wenn erfasst – Ende. */
export interface HistoricCalling {
  /**
   * Kennung der Quellzeile, z. B. «2017-042».
   *
   * Aus ihr entsteht die Dokument-ID. Damit schreibt ein zweiter Durchlauf
   * dieselben Berufungen noch einmal, statt den Verlauf zu verdoppeln –
   * auch dann, wenn beim zweiten Mal mehr Namen von Hand zugeordnet wurden.
   */
  ref: string
  fullName: string
  position: string
  organization: Organization
  organizationLabel: string
  outOfUnit: boolean
  /** «berufen am» – der Tag, an dem die Berufung ausgesprochen wurde */
  extendedDate: string | null
  sustainedDate: string | null
  setApartDate: string | null
  /** Tag der Entlassung; `null`, wenn eine Entlassung fehlt oder undatiert ist */
  releasedDate: string | null
  /** Ist eine Entlassung erfasst? */
  released: boolean
  calledBy: string
  setApartBy: string
  /** Frühestes bekanntes Datum – danach wird sortiert */
  startDate: string | null
  sheet: string
  row: number
}

export interface CallingHistorySheet {
  sheet: string
  calls: number
  releases: number
}

export interface ParsedCallingHistory {
  callings: HistoricCalling[]
  sheets: CallingHistorySheet[]
  /** Blätter ohne erkennbare Kopfzeile – etwa die Liste der Auswahlwerte */
  skippedSheets: string[]
  /** Entlassungen ohne zugehörige Berufung – die Berufung liegt vor der Tabelle */
  releaseOnly: number
  /** Berufungen ohne erfasste Entlassung */
  open: number
  /** Zeilen ganz ohne Datum */
  undated: number
  /** Organisationskürzel, die keiner Organisation entsprachen */
  unknownOrganizations: string[]
}

/* ------------------------------------------------------------------ */
/* Blätter lesen                                                       */
/* ------------------------------------------------------------------ */

/** Nachnamen mit Haushaltsnummer entschärfen: «Lauener (2)» → «Lauener». */
function cleanLastName(value: string): string {
  return value.replace(/\s*\([^)]*\)\s*$/, '').trim()
}

function readEvents(sheet: RawSheet, slug: string, unknown: Set<string>): CallingEvent[] {
  const header = readHeader(sheet.data)
  if (!header) return []
  const { columns } = header

  const events: CallingEvent[] = []
  const cell = (row: SheetCell[], index: number): SheetCell =>
    index >= 0 ? (row[index] ?? null) : null

  for (let index = header.row + 1; index < sheet.data.length; index++) {
    const row = sheet.data[index]
    if (!row) continue

    const lastName = cleanLastName(text(cell(row, columns.lastName)))
    const firstName = text(cell(row, columns.firstName))
    if (!lastName && !firstName) continue

    const position = text(cell(row, columns.position))
    const label = text(cell(row, columns.organization))
    const organization = ORGANIZATIONS[fold(label)]
    if (label && !organization) unknown.add(label)

    const marker = text(cell(row, columns.kind)).toUpperCase()
    // Bis 2015 gab es die Spalte «B/E» noch nicht. Dort verrät sich die
    // Entlassung an den durchgestrichenen Feldern «eingesetzt am» und
    // «eingesetzt von» – so hält es die Legende der Tabelle fest.
    const kind: CallingEventKind =
      marker === 'B' || marker === 'E'
        ? marker === 'E'
          ? 'release'
          : 'call'
        : isStruck(cell(row, columns.setApart)) || isStruck(cell(row, columns.setApartBy))
          ? 'release'
          : 'call'

    events.push({
      kind,
      fullName: [lastName, firstName].filter(Boolean).join(', '),
      position,
      organization: organization ?? 'other',
      organizationLabel: label,
      outOfUnit: OUT_OF_UNIT.test(fold(label)) || OUT_OF_UNIT.test(fold(position)),
      decidedDate: parseListDate(cell(row, columns.decided)),
      sustainedDate: parseListDate(cell(row, columns.sustained)),
      setApartDate: parseListDate(cell(row, columns.setApart)),
      calledBy: text(cell(row, columns.calledBy)),
      setApartBy: isStruck(cell(row, columns.setApartBy))
        ? ''
        : text(cell(row, columns.setApartBy)),
      sheet: sheet.sheet,
      row: index + 1,
      ref: `${slug}-${String(index + 1).padStart(3, '0')}`,
    })
  }

  return events
}

/**
 * Kurzname eines Blattes für die Kennung seiner Zeilen: «2017».
 *
 * Das Jahr im Blattnamen genügt und bleibt lesbar. Tragen zwei Blätter
 * dasselbe Jahr – oder gar keines –, wird durchnummeriert; zwei Zeilen
 * dürfen niemals dieselbe Kennung tragen, sonst überschriebe beim Import
 * die eine die andere.
 */
function sheetSlugs(sheets: RawSheet[]): string[] {
  const taken = new Set<string>()
  return sheets.map((sheet, index) => {
    const base = sheet.sheet.match(/(?:19|20)\d{2}/)?.[0] ?? `blatt${index + 1}`
    let slug = base
    let suffix = 2
    while (taken.has(slug)) slug = `${base}-${suffix++}`
    taken.add(slug)
    return slug
  })
}

/* ------------------------------------------------------------------ */
/* Ereignisse zu Berufungen zusammenfügen                              */
/* ------------------------------------------------------------------ */

/** Frühestes erfasstes Datum eines Ereignisses. */
function eventDate(event: CallingEvent): string | null {
  const dates = [event.decidedDate, event.sustainedDate, event.setApartDate].filter(
    (date): date is string => date !== null,
  )
  return dates.length ? dates.reduce((first, date) => (date < first ? date : first)) : null
}

/** Wie ähnlich sind sich zwei Ämter? 1 = gleich, 0 = kein gemeinsames Wort. */
function similarity(a: string, b: string): number {
  const left = new Set(positionTokens(a))
  const right = new Set(positionTokens(b))
  if (left.size === 0 || right.size === 0) return 0
  const shared = [...left].filter((token) => right.has(token)).length
  return shared / new Set([...left, ...right]).size
}

/** Ab hier gelten zwei Ämter als dasselbe. */
const SIMILAR_ENOUGH = 0.4

interface OpenCalling {
  calling: HistoricCalling
  person: string
  positionKey: string
}

/**
 * Fügt Berufungen und Entlassungen zu Berufungen mit Anfang und Ende
 * zusammen.
 *
 * Gesucht wird von der Entlassung aus, und zwar unter den noch offenen
 * Berufungen derselben Person in derselben Organisation. Dort gilt zuerst
 * das gleich benannte Amt, dann das ähnlichste – und wenn nur eine einzige
 * offen ist, diese. Die Reihenfolge ist nicht beliebig: «1. Ratgeberin»
 * und «1. Ratgeberin JD» meinen dasselbe, «Lehrerin» und «Präsidentin»
 * aber nicht, und wer beides gleichzeitig innehatte, soll nicht das eine
 * mit dem anderen beenden.
 *
 * Was übrig bleibt, geht nicht verloren: Eine Entlassung ohne Berufung
 * wird zur Berufung ohne Anfangsdatum – die Person hatte die Aufgabe ja
 * nachweislich inne, bloss begann sie vor dem ersten Blatt.
 */
function pair(events: CallingEvent[]): HistoricCalling[] {
  const callings: HistoricCalling[] = []
  const open: OpenCalling[] = []

  const record = (event: CallingEvent): HistoricCalling => ({
    ref: event.ref,
    fullName: event.fullName,
    position: event.position,
    organization: event.organization,
    organizationLabel: event.organizationLabel,
    outOfUnit: event.outOfUnit,
    extendedDate: event.decidedDate,
    sustainedDate: event.sustainedDate,
    setApartDate: event.setApartDate,
    releasedDate: null,
    released: false,
    calledBy: event.calledBy,
    setApartBy: event.setApartBy,
    startDate: eventDate(event),
    sheet: event.sheet,
    row: event.row,
  })

  for (const event of events) {
    const person = fold(event.fullName)

    if (event.kind === 'call') {
      const calling = record(event)
      callings.push(calling)
      open.push({ calling, person, positionKey: positionKey(event.position) })
      continue
    }

    const key = positionKey(event.position)
    const candidates = open.filter(
      (entry) => entry.person === person && entry.calling.organization === event.organization,
    )

    // Das gleich benannte Amt zuerst, und darunter das zuletzt begonnene:
    // Wer eine Aufgabe zweimal innehatte, wird von der jüngeren entlassen.
    let match = [...candidates].reverse().find((entry) => entry.positionKey === key)

    if (!match) {
      const ranked = candidates
        .map((entry) => ({ entry, score: similarity(entry.calling.position, event.position) }))
        .filter(({ score }) => score >= SIMILAR_ENOUGH)
        .sort((a, b) => b.score - a.score)
      match = ranked[0]?.entry
    }

    if (!match && candidates.length === 1) match = candidates[0]

    if (match) {
      match.calling.released = true
      match.calling.releasedDate = eventDate(event)
      open.splice(open.indexOf(match), 1)
      continue
    }

    // Entlassung ohne Berufung: Die Aufgabe begann vor der Tabelle.
    const orphan = record(event)
    orphan.extendedDate = null
    orphan.sustainedDate = null
    orphan.setApartDate = null
    orphan.released = true
    orphan.releasedDate = eventDate(event)
    orphan.startDate = null
    callings.push(orphan)
  }

  return callings
}

/**
 * Die Notiz, die eine übernommene Berufung mitbringt.
 *
 * Sie hält fest, woher der Eintrag stammt und was die Tabelle sonst noch
 * wusste – wer die Berufung ausgesprochen und wer eingesetzt hat. Diese
 * beiden Namen sind in der App keine Felder (dort steht eine verknüpfte
 * Person, und die gibt es für die Führung von 2014 nicht mehr), gehen aber
 * auch nicht verloren.
 */
export function historyNote(calling: HistoricCalling): string {
  return [
    `Aus der Berufungsliste (${calling.sheet}, Zeile ${calling.row}).`,
    calling.calledBy && `Berufung durch ${calling.calledBy}.`,
    calling.setApartBy && `Eingesetzt von ${calling.setApartBy}.`,
    !calling.released && 'Keine Entlassung erfasst.',
  ]
    .filter(Boolean)
    .join(' ')
}

/* ------------------------------------------------------------------ */
/* Einstiegspunkt                                                      */
/* ------------------------------------------------------------------ */

export function parseCallingHistory(sheets: RawSheet[]): ParsedCallingHistory {
  const unknownOrganizations = new Set<string>()
  const summaries: CallingHistorySheet[] = []
  const skippedSheets: string[] = []
  const events: CallingEvent[] = []
  const slugs = sheetSlugs(sheets)

  for (const [index, sheet] of sheets.entries()) {
    const read = readEvents(sheet, slugs[index], unknownOrganizations)
    if (read.length === 0) {
      skippedSheets.push(sheet.sheet)
      continue
    }
    summaries.push({
      sheet: sheet.sheet,
      calls: read.filter((event) => event.kind === 'call').length,
      releases: read.filter((event) => event.kind === 'release').length,
    })
    events.push(...read)
  }

  /*
   * Nach Datum ordnen, bevor Paare gebildet werden: Die Blätter zählen
   * teils vorwärts, teils rückwärts, und eine Entlassung gehört zur
   * Berufung davor – nicht zu der, die zufällig darüber steht. Zeilen ohne
   * Datum stehen vorn; sie sind die ältesten Reste und sollen eine
   * datierte Berufung nicht verdrängen.
   *
   * Am selben Tag kommt die Entlassung zuerst. Das ist der Normalfall bei
   * jedem Wechsel: In derselben Versammlung wird der eine entlassen und der
   * andere bestätigt – und wer beides erlebt, weil er innerhalb derselben
   * Präsidentschaft die Aufgabe wechselt, soll nicht am Tag seiner Berufung
   * gleich wieder entlassen werden.
   */
  const ordered = [...events].sort((a, b) => {
    const left = eventDate(a) ?? ''
    const right = eventDate(b) ?? ''
    if (left !== right) return left.localeCompare(right)
    return Number(a.kind === 'call') - Number(b.kind === 'call')
  })

  const callings = pair(ordered)

  return {
    callings,
    sheets: summaries,
    skippedSheets,
    releaseOnly: callings.filter((calling) => calling.released && !calling.startDate).length,
    open: callings.filter((calling) => !calling.released).length,
    undated: callings.filter((calling) => !calling.startDate && !calling.releasedDate).length,
    unknownOrganizations: [...unknownOrganizations],
  }
}
