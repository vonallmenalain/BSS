import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  crestCompleters,
  crestComplete,
  daysUntilSunday,
  deckOrder,
  impulseCrestStars,
  impulseCrestSteps,
  isFeedCardKind,
  nextImpulseOrder,
  pollResults,
  puzzlePieces,
  puzzleSolution,
  puzzleSolved,
  readyProblems,
  shuffledPuzzlePieces,
} from '../src/lib/impulse.ts'
import { defaultCrest, revealedCells } from '../src/lib/impulseCrest.ts'
import type { ImpulseItem, ImpulsePoll, ImpulseProgress } from '../src/lib/types.ts'

/*
 * Die Bausteine des Neustarts: die Reihenfolge des Feeds über alle Arten
 * hinweg, die Umfrage mit ihrem Ergebnis, das Vers-Puzzle – und das
 * Wochen-Wappen, das sich mit jeder geschafften Karte aufbaut.
 */

function item(over: Partial<ImpulseItem>): ImpulseItem {
  return { id: 'x', week: '2026-W41', kind: 'feed', status: 'ready', title: 'Titel', ...over }
}

const CHOICE: ImpulsePoll = {
  form: 'choice',
  options: ['A', 'B', 'C'],
  min: 1,
  max: 10,
  minLabel: '',
  maxLabel: '',
  unit: '',
  explanation: '',
}

const SCALE: ImpulsePoll = {
  ...CHOICE,
  form: 'scale',
  options: [],
  min: 1,
  max: 5,
  minLabel: 'wenig',
  maxLabel: 'viel',
}

/* ------------------------------------------------------------------ */
/* Reihenfolge                                                         */
/* ------------------------------------------------------------------ */

test('deckOrder: Wochenthema vorn, Teilen hinten, dazwischen der Platz über alle Arten', () => {
  const items = [
    item({ id: 'teilen', kind: 'teilen', order: 1 }),
    item({ id: 'feed', kind: 'feed', order: 3 }),
    item({ id: 'umfrage', kind: 'umfrage', order: 1 }),
    item({ id: 'ohne', kind: 'quiz' }),
    item({ id: 'quiz', kind: 'quiz', order: 2 }),
    item({ id: 'thema', kind: 'impuls', order: 9 }),
  ]
  assert.deepEqual(
    deckOrder(items).map((entry) => entry.id),
    ['thema', 'umfrage', 'quiz', 'feed', 'ohne', 'teilen'],
  )
})

test('deckOrder: bei gleichem Platz entscheidet die Ordnung der Arten', () => {
  const items = [
    item({ id: 'feed', kind: 'feed', order: 1 }),
    item({ id: 'quiz', kind: 'quiz', order: 1 }),
    item({ id: 'umfrage', kind: 'umfrage', order: 1 }),
  ]
  assert.deepEqual(
    deckOrder(items).map((entry) => entry.id),
    ['umfrage', 'quiz', 'feed'],
  )
})

test('nextImpulseOrder: Feed-Karten teilen sich eine Reihe über alle Arten', () => {
  const items = [
    item({ kind: 'umfrage', order: 1 }),
    item({ kind: 'feed', order: 2 }),
    item({ kind: 'quiz', order: 5 }),
    item({ kind: 'wochenziel', order: 40 }),
    item({ kind: 'feed', order: 9, week: '2026-W42' }),
  ]
  assert.equal(nextImpulseOrder(items, '2026-W41', 'puzzle'), 6)
  assert.equal(nextImpulseOrder(items, '2026-W41', 'feed'), 6)
  // Die Aufgaben zählen für sich.
  assert.equal(nextImpulseOrder(items, '2026-W41', 'tageschallenge'), 1)
  assert.equal(nextImpulseOrder([], '2026-W41', 'feed'), 1)
})

