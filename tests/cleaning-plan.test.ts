import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  CLEANING_DEFAULT_TEXT,
  addMonths,
  cleaningAround,
  cleaningNow,
  diffCleaningPlan,
  fillCleaningText,
  generateCleaningWeeks,
  nextPlanStart,
  noMeetingSundays,
  rotationStart,
  sundayOnOrBefore,
  sundaysBetween,
} from '../src/lib/cleaningPlan.ts'

/*
 * Läuft ohne Bundler direkt in Node: `npm run test:import`.
 *
 * Geprüft wird, was sich aus dem Putzplan ablesen lässt – wem am Sonntag
 * gedankt wird, wer heute dran ist – und wie er sich fortführen lässt.
 */

/** Ein Plan wie der der Gemeinde: erst von Montag bis Samstag, ab August ab Sonntag. */
const WEEKS = [
  {
    startDate: '2026-06-29',
    endDate: '2026-07-04',
    group: 'Gruppe 2',
    team: 'Bader Roger & Sylvie',
  },
  {
    startDate: '2026-07-06',
    endDate: '2026-07-11',
    group: 'Gruppe 3',
    team: 'Nanogjoka Arbi & Melina',
  },
  {
    startDate: '2026-09-27',
    endDate: '2026-10-03',
    group: 'Gruppe 5',
    team: 'Morales-Römer Oscar & Céleste',
  },
  {
    startDate: '2026-12-27',
    endDate: '2027-01-02',
    group: 'Gruppe 6',
    team: 'von Allmen Adrian & Bea',
  },
]

/* ------------------------------------------------------------------ */
/* Der Sonntag zwischen zwei Wochen                                    */
/* ------------------------------------------------------------------ */

test('findet die Woche davor und die Woche danach', () => {
  const weeks = WEEKS
  // Sonntag, 5. Juli 2026 – zwischen «29.6. – 4.7.» und «6.7. – 11.7.».
  const { previous, next } = cleaningAround(weeks, '2026-07-05')

  assert.equal(previous?.startDate, '2026-06-29')
  assert.equal(next?.startDate, '2026-07-06')
})

test('kommt mit Wochen zurecht, die am Sonntag beginnen', () => {
  /*
   * Die Tabelle der Gemeinde wechselt mitten im Plan die Zählweise: bis
   * Juli von Montag bis Samstag, ab August von Sonntag bis Samstag. Am
   * 2. August 2026 ist der Sonntag damit der erste Tag der neuen Woche –
   * angekündigt gehört sie trotzdem, nicht die übernächste.
   */
  const weeks = [
    { startDate: '2026-07-27', endDate: '2026-08-01' },
    { startDate: '2026-08-02', endDate: '2026-08-08' },
    { startDate: '2026-08-09', endDate: '2026-08-15' },
  ]
  const { previous, next } = cleaningAround(weeks, '2026-08-02')

  assert.equal(previous?.startDate, '2026-07-27')
  assert.equal(next?.startDate, '2026-08-02')
})

test('kommt mit Wochen zurecht, die am Sonntag enden', () => {
  const weeks = [
    { startDate: '2026-06-29', endDate: '2026-07-05' },
    { startDate: '2026-07-06', endDate: '2026-07-12' },
  ]
  const { previous, next } = cleaningAround(weeks, '2026-07-05')

  assert.equal(previous?.startDate, '2026-06-29')
  assert.equal(next?.startDate, '2026-07-06')
})

test('überspringt Lücken im Plan, statt aufzugeben', () => {
  const weeks = WEEKS
  // Sonntag, 20. September – der Plan hat davor und danach eine Lücke.
  const { previous, next } = cleaningAround(weeks, '2026-09-20')
  assert.equal(previous?.startDate, '2026-07-06')
  assert.equal(next?.startDate, '2026-09-27')
})

test('meldet nichts, wo der Plan nicht hinreicht', () => {
  const weeks = WEEKS
  assert.equal(cleaningAround(weeks, '2026-06-28').previous, null)
  assert.equal(cleaningAround(weeks, '2027-02-07').next, null)
})

test('kündigt am letzten Sonntag des Jahres die Woche über den Jahreswechsel an', () => {
  // «27.12. – 2.1.» beginnt an einem Sonntag – genau an dem, an dem sie
  // angekündigt wird.
  const weeks = WEEKS
  const { previous, next } = cleaningAround(weeks, '2026-12-27')

  assert.equal(previous?.startDate, '2026-09-27')
  assert.equal(next?.startDate, '2026-12-27')
  assert.equal(next?.endDate, '2027-01-02')
})

/* ------------------------------------------------------------------ */
/* Der Wortlaut am Sonntag                                             */
/* ------------------------------------------------------------------ */

test('setzt die Platzhalter ein', () => {
  const text = fillCleaningText(CLEANING_DEFAULT_TEXT, {
    previousGroup: 'Gruppe 2',
    previousTeam: 'Bader Roger & Sylvie',
    nextGroup: 'Gruppe 3',
    nextTeam: 'Nanogjoka Arbi & Melina',
  })

  assert.equal(
    text,
    'Herzlichen Dank an Bader Roger & Sylvie (Gruppe 2) für das Putzen in der vergangenen Woche. ' +
      'In der kommenden Woche ist Gruppe 3 an der Reihe: Nanogjoka Arbi & Melina.',
  )
})

