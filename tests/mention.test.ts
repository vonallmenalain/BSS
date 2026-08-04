import assert from 'node:assert/strict'
import { test } from 'node:test'

import { findMentionTrigger, splitMentions } from '../src/lib/mention.ts'

/*
 * Läuft ohne Bundler direkt in Node: `npm run test:import`.
 *
 * Zwei Fragen: Wann öffnet ein «@» die Mitgliederliste, und wo steckt in
 * einem fertigen Text der Name, der anklickbar werden soll. Die zweite ist
 * die heiklere – der Name steht dort als gewöhnlicher Text, und ein Muster,
 * das zu grosszügig sucht, macht aus «Meierhof» einen Verweis auf Meier.
 */

const MEIER = { id: 'm1', name: 'Peter Meier' }
const PETER = { id: 'm2', name: 'Peter' }

const marked = (text: string, mentions = [MEIER]) =>
  splitMentions(text, mentions)
    .filter((part) => part.memberId)
    .map((part) => `${part.text} → ${part.memberId}`)

test('erkennt das «@» am Wortanfang', () => {
  assert.deepEqual(findMentionTrigger('Besuch bei @Mei', 15), { start: 11, query: 'Mei' })
  assert.deepEqual(findMentionTrigger('@', 1), { start: 0, query: '' })
})

test('lässt eine E-Mail-Adresse in Ruhe', () => {
  assert.equal(findMentionTrigger('peter@example.ch', 16), null)
})

test('sucht nicht über einen Zeilenumbruch hinweg', () => {
  assert.equal(findMentionTrigger('@Peter\nund weiter', 17), null)
})

test('findet den erwähnten Namen im Text', () => {
  assert.deepEqual(marked('Besuch bei Peter Meier vereinbaren'), ['Peter Meier → m1'])
  assert.deepEqual(marked('Peter Meier'), ['Peter Meier → m1'])
})

test('zerlegt den Text in der richtigen Reihenfolge', () => {
  assert.deepEqual(
    splitMentions('Für Peter Meier abklären', [MEIER]).map((part) => part.text),
    ['Für ', 'Peter Meier', ' abklären'],
  )
})

test('reisst keinen Namen aus einem Wort', () => {
  assert.deepEqual(marked('Treffen im Meierhof', [{ id: 'm3', name: 'Meier' }]), [])
})

test('nimmt den längeren Namen, wenn beide passen', () => {
  assert.deepEqual(marked('Peter Meier anrufen', [PETER, MEIER]), ['Peter Meier → m1'])
})

test('findet jedes Vorkommen', () => {
  assert.deepEqual(marked('Peter Meier und nochmals Peter Meier'), [
    'Peter Meier → m1',
    'Peter Meier → m1',
  ])
})

test('kümmert sich nicht um Gross- und Kleinschreibung', () => {
  assert.deepEqual(marked('bei peter meier melden'), ['peter meier → m1'])
})

test('kommt mit leerem Text und ohne Erwähnungen zurecht', () => {
  assert.deepEqual(splitMentions('', [MEIER]), [])
  assert.deepEqual(
    splitMentions('Nichts Besonderes', []).map((part) => part.text),
    ['Nichts Besonderes'],
  )
})
