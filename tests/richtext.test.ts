import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  applyMark,
  autoListBlock,
  changeIndent,
  clearMarks,
  docFromPlain,
  docOfValue,
  editLengthOf,
  editTextOf,
  isPlainDoc,
  listStateAt,
  marksAt,
  normalizeDoc,
  parseRichJson,
  plainTextOf,
  replaceRange,
  richDocFor,
  serializeDoc,
  toRichValue,
  toggleList,
  trimRichValue,
  wordRangeAt,
  type RichDoc,
} from '../src/lib/richtext.ts'

/*
 * Der formatierte Text lebt von einer einzigen Zusage: Die Projektion des
 * Formatfelds entspricht Zeichen für Zeichen dem gespeicherten Text – sonst
 * wird unformatiert gezeigt. Diese Tests prüfen die Zusage und die
 * Werkzeuge, die auf ihr rechnen (Bereiche, Marken, Listen): alles reine
 * Rechnerei ohne Browser, und genau die Art Code, bei der ein
 * Ein-Zeichen-Fehler still Formatierungen verwerfen würde.
 */

const doc = (input: RichDoc) => normalizeDoc(input)

test('plainTextOf: Listenpunkte tragen Zeichen und Einzug', () => {
  const value: RichDoc = {
    blocks: [
      { runs: [{ t: 'Titel' }] },
      { list: 1, runs: [{ t: 'Milch' }] },
      { list: 2, runs: [{ t: 'Butter' }] },
      { list: 2, runs: [] },
      { runs: [] },
    ],
  }
  assert.equal(plainTextOf(value), 'Titel\n• Milch\n  ◦ Butter\n  ◦\n')
  assert.equal(editTextOf(value), 'Titel\nMilch\nButter\n\n')
  assert.equal(editLengthOf(value), editTextOf(value).length)
})

test('Rundreise: serialisieren, einlesen, Projektion bleibt gleich', () => {
  const value = doc({
    blocks: [
      { runs: [{ t: 'Hallo ' }, { t: 'Welt', b: true, color: 'red' }] },
      { runs: [{ t: 'kursiv', i: true }, { t: ' und ' }, { t: 'unterstrichen', u: true }] },
      { list: 1, runs: [{ t: 'Punkt', bg: 'yellow', who: 'uid-1' }] },
    ],
  })
  const json = serializeDoc(value)
  const back = parseRichJson(json)
  assert.ok(back)
  assert.deepEqual(back, value)
  assert.equal(plainTextOf(back), plainTextOf(value))
})

test('richDocFor: passt der Text nicht mehr, gilt er allein', () => {
  const value = doc({ blocks: [{ runs: [{ t: 'Hallo', b: true }] }] })
  const json = serializeDoc(value)
  assert.ok(richDocFor(json, 'Hallo'))
  assert.equal(richDocFor(json, 'Hallo!'), null)
  assert.equal(richDocFor(null, 'Hallo'), null)
  assert.equal(richDocFor('kaputt{', 'Hallo'), null)
})

test('parseRichJson: Unbekanntes im Kleinen fällt weg, im Grossen alles', () => {
  const kaputt = parseRichJson(JSON.stringify({ v: 99, blocks: [] }))
  assert.equal(kaputt, null)

  const fremdeFarbe = parseRichJson(
    JSON.stringify({
      v: 1,
      blocks: [{ runs: [{ t: 'Hi', color: 'neon', bg: 'yellow', x: 1 }] }],
    }),
  )
  assert.ok(fremdeFarbe)
  assert.deepEqual(fremdeFarbe.blocks[0].runs, [{ t: 'Hi', bg: 'yellow' }])
})

test('toRichValue: Unformatiertes speichert kein Formatfeld', () => {
  const plain = toRichValue(docFromPlain('Zeile 1\nZeile 2'))
  assert.equal(plain.rich, null)
  assert.equal(plain.text, 'Zeile 1\nZeile 2')

  const formatiert = toRichValue(doc({ blocks: [{ runs: [{ t: 'Fett', b: true }] }] }))
  assert.ok(formatiert.rich)
  assert.equal(formatiert.text, 'Fett')
  assert.ok(richDocFor(formatiert.rich, formatiert.text))
})

test('docOfValue: gültiges Formatfeld gewinnt, ungültiges fällt auf Text zurück', () => {
  const value = toRichValue(doc({ blocks: [{ runs: [{ t: 'Bunt', color: 'blue' }] }] }))
  assert.equal(isPlainDoc(docOfValue(value)), false)

  const stale = docOfValue({ text: 'Anderer Text', rich: value.rich })
  assert.ok(isPlainDoc(stale))
  assert.equal(editTextOf(stale), 'Anderer Text')
})

