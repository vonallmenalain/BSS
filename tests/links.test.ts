import assert from 'node:assert/strict'
import { test } from 'node:test'

import { labeledLink, splitLinks } from '../src/lib/links.ts'

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

/* ------------------------------------------------------------------ */
/* Beschriftete Verweise – «Alma 32:27 – https://…»                    */
/* ------------------------------------------------------------------ */

test('labeledLink: Beschriftung, Gedankenstrich, Adresse', () => {
  assert.deepEqual(
    labeledLink('Alma 32:27 – https://www.churchofjesuschrist.org/study/scriptures/bofm/alma/32?lang=deu&id=p27#p27'),
    {
      label: 'Alma 32:27',
      href: 'https://www.churchofjesuschrist.org/study/scriptures/bofm/alma/32?lang=deu&id=p27#p27',
    },
  )
  // Auch mit einfachem Bindestrich und mit www-Adresse (Schema wird ergänzt).
  assert.deepEqual(labeledLink('Fahrplan - www.sbb.ch'), {
    label: 'Fahrplan',
    href: 'https://www.sbb.ch',
  })
})

test('labeledLink: die Beschriftung darf selbst Gedankenstriche tragen', () => {
  assert.deepEqual(
    labeledLink('Alma 32:41–43 – https://www.churchofjesuschrist.org/study/scriptures/bofm/alma/32?lang=deu&id=p41-p43#p41'),
    {
      label: 'Alma 32:41–43',
      href: 'https://www.churchofjesuschrist.org/study/scriptures/bofm/alma/32?lang=deu&id=p41-p43#p41',
    },
  )
})

test('labeledLink: gewöhnliche Zeilen sind keine Verweise', () => {
  assert.equal(labeledLink('Zum Weiterlesen:'), null)
  assert.equal(labeledLink('Ein Satz mit https://sbb.ch mittendrin geht weiter'), null)
  assert.equal(labeledLink('https://sbb.ch'), null)
  assert.equal(labeledLink(''), null)
})
