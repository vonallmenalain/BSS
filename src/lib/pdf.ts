/**
 * Eine Tabelle als PDF – ohne Bibliothek.
 *
 * Für den Ausdruck einer Liste braucht es von PDF wenig: Seiten im Format A4,
 * Text in den beiden Standardschriften Helvetica und Helvetica-Bold, ein paar
 * Linien und graue Flächen. Diese Schriften kennt jedes Programm, das PDF
 * anzeigt – sie müssen nicht eingebettet werden, und die Datei bleibt ein
 * paar Kilobyte klein. Eine Bibliothek dafür einzubinden hiesse, jedem Aufruf
 * der App ein Paket mehr aufzuladen, für einen Knopf, der selten gedrückt
 * wird.
 *
 * **Umlaute** gehen über die Kodierung «WinAnsi», die die Standardschriften
 * mitbringen: ä, ö, ü, ß, é, «–» und die Anführungszeichen stehen darin. Was
 * dort fehlt, wird zum Fragezeichen – in einem Putzplan kommt das nicht vor.
 *
 * **Breiten** stehen als Tabelle hier (aus den Schriftmetriken von Adobe).
 * Ohne sie liesse sich weder rechtsbündig setzen noch ein langer Name auf
 * zwei Zeilen umbrechen, bevor er in die nächste Spalte läuft.
 *
 * Bewusst ohne Abhängigkeiten, damit sich der Aufbau mit `node --test`
 * prüfen lässt.
 */

export type PdfFont = 'regular' | 'bold'

/**
 * Was in einer Zelle steht: ein Text – oder ein Text mit einem grauen
 * Zusatz dahinter, «Künzli Dominik & Lena (Pfahlkonferenz)».
 */
export type PdfCell = string | { text: string; aside?: string }

/**
 * Unten auf jeder Seite: wo es die Liste online gibt – als Adresse zum
 * Abtippen und als QR-Code zum Scannen.
 */
export interface PdfLink {
  /** Klein über der Adresse – «Immer aktuell unter» */
  caption: string
  /** Die Adresse, wie sie dasteht – «bss.alae.app/putzplan» */
  label: string
  /** Der QR-Code dazu, Zeile für Zeile (`lib/qr`); `true` ist dunkel */
  qr: boolean[][]
}

export interface PdfColumn {
  label: string
  /** Anteil an der Tabellenbreite – die Anteile aller Spalten werden zusammengezählt */
  width: number
  align?: 'left' | 'right' | 'center'
}

export interface PdfTable {
  /** Gross über der Tabelle – «Putzplan» */
  title: string
  /** Darunter, kleiner und grau – der Name der Gemeinde */
  subtitle?: string
  columns: PdfColumn[]
  /** Je Zeile ein Eintrag pro Spalte */
  rows: PdfCell[][]
  /** Links unten auf jeder Seite – «Stand: 02.10.2026» */
  footer?: string
  /** Unten rechts auf jeder Seite: Adresse und QR-Code */
  link?: PdfLink
  /** Für die Eigenschaften der Datei; sonst der Titel */
  documentTitle?: string
  /** Wann erstellt – für die Eigenschaften der Datei */
  createdAt?: Date
}

/* ------------------------------------------------------------------ */
/* Seite und Masse                                                     */
/* ------------------------------------------------------------------ */

/** A4 in Punkt (1/72 Zoll). */
const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89

const MARGIN_X = 48
const MARGIN_TOP = 56
const MARGIN_BOTTOM = 56

const TITLE_SIZE = 20
const SUBTITLE_SIZE = 11
const HEAD_SIZE = 9.5
const BODY_SIZE = 10.5
const FOOT_SIZE = 8.5
/** Die Adresse neben dem QR-Code – fett und etwas grösser, zum Abtippen. */
const LINK_SIZE = 11.5
const LINE_HEIGHT = 13
const CELL_PAD_X = 8
const CELL_PAD_Y = 6
const HEAD_HEIGHT = 22
/** Mehr als drei Zeilen je Zelle wären keine Tabelle mehr, sondern ein Absatz. */
const MAX_LINES = 3

