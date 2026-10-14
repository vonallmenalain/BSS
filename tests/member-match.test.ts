import assert from 'node:assert/strict'
import { test } from 'node:test'

import { indexMembersForImport, matchImportPerson } from '../src/lib/memberMatch.ts'
import { personKeys } from '../src/lib/names.ts'
import type { Member } from '../src/lib/types.ts'

/*
 * Läuft ohne Bundler direkt in Node: `npm run test:import`.
 *
 * Der Abgleich des Mitgliederimports. Anlass war ein echter Fall: Das LCR
 * schreibt «Römer», in der App stand «Roemer» – der Import wollte beide
 * neu anlegen und die bisherigen Einträge samt Ansprachen entfernen.
 */

const member = (
  id: string,
  lastName: string,
  firstName: string,
  birthDate: Date | null = null,
): Member =>
  ({
    id,
    lastName,
    firstName,
    gender: 'unknown',
    birthDate,
    status: 'active',
    availableForTalks: true,
    lastTalkDate: null,
    talkCount: 0,
    tags: [],
  }) as unknown as Member

const geboren = (iso: string) => new Date(`${iso}T00:00:00`)

test('Umlaut ausgeschrieben oder nicht – dieselbe Person', () => {
  const index = indexMembersForImport([
    member('aaron', 'Roemer', 'Aaron Erich', geboren('1991-01-22')),
    member('levi', 'Roemer', 'Lévi Aaron', geboren('2018-03-01')),
  ])
  const aaron = matchImportPerson(index, 'Römer', 'Aaron Erich', geboren('1991-01-22'))
  assert.equal(aaron.member?.id, 'aaron')
  assert.equal(aaron.member && 'reason' in aaron && aaron.reason, 'name+birth')
  // Auch ohne Geburtsdatum, solange der Name eindeutig ist.
  assert.equal(matchImportPerson(index, 'Römer', 'Lévi Aaron', null).member?.id, 'levi')
  // Und in die andere Richtung.
  const reverse = indexMembersForImport([member('r', 'Römer', 'Rachelle Riitta')])
  assert.equal(matchImportPerson(reverse, 'Roemer', 'Rachelle Riitta', null).member?.id, 'r')
})

test('Akzente und Gross-/Kleinschreibung zählen nicht', () => {
  const index = indexMembersForImport([
    member('elin', 'von Allmen', 'Elin Auri'),
    member('celine', 'Lauener', 'Céline Ann'),
  ])
  assert.equal(matchImportPerson(index, 'Von Allmen', 'Elin Auri', null).member?.id, 'elin')
  assert.equal(matchImportPerson(index, 'Lauener', 'Celine Ann', null).member?.id, 'celine')
})

test('das Geburtsdatum trennt Gleichnamige', () => {
  const index = indexMembersForImport([
    member('alt', 'Muster', 'Hans', geboren('1950-05-01')),
    member('jung', 'Muster', 'Hans', geboren('1990-05-01')),
  ])
  assert.equal(matchImportPerson(index, 'Muster', 'Hans', geboren('1990-05-01')).member?.id, 'jung')
  // Ohne Datum wird nicht geraten.
  const offen = matchImportPerson(index, 'Muster', 'Hans', null)
  assert.equal(offen.member, null)
  assert.equal(!offen.member && offen.candidates, 2)
})

test('ein anderer Name ist eine andere Person', () => {
  const index = indexMembersForImport([member('a', 'Weidmann', 'Nick Sunny')])
  const result = matchImportPerson(index, 'Weidmann', 'Robin Greg', null)
  assert.equal(result.member, null)
  assert.equal(!result.member && result.candidates, 0)
})

test('jede Schreibweise von Nach- und Vorname', () => {
  assert.deepEqual(personKeys('Römer', 'Lévi'), ['roemer|levi', 'romer|levi'])
  assert.deepEqual(personKeys('Roemer', 'Aaron'), ['roemer|aaron'])
})
