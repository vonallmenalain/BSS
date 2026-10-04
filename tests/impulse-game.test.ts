import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  cleanGameName,
  cleanGameScore,
  GAME_NAME_MAX,
  GAME_SCORE_MAX,
  gameRanking,
  gameUnit,
  leaderboardLines,
  nextSortItem,
  seededRandom,
  SORT_ITEMS,
  SORT_LIVES,
  SORT_STREAK_FOR_LIFE,
  sortPace,
  type SortItem,
} from '../src/lib/impulseGame.ts'
import { deckOrder, readyProblems } from '../src/lib/impulse.ts'

/*
 * Die Minispiele ohne Leinwand: Rangliste, Name, Punkte – und das Tempo,
 * mit einem nachgebildeten Spieler durchgespielt.
 */

const at = (millis: number) => ({ toMillis: () => millis })
const score = (uid: string, name: string, best: number, extra: Record<string, unknown> = {}) => ({
  uid,
  name,
  best,
  bestAt: at(1000),
  hidden: false,
  ...extra,
})

/* ------------------------------------------------------------------ */
/* Rangliste                                                           */
/* ------------------------------------------------------------------ */

test('Rangliste: der beste Lauf zuoberst – Gleichstand heisst gleicher Platz', () => {
  const rows = gameRanking(
    [
      score('a', 'Mia', 30),
      score('b', 'Levin', 42),
      score('c', 'Noah', 30, { bestAt: at(500) }),
      score('d', 'Lea', 12),
    ],
    { ownUid: 'd' },
  )
  assert.deepEqual(
    rows.map((row) => [row.score.name, row.rank]),
    [
      ['Levin', 1],
      // Gleich viele Punkte: Wer früher dort war, steht oben – beide auf Platz 2.
      ['Noah', 2],
      ['Mia', 2],
      // Der nächste überspringt den geteilten Platz.
      ['Lea', 4],
    ],
  )
  assert.equal(rows.find((row) => row.own)?.score.name, 'Lea')
})

test('Rangliste: ohne Namen sieht nur die Person selbst ihren Eintrag', () => {
  const scores = [score('a', 'Mia', 30), score('b', '', 50), score('c', '  ', 70)]
  const forMia = gameRanking(scores, { ownUid: 'a' })
  assert.deepEqual(
    forMia.map((row) => row.score.uid),
    ['a'],
  )
  const forB = gameRanking(scores, { ownUid: 'b' })
  assert.deepEqual(
    forB.map((row) => [row.score.uid, row.rank, row.own]),
    [
      ['b', 1, true],
      ['a', 2, false],
    ],
  )
})

test('Rangliste: Ausgeblendetes sehen nur die Person selbst und die Redaktion', () => {
  const scores = [score('a', 'Mia', 30), score('b', 'Unpassend', 50, { hidden: true })]
  assert.deepEqual(
    gameRanking(scores, { ownUid: 'a' }).map((row) => row.score.uid),
    ['a'],
  )
  assert.deepEqual(
    gameRanking(scores, { ownUid: 'b' }).map((row) => row.score.uid),
    ['b', 'a'],
  )
  assert.deepEqual(
    gameRanking(scores, { ownUid: 'x', showHidden: true }).map((row) => row.score.uid),
    ['b', 'a'],
  )
})

test('Rangliste: die kurze Liste zeigt die Ersten – und den eigenen Platz immer', () => {
  const scores = Array.from({ length: 9 }, (_, index) =>
    score(`u${index}`, `Name ${index}`, 100 - index),
  )
  const rows = gameRanking(scores, { ownUid: 'u7' })
  const lines = leaderboardLines(rows, 5)
  assert.deepEqual(
    lines.map((line) => (line.kind === 'gap' ? '···' : line.row.score.uid)),
    ['u0', 'u1', 'u2', 'u3', 'u4', '···', 'u7'],
  )
  // Direkt hinter den Ersten braucht es keine Lücke.
  const sixth = leaderboardLines(gameRanking(scores, { ownUid: 'u5' }), 5)
  assert.deepEqual(
    sixth.map((line) => (line.kind === 'gap' ? '···' : line.row.score.uid)),
    ['u0', 'u1', 'u2', 'u3', 'u4', 'u5'],
  )
  // Unter den Ersten steht der eigene Eintrag nur einmal.
  const second = leaderboardLines(gameRanking(scores, { ownUid: 'u1' }), 5)
  assert.equal(second.length, 5)
})

