import assert from 'node:assert/strict'
import { test } from 'node:test'

import { readyProblems } from '../src/lib/impulse.ts'
import { planStarterItems, STARTER_WEEKS } from '../src/lib/impulseStarter.ts'

/*
 * Das Startpaket verspricht «bereit» – also muss jeder seiner Inhalte die
 * Prüfung bestehen, die auch das Redaktionsformular anwendet. Diese Tests
 * sind die Garantie dafür, dass das Paket nie halbe Inhalte veröffentlicht
 * und dass ein späterer Lauf nur nachholt, was fehlt.
 */

test('Startpaket: vier Wochen, je Impuls, Ziel, Quiz, Tages-Challenge, Wochenfrage und drei Feed-Karten', () => {
  assert.equal(STARTER_WEEKS.length, 4)
  const plans = planStarterItems([], '2026-W33')
  assert.equal(plans.length, 32)
  for (let week = 1; week <= 4; week += 1) {
    for (const kind of ['impuls', 'wochenziel', 'quiz', 'tageschallenge', 'frage']) {
      assert.ok(
        plans.some((plan) => plan.id === `starter-w${week}-${kind}`),
        `starter-w${week}-${kind} fehlt`,
      )
    }
    for (let card = 1; card <= 3; card += 1) {
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
      ['2026-W33', 8],
      ['2026-W34', 8],
      ['2026-W35', 8],
      ['2026-W36', 8],
    ],
  )
  // Auch über die Jahresgrenze hinweg – 2026 hat 53 Wochen.
  const yearEnd = planStarterItems([], '2026-W52')
  assert.deepEqual(
    [...new Set(yearEnd.map((plan) => plan.week))],
    ['2026-W52', '2026-W53', '2027-W01', '2027-W02'],
  )
})

test('Startpaket: jeder Inhalt ist vollständig «bereit»', () => {
  for (const plan of planStarterItems([], '2026-W33')) {
    assert.deepEqual(
      readyProblems(plan),
      [],
      `${plan.id} ist unvollständig: ${readyProblems(plan).join(' ')}`,
    )
    assert.equal(plan.status, 'ready')
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
})

test('Startpaket: belegte Plätze bleiben unangetastet – der Inhalt geht in den Pool', () => {
  const plans = planStarterItems(
    [
      { id: 'eigenes-1', week: '2026-W33', kind: 'impuls' },
      { id: 'eigenes-2', week: '2026-W34', kind: 'quiz' },
    ],
    '2026-W33',
  )
  const byId = new Map(plans.map((plan) => [plan.id, plan]))
  assert.equal(byId.get('starter-w1-impuls')?.week, null)
  assert.equal(byId.get('starter-w1-quiz')?.week, '2026-W33')
  assert.equal(byId.get('starter-w2-impuls')?.week, '2026-W34')
  assert.equal(byId.get('starter-w2-quiz')?.week, null)
  // Der Fragenpool zählt nicht als belegter Platz.
  const withPool = planStarterItems([{ id: 'pool-1', week: null, kind: 'impuls' }], '2026-W33')
  assert.equal(withPool.find((plan) => plan.id === 'starter-w1-impuls')?.week, '2026-W33')
})

test('Startpaket: was schon da ist, wird nicht noch einmal geplant', () => {
  // Das Paket wurde früher eingespielt, als es nur Impuls und Quiz kannte –
  // ein zweiter Lauf holt genau die neuen Aufgaben nach.
  const existing = []
  for (let week = 1; week <= 4; week += 1) {
    existing.push(
      { id: `starter-w${week}-impuls`, week: `2026-W3${2 + week}`, kind: 'impuls' as const },
      { id: `starter-w${week}-quiz`, week: `2026-W3${2 + week}`, kind: 'quiz' as const },
    )
  }
  const plans = planStarterItems(existing, '2026-W33')
  assert.equal(plans.length, 24)
  assert.ok(
    plans.every(
      (plan) =>
        plan.kind === 'wochenziel' ||
        plan.kind === 'tageschallenge' ||
        plan.kind === 'frage' ||
        plan.kind === 'feed',
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
