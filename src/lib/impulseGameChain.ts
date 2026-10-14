/*
 * «Ketten sprengen» – das Minispiel zur Woche «Die Wahrheit befreit
 * dich», ohne Leinwand: wo eine Notlüge auftaucht, wie schnell sie zur
 * Kette wird und was ein Tipp bewirkt.
 *
 * Auf einem Feld aus neun Plätzen tauchen Notlügen auf – «Bin gleich
 * da», «Hab’s nicht gesehen», «Der Hund war’s». Jede beginnt als dünne
 * Schnur und wird mit der Zeit zur Kette. Ein Tipp sprengt sie: als
 * Schnur gibt das drei Punkte, als Strick zwei, als Kette noch einen.
 * Wird sie ganz zur Kette, schnappt sie zu – ein Leben weniger; drei gibt
 * es. Ab und zu taucht ein Schlüssel auf: Wer ihn trifft, sprengt alles,
 * was gerade auf dem Feld liegt, und bekommt ein Leben zurück. Ein Tipp
 * auf einen leeren Platz lähmt kurz (`CHAIN_MISS_LOCK`) – wildes Tippen
 * überall lohnt sich so nicht.
 *
 * Das Bild dahinter: Der Widersacher führt mit einer dünnen Schnur, bis
 * er mit starken Stricken bindet (vgl. 2 Nephi 26:22) – kleine Lügen
 * wachsen. Und Jesus: Die Wahrheit wird euch frei machen (Johannes 8:32).
 * Die Tages-Challenge derselben Woche heisst «Sieben Tage ohne Notlüge»,
 * mit genau solchen Sätzen.
 *
 * Gezeichnet wird in `components/impulse/game/chainGame`; die Regeln
 * stehen hier, damit `tests/impulse-game.test.ts` eine Runde mit einem
 * nachgebildeten Spieler durchspielen kann – mit genau diesem Code.
 */

export interface ChainItem {
  emoji: string
  label: string
}

/** Die Notlügen – kurz genug für einen Platz auf dem Telefon. */
export const CHAIN_LIES: readonly ChainItem[] = [
  { emoji: '🏃', label: 'Bin gleich da' },
  { emoji: '🙈', label: 'Hab’s nicht gesehen' },
  { emoji: '🤷', label: 'War nicht ich' },
  { emoji: '📵', label: 'Hatte kein Netz' },
  { emoji: '🤒', label: 'Mir ist schlecht' },
  { emoji: '✅', label: 'Schon erledigt' },
  { emoji: '🐕', label: 'Der Hund war’s' },
  { emoji: '🔇', label: 'Nicht gehört' },
]

/** Der Schlüssel – die Wahrheit, die befreit. */
export const CHAIN_KEY: ChainItem = { emoji: '🗝️', label: 'Wahrheit' }

/** Drei Leben – der Schlüssel gibt eines zurück. */
export const CHAIN_LIVES = 3
/** Neun Plätze, drei mal drei – am Rechner die Tasten 1 bis 9 oder Q bis C. */
export const CHAIN_SLOTS = 9
/** So lange (Sekunden) lähmt ein Tipp ins Leere. */
export const CHAIN_MISS_LOCK = 0.45

export const CHAIN_PACE = {
  /** Wie lange eine Notlüge braucht, bis sie zuschnappt … */
  lifeStart: 2.6,
  lifeMin: 1.05,
  lifeDecay: 22,
  /** … und wie viel Zeit bis zur nächsten vergeht. */
  gapStart: 0.85,
  gapMin: 0.25,
  gapDecay: 10,
  rushFrom: 40,
  rushHalf: 14,
  /** Der Schlüssel: alle so viele Sekunden, mit etwas Zufall … */
  keyEvery: 15,
  keyJitter: 6,
  /** … und nur so kurz zu haben. */
  keyLife: 1.7,
} as const

export interface ChainPace {
  /** Sekunden, bis eine Notlüge zur Kette wird. */
  life: number
  /** Sekunden bis zur nächsten. */
  gap: number
}

export function chainPace(t: number): ChainPace {
  const time = Math.max(0, t)
  const p = CHAIN_PACE
  const rush = time > p.rushFrom ? Math.pow(0.5, (time - p.rushFrom) / p.rushHalf) : 1
  const life = p.lifeMin + (p.lifeStart - p.lifeMin) * Math.exp(-time / p.lifeDecay)
  const gap = (p.gapMin + (p.gapStart - p.gapMin) * Math.exp(-time / p.gapDecay)) * rush
  return { life: life * (0.75 + 0.25 * rush), gap }
}

/** Schnur, Strick, Kette – je früher gesprengt, desto mehr Punkte. */
export type ChainStage = 0 | 1 | 2

export function chainStage(age: number, life: number): ChainStage {
  const k = life > 0 ? age / life : 1
  return k < 1 / 3 ? 0 : k < 2 / 3 ? 1 : 2
}

export function chainPoints(age: number, life: number): number {
  return 3 - chainStage(age, life)
}

export interface ChainLock {
  id: number
  slot: number
  item: ChainItem
  /** Der Schlüssel statt einer Notlüge. */
  key: boolean
  spawn: number
  life: number
}

