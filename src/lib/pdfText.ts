/**
 * Den Text einer einfachen PDF-Datei lesen – ohne Bibliothek.
 *
 * Gebraucht wird das für einen einzigen Zweck: die Gruppeneinteilung fürs
 * Putzen, die als PDF aus Google Docs vorliegt (`services/importCleaningGroups`).
 * Kopiert man den Text aus einem PDF-Programm, kommt er je nach Programm
 * spaltenweise – erst «Gruppe 1» bis «Gruppe 10», dann alle Namen am Stück –,
 * und dann weiss niemand mehr, wer zu welcher Gruppe gehört. Die Datei selbst
 * kennt die Lage jedes Wortes; daraus lassen sich die Zeilen so wieder
 * zusammensetzen, wie sie auf dem Blatt stehen. Und sie kennt die Schrift:
 * Wer **fett** dasteht, ist zuständig.
 *
 * Gelesen wird nur, was solche Dateien brauchen: Objekte, mit «Flate»
 * gepackte Inhalte, die Textbefehle (BT … ET, Tf, Tm, Td, TJ und Verwandte)
 * samt Koordinatensystem und die Zuordnung der Zeichen zu Unicode über die
 * `ToUnicode`-Tabelle der Schrift. Verschlüsselte Dateien, Objektströme und
 * Formulare gehören nicht dazu – dann kommt eben nichts heraus, und der
 * Import bietet das Einfügen als Text an.
 *
 * Ohne Abhängigkeiten und ohne DOM, damit es sich mit `node --test` prüfen
 * lässt (`DecompressionStream` gibt es in Node wie im Browser).
 */

/** Ein Stück Text, wie es auf der Seite steht. */
export interface PdfTextItem {
  text: string
  /** Links unten, in Punkt vom linken Rand */
  x: number
  /** Grundlinie, in Punkt vom oberen Rand – wächst nach unten */
  y: number
  /** Schriftgrösse auf der Seite, in Punkt */
  size: number
  /**
   * Ungefähre Breite – halb so viel je Zeichen wie die Schriftgrösse. Genau
   * genug, um Wörter von Spalten zu unterscheiden; die Schriftmetriken
   * braucht es dafür nicht.
   */
  width: number
  /** Gesetzt in einer fetten Schrift */
  bold: boolean
  /** Seite, ab 1 */
  page: number
}

/** Eine Zeile der Seite – ihre Stücke von links nach rechts. */
export interface PdfLine {
  page: number
  y: number
  items: PdfTextItem[]
}

type Matrix = [number, number, number, number, number, number]

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0]

function multiply(m: Matrix, n: Matrix): Matrix {
  return [
    m[0] * n[0] + m[1] * n[2],
    m[0] * n[1] + m[1] * n[3],
    m[2] * n[0] + m[3] * n[2],
    m[2] * n[1] + m[3] * n[3],
    m[4] * n[0] + m[5] * n[2] + n[4],
    m[4] * n[1] + m[5] * n[3] + n[5],
  ]
}

/* ------------------------------------------------------------------ */
/* Objekte                                                             */
/* ------------------------------------------------------------------ */

interface PdfObject {
  dict: string
  stream: Uint8Array | null
}

function latin1(bytes: Uint8Array): string {
  let text = ''
  const chunk = 0x8000
  for (let index = 0; index < bytes.length; index += chunk) {
    text += String.fromCharCode(...bytes.subarray(index, index + chunk))
  }
  return text
}

function readObjects(bytes: Uint8Array): Map<number, PdfObject> {
  const text = latin1(bytes)
  const objects = new Map<number, PdfObject>()
  const pattern = /(\d+)\s+\d+\s+obj\b/g
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    const id = Number(match[1])
    const start = match.index + match[0].length
    const end = text.indexOf('endobj', start)
    if (end === -1) break
    const body = text.slice(start, end)
    const streamAt = body.search(/\bstream\r?\n/)
    if (streamAt === -1) {
      objects.set(id, { dict: body, stream: null })
      continue
    }
    const dict = body.slice(0, streamAt)
    let dataStart = start + streamAt + 'stream'.length
    if (text[dataStart] === '\r') dataStart++
    if (text[dataStart] === '\n') dataStart++
    const dataEnd = text.indexOf('endstream', dataStart)
    objects.set(id, { dict, stream: bytes.subarray(dataStart, dataEnd === -1 ? end : dataEnd) })
    pattern.lastIndex = end
  }
  return objects
}

