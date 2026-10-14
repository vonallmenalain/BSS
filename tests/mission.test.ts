import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  defaultMissionUntil,
  isOnMission,
  missionCalling,
  missionCallings,
  missionMonths,
  missionOf,
  MISSION_POSITION,
} from '../src/lib/mission.ts'
import { callingPeriod } from '../src/services/callings.ts'
import type { Member } from '../src/lib/types.ts'

/*
 * Läuft ohne Bundler direkt in Node: `npm run test:import`.
 *
 * Geprüft wird der Haken «Auf Mission»: Es zählt der Zeitraum und nicht der
 * Haken. Davor und danach steht die Person in allen Listen, dazwischen in
 * keiner – und unter den Berufungen steht sie als «Vollzeitmission».
 */

const JETZT = new Date('2026-08-05T14:00:00')

const member = (partial: Partial<Member> = {}): Member =>
  ({
    id: 'm1',
    lastName: 'Muster',
    firstName: 'Max',
    gender: 'm',
    birthDate: null,
    status: 'active',
    availableForTalks: true,
    lastTalkDate: null,
    talkCount: 0,
    tags: [],
    ...partial,
  }) as unknown as Member

const unterwegs = (partial: Partial<Member> = {}) =>
  member({
    missionFrom: new Date('2026-02-01T00:00:00') as never,
    missionUntil: new Date('2028-01-31T23:59:59') as never,
    ...partial,
  })

/* ------------------------------------------------------------------ */
/* Dauer                                                               */
/* ------------------------------------------------------------------ */

test('Männer zwei Jahre, Frauen anderthalb', () => {
  assert.equal(missionMonths('m'), 24)
  assert.equal(missionMonths('f'), 18)
  // Ohne erfasstes Geschlecht die längere Dauer – ein zu frühes «Bis» holte
  // die Person mitten in der Mission zurück in die Vorschläge.
  assert.equal(missionMonths('unknown'), 24)
})

test('das vorgeschlagene «Bis» folgt dem «Von»', () => {
  assert.equal(defaultMissionUntil('2026-03-01', 'm'), '2028-03-01')
  assert.equal(defaultMissionUntil('2026-03-01', 'f'), '2027-09-01')
  assert.equal(defaultMissionUntil('', 'm'), '')
  assert.equal(defaultMissionUntil('kein Datum', 'f'), '')
})

/* ------------------------------------------------------------------ */
/* Zeitraum                                                            */
/* ------------------------------------------------------------------ */

test('ohne «Von» ist keine Mission erfasst', () => {
  assert.equal(missionOf(member(), JETZT), null)
  assert.equal(isOnMission(member(), JETZT), false)
})

test('im Zeitraum ist die Person weg', () => {
  const mission = missionOf(unterwegs(), JETZT)
  assert.equal(mission?.phase, 'away')
  assert.equal(isOnMission(unterwegs(), JETZT), true)
})

test('vor dem ersten Tag steht die Mission erst bevor', () => {
  const bald = unterwegs({ missionFrom: new Date('2026-09-01T00:00:00') as never })
  assert.equal(missionOf(bald, JETZT)?.phase, 'planned')
  assert.equal(isOnMission(bald, JETZT), false)
})

test('der erste und der letzte Tag gehören dazu', () => {
  const ersterTag = new Date('2026-02-01T08:00:00')
  const letzterTag = new Date('2028-01-31T20:00:00')
  assert.equal(isOnMission(unterwegs(), ersterTag), true)
  assert.equal(isOnMission(unterwegs(), letzterTag), true)
  assert.equal(isOnMission(unterwegs(), new Date('2028-02-01T08:00:00')), false)
})

test('nach dem letzten Tag ist die Person von selbst zurück', () => {
  const zurueck = unterwegs({
    missionFrom: new Date('2024-06-01T00:00:00') as never,
    missionUntil: new Date('2026-05-31T23:59:59') as never,
  })
  assert.equal(missionOf(zurueck, JETZT)?.phase, 'returned')
  assert.equal(isOnMission(zurueck, JETZT), false)
})

test('ohne «Bis» läuft die Mission, bis jemand etwas einträgt', () => {
  const offen = unterwegs({ missionUntil: null })
  assert.equal(isOnMission(offen, JETZT), true)
  assert.equal(isOnMission(offen, new Date('2035-01-01T12:00:00')), true)
})

/* ------------------------------------------------------------------ */
/* Unter den Berufungen                                                */
/* ------------------------------------------------------------------ */

test('während der Mission steht sie als laufende Vollzeitmission da', () => {
  const calling = missionCalling(unterwegs(), JETZT)
  assert.ok(calling)
  assert.equal(calling.position, MISSION_POSITION)
  assert.equal(calling.memberId, 'm1')
  assert.equal(calling.memberName, 'Muster, Max')
  assert.equal(calling.status, 'set_apart')
  assert.equal(calling.outOfUnit, true)
  assert.equal(calling.releasedDate, null)
  // Bei der Mission zählt die Rückkehr – nicht bloss «seit».
  assert.match(callingPeriod(calling), /2026.*–.*2028/)
})

test('nach der Rückkehr ist sie eine frühere Berufung', () => {
  const zurueck = unterwegs({
    missionFrom: new Date('2024-06-01T00:00:00') as never,
    missionUntil: new Date('2026-05-31T23:59:59') as never,
  })
  const calling = missionCalling(zurueck, JETZT)
  assert.equal(calling?.status, 'released')
  assert.equal(calling?.plannedEndDate, null)
})

test('eine bevorstehende Mission ist noch keine Berufung', () => {
  const bald = unterwegs({ missionFrom: new Date('2026-09-01T00:00:00') as never })
  assert.equal(missionCalling(bald, JETZT), null)
})

test('aus der Gemeinde kommen nur die erfassten Missionen', () => {
  const list = missionCallings([member({ id: 'a' }), unterwegs({ id: 'b' })], JETZT)
  assert.deepEqual(
    list.map((calling) => calling.memberId),
    ['b'],
  )
})
