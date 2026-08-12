import assert from 'node:assert/strict'
import { test } from 'node:test'

import { readyProblems } from '../src/lib/impulse.ts'
import { planStarterItems, STARTER_WEEKS } from '../src/lib/impulseStarter.ts'

/*
 * Das Startpaket verspricht «bereit» – also muss jeder seiner Inhalte die
 * Prüfung bestehen, die auch das Redaktionsformular anwendet. Diese Tests
 * sind die Garantie dafür, dass das Paket nie halbe Inhalte oder Inhalte
 * ohne Quelle veröffentlicht.
 */

test('Startpaket: vier Wochen, je Impuls und Quizfrage', () => {
  assert.equal(STARTER_WEEKS.length, 4)
  const plans = planStarterItems([], '2026-W33')
  assert.equal(plans.length, 8)
  assert.deepEqual(
    plans.map((plan) => plan.id),
    [
      'starter-w1-impuls',
      'starter-w1-quiz',
      'starter-w2-impuls',
      'starter-w2-quiz',
      'starter-w3-impuls',
      'starter-w3-quiz',
      'starter-w4-impuls',
      'starter-w4-quiz',
    ],
  )
})

test('Startpaket: belegt die laufende und die nächsten drei Wochen', () => {
  const plans = planStarterItems([], '2026-W33')
  assert.deepEqual(
    plans.map((plan) => plan.week),
    ['2026-W33', '2026-W33', '2026-W34', '2026-W34', '2026-W35', '2026-W35', '2026-W36', '2026-W36'],
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

test('Startpaket: jede Quelle trägt Bezeichnung und Link zur Kirche', () => {
  for (const plan of planStarterItems([], '2026-W33')) {
    assert.ok(plan.source.label.trim(), `${plan.id} ohne Quellenangabe`)
    assert.ok(
      plan.source.url.startsWith('https://www.churchofjesuschrist.org/'),
      `${plan.id} verweist nicht auf churchofjesuschrist.org: ${plan.source.url}`,
    )
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
      { week: '2026-W33', kind: 'impuls' },
      { week: '2026-W34', kind: 'quiz' },
    ],
    '2026-W33',
  )
  const byId = new Map(plans.map((plan) => [plan.id, plan]))
  assert.equal(byId.get('starter-w1-impuls')?.week, null)
  assert.equal(byId.get('starter-w1-quiz')?.week, '2026-W33')
  assert.equal(byId.get('starter-w2-impuls')?.week, '2026-W34')
  assert.equal(byId.get('starter-w2-quiz')?.week, null)
  // Der Fragenpool zählt nicht als belegter Platz.
  const withPool = planStarterItems([{ week: null, kind: 'impuls' }], '2026-W33')
  assert.equal(withPool.find((plan) => plan.id === 'starter-w1-impuls')?.week, '2026-W33')
})
