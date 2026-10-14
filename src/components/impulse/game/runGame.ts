import {
  RUN_HURDLE_SHAPES,
  RUN_HURDLES,
  RUN_LIVES,
  RUN_TASK_RADIUS,
  RUN_TASKS,
  RUN_WORLD,
  RunRound,
  type RunHurdle,
  type RunHurdleShape,
  type RunItem,
} from '@/lib/impulseGameRun'
import { CanvasGame, type HudColors } from '@/components/impulse/game/canvasGame'
import {
  clamp,
  EMOJI_FONT,
  emojiBadge,
  makeLayer,
  roundRect,
  UI_FONT,
  type GameEngineEvents,
  type GameEngineOptions,
} from '@/components/impulse/game/canvasKit'

/*
 * «Keine Ausreden!» auf der Leinwand – das Minispiel zu Helamans jungen
 * Kriegern.
 *
 * Von der Seite gesehen: Der Läufer steht links, die Welt läuft unter
 * ihm durch (Regeln: `lib/impulseGameRun`). Ein Tipp irgendwo – oder die
 * Leertaste, Pfeil nach oben, W – lässt ihn springen; wer gedrückt hält,
 * springt höher. Gemessen wird in Körperhöhen: Auf jedem Bildschirm sieht
 * man gleich weit voraus, ein breiter zeigt nur mehr Himmel.
 *
 * Für die Tiefe zieht eine Hügelkette langsamer vorbei als der Boden –
 * vorgezeichnet als ein Streifen, der zweimal gestempelt wird.
 */

interface Palette {
  skyTop: string
  skyBottom: string
  sun: string
  hillsFar: string
  hillsNear: string
  ground: string
  groundTop: string
  groundLine: string
  dash: string
  hurdleTop: string
  hurdleBottom: string
  hurdleEdge: string
  taskInner: string
  taskOuter: string
  taskRing: string
  label: string
  labelText: string
  hud: HudColors
  muted: string
}

const LIGHT: Palette = {
  skyTop: '#bae6fd',
  skyBottom: '#fef3c7',
  sun: 'rgba(253, 186, 116, 0.9)',
  hillsFar: 'rgba(134, 239, 172, 0.55)',
  hillsNear: 'rgba(74, 222, 128, 0.55)',
  ground: '#d6b98c',
  groundTop: '#a3e635',
  groundLine: '#65a30d',
  dash: 'rgba(120, 83, 39, 0.28)',
  hurdleTop: '#78716c',
  hurdleBottom: '#44403c',
  hurdleEdge: '#292524',
  taskInner: '#ffffff',
  taskOuter: '#fef3c7',
  taskRing: '#f59e0b',
  label: 'rgba(15, 23, 42, 0.82)',
  labelText: '#ffffff',
  hud: {
    text: '#0f172a',
    note: '#c2410c',
    heart: '#ef4444',
    heartEmpty: 'rgba(15, 23, 42, 0.18)',
  },
  muted: 'rgba(15, 23, 42, 0.6)',
}

const DARK: Palette = {
  skyTop: '#0b1026',
  skyBottom: '#312e81',
  sun: 'rgba(254, 240, 138, 0.85)',
  hillsFar: 'rgba(30, 41, 59, 0.9)',
  hillsNear: 'rgba(15, 23, 42, 0.9)',
  ground: '#3f2d1c',
  groundTop: '#3f6212',
  groundLine: '#65a30d',
  dash: 'rgba(0, 0, 0, 0.3)',
  hurdleTop: '#57534e',
  hurdleBottom: '#292524',
  hurdleEdge: '#0c0a09',
  taskInner: '#ffffff',
  taskOuter: '#fde68a',
  taskRing: '#fbbf24',
  label: 'rgba(2, 6, 23, 0.86)',
  labelText: '#ffffff',
  hud: {
    text: '#f8fafc',
    note: '#fdba74',
    heart: '#f87171',
    heartEmpty: 'rgba(248, 250, 252, 0.2)',
  },
  muted: 'rgba(248, 250, 252, 0.65)',
}

/** Wie lange der Hinweis zum Springen mindestens steht. */
const HINT_S = 4
/** So viel langsamer als der Boden ziehen die Hügel vorbei. */
const PARALLAX = 0.25

