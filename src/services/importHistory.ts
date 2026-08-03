// Mit Dateiendung, damit sich der Parser auch ohne Bundler ausführen lässt
// (`node --test`). Vite und TypeScript lösen das genauso auf.
import { parseMonthName } from './importPaste.ts'

/**
 * Den Verlauf von Ansprachen und Gebeten aus der bisherigen Excel-Tabelle
 * einlesen.
 *
 * Vor dieser App wurde mitgeschrieben, wer wann gesprochen und gebetet hat –
 * ein Blatt pro Jahr, eine Zeile pro Person, zwei Spalten pro Monat:
 *
 *                 Jan.        Feb.        März
 *                 A     G     A     G     A     G
 *     Muster  Hans  m         14                7
 *     Beispiel Anna w   3           21
 *
 * «A» steht für Ansprache, «G» für Gebet, der Wert ist der Tag im Monat;
 * das Jahr steht im Blattnamen. Zusammen ergibt das den Sonntag.
 *
 * Der Aufbau ist über die Jahre gewachsen und nicht überall streng: Hinter
 * dem Tag stehen Vermerke («28 K» für die Kinderansprache), gelegentlich
 * zwei Termine in einer Zelle («10, 31»), und wo niemand mehr weiterwusste,
 * steht Prosa. Der Parser liest, was sich sicher lesen lässt, und meldet den
 * Rest, statt zu raten – 78 von rund 1700 Zellen sind Handnotizen, und die
 * gehören von Hand angeschaut.
 *
 * Bewusst ohne Abhängigkeiten zur Firestore-Schicht, damit sich der Parser
 * mit `node --test` direkt ausführen lässt.
 */

/* ------------------------------------------------------------------ */
/* Eingabe                                                             */
/* ------------------------------------------------------------------ */

/** Eine Zelle, wie sie `read-excel-file` liefert. */
export type SheetCell = string | number | boolean | Date | null

export interface RawSheet {
  /** Blattname – daraus stammt das Jahr */
  sheet: string
  data: SheetCell[][]
}

export type HistoryKind = 'talk' | 'prayer'

/**
 * Was die Zahl in der Zelle bedeutet.
 *
 * Die Tabelle hat die Zählweise unterwegs gewechselt: Bis 2018 stand dort
 * der wievielte Sonntag des Monats es war – daher die Beschriftung «x-ter
 * Sonntag im entspr. Monat», die bis heute im Kopf steht. Ab 2019 steht der
 * Tag selbst.
 */
export type Counting = 'sunday' | 'day'

/** Was aus einem Jahresblatt gelesen wurde. */
export interface SheetSummary {
  sheet: string
  year: number
  counting: Counting
  entries: number
}

export interface HistoryEntry {
  /** «Nachname, Vorname» – dieselbe Schreibweise wie beim LCR-Abgleich */
  fullName: string
  kind: HistoryKind
  year: number
  /** 1–12 */
  month: number
  day: number
  /** Vermerk aus der Zelle, z. B. «Kinderansprache» */
  note: string
}

/** Eine Zelle, aus der sich kein Datum lesen liess. */
export interface UnreadCell {
  sheet: string
  fullName: string
  /** Monatsspalte, wie sie im Blatt steht */
  column: string
  kind: HistoryKind
  text: string
}

export interface ParsedHistory {
  entries: HistoryEntry[]
  unread: UnreadCell[]
  /** Ein Eintrag je gelesenem Blatt – auch die Zählweise steht hier */
  sheets: SheetSummary[]
  /**
   * Zeilen ohne Vornamen. In der Tabelle stehen dort Rollen statt Personen –
   * «Besucher», «Pfahlpräsident», «Missionspräs.». Sie gehören keinem
   * Gemeindemitglied und würden über den Nachnamen allein sonst noch
   * falsch zugeordnet.
   */
  ignoredRows: string[]
  /** Gelesene Jahre, aufsteigend */
  years: number[]
  /** Blätter ohne Jahreszahl im Namen oder ohne erkennbaren Aufbau */
  skippedSheets: string[]
}

/* ------------------------------------------------------------------ */
/* Zellen lesen                                                        */
/* ------------------------------------------------------------------ */

function text(cell: SheetCell | undefined): string {
  if (cell === null || cell === undefined) return ''
  if (cell instanceof Date) return cell.toISOString().slice(0, 10)
  return String(cell).trim()
}

