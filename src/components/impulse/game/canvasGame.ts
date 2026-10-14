import {
  clamp,
  drawHeart,
  MAX_DPR,
  MAX_STEP,
  roundRect,
  UI_FONT,
  type GameEngine,
  type GameEngineEvents,
  type GameEngineOptions,
} from '@/components/impulse/game/canvasKit'

/*
 * Das Gerüst der Minispiele auf der Leinwand – alles ausser dem Spiel
 * selbst: die Bildschleife, Anhalten und Weiter, die Masse, die Punkte
 * und Herzen oben, Funken, aufsteigende Zahlen, der rote Blitz beim
 * Treffer und der Ausklang nach dem letzten Leben.
 *
 * Gebaut nach dem Muster von «Gut für dich?» (`sortGame`), damit jedes
 * Spiel auch auf älteren Telefonen flüssig bleibt:
 * - Gerechnet wird mit der verstrichenen Zeit, nicht mit Bildern: 60 oder
 *   120 Bilder je Sekunde ergeben dasselbe Spiel. Nach einem Tabwechsel
 *   springt die Zeit nicht (`MAX_STEP`).
 * - Die Pixeldichte ist auf 2 begrenzt (`MAX_DPR`).
 * - Der Hintergrund liegt fertig auf einer zweiten Leinwand; Figuren
 *   zeichnet jedes Spiel einmal vor und stempelt sie danach nur noch.
 *
 * Die Regeln eines Spiels stehen nicht hier, sondern in `lib/impulseGame*`
 * – ohne Leinwand, damit die Prüfungen eine Runde durchspielen können.
 * Die Unterklasse verbindet beides: Sie rechnet die Runde weiter
 * (`update`), zeichnet die Welt (`renderWorld`) und die Anzeige oben
 * (`renderHud`) und baut beim Messen ihre Bilder neu (`layout`).
 */

export type GamePhase = 'ready' | 'play' | 'over' | 'done'

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
  size: number
}

export interface HudColors {
  text: string
  /** Die kleine Zeile unter den Punkten («8 am Stück»). */
  note: string
  heart: string
  heartEmpty: string
}

/** Vom letzten Leben bis zum Ergebnis. */
const END_S = 0.95
/** So hoch ist die Anzeige oben (Punkte, Herzen) – unter dem Rand der Seite. */
export const HUD_HEIGHT = 58

export abstract class CanvasGame implements GameEngine {
  protected readonly canvas: HTMLCanvasElement
  protected readonly g: CanvasRenderingContext2D
  protected readonly options: GameEngineOptions
  protected readonly random: () => number
  private readonly events: GameEngineEvents
  private readonly maxLives: number

  protected phase: GamePhase = 'ready'
  private paused = false
  private frame = 0
  private last = 0
  private endTimer = 0
  /** Läuft immer, auch nach dem letzten Leben – für Wackeln und Pulsieren. */
  protected clock = 0

  /* Masse in CSS-Pixeln */
  protected width = 0
  protected height = 0
  protected dpr = 1
  protected background: HTMLCanvasElement | null = null

  /* Wirkungen, die abklingen */
  private sparks: Spark[] = []
  private floaters: Floater[] = []
  private toast: { text: string; life: number } | null = null
  protected flash = 0
  protected shake = 0
  protected scoreBump = 0
  protected heartPop: number[]

  constructor(options: GameEngineOptions, events: GameEngineEvents, maxLives: number) {
    this.options = options
    this.events = events
    this.canvas = options.canvas
    const context = this.canvas.getContext('2d', { alpha: false })
    if (!context) throw new Error('Keine Leinwand verfügbar.')
    this.g = context
    this.random = options.random ?? Math.random
    this.maxLives = maxLives
    this.heartPop = Array.from({ length: maxLives }, () => 0)
  }

  /**
   * Messen und die Schleife anwerfen – am Ende des Konstruktors der
   * Unterklasse: Erst dann stehen ihre Felder, die `layout` braucht.
   */
  protected boot(): void {
    this.measure()
    this.last = performance.now()
    this.frame = requestAnimationFrame(this.loop)
  }

  /* ---------------------------------------------------------------- */
  /* Was jedes Spiel selbst beiträgt                                   */
  /* ---------------------------------------------------------------- */

