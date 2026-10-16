import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  cleanGameName,
  cleanGameScore,
  GAME_NAME_MAX,
  GAME_SCORE_MAX,
  gameRanking,
  gameUnit,
  isImpulseGameId,
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
import { IMPULSE_GAME_LABELS, type ImpulseGameId } from '../src/lib/types.ts'
import {
  SHIELD_DARK,
  SHIELD_ITEMS,
  SHIELD_LIGHT,
  SHIELD_LIGHT_POINTS,
  SHIELD_LIVES,
  SHIELD_PACE,
  ShieldRound,
  shieldPace,
  type ShieldDir,
  type ShieldEvent,
} from '../src/lib/impulseGameShield.ts'
import {
  RUN_GAPS,
  RUN_HURDLE_SHAPES,
  RUN_HURDLES,
  RUN_LEVELS,
  RUN_LIVES,
  RUN_PACE,
  RUN_STREAK_FOR_LIFE,
  RUN_TASKS,
  RUN_WORLD,
  RunRound,
  runTempo,
  type RunEvent,
  type RunGap,
  type RunHurdle,
  type RunPlatform,
  type RunTask,
} from '../src/lib/impulseGameRun.ts'
import {
  CHAIN_KEY,
  CHAIN_LIES,
  CHAIN_LIVES,
  CHAIN_MISS_LOCK,
  CHAIN_SLOTS,
  ChainRound,
  chainPace,
  chainPoints,
  type ChainEvent,
  type ChainLock,
} from '../src/lib/impulseGameChain.ts'

/*
 * Die Minispiele ohne Leinwand: Rangliste, Name, Punkte – und das Tempo,
 * mit einem nachgebildeten Spieler durchgespielt. Bei «Gut für dich?»
 * rechnet der Test das Spiel nach; bei den späteren Spielen spielt er
 * die Runde selbst – die Regeln liegen dort als Klasse ohne Leinwand in
 * `lib/impulseGame*`, und die Leinwand benutzt dieselbe.
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

/* ------------------------------------------------------------------ */
/* Alle Spiele                                                         */
/* ------------------------------------------------------------------ */

const GAME_IDS = Object.keys(IMPULSE_GAME_LABELS) as ImpulseGameId[]

test('Spiele: vier Schlüssel – jeder bereit, mit Namen und Einheit', () => {
  assert.deepEqual(GAME_IDS, ['sortieren', 'abwehren', 'springen', 'befreien'])
  for (const game of GAME_IDS) {
    assert.ok(isImpulseGameId(game), game)
    assert.deepEqual(readyProblems({ kind: 'spiel', title: 'Ein Spiel', game }), [], game)
    assert.equal(gameUnit(game, 1), 'Punkt')
    assert.equal(gameUnit(game, 12), 'Punkte')
    assert.ok(!IMPULSE_GAME_LABELS[game].includes('ß'), game)
  }
  assert.equal(isImpulseGameId('tetris'), false)
  assert.equal(isImpulseGameId(null), false)
})

/** Zufall für den nachgebildeten Spieler – eine Glockenkurve um null. */
function gaussian(random: () => number) {
  return () => {
    const u = Math.max(random(), 1e-9)
    const v = random()
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }
}

/** Die Regeln für eine Rundenlänge wie bei «Gut für dich?» – vom Anfänger bis zur Spitze. */
function assertRoundLengths(
  name: string,
  rounds: Record<'beginner' | 'average' | 'top', { seconds: number; points: number }[]>,
) {
  const beginner = median(rounds.beginner.map((round) => round.seconds))
  const average = median(rounds.average.map((round) => round.seconds))
  const topMax = Math.max(...rounds.top.map((round) => round.seconds))
  assert.ok(beginner >= 15, `${name}: Anfänger nach ${beginner.toFixed(0)} s schon fertig`)
  assert.ok(average >= 20 && average <= 45, `${name}: Durchschnitt ${average.toFixed(0)} s`)
  assert.ok(topMax <= 65, `${name}: Spitze ${topMax.toFixed(0)} s`)
  // Wer besser spielt, steht höher: Die Liste trennt die Spieler.
  const points = (list: { points: number }[]) => median(list.map((round) => round.points))
  assert.ok(points(rounds.top) > points(rounds.average), `${name}: Spitze vor Durchschnitt`)
  assert.ok(points(rounds.average) > points(rounds.beginner), `${name}: Durchschnitt vor Anfänger`)
  // Weit unter der Grenze der Zugriffsregeln.
  assert.ok(Math.max(...rounds.top.map((round) => round.points)) < GAME_SCORE_MAX / 10, name)
}

function itemsAreClean(items: readonly { emoji: string; label: string }[], max: number) {
  assert.equal(new Set(items.map((item) => item.label)).size, items.length, 'doppeltes Wort')
  for (const item of items) {
    assert.ok(item.emoji.trim() && item.label.trim(), JSON.stringify(item))
    assert.ok(!item.label.includes('ß'), item.label)
    assert.ok(item.label.length <= max, `zu lang: ${item.label}`)
  }
}

/* ------------------------------------------------------------------ */
/* «Schild hoch!»                                                      */
/* ------------------------------------------------------------------ */

test('Schild: genug Dunkles und Lichter, jedes mit Emoji und Wort', () => {
  assert.ok(SHIELD_DARK.length >= 6)
  assert.ok(SHIELD_LIGHT.length >= 4)
  assert.ok(SHIELD_DARK.every((item) => !item.light))
  assert.ok(SHIELD_LIGHT.every((item) => item.light))
  itemsAreClean(SHIELD_ITEMS, 16)
})