test('Name und Punkte: sauber, kurz, ganzzahlig', () => {
  assert.equal(cleanGameName('  Levin   der  Schnelle '), 'Levin der Schnelle')
  assert.equal(cleanGameName('x'.repeat(40)).length, GAME_NAME_MAX)
  assert.equal(cleanGameName('   '), '')
  assert.equal(cleanGameScore(41.6), 42)
  assert.equal(cleanGameScore(-3), 0)
  assert.equal(cleanGameScore(Number.NaN), 0)
  assert.equal(cleanGameScore(1e9), GAME_SCORE_MAX)
  assert.equal(gameUnit('sortieren', 1), 'Punkt')
  assert.equal(gameUnit('sortieren', 7), 'Punkte')
})

/* ------------------------------------------------------------------ */
/* Die Karte im Feed                                                   */
/* ------------------------------------------------------------------ */

test('Minispiel: steht im Feed ganz zuletzt – auch hinter der Teilen-Aufgabe', () => {
  const cards = [
    { id: 'spiel', kind: 'spiel' as const, order: 1 },
    { id: 'teilen', kind: 'teilen' as const, order: 2 },
    { id: 'quiz', kind: 'quiz' as const, order: 9 },
    { id: 'impuls', kind: 'impuls' as const, order: 5 },
  ]
  assert.deepEqual(
    deckOrder(cards).map((card) => card.id),
    ['impuls', 'quiz', 'teilen', 'spiel'],
  )
})

test('Minispiel: bereit erst mit einem Spiel, das die App kennt', () => {
  assert.deepEqual(readyProblems({ kind: 'spiel', title: 'Gut für dich?', game: 'sortieren' }), [])
  assert.deepEqual(readyProblems({ kind: 'spiel', title: 'Gut für dich?', game: null }), [
    'Das Spiel fehlt.',
  ])
  assert.deepEqual(
    readyProblems({
      kind: 'spiel',
      title: 'Gut für dich?',
      game: 'tetris' as unknown as 'sortieren',
    }),
    ['Das Spiel fehlt.'],
  )
})

/* ------------------------------------------------------------------ */
/* «Gut für dich?»                                                     */
/* ------------------------------------------------------------------ */

test('Gegenstände: genug auf beiden Seiten, jeder mit Emoji und Wort – Schweizer Schreibweise', () => {
  const good = SORT_ITEMS.filter((item) => item.good)
  const bad = SORT_ITEMS.filter((item) => !item.good)
  assert.ok(good.length >= 8, 'zu wenig Gutes')
  assert.ok(bad.length >= 6, 'zu wenig «Nein, danke»')
  for (const item of SORT_ITEMS) {
    assert.ok(item.emoji.trim() && item.label.trim(), JSON.stringify(item))
    assert.ok(!item.label.includes('ß'), item.label)
  }
  assert.equal(new Set(SORT_ITEMS.map((item) => item.label)).size, SORT_ITEMS.length)
})

test('Folge: halb und halb, nie viermal dieselbe Seite und nie zweimal derselbe Gegenstand', () => {
  const random = seededRandom(42)
  const recent: SortItem[] = []
  for (let index = 0; index < 2000; index += 1) recent.push(nextSortItem(random, recent))
  const good = recent.filter((item) => item.good).length
  assert.ok(good > 850 && good < 1150, `Gut: ${good} von 2000`)
  for (let index = 1; index < recent.length; index += 1) {
    assert.notEqual(recent[index], recent[index - 1], `zweimal ${recent[index].label}`)
  }
  for (let index = 3; index < recent.length; index += 1) {
    const four = recent.slice(index - 3, index + 1)
    assert.ok(
      !four.every((item) => item.good === four[0].good),
      `viermal dieselbe Seite bei ${index}`,
    )
  }
})

