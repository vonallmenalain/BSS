/**
 * Ein Word-Dokument lesen – ohne Bibliothek.
 *
 * Eine `.docx`-Datei ist ein ZIP-Archiv, und der Text steht darin in
 * `word/document.xml`. Beides lässt sich mit Bordmitteln öffnen: Das
 * Inhaltsverzeichnis des Archivs ist ein paar Zahlen weit hinten in der
 * Datei, und entpackt wird mit `DecompressionStream` – der Browser bringt
 * denselben Algorithmus mit, den auch ein ZIP-Programm verwendet.
 *
 * Eine Bibliothek dafür einzubinden hiesse, für einen **einmaligen**
 * Import jedem Aufruf der App ein Paket mehr aufzuladen. Die hundert
 * Zeilen hier sind der ehrlichere Preis.
 *
 * Aus dem XML wird nur gelesen, was das Protokoll ausmacht: Absätze und
 * Tabellen. Alles Übrige – Formatierung, Kommentare, Nummerierung – bleibt
 * liegen, wo es steht.
 */

/* ------------------------------------------------------------------ */
/* ZIP                                                                 */
/* ------------------------------------------------------------------ */

const EOCD_SIGNATURE = 0x06054b50
const CENTRAL_SIGNATURE = 0x02014b50
const LOCAL_SIGNATURE = 0x04034b50
/** Ein ZIP-Kommentar darf bis 65 535 Zeichen lang sein – so weit muss gesucht werden. */
const MAX_COMMENT = 0xffff

/** Das Ende des Inhaltsverzeichnisses steht am Schluss der Datei – rückwärts gesucht. */
function findEndOfCentralDirectory(view: DataView): number {
  const start = Math.max(0, view.byteLength - MAX_COMMENT - 22)
  for (let offset = view.byteLength - 22; offset >= start; offset--) {
    if (view.getUint32(offset, true) === EOCD_SIGNATURE) return offset
  }
  throw new Error('Die Datei ist kein ZIP-Archiv – .docx wird erwartet.')
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('Dieser Browser kann keine .docx-Dateien entpacken. Nimm einen neueren.')
  }
  const stream = new Blob([data as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/**
 * Eine einzelne Datei aus dem Archiv holen.
 *
 * Gesucht wird über das zentrale Verzeichnis und nicht über die lokalen
 * Köpfe: Nur dort stehen die Grössen zuverlässig – bei manchen Schreibern
 * sind sie im lokalen Kopf null und stehen erst hinter den Daten.
 */
export async function readZipEntry(buffer: ArrayBuffer, name: string): Promise<Uint8Array> {
  const view = new DataView(buffer)
  const bytes = new Uint8Array(buffer)
  const eocd = findEndOfCentralDirectory(view)
  const count = view.getUint16(eocd + 10, true)
  let pointer = view.getUint32(eocd + 16, true)

  const decoder = new TextDecoder('utf-8')

  for (let index = 0; index < count; index++) {
    if (view.getUint32(pointer, true) !== CENTRAL_SIGNATURE) break

    const method = view.getUint16(pointer + 10, true)
    const compressedSize = view.getUint32(pointer + 20, true)
    const nameLength = view.getUint16(pointer + 28, true)
    const extraLength = view.getUint16(pointer + 30, true)
    const commentLength = view.getUint16(pointer + 32, true)
    const localOffset = view.getUint32(pointer + 42, true)
    const entryName = decoder.decode(bytes.subarray(pointer + 46, pointer + 46 + nameLength))

    if (entryName === name) {
      if (view.getUint32(localOffset, true) !== LOCAL_SIGNATURE) {
        throw new Error('Das Archiv ist beschädigt.')
      }
      const localNameLength = view.getUint16(localOffset + 26, true)
      const localExtraLength = view.getUint16(localOffset + 28, true)
      const start = localOffset + 30 + localNameLength + localExtraLength
      const data = bytes.subarray(start, start + compressedSize)
      if (method === 0) return data
      if (method === 8) return inflateRaw(data)
      throw new Error(`Die Datei ist mit einem unbekannten Verfahren gepackt (${method}).`)
    }

    pointer += 46 + nameLength + extraLength + commentLength
  }

  throw new Error(`Im Archiv fehlt «${name}» – ist das wirklich ein Word-Dokument?`)
}

/** Der Text eines Word-Dokuments als XML. */
export async function readDocxXml(buffer: ArrayBuffer): Promise<string> {
  const data = await readZipEntry(buffer, 'word/document.xml')
  return new TextDecoder('utf-8').decode(data)
}

/* ------------------------------------------------------------------ */
/* XML                                                                 */
/* ------------------------------------------------------------------ */

export type DocxBlock =
  | { type: 'paragraph'; text: string }
  /** Eine Tabelle als Zeilen von Zellen; Zeilenumbrüche in einer Zelle bleiben erhalten. */
  | { type: 'table'; rows: string[][] }

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
}

function decodeXml(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-z]+);/g, (whole, code: string) => {
    if (code.startsWith('#x') || code.startsWith('#X')) {
      return String.fromCodePoint(Number.parseInt(code.slice(2), 16))
    }
    if (code.startsWith('#')) return String.fromCodePoint(Number.parseInt(code.slice(1), 10))
    return ENTITIES[code] ?? whole
  })
}