interface Sprite {
  canvas: HTMLCanvasElement
  w: number
  h: number
}

interface Debris {
  sprite: Sprite
  x: number
  y: number
  vx: number
  vy: number
  spin: number
  t: number
}

export class RunGame extends CanvasGame {
  private readonly colors: Palette
  private round: RunRound
  private cleared = 0
  /** Hürden, die ihn getroffen haben – sie zerspringen und sind weg. */
  private smashed = new Set<number>()
  private debris: Debris[] = []
  private squash = 0

  /* Masse */
  private unit = 40
  private groundY = 0
  private runnerX = 0

  /* Vorgezeichnetes */
  private runner: Sprite | null = null
  private hills: Sprite | null = null
  private hurdleSprites = new Map<string, Sprite>()
  private taskSprites = new Map<RunItem, Sprite & { centerY: number }>()

  constructor(options: GameEngineOptions, events: GameEngineEvents) {
    super(options, events, RUN_LIVES)
    this.colors = options.dark ? DARK : LIGHT
    this.round = new RunRound(this.random)
    this.boot()
  }

  /** Finger auf den Bildschirm oder Taste gedrückt. */
  press(): void {
    if (this.phase !== 'play' || this.isPaused) return
    this.round.press()
  }

  release(): void {
    this.round.release()
  }

  protected get score(): number {
    return this.round.points
  }

  protected newRound(): void {
    this.round = new RunRound(this.random)
    this.cleared = 0
    this.smashed.clear()
    this.debris = []
    this.squash = 0
  }

  protected update(dt: number): void {
    for (const event of this.round.step(dt)) {
      switch (event.kind) {
        case 'land':
          this.squash = 1
          break
        case 'clear': {
          this.cleared += 1
          this.bump()
          const x = this.screenX(event.hurdle.x + event.hurdle.w / 2)
          this.float('+1', x, this.groundY - event.hurdle.h * this.unit - 16, this.colors.hud.note)
          if (event.healed) this.heal(this.round.lives, this.width / 2, this.hudBottom + 10)
          break
        }
        case 'task': {
          const x = this.runnerX
          const y = this.groundY - event.task.y * this.unit
          this.bump()
          this.burst(x, y, '#f59e0b', 8)
          this.float(`+1 ${event.task.item.label}`, x + this.unit * 0.6, y - 10, '#d97706', 16)
          this.options.vibrate?.(8)
          break
        }
        case 'hit':
          this.smashed.add(event.hurdle.id)
          this.shatter(event.hurdle)
          this.hurt(`Verwundet: «${event.hurdle.item.label}»`, this.round.lives)
          break
        case 'over':
          this.finish()
          break
      }
    }
  }

  protected tick(dt: number): void {
    this.squash = Math.max(0, this.squash - dt / 0.18)
    for (let index = this.debris.length - 1; index >= 0; index -= 1) {
      const piece = this.debris[index]
      piece.vy += 1600 * dt
      piece.x += piece.vx * dt
      piece.y += piece.vy * dt
      piece.t += dt / 0.7
      if (piece.t >= 1) this.debris.splice(index, 1)
    }
  }

  protected teardown(): void {
    this.hurdleSprites.clear()
    this.taskSprites.clear()
    this.runner = null
    this.hills = null
  }

  /* ---------------------------------------------------------------- */
  /* Masse und Vorzeichnen                                             */
  /* ---------------------------------------------------------------- */

  protected layout(): void {
    const w = RUN_WORLD
    const top = this.hudBottom + 8
    const bottom = this.height - this.options.bottomInset - 8
    // Über dem Boden braucht es Platz für den höchsten Sprung samt Aufgabe, darunter für die Wörter.
    const above = 3.5
    const below = 1.3
    this.unit = clamp(
      Math.min(this.width / (w.ahead + w.behind), (bottom - top) / (above + below)),
      26,
      96,
    )
    const spare = Math.max(0, bottom - top - this.unit * (above + below))
    this.groundY = top + spare * 0.55 + this.unit * above
    this.runnerX = this.unit * w.behind
    this.buildBackground()
    this.buildSprites()
  }

  private screenX(worldX: number): number {
    return this.runnerX + (worldX - this.round.distance) * this.unit
  }