test('isFeedCardKind: nur Wochenziel und Tages-Challenge sind Kacheln', () => {
  assert.equal(isFeedCardKind('wochenziel'), false)
  assert.equal(isFeedCardKind('tageschallenge'), false)
  for (const kind of ['impuls', 'umfrage', 'quiz', 'puzzle', 'frage', 'feed', 'teilen'] as const) {
    assert.equal(isFeedCardKind(kind), true, kind)
  }
})

/* ------------------------------------------------------------------ */
/* Bereit?                                                             */
/* ------------------------------------------------------------------ */

test('readyProblems: die Umfrage braucht Möglichkeiten oder eine brauchbare Skala – keine Quelle', () => {
  assert.deepEqual(readyProblems(item({ kind: 'umfrage', poll: CHOICE })), [])
  assert.deepEqual(readyProblems(item({ kind: 'umfrage', poll: SCALE })), [])
  assert.deepEqual(readyProblems(item({ kind: 'umfrage' })), ['Die Umfrage fehlt.'])
  assert.deepEqual(readyProblems(item({ kind: 'umfrage', poll: { ...CHOICE, options: ['A'] } })), [
    'Es braucht mindestens zwei Möglichkeiten.',
  ])
  assert.deepEqual(
    readyProblems(item({ kind: 'umfrage', poll: { ...CHOICE, options: ['A', ' ', 'C'] } })),
    ['Eine Möglichkeit ist noch leer.'],
  )
  assert.equal(
    readyProblems(item({ kind: 'umfrage', poll: { ...SCALE, min: 5, max: 5 } })).length,
    1,
  )
  assert.equal(
    readyProblems(item({ kind: 'umfrage', poll: { ...SCALE, min: 0, max: 50 } })).length,
    1,
  )
  assert.deepEqual(readyProblems(item({ kind: 'umfrage', title: ' ', poll: CHOICE })), [
    'Die Frage fehlt.',
  ])
})

test('readyProblems: das Vers-Puzzle braucht drei Teile und seine Fundstelle', () => {
  const source = { label: 'Alma 53:20', url: '' }
  assert.deepEqual(
    readyProblems(
      item({
        kind: 'puzzle',
        source,
        puzzle: { text: 'treu / zu allen / Zeiten', explanation: '' },
      }),
    ),
    [],
  )
  assert.deepEqual(
    readyProblems(item({ kind: 'puzzle', puzzle: { text: 'a b c', explanation: '' } })),
    ['Die Quelle fehlt.'],
  )
  assert.deepEqual(
    readyProblems(item({ kind: 'puzzle', source, puzzle: { text: 'a / b', explanation: '' } })),
    ['Das Puzzle braucht mindestens drei Teile.'],
  )
})

/* ------------------------------------------------------------------ */
/* Umfrage                                                             */
/* ------------------------------------------------------------------ */

test('pollResults: Anteile je Möglichkeit, fremde Werte fallen heraus', () => {
  const result = pollResults(CHOICE, [
    { choiceIndex: 0 },
    { choiceIndex: 0 },
    { choiceIndex: 2 },
    { choiceIndex: 7 },
    { choiceIndex: null },
  ])
  assert.equal(result.total, 3)
  assert.deepEqual(
    result.bars.map((bar) => [bar.label, bar.count]),
    [
      ['A', 2],
      ['B', 0],
      ['C', 1],
    ],
  )
  assert.equal(result.bars[0].share, 2 / 3)
  assert.equal(result.average, null)
})

test('pollResults: die Skala zeigt jede Stufe und den Schnitt auf eine Stelle', () => {
  const result = pollResults(SCALE, [{ choiceIndex: 2 }, { choiceIndex: 3 }, { choiceIndex: 5 }])
  assert.deepEqual(
    result.bars.map((bar) => bar.value),
    [1, 2, 3, 4, 5],
  )
  assert.deepEqual(
    result.bars.map((bar) => bar.count),
    [0, 1, 1, 0, 1],
  )
  assert.equal(result.average, 3.3)
  assert.equal(pollResults(SCALE, []).average, null)
  assert.equal(pollResults(SCALE, []).total, 0)
})

