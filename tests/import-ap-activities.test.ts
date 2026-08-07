import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  apActivityKind,
  parseApDate,
  parseApMonthHeading,
  parseApSheet,
} from '../src/services/importApActivities.ts'
import { FHV_TITLE, generateApSchedule, nextFreeApDate } from '../src/services/apSchedule.ts'

/*
 * Läuft ohne Bundler direkt in Node (Typen werden beim Laden entfernt,
 * Node >= 22.18): `npm run test:import`.
 *
 * Die Zeilen stammen aus dem Aktivitätenplan der Gemeinde – Aufbau
 * unverändert, Namen gekürzt. Zwei Dinge sind daran heikel und deshalb
 * hier festgehalten: Excel liefert ein Datum als **Zahl**, und Mehrtägiges
 * steht als Satz in der Zelle.
 */

/** 46029 ist der 7. Januar 2026 – so kommt ein Datum aus Excel an. */
const SHEET: string[][] = [
  ['', "Aktivitätenplan AP's Gemeinde Burgdorf", '', '', '', '', '', ''],
  ['', '', '', '', '', '', '', ''],
  [
    '',
    'Datum',
    'Aktivität / Klasse',
    'Treffpunkt',
    'Leitung / Org',
    'Teilnahme BSS',
    'Teilnahme Berater',
    'Bemerkung / Sonstiges Programm',
  ],
  ['', '', '', '', '', '', '', ''],
  ['', 'JANUAR - LEITUNG LEHRER', '', '', '', '', '', ''],
  ['', '46029', 'Bouldern', 'Gemeindehaus', 'Carden', 'Alain', '', ''],
  ['', '46043', 'FHV - keine Aktivität', '', '', '', '', 'FHV'],
  ['', '46047', 'Kleine Entscheidungen', '', 'Jeremia', '', 'Simeon', ''],
  [
    '',
    'Freitag + Samstag, 30.01 -31.01.2026',
    'Übernachtung Hasliberg',
    'Gemeindehaus',
    '',
    'Alain',
    '',
    '',
  ],
  ['', 'APRIL - LEITUNG LEHRER', '', '', '', '', '', ''],
  ['', '03. April - 06. April 2026', 'Osterlager', '', '', '', '', ''],
  ['', '46267', '', '', '', '', '', ''],
]

/* ------------------------------------------------------------------ */
/* Datum                                                               */
/* ------------------------------------------------------------------ */

test('liest die Excel-Zahl als Datum', () => {
  assert.deepEqual(parseApDate('46029', null), {
    start: '2026-01-07',
    end: null,
    yearStated: true,
  })
})

test('lässt eine Zahl ausserhalb des Datumsbereichs stehen', () => {
  // «12» ist keine Jahreszahl, sondern eine vergessene Hilfsspalte.
  assert.equal(parseApDate('12', 2026), null)
})

test('liest einen Zeitraum aus einem von Hand geschriebenen Satz', () => {
  assert.deepEqual(parseApDate('Freitag + Samstag, 30.01 -31.01.2026', null), {
    start: '2026-01-30',
    end: '2026-01-31',
    yearStated: true,
  })
})

test('liest einen Zeitraum mit ausgeschriebenen Monatsnamen', () => {
  assert.deepEqual(parseApDate('03. April - 06. April 2026', null), {
    start: '2026-04-03',
    end: '2026-04-06',
    yearStated: true,
  })
})

test('liest einen Zeitraum über den Monatswechsel', () => {
  assert.deepEqual(parseApDate('30. Oktober - 1. November 2026', null), {
    start: '2026-10-30',
    end: '2026-11-01',
    yearStated: true,
  })
})

test('erkennt den Jahreswechsel innerhalb einer Zelle', () => {
  assert.deepEqual(parseApDate('28.12. - 2.1.', 2026), {
    start: '2026-12-28',
    end: '2027-01-02',
    yearStated: false,
  })
})

test('nimmt das ISO-Datum, wie es aus einer CSV-Datei kommt', () => {
  assert.deepEqual(parseApDate('2026-08-12', null), {
    start: '2026-08-12',
    end: null,
    yearStated: true,
  })
})

/* ------------------------------------------------------------------ */
/* Art des Termins                                                     */
/* ------------------------------------------------------------------ */

test('leitet die Art aus dem Wochentag ab', () => {
  // 7. Januar 2026 ist ein Mittwoch, der 11. ein Sonntag, der 17. ein Samstag.
  assert.equal(apActivityKind('2026-01-07', null, 'Bouldern'), 'activity')
  assert.equal(apActivityKind('2026-01-11', null, ''), 'class')
  assert.equal(apActivityKind('2026-01-17', null, 'Semi + Ball'), 'special')
})

test('erkennt einen ausgefallenen Abend am Titel', () => {
  assert.equal(apActivityKind('2026-01-21', null, 'FHV - keine Aktivität'), 'cancelled')
  assert.equal(apActivityKind('2026-03-29', null, 'keine Klasse'), 'cancelled')
})

test('macht aus Mehrtägigem einen besonderen Anlass', () => {
  assert.equal(apActivityKind('2026-04-03', '2026-04-06', 'Osterlager'), 'special')
})

/* ------------------------------------------------------------------ */
/* Monatsüberschriften                                                 */
/* ------------------------------------------------------------------ */