test('Schild: Tempo wird nur schneller, am Anfang bleibt Zeit', () => {
  let previous = shieldPace(0)
  assert.ok(previous.travel >= 1.5, 'am Anfang bleibt Zeit zum Verstehen')
  for (let t = 1; t <= 70; t += 1) {
    const pace = shieldPace(t)
    assert.ok(pace.travel <= previous.travel + 1e-9, `travel bei ${t}s`)
    assert.ok(pace.gap <= previous.gap + 1e-9, `gap bei ${t}s`)
    previous = pace
  }
  assert.ok(shieldPace(60).gap < 0.15, 'nach einer Minute kommt kaum jemand mehr nach')
})

/** Rechnet weiter, bis ein Ereignis der Art kommt – mit einer Regel, wohin der Schild zeigt. */
function shieldUntil(
  round: ShieldRound,
  kind: ShieldEvent['kind'],
  aim: (round: ShieldRound) => void = () => {},
): ShieldEvent {
  for (let index = 0; index < 120 * 120; index += 1) {
    aim(round)
    const found = round.step(1 / 120).find((event) => event.kind === kind)
    if (found) return found
  }
  throw new Error(`kein ${kind}`)
}

/** Der Schild zeigt immer zum Vordersten – oder von einem Licht weg. */
const perfectShield = (round: ShieldRound) => {
  const first = round.shots[0]
  if (!first) return
  if (!first.item.light) round.turn(first.dir)
  else if (round.shield === first.dir) round.turn(((first.dir + 1) % 4) as ShieldDir)
}

/** Der Schild schaut weg vom nächsten dunklen Pfeil. */
const missShield = (round: ShieldRound) => {
  const next = round.shots.find((shot) => !shot.item.light)
  if (next) round.turn(((next.dir + 2) % 4) as ShieldDir)
}

test('Schild: was auf ihn trifft, prallt ab – was vorbeikommt, trifft das Herz', () => {
  const round = new ShieldRound(seededRandom(7))
  const block = shieldUntil(round, 'block', perfectShield)
  assert.ok(block.kind === 'block' && !block.shot.item.light)
  assert.equal(round.points, 1)
  assert.equal(round.lives, SHIELD_LIVES)
  shieldUntil(round, 'hit', missShield)
  assert.equal(round.lives, SHIELD_LIVES - 1)
  assert.equal(round.streak, 0)
})

test('Schild: ein Licht, das durchkommt, zählt drei und heilt – vor dem Schild prallt es ab', () => {
  const round = new ShieldRound(seededRandom(11))
  shieldUntil(round, 'hit', missShield)
  assert.equal(round.lives, SHIELD_LIVES - 1)
  const before = round.points
  const light = shieldUntil(round, 'light', perfectShield)
  assert.ok(light.kind === 'light' && light.healed)
  assert.equal(round.lives, SHIELD_LIVES)
  assert.ok(round.points - before >= SHIELD_LIGHT_POINTS)
  // Vor dem Schild: verloren, aber ohne Strafe.
  const lives = round.lives
  const points = round.points
  shieldUntil(round, 'bounce', (r) => {
    const first = r.shots[0]
    if (first) r.turn(first.dir)
  })
  assert.equal(round.lives, lives)
  assert.ok(round.points >= points)
})

test('Schild: nie dreimal dieselbe Richtung, Lichter mit Abstand, Ankunft in Reihenfolge', () => {
  const round = new ShieldRound(seededRandom(3))
  const seen = new Map<number, { dir: ShieldDir; light: boolean; spawn: number; arrive: number }>()
  while (round.time < 45 && !round.over) {
    perfectShield(round)
    round.step(1 / 240)
    for (const shot of round.shots)
      if (!seen.has(shot.id))
        seen.set(shot.id, {
          dir: shot.dir,
          light: shot.item.light,
          spawn: shot.spawn,
          arrive: shot.arrive,
        })
  }
  const shots = [...seen.values()]
  assert.ok(shots.length > 60, `nur ${shots.length} Geschosse`)
  for (let index = 2; index < shots.length; index += 1) {
    const three = shots.slice(index - 2, index + 1)
    assert.ok(!three.every((shot) => shot.dir === three[0].dir), `dreimal gleich bei ${index}`)
  }
  for (let index = 1; index < shots.length; index += 1) {
    assert.ok(shots[index].arrive > shots[index - 1].arrive, `Reihenfolge bei ${index}`)
    assert.ok(!(shots[index].light && shots[index - 1].light), `zwei Lichter bei ${index}`)
  }
  const lights = shots.filter((shot) => shot.light)
  assert.ok(lights.length >= 3, `nur ${lights.length} Lichter`)
  assert.ok(lights[0].spawn >= SHIELD_PACE.lightFrom)
  for (let index = 1; index < lights.length; index += 1)
    assert.ok(lights[index].spawn - lights[index - 1].spawn >= SHIELD_PACE.lightSpacing - 1e-9)
})

/**
 * Ein nachgebildeter Spieler am Schild: erkennt ein Geschoss eine
 * Reaktionszeit nach dem Auftauchen, und nach dem Aufprall des vorigen
 * braucht er einen Moment, um umzuschalten (zu früh heisst: das vorige
 * trifft). Ab und zu dreht er falsch und braucht dann eine Reaktionszeit,
 * um es zu merken. Lichtern dreht er aus dem Weg, so gut es geht.
 */
