import {
  CHAIN_KEY,
  CHAIN_LIES,
  CHAIN_LIVES,
  CHAIN_SLOTS,
  ChainRound,
  chainPoints,
  chainStage,
  type ChainItem,
  type ChainLock,
} from '@/lib/impulseGameChain'
import { CanvasGame, type HudColors } from '@/components/impulse/game/canvasGame'
import {
  clamp,
  easeOut,
  EMOJI_FONT,
  emojiBadge,
  makeLayer,
  roundRect,
  UI_FONT,
  type GameEngineEvents,
  type GameEngineOptions,
} from '@/components/impulse/game/canvasKit'

/*
 * «Ketten sprengen» auf der Leinwand – das Minispiel zu «Die Wahrheit
 * befreit dich».
 *
 * Neun Plätze, drei mal drei. Auf ihnen tauchen Notlügen auf, und um
 * jede legt sich eine Schnur, die sich zusammenzieht, dicker und dunkler
 * wird und am Ende als Kette zuschnappt (Regeln: `lib/impulseGameChain`).
 * Ein Tipp sprengt sie; die kleine Zahl daneben sagt, was sie gerade
 * wert ist. Am Rechner gehen die Ziffern 1 bis 9 (wie auf dem Telefon:
 * 1 oben links), der Ziffernblock (7 oben links) und die Buchstaben
 * Q W E / A S D / Y X C – dann stehen die Tasten auch in den Plätzen.
 */

interface Palette {
  skyTop: string
  skyBottom: string
  cell: string
  cellEdge: string
  dove: string
  bubble: string
  label: string
  labelText: string
  /** Schnur, Strick, Kette – die Farbe des Rings je Stufe … */
  cord: [string, string, string]
  /** … und die der kleinen Zahl daneben (+3, +2, +1), dunkel genug für weisse Schrift. */
  badge: [string, string, string]
  keyInner: string
  keyOuter: string
  keyRing: string
  hud: HudColors
  muted: string
  keyHint: string
}

const LIGHT: Palette = {
  skyTop: '#f5f3ff',
  skyBottom: '#ede9fe',
  cell: 'rgba(124, 58, 237, 0.07)',
  cellEdge: 'rgba(124, 58, 237, 0.16)',
  dove: 'rgba(124, 58, 237, 0.07)',
  bubble: '#ffffff',
  label: 'rgba(15, 23, 42, 0.82)',
  labelText: '#ffffff',
  cord: ['#d6b77a', '#9a5b1e', '#334155'],
  badge: ['#7c3aed', '#b45309', '#475569'],
  keyInner: '#fffbeb',
  keyOuter: '#fde68a',
  keyRing: '#f59e0b',
  hud: {
    text: '#0f172a',
    note: '#7c3aed',
    heart: '#ef4444',
    heartEmpty: 'rgba(15, 23, 42, 0.18)',
  },
  muted: 'rgba(15, 23, 42, 0.55)',
  keyHint: 'rgba(91, 33, 182, 0.55)',
}

const DARK: Palette = {
  skyTop: '#140b2e',
  skyBottom: '#2e1065',
  cell: 'rgba(196, 181, 253, 0.07)',
  cellEdge: 'rgba(196, 181, 253, 0.16)',
  dove: 'rgba(221, 214, 254, 0.07)',
  bubble: '#ffffff',
  label: 'rgba(2, 6, 23, 0.86)',
  labelText: '#ffffff',
  cord: ['#e7cf9c', '#c27c3a', '#94a3b8'],
  badge: ['#8b5cf6', '#c2410c', '#64748b'],
  keyInner: '#fffbeb',
  keyOuter: '#fcd34d',
  keyRing: '#fbbf24',
  hud: {
    text: '#f8fafc',
    note: '#c4b5fd',
    heart: '#f87171',
    heartEmpty: 'rgba(248, 250, 252, 0.2)',
  },
  muted: 'rgba(248, 250, 252, 0.6)',
  keyHint: 'rgba(221, 214, 254, 0.55)',
}

/** Die Tasten je Platz, wie sie im Feld stehen (Ziffern wie auf dem Telefon). */
const KEY_LABELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']
/** Wie lange der Hinweis mindestens steht. */
const HINT_S = 4

