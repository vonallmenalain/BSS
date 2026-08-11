import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  CONFERENCE_TITLE,
  FHV_TITLE,
  HOLIDAY_TITLE,
  apClassSundays,
  generateApSchedule,
  isApClassSunday,
  isGeneralConferenceSunday,
  nextFreeApDate,
  sundaysOfMonth,
} from '../src/services/apSchedule.ts'
import { SCHOOL_HOLIDAYS, isSchoolHoliday } from '../src/lib/schoolHolidays.ts'
import { apClassHours, apTimeLabel } from '../src/lib/types.ts'

/*
 * Läuft ohne Bundler direkt in Node: `npm run test:import`.
 *
 * Geprüft wird der Grundtakt des Aktivitätenplans – der Wechsel im
 * September 2026 (die AP-Klasse war am 2. und 4. Sonntag von 11 bis 12 Uhr
 * und ist seither an jedem Sonntag von 11:35 bis 12:00) und die drei
 * Gründe, aus denen ein Termin ausfällt: FHV, Schulferien, Generalkonferenz.
 */

const options = (from: string, to: string) => ({
  from,
  to,
  activities: false,
  classes: true,
  fhv: false,
  holidays: false,
  conference: false,
})

/** Nur die Mittwochsseite: Aktivitäten, FHV und Ferien. */
const wednesdays = (from: string, to: string) => ({
  from,
  to,
  activities: true,
  classes: false,
  fhv: true,
  holidays: true,
  conference: false,
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
/* Die Generalkonferenz                                                */
/* ------------------------------------------------------------------ */

test('der 1. Sonntag im April und im Oktober ist Generalkonferenz', () => {
  assert.equal(isGeneralConferenceSunday('2027-04-04'), true)
  assert.equal(isGeneralConferenceSunday('2027-10-03'), true)
  // Der zweite Sonntag im selben Monat ist gewöhnlich.
  assert.equal(isGeneralConferenceSunday('2027-04-11'), false)
  // Ein Mittwoch in derselben Woche ebenso – gemeint ist der Sonntag.
  assert.equal(isGeneralConferenceSunday('2027-04-07'), false)
  // Und der 1. Sonntag jedes anderen Monats.
  assert.equal(isGeneralConferenceSunday('2027-05-02'), false)
})

test('an den Konferenzsonntagen findet keine Klasse statt', () => {
  assert.equal(isApClassSunday('2027-04-04', 1), false)
  assert.equal(isApClassSunday('2027-10-03', 1), false)

  // Auch der Themen-Import lässt diesen Sonntag deshalb aus.
  assert.deepEqual(apClassSundays('2027-04'), ['2027-04-11', '2027-04-18', '2027-04-25'])
  assert.deepEqual(apClassSundays('2027-10'), [
    '2027-10-10',
    '2027-10-17',
    '2027-10-24',
    '2027-10-31',
  ])
  // Ein Monat ohne Konferenz behält alle seine Sonntage.
  assert.deepEqual(apClassSundays('2027-05'), sundaysOfMonth('2027-05'))
})

test('statt der Klasse steht der Grund im Plan', () => {
  const entries = generateApSchedule({ ...options('2027-04-01', '2027-04-30'), conference: true })

  assert.deepEqual(
    entries.map((entry) => `${entry.date} ${entry.title}`),
    [`2027-04-04 ${CONFERENCE_TITLE}`, '2027-04-11 ', '2027-04-18 ', '2027-04-25 '],
  )
  assert.equal(entries[0].kind, 'cancelled')
  assert.equal(entries[0].reason, 'conference')
})

test('im alten Takt bleibt der Konferenzsonntag ohne Hinweis', () => {
  // Der 1. Sonntag im April 2026 war ohnehin kein Klassentag – ein «fällt
  // aus» erklärte dort eine Lücke, die es gar nicht gab.
  const entries = generateApSchedule({ ...options('2026-04-01', '2026-04-30'), conference: true })

  assert.deepEqual(
    entries.map((entry) => entry.date),
    ['2026-04-12', '2026-04-26'],
  )
})

/* ------------------------------------------------------------------ */
/* Die Schulferien                                                     */
/* ------------------------------------------------------------------ */

test('der Ferienplan kennt den ersten und den letzten Ferientag', () => {
  assert.equal(isSchoolHoliday('2027-07-03'), true) // erster Tag der Sommerferien
  assert.equal(isSchoolHoliday('2027-08-15'), true) // letzter Tag
  assert.equal(isSchoolHoliday('2027-07-02'), false)
  assert.equal(isSchoolHoliday('2027-08-16'), false)
})

test('die Ferien stehen der Reihe nach und überschneiden sich nicht', () => {
  let previous = ''
  for (const holiday of SCHOOL_HOLIDAYS) {
    assert.ok(holiday.from <= holiday.to, `${holiday.name} ${holiday.from}`)
    assert.ok(holiday.from > previous, `${holiday.name} ${holiday.from} nach ${previous}`)
    previous = holiday.to
  }
})

test('die Ferien gehen der FHV vor', () => {
  // Sportwoche 2027: Sa 13.02. bis So 21.02. – der 3. Mittwoch fällt hinein.
  const entries = generateApSchedule(wednesdays('2027-02-01', '2027-02-28'))

  assert.deepEqual(
    entries.map((entry) => `${entry.date} ${entry.title}`),
    ['2027-02-03 ', '2027-02-10 ', `2027-02-17 ${HOLIDAY_TITLE}`, '2027-02-24 '],
  )
  assert.equal(entries[2].kind, 'cancelled')
  assert.equal(entries[2].reason, 'holiday')
})

test('jeder Mittwoch der Ferien steht als Ferientag im Plan', () => {
  // Herbstferien 2027: Sa 25.09. bis So 17.10.
  const entries = generateApSchedule(wednesdays('2027-10-01', '2027-10-31'))

  assert.deepEqual(
    entries.map((entry) => `${entry.date} ${entry.title}`),
    [
      `2027-10-06 ${HOLIDAY_TITLE}`,
      `2027-10-13 ${HOLIDAY_TITLE}`,
      `2027-10-20 ${FHV_TITLE}`,
      '2027-10-27 ',
    ],
  )
})

test('die AP-Klasse findet auch in den Ferien statt', () => {
  // Mitten in den Sommerferien 2027 – die Klasse am Sonntag bleibt.
  const entries = generateApSchedule(options('2027-07-01', '2027-07-31'))

  assert.deepEqual(
    entries.map((entry) => entry.date),
    ['2027-07-04', '2027-07-11', '2027-07-18', '2027-07-25'],
  )
})

test('das ganze Jahr 2027 lässt keinen Mittwoch offen', () => {
  const entries = generateApSchedule({
    from: '2027-01-01',
    to: '2027-12-31',
    activities: true,
    classes: true,
    fhv: true,
    holidays: true,
    conference: true,
  })

  const byDate = new Map(entries.map((entry) => [entry.date, entry]))

  const cursor = new Date(2027, 0, 1)
  while (cursor.getFullYear() === 2027) {
    // Von Hand statt `toISOString()`: Das rechnet nach UTC um und liefert
    // in Zürich den Vortag.
    const date = `2027-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(
      cursor.getDate(),
    ).padStart(2, '0')}`
    if (cursor.getDay() === 3) {
      const entry = byDate.get(date)
      assert.ok(entry, `Mittwoch ohne Eintrag: ${date}`)
      // In den Ferien nie eine Aktivität, ausserhalb nie ein Ferientag.
      assert.equal(entry?.reason === 'holiday', isSchoolHoliday(date), date)
    }
    cursor.setDate(cursor.getDate() + 1)
  }

  // Zwei Konferenzsonntage, und an beiden keine Klasse.
  const conference = entries.filter((entry) => entry.reason === 'conference')
  assert.deepEqual(
    conference.map((entry) => entry.date),
    ['2027-04-04', '2027-10-03'],
  )
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

test('von September bis Ende Jahr entstehen sechzehn Klassen', () => {
  const entries = generateApSchedule(options('2026-09-01', '2026-12-31'))

  // 4 + 4 + 5 + 4 Sonntage, abzüglich der Generalkonferenz am 4. Oktober.
  assert.equal(entries.length, 16)
  assert.equal(entries.at(0)?.date, '2026-09-06')
  assert.equal(
    entries.some((entry) => entry.date === '2026-10-04'),
    false,
  )
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
