// Mit Dateiendung, damit sich das Modul auch ohne Bundler ausführen lässt
// (`node --test`). Vite und TypeScript lösen das genauso auf.
import { apClassSundays, isGeneralConferenceSunday, sundaysOfMonth } from './apSchedule.ts'

/**
 * Die Themen der AP-Klasse aus **«Für eine starke Jugend»** einlesen.
 *
 * Seit dem Wechsel auf die wöchentliche Klasse sind die Themen nicht mehr
 * frei: Die Kirche gibt für jeden Monat ein Thema und vier Lektionen
 * heraus – eine für den Fastsonntag und je eine für den zweiten, dritten
 * und vierten Sonntag. Sie stehen als Seite im Netz, herunterladen lässt
 * sich nichts, kopieren schon. Genau das liest dieser Import.
 *
 * **Die Seite gliedert sich nach Monaten.** Jeder Monat hat einen eigenen
 * Abschnitt, und ein Heft kann mehrere davon enthalten – das vom Oktober
 * 2026 bringt auch die Lektionen für den November mit. Unter jeder
 * Überschrift steht dasselbe Muster:
 *
 *     Oktober: Lektionen am Sonntag – Für eine starke Jugend   ← Überschrift
 *     Oktober                                    ← Rubrik
 *     Dein Körper ist heilig                     ← Thema des Monats
 *     Fastensonntag                              ← Rubrik
 *     1. Befasse dich mit dem Kapitel aus …      ← Lektion
 *     Zweiter Sonntag
 *     2. Erfahre mehr über das Wort der Weisheit
 *     …
 *
 * Woran die Lektion zu erkennen ist: Sie beginnt mit ihrer Nummer. Und das
 * Thema des Monats: Es ist der erste Eintrag unter der Überschrift, der
 * weder der Monatsname noch eine Beschreibung («Einstieg für den
 * Unterricht …, Oktober 2026») ist und auf den nicht gleich eine Lektion
 * folgt – sonst wäre er deren Rubrik.
 *
 * Den Monat nennt die Überschrift, das Jahr das Heft. Die Adresse taugt
 * für den Monat nicht immer: Die Lektionen für den November liegen im
 * Oktoberheft, unter `…/ftsoy/2026/10/01-fast-sunday`.
 *
 * **Verweise kommen mit oder nicht.** Je nachdem, wo kopiert und wo
 * eingefügt wird, stehen die Einträge als blosse Zeilen da oder als
 * Verweis:
 *
 *     [2. Erfahre mehr über das Wort der Weisheit](…/ftsoy/2026/10/fsy-lessons/02-second-sunday?lang=deu)
 *
 * Beides geht. Wo die Adresse mitkommt, hilft sie: Sie weist den Einstieg
 * (`00-intro`) und die Lektionen sicher aus und unterscheidet beim vierten
 * Sonntag die Fassung der Jungen Damen (`04a`) von der der Kollegien
 * (`04b`).
 *
 * **Der vierte Sonntag steht zweimal da**, erst für die Jungen Damen, dann
 * für die Kollegien des Aaronischen Priestertums. Der Plan hier ist der
 * der Kollegien, also gilt deren Fassung – erkannt an der Adresse oder an
 * der Rubrik darüber, und wo beides nichts sagt, an der Reihenfolge. Steht
 * die Vier nur einmal da, gilt sie für beide.
 *
 * Bewusst ohne Abhängigkeiten ausser dem Takt, damit sich der Parser mit
 * `node --test` direkt ausführen lässt.
 */

/**
 * Welcher Sonntag im Monat – so ordnet «Für eine starke Jugend» seine
 * Lektionen.
 *
 * Die vierte heisst im Heft «Letzter Sonntag» und in der Adresse
 * `04-fourth-sunday`. Hier gilt die Zählung: Sie kommt auf den **vierten**
 * Sonntag, und ein fünfter bleibt frei (siehe `apTopicRows`).
 */
export type ApLessonSlot = 'fast' | 'second' | 'third' | 'fourth'

export const AP_LESSON_SLOT_LABELS: Record<ApLessonSlot, string> = {
  fast: 'Fastensonntag',
  second: 'Zweiter Sonntag',
  third: 'Dritter Sonntag',
  fourth: 'Vierter Sonntag',
}

/** Die Reihenfolge, in der die Lektionen im Monat stehen. */
export const AP_LESSON_SLOTS: ApLessonSlot[] = ['fast', 'second', 'third', 'fourth']

