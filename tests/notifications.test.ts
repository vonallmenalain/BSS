import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  AGENDA_GAP_MINUTES,
  agendaDue,
  agendaMessage,
  clockLabel,
  DEFAULT_NOTIFICATION_SETTINGS,
  firstName,
  formatTime,
  impulsMessage,
  joinNames,
  meetingDue,
  meetingMessage,
  NOTIFY_TIMES,
  parseTime,
  scheduleDue,
  scheduleLabel,
  wallClock,
} from '../src/lib/notifications.ts'
import type { NotificationSchedule } from '../src/lib/types.ts'

/* ------------------------------------------------------------------ */
/* Wanduhr                                                             */
/* ------------------------------------------------------------------ */

test('wallClock rechnet UTC in Schweizer Wanduhrzeit um', () => {
  // 12. August 2026 ist ein Mittwoch; Sommerzeit heisst UTC+2.
  const sommer = wallClock(new Date('2026-08-12T06:00:00Z'))
  assert.equal(sommer.weekday, 3)
  assert.equal(sommer.minutes, 8 * 60)

  // 12. Januar 2026 ist ein Montag; Winterzeit heisst UTC+1.
  const winter = wallClock(new Date('2026-01-12T07:00:00Z'))
  assert.equal(winter.weekday, 1)
  assert.equal(winter.minutes, 8 * 60)
})

test('wallClock zählt Sonntag als siebten Tag, nicht als nullten', () => {
  assert.equal(wallClock(new Date('2026-08-16T10:00:00Z')).weekday, 7)
})

test('clockLabel zeigt die Uhrzeit, die in der Schweiz auf der Uhr steht', () => {
  assert.equal(clockLabel(new Date('2026-08-12T17:00:00Z')), '19:00')
  assert.equal(clockLabel(new Date('2026-01-12T17:00:00Z')), '18:00')
})

/* ------------------------------------------------------------------ */
/* Uhrzeiten                                                           */
/* ------------------------------------------------------------------ */

test('parseTime liest «HH:MM» und fällt bei Unsinn auf acht Uhr zurück', () => {
  assert.equal(parseTime('08:00'), 480)
  assert.equal(parseTime('23:30'), 1410)
  assert.equal(parseTime('0:15'), 15)
  assert.equal(parseTime('unfug'), 480)
  assert.equal(parseTime('25:00'), 480)
  assert.equal(parseTime('08:75'), 480)
})

test('formatTime schreibt Minuten wieder als Uhrzeit', () => {
  assert.equal(formatTime(0), '00:00')
  assert.equal(formatTime(480), '08:00')
  assert.equal(formatTime(1410), '23:30')
})

test('NOTIFY_TIMES bietet jede halbe Stunde eines Tages an', () => {
  assert.equal(NOTIFY_TIMES.length, 48)
  assert.equal(NOTIFY_TIMES[0], '00:00')
  assert.equal(NOTIFY_TIMES[16], '08:00')
  assert.equal(NOTIFY_TIMES.at(-1), '23:30')
  // Jede angebotene Zeit muss ein Lauf auch treffen können (alle 15 Minuten).
  for (const time of NOTIFY_TIMES) assert.equal(parseTime(time) % 15, 0)
})

/* ------------------------------------------------------------------ */
/* Fälligkeit des Zeitplans                                            */
/* ------------------------------------------------------------------ */

const montags: NotificationSchedule = { mode: 'weekly', weekday: 1, time: '08:00' }

test('wöchentlich: fällig am gewählten Tag zur gewählten Zeit', () => {
  // Montag, 10. August 2026, 08:00 Schweizer Zeit.
  assert.equal(scheduleDue(montags, new Date('2026-08-10T06:00:00Z'), null), true)
})

test('wöchentlich: vor der Zeit und an anderen Tagen bleibt es still', () => {
  // Montag, 07:45 – noch nicht.
  assert.equal(scheduleDue(montags, new Date('2026-08-10T05:45:00Z'), null), false)
  // Dienstag, 08:00 – falscher Tag.
  assert.equal(scheduleDue(montags, new Date('2026-08-11T06:00:00Z'), null), false)
})

