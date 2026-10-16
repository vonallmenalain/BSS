/*
 * «Keine Ausreden!» – das Minispiel zur Woche über Helamans junge Krieger,
 * ohne Leinwand: Laufen, Springen, Hürden, Lücken, Etagen und Aufgaben.
 *
 * Ein junger Krieger läuft, und ihm kommen Ausreden entgegen: «Später»,
 * «Keine Lust», «Nur noch kurz». Ein Tipp – oder die Leertaste – lässt
 * ihn springen; wer länger drückt, springt höher. Jede Hürde, über die er
 * kommt, zählt einen Punkt, ebenso jede Lücke, über die er springt, und
 * jede Aufgabe, die er unterwegs einsammelt: beten, Schriften, helfen,
 * Ämtli. Wer an eine Ausrede stösst oder in eine Lücke fällt, ist
 * verwundet – drei Wunden, und die Runde ist vorbei. Zehn Hindernisse am
 * Stück ohne Treffer heilen eine.
 *
 * **Etagen.** Nach etwa fünf Sekunden tun sich Lücken im Boden auf, und
 * darüber schweben Bretter – die erste Etage. Wer lang drückt, kommt
 * hinauf; dort oben liegen mehr Aufgaben, unten zählen die Hürden und
 * Lücken. Bequemer ist es oben nicht: Bald stehen auch dort Ausreden.
 * Später kommt eine zweite Etage dazu, erreichbar nur von der ersten
 * aus – mit den meisten Aufgaben. Die Bretter trägt man von unten
 * durch (wie in jedem Jump-'n'-Run), gelandet wird nur von oben. Wo ein
 * Brett endet, fällt man eine Etage tiefer – dort ist immer Platz zum
 * Landen. Wer in eine Lücke fällt, wird aufgefangen: Die Lücke wird zur
 * Brücke, er läuft weiter, eine Wunde ärmer.
 *
 * Das Bild dahinter: Die jungen Krieger waren «mutig, stark und regsam»
 * und treu «zu allen Zeiten und in allem, was ihnen anvertraut war»
 * (Alma 53:20) – regsam heisst anpacken statt warten. Nach der Schlacht
 * war jeder verwundet, aber keiner gefallen (Alma 57:25): Ein Treffer
 * beendet hier nichts, erst der dritte.
 *
 * **Das Tempo.** Statt die Hürden schneller laufen zu lassen, läuft die
 * ganze Welt schneller – Laufen, Springen, Fallen, alles um denselben
 * Faktor (`runTempo`). So bleibt jede Hürde und jede Lücke mit demselben
 * Sprung zu schaffen, nur das Zeitfenster dafür wird kürzer – und die
 * Reaktion des Menschen davor wird es nicht. Ab etwa vierzig Sekunden
 * zieht ein zweiter Schub an, den auf Dauer niemand hält.
 *
 * **Masse.** Gerechnet wird in Körperhöhen (eine Einheit ≈ die Höhe des
 * Läufers), die Leinwand rechnet sie in Pixel um. Wie weit man voraus
 * sieht, ist fest (`RUN_WORLD.ahead`): Ein breiter Bildschirm zeigt
 * nicht früher, was kommt – sonst wäre die Rangliste am Rechner leichter.
 *
 * Gezeichnet wird in `components/impulse/game/runGame`; die Regeln stehen
 * hier, damit `tests/impulse-game.test.ts` eine Runde mit einem
 * nachgebildeten Spieler durchspielen kann – mit genau diesem Code.
 */

export interface RunItem {
  emoji: string
  label: string
}

/** Die Ausreden – darüber springen. */
export const RUN_HURDLES: readonly RunItem[] = [
  { emoji: '⏰', label: 'Später' },
  { emoji: '🛋️', label: 'Keine Lust' },
  { emoji: '📱', label: 'Nur noch kurz' },
  { emoji: '🤷', label: 'Egal' },
  { emoji: '😴', label: 'Zu müde' },
  { emoji: '🤔', label: 'Zweifel' },
  { emoji: '😨', label: 'Angst' },
]

