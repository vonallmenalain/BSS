import assert from 'node:assert/strict'
import { test } from 'node:test'

import { impulseFirstName, withCurrentFirstNames } from '../src/lib/impulse.ts'

/*
 * Der Vorname in «Anti Doom» folgt dem Profil (src/lib/impulse.ts) –
 * sofort dort, wo das Gerät die Profile lesen darf.
 */

const profiles = new Map([
  ['ammon', 'Ammon Lauener'],
  ['caelen', 'Caelen'],
])
const displayNameOf = (uid: string) => profiles.get(uid)

test('ein geänderter Name gilt sofort – mit dem Vornamen aus dem Profil', () => {
  const progress = [
    { uid: 'ammon', firstName: 'Lauener' },
    { uid: 'caelen', firstName: 'Caelen' },
  ]
  const result = withCurrentFirstNames(progress, displayNameOf)
  assert.deepEqual(
    result.map((entry) => entry.firstName),
    ['Ammon', 'Caelen'],
  )
  // Unverändertes bleibt dasselbe Objekt.
  assert.equal(result[1], progress[1])
})

test('ohne lesbares Profil bleibt der mitgeschriebene Name', () => {
  const progress = [{ uid: 'jeremia', firstName: 'Jeremia' }]
  assert.equal(withCurrentFirstNames(progress, displayNameOf), progress)
  // Ein Gerät ohne Zugriff auf die Profile kennt keines.
  assert.equal(
    withCurrentFirstNames(progress, () => undefined),
    progress,
  )
})

test('anonym bleibt anonym – ein leerer Vorname wird nicht ergänzt', () => {
  const comments = [{ uid: 'ammon', firstName: '', anonymous: true }]
  assert.equal(withCurrentFirstNames(comments, displayNameOf)[0].firstName, '')
})

test('der Vorname ist das erste Wort des Namens', () => {
  assert.equal(impulseFirstName('Ammon Lauener'), 'Ammon')
  assert.equal(impulseFirstName('  Jeremia  '), 'Jeremia')
})