test('wöchentlich: die Zeitumstellung verschiebt nichts', () => {
  // Montag nach der Umstellung auf Winterzeit (26. Oktober 2026): 08:00
  // Schweizer Zeit ist jetzt 07:00 UTC – und genau dann fällig.
  assert.equal(scheduleDue(montags, new Date('2026-10-26T07:00:00Z'), null), true)
  assert.equal(scheduleDue(montags, new Date('2026-10-26T06:00:00Z'), null), false)
})

test('eine verpasste Erinnerung wird zwei Stunden lang nachgereicht', () => {
  // Montag 09:45 Schweizer Zeit – der Lauf um acht ist ausgefallen.
  assert.equal(scheduleDue(montags, new Date('2026-08-10T07:45:00Z'), null), true)
  // Montag 10:15 – zu spät, die Erinnerung entfällt.
  assert.equal(scheduleDue(montags, new Date('2026-08-10T08:15:00Z'), null), false)
})

test('wöchentlich: eine zweite Nachricht in derselben Woche unterbleibt', () => {
  const montagAcht = new Date('2026-08-10T06:00:00Z')
  const montagNeun = new Date('2026-08-10T07:00:00Z')
  assert.equal(scheduleDue(montags, montagNeun, montagAcht), false)
  // Die Woche darauf ist es wieder so weit.
  assert.equal(scheduleDue(montags, new Date('2026-08-17T06:00:00Z'), montagAcht), true)
})

test('täglich: jeden Tag zur gewählten Zeit, aber nur einmal', () => {
  const taeglich: NotificationSchedule = { mode: 'daily', weekday: 1, time: '07:00' }
  const mittwoch = new Date('2026-08-12T05:00:00Z')

  assert.equal(scheduleDue(taeglich, mittwoch, null), true)
  // Der Wochentag zählt beim Tagestakt nicht.
  assert.equal(scheduleDue(taeglich, new Date('2026-08-15T05:00:00Z'), null), true)
  // Eine Stunde später, schon gesendet – still.
  assert.equal(scheduleDue(taeglich, new Date('2026-08-12T06:00:00Z'), mittwoch), false)
  // Am nächsten Morgen wieder.
  assert.equal(scheduleDue(taeglich, new Date('2026-08-13T05:00:00Z'), mittwoch), true)
})

test('eine späte Uhrzeit läuft nicht in den nächsten Tag hinein', () => {
  const spaet: NotificationSchedule = { mode: 'daily', weekday: 1, time: '23:30' }
  assert.equal(scheduleDue(spaet, new Date('2026-08-12T21:30:00Z'), null), true)
  // 00:15 des Folgetages – das Fenster endet um Mitternacht.
  assert.equal(scheduleDue(spaet, new Date('2026-08-12T22:15:00Z'), null), false)
})

/* ------------------------------------------------------------------ */
/* Traktanden und Sitzungen                                            */
/* ------------------------------------------------------------------ */

test('Traktanden werden mit Mindestabstand gebündelt', () => {
  const jetzt = new Date('2026-08-12T18:00:00Z')
  assert.equal(agendaDue(jetzt, null), true)

  const geradeEben = new Date(jetzt.getTime() - 5 * 60_000)
  assert.equal(agendaDue(jetzt, geradeEben), false)

  const langeHer = new Date(jetzt.getTime() - AGENDA_GAP_MINUTES * 60_000)
  assert.equal(agendaDue(jetzt, langeHer), true)
})

test('die Sitzungserinnerung trifft das Fenster um eine Stunde vorher', () => {
  const start = new Date('2026-08-12T17:00:00Z')

  assert.equal(meetingDue(start, new Date('2026-08-12T16:00:00Z')), true)
  assert.equal(meetingDue(start, new Date('2026-08-12T15:50:00Z')), true)
  assert.equal(meetingDue(start, new Date('2026-08-12T16:10:00Z')), true)
  // Zwei Stunden vorher: zu früh. Eine halbe Stunde vorher: zu spät.
  assert.equal(meetingDue(start, new Date('2026-08-12T15:00:00Z')), false)
  assert.equal(meetingDue(start, new Date('2026-08-12T16:30:00Z')), false)
  // Und nach dem Start erst recht nicht mehr.
  assert.equal(meetingDue(start, new Date('2026-08-12T17:30:00Z')), false)
})