function playShield(
  player: {
    reaction: number
    spread: number
    switchMean: number
    switchSpread: number
    error: number
  },
  seed: number,
) {
  const round = new ShieldRound(seededRandom(seed))
  const noise = seededRandom(seed * 7919 + 13)
  const gauss = gaussian(noise)
  const plans = new Map<number, number>()
  let lastArrive = -Infinity
  let busyUntil = 0
  while (!round.over && round.time < 300) {
    round.step(1 / 120)
    for (const shot of round.shots) {
      if (plans.has(shot.id)) continue
      const react = shot.spawn + Math.max(0.15, player.reaction + player.spread * gauss())
      const after = lastArrive + player.switchMean + player.switchSpread * gauss()
      plans.set(shot.id, Math.max(react, after))
      lastArrive = shot.arrive
    }
    if (round.time < busyUntil) continue
    // Es gilt der am weitesten fortgeschrittene Plan – zu früh umgeschaltet, trifft das vorige.
    let target = null
    for (const shot of round.shots) if (plans.get(shot.id)! <= round.time) target = shot
    if (!target) continue
    if (!target.item.light) {
      if (round.shield !== target.dir) {
        const wrong = noise() < player.error
        const dir = wrong ? (target.dir + 1 + Math.floor(noise() * 3)) % 4 : target.dir
        round.turn(dir as ShieldDir)
        if (wrong) busyUntil = round.time + player.reaction
      }
    } else if (round.shield === target.dir) {
      const next = round.shots.find((shot) => !shot.item.light && shot.id > target.id)
      round.turn(next && next.dir !== target.dir ? next.dir : (((target.dir + 1) % 4) as ShieldDir))
    }
  }
  return { seconds: round.time, points: round.points }
}

test('Schild: eine Runde dauert 20 bis 60 Sekunden – vom Anfänger bis zur Spitze', () => {
  const play = (player: Parameters<typeof playShield>[0]) =>
    Array.from({ length: 200 }, (_, index) => playShield(player, 500 + index))
  assertRoundLengths('Schild', {
    beginner: play({
      reaction: 0.55,
      spread: 0.12,
      switchMean: 0.3,
      switchSpread: 0.1,
      error: 0.05,
    }),
    average: play({
      reaction: 0.45,
      spread: 0.1,
      switchMean: 0.22,
      switchSpread: 0.07,
      error: 0.03,
    }),
    top: play({ reaction: 0.3, spread: 0.06, switchMean: 0.14, switchSpread: 0.04, error: 0.01 }),
  })
})

/* ------------------------------------------------------------------ */
/* «Keine Ausreden!»                                                   */
/* ------------------------------------------------------------------ */

test('Laufen: genug Ausreden, Lücken und Aufgaben, jede mit Emoji und Wort', () => {
  assert.ok(RUN_HURDLES.length >= 5)
  assert.ok(RUN_GAPS.length >= 4)
  assert.ok(RUN_TASKS.length >= 4)
  itemsAreClean([...RUN_HURDLES, ...RUN_GAPS, ...RUN_TASKS], 14)
})

test('Laufen: das Tempo wächst nur – erst sanft, dann mit einem Schub', () => {
  assert.equal(runTempo(0), 1)
  let previous = runTempo(0)
  for (let t = 1; t <= 70; t += 1) {
    const tempo = runTempo(t)
    assert.ok(tempo >= previous, `bei ${t}s`)
    previous = tempo
  }
  assert.ok(runTempo(30) < 2.4, 'nach einer halben Minute noch spielbar')
  assert.ok(runTempo(60) > 4, 'nach einer Minute hält es niemand mehr')
})

/** Ein voller Sprung vom Boden: wie hoch – und wie weit, bis er wieder unten ist. */
const FULL_APEX = RUN_WORLD.jumpVelocity ** 2 / (2 * RUN_WORLD.gravityHold)
const FULL_JUMP =
  (RUN_WORLD.jumpVelocity / RUN_WORLD.gravityHold +
    Math.sqrt((2 * FULL_APEX) / RUN_WORLD.gravity)) *
  RUN_WORLD.speed

type Obstacle = { kind: 'hurdle'; hurdle: RunHurdle } | { kind: 'gap'; gap: RunGap }

/** Die Hindernisse auf seiner Etage, die noch vor ihm liegen – das nächste zuerst. */
function obstaclesAhead(round: RunRound): Obstacle[] {
  return [
    ...round.hurdles
      .filter((h) => !h.passed && !h.touched && h.base === round.base)
      .map((hurdle) => ({ kind: 'hurdle' as const, hurdle })),
    ...round.gaps
      .filter((g) => round.base === 0 && !g.passed && !g.bridged && g.x > round.distance)
      .map((gap) => ({ kind: 'gap' as const, gap })),
  ]
    .filter((obstacle) => idealLead(obstacle).at > round.distance)
    .sort((a, b) => idealLead(a).at - idealLead(b).at)
}

/** Das nächste Hindernis auf seiner Etage. */
function nextObstacle(round: RunRound): Obstacle | null {
  return obstaclesAhead(round)[0] ?? null
}

/**
 * Wie weit vor dem Hindernis der beste Absprung liegt: bei einer Hürde,
 * wenn ihre Mitte so weit weg ist, wie der Sprung bis zum Scheitel trägt;
 * bei einer Lücke so, dass der volle Sprung mittig darüber liegt.
 */
