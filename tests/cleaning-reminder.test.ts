import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  cleaningReminderAt,
  cleaningReminderDayLabel,
  cleaningReminderDue,
  cleaningReminderLabel,
  cleaningReminderMark,
  cleaningReminderMessage,
  cleaningReminderWhen,
  cleaningWeekSpan,
  continuesCleaningWeek,
  dueCleaningWeek,
  nextCleaningReminder,
  parseCleaningReminder,
  validPushToken,
} from '../src/lib/cleaningReminder.ts'

const WEEKS = [
  {
    startDate: '2026-09-20',
    endDate: '2026-09-26',
    group: 'Gruppe 4',
    team: 'Beispiel Lea',
    note: '',
  },
  {
    startDate: '2026-09-27',
    endDate: '2026-10-03',
    group: 'Gruppe 5',
    team: 'Bader Roger & Sylvie',
    note: '',
  },
  // Generalkonferenz: Dieselbe Gruppe putzt eine zweite Woche.
  {
    startDate: '2026-10-04',
    endDate: '2026-10-10',
    group: 'Gruppe 5',
    team: 'Bader Roger & Sylvie',
    note: 'Generalkonferenz',
  },
  {
    startDate: '2026-10-11',
    endDate: '2026-10-17',
    group: 'Gruppe 6',
    team: 'Muster Hans & Anna',
    note: '',
  },
]

const SATURDAY_BEFORE = { group: 5, day: -1, time: '18:00' }

/* ------------------------------------------------------------------ */
/* Zeit                                                                */
/* ------------------------------------------------------------------ */

test('rechnet den Zeitpunkt in Schweizer Zeit – auch über die Zeitumstellung', () => {
  // Sommerzeit: 18:00 in Zürich ist 16:00 UTC.
  assert.equal(
    cleaningReminderAt('2026-10-04', { day: -1, time: '18:00' }).toISOString(),
    '2026-10-03T16:00:00.000Z',
  )
  // Am 25. Oktober endet die Sommerzeit: Samstag noch +2, Sonntag schon +1.
  assert.equal(
    cleaningReminderAt('2026-10-25', { day: -1, time: '18:00' }).toISOString(),
    '2026-10-24T16:00:00.000Z',
  )
  assert.equal(
    cleaningReminderAt('2026-10-25', { day: 0, time: '18:00' }).toISOString(),
    '2026-10-25T17:00:00.000Z',
  )
  // Samstag am Ende der Woche, über den Monatswechsel.
  assert.equal(
    cleaningReminderAt('2026-09-27', { day: 6, time: '09:00' }).toISOString(),
    '2026-10-03T07:00:00.000Z',
  )
})

test('ist fällig ab dem Zeitpunkt und noch zwei Stunden danach', () => {
  const at = new Date('2026-10-03T16:00:00Z')
  const minutes = (value: number) => new Date(at.getTime() + value * 60_000)
  assert.equal(cleaningReminderDue(at, minutes(-1)), false)
  assert.equal(cleaningReminderDue(at, minutes(0)), true)
  assert.equal(cleaningReminderDue(at, minutes(119)), true)
  assert.equal(cleaningReminderDue(at, minutes(120)), false)
})

test('findet die fällige Woche der Gruppe und erinnert nur einmal', () => {
  const now = new Date('2026-10-03T16:05:00Z')
  const week = dueCleaningWeek(WEEKS, SATURDAY_BEFORE, now, '')
  assert.equal(week?.startDate, '2026-10-04')

  // Schon verschickt – die Marke hält sie zurück.
  assert.equal(dueCleaningWeek(WEEKS, SATURDAY_BEFORE, now, '5:2026-10-04'), null)
  // Eine andere Gruppe ist zu dieser Zeit nicht fällig.
  assert.equal(dueCleaningWeek(WEEKS, { ...SATURDAY_BEFORE, group: 6 }, now, ''), null)
  // Zu spät: Was mehr als zwei Stunden her ist, kommt nicht mehr.
  assert.equal(dueCleaningWeek(WEEKS, SATURDAY_BEFORE, new Date('2026-10-04T08:00:00Z'), ''), null)
})

test('die Marke trägt die Gruppe – ein Wechsel verschluckt keine Erinnerung', () => {
  assert.equal(cleaningReminderMark(5, '2026-10-04'), '5:2026-10-04')
  const now = new Date('2026-10-10T16:00:00Z')
  // Gruppe 5 wurde für den 4. Oktober erinnert; Gruppe 6 ist eine andere Marke.
  assert.equal(
    dueCleaningWeek(WEEKS, { group: 6, day: -1, time: '18:00' }, now, '5:2026-10-04')?.startDate,
    '2026-10-11',
  )
})