/** Die Länge eines Stroms – direkt angegeben oder als Verweis. */
function streamBytes(object: PdfObject, objects: Map<number, PdfObject>): Uint8Array | null {
  if (!object.stream) return null
  const direct = object.dict.match(/\/Length\s+(\d+)(?!\s+\d+\s+R)/)
  const indirect = object.dict.match(/\/Length\s+(\d+)\s+\d+\s+R/)
  const length = direct
    ? Number(direct[1])
    : indirect
      ? Number(objects.get(Number(indirect[1]))?.dict.trim())
      : NaN
  // Ohne lesbare Länge zählt der Text bis «endstream» – samt Zeilenende, das
  // Inflate ohnehin übergeht.
  return Number.isFinite(length) ? object.stream.subarray(0, length) : object.stream
}

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream('deflate'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function decodedStream(
  object: PdfObject,
  objects: Map<number, PdfObject>,
): Promise<Uint8Array | null> {
  const data = streamBytes(object, objects)
  if (!data) return null
  if (/\/Filter\s*\/FlateDecode/.test(object.dict)) return inflate(data)
  if (/\/Filter/.test(object.dict)) return null // andere Filter kommen hier nicht vor
  return data
}

/** Ein Verweis «12 0 R» aus einem Schlüssel des Wörterbuchs. */
function ref(dict: string, key: string): number | null {
  const match = dict.match(new RegExp(`/${key}\\s+(\\d+)\\s+\\d+\\s+R`))
  return match ? Number(match[1]) : null
}

/* ------------------------------------------------------------------ */
/* Schriften                                                           */
/* ------------------------------------------------------------------ */

interface Font {
  bold: boolean
  /** Bytes je Zeichencode – 2 bei «Identity-H», sonst 1 */
  codeLength: number
  toUnicode: Map<number, string>
}

function hexToString(hex: string): string {
  let text = ''
  for (let index = 0; index + 4 <= hex.length; index += 4) {
    text += String.fromCharCode(parseInt(hex.slice(index, index + 4), 16))
  }
  return text
}

/** Die Tabelle «Zeichencode → Unicode» aus einer CMap. */
function parseCMap(source: string): Map<number, string> {
  const map = new Map<number, string>()
  for (const block of source.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const pair of block[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]*)>/g)) {
      map.set(parseInt(pair[1], 16), hexToString(pair[2]))
    }
  }
  for (const block of source.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    const body = block[1]
    for (const range of body.matchAll(
      /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(?:<([0-9A-Fa-f]+)>|\[([^\]]*)\])/g,
    )) {
      const low = parseInt(range[1], 16)
      const high = parseInt(range[2], 16)
      if (range[3] !== undefined) {
        const base = hexToString(range[3])
        const first = base.charCodeAt(base.length - 1)
        for (let code = low; code <= high; code++) {
          map.set(code, base.slice(0, -1) + String.fromCharCode(first + code - low))
        }
      } else {
        const targets = [...(range[4] ?? '').matchAll(/<([0-9A-Fa-f]*)>/g)].map((entry) =>
          hexToString(entry[1]),
        )
        targets.forEach((target, offset) => map.set(low + offset, target))
      }
    }
  }
  return map
}

async function readFont(id: number, objects: Map<number, PdfObject>): Promise<Font> {
  const dict = objects.get(id)?.dict ?? ''
  const baseFont = dict.match(/\/BaseFont\s*\/([^\s/>]+)/)?.[1] ?? ''
  const identity = /\/Encoding\s*\/Identity-H/.test(dict)
  const toUnicodeId = ref(dict, 'ToUnicode')
  const cmapObject = toUnicodeId === null ? undefined : objects.get(toUnicodeId)
  const cmap = cmapObject ? await decodedStream(cmapObject, objects) : null
  return {
    bold: /bold|black|heavy|semibold/i.test(baseFont),
    codeLength: identity ? 2 : 1,
    toUnicode: cmap ? parseCMap(latin1(cmap)) : new Map(),
  }
}

