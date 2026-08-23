import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  assistantAccessOf,
  assistantAccessSummary,
  assistantAreasOf,
  assistantListsFrom,
  assistantWriteOf,
  ROLE_LABELS,
  ROLE_ORDER,
  roleRank,
  sacramentThemeFor,
} from '../src/lib/types.ts'
import type { AppUser, AssistantArea, Role } from '../src/lib/types.ts'

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

test('Vollzugriff vor Assistenz vor AP-bearbeiten vor AP-ansehen', () => {
  const users = [
    user('Anna', 'ap_viewer'),
    user('Bruno', 'secretary'),
    user('Carla', 'ap_editor'),
    user('David', 'bishop'),
    user('Elena', 'assistant'),
  ]
  assert.deepEqual(byRole(users), ['David', 'Bruno', 'Elena', 'Carla', 'Anna'])
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

/* ------------------------------------------------------------------ */
/* Assistenz: welche Bereiche                                          */
/* ------------------------------------------------------------------ */

const assistant = (areas: unknown, patch: Partial<AppUser> = {}): AppUser =>
  ({
    id: 'assistenz',
    displayName: 'Assistenz',
    email: 'assistenz@example.com',
    role: 'assistant',
    active: true,
    assistantAreas: areas,
    ...patch,
  }) as AppUser

test('die Bereiche stehen immer in derselben Reihenfolge', () => {
  assert.deepEqual(assistantAreasOf(assistant(['prayers', 'talks'])), ['talks', 'prayers'])
  assert.deepEqual(assistantAreasOf(assistant(['music', 'prayers', 'talks'])), [
    'talks',
    'music',
    'prayers',
  ])
})

test('eine leere Liste heisst «nichts» und nicht «alles»', () => {
  assert.deepEqual(assistantAreasOf(assistant([])), [])
  assert.deepEqual(assistantAreasOf(assistant(undefined)), [])
})

test('was kein Bereich ist, öffnet keinen', () => {
  assert.deepEqual(assistantAreasOf(assistant(['bekanntmachungen', 'talks'])), ['talks'])
  assert.deepEqual(assistantAreasOf(assistant('talks')), [])
})

test('ohne die Rolle bleibt das Feld still', () => {
  const areas: AssistantArea[] = ['talks', 'music', 'prayers']
  assert.deepEqual(assistantAreasOf(assistant(areas, { role: 'secretary' })), [])
  assert.deepEqual(assistantAreasOf(assistant(areas, { role: 'pending' })), [])
  assert.deepEqual(assistantAreasOf(assistant(areas, { active: false })), [])
  assert.deepEqual(assistantAreasOf(null), [])
})

/* ------------------------------------------------------------------ */
/* Assistenz: lesen oder auch schreiben                                */
/* ------------------------------------------------------------------ */

test('ohne das Feld darf die Assistenz überall arbeiten, wo sie hinkommt', () => {
  // Der Altbestand: Bis es die Unterscheidung gab, hiess «sieht» auch «darf».
  assert.deepEqual(assistantWriteOf(assistant(['talks', 'music'])), ['talks', 'music'])
})

test('eine leere Liste heisst «nur lesen» – und nicht «alles»', () => {
  const user = assistant(['talks', 'music'], { assistantWrite: [] })
  assert.deepEqual(assistantAreasOf(user), ['talks', 'music'])
  assert.deepEqual(assistantWriteOf(user), [])
})

test('das Schreibrecht gilt je Sparte einzeln', () => {
  const user = assistant(['talks', 'music'], { assistantWrite: ['music'] })
  assert.deepEqual(assistantWriteOf(user), ['music'])
  assert.deepEqual(assistantAccessOf(user), {
    talks: 'read',
    music: 'write',
    prayers: 'none',
  })
})

test('geschrieben wird nur, was auch offensteht', () => {
  // Ein Schreibrecht auf einen Bereich ohne Zugang wäre ein Widerspruch –
  // und ein schlafendes Recht, sobald der Haken wieder gesetzt wird.
  const user = assistant(['music'], { assistantWrite: ['talks', 'music'] })
  assert.deepEqual(assistantWriteOf(user), ['music'])
  assert.deepEqual(assistantListsFrom(assistantAccessOf(user)), {
    areas: ['music'],
    write: ['music'],
  })
})

test('ohne die Rolle sagt auch das Schreibrecht nichts', () => {
  const patch = { assistantWrite: ['talks', 'music', 'prayers'] }
  assert.deepEqual(assistantWriteOf(assistant(['talks'], { ...patch, role: 'secretary' })), [])
  assert.deepEqual(assistantWriteOf(assistant(['talks'], { ...patch, active: false })), [])
  assert.deepEqual(assistantWriteOf(null), [])
})

test('die Wahl je Bereich wird zu den beiden Listen', () => {
  assert.deepEqual(assistantListsFrom({ talks: 'read', music: 'write', prayers: 'none' }), {
    areas: ['talks', 'music'],
    write: ['music'],
  })
  assert.deepEqual(assistantListsFrom({ talks: 'none', music: 'none', prayers: 'none' }), {
    areas: [],
    write: [],
  })
})

test('der Satz zur Kontozeile nennt Bereich und Umfang', () => {
  assert.equal(
    assistantAccessSummary({ talks: 'read', music: 'write', prayers: 'none' }),
    'Ansprachen (nur lesen), Musik (bearbeiten)',
  )
  assert.equal(assistantAccessSummary({ talks: 'none', music: 'none', prayers: 'none' }), '')
})

/* ------------------------------------------------------------------ */
/* Monatsthema                                                         */
/* ------------------------------------------------------------------ */

test('das Monatsthema gilt für den ganzen Monat', () => {
  const themes = { '2026-09': 'Glaube an Jesus Christus' }
  assert.equal(sacramentThemeFor(themes, '2026-09'), 'Glaube an Jesus Christus')
  assert.equal(sacramentThemeFor(themes, '2026-10'), '')
  assert.equal(sacramentThemeFor(undefined, '2026-09'), '')
})

test('ein Thema aus lauter Leerzeichen zählt als keines', () => {
  assert.equal(sacramentThemeFor({ '2026-09': '   ' }, '2026-09'), '')
})