  /** Die Punkte der laufenden Runde. */
  protected abstract get score(): number
  /** Eine neue Runde anlegen – von vorn. */
  protected abstract newRound(): void
  /** Die Runde um `dt` Sekunden weiterrechnen – nur, solange gespielt wird. */
  protected abstract update(dt: number): void
  /** Die Masse sind neu: Grössen rechnen, Hintergrund und Figuren vorzeichnen. */
  protected abstract layout(scaleX: number, scaleY: number): void
  /** Die Welt – mit dem Wackeln beim Treffer. */
  protected abstract renderWorld(): void
  /** Die Anzeige oben – ruhig, ohne Wackeln. */
  protected abstract renderHud(): void
  /** Jedes Bild, auch in der Pause des Ausklangs – für eigene Wirkungen, die abklingen. */
  protected tick(_dt: number): void {}
  /** Beim Abbauen: eigene Bilder freigeben. */
  protected teardown(): void {}

  /* ---------------------------------------------------------------- */
  /* Von aussen                                                        */
  /* ---------------------------------------------------------------- */

  start(): void {
    this.sparks = []
    this.floaters = []
    this.toast = null
    this.flash = 0
    this.shake = 0
    this.scoreBump = 0
    this.heartPop = this.heartPop.map(() => 0)
    this.endTimer = 0
    this.paused = false
    this.newRound()
    this.phase = 'play'
  }