/** Grauwerte: die Schrift fast schwarz, Zusätze und Fusszeile gedämpft. */
const INK = 0.1
const MUTED = 0.45

/**
 * Der QR-Code unten rechts – gut 23 mm breit, so lässt er sich vor dem
 * Anschlagbrett noch bequem scannen. Er sitzt etwas tiefer als die
 * gewöhnliche Fusszeile, damit die Tabelle nicht mehr Platz verliert als
 * nötig: Ein halbes Jahr Putzplan passt weiterhin auf eine Seite.
 */
const QR_SIZE = 66
const QR_BOTTOM = 30

/* ------------------------------------------------------------------ */
/* Schrift: Kodierung und Breiten                                      */
/* ------------------------------------------------------------------ */

/** Was WinAnsi im Bereich 0x80–0x9F anders belegt als Latin-1. */
const WIN_ANSI_SPECIAL: Record<string, number> = {
  '€': 0x80,
  '‚': 0x82,
  ƒ: 0x83,
  '„': 0x84,
  '…': 0x85,
  '†': 0x86,
  '‡': 0x87,
  ˆ: 0x88,
  '‰': 0x89,
  Š: 0x8a,
  '‹': 0x8b,
  Œ: 0x8c,
  Ž: 0x8e,
  '‘': 0x91,
  '’': 0x92,
  '“': 0x93,
  '”': 0x94,
  '•': 0x95,
  '–': 0x96,
  '—': 0x97,
  '˜': 0x98,
  '™': 0x99,
  š: 0x9a,
  '›': 0x9b,
  œ: 0x9c,
  ž: 0x9e,
  Ÿ: 0x9f,
}

/** Ein Zeichen als Byte in WinAnsi – oder das Fragezeichen. */
function winAnsiCode(char: string): number {
  const code = char.charCodeAt(0)
  if (code >= 0x20 && code <= 0x7e) return code
  if (code >= 0xa0 && code <= 0xff) return code
  return WIN_ANSI_SPECIAL[char] ?? 0x3f
}

/** Text als Folge von WinAnsi-Bytes – jedes Zeichen des Ergebnisses ist ein Byte. */
export function toWinAnsi(text: string): string {
  let result = ''
  for (const char of text.replace(/[\t\r\n]+/g, ' ')) {
    result += String.fromCharCode(winAnsiCode(char))
  }
  return result
}

/** Breiten der Zeichen 32–126, in Tausendsteln der Schriftgrösse. */
// prettier-ignore
const ASCII_WIDTHS: Record<PdfFont, number[]> = {
  regular: [
    278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
    556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
    1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
    667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
    333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
    556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
  ],
  bold: [
    278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
    556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
    975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
    667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
    333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
    611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
  ],
}

/** Satzzeichen und Zeichen jenseits von ASCII, die vorkommen können. */
// prettier-ignore
const SPECIAL_WIDTHS: Record<PdfFont, Record<number, number>> = {
  regular: {
    0x82: 222, 0x84: 333, 0x85: 1000, 0x91: 222, 0x92: 222, 0x93: 333, 0x94: 333,
    0x95: 350, 0x96: 556, 0x97: 1000, 0xa0: 278, 0xab: 556, 0xbb: 556, 0xb0: 400,
    0xb7: 278, 0xa9: 737, 0xae: 737, 0xc6: 1000, 0xd7: 584, 0xdf: 611, 0xe6: 889,
    0xf7: 584, 0xf8: 611,
  },
  bold: {
    0x82: 278, 0x84: 500, 0x85: 1000, 0x91: 278, 0x92: 278, 0x93: 500, 0x94: 500,
    0x95: 350, 0x96: 556, 0x97: 1000, 0xa0: 278, 0xab: 556, 0xbb: 556, 0xb0: 400,
    0xb7: 278, 0xa9: 737, 0xae: 737, 0xc6: 1000, 0xd7: 584, 0xdf: 611, 0xe6: 889,
    0xf7: 584, 0xf8: 611,
  },
}