/** Die Bytes einer Zeichenkette als Text der Schrift. */
function decodeString(bytes: number[], font: Font | undefined): string {
  if (!font) return String.fromCharCode(...bytes)
  let text = ''
  for (let index = 0; index + font.codeLength <= bytes.length; index += font.codeLength) {
    const code = font.codeLength === 2 ? (bytes[index] << 8) | bytes[index + 1] : bytes[index]
    text += font.toUnicode.get(code) ?? (font.codeLength === 1 ? String.fromCharCode(code) : '')
  }
  return text
}

/* ------------------------------------------------------------------ */
/* Inhalt einer Seite                                                  */
/* ------------------------------------------------------------------ */

type Token =
  | { kind: 'number'; value: number }
  | { kind: 'string'; bytes: number[] }
  | { kind: 'name'; value: string }
  | { kind: 'array'; items: Token[] }
  | { kind: 'operator'; value: string }

/** Zerlegt einen Inhaltsstrom in Zahlen, Zeichenketten, Namen und Befehle. */
function tokenize(source: string): Token[] {
  const tokens: Token[] = []
  const stack: Token[][] = [tokens]
  const push = (token: Token) => stack[stack.length - 1].push(token)
  let index = 0

  while (index < source.length) {
    const char = source[index]
    if (/\s/.test(char)) {
      index++
    } else if (char === '%') {
      while (index < source.length && source[index] !== '\n' && source[index] !== '\r') index++
    } else if (char === '(') {
      const bytes: number[] = []
      let depth = 1
      index++
      while (index < source.length && depth > 0) {
        const current = source[index]
        if (current === '\\') {
          const next = source[index + 1]
          const escapes: Record<string, number> = { n: 10, r: 13, t: 9, b: 8, f: 12 }
          if (next in escapes) {
            bytes.push(escapes[next])
            index += 2
          } else if (/[0-7]/.test(next)) {
            const octal = source.slice(index + 1, index + 4).match(/^[0-7]{1,3}/)![0]
            bytes.push(parseInt(octal, 8) & 0xff)
            index += 1 + octal.length
          } else if (next === '\r' || next === '\n') {
            index += next === '\r' && source[index + 2] === '\n' ? 3 : 2
          } else {
            bytes.push(next.charCodeAt(0))
            index += 2
          }
          continue
        }
        if (current === '(') depth++
        if (current === ')') depth--
        if (depth > 0) bytes.push(current.charCodeAt(0))
        index++
      }
      push({ kind: 'string', bytes })
    } else if (char === '<' && source[index + 1] !== '<') {
      const end = source.indexOf('>', index)
      const hex = source.slice(index + 1, end).replace(/\s+/g, '')
      const padded = hex.length % 2 === 1 ? `${hex}0` : hex
      const bytes: number[] = []
      for (let at = 0; at < padded.length; at += 2)
        bytes.push(parseInt(padded.slice(at, at + 2), 16))
      push({ kind: 'string', bytes })
      index = end + 1
    } else if (char === '[') {
      const array: Token = { kind: 'array', items: [] }
      push(array)
      stack.push(array.items)
      index++
    } else if (char === ']') {
      if (stack.length > 1) stack.pop()
      index++
    } else if (char === '/') {
      const match = source.slice(index + 1).match(/^[^\s/[\]()<>{}%]*/)![0]
      push({ kind: 'name', value: match })
      index += 1 + match.length
    } else if (char === '<' || char === '>' || char === '{' || char === '}') {
      // Wörterbücher (BDC …) und Klammern: für den Text ohne Bedeutung.
      index += source[index + 1] === char ? 2 : 1
    } else {
      const match = source.slice(index).match(/^[^\s/[\]()<>{}%]+/)![0]
      const number = Number(match)
      push(
        Number.isNaN(number)
          ? { kind: 'operator', value: match }
          : { kind: 'number', value: number },
      )
      index += match.length
    }
  }
  return tokens
}