  private shatter(hurdle: RunHurdle) {
    const sprite = this.hurdleSprites.get(spriteKey(hurdle.shape, hurdle.item))
    if (!sprite) return
    this.debris.push({
      sprite,
      x: this.screenX(hurdle.x) + sprite.w / 2,
      y: this.groundY - sprite.h / 2,
      vx: 220,
      vy: -380,
      spin: 5,
      t: 0,
    })
  }

  private buildBackground() {
    const layer = makeLayer(this.width, this.height, this.dpr)
    if (!layer) return
    const { canvas, g } = layer
    const c = this.colors
    const sky = g.createLinearGradient(0, 0, 0, this.groundY)
    sky.addColorStop(0, c.skyTop)
    sky.addColorStop(1, c.skyBottom)
    g.fillStyle = sky
    g.fillRect(0, 0, this.width, this.groundY)
    // Sonne bei Tag, Mond bei Nacht – «zu allen Zeiten».
    const sunX = this.width * 0.78
    const sunY = Math.max(this.hudBottom + this.unit, this.groundY - this.unit * 3.6)
    const sun = g.createRadialGradient(sunX, sunY, 0, sunX, sunY, this.unit * 1.6)
    sun.addColorStop(0, c.sun)
    sun.addColorStop(0.35, c.sun)
    sun.addColorStop(
      0.4,
      this.options.dark ? 'rgba(254, 240, 138, 0.18)' : 'rgba(253, 186, 116, 0.3)',
    )
    sun.addColorStop(1, 'rgba(255, 255, 255, 0)')
    g.fillStyle = sun
    g.fillRect(sunX - this.unit * 2, sunY - this.unit * 2, this.unit * 4, this.unit * 4)
    if (this.options.dark) {
      g.fillStyle = 'rgba(255, 255, 255, 0.7)'
      for (let index = 0; index < 40; index += 1) {
        const x = (Math.sin(index * 12.9898) * 43758.5453) % 1
        const y = (Math.sin(index * 78.233) * 12543.123) % 1
        g.beginPath()
        g.arc(
          Math.abs(x) * this.width,
          Math.abs(y) * this.groundY * 0.85,
          index % 3 === 0 ? 1.3 : 0.8,
          0,
          Math.PI * 2,
        )
        g.fill()
      }
    }
    // Der Boden: Gras oben, Erde darunter – dort stehen die Wörter der Ausreden.
    g.fillStyle = c.ground
    g.fillRect(0, this.groundY, this.width, this.height - this.groundY)
    g.fillStyle = c.groundTop
    g.fillRect(0, this.groundY, this.width, Math.max(5, this.unit * 0.14))
    g.fillStyle = c.groundLine
    g.fillRect(0, this.groundY, this.width, 2)
    this.background = canvas

    // Die Hügel: ein Streifen, so breit wie der Bildschirm, der sich nahtlos wiederholt.
    // Genau so breit, dass es ganze Gerätepixel sind – sonst passt die Wiederholung nicht auf den Punkt.
    const stripW = Math.ceil(this.width * this.dpr) / this.dpr
    const stripH = Math.ceil(this.unit * 2.4)
    const hills = makeLayer(stripW, stripH, this.dpr)
    if (!hills) return
    const hg = hills.g
    const wave = (color: string, height: number, bumps: number, phase: number) => {
      hg.fillStyle = color
      hg.beginPath()
      hg.moveTo(0, stripH)
      // Bis genau an den rechten Rand – sonst bliebe an der Naht ein Spalt.
      for (let step = 0; step <= stripW + 3; step += 4) {
        const x = Math.min(step, stripW)
        const k = (x / stripW) * Math.PI * 2 * bumps + phase
        hg.lineTo(x, stripH - height * (0.6 + 0.4 * Math.sin(k)))
      }
      hg.lineTo(stripW, stripH)
      hg.closePath()
      hg.fill()
    }
    wave(c.hillsFar, stripH * 0.95, 2, 0.4)
    wave(c.hillsNear, stripH * 0.6, 3, 2.1)
    this.hills = { canvas: hills.canvas, w: stripW, h: stripH }
  }

