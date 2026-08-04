import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  addLayoutRow,
  canMergeLayoutField,
  emptyLayout,
  isLayoutEmpty,
  layoutGrid,
  layoutLossOnColumns,
  layoutToText,
  mergeLayoutField,
  normalizeLayout,
  removeLayoutRow,
  serializeLayout,
  setLayoutColumns,
  splitLayoutField,
  updateLayoutField,
} from '../src/lib/layout.ts'
import type { ItemLayout, LayoutField } from '../src/lib/types.ts'

/*
 * Läuft ohne Bundler direkt in Node: `npm run test:import`.
 *
 * Das variable Layout steht und fällt mit einer einzigen Zusicherung: Jede
 * Rasterzelle gehört genau einem Feld. Verbinden, trennen, Zeilen und
 * Spalten ändern – jeder dieser Griffe könnte sie brechen, und ein Loch im
 * Raster wäre eine Fläche, in die sich nichts schreiben lässt. Deshalb
 * prüft fast jeder Test hier am Ende dasselbe: Ist das Raster noch dicht?
 */

/** Deckt jedes Feld genau die Zellen ab, die ihm gehören – und keine zweimal? */
function assertDicht(layout: ItemLayout, hinweis = '') {
  const seen = new Map<string, number>()
  for (const field of layout.fields) {
    for (let row = field.row; row < field.row + field.rowSpan; row++) {
      for (let col = field.col; col < field.col + field.colSpan; col++) {
        assert.ok(
          row < layout.rows && col < layout.columns,
          `${hinweis}: Feld ragt über das Raster hinaus (${col}/${row})`,
        )
        const key = `${col}/${row}`
        assert.equal(seen.get(key), undefined, `${hinweis}: Zelle ${key} doppelt belegt`)
        seen.set(key, 1)
      }
    }
  }
  assert.equal(
    seen.size,
    layout.columns * layout.rows,
    `${hinweis}: Nicht jede Zelle ist belegt (${seen.size} von ${layout.columns * layout.rows})`,
  )
  const ids = new Set(layout.fields.map((field) => field.id))
  assert.equal(ids.size, layout.fields.length, `${hinweis}: IDs sind nicht eindeutig`)
}

/** Das Feld an einer bestimmten Stelle. */
function at(layout: ItemLayout, col: number, row: number): LayoutField {
  const field = layout.fields.find((f) => f.col === col && f.row === row)
  assert.ok(field, `Kein Feld an ${col}/${row}`)
  return field
}

/* --- Grundzustand --------------------------------------------------- */

test('das leere Raster hat eine Zeile und lauter Freitextfelder', () => {
  const layout = emptyLayout(3)
  assert.equal(layout.columns, 3)
  assert.equal(layout.rows, 1)
  assert.equal(layout.fields.length, 3)
  assert.ok(layout.fields.every((field) => field.kind === 'text'))
  assert.ok(isLayoutEmpty(layout))
  assertDicht(layout, 'emptyLayout')
})

test('mehr als vier Spalten gibt es nicht', () => {
  assert.equal(emptyLayout(9).columns, 4)
  assert.equal(emptyLayout(0).columns, 1)
})

/* --- Geradeziehen ---------------------------------------------------- */

test('normalizeLayout füllt Löcher mit leeren Freitextfeldern', () => {
  const layout = normalizeLayout({ columns: 3, rows: 2, fields: [] })
  assert.equal(layout.fields.length, 6)
  assertDicht(layout, 'nur Löcher')
})

test('normalizeLayout kürzt Felder, die über den Rand ragen', () => {
  const layout = normalizeLayout({
    columns: 2,
    rows: 2,
    fields: [{ id: 'a', col: 1, row: 0, colSpan: 3, rowSpan: 5, kind: 'text' }],
  })
  const feld = at(layout, 1, 0)
  assert.equal(feld.colSpan, 1)
  assert.equal(feld.rowSpan, 2)
  assertDicht(layout, 'übergross')
})

test('normalizeLayout wirft weg, was ausserhalb des Rasters liegt', () => {
  const layout = normalizeLayout({
    columns: 2,
    rows: 1,
    fields: [
      { id: 'drin', col: 0, row: 0, colSpan: 1, rowSpan: 1, kind: 'text', text: 'bleibt' },
      { id: 'draussen', col: 5, row: 0, colSpan: 1, rowSpan: 1, kind: 'text', text: 'weg' },
    ],
  })
  assert.equal(
    layout.fields.find((field) => field.id === 'draussen'),
    undefined,
  )
  assert.equal(at(layout, 0, 0).text, 'bleibt')
  assertDicht(layout, 'ausserhalb')
})