interface Sprite {
  canvas: HTMLCanvasElement
  w: number
  h: number
  centerY: number
}

interface Burst {
  sprite: Sprite
  x: number
  y: number
  /** 0 → 1 */
  t: number
  /** Zugeschnappt: Die Kette bleibt kurz stehen, statt zu zerspringen. */
  snapped: boolean
}

export class ChainGame extends CanvasGame {
  private readonly colors: Palette
  private round: ChainRound
  private broken = 0
  private bursts: Burst[] = []
  private missCell: { slot: number; life: number } | null = null
  private freed = 0
  /** Einmal mit der Tastatur gespielt: die Tasten in den Plätzen zeigen. */
  private showKeys = false

  /* Masse */
  private gridX = 0
  private gridY = 0
  /** Ein Platz – hochkant etwas höher als breit, damit das Feld den Bildschirm füllt. */
  private cellW = 0
  private cellH = 0
  private bubbleR = 0

  /* Vorgezeichnetes */
  private sprites = new Map<ChainItem, Sprite>()

  constructor(options: GameEngineOptions, events: GameEngineEvents) {
    super(options, events, CHAIN_LIVES)
    this.colors = options.dark ? DARK : LIGHT
    this.round = new ChainRound(this.random)
    this.boot()
  }

  /** Ein Finger auf der Leinwand (CSS-Pixel): der Platz darunter. Neben dem Feld zählt nichts. */
  tapAt(x: number, y: number): void {
    const col = Math.floor((x - this.gridX) / this.cellW)
    const row = Math.floor((y - this.gridY) / this.cellH)
    if (col < 0 || col > 2 || row < 0 || row > 2) return
    this.tapSlot(row * 3 + col)
  }

  /** Eine Taste: der Platz direkt. */
  tapSlot(slot: number, fromKeyboard = false): void {
    if (this.phase !== 'play' || this.isPaused) return
    if (fromKeyboard) this.showKeys = true
    for (const event of this.round.tap(slot)) {
      switch (event.kind) {
        case 'break':
          this.broken += 1
          this.shatter(event.lock, event.points)
          this.options.vibrate?.(8)
          break
        case 'key': {
          const at = this.center(event.lock.slot)
          this.freed = 1
          this.broken += event.broken.length
          this.burst(at.x, at.y, '#fbbf24', 14)
          for (const entry of event.broken) this.shatter(entry.lock, entry.points)
          this.float('Die Wahrheit befreit!', this.width / 2, this.gridY - 14, '#d97706', 18)
          if (event.healed) this.heal(this.round.lives, at.x, at.y - this.bubbleR)
          this.options.vibrate?.([10, 30, 10])
          break
        }
        case 'miss':
          this.missCell = { slot: event.slot, life: 1 }
          this.options.vibrate?.(20)
          break
      }
    }
  }

  protected get score(): number {
    return this.round.points
  }

  protected get toastY(): number {
    // Unter dem Feld, wo Platz ist – oben deckte der Hinweis die erste Reihe zu.
    const below = this.gridY + this.cellH * 3 + 10
    return below + 32 <= this.height - this.options.bottomInset - 4 ? below : this.hudBottom + 22
  }

  protected newRound(): void {
    this.round = new ChainRound(this.random)
    this.broken = 0
    this.bursts = []
    this.missCell = null
    this.freed = 0
  }

  protected update(dt: number): void {
    for (const event of this.round.step(dt)) {
      switch (event.kind) {
        case 'snap': {
          const sprite = this.sprites.get(event.lock.item)
          const at = this.center(event.lock.slot)
          if (sprite) this.bursts.push({ sprite, x: at.x, y: at.y, t: 0, snapped: true })
          this.hurt(`Zur Kette geworden: «${event.lock.item.label}»`, this.round.lives)
          break
        }
        case 'over':
          this.finish()
          break
      }
    }
  }

  protected tick(dt: number): void {
    for (let index = this.bursts.length - 1; index >= 0; index -= 1) {
      const burst = this.bursts[index]
      burst.t += dt / (burst.snapped ? 0.6 : 0.3)
      if (burst.t >= 1) this.bursts.splice(index, 1)
    }
    if (this.missCell) {
      this.missCell.life -= dt / 0.45
      if (this.missCell.life <= 0) this.missCell = null
    }
    this.freed = Math.max(0, this.freed - dt / 0.6)
  }

