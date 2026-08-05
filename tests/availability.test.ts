import assert from 'node:assert/strict'
import { test } from 'node:test'

import { prayerAvailability, talkAvailability } from '../src/lib/availability.ts'
import type { Member } from '../src/lib/types.ts'

/*
 * Läuft ohne Bundler direkt in Node: `npm run test:import`.
 *
 * Geprüft wird der Vermerk «nicht anfragen» – für Ansprachen wie für Gebete.
 * Heikel ist daran der Altbestand: Aus zwei Haken ist einer geworden, und
 * niemand darf durch die Zusammenlegung stillschweigend wieder in den
 * Vorschlägen auftauchen, den jemand ausdrücklich herausgenommen hatte.
 */

const JETZT = new Date('2026-08-05T14:00:00')
const FRUEHER = new Date('2026-01-31T23:59:59')
const SPAETER = new Date('2026-12-31T23:59:59')

const member = (partial: Partial<Member> = {}): Member =>
  ({
    id: 'm1',
    lastName: 'Muster',
    firstName: 'Max',
    gender: 'unknown',
    birthDate: null,
    status: 'active',
    availableForTalks: true,
    lastTalkDate: null,
    talkCount: 0,
    tags: [],
    ...partial,
  }) as unknown as Member

/* ------------------------------------------------------------------ */
/* Ansprachen                                                          */
/* ------------------------------------------------------------------ */

test('ohne Vermerk kann angefragt werden', () => {
  const status = talkAvailability(member(), JETZT)
  assert.equal(status.available, true)
  assert.equal(status.until, null)
  assert.equal(status.expired, false)
})

test('ohne Datum gilt der Vermerk auf Weiteres', () => {
  const status = talkAvailability(member({ availableForTalks: false }), JETZT)
  assert.equal(status.available, false)
  assert.equal(status.until, null)
  assert.equal(status.expired, false)
})

test('ein Datum in der Zukunft hält die Person heraus', () => {
  const status = talkAvailability(
    member({ availableForTalks: false, talkHoldUntil: SPAETER as never }),
    JETZT,
  )
  assert.equal(status.available, false)
  assert.deepEqual(status.until, SPAETER)
})

test('ein verstrichenes Datum gibt die Person von selbst wieder frei', () => {
  // Niemand muss den Haken nachträglich entfernen: Wer «bis Ende Januar»
  // einträgt, meint genau das – und im Februar steht die Person wieder da.
  const status = talkAvailability(
    member({ availableForTalks: false, talkHoldUntil: FRUEHER as never }),
    JETZT,
  )
  assert.equal(status.available, true)
  assert.equal(status.expired, true)
  assert.deepEqual(status.until, FRUEHER)
})

test('der frühere zweite Haken gilt weiter als Vermerk', () => {
  // Altbestand: `talkHold` war «vorerst nicht anfragen». Wer ihn gesetzt hat,
  // soll nach der Zusammenlegung nicht plötzlich wieder vorgeschlagen werden.
  const status = talkAvailability(member({ availableForTalks: true, talkHold: true }), JETZT)
  assert.equal(status.available, false)
})

test('wann die Entscheidung fiel, wird mitgeführt', () => {
  const status = talkAvailability(
    member({ availableForTalks: false, talkAvailabilityChangedAt: FRUEHER as never }),
    JETZT,
  )
  assert.deepEqual(status.changedAt, FRUEHER)
})

/* ------------------------------------------------------------------ */
/* Gebete                                                              */
/* ------------------------------------------------------------------ */

test('beim Gebet gilt der Altbestand: ein Datum allein ist der Vermerk', () => {
  // Vor der Zusammenlegung gab es beim Gebet nur `prayerHoldUntil`. Fehlt der
  // neue Haken, entscheidet deshalb weiterhin das Datum.
  const gehalten = prayerAvailability(member({ prayerHoldUntil: SPAETER as never }), JETZT)
  assert.equal(gehalten.available, false)

  const abgelaufen = prayerAvailability(member({ prayerHoldUntil: FRUEHER as never }), JETZT)
  assert.equal(abgelaufen.available, true)
  assert.equal(abgelaufen.expired, true)
})

test('beim Gebet lässt sich auch ohne Datum aussetzen', () => {
  const status = prayerAvailability(member({ availableForPrayers: false }), JETZT)
  assert.equal(status.available, false)
  assert.equal(status.until, null)
})

test('der neue Haken sticht ein stehen gebliebenes Datum', () => {
  // Wieder aufgenommen heisst wieder aufgenommen – auch wenn das alte «bis»
  // aus einem früheren Stand noch im Datensatz steht.
  const status = prayerAvailability(
    member({ availableForPrayers: true, prayerHoldUntil: SPAETER as never }),
    JETZT,
  )
  assert.equal(status.available, true)
})