/* ------------------------------------------------------------------ */
/* Vers-Puzzle                                                         */
/* ------------------------------------------------------------------ */

test('puzzlePieces: Teile mit « / » – oder Wort für Wort', () => {
  assert.deepEqual(puzzlePieces('die Worte / von  Christus /  werden euch '), [
    'die Worte',
    'von Christus',
    'werden euch',
  ])
  assert.deepEqual(puzzlePieces('Zeile um Zeile'), ['Zeile', 'um', 'Zeile'])
  assert.deepEqual(puzzlePieces('  '), [])
  assert.equal(puzzleSolution('die Worte / von Christus'), 'die Worte von Christus')
})

test('puzzleSolved: es zählt der Satz – Satzzeichen und gleiche Wörter sind egal', () => {
  const text = 'Zeile / um / Zeile, / hier / ein / wenig'
  assert.equal(puzzleSolved(text, 'Zeile um Zeile, hier ein wenig'), true)
  assert.equal(puzzleSolved(text, 'zeile um zeile hier ein wenig'), true)
  assert.equal(puzzleSolved(text, 'um Zeile Zeile, hier ein wenig'), false)
  assert.equal(puzzleSolved('', ''), false)
})

test('shuffledPuzzlePieces: fest gemischt – und nie schon gelöst', () => {
  const text = 'eins / zwei / drei / vier / fünf'
  const first = shuffledPuzzlePieces(text, 'karte-1')
  assert.deepEqual(first, shuffledPuzzlePieces(text, 'karte-1'))
  assert.deepEqual([...first].sort(), [...puzzlePieces(text)].sort())
  for (let seed = 0; seed < 40; seed += 1) {
    assert.notDeepEqual(shuffledPuzzlePieces('a / b', `s${seed}`), ['a', 'b'])
  }
})

/* ------------------------------------------------------------------ */
/* Das Wochen-Wappen                                                   */
/* ------------------------------------------------------------------ */

const CARDS = [
  { id: 'thema', kind: 'impuls' as const, title: 'Thema', deepening: 'mehr' },
  { id: 'umfrage', kind: 'umfrage' as const, title: 'Umfrage' },
  { id: 'feed', kind: 'feed' as const, title: 'Fakt' },
  { id: 'frage', kind: 'frage' as const, title: 'Frage' },
  { id: 'teilen', kind: 'teilen' as const, title: 'Teilen' },
]

test('impulseCrestSteps: anschauen genügt nur, wo es nichts zu tun gibt', () => {
  const steps = impulseCrestSteps({
    cards: CARDS,
    seen: new Set(['thema', 'umfrage', 'feed', 'frage', 'teilen']),
    deepened: new Set(),
    answered: new Set(),
    shared: false,
  })
  assert.deepEqual(
    steps.map((step) => [step.itemId, step.done, step.missing]),
    [
      ['thema', false, ['Vertiefung']],
      ['umfrage', false, ['abstimmen']],
      ['feed', true, []],
      ['frage', false, ['antworten']],
      ['teilen', false, ['abhaken']],
    ],
  )
  assert.equal(crestComplete(steps), false)
})

test('impulseCrestSteps: alles getan – das Wappen steht', () => {
  const steps = impulseCrestSteps({
    cards: CARDS,
    seen: new Set(['thema', 'feed']),
    deepened: new Set(['thema']),
    answered: new Set(['umfrage', 'frage']),
    shared: true,
  })
  assert.ok(steps.every((step) => step.done))
  assert.equal(crestComplete(steps), true)
  // Eine Woche ohne Karten hat kein Wappen.
  assert.equal(crestComplete([]), false)
})

