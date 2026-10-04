import type { ImpulseGameId, ImpulseGameScore } from './types.ts'

/*
 * Die Minispiele von «Anti Doom» – alles, was sich ohne Leinwand rechnen
 * lässt: die Gegenstände, das Tempo, die Rangliste und der Name darin.
 *
 * Das Spiel selbst zeichnet `components/impulse/game` auf eine Leinwand;
 * was es dort tut, entscheiden die Zahlen hier. So lässt sich prüfen,
 * dass eine Runde wirklich kurz bleibt, ohne ein einziges Bild zu
 * zeichnen (`tests/impulse-game.test.ts` spielt sie mit einem
 * nachgebildeten Spieler durch).
 */

/* ------------------------------------------------------------------ */
/* Name und Punkte                                                     */
/* ------------------------------------------------------------------ */

/** So lang darf ein Name in der Rangliste sein – er steht dann auf jedem Telefon ganz da. */
export const GAME_NAME_MAX = 20

/** Ein Name, wie er in die Liste kommt: ohne doppelte Leerzeichen, nicht zu lang. */
export function cleanGameName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, GAME_NAME_MAX).trim()
}

/**
 * Mehr nehmen die Zugriffsregeln nicht an. Ehrlich kommt niemand auch nur
 * in die Nähe – die Grenze hält bloss Unsinn aus der Liste.
 */
export const GAME_SCORE_MAX = 9999

/** Punkte, wie sie gespeichert werden: eine ganze Zahl zwischen 0 und der Grenze. */
export function cleanGameScore(points: number): number {
  if (!Number.isFinite(points)) return 0
  return Math.min(GAME_SCORE_MAX, Math.max(0, Math.round(points)))
}

/* ------------------------------------------------------------------ */
/* Die Rangliste                                                       */
/* ------------------------------------------------------------------ */

type RankableScore = Pick<ImpulseGameScore, 'uid' | 'name' | 'best' | 'hidden'> & {
  bestAt?: { toMillis(): number } | null
}

export interface GameRankRow<T extends RankableScore = ImpulseGameScore> {
  score: T
  /** Der Platz – bei gleicher Punktzahl derselbe, der nächste überspringt. */
  rank: number
  /** Der eigene Eintrag. */
  own: boolean
}

/**
 * Die Rangliste eines Spiels: je Konto ein Eintrag, der beste Lauf.
 *
 * Gezeigt wird, wer einen Namen eingetragen hat und nicht ausgeblendet
 * ist – der eigene Eintrag immer, auch ohne Namen (die Liste fragt dann
 * danach). Die Redaktion sieht auch Ausgeblendetes (`showHidden`), sonst
 * könnte sie es nicht wieder zeigen.
 *
 * Gleiche Punktzahl heisst gleicher Platz – und wer früher dort war, steht
 * oben: Die Zahl war zuerst da. Ganz zuletzt entscheidet der Name, damit
 * die Reihe stabil bleibt.
 */
export function gameRanking<T extends RankableScore>(
  scores: readonly T[],
  options: { ownUid: string; showHidden?: boolean },
): GameRankRow<T>[] {
  const at = (score: T) => score.bestAt?.toMillis() ?? Number.MAX_SAFE_INTEGER
  const shown = scores
    .filter(
      (score) =>
        score.uid === options.ownUid ||
        (score.name.trim() !== '' && (!score.hidden || options.showHidden === true)),
    )
    .sort((a, b) => b.best - a.best || at(a) - at(b) || a.name.localeCompare(b.name, 'de') || 0)
  let rank = 0
  return shown.map((score, index) => {
    if (index === 0 || score.best !== shown[index - 1].best) rank = index + 1
    return { score, rank, own: score.uid === options.ownUid }
  })
}

export type LeaderboardLine<T extends RankableScore = ImpulseGameScore> =
  { kind: 'row'; row: GameRankRow<T> } | { kind: 'gap' }