function idealLead(obstacle: Obstacle): { at: number; lead: number } {
  return obstacle.kind === 'hurdle'
    ? { at: obstacle.hurdle.x + obstacle.hurdle.w / 2, lead: RUN_WORLD.speed * 0.38 }
    : { at: obstacle.gap.x, lead: (FULL_JUMP - obstacle.gap.w) / 2 }
}

/** Springt im besten Moment über alles auf seiner Etage – am Boden und oben. */
function perfectRunner(round: RunRound, options: { short?: boolean } = {}) {
  if (!round.grounded && (options.short || round.vy <= 0)) round.release()
  if (!round.grounded) return
  const next = nextObstacle(round)
  if (!next) return
  const { at, lead } = idealLead(next)
  if (at - round.distance <= lead) round.press()
}

function runUntil(
  round: RunRound,
  kind: RunEvent['kind'],
  policy: (round: RunRound) => void = () => {},
): RunEvent {
  for (let index = 0; index < 120 * 120; index += 1) {
    policy(round)
    const found = round.step(1 / 120).find((event) => event.kind === kind)
    if (found) return found
  }
  throw new Error(`kein ${kind}`)
}

/** Alles, was eine Runde je angelegt hat – auch was längst hinter ihm liegt. */
function collectWorld(seed: number, seconds: number) {
  const round = new RunRound(seededRandom(seed))
  const hurdles = new Map<number, RunHurdle>()
  const gaps = new Map<number, RunGap & { firstSeen: number }>()
  const platforms = new Map<number, RunPlatform & { firstSeen: number }>()
  const tasks = new Map<number, RunTask>()
  let firstGapReached: number | null = null
  while (round.time < seconds && !round.over) {
    perfectRunner(round)
    round.step(1 / 120)
    for (const h of round.hurdles) hurdles.set(h.id, h)
    for (const g of round.gaps) {
      if (!gaps.has(g.id)) gaps.set(g.id, { ...g, firstSeen: round.time })
      if (firstGapReached === null && g.x <= round.distance) firstGapReached = round.time
    }
    for (const p of round.platforms)
      if (!platforms.has(p.id)) platforms.set(p.id, { ...p, firstSeen: round.time })
    for (const t of round.tasks) tasks.set(t.id, t)
  }
  return {
    round,
    hurdles: [...hurdles.values()],
    gaps: [...gaps.values()],
    platforms: [...platforms.values()],
    tasks: [...tasks.values()],
    firstGapReached,
  }
}

test('Laufen: ein voller Sprung im richtigen Moment schafft jede Hürde', () => {
  for (const shape of Object.keys(RUN_HURDLE_SHAPES) as (keyof typeof RUN_HURDLE_SHAPES)[]) {
    const round = new RunRound(seededRandom(5))
    // Die erste Hürde bekommt die Form, um die es geht.
    while (round.hurdles.length === 0) round.step(1 / 120)
    const first = round.hurdles[0]
    first.w = RUN_HURDLE_SHAPES[shape].w
    first.h = RUN_HURDLE_SHAPES[shape].h
    const event = runUntil(round, 'clear', perfectRunner)
    assert.ok(event.kind === 'clear' && event.hurdle === first, shape)
    assert.equal(round.lives, RUN_LIVES, `${shape}: getroffen`)
  }
})

test('Laufen: ein kurzer Hüpfer reicht nicht über eine hohe Hürde', () => {
  const round = new RunRound(seededRandom(5))
  while (round.hurdles.length === 0) round.step(1 / 120)
  const first = round.hurdles[0]
  first.w = RUN_HURDLE_SHAPES.tall.w
  first.h = RUN_HURDLE_SHAPES.tall.h
  const event = runUntil(round, 'hit', (r) => perfectRunner(r, { short: true }))
  assert.ok(event.kind === 'hit' && event.hurdle === first)
})

test('Laufen: drei Treffer beenden die Runde – dazwischen kurz unverwundbar', () => {
  const round = new RunRound(seededRandom(9))
  runUntil(round, 'hit')
  assert.equal(round.lives, RUN_LIVES - 1)
  assert.ok(round.invulnerable > 0)
  const events: RunEvent[] = []
  while (!round.over && round.time < 60) events.push(...round.step(1 / 120))
  const wounds = events.filter(
    (event) => event.kind === 'hit' || (event.kind === 'fall' && event.hurt),
  )
  assert.equal(wounds.length, RUN_LIVES - 1)
  assert.equal(events.at(-1)?.kind, 'over')
  assert.equal(round.lives, 0)
  // Ohne Sprung kein Punkt für ein Hindernis – auch nicht, wenn er unverwundbar hindurchlief.
  assert.equal(
    events.some((event) => event.kind === 'clear' || event.kind === 'leap'),
    false,
  )
})

test('Laufen: zehn Hindernisse am Stück heilen eine Wunde', () => {
  const round = new RunRound(seededRandom(21))
  runUntil(round, 'hit')
  assert.equal(round.lives, RUN_LIVES - 1)
  let healed = false
  let overcome = 0
  while (!healed && round.time < 120) {
    perfectRunner(round)
    for (const event of round.step(1 / 120)) {
      assert.ok(event.kind !== 'hit' && event.kind !== 'fall', `${event.kind} bei ${round.time}`)
      if (event.kind === 'clear' || event.kind === 'leap') {
        overcome += 1
        healed = event.healed
      }
    }
  }
  assert.ok(healed, 'nach zehn Hindernissen geheilt')
  assert.equal(overcome, RUN_STREAK_FOR_LIFE)
  assert.equal(round.lives, RUN_LIVES)
  assert.equal(round.streak, RUN_STREAK_FOR_LIFE)
})