test('gibt nichts zurück, wenn ein gebrauchter Platzhalter leer bliebe', () => {
  const facts = {
    previousGroup: '',
    previousTeam: '',
    nextGroup: 'Gruppe 3',
    nextTeam: 'Nanogjoka Arbi & Melina',
  }
  assert.equal(fillCleaningText(CLEANING_DEFAULT_TEXT, facts), null)

  // Ein Text, der die fehlenden Angaben gar nicht braucht, geht durch.
  assert.equal(
    fillCleaningText('Diese Woche putzt {gruppe-neu}.', facts),
    'Diese Woche putzt Gruppe 3.',
  )
})

test('lässt unbekannte Klammerausdrücke stehen', () => {
  assert.equal(
    fillCleaningText('Bis {irgendwann} um {gruppe-neu}', {
      previousGroup: 'Gruppe 2',
      previousTeam: 'Team',
      nextGroup: 'Gruppe 3',
      nextTeam: 'Team',
    }),
    'Bis {irgendwann} um Gruppe 3',
  )
})

/* ------------------------------------------------------------------ */
/* Wer jetzt dran ist                                                  */
/* ------------------------------------------------------------------ */

test('diese Woche und die nächste – gezählt ab heute', () => {
  const weeks = [
    { startDate: '2026-10-11', endDate: '2026-10-17', team: 'C' },
    { startDate: '2026-09-27', endDate: '2026-10-03', team: 'A' },
    { startDate: '2026-10-04', endDate: '2026-10-10', team: 'B' },
  ]
  // Mittwoch: mitten in der Woche von B.
  const wednesday = cleaningNow(weeks, '2026-10-07')
  assert.equal(wednesday.current?.team, 'B')
  assert.equal(wednesday.next?.team, 'C')
  assert.equal(wednesday.after, null)
  // Der erste und der letzte Tag gehören dazu.
  assert.equal(cleaningNow(weeks, '2026-10-04').current?.team, 'B')
  assert.equal(cleaningNow(weeks, '2026-10-10').current?.team, 'B')
  // Nach dem letzten Eintrag ist niemand mehr dran.
  assert.deepEqual(cleaningNow(weeks, '2026-10-18'), { current: null, next: null, after: null })
})

test('am Sonntag zwischen zwei Wochen von Montag bis Samstag rückt die nächste nach', () => {
  const weeks = [
    { startDate: '2026-06-29', endDate: '2026-07-04', team: 'A' },
    { startDate: '2026-07-06', endDate: '2026-07-11', team: 'B' },
    { startDate: '2026-07-13', endDate: '2026-07-18', team: 'C' },
  ]
  const sunday = cleaningNow(weeks, '2026-07-05')
  assert.equal(sunday.current, null)
  assert.equal(sunday.next?.team, 'B')
  assert.equal(sunday.after?.team, 'C')
})

/* ------------------------------------------------------------------ */
/* Generieren                                                          */
/* ------------------------------------------------------------------ */

/** Zehn Gruppen, je ein zuständiger Haushalt. */
const GROUPS = Array.from({ length: 10 }, (_, index) => ({
  number: index + 1,
  entries: [{ id: `g${index + 1}`, label: `Familie ${index + 1}`, memberIds: [] }],
}))

/** Der Plan bis Ende September 2026, zuletzt Gruppe 4. */
const PLAN = [
  { startDate: '2026-09-13', endDate: '2026-09-19', group: 'Gruppe 3', team: 'Familie 3' },
  { startDate: '2026-09-20', endDate: '2026-09-26', group: 'Gruppe 4', team: 'Familie 4' },
]

const NO_SUNDAYS = new Map<string, never>()

test('Kalender: Sonntage, Monate und wo der Plan weitergeht', () => {
  assert.equal(sundayOnOrBefore('2026-10-07'), '2026-10-04')
  assert.equal(sundayOnOrBefore('2026-10-04'), '2026-10-04')
  assert.equal(addMonths('2026-10-31', 1), '2026-11-30')
  assert.equal(addMonths('2026-12-15', 3), '2027-03-15')
  assert.deepEqual(sundaysBetween('2026-10-01', '2026-10-18'), [
    '2026-10-04',
    '2026-10-11',
    '2026-10-18',
  ])
  assert.equal(nextPlanStart(PLAN, '2026-10-02'), '2026-09-27')
  assert.equal(nextPlanStart([], '2026-10-02'), '2026-10-04')
})