/**
 * Akzentbuchstaben sind so breit wie ihr Grundbuchstabe – «ä» wie «a».
 * Ausgenommen die i mit Akzent: Die sind in Helvetica breiter als das «i».
 */
const BASE_LETTERS = 'AAAAAA CEEEEIIIIDNOOOOO OUUUUYPsaaaaaa ceeeeiiiidnooooo ouuuuypy'

function charWidth(code: number, font: PdfFont): number {
  if (code >= 32 && code <= 126) return ASCII_WIDTHS[font][code - 32]
  const special = SPECIAL_WIDTHS[font][code]
  if (special) return special
  if (code >= 0xc0) {
    if (code >= 0xec && code <= 0xef) return 278
    const base = BASE_LETTERS.charCodeAt(code - 0xc0)
    if (base !== 32) return ASCII_WIDTHS[font][base - 32]
  }
  return 556
}

/** Wie breit ein Text gesetzt ist, in Punkt. */
export function textWidth(text: string, font: PdfFont, size: number): number {
  let units = 0
  for (const char of toWinAnsi(text)) units += charWidth(char.charCodeAt(0), font)
  return (units * size) / 1000
}

/**
 * Einen Text auf Zeilen verteilen, die in die Breite passen.
 *
 * Umgebrochen wird an Leerzeichen; ein einzelnes Wort, das allein zu breit
 * ist, wird gekürzt. Mehr als `MAX_LINES` Zeilen gibt es nicht – die letzte
 * endet dann mit «…».
 */
export function wrapText(text: string, font: PdfFont, size: number, width: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return ['']

  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (!current || textWidth(candidate, font, size) <= width) {
      current = candidate
    } else {
      lines.push(current)
      current = word
    }
  }
  lines.push(current)

  const kept = lines.slice(0, MAX_LINES)
  if (lines.length > MAX_LINES) kept[MAX_LINES - 1] = `${kept[MAX_LINES - 1]} …`
  return kept.map((line) => fitText(line, font, size, width))
}

/** Kürzt einen Text mit «…», bis er in die Breite passt. */
function fitText(text: string, font: PdfFont, size: number, width: number): string {
  if (textWidth(text, font, size) <= width) return text
  let cut = text
  while (cut.length > 1 && textWidth(`${cut}…`, font, size) > width) cut = cut.slice(0, -1)
  return `${cut.trimEnd()}…`
}

/* ------------------------------------------------------------------ */
/* Zeichnen                                                            */
/* ------------------------------------------------------------------ */

const FONT_NAME: Record<PdfFont, string> = { regular: 'F1', bold: 'F2' }

/** Zahlen kurz und ohne Exponenten – PDF kennt keine «1e-7». */
function num(value: number): string {
  return Number(value.toFixed(2)).toString()
}

/** Ein Text als PDF-Zeichenkette: in WinAnsi, Klammern und Backslash maskiert. */
function pdfString(text: string): string {
  return `(${toWinAnsi(text).replace(/[\\()]/g, (char) => `\\${char}`)})`
}

function drawText(
  x: number,
  y: number,
  text: string,
  font: PdfFont,
  size: number,
  gray: number,
): string {
  return `BT /${FONT_NAME[font]} ${num(size)} Tf ${num(gray)} g ${num(x)} ${num(y)} Td ${pdfString(text)} Tj ET`
}

function fillRect(x: number, y: number, width: number, height: number, gray: number): string {
  return `${num(gray)} g ${num(x)} ${num(y)} ${num(width)} ${num(height)} re f`
}

function line(x1: number, y1: number, x2: number, y2: number, gray: number, width = 0.5): string {
  return `${num(gray)} G ${num(width)} w ${num(x1)} ${num(y1)} m ${num(x2)} ${num(y2)} l S`
}

/** Wo ein Text der Breite `width` in seiner Zelle beginnt – links, rechts oder mittig. */
function alignedX(cellX: number, cellWidth: number, width: number, column: PdfColumn) {
  const inner = cellWidth - 2 * CELL_PAD_X
  if (column.align === 'right') return cellX + CELL_PAD_X + inner - width
  if (column.align === 'center') return cellX + CELL_PAD_X + (inner - width) / 2
  return cellX + CELL_PAD_X
}

