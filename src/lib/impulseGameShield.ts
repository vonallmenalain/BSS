/*
 * «Schild hoch!» – das Minispiel zur Woche über das Gesetz der Keuschheit,
 * ohne Leinwand: was fliegt, wann es ankommt und was dann geschieht.
 *
 * In der Mitte liegt dein Herz, rundum dein Schild. Aus vier Richtungen
 * fliegen Dinge heran: dunkle Pfeile – Pop-ups, Gruppendruck, grobe
 * Sprache – und ab und zu ein Licht – Musik, Freunde, Gebet. Der Schild
 * zeigt immer in eine Richtung. Ein dunkler Pfeil, der auf ihn trifft,
 * prallt ab (ein Punkt); einer, der vorbeikommt, trifft das Herz (ein
 * Leben weniger). Ein Licht dagegen soll durch: Steht der Schild im Weg,
 * prallt es ab und ist verloren; kommt es durch, gibt es drei Punkte und
 * ein verlorenes Leben zurück.
 *
 * Das Bild dahinter: der Schild des Glaubens, mit dem man die feurigen
 * Pfeile des Bösen abwehrt (Epheser 6:16; LuB 27:17) – und der
 * 13. Glaubensartikel, der in derselben Woche im Feed steht: Wer nach dem
 * Tugendhaften und Liebenswerten trachtet, hat weniger Platz für das
 * andere. Keusch sein heisst nicht nur Nein sagen, sondern auch das Gute
 * hereinlassen. Darum die Lichter – und darum zählen sie mehr.
 *
 * Gezeichnet wird in `components/impulse/game/shieldGame`; die Regeln
 * stehen hier, damit `tests/impulse-game.test.ts` eine Runde mit einem
 * nachgebildeten Spieler durchspielen kann – mit genau diesem Code.
 */

/** Oben, rechts, unten, links – im Uhrzeigersinn, wie die Pfeiltasten. */
export type ShieldDir = 0 | 1 | 2 | 3

export const SHIELD_DIRS: readonly ShieldDir[] = [0, 1, 2, 3]

export interface ShieldItem {
  emoji: string
  label: string
  /** Ein Licht – soll durch. Sonst ein dunkler Pfeil, der abprallen soll. */
  light: boolean
}

/**
 * Was abprallen soll. Nichts davon zeigt, was es meint – Pop-up, Video im
 * Chat, grobe Sprache: Wer in der Gruppe ist, weiss, wovon die Rede ist,
 * und das Spiel muss es nicht ausmalen. Alles stammt aus den Karten der
 * Woche (Umfrage, «Was würdest du tun?», Tages-Challenge).
 */
export const SHIELD_DARK: readonly ShieldItem[] = [
  { emoji: '📱', label: 'Pop-up', light: false },
  { emoji: '🙈', label: 'Video im Chat', light: false },
  { emoji: '🗯️', label: 'Grobe Sprache', light: false },
  { emoji: '🔗', label: 'Dubioser Link', light: false },
  { emoji: '👥', label: 'Gruppendruck', light: false },
  { emoji: '🌙', label: 'Handy im Bett', light: false },
  { emoji: '🥱', label: 'Langeweile', light: false },
  { emoji: '📺', label: 'Schlechte Serie', light: false },
]

/** Was durch soll – «tugendhaft und liebenswert» (13. Glaubensartikel). */
export const SHIELD_LIGHT: readonly ShieldItem[] = [
  { emoji: '🎵', label: 'Gute Musik', light: true },
  { emoji: '🤝', label: 'Freunde', light: true },
  { emoji: '🙏', label: 'Gebet', light: true },
  { emoji: '📖', label: 'Schriften', light: true },
  { emoji: '⚽', label: 'Sport', light: true },
  { emoji: '🌲', label: 'Natur', light: true },
]

export const SHIELD_ITEMS: readonly ShieldItem[] = [...SHIELD_DARK, ...SHIELD_LIGHT]

