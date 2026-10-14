import {
  SHIELD_ITEMS,
  SHIELD_LIGHT_POINTS,
  SHIELD_LIVES,
  ShieldRound,
  type ShieldDir,
  type ShieldItem,
  type ShieldShot,
} from '@/lib/impulseGameShield'
import { CanvasGame, type HudColors } from '@/components/impulse/game/canvasGame'
import {
  clamp,
  easeIn,
  easeOut,
  emojiBadge,
  makeLayer,
  type GameEngineEvents,
  type GameEngineOptions,
} from '@/components/impulse/game/canvasKit'

/*
 * «Schild hoch!» auf der Leinwand – das Minispiel zur Keuschheit.
 *
 * In der Mitte das Herz, rundum der Schild; aus vier Richtungen fliegen
 * dunkle Pfeile und Lichter heran (Regeln: `lib/impulseGameShield`).
 * Gedreht wird mit einem Tipp dorthin, woher etwas kommt – wer den Finger
 * liegen lässt und im Kreis zieht, dreht den Schild mit. Am Rechner gehen
 * die Pfeiltasten (und W, A, S, D).
 *
 * Der Schild springt in der Rechnung sofort in die neue Richtung; die
 * Leinwand dreht ihn nur rasch hinterher, damit man die Bewegung sieht.
 */

interface Palette {
  skyTop: string
  skyBottom: string
  glow: string
  ring: string
  lane: string
  shield: string
  shieldEdge: string
  shieldShine: string
  heartTop: string
  heartBottom: string
  darkOrbInner: string
  darkOrbOuter: string
  darkRing: string
  darkTrail: string
  lightOrbInner: string
  lightOrbOuter: string
  lightRing: string
  lightTrail: string
  label: string
  labelText: string
  hud: HudColors
  muted: string
}

const LIGHT: Palette = {
  skyTop: '#dbeafe',
  skyBottom: '#ede9fe',
  glow: 'rgba(251, 191, 36, 0.28)',
  ring: 'rgba(30, 64, 175, 0.16)',
  lane: 'rgba(30, 64, 175, 0.08)',
  shield: '#2563eb',
  shieldEdge: '#1e3a8a',
  shieldShine: 'rgba(255, 255, 255, 0.75)',
  heartTop: '#fb7185',
  heartBottom: '#e11d48',
  darkOrbInner: '#4c1d95',
  darkOrbOuter: '#1e1b4b',
  darkRing: '#f97316',
  darkTrail: 'rgba(249, 115, 22, 0.55)',
  lightOrbInner: '#ffffff',
  lightOrbOuter: '#fef3c7',
  lightRing: '#f59e0b',
  lightTrail: 'rgba(251, 191, 36, 0.6)',
  label: 'rgba(15, 23, 42, 0.82)',
  labelText: '#ffffff',
  hud: {
    text: '#0f172a',
    note: '#2563eb',
    heart: '#ef4444',
    heartEmpty: 'rgba(15, 23, 42, 0.18)',
  },
  muted: 'rgba(15, 23, 42, 0.55)',
}

const DARK: Palette = {
  skyTop: '#0b1026',
  skyBottom: '#1e1b4b',
  glow: 'rgba(251, 191, 36, 0.16)',
  ring: 'rgba(147, 197, 253, 0.16)',
  lane: 'rgba(147, 197, 253, 0.07)',
  shield: '#60a5fa',
  shieldEdge: '#bfdbfe',
  shieldShine: 'rgba(255, 255, 255, 0.6)',
  heartTop: '#fda4af',
  heartBottom: '#e11d48',
  darkOrbInner: '#3b0764',
  darkOrbOuter: '#020617',
  darkRing: '#fb923c',
  darkTrail: 'rgba(251, 146, 60, 0.5)',
  lightOrbInner: '#ffffff',
  lightOrbOuter: '#fde68a',
  lightRing: '#fbbf24',
  lightTrail: 'rgba(253, 224, 71, 0.55)',
  label: 'rgba(2, 6, 23, 0.86)',
  labelText: '#ffffff',
  hud: {
    text: '#f8fafc',
    note: '#93c5fd',
    heart: '#f87171',
    heartEmpty: 'rgba(248, 250, 252, 0.2)',
  },
  muted: 'rgba(248, 250, 252, 0.6)',
}

