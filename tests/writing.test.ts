import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  caretOf,
  holdWriting,
  isWriting,
  noteCaret,
  releaseWriting,
  startWriting,
  stopWriting,
} from '../src/lib/writing.ts'

/*
 * Läuft ohne Bundler direkt in Node: `npm run test:import`.
 *
 * Der Merkzettel entscheidet darüber, ob jemand nach dem automatischen
 * Speichern weiterschreiben kann oder wieder ins Feld klicken muss. Er hat
 * genau eine heikle Stelle: Ein Feld, das abgebaut und im selben Zug wieder
 * aufgebaut wird, muss ihn behalten – eines, das wirklich verschwindet, muss
 * ihn verlieren. Beides steht hier.
 */

/** Einen Durchgang der Ereignisschleife abwarten – so lange gilt der Zettel. */
const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

test('wer schreibt, ist vermerkt – samt Stelle im Text', () => {
  startWriting('feld-a', 4)
  assert.ok(isWriting('feld-a'))
  assert.deepEqual(caretOf('feld-a'), { id: 'feld-a', start: 4, end: 4 })
  assert.equal(isWriting('feld-b'), false)
  assert.equal(caretOf('feld-b'), null)
  stopWriting('feld-a')
})

test('der Cursor wandert mit – aber nur im Feld, in dem geschrieben wird', () => {
  startWriting('feld-a', 0)
  noteCaret('feld-a', 7, 9)
  assert.deepEqual(caretOf('feld-a'), { id: 'feld-a', start: 7, end: 9 })

  // Ein anderes Feld hat hier nichts zu melden.
  noteCaret('feld-b', 1, 1)
  assert.deepEqual(caretOf('feld-a'), { id: 'feld-a', start: 7, end: 9 })
  assert.equal(isWriting('feld-b'), false)
  stopWriting('feld-a')
})

test('verlassen heisst verlassen – sofort', () => {
  startWriting('feld-a', 2)
  stopWriting('feld-a')
  assert.equal(isWriting('feld-a'), false)
})

test('ein fremdes Feld beendet das Schreiben nicht', () => {
  startWriting('feld-a', 2)
  stopWriting('feld-b')
  assert.ok(isWriting('feld-a'))
  stopWriting('feld-a')
})

test('abgebaut und im selben Zug wieder aufgebaut: der Zettel bleibt', async () => {
  startWriting('feld-a', 3)

  // Genau das passiert, wenn die Liste sich umordnet: React nimmt das Feld
  // weg und setzt es an anderer Stelle wieder ein.
  releaseWriting('feld-a')
  holdWriting('feld-a')

  await tick()
  assert.ok(isWriting('feld-a'))
  assert.deepEqual(caretOf('feld-a'), { id: 'feld-a', start: 3, end: 3 })
  stopWriting('feld-a')
})

test('abgebaut und nicht zurückgekommen: der Zettel gilt nicht mehr', async () => {
  startWriting('feld-a', 3)
  releaseWriting('feld-a')

  // Vor dem nächsten Durchgang gilt er noch – der Wiederaufbau käme genau
  // hier.
  assert.ok(isWriting('feld-a'))

  await tick()
  assert.equal(isWriting('feld-a'), false)
})

test('das Vergessen gilt dem Feld, das ging – nicht dem, das kam', async () => {
  startWriting('feld-a', 1)
  releaseWriting('feld-a')
  // Ein anderes Feld übernimmt, bevor der Zettel weggeworfen wird.
  startWriting('feld-b', 5)

  await tick()
  assert.ok(isWriting('feld-b'))
  assert.deepEqual(caretOf('feld-b'), { id: 'feld-b', start: 5, end: 5 })
  stopWriting('feld-b')
})
