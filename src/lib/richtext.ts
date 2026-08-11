import { colorIndexForId } from './utils.ts'

/**
 * Formatierter Text – Fett, Farben, Aufzählungen und die Zuordnung eines
 * Textstücks an eine Person der Bischofschaft.
 *
 * ## Der Grundsatz: Der Text bleibt Text
 *
 * Gespeichert wird die Formatierung nicht **im** Text, sondern als Feld
 * **daneben** – so, wie eine Erwähnung als `memberRefs` neben dem Text steht
 * (siehe `lib/mention`). Im Textfeld selbst steht weiterhin reiner Text, ohne
 * `{Rot}` und ohne spitze Klammern: Die Suche, das Protokoll, der Export und
 * jede ältere Ansicht lesen denselben Text wie eh und je.
 *
 * Das Formatfeld trägt eine JSON-Beschreibung desselben Textes, zerlegt in
 * **Blöcke** (Absätze oder Listenpunkte mit Ebene) und **Läufe** (Textstücke
 * mit Marken). Damit die beiden nie auseinanderlaufen, gilt eine einzige
 * Regel: Die Klartext-Projektion des Formatfelds muss Zeichen für Zeichen dem
 * gespeicherten Text entsprechen (`richDocFor`). Hat irgendwer – etwa eine
 * ältere Fassung der App – nur den Text geändert, passt die Projektion nicht
 * mehr, und die Anzeige fällt stillschweigend auf den unformatierten Text
 * zurück. Falsch formatierter Text ist schlimmer als unformatierter.
 *
 * ## Zwei Projektionen
 *
 * - `plainTextOf` ist der **gespeicherte** Text: Listenpunkte tragen ihr
 *   Aufzählungszeichen («• …», eingerückt je Ebene), damit auch Suche und
 *   Protokoll die Liste als Liste zeigen.
 * - `editTextOf` ist der Text, wie er **im Editor** steht: ohne die
 *   Aufzählungszeichen, denn die zeichnet der Browser als Marker vor die
 *   Zeile. Auf diesem Text rechnen Cursor, Auswahl und die `@`-Erwähnung.
 *
 * Die DOM-Seite – aus dem Modell ein bearbeitbares Feld machen und zurück –
 * liegt getrennt in `lib/richdom`, damit dieses Modul ohne Browser testbar
 * bleibt.
 */

/* ------------------------------------------------------------------ */
/* Modell                                                              */
/* ------------------------------------------------------------------ */

export interface RichMarks {
  /** Fett */
  b?: true
  /** Textfarbe – ein Schlüssel aus `TEXT_COLORS` */
  color?: string
  /** Hintergrundfarbe – ein Schlüssel aus `BG_COLORS` */
  bg?: string
  /** Einer Person der Bischofschaft zugeordnet – ihre UID */
  who?: string
}

/** Ein Stück Text mit einheitlichen Marken – ohne Zeilenumbrüche. */
export interface RichRun extends RichMarks {
  t: string
}

export interface RichBlock {
  /** Listenpunkt dieser Ebene (1–4); fehlt die Angabe, ist es ein Absatz. */
  list?: number
  runs: RichRun[]
}

export interface RichDoc {
  blocks: RichBlock[]
}

/**
 * Das Paar, das gespeichert wird: der Text und die Formatierung daneben.
 *
 * `rich` ist `null`, solange nichts formatiert ist – ein unformatierter
 * Eintrag sieht in Firestore genauso aus wie vor dieser Funktion.
 */
export interface RichValue {
  text: string
  rich: string | null
}

export const MAX_LIST_LEVEL = 4

/** Aufzählungszeichen je Ebene – so steht die Liste auch im reinen Text da. */
const LIST_MARKERS = ['•', '◦', '▪', '▫']

/* ------------------------------------------------------------------ */
/* Palette                                                             */
/* ------------------------------------------------------------------ */

