import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  applyColor,
  formatOf,
  hasBullets,
  parseFormat,
  plainText,
  richLines,
  toggleBullets,
} from '../src/lib/textFormat.ts'

/*
 * Läuft ohne Bundler direkt in Node: `npm run test:import`.
 *
 * Geprüft wird das Versprechen der Auszeichnung: Der Text bleibt ein Text.
 * Was gespeichert wird, lässt sich wieder lesen; was gelesen wird, ist ohne
 * Markierung dasselbe wie vorher; und wer eine Farbe wegnimmt, bekommt genau
 * das zurück, was er vorher hatte.
 */

/* ------------------------------------------------------------------ */
/* Lesen                                                               */
/* ------------------------------------------------------------------ */

test('trennt Text und Auszeichnung', () => {
  const parsed = parseFormat('Das ist {{rot|dringend}} und sonst nichts')
  assert.equal(parsed.text, 'Das ist dringend und sonst nichts')
  assert.deepEqual(parsed.spans, [{ start: 8, end: 16, color: 'rot', background: undefined }])
})

test('kennt Schrift, Hintergrund und beides zusammen', () => {
  assert.deepEqual(parseFormat('{{rot|a}}').spans[0], {
    start: 0,
    end: 1,
    color: 'rot',
    background: undefined,
  })
  assert.deepEqual(parseFormat('{{/gelb|a}}').spans[0], {
    start: 0,
    end: 1,
    color: undefined,
    background: 'gelb',
  })
  assert.deepEqual(parseFormat('{{rot/gelb|a}}').spans[0], {
    start: 0,
    end: 1,
    color: 'rot',
    background: 'gelb',
  })
})

test('eine unbekannte Farbe bleibt Text und verschluckt nichts', () => {
  assert.equal(plainText('{{knallgrün|Text}}'), '{{knallgrün|Text}}')
  assert.equal(
    plainText('Vorher {{blubb|mittendrin}} nachher'),
    'Vorher {{blubb|mittendrin}} nachher',
  )
})

test('plainText lässt gewöhnlichen Text in Ruhe', () => {
  assert.equal(plainText('Nichts Besonderes'), 'Nichts Besonderes')
  assert.equal(plainText(''), '')
  assert.equal(plainText(null), '')
  assert.equal(plainText('a {{rot|b}} c'), 'a b c')
})

/* ------------------------------------------------------------------ */
/* Farben setzen                                                       */
/* ------------------------------------------------------------------ */

test('färbt die Auswahl und lässt den Rest stehen', () => {
  const { text } = applyColor('Peter kommt später', 0, 5, 'color', 'rot')
  assert.equal(text, '{{rot|Peter}} kommt später')
})

test('die Auswahl bleibt auf demselben Stück Text stehen', () => {
  const next = applyColor('Peter kommt später', 0, 5, 'color', 'rot')
  assert.equal(next.text.slice(next.start, next.end), 'Peter')
})

test('rechnet die Auswahl in den bereits ausgezeichneten Text um', () => {
  const raw = '{{rot|Peter}} kommt später'
  // «kommt» steht im geschriebenen Text an Stelle 14 bis 19.
  assert.equal(raw.slice(14, 19), 'kommt')
  const next = applyColor(raw, 14, 19, 'background', 'gelb')
  assert.equal(next.text, '{{rot|Peter}} {{/gelb|kommt}} später')
  assert.equal(next.text.slice(next.start, next.end), 'kommt')
})

test('legt Schrift- und Hintergrundfarbe übereinander', () => {
  const rot = applyColor('dringend', 0, 8, 'color', 'rot')
  const beides = applyColor(rot.text, rot.start, rot.end, 'background', 'gelb')
  assert.equal(beides.text, '{{rot/gelb|dringend}}')
  assert.equal(plainText(beides.text), 'dringend')
})

test('nimmt nur die eine Eigenschaft zurück', () => {
  const ohneHintergrund = applyColor('{{rot/gelb|dringend}}', 11, 19, 'background', null)
  assert.equal(ohneHintergrund.text, '{{rot|dringend}}')
  const ohneAlles = applyColor(ohneHintergrund.text, 6, 14, 'color', null)
  assert.equal(ohneAlles.text, 'dringend')
})

test('eine Auswahl mitten in einer Auszeichnung teilt sie auf', () => {
  const { text } = applyColor('{{rot|Peter Meier}}', 12, 17, 'color', 'blau')
  assert.equal(plainText(text), 'Peter Meier')
  assert.equal(text, '{{rot|Peter }}{{blau|Meier}}')
})

test('ohne Auswahl geschieht nichts', () => {
  const raw = 'Peter kommt später'
  assert.deepEqual(applyColor(raw, 5, 5, 'color', 'rot'), { text: raw, start: 5, end: 5 })
})

