import { plainText } from './textFormat.ts'
import { uid } from './utils.ts'
import type { ItemLayout, LayoutField, LayoutFieldKind } from './types.ts'

/**
 * Das Raster hinter dem variablen Layout.
 *
 * Ein Traktandum kann statt einer Beschreibung eine kleine Tabelle tragen:
 * bis zu vier Spalten, beliebig viele Zeilen, und jedes Feld darf über
 * mehrere Rasterzellen reichen. Neben drei schmalen Zeilen steht so ein
 * einziges hohes Feld.
 *
 * Alles hier ist reine Rechnung ohne React und ohne Firestore – geprüft in
 * `tests/layout.test.ts`. Die eine Regel, die alles zusammenhält:
 *
 *   **Jede Rasterzelle gehört genau einem Feld.**
 *
 * `normalizeLayout()` stellt das nach jedem Eingriff wieder her – es füllt
 * Löcher mit leeren Freitextfeldern, kürzt Felder, die über den Rand oder
 * ineinander ragen, und wirft weg, was gar keinen Platz mehr hat. Jede
 * Änderung läuft am Schluss durch diese Funktion; damit muss keine der
 * übrigen den heiklen Fall selbst zu Ende denken, und ein Datensatz aus
 * Firestore darf ruhig kaputt sein.
 */

export const MAX_LAYOUT_COLUMNS = 4

/**
 * Mehr Zeilen als das trägt kein Traktandum – und eine verunglückte Zahl aus
 * Firestore soll nicht Tausende leerer Felder erzeugen.
 */
export const MAX_LAYOUT_ROWS = 30

const FIELD_KINDS: LayoutFieldKind[] = ['text', 'assignees', 'members', 'status', 'date']

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(Math.max(Math.round(value), min), max)
}

function toKind(value: unknown): LayoutFieldKind {
  return FIELD_KINDS.includes(value as LayoutFieldKind) ? (value as LayoutFieldKind) : 'text'
}

/** Ein leeres Feld an einer bestimmten Stelle. */
export function newLayoutField(
  col: number,
  row: number,
  kind: LayoutFieldKind = 'text',
): LayoutField {
  return { id: uid(), col, row, colSpan: 1, rowSpan: 1, kind }
}

/** Der Ausgangszustand: eine Zeile, zwei Spalten, alles Freitext. */
export function emptyLayout(columns = 2): ItemLayout {
  const count = clamp(columns, 1, MAX_LAYOUT_COLUMNS)
  return {
    columns: count,
    rows: 1,
    fields: Array.from({ length: count }, (_, col) => newLayoutField(col, 0)),
  }
}

/** Steht in dem Feld etwas? Beschriftungen zählen mit. */
export function isLayoutFieldEmpty(field: LayoutField): boolean {
  return (
    !field.label?.trim() && !field.text?.trim() && !field.ids?.length && !field.date && !field.done
  )
}

/** Ist im ganzen Raster nichts erfasst? */
export function isLayoutEmpty(layout: ItemLayout | null | undefined): boolean {
  return !layout || layout.fields.every(isLayoutFieldEmpty)
}

/**
 * Belegungsplan: je Rasterzelle die ID des Feldes, das sie überdeckt.
 * Nach `normalizeLayout()` steht in jeder Zelle eine ID.
 */
export function layoutGrid(layout: ItemLayout): (string | null)[][] {
  const grid: (string | null)[][] = Array.from({ length: layout.rows }, () =>
    Array<string | null>(layout.columns).fill(null),
  )
  for (const field of layout.fields) {
    for (let row = field.row; row < field.row + field.rowSpan; row++) {
      for (let col = field.col; col < field.col + field.colSpan; col++) {
        if (grid[row]?.[col] === null) grid[row][col] = field.id
      }
    }
  }
  return grid
}

/**
 * Aus irgendetwas ein gültiges Raster machen.
 *
 * Reihenfolge zählt: Gelesen wird von links oben nach rechts unten, und wer
 * zuerst kommt, behält seinen Platz. Sonst hinge bei einer Überschneidung –
 * die nur aus fehlerhaften Daten entstehen kann – davon ab, wie Firestore das
 * Array gerade sortiert hat.
 */
