import assert from 'node:assert/strict'
import { test } from 'node:test'

import { weekdaysInMonth } from '../src/lib/dates.ts'

/*
 * Läuft ohne Bundler direkt in Node: `npm run test:import`.
 *
 * Geprüft wird, welche Sonntage zu einem Monat gehören – die Grundlage für
 * «einer von uns ist einen ganzen Monat zuständig». Monatsgrenzen sind
 * genau die Stelle, an der so etwas still danebengreift: ein fünfter
 * Sonntag, ein Monat, der an einem Sonntag beginnt, und die Zeitumstellung.
 */

const tage = (weekday: number, iso: string) =>
  weekdaysInMonth(weekday, new Date(`${iso}T12:00:00`)).map((date) => date.getDate())

test('findet alle Sonntage eines Monats', () => {
  // August 2026: 2., 9., 16., 23., 30.
  assert.deepEqual(tage(0, '2026-08-09'), [2, 9, 16, 23, 30])
})

test('zählt auch den fünften Sonntag mit', () => {
  // März 2026 beginnt an einem Sonntag und hat fünf davon.
  assert.deepEqual(tage(0, '2026-03-15'), [1, 8, 15, 22, 29])
})

test('bleibt im Monat – der erste Tag des nächsten gehört nicht dazu', () => {
  // Februar 2026 endet an einem Samstag; der 1. März ist ein Sonntag.
  assert.deepEqual(tage(0, '2026-02-10'), [1, 8, 15, 22])
})

test('die Zeitumstellung verschiebt keinen Termin', () => {
  // In der Nacht auf den 29. März 2026 wird umgestellt.
  assert.deepEqual(tage(0, '2026-03-01'), [1, 8, 15, 22, 29])
  // Und zurück in der Nacht auf den 25. Oktober 2026.
  assert.deepEqual(tage(0, '2026-10-01'), [4, 11, 18, 25])
})

test('funktioniert für jeden Wochentag, nicht nur für den Sonntag', () => {
  // Mittwoche im August 2026: 5., 12., 19., 26.
  assert.deepEqual(tage(3, '2026-08-09'), [5, 12, 19, 26])
})

test('das Datum im Monat spielt keine Rolle', () => {
  assert.deepEqual(tage(0, '2026-08-01'), tage(0, '2026-08-31'))
})