test('geschweifte Klammern im Text bleiben lieber ohne Farbe', () => {
  const { text } = applyColor('ein { Zeichen', 0, 13, 'color', 'rot')
  assert.equal(text, 'ein { Zeichen')
})

test('formatOf sagt nur, was für die ganze Auswahl gilt', () => {
  const raw = '{{rot|Peter}} Meier'
  assert.deepEqual(formatOf(raw, 6, 11), { color: 'rot', background: undefined })
  // Über beide Teile hinweg gilt keine Farbe mehr.
  assert.deepEqual(formatOf(raw, 6, 19), { color: undefined, background: undefined })
  assert.deepEqual(formatOf(raw, 6, 6), {})
})

/* ------------------------------------------------------------------ */
/* Aufzählung                                                          */
/* ------------------------------------------------------------------ */

test('macht aus den berührten Zeilen eine Aufzählung', () => {
  const raw = 'Boas\nJoel\nLinda'
  const { text } = toggleBullets(raw, 0, raw.length)
  assert.equal(text, '- Boas\n- Joel\n- Linda')
})

test('ohne Auswahl gilt die Zeile mit dem Cursor', () => {
  const { text } = toggleBullets('Boas\nJoel', 6, 6)
  assert.equal(text, 'Boas\n- Joel')
})

test('nimmt die Striche wieder weg, wenn alle Zeilen welche haben', () => {
  const raw = '- Boas\n-   Joel\n  • Linda'
  assert.ok(hasBullets(raw, 0, raw.length))
  assert.equal(toggleBullets(raw, 0, raw.length).text, 'Boas\nJoel\n  Linda')
})

test('gemischte Auswahl wird zur Aufzählung, nicht zurück', () => {
  const raw = '- Boas\nJoel'
  assert.equal(hasBullets(raw, 0, raw.length), false)
  assert.equal(toggleBullets(raw, 0, raw.length).text, '- Boas\n- Joel')
})

test('leere Zeilen bleiben leer und kippen das Umschalten nicht', () => {
  const raw = '- Boas\n\n- Joel'
  assert.ok(hasBullets(raw, 0, raw.length))
  assert.equal(toggleBullets(raw, 0, raw.length).text, 'Boas\n\nJoel')
})

test('der Einzug bleibt, der Strich rückt dahinter', () => {
  assert.equal(toggleBullets('  Boas', 0, 6).text, '  - Boas')
})

test('der Strich stellt sich vor die Auszeichnung, nicht hinein', () => {
  const { text } = toggleBullets('{{rot|Boas}}', 6, 10)
  assert.equal(text, '- {{rot|Boas}}')
  assert.equal(plainText(text), '- Boas')
})

/* ------------------------------------------------------------------ */
/* Anzeigen                                                            */
/* ------------------------------------------------------------------ */

test('erkennt Aufzählungszeichen und ihre Stufe', () => {
  const lines = richLines('Wer die Leitung hat:\n- Brief an Missionare\n  - Boas\n    - Joel')
  assert.deepEqual(
    lines.map((line) => line.level),
    [null, 0, 1, 2],
  )
  assert.deepEqual(
    lines.map((line) => line.pieces.map((piece) => piece.text).join('')),
    ['Wer die Leitung hat:', 'Brief an Missionare', 'Boas', 'Joel'],
  )
})

test('trägt die Farbe an die einzelnen Stücke', () => {
  const [line] = richLines('Das ist {{rot|dringend}}!')
  assert.deepEqual(
    line.pieces.map((piece) => [piece.text, piece.color ?? null]),
    [
      ['Das ist ', null],
      ['dringend', 'rot'],
      ['!', null],
    ],
  )
})

test('schneidet die Zerlegung des Aufrufers an den Farbgrenzen nach', () => {
  // Der Aufrufer zerlegt in «Peter Meier» und den Rest; die Farbe endet
  // mitten im Namen. Beide Zerlegungen müssen sich überlagern lassen.
  const lines = richLines('{{rot|Peter}} Meier kommt', (line) => {
    const at = line.indexOf('Peter Meier')
    return [
      { text: line.slice(0, at) },
      { text: 'Peter Meier', memberId: 'm1' },
      { text: line.slice(at + 'Peter Meier'.length) },
    ].filter((part) => part.text !== '')
  })

  assert.deepEqual(
    lines[0].pieces.map((piece) => [piece.text, piece.color ?? null, piece.memberId ?? null]),
    [
      ['Peter', 'rot', 'm1'],
      [' Meier', null, 'm1'],
      [' kommt', null, null],
    ],
  )
})