async function pageItems(
  pageDict: string,
  pageNumber: number,
  objects: Map<number, PdfObject>,
): Promise<PdfTextItem[]> {
  // Schriften der Seite: «/F4 4 0 R» – direkt oder über ein Ressourcen-Objekt.
  let resources = pageDict
  const resourcesId = ref(pageDict, 'Resources')
  if (resourcesId !== null) resources = objects.get(resourcesId)?.dict ?? ''
  const fontBlock = resources.match(/\/Font\s*<<([\s\S]*?)>>/)?.[1] ?? ''
  const fontsId = ref(resources, 'Font')
  const fontEntries = fontsId !== null ? (objects.get(fontsId)?.dict ?? '') : fontBlock
  const fonts = new Map<string, Font>()
  for (const entry of fontEntries.matchAll(/\/([^\s/]+)\s+(\d+)\s+\d+\s+R/g)) {
    fonts.set(entry[1], await readFont(Number(entry[2]), objects))
  }

  const mediaBox = pageDict.match(/\/MediaBox\s*\[\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)/)
  const pageTop = mediaBox ? Number(mediaBox[4]) : 842

  // Inhalt: ein Strom oder eine Liste davon.
  const contents = pageDict.match(/\/Contents\s*(\[[^\]]*\]|\d+\s+\d+\s+R)/)?.[1] ?? ''
  const ids = [...contents.matchAll(/(\d+)\s+\d+\s+R/g)].map((entry) => Number(entry[1]))
  let source = ''
  for (const id of ids) {
    const object = objects.get(id)
    const data = object ? await decodedStream(object, objects) : null
    if (data) source += `${latin1(data)}\n`
  }

  const items: PdfTextItem[] = []
  const operands: Token[] = []
  const graphics: Matrix[] = []
  let ctm: Matrix = IDENTITY
  let textMatrix: Matrix = IDENTITY
  let lineMatrix: Matrix = IDENTITY
  let font: Font | undefined
  let fontSize = 1
  let leading = 0

  const nums = (count: number) =>
    operands.slice(-count).map((token) => (token.kind === 'number' ? token.value : 0))
  const show = (bytes: number[]) => {
    const text = decodeString(bytes, font)
    if (!text) return
    const [, , c, d, x, y] = multiply(multiply([fontSize, 0, 0, fontSize, 0, 0], textMatrix), ctm)
    const size = Math.hypot(c, d)
    items.push({
      text,
      x,
      y: pageTop - y,
      size,
      width: text.length * size * 0.5,
      bold: font?.bold ?? false,
      page: pageNumber,
    })
  }
  const nextLine = (tx: number, ty: number) => {
    lineMatrix = multiply([1, 0, 0, 1, tx, ty], lineMatrix)
    textMatrix = lineMatrix
  }

  for (const token of tokenize(source)) {
    if (token.kind !== 'operator') {
      operands.push(token)
      continue
    }
    switch (token.value) {
      case 'q':
        graphics.push(ctm)
        break
      case 'Q':
        ctm = graphics.pop() ?? IDENTITY
        break
      case 'cm':
        ctm = multiply(nums(6) as Matrix, ctm)
        break
      case 'BT':
        textMatrix = IDENTITY
        lineMatrix = IDENTITY
        break
      case 'Tf': {
        const name = operands[operands.length - 2]
        if (name?.kind === 'name') font = fonts.get(name.value)
        fontSize = nums(1)[0] || 1
        break
      }
      case 'TL':
        leading = nums(1)[0]
        break
      case 'Tm':
        textMatrix = nums(6) as Matrix
        lineMatrix = textMatrix
        break
      case 'Td': {
        const [tx, ty] = nums(2)
        nextLine(tx, ty)
        break
      }
      case 'TD': {
        const [tx, ty] = nums(2)
        leading = -ty
        nextLine(tx, ty)
        break
      }
      case 'T*':
        nextLine(0, -leading)
        break
      case 'Tj': {
        const last = operands[operands.length - 1]
        if (last?.kind === 'string') show(last.bytes)
        break
      }
      case "'":
      case '"': {
        nextLine(0, -leading)
        const last = operands[operands.length - 1]
        if (last?.kind === 'string') show(last.bytes)
        break
      }
      case 'TJ': {
        const last = operands[operands.length - 1]
        if (last?.kind !== 'array') break
        // Ein Stück je Befehl: Die Abstände dazwischen sind Feinkerning, keine
        // Wortgrenzen – Leerzeichen stehen in solchen Dateien als Zeichen da.
        const bytes: number[] = []
        for (const item of last.items) {
          if (item.kind === 'string') bytes.push(...item.bytes)
          else if (item.kind === 'number' && item.value < -250 && bytes.length > 0) {
            bytes.push(...(font?.codeLength === 2 ? [] : [32]))
          }
        }
        show(bytes)
        break
      }
    }
    operands.length = 0
  }

  return items
}