/* ------------------------------------------------------------------ */
/* Texte                                                               */
/* ------------------------------------------------------------------ */

test('firstName nimmt den ersten Namen', () => {
  assert.equal(firstName('Josh Weber'), 'Josh')
  assert.equal(firstName('  Maria  '), 'Maria')
})

test('joinNames zählt auf und kürzt ab dem vierten Namen', () => {
  assert.equal(joinNames([]), '')
  assert.equal(joinNames(['Josh']), 'Josh')
  assert.equal(joinNames(['Josh', 'Maria']), 'Josh und Maria')
  assert.equal(joinNames(['Josh', 'Maria', 'Peter']), 'Josh, Maria und Peter')
  assert.equal(joinNames(['Josh', 'Maria', 'Peter', 'Anna']), 'Josh, Maria und 2 weitere')
  // Wer zweimal etwas anlegt, steht trotzdem nur einmal da.
  assert.equal(joinNames(['Josh', 'Josh']), 'Josh')
})

test('die Traktanden-Nachricht nennt die Person und die Zahl', () => {
  assert.deepEqual(agendaMessage(['Josh'], 1), {
    title: 'Neues Traktandum',
    body: 'Josh hat ein neues Traktandum angelegt.',
  })
  assert.deepEqual(agendaMessage(['Josh'], 3), {
    title: 'Neue Traktanden',
    body: 'Josh hat 3 neue Traktanden angelegt.',
  })
  assert.deepEqual(agendaMessage(['Josh', 'Maria'], 4), {
    title: 'Neue Traktanden',
    body: 'Josh und Maria haben 4 neue Traktanden angelegt.',
  })
  // Ohne bekannten Namen bleibt die Nachricht trotzdem verständlich.
  assert.equal(agendaMessage([], 2).body, 'Es gibt 2 neue Traktanden.')
})

test('die Impuls-Nachricht kündigt die neue Woche nur beim Wochentakt an', () => {
  assert.match(impulsMessage('weekly').body, /Die neue Woche ist da/)
  // Am Donnerstag wäre «die neue Woche ist da» schlicht falsch.
  assert.doesNotMatch(impulsMessage('daily').body, /neue Woche/)
  assert.equal(impulsMessage('daily').title, 'Impuls')
})

test('die Sitzungsnachricht nennt Zeit, Traktanden und Pendenzen', () => {
  const meeting = { title: 'Bischofschaftssitzung', startsAt: new Date('2026-08-12T17:00:00Z') }

  assert.deepEqual(meetingMessage(meeting, { traktanden: 5, pendenzen: 3 }), {
    title: 'Sitzung in einer Stunde',
    body: 'Bischofschaftssitzung um 19:00 – 5 Traktanden, 3 Pendenzen.',
  })
  assert.equal(
    meetingMessage(meeting, { traktanden: 1, pendenzen: 1 }).body,
    'Bischofschaftssitzung um 19:00 – 1 Traktandum, 1 Pendenz.',
  )
  assert.equal(
    meetingMessage(meeting, { traktanden: 0, pendenzen: 0 }).body,
    'Bischofschaftssitzung um 19:00 – noch nichts traktandiert.',
  )
  assert.equal(
    meetingMessage(meeting, { traktanden: 2, pendenzen: 0 }).body,
    'Bischofschaftssitzung um 19:00 – 2 Traktanden.',
  )
})

test('scheduleLabel beschreibt den Takt in einem Satz', () => {
  assert.equal(scheduleLabel({ mode: 'weekly', weekday: 1, time: '08:00' }), 'Jeden Montag um 08:00')
  assert.equal(scheduleLabel({ mode: 'weekly', weekday: 7, time: '18:30' }), 'Jeden Sonntag um 18:30')
  assert.equal(scheduleLabel({ mode: 'daily', weekday: 3, time: '07:00' }), 'Täglich um 07:00')
})

test('der Standard ist Montag um acht – und alles ausgeschaltet', () => {
  assert.deepEqual(DEFAULT_NOTIFICATION_SETTINGS, {
    impuls: { on: false, mode: 'weekly', weekday: 1, time: '08:00' },
    agenda: { on: false },
    meeting: { on: false },
  })
})
