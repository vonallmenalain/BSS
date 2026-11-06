import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  DEFER_WEEKS,
  deferBase,
  deferByWeeks,
  deferWaits,
  fromDayKey,
  itemWaits,
  meetingFrom,
  weeksLabel,
} from '../src/lib/defer.ts'
import { dayKey, type StandingMeeting } from '../src/lib/standing.ts'

/*
 * Läuft ohne Bundler direkt in Node (Typen werden beim Laden entfernt,
 * Node >= 22.18): `npm run test:import`.
 *
 * Verschieben um ein paar Wochen oder auf ein Datum: Ab welchem Tag wird
 * gezählt, in welcher Sitzung landet der Punkt – und wartet er, wenn so spät
 * noch keine geplant ist?
 */

const meetings: StandingMeeting[] = [
  { id: 'nov-13', date: '2026-11-13' },
  { id: 'nov-27', date: '2026-11-27' },
  { id: 'jan-05', date: '2027-01-05' },
]

test('zur Wahl stehen eine bis vier Wochen', () => {
  assert.deepEqual([...DEFER_WEEKS], [1, 2, 3, 4])
  assert.equal(weeksLabel(1), '1 Woche')
  assert.equal(weeksLabel(3), '3 Wochen')
})

test('gezählt wird ab der Sitzung, in der der Punkt steht – sofern sie noch bevorsteht', () => {
  // Steht er in der Sitzung von nächster Woche, zählen die Wochen ab dort.
  assert.equal(deferBase('2026-11-13', '2026-11-06'), '2026-11-13')
  // Die Sitzung von heute oder eine vergangene: ab heute.
  assert.equal(deferBase('2026-11-06', '2026-11-06'), '2026-11-06')
  assert.equal(deferBase('2026-10-30', '2026-11-06'), '2026-11-06')
  // Ohne Sitzung: ab heute.
  assert.equal(deferBase(null, '2026-11-06'), '2026-11-06')
  assert.equal(deferBase(undefined, '2026-11-06'), '2026-11-06')
})

test('Wochen gehen über Monats- und Jahresgrenzen', () => {
  assert.equal(deferByWeeks('2026-11-06', 1), '2026-11-13')
  assert.equal(deferByWeeks('2026-11-06', 4), '2026-12-04')
  assert.equal(deferByWeeks('2026-12-18', 3), '2027-01-08')
})

test('der Punkt landet in der ersten Sitzung an oder nach dem Tag', () => {
  // Am Tag selbst – wer auf den 13. verschiebt und am 13. tagt, meint diese.
  assert.equal(meetingFrom('2026-11-13', meetings)?.id, 'nov-13')
  // Dazwischen: die nächste danach.
  assert.equal(meetingFrom('2026-11-14', meetings)?.id, 'nov-27')
  // Auf den 1. Januar verschoben – die Sitzung vom 5. Januar.
  assert.equal(meetingFrom('2027-01-01', meetings)?.id, 'jan-05')
  // So spät ist noch keine geplant.
  assert.equal(meetingFrom('2027-01-06', meetings), null)
  assert.equal(meetingFrom('2026-11-13', []), null)
})

test('die Sitzung, in der er schon steht, ist kein Ziel', () => {
  assert.equal(meetingFrom('2026-11-13', meetings, 'nov-13')?.id, 'nov-27')
  assert.equal(meetingFrom('2027-01-01', meetings, 'jan-05'), null)
})

test('die Reihenfolge der Sitzungen spielt keine Rolle', () => {
  const shuffled = [meetings[2], meetings[0], meetings[1]]
  assert.equal(meetingFrom('2026-11-14', shuffled)?.id, 'nov-27')
  // Zwei Sitzungen am selben Tag: immer dieselbe, nicht die zufällig erste.
  const twice = [
    { id: 'b', date: '2026-11-13' },
    { id: 'a', date: '2026-11-13' },
  ]
  assert.equal(meetingFrom('2026-11-13', twice)?.id, 'a')
})

test('ein verschobener Punkt wartet bis zu seinem Tag – danach nicht mehr', () => {
  const item = { deferredUntil: '2027-01-01' }
  assert.equal(deferWaits(item, '2026-12-15'), true)
  assert.equal(deferWaits(item, '2026-12-31'), true)
  // Am Tag selbst ist er dran – die Sitzung vom 1. Januar nimmt ihn auf.
  assert.equal(deferWaits(item, '2027-01-01'), false)
  assert.equal(deferWaits(item, '2027-01-05'), false)
})

test('ohne Tag (oder mit einem kaputten) wartet nichts', () => {
  assert.equal(deferWaits({}, '2026-11-06'), false)
  assert.equal(deferWaits({ deferredUntil: null }, '2026-11-06'), false)
  assert.equal(deferWaits({ deferredUntil: '2027-01' }, '2026-11-06'), false)
})

test('noch nicht dran ist, wer auf einen Tag oder auf die nächste Runde wartet', () => {
  // Verschoben auf den 1. Januar.
  assert.equal(itemWaits({ deferredUntil: '2027-01-01' }, '2026-12-15'), true)
  // Eine ständige Pendenz, die erst im Dezember wieder fällig ist.
  assert.equal(
    itemWaits({ standing: { every: 1, unit: 'month', dueFrom: '2026-12-01' } }, '2026-11-06'),
    true,
  )
  // Beides vorbei – oder gar nicht gesetzt.
  assert.equal(
    itemWaits(
      {
        deferredUntil: '2026-11-01',
        standing: { every: 1, unit: 'month', dueFrom: '2026-11-01' },
      },
      '2026-11-06',
    ),
    false,
  )
  assert.equal(itemWaits({}, '2026-11-06'), false)
})

test('ein Tag als Date liegt auf der Mittagsstunde und bleibt derselbe Tag', () => {
  const date = fromDayKey('2027-01-05')
  assert.equal(date.getHours(), 12)
  assert.equal(dayKey(date), '2027-01-05')
  assert.equal(dayKey(fromDayKey('2026-03-29')), '2026-03-29')
})
