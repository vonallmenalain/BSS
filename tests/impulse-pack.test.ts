import assert from 'node:assert/strict'
import { test } from 'node:test'

import { format } from 'date-fns'
import {
  deckOrder,
  puzzlePieces,
  puzzleSolution,
  readyProblems,
  weekEnd,
  weekKeyOffset,
  weekStart,
} from '../src/lib/impulse.ts'
import {
  isPackItem,
  PACK_ID_PREFIX,
  PACK_WEEKS,
  packWeekPlans,
  planPackItems,
} from '../src/lib/impulsePack.ts'
import { IMPULSE_CREST_PALETTE_LABELS, IMPULSE_CREST_SYMBOL_LABELS } from '../src/lib/types.ts'

/*
 * Das Themenpaket nach dem Leitfaden «Für eine starke Jugend».
 *
 * Es verspricht «bereit» – also muss jeder seiner Inhalte die Prüfung
 * bestehen, die auch das Redaktionsformular anwendet. Dazu die Zusagen,
 * von denen die Woche lebt: Jede Woche endet mit dem Sonntag ihrer
 * Lektion, trägt Lektion und Wappen, und ihr Feed wechselt den Takt.
 * Die festen IDs halten einen zweiten Lauf frei von Dubletten.
 */

const ALL = PACK_WEEKS.flatMap(packWeekPlans)

test('Themenpaket: sieben Wochen am Stück, vom 5. Oktober bis 22. November 2026', () => {
  assert.deepEqual(
    PACK_WEEKS.map((week) => week.week),
    ['2026-W41', '2026-W42', '2026-W43', '2026-W44', '2026-W45', '2026-W46', '2026-W47'],
  )
  for (const [index, week] of PACK_WEEKS.entries()) {
    if (index === 0) continue
    assert.equal(weekKeyOffset(PACK_WEEKS[index - 1].week, 1), week.week)
  }
  assert.equal(format(weekStart('2026-W41')!, 'yyyy-MM-dd'), '2026-10-05')
})

test('Themenpaket: jede Woche endet mit dem Sonntag ihrer Lektion', () => {
  /* Die Sonntage aus dem Heft Oktober 2026: 2., 3. und letzter Sonntag im
     Oktober, dann Fastsonntag, 2., 3. und letzter Sonntag im November. */
  const sundays = PACK_WEEKS.map((week) => format(weekEnd(week.week)!, 'yyyy-MM-dd'))
  assert.deepEqual(sundays, [
    '2026-10-11',
    '2026-10-18',
    '2026-10-25',
    '2026-11-01',
    '2026-11-08',
    '2026-11-15',
    '2026-11-22',
  ])
  assert.equal(PACK_WEEKS[0].theme.lesson.label, 'Erfahre mehr über das Wort der Weisheit')
  assert.equal(PACK_WEEKS[1].theme.lesson.label, 'Erfahre mehr über das Gesetz der Keuschheit')
  assert.equal(PACK_WEEKS[4].theme.lesson.label, 'Erfahre mehr über das Schriftstudium')
  assert.equal(PACK_WEEKS[5].theme.lesson.label, 'Erfahre mehr über die Suche nach Wahrheit')
})

test('Themenpaket: Wochenthema mit Monatszeile, Lektion samt Link und Wappen', () => {
  for (const week of PACK_WEEKS) {
    const theme = week.theme
    assert.ok(theme.kicker.trim(), `${week.week}: Zeile über dem Titel fehlt`)
    assert.ok(theme.lesson.label.trim(), `${week.week}: Lektion fehlt`)
    assert.ok(
      theme.lesson.url.startsWith('https://www.churchofjesuschrist.org/'),
      `${week.week}: Lektion ohne Link`,
    )
    assert.ok(theme.crest.symbol in IMPULSE_CREST_SYMBOL_LABELS, `${week.week}: Zeichen`)
    assert.ok(theme.crest.palette in IMPULSE_CREST_PALETTE_LABELS, `${week.week}: Farbe`)
    assert.ok(
      theme.crest.motto.trim().length > 0 && theme.crest.motto.length <= 32,
      `${week.week}: Spruch`,
    )
  }
  // Jede Woche sieht anders aus: keine zwei Wappen mit derselben Farbe hintereinander.
  for (let index = 1; index < PACK_WEEKS.length; index += 1) {
    assert.notEqual(
      PACK_WEEKS[index].theme.crest.palette,
      PACK_WEEKS[index - 1].theme.crest.palette,
    )
  }
})

