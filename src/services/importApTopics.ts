// Mit Dateiendung, damit sich das Modul auch ohne Bundler ausführen lässt
// (`node --test`). Vite und TypeScript lösen das genauso auf.
import { apClassSundays, sundaysOfMonth } from './apSchedule.ts'

/**
 * Die Themen der AP-Klasse aus **«Für eine starke Jugend»** einlesen.
 *
 * Seit dem Wechsel auf die wöchentliche Klasse sind die Themen nicht mehr
 * frei: Die Kirche gibt für jeden Monat vier Lektionen heraus – eine für
 * den Fastsonntag und je eine für den zweiten, dritten und vierten Sonntag.
 * Sie stehen als Seite im Netz, herunterladen lässt sich nichts, kopieren
 * schon. Genau das liest dieser Import.
 *
 * **Die Adresse ist der Schlüssel, nicht der Text.** Beim Kopieren aus dem
 * Browser kommen die Verweise mit:
 *
 *     * [Zweiter Sonntag](…/ftsoy/2026/09/fsy-lessons/02-second-sunday?lang=deu)
 *     [2. Erfahre mehr über die Wiederherstellung des Priestertums](…/02-second-sunday…)
 *     [Studienhilfen für den zweiten Sonntag im September](…/02-second-sunday…)
 *
 * Drei Zeilen, dieselbe Lektion – Rubrik, Titel, Beschreibung. Woran der
 * Titel zu erkennen ist: Er beginnt mit der Nummer der Lektion. Und woran
 * die Lektion selbst: an der Ziffer im letzten Stück der Adresse. Die ist
 * über die Monate hinweg gleich gebaut und braucht kein Deutsch – anders
 * als die Rubriken, die von Monat zu Monat anders heissen können.
 *
 * **Der vierte Sonntag steht zweimal da**, einmal für die Jungen Damen
 * (`04a`) und einmal für die Kollegien des Aaronischen Priestertums
 * (`04b`). Der Plan hier ist der der Kollegien, also gilt `04b`. Fehlt der
 * Buchstabe – manche Monate teilen die Lektion nicht –, gilt sie für beide.
 *
 * Kommt eine Seite ohne Verweise an – je nach Browser kopiert sich nur der
 * blosse Text –, bleibt der zweite Weg: die Zeilen, die mit «1.» bis «4.»
 * beginnen. Bei der Vier gilt dann die **letzte**, denn auf der Seite steht
 * erst die Lektion der Jungen Damen und danach die der Kollegien.
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

export interface ParsedApTopics {
  /** «2026-09» */
  month: string
  /** Das Monatsthema – «Durch Priestertumsschlüssel und -vollmacht wirst du gesegnet» */
  intro: string
  lessons: ParsedApLesson[]
}

/* ------------------------------------------------------------------ */
/* Die Seite lesen                                                     */
/* ------------------------------------------------------------------ */

/** Markdown-Verweis: `[Titel](Adresse)`. */
const LINK = /\[([^\]]*)\]\(([^)]*)\)/g

/** `…/ftsoy/2026/09/fsy-lessons/02-second-sunday?lang=deu` */
const LESSON_URL = /\/ftsoy\/(\d{4})\/(\d{2})\/fsy-lessons\/(\d{2})([a-z])?/i

/** «2. Erfahre mehr über …» – die Nummer gehört zur Lektion, nicht zum Thema. */
const NUMBERED = /^([1-4])\.\s+(.*\S)/

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

interface FoundLink {
  text: string
  month: string
  step: string
  variant: string
}

function findLinks(text: string): FoundLink[] {
  const found: FoundLink[] = []

  for (const match of text.matchAll(LINK)) {
    const url = match[2].match(LESSON_URL)
    if (!url) continue
    found.push({
      text: tidy(match[1]),
      month: `${url[1]}-${url[2]}`,
      step: url[3],
      variant: (url[4] ?? '').toLowerCase(),
    })
  }

  return found
}

/**
 * Der Monat, um den es geht.
 *
 * Eine Seite kann Verweise auf Nachbarmonate tragen – das Archiv, der
 * Hinweis auf das nächste Heft. Es gilt der Monat mit den meisten
 * Lektionen; bei Gleichstand der frühere, damit dasselbe Einfügen immer
 * dasselbe ergibt.
 */