/** Die Lücken – auch Ausreden, nur tiefer: hinüberspringen. */
export const RUN_GAPS: readonly RunItem[] = [
  { emoji: '🐌', label: 'Aufschieben' },
  { emoji: '💤', label: 'Verschlafen' },
  { emoji: '🌀', label: 'Ablenkung' },
  { emoji: '🙈', label: 'Wegschauen' },
  { emoji: '⏳', label: 'Morgen dann' },
]

/** Was anvertraut ist – einsammeln. */
export const RUN_TASKS: readonly RunItem[] = [
  { emoji: '🙏', label: 'Beten' },
  { emoji: '📖', label: 'Schriften' },
  { emoji: '🤝', label: 'Helfen' },
  { emoji: '🧹', label: 'Ämtli' },
  { emoji: '📚', label: 'Hausaufgaben' },
  { emoji: '⛪', label: 'Kirche' },
]

/** Drei Wunden – und zehn Hindernisse am Stück ohne Treffer heilen eine. */
export const RUN_LIVES = 3
export const RUN_STREAK_FOR_LIFE = 10

/**
 * Die Welt in Körperhöhen und Spielsekunden. Eine Spielsekunde ist am
 * Anfang eine echte; mit dem Tempo werden es mehr je echter Sekunde.
 */
export const RUN_WORLD = {
  /** Laufen: Einheiten je Spielsekunde. */
  speed: 6.5,
  /** Absprung nach oben. */
  jumpVelocity: 9.5,
  /** Schwerkraft, solange gedrückt und noch im Steigen – so wird der Sprung höher … */
  gravityHold: 22,
  /** … und sonst: Wer kurz tippt, hüpft nur. */
  gravity: 48,
  /** Ein Druck kurz vor der Landung springt gleich danach – sonst ginge er verloren. */
  buffer: 0.12,
  /** Wer eben über eine Kante gelaufen ist, darf noch abspringen – so lange (Spielsekunden). */
  coyote: 0.08,
  /** Nach einem Treffer: so lange (Spielsekunden) trifft nichts mehr. */
  invulnerable: 1.0,
  /** Der Läufer: Breite und Höhe seiner Trefferfläche. */
  runnerWidth: 0.55,
  runnerHeight: 0.9,
  /** So viel verzeiht jede Hürde, jede Kante und jedes Brett – knapp ist noch drüber. */
  forgive: 0.08,
  /** So tief fällt er in eine Lücke, bis sie ihn auffängt. */
  fallDepth: 0.7,
  /** So weit sieht man voraus – und so weit hinten steht der Läufer. */
  ahead: 7.2,
  behind: 1.3,
} as const

/**
 * Die Etagen: die Höhe ihrer Oberkante. Ein voller Sprung trägt gut zwei
 * Einheiten hoch – vom Boden auf die erste Etage, von der ersten auf die
 * zweite, aber nie vom Boden auf die zweite.
 */
export const RUN_LEVELS = [0, 1.5, 3] as const

/** Die drei Arten Hürden – klein, hoch, doppelt. */
export const RUN_HURDLE_SHAPES = {
  small: { w: 0.7, h: 0.72 },
  tall: { w: 0.72, h: 1.22 },
  double: { w: 1.45, h: 0.72 },
} as const

export type RunHurdleShape = keyof typeof RUN_HURDLE_SHAPES

