import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  formatWeekRange,
  impulseAnswerId,
  impulseWeekKey,
  itemsForWeek,
  readyProblems,
  upcomingWeekKeys,
  visibleImpulseItems,
  weekEnd,
  weekKeyOffset,
  weekStart,
} from '../src/lib/impulse.ts'
import type { ImpulseItem, ImpulseQuiz } from '../src/lib/types.ts'

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
  assert.deepEqual(upcomingWeekKeys(new Date(2026, 7, 12), 3), [
    '2026-W33',
    '2026-W34',
    '2026-W35',
  ])
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

test('itemsForWeek: der Impuls steht vor der Quizfrage', () => {
  const items = [
    item({ id: 'frage', week: '2026-W33', kind: 'quiz' }),
    item({ id: 'impuls', week: '2026-W33', kind: 'impuls' }),
    item({ id: 'andere-woche', week: '2026-W34', kind: 'impuls' }),
  ]
  assert.deepEqual(
    itemsForWeek(items, '2026-W33').map((entry) => entry.id),
    ['impuls', 'frage'],
  )
})

test('impulseAnswerId: Frage und Konto, mehr nicht', () => {
  assert.equal(impulseAnswerId('frage-1', 'uid-7'), 'frage-1_uid-7')
})

test('readyProblems: ein vollständiger Inhalt hat keine', () => {
  assert.deepEqual(
    readyProblems(
      item({ kind: 'quiz', quiz: QUIZ, source: { label: 'Alma 53', url: '' } }),
    ),
    [],
  )
  assert.deepEqual(
    readyProblems(item({ kind: 'impuls', source: { label: '1 Nephi 3:7', url: '' } })),
    [],
  )
})

test('readyProblems: die Quelle ist Pflicht', () => {
  assert.deepEqual(readyProblems(item({ kind: 'impuls' })), ['Die Quelle fehlt.'])
  assert.deepEqual(readyProblems(item({ kind: 'impuls', source: { label: '  ', url: '' } })), [
    'Die Quelle fehlt.',
  ])
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

test('readyProblems: ohne Titel keine Veröffentlichung', () => {
  assert.deepEqual(
    readyProblems(item({ title: '  ', source: { label: 'Alma 32', url: '' } })),
    ['Der Titel fehlt.'],
  )
})