/** Oben, rechts, unten, links – als Winkel auf der Leinwand (y zeigt nach unten). */
const ANGLES: Record<ShieldDir, number> = {
  0: -Math.PI / 2,
  1: 0,
  2: Math.PI / 2,
  3: Math.PI,
}
/** So weit reicht der Schild zu jeder Seite – knapp mehr als ein Viertel. */
const SHIELD_HALF = (Math.PI / 180) * 50
/** Wie lange der Hinweis zum Drehen mindestens steht. */
const HINT_S = 4

interface Afterglow {
  item: ShieldItem
  x: number
  y: number
  vx: number
  vy: number
  /** 0 → 1 */
  t: number
  /** Ins Herz (Licht, Treffer) – oder abgeprallt und weggeflogen. */
  into: boolean
}

interface Sprite {
  canvas: HTMLCanvasElement
  w: number
  h: number
  centerY: number
}

export class ShieldGame extends CanvasGame {
  private readonly colors: Palette
  private round: ShieldRound

  /* Was die Leinwand nachzeichnet */
  private angle = ANGLES[0]
  private shieldGlow = 0
  private heartGlow = 0
  private heartHit = 0
  private blocked = 0
  private afterglows: Afterglow[] = []

  /* Masse */
  private cx = 0
  private cy = 0
  /** Wie weit draussen etwas auftaucht – quer und hoch. Hochkant ist das Feld ein Oval. */
  private arenaX = 0
  private arenaY = 0
  private shieldR = 0
  private orbR = 0
  private heartSize = 0

  /* Vorgezeichnetes */
  private sprites = new Map<ShieldItem, Sprite>()
  private heart: Sprite | null = null

  constructor(options: GameEngineOptions, events: GameEngineEvents) {
    super(options, events, SHIELD_LIVES)
    this.colors = options.dark ? DARK : LIGHT
    this.round = new ShieldRound(this.random)
    this.boot()
  }

  /** Den Schild in eine Richtung drehen – Pfeiltasten. */
  turn(dir: ShieldDir): void {
    if (this.phase !== 'play' || this.isPaused) return
    this.round.turn(dir)
  }

  /**
   * Ein Finger auf der Leinwand (CSS-Pixel ab ihrer linken oberen Ecke):
   * Der Schild zeigt dorthin. Ganz nah am Herz bleibt er, wie er ist –
   * dort ist die Richtung ein Zufall des Fingers.
   */
  pointAt(x: number, y: number): void {
    const dx = x - this.cx
    const dy = y - this.cy
    if (Math.hypot(dx, dy) < this.shieldR * 0.45) return
    const dir: ShieldDir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0
    this.turn(dir)
  }

  protected get score(): number {
    return this.round.points
  }

  protected newRound(): void {
    this.round = new ShieldRound(this.random)
    this.angle = ANGLES[0]
    this.shieldGlow = 0
    this.heartGlow = 0
    this.heartHit = 0
    this.blocked = 0
    this.afterglows = []
  }

  protected update(dt: number): void {
    for (const event of this.round.step(dt)) {
      switch (event.kind) {
        case 'block': {
          const at = this.contact(event.shot.dir)
          this.blocked += 1
          this.shieldGlow = 1
          this.bump()
          this.burst(at.x, at.y, this.options.dark ? '#93c5fd' : '#2563eb', 8)
          this.float('+1', at.x, at.y - this.orbR, this.colors.hud.note)
          this.addAfterglow(event.shot, false)
          this.options.vibrate?.(8)
          break
        }
        case 'hit':
          this.heartHit = 1
          this.addAfterglow(event.shot, true)
          this.hurt(`Nicht abgewehrt: ${event.shot.item.label}`, this.round.lives)
          break
        case 'light':
          this.heartGlow = 1
          this.bump()
          this.burst(this.cx, this.cy, '#fbbf24', 10)
          this.float(
            `+${SHIELD_LIGHT_POINTS}`,
            this.cx,
            this.cy - this.heartSize * 0.75,
            this.options.dark ? '#fde68a' : '#d97706',
            24,
          )
          this.addAfterglow(event.shot, true)
          if (event.healed) this.heal(this.round.lives, this.cx, this.cy + this.heartSize * 0.8)
          this.options.vibrate?.(12)
          break
        case 'bounce': {
          const at = this.contact(event.shot.dir)
          this.addAfterglow(event.shot, false)
          this.float('Licht abgeblockt', at.x, at.y - this.orbR, this.colors.muted, 13)
          break
        }
        case 'over':
          this.finish()
          break
      }
    }
  }

