import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  APP_VERSION,
  isAppVersion,
  prNumberFrom,
  versionLabel,
  type AppVersion,
} from '../src/lib/appVersion.ts'

/*
 * Welche Fassung läuft (src/lib/appVersion.ts) – die Nummer im Menü des
 * Administrator-Kontos und der Abgleich mit `/version.json`.
 */

const built: AppVersion = {
  id: '22ae1bb07247-2026-10-26T21:21:08.000Z',
  pr: 190,
  preview: false,
  commit: '22ae1bb',
  builtAt: '2026-10-26T21:21:08.000Z',
}

test('Pull Request aus der Betreffzeile des Squash-Merges', () => {
  assert.equal(
    prNumberFrom('Anti Doom: Shorts der Woche zum Schriftstudium mit Soundeffekten (#190)'),
    190,
  )
  assert.equal(prNumberFrom('Sitzung: Angelegenheiten ohne Mitglied (#185)  '), 185)
  // Ein Verweis mitten im Text ist nicht die Herkunft.
  assert.equal(prNumberFrom('Rückgängig: #185 war falsch'), null)
  assert.equal(prNumberFrom('Direkt auf main'), null)
  assert.equal(prNumberFrom(null), null)
})

test('Bezeichnung: Nummer, Vorschau oder Commit', () => {
  assert.equal(versionLabel(built), '#190')
  assert.equal(versionLabel({ ...built, pr: 191, preview: true }), 'Vorschau #191')
  assert.equal(versionLabel({ ...built, pr: null }), '22ae1bb')
})

test('Ohne Build (Tests, Entwicklung) gilt die Entwicklungsfassung', () => {
  assert.equal(versionLabel(APP_VERSION), 'Entwicklung')
  assert.equal(APP_VERSION.pr, null)
})

test('Nur eine Auskunft mit Kennung zählt als Fassung', () => {
  assert.equal(isAppVersion(built), true)
  assert.equal(isAppVersion({ id: '' }), false)
  assert.equal(isAppVersion(null), false)
  assert.equal(isAppVersion('<!doctype html>'), false)
})