/**
 * Ein QR-Code als Fläche aus Rechtecken – je Zeile ein Rechteck für jeden
 * Lauf dunkler Module.
 *
 * Jede Zeile reicht einen Hauch in die nächste hinein: Ohne das blitzen in
 * manchen Programmen beim Kantenglätten feine helle Linien zwischen den
 * Zeilen auf.
 */
function drawQr(x: number, y: number, size: number, modules: boolean[][]): string {
  const count = modules.length
  const unit = size / count
  const rects: string[] = []
  modules.forEach((row, rowIndex) => {
    const bottom = y + size - (rowIndex + 1) * unit
    let start = -1
    for (let column = 0; column <= count; column++) {
      const dark = column < count && row[column]
      if (dark && start < 0) start = column
      if (!dark && start >= 0) {
        rects.push(
          `${num(x + start * unit)} ${num(bottom - 0.05)} ${num((column - start) * unit)} ${num(unit + 0.05)} re`,
        )
        start = -1
      }
    }
  })
  return `0 g\n${rects.join('\n')}\nf`
}

/* ------------------------------------------------------------------ */
/* Seiten                                                              */
/* ------------------------------------------------------------------ */

/** Ein Stück einer Zeile – gedämpft, wenn es der Zusatz einer Zelle ist. */
interface Span {
  text: string
  muted: boolean
}

interface LaidOutRow {
  /** Je Spalte die Zeilen der Zelle, je Zeile ihre Stücke */
  cells: Span[][][]
  height: number
}

/**
 * Die Zeilen einer Zelle.
 *
 * Der Zusatz hängt sich an die letzte Zeile, wenn er dort Platz hat –
 * sonst steht er als Ganzes darunter, statt mitten in der Klammer
 * umzubrechen.
 */
function layoutCell(cell: PdfCell, width: number): Span[][] {
  const text = typeof cell === 'string' ? cell : cell.text
  const aside = typeof cell === 'string' ? '' : (cell.aside ?? '').trim()
  const lines = wrapText(text, 'regular', BODY_SIZE, width).map((line) => [
    { text: line, muted: false },
  ])
  if (!aside) return lines

  const last = lines[lines.length - 1]
  const lastText = last[0].text
  if (!lastText) return [...lines.slice(0, -1), [{ text: aside, muted: true }]]
  if (textWidth(`${lastText} ${aside}`, 'regular', BODY_SIZE) <= width) {
    last.push({ text: aside, muted: true })
    return lines
  }
  return [
    ...lines,
    ...wrapText(aside, 'regular', BODY_SIZE, width).map((line) => [{ text: line, muted: true }]),
  ]
}

/**
 * Die Tabelle auf Seiten verteilen und jede Seite als Folge von
 * Zeichenbefehlen ausgeben.
 *
 * Jede Seite trägt Titel, Untertitel und die Kopfzeile der Tabelle – wer
 * die zweite Seite allein in der Hand hält, soll wissen, was er liest. Aus
 * demselben Grund steht ein QR-Code auf jeder Seite und nicht bloss auf der
 * letzten.
 */