export const RUN_PACE = {
  /** Der Zeitfaktor wächst von 1 gegen 1 + `tempoGain` … */
  tempoGain: 1.6,
  tempoDecay: 22,
  /** … und ab hier kommt ein zweiter Schub dazu. */
  rushFrom: 40,
  rushPerSecond: 0.05,
  /** Abstand zwischen zwei Abschnitten in Spielsekunden – nie so knapp, dass man nicht dazwischen landet. */
  gapMin: 0.95,
  gapMax: 1.75,
  /** Mit der Zeit rücken die Abschnitte zusammen: ab `tightenFrom` Sekunden bis `gapMaxLate`, über `tightenOver`. */
  gapMaxLate: 1.3,
  tightenFrom: 8,
  tightenOver: 30,
  /** Ab hier (echte Sekunden) tun sich Lücken auf, und die erste Etage kommt dazu … */
  holesFrom: 4,
  /** … ab hier die zweite. */
  upperFrom: 16,
  /** Ab hier stehen auch auf der ersten Etage Ausreden – mit dieser Wahrscheinlichkeit je Brett. */
  upHurdlesFrom: 12,
  upHurdleChance: 0.45,
  /** Breite einer Lücke: anfangs bis `holeEarly`, nach `holeGrow` Sekunden bis `holeLate`. */
  holeMin: 1.2,
  holeEarly: 1.8,
  holeLate: 2.6,
  holeGrow: 30,
  /** Unter jedem Brettende so viel freier Boden: Wer herunterfällt, landet sicher. */
  landing: 3.5,
} as const

/** Wie viele Spielsekunden nach `t` echten Sekunden je echter Sekunde vergehen. */
export function runTempo(t: number): number {
  const time = Math.max(0, t)
  const p = RUN_PACE
  const base = 1 + p.tempoGain * (1 - Math.exp(-time / p.tempoDecay))
  const rush = time > p.rushFrom ? 1 + (time - p.rushFrom) * p.rushPerSecond : 1
  return base * rush
}

export interface RunHurdle {
  id: number
  /** Linke Kante, in Einheiten ab dem Start gerechnet. */
  x: number
  /** Worauf sie steht: 0 am Boden, sonst die Höhe ihrer Etage. */
  base: number
  w: number
  h: number
  shape: RunHurdleShape
  item: RunItem
  /** Schon hinter dem Läufer. */
  passed: boolean
  /** Hat ihn getroffen – oder ist er hindurch, solange ihn nichts treffen konnte. */
  touched: boolean
  /**
   * Kam er von ihrer Ebene her darüber? Gesetzt, sobald er sie erreicht –
   * wer auf einer anderen Etage an ihr vorbeiläuft, bekommt keinen Punkt.
   */
  atLevel: boolean | null
}

export interface RunGap {
  id: number
  /** Linke Kante, in Einheiten ab dem Start. */
  x: number
  w: number
  item: RunItem
  passed: boolean
  /** Er ist hineingefallen – jetzt liegt eine Brücke darüber. */
  bridged: boolean
  /** Wie bei der Hürde: Nur wer vom Boden aus hinüberspringt, bekommt den Punkt. */
  atLevel: boolean | null
}

export interface RunPlatform {
  id: number
  /** Linke Kante und Länge, in Einheiten. */
  x: number
  w: number
  /** 1 oder 2 – die Etage. */
  level: 1 | 2
  /** Die Oberkante über dem Boden (`RUN_LEVELS`). */
  top: number
}

export interface RunTask {
  id: number
  /** Mitte, in Einheiten ab dem Start. */
  x: number
  /** Höhe der Mitte über dem Boden. */
  y: number
  item: RunItem
  taken: boolean
}

export type RunEvent =
  | { kind: 'jump' }
  /** Gelandet – `impact` ist die Fallgeschwindigkeit davor. */
  | { kind: 'land'; impact: number }
  /** Über eine Hürde – ein Punkt. */
  | { kind: 'clear'; hurdle: RunHurdle; healed: boolean }
  /** Über eine Lücke – ein Punkt. */
  | { kind: 'leap'; gap: RunGap; healed: boolean }
  /** An eine Hürde gestossen – eine Wunde. */
  | { kind: 'hit'; hurdle: RunHurdle }
  /** In eine Lücke gefallen – eine Wunde, ausser er war gerade unverwundbar. */
  | { kind: 'fall'; gap: RunGap; hurt: boolean }
  /** Eine Aufgabe eingesammelt – ein Punkt. */
  | { kind: 'task'; task: RunTask }
  | { kind: 'over' }

