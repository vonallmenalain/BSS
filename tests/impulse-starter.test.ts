import assert from 'node:assert/strict'
import { test } from 'node:test'

import { readyProblems, stripDifficultyTag } from '../src/lib/impulse.ts'
import { planStarterItems, STARTER_WEEKS } from '../src/lib/impulseStarter.ts'

/*
 * Das Startpaket verspricht «bereit» – also muss jeder seiner bereiten
 * Inhalte die Prüfung bestehen, die auch das Redaktionsformular anwendet.
 * Die eine erlaubte Ausnahme sind die Bilderrätsel: Sie kommen als
 * Entwurf, und ihnen darf genau eines fehlen – das Bild, das die
 * Redaktion aus der Mediathek der Kirche ergänzt. Diese Tests sind die
 * Garantie dafür, dass das Paket nie halbe Inhalte veröffentlicht und
 * dass ein späterer Lauf nur nachholt, was fehlt.
 */

/** Der Umfang je Woche – die ersten drei sind voll ausgebaut. */
const WEEK_SHAPE = [
  { quiz: 3, riddles: 3, feed: 10 },
  { quiz: 3, riddles: 3, feed: 10 },
  { quiz: 3, riddles: 3, feed: 10 },
  { quiz: 1, riddles: 0, feed: 3 },
]
const WEEK_TOTALS = WEEK_SHAPE.map((shape) => 5 + shape.quiz + shape.riddles + shape.feed)
const TOTAL = WEEK_TOTALS.reduce((sum, count) => sum + count, 0)

test('Startpaket: vier Wochen – Einzel-Inhalte, Quizfragen, Bilderrätsel und Feed-Karten', () => {
  assert.equal(STARTER_WEEKS.length, 4)
  const plans = planStarterItems([], '2026-W33')
  assert.equal(plans.length, TOTAL)
  for (let week = 1; week <= 4; week += 1) {
    const shape = WEEK_SHAPE[week - 1]
    for (const kind of ['impuls', 'wochenziel', 'tageschallenge', 'frage', 'teilen']) {
      assert.ok(
        plans.some((plan) => plan.id === `starter-w${week}-${kind}`),
        `starter-w${week}-${kind} fehlt`,
      )
    }
    // Die erste Quizfrage trägt die alte ID, die weiteren zählen hoch.
    assert.ok(plans.some((plan) => plan.id === `starter-w${week}-quiz`))
    for (let quiz = 2; quiz <= shape.quiz; quiz += 1) {
      const plan = plans.find((entry) => entry.id === `starter-w${week}-quiz-${quiz}`)
      assert.ok(plan, `starter-w${week}-quiz-${quiz} fehlt`)
      assert.equal(plan.order, quiz)
    }
    for (let riddle = 1; riddle <= shape.riddles; riddle += 1) {
      const plan = plans.find((entry) => entry.id === `starter-w${week}-bild-${riddle}`)
      assert.ok(plan, `starter-w${week}-bild-${riddle} fehlt`)
      assert.equal(plan.status, 'draft')
      assert.equal(plan.order, riddle)
    }
    for (let card = 1; card <= shape.feed; card += 1) {
      const plan = plans.find((entry) => entry.id === `starter-w${week}-feed-${card}`)
      assert.ok(plan, `starter-w${week}-feed-${card} fehlt`)
      assert.equal(plan.order, card)
    }
  }
})

test('Startpaket: belegt die laufende und die nächsten drei Wochen', () => {
  const plans = planStarterItems([], '2026-W33')
  const byWeek = new Map<string, number>()
  for (const plan of plans) {
    assert.ok(plan.week, `${plan.id} ohne Woche`)
    byWeek.set(plan.week, (byWeek.get(plan.week) ?? 0) + 1)
  }
  assert.deepEqual(
    [...byWeek.entries()].sort(),
    [
      ['2026-W33', WEEK_TOTALS[0]],
      ['2026-W34', WEEK_TOTALS[1]],
      ['2026-W35', WEEK_TOTALS[2]],
      ['2026-W36', WEEK_TOTALS[3]],
    ],
  )
  // Auch über die Jahresgrenze hinweg – 2026 hat 53 Wochen.
  const yearEnd = planStarterItems([], '2026-W52')
  assert.deepEqual(
    [...new Set(yearEnd.map((plan) => plan.week))],
    ['2026-W52', '2026-W53', '2027-W01', '2027-W02'],
  )
})

test('Startpaket: Bereites ist vollständig, den Rätseln fehlt allein das Bild', () => {
  for (const plan of planStarterItems([], '2026-W33')) {
    if (plan.status === 'ready') {
      assert.deepEqual(
        readyProblems(plan),
        [],
        `${plan.id} ist unvollständig: ${readyProblems(plan).join(' ')}`,
      )
    } else {
      // Entwürfe gibt es nur bei den Bilderrätseln – und nur wegen des Bildes.
      assert.equal(plan.kind, 'bilderraetsel', `${plan.id} ist unerwartet Entwurf`)
      assert.deepEqual(readyProblems(plan), ['Das Bild fehlt.'], `${plan.id}: mehr fehlt`)
    }
  }
})

test('Startpaket: Impuls und Quiz tragen immer einen Kirchen-Link', () => {
  for (const plan of planStarterItems([], '2026-W33')) {
    if (plan.kind === 'impuls' || plan.kind === 'quiz') {
      assert.ok(plan.source?.label.trim(), `${plan.id} ohne Quellenangabe`)
      assert.ok(
        plan.source?.url.startsWith('https://www.churchofjesuschrist.org/'),
        `${plan.id} verweist nicht auf churchofjesuschrist.org: ${plan.source?.url}`,
      )
    } else if (plan.source) {
      // Aufgaben dürfen ohne Quelle sein – wenn eine dasteht, gehört sie zur Kirche.
      assert.ok(
        plan.source.url === '' ||
          plan.source.url.startsWith('https://www.churchofjesuschrist.org/'),
        `${plan.id}: fremde Quelle ${plan.source.url}`,
      )
    }
  }
})

