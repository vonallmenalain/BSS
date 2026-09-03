import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  addDays,
  addMonths,
  advanceStanding,
  dayKey,
  formatDayKey,
  isDayKey,
  isStanding,
  nextStandingRound,
  normalizeStanding,
  sectionOf,
  serializeStanding,
  standingLabel,
  standingTitle,
  standingWaits,
} from '../src/lib/standing.ts'
import type { AgendaItem, StandingRule } from '../src/lib/types.ts'

/*
 * Läuft ohne Bundler direkt in Node (Typen werden beim Laden entfernt,
 * Node >= 22.18): `npm run test:import`.
 *
 * Die ständigen Pendenzen hängen an zwei Fragen: Wann ist sie das nächste Mal
 * dran, und wartet sie gerade? Beide werden ohne Firestore beantwortet – und
 * deshalb hier geprüft.
 */

function rule(partial: Partial<StandingRule> = {}): StandingRule {
  return { every: 1, unit: 'meeting', ...partial }
}

/* ------------------------------------------------------------------ */
/* Tage                                                                */
/* ------------------------------------------------------------------ */

test('dayKey liest die lokale Zeit und nicht die von Greenwich', () => {
  // 1. August, halb ein Uhr nachts: in UTC noch der 31. Juli.
  assert.equal(dayKey(new Date(2026, 7, 1, 0, 30)), '2026-08-01')
  assert.equal(dayKey(new Date(2026, 11, 31, 23, 59)), '2026-12-31')
  // Ein Datumsschlüssel trägt den Tag bereits in sich.
  assert.equal(dayKey('2026-08-04T18:00:00Z'), '2026-08-04')
})

test('isDayKey erkennt nur vollständige Tage', () => {
  assert.equal(isDayKey('2026-08-04'), true)
  assert.equal(isDayKey('2026-08'), false)
  assert.equal(isDayKey(null), false)
  assert.equal(isDayKey(undefined), false)
})

test('addDays rechnet über Monats- und Jahresgrenzen', () => {
  assert.equal(addDays('2026-08-04', 7), '2026-08-11')
  assert.equal(addDays('2026-08-28', 7), '2026-09-04')
  assert.equal(addDays('2026-12-28', 7), '2027-01-04')
  // Schaltjahr: 2028 hat einen 29. Februar.
  assert.equal(addDays('2028-02-28', 1), '2028-02-29')
  assert.equal(addDays('2027-02-28', 1), '2027-03-01')
})

test('addMonths hält den Monatsletzten fest, statt in den nächsten zu rutschen', () => {
  assert.equal(addMonths('2026-08-04', 1), '2026-09-04')
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28')
  assert.equal(addMonths('2026-11-30', 3), '2027-02-28')
  assert.equal(addMonths('2026-12-15', 1), '2027-01-15')
})

test('formatDayKey stellt bloss um und rechnet nicht', () => {
  assert.equal(formatDayKey('2026-08-04'), '04.08.2026')
  assert.equal(formatDayKey('unsinn'), 'unsinn')
})

/* ------------------------------------------------------------------ */
/* Der Takt                                                            */
/* ------------------------------------------------------------------ */

test('normalizeStanding verwirft, was kein Takt ist', () => {
  assert.equal(normalizeStanding(null), null)
  assert.equal(normalizeStanding(undefined), null)
  assert.equal(normalizeStanding({}), null)
  assert.equal(normalizeStanding({ every: 2 }), null)
  assert.equal(normalizeStanding({ unit: 'jahrhundert' }), null)
})

test('normalizeStanding zieht die Zahl gerade', () => {
  assert.deepEqual(normalizeStanding({ unit: 'week', every: 0 }), { every: 1, unit: 'week' })
  assert.deepEqual(normalizeStanding({ unit: 'week', every: 2.4 }), { every: 2, unit: 'week' })
  assert.deepEqual(normalizeStanding({ unit: 'week', every: 500 }), { every: 99, unit: 'week' })
  // Die Einheit trägt die Aussage – eine fehlende Zahl ist eine 1.
  assert.deepEqual(normalizeStanding({ unit: 'month' }), { every: 1, unit: 'month' })
  // «Jede Sitzung» kennt keine andere Zahl.
  assert.deepEqual(normalizeStanding({ unit: 'meeting', every: 3 }), { every: 1, unit: 'meeting' })
})