/**
 * Eine feste, kleine Palette statt freier Farben.
 *
 * Gespeichert wird der **Name**, gezeichnet werden Klassen mit hellem und
 * dunklem Wert: Ein sattes Rot auf weissem Grund wäre auf dunklem Grund
 * unleserlich. Freie Farbwerte könnten das nicht – und mehr als eine Handvoll
 * Farben braucht ein Sitzungsprotokoll nicht.
 */
export interface PaletteColor {
  key: string
  label: string
  /** Klassen für den gezeichneten Text bzw. Hintergrund */
  class: string
  /** Klassen für den Farbpunkt im Menü */
  dot: string
}

export const TEXT_COLORS: PaletteColor[] = [
  { key: 'red', label: 'Rot', class: 'text-red-600 dark:text-red-400', dot: 'bg-red-500' },
  {
    key: 'orange',
    label: 'Orange',
    class: 'text-orange-600 dark:text-orange-400',
    dot: 'bg-orange-500',
  },
  { key: 'amber', label: 'Gelb', class: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-400' },
  {
    key: 'green',
    label: 'Grün',
    class: 'text-emerald-600 dark:text-emerald-400',
    dot: 'bg-emerald-500',
  },
  { key: 'blue', label: 'Blau', class: 'text-blue-600 dark:text-blue-400', dot: 'bg-blue-500' },
  {
    key: 'violet',
    label: 'Violett',
    class: 'text-violet-600 dark:text-violet-400',
    dot: 'bg-violet-500',
  },
  { key: 'pink', label: 'Rosa', class: 'text-pink-600 dark:text-pink-400', dot: 'bg-pink-500' },
  { key: 'gray', label: 'Grau', class: 'text-slate-500 dark:text-slate-400', dot: 'bg-slate-400' },
]

export const BG_COLORS: PaletteColor[] = [
  {
    key: 'yellow',
    label: 'Gelb',
    class: 'bg-yellow-200/80 dark:bg-yellow-500/30',
    dot: 'bg-yellow-300',
  },
  {
    key: 'green',
    label: 'Grün',
    class: 'bg-emerald-200/70 dark:bg-emerald-500/30',
    dot: 'bg-emerald-300',
  },
  { key: 'blue', label: 'Blau', class: 'bg-sky-200/70 dark:bg-sky-500/30', dot: 'bg-sky-300' },
  { key: 'pink', label: 'Rosa', class: 'bg-pink-200/70 dark:bg-pink-500/30', dot: 'bg-pink-300' },
  {
    key: 'orange',
    label: 'Orange',
    class: 'bg-orange-200/70 dark:bg-orange-500/30',
    dot: 'bg-orange-300',
  },
  {
    key: 'violet',
    label: 'Violett',
    class: 'bg-violet-200/70 dark:bg-violet-500/30',
    dot: 'bg-violet-300',
  },
]

const TEXT_COLOR_CLASSES = new Map(TEXT_COLORS.map((color) => [color.key, color.class]))
const BG_COLOR_CLASSES = new Map(BG_COLORS.map((color) => [color.key, color.class]))

/**
 * Die Unterstreichung eines zugeordneten Textstücks – im Farbton der Person.
 *
 * Dieselbe Reihenfolge wie die Avatar-Farben in `lib/utils`, angesprochen
 * über denselben `colorIndexForId`: Wer im Kreis mit den Initialen grün ist,
 * ist es auch unter seinem Textstück.
 */
const WHO_DECORATIONS = [
  'decoration-sky-500 dark:decoration-sky-400',
  'decoration-emerald-500 dark:decoration-emerald-400',
  'decoration-amber-500 dark:decoration-amber-400',
  'decoration-violet-500 dark:decoration-violet-400',
  'decoration-rose-500 dark:decoration-rose-400',
  'decoration-teal-500 dark:decoration-teal-400',
  'decoration-indigo-500 dark:decoration-indigo-400',
  'decoration-orange-500 dark:decoration-orange-400',
]

export function whoDecoration(uid: string): string {
  return WHO_DECORATIONS[colorIndexForId(uid)]
}

/**
 * Die Klassen zu einem Satz Marken – für Editor und Lesedarstellung dieselben.
 *
 * `withWho: false` lässt die Unterstreichung weg; die Lesedarstellung zeichnet
 * die Zuordnung um eine ganze Gruppe von Läufen, nicht um jeden einzelnen.
 */
export function markClasses(marks: RichMarks, options?: { withWho?: boolean }): string {
  const classes: string[] = []
  if (marks.b) classes.push('font-semibold')
  if (marks.color) {
    const cls = TEXT_COLOR_CLASSES.get(marks.color)
    if (cls) classes.push(cls)
  }
  if (marks.bg) {
    const cls = BG_COLOR_CLASSES.get(marks.bg)
    if (cls) classes.push('rounded-[3px]', cls)
  }
  if (marks.who && options?.withWho !== false) {
    classes.push(
      'underline decoration-dotted decoration-2 underline-offset-2',
      whoDecoration(marks.who),
    )
  }
  return classes.join(' ')
}

/* ------------------------------------------------------------------ */
/* Marken lesen und vergleichen                                        */
/* ------------------------------------------------------------------ */

/** Nur die Marken eines Laufs – ohne den Text, ohne Unbekanntes. */
export function marksOf(run: RichMarks): RichMarks {
  const marks: RichMarks = {}
  if (run.b) marks.b = true
  if (run.color) marks.color = run.color
  if (run.bg) marks.bg = run.bg
  if (run.who) marks.who = run.who
  return marks
}

export function sameMarks(a: RichMarks, b: RichMarks): boolean {
  return (
    (a.b ?? false) === (b.b ?? false) &&
    (a.color ?? '') === (b.color ?? '') &&
    (a.bg ?? '') === (b.bg ?? '') &&
    (a.who ?? '') === (b.who ?? '')
  )
}

export function hasMarks(marks: RichMarks): boolean {
  return Boolean(marks.b || marks.color || marks.bg || marks.who)
}

/* ------------------------------------------------------------------ */
/* Marken am Element – für den Editor                                  */
/* ------------------------------------------------------------------ */

/**
 * Marken als `data-rt`-Attribut, z. B. `b;color:red;who:abc`.
 *
 * Im Editor tragen die `<span>` ihre Marken doppelt: als Klassen fürs Auge
 * und als dieses Attribut für den Rückweg. Der Parser liest **nur** das
 * Attribut – Klassen sind Darstellung und könnten sich jederzeit ändern.
 */
export function encodeMarks(marks: RichMarks): string {
  const parts: string[] = []
  if (marks.b) parts.push('b')
  if (marks.color) parts.push(`color:${marks.color}`)
  if (marks.bg) parts.push(`bg:${marks.bg}`)
  if (marks.who) parts.push(`who:${marks.who}`)
  return parts.join(';')
}

export function decodeMarks(value: string): RichMarks {
  const marks: RichMarks = {}
  for (const part of value.split(';')) {
    if (part === 'b') marks.b = true
    else if (part.startsWith('color:')) marks.color = part.slice(6)
    else if (part.startsWith('bg:')) marks.bg = part.slice(3)
    else if (part.startsWith('who:')) marks.who = part.slice(4)
  }
  return marks
}

/* ------------------------------------------------------------------ */
/* Aufbauen und projizieren                                            */
/* ------------------------------------------------------------------ */

function clampLevel(value: number): number {
  return Math.min(MAX_LIST_LEVEL, Math.max(1, Math.round(value)))
}

export function emptyDoc(): RichDoc {
  return { blocks: [{ runs: [] }] }
}

/** Reiner Text als Modell – jede Zeile ein Absatz, nichts markiert. */
export function docFromPlain(text: string): RichDoc {
  const lines = (text ?? '').split('\n')
  return { blocks: lines.map((line) => ({ runs: line ? [{ t: line }] : [] })) }
}

export function blockText(block: RichBlock): string {
  return block.runs.map((run) => run.t).join('')
}

/** Der Text, wie er im Editor steht – ohne Aufzählungszeichen. */
export function editTextOf(doc: RichDoc): string {
  return doc.blocks.map(blockText).join('\n')
}

/**
 * Der Text, wie er gespeichert wird – Listenpunkte mit Zeichen und Einzug.
 *
 * Ein leerer Listenpunkt endet ohne Leerzeichen («•», nicht «• »): Die
 * Dienste beschneiden Text an den Rändern, und ein Unterschied dort liesse
 * Text und Formatfeld auseinanderlaufen.
 */
export function plainTextOf(doc: RichDoc): string {
  return doc.blocks
    .map((block) => {
      const text = blockText(block)
      if (!block.list) return text
      const level = clampLevel(block.list)
      const marker = LIST_MARKERS[level - 1]
      return `${'  '.repeat(level - 1)}${marker}${text ? ` ${text}` : ''}`
    })
    .join('\n')
}

export function editLengthOf(doc: RichDoc): number {
  return doc.blocks.reduce((sum, block) => sum + blockText(block).length, 0) + doc.blocks.length - 1
}

/**
 * Aufräumen: gleiche Nachbarläufe verschmelzen, Leeres verwerfen, Ebenen
 * begrenzen. Alles Weitere setzt einen aufgeräumten Stand voraus.
 */
export function normalizeDoc(doc: RichDoc): RichDoc {
  const blocks = doc.blocks.map((block) => {
    const runs: RichRun[] = []
    for (const raw of block.runs) {
      const t = raw.t.replace(/\r/g, '').replace(/\n/g, ' ')
      if (!t) continue
      const marks = marksOf(raw)
      const last = runs[runs.length - 1]
      if (last && sameMarks(last, marks)) last.t += t
      else runs.push({ t, ...marks })
    }
    const clean: RichBlock = { runs }
    if (block.list) clean.list = clampLevel(block.list)
    return clean
  })
  return { blocks: blocks.length > 0 ? blocks : [{ runs: [] }] }
}

/** Trägt das Modell überhaupt eine Formatierung? */
export function isPlainDoc(doc: RichDoc): boolean {
  return doc.blocks.every((block) => !block.list && block.runs.every((run) => !hasMarks(run)))
}

/* ------------------------------------------------------------------ */
/* Speichern und Lesen                                                 */
/* ------------------------------------------------------------------ */

const FORMAT_VERSION = 1

/**
 * Obergrenzen beim Einlesen – gegen kaputte oder bösartig grosse Felder.
 * Ein Sitzungstext hat Dutzende Blöcke, nicht Tausende.
 */
const LIMITS = { blocks: 2000, runs: 20000, who: 200 }

export function serializeDoc(doc: RichDoc): string {
  const blocks = doc.blocks.map((block) => {
    const runs = block.runs.map((run) => {
      const out: Record<string, unknown> = { t: run.t }
      if (run.b) out.b = true
      if (run.color) out.color = run.color
      if (run.bg) out.bg = run.bg
      if (run.who) out.who = run.who
      return out
    })
    return block.list ? { list: block.list, runs } : { runs }
  })
  return JSON.stringify({ v: FORMAT_VERSION, blocks })
}

/**
 * Das Formatfeld einlesen – wohlwollend im Kleinen, streng im Grossen.
 *
 * Eine unbekannte Farbe fällt weg (der Text bleibt), ein unbekannter Aufbau
 * lässt das ganze Feld fallen (`null`): Dann gilt der reine Text, und der
 * ist immer da.
 */
export function parseRichJson(json: string): RichDoc | null {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    return null
  }
  if (!raw || typeof raw !== 'object') return null
  const { v, blocks: rawBlocks } = raw as { v?: unknown; blocks?: unknown }
  if (v !== FORMAT_VERSION || !Array.isArray(rawBlocks) || rawBlocks.length > LIMITS.blocks) {
    return null
  }

  let runCount = 0
  const blocks: RichBlock[] = []
  for (const entry of rawBlocks) {
    if (!entry || typeof entry !== 'object') return null
    const { list, runs: rawRuns } = entry as { list?: unknown; runs?: unknown }
    if (!Array.isArray(rawRuns)) return null

    const block: RichBlock = { runs: [] }
    if (typeof list === 'number' && Number.isFinite(list)) block.list = clampLevel(list)

    for (const rawRun of rawRuns) {
      if (!rawRun || typeof rawRun !== 'object') return null
      const { t, b, color, bg, who } = rawRun as Record<string, unknown>
      if (typeof t !== 'string') return null
      if (++runCount > LIMITS.runs) return null

      const run: RichRun = { t }
      if (b === true) run.b = true
      if (typeof color === 'string' && TEXT_COLOR_CLASSES.has(color)) run.color = color
      if (typeof bg === 'string' && BG_COLOR_CLASSES.has(bg)) run.bg = bg
      if (typeof who === 'string' && who !== '' && who.length <= LIMITS.who) run.who = who
      block.runs.push(run)
    }
    blocks.push(block)
  }
  return normalizeDoc({ blocks })
}