/** Drei Leben – ein Licht, das durchkommt, gibt eines zurück. */
export const SHIELD_LIVES = 3
/** So viel zählt ein Licht, das durchkommt – ein abgewehrter Pfeil zählt einen. */
export const SHIELD_LIGHT_POINTS = 3

/**
 * Das Tempo nach `t` Sekunden: wie lange ein Pfeil vom Rand bis zum
 * Schild braucht (`travel`) und wie viel Zeit bis zum nächsten vergeht
 * (`gap`). Beides schrumpft von Anfang an, ab vierzig Sekunden kommt ein
 * zweiter Schub – wie bei «Gut für dich?», und aus demselben Grund: Eine
 * Uhr gäbe jedem fehlerfreien Lauf dieselbe Zahl.
 *
 * Ausgespielt mit einem nachgebildeten Spieler (`tests/impulse-game.test.ts`).
 */
export const SHIELD_PACE = {
  travelStart: 1.8,
  travelMin: 0.75,
  travelDecay: 18,
  gapStart: 0.95,
  gapMin: 0.25,
  gapDecay: 11,
  rushFrom: 40,
  rushHalf: 12,
  /** Ab hier kommen Lichter – vorher lernt man erst den Schild. */
  lightFrom: 4,
  /** So wahrscheinlich ist das Nächste ein Licht … */
  lightChance: 0.16,
  /** … aber nie zwei kurz hintereinander. */
  lightSpacing: 3.5,
  /** Um ein Licht herum bleibt mehr Luft – zum Wegdrehen. */
  lightGap: 1.5,
} as const

export interface ShieldPace {
  /** Sekunden vom Rand bis zum Schild. */
  travel: number
  /** Sekunden bis zum Nächsten. */
  gap: number
}

export function shieldPace(t: number): ShieldPace {
  const time = Math.max(0, t)
  const p = SHIELD_PACE
  const rush = time > p.rushFrom ? Math.pow(0.5, (time - p.rushFrom) / p.rushHalf) : 1
  const travel = p.travelMin + (p.travelStart - p.travelMin) * Math.exp(-time / p.travelDecay)
  const gap = (p.gapMin + (p.gapStart - p.gapMin) * Math.exp(-time / p.gapDecay)) * rush
  return { travel: travel * (0.7 + 0.3 * rush), gap }
}

export interface ShieldShot {
  id: number
  item: ShieldItem
  dir: ShieldDir
  /** Spielsekunde, in der es am Rand auftaucht … */
  spawn: number
  /** … und in der es beim Schild ankommt. */
  arrive: number
}

export type ShieldEvent =
  /** Ein dunkler Pfeil prallt am Schild ab – ein Punkt. */
  | { kind: 'block'; shot: ShieldShot }
  /** Ein dunkler Pfeil kommt vorbei – ein Leben weniger. */
  | { kind: 'hit'; shot: ShieldShot }
  /** Ein Licht kommt durch – drei Punkte, vielleicht ein Leben zurück. */
  | { kind: 'light'; shot: ShieldShot; healed: boolean }
  /** Ein Licht prallt am Schild ab – verloren, aber ohne Strafe. */
  | { kind: 'bounce'; shot: ShieldShot }
  /** Das letzte Leben ist weg. */
  | { kind: 'over' }

/**
 * Eine Runde «Schild hoch!». `step` rechnet die Zeit weiter und meldet,
 * was geschehen ist; `turn` dreht den Schild – sofort, die Leinwand
 * zeichnet die Drehung nur nach.
 */
export class ShieldRound {
  time = 0
  points = 0
  lives = SHIELD_LIVES
  /** Wohin der Schild zeigt – am Anfang nach oben. */
  shield: ShieldDir = 0
  /** Abgewehrte Pfeile am Stück – nur für die Anzeige. */
  streak = 0
  over = false
  /** Was gerade fliegt – nach Ankunft geordnet, das Vorderste zuerst. */
  shots: ShieldShot[] = []

  private readonly random: () => number
  private nextSpawn = 0.8
  private nextId = 1
  private lastLight = -Infinity
  private upcomingLight = false
  private recent: ShieldShot[] = []
  private readonly out: ShieldEvent[] = []

