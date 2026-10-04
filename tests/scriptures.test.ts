import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  addScriptureLinks,
  churchSearchLink,
  countScriptureLinkCandidates,
  scriptureLink,
} from '../src/lib/scriptures.ts'
import { PACK_WEEKS, packWeekPlans } from '../src/lib/impulsePack.ts'

/*
 * Die Schriftstellen-Links: Aus «1 Nephi 3:7» soll genau die Adresse
 * werden, die die Evangeliumsbibliothek erwartet. Die Stichproben decken
 * jede Schriftensammlung und jede Schreibform ab; der Rundlauf am Ende
 * prüft, dass jede Schriftstelle des Themenpakets ihren Link bekommt –
 * das Paket baut seine Schriften-Links mit genau dieser Funktion, und
 * eine Angabe, die sie nicht versteht, stünde dort ohne Link.
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

test('scriptureLink: jede Schriftstelle des Themenpakets bekommt ihren Link', () => {
  let covered = 0
  for (const plan of PACK_WEEKS.flatMap(packWeekPlans)) {
    const source = plan.source
    if (!source) continue
    // Jede Quelle des Pakets trägt einen Link – auch die ausserhalb der Schriften.
    assert.ok(
      source.url.startsWith('https://www.churchofjesuschrist.org/'),
      `${plan.id}: «${source.label}» ohne Link`,
    )
    if (!source.url.startsWith(BASE)) continue
    assert.equal(scriptureLink(source.label), source.url, `${plan.id}: «${source.label}»`)
    covered += 1
  }
  // Das Paket lebt von den Schriften – der Grossteil seiner Quellen sind Verse.
  assert.ok(covered >= 40, `nur ${covered} Schriften-Links im Paket`)
})

test('scriptureLink: die reinen Schriftstellen-Zeilen der Vertiefungen werden verlinkt', () => {
  /* Die Vertiefungen des Pakets nennen ihre Stellen auf eigenen Zeilen
     («Alma 53:14–22») – die Anzeige verlinkt solche Zeilen von selbst.
     Jede Zeile, die mit einem Buchnamen und einer Zahl endet, muss
     deshalb erkannt werden. */
  const lines = PACK_WEEKS.flatMap(packWeekPlans)
    .flatMap((plan) => (plan.deepening ?? '').split('\n'))
    .map((line) => line.trim())
    .filter((line) => /^[1-3]?\s?[A-ZÄÖÜ][\wäöüÄÖÜ –-]+ \d+(:\d+(–\d+)?)?$/.test(line))
  assert.ok(lines.length >= 20, `nur ${lines.length} Stellen-Zeilen gefunden`)
  for (const line of lines) assert.ok(scriptureLink(line), `«${line}» wird nicht verlinkt`)
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