test('Laufen: zwischen zwei Hindernissen am Boden bleibt immer Platz zum Landen', () => {
  for (const seed of [4, 11, 27, 64]) {
    const world = collectWorld(seed, 60)
    const ground = [
      ...world.hurdles.filter((h) => h.base === 0).map((h) => ({ x: h.x, end: h.x + h.w })),
      ...world.gaps.map((g) => ({ x: g.x, end: g.x + g.w })),
    ].sort((a, b) => a.x - b.x)
    assert.ok(ground.length >= 20, `nur ${ground.length} Hindernisse`)
    for (let index = 1; index < ground.length; index += 1) {
      const space = ground[index].x - ground[index - 1].end
      assert.ok(space >= RUN_PACE.gapMin * RUN_WORLD.speed - 1e-9, `Abstand ${space.toFixed(2)}`)
    }
  }
})

test('Laufen: Lücken erst nach etwa fünf Sekunden – mit einem Brett darüber, die zweite Etage später', () => {
  for (const seed of [3, 8, 15, 42]) {
    const world = collectWorld(seed, 40)
    assert.ok(world.firstGapReached !== null, 'keine Lücke')
    assert.ok(
      world.firstGapReached >= 4.5 && world.firstGapReached <= 9,
      `erste Lücke nach ${world.firstGapReached.toFixed(1)} s`,
    )
    // Die erste Lücke führt die Etage ein: Über ihr liegt ein Brett.
    const first = [...world.gaps].sort((a, b) => a.x - b.x)[0]
    assert.ok(
      world.platforms.some(
        (p) => p.level === 1 && p.x <= first.x && p.x + p.w >= first.x + first.w,
      ),
      'kein Brett über der ersten Lücke',
    )
    const upper = world.platforms.filter((p) => p.level === 2)
    assert.ok(upper.length > 0, 'keine zweite Etage')
    assert.ok(
      upper.every((p) => p.firstSeen >= RUN_PACE.upperFrom),
      'zweite Etage zu früh',
    )
  }
})

test('Laufen: jede Lücke ist mit einem vollen Sprung zu schaffen', () => {
  assert.ok(RUN_PACE.holeLate < FULL_JUMP - 1.5, `Lücke ${RUN_PACE.holeLate} zu breit`)
  const round = new RunRound(seededRandom(5))
  const gap: RunGap = {
    id: 9999,
    x: 2.5,
    w: RUN_PACE.holeLate,
    item: RUN_GAPS[0],
    passed: false,
    bridged: false,
    atLevel: null,
  }
  round.gaps.push(gap)
  const event = runUntil(round, 'leap', perfectRunner)
  assert.ok(event.kind === 'leap' && event.gap === gap)
  assert.equal(round.lives, RUN_LIVES)
  assert.equal(round.points, 1)
})

test('Laufen: wer in eine Lücke fällt, ist verwundet – und läuft auf einer Brücke weiter', () => {
  const round = new RunRound(seededRandom(5))
  const gap: RunGap = {
    id: 9999,
    x: 2,
    w: 2,
    item: RUN_GAPS[1],
    passed: false,
    bridged: false,
    atLevel: null,
  }
  round.gaps.push(gap)
  const event = runUntil(round, 'fall')
  assert.ok(event.kind === 'fall' && event.gap === gap && event.hurt)
  assert.equal(round.lives, RUN_LIVES - 1)
  assert.ok(gap.bridged, 'keine Brücke')
  assert.ok(round.invulnerable > 0)
  runUntil(round, 'land')
  assert.equal(round.y, 0)
  assert.ok(round.groundAt(gap.x + gap.w / 2), 'die Brücke trägt')
  // Für eine Lücke, in die er fiel, gibt es keinen Punkt.
  while (!gap.passed) round.step(1 / 120)
  assert.equal(round.points, 0)
})

test('Laufen: vom Boden auf die erste Etage, von dort auf die zweite – nie direkt hinauf', () => {
  const [, first, second] = RUN_LEVELS
  assert.ok(first < FULL_APEX - 0.4, 'erste Etage zu hoch')
  assert.ok(second > FULL_APEX + 0.4, 'zweite Etage vom Boden aus erreichbar')
  assert.ok(second - first < FULL_APEX - 0.4, 'zweite Etage von der ersten aus zu hoch')

  // Hinauf: gedrückt halten bis zum Scheitel – er landet oben.
  const round = new RunRound(seededRandom(5))
  round.platforms.push({ id: 9001, x: 2, w: 6, level: 1, top: first })
  round.platforms.push({ id: 9002, x: 5, w: 6, level: 2, top: second })
  round.press()
  runUntil(round, 'land', (r) => {
    if (r.vy <= 0) r.release()
  })
  assert.equal(round.base, first)
  // Von dort aus die zweite.
  round.press()
  runUntil(round, 'land', (r) => {
    if (r.vy <= 0) r.release()
  })
  assert.equal(round.base, second)
  // Am Ende des Bretts fällt er hinunter – bis auf den Boden.
  while (round.base !== 0) round.step(1 / 120)
  assert.equal(round.y, 0)

  // Vom Boden aus kommt kein Sprung auf die zweite Etage.
  const low = new RunRound(seededRandom(5))
  low.platforms.push({ id: 9003, x: 2, w: 8, level: 2, top: second })
  low.press()
  runUntil(low, 'land', (r) => {
    if (r.vy <= 0) r.release()
  })
  assert.equal(low.base, 0)
})