function mainMonth(links: FoundLink[]): string {
  const counts = new Map<string, number>()
  for (const link of links) counts.set(link.month, (counts.get(link.month) ?? 0) + 1)

  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0]
}

/** Der Monat aus der Überschrift – «Für eine starke Jugend, September 2026». */
function monthFromHeading(text: string): string {
  const match = text.match(new RegExp(`\\b(${MONTHS.join('|')})\\s+(\\d{4})\\b`, 'i'))
  if (!match) return ''

  const index = MONTHS.indexOf(match[1].toLowerCase())
  return `${match[2]}-${String(index + 1).padStart(2, '0')}`
}

/**
 * Die Lektionen aus den Verweisen.
 *
 * Je Lektion stehen mehrere Verweise auf der Seite. Es gilt der, der mit
 * der Nummer beginnt – das ist der Titel. Findet sich keiner, nimmt der
 * Import den ersten: besser die Rubrik als gar nichts.
 */
function lessonsFromLinks(links: FoundLink[]): ParsedApLesson[] {
  const best = new Map<ApLessonSlot, { text: string; numbered: boolean }>()

  for (const link of links) {
    const slot = SLOT_OF_STEP[link.step]
    if (!slot || !link.text) continue
    // Der vierte Sonntag: «a» ist die Lektion der Jungen Damen.
    if (link.step === '04' && link.variant === 'a') continue

    const numbered = NUMBERED.test(link.text)
    const current = best.get(slot)
    // Der nummerierte Titel gilt vor der Rubrik; unter Gleichen der erste.
    if (!current || (numbered && !current.numbered)) best.set(slot, { text: link.text, numbered })
  }

  return AP_LESSON_SLOTS.filter((slot) => best.has(slot)).map((slot) => ({
    slot,
    topic: stripNumber(best.get(slot)?.text ?? ''),
  }))
}

/**
 * Der zweite Weg: die blosse Textfassung.
 *
 * Gesucht sind Zeilen, die mit «1.» bis «4.» beginnen. Bei der Vier gilt
 * die letzte – auf der Seite steht erst die Lektion der Jungen Damen und
 * danach die der Kollegien des Aaronischen Priestertums.
 */
function lessonsFromText(text: string): ParsedApLesson[] {
  const byNumber = new Map<string, string>()

  for (const line of text.split('\n')) {
    const match = tidy(line).match(NUMBERED)
    if (!match) continue
    // Nur die erste Nennung – ausser bei der Vier, wo die zweite gilt.
    if (match[1] === '4' || !byNumber.has(match[1])) byNumber.set(match[1], match[2])
  }

  return AP_LESSON_SLOTS.map((slot, index) => ({
    slot,
    topic: tidy(byNumber.get(String(index + 1)) ?? ''),
  })).filter((lesson) => lesson.topic)
}

/** Das Monatsthema – der erste Verweis auf den Einstieg («00-intro»). */
function introFromLinks(links: FoundLink[], month: string): string {
  const intro = links.find((link) => link.month === month && link.step === '00')
  return intro ? tidy(intro.text) : ''
}

/**
 * Eine eingefügte Seite lesen.
 *
 * `null`, wenn sich weder ein Monat noch eine Lektion erkennen lässt – dann
 * wurde etwas anderes eingefügt, und die Oberfläche sagt es.
 */
export function parsePastedApTopics(text: string): ParsedApTopics | null {
  const source = clean(text)
  const links = findLinks(source)

  const month = links.length > 0 ? mainMonth(links) : monthFromHeading(source)
  if (!month) return null

  const ofMonth = links.filter((link) => link.month === month)
  const lessons = ofMonth.length > 0 ? lessonsFromLinks(ofMonth) : lessonsFromText(source)
  if (lessons.length === 0) return null

  return { month, intro: introFromLinks(links, month), lessons }
}

/* ------------------------------------------------------------------ */
/* Auf die Sonntage verteilen                                          */
/* ------------------------------------------------------------------ */

export interface ApTopicRow {
  /** «2026-09-06» */
  date: string
  /** Welche Lektion – `null`, wenn für diesen Sonntag keine vorgesehen ist */
  slot: ApLessonSlot | null
  /** Das Thema, oder leer: «Thema noch offen» */
  topic: string
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
 * August 2026 also der 2. und der 4., danach alle.
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
    return { date, slot, topic: (slot && topics.get(slot)) || '' }
  })
}
