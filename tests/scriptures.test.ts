import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  addScriptureLinks,
  churchSearchLink,
  countScriptureLinkCandidates,
  scriptureLink,
} from '../src/lib/scriptures.ts'
import { planStarterItems } from '../src/lib/impulseStarter.ts'

/*
 * Die Schriftstellen-Links: Aus «1 Nephi 3:7» soll genau die Adresse
 * werden, die auch das Startpaket von Hand hineingeschrieben hat. Die
 * Stichproben decken jede Schriftensammlung und jede Schreibform ab;
 * der Rundlauf am Ende prüft die Funktion gegen **alle** Quellen-Links
 * des Startpakets – baut jemand die Adressen der Kirche je anders,
 * schlägt genau ein Ort Alarm.
 */

const BASE = 'https://www.churchofjesuschrist.org/study/scriptures'

test('scriptureLink: Vers, Versbereich, Kapitel und Kapitelbereich', () => {
  assert.equal(scriptureLink('1 Nephi 3:7'), `${BASE}/bofm/1-ne/3?lang=deu&id=p7#p7`)
  assert.equal(scriptureLink('1 Nephi 3:2–4'), `${BASE}/bofm/1-ne/3?lang=deu&id=p2-p4#p2`)
  assert.equal(scriptureLink('Alma 32'), `${BASE}/bofm/alma/32?lang=deu`)
  assert.equal(scriptureLink('Matthäus 5–7'), `${BASE}/nt/matt/5?lang=deu`)
})

test('scriptureLink: alle Schriftensammlungen', () => {
  assert.equal(scriptureLink('Psalm 62:3'), `${BASE}/ot/ps/62?lang=deu&id=p3#p3`)
  assert.equal(scriptureLink('Markus 4:39'), `${BASE}/nt/mark/4?lang=deu&id=p39#p39`)
  assert.equal(scriptureLink('Helaman 5:12'), `${BASE}/bofm/hel/5?lang=deu&id=p12#p12`)
  assert.equal(
    scriptureLink('Lehre und Bündnisse 6:36'),
    `${BASE}/dc-testament/dc/6?lang=deu&id=p36#p36`,
  )
  assert.equal(
    scriptureLink('Joseph Smith – Lebensgeschichte 1:59'),
    `${BASE}/pgp/js-h/1?lang=deu&id=p59#p59`,
  )
})

test('scriptureLink: gängige Schreibweisen', () => {
  // Dieselbe Stelle, drei Schreibarten.
  const expected = `${BASE}/dc-testament/dc/6?lang=deu&id=p36#p36`
  assert.equal(scriptureLink('LuB 6:36'), expected)
  assert.equal(scriptureLink('lehre und bündnisse 6:36'), expected)
  assert.equal(scriptureLink('Sprüche 3:5'), scriptureLink('Sprichwörter 3:5'))
  assert.equal(scriptureLink('Mosia 2:17'), scriptureLink('Mosiah 2:17'))
  // «1 Johannes» ist ein eigenes Buch, kein Kapitel von «Johannes».
  assert.equal(scriptureLink('1 Johannes 4:18'), `${BASE}/nt/1-jn/4?lang=deu&id=p18#p18`)
  assert.equal(scriptureLink('Mose 1:39'), `${BASE}/pgp/moses/1?lang=deu&id=p39#p39`)
  assert.equal(scriptureLink('1 Mose 1:1'), `${BASE}/ot/gen/1?lang=deu&id=p1#p1`)
})

test('scriptureLink: die Glaubensartikel zählen ihre Artikel als Verse', () => {
  assert.equal(scriptureLink('4. Glaubensartikel'), `${BASE}/pgp/a-of-f/1?lang=deu&id=p4#p4`)
  assert.equal(scriptureLink('Glaubensartikel 13'), `${BASE}/pgp/a-of-f/1?lang=deu&id=p13#p13`)
  assert.equal(scriptureLink('Die Glaubensartikel'), `${BASE}/pgp/a-of-f/1?lang=deu`)
  assert.equal(scriptureLink('14. Glaubensartikel'), null)
})

test('scriptureLink: was keine Schriftstelle ist, bekommt keinen Vorschlag', () => {
  assert.equal(scriptureLink(''), null)
  assert.equal(scriptureLink('Generalkonferenz Okt. 2025'), null)
  assert.equal(scriptureLink('Tempel der Kirche'), null)
  assert.equal(scriptureLink('Buch Mormon'), null)
  assert.equal(scriptureLink('Alma'), null)
  assert.equal(scriptureLink('Alma dreiunddreissig'), null)
  // Ein verkehrter Versbereich ist eher ein Tippfehler als ein Link.
  assert.equal(scriptureLink('Alma 32:9–7'), null)
})

test('scriptureLink: deckt jeden Schriften-Link des Startpakets', () => {
  let covered = 0
  for (const plan of planStarterItems([], '2026-W33')) {
    const source = plan.source
    if (!source?.url.startsWith(BASE)) continue
    const derived = scriptureLink(source.label)
    if (derived === null) continue
    assert.equal(derived, source.url, `${plan.id}: «${source.label}»`)
    covered += 1
  }
  // Nicht nur «nichts widerspricht»: Der Grossteil der Links muss auch
  // wirklich hergeleitet werden – sonst ist die Bücher-Tafel löchrig.
  assert.ok(covered >= 25, `nur ${covered} Schriften-Links hergeleitet`)
})

test('churchSearchLink: die Suche der Kirche, vorbefüllt', () => {
  assert.equal(
    churchSearchLink('Generalkonferenz Okt. 2025'),
    'https://www.churchofjesuschrist.org/search?lang=deu&query=Generalkonferenz%20Okt.%202025',
  )
})

test('addScriptureLinks: verlinkt reine Schriftstellen-Zeilen, sonst nichts', () => {
  const before = [
    'Der Auftrag wirkt riskant – aber Gottes Gebote haben Gründe.',
    '',
    'Zum Weiterlesen:',
    'Mosia 1:3–4',
    `1 Nephi 4:6 – ${BASE}/bofm/1-ne/4?lang=deu&id=p6#p6`,
  ].join('\n')
  const { text, added } = addScriptureLinks(before)
  assert.equal(added, 1)
  assert.deepEqual(text.split('\n'), [
    'Der Auftrag wirkt riskant – aber Gottes Gebote haben Gründe.',
    '',
    'Zum Weiterlesen:',
    `Mosia 1:3–4 – ${BASE}/bofm/mosiah/1?lang=deu&id=p3-p4#p3`,
    `1 Nephi 4:6 – ${BASE}/bofm/1-ne/4?lang=deu&id=p6#p6`,
  ])
  // Ein zweiter Lauf findet nichts mehr – der Knopf verlinkt nie doppelt.
  const again = addScriptureLinks(text)
  assert.equal(again.added, 0)
  assert.equal(again.text, text)
  assert.equal(countScriptureLinkCandidates(before), 1)
  assert.equal(countScriptureLinkCandidates(text), 0)
})