test('Laufen: wer oben über eine Hürde hinwegläuft, bekommt keinen Punkt dafür', () => {
  const round = new RunRound(seededRandom(5))
  round.platforms.push({ id: 9001, x: -1, w: 12, level: 1, top: RUN_LEVELS[1] })
  round.y = RUN_LEVELS[1]
  round.base = RUN_LEVELS[1]
  while (round.hurdles.length === 0) round.step(1 / 120)
  const first = round.hurdles[0]
  first.x = 6
  const events: RunEvent[] = []
  while (!first.passed) events.push(...round.step(1 / 120))
  assert.equal(
    events.some((event) => event.kind === 'clear' || event.kind === 'hit'),
    false,
  )
  assert.equal(round.points, 0)
})

test('Laufen: oben steht später auch eine Ausrede – darunter bleibt der Boden frei', () => {
  // Wer oben über sie springt, bekommt den Punkt wie am Boden.
  const round = new RunRound(seededRandom(5))
  round.platforms.push({ id: 9001, x: -1, w: 14, level: 1, top: RUN_LEVELS[1] })
  round.y = RUN_LEVELS[1]
  round.base = RUN_LEVELS[1]
  while (round.hurdles.length === 0) round.step(1 / 120)
  const up = round.hurdles[0]
  up.x = 5
  up.base = RUN_LEVELS[1]
  const event = runUntil(round, 'clear', perfectRunner)
  assert.ok(event.kind === 'clear' && event.hurdle === up)
  assert.equal(round.lives, RUN_LIVES)

  // Unter einem Brett mit Ausrede liegt nichts: Unten ist es sicher, oben gibt es mehr.
  let seen = 0
  for (const seed of [2, 13, 29, 57, 88]) {
    const world = collectWorld(seed, 45)
    for (const hurdle of world.hurdles.filter((h) => h.base > 0)) {
      const p = world.platforms.find((q) => q.x <= hurdle.x && q.x + q.w >= hurdle.x + hurdle.w)
      assert.ok(p, 'Ausrede ohne Brett')
      seen += 1
      const below = [
        ...world.hurdles.filter((h) => h.base === 0).map((h) => [h.x, h.x + h.w]),
        ...world.gaps.map((g) => [g.x, g.x + g.w]),
      ].some(([a, b]) => b > p.x && a < p.x + p.w)
      assert.ok(!below, 'unter dem Brett mit Ausrede liegt ein Hindernis')
      assert.ok(hurdle.x >= RUN_PACE.upHurdlesFrom * RUN_WORLD.speed, 'Ausrede oben zu früh')
    }
  }
  assert.ok(seen > 0, 'oben stand nie eine Ausrede')
})

test('Laufen: oben liegen mehr Aufgaben – und unter jedem Brettende ist Platz zum Landen', () => {
  for (const seed of [6, 19, 33, 71]) {
    const world = collectWorld(seed, 45)
    const on = (p: RunPlatform) =>
      world.tasks.filter((t) => t.y > p.top && t.y < p.top + 2 && t.x >= p.x && t.x <= p.x + p.w)
        .length
    const upper = world.platforms.filter((p) => p.level === 2)
    const lower = world.platforms.filter((p) => p.level === 1)
    assert.ok(lower.length >= 3, `nur ${lower.length} Bretter`)
    for (const p of upper) assert.equal(on(p), 3, 'drei Aufgaben auf der zweiten Etage')
    for (const p of lower) {
      const above = upper.some((q) => q.x >= p.x && q.x + q.w <= p.x + p.w)
      if (!above) assert.ok(on(p) >= 2, 'mindestens zwei Aufgaben auf der ersten Etage')
      // Darunter höchstens eine Aufgabe am Boden.
      const below = world.tasks.filter((t) => t.y < 1 && t.x >= p.x && t.x <= p.x + p.w)
      assert.ok(below.length <= 1, 'zu viel am Boden unter dem Brett')
      // Wo das Brett endet, liegt weder Lücke noch Hürde: Wer herunterfällt, landet.
      const end = p.x + p.w
      const blocked = [
        ...world.hurdles.filter((h) => h.base === 0).map((h) => [h.x, h.x + h.w]),
        ...world.gaps.map((g) => [g.x, g.x + g.w]),
      ].some(([a, b]) => b > end - 1.2 && a < end + RUN_PACE.landing)
      assert.ok(!blocked, `Brettende bei ${end.toFixed(1)} nicht frei`)
      // Eine Ausrede oben steht ganz auf dem Brett – mit Anlauf davor und Platz danach.
      for (const h of world.hurdles.filter((h) => h.base === p.top && h.x >= p.x && h.x < end)) {
        assert.ok(h.x >= p.x + 2 && h.x + h.w <= end - 1.4, 'Ausrede zu nah am Brettrand')
      }
    }
    if (world.round.time >= RUN_PACE.upHurdlesFrom + 10) {
      assert.ok(
        world.hurdles.some((h) => h.base > 0),
        'oben steht nie eine Ausrede',
      )
    }
    // Von der zweiten Etage fällt man auf die erste, nicht daneben.
    for (const q of upper) {
      assert.ok(
        lower.some((p) => p.x <= q.x && p.x + p.w >= q.x + q.w + 2 - 1e-9),
        'unter dem Ende der zweiten Etage fehlt die erste',
      )
    }
  }
})