/**
 * Die Zeilen, die eine kurze Liste zeigt: die ersten `max` – und der
 * eigene Eintrag immer, auch wenn er weit hinten liegt. Dazwischen steht
 * dann eine Lücke, damit niemand die Plätze dazwischen für ausgelassen
 * hält. Eine Liste, die nur die ersten fünf zeigt, liesse genau den ohne
 * Antwort, der am meisten wissen will, wo er steht.
 */
export function leaderboardLines<T extends RankableScore>(
  rows: readonly GameRankRow<T>[],
  max: number,
): LeaderboardLine<T>[] {
  const top = rows.slice(0, Math.max(0, max))
  const lines: LeaderboardLine<T>[] = top.map((row) => ({ kind: 'row', row }))
  const own = rows.find((row) => row.own)
  if (own && !top.includes(own)) {
    if (rows.indexOf(own) > top.length) lines.push({ kind: 'gap' })
    lines.push({ kind: 'row', row: own })
  }
  return lines
}

/* ------------------------------------------------------------------ */
/* «Gut für dich?» – das Spiel zum Wort der Weisheit                    */
/* ------------------------------------------------------------------ */

/**
 * Ein Gegenstand, der von oben fällt. `good` heisst: gehört nach rechts,
 * «Gut für dich». Alles andere gehört nach links, «Nein, danke».
 *
 * Bewusst nur, was das Wort der Weisheit selbst nennt oder die Kirche
 * dazu klar sagt: Getreide, Obst, Gemüse, Bewegung und Schlaf auf der
 * einen Seite (LuB 89:10–17, 88:124), Alkohol, Tabak, Vapes, Kaffee und
 * Drogen auf der anderen. Pommes und Schokolade fehlen absichtlich – die
 * stünden zu Recht in einer Diskussion, aber nicht in einem Spiel, das in
 * Sekundenbruchteilen ein klares Ja oder Nein verlangt.
 */
export interface SortItem {
  emoji: string
  label: string
  good: boolean
}

export const SORT_ITEMS: readonly SortItem[] = [
  { emoji: '🌾', label: 'Weizen', good: true },
  { emoji: '🍞', label: 'Brot', good: true },
  { emoji: '🍎', label: 'Apfel', good: true },
  { emoji: '🥕', label: 'Rüebli', good: true },
  { emoji: '🥦', label: 'Brokkoli', good: true },
  { emoji: '🍌', label: 'Banane', good: true },
  { emoji: '🍓', label: 'Erdbeere', good: true },
  { emoji: '🍊', label: 'Orange', good: true },
  { emoji: '🥗', label: 'Salat', good: true },
  { emoji: '🥜', label: 'Nüsse', good: true },
  { emoji: '💧', label: 'Wasser', good: true },
  { emoji: '🥛', label: 'Milch', good: true },
  { emoji: '🏃', label: 'Joggen', good: true },
  { emoji: '⚽', label: 'Fussball', good: true },
  { emoji: '🚴', label: 'Velo', good: true },
  { emoji: '😴', label: 'Schlaf', good: true },
  { emoji: '🚬', label: 'Zigarette', good: false },
  { emoji: '💨', label: 'Vape', good: false },
  { emoji: '🍺', label: 'Bier', good: false },
  { emoji: '🍷', label: 'Wein', good: false },
  { emoji: '🥃', label: 'Schnaps', good: false },
  { emoji: '🍸', label: 'Cocktail', good: false },
  { emoji: '🍾', label: 'Sekt', good: false },
  { emoji: '☕', label: 'Kaffee', good: false },
  { emoji: '💊', label: 'Drogen', good: false },
]

/** Die beiden Seiten – links das «Nein», rechts das «Ja». */
export const SORT_SIDES = {
  left: 'Nein, danke',
  right: 'Gut für dich',
} as const

