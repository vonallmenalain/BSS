import assert from 'node:assert/strict'
import { test } from 'node:test'

import { buildMemberIndex, matchMemberByName } from '../src/services/importMatch.ts'
import { matchesGivenNames, nameKeys } from '../src/lib/names.ts'
import type { Member } from '../src/lib/types.ts'

/*
 * Läuft ohne Bundler direkt in Node (Typen werden beim Laden entfernt,
 * Node >= 22.18): `npm run test:import`.
 *
 * Die Namen sind erfunden, die Muster nicht: Umlaute einmal ausgeschrieben
 * und einmal nicht, ein zweiter Vorname, der in der einen Liste fehlt, und
 * zwei Personen, die sich Vor- und Nachname teilen.
 */

function member(id: string, lastName: string, firstName: string): Member {
  return {
    id,
    lastName,
    firstName,
    gender: 'unknown',
    birthDate: null,
    status: 'active',
    availableForTalks: true,
    lastTalkDate: null,
    talkCount: 0,
    tags: [],
  }
}

const MEMBERS = [
  member('m1', 'Bürge', 'Regina'),
  member('m2', 'Burri', 'Hansjörg'),
  member('m3', 'Gräppi', 'Diana'),
  member('m4', 'Lauener', 'Anne Christiane'),
  member('m5', 'Lauener', 'Céline Désirée'),
  member('m6', 'Lauener', 'Céline Ann'),
  member('m7', 'Bader', 'Joshua Brandon'),
  member('m8', 'Kummer', 'Marie-Theres'),
  member('m9', 'Roemer', 'Aaron'),
]

const INDEX = buildMemberIndex(MEMBERS)

function match(name: string) {
  return matchMemberByName(name, INDEX)
}

/* ------------------------------------------------------------------ */
/* Vergleichsformen                                                    */
/* ------------------------------------------------------------------ */

test('gibt Umlauten beide Schreibweisen', () => {
  assert.deepEqual(nameKeys('Bürge'), ['buerge', 'burge'])
  assert.deepEqual(nameKeys('Gräppi'), ['graeppi', 'grappi'])
  // Ohne Umlaut bleibt es bei einer Form.
  assert.deepEqual(nameKeys('Buerge'), ['buerge'])
  assert.deepEqual(nameKeys('Céline'), ['celine'])
})

test('zieht «ue» nicht zu «u» zusammen', () => {
  // Sonst würde aus «Manuel» «manul» – und Namen fielen zusammen,
  // die nichts miteinander zu tun haben.
  assert.deepEqual(nameKeys('Manuel'), ['manuel'])
  assert.deepEqual(nameKeys('Neuenschwander'), ['neuenschwander'])
})

/* ------------------------------------------------------------------ */
/* Umlaute im Abgleich                                                 */
/* ------------------------------------------------------------------ */

test('findet den ausgeschriebenen Umlaut', () => {
  assert.equal(match('Buerge, Regina').member?.id, 'm1')
  assert.equal(match('Burri, Hansjoerg').member?.id, 'm2')
  assert.equal(match('Graeppi, Diana').member?.id, 'm3')
})

test('findet auch den weggelassenen Umlaut', () => {
  assert.equal(match('Burge, Regina').member?.id, 'm1')
  assert.equal(match('Grappi, Diana').member?.id, 'm3')
})

test('findet den Umlaut auch umgekehrt', () => {
  // In der Mitgliederliste ohne, in der Quelle mit.
  assert.equal(matchMemberByName('Römer, Aaron', INDEX).member?.id, 'm9')
})

test('setzt Akzente mit ihrem Grundbuchstaben gleich', () => {
  assert.equal(match('Lauener, Céline Désirée').member?.id, 'm5')
  assert.equal(match('Lauener, Celine Desiree').member?.id, 'm5')
})

/* ------------------------------------------------------------------ */
/* Vornamen                                                            */
/* ------------------------------------------------------------------ */

test('erkennt den Vornamen auch als zweiten', () => {
  // In der Tabelle steht «Christiane», im Verzeichnis «Anne Christiane».
  assert.equal(match('Lauener, Christiane').member?.id, 'm4')
})

test('erkennt abgekürzte Zweitnamen', () => {
  assert.equal(match('Bader, Joshua B.').member?.id, 'm7')
})

test('zerlegt Doppelnamen', () => {
  assert.equal(match('Kummer, Marie').member?.id, 'm8')
  assert.equal(match('Kummer, Theres').member?.id, 'm8')
})

test('lässt den genauen Vornamen vorgehen', () => {
  // «Céline» allein passt zu beiden Célines und bleibt deshalb offen –
  // «Céline Ann» aber ist genau eine.
  assert.equal(match('Lauener, Céline Ann').member?.id, 'm6')
  assert.equal(match('Lauener, Céline').member, null)
  assert.equal(match('Lauener, Céline').ambiguous, true)
})

test('meldet einen halben Treffer als offen, statt zu raten', () => {
  // «Celine Müller» – der zweite Bestandteil passt zu keiner der beiden.
  const result = match('Lauener, Celine Müller')
  assert.equal(result.member, null)
  assert.equal(result.ambiguous, false)
})

test('meldet einen unbekannten Nachnamen als offen', () => {
  // Nach einer Heirat steht in der Tabelle der frühere Name.
  assert.deepEqual(match('Fetscherin, Myriam'), { member: null, ambiguous: false })
})

test('braucht ohne Vornamen einen eindeutigen Nachnamen', () => {
  assert.equal(match('Bürge').member?.id, 'm1')
  assert.equal(match('Lauener').ambiguous, true)
})

/* ------------------------------------------------------------------ */
/* Regel für sich                                                      */
/* ------------------------------------------------------------------ */

test('verlangt, dass jeder genannte Vorname vorkommt', () => {
  assert.equal(matchesGivenNames('Christiane', 'Anne Christiane'), true)
  assert.equal(matchesGivenNames('Anne Christiane', 'Anne Christiane'), true)
  assert.equal(matchesGivenNames('Joshua B.', 'Joshua Brandon'), true)
  assert.equal(matchesGivenNames('Celine Müller', 'Céline Désirée'), false)
  assert.equal(matchesGivenNames('Anne Christiane', 'Christiane'), false)
})