  protected teardown(): void {
    this.sprites.clear()
  }

  /* ---------------------------------------------------------------- */
  /* Masse und Vorzeichnen                                             */
  /* ---------------------------------------------------------------- */

  protected layout(): void {
    const top = this.hudBottom + 30
    const bottom = this.height - this.options.bottomInset - 56
    const size = Math.max(210, Math.min(this.width - 24, bottom - top, 520))
    this.cellW = size / 3
    // Grosse Ziele für den Daumen: Ist Platz, werden die Plätze bis zu 40 % höher.
    this.cellH = clamp((bottom - top) / 3, this.cellW, this.cellW * 1.4)
    this.gridX = (this.width - size) / 2
    this.gridY = top + Math.max(0, (bottom - top - this.cellH * 3) / 2)
    this.bubbleR = this.cellW * 0.27
    this.buildBackground()
    this.buildSprites()
  }

  private center(slot: number) {
    return {
      x: this.gridX + (slot % 3) * this.cellW + this.cellW / 2,
      y: this.gridY + Math.floor(slot / 3) * this.cellH + this.cellH / 2 - this.cellW * 0.04,
    }
  }

  private shatter(lock: ChainLock, points: number) {
    const sprite = this.sprites.get(lock.item)
    const at = this.center(lock.slot)
    if (sprite) this.bursts.push({ sprite, x: at.x, y: at.y, t: 0, snapped: false })
    this.burst(at.x, at.y, this.colors.badge[3 - points], points === 3 ? 10 : 7)
    this.float(`+${points}`, at.x, at.y - this.bubbleR * 1.2, this.colors.hud.note, 20 + points * 2)
    this.bump()
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
    for (let slot = 0; slot < CHAIN_SLOTS; slot += 1) {
      const x = this.gridX + (slot % 3) * this.cellW
      const y = this.gridY + Math.floor(slot / 3) * this.cellH
      const inset = this.cellW * 0.06
      roundRect(
        g,
        x + inset,
        y + inset,
        this.cellW - inset * 2,
        this.cellH - inset * 2,
        this.cellW * 0.2,
      )
      g.fillStyle = c.cell
      g.fill()
      g.lineWidth = 1.5
      g.strokeStyle = c.cellEdge
      g.stroke()
    }
    this.background = canvas
  }

