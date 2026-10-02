import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  addDays,
  addMonths,
  advanceStanding,
  asDoneIn,
  canUndoStanding,
  dayKey,
  formatDayKey,
  isDayKey,
  isStanding,
  itemsByMeeting,
  itemsOfMeeting,
  nextStandingRound,
  normalizeStanding,
  revertStanding,
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
    doneIn: [],
    undo: null,
  })
})

test('normalizeStanding übernimmt die Sitzungen und den Stand davor', () => {
  const normalized = normalizeStanding({
    unit: 'meeting',
    doneIn: ['m1', '', 7, 'm2'],
    undo: { meetingId: 'm2', dueFrom: 'bald', lastDoneAt: '2026-10-01T18:30:00.000Z' },
  })
  assert.deepEqual(normalized?.doneIn, ['m1', 'm2'])
  assert.deepEqual(normalized?.undo, {
    meetingId: 'm2',
    dueFrom: null,
    lastDoneAt: '2026-10-01T18:30:00.000Z',
  })
  // Ohne Sitzung ist der Stand davor nichts wert.
  assert.equal(normalizeStanding({ unit: 'meeting', undo: { dueFrom: null } })?.undo, undefined)
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

/* ------------------------------------------------------------------ */
/* In der Sitzung erledigt                                             */
/* ------------------------------------------------------------------ */

/*
 * Der Fall aus der Praxis: In der Sitzung vom 1. Oktober wird eine ständige
 * Pendenz abgehakt. Sie wandert in die Sitzung vom 8. Oktober und ist dort
 * wieder offen – in der vom 1. soll sie trotzdem mit dem grünen Haken
 * stehen bleiben.
 */

const ABGEHAKT = new Date('2026-10-01T19:15:00Z')

test('advanceStanding merkt sich die Sitzung und den Stand davor', () => {
  const vorher = rule({ doneCount: 2, lastDoneAt: '2026-09-24T19:00:00.000Z', doneIn: ['m0'] })
  const nachher = advanceStanding(
    vorher,
    { dueFrom: '2026-10-08', meetingId: 'm2' },
    ABGEHAKT,
    'm1',
  )

  assert.deepEqual(nachher.doneIn, ['m0', 'm1'])
  assert.deepEqual(nachher.undo, {
    meetingId: 'm1',
    dueFrom: null,
    lastDoneAt: '2026-09-24T19:00:00.000Z',
  })
  assert.equal(nachher.doneCount, 3)
})

test('dieselbe Sitzung steht nur einmal in der Liste', () => {
  const nachher = advanceStanding(
    rule({ doneIn: ['m1'] }),
    { dueFrom: null, meetingId: null },
    ABGEHAKT,
    'm1',
  )
  assert.deepEqual(nachher.doneIn, ['m1'])
})

test('ohne Sitzung abgehakt: nichts zum Zurücknehmen', () => {
  const nachher = advanceStanding(
    rule({ doneIn: ['m1'], undo: { meetingId: 'm1', dueFrom: null, lastDoneAt: null } }),
    { dueFrom: '2026-11-01', meetingId: null },
    ABGEHAKT,
  )
  assert.deepEqual(nachher.doneIn, ['m1'])
  assert.equal(nachher.undo, undefined)
  assert.equal(serializeStanding(nachher).undo, null)
})

test('revertStanding stellt den Stand vor der letzten Runde wieder her', () => {
  const vorher = rule({
    doneCount: 2,
    dueFrom: '2026-10-01',
    lastDoneAt: '2026-09-24T19:00:00.000Z',
  })
  const nachher = advanceStanding(
    vorher,
    { dueFrom: '2026-10-08', meetingId: 'm2' },
    ABGEHAKT,
    'm1',
  )

  assert.deepEqual(revertStanding(nachher, 'm1'), {
    every: 1,
    unit: 'meeting',
    dueFrom: '2026-10-01',
    doneCount: 2,
    lastDoneAt: '2026-09-24T19:00:00.000Z',
    doneIn: [],
    undo: null,
  })
})

test('zurücknehmen geht nur mit der letzten Runde und in ihrer Sitzung', () => {
  const erste = advanceStanding(rule(), { dueFrom: '2026-10-08', meetingId: 'm2' }, ABGEHAKT, 'm1')
  const zweite = advanceStanding(
    erste,
    { dueFrom: '2026-10-15', meetingId: 'm3' },
    new Date('2026-10-08T19:15:00Z'),
    'm2',
  )

  assert.equal(revertStanding(zweite, 'm1'), null)
  assert.notEqual(revertStanding(zweite, 'm2'), null)
  assert.equal(canUndoStanding({ standing: zweite }, 'm1'), false)
  assert.equal(canUndoStanding({ standing: zweite }, 'm2'), true)
})

function item(partial: Partial<AgendaItem>): AgendaItem {
  return { id: 'p1', title: 'Ansprachen planen', status: 'pending', ...partial } as AgendaItem
}

test('in der Sitzung abgehakt steht sie dort als erledigt', () => {
  const standing = advanceStanding(
    rule(),
    { dueFrom: '2026-10-08', meetingId: 'm2' },
    ABGEHAKT,
    'm1',
  )
  const pendenz = item({ meetingId: 'm2', standing })
  const andere = item({ id: 'p2', meetingId: 'm1', kind: 'pendenz' })

  const ersteSitzung = itemsOfMeeting([pendenz, andere], 'm1')
  assert.deepEqual(
    ersteSitzung.map((entry) => [entry.id, entry.status, entry.doneInMeeting]),
    [
      ['p1', 'done', 'm1'],
      ['p2', 'pending', undefined],
    ],
  )

  // In der nächsten Sitzung ist sie wieder offen – wie sie gespeichert ist.
  const naechsteSitzung = itemsOfMeeting([pendenz, andere], 'm2')
  assert.deepEqual(
    naechsteSitzung.map((entry) => [entry.id, entry.status, entry.doneInMeeting]),
    [['p1', 'pending', undefined]],
  )
})

test('nach dem Zurücknehmen steht sie wieder offen in ihrer Sitzung', () => {
  const abgehakt = advanceStanding(
    rule(),
    { dueFrom: '2026-10-08', meetingId: 'm2' },
    ABGEHAKT,
    'm1',
  )
  const zurueck = item({ meetingId: 'm1', standing: revertStanding(abgehakt, 'm1') })

  assert.deepEqual(
    itemsOfMeeting([zurueck], 'm1').map((entry) => [entry.status, entry.doneInMeeting]),
    [['pending', undefined]],
  )
  assert.deepEqual(itemsOfMeeting([zurueck], 'm2'), [])
  // Das Fenster, das sie eben noch als erledigt zeigte, zeigt sie wieder offen.
  assert.equal(asDoneIn(zurueck, 'm1').status, 'pending')
})

test('itemsByMeeting legt die erledigte Runde in jede ihrer Sitzungen', () => {
  const standing = rule({ doneIn: ['m0', 'm1'] })
  const map = itemsByMeeting([item({ meetingId: 'm2', standing })])

  assert.deepEqual([...map.keys()].sort(), ['m0', 'm1', 'm2'])
  assert.equal(map.get('m0')?.[0].status, 'done')
  assert.equal(map.get('m1')?.[0].doneInMeeting, 'm1')
  assert.equal(map.get('m2')?.[0].status, 'pending')
})
