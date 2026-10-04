import {
  nextSortItem,
  SORT_ITEMS,
  SORT_LIVES,
  SORT_SIDES,
  SORT_STREAK_FOR_LIFE,
  sortPace,
  type SortItem,
} from '@/lib/impulseGame'

/*
 * «Gut für dich?» – das Minispiel zum Wort der Weisheit, auf einer Leinwand.
 *
 * Von oben fallen Gegenstände: Weizen, Rüebli, Wasser, ein Velo – und
 * Zigarette, Bier, Kaffee, Drogen. Der unterste ist dran (er trägt den
 * Ring); ein Wisch nach rechts legt ihn zu «Gut für dich», einer nach
 * links zu «Nein, danke». Tippen geht auch: links oder rechts aufs Bild.
 * Wer danebenliegt oder einen Gegenstand bis zur Linie fallen lässt,
 * verliert ein Leben – drei gibt es, und zehn richtige am Stück geben
 * eines zurück. Das Tempo zieht von Anfang an an (`sortPace`), eine Runde
 * dauert so 20 bis 60 Sekunden.
 *
 * Gezeichnet wird auf eine Leinwand statt in Elemente – wie Turmbau in
 * den Mini-Games: Dutzende Gegenstände, Funken und Schriftzüge schiebt
 * kein Browser als eigene Kästen flüssig durchs Bild. React kennt nur die
 * Ränder (Einführung, Ergebnis, der Knopf zum Abbrechen); die Runde
 * selbst läuft hier, Bild für Bild, ohne einen einzigen Render.
 *
 * Damit es auch auf älteren Telefonen flüssig bleibt:
 * - Jeder Gegenstand wird einmal vorgezeichnet (Kreis, Schatten, Emoji,
 *   Wort) und danach nur noch als Bild gestempelt – Schatten und Emoji je
 *   Bild neu zu zeichnen kostet ein Vielfaches.
 * - Der Hintergrund liegt fertig auf einer zweiten Leinwand.
 * - Gerechnet wird mit der verstrichenen Zeit, nicht mit Bildern: 60 oder
 *   120 Bilder je Sekunde ergeben dasselbe Spiel. Nach einem Tabwechsel
 *   springt die Zeit nicht (`MAX_STEP`).
 * - Die Pixeldichte ist auf 2 begrenzt: schärfer sieht niemand, aber
 *   jede Stufe mehr kostet die Grafik ein Vielfaches.
 */

export type SortSide = 'left' | 'right'

export interface SortGameOptions {
  canvas: HTMLCanvasElement
  /** Dunkle Darstellung – die Farben folgen dem Bereich. */
  dark: boolean
  /** Weniger Bewegung: kein Wackeln, weniger Funken. */
  reducedMotion: boolean
  /** Platz oben, den die Seite für sich braucht (Knopf «Abbrechen», Notch). */
  topInset: number
  /** Platz unten (Home-Leiste). */
  bottomInset: number
  /** Zufall – in den Prüfungen fest, sonst `Math.random`. */
  random?: () => number
  /** Zittern beim Treffer – das Telefon, wo es eines hat. */
  vibrate?: (pattern: number | number[]) => void
}

export interface SortGameEvents {
  /** Die Runde ist vorbei – nach dem letzten Leben und dem Ausklang. */
  onEnd: (points: number) => void
}

type Phase = 'ready' | 'play' | 'over' | 'done'

interface Falling {
  item: SortItem
  x: number
  y: number
  /** Einheiten je Sekunde nach unten – fest ab dem Erscheinen. */
  speed: number
  /** 0 → 1: das Aufploppen beim Erscheinen. */
  born: number
}

interface Flying {
  item: SortItem
  x0: number
  y0: number
  x1: number
  y1: number
  /** 0 → 1 */
  t: number
  spin: number
  /** Richtig einsortiert – oder abgeprallt (falsch, verpasst). */
  ok: boolean
  /** Bei «verpasst»: fällt weiter statt zu einer Seite. */
  dropped?: boolean
  vx?: number
  vy?: number
}

interface Spark {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  r: number
  color: string
}

interface Floater {
  text: string
  x: number
  y: number
  life: number
  color: string
}

/** Länger als das rechnet ein einzelner Schritt nie – nach einem Tabwechsel. */
const MAX_STEP = 0.05
/** So lange dauert der Flug in eine Seite. */
const FLY_S = 0.3
/** Vom letzten Leben bis zum Ergebnis. */
const END_S = 0.95
/** Wie lange der Hinweis «← Nein, danke · Gut für dich →» mindestens steht. */
const HINT_S = 3
const MAX_DPR = 2

const EMOJI_FONT =
  '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Segoe UI Symbol",sans-serif'
const UI_FONT =
  'ui-rounded,"SF Pro Rounded",system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif'

interface Palette {
  skyTop: string
  skyBottom: string
  bubble: string
  label: string
  labelText: string
  ring: string
  text: string
  muted: string
  heart: string
  heartEmpty: string
  leftFill: string
  leftLine: string
  leftText: string
  rightFill: string
  rightLine: string
  rightText: string
  danger: string
}

