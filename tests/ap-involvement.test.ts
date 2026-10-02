import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  apInvolves,
  formatPlanNames,
  involvedFields,
  linkedAccounts,
  mentionsName,
  parsePlanNames,
  planNameSuggestions,
} from '../src/lib/apInvolvement.ts'
import { DEFAULT_NOTIFICATION_SETTINGS } from '../src/lib/notifications.ts'

/*
 * Läuft ohne Bundler direkt in Node: `npm run test:import`.
 *
 * Geprüft wird die Brücke zwischen den Namen im Aktivitätenplan (Freitext,
 * wie ihn die Excel-Tabelle führt) und den Konten – die Grundlage der
 * Erinnerung «nur wo ich eingetragen bin».
 */

test('ein Name trifft nur ganze Wörter', () => {
  assert.equal(mentionsName('Carden & Josh', 'Josh'), true)
  assert.equal(mentionsName('Josh M.', 'josh'), true)
  assert.equal(mentionsName('Joshua', 'Josh'), false)
  assert.equal(mentionsName('JM, Carden', 'JM'), true)
  assert.equal(mentionsName('Br. Meier', 'Bruder Meier'), false)
  // Auch eine Wortfolge – mit beliebig vielen Leerzeichen dazwischen.
  assert.equal(mentionsName('Leitung:  Bruder   Meier', 'Bruder Meier'), true)
  // Umlaute zählen als Buchstaben: «Müller» steckt nicht in «Müllers».
  assert.equal(mentionsName('Familie Müllers', 'Müller'), false)
  assert.equal(mentionsName('', 'Carden'), false)
  assert.equal(mentionsName('Carden', '  '), false)
})

test('beteiligt ist, wer in einem der drei Personenfelder steht', () => {
  const termin = { leader: 'Carden', bishopric: 'Bischof Meier', advisor: 'JM' }

  assert.deepEqual(involvedFields(termin, ['Carden']), ['leader'])
  assert.deepEqual(involvedFields(termin, ['Meier', 'JM']), ['bishopric', 'advisor'])
  assert.equal(apInvolves(termin, ['Josh']), false)
  // Ohne Namen ist nichts das eigene.
  assert.equal(apInvolves(termin, []), false)
  // Andere Felder zählen nicht – im Titel erwähnt ist nicht eingetragen.
  assert.equal(apInvolves({ leader: '' }, ['Carden']), false)
})

test('das Eingabefeld nimmt mehrere Namen, ohne Doppel', () => {
  assert.deepEqual(parsePlanNames(' Carden,  JM ; carden,, Bruder  Meier '), [
    'Carden',
    'JM',
    'Bruder Meier',
  ])
  assert.deepEqual(parsePlanNames(''), [])
  assert.equal(formatPlanNames(['Carden', 'JM']), 'Carden, JM')
  assert.equal(formatPlanNames(undefined), '')
})

test('die verknüpften Konten eines Termins – je mit ihrem Feld', () => {
  const users = [
    { id: 'u1', displayName: 'Carden Müller', apNames: ['Carden'] },
    { id: 'u2', displayName: 'Josh Meier', apNames: ['Josh', 'JM'] },
    { id: 'u3', displayName: 'Ohne Namen' },
  ]
  const linked = linkedAccounts({ leader: 'Carden & Josh', advisor: 'JM' }, users)

  assert.deepEqual(
    linked.map(({ user, fields }) => [user.id, fields]),
    [
      ['u1', ['leader']],
      ['u2', ['leader', 'advisor']],
    ],
  )
})

test('Vorschläge sind die einzelnen Namen aus dem Plan – die häufigsten zuerst', () => {
  const plan = [
    { leader: 'Carden & Josh', bishopric: 'Bischof' },
    { leader: 'Carden', advisor: 'JM / Josh' },
    { leader: 'Elias und Carden' },
  ]
  assert.deepEqual(planNameSuggestions(plan), ['Carden', 'Josh', 'Bischof', 'Elias', 'JM'])
})

test('die Erinnerung beginnt für alle Termine – «nur meine» ist eine Wahl', () => {
  assert.equal(DEFAULT_NOTIFICATION_SETTINGS.ap.onlyMine, false)
})