/** Grösser rechnet ein einzelner Schritt nie – sonst spränge der Läufer durch eine Hürde. */
const SUBSTEP = 1 / 240
/** Halbmesser einer Aufgabe – zum Einsammeln. */
export const RUN_TASK_RADIUS = 0.32
/** Eine Aufgabe auf einer Etage schwebt so hoch über dem Brett – auf Brusthöhe. */
const TASK_LIFT = 0.45

/**
 * Eine Runde «Keine Ausreden!». `press` und `release` sind der Finger
 * (oder die Taste), `step` rechnet die Zeit weiter und meldet, was
 * geschehen ist.
 */
export class RunRound {
  /** Echte Sekunden seit dem Start. */
  time = 0
  /** Zurückgelegte Einheiten – die Welt läuft unter dem Läufer durch. */
  distance = 0
  points = 0
  lives = RUN_LIVES
  streak = 0
  over = false
  /** Höhe der Füsse über dem Boden und Geschwindigkeit nach oben. */
  y = 0
  vy = 0
  grounded = true
  /** Die Höhe, auf der er zuletzt stand – 0 am Boden, sonst eine Etage. */
  base = 0
  /** Restliche Spielsekunden, in denen nichts trifft. */
  invulnerable = 0
  hurdles: RunHurdle[] = []
  gaps: RunGap[] = []
  platforms: RunPlatform[] = []
  tasks: RunTask[] = []

  private readonly random: () => number
  private holding = false
  private buffered = 0
  private coyote = 0
  private nextX = RUN_WORLD.ahead + 1.5
  private nextId = 1
  private spawned = 0
  /** Die ersten Abschnitte mit Lücken bzw. zweiter Etage führen sie ein. */
  private introducedHoles = false
  private introducedUpper = false
  private lastItem: RunItem | null = null
  private lastGap: RunItem | null = null
  private lastTask: RunItem | null = null
  private readonly out: RunEvent[] = []

  constructor(random: () => number) {
    this.random = random
  }

  /** Finger auf den Bildschirm: springen – oder gleich nach der Landung. */
  press(): void {
    if (this.over) return
    this.holding = true
    if (this.grounded || this.coyote > 0) this.jump()
    else this.buffered = RUN_WORLD.buffer
  }

  /** Finger weg: Der Sprung steigt nicht weiter. */
  release(): void {
    this.holding = false
  }

  /** Der Zeitfaktor jetzt – für die Leinwand (Laufschritt, Wolken). */
  get tempo(): number {
    return runTempo(this.time)
  }

  step(dt: number): readonly RunEvent[] {
    this.out.length = 0
    if (this.over) return this.out
    const tempo = runTempo(this.time)
    this.time += dt
    let rest = dt * tempo
    while (rest > 1e-9 && !this.over) {
      const h = Math.min(SUBSTEP, rest)
      rest -= h
      this.physics(h)
    }
    return this.out
  }

  /** Steht dort, wo er gerade ist, Boden unter ihm – oder ist da eine Lücke? */
  groundAt(x: number): boolean {
    const s = RUN_WORLD.runnerWidth / 2 - RUN_WORLD.forgive
    return !this.gaps.some((gap) => !gap.bridged && x - s >= gap.x && x + s <= gap.x + gap.w)
  }

  /** Das Brett der Höhe `top`, das ihn an der Stelle `x` trägt. */
  platformAt(x: number, top: number): RunPlatform | null {
    const s = RUN_WORLD.runnerWidth / 2 - RUN_WORLD.forgive
    return (
      this.platforms.find(
        (platform) =>
          platform.top === top && x + s >= platform.x && x - s <= platform.x + platform.w,
      ) ?? null
    )
  }

