import assert from 'node:assert/strict'
import { test } from 'node:test'

import { searchHits, searchSnippet } from '../src/lib/search.ts'

/*
 * Läuft ohne Bundler direkt in Node: `npm run test:import`.
 *
 * Geprüft wird, was die Hervorhebung in der Sitzungssuche braucht: die
 * Fundstelle im **ursprünglichen** Text. Verglichen wird ohne Rücksicht auf
 * Gross- und Kleinschreibung und ohne Akzente – markiert wird trotzdem das,
 * was dasteht, samt Umlaut.
 */

/** Der markierte Ausschnitt – so, wie ihn die Oberfläche unterlegt. */
const marked = (text: string, needle: string) =>
  searchHits(text, needle).map((hit) => text.slice(hit.start, hit.end))

test('findet ohne Rücksicht auf Gross- und Kleinschreibung', () => {
  assert.deepEqual(marked('Taufe von Anna', 'taufe'), ['Taufe'])
  assert.deepEqual(marked('taufe von Anna', 'TAUFE'), ['taufe'])
})

test('markiert den Umlaut, nicht seine vereinfachte Fassung', () => {
  assert.deepEqual(marked('Grüezi mitenand', 'gruezi'), ['Grüezi'])
  assert.deepEqual(marked('Bürgergemeinde', 'burger'), ['Bürger'])
  // Das «ß» wird zu zwei Zeichen – die Fundstelle zeigt trotzdem auf das eine.
  assert.deepEqual(marked('Strasse und Straße', 'strasse'), ['Strasse', 'Straße'])
})

test('findet jedes Vorkommen, nicht nur das erste', () => {
  assert.deepEqual(marked('Taufe, Taufe und nochmals Taufe', 'taufe'), ['Taufe', 'Taufe', 'Taufe'])
})

test('mehrere Wörter zählen einzeln und in beliebiger Reihenfolge', () => {
  assert.deepEqual(marked('Protokoll der Taufe', 'taufe protokoll'), ['Protokoll', 'Taufe'])
})

test('überschneidende Fundstellen werden zu einer', () => {
  assert.deepEqual(marked('Taufen', 'tauf taufen'), ['Taufen'])
})

test('ohne Begriff und ohne Treffer bleibt nichts übrig', () => {
  assert.deepEqual(searchHits('Taufe', ''), [])
  assert.deepEqual(searchHits('Taufe', '   '), [])
  assert.deepEqual(searchHits('', 'taufe'), [])
  assert.deepEqual(searchHits('Taufe', 'Abendmahl'), [])
})

/* ------------------------------------------------------------------ */
/* Ausschnitt                                                          */
/* ------------------------------------------------------------------ */

test('der Ausschnitt holt die Fundstelle nach vorn', () => {
  const lang = `${'Wort '.repeat(60)}Taufe${' Wort'.repeat(60)}`
  const snippet = searchSnippet(lang, 'taufe', 20)

  assert.ok(snippet.includes('Taufe'))
  assert.ok(snippet.startsWith('…'))
  assert.ok(snippet.endsWith('…'))
  assert.ok(snippet.length < 80)
})

test('kurzer Text bleibt ganz stehen, Zeilenumbrüche werden zu Leerzeichen', () => {
  assert.equal(searchSnippet('Taufe\nvon Anna', 'taufe'), 'Taufe von Anna')
})