const LIGHT: Palette = {
  skyTop: '#dbeafe',
  skyBottom: '#fdf2f8',
  bubble: '#ffffff',
  label: 'rgba(15, 23, 42, 0.82)',
  labelText: '#ffffff',
  ring: '#f59e0b',
  text: '#0f172a',
  muted: 'rgba(15, 23, 42, 0.55)',
  heart: '#ef4444',
  heartEmpty: 'rgba(15, 23, 42, 0.18)',
  leftFill: 'rgba(254, 226, 226, 0.92)',
  leftLine: 'rgba(239, 68, 68, 0.55)',
  leftText: '#b91c1c',
  rightFill: 'rgba(220, 252, 231, 0.92)',
  rightLine: 'rgba(34, 197, 94, 0.55)',
  rightText: '#15803d',
  danger: 'rgba(239, 68, 68, 0.45)',
}

const DARK: Palette = {
  skyTop: '#0b1026',
  skyBottom: '#2a1033',
  bubble: '#ffffff',
  label: 'rgba(2, 6, 23, 0.86)',
  labelText: '#ffffff',
  ring: '#fbbf24',
  text: '#f8fafc',
  muted: 'rgba(248, 250, 252, 0.6)',
  heart: '#f87171',
  heartEmpty: 'rgba(248, 250, 252, 0.2)',
  leftFill: 'rgba(127, 29, 29, 0.6)',
  leftLine: 'rgba(248, 113, 113, 0.55)',
  leftText: '#fecaca',
  rightFill: 'rgba(20, 83, 45, 0.6)',
  rightLine: 'rgba(74, 222, 128, 0.55)',
  rightText: '#bbf7d0',
  danger: 'rgba(248, 113, 113, 0.5)',
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const easeOut = (k: number) => 1 - (1 - k) * (1 - k)
const easeIn = (k: number) => k * k

export class SortGame {
  private readonly canvas: HTMLCanvasElement
  private readonly g: CanvasRenderingContext2D
  private readonly options: SortGameOptions
  private readonly events: SortGameEvents
  private readonly colors: Palette
  private readonly random: () => number

  private phase: Phase = 'ready'
  private paused = false
  private frame = 0
  private last = 0

  /* Spielstand */
  private time = 0
  private nextSpawn = 0.6
  private points = 0
  private lives = SORT_LIVES
  private streak = 0
  private sorted = 0
  private endTimer = 0
  private recent: SortItem[] = []
  private falling: Falling[] = []
  private flying: Flying[] = []
  private sparks: Spark[] = []
  private floaters: Floater[] = []

  /* Wirkungen, die abklingen (1 → 0) */
  private flash = 0
  private shake = 0
  private scoreBump = 0
  private binGlow = { left: 0, right: 0 }
  private hintSide: { side: SortSide; life: number } | null = null
  private heartPop: number[] = Array.from({ length: SORT_LIVES }, () => 0)
  private toast: { text: string; life: number } | null = null

  /* Masse in CSS-Pixeln */
  private width = 0
  private height = 0
  private dpr = 1
  private radius = 32
  private hudBottom = 0
  private lineY = 0
  private binTop = 0
  private binHeight = 0

  /* Vorgezeichnetes */
  private background: HTMLCanvasElement | null = null
  private sprites = new Map<SortItem, HTMLCanvasElement>()
  private spriteSize = { w: 0, h: 0 }
  /** Wo im vorgezeichneten Bild die Mitte des Kreises liegt (von oben). */
  private spriteCenterY = 0
  /** Läuft immer, auch nach dem letzten Leben – für Wackeln und Pulsieren. */
  private clock = 0

  constructor(options: SortGameOptions, events: SortGameEvents) {
    this.options = options
    this.events = events
    this.canvas = options.canvas
    const context = this.canvas.getContext('2d', { alpha: false })
    if (!context) throw new Error('Keine Leinwand verfügbar.')
    this.g = context
    this.colors = options.dark ? DARK : LIGHT
    this.random = options.random ?? Math.random
    this.measure()
    this.last = performance.now()
    this.frame = requestAnimationFrame(this.loop)
  }

  /* ---------------------------------------------------------------- */
  /* Von aussen                                                        */
  /* ---------------------------------------------------------------- */

  /** Die Runde beginnt – der erste Gegenstand kommt gleich. */
  start(): void {
    this.reset()
    this.phase = 'play'
  }

  /** Ein Wisch oder Tipp: der unterste Gegenstand auf diese Seite. */
  input(side: SortSide): void {
    if (this.phase !== 'play' || this.paused) return
    const target = this.falling[0]
    if (!target) return
    this.falling.shift()
    const good = side === 'right'
    const bin = this.binCenter(side)
    if (target.item.good === good) {
      this.points += 1
      this.sorted += 1
      this.streak += 1
      this.scoreBump = 1
      this.binGlow[side] = 1
      this.flying.push({
        item: target.item,
        x0: target.x,
        y0: target.y,
        x1: bin.x,
        y1: bin.y,
        t: 0,
        spin: (side === 'right' ? 1 : -1) * (0.9 + this.random() * 0.6),
        ok: true,
      })
      this.options.vibrate?.(8)
      // Zehn am Stück: ein Leben zurück – sind alle drei da, zählt die Serie einfach weiter.
      if (this.streak % SORT_STREAK_FOR_LIFE === 0 && this.lives < SORT_LIVES) {
        this.heartPop[this.lives] = 1
        this.lives += 1
        this.floaters.push({
          text: '+❤',
          x: this.width / 2,
          y: this.hudBottom + 8,
          life: 1,
          color: this.colors.heart,
        })
      }
    } else {
      // Falsch: Der Gegenstand prallt ab, und die richtige Seite leuchtet auf.
      const right: SortSide = target.item.good ? 'right' : 'left'
      this.flying.push({
        item: target.item,
        x0: target.x,
        y0: target.y,
        x1: target.x + (side === 'right' ? 1 : -1) * this.radius * 1.6,
        y1: target.y + this.radius * 0.6,
        t: 0,
        spin: (side === 'right' ? 1 : -1) * 2.4,
        ok: false,
      })
      this.hintSide = { side: right, life: 1 }
      this.loseLife(
        `${target.item.label}: ${target.item.good ? SORT_SIDES.right : SORT_SIDES.left}`,
      )
    }
  }

  /** Anhalten – etwa wenn das Telefon die App in den Hintergrund schickt. */
  pause(): void {
    if (this.paused) return
    this.paused = true
  }

  resume(): void {
    if (!this.paused) return
    this.paused = false
    this.last = performance.now()
  }

  get isPaused(): boolean {
    return this.paused
  }

  get isPlaying(): boolean {
    return this.phase === 'play'
  }

  /** Abbrechen: Die Runde endet sofort, ohne Ausklang – zurück kommen die Punkte bis hier. */
  stop(): number {
    const points = this.points
    this.phase = 'done'
    return points
  }

  /** Die Leinwand hat eine neue Grösse – beim Drehen des Telefons. */
  resize(): void {
    this.measure()
  }

  destroy(): void {
    cancelAnimationFrame(this.frame)
    this.frame = 0
    this.sprites.clear()
    this.background = null
  }

  /* ---------------------------------------------------------------- */
  /* Ablauf                                                            */
  /* ---------------------------------------------------------------- */

  private reset() {
    this.time = 0
    this.nextSpawn = 0.6
    this.points = 0
    this.lives = SORT_LIVES
    this.streak = 0
    this.sorted = 0
    this.endTimer = 0
    this.recent = []
    this.falling = []
    this.flying = []
    this.sparks = []
    this.floaters = []
    this.flash = 0
    this.shake = 0
    this.scoreBump = 0
    this.binGlow = { left: 0, right: 0 }
    this.hintSide = null
    this.heartPop = this.heartPop.map(() => 0)
    this.toast = null
    this.paused = false
  }

  private loseLife(reason: string) {
    this.streak = 0
    this.lives -= 1
    this.heartPop[Math.max(0, this.lives)] = 1
    this.flash = 1
    if (!this.options.reducedMotion) this.shake = 1
    this.toast = { text: reason, life: 1 }
    this.options.vibrate?.([30, 40, 30])
    if (this.lives <= 0) {
      this.phase = 'over'
      this.endTimer = 0
      // Was noch fällt, fällt jetzt ab – nichts bleibt mitten im Bild stehen.
      for (const entry of this.falling) {
        this.flying.push({
          item: entry.item,
          x0: entry.x,
          y0: entry.y,
          x1: entry.x,
          y1: entry.y,
          t: 0,
          spin: (this.random() - 0.5) * 3,
          ok: false,
          dropped: true,
          vx: (this.random() - 0.5) * 120,
          vy: -80 - this.random() * 80,
        })
      }
      this.falling = []
    }
  }

  private spawn() {
    const pace = sortPace(this.time)
    const item = nextSortItem(this.random, this.recent, SORT_ITEMS)
    this.recent = [...this.recent.slice(-5), item]
    const margin = this.radius * 1.15
    const x = margin + this.random() * Math.max(1, this.width - margin * 2)
    const startY = this.hudBottom + this.radius * 0.6
    this.falling.push({
      item,
      x,
      y: startY,
      speed: (this.lineY - startY) / pace.fall,
      born: 0,
    })
    this.nextSpawn = this.time + pace.gap
  }

  private step(dt: number) {
    this.clock += dt
    if (this.phase === 'play') {
      this.time += dt
      if (this.time >= this.nextSpawn) this.spawn()
      for (const entry of this.falling) {
        entry.y += entry.speed * dt
        if (entry.born < 1) entry.born = Math.min(1, entry.born + dt / 0.16)
      }
      // Verpasst: der unterste ist bis zur Linie gefallen.
      const first = this.falling[0]
      if (first && first.y >= this.lineY - this.radius * 0.2) {
        this.falling.shift()
        this.flying.push({
          item: first.item,
          x0: first.x,
          y0: first.y,
          x1: first.x,
          y1: first.y,
          t: 0,
          spin: (this.random() - 0.5) * 2,
          ok: false,
          dropped: true,
          vx: (this.random() - 0.5) * 60,
          vy: 40,
        })
        this.hintSide = { side: first.item.good ? 'right' : 'left', life: 1 }
        this.loseLife(`Verpasst: ${first.item.label}`)
      }
    } else if (this.phase === 'over') {
      this.endTimer += dt
      if (this.endTimer >= END_S) {
        this.phase = 'done'
        this.events.onEnd(this.points)
      }
    }

    // Flüge: in die Seite – oder abprallen, fallen, verblassen.
    for (let index = this.flying.length - 1; index >= 0; index -= 1) {
      const fly = this.flying[index]
      if (fly.dropped) {
        fly.vy = (fly.vy ?? 0) + 1400 * dt
        fly.x0 += (fly.vx ?? 0) * dt
        fly.y0 += fly.vy * dt
        fly.t += dt / 0.7
      } else {
        fly.t += dt / FLY_S
      }
      if (fly.t >= 1) {
        if (fly.ok) this.burst(fly.x1, fly.y1)
        this.flying.splice(index, 1)
      }
    }

    for (let index = this.sparks.length - 1; index >= 0; index -= 1) {
      const spark = this.sparks[index]
      spark.vy += 520 * dt
      spark.x += spark.vx * dt
      spark.y += spark.vy * dt
      spark.life -= dt
      if (spark.life <= 0) this.sparks.splice(index, 1)
    }
    for (let index = this.floaters.length - 1; index >= 0; index -= 1) {
      const floater = this.floaters[index]
      floater.life -= dt / 0.9
      floater.y -= 34 * dt
      if (floater.life <= 0) this.floaters.splice(index, 1)
    }

    const decay = (value: number, seconds: number) => Math.max(0, value - dt / seconds)
    this.flash = decay(this.flash, 0.35)
    this.shake = decay(this.shake, 0.3)
    this.scoreBump = decay(this.scoreBump, 0.18)
    this.binGlow.left = decay(this.binGlow.left, 0.4)
    this.binGlow.right = decay(this.binGlow.right, 0.4)
    this.heartPop = this.heartPop.map((value) => decay(value, 0.35))
    if (this.hintSide) {
      this.hintSide.life = decay(this.hintSide.life, 0.8)
      if (this.hintSide.life <= 0) this.hintSide = null
    }
    if (this.toast) {
      this.toast.life = decay(this.toast.life, 1.4)
      if (this.toast.life <= 0) this.toast = null
    }
  }

  /**
   * Funken und «+1» – dort, wo der Gegenstand gelandet ist. Immer golden
   * und grün, auch auf der Seite «Nein, danke»: Richtig ist richtig, und
   * Rot hiesse dort «falsch».
   */
  private burst(x: number, y: number) {
    const count = this.options.reducedMotion ? 4 : 9
    const color = this.options.dark ? '#4ade80' : '#16a34a'
    for (let index = 0; index < count; index += 1) {
      const angle = -Math.PI * (0.15 + this.random() * 0.7)
      const speed = 90 + this.random() * 140
      this.sparks.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.45 + this.random() * 0.2,
        max: 0.65,
        r: 2 + this.random() * 2.2,
        color: index % 2 === 0 ? '#fbbf24' : color,
      })
    }
    if (this.sparks.length > 90) this.sparks.splice(0, this.sparks.length - 90)
    // Leicht versetzt: Zwei schnelle Treffer in dieselbe Seite liegen nicht aufeinander.
    const jitter = (this.random() - 0.5) * this.binHeight * 0.9
    this.floaters.push({ text: '+1', x: x + jitter, y: y - this.binHeight * 0.55, life: 1, color })
  }

  private loop = (now: number) => {
    this.frame = requestAnimationFrame(this.loop)
    const dt = Math.min(MAX_STEP, Math.max(0, (now - this.last) / 1000))
    this.last = now
    if (!this.paused) this.step(dt)
    this.draw()
  }

  /* ---------------------------------------------------------------- */
  /* Masse                                                             */
  /* ---------------------------------------------------------------- */

  private measure() {
    const rect = this.canvas.getBoundingClientRect()
    const width = Math.max(240, Math.round(rect.width))
    const height = Math.max(320, Math.round(rect.height))
    const dpr = clamp(window.devicePixelRatio || 1, 1, MAX_DPR)
    if (width === this.width && height === this.height && dpr === this.dpr) return
    const scaleX = this.width ? width / this.width : 1
    const scaleY = this.height ? height / this.height : 1
    this.width = width
    this.height = height
    this.dpr = dpr
    this.canvas.width = Math.round(width * dpr)
    this.canvas.height = Math.round(height * dpr)

    this.radius = clamp(Math.min(width, height) * 0.085, 26, 44)
    this.hudBottom = this.options.topInset + 58
    this.binHeight = clamp(height * 0.11, 70, 96)
    this.binTop = height - this.options.bottomInset - this.binHeight - 12
    const oldLine = this.lineY
    this.lineY = this.binTop - 14

    // Was schon fällt, wandert mit – nach dem Drehen stünde es sonst daneben.
    if (oldLine) {
      for (const entry of this.falling) {
        entry.x *= scaleX
        entry.y *= scaleY
        entry.speed *= scaleY
      }
    }
    this.buildBackground()
    this.buildSprites()
  }

  private binRect(side: SortSide) {
    const gap = 12
    const w = (this.width - gap * 3) / 2
    const x = side === 'left' ? gap : gap * 2 + w
    return { x, y: this.binTop, w, h: this.binHeight }
  }

  private binCenter(side: SortSide) {
    const rect = this.binRect(side)
    return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 }
  }

  /* ---------------------------------------------------------------- */
  /* Vorzeichnen                                                       */
  /* ---------------------------------------------------------------- */

  private buildBackground() {
    const canvas = document.createElement('canvas')
    canvas.width = this.canvas.width
    canvas.height = this.canvas.height
    const g = canvas.getContext('2d')
    if (!g) return
    g.scale(this.dpr, this.dpr)
    const sky = g.createLinearGradient(0, 0, 0, this.height)
    sky.addColorStop(0, this.colors.skyTop)
    sky.addColorStop(1, this.colors.skyBottom)
    g.fillStyle = sky
    g.fillRect(0, 0, this.width, this.height)
    // Ein paar weiche Kreise im Hintergrund – Tiefe, ohne zu stören.
    const blobs = [
      [
        0.15,
        0.25,
        0.38,
        this.options.dark ? 'rgba(236, 72, 153, 0.12)' : 'rgba(244, 114, 182, 0.18)',
      ],
      [0.9, 0.42, 0.42, this.options.dark ? 'rgba(59, 130, 246, 0.12)' : 'rgba(96, 165, 250, 0.2)'],
      [0.5, 0.78, 0.5, this.options.dark ? 'rgba(249, 115, 22, 0.08)' : 'rgba(251, 191, 36, 0.14)'],
    ] as const
    for (const [fx, fy, fr, color] of blobs) {
      const r = Math.max(this.width, this.height) * fr
      const glow = g.createRadialGradient(
        fx * this.width,
        fy * this.height,
        0,
        fx * this.width,
        fy * this.height,
        r,
      )
      glow.addColorStop(0, color)
      glow.addColorStop(1, 'rgba(255, 255, 255, 0)')
      g.fillStyle = glow
      g.fillRect(0, 0, this.width, this.height)
    }
    this.background = canvas
  }

  private buildSprites() {
    this.sprites.clear()
    const r = this.radius
    const pad = Math.ceil(r * 0.45)
    const labelSize = Math.round(clamp(r * 0.36, 11, 14))
    const labelH = labelSize + 8
    const w = Math.ceil(r * 2 + pad * 2)
    const h = Math.ceil(r * 2 + pad * 2 + labelH * 0.75)
    this.spriteSize = { w, h }
    this.spriteCenterY = pad + r
    for (const item of SORT_ITEMS) {
      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(w * this.dpr)
      canvas.height = Math.ceil(h * this.dpr)
      const g = canvas.getContext('2d')
      if (!g) continue
      g.scale(this.dpr, this.dpr)
      const cx = w / 2
      const cy = pad + r
      g.save()
      g.shadowColor = this.options.dark ? 'rgba(0, 0, 0, 0.55)' : 'rgba(15, 23, 42, 0.22)'
      g.shadowBlur = r * 0.4
      g.shadowOffsetY = r * 0.12
      g.fillStyle = this.colors.bubble
      g.beginPath()
      g.arc(cx, cy, r, 0, Math.PI * 2)
      g.fill()
      g.restore()
      g.font = `${Math.round(r * 1.12)}px ${EMOJI_FONT}`
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText(item.emoji, cx, cy + r * 0.06)
      // Das Wort darunter, auf einer dunklen Kapsel – auf jedem Hintergrund lesbar.
      g.font = `700 ${labelSize}px ${UI_FONT}`
      const textW = g.measureText(item.label).width
      const pillW = textW + 14
      const pillY = cy + r - labelH * 0.25
      g.fillStyle = this.colors.label
      roundRect(g, cx - pillW / 2, pillY, pillW, labelH, labelH / 2)
      g.fill()
      g.fillStyle = this.colors.labelText
      g.fillText(item.label, cx, pillY + labelH / 2 + 0.5)
      this.sprites.set(item, canvas)
    }
  }

  /* ---------------------------------------------------------------- */
  /* Zeichnen                                                          */
  /* ---------------------------------------------------------------- */

  private draw() {
    const g = this.g
    g.setTransform(1, 0, 0, 1, 0, 0)
    if (this.background) g.drawImage(this.background, 0, 0)
    else {
      g.fillStyle = this.colors.skyTop
      g.fillRect(0, 0, this.canvas.width, this.canvas.height)
    }

    const shakeX = this.shake > 0 ? Math.sin(this.clock * 90) * 6 * this.shake : 0
    g.setTransform(this.dpr, 0, 0, this.dpr, shakeX * this.dpr, 0)

    // Je schneller, desto wärmer wird das Licht – man spürt, dass es eng wird.
    const heat = clamp((this.time - 15) / 40, 0, 1) * (this.phase === 'ready' ? 0 : 1)
    if (heat > 0) {
      g.globalAlpha = heat * (this.options.dark ? 0.22 : 0.18)
      g.fillStyle = '#f97316'
      g.fillRect(-10, 0, this.width + 20, this.lineY)
      g.globalAlpha = 1
    }

    this.drawLine()
    this.drawBins()
    this.drawHint()
    this.drawFalling()
    this.drawFlying()
    this.drawSparks()
    this.drawFloaters()

    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    this.drawHud()
    this.drawToast()

    if (this.flash > 0) {
      g.globalAlpha = this.flash * 0.28
      g.fillStyle = '#ef4444'
      g.fillRect(0, 0, this.width, this.height)
      g.globalAlpha = 1
    }
  }

  private drawLine() {
    const g = this.g
    const first = this.falling[0]
    // Kommt der unterste der Linie nahe, wird sie deutlicher.
    const near = first
      ? clamp((first.y - (this.lineY - this.radius * 4)) / (this.radius * 4), 0, 1)
      : 0
    g.strokeStyle = this.colors.danger
    g.globalAlpha = 0.45 + 0.55 * near
    g.lineWidth = 2
    g.setLineDash([8, 8])
    g.beginPath()
    g.moveTo(12, this.lineY)
    g.lineTo(this.width - 12, this.lineY)
    g.stroke()
    g.setLineDash([])
    g.globalAlpha = 1
  }

  private drawBins() {
    for (const side of ['left', 'right'] as const) {
      const g = this.g
      const rect = this.binRect(side)
      const glow = Math.max(
        this.binGlow[side],
        this.hintSide?.side === side ? this.hintSide.life : 0,
      )
      const scale = 1 + 0.05 * glow
      const cx = rect.x + rect.w / 2
      const cy = rect.y + rect.h / 2
      g.save()
      g.translate(cx, cy)
      g.scale(scale, scale)
      const fill = side === 'left' ? this.colors.leftFill : this.colors.rightFill
      const line = side === 'left' ? this.colors.leftLine : this.colors.rightLine
      const text = side === 'left' ? this.colors.leftText : this.colors.rightText
      roundRect(g, -rect.w / 2, -rect.h / 2, rect.w, rect.h, 18)
      g.fillStyle = fill
      g.fill()
      g.lineWidth = 2 + 2 * glow
      g.strokeStyle = line
      g.stroke()
      if (glow > 0) {
        g.globalAlpha = glow * 0.35
        g.fillStyle = side === 'left' ? '#ef4444' : '#22c55e'
        roundRect(g, -rect.w / 2, -rect.h / 2, rect.w, rect.h, 18)
        g.fill()
        g.globalAlpha = 1
      }
      // Zeichen und Wort: ✗ «Nein, danke» links, ✓ «Gut für dich» rechts.
      const iconY = -rect.h * 0.13
      g.strokeStyle = text
      g.lineWidth = 4
      g.lineCap = 'round'
      g.lineJoin = 'round'
      g.beginPath()
      const s = Math.min(rect.h * 0.16, 13)
      if (side === 'left') {
        g.moveTo(-s, iconY - s)
        g.lineTo(s, iconY + s)
        g.moveTo(s, iconY - s)
        g.lineTo(-s, iconY + s)
      } else {
        g.moveTo(-s * 1.1, iconY + s * 0.05)
        g.lineTo(-s * 0.3, iconY + s * 0.85)
        g.lineTo(s * 1.15, iconY - s * 0.75)
      }
      g.stroke()
      g.fillStyle = text
      g.font = `800 ${Math.round(clamp(rect.w * 0.085, 13, 17))}px ${UI_FONT}`
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      const arrow = side === 'left' ? '← ' : ''
      const arrowAfter = side === 'right' ? ' →' : ''
      g.fillText(
        `${arrow}${side === 'left' ? SORT_SIDES.left : SORT_SIDES.right}${arrowAfter}`,
        0,
        rect.h * 0.24,
      )
      g.restore()
    }
  }

  /** Der Hinweis über den Seiten – am Anfang jeder Runde, bis drei sitzen. */
  private drawHint() {
    if (this.phase !== 'play' || (this.sorted >= 3 && this.time > HINT_S)) return
    const g = this.g
    const fade = this.sorted >= 3 ? clamp((HINT_S + 0.5 - this.time) / 0.5, 0, 1) : 1
    g.globalAlpha = 0.85 * fade
    g.fillStyle = this.colors.muted
    g.font = `700 13px ${UI_FONT}`
    g.textAlign = 'center'
    g.textBaseline = 'bottom'
    g.fillText(
      'Wische oder tippe: links «Nein, danke» · rechts «Gut für dich»',
      this.width / 2,
      this.lineY - 8,
    )
    g.globalAlpha = 1
  }

  private drawFalling() {
    const g = this.g
    const { w, h } = this.spriteSize
    this.falling.forEach((entry, index) => {
      const sprite = this.sprites.get(entry.item)
      if (!sprite) return
      const active = index === 0 && this.phase === 'play'
      const pop = easeOut(entry.born)
      const scale = (0.6 + 0.4 * pop) * (active ? 1.08 : 1)
      const r = this.radius * scale
      if (active) {
        // Der Ring: Dieser ist dran.
        const pulse = 0.5 + 0.5 * Math.sin(this.clock * 9)
        g.strokeStyle = this.colors.ring
        g.lineWidth = 3.5
        g.globalAlpha = 0.95
        g.beginPath()
        g.arc(entry.x, entry.y, r + 5, 0, Math.PI * 2)
        g.stroke()
        g.globalAlpha = 0.25 + 0.2 * pulse
        g.lineWidth = 8
        g.beginPath()
        g.arc(entry.x, entry.y, r + 9 + pulse * 3, 0, Math.PI * 2)
        g.stroke()
        g.globalAlpha = 1
      }
      const dw = w * scale
      const dh = h * scale
      g.globalAlpha = 0.35 + 0.65 * pop
      g.drawImage(sprite, entry.x - dw / 2, entry.y - this.spriteCenterY * scale, dw, dh)
      g.globalAlpha = 1
    })
  }

  private drawFlying() {
    const g = this.g
    const { w, h } = this.spriteSize
    for (const fly of this.flying) {
      const sprite = this.sprites.get(fly.item)
      if (!sprite) continue
      let x: number
      let y: number
      let scale: number
      let alpha: number
      if (fly.dropped) {
        x = fly.x0
        y = fly.y0
        scale = 1 - 0.2 * fly.t
        alpha = 1 - easeIn(clamp(fly.t, 0, 1))
      } else if (fly.ok) {
        const k = easeIn(clamp(fly.t, 0, 1))
        // Ein kleiner Bogen nach oben, dann hinein in die Seite.
        x = fly.x0 + (fly.x1 - fly.x0) * k
        y = fly.y0 + (fly.y1 - fly.y0) * k - Math.sin(Math.PI * k) * this.radius * 1.2
        scale = 1 - 0.55 * k
        alpha = 1 - 0.3 * k
      } else {
        const k = easeOut(clamp(fly.t, 0, 1))
        x = fly.x0 + (fly.x1 - fly.x0) * k
        y = fly.y0 + (fly.y1 - fly.y0) * k
        scale = 1
        alpha = 1 - k
      }
      const angle = fly.spin * fly.t
      g.save()
      g.globalAlpha = clamp(alpha, 0, 1)
      g.translate(x, y)
      g.rotate(angle)
      if (!fly.ok) {
        g.strokeStyle = '#ef4444'
        g.lineWidth = 3.5
        g.beginPath()
        g.arc(0, 0, this.radius * scale + 4, 0, Math.PI * 2)
        g.stroke()
      }
      const dw = w * scale
      const dh = h * scale
      g.drawImage(sprite, -dw / 2, -this.spriteCenterY * scale, dw, dh)
      g.restore()
    }
  }

  private drawSparks() {
    const g = this.g
    for (const spark of this.sparks) {
      g.globalAlpha = clamp(spark.life / spark.max, 0, 1)
      g.fillStyle = spark.color
      g.beginPath()
      g.arc(spark.x, spark.y, spark.r, 0, Math.PI * 2)
      g.fill()
    }
    g.globalAlpha = 1
  }

  private drawFloaters() {
    const g = this.g
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    for (const floater of this.floaters) {
      g.globalAlpha = clamp(floater.life * 1.4, 0, 1)
      g.fillStyle = floater.color
      g.font = `900 ${floater.text === '+1' ? 22 : 18}px ${UI_FONT}`
      g.fillText(floater.text, floater.x, floater.y)
    }
    g.globalAlpha = 1
  }

  /** Oben: die Punkte links, die Leben in der Mitte. Rechts liegt der Knopf zum Abbrechen. */
  private drawHud() {
    const g = this.g
    const top = this.options.topInset
    const midY = top + 30
    if (this.phase !== 'ready') {
      const bump = 1 + 0.18 * this.scoreBump
      g.save()
      g.translate(18, midY)
      g.scale(bump, bump)
      g.fillStyle = this.colors.text
      g.font = `900 34px ${UI_FONT}`
      g.textAlign = 'left'
      g.textBaseline = 'middle'
      g.fillText(String(this.points), 0, 1)
      g.restore()
      if (this.streak >= 3) {
        g.fillStyle = this.colors.ring
        g.font = `800 12px ${UI_FONT}`
        g.textAlign = 'left'
        g.textBaseline = 'middle'
        g.fillText(`${this.streak} am Stück`, 18, midY + 24)
      }
    }
    // Die Leben als Herzen.
    const size = 22
    const gap = 8
    const total = SORT_LIVES * size + (SORT_LIVES - 1) * gap
    const startX = this.width / 2 - total / 2 + size / 2
    for (let index = 0; index < SORT_LIVES; index += 1) {
      const full = index < this.lives
      const pop = this.heartPop[index]
      const scale = 1 + 0.35 * pop
      drawHeart(
        g,
        startX + index * (size + gap),
        midY,
        size * scale,
        full ? this.colors.heart : this.colors.heartEmpty,
      )
    }
  }

  private drawToast() {
    if (!this.toast) return
    const g = this.g
    const alpha = clamp(this.toast.life * 2.5, 0, 1)
    g.globalAlpha = alpha
    g.font = `800 14px ${UI_FONT}`
    const textW = g.measureText(this.toast.text).width
    const w = textW + 28
    const h = 32
    const x = this.width / 2 - w / 2
    const y = this.hudBottom + 22
    g.fillStyle = this.options.dark ? 'rgba(127, 29, 29, 0.92)' : 'rgba(254, 226, 226, 0.97)'
    roundRect(g, x, y, w, h, h / 2)
    g.fill()
    g.fillStyle = this.options.dark ? '#fecaca' : '#991b1b'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(this.toast.text, this.width / 2, y + h / 2 + 0.5)
    g.globalAlpha = 1
  }
}