test('bei Überschneidung behält das Feld links oben seinen Platz', () => {
  const layout = normalizeLayout({
    columns: 2,
    rows: 2,
    fields: [
      { id: 'hoch', col: 0, row: 0, colSpan: 1, rowSpan: 2, kind: 'text', text: 'zuerst' },
      { id: 'stört', col: 0, row: 1, colSpan: 1, rowSpan: 1, kind: 'text', text: 'danach' },
    ],
  })
  assert.equal(at(layout, 0, 0).rowSpan, 2)
  assert.equal(
    layout.fields.find((field) => field.id === 'stört'),
    undefined,
  )
  assertDicht(layout, 'Überschneidung')
})

test('unbekannte Feldarten werden zu Freitext', () => {
  const layout = normalizeLayout({
    columns: 1,
    rows: 1,
    fields: [{ id: 'a', col: 0, row: 0, colSpan: 1, rowSpan: 1, kind: 'raketenstart' as never }],
  })
  assert.equal(at(layout, 0, 0).kind, 'text')
})

test('kaputte Zahlen aus Firestore ergeben trotzdem ein Raster', () => {
  const layout = normalizeLayout({
    columns: Number.NaN,
    rows: -4,
    fields: [{ id: 'a', col: Number.NaN, row: 2.6, colSpan: 0, rowSpan: -1, kind: 'text' }],
  })
  assert.ok(layout.columns >= 1 && layout.rows >= 1)
  assertDicht(layout, 'kaputte Zahlen')
})

/* --- Zeilen ---------------------------------------------------------- */

test('eine Zeile kommt dazu und ist leer', () => {
  const layout = addLayoutRow(emptyLayout(2))
  assert.equal(layout.rows, 2)
  assert.equal(layout.fields.length, 4)
  assertDicht(layout, 'Zeile dazu')
})

test('eine Zeile entfernen lässt die darunter aufrücken', () => {
  let layout = addLayoutRow(addLayoutRow(emptyLayout(1)))
  layout = updateLayoutField(layout, at(layout, 0, 0).id, { text: 'oben' })
  layout = updateLayoutField(layout, at(layout, 0, 2).id, { text: 'unten' })

  layout = removeLayoutRow(layout, 1)
  assert.equal(layout.rows, 2)
  assert.equal(at(layout, 0, 0).text, 'oben')
  assert.equal(at(layout, 0, 1).text, 'unten')
  assertDicht(layout, 'Zeile entfernt')
})

test('die letzte Zeile lässt sich nicht entfernen', () => {
  const layout = emptyLayout(2)
  assert.equal(removeLayoutRow(layout, 0), layout)
})

test('ein hohes Feld wird kürzer, statt zu verschwinden', () => {
  let layout = addLayoutRow(addLayoutRow(emptyLayout(2)))
  const hoch = at(layout, 0, 0).id
  layout = updateLayoutField(layout, hoch, { text: 'Vorgeschichte' })
  layout = mergeLayoutField(layout, hoch, 'down')
  layout = mergeLayoutField(layout, hoch, 'down')
  assert.equal(at(layout, 0, 0).rowSpan, 3)

  // Die mittlere Zeile fällt weg – das Feld reicht noch über zwei.
  layout = removeLayoutRow(layout, 1)
  assert.equal(at(layout, 0, 0).rowSpan, 2)
  assert.equal(at(layout, 0, 0).text, 'Vorgeschichte')
  assertDicht(layout, 'hohes Feld gekürzt')
})

/* --- Spalten --------------------------------------------------------- */

test('mehr Spalten bringen leere Felder mit', () => {
  const layout = setLayoutColumns(addLayoutRow(emptyLayout(1)), 3)
  assert.equal(layout.columns, 3)
  assert.equal(layout.fields.length, 6)
  assertDicht(layout, 'Spalten dazu')
})

test('weniger Spalten schneiden rechts ab – und werden vorher gemeldet', () => {
  let layout = emptyLayout(3)
  layout = updateLayoutField(layout, at(layout, 2, 0).id, { text: 'ganz rechts' })

  const verlust = layoutLossOnColumns(layout, 2)
  assert.equal(verlust.length, 1)
  assert.equal(verlust[0].text, 'ganz rechts')

  const kleiner = setLayoutColumns(layout, 2)
  assert.equal(kleiner.columns, 2)
  assert.ok(!kleiner.fields.some((field) => field.text === 'ganz rechts'))
  assertDicht(kleiner, 'Spalten weg')
})

