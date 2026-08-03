import assert from 'node:assert/strict'
import { test } from 'node:test'

import { splitLinks } from '../src/lib/links.ts'

/*
 * Läuft ohne Bundler direkt in Node: `npm run test:import`.
 *
 * Geprüft wird, was in einer Notiz anklickbar wird – und vor allem, was
 * nicht: Ein Muster, das jede Zahl mit Punkt für eine Adresse hält, machte
 * aus jeder Notiz ein Minenfeld.
 */

const links = (text: string) =>
  splitLinks(text)
    .filter((part) => part.href)
    .map((part) => `${part.text} → ${part.href}`)

test('erkennt Adressen mit und ohne Schema', () => {
  assert.deepEqual(links('Fahrplan: https://www.sbb.ch/de'), [
    'https://www.sbb.ch/de → https://www.sbb.ch/de',
  ])
  assert.deepEqual(links('Siehe www.kirche.ch'), ['www.kirche.ch → https://www.kirche.ch'])
})

test('erkennt E-Mail-Adressen', () => {
  assert.deepEqual(links('Melden bei peter.meier@example.ch, danke'), [
    'peter.meier@example.ch → mailto:peter.meier@example.ch',
  ])
})

test('lässt den Satzpunkt beim Satz', () => {
  const parts = splitLinks('Siehe https://sbb.ch.')
  assert.deepEqual(
    parts.map((part) => part.text),
    ['Siehe ', 'https://sbb.ch', '.'],
  )
  assert.equal(parts[2]?.href, undefined)
})

test('behält eine Klammer, die zur Adresse gehört', () => {
  assert.deepEqual(links('https://de.wikipedia.org/wiki/Bern_(Stadt)'), [
    'https://de.wikipedia.org/wiki/Bern_(Stadt) → https://de.wikipedia.org/wiki/Bern_(Stadt)',
  ])
  assert.deepEqual(links('(siehe https://sbb.ch)'), ['https://sbb.ch → https://sbb.ch'])
})

test('hält gewöhnlichen Text für gewöhnlichen Text', () => {
  assert.deepEqual(links('Das kostet 12.50 pro Person'), [])
  assert.deepEqual(links('Kapitel 29.2.1 im Handbuch'), [])
})

test('gibt den Text vollständig zurück', () => {
  const text = 'Anmeldung bei anna@example.ch oder www.gemeinde.ch – bis Freitag.'
  assert.equal(
    splitLinks(text)
      .map((part) => part.text)
      .join(''),
    text,
  )
})