/**
 * Ein nachgebildeter Läufer: sieht ein Hindernis, sobald es auftaucht,
 * und braucht eine Reaktionszeit, bevor er handeln kann. Er will im
 * besten Moment abspringen, liegt aber um eine Streuung (in echten
 * Sekunden) daneben – je schneller die Welt, desto weiter ist das. Ab und
 * zu passt er nicht auf. Er springt immer voll; landet er dabei auf einem
 * Brett, läuft er oben weiter, bis es endet – und springt dort über die
 * Ausreden seiner Etage. Aufgaben jagt er nicht.
 */
function playRun(player: { reaction: number; timing: number; lapse: number }, seed: number) {
  const round = new RunRound(seededRandom(seed))
  const noise = seededRandom(seed * 7919 + 13)
  const gauss = gaussian(noise)
  const plans = new Map<number, { seen: number; offset: number; skip: boolean; done: boolean }>()
  while (!round.over && round.time < 300) {
    round.step(1 / 120)
    if (!round.grounded && round.vy <= 0) round.release()
    if (!round.grounded) continue
    for (const obstacle of obstaclesAhead(round)) {
      const { at, lead } = idealLead(obstacle)
      const left = at - round.distance
      if (left > RUN_WORLD.ahead) break
      const id = obstacle.kind === 'hurdle' ? obstacle.hurdle.id : obstacle.gap.id
      if (!plans.has(id))
        plans.set(id, {
          seen: round.time + Math.max(0.12, player.reaction + 0.05 * gauss()),
          offset: player.timing * gauss(),
          skip: noise() < player.lapse,
          done: false,
        })
      const plan = plans.get(id)!
      if (plan.done || plan.skip) continue
      // Die Abweichung in echten Sekunden wird beim jetzigen Tempo zu einer Strecke.
      const target = lead + plan.offset * RUN_WORLD.speed * runTempo(round.time)
      if (round.time >= plan.seen && left <= target) {
        round.press()
        plan.done = true
      }
      break
    }
  }
  return { seconds: round.time, points: round.points }
}

test('Laufen: eine Runde dauert 20 bis 60 Sekunden – vom Anfänger bis zur Spitze', () => {
  const play = (player: Parameters<typeof playRun>[0]) =>
    Array.from({ length: 200 }, (_, index) => playRun(player, 500 + index))
  assertRoundLengths('Laufen', {
    beginner: play({ reaction: 0.45, timing: 0.075, lapse: 0.03 }),
    average: play({ reaction: 0.35, timing: 0.055, lapse: 0.015 }),
    top: play({ reaction: 0.25, timing: 0.03, lapse: 0.004 }),
  })
})

/* ------------------------------------------------------------------ */
/* «Ketten sprengen»                                                   */
/* ------------------------------------------------------------------ */

test('Ketten: genug Notlügen, kurz genug für einen Platz', () => {
  assert.ok(CHAIN_LIES.length >= 6)
  itemsAreClean([...CHAIN_LIES, CHAIN_KEY], 20)
})

test('Ketten: je früher gesprengt, desto mehr Punkte', () => {
  assert.equal(chainPoints(0, 3), 3)
  assert.equal(chainPoints(0.99, 3), 3)
  assert.equal(chainPoints(1, 3), 2)
  assert.equal(chainPoints(1.99, 3), 2)
  assert.equal(chainPoints(2, 3), 1)
  assert.equal(chainPoints(2.99, 3), 1)
})

test('Ketten: Tempo wird nur schneller', () => {
  let previous = chainPace(0)
  assert.ok(previous.life >= 2, 'am Anfang bleibt Zeit')
  for (let t = 1; t <= 70; t += 1) {
    const pace = chainPace(t)
    assert.ok(pace.life <= previous.life + 1e-9, `life bei ${t}s`)
    assert.ok(pace.gap <= previous.gap + 1e-9, `gap bei ${t}s`)
    previous = pace
  }
})

function chainUntil(round: ChainRound, done: (round: ChainRound) => boolean): void {
  for (let index = 0; index < 120 * 120 && !done(round); index += 1) round.step(1 / 120)
  assert.ok(done(round), 'nie eingetreten')
}

const emptySlot = (round: ChainRound) =>
  Array.from({ length: CHAIN_SLOTS }, (_, slot) => slot).find((slot) => !round.at(slot))

test('Ketten: ein Tipp sprengt, ein Tipp ins Leere lähmt kurz', () => {
  const round = new ChainRound(seededRandom(2))
  chainUntil(round, (r) => r.locks.some((lock) => !lock.key))
  const lock = round.locks.find((entry) => !entry.key)!
  const [event] = round.tap(lock.slot)
  assert.ok(event.kind === 'break' && event.points === 3)
  assert.equal(round.points, 3)
  // Ins Leere: gelähmt – solange nimmt das Feld keinen Tipp an.
  assert.equal(round.tap(emptySlot(round)!)[0].kind, 'miss')
  assert.ok(Math.abs(round.lockedUntil - round.time - CHAIN_MISS_LOCK) < 1e-9)
  assert.equal(round.tap(emptySlot(round)!).length, 0)
  chainUntil(round, (r) => r.time >= r.lockedUntil)
  assert.equal(round.tap(emptySlot(round)!)[0].kind, 'miss')
})

