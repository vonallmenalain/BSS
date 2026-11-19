import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildProgram,
  countOpenPositions,
  nextOpenPosition,
  nextTalkSlot,
  nextTalkStatus,
  plannedAfterAdding,
  planProgramOrder,
  planRemoveOpenPosition,
  planTalkInsert,
  planTalkMove,
  planTalkRemoval,
  talkPositions,
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

test('ein Platzhalter steht mit seiner Art im Ablauf – nur der Name fehlt', () => {
  // Ein Zeugnis lässt sich vergeben, bevor feststeht, wer es gibt.
  const platzhalter: Talk = { ...talk('z', 2, '', 'testimony'), memberId: '', memberName: '' }
  const talks = [talk('a', 1, 'Anna'), platzhalter]

  assert.deepEqual(shape(withIntermediate(), talks, 2), [
    'Ansprache:Anna',
    'Zwischenlied:100 – Lied',
    'Zeugnis:?',
  ])

  const program = buildProgram(withIntermediate(), talks, hymnTitle, 2)
  const entry = program[program.length - 1]
  assert.equal(entry.talkId, 'z', 'Der Punkt bleibt anklickbar – der Name wird nachgetragen.')
  assert.equal(entry.incomplete, true, 'Ohne Namen ist der Punkt unvollständig.')
  assert.equal(program[0].incomplete, false, 'Mit Namen nicht.')
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

/* ------------------------------------------------------------------ */
/* Dieselben Plätze unter «Ansprachen» und «Leitung»                   */
/* ------------------------------------------------------------------ */

/** Eine Ansprache, die zum Zeitpunkt `minute` erfasst wurde. */
function entered(id: string, slot: number, minute: number, name = id): Talk {
  return {
    ...talk(id, slot, name),
    createdAt: { seconds: minute * 60, nanoseconds: 0 } as unknown as Talk['createdAt'],
  }
}

/** Die Zeilen unter «Ansprachen»: Name oder «·» für einen offenen Platz. */
const rows = (talks: Talk[], planned: number) =>
  talkPositions(talks, planned).map((row) => `${row.position}:${row.talk ? row.talk.id : '·'}`)

/** Die Ansprachen im Ablauf unter «Leitung», in ihrer Reihenfolge. */
const conducted = (talks: Talk[], planned: number) =>
  buildProgram({ hymns: {}, musicalNumbers: [], programOrder: [] }, talks, hymnTitle, planned)
    .filter((entry) => entry.kind === 'talk' || entry.kind === 'testimony')
    .map((entry) => `${entry.slot}:${entry.talkId ?? '·'}`)

/** Schreibt Positionen zurück – wie es `updateTalkSlots` in Firestore täte. */
const applySlots = (talks: Talk[], updates: { id: string; slot: number }[]) => {
  const bySlot = new Map(updates.map((entry) => [entry.id, entry.slot]))
  return talks.map((entry) => ({ ...entry, slot: bySlot.get(entry.id) ?? entry.slot }))
}

test('zwei Ansprachen auf derselben Nummer bleiben beide sichtbar', () => {
  // Der Fall vom 13. Dezember: vier Eingetragene, je zwei auf Nummer 1 und 2.
  // «Ansprachen» zeigte nur zwei davon, «Leitung» alle vier.
  const talks = [
    entered('heinz', 2, 3),
    entered('sylvie', 1, 1),
    entered('moesha', 2, 4),
    entered('milena', 1, 2),
  ]
  assert.deepEqual(rows(talks, 2), ['1:sylvie', '2:milena', '3:heinz', '4:moesha'])
  assert.deepEqual(
    conducted(talks, 2),
    ['1:sylvie', '2:milena', '3:heinz', '4:moesha'],
    '«Leitung» zeigt dieselben vier in derselben Folge und mit denselben Nummern.',
  )
  assert.equal(countOpenPositions(talkPositions(talks, 2)), 0)
})

test('bei gleicher Nummer steht vorne, wer zuerst erfasst war', () => {
  const talks = [entered('spaet', 1, 9), entered('frueh', 1, 1)]
  assert.deepEqual(rows(talks, 2), ['1:frueh', '2:spaet'])
  // Ein eben erst angelegter Eintrag hat noch keinen Zeitstempel – er gilt als jüngster.
  const pending = { ...talk('neu', 1), createdAt: null as unknown as Talk['createdAt'] }
  assert.deepEqual(rows([pending, entered('alt', 1, 5)], 2), ['1:alt', '2:neu'])
})

test('eine Lücke innerhalb der vorgesehenen Plätze bleibt offen', () => {
  // Jemand hat abgesagt und wurde entfernt – der Platz wartet auf Ersatz.
  const talks = [talk('a', 1), talk('c', 3)]
  assert.deepEqual(rows(talks, 3), ['1:a', '2:·', '3:c'])
  assert.deepEqual(conducted(talks, 3), ['1:a', '2:·', '3:c'])
  assert.equal(countOpenPositions(talkPositions(talks, 3)), 1)
})

test('wer über die vorgesehenen Plätze hinaus eingetragen ist, rückt lückenlos an', () => {
  const talks = [talk('a', 1), talk('b', 2), talk('e', 5)]
  assert.deepEqual(rows(talks, 2), ['1:a', '2:b', '3:e'])
  assert.deepEqual(conducted(talks, 2), ['1:a', '2:b', '3:e'])
  // Offene Plätze vorne bleiben, der Zusatzpunkt steht dahinter.
  assert.deepEqual(rows([talk('a', 1), talk('e', 5)], 3), ['1:a', '2:·', '3:·', '4:e'])
  // An einem Sonntag ohne Ansprachen steht ein Eingetragener trotzdem da.
  assert.deepEqual(rows([talk('x', 2)], 0), ['1:x'])
})

test('ein Platzhalter belegt seinen Platz, zählt aber als offen', () => {
  const placeholder = { ...talk('p', 2), memberId: '', memberName: '' }
  const positions = talkPositions([talk('a', 1), placeholder], 2)
  assert.deepEqual(rows([talk('a', 1), placeholder], 2), ['1:a', '2:p'])
  assert.equal(countOpenPositions(positions), 1)
})

test('neu eingetragen wird am ersten offenen Platz, sonst hinten', () => {
  assert.equal(nextOpenPosition([talk('a', 1), talk('c', 3)], 3), 2)
  assert.equal(nextOpenPosition([talk('a', 1), talk('b', 2)], 2), 3)
  // Doppelt belegt zählt nicht als frei: hinter den vieren, nicht auf Nummer 3.
  assert.equal(nextOpenPosition([talk('a', 1), talk('b', 1), talk('c', 2), talk('d', 2)], 3), 5)
  assert.equal(nextOpenPosition([], 2), 1)
})

test('eine freie Position wird einfach belegt', () => {
  const plan = planTalkInsert([talk('a', 1), talk('c', 3)], 3, 2)
  assert.equal(plan.slot, 2)
  assert.deepEqual(plan.slots, [])
})

test('auf einer belegten Position rücken die Folgenden bis zum nächsten offenen Platz', () => {
  // a, b, offen – neu auf Position 1: a und b rücken nach, der offene Platz wird aufgefüllt.
  const talks = [talk('a', 1), talk('b', 2)]
  const plan = planTalkInsert(talks, 3, 1)
  assert.equal(plan.slot, 1)
  assert.deepEqual(plan.slots, [
    { id: 'a', slot: 2 },
    { id: 'b', slot: 3 },
  ])
  const after = [...applySlots(talks, plan.slots), talk('neu', plan.slot)]
  assert.deepEqual(rows(after, 3), ['1:neu', '2:a', '3:b'])

  // Ist nichts mehr offen, wird die Folge länger – der Letzte wird zum Zusatzpunkt.
  const full = planTalkInsert(talks, 2, 2)
  assert.equal(full.slot, 2)
  assert.deepEqual(full.slots, [{ id: 'b', slot: 3 }])
})

test('Eintragen bereinigt doppelt belegte Nummern', () => {
  const talks = [entered('a', 1, 1), entered('b', 1, 2), entered('c', 2, 3)]
  const plan = planTalkInsert(talks, 3, 5)
  // Hinten angehängt – an Position 4, nicht an der gewünschten 5: dort entstünde eine Lücke.
  assert.equal(plan.slot, 4)
  const after = [...applySlots(talks, plan.slots), talk('neu', plan.slot)]
  assert.deepEqual(
    after.map((entry) => `${entry.id}=${entry.slot}`),
    ['a=1', 'b=2', 'c=3', 'neu=4'],
  )
})

test('Verschieben unter «Ansprachen» nimmt offene Plätze mit', () => {
  const talks = [talk('a', 1), talk('c', 3)]
  // c an den offenen Platz 2 vorziehen – der offene Platz rutscht nach hinten.
  const moved = applySlots(talks, planTalkMove(talks, 3, 3, -1))
  assert.deepEqual(rows(moved, 3), ['1:a', '2:c', '3:·'])
  // Am Rand gibt es nichts zu verschieben.
  assert.deepEqual(planTalkMove(talks, 3, 1, -1), [])
})

test('Verschieben bei doppelt belegten Nummern tauscht genau die beiden Zeilen', () => {
  const talks = [entered('a', 1, 1), entered('b', 1, 2), entered('c', 2, 3)]
  const moved = applySlots(talks, planTalkMove(talks, 2, 3, -1))
  assert.deepEqual(rows(moved, 2), ['1:a', '2:c', '3:b'])
  assert.deepEqual(
    moved.map((entry) => `${entry.id}=${entry.slot}`),
    ['a=1', 'b=3', 'c=2'],
    'Danach steht jede Ansprache auf ihrer eigenen Nummer.',
  )
})

test('ein leerer Platz lässt sich streichen – die Folgenden rücken auf', () => {
  // «Leeren Platz hinzufügen» an einem vollen Sonntag – und wieder weg.
  const talks = [talk('a', 1), talk('b', 2)]
  const planned = plannedAfterAdding(talks, 2)
  assert.equal(planned, 3)
  assert.deepEqual(rows(talks, planned), ['1:a', '2:b', '3:·'])

  const removed = planRemoveOpenPosition(talks, planned, 3)
  assert.deepEqual(removed, { planned: 2, slots: [] })

  // Ein offener Platz in der Mitte: wer dahinter steht, rückt auf.
  const middle = planRemoveOpenPosition([talk('a', 1), talk('c', 3)], 3, 2)
  assert.deepEqual(middle, { planned: 2, slots: [{ id: 'c', slot: 2 }] })

  // Ein vergebener Platz wird so nicht gestrichen.
  assert.equal(planRemoveOpenPosition(talks, 3, 1), null)
})

test('ein leerer Platz kommt hinter die Zusatzpunkte, nicht davor', () => {
  // Drei Eingetragene bei zwei vorgesehenen Plätzen: «+1» hiesse sonst drei,
  // und zu sehen wäre gar kein freier Platz.
  const talks = [talk('a', 1), talk('b', 2), talk('c', 3)]
  const planned = plannedAfterAdding(talks, 2)
  assert.equal(planned, 4)
  assert.deepEqual(rows(talks, planned), ['1:a', '2:b', '3:c', '4:·'])
})

test('nach dem Bereinigen ergibt sich dieselbe Folge noch einmal', () => {
  const talks = [entered('a', 2, 1), entered('b', 2, 2), entered('c', 7, 3), entered('d', 1, 4)]
  const once = applySlots(talks, planTalkMove(talks, 3, 1, 0))
  const twice = applySlots(once, planTalkMove(once, 3, 1, 0))
  assert.deepEqual(rows(once, 3), rows(talks, 3))
  assert.deepEqual(rows(twice, 3), rows(once, 3))
})

/* ------------------------------------------------------------------ */
/* Besetzte Plätze zählen als vorgesehen                               */
/* ------------------------------------------------------------------ */

const placeholderAt = (id: string, slot: number): Talk => ({
  ...talk(id, slot),
  memberId: '',
  memberName: '',
})

test('ein besetzter Platz über dem Standard zählt wie jeder andere', () => {
  // Zwei vorgesehen, vier eingetragen – der vierte sagt ab und wird zum Platzhalter.
  const talks = [talk('a', 1), talk('b', 2), talk('c', 3), placeholderAt('d', 4)]
  const positions = talkPositions(talks, 2)
  assert.equal(positions.length, 4, 'Der Sonntag hat vier Plätze, nicht zwei.')
  assert.equal(
    countOpenPositions(positions),
    1,
    'Der abgesagte vierte Platz ist offen – kein freiwilliger Zusatz, nach dem niemand fragt.',
  )
})

test('Entfernen lässt den Platz offen – auch über dem Standard', () => {
  const talks = [talk('a', 1), talk('b', 2), talk('c', 3), talk('d', 4)]
  // c steht auf Platz 3, bei zwei vorgesehenen: Die Anzahl wird mitgezogen.
  const plan = planTalkRemoval(talks, 2, 'c')
  assert.ok(plan)
  assert.equal(plan.planned, 4)
  const after = applySlots(
    talks.filter((entry) => entry.id !== 'c'),
    plan.slots,
  )
  assert.deepEqual(rows(after, plan.planned), ['1:a', '2:b', '3:·', '4:d'])

  // Innerhalb der vorgesehenen Plätze ändert sich an der Anzahl nichts.
  assert.deepEqual(planTalkRemoval(talks, 4, 'a'), { planned: 4, slots: [] })
  // Was nicht dasteht, wird nicht entfernt.
  assert.equal(planTalkRemoval(talks, 4, 'x'), null)
})

test('unter «Leitung» verschwindet ein Platzhalter mitsamt seinem Platz', () => {
  const talks = [talk('a', 1), placeholderAt('p', 2), talk('c', 3)]
  const plan = planTalkRemoval(talks, 3, 'p', false)
  assert.deepEqual(plan, { planned: 2, slots: [{ id: 'c', slot: 2 }] })
  const after = applySlots(
    talks.filter((entry) => entry.id !== 'p'),
    plan?.slots ?? [],
  )
  assert.deepEqual(rows(after, 2), ['1:a', '2:c'])
})

test('ein offener Platz lässt sich auch dann streichen, wenn mehr besetzt als vorgesehen sind', () => {
  // Zwei vorgesehen, drei eingetragen, dazu ein leerer Platz: Gestrichen
  // bleiben drei – nicht einer, weil von den vorgesehenen zwei abgezogen würde.
  const talks = [talk('a', 1), talk('b', 2), talk('c', 3)]
  const planned = plannedAfterAdding(talks, 2)
  assert.deepEqual(planRemoveOpenPosition(talks, planned, 4), { planned: 3, slots: [] })
})

test('der Status geht einen Schritt weiter – nach der Zusage wieder von vorne', () => {
  assert.equal(nextTalkStatus('planned'), 'asked')
  assert.equal(nextTalkStatus('asked'), 'confirmed')
  assert.equal(nextTalkStatus('confirmed'), 'planned')
})