export interface ParsedApLesson {
  slot: ApLessonSlot
  /** «Erfahre mehr über Priestertumsschlüssel» – ohne die führende Nummer */
  topic: string
}

/** Die Themen eines Monats. */
export interface ParsedApTopics {
  /** «2026-10» */
  month: string
  /** Das Thema des Monats – «Dein Körper ist heilig» */
  intro: string
  lessons: ParsedApLesson[]
}

/* ------------------------------------------------------------------ */
/* Die Seite lesen                                                     */
/* ------------------------------------------------------------------ */

/** Markdown-Verweis: `[Titel](Adresse)`. */
const LINK = /\[([^\]]*)\]\(([^)]*)\)/g

/** Aufzählungszeichen am Zeilenanfang – «* », «- », «• ». */
const BULLET = /^\s*[*•-]\s+/

/**
 * `…/ftsoy/2026/10/fsy-lessons/02-second-sunday?lang=deu` – oder, wie beim
 * November im Oktoberheft, ohne `fsy-lessons/` dazwischen.
 */
const LESSON_URL = /\/ftsoy\/(\d{4})\/(\d{2})\/(fsy-lessons\/)?(\d{2})([a-z])?(?:-([a-z][a-z-]*))?/i

/**
 * Ohne `fsy-lessons/` steht eine Lektion neben den Artikeln des Hefts
 * (`…/2026/10/02-god-knows-and-loves-you`) und ist nur an ihrem Namen zu
 * erkennen.
 */
const LESSON_NAME = /^(?:intro|fast-sunday|(?:second|third|fourth|last)-sunday|activity-idea)$/i

/** «2. Erfahre mehr über …» – die Nummer gehört zur Lektion, nicht zum Thema. */
const NUMBERED = /^([1-4])\.\s+(.*\S)/

/** «Oktober: Lektionen am Sonntag – Für eine starke Jugend», mit oder ohne Monat. */
const SECTION = /Lektionen am Sonntag/i

/** Die Rubriken über der vierten Lektion – «Letzter Sonntag: Junge Damen». */
const YOUNG_WOMEN = /junge damen/i
const QUORUMS = /kollegien|priestertum/i

/** Welche Ziffer der Adresse zu welchem Sonntag gehört. */
const SLOT_OF_STEP: Record<string, ApLessonSlot> = {
  '01': 'fast',
  '02': 'second',
  '03': 'third',
  '04': 'fourth',
}

const MONTHS = [
  'januar',
  'februar',
  'märz',
  'april',
  'mai',
  'juni',
  'juli',
  'august',
  'september',
  'oktober',
  'november',
  'dezember',
]

const MONTH_NAMES = MONTHS.join('|')

/** Ein Monatsname, wo auch immer – «Oktober: Lektionen am Sonntag». */
const MONTH_NAME = new RegExp(`\\b(${MONTH_NAMES})\\b`, 'i')

/** Nichts als der Monat – die Rubrik über dem Thema, «Oktober». */
const MONTH_ONLY = new RegExp(`^(?:${MONTH_NAMES})(?:\\s+\\d{4})?$`, 'i')

/** «Oktober 2026» – so nennt die Beschreibung des Einstiegs den Monat. */
const MONTH_YEAR = new RegExp(`\\b(${MONTH_NAMES})\\s+(\\d{4})\\b`, 'i')

/** «Für eine starke Jugend, Oktober 2026» – die Überschrift des Hefts. */
const ISSUE = new RegExp(`^Für eine starke Jugend\\s*,\\s*(${MONTH_NAMES})\\s+(\\d{4})\\b`, 'i')

function clean(text: string): string {
  return (
    text
      .replace(/\r\n?/g, '\n')
      // Geschützte Leerzeichen kommen beim Kopieren aus dem Browser häufig mit.
      .replace(/[\u00a0\u202f]/g, ' ')
  )
}

/** «„Für eine starke Jugend“» – Anführungszeichen bleiben, Leerraum nicht. */
function tidy(title: string): string {
  return title.replace(/\s+/g, ' ').trim()
}

/**
 * Aus «2. Erfahre mehr über …» wird «Erfahre mehr über …».
 *
 * Die Nummer sagt, der wievielte Sonntag gemeint ist – und das steht im
 * Plan schon im Datum. Als Titel eines Termins wäre sie eine Dopplung, die
 * beim ersten Verschieben falsch würde.
 */