/**
 * Alle Textstücke einer PDF-Datei – oder eine leere Liste, wenn sie sich so
 * nicht lesen lässt.
 */
export async function pdfTextItems(bytes: Uint8Array): Promise<PdfTextItem[]> {
  const head = latin1(bytes.subarray(0, 8))
  if (!head.startsWith('%PDF-')) return []
  const objects = readObjects(bytes)
  if ([...objects.values()].some((object) => /\/Encrypt\b/.test(object.dict))) return []

  // Die Seiten in der Reihenfolge des Seitenbaums – wie in der Datei vorkommend
  // genügt für die einseitigen Listen, um die es hier geht.
  const pages = [...objects.entries()].filter(([, object]) =>
    /\/Type\s*\/Page(?!s)\b/.test(object.dict),
  )
  const items: PdfTextItem[] = []
  for (const [index, [, page]] of pages.entries()) {
    items.push(...(await pageItems(page.dict, index + 1, objects)))
  }
  return items
}

/**
 * Die Stücke zu Zeilen zusammengesetzt – von oben nach unten, je Zeile von
 * links nach rechts. Was auf derselben Grundlinie steht (bis auf zwei Punkt),
 * ist dieselbe Zeile.
 */
export function pdfLines(items: readonly PdfTextItem[]): PdfLine[] {
  const sorted = [...items].sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x)
  const lines: PdfLine[] = []
  for (const item of sorted) {
    const line = lines[lines.length - 1]
    if (line && line.page === item.page && Math.abs(line.y - item.y) <= 2) line.items.push(item)
    else lines.push({ page: item.page, y: item.y, items: [item] })
  }
  for (const line of lines) line.items.sort((a, b) => a.x - b.x)
  return lines
}

/** Ein zusammenhängendes Stück einer Zeile – in einer Spalte, in einer Schrift. */
export interface PdfSegment {
  text: string
  bold: boolean
}

/**
 * Eine Zeile in ihre Spalten zerlegt.
 *
 * Manche Programme setzen jedes Zeichen einzeln, andere ganze Wörter;
 * zusammengehörig ist, was dicht beieinandersteht. Eine Lücke von mehr als
 * anderthalb Schriftgrössen trennt zwei Spalten – in der Gruppeneinteilung
 * etwa «Gruppe 1» von «Römer Nathan». Fett ist ein Stück, wenn die Mehrheit
 * seiner Zeichen fett ist.
 */
export function pdfSegments(line: PdfLine): PdfSegment[] {
  const groups: PdfTextItem[][] = []
  for (const item of line.items) {
    const current = groups[groups.length - 1]
    const previous = current?.[current.length - 1]
    const gap = previous ? item.x - (previous.x + previous.width) : Infinity
    if (previous && gap <= Math.max(10, 1.5 * Math.max(previous.size, item.size))) {
      current.push(item)
    } else {
      groups.push([item])
    }
  }
  return groups
    .map((items) => {
      const text = items
        .map((item) => item.text)
        .join('')
        .replace(/\s+/g, ' ')
        .trim()
      const letters = items.filter((item) => item.text.trim())
      const bold = letters.filter((item) => item.bold).length > letters.length / 2
      return { text, bold }
    })
    .filter((segment) => segment.text)
}
