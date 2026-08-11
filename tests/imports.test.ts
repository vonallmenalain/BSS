import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { ADMIN_IMPORTS, ADMIN_IMPORT_PATHS, EVERYDAY_IMPORTS, IMPORTS } from '../src/lib/imports.ts'

/*
 * Läuft ohne Bundler direkt in Node: `npm run test:import`.
 *
 * Geprüft wird eine einzige Zusicherung, die sich über zwei Dateien
 * erstreckt: Was `lib/imports` als Admin-Import führt, muss in `App.tsx`
 * hinter `RequireAdmin` stehen – und umgekehrt. Fällt eines von beidem
 * auseinander, ist der Eintrag entweder nirgends mehr verlinkt, aber über
 * die Adresse weiterhin offen, oder er ist verlinkt und führt ins Leere.
 * Beides fiele im Alltag niemandem auf: Das Administrator-Konto sieht ja
 * ohnehin alles.
 */

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')

/** Die Adressen aller Import-Routen, in der Reihenfolge der Datei. */
const routes = [...app.matchAll(/path="(import[^"]*)"/g)].map((match) => `/${match[1]}`)

/**
 * Alles ab der Weiche – dort und nur dort stehen die Admin-Importe.
 *
 * Die Weiche steht inzwischen mehr als einmal in der Datei (auch vor dem
 * Zugriffsprotokoll), deshalb wird sie samt Ziel gesucht. Und wird sie gar
 * nicht gefunden, bleibt hier ein leerer Text: `slice(-1)` gäbe sonst das
 * letzte Zeichen zurück, und die Prüfung darunter meldete «nicht geschützt»
 * statt «Weiche verschwunden».
 */
const GUARD = '<Route element={<RequireAdmin to="/import" />}>'
const guardedAt = app.indexOf(GUARD)
const guarded = guardedAt === -1 ? '' : app.slice(guardedAt)

test('jeder Import hat eine Route – und jede Route einen Import', () => {
  assert.deepEqual(new Set(routes), new Set(IMPORTS.map((entry) => entry.to)))
  assert.equal(routes.length, IMPORTS.length, 'eine Adresse steht doppelt in App.tsx')
})

test('die Admin-Importe stehen hinter RequireAdmin', () => {
  assert.ok(guarded, 'App.tsx kennt keine Weiche RequireAdmin mehr')
  for (const path of ADMIN_IMPORT_PATHS) {
    assert.ok(guarded.includes(`path="${path.slice(1)}"`), `${path} ist nicht geschützt`)
  }
})

test('die übrigen Importe stehen nicht dahinter', () => {
  for (const entry of EVERYDAY_IMPORTS) {
    assert.ok(
      !guarded.includes(`path="${entry.to.slice(1)}"`),
      `${entry.to} ist versehentlich geschützt`,
    )
  }
})

test('beide Gruppen sind besetzt', () => {
  // Eine leere Gruppe hiesse, dass die Prüfungen oben nichts mehr prüfen.
  assert.ok(ADMIN_IMPORTS.length > 0)
  assert.ok(EVERYDAY_IMPORTS.length > 0)
})