export function normalizeLayout(input: Partial<ItemLayout> | null | undefined): ItemLayout {
  const columns = clamp(input?.columns ?? 2, 1, MAX_LAYOUT_COLUMNS)
  const rows = clamp(input?.rows ?? 1, 1, MAX_LAYOUT_ROWS)

  const taken: (string | null)[][] = Array.from({ length: rows }, () =>
    Array<string | null>(columns).fill(null),
  )
  const free = (col: number, row: number, colSpan: number, rowSpan: number) => {
    for (let r = row; r < row + rowSpan; r++) {
      for (let c = col; c < col + colSpan; c++) if (taken[r][c]) return false
    }
    return true
  }

  const source = Array.isArray(input?.fields) ? input.fields : []
  const ordered = [...source]
    .filter((field): field is LayoutField => Boolean(field) && typeof field === 'object')
    .sort((a, b) => (a.row ?? 0) - (b.row ?? 0) || (a.col ?? 0) - (b.col ?? 0))

  const fields: LayoutField[] = []

  for (const field of ordered) {
    const col = clamp(field.col ?? 0, 0, columns - 1)
    const row = clamp(field.row ?? 0, 0, rows - 1)
    // Ausserhalb des Rasters oder auf einer schon vergebenen Zelle: Das Feld
    // fällt weg. Beim Verkleinern der Spaltenzahl ist genau das gewollt.
    if ((field.col ?? 0) >= columns || (field.row ?? 0) >= rows) continue
    if (taken[row][col]) continue

    let colSpan = clamp(field.colSpan ?? 1, 1, columns - col)
    let rowSpan = clamp(field.rowSpan ?? 1, 1, rows - row)
    while (!free(col, row, colSpan, rowSpan)) {
      if (rowSpan > 1) rowSpan--
      else if (colSpan > 1) colSpan--
      else break
    }

    for (let r = row; r < row + rowSpan; r++) {
      for (let c = col; c < col + colSpan; c++) taken[r][c] = field.id
    }

    const clean: LayoutField = {
      id: typeof field.id === 'string' && field.id ? field.id : uid(),
      col,
      row,
      colSpan,
      rowSpan,
      kind: toKind(field.kind),
    }
    if (typeof field.label === 'string' && field.label.trim()) clean.label = field.label
    if (typeof field.text === 'string' && field.text) clean.text = field.text
    if (Array.isArray(field.ids)) {
      const ids = field.ids.filter((id): id is string => typeof id === 'string' && id !== '')
      if (ids.length) clean.ids = ids
    }
    if (field.done === true) clean.done = true
    if (typeof field.date === 'string' && field.date) clean.date = field.date
    fields.push(clean)
  }

  // Was übrig bleibt, wird ein leeres Freitextfeld – ein Loch im Raster gäbe
  // eine Lücke, in die sich nichts schreiben liesse.
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      if (taken[row][col]) continue
      const field = newLayoutField(col, row)
      taken[row][col] = field.id
      fields.push(field)
    }
  }

  fields.sort((a, b) => a.row - b.row || a.col - b.col)
  return { columns, rows, fields }
}

/** Einzelne Werte eines Feldes ändern – Lage und Grösse bleiben, wie sie sind. */
export function updateLayoutField(
  layout: ItemLayout,
  id: string,
  patch: Partial<Omit<LayoutField, 'id' | 'col' | 'row' | 'colSpan' | 'rowSpan'>>,
): ItemLayout {
  return {
    ...layout,
    fields: layout.fields.map((field) => (field.id === id ? { ...field, ...patch } : field)),
  }
}

/** Eine leere Zeile unten anhängen. */
export function addLayoutRow(layout: ItemLayout): ItemLayout {
  if (layout.rows >= MAX_LAYOUT_ROWS) return layout
  return normalizeLayout({ ...layout, rows: layout.rows + 1 })
}

/**
 * Eine Zeile entfernen.
 *
 * Felder darunter rücken auf; Felder, die über die Zeile hinweg reichen,
 * werden um eine Zeile kürzer und behalten ihren Inhalt. Die letzte Zeile
 * lässt sich nicht entfernen – ein Raster ohne Zeile wäre keines.
 */
