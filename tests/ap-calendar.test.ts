import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  apCalendarGrid,
  apCalendarShowsToday,
  apCalendarStep,
  apCalendarTitle,
} from '../src/lib/apCalendar.ts'
import {
  apEndTime,
  apStartTime,
  apTimeLabel,
  apTimePlus,
  apVisibleActivities,
} from '../src/lib/types.ts'
import type { ApActivity } from '../src/lib/types.ts'

/*
 * Läuft ohne Bundler direkt in Node: `npm run test:import`.
 *
 * Geprüft wird das Raster, auf dem die beiden Kalenderansichten des
 * Aktivitätenplans stehen: Die Woche beginnt am Montag, ein Monat füllt
 * seine erste und letzte Zeile mit den angrenzenden Tagen auf, und ein
 * mehrtägiger Anlass steht an jedem Tag, den er belegt.
 */

/** Ein Tag als lokales Datum um Mittag – so wie die Oberfläche rechnet. */
const day = (iso: string) => new Date(`${iso}T12:00:00`)

const activity = (partial: Partial<ApActivity> & { date: string }): ApActivity =>
  ({
    id: partial.date,
    kind: 'activity',
    title: 'Bouldern',
    ...partial,
  }) as ApActivity

/* ------------------------------------------------------------------ */
/* Woche                                                               */
/* ------------------------------------------------------------------ */

test('die Woche beginnt am Montag und endet am Sonntag', () => {
  // Der 8. Juli 2026 ist ein Mittwoch.
  const [week, ...rest] = apCalendarGrid([], day('2026-07-08'), 'week')

  assert.equal(rest.length, 0)
  assert.equal(week.days.length, 7)
  assert.equal(week.days[0].key, '2026-07-06')
  assert.equal(week.days[6].key, '2026-07-12')
  assert.equal(week.days[0].date.getDay(), 1)
  assert.equal(week.days[6].date.getDay(), 0)
})

test('in der Wochenansicht gehören alle sieben Tage dazu', () => {
  // Diese Woche liegt über dem Monatswechsel – auch der Juli-Teil zählt.
  const [week] = apCalendarGrid([], day('2026-06-30'), 'week')
  assert.deepEqual(
    week.days.map((entry) => entry.inRange),
    Array(7).fill(true),
  )
})

/* ------------------------------------------------------------------ */
/* Monat                                                               */
/* ------------------------------------------------------------------ */

test('der Monat steht in vollen Wochen und markiert die angrenzenden Tage', () => {
  // Der 1. Juli 2026 ist ein Mittwoch, der 31. ein Freitag.
  const weeks = apCalendarGrid([], day('2026-07-15'), 'month')

  assert.equal(weeks[0].days[0].key, '2026-06-29')
  assert.equal(weeks.at(-1)?.days[6].key, '2026-08-02')
  weeks.forEach((week) => assert.equal(week.days.length, 7))

  const juni = weeks[0].days[0]
  assert.equal(juni.inRange, false)
  assert.equal(weeks[0].days[2].key, '2026-07-01')
  assert.equal(weeks[0].days[2].inRange, true)
})

/* ------------------------------------------------------------------ */
/* Termine im Raster                                                   */
/* ------------------------------------------------------------------ */

test('ein mehrtägiger Anlass steht an jedem Tag, den er belegt', () => {
  const lager = activity({ date: '2026-07-10', endDate: '2026-07-12', title: 'Lager' })
  const [week] = apCalendarGrid([lager], day('2026-07-08'), 'week')

  const belegt = week.days.filter((entry) => entry.activities.length > 0).map((entry) => entry.key)

  assert.deepEqual(belegt, ['2026-07-10', '2026-07-11', '2026-07-12'])
})

test('innerhalb eines Tages zuerst, was ohne Zeitangabe steht', () => {
  const klasse = activity({ date: '2026-07-08', time: '19:30', title: 'Klasse', kind: 'class' })
  const lager = activity({ date: '2026-07-08', title: 'Lager', id: 'lager' })
  const [week] = apCalendarGrid([klasse, lager], day('2026-07-08'), 'week')

  const mittwoch = week.days.find((entry) => entry.key === '2026-07-08')
  assert.deepEqual(
    mittwoch?.activities.map((entry) => entry.title),
    ['Lager', 'Klasse'],
  )
})

test('das Raster lässt die übergebene Liste unangetastet', () => {
  const zuerst = activity({ date: '2026-07-08', time: '19:30', id: 'a' })
  const danach = activity({ date: '2026-07-08', time: '09:00', id: 'b' })
  const liste = [zuerst, danach]

  apCalendarGrid(liste, day('2026-07-08'), 'week')

  assert.deepEqual(
    liste.map((entry) => entry.id),
    ['a', 'b'],
  )
})

/* ------------------------------------------------------------------ */
/* Beschriftung und Blättern                                           */
/* ------------------------------------------------------------------ */