test('impulseCrestStars: «Bereit für Sonntag» nur, wenn es vor dem Sonntag ganz war', () => {
  const base = { week: '2026-W41', complete: true, goal: null, challengeDays: null }
  assert.equal(impulseCrestStars({ ...base, completedOn: '2026-10-10' }).sunday, true)
  assert.equal(impulseCrestStars({ ...base, completedOn: '2026-10-11' }).sunday, false)
  assert.equal(
    impulseCrestStars({ ...base, complete: false, completedOn: '2026-10-07' }).sunday,
    false,
  )
  assert.equal(impulseCrestStars({ ...base, completedOn: null }).sunday, false)
  // Wo es keinen Stern gibt, bleibt er weg – statt unerreichbar dazustehen.
  assert.equal(impulseCrestStars({ ...base, completedOn: null }).goal, null)
  assert.equal(impulseCrestStars({ ...base, completedOn: null }).challenge, null)
  const full = impulseCrestStars({ ...base, completedOn: null, goal: true, challengeDays: 7 })
  assert.equal(full.goal, true)
  assert.equal(full.challenge, true)
  assert.equal(impulseCrestStars({ ...base, completedOn: null, challengeDays: 6 }).challenge, false)
})

test('crestCompleters: genannt wird, wer es geschafft hat – sonst niemand', () => {
  const progress = (uid: string, firstName: string, done: boolean): ImpulseProgress => ({
    id: uid,
    uid,
    firstName,
    weeks: {
      '2026-W41': {
        cards: ['thema', 'feed'],
        deepened: done ? ['thema'] : [],
        share: true,
      },
    },
  })
  const names = crestCompleters({
    week: '2026-W41',
    cards: CARDS,
    progressDocs: [
      progress('u2', 'Noah', true),
      progress('u1', 'Luca', true),
      progress('u3', 'Elias', false),
    ],
    answers: [
      { itemId: 'umfrage', uid: 'u1' },
      { itemId: 'frage', uid: 'u1' },
      { itemId: 'umfrage', uid: 'u2' },
      { itemId: 'frage', uid: 'u2' },
      { itemId: 'umfrage', uid: 'u3' },
      { itemId: 'frage', uid: 'u3' },
    ],
  })
  assert.deepEqual(
    names.map((person) => person.firstName),
    ['Luca', 'Noah'],
  )
  assert.deepEqual(
    crestCompleters({ week: '2026-W41', cards: [], progressDocs: [], answers: [] }),
    [],
  )
})

test('daysUntilSunday: 6 am Montag, 0 am Sonntag', () => {
  assert.equal(daysUntilSunday('2026-W41', new Date(2026, 9, 5, 8)), 6)
  assert.equal(daysUntilSunday('2026-W41', new Date(2026, 9, 10, 23)), 1)
  assert.equal(daysUntilSunday('2026-W41', new Date(2026, 9, 11, 12)), 0)
  assert.equal(daysUntilSunday('kaputt', new Date()), null)
})

test('revealedCells: der Anteil zählt – ganz erst mit der letzten Karte', () => {
  assert.equal(revealedCells(0, 10, 40), 0)
  assert.equal(revealedCells(1, 100, 40), 1)
  assert.equal(revealedCells(5, 10, 40), 20)
  assert.equal(revealedCells(99, 100, 40), 39)
  assert.equal(revealedCells(10, 10, 40), 40)
  assert.equal(revealedCells(3, 0, 40), 0)
})

test('defaultCrest: jede Woche ihr Wappen – dieselbe Woche immer dasselbe', () => {
  assert.deepEqual(defaultCrest('2026-W50'), defaultCrest('2026-W50'))
  const looks = new Set(
    ['2026-W48', '2026-W49', '2026-W50', '2026-W51', '2026-W52'].map((week) => {
      const crest = defaultCrest(week)
      return `${crest.symbol}/${crest.palette}`
    }),
  )
  assert.ok(looks.size >= 3, 'die Wochen sehen sich zu ähnlich')
})