  private buildSprites() {
    this.sprites.clear()
    const c = this.colors
    for (const item of [...CHAIN_LIES, CHAIN_KEY]) {
      const key = item === CHAIN_KEY
      const sprite = emojiBadge(this.dpr, this.bubbleR, item.emoji, item.label, {
        fill: (g, cx, cy, r) => {
          if (!key) return c.bubble
          const fill = g.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r)
          fill.addColorStop(0, c.keyInner)
          fill.addColorStop(1, c.keyOuter)
          return fill
        },
        ring: key ? c.keyRing : undefined,
        shadow: key
          ? 'rgba(245, 158, 11, 0.7)'
          : this.options.dark
            ? 'rgba(0, 0, 0, 0.55)'
            : 'rgba(76, 29, 149, 0.22)',
        labelFill: c.label,
        labelText: c.labelText,
      })
      if (sprite) this.sprites.set(item, sprite)
    }
  }

  /* ---------------------------------------------------------------- */
  /* Zeichnen                                                          */
  /* ---------------------------------------------------------------- */

  protected renderWorld(): void {
    const g = this.g
    const round = this.round
    const heat = this.phase === 'ready' ? 0 : clamp((round.time - 15) / 40, 0, 1)
    if (heat > 0) {
      g.globalAlpha = heat * (this.options.dark ? 0.16 : 0.12)
      g.fillStyle = '#f97316'
      g.fillRect(-10, 0, this.width + 20, this.height)
      g.globalAlpha = 1
    }
    if (this.freed > 0) {
      g.globalAlpha = this.freed * 0.3
      g.fillStyle = '#fde68a'
      g.fillRect(-10, 0, this.width + 20, this.height)
      g.globalAlpha = 1
    }
    this.drawMiss()
    if (this.showKeys) this.drawKeys()
    // Gelähmt nach einem Tipp ins Leere: Das Feld wird kurz blass.
    const locked = round.lockedUntil > round.time && this.phase === 'play'
    if (locked) g.globalAlpha = 0.55
    for (const lock of round.locks) this.drawLock(lock)
    g.globalAlpha = 1
    this.drawBursts()
    if (this.phase === 'play') {
      const fade = this.broken >= 3 ? clamp((HINT_S + 0.5 - round.time) / 0.5, 0, 1) : 1
      this.drawHint(
        'Tippe die Notlügen weg, solange sie dünne Schnüre sind',
        this.gridY - 12,
        this.colors.muted,
        fade,
      )
    }
  }

  protected renderHud(): void {
    const streak = this.round.streak
    this.drawHud(this.colors.hud, this.round.lives, streak >= 5 ? `${streak} gesprengt` : '')
  }

  private drawLock(lock: ChainLock) {
    const g = this.g
    const sprite = this.sprites.get(lock.item)
    if (!sprite) return
    const round = this.round
    const age = round.time - lock.spawn
    const k = clamp(age / lock.life, 0, 1)
    const at = this.center(lock.slot)
    const pop = easeOut(clamp(age / 0.14, 0, 1))
    const r = this.bubbleR
    let x = at.x
    if (!lock.key && k > 0.8 && !this.options.reducedMotion) {
      // Kurz vor dem Zuschnappen zittert sie.
      x += Math.sin(this.clock * 60) * 2 * ((k - 0.8) / 0.2)
    }
    if (lock.key) {
      // Der Schlüssel leuchtet – und verblasst gegen Ende.
      const pulse = 0.5 + 0.5 * Math.sin(this.clock * 10)
      g.globalAlpha = (k > 0.7 ? clamp((1 - k) / 0.3, 0.2, 1) : 1) * (0.35 + 0.25 * pulse)
      g.fillStyle = '#fde68a'
      g.beginPath()
      g.arc(x, at.y, r * (1.25 + 0.12 * pulse), 0, Math.PI * 2)
      g.fill()
      g.globalAlpha = k > 0.7 ? clamp((1 - k) / 0.3, 0.2, 1) : 1
    } else {
      // Die Schnur zieht sich zusammen, wird dicker und dunkler – und wird zur Kette.
      const stage = chainStage(age, lock.life)
      const ringR = r * (1.42 - 0.34 * k)
      const thick = 2 + 8 * k
      g.strokeStyle = this.colors.cord[stage]
      g.lineWidth = thick
      if (stage === 2) g.setLineDash([thick * 1.5, thick * 0.7])
      g.beginPath()
      g.arc(x, at.y, ringR, 0, Math.PI * 2)
      g.stroke()
      g.setLineDash([])
    }
    const scale = 0.6 + 0.4 * pop
    g.drawImage(
      sprite.canvas,
      x - (sprite.w * scale) / 2,
      at.y - sprite.centerY * scale,
      sprite.w * scale,
      sprite.h * scale,
    )
    if (!lock.key) {
      // Was sie jetzt wert ist: +3, +2, +1.
      const points = chainPoints(age, lock.life)
      const bx = x + r * 0.95
      const by = at.y - r * 0.95
      g.fillStyle = this.colors.badge[3 - points]
      g.beginPath()
      g.arc(bx, by, 11, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = '#ffffff'
      g.font = `900 12px ${UI_FONT}`
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText(`+${points}`, bx, by + 0.5)
    }
    g.globalAlpha = 1
  }

  private drawBursts() {
    const g = this.g
    for (const burst of this.bursts) {
      const { sprite } = burst
      if (burst.snapped) {
        // Zugeschnappt: Die Notlüge verschwindet hinter einer Kette.
        const k = clamp(burst.t, 0, 1)
        g.globalAlpha = clamp(1 - k, 0, 1)
        g.font = `${Math.round(this.bubbleR * (1.6 + 0.4 * k))}px ${EMOJI_FONT}`
        g.textAlign = 'center'
        g.textBaseline = 'middle'
        g.fillText('⛓️', burst.x, burst.y)
        continue
      }
      const scale = 1 + 0.5 * burst.t
      g.globalAlpha = clamp(1 - burst.t, 0, 1)
      g.drawImage(
        sprite.canvas,
        burst.x - (sprite.w * scale) / 2,
        burst.y - sprite.centerY * scale,
        sprite.w * scale,
        sprite.h * scale,
      )
    }
    g.globalAlpha = 1
  }

  private drawMiss() {
    if (!this.missCell) return
    const g = this.g
    const at = this.center(this.missCell.slot)
    const s = this.cellW * 0.12
    g.globalAlpha = clamp(this.missCell.life, 0, 1)
    g.strokeStyle = this.colors.muted
    g.lineWidth = 4
    g.lineCap = 'round'
    g.beginPath()
    g.moveTo(at.x - s, at.y - s)
    g.lineTo(at.x + s, at.y + s)
    g.moveTo(at.x + s, at.y - s)
    g.lineTo(at.x - s, at.y + s)
    g.stroke()
    g.fillStyle = this.colors.muted
    g.font = `800 12px ${UI_FONT}`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText('daneben', at.x, at.y + s + 14)
    g.globalAlpha = 1
  }

  private drawKeys() {
    const g = this.g
    g.fillStyle = this.colors.keyHint
    g.font = `800 12px ${UI_FONT}`
    g.textAlign = 'left'
    g.textBaseline = 'top'
    for (let slot = 0; slot < CHAIN_SLOTS; slot += 1) {
      const x = this.gridX + (slot % 3) * this.cellW + this.cellW * 0.12
      const y = this.gridY + Math.floor(slot / 3) * this.cellH + this.cellW * 0.1
      g.fillText(KEY_LABELS[slot], x, y)
    }
  }
}