  protected tick(dt: number): void {
    // Der Schild dreht rasch hinterher – auf dem kürzeren Weg.
    const target = ANGLES[this.round.shield]
    let delta = target - this.angle
    while (delta > Math.PI) delta -= Math.PI * 2
    while (delta < -Math.PI) delta += Math.PI * 2
    this.angle =
      this.options.reducedMotion || Math.abs(delta) < 0.01
        ? target
        : this.angle + delta * Math.min(1, dt * 26)

    const decay = (value: number, seconds: number) => Math.max(0, value - dt / seconds)
    this.shieldGlow = decay(this.shieldGlow, 0.25)
    this.heartGlow = decay(this.heartGlow, 0.6)
    this.heartHit = decay(this.heartHit, 0.4)
    for (let index = this.afterglows.length - 1; index >= 0; index -= 1) {
      const glow = this.afterglows[index]
      glow.t += dt / (glow.into ? 0.22 : 0.45)
      if (!glow.into) {
        glow.x += glow.vx * dt
        glow.y += glow.vy * dt
      }
      if (glow.t >= 1) this.afterglows.splice(index, 1)
    }
  }

  protected teardown(): void {
    this.sprites.clear()
    this.heart = null
  }

  /* ---------------------------------------------------------------- */
  /* Masse und Vorzeichnen                                             */
  /* ---------------------------------------------------------------- */

  protected layout(): void {
    const top = this.hudBottom + 6
    const bottom = this.height - this.options.bottomInset - 34
    this.cx = this.width / 2
    this.cy = (top + bottom) / 2
    // Auf dem Telefon ist der Platz hoch, nicht breit: Von oben und unten
    // kommt es von weiter her – in derselben Zeit, also nur schneller im Bild.
    this.arenaX = Math.max(120, Math.min(this.width / 2 - 6, (bottom - top) / 2))
    this.arenaY = Math.max(this.arenaX, Math.min((bottom - top) / 2, this.arenaX * 1.45))
    const arena = Math.min(this.arenaX, this.arenaY)
    this.shieldR = clamp(arena * 0.34, 50, 96)
    this.orbR = clamp(arena * 0.12, 19, 30)
    this.heartSize = this.shieldR * 0.95
    this.buildBackground()
    this.buildSprites()
  }

  /** Wo ein Geschoss aus dieser Richtung auf den Schild trifft. */
  private contact(dir: ShieldDir) {
    const a = ANGLES[dir]
    const d = this.shieldR + this.orbR * 0.6
    return { x: this.cx + Math.cos(a) * d, y: this.cy + Math.sin(a) * d }
  }

  /** Wo ein Geschoss steht: am Rand bei 0, am Schild bei 1. */
  private position(shot: ShieldShot) {
    const a = ANGLES[shot.dir]
    const from = this.reach(shot.dir) + this.orbR * 0.4
    const to = this.shieldR + this.orbR * 0.9
    const d = from - (from - to) * this.round.progress(shot)
    return { x: this.cx + Math.cos(a) * d, y: this.cy + Math.sin(a) * d }
  }

  /** Wie weit draussen es aus dieser Richtung auftaucht. */
  private reach(dir: ShieldDir): number {
    return dir % 2 === 0 ? this.arenaY : this.arenaX
  }

  private addAfterglow(shot: ShieldShot, into: boolean) {
    const a = ANGLES[shot.dir]
    const start = this.contact(shot.dir)
    const spin = (this.random() - 0.5) * 1.2
    this.afterglows.push({
      item: shot.item,
      x: start.x,
      y: start.y,
      // Abgeprallt: zurück nach aussen, ein wenig zur Seite.
      vx: Math.cos(a + spin) * 260,
      vy: Math.sin(a + spin) * 260,
      t: 0,
      into,
    })
  }