/** Ein Rechteck mit runden Ecken – ohne `roundRect`, das ältere Browser nicht kennen. */
function roundRect(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2))
  g.beginPath()
  g.moveTo(x + radius, y)
  g.lineTo(x + w - radius, y)
  g.quadraticCurveTo(x + w, y, x + w, y + radius)
  g.lineTo(x + w, y + h - radius)
  g.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
  g.lineTo(x + radius, y + h)
  g.quadraticCurveTo(x, y + h, x, y + h - radius)
  g.lineTo(x, y + radius)
  g.quadraticCurveTo(x, y, x + radius, y)
  g.closePath()
}

/** Ein Herz um seinen Mittelpunkt, `size` breit. */
function drawHeart(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string,
) {
  const s = size / 2
  g.fillStyle = color
  g.beginPath()
  g.moveTo(cx, cy + s * 0.85)
  g.bezierCurveTo(cx - s * 1.25, cy - s * 0.05, cx - s * 0.75, cy - s * 1.15, cx, cy - s * 0.45)
  g.bezierCurveTo(cx + s * 0.75, cy - s * 1.15, cx + s * 1.25, cy - s * 0.05, cx, cy + s * 0.85)
  g.closePath()
  g.fill()
}

/* ------------------------------------------------------------------ */
/* Die Steuerung                                                       */
/* ------------------------------------------------------------------ */