  private jump() {
    this.vy = RUN_WORLD.jumpVelocity
    this.grounded = false
    this.buffered = 0
    this.coyote = 0
    this.out.push({ kind: 'jump' })
  }

  private supported(top: number): boolean {
    return top === 0 ? this.groundAt(this.distance) : this.platformAt(this.distance, top) !== null
  }

  private physics(h: number) {
    const w = RUN_WORLD
    this.distance += w.speed * h
    if (this.invulnerable > 0) this.invulnerable = Math.max(0, this.invulnerable - h)
    if (this.buffered > 0) this.buffered = Math.max(0, this.buffered - h)
    if (this.coyote > 0) this.coyote = Math.max(0, this.coyote - h)

    // Über die Kante gelaufen: Er fällt – darf aber kurz noch abspringen.
    if (this.grounded && !this.supported(this.base)) {
      this.grounded = false
      this.vy = 0
      this.coyote = w.coyote
    }

    if (!this.grounded) {
      const gravity = this.holding && this.vy > 0 ? w.gravityHold : w.gravity
      const before = this.y
      this.vy -= gravity * h
      this.y += this.vy * h
      if (this.vy <= 0) {
        // Gelandet wird nur von oben – auf der höchsten Fläche, die er dabei kreuzt.
        for (let index = RUN_LEVELS.length - 1; index >= 0; index -= 1) {
          const top = RUN_LEVELS[index]
          if (before >= top - 1e-9 && this.y <= top && this.supported(top)) {
            this.land(top)
            break
          }
        }
      }
      if (!this.grounded && this.y < 0) this.checkFall()
    }

    while (this.nextX - this.distance < w.ahead + 1) this.spawn()
    if (!this.over) this.collide()
  }

  private land(top: number) {
    const impact = -this.vy
    this.y = top
    this.vy = 0
    this.grounded = true
    this.base = top
    this.coyote = 0
    this.out.push({ kind: 'land', impact })
    if (this.buffered > 0) this.jump()
  }

  /** Unter dem Boden: tief genug gefallen – oder an die andere Kante gestossen? */
  private checkFall() {
    const w = RUN_WORLD
    const half = w.runnerWidth / 2
    const gap = this.gaps.find(
      (candidate) =>
        !candidate.bridged &&
        this.distance + half > candidate.x &&
        this.distance - half < candidate.x + candidate.w,
    )
    if (!gap) {
      // Keine Lücke unter ihm – dann trägt der Boden (nur eine Rundung im Schritt).
      this.land(0)
      return
    }
    const wall = this.distance + half - w.forgive > gap.x + gap.w
    if (this.y > -w.fallDepth && !wall) return
    // Aufgefangen: Die Lücke wird zur Brücke, er hüpft hinauf und läuft weiter.
    gap.bridged = true
    this.y = 0
    this.vy = w.jumpVelocity * 0.45
    this.base = 0
    this.streak = 0
    const hurt = this.invulnerable <= 0
    if (hurt) {
      this.lives -= 1
      this.invulnerable = w.invulnerable
    }
    this.out.push({ kind: 'fall', gap, hurt })
    if (this.lives <= 0) {
      this.over = true
      this.out.push({ kind: 'over' })
    }
  }

  /** Ein Punkt für ein überwundenes Hindernis – und alle zehn eine Wunde weniger. */
  private score(): boolean {
    this.points += 1
    this.streak += 1
    const healed = this.streak % RUN_STREAK_FOR_LIFE === 0 && this.lives < RUN_LIVES
    if (healed) this.lives += 1
    return healed
  }