function renderPages(table: PdfTable): string[] {
  const tableWidth = PAGE_WIDTH - 2 * MARGIN_X
  const totalShare = table.columns.reduce((sum, column) => sum + column.width, 0) || 1
  const widths = table.columns.map((column) => (column.width / totalShare) * tableWidth)
  const starts = widths.map((_, index) =>
    widths.slice(0, index).reduce((sum, width) => sum + width, MARGIN_X),
  )

  const rows: LaidOutRow[] = table.rows.map((row) => {
    const cells = table.columns.map((_, index) =>
      layoutCell(row[index] ?? '', widths[index] - 2 * CELL_PAD_X),
    )
    const lines = Math.max(1, ...cells.map((cell) => cell.length))
    return { cells, height: lines * LINE_HEIGHT + 2 * CELL_PAD_Y - (LINE_HEIGHT - BODY_SIZE) }
  })

  const headerBottom = PAGE_HEIGHT - MARGIN_TOP - TITLE_SIZE - (table.subtitle ? 24 : 6) - 18
  // Mit QR-Code endet die Tabelle über ihm – samt seiner hellen Ruhezone.
  const pageFloor = table.link ? QR_BOTTOM + QR_SIZE + 16 : MARGIN_BOTTOM + 18

  // Zeilen auf Seiten verteilen: so viele, wie unter die Kopfzeile passen.
  const pages: LaidOutRow[][] = [[]]
  let y = headerBottom - HEAD_HEIGHT
  for (const row of rows) {
    if (y - row.height < pageFloor && pages[pages.length - 1].length > 0) {
      pages.push([])
      y = headerBottom - HEAD_HEIGHT
    }
    pages[pages.length - 1].push(row)
    y -= row.height
  }

  return pages.map((pageRows, pageIndex) => {
    const ops: string[] = []

    // Titel und Untertitel
    let top = PAGE_HEIGHT - MARGIN_TOP - TITLE_SIZE * 0.75
    ops.push(drawText(MARGIN_X, top, table.title, 'bold', TITLE_SIZE, INK))
    if (table.subtitle) {
      top -= 22
      ops.push(drawText(MARGIN_X, top, table.subtitle, 'regular', SUBTITLE_SIZE, 0.4))
    }

    // Kopfzeile der Tabelle
    const headTop = headerBottom
    ops.push(fillRect(MARGIN_X, headTop - HEAD_HEIGHT, tableWidth, HEAD_HEIGHT, 0.92))
    table.columns.forEach((column, index) => {
      const label = fitText(column.label, 'bold', HEAD_SIZE, widths[index] - 2 * CELL_PAD_X)
      const x = alignedX(starts[index], widths[index], textWidth(label, 'bold', HEAD_SIZE), column)
      ops.push(
        drawText(x, headTop - HEAD_HEIGHT / 2 - HEAD_SIZE * 0.35, label, 'bold', HEAD_SIZE, 0.2),
      )
    })

    // Die Zeilen – jede zweite leicht hinterlegt, dazwischen eine feine Linie
    let rowTop = headTop - HEAD_HEIGHT
    pageRows.forEach((row, rowIndex) => {
      const bottom = rowTop - row.height
      if (rowIndex % 2 === 1) ops.push(fillRect(MARGIN_X, bottom, tableWidth, row.height, 0.97))
      row.cells.forEach((cellLines, index) => {
        cellLines.forEach((spans, lineIndex) => {
          const baseline = rowTop - CELL_PAD_Y - BODY_SIZE * 0.78 - lineIndex * LINE_HEIGHT
          const full = spans.map((span) => span.text).join(' ')
          let x = alignedX(
            starts[index],
            widths[index],
            textWidth(full, 'regular', BODY_SIZE),
            table.columns[index],
          )
          for (const span of spans) {
            if (span.text) {
              ops.push(
                drawText(x, baseline, span.text, 'regular', BODY_SIZE, span.muted ? MUTED : INK),
              )
            }
            x += textWidth(`${span.text} `, 'regular', BODY_SIZE)
          }
        })
      })
      ops.push(line(MARGIN_X, bottom, MARGIN_X + tableWidth, bottom, 0.85))
      rowTop = bottom
    })

    const pageLabel = `Seite ${pageIndex + 1} von ${pages.length}`

    if (table.link) {
      /* Unten rechts der QR-Code, links daneben die Adresse zum Abtippen.
         Die Seitenzahl rückt dann zum Stand nach links – rechts ist kein
         Platz mehr für sie. */
      const qrX = PAGE_WIDTH - MARGIN_X - QR_SIZE
      ops.push(drawQr(qrX, QR_BOTTOM, QR_SIZE, table.link.qr))

      const textRight = qrX - 14
      const middle = QR_BOTTOM + QR_SIZE / 2
      const { caption, label } = table.link
      ops.push(
        drawText(
          textRight - textWidth(caption, 'regular', FOOT_SIZE),
          middle + 5,
          caption,
          'regular',
          FOOT_SIZE,
          MUTED,
        ),
        drawText(
          textRight - textWidth(label, 'bold', LINK_SIZE),
          middle - 11,
          label,
          'bold',
          LINK_SIZE,
          INK,
        ),
      )

      const footer = table.footer ? `${table.footer} · ${pageLabel}` : pageLabel
      ops.push(drawText(MARGIN_X, QR_BOTTOM + 4, footer, 'regular', FOOT_SIZE, MUTED))
      return ops.join('\n')
    }

    // Fusszeile: links der Stand, rechts die Seite
    const footY = MARGIN_BOTTOM - FOOT_SIZE
    if (table.footer) ops.push(drawText(MARGIN_X, footY, table.footer, 'regular', FOOT_SIZE, MUTED))
    ops.push(
      drawText(
        PAGE_WIDTH - MARGIN_X - textWidth(pageLabel, 'regular', FOOT_SIZE),
        footY,
        pageLabel,
        'regular',
        FOOT_SIZE,
        MUTED,
      ),
    )

    return ops.join('\n')
  })
}

