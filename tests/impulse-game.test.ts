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
  RUN_TASK_RADIUS,
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

test('Minispiel: ein Video mit Platz zwischen Teilen-Aufgabe und Spiel führt ins Spiel ein', () => {
  const cards = [
    { id: 'spiel', kind: 'spiel' as const, order: 14 },
    { id: 'trailer', kind: 'video' as const, order: 13.5 },
    { id: 'teilen', kind: 'teilen' as const, order: 13 },
    { id: 'neu', kind: 'video' as const, order: 15 },
    { id: 'quiz', kind: 'quiz' as const, order: 12 },
    { id: 'impuls', kind: 'impuls' as const, order: 0 },
  ]
  assert.deepEqual(
    deckOrder(cards).map((card) => card.id),
    // Ein Video, das die Redaktion neu anhängt (Platz hinter dem Spiel), bleibt vor der Teilen-Aufgabe.
    ['impuls', 'quiz', 'neu', 'teilen', 'trailer', 'spiel'],
  )
  // Ohne Spiel gibt es nichts einzuführen – das Video steht bei den Karten.
  assert.deepEqual(
    deckOrder(cards.filter((card) => card.kind !== 'spiel')).map((card) => card.id),
    ['impuls', 'quiz', 'trailer', 'neu', 'teilen'],
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

const W = RUN_WORLD
/** Wie weit die Füsse über eine Kante hinaus noch tragen. */
const SUPPORT = W.runnerWidth / 2 - W.forgive
const HALF = W.runnerWidth / 2
/** Ein voller Sprung vom Boden: wie hoch – und wie weit, bis er wieder unten ist. */
const FULL_APEX = W.jumpVelocity ** 2 / (2 * W.gravityHold)
const FULL_JUMP =
  (W.jumpVelocity / W.gravityHold + Math.sqrt((2 * FULL_APEX) / W.gravity)) * W.speed
/** Wie weit ein voller Sprung von der ersten Etage bis auf den Boden trägt. */
const FULL_FROM_FIRST =
  (W.jumpVelocity / W.gravityHold + Math.sqrt((2 * (FULL_APEX + RUN_LEVELS[1])) / W.gravity)) *
  W.speed
/** Was der Nachsprung an der Kante noch dazugibt. */
const COYOTE = W.coyote * W.speed

/** Trägt an der Stelle `x` eine Fläche der Höhe `top`? */
function supports(round: RunRound, x: number, top: number): boolean {
  return top === 0 ? round.groundAt(x) : round.platformAt(x, top) !== null
}

/**
 * Ein Flug, nachgerechnet: ab (x0, y0) mit `vy0` nach oben, gehalten bis
 * zum Scheitel – so springt der Läufer im Test immer. Gibt zurück, wo er
 * landet, oder `null`, wenn er dabei in eine Lücke fällt oder an eine
 * Hürde stösst.
 */
function flight(
  round: RunRound,
  x0: number,
  y0: number,
  vy0: number,
): { x: number; top: number } | null {
  const rise = vy0 > 0 ? vy0 / W.gravityHold : 0
  const peak = y0 + (vy0 > 0 ? vy0 ** 2 / (2 * W.gravityHold) : 0)
  const yAt = (t: number) =>
    t <= rise
      ? y0 + vy0 * t - (W.gravityHold * t * t) / 2
      : peak - (W.gravity * (t - rise) ** 2) / 2
  let landing: { t: number; top: number } | null = null
  for (const top of [...RUN_LEVELS].reverse()) {
    if (top > peak + 1e-9) continue
    const t = rise + Math.sqrt((2 * (peak - top)) / W.gravity)
    if (t < 1e-6) continue
    if (supports(round, x0 + W.speed * t, top)) {
      landing = { t, top }
      break
    }
  }
  if (!landing) return null
  for (const h of round.hurdles) {
    if (h.passed || h.touched) continue
    const a = Math.max(0, (h.x + W.forgive - HALF - x0) / W.speed)
    const b = Math.min(landing.t, (h.x + h.w - W.forgive + HALF - x0) / W.speed)
    if (a > b) continue
    const rel = [a, b, ...(rise > a && rise < b ? [rise] : [])].map((t) => yAt(t) - h.base)
    if (Math.max(...rel) >= -0.05 && Math.min(...rel) < h.h - W.forgive) return null
  }
  return { x: x0 + W.speed * landing.t, top: landing.top }
}

interface Hazard {
  /** Wo es spätestens schiefgeht – an dieser Stelle der Läufermitte. */
  x: number
  /** Woran es hängt: die Hürde, die Lücke oder das Brett, dessen Ende droht. */
  key: string
  /** Ab wo man es kommen sieht: die Stelle, die zuerst ins Bild rückt. */
  visibleFrom: number
}

/**
 * Was ihn auf seiner Etage als Nächstes verwundet, wenn er einfach
 * weiterläuft: eine Hürde – oder eine Kante, hinter der er ins Leere
 * fällt. Wo er von einem Brett sicher eine Etage tiefer fällt, droht
 * nichts.
 */
function nextHazard(round: RunRound): Hazard | null {
  const d = round.distance
  const base = round.base
  let hazard: Hazard | null = null
  for (const h of round.hurdles) {
    if (h.passed || h.touched || h.base !== base) continue
    const start = h.x + W.forgive - HALF
    if (start > d && (!hazard || start < hazard.x))
      hazard = { x: start, key: `h${h.id}`, visibleFrom: h.x }
  }
  let edge: Hazard | null = null
  if (base === 0) {
    for (const g of round.gaps) {
      const lose = g.x + SUPPORT
      if (!g.bridged && lose > d && (edge === null || lose < edge.x))
        edge = { x: lose, key: `g${g.id}`, visibleFrom: g.x }
    }
  } else {
    const p = round.platformAt(d, base)
    if (p) edge = { x: p.x + p.w + SUPPORT, key: `p${p.id}`, visibleFrom: p.x + p.w }
  }
  if (edge !== null && (!hazard || edge.x < hazard.x)) {
    if (!flight(round, edge.x + 0.01, base, 0)) return edge
    if (hazard && hazard.x > edge.x) return null
  }
  return hazard
}

/**
 * Wo er abspringen muss, damit ein voller Sprung sicher landet – jenseits
 * der Gefahr oder auf einer anderen Etage. Gibt die Mitte des ersten
 * solchen Fensters zurück (so landet er mitten auf dem nächsten Stein,
 * nicht an dessen Rand), `null`, wenn es keines gibt.
 */
function planJump(round: RunRound, hazard: Hazard): number | null {
  const windows: [number, number][] = []
  let open: number | null = null
  const step = 0.05
  for (let x = round.distance; x <= hazard.x + 1e-9; x += step) {
    const landing = flight(round, x, round.base, W.jumpVelocity)
    const ok = landing !== null && (landing.top !== round.base || landing.x > hazard.x)
    if (ok && open === null) open = x
    if (!ok && open !== null) {
      windows.push([open, x - step])
      open = null
    }
  }
  if (open !== null) windows.push([open, hazard.x])
  const first = windows[0]
  return first ? (first[0] + first[1]) / 2 : null
}

const plans = new WeakMap<RunRound, { key: string; at: number | null }>()

/**
 * Der perfekte Läufer: sieht die nächste Gefahr auf seiner Etage, rechnet
 * das Fenster aus, in dem ein voller Sprung sicher landet, und springt
 * genau in dessen Mitte. Auf ein Brett, aufs obere, auf einen Trittstein
 * – was immer ihn weiterbringt. Aufgaben jagt er nicht.
 */
function perfectRunner(round: RunRound, options: { short?: boolean } = {}) {
  if (!round.grounded && (options.short || round.vy <= 0)) round.release()
  if (!round.grounded) return
  const hazard = nextHazard(round)
  if (!hazard) return
  let plan = plans.get(round)
  if (!plan || plan.key !== hazard.key) {
    plan = { key: hazard.key, at: planJump(round, hazard) }
    plans.set(round, plan)
  }
  if (plan.at !== null && round.distance >= plan.at) round.press()
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
function collectWorld(seed: number, seconds: number, policy = perfectRunner) {
  const round = new RunRound(seededRandom(seed))
  const hurdles = new Map<number, RunHurdle>()
  const gaps = new Map<number, RunGap & { firstSeen: number }>()
  const platforms = new Map<number, RunPlatform & { firstSeen: number }>()
  const tasks = new Map<number, RunTask>()
  const events: RunEvent[] = []
  let firstGapReached: number | null = null
  while (round.time < seconds && !round.over) {
    policy(round)
    events.push(...round.step(1 / 120))
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
    events,
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

test('Laufen: ein perfekter Läufer kommt über jede Strecke – ohne eine Wunde', () => {
  // Jede Prüfung ist zu schaffen: Kluft, Trittsteine, Gabelung, weite Lücke.
  const kinds = new Set<string>()
  for (let seed = 1; seed <= 14; seed += 1) {
    const world = collectWorld(seed, 60)
    const wound = world.events.find(
      (event) => event.kind === 'hit' || event.kind === 'fall' || event.kind === 'over',
    )
    assert.equal(
      wound,
      undefined,
      `Saat ${seed}: ${wound?.kind} nach ${world.round.time.toFixed(1)} s`,
    )
    for (const p of world.platforms) kinds.add(p.kind)
    if (world.gaps.some((g) => !g.chasm && g.w >= RUN_PACE.preciseMin)) kinds.add('precise')
    if (world.gaps.some((g) => g.chasm)) kinds.add('chasm')
  }
  for (const kind of ['ledge', 'bridge', 'stone', 'deadEnd', 'upper', 'precise', 'chasm'])
    assert.ok(kinds.has(kind), `nie gesehen: ${kind}`)
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
      assert.ok(space >= RUN_PACE.gapMin * W.speed - 1e-9, `Abstand ${space.toFixed(2)}`)
    }
  }
})

test('Laufen: jede Neuheit kommt zu ihrer Zeit – die erste Lücke nach etwa fünf Sekunden, mit Brett', () => {
  for (const seed of [3, 8, 15, 42]) {
    const world = collectWorld(seed, 40)
    assert.ok(world.firstGapReached !== null, 'keine Lücke')
    assert.ok(
      world.firstGapReached >= 4.5 && world.firstGapReached <= 9,
      `erste Lücke nach ${world.firstGapReached.toFixed(1)} s`,
    )
    // Die erste Lücke führt die Etage ein: Über ihr liegt ein Brett, und unten geht es auch.
    const first = [...world.gaps].sort((a, b) => a.x - b.x)[0]
    assert.ok(!first.chasm, 'die erste Lücke ist gleich eine Kluft')
    assert.ok(
      world.platforms.some((p) => p.x <= first.x && p.x + p.w >= first.x + first.w),
      'kein Brett über der ersten Lücke',
    )
    const firstOf = (kind: RunPlatform['kind']) =>
      Math.min(...world.platforms.filter((p) => p.kind === kind).map((p) => p.firstSeen))
    assert.ok(firstOf('bridge') >= RUN_PACE.bridgesFrom, 'Kluft zu früh')
    assert.ok(firstOf('stone') >= RUN_PACE.stonesFrom, 'Trittsteine zu früh')
    assert.ok(firstOf('upper') >= RUN_PACE.forksFrom, 'zweite Etage zu früh')
    const precise = world.gaps.filter((g) => !g.chasm && g.w >= RUN_PACE.preciseMin)
    assert.ok(precise.length > 0, 'keine weite Lücke')
    assert.ok(
      precise.every((g) => g.firstSeen >= RUN_PACE.preciseFrom),
      'weite Lücke zu früh',
    )
  }
})

test('Laufen: eine weite Lücke schafft nur ein voller Sprung im richtigen Moment', () => {
  // Das Fenster dafür ist knapp – aber da.
  const window = FULL_JUMP + 2 * SUPPORT - RUN_PACE.preciseMax
  assert.ok(window >= 1 && window <= 1.8, `Fenster ${window.toFixed(2)} Einheiten`)
  assert.ok(RUN_PACE.holeLate < RUN_PACE.preciseMin)
  const round = new RunRound(seededRandom(5))
  const gap: RunGap = {
    id: 9999,
    x: 2.5,
    w: RUN_PACE.preciseMax,
    item: RUN_GAPS[0],
    passed: false,
    bridged: false,
    atLevel: null,
    chasm: false,
  }
  round.gaps.push(gap)
  const event = runUntil(round, 'leap', perfectRunner)
  assert.ok(event.kind === 'leap' && event.gap === gap)
  assert.equal(round.lives, RUN_LIVES)
  // Ein halber Sprung reicht nicht.
  const short = new RunRound(seededRandom(5))
  short.gaps.push({ ...gap, passed: false, bridged: false, atLevel: null })
  const fall = runUntil(short, 'fall', (r) => perfectRunner(r, { short: true }))
  assert.ok(fall.kind === 'fall')
})

test('Laufen: eine Kluft springt niemand – hinüber kommt nur, wer die Route wählt', () => {
  assert.ok(
    RUN_PACE.chasmMin > FULL_JUMP + 2 * SUPPORT + COYOTE + 0.5,
    'Kluft vom Boden aus zu überspringen',
  )
  // Von der Spitze des unteren Bretts einer Gabelung reicht es auch nicht.
  assert.ok(
    RUN_PACE.forkChasmMin - RUN_PACE.forkOverhang > FULL_FROM_FIRST + 2 * SUPPORT + COYOTE + 0.3,
    'Gabelung: Weitsprung vom unteren Brett reicht',
  )
  // Wer unten bleibt, fällt in die Kluft; wer auf dem unteren Brett der Gabelung bleibt, auch.
  for (const seed of [3, 8, 15]) {
    const world = collectWorld(seed, 40)
    const bridge = world.platforms.find((p) => p.kind === 'bridge')!
    const stay = new RunRound(seededRandom(seed))
    let event: RunEvent | undefined
    while (!event && stay.time < 40) {
      // Bis kurz vor der Brücke perfekt laufen – dann unten bleiben.
      if (stay.distance < bridge.x - 5) perfectRunner(stay)
      event = stay.step(1 / 120).find((e) => e.kind === 'fall' && e.gap.chasm && e.gap.x > bridge.x)
    }
    assert.ok(event, `Saat ${seed}: unten nicht in die Kluft gefallen`)

    const fork = world.platforms.find((p) => p.kind === 'deadEnd')!
    const lazy = new RunRound(seededRandom(seed))
    event = undefined
    while (!event && lazy.time < 60) {
      // Perfekt bis aufs untere Brett der Gabelung – dort nicht mehr springen.
      if (!(lazy.base === fork.top && lazy.distance >= fork.x)) perfectRunner(lazy)
      event = lazy.step(1 / 120).find((e) => e.kind === 'fall' && e.gap.chasm)
    }
    assert.ok(event, `Saat ${seed}: auf dem unteren Brett nicht gefallen`)
  }
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
    chasm: false,
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
  round.platforms.push({ id: 9001, x: 2, w: 6, level: 1, top: first, kind: 'ledge' })
  round.platforms.push({ id: 9002, x: 5, w: 6, level: 2, top: second, kind: 'upper' })
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
  low.platforms.push({ id: 9003, x: 2, w: 8, level: 2, top: second, kind: 'upper' })
  low.press()
  runUntil(low, 'land', (r) => {
    if (r.vy <= 0) r.release()
  })
  assert.equal(low.base, 0)
})

test('Laufen: wer oben über eine Hürde hinwegläuft, bekommt keinen Punkt dafür', () => {
  const round = new RunRound(seededRandom(5))
  round.platforms.push({ id: 9001, x: -1, w: 12, level: 1, top: RUN_LEVELS[1], kind: 'ledge' })
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
  round.platforms.push({ id: 9001, x: -1, w: 14, level: 1, top: RUN_LEVELS[1], kind: 'ledge' })
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
      assert.ok(p && p.kind === 'ledge', 'Ausrede ohne Brett')
      seen += 1
      const below = [
        ...world.hurdles.filter((h) => h.base === 0).map((h) => [h.x, h.x + h.w]),
        ...world.gaps.map((g) => [g.x, g.x + g.w]),
      ].some(([a, b]) => b > p.x && a < p.x + p.w)
      assert.ok(!below, 'unter dem Brett mit Ausrede liegt ein Hindernis')
      assert.ok(hurdle.x >= RUN_PACE.upHurdlesFrom * W.speed, 'Ausrede oben zu früh')
    }
  }
  assert.ok(seen > 0, 'oben stand nie eine Ausrede')
})

test('Laufen: wenige Aufgaben – und keine liegt einfach am Weg', () => {
  for (const seed of [6, 19, 33, 71]) {
    const world = collectWorld(seed, 45)
    const obstacles = world.hurdles.filter((h) => h.base === 0).length + world.gaps.length
    assert.ok(world.tasks.length > 0, 'keine Aufgabe')
    assert.ok(
      world.tasks.length <= obstacles * 0.5,
      `${world.tasks.length} Aufgaben auf ${obstacles} Hindernisse`,
    )
    for (const task of world.tasks) {
      // Die Fläche darunter: Wer dort läuft, streift die Aufgabe nicht – er muss springen.
      const floors = [
        ...world.platforms
          .filter((p) => p.top < task.y && task.x >= p.x && task.x <= p.x + p.w)
          .map((p) => p.top),
        ...(world.gaps.some((g) => task.x > g.x && task.x < g.x + g.w) ? [] : [0]),
      ]
      const floor = floors.length > 0 ? Math.max(...floors) : null
      if (floor !== null)
        assert.ok(
          task.y - RUN_TASK_RADIUS > floor + W.runnerHeight,
          `Aufgabe bei ${task.x.toFixed(1)} liegt am Weg`,
        )
      // … und sie steckt in keinem Brett.
      for (const p of world.platforms) {
        if (task.x < p.x - RUN_TASK_RADIUS || task.x > p.x + p.w + RUN_TASK_RADIUS) continue
        assert.ok(
          task.y - RUN_TASK_RADIUS > p.top || task.y + RUN_TASK_RADIUS < p.top - 0.34,
          `Aufgabe bei ${task.x.toFixed(1)} steckt im Brett`,
        )
      }
    }
  }
})

test('Laufen: unter jedem Brettende ist Platz zum Landen – ausser über einer Kluft', () => {
  for (const seed of [6, 19, 33, 71]) {
    const world = collectWorld(seed, 45)
    for (const p of world.platforms) {
      // Trittsteine und das untere Brett einer Gabelung enden mit Absicht über dem Abgrund.
      if (p.kind === 'stone' || p.kind === 'deadEnd') {
        const end = p.x + p.w
        assert.ok(
          world.gaps.some((g) => g.chasm && g.x < end && g.x + g.w > end),
          `${p.kind} endet nicht über einer Kluft`,
        )
        continue
      }
      const end = p.x + p.w
      const blocked = [
        ...world.hurdles.filter((h) => h.base === 0).map((h) => [h.x, h.x + h.w]),
        ...world.gaps.map((g) => [g.x, g.x + g.w]),
      ].some(([a, b]) => b > end - 1.2 && a < end + RUN_PACE.landing)
      assert.ok(!blocked, `${p.kind}: Brettende bei ${end.toFixed(1)} nicht frei`)
      // Ein Brett der zweiten Etage endet über der ersten – oder über freiem Boden.
    }
  }
})

/**
 * Ein nachgebildeter Läufer: rechnet wie der perfekte, braucht aber eine
 * Reaktionszeit – gezählt ab dem Moment, in dem das, was ihm droht, ins
 * Bild rückt (so plant er wie ein Mensch den zweiten Sprung einer
 * Gabelung schon, bevor er den ersten getan hat). Er springt um eine
 * Streuung (in echten Sekunden) daneben – je schneller die Welt, desto
 * weiter ist das. Ab und zu passt er nicht auf.
 */
function playRun(player: { reaction: number; timing: number; lapse: number }, seed: number) {
  const round = new RunRound(seededRandom(seed))
  const noise = seededRandom(seed * 7919 + 13)
  const gauss = gaussian(noise)
  /** Wann jede Stelle zuerst im Bild war – nach ihrem Schlüssel. */
  const sighted = new Map<string, number>()
  let plan: {
    key: string
    at: number | null
    seen: number
    offset: number
    skip: boolean
    done: boolean
  } | null = null
  while (!round.over && round.time < 300) {
    round.step(1 / 120)
    const horizon = round.distance + W.ahead
    for (const h of round.hurdles)
      if (h.x <= horizon && !sighted.has(`h${h.id}`)) sighted.set(`h${h.id}`, round.time)
    for (const g of round.gaps)
      if (g.x <= horizon && !sighted.has(`g${g.id}`)) sighted.set(`g${g.id}`, round.time)
    for (const p of round.platforms)
      if (p.x + p.w <= horizon && !sighted.has(`p${p.id}`)) sighted.set(`p${p.id}`, round.time)
    if (!round.grounded && round.vy <= 0) round.release()
    if (!round.grounded) continue
    const hazard = nextHazard(round)
    if (!hazard || hazard.visibleFrom > horizon) continue
    if (!plan || plan.key !== hazard.key)
      plan = {
        key: hazard.key,
        at: planJump(round, hazard),
        seen:
          (sighted.get(hazard.key) ?? round.time) +
          Math.max(0.12, player.reaction + 0.05 * gauss()),
        offset: player.timing * gauss(),
        skip: noise() < player.lapse,
        done: false,
      }
    if (plan.done || plan.skip || plan.at === null) continue
    // Die Abweichung in echten Sekunden wird beim jetzigen Tempo zu einer Strecke.
    const target = plan.at + plan.offset * W.speed * runTempo(round.time)
    if (round.time >= plan.seen && round.distance >= target) {
      round.press()
      plan.done = true
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
