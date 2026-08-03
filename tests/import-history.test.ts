import assert from 'node:assert/strict'
import { test } from 'node:test'

import { isoDate, parseTalkHistory, type RawSheet } from '../src/services/importHistory.ts'
import { buildHistoryPreview } from '../src/services/importMatch.ts'
import type { Member } from '../src/lib/types.ts'

/*
 * Läuft ohne Bundler direkt in Node (Typen werden beim Laden entfernt,
 * Node >= 22.18): `npm run test:import`.
 *
 * Die Testdaten sind erfunden, haben aber denselben Aufbau wie die bisher
 * geführte Excel-Tabelle – samt ihrer über die Jahre gewachsenen
 * Eigenheiten: Vermerke neben dem Tag, zwei Termine in einer Zelle,
 * Prosa statt Datum und Zeilen, in denen eine Rolle statt einer Person steht.
 */

/* ------------------------------------------------------------------ */
/* Testdaten                                                           */
/* ------------------------------------------------------------------ */

/** Ein Jahresblatt: drei Monate, je eine Spalte für Ansprache und Gebet. */
function sheet(name: string, rows: (string | number | null)[][]): RawSheet {
  return {
    sheet: name,
    data: [
      ['länger abwesend oder weggezogen', null, null, null, null, 'Abendmahlsversammlungen'],
      [null, null, null, 'A = Ansprache', null, null, 'G = Gebet', null, 'K = Kinderansprache'],
      [null, null, null, null, null, null, null, null, null],
      ['x-ter Sonntag im', null, null, 'Jan.', null, 'Feb.', null, 'März', null, 'Ansprache'],
      ['entspr. Monat', null, null, 'A', 'G', 'A', 'G', 'A', 'G', null],
      ...rows,
    ],
  }
}

const HISTORY = [
  sheet('2024', [
    ['Amsler', 'Peter Daniel', 'm', 7, null, null, null, null, 24, 'ja'],
    ['Brunner', 'Simon', 'm', null, 7, null, null, '17 K', null, 'ja'],
    // Zwei Termine in einer Zelle, wie sie von Hand nachgetragen wurden.
    ['Cadonau', 'Rita', 'w', null, null, '4, 25', null, null, null, 'ja'],
    // Rolle statt Person – gehört keinem Gemeindemitglied.
    ['Besucher', null, null, 14, null, null, null, null, null, null],
    // Weder Tag noch Datum: bleibt ungelesen und wird gemeldet.
    ['Dahinden', 'Marc', 'm', 'auf Mission', null, 'v', null, null, null, null],
    ['Egger', 'Nadja Vera', 'w', null, null, null, null, 'keine Ansprache im 2020??', null, null],
  ]),
  sheet('2023_Anspr+Geb', [
    ['Amsler', 'Peter Daniel', 'm', null, null, 12, null, null, null, 'ja'],
  ]),
]

function member(id: string, lastName: string, firstName: string): Member {
  return {
    id,
    lastName,
    firstName,
    gender: 'unknown',
    birthDate: null,
    status: 'active',
    availableForTalks: true,
    lastTalkDate: null,
    talkCount: 0,
    tags: [],
  }
}

const MEMBERS = [
  member('m1', 'Amsler', 'Peter Daniel'),
  member('m2', 'Brunner', 'Simon'),
  member('m3', 'Cadonau', 'Rita'),
  member('m4', 'Dahinden', 'Marc'),
  member('m5', 'Egger', 'Nadja Vera'),
]

/* ------------------------------------------------------------------ */
/* Parser                                                              */
/* ------------------------------------------------------------------ */

test('liest Ansprachen und Gebete aus den Jahresblättern', () => {
  const parsed = parseTalkHistory(HISTORY)

  assert.deepEqual(parsed.years, [2023, 2024])
  assert.deepEqual(
    parsed.entries
      .filter((e) => e.fullName === 'Amsler, Peter Daniel')
      .map((e) => [e.kind, isoDate(e.year, e.month, e.day)]),
    [
      ['talk', '2024-01-07'],
      ['prayer', '2024-03-24'],
      ['talk', '2023-02-12'],
    ],
  )
})