function stripNumber(title: string): string {
  return tidy(title).replace(NUMBERED, '$2')
}

function monthNumber(name: string): number {
  return MONTHS.indexOf(name.toLowerCase()) + 1
}

/** «2026-10» */
function isoMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

/** Wohin ein Verweis auf eine Lektion führt. */
interface LessonLink {
  /** Das Heft, in dem sie steht – «2026-10» */
  issue: string
  /** «00» der Einstieg, «01» bis «04» die Lektionen, «05» die Aktivitäten */
  step: string
  /** Beim vierten Sonntag «a» für die Jungen Damen, «b» für die Kollegien */
  variant: string
}

/**
 * Ein Eintrag der Seite – eine Zeile oder ein Verweis.
 *
 * Kommen die Verweise mit, stehen auf einer Zeile manchmal mehrere; jeder
 * ist dann ein eigener Eintrag.
 */
interface Entry {
  text: string
  /** Ein Verweis – auf eine Lektion oder anderswohin */
  linked: boolean
  /** Die Lektion, auf die er verweist, sonst `null` */
  lesson: LessonLink | null
}

function lessonLink(url: string): LessonLink | null {
  const match = url.match(LESSON_URL)
  if (!match) return null
  if (!match[3] && !LESSON_NAME.test(match[6] ?? '')) return null

  return {
    issue: `${match[1]}-${match[2]}`,
    step: match[4],
    variant: (match[5] ?? '').toLowerCase(),
  }
}

function entriesOf(text: string): Entry[] {
  const entries: Entry[] = []

  for (const line of text.split('\n')) {
    const links = [...line.matchAll(LINK)]
    if (links.length === 0) {
      const plain = tidy(line.replace(BULLET, ''))
      if (plain) entries.push({ text: plain, linked: false, lesson: null })
      continue
    }
    for (const link of links) {
      const label = tidy(link[1])
      if (label) entries.push({ text: label, linked: true, lesson: lessonLink(link[2]) })
    }
  }

  return entries
}

/** Ein Monat der Seite – seine Überschrift und was darunter steht. */
interface Section {
  /** Der Monat aus der Überschrift, 1 bis 12 – `null`, wenn sie keinen nennt */
  month: number | null
  entries: Entry[]
  /** Keine Überschrift gefunden: die ganze Seite als ein Abschnitt */
  implicit: boolean
}

/**
 * Die Seite in ihre Monate zerlegen.
 *
 * Ein Abschnitt beginnt mit seiner Überschrift und endet vor der nächsten,
 * vor der Überschrift des Hefts – sie steht zwischen dem Inhaltsverzeichnis
 * und den Artikeln – oder vor einem Verweis, der nicht zu einer Lektion
 * führt. Menü, Artikel und Fusszeile bleiben so draussen.
 *
 * Findet sich gar keine Überschrift, gilt die ganze Seite als ein Abschnitt
 * – der Weg für Ausschnitte, die erst unterhalb der Überschrift beginnen.
 */
function sectionsOf(entries: Entry[]): Section[] {
  const sections: Section[] = []
  let current: Section | null = null

  for (const entry of entries) {
    if (!entry.lesson && SECTION.test(entry.text)) {
      const name = entry.text.match(MONTH_NAME)
      current = { month: name ? monthNumber(name[1]) : null, entries: [], implicit: false }
      sections.push(current)
    } else if (ISSUE.test(entry.text) || (entry.linked && !entry.lesson)) {
      current = null
    } else {
      current?.entries.push(entry)
    }
  }

  return sections.length > 0 ? sections : [{ month: null, entries, implicit: true }]
}

/**
 * Das Heft, aus dem die Verweise stammen.
 *
 * Eine Seite kann auch auf Nachbarhefte verweisen – das Archiv, der
 * Hinweis auf das nächste Heft. Es gilt das mit den meisten Verweisen; bei
 * Gleichstand das frühere, damit dasselbe Einfügen immer dasselbe ergibt.
 */
function issueOfLinks(entries: Entry[]): string | null {
  const counts = new Map<string, number>()
  for (const { lesson } of entries) {
    if (lesson) counts.set(lesson.issue, (counts.get(lesson.issue) ?? 0) + 1)
  }

  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  return ranked[0]?.[0] ?? null
}

