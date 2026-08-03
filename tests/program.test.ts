import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildProgram,
  nextTalkSlot,
  planProgramOrder,
  type ProgramSource,
} from '../src/lib/program.ts'
import type { HymnChoice, Talk, TalkKind } from '../src/lib/types.ts'

/*
 * Läuft ohne Bundler direkt in Node: `npm run test:import`.
 *
 * Geprüft wird die Zusage, auf der die Seiten «Leitung» und «Ansprachen»
 * aufbauen: Beide zeigen dieselbe Reihenfolge, gleich von welcher Seite aus
 * verschoben wurde.
 */

function talk(id: string, slot: number, name = `Person ${slot}`, kind: TalkKind = 'talk'): Talk {
  return {
    id,
    memberId: `m-${id}`,
    memberName: name,
    date: null as unknown as Talk['date'],
    slot,
    kind,
    status: 'planned',
  }
}

const hymn = (number: number | null, title: string): HymnChoice => ({ number, title })

const hymnTitle = (choice: HymnChoice | undefined) =>
  choice && (choice.number || choice.title) ? `${choice.number} – ${choice.title}` : '–'

const withIntermediate = (programOrder: string[] = []): ProgramSource => ({
  hymns: { intermediate: hymn(100, 'Lied') },
  musicalNumbers: [],
  programOrder,
})

const shape = (source: ProgramSource | null, talks: Talk[], planned: number) =>
  buildProgram(source, talks, hymnTitle, planned).map(
    (entry) => `${entry.label}:${entry.title || '?'}`,
  )

/** Wendet eine neue Reihenfolge an – wie es `saveProgramOrder` in Firestore täte. */
function apply(source: ProgramSource, talks: Talk[], keys: string[]) {
  const { order, slots } = planProgramOrder(keys, talks)
  const bySlot = new Map(slots.map((entry) => [entry.id, entry.slot]))
  return {
    source: { ...source, programOrder: order },
    talks: talks
      .map((entry) => ({ ...entry, slot: bySlot.get(entry.id) ?? entry.slot }))
      .sort((a, b) => a.slot - b.slot),
  }
}

/* ------------------------------------------------------------------ */

test('Standardablauf: Ansprache, Zwischenlied, Schlussansprache', () => {
  assert.deepEqual(shape(withIntermediate(), [], 2), [
    'Ansprache:?',
    'Zwischenlied:100 – Lied',
    'Schlussansprache:?',
  ])
})

test('offene Programmplätze stehen an ihrer Position', () => {
  // Die erste Ansprache wurde abgesagt, die zweite bleibt stehen.
  assert.deepEqual(shape(withIntermediate(), [talk('b', 2, 'Bea')], 2), [
    'Ansprache:?',
    'Zwischenlied:100 – Lied',
    'Schlussansprache:Bea',
  ])
})

test('bei drei Ansprachen steht das Zwischenlied vor der letzten', () => {
  const talks = [talk('a', 1, 'Anna'), talk('b', 2, 'Bea'), talk('c', 3, 'Cara')]
  assert.deepEqual(shape(withIntermediate(), talks, 3), [
    'Ansprache:Anna',
    'Ansprache:Bea',
    'Zwischenlied:100 – Lied',
    'Schlussansprache:Cara',
  ])
})

test('ein Zeugnis am Schluss bleibt ein Zeugnis', () => {
  const talks = [talk('a', 1, 'Anna'), talk('b', 2, 'Bea', 'testimony')]
  assert.deepEqual(shape(withIntermediate(), talks, 2), [
    'Ansprache:Anna',
    'Zwischenlied:100 – Lied',
    'Zeugnis:Bea',
  ])
})

test('unter «Leitung» verschobenes Zwischenlied bleibt vorne', () => {
  const talks = [talk('a', 1, 'Anna'), talk('b', 2, 'Bea')]
  const before = buildProgram(withIntermediate(), talks, hymnTitle, 2)
  const keys = before.map((entry) => entry.key)
  // Zwischenlied nach ganz oben
  const next = ['hymn:intermediate', ...keys.filter((key) => key !== 'hymn:intermediate')]

  const applied = apply(withIntermediate(), talks, next)
  assert.deepEqual(shape(applied.source, applied.talks, 2), [
    'Zwischenlied:100 – Lied',
    'Ansprache:Anna',
    'Schlussansprache:Bea',
  ])
})