interface OpenTable {
  rows: string[][]
  row: string[]
  cell: string[]
}

/**
 * Absätze und Tabellen in der Reihenfolge, in der sie im Dokument stehen.
 *
 * Gelesen wird mit einem kleinen Automaten statt mit einem XML-Parser: Das
 * Format ist gutartig – Word schreibt keine Attributwerte mit `>` –, und
 * so bleibt der Code auch ohne Browser prüfbar (`tests/import-minutes`).
 *
 * Drei Eigenheiten von Word sind eingerechnet:
 *
 * - **Inhaltssteuerelemente** (`w:sdt`) umschliessen manche Tabellen. Sie
 *   werden schlicht durchgelassen – wer nur auf `w:tbl` achtet, merkt
 *   nichts davon. In der Protokolldatei steckt fast ein Viertel der
 *   Sitzungen in solchen Hüllen.
 * - **Verschachtelte Tabellen** landen als Zeilen im Text der Zelle, in
 *   der sie stehen. Sie zu übergehen hiesse, Inhalt zu verlieren.
 * - **Ein Absatz** ist die Zeileneinheit einer Zelle; `w:br` und `w:tab`
 *   stehen für Umbruch und Tabulator innerhalb eines Absatzes.
 */
export function parseDocxBlocks(xml: string): DocxBlock[] {
  const blocks: DocxBlock[] = []
  const tables: OpenTable[] = []
  let paragraph: string[] = []
  /**
   * Ein Textfeld in einer Zeichnung bringt eigene Absätze mit, mitten im
   * laufenden. Gezählt wird deshalb die Verschachtelung: Erst der äusserste
   * Absatz gibt seine Zeile ab, und was im Textfeld steht, gehört dazu.
   */
  let depth = 0
  let inText = false

  const addLine = (line: string) => {
    const table = tables[tables.length - 1]
    if (table) table.cell.push(line.trimEnd())
    else if (line.trim()) blocks.push({ type: 'paragraph', text: line.trim() })
  }

  const pattern = /<([^>]*)>([^<]*)/g
  let match: RegExpExecArray | null

  while ((match = pattern.exec(xml)) !== null) {
    const tag = match[1]
    const between = match[2]
    const closing = tag.startsWith('/')
    const selfClosing = tag.endsWith('/')
    const name = (closing ? tag.slice(1) : tag).split(/[\s/]/)[0]

    switch (name) {
      case 'w:tbl':
        if (closing) {
          const done = tables.pop()
          if (!done) break
          if (tables.length === 0) blocks.push({ type: 'table', rows: done.rows })
          // Eine Tabelle in einer Zelle: ihre Zeilen gehören zum Text der Zelle.
          else for (const row of done.rows) addLine(row.filter(Boolean).join(' – '))
        } else if (!selfClosing) {
          tables.push({ rows: [], row: [], cell: [] })
        }
        break

      case 'w:tr': {
        const table = tables[tables.length - 1]
        if (!table) break
        if (closing) {
          table.rows.push(table.row)
          table.row = []
        } else if (!selfClosing) {
          table.row = []
        }
        break
      }

      case 'w:tc': {
        const table = tables[tables.length - 1]
        if (!table) break
        if (closing) {
          table.row.push(table.cell.join('\n').trim())
          table.cell = []
        } else if (!selfClosing) {
          table.cell = []
        }
        break
      }

      case 'w:p':
        if (selfClosing) {
          if (depth === 0) addLine('')
        } else if (closing) {
          depth = Math.max(0, depth - 1)
          if (depth === 0) {
            addLine(paragraph.join(''))
            paragraph = []
          }
        } else {
          if (depth === 0) paragraph = []
          depth++
        }
        break

      case 'w:br':
        if (!closing) paragraph.push('\n')
        break

      case 'w:tab':
        if (!closing) paragraph.push('\t')
        break

      case 'w:t':
        inText = !closing && !selfClosing
        break
    }

    if (inText && between) paragraph.push(decodeXml(between))
  }

  return blocks
}