/** Aus dem Modell das Paar machen, das gespeichert wird. */
export function toRichValue(doc: RichDoc): RichValue {
  const normal = normalizeDoc(doc)
  return {
    text: plainTextOf(normal),
    rich: isPlainDoc(normal) ? null : serializeDoc(normal),
  }
}

export function richValueOf(
  text: string | null | undefined,
  rich: string | null | undefined,
): RichValue {
  return { text: text ?? '', rich: rich ?? null }
}

/**
 * Das Formatfeld zu einem Text – oder `null`, wenn es nicht (mehr) passt.
 *
 * Der Wächter dieser ganzen Einrichtung: Nur wenn die Projektion des
 * Formatfelds Zeichen für Zeichen dem gespeicherten Text entspricht, wird
 * formatiert gezeichnet. Alles andere hiesse, einen Text zu zeigen, den so
 * niemand geschrieben hat.
 */
export function richDocFor(
  rich: string | null | undefined,
  text: string | null | undefined,
): RichDoc | null {
  if (!rich) return null
  const doc = parseRichJson(rich)
  if (!doc) return null
  return plainTextOf(doc) === (text ?? '') ? doc : null
}

/** Das Modell zu einem gespeicherten Paar – notfalls der reine Text. */
export function docOfValue(value: { text: string; rich?: string | null }): RichDoc {
  return richDocFor(value.rich ?? null, value.text) ?? docFromPlain(value.text)
}