export function removeLayoutRow(layout: ItemLayout, row: number): ItemLayout {
  if (layout.rows <= 1 || row < 0 || row >= layout.rows) return layout

  const fields = layout.fields.flatMap((field) => {
    if (field.row === row) {
      // Reichte das Feld weiter nach unten, rutscht sein Inhalt eine Zeile
      // hoch; endete es hier, verschwindet es.
      return field.rowSpan > 1 ? [{ ...field, rowSpan: field.rowSpan - 1 }] : []
    }
    if (field.row > row) return [{ ...field, row: field.row - 1 }]
    if (field.row + field.rowSpan > row) return [{ ...field, rowSpan: field.rowSpan - 1 }]
    return [field]
  })

  return normalizeLayout({ ...layout, rows: layout.rows - 1, fields })
}

/**
 * Die Spaltenzahl setzen.
 *
 * Beim Verkleinern fällt weg, was rechts über den neuen Rand ragt – deshalb
 * fragt die Oberfläche vorher nach, wenn dort etwas steht (siehe
 * `layoutLossOnColumns`).
 */
export function setLayoutColumns(layout: ItemLayout, columns: number): ItemLayout {
  return normalizeLayout({ ...layout, columns: clamp(columns, 1, MAX_LAYOUT_COLUMNS) })
}

/** Was beim Verkleinern auf `columns` Spalten verloren ginge. */
export function layoutLossOnColumns(layout: ItemLayout, columns: number): LayoutField[] {
  if (columns >= layout.columns) return []
  return layout.fields.filter((field) => field.col >= columns && !isLayoutFieldEmpty(field))
}

export type MergeDirection = 'right' | 'down'

/**
 * Die Felder, die beim Verbinden aufgehen würden – oder `null`, wenn es
 * nicht geht.
 *
 * Verbunden wird immer um genau eine Zeile bzw. Spalte, und nur mit Feldern,
 * die den Block sauber abschliessen: gleich breit bzw. gleich hoch wie der
 * Rand, an den sie stossen. Alles andere gäbe ein Raster mit Treppen darin,
 * und das lässt sich weder zeichnen noch wieder auftrennen.
 */
export function mergeCandidates(
  layout: ItemLayout,
  id: string,
  direction: MergeDirection,
): LayoutField[] | null {
  const target = layout.fields.find((field) => field.id === id)
  if (!target) return null

  if (direction === 'down') {
    const row = target.row + target.rowSpan
    if (row >= layout.rows) return null
    const strip = layout.fields.filter(
      (field) =>
        field.row === row &&
        field.col >= target.col &&
        field.col + field.colSpan <= target.col + target.colSpan,
    )
    const covered = strip.reduce((sum, field) => sum + field.colSpan, 0)
    // Alle Felder der Zeile darunter müssen genau die Breite des Blocks
    // abdecken und dürfen nicht selbst schon mehrzeilig sein.
    if (covered !== target.colSpan || strip.some((field) => field.rowSpan !== 1)) return null
    return strip
  }

  const col = target.col + target.colSpan
  if (col >= layout.columns) return null
  const strip = layout.fields.filter(
    (field) =>
      field.col === col &&
      field.row >= target.row &&
      field.row + field.rowSpan <= target.row + target.rowSpan,
  )
  const covered = strip.reduce((sum, field) => sum + field.rowSpan, 0)
  if (covered !== target.rowSpan || strip.some((field) => field.colSpan !== 1)) return null
  return strip
}

export function canMergeLayoutField(
  layout: ItemLayout,
  id: string,
  direction: MergeDirection,
): boolean {
  return mergeCandidates(layout, id, direction) !== null
}

/**
 * Ein Feld um eine Zeile bzw. Spalte wachsen lassen.
 *
 * Was in den aufgehenden Feldern stand, wird übernommen und nicht
 * weggeworfen: Texte hängen sich untereinander an, Personen kommen dazu.
 * Verbinden ist ein Handgriff am Layout und darf keine Arbeit kosten.
 */