  private buildBackground() {
    const layer = makeLayer(this.width, this.height, this.dpr)
    if (!layer) return
    const { canvas, g } = layer
    const c = this.colors
    const sky = g.createLinearGradient(0, 0, 0, this.height)
    sky.addColorStop(0, c.skyTop)
    sky.addColorStop(1, c.skyBottom)
    g.fillStyle = sky
    g.fillRect(0, 0, this.width, this.height)
    // Ein warmes Leuchten um das Herz – das, was geschützt wird.
    const glow = g.createRadialGradient(this.cx, this.cy, 0, this.cx, this.cy, this.arenaY * 1.05)
    glow.addColorStop(0, c.glow)
    glow.addColorStop(1, 'rgba(255, 255, 255, 0)')
    g.fillStyle = glow
    g.fillRect(0, 0, this.width, this.height)
    // Die vier Bahnen und der Rand, an dem alles auftaucht.
    g.strokeStyle = c.lane
    g.lineWidth = this.orbR * 1.35
    g.lineCap = 'round'
    for (const dir of [0, 1, 2, 3] as const) {
      const a = ANGLES[dir]
      g.beginPath()
      g.moveTo(
        this.cx + Math.cos(a) * this.shieldR * 1.25,
        this.cy + Math.sin(a) * this.shieldR * 1.25,
      )
      g.lineTo(this.cx + Math.cos(a) * this.reach(dir), this.cy + Math.sin(a) * this.reach(dir))
      g.stroke()
    }
    g.strokeStyle = c.ring
    g.lineWidth = 2
    g.setLineDash([6, 10])
    g.beginPath()
    g.ellipse(this.cx, this.cy, this.arenaX, this.arenaY, 0, 0, Math.PI * 2)
    g.stroke()
    g.setLineDash([])
    this.background = canvas
  }