/**
 * Nachnamen mit Haushaltsnummer entschärfen: «Lauener (2)» → «Lauener».
 *
 * In der Tabelle unterscheiden solche Zusätze die Haushalte einer grossen
 * Familie. Für den Abgleich stören sie nur – der Vorname genügt dort zur
 * Unterscheidung.
 */
function cleanLastName(value: string): string {
  return value.replace(/\s*\([^)]*\)\s*$/, '').trim()
}

/** Gibt es diesen Tag im Monat wirklich? «31. Februar» soll nicht durchrutschen. */
function isRealDate(year: number, month: number, day: number): boolean {
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

/**
 * Der wievielte Sonntag – als Tag im Monat. `null`, wenn es ihn nicht gibt:
 * Ein sechster Sonntag kommt in keinem Monat vor, ein fünfter nicht in jedem.
 */
function nthSundayOfMonth(year: number, month: number, nth: number): number | null {
  if (nth < 1 || nth > 5) return null
  const first = new Date(year, month - 1, 1)
  const day = 1 + ((7 - first.getDay()) % 7) + (nth - 1) * 7
  return isRealDate(year, month, day) ? day : null
}

/**
 * Liest die Tage aus einer Zelle.
 *
 * Zahlen sind der Normalfall. Text wird nur gelesen, wenn er wie ein Datum
 * aussieht: «28 K», «10, 31», «2+3». Sobald drei Ziffern am Stück
 * vorkommen, ist es keine Tagesangabe mehr, sondern eine Jahreszahl in einer
 * Bemerkung – «keine Ansprache im 2020??» darf nicht als «20.» enden.
 */
function readDays(cell: SheetCell): number[] {
  if (typeof cell === 'number') {
    return Number.isInteger(cell) && cell >= 1 && cell <= 31 ? [cell] : []
  }
  if (cell instanceof Date) return [cell.getDate()]

  const value = text(cell)
  if (!value || /\d{3,}/.test(value)) return []

  const found = value.match(/\d{1,2}/g) ?? []
  const days: number[] = []
  for (const token of found) {
    const day = Number(token)
    if (day >= 1 && day <= 31 && !days.includes(day)) days.push(day)
  }
  return days
}

/**
 * Der Vermerk neben dem Tag.
 *
 * Die Legende der Tabelle kennt «K = Kinderansprache»; alles andere bleibt
 * im Wortlaut stehen, statt es zu deuten. So geht nichts verloren, was
 * jemand einmal bewusst hingeschrieben hat.
 */
function readNote(cell: SheetCell): string {
  if (typeof cell !== 'string') return ''
  const rest = cell.replace(/[\d\s,;.+]+/g, ' ').trim()
  if (!rest) return ''
  return rest.toUpperCase() === 'K' ? 'Kinderansprache' : rest
}

/* ------------------------------------------------------------------ */
/* Aufbau eines Blattes                                                */
/* ------------------------------------------------------------------ */

interface MonthColumn {
  index: number
  kind: HistoryKind
  /** 1–12 */
  month: number
  /** Beschriftung im Blatt, z. B. «Sept.» */
  label: string
}

/** Nur die Zeile mit den Spaltenkürzeln enthält reihenweise «A» und «G». */
function findMarkerRow(data: SheetCell[][]): number {
  const limit = Math.min(data.length, 15)
  for (let i = 0; i < limit; i++) {
    const marks = data[i].filter((cell) => {
      const value = text(cell).toUpperCase()
      return value === 'A' || value === 'G'
    })
    if (marks.length >= 4) return i
  }
  return -1
}

/**
 * Ordnet jeder Kürzelspalte ihren Monat zu.
 *
 * Der Monatsname steht eine Zeile höher und nur über der «A»-Spalte; das
 * «G» daneben gehört zum selben Monat. Die Auswertungsspalten am rechten
 * Rand («Ansprache 2026») tragen kein Kürzel und fallen damit von selbst weg.
 */
function readColumns(data: SheetCell[][], markerRow: number): MonthColumn[] {
  const marks = data[markerRow]
  const months = data[markerRow - 1] ?? []
  const columns: MonthColumn[] = []

  let month = 0
  let label = ''

  for (let i = 0; i < marks.length; i++) {
    const name = parseMonthName(text(months[i]))
    if (name !== null) {
      month = name + 1
      label = text(months[i])
    }

    const mark = text(marks[i]).toUpperCase()
    if (!month || (mark !== 'A' && mark !== 'G')) continue
    columns.push({ index: i, kind: mark === 'A' ? 'talk' : 'prayer', month, label })
  }

  return columns
}

/* ------------------------------------------------------------------ */
/* Einstiegspunkt                                                      */
/* ------------------------------------------------------------------ */

/** Eine gefüllte Zelle mit allem, was zu ihrer Deutung nötig ist. */
interface Hit {
  fullName: string
  column: MonthColumn
  cell: SheetCell
  values: number[]
}

/**
 * Zählt das Blatt Sonntage oder Tage?
 *
 * Entschieden wird am Inhalt, nicht am Kopf: Die Beschriftung «x-ter
 * Sonntag» steht auch in den neuen Blättern noch, sie ist bloss nicht mehr
 * mitgewandert. Der Unterschied ist trotzdem eindeutig – ein Monat hat
 * höchstens fünf Sonntage, Tagesangaben liegen zu über vier Fünfteln
 * darüber. Dazwischen liegt eine breite Lücke, kein Grenzfall.
 */
function readCounting(hits: Hit[]): Counting {
  const values = hits.flatMap((hit) => hit.values)
  if (values.length === 0) return 'day'
  const above = values.filter((value) => value > 5).length
  return above / values.length < 0.25 ? 'sunday' : 'day'
}

export function parseTalkHistory(sheets: RawSheet[]): ParsedHistory {
  const entries: HistoryEntry[] = []
  const unread: UnreadCell[] = []
  const ignoredRows: string[] = []
  const summaries: SheetSummary[] = []
  const skippedSheets: string[] = []

  for (const { sheet, data } of sheets) {
    const year = Number(sheet.match(/(?:19|20)\d{2}/)?.[0])
    const markerRow = data.length ? findMarkerRow(data) : -1
    const columns = markerRow >= 1 ? readColumns(data, markerRow) : []
    if (!year || columns.length === 0) {
      skippedSheets.push(sheet)
      continue
    }

    /* Erst sammeln – die Zählweise ergibt sich aus dem ganzen Blatt. */
    const hits: Hit[] = []
    for (const row of data.slice(markerRow + 1)) {
      const lastName = cleanLastName(text(row[0]))
      const firstName = text(row[1])
      if (!lastName) continue
      if (!firstName) {
        if (!ignoredRows.includes(lastName)) ignoredRows.push(lastName)
        continue
      }
      const fullName = `${lastName}, ${firstName}`

      for (const column of columns) {
        const cell = row[column.index]
        if (cell === null || cell === undefined || text(cell) === '') continue
        hits.push({ fullName, column, cell, values: readDays(cell) })
      }
    }

    /* Dann deuten. */
    const counting = readCounting(hits)
    let count = 0

    for (const hit of hits) {
      const { column } = hit
      const days = hit.values
        .map((value) =>
          counting === 'sunday'
            ? nthSundayOfMonth(year, column.month, value)
            : isRealDate(year, column.month, value)
              ? value
              : null,
        )
        .filter((day): day is number => day !== null)

      if (days.length === 0) {
        unread.push({
          sheet,
          fullName: hit.fullName,
          column: column.label,
          kind: column.kind,
          text: text(hit.cell),
        })
        continue
      }

      const note = readNote(hit.cell)
      for (const day of days) {
        entries.push({
          fullName: hit.fullName,
          kind: column.kind,
          year,
          month: column.month,
          day,
          note,
        })
        count++
      }
    }

    summaries.push({ sheet, year, counting, entries: count })
  }

  return {
    entries,
    unread,
    sheets: summaries.sort((a, b) => a.year - b.year),
    ignoredRows,
    years: summaries.map((summary) => summary.year).sort((a, b) => a - b),
    skippedSheets,
  }
}

/* ------------------------------------------------------------------ */
/* Datum                                                               */
/* ------------------------------------------------------------------ */

/** «2024-10-20» – Schlüssel für Dokument-IDs und Abgleich. */
export function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Umkehrung von `isoDate()`, als lokales Datum um Mitternacht. */
export function fromIsoDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day)
}
