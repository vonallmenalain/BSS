import assert from 'node:assert/strict'
import { test } from 'node:test'

import { isUpcomingMeeting } from '../src/lib/meetingScope.ts'
import type { Meeting } from '../src/lib/types.ts'

/*
 * Läuft ohne Bundler direkt in Node: `npm run test:import`.
 *
 * Welche Sitzung unter «Anstehend» steht – geprüft am Fall, der auffiel:
 * Sitzung am Donnerstag, 1. Oktober 2026, um 20:30, abgeschlossen; am
 * Freitagabend stand sie noch immer da.
 */

const SITZUNG = new Date(2026, 9, 1, 20, 30)

function meeting(status: Meeting['status'], date = SITZUNG): Pick<Meeting, 'status' | 'date'> {
  return { status, date: date as unknown as Meeting['date'] }
}

/** Freitag, 2. Oktober 2026, um die genannte Zeit. */
function freitag(hours: number, minutes = 0): number {
  return new Date(2026, 9, 2, hours, minutes).getTime()
}

test('eine abgeschlossene Sitzung steht nicht mehr unter «Anstehend»', () => {
  assert.equal(isUpcomingMeeting(meeting('closed'), freitag(19)), false)
  // Auch nicht am Abend selbst: «Abschliessen» genügt.
  assert.equal(isUpcomingMeeting(meeting('closed'), new Date(2026, 9, 1, 22, 15).getTime()), false)
})

test('eine geplante Sitzung bleibt bis zum Ende ihres Tages', () => {
  assert.equal(isUpcomingMeeting(meeting('planned'), new Date(2026, 9, 1, 23, 59).getTime()), true)
  assert.equal(isUpcomingMeeting(meeting('planned'), freitag(0, 0)), false)
})

test('eine laufende Sitzung steht immer da – auch am Tag danach', () => {
  assert.equal(isUpcomingMeeting(meeting('running'), freitag(19)), true)
})

test('was noch kommt, steht unter «Anstehend»', () => {
  const naechsteWoche = new Date(2026, 9, 8, 20, 30)
  assert.equal(isUpcomingMeeting(meeting('planned', naechsteWoche), freitag(19)), true)
})
