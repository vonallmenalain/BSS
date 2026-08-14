import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  computeStreak,
  formatWeekRange,
  impulseAnswerId,
  impulseWeekKey,
  impulseWeekMilestones,
  itemsForWeek,
  monthOfWeek,
  participatedWeeks,
  planDifficultyCleanup,
  readyProblems,
  stripDifficultyTag,
  upcomingWeekKeys,
  seededShuffle,
  visibleImpulseItems,
  weekDays,
  weekEnd,
  weekKeyOffset,
  weekParticipants,
  weekStart,
} from '../src/lib/impulse.ts'
import type { ImpulseItem, ImpulseProgress, ImpulseQuiz } from '../src/lib/types.ts'

/*
 * Die Wochenrechnung des Bereichs «Impuls».
 *
 * Die heiklen Stellen sind die Jahresgrenzen: Die ISO-Woche 1 kann im alten
 * Jahr beginnen, und ein Jahr kann 52 oder 53 Wochen haben. 2026 beginnt an
 * einem Donnerstag und hat deshalb 53 – die Testfälle unten stehen genau an
 * diesen Kanten.
 */

function item(over: Partial<ImpulseItem>): ImpulseItem {
  return { id: 'x', week: null, kind: 'impuls', status: 'draft', title: 'Titel', ...over }
}

const QUIZ: ImpulseQuiz = {
  form: 'choice',
  options: ['1 Nephi', 'Alma', 'Ether'],
  answerIndex: 1,
  answerText: '',
  explanation: 'Alma 53 und 56 erzählen von den 2000 jungen Kriegern.',
}

test('impulseWeekKey: gewöhnliche Woche mitten im Jahr', () => {
  assert.equal(impulseWeekKey(new Date(2026, 7, 12)), '2026-W33')
})

test('impulseWeekKey: die Woche 1 beginnt im alten Jahr', () => {
  // Montag, 29. Dezember 2025, gehört bereits zur Woche 1 des Jahres 2026.
  assert.equal(impulseWeekKey(new Date(2025, 11, 29)), '2026-W01')
})

test('impulseWeekKey: die Woche 53 reicht ins neue Jahr hinein', () => {
  assert.equal(impulseWeekKey(new Date(2026, 11, 31)), '2026-W53')
  assert.equal(impulseWeekKey(new Date(2027, 0, 1)), '2026-W53')
  assert.equal(impulseWeekKey(new Date(2027, 0, 4)), '2027-W01')
})

test('weekStart und weekEnd: Montag bis Sonntag', () => {
  assert.deepEqual(weekStart('2026-W33'), new Date(2026, 7, 10))
  assert.deepEqual(weekEnd('2026-W33'), new Date(2026, 7, 16))
  // Die Woche 1 beginnt im Dezember des Vorjahrs.
  assert.deepEqual(weekStart('2026-W01'), new Date(2025, 11, 29))
})

test('weekStart: unbrauchbare Schlüssel geben null', () => {
  assert.equal(weekStart('quatsch'), null)
  assert.equal(weekStart('2026-33'), null)
  assert.equal(weekStart('2026-W99'), null)
})

test('Schlüssel und Montag bilden einen Kreis', () => {
  for (const key of ['2025-W52', '2026-W01', '2026-W33', '2026-W53', '2027-W01']) {
    const start = weekStart(key)
    assert.ok(start, key)
    assert.equal(impulseWeekKey(start), key)
  }
})

test('weekKeyOffset: über die Jahresgrenze in beide Richtungen', () => {
  // 2025 hat 52 Wochen, 2026 hat 53.
  assert.equal(weekKeyOffset('2026-W01', -1), '2025-W52')
  assert.equal(weekKeyOffset('2026-W52', 1), '2026-W53')
  assert.equal(weekKeyOffset('2026-W53', 1), '2027-W01')
  assert.equal(weekKeyOffset('2026-W33', 0), '2026-W33')
})

test('upcomingWeekKeys: die laufende Woche zuerst', () => {
  assert.deepEqual(upcomingWeekKeys(new Date(2026, 7, 12), 3), ['2026-W33', '2026-W34', '2026-W35'])
})

