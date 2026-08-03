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

test('ein Eintrag ohne Mitglied steht mit seinem Namen im Ablauf', () => {
  // Nicht jeder Programmpunkt gehört zu jemandem aus der Mitgliederliste –
  // ein besuchender Hoher Rat, «Zeugnisse der neuen Ältesten».
  const gast: Talk = { ...talk('g', 2, 'Zeugnisse der neuen Ältesten'), memberId: '' }
  assert.deepEqual(shape(withIntermediate(), [talk('a', 1, 'Anna'), gast], 2), [
    'Ansprache:Anna',
    'Zwischenlied:100 – Lied',
    'Schlussansprache:Zeugnisse der neuen Ältesten',
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
  assert.deepEqual(
    applied.source.programOrder,
    ['slot:1', 'talk:a', 'hymn:intermediate'],
    'Der offene Platz bleibt im Schlüsselband – auf seine neue Nummer umgeschrieben.',
  )
})

test('das Zwischenlied lässt sich auch an offenen Plätzen vorbeischieben', () => {
  // Ein frisch geplanter Sonntag: drei Ansprachen vorgesehen, noch keine
  // vergeben. Genau hier stand das Zwischenlied bisher fest.
  const before = buildProgram(withIntermediate(), [], hymnTitle, 3)
  assert.deepEqual(
    before.map((entry) => entry.key),
    ['slot:1', 'slot:2', 'hymn:intermediate', 'slot:3'],
  )

  // Zwischenlied hinter die zweite Ansprache – eine Position nach unten.
  const down = apply(withIntermediate(), [], ['slot:1', 'slot:2', 'slot:3', 'hymn:intermediate'])
  assert.deepEqual(shape(down.source, down.talks, 3), [
    'Ansprache:?',
    'Ansprache:?',
    'Schlussansprache:?',
    'Zwischenlied:100 – Lied',
  ])

  // … und wieder ganz nach vorne.
  const up = apply(down.source, [], ['hymn:intermediate', 'slot:1', 'slot:2', 'slot:3'])
  assert.deepEqual(shape(up.source, up.talks, 3), [
    'Zwischenlied:100 – Lied',
    'Ansprache:?',
    'Ansprache:?',
    'Schlussansprache:?',
  ])
})

test('eine vergebene Ansprache schiebt sich an einem offenen Platz vorbei', () => {
  const talks = [talk('a', 1, 'Anna')]
  // Anna hinter den offenen zweiten Platz – sie rückt damit auf Platz 2.
  const applied = apply(withIntermediate(), talks, ['slot:1', 'talk:a', 'hymn:intermediate'])

  assert.deepEqual(
    applied.talks.map((entry) => `${entry.id}=${entry.slot}`),
    ['a=2'],
    'Die Position folgt der neuen Reihenfolge – sonst ordnete «Ansprachen» anders.',
  )
  assert.deepEqual(shape(applied.source, applied.talks, 2), [
    'Ansprache:?',
    'Schlussansprache:Anna',
    'Zwischenlied:100 – Lied',
  ])
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