/**
 * Rand-Weissraum entfernen, ohne Text und Formatfeld zu entzweien.
 *
 * Das Gegenstück zu `title.trim()` der Dienste: Wer beides speichert, muss
 * beides gleich beschneiden. Bleibt am Ende doch Weissraum am Rand (bei
 * Listen wäre das denkbar), fällt die Formatierung weg, bevor Text und
 * Formatfeld auseinanderlaufen.
 */
export function trimRichValue(value: RichValue): RichValue {
  if (!value.rich) return { text: value.text.trim(), rich: null }
  const doc = richDocFor(value.rich, value.text)
  if (!doc) return { text: value.text.trim(), rich: null }

  const trimmed = toRichValue(trimDoc(doc))
  if (trimmed.text !== trimmed.text.trim()) return { text: trimmed.text.trim(), rich: null }
  return trimmed
}

function trimDoc(doc: RichDoc): RichDoc {
  const blocks = doc.blocks.map((block) => ({
    ...(block.list ? { list: block.list } : {}),
    runs: block.runs.map((run) => ({ ...run })),
  }))
  const blank = (block: RichBlock) => !block.list && blockText(block).trim() === ''

  while (blocks.length > 1 && blank(blocks[0])) blocks.shift()
  while (blocks.length > 1 && blank(blocks[blocks.length - 1])) blocks.pop()

  const first = blocks[0]
  while (first.runs.length > 0) {
    first.runs[0].t = first.runs[0].t.replace(/^\s+/, '')
    if (first.runs[0].t) break
    first.runs.shift()
  }
  const last = blocks[blocks.length - 1]
  while (last.runs.length > 0) {
    const run = last.runs[last.runs.length - 1]
    run.t = run.t.replace(/\s+$/, '')
    if (run.t) break
    last.runs.pop()
  }
  return normalizeDoc({ blocks })
}

