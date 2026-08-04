import assert from 'node:assert/strict'
import { test } from 'node:test'

import { parseDocxBlocks } from '../src/lib/docx.ts'
import { minutesItem, parseMinutes, parseMinutesDate } from '../src/lib/minutes.ts'
import { findMentionTrigger } from '../src/lib/mention.ts'

/*
 * Läuft ohne Bundler direkt in Node: `npm run test:import`.
 *
 * Geprüft wird das Lesen der bisherigen Protokolle – ein einmaliger
 * Vorgang, bei dem vier Jahre Sitzungsgeschichte auf einen Schlag in die
 * App wandern. Genau deshalb muss er stimmen: Was hier falsch gelesen
 * wird, korrigiert danach niemand mehr von Hand.
 */

/* ------------------------------------------------------------------ */
/* Word-Dokument                                                       */
/* ------------------------------------------------------------------ */

const paragraph = (text: string) => `<w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`
const cell = (...paragraphs: string[]) => `<w:tc>${paragraphs.join('')}</w:tc>`
const row = (...cells: string[]) => `<w:tr>${cells.join('')}</w:tr>`
const table = (...rows: string[]) => `<w:tbl>${rows.join('')}</w:tbl>`

test('Absätze und Tabellen kommen in der Reihenfolge des Dokuments', () => {
  const xml = `<w:document><w:body>${paragraph('Vorspann')}${table(
    row(cell(paragraph('Traktanden, 31.07.2025')), cell(paragraph('Wer'))),
    row(cell(paragraph('Erstes Thema'), paragraph('Ein Satz dazu')), cell(paragraph('Alain'))),
  )}</w:body></w:document>`

  const blocks = parseDocxBlocks(xml)
  assert.equal(blocks.length, 2)
  assert.deepEqual(blocks[0], { type: 'paragraph', text: 'Vorspann' })
  assert.deepEqual(blocks[1], {
    type: 'table',
    rows: [
      ['Traktanden, 31.07.2025', 'Wer'],
      ['Erstes Thema\nEin Satz dazu', 'Alain'],
    ],
  })
})

test('Tabellen in einem Inhaltssteuerelement zählen mit', () => {
  // Word verpackt manche Tabellen in `w:sdt` – im Protokoll fast ein Viertel.
  const xml = `<w:document><w:body><w:sdt><w:sdtContent>${table(
    row(cell(paragraph('Traktanden, 01.02.2024'))),
    row(cell(paragraph('Thema'))),
  )}</w:sdtContent></w:sdt></w:body></w:document>`

  const blocks = parseDocxBlocks(xml)
  assert.equal(blocks.length, 1)
  assert.equal(blocks[0].type === 'table' && blocks[0].rows[0][0], 'Traktanden, 01.02.2024')
})

test('ein Textfeld mitten im Absatz zerreisst die Zeile nicht', () => {
  /*
   * In einer Zeichnung stecken eigene Absätze. Wer sie für das Ende des
   * laufenden hält, verliert den Text davor – genau das ist beim ersten
   * Anlauf passiert.
   */
  const xml = `<w:document><w:body><w:p><w:r><w:t>JD</w:t></w:r><w:r><w:drawing><w:txbxContent>${paragraph(
    'Beschriftung',
  )}</w:txbxContent></w:drawing></w:r></w:p></w:body></w:document>`

  const blocks = parseDocxBlocks(xml)
  assert.deepEqual(blocks, [{ type: 'paragraph', text: 'JDBeschriftung' }])
})

test('eine Tabelle in einer Zelle bleibt als Text erhalten', () => {
  const xml = `<w:document><w:body>${table(
    row(cell(paragraph('Kopf'))),
    row(
      `<w:tc>${paragraph('Aufteilung')}${table(
        row(cell(paragraph('Alain')), cell(paragraph('Nov'))),
        row(cell(paragraph('Josh')), cell(paragraph('Dez'))),
      )}</w:tc>`,
    ),
  )}</w:body></w:document>`

  const blocks = parseDocxBlocks(xml)
  assert.equal(blocks.length, 1)
  assert.equal(
    blocks[0].type === 'table' && blocks[0].rows[1][0],
    'Aufteilung\nAlain – Nov\nJosh – Dez',
  )
})

test('Umbrüche und Sonderzeichen kommen an', () => {
  const xml = `<w:document><w:body><w:p><w:r><w:t>Vor</w:t></w:r><w:r><w:br/><w:t>Nach &amp; mehr</w:t></w:r></w:p></w:body></w:document>`
  assert.deepEqual(parseDocxBlocks(xml), [{ type: 'paragraph', text: 'Vor\nNach & mehr' }])
})

/* ------------------------------------------------------------------ */
/* Datum der Sitzung                                                   */
/* ------------------------------------------------------------------ */

test('das Datum steht in der Kopfzeile', () => {
  assert.equal(parseMinutesDate('Traktanden, 31.07.2025', null), '2025-07-31')
  assert.equal(parseMinutesDate('Traktanden vom 21.09.2023', null), '2023-09-21')
  assert.equal(parseMinutesDate('Protokoll, 05.01.2023', null), '2023-01-05')
})

test('fehlt das Jahr, ergibt es sich aus der Sitzung darüber', () => {
  // Das Dokument ist von der neusten Sitzung abwärts geschrieben.
  assert.equal(parseMinutesDate('Traktanden 08.06.', '2023-06-23'), '2023-06-08')
  // Läge das Datum damit später als die vorige Sitzung, ist es das Jahr davor.
  assert.equal(parseMinutesDate('Traktanden 20.12.', '2024-01-05'), '2023-12-20')
  // Ohne Vorgängerin lässt sich nichts raten.
  assert.equal(parseMinutesDate('Traktanden 08.06.', null), null)
})