test('leere Spalten werden ohne Rückfrage entfernt', () => {
  assert.deepEqual(layoutLossOnColumns(emptyLayout(4), 1), [])
})

/* --- Verbinden und trennen ------------------------------------------- */

test('nach unten verbinden ergibt das hohe Feld neben drei schmalen', () => {
  // Der vom Nutzer beschriebene Fall: links drei Zeilen, rechts ein Feld
  // über alle drei.
  let layout = addLayoutRow(addLayoutRow(emptyLayout(2)))
  const rechts = at(layout, 1, 0).id
  layout = mergeLayoutField(layout, rechts, 'down')
  layout = mergeLayoutField(layout, rechts, 'down')

  const feld = at(layout, 1, 0)
  assert.equal(feld.rowSpan, 3)
  assert.equal(feld.colSpan, 1)
  assert.equal(layout.fields.length, 4) // drei links, eines rechts
  assertDicht(layout, 'drei hoch')
})

test('nach rechts verbinden über die ganze Breite', () => {
  let layout = emptyLayout(4)
  const erstes = at(layout, 0, 0).id
  for (let i = 0; i < 3; i++) layout = mergeLayoutField(layout, erstes, 'right')

  assert.equal(layout.fields.length, 1)
  assert.equal(at(layout, 0, 0).colSpan, 4)
  assertDicht(layout, 'ganze Breite')
})

test('am Rand lässt sich nicht verbinden', () => {
  const layout = emptyLayout(2)
  assert.equal(canMergeLayoutField(layout, at(layout, 1, 0).id, 'right'), false)
  assert.equal(canMergeLayoutField(layout, at(layout, 0, 0).id, 'down'), false)
  // Unverändert, wenn es trotzdem versucht wird.
  assert.equal(mergeLayoutField(layout, at(layout, 0, 0).id, 'down'), layout)
})

test('ein hoher Nachbar lässt sich nicht anschneiden', () => {
  // Mitte ein Feld über beide Zeilen. Das Feld links davon ist nur eine
  // Zeile hoch – verbände es sich nach rechts, entstünde eine Treppe.
  let layout = addLayoutRow(emptyLayout(3))
  layout = mergeLayoutField(layout, at(layout, 1, 0).id, 'down')

  assert.equal(canMergeLayoutField(layout, at(layout, 0, 0).id, 'right'), false)
  assert.equal(mergeLayoutField(layout, at(layout, 0, 0).id, 'right'), layout)
  assertDicht(layout, 'hoher Nachbar')
})

test('ein breiter Nachbar unten lässt sich nicht anschneiden', () => {
  // Untere Zeile: ein Feld über die ersten beiden Spalten. Das schmale Feld
  // darüber kann nicht nach unten – es träfe auf mehr Breite, als es hat.
  let layout = addLayoutRow(emptyLayout(3))
  layout = mergeLayoutField(layout, at(layout, 0, 1).id, 'right')

  assert.equal(canMergeLayoutField(layout, at(layout, 0, 0).id, 'down'), false)
  // Das breite Feld darüber ginge dagegen: Es deckt genau dieselben Spalten ab.
  let breit = addLayoutRow(emptyLayout(3))
  const oben = at(breit, 0, 0).id
  breit = mergeLayoutField(breit, oben, 'right')
  assert.equal(canMergeLayoutField(breit, oben, 'down'), true)
  assertDicht(layout, 'breiter Nachbar')
})

test('ein hohes Feld nimmt eine ganze Spalte auf einmal auf', () => {
  // Links über beide Zeilen, rechts zwei einzelne – zusammen ergibt das
  // genau die Höhe des hohen Feldes, also darf es sie schlucken.
  let layout = addLayoutRow(emptyLayout(2))
  const links = at(layout, 0, 0).id
  layout = mergeLayoutField(layout, links, 'down')
  assert.equal(canMergeLayoutField(layout, links, 'right'), true)

  layout = mergeLayoutField(layout, links, 'right')
  assert.equal(layout.fields.length, 1)
  assert.equal(at(layout, 0, 0).colSpan, 2)
  assert.equal(at(layout, 0, 0).rowSpan, 2)
  assertDicht(layout, 'ganze Spalte geschluckt')
})