/* ------------------------------------------------------------------ */
/* Bereiche im Bearbeitungstext                                        */
/* ------------------------------------------------------------------ */

interface BlockPos {
  /** Anfang des Blocktexts im Bearbeitungstext */
  start: number
  /** Ende des Blocktexts (ohne das `\n` dahinter) */
  end: number
}

function blockPositions(doc: RichDoc): BlockPos[] {
  const positions: BlockPos[] = []
  let offset = 0
  for (const block of doc.blocks) {
    const length = blockText(block).length
    positions.push({ start: offset, end: offset + length })
    offset += length + 1
  }
  return positions
}

function clampRange(doc: RichDoc, start: number, end: number): [number, number] {
  const length = editLengthOf(doc)
  const from = Math.max(0, Math.min(start, length))
  const to = Math.max(0, Math.min(end, length))
  return from <= to ? [from, to] : [to, from]
}

/** Läufe an den angegebenen Stellen (lokal zum Block) auftrennen. */
function splitRuns(runs: RichRun[], cuts: number[]): RichRun[] {
  const points = [...new Set(cuts)].sort((a, b) => a - b)
  const out: RichRun[] = []
  let pos = 0
  for (const run of runs) {
    const end = pos + run.t.length
    let from = pos
    for (const cut of points) {
      if (cut <= from || cut >= end) continue
      out.push({ ...run, t: run.t.slice(from - pos, cut - pos) })
      from = cut
    }
    out.push({ ...run, t: run.t.slice(from - pos) })
    pos = end
  }
  return out.filter((run) => run.t !== '')
}