test('applyMark: setzt und entfernt über Blockgrenzen hinweg', () => {
  const base = docFromPlain('Hallo Welt\nZweite Zeile')
  // «Welt\nZwei» fett: Zeichen 6–15
  const bold = applyMark(base, 6, 15, 'b', true)
  assert.equal(plainTextOf(bold), 'Hallo Welt\nZweite Zeile')
  assert.deepEqual(bold.blocks[0].runs, [{ t: 'Hallo ' }, { t: 'Welt', b: true }])
  assert.deepEqual(bold.blocks[1].runs, [{ t: 'Zwei', b: true }, { t: 'te Zeile' }])
  assert.deepEqual(marksAt(bold, 8, 8), { b: true })

  const wieder = applyMark(bold, 0, editLengthOf(bold), 'b', null)
  assert.ok(isPlainDoc(wieder))
})

test('clearMarks: nimmt alle Marken, lässt die Liste stehen', () => {
  const base = doc({
    blocks: [{ list: 2, runs: [{ t: 'Bunt', color: 'red', bg: 'yellow', who: 'u1' }] }],
  })
  const clean = clearMarks(base, 0, 4)
  assert.deepEqual(clean.blocks[0], { list: 2, runs: [{ t: 'Bunt' }] })
})

test('toggleList und changeIndent: Absatz ↔ Punkt, Ebenen 1–4', () => {
  const base = docFromPlain('Eins\nZwei')
  const list = toggleList(base, 0, editLengthOf(base))
  assert.deepEqual(
    list.blocks.map((block) => block.list),
    [1, 1],
  )
  assert.equal(plainTextOf(list), '• Eins\n• Zwei')

  const deeper = changeIndent(list, 5, 5, 1)
  assert.deepEqual(
    deeper.blocks.map((block) => block.list),
    [1, 2],
  )
  assert.equal(listStateAt(deeper, 5, 5).level, 2)

  // Ausrücken auf Ebene 1 macht wieder einen Absatz.
  const flat = changeIndent(changeIndent(deeper, 5, 5, -1), 5, 5, -1)
  assert.equal(flat.blocks[1].list, undefined)

  // Zurückschalten nimmt die Listenform ganz weg.
  const off = toggleList(list, 0, editLengthOf(list))
  assert.ok(off.blocks.every((block) => !block.list))
})

test('replaceRange: erbt Marken und Listenebene, meldet den Cursor', () => {
  const base = doc({ blocks: [{ list: 1, runs: [{ t: 'Hallo ', b: true }, { t: 'Welt' }] }] })
  const { doc: next, caret } = replaceRange(base, 6, 6, 'schöne ')
  assert.equal(editTextOf(next), 'Hallo schöne Welt')
  assert.equal(caret, 13)
  // Eingesetzt mit den Marken des Zeichens davor – fett.
  assert.deepEqual(next.blocks[0].runs[0], { t: 'Hallo schöne ', b: true })

  const mehrzeilig = replaceRange(base, 6, 10, 'A\nB')
  assert.equal(editTextOf(mehrzeilig.doc), 'Hallo A\nB')
  assert.deepEqual(
    mehrzeilig.doc.blocks.map((block) => block.list),
    [1, 1],
  )
})

test('trimRichValue: beschneidet Text und Formatfeld gemeinsam', () => {
  const value = toRichValue(doc({ blocks: [{ runs: [{ t: '  Titel ', b: true }] }] }))
  const trimmed = trimRichValue(value)
  assert.equal(trimmed.text, 'Titel')
  assert.ok(trimmed.rich)
  assert.ok(richDocFor(trimmed.rich, trimmed.text))

  // Ohne Formatfeld bleibt es beim gewohnten trim().
  assert.deepEqual(trimRichValue({ text: '  x ', rich: null }), { text: 'x', rich: null })
})

test('autoListBlock: «- » am Zeilenanfang wird zum Listenpunkt', () => {
  // «- Milch», Cursor hinter dem Leerschlag (Zeile 2, Stelle 5+2).
  const base = docFromPlain('Kopf\n- Milch')
  const auto = autoListBlock(base, 7)
  assert.ok(auto)
  assert.equal(editTextOf(auto.doc), 'Kopf\nMilch')
  assert.equal(auto.doc.blocks[1].list, 1)
  assert.equal(auto.caret, 5)

  // Nur unmittelbar hinter dem «- »: mitten im Wort oder am Ende nicht.
  assert.equal(autoListBlock(base, 9), null)
  // Nur am Zeilenanfang eines Absatzes – nicht in einer bestehenden Liste.
  const list = doc({ blocks: [{ list: 1, runs: [{ t: '- x' }] }] })
  assert.equal(autoListBlock(list, 2), null)
  // Ohne «- » kein Fall.
  assert.equal(autoListBlock(docFromPlain('ab'), 2), null)
})

test('wordRangeAt: findet das Wort unter dem Cursor', () => {
  assert.deepEqual(wordRangeAt('Hallo Welt', 7), { start: 6, end: 10 })
  assert.deepEqual(wordRangeAt('Hallo Welt', 5), { start: 0, end: 5 })
  assert.equal(wordRangeAt('Hallo  Welt', 6), null)
})