test('was kein Datum ist, wird auch keines', () => {
  assert.equal(parseMinutesDate('Traktanden, bis Ende November 2025', null), null)
  assert.equal(parseMinutesDate('Offene Pendenzen', null), null)
  assert.equal(parseMinutesDate('Traktanden, 45.13.2025', null), null)
})

/* ------------------------------------------------------------------ */
/* Ein Traktandum aus einer Zeile                                      */
/* ------------------------------------------------------------------ */

test('die erste Zeile ist der Titel, der Rest die Beschreibung', () => {
  const item = minutesItem('Berufungen Update:\nBerufungsänderungen\nZwischenbilanz')
  assert.equal(item?.title, 'Berufungen Update')
  assert.equal(item?.description, 'Berufungsänderungen\nZwischenbilanz')
})

test('«Wer» und «Bis» gehen nicht verloren', () => {
  const item = minutesItem('Flyer verteilen', 'Josh\nKevin', '29.10.')
  assert.equal(item?.description, 'Wer: Josh, Kevin\n\nBis: 29.10.')
})

test('ein ganzer Absatz als erste Zeile wird gekürzt – und bleibt vollständig', () => {
  const long = `${'A'.repeat(150)} Ende`
  const item = minutesItem(long)
  assert.ok(item)
  assert.ok(item.title.length <= 120)
  assert.ok(item.title.endsWith('…'))
  assert.equal(item.description, long)
})

test('leere Zeilen ergeben kein Traktandum', () => {
  assert.equal(minutesItem(''), null)
  assert.equal(minutesItem('\n \n'), null)
})

/* ------------------------------------------------------------------ */
/* Das ganze Dokument                                                  */
/* ------------------------------------------------------------------ */

const minutesTable = (head: string, ...items: string[]) =>
  table(
    row(cell(paragraph(head)), cell(paragraph('Wer')), cell(paragraph('Bis'))),
    ...items.map((text) => row(cell(...text.split('\n').map(paragraph)), cell(), cell())),
  )

test('aus Tabellen werden Sitzungen, Pendenzen bleiben Pendenzen', () => {
  const xml = `<w:document><w:body>${minutesTable(
    'Traktanden, 31.07.2025',
    'Erstes Thema\nDetails',
    'Zweites Thema',
  )}${minutesTable('Offene Pendenzen', 'Bleibt offen')}${minutesTable(
    'Traktanden, 24.07.2025',
    'Älteres Thema',
  )}</w:body></w:document>`

  const parsed = parseMinutes(parseDocxBlocks(xml))
  assert.equal(parsed.meetings.length, 2)
  assert.deepEqual(
    parsed.meetings.map((meeting) => meeting.date),
    ['2025-07-31', '2025-07-24'],
  )
  assert.equal(parsed.meetings[0].items.length, 2)
  assert.equal(parsed.pending.length, 1)
  assert.equal(parsed.pending[0].title, 'Bleibt offen')
})

test('dieselbe Sitzung zweimal wird eine – ohne Doppel', () => {
  const xml = `<w:document><w:body>${minutesTable(
    'Traktanden, 18.09.2025',
    'Gemeinsames Thema',
    'Nur in der ersten Fassung',
  )}${minutesTable(
    'Traktanden, 18.09.2025',
    'Gemeinsames Thema\nDafür mit Ergebnis',
    'Nur in der zweiten Fassung',
  )}</w:body></w:document>`

  const parsed = parseMinutes(parseDocxBlocks(xml))
  assert.equal(parsed.meetings.length, 1)
  assert.equal(parsed.meetings[0].tables, 2)
  assert.deepEqual(
    parsed.meetings[0].items.map((item) => item.title),
    ['Gemeinsames Thema', 'Nur in der ersten Fassung', 'Nur in der zweiten Fassung'],
  )
  // Von zwei Fassungen bleibt die ausführlichere.
  assert.equal(parsed.meetings[0].items[0].description, 'Dafür mit Ergebnis')
})

test('eine Tabelle ohne lesbares Datum wird gemeldet statt verschluckt', () => {
  const xml = `<w:document><w:body>${minutesTable(
    'Traktanden, bis Ende November 2025',
    'Ein Punkt',
    'Noch einer',
  )}</w:body></w:document>`

  const parsed = parseMinutes(parseDocxBlocks(xml))
  assert.equal(parsed.meetings.length, 0)
  assert.deepEqual(parsed.skipped, [{ label: 'Traktanden, bis Ende November 2025', items: 2 }])
})

/* ------------------------------------------------------------------ */
/* Das «@» im Traktandum                                               */
/* ------------------------------------------------------------------ */

test('«@» am Wortanfang ruft die Mitgliederliste', () => {
  assert.deepEqual(findMentionTrigger('@', 1), { start: 0, query: '' })
  assert.deepEqual(findMentionTrigger('Besuch bei @Mei', 15), { start: 11, query: 'Mei' })
})

test('mitten im Wort und über Zeilen hinweg nicht', () => {
  assert.equal(findMentionTrigger('mail@example.ch', 15), null)
  assert.equal(findMentionTrigger('@Meier\nzweite Zeile', 19), null)
  assert.equal(findMentionTrigger('ohne', 4), null)
})
