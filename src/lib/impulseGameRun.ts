/*
 * «Keine Ausreden!» – das Minispiel zur Woche über Helamans junge Krieger,
 * ohne Leinwand: Laufen, Springen, Hürden und Aufgaben.
 *
 * Ein junger Krieger läuft, und ihm kommen Ausreden entgegen: «Später»,
 * «Keine Lust», «Nur noch kurz». Ein Tipp – oder die Leertaste – lässt
 * ihn springen; wer länger drückt, springt höher. Jede Hürde, über die er
 * kommt, zählt einen Punkt, ebenso jede Aufgabe, die er unterwegs
 * einsammelt: beten, Schriften, helfen, Ämtli. Wer an eine Ausrede
 * stösst, ist verwundet – drei Wunden, und die Runde ist vorbei. Zehn
 * Hürden am Stück ohne Treffer heilen eine.
 *
 * Das Bild dahinter: Die jungen Krieger waren «mutig, stark und regsam»
 * und treu «zu allen Zeiten und in allem, was ihnen anvertraut war»
 * (Alma 53:20) – regsam heisst anpacken statt warten. Nach der Schlacht
 * war jeder verwundet, aber keiner gefallen (Alma 57:25): Ein Treffer
 * beendet hier nichts, erst der dritte.
 *
 * **Das Tempo.** Statt die Hürden schneller laufen zu lassen, läuft die
 * ganze Welt schneller – Laufen, Springen, Fallen, alles um denselben
 * Faktor (`runTempo`). So bleibt jede Hürde mit demselben Sprung zu
 * schaffen, nur das Zeitfenster dafür wird kürzer – und die Reaktion
 * des Menschen davor wird es nicht. Ab etwa vierzig Sekunden zieht ein
 * zweiter Schub an, den auf Dauer niemand hält.
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

/** Was anvertraut ist – einsammeln. */
export const RUN_TASKS: readonly RunItem[] = [
  { emoji: '🙏', label: 'Beten' },
  { emoji: '📖', label: 'Schriften' },
  { emoji: '🤝', label: 'Helfen' },
  { emoji: '🧹', label: 'Ämtli' },
  { emoji: '📚', label: 'Hausaufgaben' },
  { emoji: '⛪', label: 'Kirche' },
]

/** Drei Wunden – und zehn Hürden am Stück ohne Treffer heilen eine. */
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
  /** Nach einem Treffer: so lange (Spielsekunden) trifft nichts mehr. */
  invulnerable: 1.0,
  /** Der Läufer: Breite und Höhe seiner Trefferfläche. */
  runnerWidth: 0.55,
  runnerHeight: 0.9,
  /** So viel verzeiht jede Hürde an den Kanten – knapp ist noch drüber. */
  forgive: 0.08,
  /** So weit sieht man voraus – und so weit hinten steht der Läufer. */
  ahead: 7.2,
  behind: 1.3,
} as const

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
  /** Abstand zwischen zwei Hürden in Spielsekunden – nie so knapp, dass man nicht dazwischen landet. */
  gapMin: 0.95,
  gapMax: 1.75,
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
  w: number
  h: number
  shape: RunHurdleShape
  item: RunItem
  /** Schon hinter dem Läufer. */
  passed: boolean
  /** Hat ihn getroffen – oder ist er hindurch, solange ihn nichts treffen konnte. */
  touched: boolean
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
  | { kind: 'land' }
  /** Über eine Hürde – ein Punkt. */
  | { kind: 'clear'; hurdle: RunHurdle; healed: boolean }
  /** An eine Hürde gestossen – eine Wunde. */
  | { kind: 'hit'; hurdle: RunHurdle }
  /** Eine Aufgabe eingesammelt – ein Punkt. */
  | { kind: 'task'; task: RunTask }
  | { kind: 'over' }