/** Das Heft – aus seiner Überschrift, den Verweisen oder einer Monatsangabe. */
function issueOfPage(entries: Entry[]): string | null {
  for (const { text } of entries) {
    const match = text.match(ISSUE)
    if (match) return isoMonth(Number(match[2]), monthNumber(match[1]))
  }

  const fromLinks = issueOfLinks(entries)
  if (fromLinks) return fromLinks

  for (const { text } of entries) {
    const match = text.match(MONTH_YEAR)
    if (match) return isoMonth(Number(match[2]), monthNumber(match[1]))
  }
  return null
}

/**
 * Der Monat im Jahr, das dem Heft am nächsten liegt.
 *
 * Die Überschrift nennt nur den Monat. Ein Oktoberheft meint mit «November»
 * den folgenden, ein Dezemberheft mit «Januar» den im neuen Jahr.
 */
function nearestMonth(month: number, issue: string): string {
  const [year, issueMonth] = issue.split('-').map(Number)
  const offset = month - issueMonth
  return isoMonth(offset < -6 ? year + 1 : offset > 6 ? year - 1 : year, month)
}

/** Die Einträge vor der ersten Lektion – Rubrik, Thema, Beschreibung. */
function headOf(entries: Entry[]): Entry[] {
  const end = entries.findIndex(
    (entry) => NUMBERED.test(entry.text) || (entry.lesson !== null && entry.lesson.step !== '00'),
  )
  return end < 0 ? entries : entries.slice(0, end)
}

/** Nur der Monat oder eine Beschreibung mit Monat und Jahr – nie das Thema. */
function isMonthLabel(text: string): boolean {
  return MONTH_ONLY.test(text) || MONTH_YEAR.test(text)
}

/**
 * Der Monat eines Abschnitts – «2026-11».
 *
 * Den Monat nennt die Überschrift oder die Rubrik darunter, das Jahr die
 * Beschreibung des Einstiegs («…, November 2026») oder sonst das Heft.
 * Nennt der Abschnitt gar keinen Monat, gilt der aus der Beschreibung, aus
 * den Adressen seiner Lektionen oder der des Hefts.
 */
function monthOfSection(section: Section, page: string | null): string | null {
  const head = headOf(section.entries)
  const rubric = head.find((entry) => MONTH_ONLY.test(entry.text))?.text.match(MONTH_NAME)
  const name = section.month ?? (rubric ? monthNumber(rubric[1]) : null)
  const mention = head.map((entry) => entry.text.match(MONTH_YEAR)).find(Boolean)
  const issue = issueOfLinks(section.entries) ?? page

  if (name) {
    if (mention && monthNumber(mention[1]) === name) return isoMonth(Number(mention[2]), name)
    return issue ? nearestMonth(name, issue) : null
  }
  if (mention) return isoMonth(Number(mention[2]), monthNumber(mention[1]))
  return issue
}

/**
 * Das Thema des Monats.
 *
 * Der erste Eintrag unter der Überschrift, der weder der Monatsname noch
 * eine Beschreibung ist. Verweist er auf den Einstieg (`00-intro`), ist er
 * es sicher; folgt ihm dagegen gleich eine Lektion, ist er deren Rubrik,
 * und das Thema fehlt.
 */
function introOf(entries: Entry[]): string {
  for (const [index, entry] of entries.entries()) {
    if (NUMBERED.test(entry.text)) break
    if (isMonthLabel(entry.text)) continue
    if (entry.lesson) return entry.lesson.step === '00' ? entry.text : ''

    const next = entries[index + 1]
    return next && NUMBERED.test(next.text) ? '' : entry.text
  }
  return ''
}

/** Eine Fundstelle für eine Lektion – und wie sicher sie ist. */
interface Candidate {
  text: string
  /** 1 nur die Rubrik, 2 der Titel, 3 der Titel und sicher der der Kollegien */
  rank: number
}

/**
 * Die Lektionen eines Abschnitts.
 *
 * Es gilt der Eintrag mit der Nummer – das ist der Titel. Rubrik und
 * Beschreibung zählen nicht; nur wo der Titel ganz fehlt, nimmt der Import
 * die Rubrik, sofern ihr Verweis sie als Lektion ausweist: besser als gar
 * nichts.
 *
 * Bei der Vier fällt die Fassung der Jungen Damen weg. Die der Kollegien
 * gilt, sobald sie als solche erkannt ist; sonst die letzte Vier, denn auf
 * der Seite steht die der Jungen Damen zuerst.
 */