  private buildSprites() {
    this.sprites.clear()
    const c = this.colors
    for (const item of SHIELD_ITEMS) {
      const sprite = emojiBadge(this.dpr, this.orbR, item.emoji, item.label, {
        fill: (g, cx, cy, r) => {
          const fill = g.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r)
          fill.addColorStop(0, item.light ? c.lightOrbInner : c.darkOrbInner)
          fill.addColorStop(1, item.light ? c.lightOrbOuter : c.darkOrbOuter)
          return fill
        },
        ring: item.light ? c.lightRing : c.darkRing,
        shadow: item.light ? 'rgba(251, 191, 36, 0.7)' : 'rgba(0, 0, 0, 0.5)',
        labelFill: c.label,
        labelText: c.labelText,
      })
      if (sprite) this.sprites.set(item, sprite)
    }
    // Das Herz – mit weichem Schein, einmal vorgezeichnet.
    const size = this.heartSize
    const pad = size * 0.4
    const layer = makeLayer(size + pad * 2, size + pad * 2, this.dpr)
    if (!layer) return
    const { canvas, g } = layer
    const mid = (size + pad * 2) / 2
    const fill = g.createLinearGradient(0, mid - size / 2, 0, mid + size / 2)
    fill.addColorStop(0, c.heartTop)
    fill.addColorStop(1, c.heartBottom)
    g.save()
    g.shadowColor = this.options.dark ? 'rgba(251, 113, 133, 0.65)' : 'rgba(225, 29, 72, 0.4)'
    g.shadowBlur = size * 0.3
    heartPath(g, mid, mid + size * 0.04, size)
    g.fillStyle = fill
    g.fill()
    g.restore()
    // Ein Glanzpunkt oben links.
    g.fillStyle = 'rgba(255, 255, 255, 0.55)'
    g.beginPath()
    g.ellipse(mid - size * 0.2, mid - size * 0.16, size * 0.09, size * 0.06, -0.6, 0, Math.PI * 2)
    g.fill()
    this.heart = { canvas, w: size + pad * 2, h: size + pad * 2, centerY: mid }
  }

  /* ---------------------------------------------------------------- */
  /* Zeichnen                                                          */
  /* ---------------------------------------------------------------- */

  protected renderWorld(): void {
    const g = this.g
    // Je schneller, desto wärmer das Licht am Rand – man spürt, dass es eng wird.
    const heat = this.phase === 'ready' ? 0 : clamp((this.round.time - 15) / 40, 0, 1)
    if (heat > 0) {
      g.globalAlpha = heat * (this.options.dark ? 0.2 : 0.14)
      g.fillStyle = '#f97316'
      g.fillRect(-10, 0, this.width + 20, this.height)
      g.globalAlpha = 1
    }
    this.drawHeart()
    this.drawShots()
    this.drawAfterglows()
    this.drawShield()
    if (this.phase === 'play') {
      const fade = this.blocked >= 3 ? clamp((HINT_S + 0.5 - this.round.time) / 0.5, 0, 1) : 1
      this.drawHint(
        'Tippe dorthin, woher es kommt – Lichter lässt du durch',
        this.height - this.options.bottomInset - 18,
        this.colors.muted,
        fade,
      )
    }
  }

  protected renderHud(): void {
    const streak = this.round.streak
    this.drawHud(this.colors.hud, this.round.lives, streak >= 5 ? `${streak} abgewehrt` : '')
  }

  private drawHeart() {
    if (!this.heart) return
    const g = this.g
    const beat = this.options.reducedMotion ? 0 : Math.sin(this.clock * 5) * 0.025
    const scale = 1 + beat + 0.12 * this.heartGlow - 0.08 * this.heartHit
    const { canvas, w, h, centerY } = this.heart
    if (this.heartGlow > 0) {
      g.globalAlpha = this.heartGlow * 0.55
      g.fillStyle = '#fde68a'
      g.beginPath()
      g.arc(this.cx, this.cy, this.heartSize * (0.7 + 0.3 * this.heartGlow), 0, Math.PI * 2)
      g.fill()
      g.globalAlpha = 1
    }
    g.drawImage(canvas, this.cx - (w * scale) / 2, this.cy - centerY * scale, w * scale, h * scale)
  }

  private drawShots() {
    const g = this.g
    // Von hinten nach vorn: Was näher am Herz ist, liegt obenauf.
    for (let index = this.round.shots.length - 1; index >= 0; index -= 1) {
      const shot = this.round.shots[index]
      if (shot.spawn > this.round.time) continue
      const sprite = this.sprites.get(shot.item)
      if (!sprite) continue
      const { x, y } = this.position(shot)
      const p = this.round.progress(shot)
      const a = ANGLES[shot.dir]
      // Der Schweif – nach aussen, von wo es kommt.
      const tail = this.orbR * (1.4 + 1.2 * p)
      const tx = x + Math.cos(a) * tail
      const ty = y + Math.sin(a) * tail
      const trail = g.createLinearGradient(x, y, tx, ty)
      trail.addColorStop(0, shot.item.light ? this.colors.lightTrail : this.colors.darkTrail)
      trail.addColorStop(1, 'rgba(255, 255, 255, 0)')
      g.strokeStyle = trail
      g.lineWidth = this.orbR * 1.1
      g.lineCap = 'round'
      g.beginPath()
      g.moveTo(x, y)
      g.lineTo(tx, ty)
      g.stroke()
      const pop = easeOut(clamp(p * 6, 0, 1))
      const scale = 0.7 + 0.3 * pop
      g.globalAlpha = 0.4 + 0.6 * pop
      g.drawImage(
        sprite.canvas,
        x - (sprite.w * scale) / 2,
        y - sprite.centerY * scale,
        sprite.w * scale,
        sprite.h * scale,
      )
      g.globalAlpha = 1
    }
  }

  private drawAfterglows() {
    const g = this.g
    for (const glow of this.afterglows) {
      const sprite = this.sprites.get(glow.item)
      if (!sprite) continue
      let x = glow.x
      let y = glow.y
      let scale: number
      if (glow.into) {
        const k = easeIn(clamp(glow.t, 0, 1))
        x += (this.cx - x) * k
        y += (this.cy - y) * k
        scale = 1 - 0.7 * k
      } else {
        scale = 1 - 0.3 * glow.t
      }
      g.globalAlpha = clamp(1 - glow.t, 0, 1)
      g.drawImage(
        sprite.canvas,
        x - (sprite.w * scale) / 2,
        y - sprite.centerY * scale,
        sprite.w * scale,
        sprite.h * scale,
      )
    }
    g.globalAlpha = 1
  }

  private drawShield() {
    const g = this.g
    const c = this.colors
    const r = this.shieldR
    const thick = clamp(r * 0.2, 10, 17) * (1 + 0.25 * this.shieldGlow)
    const from = this.angle - SHIELD_HALF
    const to = this.angle + SHIELD_HALF
    g.lineCap = 'round'
    if (this.shieldGlow > 0) {
      g.globalAlpha = this.shieldGlow * 0.5
      g.strokeStyle = '#fde68a'
      g.lineWidth = thick + 12
      g.beginPath()
      g.arc(this.cx, this.cy, r, from, to)
      g.stroke()
      g.globalAlpha = 1
    }
    g.strokeStyle = c.shieldEdge
    g.lineWidth = thick + 4
    g.beginPath()
    g.arc(this.cx, this.cy, r, from, to)
    g.stroke()
    g.strokeStyle = c.shield
    g.lineWidth = thick
    g.beginPath()
    g.arc(this.cx, this.cy, r, from, to)
    g.stroke()
    // Ein Glanz auf der Innenseite – damit es nach Metall aussieht, nicht nach Strich.
    g.strokeStyle = c.shieldShine
    g.lineWidth = Math.max(2, thick * 0.22)
    g.beginPath()
    g.arc(this.cx, this.cy, r - thick * 0.22, from + 0.12, to - 0.12)
    g.stroke()
    // Ein kleiner Kreis als Griff zeigt, wohin der Schild schaut.
    g.fillStyle = c.shieldEdge
    g.beginPath()
    g.arc(
      this.cx + Math.cos(this.angle) * (r - thick * 1.1),
      this.cy + Math.sin(this.angle) * (r - thick * 1.1),
      Math.max(3, thick * 0.28),
      0,
      Math.PI * 2,
    )
    g.fill()
  }
}