/** Die Läufe eines Blocks im lokalen Bereich [from, to). */
function runsSlice(runs: RichRun[], from: number, to: number): RichRun[] {
  const out: RichRun[] = []
  let pos = 0
  for (const run of runs) {
    const end = pos + run.t.length
    const cutFrom = Math.max(from, pos)
    const cutTo = Math.min(to, end)
    if (cutFrom < cutTo) out.push({ ...run, t: run.t.slice(cutFrom - pos, cutTo - pos) })
    pos = end
  }
  return out
}

export type MarkKey = 'b' | 'color' | 'bg' | 'who'

function withMark(run: RichRun, key: MarkKey, value: true | string | null): RichRun {
  const next: RichRun = { t: run.t, ...marksOf(run) }
  if (value === null) delete next[key]
  else if (key === 'b') next.b = true
  else next[key] = value as string
  return next
}

/** Eine Marke über den Bereich setzen (`value`) oder entfernen (`null`). */
export function applyMark(
  doc: RichDoc,
  start: number,
  end: number,
  key: MarkKey,
  value: true | string | null,
): RichDoc {
  const [from, to] = clampRange(doc, start, end)
  if (from === to) return doc
  const positions = blockPositions(doc)

  const blocks = doc.blocks.map((block, index) => {
    const { start: bs, end: be } = positions[index]
    const localFrom = Math.max(from, bs) - bs
    const localTo = Math.min(to, be) - bs
    if (localFrom >= localTo) return block

    const runs = splitRuns(block.runs, [localFrom, localTo])
    let pos = 0
    const next = runs.map((run) => {
      const runStart = pos
      pos += run.t.length
      if (runStart < localFrom || runStart >= localTo) return run
      return withMark(run, key, value)
    })
    return { ...block, runs: next }
  })
  return normalizeDoc({ blocks })
}