test('verbinden nimmt den Inhalt der aufgehenden Felder mit', () => {
  let layout = emptyLayout(3)
  layout = updateLayoutField(layout, at(layout, 0, 0).id, { text: 'links' })
  layout = updateLayoutField(layout, at(layout, 1, 0).id, { text: 'mitte', ids: ['m1'] })

  const erstes = at(layout, 0, 0).id
  layout = mergeLayoutField(layout, erstes, 'right')

  const feld = at(layout, 0, 0)
  assert.equal(feld.text, 'links\nmitte')
  assert.deepEqual(feld.ids, ['m1'])
  assertDicht(layout, 'Inhalt übernommen')
})

test('trennen gibt die Zellen wieder frei und lässt den Inhalt oben links', () => {
  let layout = addLayoutRow(emptyLayout(2))
  const feld = at(layout, 0, 0).id
  layout = updateLayoutField(layout, feld, { text: 'bleibt' })
  layout = mergeLayoutField(layout, feld, 'down')
  layout = mergeLayoutField(layout, feld, 'right')
  assert.equal(at(layout, 0, 0).colSpan, 2)
  assert.equal(at(layout, 0, 0).rowSpan, 2)

  layout = splitLayoutField(layout, feld)
  assert.equal(layout.fields.length, 4)
  assert.equal(at(layout, 0, 0).text, 'bleibt')
  assert.ok(layout.fields.every((f) => f.colSpan === 1 && f.rowSpan === 1))
  assertDicht(layout, 'getrennt')
})

/* --- Belegungsplan --------------------------------------------------- */

test('der Belegungsplan nennt für jede Zelle ihr Feld', () => {
  let layout = addLayoutRow(emptyLayout(2))
  const hoch = at(layout, 1, 0).id
  layout = mergeLayoutField(layout, hoch, 'down')

  const grid = layoutGrid(layout)
  assert.equal(grid.length, 2)
  assert.equal(grid[0][1], hoch)
  assert.equal(grid[1][1], hoch)
  assert.notEqual(grid[0][0], grid[1][0])
})

/* --- Speichern und Ausgeben ------------------------------------------ */

test('serializeLayout lässt kein undefined stehen', () => {
  let layout = emptyLayout(2)
  layout = updateLayoutField(layout, at(layout, 0, 0).id, {
    label: '  Aufgabe  ',
    text: 'etwas',
    ids: [],
    done: false,
  })

  const stored = serializeLayout(layout)
  for (const field of stored.fields) {
    for (const [key, value] of Object.entries(field)) {
      assert.notEqual(value, undefined, `${key} ist undefined`)
    }
  }
  // Leeres wird gar nicht erst geschrieben, Beschriftungen ohne Leerraum.
  assert.equal(stored.fields[0].label, 'Aufgabe')
  assert.equal('ids' in stored.fields[0], false)
  assert.equal('done' in stored.fields[0], false)
  assert.equal('text' in stored.fields[1], false)
})

test('das Raster lässt sich als Text lesen', () => {
  let layout = addLayoutRow(emptyLayout(2))
  layout = updateLayoutField(layout, at(layout, 0, 0).id, { text: 'Dachsanierung' })
  layout = updateLayoutField(layout, at(layout, 1, 0).id, { kind: 'assignees', ids: ['u1'] })
  layout = updateLayoutField(layout, at(layout, 0, 1).id, { kind: 'status', done: true })
  layout = updateLayoutField(layout, at(layout, 1, 1).id, { kind: 'date', date: '2026-08-04' })

  const text = layoutToText(layout, (id) => (id === 'u1' ? 'Peter Meier' : undefined))
  assert.equal(text, 'Dachsanierung\tPeter Meier\nErledigt\t2026-08-04')
})

test('ein hohes Feld steht im Text nur einmal', () => {
  let layout = addLayoutRow(emptyLayout(2))
  const hoch = at(layout, 1, 0).id
  layout = mergeLayoutField(layout, hoch, 'down')
  layout = updateLayoutField(layout, hoch, { text: 'über beide Zeilen' })
  layout = updateLayoutField(layout, at(layout, 0, 0).id, { text: 'eins' })
  layout = updateLayoutField(layout, at(layout, 0, 1).id, { text: 'zwei' })

  assert.equal(layoutToText(layout), 'eins\tüber beide Zeilen\nzwei')
})

test('ein leeres Raster ergibt keinen Text', () => {
  assert.equal(layoutToText(emptyLayout(3)), '')
})