test('unter «Leitung» getauschte Ansprachen verschieben auch ihre Position', () => {
  const talks = [talk('a', 1, 'Anna'), talk('b', 2, 'Bea')]
  const applied = apply(withIntermediate(), talks, ['talk:b', 'hymn:intermediate', 'talk:a'])

  assert.deepEqual(
    applied.talks.map((entry) => `${entry.id}=${entry.slot}`),
    ['b=1', 'a=2'],
    'Die Positionen folgen der neuen Reihenfolge – sonst ordnete «Ansprachen» anders.',
  )
  assert.deepEqual(shape(applied.source, applied.talks, 2), [
    'Ansprache:Bea',
    'Zwischenlied:100 – Lied',
    'Schlussansprache:Anna',
  ])
})

test('unter «Ansprachen» getauschte Positionen verschieben auch den Ablauf', () => {
  // Nur die Positionen wurden getauscht, `programOrder` blieb unberührt.
  const talks = [talk('b', 1, 'Bea'), talk('a', 2, 'Anna')]
  const source = withIntermediate(['talk:a', 'hymn:intermediate', 'talk:b'])

  assert.deepEqual(shape(source, talks, 2), [
    'Ansprache:Bea',
    'Zwischenlied:100 – Lied',
    'Schlussansprache:Anna',
  ])
})

test('ein offener Platz zählt beim Verschieben als Position mit', () => {
  const talks = [talk('a', 1, 'Anna')]
  const before = buildProgram(withIntermediate(), talks, hymnTitle, 2)
  assert.deepEqual(
    before.map((entry) => entry.key),
    ['talk:a', 'hymn:intermediate', 'slot:2'],
  )

  // Den offenen Platz ganz nach vorne ziehen.
  const applied = apply(withIntermediate(), talks, ['slot:2', 'talk:a', 'hymn:intermediate'])

  assert.deepEqual(
    applied.talks.map((entry) => `${entry.id}=${entry.slot}`),
    ['a=2'],
    'Anna rückt auf den zweiten Platz – auch unter «Ansprachen».',
  )
  assert.deepEqual(shape(applied.source, applied.talks, 2), [
    'Ansprache:?',
    'Schlussansprache:Anna',
    'Zwischenlied:100 – Lied',
  ])
  assert.equal(
    applied.source.programOrder?.includes('slot:2'),
    false,
    'Offene Plätze gehören nicht ins gespeicherte Schlüsselband.',
  )
})

test('Musikeinlage und Zwischenlied stehen beide vor der Schlussansprache', () => {
  const talks = [talk('a', 1, 'Anna'), talk('b', 2, 'Bea')]
  const source: ProgramSource = {
    hymns: { intermediate: hymn(100, 'Lied') },
    musicalNumbers: [{ id: 'm1', title: 'Chor' }],
    programOrder: [],
  }
  assert.deepEqual(shape(source, talks, 2), [
    'Ansprache:Anna',
    'Zwischenlied:100 – Lied',
    'Musikeinlage:Chor',
    'Schlussansprache:Bea',
  ])
})

test('ohne Ansprachen und ohne Plätze bleibt der Teil leer', () => {
  assert.deepEqual(shape({ hymns: {}, musicalNumbers: [], programOrder: [] }, [], 0), [])
})

test('ein frisch angelegtes Zwischenlied erscheint als offener Punkt', () => {
  const source: ProgramSource = {
    hymns: { intermediate: hymn(null, '') },
    musicalNumbers: [],
    programOrder: [],
  }
  const entries = buildProgram(source, [talk('a', 1, 'Anna')], hymnTitle, 1)
  const intermediate = entries.find((entry) => entry.key === 'hymn:intermediate')
  assert.ok(intermediate)
  assert.equal(intermediate.title, '')
  assert.equal(intermediate.incomplete, true)
})

test('der nächste Programmplatz füllt zuerst die Lücke', () => {
  assert.equal(nextTalkSlot([talk('a', 1), talk('c', 3)]), 2)
  assert.equal(nextTalkSlot([talk('a', 1), talk('b', 2)]), 3)
  assert.equal(nextTalkSlot([]), 1)
})
