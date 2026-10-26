/*
 * «Bücherturm» – das Minispiel zur Woche zum Schriftstudium, ohne
 * Leinwand: welches Buch als Nächstes kommt, wie es über dem Turm
 * schwebt, wo es landet und ob der Turm hält.
 *
 * Gebaut nach dem Muster von Turmbau (games.alae.app): Über dem Turm
 * schwebt ein Buch hin und her, ein Tipp lässt es senkrecht fallen. Die
 * Bücher kommen in der Reihenfolge der heiligen Schriften – zuerst das
 * Buch Mormon (1 Nephi, 2 Nephi, Jakob, Enos …), dann das Neue
 * Testament, Lehre und Bündnisse, die Köstliche Perle und das Alte
 * Testament. Wer ein paar Runden spielt, kennt die Reihenfolge.
 *
 * Anders als beim Turmbau bricht nichts ab: Ein Buch, das schief
 * aufliegt, bleibt schief liegen. Gezählt wird wie bei echten Büchern –
 * der Turm hält, solange über jedem Buch der Schwerpunkt aller Bücher
 * darüber auf ihm liegt. Wer immer zur selben Seite danebenliegt, baut
 * einen schiefen Turm, und der kippt; wer gegensteuert, hält ihn. Kippt
 * er, fällt alles ab dem Buch, das nachgibt – das kostet ein Leben, und
 * die gefallenen Bücher kommen der Reihe nach wieder. So steht im Turm
 * immer die richtige Reihenfolge, von unten nach oben.
 *
 * Ein Buch, das daneben fällt oder abrutscht, kostet ebenfalls ein Leben;
 * drei gibt es. Genau drauf (`STACK_PERFECT`) gibt Extrapunkte, mehrere
 * genaue hintereinander noch mehr. Wer eine ganze Sammlung stapelt – als
 * Erstes alle fünfzehn Bücher des Buches Mormon –, bekommt fünf Punkte
 * und ein Leben zurück.
 *
 * Schneller wird es mit jedem Buch, das liegen bleibt (`stackSwing`):
 * Das Buch schwebt schneller und weiter, ab dem zwölften schwankt der
 * Takt, damit man ihn nicht auswendig lernt.
 *
 * Gemessen wird in Buchbreiten: Alle Bücher sind gleich breit (eins),
 * nur verschieden dick – Alma ist dicker als Enos. Gezeichnet wird in
 * `components/impulse/game/stackGame`; die Regeln stehen hier, damit
 * `tests/impulse-game.test.ts` Runden mit nachgebildeten Spielern
 * durchspielen kann – mit genau diesem Code.
 */

export type StackCollectionId = 'bom' | 'nt' | 'dc' | 'pgp' | 'ot'

export interface StackCollection {
  id: StackCollectionId
  label: string
  /** Die Bücher in ihrer Reihenfolge – mit der Zahl ihrer Kapitel (macht sie dick oder dünn). */
  books: readonly (readonly [string, number])[]
}

export interface StackBook {
  label: string
  collection: StackCollectionId
  chapters: number
  /** Dicke in Buchbreiten. */
  thickness: number
  /** Das letzte Buch seiner Sammlung. */
  last: boolean
}