  private collide() {
    const w = RUN_WORLD
    const half = w.runnerWidth / 2
    for (const hurdle of this.hurdles) {
      const left = hurdle.x - this.distance
      const right = left + hurdle.w
      if (!hurdle.passed && right < -half) {
        hurdle.passed = true
        if (!hurdle.touched && hurdle.atLevel === true) {
          this.out.push({ kind: 'clear', hurdle, healed: this.score() })
        }
        continue
      }
      if (hurdle.passed || hurdle.touched) continue
      const overlapX = left + w.forgive < half && right - w.forgive > -half
      if (overlapX && hurdle.atLevel === null) hurdle.atLevel = this.base === hurdle.base
      // Die Füsse gemessen ab ihrem Fuss: darüber ist drüber, darunter eine andere Etage –
      // wer von unten durch ein Brett springt, stösst sich nicht an dem, was darauf steht.
      const feet = this.y - hurdle.base
      if (!overlapX || feet >= hurdle.h - w.forgive || feet < -0.05) continue
      hurdle.touched = true
      // Solange ihn nichts treffen kann, läuft er hindurch – ohne Wunde, aber auch ohne Punkt.
      if (this.invulnerable > 0) continue
      this.lives -= 1
      this.streak = 0
      this.invulnerable = w.invulnerable
      this.out.push({ kind: 'hit', hurdle })
      if (this.lives <= 0) {
        this.over = true
        this.out.push({ kind: 'over' })
        return
      }
    }
    for (const gap of this.gaps) {
      if (gap.passed) continue
      if (gap.atLevel === null && gap.x < this.distance + half) gap.atLevel = this.base === 0
      if (gap.x + gap.w < this.distance - half) {
        gap.passed = true
        if (!gap.bridged && gap.atLevel === true) {
          this.out.push({ kind: 'leap', gap, healed: this.score() })
        }
      }
    }
    for (const task of this.tasks) {
      if (task.taken) continue
      const dx = Math.abs(task.x - this.distance)
      const top = this.y + w.runnerHeight
      if (
        dx < half + RUN_TASK_RADIUS &&
        task.y + RUN_TASK_RADIUS > this.y &&
        task.y - RUN_TASK_RADIUS < top
      ) {
        task.taken = true
        this.points += 1
        this.out.push({ kind: 'task', task })
      }
    }
    // Was weit hinten liegt, braucht niemand mehr.
    const behind = this.distance - 4
    if (this.hurdles.length > 8) this.hurdles = this.hurdles.filter((h) => h.x + h.w > behind)
    if (this.gaps.length > 8) this.gaps = this.gaps.filter((g) => g.x + g.w > behind)
    if (this.platforms.length > 8) this.platforms = this.platforms.filter((p) => p.x + p.w > behind)
    if (this.tasks.length > 12) this.tasks = this.tasks.filter((t) => t.x > behind)
  }

  /* ---------------------------------------------------------------- */
  /* Die Strecke                                                       */
  /* ---------------------------------------------------------------- */

  /**
   * Der nächste Abschnitt. Am Anfang nur Hürden; ab `holesFrom` auch
   * Lücken und die erste Etage, ab `upperFrom` die zweite. Der erste
   * Abschnitt jeder Neuheit führt sie ein – ein Brett über einer Lücke,
   * dann ein Brett mit einem zweiten darüber.
   */
  private spawn() {
    const p = RUN_PACE
    const x = this.nextX
    let end: number
    if (this.spawned < 3 || this.time < p.holesFrom) {
      end = this.hurdleSection(x)
    } else if (!this.introducedHoles) {
      this.introducedHoles = true
      end = this.platformSection(x, true)
    } else if (this.time >= p.upperFrom && !this.introducedUpper) {
      this.introducedUpper = true
      end = this.towerSection(x)
    } else {
      const roll = this.random()
      if (this.time < p.upperFrom) {
        end =
          roll < 0.4
            ? this.hurdleSection(x)
            : roll < 0.65
              ? this.gapSection(x)
              : this.platformSection(x, this.random() < 0.65)
      } else {
        end =
          roll < 0.3
            ? this.hurdleSection(x)
            : roll < 0.5
              ? this.gapSection(x)
              : roll < 0.75
                ? this.platformSection(x, this.random() < 0.65)
                : this.towerSection(x)
      }
    }
    this.spawned += 1
    this.nextX = end
  }

