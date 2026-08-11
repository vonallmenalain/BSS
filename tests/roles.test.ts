import assert from 'node:assert/strict'
import { test } from 'node:test'

import { ROLE_LABELS, ROLE_ORDER, roleRank } from '../src/lib/types.ts'
import type { AppUser, Role } from '../src/lib/types.ts'

/*
 * Läuft ohne Bundler direkt in Node: `npm run test:import`.
 *
 * Geprüft wird die Reihenfolge der Benutzerliste in den Einstellungen: nach
 * Rolle statt nach Namen, damit beieinandersteht, was dieselben Rechte hat –
 * zuerst die Bischofschaft mit Vollzugriff, dann die beiden AP-Zugänge.
 */

const user = (displayName: string, role: Role): AppUser =>
  ({
    id: displayName,
    displayName,
    email: `${displayName}@example.com`,
    role,
    active: true,
  }) as AppUser

/** So sortiert die Seite: auf der bereits nach Namen geordneten Liste. */
const byRole = (users: AppUser[]) =>
  [...users]
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'de'))
    .sort((a, b) => roleRank(a.role) - roleRank(b.role))
    .map((entry) => entry.displayName)

test('jede Rolle hat einen Platz in der Reihenfolge', () => {
  const roles = Object.keys(ROLE_LABELS) as Role[]
  for (const role of roles) {
    assert.ok(ROLE_ORDER.includes(role), `${role} fehlt in ROLE_ORDER`)
  }
  assert.equal(ROLE_ORDER.length, roles.length)
})

test('Vollzugriff vor AP-bearbeiten vor AP-ansehen', () => {
  const users = [
    user('Anna', 'ap_viewer'),
    user('Bruno', 'secretary'),
    user('Carla', 'ap_editor'),
    user('David', 'bishop'),
  ]
  assert.deepEqual(byRole(users), ['David', 'Bruno', 'Carla', 'Anna'])
})

test('innerhalb der Bischofschaft entscheidet die Aufgabe', () => {
  const users = [
    user('Anna', 'secretary'),
    user('Bruno', 'counselor2'),
    user('Carla', 'executive_secretary'),
    user('David', 'counselor1'),
    user('Emil', 'bishop'),
  ]
  assert.deepEqual(byRole(users), ['Emil', 'David', 'Bruno', 'Carla', 'Anna'])
})

test('gleiche Rolle bleibt alphabetisch', () => {
  const users = [user('Zora', 'secretary'), user('Anna', 'secretary'), user('Mia', 'secretary')]
  assert.deepEqual(byRole(users), ['Anna', 'Mia', 'Zora'])
})

test('die alte Sammelrolle steht bei den Ratgebern', () => {
  assert.ok(roleRank('counselor') > roleRank('counselor2'))
  assert.ok(roleRank('counselor') < roleRank('secretary'))
})

test('eine unbekannte Rolle führt die Liste nicht an', () => {
  assert.equal(roleRank('geschichtsschreiber' as Role), ROLE_ORDER.length)
  assert.ok(roleRank('geschichtsschreiber' as Role) > roleRank('ap_viewer'))
})