test('trennt Ansprache und Gebet nach der Spalte', () => {
  const parsed = parseTalkHistory(HISTORY)
  const brunner = parsed.entries.filter((e) => e.fullName === 'Brunner, Simon')

  assert.deepEqual(
    brunner.map((e) => [e.kind, isoDate(e.year, e.month, e.day), e.note]),
    [
      ['prayer', '2024-01-07', ''],
      ['talk', '2024-03-17', 'Kinderansprache'],
    ],
  )
})

test('liest zwei Termine aus einer Zelle', () => {
  const parsed = parseTalkHistory(HISTORY)

  assert.deepEqual(
    parsed.entries
      .filter((e) => e.fullName === 'Cadonau, Rita')
      .map((e) => isoDate(e.year, e.month, e.day)),
    ['2024-02-04', '2024-02-25'],
  )
})

test('meldet Zellen, die kein Datum enthalten, statt zu raten', () => {
  const parsed = parseTalkHistory(HISTORY)

  assert.deepEqual(
    parsed.unread.map((cell) => [cell.fullName, cell.text]),
    [
      ['Dahinden, Marc', 'auf Mission'],
      ['Dahinden, Marc', 'v'],
      ['Egger, Nadja Vera', 'keine Ansprache im 2020??'],
    ],
  )
  // Die Jahreszahl in der Bemerkung darf nicht als Tag durchgehen.
  assert.equal(
    parsed.entries.some((e) => e.fullName === 'Egger, Nadja Vera'),
    false,
  )
})

test('überspringt Zeilen, in denen eine Rolle statt einer Person steht', () => {
  const parsed = parseTalkHistory(HISTORY)

  assert.deepEqual(parsed.ignoredRows, ['Besucher'])
  assert.equal(
    parsed.entries.some((e) => e.fullName.startsWith('Besucher')),
    false,
  )
})

test('liest die alten Blätter als gezählte Sonntage', () => {
  // Bis 2018 stand in der Zelle, der wievielte Sonntag es war. Der 1. Januar
  // 2016 war ein Freitag, der erste Sonntag also der 3.
  const parsed = parseTalkHistory([
    sheet('2016_Anspr+Geb', [
      ['Amsler', 'Peter Daniel', 'm', 2, null, 1, null, 4],
      ['Brunner', 'Simon', 'm', null, 5, null, null, null],
    ]),
  ])

  assert.deepEqual(parsed.sheets, [
    { sheet: '2016_Anspr+Geb', year: 2016, counting: 'sunday', entries: 4 },
  ])
  assert.deepEqual(
    parsed.entries.map((e) => [e.kind, isoDate(e.year, e.month, e.day)]),
    [
      ['talk', '2016-01-10'],
      ['talk', '2016-02-07'],
      ['talk', '2016-03-27'],
      ['prayer', '2016-01-31'],
    ],
  )
})

test('meldet gezählte Sonntage, die es im Monat nicht gibt', () => {
  // Der Februar 2016 hat vier Sonntage – einen fünften gibt es nicht.
  const parsed = parseTalkHistory([
    sheet('2016_Anspr+Geb', [
      ['Amsler', 'Peter Daniel', 'm', 1, null, 5, null, 1],
      ['Brunner', 'Simon', 'm', 2, null, 3, null, 2],
    ]),
  ])

  assert.deepEqual(
    parsed.unread.map((cell) => [cell.fullName, cell.column, cell.text]),
    [['Amsler, Peter Daniel', 'Feb.', '5']],
  )
})

test('erkennt die Zählweise am Inhalt, nicht an der Beschriftung', () => {
  const parsed = parseTalkHistory(HISTORY)

  assert.deepEqual(
    parsed.sheets.map((s) => [s.year, s.counting]),
    [
      [2023, 'day'],
      [2024, 'day'],
    ],
  )
})

test('überspringt Blätter ohne Jahreszahl oder ohne Aufbau', () => {
  const parsed = parseTalkHistory([
    { sheet: 'Hinweise', data: [['Irgendein Text']] },
    { sheet: '2019', data: [] },
  ])

  assert.deepEqual(parsed.skippedSheets, ['Hinweise', '2019'])
  assert.deepEqual(parsed.entries, [])
})

test('lässt unmögliche Tage wie den 30. Februar liegen', () => {
  const parsed = parseTalkHistory([sheet('2024', [['Amsler', 'Peter', 'm', 32, null, 30]])])

  assert.deepEqual(
    parsed.unread.map((cell) => cell.text),
    ['32', '30'],
  )
  assert.deepEqual(parsed.entries, [])
})