/** Die heiligen Schriften – das Buch Mormon zuerst. Namen wie im Rest der App (Einheitsübersetzung). */
export const STACK_COLLECTIONS: readonly StackCollection[] = [
  {
    id: 'bom',
    label: 'Buch Mormon',
    books: [
      ['1 Nephi', 22],
      ['2 Nephi', 33],
      ['Jakob', 7],
      ['Enos', 1],
      ['Jarom', 1],
      ['Omni', 1],
      ['Worte Mormons', 1],
      ['Mosia', 29],
      ['Alma', 63],
      ['Helaman', 16],
      ['3 Nephi', 30],
      ['4 Nephi', 1],
      ['Mormon', 9],
      ['Ether', 15],
      ['Moroni', 10],
    ],
  },
  {
    id: 'nt',
    label: 'Neues Testament',
    books: [
      ['Matthäus', 28],
      ['Markus', 16],
      ['Lukas', 24],
      ['Johannes', 21],
      ['Apostelgeschichte', 28],
      ['Römer', 16],
      ['1 Korinther', 16],
      ['2 Korinther', 13],
      ['Galater', 6],
      ['Epheser', 6],
      ['Philipper', 4],
      ['Kolosser', 4],
      ['1 Thessalonicher', 5],
      ['2 Thessalonicher', 3],
      ['1 Timotheus', 6],
      ['2 Timotheus', 4],
      ['Titus', 3],
      ['Philemon', 1],
      ['Hebräer', 13],
      ['Jakobus', 5],
      ['1 Petrus', 5],
      ['2 Petrus', 3],
      ['1 Johannes', 5],
      ['2 Johannes', 1],
      ['3 Johannes', 1],
      ['Judas', 1],
      ['Offenbarung', 22],
    ],
  },
  { id: 'dc', label: 'Lehre und Bündnisse', books: [['Lehre und Bündnisse', 138]] },
  {
    id: 'pgp',
    label: 'Köstliche Perle',
    books: [
      ['Mose', 8],
      ['Abraham', 5],
      ['Joseph Smith – Matthäus', 1],
      ['Joseph Smith – Lebensgeschichte', 1],
      ['Glaubensartikel', 1],
    ],
  },
  {
    id: 'ot',
    label: 'Altes Testament',
    books: [
      ['Genesis', 50],
      ['Exodus', 40],
      ['Levitikus', 27],
      ['Numeri', 36],
      ['Deuteronomium', 34],
      ['Josua', 24],
      ['Richter', 21],
      ['Rut', 4],
      ['1 Samuel', 31],
      ['2 Samuel', 24],
      ['1 Könige', 22],
      ['2 Könige', 25],
      ['1 Chronik', 29],
      ['2 Chronik', 36],
      ['Esra', 10],
      ['Nehemia', 13],
      ['Ester', 10],
      ['Ijob', 42],
      ['Psalmen', 150],
      ['Sprichwörter', 31],
      ['Kohelet', 12],
      ['Hoheslied', 8],
      ['Jesaja', 66],
      ['Jeremia', 52],
      ['Klagelieder', 5],
      ['Ezechiel', 48],
      ['Daniel', 12],
      ['Hosea', 14],
      ['Joel', 3],
      ['Amos', 9],
      ['Obadja', 1],
      ['Jona', 4],
      ['Micha', 7],
      ['Nahum', 3],
      ['Habakuk', 3],
      ['Zefanja', 3],
      ['Haggai', 2],
      ['Sacharja', 14],
      ['Maleachi', 4],
    ],
  },
]

/** Dünne Bücher sind dünn, dicke dick – aber keines so dünn, dass man es nicht mehr trifft. */
export function stackThickness(chapters: number): number {
  return Math.min(0.32, Math.max(0.15, 0.13 + 0.018 * Math.sqrt(Math.max(1, chapters))))
}

/** Alle Bücher in der Reihenfolge des Turms. */
export const STACK_BOOKS: readonly StackBook[] = STACK_COLLECTIONS.flatMap((collection) =>
  collection.books.map(([label, chapters], index) => ({
    label,
    collection: collection.id,
    chapters,
    thickness: stackThickness(chapters),
    last: index === collection.books.length - 1,
  })),
)

/** Das Buch an einer Stelle der Reihe – wer alle schafft, beginnt von vorn. */
export function stackBookAt(index: number): StackBook {
  return STACK_BOOKS[((index % STACK_BOOKS.length) + STACK_BOOKS.length) % STACK_BOOKS.length]
}

export function stackCollection(id: StackCollectionId): StackCollection {
  return STACK_COLLECTIONS.find((collection) => collection.id === id)!
}