test('die Beschriftung nennt Gemeinsames nur einmal', () => {
  assert.equal(apCalendarTitle(day('2026-07-08'), 'week'), '6. – 12. Juli 2026')
  assert.equal(apCalendarTitle(day('2026-07-01'), 'week'), '29. Juni – 5. Juli 2026')
  assert.equal(apCalendarTitle(day('2025-12-31'), 'week'), '29. Dezember 2025 – 4. Januar 2026')
  assert.equal(apCalendarTitle(day('2026-07-08'), 'month'), 'Juli 2026')
})

test('geblättert wird um eine Woche bzw. um einen Monat', () => {
  assert.equal(apCalendarStep(day('2026-07-08'), 'week', 1).getDate(), 15)
  assert.equal(apCalendarStep(day('2026-07-08'), 'week', -1).getDate(), 1)
  assert.equal(apCalendarStep(day('2026-07-08'), 'month', 1).getMonth(), 7)
  assert.equal(apCalendarStep(day('2026-01-31'), 'month', 1).getMonth(), 1)
})

test('«Heute» ruht, solange das Raster den heutigen Tag zeigt', () => {
  const heute = day('2026-07-08')
  assert.equal(apCalendarShowsToday(day('2026-07-06'), 'week', heute), true)
  assert.equal(apCalendarShowsToday(day('2026-07-13'), 'week', heute), false)
  assert.equal(apCalendarShowsToday(day('2026-07-31'), 'month', heute), true)
  assert.equal(apCalendarShowsToday(day('2026-08-01'), 'month', heute), false)
})

/* ------------------------------------------------------------------ */
/* Auswahl der Arten                                                   */
/* ------------------------------------------------------------------ */

test('ohne Auswahl steht alles im Plan, mit Auswahl fällt «Fällt aus» weg', () => {
  const plan = [
    activity({ date: '2026-07-01', kind: 'activity', id: 'a' }),
    activity({ date: '2026-07-12', kind: 'class', id: 'k' }),
    activity({ date: '2026-07-15', kind: 'cancelled', id: 'x' }),
    activity({ date: '2026-07-18', kind: 'special', id: 's' }),
  ]

  assert.equal(apVisibleActivities(plan, []).length, 4)
  assert.equal(apVisibleActivities(plan, undefined).length, 4)
  assert.deepEqual(
    apVisibleActivities(plan, ['activity', 'class', 'special']).map((entry) => entry.id),
    ['a', 'k', 's'],
  )
  assert.deepEqual(
    apVisibleActivities(plan, ['class']).map((entry) => entry.id),
    ['k'],
  )
})

/* ------------------------------------------------------------------ */
/* Von – bis                                                           */
/* ------------------------------------------------------------------ */

test('erfasst ist erfasst – Beginn und Ende stehen am Termin', () => {
  const abend = activity({ date: '2026-07-01', time: '19:30', endTime: '21:00' })

  assert.equal(apStartTime(abend), '19:30')
  assert.equal(apEndTime(abend), '21:00')
  assert.equal(apTimeLabel(abend), '19:30 – 21:00')
})

test('ohne Ende steht nur der Beginn da – ein Strich ins Leere sagt nichts', () => {
  const abend = activity({ date: '2026-07-01', time: '19:30' })

  assert.equal(apEndTime(abend), '')
  assert.equal(apTimeLabel(abend), '19:30')
})

test('ohne jede Zeit bleibt es dabei', () => {
  const lager = activity({ date: '2026-07-01', kind: 'special' })

  assert.equal(apStartTime(lager), '')
  assert.equal(apEndTime(lager), '')
  assert.equal(apTimeLabel(lager), '')
})

test('die Klasse bringt ihre Stunde mit – auch verschoben', () => {
  const klasse = activity({ date: '2026-07-12', kind: 'class' })
  const frueh = activity({ date: '2026-07-12', kind: 'class', time: '09:15' })
  const kurz = activity({ date: '2026-07-12', kind: 'class', endTime: '11:45' })

  assert.equal(apTimeLabel(klasse), '11:00 – 12:00')
  assert.equal(apTimeLabel(frueh), '09:15 – 10:15')
  // Was erfasst ist, gilt vor dem Üblichen.
  assert.equal(apTimeLabel(kurz), '11:00 – 11:45')
})

test('eine Uhrzeit weiterstellen – und was dabei keine Uhrzeit ergibt', () => {
  assert.equal(apTimePlus('11:00', 60), '12:00')
  assert.equal(apTimePlus('19:45', 90), '21:15')
  assert.equal(apTimePlus('09:00', 0), '09:00')
  // Über Mitternacht wird nicht gerechnet, und aus Unlesbarem wird nichts.
  assert.equal(apTimePlus('23:30', 60), '')
  assert.equal(apTimePlus('nach Absprache', 60), '')
  assert.equal(apTimePlus('', 60), '')
})