/** Die Form eines Herzens um seinen Mittelpunkt – als Pfad, zum Füllen mit Verlauf. */
function heartPath(g: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  const s = size / 2
  g.beginPath()
  g.moveTo(cx, cy + s * 0.85)
  g.bezierCurveTo(cx - s * 1.25, cy - s * 0.05, cx - s * 0.75, cy - s * 1.15, cx, cy - s * 0.45)
  g.bezierCurveTo(cx + s * 0.75, cy - s * 1.15, cx + s * 1.25, cy - s * 0.05, cx, cy + s * 0.85)
  g.closePath()
}

/* ------------------------------------------------------------------ */
/* Die Steuerung                                                       */
/* ------------------------------------------------------------------ */

const KEY_DIRS: Record<string, ShieldDir> = {
  ArrowUp: 0,
  ArrowRight: 1,
  ArrowDown: 2,
  ArrowLeft: 3,
  w: 0,
  d: 1,
  s: 2,
  a: 3,
}

/**
 * Tippen, Ziehen und Pfeiltasten.
 *
 * Ein Finger zeigt, wohin der Schild soll – schon beim Aufsetzen, nicht
 * erst beim Loslassen. Bleibt er liegen und zieht im Kreis, dreht der
 * Schild mit. Mehrere Finger gehen auch: Es zählt der, der sich zuletzt
 * bewegt hat. Am Rechner die Pfeiltasten oder W, A, S, D.
 *
 * Gibt das Abmelden zurück.
 */
export function attachShieldControls(
  surface: HTMLElement,
  handlers: { point: (x: number, y: number) => void; dir: (dir: ShieldDir) => void },
): () => void {
  const pressed = new Set<number>()
  const local = (event: PointerEvent) => {
    const rect = surface.getBoundingClientRect()
    handlers.point(event.clientX - rect.left, event.clientY - rect.top)
  }
  const down = (event: PointerEvent) => {
    if ((event.target as HTMLElement | null)?.closest('button, a, input')) return
    pressed.add(event.pointerId)
    local(event)
  }
  const move = (event: PointerEvent) => {
    if (pressed.has(event.pointerId)) local(event)
  }
  const up = (event: PointerEvent) => {
    pressed.delete(event.pointerId)
  }
  const key = (event: KeyboardEvent) => {
    if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return
    if ((event.target as HTMLElement | null)?.closest('input, textarea')) return
    const dir = KEY_DIRS[event.key.length === 1 ? event.key.toLowerCase() : event.key]
    if (dir === undefined) return
    event.preventDefault()
    handlers.dir(dir)
  }

  surface.addEventListener('pointerdown', down)
  surface.addEventListener('pointermove', move)
  surface.addEventListener('pointerup', up)
  surface.addEventListener('pointercancel', up)
  window.addEventListener('keydown', key)
  return () => {
    surface.removeEventListener('pointerdown', down)
    surface.removeEventListener('pointermove', move)
    surface.removeEventListener('pointerup', up)
    surface.removeEventListener('pointercancel', up)
    window.removeEventListener('keydown', key)
  }
}