  private buildSprites() {
    const u = this.unit
    const c = this.colors
    // Der Läufer schaut im Emoji nach links – gespiegelt läuft er nach rechts, der Welt entgegen.
    const size = u * 1.25
    const runner = makeLayer(size * 1.3, size * 1.2, this.dpr)
    if (runner) {
      const g = runner.g
      g.translate(size * 1.3, 0)
      g.scale(-1, 1)
      g.font = `${Math.round(size)}px ${EMOJI_FONT}`
      g.textAlign = 'center'
      g.textBaseline = 'bottom'
      g.fillText('🏃', size * 0.65, size * 1.15)
      g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
      // Der Schild vorne – ein junger Krieger, nicht bloss ein Jogger.
      g.font = `${Math.round(size * 0.45)}px ${EMOJI_FONT}`
      g.fillText('🛡️', size * 0.98, size * 0.86)
      this.runner = { canvas: runner.canvas, w: size * 1.3, h: size * 1.2 }
    }

    this.hurdleSprites.clear()
    for (const shape of Object.keys(RUN_HURDLE_SHAPES) as RunHurdleShape[]) {
      for (const item of RUN_HURDLES) {
        const { w, h } = RUN_HURDLE_SHAPES[shape]
        const pw = w * u
        const ph = h * u
        const layer = makeLayer(pw, ph, this.dpr)
        if (!layer) continue
        const g = layer.g
        const fill = g.createLinearGradient(0, 0, 0, ph)
        fill.addColorStop(0, c.hurdleTop)
        fill.addColorStop(1, c.hurdleBottom)
        roundRect(g, 1, 1, pw - 2, ph - 1, Math.min(10, pw * 0.2))
        g.fillStyle = fill
        g.fill()
        g.lineWidth = 2
        g.strokeStyle = c.hurdleEdge
        g.stroke()
        const emoji = Math.min(pw * (shape === 'double' ? 0.45 : 0.78), ph * 0.78)
        g.font = `${Math.round(emoji)}px ${EMOJI_FONT}`
        g.textAlign = 'center'
        g.textBaseline = 'middle'
        if (shape === 'double') {
          g.fillText(item.emoji, pw * 0.27, ph * 0.54)
          g.fillText(item.emoji, pw * 0.73, ph * 0.54)
        } else {
          g.fillText(item.emoji, pw / 2, ph - emoji * 0.62)
        }
        this.hurdleSprites.set(spriteKey(shape, item), { canvas: layer.canvas, w: pw, h: ph })
      }
    }

    this.taskSprites.clear()
    for (const item of RUN_TASKS) {
      const sprite = emojiBadge(this.dpr, RUN_TASK_RADIUS * u, item.emoji, '', {
        fill: (g, cx, cy, r) => {
          const fill = g.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r)
          fill.addColorStop(0, c.taskInner)
          fill.addColorStop(1, c.taskOuter)
          return fill
        },
        ring: c.taskRing,
        shadow: 'rgba(245, 158, 11, 0.6)',
        labelFill: c.label,
        labelText: c.labelText,
      })
      if (sprite) this.taskSprites.set(item, sprite)
    }
  }

  /* ---------------------------------------------------------------- */
  /* Zeichnen                                                          */
  /* ---------------------------------------------------------------- */

  protected renderWorld(): void {
    const g = this.g
    const u = this.unit
    const round = this.round
    // Je schneller, desto wärmer das Licht – man spürt, dass es eng wird.
    const heat = this.phase === 'ready' ? 0 : clamp((round.time - 15) / 40, 0, 1)
    if (heat > 0) {
      g.globalAlpha = heat * (this.options.dark ? 0.18 : 0.14)
      g.fillStyle = '#f97316'
      g.fillRect(-10, 0, this.width + 20, this.groundY)
      g.globalAlpha = 1
    }
    if (this.hills) {
      // Zwei Kopien Kante an Kante, in ganzen Gerätepixeln und ohne Skalieren:
      // Halbe Pixel verwischten die Ränder, und die Naht schimmerte als Strich durch.
      const strip = this.hills.canvas
      const shift = Math.round((round.distance * u * PARALLAX * this.dpr) % strip.width)
      const y = Math.round((this.groundY - this.hills.h + 1) * this.dpr)
      g.save()
      g.setTransform(1, 0, 0, 1, 0, 0)
      g.drawImage(strip, -shift, y)
      g.drawImage(strip, strip.width - shift, y)
      g.restore()
    }
    // Striche im Boden ziehen mit der Welt – so sieht man das Tempo.
    g.fillStyle = this.colors.dash
    const spacing = u * 1.1
    const shift = (round.distance * u) % spacing
    for (let x = -shift; x < this.width + spacing; x += spacing) {
      g.fillRect(x, this.groundY + u * 0.35, u * 0.4, 3)
      g.fillRect(x + spacing * 0.5, this.groundY + u * 0.8, u * 0.25, 3)
    }

    this.drawTasks()
    this.drawHurdles()
    this.drawRunner()
    this.drawDebris()

    if (this.phase === 'play') {
      const fade = this.cleared >= 3 ? clamp((HINT_S + 0.5 - round.time) / 0.5, 0, 1) : 1
      this.drawHint(
        'Tippe zum Springen – länger drücken springt höher',
        Math.min(this.height - this.options.bottomInset - 18, this.groundY + u * 1.15),
        this.options.dark ? this.colors.muted : 'rgba(255, 255, 255, 0.95)',
        fade,
      )
    }
  }

  protected renderHud(): void {
    const streak = this.round.streak
    this.drawHud(this.colors.hud, this.round.lives, streak >= 5 ? `${streak} Hürden am Stück` : '')
  }

  private drawHurdles() {
    const g = this.g
    const c = this.colors
    for (const hurdle of this.round.hurdles) {
      const x = this.screenX(hurdle.x)
      if (x > this.width + 4 || x + hurdle.w * this.unit < -4) continue
      const sprite = this.hurdleSprites.get(spriteKey(hurdle.shape, hurdle.item))
      if (!sprite) continue
      if (this.smashed.has(hurdle.id)) continue
      // Weit vorne taucht sie sanft auf, statt am Rand hereinzuspringen; wer
      // nach einem Treffer hindurchläuft, sieht sie nur noch blass.
      const ahead = (hurdle.x - this.round.distance) / RUN_WORLD.ahead
      g.globalAlpha = hurdle.touched ? 0.35 : clamp((1.12 - ahead) / 0.12, 0, 1)
      g.drawImage(sprite.canvas, x, this.groundY - sprite.h, sprite.w, sprite.h)
      // Das Wort der Ausrede unten in der Erde – solange sie vor dem Läufer liegt.
      if (!hurdle.passed) {
        const size = Math.round(clamp(this.unit * 0.3, 10, 14))
        g.font = `800 ${size}px ${UI_FONT}`
        const text = hurdle.item.label
        const tw = g.measureText(text).width
        const cx = x + sprite.w / 2
        const h = size + 8
        const y = this.groundY + this.unit * 0.22
        g.fillStyle = c.label
        roundRect(g, cx - tw / 2 - 7, y, tw + 14, h, h / 2)
        g.fill()
        g.fillStyle = c.labelText
        g.textAlign = 'center'
        g.textBaseline = 'middle'
        g.fillText(text, cx, y + h / 2 + 0.5)
      }
      g.globalAlpha = 1
    }
  }

  private drawTasks() {
    const g = this.g
    for (const task of this.round.tasks) {
      if (task.taken) continue
      const sprite = this.taskSprites.get(task.item)
      if (!sprite) continue
      const x = this.screenX(task.x)
      if (x < -sprite.w || x > this.width + sprite.w) continue
      const bob = this.options.reducedMotion
        ? 0
        : Math.sin(this.clock * 4 + task.id) * this.unit * 0.05
      const y = this.groundY - task.y * this.unit + bob
      const ahead = (task.x - this.round.distance) / RUN_WORLD.ahead
      g.globalAlpha = clamp((1.12 - ahead) / 0.12, 0, 1)
      g.drawImage(sprite.canvas, x - sprite.w / 2, y - sprite.centerY, sprite.w, sprite.h)
    }
    g.globalAlpha = 1
  }

  private drawRunner() {
    const sprite = this.runner
    if (!sprite) return
    const g = this.g
    const round = this.round
    // Getroffen: Er blinkt, solange ihn nichts treffen kann.
    if (round.invulnerable > 0 && Math.floor(this.clock * 14) % 2 === 0) return
    const running = round.grounded && this.phase === 'play' && !this.options.reducedMotion
    const bob = running ? Math.abs(Math.sin(this.clock * 9 * round.tempo)) * this.unit * 0.08 : 0
    const squash = 1 - 0.12 * this.squash
    const footY = this.groundY - round.y * this.unit - bob
    g.save()
    g.translate(this.runnerX, footY)
    if (!round.grounded && !this.options.reducedMotion)
      g.rotate(clamp(-round.vy * 0.02, -0.25, 0.25))
    g.scale(1 + (1 - squash) * 0.6, squash)
    g.drawImage(sprite.canvas, -sprite.w * 0.5, -sprite.h, sprite.w, sprite.h)
    g.restore()
    // Ein Schatten auf dem Boden – je höher, desto kleiner.
    const shadow = clamp(1 - round.y / 3, 0.3, 1)
    g.globalAlpha = 0.18 * shadow
    g.fillStyle = '#000000'
    g.beginPath()
    g.ellipse(
      this.runnerX,
      this.groundY + 2,
      this.unit * 0.35 * shadow,
      this.unit * 0.08,
      0,
      0,
      Math.PI * 2,
    )
    g.fill()
    g.globalAlpha = 1
  }

  private drawDebris() {
    const g = this.g
    for (const piece of this.debris) {
      g.save()
      g.globalAlpha = clamp(1 - piece.t, 0, 1)
      g.translate(piece.x, piece.y)
      g.rotate(piece.spin * piece.t)
      g.drawImage(
        piece.sprite.canvas,
        -piece.sprite.w / 2,
        -piece.sprite.h / 2,
        piece.sprite.w,
        piece.sprite.h,
      )
      g.restore()
    }
  }
}