test('formatWeekRange: innerhalb des Monats, über Monats- und Jahresgrenzen', () => {
  assert.equal(formatWeekRange('2026-W33'), '10.–16. August 2026')
  assert.equal(formatWeekRange('2026-W36'), '31. August – 6. September 2026')
  assert.equal(formatWeekRange('2026-W01'), '29. Dezember 2025 – 4. Januar 2026')
  // Ein unbrauchbarer Schlüssel bleibt stehen, statt einen leeren Kopf zu geben.
  assert.equal(formatWeekRange('quatsch'), 'quatsch')
})

test('visibleImpulseItems: bereit, geplant und die Woche hat begonnen', () => {
  const items = [
    item({ id: 'aktuell', week: '2026-W33', status: 'ready' }),
    item({ id: 'vergangen', week: '2026-W30', status: 'ready' }),
    item({ id: 'zukunft', week: '2026-W40', status: 'ready' }),
    item({ id: 'entwurf', week: '2026-W33', status: 'draft' }),
    item({ id: 'pool', week: null, status: 'ready' }),
  ]
  assert.deepEqual(
    visibleImpulseItems(items, '2026-W33').map((entry) => entry.id),
    ['aktuell', 'vergangen'],
  )
})

test('itemsForWeek: Impuls, Ziel, Tages-Challenge, Quiz, Rätsel, Teilen – in dieser Folge', () => {
  const items = [
    item({ id: 'teilen', week: '2026-W33', kind: 'teilen' }),
    item({ id: 'raetsel', week: '2026-W33', kind: 'bilderraetsel' }),
    item({ id: 'challenge', week: '2026-W33', kind: 'tageschallenge' }),
    item({ id: 'quiz', week: '2026-W33', kind: 'quiz' }),
    item({ id: 'ziel', week: '2026-W33', kind: 'wochenziel' }),
    item({ id: 'impuls', week: '2026-W33', kind: 'impuls' }),
    item({ id: 'andere-woche', week: '2026-W34', kind: 'impuls' }),
  ]
  assert.deepEqual(
    itemsForWeek(items, '2026-W33').map((entry) => entry.id),
    ['impuls', 'ziel', 'challenge', 'quiz', 'raetsel', 'teilen'],
  )
})

test('impulseAnswerId: Frage und Konto, mehr nicht', () => {
  assert.equal(impulseAnswerId('frage-1', 'uid-7'), 'frage-1_uid-7')
})

test('readyProblems: ein vollständiger Inhalt hat keine', () => {
  assert.deepEqual(
    readyProblems(item({ kind: 'quiz', quiz: QUIZ, source: { label: 'Alma 53', url: '' } })),
    [],
  )
  assert.deepEqual(
    readyProblems(item({ kind: 'impuls', source: { label: '1 Nephi 3:7', url: '' } })),
    [],
  )
})

test('readyProblems: die Quelle ist Pflicht – bei Impuls und Quiz', () => {
  assert.deepEqual(readyProblems(item({ kind: 'impuls' })), ['Die Quelle fehlt.'])
  assert.deepEqual(readyProblems(item({ kind: 'impuls', source: { label: '  ', url: '' } })), [
    'Die Quelle fehlt.',
  ])
})

test('readyProblems: Aufgaben brauchen keine Fundstelle', () => {
  // «Bete jeden Abend» hat keine – das darf trotzdem «bereit» sein.
  assert.deepEqual(readyProblems(item({ kind: 'wochenziel' })), [])
  assert.deepEqual(readyProblems(item({ kind: 'tageschallenge' })), [])
  // Ohne Aufgabe geht es trotzdem nicht.
  assert.deepEqual(readyProblems(item({ kind: 'wochenziel', title: ' ' })), ['Der Titel fehlt.'])
})

test('readyProblems: eine Auswahlfrage braucht Antworten und die Markierung', () => {
  const source = { label: 'Alma 53', url: '' }
  assert.deepEqual(
    readyProblems(
      item({ kind: 'quiz', source, quiz: { ...QUIZ, options: ['Alma', ''], answerIndex: 0 } }),
    ),
    ['Es braucht mindestens zwei Antworten.'],
  )
  assert.deepEqual(
    readyProblems(item({ kind: 'quiz', source, quiz: { ...QUIZ, answerIndex: 5 } })),
    ['Die richtige Antwort ist nicht markiert.'],
  )
})

test('readyProblems: eine Suchfrage braucht die Lösung', () => {
  const source = { label: 'Generalkonferenz Okt. 2025', url: 'https://example.org' }
  assert.deepEqual(
    readyProblems(
      item({
        kind: 'quiz',
        source,
        quiz: { form: 'text', options: [], answerIndex: 0, answerText: '', explanation: '' },
      }),
    ),
    ['Die Lösung fehlt.'],
  )
})

