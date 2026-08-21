import assert from 'node:assert/strict'
import { test } from 'node:test'

import { HUE_COUNT, personHues, ROLE_HUES } from '../src/lib/personColors.ts'
import { colorIndexForId } from '../src/lib/utils.ts'
import type { AppUser, Role } from '../src/lib/types.ts'

/*
 * Läuft ohne Bundler direkt in Node: `npm run test:import`.
 *
 * Geprüft wird die Frage, wegen der es diese Vergabe überhaupt gibt: Tragen
 * Bischof, Ratgeber und Sekretäre sicher verschiedene Farbtöne? Eine
 * Quersumme über die Kennung tat das nicht – bei acht Tönen und einer
 * Handvoll Konten trafen sich früher oder später zwei.
 */

const user = (id: string, role: Role, patch: Partial<AppUser> = {}): AppUser =>
  ({
    id,
    displayName: id,
    email: `${id}@example.com`,
    role,
    active: true,
    ...patch,
  }) as AppUser

/** Eine vollständig besetzte Bischofschaft. */
const bishopric = () => [
  user('uid-bischof', 'bishop'),
  user('uid-ratgeber-1', 'counselor1'),
  user('uid-ratgeber-2', 'counselor2'),
  user('uid-finanz', 'executive_secretary'),
  user('uid-sekretaer', 'secretary'),
]

test('die fünf Ämter tragen fünf verschiedene Töne', () => {
  const hues = personHues(bishopric())
  const values = bishopric().map((entry) => hues.get(entry.id))

  assert.equal(new Set(values).size, 5, `nicht alle verschieden: ${values.join(', ')}`)
  for (const value of values) assert.equal(typeof value, 'number')
})

test('der Ton gehört dem Amt und nicht der Person', () => {
  const hues = personHues(bishopric())
  for (const entry of bishopric()) {
    assert.equal(hues.get(entry.id), ROLE_HUES[entry.role])
  }

  // Ein anderer Bischof, derselbe Ton – und die übrigen bleiben, wo sie waren.
  const nachfolge = personHues([
    user('uid-neuer-bischof', 'bishop'),
    ...bishopric().filter((entry) => entry.role !== 'bishop'),
  ])
  assert.equal(nachfolge.get('uid-neuer-bischof'), ROLE_HUES.bishop)
  assert.equal(nachfolge.get('uid-ratgeber-1'), hues.get('uid-ratgeber-1'))
  assert.equal(nachfolge.get('uid-sekretaer'), hues.get('uid-sekretaer'))
})

test('ein leeres Amt gibt seinen Ton nicht her', () => {
  // Ohne 2. Ratgeber bleibt dessen Ton frei – die Assistenz bekommt einen
  // anderen, damit der Ton beim Besetzen des Amtes wieder da ist.
  const hues = personHues([user('uid-bischof', 'bishop'), user('uid-assistenz', 'assistant')])
  assert.equal(hues.get('uid-bischof'), ROLE_HUES.bishop)
  assert.notEqual(hues.get('uid-assistenz'), ROLE_HUES.counselor2)
  assert.ok(!Object.values(ROLE_HUES).includes(hues.get('uid-assistenz') as number))
})

test('ein doppelt besetztes Amt bekommt einen zweiten Ton', () => {
  const hues = personHues([user('uid-a', 'secretary'), user('uid-b', 'secretary')])
  assert.equal(hues.get('uid-a'), ROLE_HUES.secretary)
  assert.notEqual(hues.get('uid-b'), ROLE_HUES.secretary)
})

test('das verknüpfte Mitglied trägt denselben Ton wie sein Konto', () => {
  const hues = personHues([user('uid-bischof', 'bishop', { memberId: 'mitglied-7' })])
  assert.equal(hues.get('mitglied-7'), hues.get('uid-bischof'))
})

test('wartende und deaktivierte Konten bekommen keinen Ton', () => {
  const hues = personHues([
    user('uid-wartend', 'pending'),
    user('uid-aus', 'secretary', { active: false }),
  ])
  assert.equal(hues.get('uid-wartend'), undefined)
  assert.equal(hues.get('uid-aus'), undefined)
})

test('acht Konten tragen acht verschiedene Töne', () => {
  const team = [
    ...bishopric(),
    user('uid-alt', 'counselor'),
    user('uid-assistenz', 'assistant'),
    user('uid-ap', 'ap_editor'),
  ]
  const hues = personHues(team)
  const values = team.map((entry) => hues.get(entry.id))

  assert.equal(values.length, HUE_COUNT)
  assert.equal(new Set(values).size, HUE_COUNT, `nicht alle verschieden: ${values.join(', ')}`)
})

test('das neunte Konto fällt auf die Rechnung zurück', () => {
  const team = [
    ...bishopric(),
    user('uid-alt', 'counselor'),
    user('uid-assistenz', 'assistant'),
    user('uid-ap', 'ap_editor'),
    user('uid-ap-2', 'ap_viewer'),
  ]
  const hues = personHues(team)

  // Die Bischofschaft behält ihre Töne – sie kommt in der Reihenfolge zuerst.
  for (const entry of bishopric()) assert.equal(hues.get(entry.id), ROLE_HUES[entry.role])
  assert.equal(hues.get('uid-ap-2'), undefined)
  // Ohne Zuordnung greift die Rechnung, und die gibt es immer.
  assert.ok(colorIndexForId('uid-ap-2') >= 0)
})

test('die Vergabe hängt nicht davon ab, wer zuerst in der Liste steht', () => {
  const team = bishopric()
  const vorwaerts = personHues(team)
  const rueckwaerts = personHues([...team].reverse())

  for (const entry of team) {
    assert.equal(vorwaerts.get(entry.id), rueckwaerts.get(entry.id))
  }
})

test('die Töne liegen in der Farbreihe', () => {
  const hues = personHues(bishopric())
  for (const hue of hues.values()) {
    assert.ok(Number.isInteger(hue) && hue >= 0 && hue < HUE_COUNT, `Ton ausserhalb: ${hue}`)
  }
})