export function mergeLayoutField(
  layout: ItemLayout,
  id: string,
  direction: MergeDirection,
): ItemLayout {
  const absorbed = mergeCandidates(layout, id, direction)
  if (!absorbed) return layout
  const eaten = new Set(absorbed.map((field) => field.id))

  const fields = layout.fields
    .filter((field) => !eaten.has(field.id))
    .map((field) => {
      if (field.id !== id) return field

      const texts = [field.text, ...absorbed.map((other) => other.text)]
        .map((text) => text?.trim())
        .filter((text): text is string => Boolean(text))
      const ids = [...new Set([...(field.ids ?? []), ...absorbed.flatMap((o) => o.ids ?? [])])]

      const grown: LayoutField = {
        ...field,
        colSpan: direction === 'right' ? field.colSpan + 1 : field.colSpan,
        rowSpan: direction === 'down' ? field.rowSpan + 1 : field.rowSpan,
      }
      if (texts.length) grown.text = texts.join('\n')
      if (ids.length) grown.ids = ids
      if (field.done || absorbed.some((other) => other.done)) grown.done = true
      const date = field.date ?? absorbed.find((other) => other.date)?.date
      if (date) grown.date = date
      return grown
    })

  return normalizeLayout({ ...layout, fields })
}

/**
 * Ein verbundenes Feld wieder auftrennen.
 *
 * Der Inhalt bleibt beim Feld links oben; die frei werdenden Zellen füllt
 * `normalizeLayout()` mit leeren Freitextfeldern.
 */
export function splitLayoutField(layout: ItemLayout, id: string): ItemLayout {
  const fields = layout.fields.map((field) =>
    field.id === id ? { ...field, colSpan: 1, rowSpan: 1 } : field,
  )
  return normalizeLayout({ ...layout, fields })
}

/**
 * Für Firestore: nur gesetzte Schlüssel.
 *
 * Ein `undefined` irgendwo im Objekt lässt den ganzen Schreibvorgang
 * scheitern – und `stripUndefined()` reicht nicht, weil es nur die oberste
 * Ebene abräumt.
 */
export function serializeLayout(layout: ItemLayout): ItemLayout {
  return {
    columns: layout.columns,
    rows: layout.rows,
    fields: layout.fields.map((field) => {
      const stored: LayoutField = {
        id: field.id,
        col: field.col,
        row: field.row,
        colSpan: field.colSpan,
        rowSpan: field.rowSpan,
        kind: field.kind,
      }
      if (field.label?.trim()) stored.label = field.label.trim()
      if (field.text) stored.text = field.text
      if (field.ids?.length) stored.ids = field.ids
      if (field.done) stored.done = true
      if (field.date) stored.date = field.date
      return stored
    }),
  }
}

/**
 * Das Raster als Text – für Suche und Protokoll.
 *
 * Zeilenweise, Felder mit Tabulator getrennt, wie man eine Tabelle abtippen
 * würde. Personen stehen mit Namen da, sofern der Aufrufer sie auflösen kann.
 *
 * Auszeichnungen fallen weg (`plainText`): Weder die Suche noch das Papier
 * haben etwas davon, dass ein Wort gelb hinterlegt war.
 */
export function layoutToText(
  layout: ItemLayout,
  resolve?: (id: string) => string | undefined,
): string {
  const grid = layoutGrid(layout)
  const byId = new Map(layout.fields.map((field) => [field.id, field]))

  const text = grid
    .map((row, rowIndex) =>
      row
        // Ein hohes Feld steht nur in der Zeile, in der es beginnt.
        .filter((id, colIndex) => {
          const field = id ? byId.get(id) : undefined
          return Boolean(field) && field!.row === rowIndex && field!.col === colIndex
        })
        .map((id) => layoutFieldToText(byId.get(id!)!, resolve))
        .join('\t')
        .trimEnd(),
    )
    .filter((line) => line !== '')
    .join('\n')

  return plainText(text)
}

/** Ein einzelnes Feld als Text – die Beschriftung bleibt weg. */
export function layoutFieldToText(
  field: LayoutField,
  resolve?: (id: string) => string | undefined,
): string {
  switch (field.kind) {
    case 'status':
      return field.done ? 'Erledigt' : 'Pendent'
    case 'date':
      return field.date ?? ''
    case 'assignees':
    case 'members':
      return (field.ids ?? []).map((id) => resolve?.(id) ?? id).join(', ')
    default:
      return field.text?.trim() ?? ''
  }
}