test('readyProblems: das Bilderrätsel braucht Bild und Auflösung, aber keine Quelle', () => {
  const image = { url: 'https://www.churchofjesuschrist.org/media/bild.jpg' }
  assert.deepEqual(readyProblems(item({ kind: 'bilderraetsel', quiz: QUIZ, image })), [])
  assert.deepEqual(readyProblems(item({ kind: 'bilderraetsel', quiz: QUIZ })), [
    'Das Bild fehlt.',
  ])
  assert.deepEqual(
    readyProblems(item({ kind: 'bilderraetsel', quiz: QUIZ, image: { url: '  ' } })),
    ['Das Bild fehlt.'],
  )
  assert.deepEqual(
    readyProblems(item({ kind: 'bilderraetsel', image, quiz: { ...QUIZ, answerIndex: 5 } })),
    ['Die richtige Antwort ist nicht markiert.'],
  )
})

test('readyProblems: die Teilen-Aufgabe braucht nur ihre Aufgabe', () => {
  assert.deepEqual(readyProblems(item({ kind: 'teilen' })), [])
  assert.deepEqual(readyProblems(item({ kind: 'teilen', title: ' ' })), ['Der Titel fehlt.'])
})

test('readyProblems: ohne Titel keine Veröffentlichung', () => {
  assert.deepEqual(readyProblems(item({ title: '  ', source: { label: 'Alma 32', url: '' } })), [
    'Der Titel fehlt.',
  ])
})

/* ------------------------------------------------------------------ */
/* Beteiligung, Serie und Abzeichen                                    */
/* ------------------------------------------------------------------ */

test('weekDays: Montag bis Sonntag als ISO-Daten', () => {
  assert.deepEqual(weekDays('2026-W33'), [
    '2026-08-10',
    '2026-08-11',
    '2026-08-12',
    '2026-08-13',
    '2026-08-14',
    '2026-08-15',
    '2026-08-16',
  ])
  assert.deepEqual(weekDays('quatsch'), [])
})

test('monthOfWeek: der Monat, in dem die Woche beginnt', () => {
  assert.equal(monthOfWeek('2026-W33'), '2026-08')
  // Die Woche 1 des Jahres 2026 beginnt noch im Dezember 2025.
  assert.equal(monthOfWeek('2026-W01'), '2025-12')
  assert.equal(monthOfWeek('quatsch'), null)
})

test('participatedWeeks: Ziel, Tage, Feed oder Antwort – jedes davon zählt', () => {
  const weekOfItem = (itemId: string) => (itemId === 'frage-33' ? '2026-W33' : null)
  const participated = participatedWeeks(
    {
      weeks: {
        '2026-W28': { share: true },
        '2026-W29': { feed: true },
        '2026-W30': { goal: true },
        '2026-W31': { days: ['2026-07-28'] },
        '2026-W32': { goal: false, days: [], feed: false, share: false },
      },
    },
    [{ itemId: 'frage-33' }, { itemId: 'geloescht' }],
    weekOfItem,
  )
  assert.deepEqual(
    [...participated].sort(),
    ['2026-W28', '2026-W29', '2026-W30', '2026-W31', '2026-W33'],
  )
})

test('itemsForWeek: Feed-Karten am Ende, in der Reihenfolge der Redaktion', () => {
  const items = [
    item({ id: 'feed-b', week: '2026-W33', kind: 'feed', order: 2 }),
    item({ id: 'impuls', week: '2026-W33', kind: 'impuls' }),
    item({ id: 'feed-a', week: '2026-W33', kind: 'feed', order: 1 }),
    item({ id: 'feed-ohne', week: '2026-W33', kind: 'feed' }),
  ]
  assert.deepEqual(
    itemsForWeek(items, '2026-W33').map((entry) => entry.id),
    ['impuls', 'feed-a', 'feed-b', 'feed-ohne'],
  )
})

test('computeStreak: Wochen in Folge, die laufende zählt sofort mit', () => {
  assert.deepEqual(computeStreak(new Set(), '2026-W33'), { current: 0, best: 0 })
  assert.deepEqual(
    computeStreak(new Set(['2026-W30', '2026-W31', '2026-W32', '2026-W33']), '2026-W33'),
    { current: 4, best: 4 },
  )
})

