import type { DocxBlock } from './docx.ts'

/**
 * Die bisherigen Protokolle lesen.
 *
 * Das Dokument, das die Bischofschaft bis jetzt geführt hat, ist eine
 * lange Reihe von Tabellen – die neuste zuoberst. Jede Tabelle ist eine
 * Sitzung: In der ersten Zeile steht das Datum, darunter je Zeile ein
 * Traktandum, daneben «Wer» und «Bis». Dazwischen steht eine einzige
 * Tabelle «Offene Pendenzen»; das ist der Korb, in dem alles landet, was
 * offen geblieben ist.
 *
 * Hier steht nur das Lesen – ohne Firestore, damit es sich prüfen lässt
 * (`tests/import-minutes.test.ts`). Geschrieben wird in
 * `services/importMinutes`.
 */

export interface ParsedMinutesItem {
  title: string
  description: string
}

export interface ParsedMinutesMeeting {
  /** Erster Tag als «2025-07-31» */
  date: string
  /** Die Kopfzeile, wie sie in der Datei steht */
  label: string
  items: ParsedMinutesItem[]
  /** Aus wie vielen Tabellen zusammengesetzt – mehr als eine heisst: Dublette in der Datei */
  tables: number
}

export interface ParsedMinutes {
  /** Sitzungen in der Reihenfolge der Datei – die neuste zuoberst */
  meetings: ParsedMinutesMeeting[]
  pending: ParsedMinutesItem[]
  /** Tabellen ohne lesbares Datum; sie werden nicht übernommen */
  skipped: { label: string; items: number }[]
}

/** Ab hier ist der Titel zu lang für eine Zeile und wandert ganz in die Beschreibung. */
const TITLE_LIMIT = 120

const DATE_PATTERN = /(\d{1,2})\.\s*(\d{1,2})\.(?:\s*(\d{2,4}))?/

const PENDING_PATTERN = /offene\s+pendenzen/i

function pad(value: number): string {
  return value.toString().padStart(2, '0')
}

/**
 * Das Datum aus einer Kopfzeile – «Traktanden, 31.07.2025».
 *
 * Manche Kopfzeilen nennen kein Jahr («Traktanden 08.06.»). Weil das
 * Dokument von der neusten Sitzung abwärts geschrieben ist, ergibt es sich
 * aus der Sitzung darüber: dasselbe Jahr, und wenn das Datum damit später
 * läge als die vorige Sitzung, das Jahr davor.
 */
export function parseMinutesDate(text: string, previous: string | null): string | null {
  const match = DATE_PATTERN.exec(text)
  if (!match) return null

  const day = Number.parseInt(match[1], 10)
  const month = Number.parseInt(match[2], 10)
  if (day < 1 || day > 31 || month < 1 || month > 12) return null

  const written = match[3]
  if (written) {
    const year =
      written.length <= 2 ? 2000 + Number.parseInt(written, 10) : Number.parseInt(written, 10)
    return `${year}-${pad(month)}-${pad(day)}`
  }

  if (!previous) return null
  const year = Number.parseInt(previous.slice(0, 4), 10)
  const candidate = `${year}-${pad(month)}-${pad(day)}`
  return candidate > previous ? `${year - 1}-${pad(month)}-${pad(day)}` : candidate
}

/** «Josh\nKevin\nAlain» wird zu «Josh, Kevin, Alain». */
function joinNames(text: string): string {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(', ')
}

/**
 * Aus einer Tabellenzeile ein Traktandum machen.
 *
 * Die erste Zeile der Zelle ist der Titel, alles Weitere die Beschreibung –
 * so ist es geschrieben worden, und so liest es sich auch in der App. Ist
 * die erste Zeile schon ein ganzer Absatz, bleibt der Text vollständig in
 * der Beschreibung und der Titel wird gekürzt: Ein Traktandum, dessen
 * Titel drei Zeilen füllt, macht jede Liste unlesbar.
 *
 * «Wer» und «Bis» haben in der App keine Entsprechung als Freitext – die
 * Zuständigen sind dort Konten. Beides bleibt deshalb als Zeile in der
 * Beschreibung stehen, statt verloren zu gehen.
 */
export function minutesItem(cell: string, who = '', due = ''): ParsedMinutesItem | null {
  const lines = cell.split('\n').map((line) => line.trimEnd())
  while (lines.length > 0 && !lines[0].trim()) lines.shift()
  while (lines.length > 0 && !lines[lines.length - 1].trim()) lines.pop()
  if (lines.length === 0) return null

  const first = lines[0].trim()
  const long = first.length > TITLE_LIMIT
  const title = (long ? `${first.slice(0, TITLE_LIMIT - 1).trimEnd()}…` : first).replace(/:$/, '')

  const body = (long ? lines : lines.slice(1)).join('\n').trim()
  const description = [
    body,
    joinNames(who) && `Wer: ${joinNames(who)}`,
    joinNames(due) && `Bis: ${joinNames(due)}`,
  ]
    .filter(Boolean)
    .join('\n\n')

  return { title, description }
}

function itemsOf(rows: string[][]): ParsedMinutesItem[] {
  const items: ParsedMinutesItem[] = []
  // Die erste Zeile ist die Kopfzeile («Traktanden, … | Wer | Bis»).
  for (const row of rows.slice(1)) {
    const item = minutesItem(row[0] ?? '', row[1] ?? '', row[2] ?? '')
    if (item) items.push(item)
  }
  return items
}

/**
 * Zwei Tabellen zum selben Datum zusammenlegen.
 *
 * Im Dokument steht dieselbe Sitzung mitunter zweimal – einmal als
 * Zwischenstand, einmal fertig. Zwei Sitzungen am selben Tag wären falsch,
 * und die Zeilen einfach aneinanderzuhängen ergäbe Doppel. Deshalb: gleiche
 * Titel gelten als dieselbe Sache, und es bleibt die ausführlichere Fassung.
 */
function mergeItems(into: ParsedMinutesItem[], extra: ParsedMinutesItem[]): ParsedMinutesItem[] {
  const result = [...into]
  for (const item of extra) {
    const key = item.title.toLowerCase()
    const index = result.findIndex((existing) => existing.title.toLowerCase() === key)
    if (index === -1) result.push(item)
    else if (item.description.length > result[index].description.length) result[index] = item
  }
  return result
}

export function parseMinutes(blocks: DocxBlock[]): ParsedMinutes {
  const meetings: ParsedMinutesMeeting[] = []
  const byDate = new Map<string, ParsedMinutesMeeting>()
  const pending: ParsedMinutesItem[] = []
  const skipped: { label: string; items: number }[] = []
  let previous: string | null = null

  for (const block of blocks) {
    if (block.type !== 'table' || block.rows.length < 2) continue
    const label = (block.rows[0][0] ?? '').replace(/\s+/g, ' ').trim()

    if (PENDING_PATTERN.test(label)) {
      pending.push(...itemsOf(block.rows))
      continue
    }

    const date = parseMinutesDate(label, previous)
    if (!date) {
      const items = itemsOf(block.rows).length
      if (items > 0 || label) skipped.push({ label, items })
      continue
    }
    previous = date

    const existing = byDate.get(date)
    if (existing) {
      existing.items = mergeItems(existing.items, itemsOf(block.rows))
      existing.tables += 1
      continue
    }

    const meeting: ParsedMinutesMeeting = {
      date,
      label,
      items: itemsOf(block.rows),
      tables: 1,
    }
    byDate.set(date, meeting)
    meetings.push(meeting)
  }

  return { meetings, pending, skipped }
}