/** Grösser rechnet ein einzelner Schritt nie – sonst spränge der Läufer durch eine Hürde. */
const SUBSTEP = 1 / 240
/** Halbmesser einer Aufgabe – zum Einsammeln. */
export const RUN_TASK_RADIUS = 0.32

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
  /** Höhe über dem Boden und Geschwindigkeit nach oben. */
  y = 0
  vy = 0
  grounded = true
  /** Restliche Spielsekunden, in denen nichts trifft. */
  invulnerable = 0
  hurdles: RunHurdle[] = []
  tasks: RunTask[] = []

  private readonly random: () => number
  private holding = false
  private buffered = 0
  private nextX = RUN_WORLD.ahead + 1.5
  private nextId = 1
  private spawned = 0
  private lastItem: RunItem | null = null
  private lastTask: RunItem | null = null
  private readonly out: RunEvent[] = []

  constructor(random: () => number) {
    this.random = random
  }

  /** Finger auf den Bildschirm: springen – oder gleich nach der Landung. */
  press(): void {
    if (this.over) return
    this.holding = true
    if (this.grounded) this.jump()
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

  private jump() {
    this.vy = RUN_WORLD.jumpVelocity
    this.grounded = false
    this.buffered = 0
    this.out.push({ kind: 'jump' })
  }

  private physics(h: number) {
    const w = RUN_WORLD
    this.distance += w.speed * h
    if (this.invulnerable > 0) this.invulnerable = Math.max(0, this.invulnerable - h)
    if (this.buffered > 0) this.buffered = Math.max(0, this.buffered - h)

    if (!this.grounded) {
      const gravity = this.holding && this.vy > 0 ? w.gravityHold : w.gravity
      this.vy -= gravity * h
      this.y += this.vy * h
      if (this.y <= 0) {
        this.y = 0
        this.vy = 0
        this.grounded = true
        this.out.push({ kind: 'land' })
        if (this.buffered > 0) this.jump()
      }
    }

    while (this.nextX - this.distance < w.ahead + 1) this.spawn()
    this.collide()
  }

  private collide() {
    const w = RUN_WORLD
    const half = w.runnerWidth / 2
    for (const hurdle of this.hurdles) {
      const left = hurdle.x - this.distance
      const right = left + hurdle.w
      if (!hurdle.passed && right < -half) {
        hurdle.passed = true
        if (!hurdle.touched) {
          this.points += 1
          this.streak += 1
          const healed = this.streak % RUN_STREAK_FOR_LIFE === 0 && this.lives < RUN_LIVES
          if (healed) this.lives += 1
          this.out.push({ kind: 'clear', hurdle, healed })
        }
        continue
      }
      if (hurdle.passed || hurdle.touched) continue
      const overlapX = left + w.forgive < half && right - w.forgive > -half
      if (!overlapX || this.y >= hurdle.h - w.forgive) continue
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
    if (this.hurdles.length > 8)
      this.hurdles = this.hurdles.filter((h) => h.x + h.w > this.distance - 4)
    if (this.tasks.length > 8) this.tasks = this.tasks.filter((t) => t.x > this.distance - 4)
  }

  /**
   * Die nächste Hürde – und manchmal eine Aufgabe dazu: im Abstand davor,
   * auf dem Boden oder in Sprunghöhe, oder hoch über der Hürde, für einen
   * vollen Sprung.
   */
  private spawn() {
    const w = RUN_WORLD
    const p = RUN_PACE
    const roll = this.random()
    const shape: RunHurdleShape =
      this.spawned < 3 ? 'small' : roll < 0.55 ? 'small' : roll < 0.8 ? 'tall' : 'double'
    const size = RUN_HURDLE_SHAPES[shape]
    const choices = RUN_HURDLES.filter((item) => item !== this.lastItem)
    const item = choices[Math.floor(this.random() * choices.length) % choices.length]
    this.lastItem = item
    const hurdle: RunHurdle = {
      id: this.nextId,
      x: this.nextX,
      w: size.w,
      h: size.h,
      shape,
      item,
      passed: false,
      touched: false,
    }
    this.nextId += 1
    this.spawned += 1
    this.hurdles.push(hurdle)

    const gapTime = p.gapMin + (p.gapMax - p.gapMin) * this.random()
    const gap = gapTime * w.speed
    const after = hurdle.x + hurdle.w
    this.nextX = after + gap

    const taskRoll = this.random()
    if (taskRoll < 0.22) {
      // Hoch über der Hürde: nur mit einem vollen Sprung.
      this.addTask(hurdle.x + hurdle.w / 2, hurdle.h + 1.05)
    } else if (taskRoll < 0.6) {
      // Im Abstand danach: am Boden oder in Sprunghöhe.
      const air = this.random() < 0.55
      this.addTask(after + gap * (0.45 + 0.1 * this.random()), air ? 1.55 : 0.42)
    }
  }

  private addTask(x: number, y: number) {
    const choices = RUN_TASKS.filter((item) => item !== this.lastTask)
    const item = choices[Math.floor(this.random() * choices.length) % choices.length]
    this.lastTask = item
    this.tasks.push({ id: this.nextId, x, y, item, taken: false })
    this.nextId += 1
  }
}
