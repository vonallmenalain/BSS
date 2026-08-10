import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  activeCallings,
  matchesOrganizationScope,
  organizationChoices,
  organizationScopeOf,
} from '../src/services/callings.ts'
import { DEFAULT_CALLINGS_VIEW, hasCallingFilters } from '../src/lib/types.ts'
import type { Calling, CallingStatus, Organization } from '../src/lib/types.ts'

/*
 * Läuft ohne Bundler direkt in Node: `npm run test:import`.
 *
 * Geprüft wird die Einschränkung der Berufungsliste auf eine Sparte – «nur
 * die PV», «nur ausserhalb der Einheit» – und der Knopf, der alles wieder
 * wegnimmt.
 */

function calling(
  id: string,
  organization: Organization,
  status: CallingStatus,
  extra: Partial<Calling> = {},
): Calling {
  return {
    id,
    memberId: `m-${id}`,
    memberName: 'Muster, Max',
    position: 'Irgendeine Berufung',
    organization,
    status,
    proposedDate: null,
    extendedDate: null,
    sustainedDate: null,
    setApartDate: null,
    releasedDate: null,
    ...extra,
  }
}

const CALLINGS = [
  calling('1', 'primary', 'sustained'),
  calling('2', 'primary', 'set_apart'),
  calling('3', 'primary', 'released'),
  calling('4', 'bishopric', 'sustained'),
  // Dieselbe Organisation, aber im Pfahl – nicht im Organisationsplan der
  // Gemeinde.
  calling('5', 'sunday_school', 'sustained', { outOfUnit: true }),
  calling('6', 'other', 'sustained', { outOfUnit: true }),
]

/* ------------------------------------------------------------------ */
/* Auf eine Sparte einschränken                                        */
/* ------------------------------------------------------------------ */

const idsIn = (scope: Parameters<typeof matchesOrganizationScope>[1], entries = CALLINGS) =>
  entries.filter((c) => matchesOrganizationScope(c, scope)).map((c) => c.id)

test('«Alle Organisationen» nimmt alles', () => {
  assert.deepEqual(idsIn('all'), ['1', '2', '3', '4', '5', '6'])
})

test('schränkt auf eine einzelne Organisation ein', () => {
  assert.deepEqual(idsIn('primary'), ['1', '2', '3'])
  assert.deepEqual(idsIn('bishopric'), ['4'])
})

test('die Sonntagsschule der Gemeinde ist nicht die des Pfahls', () => {
  // Die einzige Sonntagsschulberufung im Bestand liegt ausserhalb der
  // Einheit. Unter «Sonntagsschule» hat sie nichts verloren.
  assert.deepEqual(idsIn('sunday_school'), [])
  assert.deepEqual(idsIn('out_of_unit'), ['5', '6'])
})

test('eine Sparte ohne Berufung ergibt eine leere Liste, keinen Fehler', () => {
  assert.deepEqual(idsIn('young_women'), [])
})

test('ordnet jede Berufung genau einer Sparte der Auswahl zu', () => {
  assert.equal(organizationScopeOf(CALLINGS[0]), 'primary')
  assert.equal(organizationScopeOf(CALLINGS[4]), 'out_of_unit')
})

/* ------------------------------------------------------------------ */
/* Die Auswahl im Menü                                                 */
/* ------------------------------------------------------------------ */

test('bietet nur Sparten an, die es im Bestand auch gibt', () => {
  assert.deepEqual(
    organizationChoices(CALLINGS, 'all').map((choice) => [choice.value, choice.count]),
    [
      ['all', 6],
      ['bishopric', 1],
      ['primary', 3],
      ['out_of_unit', 2],
    ],
  )
})

test('zählt gegen den übergebenen Ausschnitt', () => {
  // Nur die laufenden Berufungen: Die entlassene PV-Berufung zählt nicht mit.
  const choices = organizationChoices(activeCallings(CALLINGS), 'all')
  assert.deepEqual(
    choices.map((choice) => [choice.value, choice.count]),
    [
      ['all', 5],
      ['bishopric', 1],
      ['primary', 2],
      ['out_of_unit', 2],
    ],
  )
})

test('behält die gewählte Sparte in der Liste, auch wenn nichts darin steht', () => {
  // Sonst verschwände die eigene Wahl aus dem Feld, sobald der Ausschnitt
  // wechselt – und niemand käme mehr davon weg.
  assert.deepEqual(
    organizationChoices([], 'primary').map((choice) => [choice.value, choice.count]),
    [
      ['all', 0],
      ['primary', 0],
    ],
  )
})

test('führt die Sparten in der Ordnung des Organisationsplans, «ausserhalb» zuletzt', () => {
  const choices = organizationChoices(
    [
      calling('a', 'other', 'sustained', { outOfUnit: true }),
      calling('b', 'primary', 'sustained'),
      calling('c', 'bishopric', 'sustained'),
    ],
    'all',
  )
  assert.deepEqual(
    choices.map((choice) => choice.value),
    ['all', 'bishopric', 'primary', 'out_of_unit'],
  )
})

/* ------------------------------------------------------------------ */
/* Alle Filter entfernen                                               */
/* ------------------------------------------------------------------ */

test('die Vorgabe schränkt nichts ein', () => {
  assert.equal(hasCallingFilters(DEFAULT_CALLINGS_VIEW), false)
})

test('erkennt jede Abweichung von der Vorgabe – auch die Sortierung', () => {
  const cases: Partial<typeof DEFAULT_CALLINGS_VIEW>[] = [
    { scope: 'released' },
    { audience: 'active' },
    { organization: 'primary' },
    { organization: 'out_of_unit' },
    { gender: 'f' },
    { minAge: 18 },
    { maxAge: 30 },
    { sort: 'name' },
    { direction: 'desc' },
  ]

  for (const change of cases) {
    assert.equal(
      hasCallingFilters({ ...DEFAULT_CALLINGS_VIEW, ...change }),
      true,
      `Abweichung: ${JSON.stringify(change)}`,
    )
  }
})

test('deckt jedes Feld der Ansicht ab', () => {
  // Der Knopf verspricht, alles wegzunehmen. Käme ein Feld dazu, das die
  // Prüfung nicht kennt, bliebe er ausgegraut, obwohl etwas eingeschränkt
  // wäre – deshalb wird über alle Felder gefragt und nicht über eine Liste
  // von Hand.
  for (const key of Object.keys(DEFAULT_CALLINGS_VIEW)) {
    const changed = { ...DEFAULT_CALLINGS_VIEW, [key]: '__anders__' }
    assert.equal(hasCallingFilters(changed as typeof DEFAULT_CALLINGS_VIEW), true, `Feld: ${key}`)
  }
})