/* ------------------------------------------------------------------ */
/* Die Datei                                                           */
/* ------------------------------------------------------------------ */

/**
 * Ein Text für die Eigenschaften der Datei – als UTF-16 mit Kennung, damit
 * auch der Gedankenstrich im Titel ankommt.
 */
function infoString(text: string): string {
  let hex = 'FEFF'
  for (const char of text) {
    const code = char.charCodeAt(0)
    hex += code.toString(16).padStart(4, '0').toUpperCase()
  }
  return `<${hex}>`
}

/** «D:20261002193000» – so will PDF ein Datum. */
function pdfDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `D:${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
}

/**
 * Die Tabelle als PDF-Datei.
 *
 * Die Datei entsteht als Folge von Objekten – Katalog, Seitenbaum, die zwei
 * Schriften, die Eigenschaften und je Seite ihr Inhalt –, dahinter das
 * Verzeichnis mit der Stelle jedes Objekts. Jedes Zeichen der Zeichenkette
 * ist ein Byte; die Stellen lassen sich deshalb an ihrer Länge abzählen.
 */
export function tablePdf(table: PdfTable): Uint8Array {
  const pages = renderPages(table)

  const objects: string[] = []
  const add = (body: string) => {
    objects.push(body)
    return objects.length
  }

  const catalog = add('') // wird unten gesetzt, sobald der Seitenbaum steht
  const pageTree = add('')
  const regular = add(
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  )
  const bold = add(
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  )
  const info = add(
    `<< /Title ${infoString(table.documentTitle ?? table.title)} /Producer ${infoString('Bischofschaft')} /CreationDate (${pdfDate(table.createdAt ?? new Date())}) >>`,
  )

  const pageIds = pages.map((content) => {
    const contentId = add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`)
    return add(
      `<< /Type /Page /Parent ${pageTree} 0 R /MediaBox [0 0 ${num(PAGE_WIDTH)} ${num(PAGE_HEIGHT)}] ` +
        `/Resources << /Font << /F1 ${regular} 0 R /F2 ${bold} 0 R >> >> /Contents ${contentId} 0 R >>`,
    )
  })

  objects[catalog - 1] = `<< /Type /Catalog /Pages ${pageTree} 0 R >>`
  objects[pageTree - 1] =
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`

  // Kopf mit vier Bytes über 127: So erkennen Programme die Datei als binär.
  let file = '%PDF-1.4\n%âãÏÓ\n'
  const offsets: number[] = []
  objects.forEach((body, index) => {
    offsets.push(file.length)
    file += `${index + 1} 0 obj\n${body}\nendobj\n`
  })

  const xref = file.length
  file += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets) file += `${String(offset).padStart(10, '0')} 00000 n \n`
  file += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\n`
  file += `startxref\n${xref}\n%%EOF\n`

  const bytes = new Uint8Array(file.length)
  for (let index = 0; index < file.length; index++) bytes[index] = file.charCodeAt(index) & 0xff
  return bytes
}