function spriteKey(shape: RunHurdleShape, item: RunItem): string {
  return `${shape}:${item.label}`
}

/* ------------------------------------------------------------------ */
/* Die Steuerung                                                       */
/* ------------------------------------------------------------------ */

const JUMP_KEYS = new Set([' ', 'Spacebar', 'ArrowUp', 'w', 'W'])

/**
 * Tippen irgendwo und die Sprungtasten.
 *
 * Der Sprung beginnt beim Aufsetzen des Fingers, nicht beim Loslassen –
 * so reagiert das Spiel im selben Moment. Losgelassen ist erst, wenn kein
 * Finger mehr liegt: Wer mit zwei Daumen spielt, springt nicht zu kurz,
 * weil der erste schon weg ist. Am Rechner die Leertaste, Pfeil nach oben
 * oder W – gedrückt halten springt höher.
 *
 * Gibt das Abmelden zurück.
 */
export function attachRunControls(
  surface: HTMLElement,
  handlers: { press: () => void; release: () => void },
): () => void {
  const pressed = new Set<number>()
  let keyDown = false
  const down = (event: PointerEvent) => {
    if ((event.target as HTMLElement | null)?.closest('button, a, input')) return
    pressed.add(event.pointerId)
    handlers.press()
  }
  const up = (event: PointerEvent) => {
    if (!pressed.delete(event.pointerId)) return
    if (pressed.size === 0 && !keyDown) handlers.release()
  }
  const keydown = (event: KeyboardEvent) => {
    if (!JUMP_KEYS.has(event.key) || event.altKey || event.ctrlKey || event.metaKey) return
    if ((event.target as HTMLElement | null)?.closest('input, textarea, button')) return
    event.preventDefault()
    if (event.repeat) return
    keyDown = true
    handlers.press()
  }
  const keyup = (event: KeyboardEvent) => {
    if (!JUMP_KEYS.has(event.key)) return
    keyDown = false
    if (pressed.size === 0) handlers.release()
  }

  surface.addEventListener('pointerdown', down)
  surface.addEventListener('pointerup', up)
  surface.addEventListener('pointercancel', up)
  window.addEventListener('keydown', keydown)
  window.addEventListener('keyup', keyup)
  return () => {
    surface.removeEventListener('pointerdown', down)
    surface.removeEventListener('pointerup', up)
    surface.removeEventListener('pointercancel', up)
    window.removeEventListener('keydown', keydown)
    window.removeEventListener('keyup', keyup)
  }
}