test('Themenpaket: jeder Inhalt ist bereit und vollständig', () => {
  for (const plan of ALL) {
    assert.equal(plan.status, 'ready', plan.id)
    assert.deepEqual(readyProblems(plan), [], `${plan.id}: ${readyProblems(plan).join(' ')}`)
  }
})

test('Themenpaket: feste, eindeutige IDs mit Vorsilbe', () => {
  const ids = ALL.map((plan) => plan.id)
  assert.equal(new Set(ids).size, ids.length, 'doppelte ID')
  for (const id of ids) {
    assert.ok(id.startsWith(PACK_ID_PREFIX), id)
    assert.ok(isPackItem(id), id)
  }
  assert.ok(ids.includes('fsy26-w41-impuls'))
  assert.ok(ids.includes('fsy26-w41-umfrage-1'))
  assert.ok(ids.includes('fsy26-w47-teilen'))
  assert.equal(isPackItem('starter-w1-impuls'), false)
})

test('Themenpaket: der Feed wechselt den Takt – und endet mit der Teilen-Aufgabe', () => {
  for (const week of PACK_WEEKS) {
    const kinds = week.deck.map((card) => card.kind)
    assert.equal(kinds.at(-1), 'teilen', `${week.week}: Teilen-Aufgabe nicht zuletzt`)
    assert.equal(kinds.filter((kind) => kind === 'teilen').length, 1, week.week)
    for (const kind of ['umfrage', 'quiz', 'puzzle', 'frage', 'feed'] as const) {
      assert.ok(kinds.includes(kind), `${week.week}: keine Karte der Art ${kind}`)
    }
    // Eine Skala und ein «Was würdest du tun?» gehören zu jeder Woche.
    assert.ok(
      week.deck.some((card) => card.poll?.form === 'scale'),
      `${week.week}: keine Skala`,
    )
    assert.ok(
      week.deck.some(
        (card) => card.poll?.form === 'choice' && card.title.startsWith('Was würdest du tun?'),
      ),
      `${week.week}: kein «Was würdest du tun?»`,
    )
    // Nie zwei gleiche Arten direkt hintereinander.
    for (let index = 1; index < kinds.length; index += 1) {
      assert.notEqual(
        kinds[index],
        kinds[index - 1],
        `${week.week}: zweimal ${kinds[index]} am Stück`,
      )
    }
    const keys = week.deck.map((card) => card.key)
    assert.equal(new Set(keys).size, keys.length, `${week.week}: doppelter Schlüssel`)
  }
})

test('Themenpaket: der Feed liegt im Bereich genau in der Reihenfolge des Pakets', () => {
  for (const week of PACK_WEEKS) {
    const plans = packWeekPlans(week).filter(
      (plan) => plan.kind !== 'wochenziel' && plan.kind !== 'tageschallenge',
    )
    // Gemischt hereingegeben, wie die Datenbank sie liefert …
    const shuffled = [...plans].reverse()
    // … und vom Feed wieder in die Ordnung des Pakets gelegt.
    assert.deepEqual(
      deckOrder(shuffled).map((plan) => plan.id),
      plans.map((plan) => plan.id),
      week.week,
    )
  }
})

test('Themenpaket: Wochenziel und Tages-Challenge sind Kacheln, keine Feed-Karten', () => {
  for (const week of PACK_WEEKS) {
    const plans = packWeekPlans(week)
    assert.equal(plans.filter((plan) => plan.kind === 'wochenziel').length, 1, week.week)
    assert.equal(plans.filter((plan) => plan.kind === 'tageschallenge').length, 1, week.week)
    for (const plan of plans) {
      if (plan.kind === 'wochenziel' || plan.kind === 'tageschallenge')
        assert.equal(plan.order, null)
      else assert.equal(typeof plan.order, 'number', plan.id)
    }
  }
})