test('computeStreak: die laufende Woche ist neutral, solange sie offen ist', () => {
  // Montagmorgen: W33 hat begonnen, noch nichts abgehakt – die Serie hält.
  assert.deepEqual(computeStreak(new Set(['2026-W31', '2026-W32']), '2026-W33'), {
    current: 2,
    best: 2,
  })
})

test('computeStreak: eine verpasste Woche reisst die Serie – ohne Jokerwoche', () => {
  // W32 verpasst: Die Serie beginnt mit W33 neu, die alte bleibt die beste.
  assert.deepEqual(computeStreak(new Set(['2026-W30', '2026-W31', '2026-W33']), '2026-W33'), {
    current: 1,
    best: 2,
  })
})

test('computeStreak: die beste Serie überlebt den Riss', () => {
  const participated = new Set([
    '2026-W20',
    '2026-W21',
    '2026-W22',
    '2026-W23',
    '2026-W24',
    '2026-W25',
    '2026-W32',
    '2026-W33',
  ])
  assert.deepEqual(computeStreak(participated, '2026-W33'), { current: 2, best: 6 })
})

test('impulseWeekMilestones: vier Ziele, jede Woche neu offen', () => {
  const open = impulseWeekMilestones({
    seen: false,
    answeredQuestion: false,
    challengeDays: 0,
    cardsSeen: 0,
    cardsTotal: 12,
    deepeningsSeen: 0,
    deepeningsTotal: 4,
  })
  assert.deepEqual(
    open.map((milestone) => milestone.id),
    ['dabei', 'mitgeredet', 'challenge', 'scroller'],
  )
  assert.ok(open.every((milestone) => !milestone.earned))

  const done = impulseWeekMilestones({
    seen: true,
    answeredQuestion: true,
    challengeDays: 7,
    cardsSeen: 12,
    cardsTotal: 12,
    deepeningsSeen: 4,
    deepeningsTotal: 4,
  })
  assert.ok(done.every((milestone) => milestone.earned))
})

test('impulseWeekMilestones: die Tageschallenge zählt ihre Haken – höchstens sieben', () => {
  const three = impulseWeekMilestones({
    seen: true,
    answeredQuestion: false,
    challengeDays: 3,
    cardsSeen: 0,
    cardsTotal: 0,
    deepeningsSeen: 0,
    deepeningsTotal: 0,
  }).find((milestone) => milestone.id === 'challenge')
  assert.equal(three?.earned, false)
  assert.deepEqual(three?.progress, { value: 3, max: 7 })

  const nine = impulseWeekMilestones({
    seen: true,
    answeredQuestion: false,
    challengeDays: 9,
    cardsSeen: 0,
    cardsTotal: 0,
    deepeningsSeen: 0,
    deepeningsTotal: 0,
  }).find((milestone) => milestone.id === 'challenge')
  assert.equal(nine?.earned, true)
  assert.deepEqual(nine?.progress, { value: 7, max: 7 })
})

test('impulseWeekMilestones: der Scroller braucht alle Karten und alle Vertiefungen', () => {
  const almost = impulseWeekMilestones({
    seen: true,
    answeredQuestion: true,
    challengeDays: 0,
    cardsSeen: 12,
    cardsTotal: 12,
    deepeningsSeen: 3,
    deepeningsTotal: 4,
  }).find((milestone) => milestone.id === 'scroller')
  assert.equal(almost?.earned, false)
  assert.deepEqual(almost?.progress, { value: 15, max: 16 })

  // Eine Woche ohne Karten kennt keinen Scroller – erreicht ist sie nie.
  const empty = impulseWeekMilestones({
    seen: true,
    answeredQuestion: true,
    challengeDays: 0,
    cardsSeen: 0,
    cardsTotal: 0,
    deepeningsSeen: 0,
    deepeningsTotal: 0,
  }).find((milestone) => milestone.id === 'scroller')
  assert.equal(empty?.earned, false)
  assert.deepEqual(empty?.progress, { value: 0, max: 0 })
})