test('Tempo: wird nur schneller – erst sanft, dann mit einem Schub', () => {
  let previous = sortPace(0)
  assert.ok(previous.fall >= 2.5, 'am Anfang bleibt Zeit zum Verstehen')
  for (let t = 1; t <= 70; t += 1) {
    const pace = sortPace(t)
    assert.ok(pace.fall <= previous.fall + 1e-9, `fall bei ${t}s`)
    assert.ok(pace.gap <= previous.gap + 1e-9, `gap bei ${t}s`)
    previous = pace
  }
  assert.ok(sortPace(60).gap < 0.2, 'nach einer Minute kommt kaum jemand mehr nach')
})

/**
 * Ein nachgebildeter Spieler: arbeitet die Gegenstände der Reihe nach ab
 * (immer den untersten), braucht pro Entscheid eine Reaktionszeit, die
 * streut, und irrt sich mit einer kleinen Wahrscheinlichkeit – öfter,
 * wenn es eng wird. Dieselbe Rechnung wie das Spiel: drei Leben, zehn
 * richtige am Stück geben eines zurück.
 */
function playRound(reaction: number, spread: number, baseError: number, seed: number) {
  const random = seededRandom(seed)
  const gauss = () => {
    const u = Math.max(random(), 1e-9)
    const v = random()
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }
  let nextSpawn = 0.6
  const items: { spawn: number; arrive: number }[] = []
  let lives = SORT_LIVES
  let streak = 0
  let points = 0
  let busyUntil = 0
  let t = 0
  while (lives > 0 && t < 300) {
    while (nextSpawn <= Math.max(t, busyUntil)) {
      const pace = sortPace(nextSpawn)
      items.push({ spawn: nextSpawn, arrive: nextSpawn + pace.fall })
      nextSpawn += pace.gap
    }
    if (items.length === 0) {
      t = nextSpawn
      continue
    }
    items.sort((a, b) => a.arrive - b.arrive)
    const item = items.shift()!
    const start = Math.max(busyUntil, item.spawn + 0.12)
    const decided = start + Math.max(0.15, reaction + spread * gauss())
    if (decided > item.arrive) {
      lives -= 1
      streak = 0
      t = item.arrive
      busyUntil = Math.max(busyUntil, item.arrive)
      continue
    }
    const left = item.arrive - start
    const error = baseError + (left < 0.7 ? (0.1 * (0.7 - left)) / 0.7 : 0)
    busyUntil = decided
    t = decided
    if (random() < error) {
      lives -= 1
      streak = 0
    } else {
      points += 1
      streak += 1
      if (streak % SORT_STREAK_FOR_LIFE === 0 && lives < SORT_LIVES) lives += 1
    }
  }
  return { seconds: t, points }
}

const median = (values: number[]) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]

test('eine Runde dauert 20 bis 60 Sekunden – vom Anfänger bis zur Spitze', () => {
  const play = (reaction: number, spread: number, error: number) =>
    Array.from({ length: 200 }, (_, index) => playRound(reaction, spread, error, 500 + index))
  const beginner = play(0.62, 0.12, 0.05)
  const average = play(0.48, 0.1, 0.03)
  const top = play(0.26, 0.05, 0.008)

  const beginnerSeconds = median(beginner.map((round) => round.seconds))
  const averageSeconds = median(average.map((round) => round.seconds))
  const topSeconds = top.map((round) => round.seconds)
  assert.ok(beginnerSeconds >= 15, `Anfänger nach ${beginnerSeconds.toFixed(0)} s schon fertig`)
  assert.ok(
    averageSeconds >= 20 && averageSeconds <= 45,
    `Durchschnitt: ${averageSeconds.toFixed(0)} s`,
  )
  assert.ok(Math.max(...topSeconds) <= 65, `Spitze: ${Math.max(...topSeconds).toFixed(0)} s`)
  // Wer besser spielt, steht höher: Die Liste trennt die Spieler.
  assert.ok(median(top.map((round) => round.points)) > median(average.map((round) => round.points)))
  assert.ok(
    median(average.map((round) => round.points)) > median(beginner.map((round) => round.points)),
  )
})