test('nennt die nächste Erinnerung für die Vorschau', () => {
  const next = nextCleaningReminder(WEEKS, SATURDAY_BEFORE, new Date('2026-10-02T12:00:00Z'))
  assert.equal(next?.week.startDate, '2026-10-04')
  assert.equal(next?.at.toISOString(), '2026-10-03T16:00:00.000Z')

  assert.equal(nextCleaningReminder(WEEKS, SATURDAY_BEFORE, new Date('2026-10-04T00:00:00Z')), null)
  assert.equal(nextCleaningReminder(WEEKS, { ...SATURDAY_BEFORE, group: 9 }, new Date()), null)
})

test('erkennt die zweite Woche um einen Sonntag ohne Versammlung', () => {
  assert.equal(continuesCleaningWeek(WEEKS, WEEKS[2]), true)
  assert.equal(continuesCleaningWeek(WEEKS, WEEKS[1]), false)
  assert.equal(continuesCleaningWeek(WEEKS, WEEKS[3]), false)
})

/* ------------------------------------------------------------------ */
/* Texte                                                               */
/* ------------------------------------------------------------------ */

test('schreibt die Nachricht – vor und in der Woche, und als Verlängerung', () => {
  assert.deepEqual(cleaningReminderMessage(WEEKS[1], { day: -1 }), {
    title: 'Ab morgen putzt Gruppe 5',
    body: '27. September – 3. Oktober · zuständig: Bader Roger & Sylvie',
  })
  assert.deepEqual(cleaningReminderMessage(WEEKS[3], { day: 6 }), {
    title: 'Diese Woche putzt Gruppe 6',
    body: '11.–17. Oktober · zuständig: Muster Hans & Anna',
  })
  assert.deepEqual(cleaningReminderMessage(WEEKS[2], { day: -1 }, true), {
    title: 'Gruppe 5 putzt noch eine Woche',
    body: '4.–10. Oktober (Generalkonferenz) · zuständig: Bader Roger & Sylvie',
  })
  assert.deepEqual(
    cleaningReminderMessage(WEEKS[2], { day: 0 }, true).title,
    'Gruppe 5 putzt auch diese Woche',
  )
  assert.deepEqual(
    cleaningReminderMessage({ ...WEEKS[3], team: '' }, { day: 0 }).body,
    '11.–17. Oktober',
  )
})

test('nennt die Woche über Monats- und Jahreswechsel', () => {
  assert.equal(
    cleaningWeekSpan({ startDate: '2026-10-04', endDate: '2026-10-10' }),
    '4.–10. Oktober',
  )
  assert.equal(
    cleaningWeekSpan({ startDate: '2026-12-27', endDate: '2027-01-02' }),
    '27. Dezember 2026 – 2. Januar 2027',
  )
})

test('beschriftet Tag, Einstellung und Zeitpunkt', () => {
  assert.equal(cleaningReminderDayLabel(-1), 'Am Samstag davor')
  assert.equal(cleaningReminderDayLabel(0), 'Am Sonntag, wenn die Woche beginnt')
  assert.equal(cleaningReminderDayLabel(3), 'Am Mittwoch')
  assert.equal(cleaningReminderLabel({ day: -1, time: '18:00' }), 'Samstag davor, 18:00')
  assert.equal(cleaningReminderLabel({ day: 6, time: '09:30' }), 'Samstag in der Woche, 09:30')
  assert.equal(
    cleaningReminderWhen(new Date('2026-10-03T16:00:00Z')),
    'Samstag, 3. Oktober um 18:00',
  )
})

/* ------------------------------------------------------------------ */
/* Was der Server annimmt                                              */
/* ------------------------------------------------------------------ */

test('nimmt nur an, was die Auswahl anbietet', () => {
  assert.deepEqual(parseCleaningReminder({ group: 5, day: -1, time: '18:00' }), {
    group: 5,
    day: -1,
    time: '18:00',
  })
  // Was sonst noch mitkommt, fällt weg.
  assert.deepEqual(parseCleaningReminder({ group: 1, day: 6, time: '00:30', extra: true }), {
    group: 1,
    day: 6,
    time: '00:30',
  })
  for (const input of [
    null,
    'gruppe 5',
    { group: 0, day: 0, time: '18:00' },
    { group: 100, day: 0, time: '18:00' },
    { group: 1.5, day: 0, time: '18:00' },
    { group: '5', day: 0, time: '18:00' },
    { group: 5, day: 7, time: '18:00' },
    { group: 5, day: -2, time: '18:00' },
    { group: 5, day: 0, time: '18:15' },
    { group: 5, day: 0, time: '25:00' },
  ]) {
    assert.equal(parseCleaningReminder(input), null, JSON.stringify(input))
  }
})

test('prüft die Form der Geräte-Adresse', () => {
  assert.equal(validPushToken('dXyZ0123456789_-abc:APA91bHk-9_xyz'), true)
  assert.equal(validPushToken('kurz'), false)
  assert.equal(validPushToken('mit leerzeichen und genug zeichen'), false)
  assert.equal(validPushToken('a/b/c/d/e/f/g/h/i/j/k/l/m'), false)
  assert.equal(validPushToken(42), false)
})
