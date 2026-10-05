import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  describeImpulseReset,
  IMPULSE_RESET_PARTS,
  impulseResetPeople,
  planImpulseReset,
  type ImpulseResetPart,
  type ImpulseResetSource,
} from '../src/lib/impulseReset.ts'

/*
 * Eine Woche zurücksetzen (src/lib/impulseReset.ts): wer Spuren hat, und
 * was ein Zurücksetzen anfasst – ohne Datenbank gerechnet.
 */

const WEEK = '2026-W41'
const ALL_PARTS = new Set<ImpulseResetPart>(IMPULSE_RESET_PARTS.map((part) => part.key))

/** Zwei Personen mit Spuren in W41, eine nur in W40 – und eine, die nur geschaut hat. */
function source(): ImpulseResetSource {
  return {
    week: WEEK,
    itemIds: ['quiz', 'frage', 'spiel', 'feed'],
    progress: [
      {
        uid: 'levin',
        firstName: 'Levin',
        weeks: {
          [WEEK]: {
            cards: ['quiz', 'feed'],
            deepened: ['feed'],
            goal: true,
            days: ['2026-10-05', '2026-10-06'],
            crest: '2026-10-06',
          },
          '2026-W40': { cards: ['alt'], goal: true },
        },
        // Amen zur Karte «feed», zum Beitrag von Mia – und zu einer Karte aus W40.
        amens: ['feed', 'frage_mia', 'alt'],
        favorites: ['feed', 'alt'],
        reports: ['frage_mia'],
        lastSeenWeek: WEEK,
        firstSeenWeek: '2026-W40',
        gameName: 'Blitz',
      },
      {
        uid: 'mia',
        firstName: 'Mia',
        weeks: { [WEEK]: { cards: ['quiz'], share: true } },
        amens: ['frage_levin'],
        lastSeenWeek: WEEK,
        firstSeenWeek: WEEK,
        gameName: 'Mia',
      },
      {
        uid: 'noah',
        firstName: 'Noah',
        lastSeenWeek: WEEK,
      },
      {
        uid: 'lea',
        firstName: 'Lea',
        weeks: { '2026-W40': { goal: true } },
        lastSeenWeek: '2026-W40',
      },
    ],
    answers: [
      { id: 'quiz_levin', itemId: 'quiz', uid: 'levin', firstName: 'Levin' },
      { id: 'quiz_mia', itemId: 'quiz', uid: 'mia', firstName: '' },
      { id: 'alt_lea', itemId: 'alt', uid: 'lea', firstName: 'Lea' },
    ],
    comments: [
      { id: 'frage_levin', itemId: 'frage', uid: 'levin', firstName: 'Levin' },
      { id: 'frage_mia', itemId: 'frage', uid: 'mia', firstName: '' },
    ],
    scores: [
      { id: 'spiel_levin', itemId: 'spiel', uid: 'levin' },
      { id: 'spiel_mia', itemId: 'spiel', uid: 'mia' },
      // Mia hat auch in einer früheren Woche gespielt.
      { id: 'spiel-alt_mia', itemId: 'spiel-alt', uid: 'mia' },
    ],
  }
}

test('Spuren: wer in der Woche etwas getan hat – mit den Zahlen je Teil', () => {
  const people = impulseResetPeople(source())
  assert.deepEqual(
    people.map((person) => person.firstName),
    // Lea hat nur in W40 Spuren, Noah hat die Woche bloss geöffnet.
    ['Levin', 'Mia', 'Noah'],
  )
  const levin = people.find((person) => person.uid === 'levin')
  assert.deepEqual(levin, {
    uid: 'levin',
    firstName: 'Levin',
    cards: 2,
    ticks: 3,
    crest: true,
    progress: true,
    answers: 1,
    comments: 1,
    scores: 1,
    // Amen «feed» und «frage_mia», Gemerkt «feed», Meldung «frage_mia» – nicht «alt».
    reactions: 4,
  })
  const noah = people.find((person) => person.uid === 'noah')
  assert.equal(noah?.progress, true)
  assert.equal(noah?.cards, 0)
})

test('Spuren: Vornamen aus dem Fortschritt – auch für wer nur geantwortet hat', () => {
  const data = source()
  data.answers = [...data.answers, { id: 'quiz_ben', itemId: 'quiz', uid: 'ben', firstName: '' }]
  data.progress = [...data.progress, { uid: 'ben', firstName: 'Ben', lastSeenWeek: '2026-W39' }]
  const ben = impulseResetPeople(data).find((person) => person.uid === 'ben')
  assert.equal(ben?.firstName, 'Ben')
  assert.equal(ben?.answers, 1)
  assert.equal(ben?.progress, false)
})

test('Alles für alle: die Woche ist danach wie neu – frühere Wochen bleiben', () => {
  const plan = planImpulseReset(source(), { people: null, parts: ALL_PARTS })
  assert.deepEqual(plan.answerIds.sort(), ['quiz_levin', 'quiz_mia'])
  assert.deepEqual(plan.commentIds.sort(), ['frage_levin', 'frage_mia'])
  assert.deepEqual(plan.scoreIds.sort(), ['spiel_levin', 'spiel_mia'])
  assert.deepEqual(plan.people.sort(), ['levin', 'mia', 'noah'])

  const levin = plan.progress.find((entry) => entry.uid === 'levin')
  assert.deepEqual(levin, {
    uid: 'levin',
    week: true,
    amens: ['feed', 'frage_mia'],
    favorites: ['feed'],
    reports: ['frage_mia'],
    lastSeenWeek: true,
    // Die erste Woche war W40 – sie bleibt.
    firstSeenWeek: false,
    // Levin steht danach in keiner Rangliste mehr: Das Spiel fragt wieder nach dem Namen.
    gameName: true,
  })
  const mia = plan.progress.find((entry) => entry.uid === 'mia')
  assert.equal(mia?.firstSeenWeek, true)
  // Mia steht noch in der Rangliste von früher – ihr Name bleibt.
  assert.equal(mia?.gameName, false)
  assert.deepEqual(mia?.amens, ['frage_levin'])
  // Noah hat die Woche nur geöffnet – auch das wird zurückgesetzt.
  assert.deepEqual(
    plan.progress.find((entry) => entry.uid === 'noah'),
    {
      uid: 'noah',
      week: false,
      amens: [],
      favorites: [],
      reports: [],
      lastSeenWeek: true,
      firstSeenWeek: false,
      gameName: false,
    },
  )
  // Lea hat in dieser Woche nichts – ihr Dokument bleibt unberührt.
  assert.equal(
    plan.progress.some((entry) => entry.uid === 'lea'),
    false,
  )
})