test('Ketten: wird eine Notlüge zur Kette, kostet sie ein Leben – drei, und es ist vorbei', () => {
  const round = new ChainRound(seededRandom(8))
  const events: ChainEvent[] = []
  while (!round.over && round.time < 60) events.push(...round.step(1 / 120))
  assert.equal(events.filter((event) => event.kind === 'snap').length, CHAIN_LIVES)
  assert.equal(events.at(-1)?.kind, 'over')
  assert.equal(round.points, 0)
  assert.equal(round.locks.length, 0)
})

test('Ketten: der Schlüssel sprengt alles auf dem Feld und bringt ein Leben zurück', () => {
  const round = new ChainRound(seededRandom(13))
  // Eine zuschnappen lassen, damit ein Leben fehlt …
  chainUntil(round, (r) => r.lives < CHAIN_LIVES)
  // … dann Notlügen erst spät sprengen, damit welche liegen, wenn der Schlüssel kommt.
  let key: ChainLock | undefined
  for (let index = 0; index < 120 * 60 && !key; index += 1) {
    round.step(1 / 120)
    for (const lock of round.locks)
      if (!lock.key && round.time - lock.spawn > lock.life * 0.8) round.tap(lock.slot)
    key = round.locks.find((lock) => lock.key)
  }
  assert.ok(key, 'kein Schlüssel')
  chainUntil(round, (r) => r.locks.filter((lock) => !lock.key).length >= 1)
  const lies = round.locks.filter((lock) => !lock.key)
  const lives = round.lives
  const before = round.points
  const [event] = round.tap(key.slot)
  assert.ok(event.kind === 'key')
  assert.equal(event.broken.length, lies.length)
  assert.equal(
    round.points - before,
    event.broken.reduce((sum, entry) => sum + entry.points, 0),
  )
  assert.equal(round.locks.length, 0)
  assert.equal(round.lives, Math.min(CHAIN_LIVES, lives + 1))
  assert.equal(event.healed, lives < CHAIN_LIVES)
})

test('Ketten: eine neue Notlüge nie auf einem besetzten oder eben benutzten Platz', () => {
  const round = new ChainRound(seededRandom(17))
  const known = new Set<number>()
  const order: ChainLock[] = []
  while (round.time < 40 && !round.over) {
    const occupied = new Set(round.locks.map((lock) => lock.slot))
    round.step(1 / 120)
    for (const lock of round.locks) {
      if (known.has(lock.id)) continue
      known.add(lock.id)
      assert.ok(!occupied.has(lock.slot), 'auf einem besetzten Platz')
      const recent = order.slice(-2).map((entry) => entry.slot)
      const others = CHAIN_SLOTS - new Set([...occupied, ...recent]).size
      if (others > 0) assert.ok(!recent.includes(lock.slot), 'zweimal dieselbe Stelle')
      order.push(lock)
      occupied.add(lock.slot)
    }
    // Sprengen, was älter als eine halbe Lebenszeit ist – das Feld bleibt halb voll.
    for (const lock of round.locks)
      if (round.time - lock.spawn > lock.life * 0.5) round.tap(lock.slot)
  }
  assert.ok(order.length > 40, `nur ${order.length}`)
})

/**
 * Ein nachgebildeter Spieler auf dem Feld: erkennt eine Notlüge eine
 * Reaktionszeit nach dem Auftauchen, braucht von Tipp zu Tipp einen
 * Moment für den Weg dorthin und sprengt die dringendste zuerst. Den
 * Schlüssel nimmt er, wenn er sich lohnt. Ab und zu tippt er daneben.
 */
function playChain(
  player: { reaction: number; spread: number; move: number; moveSpread: number; error: number },
  seed: number,
) {
  const round = new ChainRound(seededRandom(seed))
  const noise = seededRandom(seed * 7919 + 13)
  const gauss = gaussian(noise)
  const seen = new Map<number, number>()
  let nextTap = 0
  while (!round.over && round.time < 300) {
    round.step(1 / 120)
    for (const lock of round.locks)
      if (!seen.has(lock.id))
        seen.set(lock.id, lock.spawn + Math.max(0.15, player.reaction + player.spread * gauss()))
    if (round.time < nextTap || round.time < round.lockedUntil) continue
    const visible = round.locks.filter((lock) => seen.get(lock.id)! <= round.time)
    if (visible.length === 0) continue
    const lies = visible.filter((lock) => !lock.key)
    const key = visible.find((lock) => lock.key)
    const target =
      key && (lies.length >= 2 || round.lives < CHAIN_LIVES || lies.length === 0)
        ? key
        : [...lies].sort((a, b) => a.spawn + a.life - (b.spawn + b.life))[0]
    round.tap(noise() < player.error ? (emptySlot(round) ?? target.slot) : target.slot)
    nextTap = round.time + Math.max(0.08, player.move + player.moveSpread * gauss())
  }
  return { seconds: round.time, points: round.points }
}

test('Ketten: eine Runde dauert 20 bis 60 Sekunden – vom Anfänger bis zur Spitze', () => {
  const play = (player: Parameters<typeof playChain>[0]) =>
    Array.from({ length: 200 }, (_, index) => playChain(player, 500 + index))
  assertRoundLengths('Ketten', {
    beginner: play({ reaction: 0.5, spread: 0.12, move: 0.42, moveSpread: 0.1, error: 0.05 }),
    average: play({ reaction: 0.4, spread: 0.1, move: 0.32, moveSpread: 0.08, error: 0.03 }),
    top: play({ reaction: 0.3, spread: 0.06, move: 0.22, moveSpread: 0.05, error: 0.01 }),
  })
})