/** Ab so vielen Pixeln quer ist eine Bewegung ein Wisch. */
const SWIPE_PX = 18
/** Bis hierhin ist eine Berührung noch ein Tipp. */
const TAP_PX = 14

/**
 * Wischen, Tippen und Pfeiltasten auf der Spielfläche.
 *
 * Ein Wisch zählt, sobald der Finger weit genug quer gefahren ist – nicht
 * erst beim Loslassen: So reagiert das Spiel im selben Moment. Jede
 * Berührung zählt einzeln, zwei Daumen spielen also gleichzeitig. Ein
 * Tipp zählt nach der Hälfte, auf der er sitzt. Am Rechner gehen die
 * Pfeiltasten (und A/D).
 *
 * Gibt das Abmelden zurück.
 */
export function attachSortControls(
  surface: HTMLElement,
  onSide: (side: SortSide) => void,
): () => void {
  const touches = new Map<number, { x: number; y: number; done: boolean }>()

  const down = (event: PointerEvent) => {
    if ((event.target as HTMLElement | null)?.closest('button, a, input')) return
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY, done: false })
  }
  const move = (event: PointerEvent) => {
    const touch = touches.get(event.pointerId)
    if (!touch || touch.done) return
    const dx = event.clientX - touch.x
    const dy = event.clientY - touch.y
    if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 0.7) {
      touch.done = true
      onSide(dx < 0 ? 'left' : 'right')
    }
  }
  const up = (event: PointerEvent) => {
    const touch = touches.get(event.pointerId)
    touches.delete(event.pointerId)
    if (!touch || touch.done) return
    const dx = event.clientX - touch.x
    const dy = event.clientY - touch.y
    if (Math.abs(dx) < TAP_PX && Math.abs(dy) < TAP_PX) {
      const rect = surface.getBoundingClientRect()
      onSide(event.clientX < rect.left + rect.width / 2 ? 'left' : 'right')
    } else if (Math.abs(dx) >= 10 && Math.abs(dx) > Math.abs(dy)) {
      onSide(dx < 0 ? 'left' : 'right')
    }
  }
  const cancel = (event: PointerEvent) => {
    touches.delete(event.pointerId)
  }
  const key = (event: KeyboardEvent) => {
    if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return
    if ((event.target as HTMLElement | null)?.closest('input, textarea')) return
    if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') {
      event.preventDefault()
      onSide('left')
    } else if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') {
      event.preventDefault()
      onSide('right')
    }
  }

  surface.addEventListener('pointerdown', down)
  surface.addEventListener('pointermove', move)
  surface.addEventListener('pointerup', up)
  surface.addEventListener('pointercancel', cancel)
  window.addEventListener('keydown', key)
  return () => {
    surface.removeEventListener('pointerdown', down)
    surface.removeEventListener('pointermove', move)
    surface.removeEventListener('pointerup', up)
    surface.removeEventListener('pointercancel', cancel)
    window.removeEventListener('keydown', key)
  }
}