test('normalizeStanding übernimmt nur ein brauchbares Datum', () => {
  assert.equal(
    normalizeStanding({ unit: 'month', every: 1, dueFrom: '2026-10-01' })?.dueFrom,
    '2026-10-01',
  )
  assert.equal(normalizeStanding({ unit: 'month', every: 1, dueFrom: 'bald' })?.dueFrom, undefined)
})

test('serializeStanding schreibt jedes Feld aus', () => {
  assert.deepEqual(serializeStanding(rule({ unit: 'week', every: 3 })), {
    every: 3,
    unit: 'week',
    dueFrom: null,
    doneCount: 0,
    lastDoneAt: null,
  })
})

test('isStanding fragt am Eintrag', () => {
  assert.equal(isStanding({ standing: { every: 1, unit: 'meeting' } }), true)
  assert.equal(isStanding({ standing: null }), false)
  assert.equal(isStanding({}), false)
})

test('standingLabel sagt Einzahl, wo die Zahl nichts hinzufügt', () => {
  assert.equal(standingLabel(rule()), 'jede Sitzung')
  assert.equal(standingLabel(rule({ unit: 'month', every: 1 })), 'jeden Monat')
  assert.equal(standingLabel(rule({ unit: 'week', every: 1 })), 'jede Woche')
  assert.equal(standingLabel(rule({ unit: 'week', every: 3 })), 'alle 3 Wochen')
  assert.equal(standingLabel(rule({ unit: 'day', every: 10 })), 'alle 10 Tage')
  assert.equal(standingTitle(rule({ unit: 'week', every: 3 })), 'Alle 3 Wochen')
})

/* ------------------------------------------------------------------ */
/* Wartet sie gerade?                                                  */
/* ------------------------------------------------------------------ */

test('standingWaits gilt nur bis zum Tag der nächsten Runde', () => {
  const item = { standing: { every: 1, unit: 'month' as const, dueFrom: '2026-10-01' } }
  assert.equal(standingWaits(item, '2026-09-30'), true)
  // Am Tag selbst ist sie dran – «ab» heisst einschliesslich.
  assert.equal(standingWaits(item, '2026-10-01'), false)
  assert.equal(standingWaits(item, '2026-10-02'), false)
  // Ohne Datum ist sie sofort dran, und eine gewöhnliche Pendenz wartet nie.
  assert.equal(standingWaits({ standing: { every: 1, unit: 'meeting' } }, '2026-09-30'), false)
  assert.equal(standingWaits({ standing: null }, '2026-09-30'), false)
})

/* ------------------------------------------------------------------ */
/* Wann ist sie das nächste Mal dran?                                  */
/* ------------------------------------------------------------------ */

const MEETINGS = [
  { id: 'm1', date: '2026-08-04' },
  { id: 'm2', date: '2026-08-11' },
  { id: 'm3', date: '2026-08-18' },
  { id: 'm4', date: '2026-09-15' },
]

test('jede Sitzung: die nächste geplante nach dieser', () => {
  assert.deepEqual(
    nextStandingRound(rule(), { fromMeetingId: 'm1', meetings: MEETINGS, today: '2026-08-04' }),
    { dueFrom: '2026-08-11', meetingId: 'm2' },
  )
})

test('jede Sitzung ohne Folgesitzung: sie wartet ohne Datum im Sammelkorb', () => {
  // Ein gerechnetes Datum hielte sie von einer Sitzung fern, die früher
  // stattfindet als vermutet.
  assert.deepEqual(
    nextStandingRound(rule(), { fromMeetingId: 'm4', meetings: MEETINGS, today: '2026-09-15' }),
    { dueFrom: null, meetingId: null },
  )
})