/* ------------------------------------------------------------------ */
/* Vorschau                                                            */
/* ------------------------------------------------------------------ */

test('ordnet den Verlauf den erfassten Personen zu', () => {
  const preview = buildHistoryPreview(parseTalkHistory(HISTORY), MEMBERS, [], [])

  assert.deepEqual(
    preview.talks.map((t) => [t.date, t.memberName, t.slot]),
    [
      ['2023-02-12', 'Peter Daniel Amsler', 1],
      ['2024-01-07', 'Peter Daniel Amsler', 1],
      ['2024-02-04', 'Rita Cadonau', 1],
      ['2024-02-25', 'Rita Cadonau', 1],
      ['2024-03-17', 'Simon Brunner', 1],
    ],
  )
  assert.deepEqual(
    preview.prayers.map((p) => [p.date, p.memberName, p.slot]),
    [
      ['2024-01-07', 'Simon Brunner', 'opening'],
      ['2024-03-24', 'Peter Daniel Amsler', 'opening'],
    ],
  )
  assert.deepEqual(preview.unmatched, [])
})

test('führt Anzahl und Datum der letzten Ansprache nach', () => {
  const preview = buildHistoryPreview(parseTalkHistory(HISTORY), MEMBERS, [], [])
  const amsler = preview.members.find((m) => m.memberId === 'm1')

  assert.deepEqual(amsler, {
    memberId: 'm1',
    memberName: 'Peter Daniel Amsler',
    talkCount: 2,
    lastTalkDate: '2024-01-07',
  })
})

test('zählt Bestehendes mit, statt es zu überschreiben', () => {
  const known = [{ memberId: 'm1', date: '2025-06-01' }]
  const preview = buildHistoryPreview(parseTalkHistory(HISTORY), MEMBERS, known, [])

  assert.deepEqual(
    preview.members.find((m) => m.memberId === 'm1'),
    {
      memberId: 'm1',
      memberName: 'Peter Daniel Amsler',
      talkCount: 3,
      lastTalkDate: '2025-06-01',
    },
  )
  // Der bestehende Sonntag hat schon eine Ansprache – die nächste rückt nach.
  assert.equal(
    preview.talks.find((t) => t.date === '2025-06-01'),
    undefined,
  )
})

test('schreibt beim zweiten Durchlauf nichts doppelt', () => {
  const parsed = parseTalkHistory(HISTORY)
  const first = buildHistoryPreview(parsed, MEMBERS, [], [])

  const second = buildHistoryPreview(
    parsed,
    MEMBERS,
    first.talks.map((t) => ({ memberId: t.memberId, date: t.date })),
    first.prayers.map((p) => ({ date: p.date, slot: p.slot, memberId: p.memberId })),
  )

  assert.deepEqual(second.talks, [])
  assert.deepEqual(second.prayers, [])
  assert.deepEqual(second.members, [])
  assert.equal(second.known, first.talks.length + first.prayers.length)
})

test('meldet Gebete, für die am Sonntag kein Platz frei ist', () => {
  const crowdedSheet = [
    sheet('2024', [
      ['Amsler', 'Peter Daniel', 'm', null, 7],
      ['Brunner', 'Simon', 'm', null, 7],
      ['Cadonau', 'Rita', 'w', null, 7],
    ]),
  ]
  const preview = buildHistoryPreview(parseTalkHistory(crowdedSheet), MEMBERS, [], [])

  assert.deepEqual(
    preview.prayers.map((p) => [p.memberName, p.slot]),
    [
      ['Peter Daniel Amsler', 'opening'],
      ['Simon Brunner', 'closing'],
    ],
  )
  assert.deepEqual(preview.crowded, [{ date: '2024-01-07', memberName: 'Rita Cadonau' }])
})

test('meldet Namen ohne erfasste Person, statt sie anzulegen', () => {
  const preview = buildHistoryPreview(parseTalkHistory(HISTORY), [MEMBERS[0]], [], [])

  assert.deepEqual(preview.unmatched, [
    { fullName: 'Brunner, Simon', count: 2 },
    { fullName: 'Cadonau, Rita', count: 2 },
  ])
  assert.equal(
    preview.talks.every((t) => t.memberId === 'm1'),
    true,
  )
})