export type ChainEvent =
  /** Eine Notlüge gesprengt – drei, zwei oder ein Punkt. */
  | { kind: 'break'; lock: ChainLock; points: number }
  /** Der Schlüssel: alles auf dem Feld gesprengt, vielleicht ein Leben zurück. */
  | { kind: 'key'; lock: ChainLock; broken: { lock: ChainLock; points: number }[]; healed: boolean }
  /** Eine Notlüge ist zur Kette geworden – ein Leben weniger. */
  | { kind: 'snap'; lock: ChainLock }
  /** Der Schlüssel ist ungenutzt verschwunden. */
  | { kind: 'fade'; lock: ChainLock }
  /** Ein Tipp ins Leere – kurz gelähmt. */
  | { kind: 'miss'; slot: number }
  | { kind: 'over' }

/**
 * Eine Runde «Ketten sprengen». `tap` ist ein Finger auf einem Platz,
 * `step` rechnet die Zeit weiter. Beide melden, was geschehen ist –
 * dieselbe Liste bei jedem Aufruf, also gleich lesen.
 */
export class ChainRound {
  time = 0
  points = 0
  lives = CHAIN_LIVES
  over = false
  /** Gesprengte Notlügen am Stück, ohne dass eine zuschnappte – nur für die Anzeige. */
  streak = 0
  /** Was gerade auf dem Feld liegt. */
  locks: ChainLock[] = []
  /** Bis hierhin (Spielsekunde) nimmt das Feld keinen Tipp an. */
  lockedUntil = 0

  private readonly random: () => number
  private nextSpawn = 0.7
  private nextKey: number
  private nextId = 1
  private recentSlots: number[] = []
  private lastItem: ChainItem | null = null
  private readonly out: ChainEvent[] = []

  constructor(random: () => number) {
    this.random = random
    this.nextKey = CHAIN_PACE.keyEvery * 0.8 + this.random() * CHAIN_PACE.keyJitter
  }

  /** Was auf einem Platz liegt – oder `null`. */
  at(slot: number): ChainLock | null {
    return this.locks.find((lock) => lock.slot === slot) ?? null
  }

  tap(slot: number): readonly ChainEvent[] {
    this.out.length = 0
    if (this.over || this.time < this.lockedUntil) return this.out
    const lock = this.at(slot)
    if (!lock) {
      this.lockedUntil = this.time + CHAIN_MISS_LOCK
      this.out.push({ kind: 'miss', slot })
      return this.out
    }
    this.locks = this.locks.filter((entry) => entry !== lock)
    if (lock.key) {
      const broken = this.locks.map((entry) => ({
        lock: entry,
        points: chainPoints(this.time - entry.spawn, entry.life),
      }))
      this.locks = []
      for (const entry of broken) this.points += entry.points
      this.streak += broken.length
      const healed = this.lives < CHAIN_LIVES
      if (healed) this.lives += 1
      this.out.push({ kind: 'key', lock, broken, healed })
    } else {
      const points = chainPoints(this.time - lock.spawn, lock.life)
      this.points += points
      this.streak += 1
      this.out.push({ kind: 'break', lock, points })
    }
    return this.out
  }

  step(dt: number): readonly ChainEvent[] {
    this.out.length = 0
    if (this.over) return this.out
    this.time += dt
    while (this.time >= this.nextSpawn) this.spawn(false)
    if (this.time >= this.nextKey) {
      this.spawn(true)
      this.nextKey = this.time + CHAIN_PACE.keyEvery + this.random() * CHAIN_PACE.keyJitter
    }
    for (const lock of [...this.locks]) {
      if (this.time - lock.spawn < lock.life) continue
      this.locks = this.locks.filter((entry) => entry !== lock)
      if (lock.key) {
        this.out.push({ kind: 'fade', lock })
        continue
      }
      this.lives -= 1
      this.streak = 0
      this.out.push({ kind: 'snap', lock })
      if (this.lives <= 0) {
        this.over = true
        this.locks = []
        this.out.push({ kind: 'over' })
        break
      }
    }
    return this.out
  }

  /**
   * Eine neue Notlüge (oder der Schlüssel) auf einen freien Platz – nicht
   * auf einen der zwei zuletzt benutzten: Sonst tippte man einfach
   * zweimal auf dieselbe Stelle.
   */
  private spawn(key: boolean) {
    const at = key ? this.time : this.nextSpawn
    if (!key) this.nextSpawn = at + chainPace(at).gap
    const taken = new Set(this.locks.map((lock) => lock.slot))
    const free = Array.from({ length: CHAIN_SLOTS }, (_, slot) => slot).filter(
      (slot) => !taken.has(slot),
    )
    const fresh = free.filter((slot) => !this.recentSlots.includes(slot))
    const choices = fresh.length > 0 ? fresh : free
    // Alles besetzt: Diese fällt aus – das Feld ist voll genug.
    if (choices.length === 0) return
    const slot = choices[Math.floor(this.random() * choices.length) % choices.length]
    this.recentSlots = [...this.recentSlots.slice(-1), slot]
    let item = CHAIN_KEY
    if (!key) {
      // Nie zweimal dieselbe am Stück und nie eine, die schon auf dem Feld liegt.
      const shown = new Set(this.locks.map((lock) => lock.item))
      const lies = CHAIN_LIES.filter((entry) => entry !== this.lastItem && !shown.has(entry))
      const pool = lies.length > 0 ? lies : CHAIN_LIES
      item = pool[Math.floor(this.random() * pool.length) % pool.length]
      this.lastItem = item
    }
    this.locks.push({
      id: this.nextId,
      slot,
      item,
      key,
      spawn: at,
      life: key ? CHAIN_PACE.keyLife : chainPace(at).life,
    })
    this.nextId += 1
  }
}