test('die Generalkonferenz ist fix – an ihr putzt dieselbe Gruppe weiter', () => {
  const noMeeting = noMeetingSundays('2026-09-27', '2026-10-24', new Map())
  // Der 4. Oktober 2026 ist der erste Sonntag im Oktober.
  assert.deepEqual([...noMeeting], [['2026-10-04', 'Generalkonferenz']])

  const weeks = generateCleaningWeeks({
    weeks: PLAN,
    groups: GROUPS,
    from: '2026-09-27',
    to: '2026-10-24',
    noMeeting,
  })
  assert.deepEqual(
    weeks.map((week) => [week.startDate, week.endDate, week.group, week.team, week.note]),
    [
      ['2026-09-27', '2026-10-03', 'Gruppe 5', 'Familie 5', ''],
      ['2026-10-04', '2026-10-10', 'Gruppe 5', 'Familie 5', 'Generalkonferenz'],
      ['2026-10-11', '2026-10-17', 'Gruppe 6', 'Familie 6', ''],
      ['2026-10-18', '2026-10-24', 'Gruppe 7', 'Familie 7', ''],
    ],
  )
})

test('Pfahlkonferenz und eigene Gründe kommen vom Sonntag – wie unter «Abendmahl» erfasst', () => {
  const stored = new Map([
    ['2026-11-15', { kind: 'stake_conference' }],
    ['2026-11-29', { kind: 'ausflug', kindLabel: 'Gemeindeausflug', meets: false }],
    // Eine Pfahlkonferenz, die ausnahmsweise in Burgdorf stattfindet, zählt nicht.
    ['2026-11-22', { kind: 'stake_conference', meets: true }],
  ])
  const noMeeting = noMeetingSundays('2026-11-08', '2026-12-05', stored)
  assert.deepEqual(
    [...noMeeting],
    [
      ['2026-11-15', 'Pfahlkonferenz'],
      ['2026-11-29', 'Gemeindeausflug'],
    ],
  )
  const weeks = generateCleaningWeeks({
    weeks: [
      { startDate: '2026-11-01', endDate: '2026-11-07', group: 'Gruppe 9', team: 'Familie 9' },
    ],
    groups: GROUPS,
    from: '2026-11-08',
    to: '2026-12-05',
    noMeeting,
  })
  assert.deepEqual(
    weeks.map((week) => week.group),
    ['Gruppe 10', 'Gruppe 10', 'Gruppe 1', 'Gruppe 1'],
  )
  assert.equal(weeks[3].note, 'Gemeindeausflug')
})

test('nach Gruppe 10 kommt wieder Gruppe 1 – ohne Plan beginnt Gruppe 1', () => {
  const first = rotationStart([], GROUPS, '2027-01-03', NO_SUNDAYS)
  assert.equal(first.group, 1)
  const weeks = generateCleaningWeeks({
    weeks: [
      { startDate: '2026-12-27', endDate: '2027-01-02', group: 'Gruppe 10', team: 'Familie 10' },
    ],
    groups: GROUPS,
    from: '2027-01-03',
    to: '2027-01-16',
    noMeeting: NO_SUNDAYS,
  })
  assert.deepEqual(
    weeks.map((week) => week.group),
    ['Gruppe 1', 'Gruppe 2'],
  )
})

test('mit einer anderen Gruppe beginnen – und ohne Zuständige bleibt «An der Reihe» leer', () => {
  const groups = [...GROUPS.slice(0, 2), { number: 3, entries: [] }]
  const weeks = generateCleaningWeeks({
    weeks: PLAN,
    groups,
    from: '2026-10-11',
    to: '2026-10-24',
    noMeeting: NO_SUNDAYS,
    firstGroup: 3,
  })
  assert.deepEqual(
    weeks.map((week) => [week.group, week.team]),
    [
      ['Gruppe 3', ''],
      ['Gruppe 1', 'Familie 1'],
    ],
  )
  assert.deepEqual(
    generateCleaningWeeks({
      weeks: PLAN,
      groups: [],
      from: '2026-10-11',
      to: '2026-10-24',
      noMeeting: NO_SUNDAYS,
    }),
    [],
  )
})

test('neu generieren: die Vorschau zeigt, was neu ist, was sich ändert und was wegfällt', () => {
  const existing = [
    {
      startDate: '2026-09-27',
      endDate: '2026-10-03',
      group: 'Gruppe 5',
      team: 'Familie 5',
      note: '',
    },
    // Damals ohne Generalkonferenz eingeteilt:
    {
      startDate: '2026-10-04',
      endDate: '2026-10-10',
      group: 'Gruppe 6',
      team: 'Familie 6',
      note: '',
    },
    // Eine alte Woche von Montag bis Samstag im Zeitraum:
    {
      startDate: '2026-10-12',
      endDate: '2026-10-17',
      group: 'Gruppe 7',
      team: 'Familie 7',
      note: '',
    },
  ]
  const weeks = generateCleaningWeeks({
    weeks: [...PLAN, ...existing],
    groups: GROUPS,
    from: '2026-09-27',
    to: '2026-10-17',
    noMeeting: noMeetingSundays('2026-09-27', '2026-10-17', new Map()),
  })
  const diff = diffCleaningPlan([...PLAN, ...existing], weeks)
  assert.deepEqual(
    diff.weeks.map((entry) => [entry.week.startDate, entry.change]),
    [
      ['2026-09-27', 'same'],
      ['2026-10-04', 'changed'],
      ['2026-10-11', 'new'],
    ],
  )
  assert.deepEqual(
    diff.removed.map((week) => week.startDate),
    ['2026-10-12'],
  )
})