test('weekParticipants: Vornamen aus Fortschritt und Antworten, ohne Doppelte', () => {
  const progress: ImpulseProgress[] = [
    { id: 'a', uid: 'a', firstName: 'Levin', weeks: { '2026-W33': { goal: true } } },
    { id: 'b', uid: 'b', firstName: 'Dario', weeks: { '2026-W33': { days: ['2026-08-11'] } } },
    { id: 'c', uid: 'c', firstName: 'Nico', weeks: { '2026-W32': { goal: true } } },
  ]
  const answers = [
    { id: 'f_a', itemId: 'frage-33', uid: 'a', firstName: 'Levin', correct: true },
    { id: 'f_d', itemId: 'frage-33', uid: 'd', firstName: 'Elias', correct: null },
  ]
  const participants = weekParticipants(
    progress,
    answers,
    (itemId) => (itemId === 'frage-33' ? '2026-W33' : null),
    '2026-W33',
  )
  assert.deepEqual(
    participants.map((person) => person.firstName),
    ['Dario', 'Elias', 'Levin'],
  )
})

/*
 * Das Kartenmischen der Zufalls-Reihenfolge: gleicher Schlüssel, gleiche
 * Ordnung – der Stapel liegt die ganze Woche über gleich, und der Sprung
 * aus dem Menü trifft seine Karte.
 */
test('seededShuffle: gleicher Schlüssel ergibt dieselbe Ordnung', () => {
  const list = ['a', 'b', 'c', 'd', 'e', 'f']
  assert.deepEqual(seededShuffle(list, 'uid:2026-W33'), seededShuffle(list, 'uid:2026-W33'))
})

test('seededShuffle: mischt eine Permutation, ohne das Original zu ändern', () => {
  const list = ['a', 'b', 'c', 'd', 'e', 'f']
  const shuffled = seededShuffle(list, 'uid:2026-W33')
  assert.deepEqual([...shuffled].sort(), [...list].sort())
  assert.deepEqual(list, ['a', 'b', 'c', 'd', 'e', 'f'])
})

test('seededShuffle: ein anderer Schlüssel mischt anders', () => {
  const list = Array.from({ length: 12 }, (_, i) => i)
  const a = seededShuffle(list, 'uid:2026-W33')
  const b = seededShuffle(list, 'uid:2026-W34')
  // Bei zwölf Karten wäre eine zufällig identische Ordnung ein Wunder –
  // und ein deterministisches: Der Test bleibt stabil.
  assert.notDeepEqual(a, b)
})

test('stripDifficultyTag: nimmt die Ansage weg und schreibt gross weiter', () => {
  assert.equal(
    stripDifficultyTag('Zum Aufwärmen: ein Boot, hohe Wellen – und einer, der ruhig bleibt.'),
    'Ein Boot, hohe Wellen – und einer, der ruhig bleibt.',
  )
  assert.equal(
    stripDifficultyTag('Schon schwieriger: Der Engel auf dem Bild heisst Moroni.'),
    'Der Engel auf dem Bild heisst Moroni.',
  )
  assert.equal(
    stripDifficultyTag('Für Profis: Die Antwort ist ein einziges Wort.'),
    'Die Antwort ist ein einziges Wort.',
  )
  // Auch mit Gedankenstrich statt Doppelpunkt.
  assert.equal(
    stripDifficultyTag('Zum Aufwärmen – für viele ist er der Tempel der Heimat.'),
    'Für viele ist er der Tempel der Heimat.',
  )
  // Steht nur die Ansage da, bleibt schlicht nichts – die Frage genügt.
  assert.equal(stripDifficultyTag('Für Profis:'), '')
  assert.equal(stripDifficultyTag('Zum Aufwärmen'), '')
})

test('stripDifficultyTag: lässt gewöhnliche Hinweise in Ruhe', () => {
  for (const text of [
    'Die Familie war bereits in der Wildnis.',
    // Ohne Doppelpunkt oder Gedankenstrich ist es keine Ansage, sondern Satzanfang.
    'Schon schwieriger wird es beim zweiten Vers.',
    'Ein Hinweis, wo sich das Suchen lohnt.',
    '',
  ]) {
    assert.equal(stripDifficultyTag(text), text)
  }
})

test('planDifficultyCleanup: findet nur Inhalte mit Ansage', () => {
  const updates = planDifficultyCleanup([
    { id: 'a', body: 'Für Profis: Alle drei stehen im selben Vers.' },
    { id: 'b', body: 'Ein Hinweis ohne Ansage.' },
    { id: 'c', body: undefined },
    { id: 'd', body: 'schon schwieriger: klein geschrieben zählt auch.' },
  ])
  assert.deepEqual(updates, [
    { id: 'a', body: 'Alle drei stehen im selben Vers.' },
    { id: 'd', body: 'Klein geschrieben zählt auch.' },
  ])
})