/** Drei Leben – eine ganze Sammlung gibt eines zurück. */
export const STACK_LIVES = 3
/** So breit ist der Tisch unter dem Turm, in Buchbreiten. */
export const STACK_DESK = 2
/**
 * Wie weit der Schwerpunkt über einem Buch von dessen Mitte weg liegen darf
 * (Anteil der halben Breite), bevor es nachgibt. Echte Bücher hielten bis zum
 * Rand – im Spiel rutscht es etwas früher, sonst stünde fast jeder Turm.
 */
export const STACK_GRIP = 0.8
/** Genau drauf: so nah (in Buchbreiten) an der Mitte des Buches darunter. */
export const STACK_PERFECT = 0.06
/** Genaue hintereinander zählen mehr – bis zu so viel dazu. */
export const STACK_CHAIN_MAX = 4
/** Eine ganze Sammlung gestapelt. */
export const STACK_COMPLETE_POINTS = 5

export const STACK_TIMES = {
  /** So lange fällt ein Buch vom Schweben bis auf den Turm … */
  drop: 0.26,
  /** … so lange liegt es, bis das nächste kommt … */
  settle: 0.2,
  /** … und so lange nach einem Fehler. */
  fail: 0.75,
} as const

export const STACK_PACE = {
  /** Sekunden für ein ganzes Hin und Her – mit jedem Buch ein Stück schneller … */
  periodStart: 2.8,
  periodRamp: 0.975,
  periodMin: 0.6,
  /** … und ab so vielen Büchern mit einem zweiten Schub, den auf Dauer niemand hält. */
  rushFrom: 33,
  rushRamp: 0.94,
  /** Ab so vielen Büchern schwankt der Takt um ± die Hälfte davon. */
  jitterFrom: 12,
  jitter: 0.16,
  /** Wie weit das Buch zur Seite schwebt (in Buchbreiten, von der Mitte aus). */
  ampStart: 0.6,
  ampStep: 0.008,
  ampMax: 0.85,
} as const

export interface StackSwing {
  /** Sekunden für ein ganzes Hin und Her. */
  period: number
  /** So weit zur Seite, in Buchbreiten. */
  amp: number
}

/** Wie das nächste Buch schwebt – nach so vielen Büchern, die schon liegen geblieben sind. */
export function stackSwing(placed: number, random: () => number = () => 0.5): StackSwing {
  const p = STACK_PACE
  const n = Math.max(0, placed)
  const rush = Math.pow(p.rushRamp, Math.max(0, n - p.rushFrom))
  let period = Math.max(p.periodMin, p.periodStart * Math.pow(p.periodRamp, n) * rush)
  if (n >= p.jitterFrom) period *= 1 + (random() - 0.5) * p.jitter
  return { period, amp: Math.min(p.ampMax, p.ampStart + p.ampStep * n) }
}

export interface StackPlaced {
  /** Die Stelle in der Reihe aller Bücher. */
  index: number
  book: StackBook
  /** Mitte des Buches, in Buchbreiten – null ist die Mitte des Tisches. */
  x: number
  perfect: boolean
}

/** Worauf ein Buch liegt: das Buch darunter oder der Tisch. */
function supportOf(tower: readonly StackPlaced[], level: number): { x: number; w: number } {
  return level === 0 ? { x: 0, w: STACK_DESK } : { x: tower[level - 1].x, w: 1 }
}

/** Der Schwerpunkt aller Bücher ab `level` – dicke Bücher wiegen mehr. */
function centerOfMass(tower: readonly StackPlaced[], level: number): number {
  let mass = 0
  let sum = 0
  for (let index = level; index < tower.length; index += 1) {
    mass += tower[index].book.thickness
    sum += tower[index].x * tower[index].book.thickness
  }
  return mass > 0 ? sum / mass : 0
}

/** Die unterste Stelle, an der der Turm nachgibt – oder `null`, wenn er hält. */
export function stackFailLevel(tower: readonly StackPlaced[]): number | null {
  for (let level = 0; level < tower.length; level += 1) {
    const support = supportOf(tower, level)
    if (Math.abs(centerOfMass(tower, level) - support.x) > (support.w / 2) * STACK_GRIP)
      return level
  }
  return null
}

