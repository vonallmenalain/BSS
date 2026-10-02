import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildCleaningIcs,
  cleaningEventUid,
  cleaningWorkdays,
  parseCalendarGroup,
  weeksOfGroup,
} from '../src/lib/cleaningIcs.ts'

const WEEKS = [
  {
    startDate: '2026-10-11',
    endDate: '2026-10-17',
    group: 'Gruppe 6',
    team: 'Muster Hans & Anna',
  },
  {
    startDate: '2026-09-27',
    endDate: '2026-10-03',
    group: 'Gruppe 5',
    team: 'Bader Roger & Sylvie',
  },
  {
    startDate: '2026-10-04',
    endDate: '2026-10-10',
    group: 'Gruppe 5',
    team: 'Bader Roger & Sylvie',
    note: 'Generalkonferenz',
    updatedAt: new Date('2026-09-01T10:00:00Z'),
  },
]

const OPTIONS = {
  group: 5,
  name: 'Putzplan Gruppe 5',
  domain: 'bss.alae.app',
  now: new Date('2026-10-02T12:00:00Z'),
  planUrl: 'https://bss.alae.app/putzplan',
}

test('eine Putzwoche steht von Montag bis Samstag im Kalender', () => {
  // Ab Sonntag gezählt: Der Termin beginnt am Montag.
  assert.deepEqual(cleaningWorkdays({ startDate: '2026-10-04', endDate: '2026-10-10' }), {
    first: '2026-10-05',
    last: '2026-10-10',
  })
  // Der alte Takt von Montag bis Samstag bleibt, wie er ist.
  assert.deepEqual(cleaningWorkdays({ startDate: '2026-10-05', endDate: '2026-10-10' }), {
    first: '2026-10-05',
    last: '2026-10-10',
  })
})

test('nur die Wochen der Gruppe, nach Datum', () => {
  assert.deepEqual(
    weeksOfGroup(WEEKS, 5).map((week) => week.startDate),
    ['2026-09-27', '2026-10-04'],
  )
  assert.deepEqual(weeksOfGroup(WEEKS, 9), [])
})

test('die Gruppe in der Adresse wird geprüft', () => {
  assert.equal(parseCalendarGroup('5'), 5)
  assert.equal(parseCalendarGroup(' 12 '), 12)
  for (const value of [null, '', '0', '100', '5a', '-1', '1.5', 'alle']) {
    assert.equal(parseCalendarGroup(value), null, String(value))
  }
})

test('der Kalender: ganztägig, DTEND exklusiv, Grund und Zuständige in der Beschreibung', () => {
  const ics = buildCleaningIcs(WEEKS, OPTIONS)
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'))
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'))
  assert.match(ics, /X-WR-CALNAME:Putzplan Gruppe 5\r\n/)

  const events = ics.split('BEGIN:VEVENT').slice(1)
  assert.equal(events.length, 2, 'nur Gruppe 5')

  const second = events[1].replace(/\r\n /g, '')
  assert.match(second, /UID:putzplan-2026-10-04-gruppe-5@bss\.alae\.app\r\n/)
  assert.match(second, /DTSTART;VALUE=DATE:20261005\r\n/)
  // Der Samstag gehört dazu – DTEND ist der Sonntag danach.
  assert.match(second, /DTEND;VALUE=DATE:20261011\r\n/)
  assert.match(second, /SUMMARY:Putzwoche Gruppe 5\r\n/)
  assert.match(
    second,
    /DESCRIPTION:Zuständig: Bader Roger & Sylvie\\nBemerkung: Generalkonferenz\\nPutzplan: https:\/\/bss\.alae\.app\/putzplan\r\n/,
  )
  assert.match(second, /TRANSP:TRANSPARENT\r\n/)
  assert.match(second, /LAST-MODIFIED:20260901T100000Z\r\n/)
  assert.match(second, /DTSTAMP:20261002T120000Z\r\n/)

  // Keine Zeile länger als 75 Oktette.
  for (const line of ics.split('\r\n')) {
    assert.ok(new TextEncoder().encode(line).length <= 75, line)
  }
})

test('die UID trägt Woche und Gruppe – sonst nichts', () => {
  assert.equal(
    cleaningEventUid({ startDate: '2026-10-04' }, 5, 'bss.alae.app'),
    'putzplan-2026-10-04-gruppe-5@bss.alae.app',
  )
})