  /** Abstand bis zum nächsten Abschnitt – in Spielsekunden gewürfelt. */
  private space(): number {
    const p = RUN_PACE
    const tight = Math.min(1, Math.max(0, (this.time - p.tightenFrom) / p.tightenOver))
    const max = p.gapMax + (p.gapMaxLate - p.gapMax) * tight
    return (p.gapMin + (max - p.gapMin) * this.random()) * RUN_WORLD.speed
  }

  /** Wie breit eine Lücke jetzt sein darf – mit der Zeit breiter. */
  private holeWidth(): number {
    const p = RUN_PACE
    const grown = Math.min(1, Math.max(0, (this.time - p.holesFrom) / p.holeGrow))
    const max = p.holeEarly + (p.holeLate - p.holeEarly) * grown
    return p.holeMin + (max - p.holeMin) * this.random()
  }

  /**
   * Eine Hürde – und manchmal eine Aufgabe dazu: im Abstand danach, auf
   * dem Boden oder in Sprunghöhe, oder hoch über der Hürde, für einen
   * vollen Sprung.
   */
  private hurdleSection(x: number): number {
    const roll = this.random()
    const shape: RunHurdleShape =
      this.spawned < 3 ? 'small' : roll < 0.55 ? 'small' : roll < 0.8 ? 'tall' : 'double'
    const hurdle = this.addHurdle(x, shape)
    const gap = this.space()
    const after = hurdle.x + hurdle.w
    const taskRoll = this.random()
    if (taskRoll < 0.22) {
      // Hoch über der Hürde: nur mit einem vollen Sprung.
      this.addTask(hurdle.x + hurdle.w / 2, hurdle.h + 1.05)
    } else if (taskRoll < 0.6) {
      // Im Abstand danach: am Boden oder in Sprunghöhe.
      const air = this.random() < 0.55
      this.addTask(after + gap * (0.45 + 0.1 * this.random()), air ? 1.55 : 0.42)
    }
    return after + gap
  }

  /** Eine Lücke allein – manchmal mit einer Aufgabe im Bogen darüber. */
  private gapSection(x: number): number {
    const gap = this.addGap(x, this.holeWidth())
    // Auf dem Scheitel eines vollen Sprungs – wer hoch springt, nimmt sie mit.
    if (this.random() < 0.45) this.addTask(gap.x + gap.w / 2, 2)
    return gap.x + gap.w + this.space()
  }

  /**
   * Ein Brett auf der ersten Etage, darauf zwei oder drei Aufgaben. Unten
   * eine Lücke oder eine kleine Hürde – und manchmal eine Aufgabe am
   * Boden: Wer unten bleibt, sammelt die Punkte fürs Hinüberspringen.
   *
   * Ab `upHurdlesFrom` steht oben manchmal eine Ausrede, mit einer
   * Aufgabe davor und einer darüber. Dann bleibt der Boden darunter frei:
   * Unten ist es sicher, oben gibt es mehr – eine echte Wahl. (Läge unten
   * auch etwas, trüge der Sprung darüber geradewegs hinauf in die Ausrede.)
   */
  private platformSection(x: number, hole: boolean): number {
    const p = RUN_PACE
    const px = x + 0.8
    const pw = 5 + 3 * this.random()
    const top = RUN_LEVELS[1]
    this.addPlatform(px, pw, 1)
    if (this.time >= p.upHurdlesFrom && this.random() < p.upHurdleChance) {
      const hx = px + 2.2 + (pw - 4.4) * this.random()
      const hurdle = this.addHurdle(hx, 'small', top)
      this.addTask(px + 0.9, top + TASK_LIFT)
      this.addTask(hx + hurdle.w / 2, top + hurdle.h + 1.05)
      if (this.random() < 0.4) this.addTask(px + pw / 2, 0.42)
      return px + pw + Math.max(this.space(), p.landing)
    }
    const count = this.random() < 0.5 ? 2 : 3
    this.addTaskRow(px + pw / 2, top + TASK_LIFT, count, 1.2)
    if (hole) {
      const gw = Math.min(this.holeWidth(), pw - 2.4)
      const gx = px + 1.2 + (pw - gw - 2.4) * this.random()
      this.addGap(gx, gw)
      if (this.random() < 0.4) this.addTask(px + 0.2, 0.42)
    } else {
      const hx = px + 1.5 + (pw - 3.5) * this.random()
      this.addHurdle(hx, 'small')
      if (this.random() < 0.4) this.addTask(hx + 1.8, 0.42)
    }
    return px + pw + Math.max(this.space(), RUN_PACE.landing)
  }