/* ------------------------------------------------------------------ */
/* Die Steuerung                                                       */
/* ------------------------------------------------------------------ */

/**
 * Die Tasten je Platz – nach der Lage auf der Tastatur (`event.code`),
 * nicht nach dem Buchstaben: Auf der Schweizer Tastatur liegt unten links
 * ein Y, auf der amerikanischen ein Z, und gemeint ist dieselbe Taste.
 */
const KEY_SLOTS: Record<string, number> = {
  Digit1: 0,
  Digit2: 1,
  Digit3: 2,
  Digit4: 3,
  Digit5: 4,
  Digit6: 5,
  Digit7: 6,
  Digit8: 7,
  Digit9: 8,
  Numpad7: 0,
  Numpad8: 1,
  Numpad9: 2,
  Numpad4: 3,
  Numpad5: 4,
  Numpad6: 5,
  Numpad1: 6,
  Numpad2: 7,
  Numpad3: 8,
  KeyQ: 0,
  KeyW: 1,
  KeyE: 2,
  KeyA: 3,
  KeyS: 4,
  KeyD: 5,
  KeyZ: 6,
  KeyX: 7,
  KeyC: 8,
}

/**
 * Tippen und Tasten.
 *
 * Jeder Finger zählt beim Aufsetzen für sich – zwei Daumen spielen
 * gleichzeitig. Am Rechner gehen Ziffern, Ziffernblock und Q bis C
 * (`KEY_SLOTS`); mit der Maus klickt man einfach.
 *
 * Gibt das Abmelden zurück.
 */
export function attachChainControls(
  surface: HTMLElement,
  handlers: { point: (x: number, y: number) => void; slot: (slot: number) => void },
): () => void {
  const down = (event: PointerEvent) => {
    if ((event.target as HTMLElement | null)?.closest('button, a, input')) return
    const rect = surface.getBoundingClientRect()
    handlers.point(event.clientX - rect.left, event.clientY - rect.top)
  }
  const key = (event: KeyboardEvent) => {
    if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return
    if ((event.target as HTMLElement | null)?.closest('input, textarea')) return
    const slot = KEY_SLOTS[event.code]
    if (slot === undefined) return
    event.preventDefault()
    handlers.slot(slot)
  }
  surface.addEventListener('pointerdown', down)
  window.addEventListener('keydown', key)
  return () => {
    surface.removeEventListener('pointerdown', down)
    window.removeEventListener('keydown', key)
  }
}
