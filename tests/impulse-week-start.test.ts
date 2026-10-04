import assert from 'node:assert/strict'
import { test } from 'node:test'

import { format } from 'date-fns'
import {
  impulseCurrentWeek,
  impulseWeeksSince,
  impulseWeekStarts,
  impulseWeekToday,
  weekStartBounds,
} from '../src/lib/impulse.ts'

/*
 * Der Start einer Woche lässt sich verschieben: Die Redaktion schaltet das
 * neue Thema etwa schon am Sonntagabend frei, oder sie lässt die alte Woche
 * länger laufen. Gespeichert ist der Start am Wochenthema (`startsAt`);
 * `impulseCurrentWeek` sagt, welche Woche die Jugendlichen gerade sehen.
 */

const at = (y: number, m: number, d: number, h = 0, min = 0) =>
  new Date(y, m - 1, d, h, min).getTime()
const stamp = (time: number) => ({ toMillis: () => time })

test('impulseCurrentWeek: ohne Verschiebung die Kalenderwoche', () => {
  const none = new Map<string, number>()
  assert.equal(impulseCurrentWeek(at(2026, 10, 11, 23, 59), none), '2026-W41')
  assert.equal(impulseCurrentWeek(at(2026, 10, 12, 0, 0), none), '2026-W42')
})

test('impulseCurrentWeek: das neue Thema schon am Sonntagabend', () => {
  const starts = new Map([['2026-W42', at(2026, 10, 11, 19, 0)]])
  assert.equal(impulseCurrentWeek(at(2026, 10, 11, 18, 59), starts), '2026-W41')
  assert.equal(impulseCurrentWeek(at(2026, 10, 11, 19, 0), starts), '2026-W42')
  assert.equal(impulseCurrentWeek(at(2026, 10, 11, 23, 0), starts), '2026-W42')
  // Am Montag läuft sie ohnehin.
  assert.equal(impulseCurrentWeek(at(2026, 10, 12, 8, 0), starts), '2026-W42')
})

test('impulseCurrentWeek: die alte Woche läuft länger', () => {
  const starts = new Map([['2026-W42', at(2026, 10, 13, 18, 0)]])
  assert.equal(impulseCurrentWeek(at(2026, 10, 12, 0, 0), starts), '2026-W41')
  assert.equal(impulseCurrentWeek(at(2026, 10, 13, 17, 59), starts), '2026-W41')
  assert.equal(impulseCurrentWeek(at(2026, 10, 13, 18, 0), starts), '2026-W42')
})

test('impulseCurrentWeek: über den Jahreswechsel', () => {
  // 2026-W53 gibt es: Der 31. Dezember 2026 ist ein Donnerstag.
  const starts = new Map([['2027-W01', at(2027, 1, 3, 18, 0)]])
  assert.equal(impulseCurrentWeek(at(2027, 1, 3, 17, 0), starts), '2026-W53')
  assert.equal(impulseCurrentWeek(at(2027, 1, 3, 18, 30), starts), '2027-W01')
})

test('impulseWeekStarts: nur bereite Wochenthemen verschieben', () => {
  const shifted = (week: string, time: number) => ({ week, at: stamp(time) })
  const starts = impulseWeekStarts([
    {
      kind: 'impuls',
      status: 'ready',
      week: '2026-W42',
      startsAt: shifted('2026-W42', at(2026, 10, 11, 19)),
    },
    // Ein Entwurf verschiebt nichts – sonst begänne eine leere Woche.
    {
      kind: 'impuls',
      status: 'draft',
      week: '2026-W43',
      startsAt: shifted('2026-W43', at(2026, 10, 18, 19)),
    },
    // Nur das Wochenthema trägt den Start.
    {
      kind: 'quiz',
      status: 'ready',
      week: '2026-W44',
      startsAt: shifted('2026-W44', at(2026, 10, 25, 19)),
    },
    { kind: 'impuls', status: 'ready', week: '2026-W45', startsAt: null },
    {
      kind: 'impuls',
      status: 'ready',
      week: null,
      startsAt: shifted('2026-W46', at(2026, 11, 8, 19)),
    },
  ])
  assert.deepEqual([...starts.entries()], [['2026-W42', at(2026, 10, 11, 19)]])
})

test('impulseWeekStarts: ein Start gilt nur für seine Woche', () => {
  // Das Wochenthema der Woche 42 wurde in die Woche 43 verschoben – sein
  // alter Start (Sonntag vor W42) darf W43 nicht mitten in W42 beginnen lassen.
  const moved = impulseWeekStarts([
    {
      kind: 'impuls',
      status: 'ready',
      week: '2026-W43',
      startsAt: { week: '2026-W42', at: stamp(at(2026, 10, 11, 19)) },
    },
  ])
  assert.equal(moved.size, 0)
  assert.equal(impulseCurrentWeek(at(2026, 10, 14, 12), moved), '2026-W42')
  // Und ein Start ausserhalb des Rahmens bleibt ebenso ohne Wirkung.
  const outside = impulseWeekStarts([
    {
      kind: 'impuls',
      status: 'ready',
      week: '2026-W42',
      startsAt: { week: '2026-W42', at: stamp(at(2026, 10, 1, 19)) },
    },
  ])
  assert.equal(outside.size, 0)
})

test('weekStartBounds: frühestens Montag der Woche davor, spätestens Sonntagabend', () => {
  const bounds = weekStartBounds('2026-W42')!
  assert.equal(format(bounds.earliest, 'yyyy-MM-dd HH:mm'), '2026-10-05 00:00')
  assert.equal(format(bounds.latest, 'yyyy-MM-dd HH:mm'), '2026-10-18 23:59')
  assert.equal(weekStartBounds('keine-woche'), null)
})

test('impulseWeekToday: früher freigeschaltet – bis Montag gilt der Montag als heute', () => {
  // Sonntagabend, 4. Oktober: Woche 41 läuft schon – sie wurde früher freigeschaltet.
  assert.equal(impulseWeekToday('2026-W41', at(2026, 10, 4, 19, 30)), '2026-10-05')
  // In der eigenen Woche ist heute heute.
  assert.equal(impulseWeekToday('2026-W41', at(2026, 10, 7, 9)), '2026-10-07')
  // Läuft eine Woche länger, bleibt es beim Sonntag.
  assert.equal(impulseWeekToday('2026-W41', at(2026, 10, 13, 8)), '2026-10-11')
  // Ein unbrauchbarer Schlüssel lässt den Kalendertag stehen.
  assert.equal(impulseWeekToday('keine-woche', at(2026, 10, 4, 19)), '2026-10-04')
})

test('impulseWeeksSince: so viele Wochen, wie man dabei ist', () => {
  // Neu dabei: eine Woche.
  assert.deepEqual(impulseWeeksSince('2026-W41', []), ['2026-W41'])
  assert.deepEqual(impulseWeeksSince('2026-W41', [undefined, null, '2026-W41']), ['2026-W41'])
  // Seit zwei Wochen dabei: drei Punkte, die laufende zuletzt.
  assert.deepEqual(impulseWeeksSince('2026-W43', ['2026-W42', '2026-W41']), [
    '2026-W41',
    '2026-W42',
    '2026-W43',
  ])
  // Über den Jahreswechsel – 2026 hat eine Woche 53.
  assert.deepEqual(impulseWeeksSince('2027-W01', ['2026-W52']), [
    '2026-W52',
    '2026-W53',
    '2027-W01',
  ])
  // Künftige Wochen und Unsinn zählen nicht.
  assert.deepEqual(impulseWeeksSince('2026-W41', ['2026-W45', 'keine-woche']), ['2026-W41'])
})