/**
 * Das Tempo nach `t` Sekunden Spiel.
 *
 * Zwei Zahlen tragen das ganze Spiel: wie lange ein Gegenstand von oben
 * bis zur Linie braucht (`fall`) und wie viel Zeit bis zum nächsten
 * vergeht (`gap`). Beide schrumpfen von Anfang an – am Start bleibt Zeit
 * zum Verstehen, nach einer halben Minute wird es eng, und ab etwa vierzig
 * Sekunden zieht ein zweiter Schub an, den auf Dauer niemand hält. So
 * dauert eine Runde 20 bis 60 Sekunden, ohne dass eine Uhr sie beendet:
 * Eine Uhr gäbe jedem fehlerfreien Lauf dieselbe Zahl, und eine
 * Bestenliste, in der oben alle gleich stehen, ist keine.
 *
 * Die Zahlen sind ausgespielt, nicht ausgerechnet: mit einem
 * nachgebildeten Spieler, dessen Reaktion um eine bestimmte Zeit streut
 * (`tests/impulse-game.test.ts`).
 */
export interface SortPace {
  /** Sekunden von oben bis zur Linie. */
  fall: number
  /** Sekunden bis zum nächsten Gegenstand. */
  gap: number
}

export const SORT_PACE = {
  fallStart: 3.0,
  fallMin: 0.85,
  fallDecay: 17,
  gapStart: 1.15,
  gapMin: 0.3,
  gapDecay: 15,
  /** Ab hier zieht der zweite Schub an … */
  rushFrom: 40,
  /** … und halbiert die Abstände alle so viele Sekunden. */
  rushHalf: 14,
} as const

export function sortPace(t: number): SortPace {
  const time = Math.max(0, t)
  const p = SORT_PACE
  const fall = p.fallMin + (p.fallStart - p.fallMin) * Math.exp(-time / p.fallDecay)
  const rush = time > p.rushFrom ? Math.pow(0.5, (time - p.rushFrom) / p.rushHalf) : 1
  const gap = (p.gapMin + (p.gapStart - p.gapMin) * Math.exp(-time / p.gapDecay)) * rush
  return { fall: fall * (0.75 + 0.25 * rush), gap }
}

/** Drei Leben – und zehn richtige am Stück geben eines zurück. */
export const SORT_LIVES = 3
export const SORT_STREAK_FOR_LIFE = 10

/**
 * Ein kleiner Zufallsgenerator mit Startwert (mulberry32) – für die Folge
 * der Gegenstände. Mit `Math.random` als Startwert ist jede Runde anders;
 * die Prüfungen geben einen festen und bekommen jedes Mal dieselbe.
 */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let x = state
    x = Math.imul(x ^ (x >>> 15), x | 1)
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61)
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Der nächste Gegenstand – halb Ja, halb Nein, aber nie mehr als drei
 * derselben Seite am Stück (sonst liesse sich raten) und nie zweimal
 * derselbe Gegenstand hintereinander.
 */
export function nextSortItem(
  random: () => number,
  recent: readonly SortItem[],
  items: readonly SortItem[] = SORT_ITEMS,
): SortItem {
  const lastThree = recent.slice(-3)
  const forced =
    lastThree.length === 3 && lastThree.every((item) => item.good === lastThree[0].good)
      ? !lastThree[0].good
      : null
  const good = forced ?? random() < 0.5
  const previous = recent.at(-1)
  const pool = items.filter((item) => item.good === good && item !== previous)
  return pool[Math.floor(random() * pool.length) % pool.length]
}

/** Was ein Spiel für die Liste zählt – fürs Erste nur dieses eine. */
export const GAME_UNITS: Record<ImpulseGameId, { one: string; many: string }> = {
  sortieren: { one: 'Punkt', many: 'Punkte' },
}

export function gameUnit(game: ImpulseGameId, points: number): string {
  const unit = GAME_UNITS[game] ?? GAME_UNITS.sortieren
  return points === 1 ? unit.one : unit.many
}