test('liest Monat und führendes Kollegium aus der Zwischenüberschrift', () => {
  assert.deepEqual(parseApMonthHeading('JANUAR - LEITUNG LEHRER'), {
    month: 1,
    leadership: 'Leitung Lehrer',
  })
  assert.deepEqual(parseApMonthHeading('März'), { month: 3, leadership: '' })
  assert.equal(parseApMonthHeading('Bouldern'), null)
})

/* ------------------------------------------------------------------ */
/* Ganzes Blatt                                                        */
/* ------------------------------------------------------------------ */

test('liest Termine, Zeiträume und Monatsangaben aus dem Blatt', () => {
  const plan = parseApSheet(SHEET)

  assert.equal(plan.headerFound, true)
  assert.equal(plan.skipped.length, 0)
  assert.equal(plan.activities.length, 6)

  assert.deepEqual(plan.activities[0], {
    date: '2026-01-07',
    endDate: null,
    kind: 'activity',
    title: 'Bouldern',
    location: 'Gemeindehaus',
    leader: 'Carden',
    bishopric: 'Alain',
    advisor: '',
    note: '',
    row: 6,
  })

  // Die Klasse am Sonntag trägt Leitung und Berater, aber keinen Treffpunkt.
  assert.equal(plan.activities[2].kind, 'class')
  assert.equal(plan.activities[2].advisor, 'Simeon')

  // Der von Hand geschriebene Zeitraum wird zum mehrtägigen Anlass.
  assert.equal(plan.activities[3].date, '2026-01-30')
  assert.equal(plan.activities[3].endDate, '2026-01-31')

  // Ein Mittwoch, an dem nur das Datum steht, bleibt als offener Abend drin.
  assert.deepEqual(
    {
      date: plan.activities[5].date,
      kind: plan.activities[5].kind,
      title: plan.activities[5].title,
    },
    { date: '2026-09-02', kind: 'activity', title: '' },
  )

  assert.deepEqual(plan.months, [
    { month: '2026-01', leadership: 'Leitung Lehrer', row: 5 },
    { month: '2026-04', leadership: 'Leitung Lehrer', row: 10 },
  ])
})

test('meldet Zeilen mit Inhalt, aber ohne lesbares Datum', () => {
  const plan = parseApSheet([
    ['Datum', 'Aktivität / Klasse'],
    ['46029', 'Bouldern'],
    ['irgendwann', 'Grillabend'],
  ])

  assert.equal(plan.activities.length, 1)
  assert.deepEqual(plan.skipped, [{ row: 3, text: 'irgendwann · Grillabend' }])
})

/* ------------------------------------------------------------------ */
/* Grundtakt                                                           */
/* ------------------------------------------------------------------ */

test('legt jeden Mittwoch ausser dem dritten als Aktivität an', () => {
  // Januar 2026: Mittwoche am 7., 14., 21. und 28. – der 21. ist der dritte.
  const entries = generateApSchedule({
    from: '2026-01-01',
    to: '2026-01-31',
    activities: true,
    classes: false,
    fhv: true,
  })

  assert.deepEqual(
    entries.map((entry) => [entry.date, entry.kind]),
    [
      ['2026-01-07', 'activity'],
      ['2026-01-14', 'activity'],
      ['2026-01-21', 'cancelled'],
      ['2026-01-28', 'activity'],
    ],
  )
  assert.equal(entries[2].title, FHV_TITLE)
})

test('legt die Klasse am 2. und 4. Sonntag an', () => {
  // Januar 2026: Sonntage am 4., 11., 18. und 25.
  const entries = generateApSchedule({
    from: '2026-01-01',
    to: '2026-01-31',
    activities: false,
    classes: true,
    fhv: false,
  })

  assert.deepEqual(
    entries.map((entry) => entry.date),
    ['2026-01-11', '2026-01-25'],
  )
})

test('die Klasse bringt ihre Zeit mit, der Mittwoch nicht', () => {
  const entries = generateApSchedule({
    from: '2026-01-01',
    to: '2026-01-31',
    activities: true,
    classes: true,
    fhv: true,
  })

  // Die Klasse ist immer von 11 bis 12 – das steht am Termin.
  for (const entry of entries.filter((candidate) => candidate.kind === 'class')) {
    assert.equal(entry.time, '11:00')
    assert.equal(entry.endTime, '12:00')
  }
  // Wann ein Mittwochabend beginnt und wie lange er geht, weiss der Takt nicht.
  for (const entry of entries.filter((candidate) => candidate.kind !== 'class')) {
    assert.equal(entry.time, '')
    assert.equal(entry.endTime, '')
  }
})

test('lässt Tage aus, an denen schon etwas im Plan steht', () => {
  const entries = generateApSchedule(
    { from: '2026-01-01', to: '2026-01-31', activities: true, classes: false, fhv: false },
    ['2026-01-07', '2026-01-28'],
  )

  assert.deepEqual(
    entries.map((entry) => entry.date),
    ['2026-01-14'],
  )
})

test('schlägt den nächsten freien Termin des Grundtakts vor', () => {
  // Der 1. Januar 2026 ist ein Donnerstag; der nächste Mittwoch ist der 7.
  assert.equal(nextFreeApDate([], new Date(2026, 0, 1)), '2026-01-07')
  // Ist der belegt, kommt der Sonntag darauf – der 11. ist der 2. Sonntag.
  assert.equal(nextFreeApDate(['2026-01-07'], new Date(2026, 0, 1)), '2026-01-11')
})