  pause(): void {
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

  stop(): number {
    const points = this.score
    this.phase = 'done'
    return points
  }

  resize(): void {
    this.measure()
  }

  destroy(): void {
    cancelAnimationFrame(this.frame)
    this.frame = 0
    this.background = null
    this.teardown()
  }

  /* ---------------------------------------------------------------- */
  /* Für die Unterklassen                                              */
  /* ---------------------------------------------------------------- */

  /** Unterkante der Anzeige oben – darunter beginnt das Spielfeld. */
  protected get hudBottom(): number {
    return this.options.topInset + HUD_HEIGHT
  }

  /** Wo der Hinweis nach einem Treffer steht – ein Spiel darf ihn verlegen, wenn er dort stört. */
  protected get toastY(): number {
    return this.hudBottom + 22
  }

  /** Das letzte Leben ist weg: kurzer Ausklang, dann das Ergebnis. */
  protected finish(): void {
    if (this.phase !== 'play') return
    this.phase = 'over'
    this.endTimer = 0
  }

  /** Ein Treffer: roter Blitz, Wackeln, Zittern – und der Grund als Hinweis. */
  protected hurt(reason: string, lives: number): void {
    this.heartPop[clamp(lives, 0, this.maxLives - 1)] = 1
    this.flash = 1
    if (!this.options.reducedMotion) this.shake = 1
    this.toast = { text: reason, life: 1 }
    this.options.vibrate?.([30, 40, 30])
  }

  /** Ein Leben zurück: das Herz ploppt auf. */
  protected heal(lives: number, x: number, y: number): void {
    this.heartPop[clamp(lives - 1, 0, this.maxLives - 1)] = 1
    this.float('+❤', x, y, this.options.dark ? '#f87171' : '#ef4444', 18)
  }

  /** Punkte dazu: Die Zahl oben hüpft. */
  protected bump(): void {
    this.scoreBump = 1
  }

  protected float(text: string, x: number, y: number, color: string, size = 22): void {
    this.floaters.push({ text, x, y, life: 1, color, size })
    if (this.floaters.length > 24) this.floaters.splice(0, this.floaters.length - 24)
  }

  /** Funken in alle Richtungen nach oben – golden und in der Farbe des Spiels. */
  protected burst(x: number, y: number, color: string, count = 9): void {
    const n = this.options.reducedMotion ? Math.ceil(count / 2) : count
    for (let index = 0; index < n; index += 1) {
      const angle = -Math.PI * (0.1 + this.random() * 0.8)
      const speed = 90 + this.random() * 150
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
    if (this.sparks.length > 120) this.sparks.splice(0, this.sparks.length - 120)
  }

  /** Oben: die Punkte links, die Leben in der Mitte. Rechts liegt der Knopf zum Abbrechen. */
  protected drawHud(colors: HudColors, lives: number, note = ''): void {
    const g = this.g
    const midY = this.options.topInset + 30
    if (this.phase !== 'ready') {
      const bump = 1 + 0.18 * this.scoreBump
      g.save()
      g.translate(18, midY)
      g.scale(bump, bump)
      g.fillStyle = colors.text
      g.font = `900 34px ${UI_FONT}`
      g.textAlign = 'left'
      g.textBaseline = 'middle'
      g.fillText(String(this.score), 0, 1)
      g.restore()
      if (note) {
        g.fillStyle = colors.note
        g.font = `800 12px ${UI_FONT}`
        g.textAlign = 'left'
        g.textBaseline = 'middle'
        g.fillText(note, 18, midY + 24)
      }
    }
    const size = 22
    const gap = 8
    const total = this.maxLives * size + (this.maxLives - 1) * gap
    const startX = this.width / 2 - total / 2 + size / 2
    for (let index = 0; index < this.maxLives; index += 1) {
      const scale = 1 + 0.35 * this.heartPop[index]
      drawHeart(
        g,
        startX + index * (size + gap),
        midY,
        size * scale,
        index < lives ? colors.heart : colors.heartEmpty,
      )
    }
  }

  /** Ein dezenter Hinweis in der Mitte – am Anfang jeder Runde, wie man spielt. */
  protected drawHint(text: string, y: number, color: string, alpha: number): void {
    if (alpha <= 0) return
    const g = this.g
    g.globalAlpha = clamp(alpha, 0, 1) * 0.9
    g.fillStyle = color
    g.font = `700 13px ${UI_FONT}`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(text, this.width / 2, y, this.width - 24)
    g.globalAlpha = 1
  }

  /* ---------------------------------------------------------------- */
  /* Ablauf                                                            */
  /* ---------------------------------------------------------------- */

  private loop = (now: number) => {
    this.frame = requestAnimationFrame(this.loop)
    const dt = Math.min(MAX_STEP, Math.max(0, (now - this.last) / 1000))
    this.last = now
    if (!this.paused) this.step(dt)
    this.draw()
  }

  private step(dt: number) {
    this.clock += dt
    if (this.phase === 'play') {
      this.update(dt)
    } else if (this.phase === 'over') {
      this.endTimer += dt
      if (this.endTimer >= END_S) {
        this.phase = 'done'
        this.events.onEnd(this.score)
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
    for (let index = 0; index < this.heartPop.length; index += 1) {
      this.heartPop[index] = decay(this.heartPop[index], 0.35)
    }
    if (this.toast) {
      this.toast.life = decay(this.toast.life, 1.4)
      if (this.toast.life <= 0) this.toast = null
    }
    this.tick(dt)
  }

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
    this.layout(scaleX, scaleY)
  }

  private draw() {
    const g = this.g
    g.setTransform(1, 0, 0, 1, 0, 0)
    if (this.background) g.drawImage(this.background, 0, 0)
    else {
      g.fillStyle = this.options.dark ? '#0b1026' : '#f1f5f9'
      g.fillRect(0, 0, this.canvas.width, this.canvas.height)
    }

    const shakeX = this.shake > 0 ? Math.sin(this.clock * 90) * 6 * this.shake : 0
    g.setTransform(this.dpr, 0, 0, this.dpr, shakeX * this.dpr, 0)
    this.renderWorld()
    this.drawSparks()
    this.drawFloaters()

    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    this.renderHud()
    this.drawToast()

    if (this.flash > 0) {
      g.globalAlpha = this.flash * 0.28
      g.fillStyle = '#ef4444'
      g.fillRect(0, 0, this.width, this.height)
      g.globalAlpha = 1
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
      g.font = `900 ${floater.size}px ${UI_FONT}`
      g.fillText(floater.text, floater.x, floater.y)
    }
    g.globalAlpha = 1
  }

  private drawToast() {
    if (!this.toast) return
    const g = this.g
    g.globalAlpha = clamp(this.toast.life * 2.5, 0, 1)
    g.font = `800 14px ${UI_FONT}`
    const textW = g.measureText(this.toast.text).width
    const w = Math.min(this.width - 24, textW + 28)
    const h = 32
    const x = this.width / 2 - w / 2
    const y = this.toastY
    g.fillStyle = this.options.dark ? 'rgba(127, 29, 29, 0.92)' : 'rgba(254, 226, 226, 0.97)'
    roundRect(g, x, y, w, h, h / 2)
    g.fill()
    g.fillStyle = this.options.dark ? '#fecaca' : '#991b1b'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(this.toast.text, this.width / 2, y + h / 2 + 0.5, this.width - 40)
    g.globalAlpha = 1
  }
}