  constructor(random: () => number) {
    this.random = random
  }

  /** Den Schild in eine Richtung drehen. */
  turn(dir: ShieldDir): void {
    if (!this.over) this.shield = dir
  }

  /**
   * Die Zeit um `dt` Sekunden weiterrechnen. Zurück kommt, was dabei
   * geschehen ist – dieselbe Liste bei jedem Aufruf, also gleich lesen.
   */
  step(dt: number): readonly ShieldEvent[] {
    this.out.length = 0
    if (this.over) return this.out
    this.time += dt
    while (this.time >= this.nextSpawn) this.spawn()
    while (this.shots.length > 0 && this.shots[0].arrive <= this.time && !this.over) {
      this.resolve(this.shots.shift()!)
    }
    return this.out
  }

  /** Wie weit ein Geschoss ist: 0 am Rand, 1 am Schild. */
  progress(shot: ShieldShot): number {
    return Math.min(1, Math.max(0, (this.time - shot.spawn) / (shot.arrive - shot.spawn)))
  }

  private resolve(shot: ShieldShot) {
    const facing = this.shield === shot.dir
    if (!shot.item.light) {
      if (facing) {
        this.points += 1
        this.streak += 1
        this.out.push({ kind: 'block', shot })
      } else {
        this.lives -= 1
        this.streak = 0
        this.out.push({ kind: 'hit', shot })
        if (this.lives <= 0) {
          this.over = true
          this.shots = []
          this.out.push({ kind: 'over' })
        }
      }
    } else if (facing) {
      this.out.push({ kind: 'bounce', shot })
    } else {
      this.points += SHIELD_LIGHT_POINTS
      const healed = this.lives < SHIELD_LIVES
      if (healed) this.lives += 1
      this.out.push({ kind: 'light', shot, healed })
    }
  }

  private spawn() {
    const p = SHIELD_PACE
    const at = this.nextSpawn
    const pace = shieldPace(at)
    const light = this.upcomingLight
    const pool = light ? SHIELD_LIGHT : SHIELD_DARK
    const recentItems = new Set(this.recent.slice(-4).map((shot) => shot.item))
    const fresh = pool.filter((item) => !recentItems.has(item))
    const choices = fresh.length > 0 ? fresh : pool
    const item = choices[Math.floor(this.random() * choices.length) % choices.length]
    const shot: ShieldShot = {
      id: this.nextId,
      item,
      dir: this.nextDir(),
      spawn: at,
      arrive: at + pace.travel,
    }
    this.nextId += 1
    this.shots.push(shot)
    // Die Reise wird mit der Zeit kürzer – was später startet, kommt trotzdem nie früher an.
    this.shots.sort((a, b) => a.arrive - b.arrive)
    this.recent = [...this.recent.slice(-5), shot]
    if (light) this.lastLight = at
    // Ob das Nächste ein Licht wird, steht schon jetzt fest: Vor und nach
    // einem Licht bleibt so Luft zum Wegdrehen – sonst stünden Pfeil und
    // Licht im selben Moment an, und kein Daumen käme hinterher.
    this.upcomingLight =
      !light &&
      at + pace.gap >= p.lightFrom &&
      at - this.lastLight >= p.lightSpacing &&
      this.random() < p.lightChance
    this.nextSpawn = at + pace.gap * (light || this.upcomingLight ? p.lightGap : 1)
  }

  /**
   * Die nächste Richtung: zufällig, aber nie dreimal dieselbe – sonst
   * bliebe der Schild einfach stehen und das Spiel spielte sich selbst.
   */
  private nextDir(): ShieldDir {
    const lastTwo = this.recent.slice(-2)
    const blocked =
      lastTwo.length === 2 && lastTwo[0].dir === lastTwo[1].dir ? lastTwo[0].dir : null
    const options = SHIELD_DIRS.filter((dir) => dir !== blocked)
    return options[Math.floor(this.random() * options.length) % options.length]
  }
}