test('Startpaket: alle Verweise in den Vertiefungen zeigen auf die Kirche', () => {
  for (const plan of planStarterItems([], '2026-W33')) {
    if (!plan.deepening) continue
    for (const match of plan.deepening.matchAll(/https?:\/\/[^\s]+/g)) {
      assert.ok(
        match[0].startsWith('https://www.churchofjesuschrist.org/'),
        `${plan.id}: fremder Link in der Vertiefung – ${match[0]}`,
      )
    }
  }
})

test('Startpaket: die Lösungen stimmen mit den markierten Antworten überein', () => {
  const plans = planStarterItems([], '2026-W33')
  const quizOf = (id: string) => {
    const plan = plans.find((entry) => entry.id === id)
    assert.ok(plan?.quiz, `${id} fehlt oder hat kein Quiz`)
    return plan.quiz
  }

  assert.equal(quizOf('starter-w1-quiz').options[quizOf('starter-w1-quiz').answerIndex], 'Alma')
  assert.equal(
    quizOf('starter-w2-quiz').options[quizOf('starter-w2-quiz').answerIndex],
    'Jesus stillt den Sturm',
  )
  assert.equal(
    quizOf('starter-w3-quiz').options[quizOf('starter-w3-quiz').answerIndex],
    'Glaube – Umkehr – Taufe – Gabe des Heiligen Geistes',
  )
  const search = quizOf('starter-w4-quiz')
  assert.equal(search.form, 'text')
  assert.equal(search.answerText, 'Mit einem Samenkorn')

  // Stichproben aus dem Ausbau: die kniffligen Suchfragen der Wochen 1 und 3.
  assert.equal(quizOf('starter-w1-quiz-3').form, 'text')
  assert.equal(quizOf('starter-w1-quiz-3').answerText, 'Einen Weg')
  assert.equal(quizOf('starter-w3-quiz-3').answerText, 'Stark und mutig (sein)')
  // Und jedes Bilderrätsel bringt seine fertige Auflösung mit.
  for (const plan of plans) {
    if (plan.kind !== 'bilderraetsel') continue
    assert.ok(plan.quiz, `${plan.id} ohne Rätselangaben`)
    assert.ok(
      plan.quiz.options[plan.quiz.answerIndex]?.trim(),
      `${plan.id}: keine markierte Lösung`,
    )
    assert.ok(plan.quiz.explanation.trim(), `${plan.id}: keine Erklärung`)
  }
})

test('Startpaket: belegte Einzel-Plätze bleiben unangetastet – der Inhalt geht in den Pool', () => {
  const plans = planStarterItems(
    [
      { id: 'eigenes-1', week: '2026-W33', kind: 'impuls' },
      { id: 'eigenes-2', week: '2026-W34', kind: 'teilen' },
      // Quiz ist eine Mehrfach-Art: eine eigene Frage belegt keinen Platz.
      { id: 'eigenes-3', week: '2026-W34', kind: 'quiz' },
    ],
    '2026-W33',
  )
  const byId = new Map(plans.map((plan) => [plan.id, plan]))
  assert.equal(byId.get('starter-w1-impuls')?.week, null)
  assert.equal(byId.get('starter-w1-quiz')?.week, '2026-W33')
  assert.equal(byId.get('starter-w2-impuls')?.week, '2026-W34')
  assert.equal(byId.get('starter-w2-teilen')?.week, null)
  assert.equal(byId.get('starter-w2-quiz')?.week, '2026-W34')
  // Der Fragenpool zählt nicht als belegter Platz.
  const withPool = planStarterItems([{ id: 'pool-1', week: null, kind: 'impuls' }], '2026-W33')
  assert.equal(withPool.find((plan) => plan.id === 'starter-w1-impuls')?.week, '2026-W33')
})

test('Startpaket: was schon da ist, wird nicht noch einmal geplant', () => {
  // Das Paket wurde früher eingespielt, als es je Woche nur einen Impuls und
  // eine Quizfrage kannte – ein zweiter Lauf holt genau das Neue nach.
  const existing = []
  for (let week = 1; week <= 4; week += 1) {
    existing.push(
      { id: `starter-w${week}-impuls`, week: `2026-W3${2 + week}`, kind: 'impuls' as const },
      { id: `starter-w${week}-quiz`, week: `2026-W3${2 + week}`, kind: 'quiz' as const },
    )
  }
  const plans = planStarterItems(existing, '2026-W33')
  assert.equal(plans.length, TOTAL - 8)
  assert.ok(
    plans.every(
      (plan) => !/-impuls$/.test(plan.id) && !/-quiz$/.test(plan.id),
      'Impuls oder erste Quizfrage wurden doppelt geplant',
    ),
  )
  // Und wer alles hat, bekommt nichts angeboten.
  const complete = planStarterItems(
    planStarterItems([], '2026-W33').map((plan) => ({
      id: plan.id,
      week: plan.week,
      kind: plan.kind,
    })),
    '2026-W33',
  )
  assert.equal(complete.length, 0)
})

test('Startpaket: kein Hinweis sagt mehr einen Schwierigkeitsgrad an', () => {
  for (const plan of planStarterItems([], '2026-W33')) {
    assert.equal(
      stripDifficultyTag(plan.body),
      plan.body,
      `${plan.id} trägt noch eine Schwierigkeitsansage: ${plan.body}`,
    )
  }
})