/**
 * Wie sicher der Turm steht: 1 heisst kerzengerade, 0 heisst, er kippt
 * gleich. Dazu die Stelle, die am wenigsten Halt hat, und wohin er sich
 * neigt (−1 links, +1 rechts) – die Leinwand lässt ihn dort wackeln.
 */
export function stackStability(tower: readonly StackPlaced[]): {
  margin: number
  level: number
  side: -1 | 1
} {
  let margin = 1
  let level = 0
  let side: -1 | 1 = 1
  for (let index = 0; index < tower.length; index += 1) {
    const support = supportOf(tower, index)
    const offset = centerOfMass(tower, index) - support.x
    const left = 1 - Math.abs(offset) / ((support.w / 2) * STACK_GRIP)
    if (left < margin) {
      margin = left
      level = index
      side = offset < 0 ? -1 : 1
    }
  }
  return { margin: Math.max(0, margin), level, side }
}

export type StackEvent =
  /** Das Buch fällt – von dort, wo es gerade schwebte. */
  | { kind: 'drop'; book: StackBook; x: number }
  /** Es liegt – mit seinen Punkten, genau oder nicht. */
  | { kind: 'land'; placed: StackPlaced; points: number; chain: number }
  /** Eine ganze Sammlung liegt im Turm. */
  | { kind: 'complete'; collection: StackCollection; points: number; healed: boolean }
  /** Daneben gefallen oder abgerutscht – ein Leben weniger, dasselbe Buch kommt nochmals. */
  | { kind: 'miss'; book: StackBook; x: number; slid: boolean }
  /** Der Turm kippt: Alles ab `level` fällt – ein Leben weniger. */
  | { kind: 'topple'; level: number; fallen: StackPlaced[]; side: -1 | 1 }
  /** Ein neues Buch schwebt über dem Turm. */
  | { kind: 'next'; book: StackBook }
  | { kind: 'over' }

/**
 * Eine Runde «Bücherturm». `tap` lässt das schwebende Buch fallen,
 * `step` rechnet die Zeit weiter. Beide melden, was geschehen ist –
 * dieselbe Liste bei jedem Aufruf, also gleich lesen.
 */
export class StackRound {
  time = 0
  points = 0
  lives = STACK_LIVES
  over = false
  /** Die Bücher im Turm, von unten nach oben – immer in der Reihenfolge der Schriften. */
  tower: StackPlaced[] = []
  /** Die Stelle des Buches, das gerade schwebt oder als Nächstes kommt. */
  next = 0
  /** Genaue hintereinander. */
  chain = 0
  /** Bücher, die liegen geblieben sind – auch solche, die später wieder fielen. Daran hängt das Tempo. */
  placed = 0
  /** Was gerade geschieht: das Buch schwebt, fällt, oder der Turm wartet aufs nächste. */
  state: 'swing' | 'drop' | 'wait' = 'swing'
  /** Das Schweben: Mitte, Weite, Takt und Anfang – wo das Buch gerade ist, sagt `hoverX`. */
  swing: { center: number; amp: number; period: number; start: number; phase: number } = {
    center: 0,
    amp: STACK_PACE.ampStart,
    period: STACK_PACE.periodStart,
    start: 0,
    phase: 0,
  }
  /** Das fallende Buch. */
  drop: { x: number; start: number } | null = null

  private readonly random: () => number
  private readonly completed = new Set<StackCollectionId>()
  private waitUntil = 0
  /** Abwechselnd von links und von rechts. */
  private fromLeft = true
  private readonly out: StackEvent[] = []

  constructor(random: () => number) {
    this.random = random
    this.beginSwing()
  }

  get book(): StackBook {
    return stackBookAt(this.next)
  }