test('jede Sitzung aus dem Sammelkorb heraus: die nächste Sitzung ab heute', () => {
  assert.deepEqual(nextStandingRound(rule(), { meetings: MEETINGS, today: '2026-08-12' }), {
    dueFrom: '2026-08-18',
    meetingId: 'm3',
  })
})

test('monatlich: gerechnet ab heute, und dann die erste passende Sitzung', () => {
  assert.deepEqual(
    nextStandingRound(rule({ unit: 'month', every: 1 }), {
      fromMeetingId: 'm1',
      meetings: MEETINGS,
      today: '2026-08-04',
    }),
    { dueFrom: '2026-09-04', meetingId: 'm4' },
  )
})

test('monatlich ohne späte Sitzung: sie wartet mit Datum im Sammelkorb', () => {
  assert.deepEqual(
    nextStandingRound(rule({ unit: 'month', every: 2 }), {
      fromMeetingId: 'm1',
      meetings: MEETINGS,
      today: '2026-08-04',
    }),
    { dueFrom: '2026-10-04', meetingId: null },
  )
})

test('spät abgehakt: gerechnet wird ab heute und nicht ab der alten Sitzung', () => {
  // Sonst wäre die Pendenz im selben Augenblick wieder fällig, in dem sie
  // abgehakt wurde.
  assert.deepEqual(
    nextStandingRound(rule({ unit: 'week', every: 2 }), {
      fromMeetingId: 'm1',
      meetings: MEETINGS,
      today: '2026-09-01',
    }),
    { dueFrom: '2026-09-15', meetingId: 'm4' },
  )
})

test('vorgearbeitet: an einer künftigen Sitzung hängt der Takt an ihrem Tag', () => {
  // Abgehakt in der Sitzung vom 18. August, während heute erst der 4. ist:
  // Eine Woche später ist der 25., und die erste Sitzung ab dann ist m4.
  assert.deepEqual(
    nextStandingRound(rule({ unit: 'week', every: 1 }), {
      fromMeetingId: 'm3',
      meetings: MEETINGS,
      today: '2026-08-04',
    }),
    { dueFrom: '2026-08-25', meetingId: 'm4' },
  )
})

test('die Sitzungen dürfen ungeordnet hereinkommen', () => {
  assert.deepEqual(
    nextStandingRound(rule(), {
      fromMeetingId: 'm1',
      meetings: [...MEETINGS].reverse(),
      today: '2026-08-04',
    }),
    { dueFrom: '2026-08-11', meetingId: 'm2' },
  )
})

test('advanceStanding zählt die Runde und merkt sich den Tag', () => {
  const now = new Date('2026-08-04T18:30:00Z')
  assert.deepEqual(
    advanceStanding(rule({ doneCount: 4 }), { dueFrom: '2026-08-11', meetingId: 'm2' }, now),
    {
      every: 1,
      unit: 'meeting',
      dueFrom: '2026-08-11',
      doneCount: 5,
      lastDoneAt: now.toISOString(),
    },
  )
})

/* ------------------------------------------------------------------ */
/* Die drei Abschnitte einer Sitzung                                   */
/* ------------------------------------------------------------------ */

test('sectionOf stellt die ständige Pendenz voran', () => {
  const item = (partial: Partial<AgendaItem>) => partial as AgendaItem
  assert.equal(sectionOf(item({ kind: 'traktandum' })), 'traktandum')
  assert.equal(sectionOf(item({ kind: 'pendenz' })), 'pendenz')
  assert.equal(
    sectionOf(item({ kind: 'pendenz', standing: { every: 1, unit: 'meeting' } })),
    'standing',
  )
  // Auch ein Traktandum, an dem jemand einen Takt gesetzt hat, steht dort –
  // die beiden Angaben können auseinanderlaufen, und der Takt gewinnt.
  assert.equal(
    sectionOf(item({ kind: 'traktandum', standing: { every: 1, unit: 'week' } })),
    'standing',
  )
  // Altbestand ohne `kind`: Wer schon in einer anderen Sitzung stand, ist
  // eine Pendenz (siehe `toItemKind`).
  assert.equal(sectionOf(item({ meetingId: 'm2', firstMeetingId: 'm1' })), 'pendenz')
})