test('Eine Person: nur ihre Spuren – das Amen der anderen zu ihrem Beitrag geht mit', () => {
  const plan = planImpulseReset(source(), { people: new Set(['levin']), parts: ALL_PARTS })
  assert.deepEqual(plan.answerIds, ['quiz_levin'])
  assert.deepEqual(plan.commentIds, ['frage_levin'])
  assert.deepEqual(plan.scoreIds, ['spiel_levin'])
  assert.deepEqual(plan.people, ['levin'])
  // Mias Amen zu Levins Beitrag verschwindet – der Beitrag ist weg, und ein
  // neuer bekäme dieselbe ID. Mias eigene Woche bleibt.
  const mia = plan.progress.find((entry) => entry.uid === 'mia')
  assert.deepEqual(mia, {
    uid: 'mia',
    week: false,
    amens: ['frage_levin'],
    favorites: [],
    reports: [],
    lastSeenWeek: false,
    firstSeenWeek: false,
    gameName: false,
  })
  assert.equal(
    plan.progress.some((entry) => entry.uid === 'noah'),
    false,
  )
})

test('Nur einzelne Teile: die Antworten – der Fortschritt bleibt, wie er ist', () => {
  const plan = planImpulseReset(source(), { people: null, parts: new Set(['answers']) })
  assert.deepEqual(plan.answerIds.sort(), ['quiz_levin', 'quiz_mia'])
  assert.deepEqual(plan.commentIds, [])
  assert.deepEqual(plan.scoreIds, [])
  assert.deepEqual(plan.progress, [])
  assert.deepEqual(plan.people.sort(), ['levin', 'mia'])
})

test('Nur die Beiträge: ihre Amen und Meldungen gehen mit, auch ohne «Reaktionen»', () => {
  const plan = planImpulseReset(source(), { people: null, parts: new Set(['comments']) })
  assert.deepEqual(plan.commentIds.sort(), ['frage_levin', 'frage_mia'])
  const levin = plan.progress.find((entry) => entry.uid === 'levin')
  // Das Amen zur Karte «feed» und das Gemerkte bleiben – nur die Beitrags-Bezüge gehen.
  assert.deepEqual(levin?.amens, ['frage_mia'])
  assert.deepEqual(levin?.favorites, [])
  assert.deepEqual(levin?.reports, ['frage_mia'])
  assert.equal(levin?.week, false)
})

test('Nur die Reaktionen: Amen, Gemerktes und Meldungen der Woche – nicht die von früher', () => {
  const plan = planImpulseReset(source(), { people: null, parts: new Set(['reactions']) })
  const levin = plan.progress.find((entry) => entry.uid === 'levin')
  assert.deepEqual(levin?.amens, ['feed', 'frage_mia'])
  assert.deepEqual(levin?.favorites, ['feed'])
  assert.equal(levin?.week, false)
  assert.equal(levin?.gameName, false)
  assert.deepEqual(plan.answerIds, [])
})

test('Bezüge: eine ähnliche ID aus einer anderen Woche bleibt stehen', () => {
  const data = source()
  data.itemIds = ['quiz']
  data.progress = [
    { uid: 'levin', firstName: 'Levin', amens: ['quiz', 'quiz-2', 'quizfrage_x', 'quiz_mia'] },
  ]
  const plan = planImpulseReset(data, { people: null, parts: new Set(['reactions']) })
  assert.deepEqual(plan.progress[0].amens, ['quiz', 'quiz_mia'])
})

test('Nichts zu tun: eine Woche ohne Spuren gibt einen leeren Plan', () => {
  const data = source()
  data.week = '2026-W45'
  data.itemIds = ['ganz-neu']
  assert.deepEqual(impulseResetPeople(data), [])
  assert.deepEqual(planImpulseReset(data, { people: null, parts: ALL_PARTS }), {
    answerIds: [],
    commentIds: [],
    scoreIds: [],
    progress: [],
    people: [],
  })
})

test('Rückmeldung: wer, und was alles mitgeht', () => {
  const plan = planImpulseReset(source(), { people: null, parts: ALL_PARTS })
  assert.equal(
    describeImpulseReset(plan),
    '3 Personen: Karten, Wappen und Haken, 2 Antworten, 2 Beiträge, 2 Ranglisten-Einträge, 5 Amen/Gemerkt',
  )
  const answers = planImpulseReset(source(), { people: null, parts: new Set(['answers']) })
  assert.equal(describeImpulseReset(answers), '2 Personen: 2 Antworten')
  // Noah hat die Woche bloss geöffnet – es bleibt bei der Person.
  const one = planImpulseReset(source(), { people: new Set(['noah']), parts: ALL_PARTS })
  assert.equal(describeImpulseReset(one), '1 Person')
})