  /** Wo das schwebende Buch gerade ist (Mitte, in Buchbreiten). */
  hoverX(time = this.time): number {
    const s = this.swing
    return s.center + s.amp * Math.sin(s.phase + ((time - s.start) / s.period) * Math.PI * 2)
  }

  /** Mitte des obersten Buches – oder des Tisches. */
  get topX(): number {
    return this.tower.at(-1)?.x ?? 0
  }

  tap(): readonly StackEvent[] {
    this.out.length = 0
    if (this.over || this.state !== 'swing') return this.out
    const x = this.hoverX()
    this.state = 'drop'
    this.drop = { x, start: this.time }
    this.out.push({ kind: 'drop', book: this.book, x })
    return this.out
  }

  step(dt: number): readonly StackEvent[] {
    this.out.length = 0
    if (this.over) return this.out
    this.time += dt
    if (this.state === 'drop' && this.drop && this.time >= this.drop.start + STACK_TIMES.drop) {
      this.land(this.drop.x)
      this.drop = null
    }
    if (!this.over && this.state === 'wait' && this.time >= this.waitUntil) {
      this.beginSwing()
      this.out.push({ kind: 'next', book: this.book })
    }
    return this.out
  }

  private land(x: number) {
    const book = this.book
    const below = this.tower.at(-1)
    const support = below ? { x: below.x, w: 1 } : { x: 0, w: STACK_DESK }
    const offset = x - support.x
    // Ganz daneben: Es berührt nichts und fällt hinunter.
    if (Math.abs(offset) >= (1 + support.w) / 2) {
      this.fail({ kind: 'miss', book, x, slid: false })
      return
    }
    const perfect = Math.abs(offset) <= STACK_PERFECT
    const placed: StackPlaced = { index: this.next, book, x: perfect ? support.x : x, perfect }
    this.tower.push(placed)
    const level = stackFailLevel(this.tower)
    if (level !== null) {
      if (level === this.tower.length - 1) {
        // Nur das neue Buch liegt zu weit draussen: Es rutscht ab.
        this.tower.pop()
        this.fail({ kind: 'miss', book, x, slid: true })
        return
      }
      const supportX = supportOf(this.tower, level).x
      const side = centerOfMass(this.tower, level) < supportX ? -1 : 1
      const fallen = this.tower.splice(level)
      this.next = fallen[0].index
      this.fail({ kind: 'topple', level, fallen, side })
      return
    }

    this.chain = perfect ? this.chain + 1 : 0
    const points = 1 + (perfect ? Math.min(this.chain, STACK_CHAIN_MAX) : 0)
    this.points += points
    this.placed += 1
    this.next += 1
    this.out.push({ kind: 'land', placed, points, chain: this.chain })
    if (book.last && !this.completed.has(book.collection)) {
      this.completed.add(book.collection)
      this.points += STACK_COMPLETE_POINTS
      const healed = this.lives < STACK_LIVES
      if (healed) this.lives += 1
      this.out.push({
        kind: 'complete',
        collection: stackCollection(book.collection),
        points: STACK_COMPLETE_POINTS,
        healed,
      })
    }
    this.state = 'wait'
    this.waitUntil = this.time + STACK_TIMES.settle
  }

  private fail(event: Extract<StackEvent, { kind: 'miss' | 'topple' }>) {
    this.lives -= 1
    this.chain = 0
    this.out.push(event)
    if (this.lives <= 0) {
      this.over = true
      this.out.push({ kind: 'over' })
      return
    }
    this.state = 'wait'
    this.waitUntil = this.time + STACK_TIMES.fail
  }

  private beginSwing() {
    const { period, amp } = stackSwing(this.placed, this.random)
    this.swing = {
      center: this.topX,
      amp,
      period,
      start: this.time,
      // Es kommt vom Rand her – einmal links, einmal rechts.
      phase: this.fromLeft ? -Math.PI / 2 : Math.PI / 2,
    }
    this.fromLeft = !this.fromLeft
    this.state = 'swing'
  }
}