function lessonsOf(entries: Entry[]): Map<ApLessonSlot, Candidate> {
  const found = new Map<ApLessonSlot, Candidate>()
  let rubric = ''

  for (const entry of entries) {
    const numbered = entry.text.match(NUMBERED)

    if (!numbered) {
      const slot = entry.lesson ? SLOT_OF_STEP[entry.lesson.step] : undefined
      const youngWomen = slot === 'fourth' && entry.lesson?.variant === 'a'
      if (slot && !youngWomen && !found.has(slot)) found.set(slot, { text: entry.text, rank: 1 })
      rubric = entry.text
      continue
    }

    const slot = AP_LESSON_SLOTS[Number(numbered[1]) - 1]
    const current = found.get(slot)
    let rank = 2

    if (slot === 'fourth') {
      if (entry.lesson?.variant === 'a' || YOUNG_WOMEN.test(rubric)) continue
      if (entry.lesson?.variant === 'b' || QUORUMS.test(rubric)) rank = 3
    }

    // Der Titel gilt vor der Rubrik; unter Gleichen der erste – ausser bei
    // einer Vier, die nicht sicher den Kollegien gehört: Da gilt die letzte.
    const replaces =
      !current || rank > current.rank || (slot === 'fourth' && rank === 2 && current.rank === 2)
    if (replaces) found.set(slot, { text: entry.text, rank })
  }

  return found
}

/** Was ein Abschnitt zu seinem Monat beiträgt. */
interface SectionResult {
  month: string
  intro: string
  lessons: Map<ApLessonSlot, Candidate>
}

function readSection(section: Section, page: string | null): SectionResult | null {
  if (!section.implicit) {
    const month = monthOfSection(section, page)
    if (!month) return null
    return { month, intro: introOf(section.entries), lessons: lessonsOf(section.entries) }
  }

  // Ohne Überschrift: die Verweise des Hefts, das am häufigsten vorkommt –
  // oder, wenn keine mitgekommen sind, alle Zeilen.
  const month = issueOfLinks(section.entries) ?? page
  if (!month) return null

  const linked = section.entries.filter((entry) => entry.lesson?.issue === month)
  const entries = linked.length > 0 ? linked : section.entries
  const intro = entries.find((entry) => entry.lesson?.step === '00' && !isMonthLabel(entry.text))

  return { month, intro: intro?.text ?? '', lessons: lessonsOf(entries) }
}

/**
 * Eine eingefügte Seite lesen.
 *
 * Zurück kommt jeder Monat, für den sich mindestens eine Lektion fand, in
 * der Reihenfolge des Kalenders. Inhaltsverzeichnis und Sammlung nennen
 * denselben Monat zweimal; beides fliesst zusammen. Eine leere Liste
 * heisst: Es wurde etwas anderes eingefügt, und die Oberfläche sagt es.
 */
export function parsePastedApTopics(text: string): ParsedApTopics[] {
  const entries = entriesOf(clean(text))
  const page = issueOfPage(entries)
  const months = new Map<string, { intro: string; lessons: Map<ApLessonSlot, Candidate> }>()

  for (const section of sectionsOf(entries)) {
    const result = readSection(section, page)
    if (!result) continue

    const known = months.get(result.month) ?? { intro: '', lessons: new Map() }
    known.intro ||= result.intro
    for (const [slot, candidate] of result.lessons) {
      const current = known.lessons.get(slot)
      if (!current || candidate.rank > current.rank) known.lessons.set(slot, candidate)
    }
    months.set(result.month, known)
  }

  return [...months.entries()]
    .map(([month, known]) => ({
      month,
      intro: tidy(known.intro),
      lessons: AP_LESSON_SLOTS.filter((slot) => known.lessons.has(slot)).map((slot) => ({
        slot,
        topic: stripNumber(known.lessons.get(slot)?.text ?? ''),
      })),
    }))
    .filter((month) => month.lessons.length > 0)
    .sort((a, b) => a.month.localeCompare(b.month))
}

/* ------------------------------------------------------------------ */
/* Der Titel der Klasse                                                */
/* ------------------------------------------------------------------ */

/**
 * «Befasse dich mit dem Kapitel aus dem Wegweiser „Für eine starke Jugend“»
 * – so heisst die Lektion am Fastsonntag jeden Monat.
 */
const GUIDE_CHAPTER = /^Befasse dich mit dem (Kapitel\b.*)$/