/** Alle Marken im Bereich entfernen – die Listenform bleibt. */
export function clearMarks(doc: RichDoc, start: number, end: number): RichDoc {
  const [from, to] = clampRange(doc, start, end)
  if (from === to) return doc
  const positions = blockPositions(doc)

  const blocks = doc.blocks.map((block, index) => {
    const { start: bs, end: be } = positions[index]
    const localFrom = Math.max(from, bs) - bs
    const localTo = Math.min(to, be) - bs
    if (localFrom >= localTo) return block

    const runs = splitRuns(block.runs, [localFrom, localTo])
    let pos = 0
    const next = runs.map((run) => {
      const runStart = pos
      pos += run.t.length
      if (runStart < localFrom || runStart >= localTo) return run
      return { t: run.t }
    })
    return { ...block, runs: next }
  })
  return normalizeDoc({ blocks })
}

/** Der Lauf, in dem das Zeichen an `offset` steht – `null` auf einem `\n`. */
function runAtOffset(doc: RichDoc, offset: number): RichRun | null {
  const positions = blockPositions(doc)
  for (let index = 0; index < doc.blocks.length; index++) {
    const { start: bs, end: be } = positions[index]
    if (offset < bs || offset >= be) continue
    let pos = bs
    for (const run of doc.blocks[index].runs) {
      if (offset < pos + run.t.length) return run
      pos += run.t.length
    }
  }
  return null
}

/**
 * Die Marken an der Auswahl – für den Zustand des Menüs.
 *
 * Massgeblich ist das erste markierte Zeichen; beim blossen Cursor das
 * Zeichen davor (so schreibt der Browser auch weiter) und am Zeilenanfang
 * das danach. Das genügt: Das Menü zeigt an, was ein Griff bewirken würde,
 * keine Statistik über die ganze Auswahl.
 */
export function marksAt(doc: RichDoc, start: number, end: number): RichMarks {
  const [from, to] = clampRange(doc, start, end)
  const candidates = from < to ? [from, from - 1] : [from - 1, from]
  for (const candidate of candidates) {
    if (candidate < 0) continue
    const run = runAtOffset(doc, candidate)
    if (run) return marksOf(run)
  }
  return {}
}

/** Erster und letzter Block, den der Bereich berührt (einschliesslich). */
function blockIndexRange(doc: RichDoc, start: number, end: number): [number, number] {
  const [from, to] = clampRange(doc, start, end)
  const positions = blockPositions(doc)
  let first = 0
  let last = doc.blocks.length - 1
  for (let index = 0; index < positions.length; index++) {
    // Das `\n` hinter einem Block gehört noch zu ihm – ein Cursor am
    // Zeilenende meint diese Zeile.
    if (from >= positions[index].start && from <= positions[index].end) first = index
    if (to >= positions[index].start && to <= positions[index].end) {
      last = index
      break
    }
  }
  return [first, Math.max(first, last)]
}

/** Der Listenstand an der Auswahl – für Menü und Tab-Taste. */
export function listStateAt(
  doc: RichDoc,
  start: number,
  end: number,
): { active: boolean; level: number } {
  const [first] = blockIndexRange(doc, start, end)
  const block = doc.blocks[first]
  return block?.list ? { active: true, level: clampLevel(block.list) } : { active: false, level: 0 }
}

/** Aufzählung ein- bzw. ausschalten – für alle Blöcke der Auswahl. */
export function toggleList(doc: RichDoc, start: number, end: number): RichDoc {
  const [first, last] = blockIndexRange(doc, start, end)
  const allList = doc.blocks.slice(first, last + 1).every((block) => block.list)
  const blocks = doc.blocks.map((block, index) => {
    if (index < first || index > last) return block
    if (allList) return { runs: block.runs }
    return { ...block, list: block.list ?? 1 }
  })
  return normalizeDoc({ blocks })
}

