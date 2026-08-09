import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  apClassSundays,
  generateApSchedule,
  isApClassSunday,
  nextFreeApDate,
  sundaysOfMonth,
} from '../src/services/apSchedule.ts'
import { apClassHours, apTimeLabel } from '../src/lib/types.ts'

/*
 * Läuft ohne Bundler direkt in Node: `npm run test:import`.
 *
 * Geprüft wird der Grundtakt des Aktivitätenplans – und vor allem der
 * Wechsel im September 2026: Die AP-Klasse war am 2. und 4. Sonntag von 11
 * bis 12 Uhr und ist seither an jedem Sonntag von 11:35 bis 12:00.
 */

const options = (from: string, to: string) => ({
  from,
  to,
  activities: false,
  classes: true,
  fhv: false,
})

/* ------------------------------------------------------------------ */
/* Die Sonntage eines Monats                                           */
/* ------------------------------------------------------------------ */

test('ein Monat kennt seine Sonntage – auch wenn es fünf sind', () => {
  assert.deepEqual(sundaysOfMonth('2026-09'), [
    '2026-09-06',
    '2026-09-13',
    '2026-09-20',
    '2026-09-27',
  ])
  assert.equal(sundaysOfMonth('2026-11').length, 5)
  assert.equal(sundaysOfMonth('2026-11').at(-1), '2026-11-29')
})

test('Klasse ist ab September 2026 an jedem Sonntag', () => {
  // Juli 2026: nur der 2. und der 4. Sonntag.
  assert.deepEqual(apClassSundays('2026-07'), ['2026-07-12', '2026-07-26'])
  // August ist der letzte Monat im alten Takt.
  assert.deepEqual(apClassSundays('2026-08'), ['2026-08-09', '2026-08-23'])
  // Ab September alle.
  assert.deepEqual(apClassSundays('2026-09'), sundaysOfMonth('2026-09'))
  assert.deepEqual(apClassSundays('2026-11'), sundaysOfMonth('2026-11'))
})

test('der Stichtag hängt am Datum und nicht an der Woche', () => {
  // Der 1. Sonntag im August 2026 – im alten Takt keine Klasse.
  assert.equal(isApClassSunday('2026-08-02', 1), false)
  assert.equal(isApClassSunday('2026-08-09', 2), true)
  // Derselbe erste Sonntag im September – neu schon.
  assert.equal(isApClassSunday('2026-09-06', 1), true)
})

/* ------------------------------------------------------------------ */
/* Die feste Stunde                                                    */
/* ------------------------------------------------------------------ */

test('die Klasse dauert bis August eine Stunde und danach 25 Minuten', () => {
  assert.deepEqual(apClassHours('2026-08-23'), { start: '11:00', end: '12:00' })
  assert.deepEqual(apClassHours('2026-09-06'), { start: '11:35', end: '12:00' })
})

test('eine Klasse ohne erfasste Zeit wird an ihrer Stunde gezeigt', () => {
  const alt = { date: '2026-08-23', kind: 'class' as const, title: '' }
  const neu = { date: '2026-09-06', kind: 'class' as const, title: '' }

  assert.equal(apTimeLabel(alt), '11:00 – 12:00')
  assert.equal(apTimeLabel(neu), '11:35 – 12:00')
})

test('eine verschobene Klasse nimmt die Länge ihres Takts mit', () => {
  assert.equal(apTimeLabel({ date: '2026-08-23', kind: 'class', time: '09:15' }), '09:15 – 10:15')
  assert.equal(apTimeLabel({ date: '2026-09-06', kind: 'class', time: '09:15' }), '09:15 – 09:40')
})

/* ------------------------------------------------------------------ */
/* Das Grundgerüst                                                     */
/* ------------------------------------------------------------------ */

test('der September 2026 bekommt vier Klassen von 11:35 bis 12:00', () => {
  const entries = generateApSchedule(options('2026-09-01', '2026-09-30'))

  assert.deepEqual(
    entries.map((entry) => entry.date),
    ['2026-09-06', '2026-09-13', '2026-09-20', '2026-09-27'],
  )
  for (const entry of entries) {
    assert.equal(entry.kind, 'class')
    assert.equal(entry.time, '11:35')
    assert.equal(entry.endTime, '12:00')
    // Ohne Titel: Was gelehrt wird, kommt aus «Für eine starke Jugend».
    assert.equal(entry.title, '')
  }
})

test('von September bis Ende Jahr entstehen siebzehn Klassen', () => {
  const entries = generateApSchedule(options('2026-09-01', '2026-12-31'))

  // 4 + 4 + 5 + 4 Sonntage.
  assert.equal(entries.length, 17)
  assert.equal(entries.at(0)?.date, '2026-09-06')
  assert.equal(entries.at(-1)?.date, '2026-12-27')
})

test('der alte Takt bleibt, wo er galt', () => {
  const entries = generateApSchedule(options('2026-08-01', '2026-08-31'))

  assert.deepEqual(
    entries.map((entry) => entry.date),
    ['2026-08-09', '2026-08-23'],
  )
  assert.equal(entries[0].time, '11:00')
  assert.equal(entries[0].endTime, '12:00')
})

test('über den Stichtag hinweg wechselt der Takt mitten im Lauf', () => {
  const entries = generateApSchedule(options('2026-08-24', '2026-09-14'))

  assert.deepEqual(
    entries.map((entry) => `${entry.date} ${entry.time}`),
    ['2026-09-06 11:35', '2026-09-13 11:35'],
  )
})

test('belegte Tage bleiben unangetastet', () => {
  const entries = generateApSchedule(options('2026-09-01', '2026-09-30'), ['2026-09-13'])

  assert.deepEqual(
    entries.map((entry) => entry.date),
    ['2026-09-06', '2026-09-20', '2026-09-27'],
  )
})

/* ------------------------------------------------------------------ */
/* Der nächste freie Termin                                            */
/* ------------------------------------------------------------------ */

test('der Vorschlag kennt den neuen Takt', () => {
  // Montag, 7. September 2026 – der nächste Termin ist der Mittwoch.
  assert.equal(nextFreeApDate([], new Date(2026, 8, 7)), '2026-09-09')
  // Ist der Mittwoch belegt, folgt neu schon der Sonntag darauf.
  assert.equal(nextFreeApDate(['2026-09-09'], new Date(2026, 8, 7)), '2026-09-13')
})