/**
 * Der Titel einer Klasse: **erst das Thema des Monats, dann das der
 * Woche** – «Dein Körper ist heilig – Erfahre mehr über das Wort der
 * Weisheit».
 *
 * Das Monatsthema vorn hält die vier Sonntage eines Monats im Plan
 * sichtbar zusammen. Von der Lektion am Fastsonntag bleibt nur, worum es
 * geht: «Kapitel aus dem Wegweiser „Für eine starke Jugend“» – die
 * Aufforderung davor ist jeden Monat dieselbe.
 *
 * Fehlt das Monatsthema, steht die Lektion allein da; fehlt die Lektion,
 * bleibt der Titel leer – «Thema noch offen».
 */
export function apClassTitle(intro: string, topic: string): string {
  const week = tidy(topic).replace(GUIDE_CHAPTER, '$1')
  if (!week) return ''
  const month = tidy(intro)
  return month ? `${month} – ${week}` : week
}

/* ------------------------------------------------------------------ */
/* Auf die Sonntage verteilen                                          */
/* ------------------------------------------------------------------ */

export interface ApTopicRow {
  /** «2026-10-11» */
  date: string
  /** Welche Lektion – `null`, wenn für diesen Sonntag keine vorgesehen ist */
  slot: ApLessonSlot | null
  /** Der Titel der Klasse (siehe `apClassTitle`), oder leer: «Thema noch offen» */
  title: string
}

/**
 * Welche Lektion an welchem Sonntag.
 *
 * Gezählt wird vom Monatsanfang her: Der erste Sonntag bekommt die erste
 * Lektion, der zweite die zweite und so weiter bis zur vierten. **Ein
 * fünfter Sonntag bleibt frei** – die Kirche gibt für ihn nichts heraus,
 * und «Thema noch offen» ist ehrlicher als ein Thema, das jemand eine Woche
 * zu früh oder zu spät behandelt.
 *
 * Das Heft nennt die vierte Lektion «Letzter Sonntag», die Adresse dagegen
 * `04-fourth-sunday`. In vier von fünf Monaten ist das dasselbe; wo es das
 * nicht ist, folgt der Plan der Zählung und nicht dem Wort – so bleiben die
 * vier Lektionen in der Reihenfolge beieinander, in der sie aufeinander
 * aufbauen, und die Lücke fällt ans Monatsende.
 *
 * Zurück kommen nur die Sonntage, an denen tatsächlich Klasse ist – bis
 * August 2026 also der 2. und der 4., danach alle ausser dem Sonntag der
 * Generalkonferenz.
 */
export function apTopicRows(parsed: ParsedApTopics): ApTopicRow[] {
  const sundays = sundaysOfMonth(parsed.month)
  const topics = new Map(parsed.lessons.map((lesson) => [lesson.slot, lesson.topic]))

  const slotOfDate = new Map<string, ApLessonSlot>()
  AP_LESSON_SLOTS.forEach((slot, index) => {
    const date = sundays[index]
    if (date) slotOfDate.set(date, slot)
  })

  return apClassSundays(parsed.month).map((date) => {
    const slot = slotOfDate.get(date) ?? null
    return { date, slot, title: apClassTitle(parsed.intro, (slot && topics.get(slot)) || '') }
  })
}

export interface ApLessonWithoutClass {
  slot: ApLessonSlot
  /** Der Sonntag, auf den die Lektion fiele – «2026-10-04» */
  date: string
  /** An diesem Sonntag ist Generalkonferenz – sonst war damals keine Klasse */
  conference: boolean
}

/**
 * Die Lektionen, die auf einen Sonntag ohne Klasse fallen.
 *
 * Im April und im Oktober ist der erste Sonntag Generalkonferenz, bis
 * August 2026 war die Klasse nur am 2. und 4. Sonntag. Die Vorschau nennt
 * diese Lektionen, damit niemand eine sucht, die nicht übernommen wurde.
 */
export function apLessonsWithoutClass(parsed: ParsedApTopics): ApLessonWithoutClass[] {
  const sundays = sundaysOfMonth(parsed.month)
  const classes = new Set(apClassSundays(parsed.month))

  return parsed.lessons.flatMap((lesson) => {
    const date = sundays[AP_LESSON_SLOTS.indexOf(lesson.slot)]
    if (!date || classes.has(date)) return []
    return [{ slot: lesson.slot, date, conference: isGeneralConferenceSunday(date) }]
  })
}