  /**
   * Zwei Etagen übereinander: unten ein langes Brett, darüber ein
   * kürzeres mit drei Aufgaben – erreichbar nur von unten her. Das obere
   * endet früh genug, dass man aufs untere fällt, nicht daneben.
   */
  private towerSection(x: number): number {
    const px = x + 0.8
    const pw = 8.5 + 2.5 * this.random()
    this.addPlatform(px, pw, 1)
    const qx = px + 2.4 + 0.6 * this.random()
    const qw = Math.min(3.4 + 1.4 * this.random(), px + pw - 2 - qx)
    this.addPlatform(qx, qw, 2)
    this.addTask(px + 1.2, RUN_LEVELS[1] + TASK_LIFT)
    this.addTaskRow(qx + qw / 2, RUN_LEVELS[2] + TASK_LIFT, 3, 1.1)
    if (this.random() < 0.7) {
      const gw = Math.min(this.holeWidth(), pw - 2.4)
      const gx = px + 1.2 + (pw - gw - 2.4) * this.random()
      this.addGap(gx, gw)
    } else {
      this.addHurdle(px + 1.5 + (pw - 3.5) * this.random(), 'small')
    }
    return px + pw + Math.max(this.space(), RUN_PACE.landing)
  }

  private addHurdle(x: number, shape: RunHurdleShape, base = 0): RunHurdle {
    const size = RUN_HURDLE_SHAPES[shape]
    const item = this.pick(RUN_HURDLES, this.lastItem)
    this.lastItem = item
    const hurdle: RunHurdle = {
      id: this.nextId,
      x,
      base,
      w: size.w,
      h: size.h,
      shape,
      item,
      passed: false,
      touched: false,
      atLevel: null,
    }
    this.nextId += 1
    this.hurdles.push(hurdle)
    return hurdle
  }

  private addGap(x: number, w: number): RunGap {
    const item = this.pick(RUN_GAPS, this.lastGap)
    this.lastGap = item
    const gap: RunGap = {
      id: this.nextId,
      x,
      w,
      item,
      passed: false,
      bridged: false,
      atLevel: null,
    }
    this.nextId += 1
    this.gaps.push(gap)
    return gap
  }

  private addPlatform(x: number, w: number, level: 1 | 2) {
    this.platforms.push({ id: this.nextId, x, w, level, top: RUN_LEVELS[level] })
    this.nextId += 1
  }

  /** Aufgaben in einer Reihe, um `center` herum. */
  private addTaskRow(center: number, y: number, count: number, spacing: number) {
    for (let index = 0; index < count; index += 1) {
      this.addTask(center + (index - (count - 1) / 2) * spacing, y)
    }
  }

  private addTask(x: number, y: number) {
    const item = this.pick(RUN_TASKS, this.lastTask)
    this.lastTask = item
    this.tasks.push({ id: this.nextId, x, y, item, taken: false })
    this.nextId += 1
  }

  /** Zufällig, aber nie zweimal hintereinander dasselbe. */
  private pick(items: readonly RunItem[], last: RunItem | null): RunItem {
    const choices = items.filter((item) => item !== last)
    return choices[Math.floor(this.random() * choices.length) % choices.length]
  }
}