/**
 * Ein- oder ausrücken. Einrücken macht aus einem Absatz einen Listenpunkt;
 * Ausrücken auf Ebene 1 macht daraus wieder einen Absatz.
 */
export function changeIndent(doc: RichDoc, start: number, end: number, delta: 1 | -1): RichDoc {
  const [first, last] = blockIndexRange(doc, start, end)
  const blocks = doc.blocks.map((block, index) => {
    if (index < first || index > last) return block
    if (delta === 1) {
      return { ...block, list: block.list ? Math.min(MAX_LIST_LEVEL, block.list + 1) : 1 }
    }
    if (!block.list) return block
    if (block.list <= 1) return { runs: block.runs }
    return { ...block, list: block.list - 1 }
  })
  return normalizeDoc({ blocks })
}

/**
 * Einen Bereich durch Text ersetzen – für Einfügen und die `@`-Erwähnung.
 *
 * Eingesetzter Text übernimmt die Marken des Zeichens davor: Wer mitten im
 * fett Geschriebenen einen Namen wählt, bekommt ihn fett. Mehrzeiliges
 * spaltet Blöcke; neue Zeilen erben die Listenebene der Einfügestelle.
 */
export function replaceRange(
  doc: RichDoc,
  start: number,
  end: number,
  text: string,
): { doc: RichDoc; caret: number } {
  const [from, to] = clampRange(doc, start, end)
  const clean = text.replace(/\r\n?/g, '\n')
  const lines = clean.split('\n')
  const positions = blockPositions(doc)
  const [startIndex, endIndex] = blockIndexRange(doc, from, to)

  const startBlock = doc.blocks[startIndex]
  const endBlock = doc.blocks[endIndex]
  const localFrom = Math.min(from - positions[startIndex].start, blockText(startBlock).length)
  const localTo = Math.min(to - positions[endIndex].start, blockText(endBlock).length)

  const before = runsSlice(startBlock.runs, 0, localFrom)
  const after = runsSlice(endBlock.runs, localTo, Number.POSITIVE_INFINITY)
  const marks =
    localFrom > 0 ? marksOf(runsSlice(startBlock.runs, localFrom - 1, localFrom)[0] ?? {}) : {}

  const inserted: RichBlock[] = []
  const firstRuns = [...before]
  if (lines[0]) firstRuns.push({ t: lines[0], ...marks })
  const firstBlock: RichBlock = startBlock.list
    ? { list: startBlock.list, runs: firstRuns }
    : { runs: firstRuns }

  if (lines.length === 1) {
    firstBlock.runs = [...firstBlock.runs, ...after]
    inserted.push(firstBlock)
  } else {
    inserted.push(firstBlock)
    for (let index = 1; index < lines.length; index++) {
      const runs: RichRun[] = lines[index] ? [{ t: lines[index], ...marks }] : []
      const list = index === lines.length - 1 ? (endBlock.list ?? startBlock.list) : startBlock.list
      inserted.push(list ? { list, runs } : { runs })
    }
    const lastBlock = inserted[inserted.length - 1]
    lastBlock.runs = [...lastBlock.runs, ...after]
  }

  const blocks = [
    ...doc.blocks.slice(0, startIndex),
    ...inserted,
    ...doc.blocks.slice(endIndex + 1),
  ]
  return { doc: normalizeDoc({ blocks }), caret: from + clean.length }
}

/**
 * Das Wort unter dem Cursor – die Fläche, auf die eine Marke ohne Auswahl
 * wirkt. Auf Weissraum gibt es keins, dann bewirkt der Griff nichts.
 */
export function wordRangeAt(text: string, position: number): { start: number; end: number } | null {
  const isWord = (char: string | undefined) => char !== undefined && /[\p{L}\p{N}]/u.test(char)
  let start = Math.max(0, Math.min(position, text.length))
  let end = start
  while (isWord(text[start - 1])) start--
  while (isWord(text[end])) end++
  return start === end ? null : { start, end }
}