test('Themenpaket: Umfragen und Quizfragen sind in sich stimmig', () => {
  for (const plan of ALL) {
    if (plan.poll?.form === 'choice') {
      assert.ok(plan.poll.options.length >= 2 && plan.poll.options.length <= 6, plan.id)
      assert.ok(plan.poll.explanation.trim(), `${plan.id}: Umfrage ohne Gedanken danach`)
    }
    if (plan.poll?.form === 'scale') {
      assert.ok(plan.poll.min < plan.poll.max, plan.id)
      assert.ok(
        plan.poll.minLabel.trim() && plan.poll.maxLabel.trim(),
        `${plan.id}: Enden ohne Namen`,
      )
    }
    if (plan.quiz?.form === 'choice') {
      assert.ok(
        plan.quiz.answerIndex >= 0 && plan.quiz.answerIndex < plan.quiz.options.length,
        plan.id,
      )
      assert.ok(plan.quiz.explanation.trim(), `${plan.id}: Quiz ohne Auflösung`)
    }
    if (plan.kind === 'quiz') assert.ok(plan.quiz, plan.id)
    if (plan.kind === 'umfrage') assert.ok(plan.poll, plan.id)
    if (plan.kind === 'puzzle') assert.ok(plan.puzzle, plan.id)
  }
})

test('Themenpaket: die Vers-Puzzles bauen ihren Vers', () => {
  for (const plan of ALL.filter((entry) => entry.kind === 'puzzle')) {
    const pieces = puzzlePieces(plan.puzzle!.text)
    assert.ok(pieces.length >= 6, `${plan.id}: nur ${pieces.length} Teile`)
    assert.ok(plan.source, `${plan.id}: ohne Fundstelle`)
  }
  const warriors = ALL.find((plan) => plan.id === 'fsy26-w43-puzzle-1')!
  assert.equal(
    puzzleSolution(warriors.puzzle!.text),
    'zu allen Zeiten und in allem, was ihnen anvertraut war, treu',
  )
})

test('Themenpaket: jede Feed-Karte trägt ihr Emoji', () => {
  for (const plan of ALL) assert.ok(plan.emoji?.trim(), `${plan.id}: ohne Emoji`)
})

test('Themenpaket: Schweizer Schreibweise – kein «ß»', () => {
  for (const plan of ALL) {
    const text = JSON.stringify(plan)
    assert.ok(!text.includes('ß'), `${plan.id} schreibt «ß»`)
  }
})

test('planPackItems: vergangene Wochen bleiben weg', () => {
  const fromStart = planPackItems([], '2026-W41')
  assert.equal(fromStart.length, ALL.length)
  const later = planPackItems([], '2026-W43')
  assert.deepEqual(
    [...new Set(later.map((plan) => plan.week))],
    ['2026-W43', '2026-W44', '2026-W45', '2026-W46', '2026-W47'],
  )
  assert.deepEqual(planPackItems([], '2026-W48'), [])
  // Wer früher einspielt, bekommt alle Wochen – geplant ist geplant.
  assert.equal(planPackItems([], '2026-W40').length, ALL.length)
})

test('planPackItems: holt nur nach, was fehlt – und überschreibt nichts', () => {
  const existing = ALL.slice(0, 10).map((plan) => ({ id: plan.id }))
  const plans = planPackItems(existing, '2026-W41')
  assert.equal(plans.length, ALL.length - 10)
  assert.ok(plans.every((plan) => !existing.some((entry) => entry.id === plan.id)))
  assert.deepEqual(
    planPackItems(
      ALL.map((plan) => ({ id: plan.id })),
      '2026-W41',
    ),
    [],
  )
})

/* ------------------------------------------------------------------ */
/* Weniger «für den Sonntag vorbereiten»                               */
/* ------------------------------------------------------------------ */

/** Die Texte einer Karte, die die Jugendlichen lesen. */
const textsOf = (plan: (typeof ALL)[number]) =>
  [plan.title, plan.body, plan.deepening ?? '', plan.puzzle?.explanation ?? ''].join('\n')

test('Themenpaket: keine Vorbereitung auf den Sonntag, nichts zum Mitbringen', () => {
  const sundayPrep =
    /vorbereitet|bereit für (den )?Sonntag|am Sonntag mit\b|Am Sonntag (geht es|lernt|könnt)|am Sonntag etwas zu sagen|am Fastsonntag sprechen|beginnt der Fastsonntag/i
  for (const plan of ALL) {
    assert.doesNotMatch(textsOf(plan), sundayPrep, plan.id)
  }
})
