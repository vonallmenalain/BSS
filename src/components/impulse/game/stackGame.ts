import {
  STACK_LIVES,
  STACK_TIMES,
  StackRound,
  stackBookAt,
  stackCollection,
  stackStability,
  type StackCollectionId,
  type StackEvent,
  type StackPlaced,
} from '@/lib/impulseGameStack'
import { CanvasGame, type HudColors } from '@/components/impulse/game/canvasGame'
import {
  clamp,
  easeIn,
  easeOut,
  makeLayer,
  roundRect,
  UI_FONT,
  type GameEngineEvents,
  type GameEngineOptions,
} from '@/components/impulse/game/canvasKit'

/*
 * «Bücherturm» auf der Leinwand – das Minispiel zur Woche zum
 * Schriftstudium.
 *
 * Von vorn gesehen: ein Schreibtisch mit Lampe, darauf der Turm aus den
 * Büchern der Schriften, jedes mit seinem Namen auf dem Rücken und in
 * der Farbe seiner Sammlung (Regeln: `lib/impulseGameStack`). Über dem
 * Turm schwebt das nächste Buch hin und her, an einem Lesebändchen, das
 * mitschwingt; ein Schatten auf dem Turm zeigt, wo es gerade landen
 * würde. Ein Tipp irgendwo – oder Leertaste, Enter, Pfeil nach unten –
 * lässt es fallen.
 *
 * **Schief ist sichtbar.** Hat der Turm an einer Stelle kaum noch Halt,
 * wackelt alles darüber um die Kante, über die es kippen würde – je
 * weniger Halt, desto mehr. Kippt er, fallen die Bücher ab dieser Stelle
 * und drehen sich aus dem Bild.
 *
 * **Die Kamera** hält die Spitze des Turms auf gut sechs Zehnteln der
 * Höhe und zieht weich nach – auch zur Seite, wenn der Turm sich neigt.
 * Die Bibliothek dahinter zieht langsamer vorbei (Regale, Fenster), und
 * je höher der Turm, desto später wird es: Über dem Raum geht der Himmel
 * in die Nacht über, mit Sternen.
 *
 * Gemessen wird in Buchbreiten: Ein Buch ist gut zwei Fünftel so breit
 * wie der Bildschirm (höchstens 250 Punkte) – auf jedem Telefon dasselbe
 * Spiel, nur grösser oder kleiner.
 * Jedes Buch wird einmal vorgezeichnet und danach nur noch gestempelt.
 */

interface Palette {
  wallTop: string
  wallBottom: string
  skyTop: string
  skyBottom: string
  star: string
  shelf: string
  shelfDark: string
  spines: string[]
  window: string
  windowFrame: string
  moon: string
  deskTop: string
  deskFront: string
  deskEdge: string
  lampMetal: string
  lampShade: string
  lampGlow: string
  covers: Record<StackCollectionId, string>
  title: string
  band: string
  shadow: string
  ribbon: string
  tag: string
  tagText: string
  hud: HudColors
  muted: string
}

const COVERS: Record<StackCollectionId, string> = {
  bom: '#27427e',
  nt: '#7d2534',
  dc: '#21603e',
  pgp: '#7a5222',
  ot: '#2f3441',
}

const LIGHT: Palette = {
  wallTop: '#f3e6cf',
  wallBottom: '#ead6b4',
  skyTop: '#9fd0f5',
  skyBottom: '#fde7c2',
  star: 'rgba(255, 255, 255, 0.9)',
  shelf: '#b9824d',
  shelfDark: '#8a5a2f',
  spines: ['#c2410c', '#1d4ed8', '#15803d', '#a16207', '#7c3aed', '#be123c', '#0f766e', '#4338ca'],
  window: '#cfe9fb',
  windowFrame: '#9a6a3c',
  moon: '#fff4c2',
  deskTop: '#b5753f',
  deskFront: '#8a5328',
  deskEdge: '#5e3618',
  lampMetal: '#b08d3c',
  lampShade: '#2f6b4f',
  lampGlow: 'rgba(255, 214, 140, 0.35)',
  covers: COVERS,
  title: '#f6d98e',
  band: '#d6ad55',
  shadow: 'rgba(60, 35, 10, 0.28)',
  ribbon: '#c0262d',
  tag: 'rgba(15, 23, 42, 0.78)',
  tagText: '#ffffff',
  hud: {
    text: '#1c1209',
    note: '#9a3412',
    heart: '#ef4444',
    heartEmpty: 'rgba(28, 18, 9, 0.18)',
  },
  muted: 'rgba(28, 18, 9, 0.6)',
}

const DARK: Palette = {
  wallTop: '#1d1730',
  wallBottom: '#2b2034',
  skyTop: '#070b22',
  skyBottom: '#1c1d48',
  star: 'rgba(255, 248, 225, 0.95)',
  shelf: '#4a3322',
  shelfDark: '#2e1f14',
  spines: ['#9a3412', '#1e3a8a', '#166534', '#854d0e', '#5b21b6', '#9f1239', '#115e59', '#3730a3'],
  window: '#141a3e',
  windowFrame: '#4a3322',
  moon: '#fff1c4',
  deskTop: '#6b4426',
  deskFront: '#4a2c16',
  deskEdge: '#2a170a',
  lampMetal: '#c7a24a',
  lampShade: '#2f6b4f',
  lampGlow: 'rgba(255, 200, 120, 0.3)',
  covers: COVERS,
  title: '#f6d98e',
  band: '#d6ad55',
  shadow: 'rgba(0, 0, 0, 0.4)',
  ribbon: '#e0383f',
  tag: 'rgba(2, 6, 23, 0.82)',
  tagText: '#ffffff',
  hud: {
    text: '#fdf6e3',
    note: '#fcd34d',
    heart: '#f87171',
    heartEmpty: 'rgba(253, 246, 227, 0.2)',
  },
  muted: 'rgba(253, 246, 227, 0.62)',
}

/** So hoch über der Turmspitze schwebt das nächste Buch (in Buchbreiten). */
const HOVER_GAP = 0.78
/** So hoch ist der Raum mit den Regalen – darüber beginnt der Himmel. */
const ROOM_H = 4.5
/** So viel langsamer als der Turm zieht der Raum vorbei. */
const ROOM_PARALLAX = 0.6
/** Schwerkraft für fallende Bücher, in Buchbreiten je Sekunde². */
const FALL_G = 11
/** Ab so wenig Halt wackelt der Turm. */
const WOBBLE_FROM = 0.4

interface Sprite {
  canvas: HTMLCanvasElement
  w: number
  h: number
}

/** Ein Buch, das fällt – daneben, abgerutscht oder mit dem Turm gekippt. */
interface Body {
  index: number
  x: number
  /** Unterkante, in Buchbreiten über dem Tisch. */
  y: number
  vx: number
  vy: number
  angle: number
  spin: number
}

export class StackGame extends CanvasGame {
  private readonly colors: Palette
  private round: StackRound

  /* Masse */
  private unit = 200
  private refY = 0
  /* Kamera: welche Höhe auf `refY` liegt und welche Mitte in der Bildmitte. */
  private camY = 0
  private camX = 0

  /* Wirkungen */
  private bodies: Body[] = []
  private landed: { index: number; t: number; perfect: boolean } | null = null
  private banner: { text: string; life: number } | null = null
  private entry = 1

  /* Vorgezeichnetes */
  private books = new Map<number, Sprite>()
  private shelfTile: HTMLCanvasElement | null = null
  private starTile: HTMLCanvasElement | null = null
  private room: Sprite | null = null
  private sky: HTMLCanvasElement | null = null

  constructor(options: GameEngineOptions, events: GameEngineEvents) {
    super(options, events, STACK_LIVES)
    this.colors = options.dark ? DARK : LIGHT
    this.round = new StackRound(this.random)
    this.boot()
  }

  /** Ein Tipp: Das schwebende Buch fällt. */
  press(): void {
    if (this.phase !== 'play' || this.isPaused) return
    for (const event of this.round.tap()) {
      if (event.kind === 'drop') this.options.vibrate?.(6)
    }
  }

  protected get score(): number {
    return this.round.points
  }

  protected newRound(): void {
    this.round = new StackRound(this.random)
    this.bodies = []
    this.landed = null
    this.banner = null
    this.entry = 0
    this.camY = this.lowestCam()
    this.camX = 0
  }

  /** Die Kamera, wenn noch nichts liegt: der Tisch unten im Bild. */
  private lowestCam(): number {
    const deskY = this.height - this.options.bottomInset - Math.min(150, this.height * 0.16)
    return (deskY - this.refY) / this.unit
  }

  protected update(dt: number): void {
    for (const event of this.round.step(dt)) this.handle(event)
  }

  protected tick(dt: number): void {
    // Die Kamera folgt der Spitze – nach oben zügig, zur Seite gemächlich.
    // Solange der Turm niedrig ist, steht der Tisch unten im Bild statt auf gut sechs Zehnteln.
    const deskY = this.height - this.options.bottomInset - Math.min(150, this.height * 0.16)
    const top = Math.max(this.towerTop(), (deskY - this.refY) / this.unit)
    const kY = 1 - Math.exp(-dt * (this.options.reducedMotion ? 14 : 6))
    const kX = 1 - Math.exp(-dt * 3)
    this.camY += (top - this.camY) * kY
    this.camX += (this.round.topX - this.camX) * kX
    for (let index = this.bodies.length - 1; index >= 0; index -= 1) {
      const body = this.bodies[index]
      body.vy -= FALL_G * dt
      body.x += body.vx * dt
      body.y += body.vy * dt
      body.angle += body.spin * dt
      if (this.sy(body.y) > this.height + this.unit) this.bodies.splice(index, 1)
    }
    if (this.banner) {
      this.banner.life -= dt / 2
      if (this.banner.life <= 0) this.banner = null
    }
    this.entry = Math.min(1, this.entry + dt / 0.16)
  }

  protected teardown(): void {
    this.books.clear()
    this.shelfTile = null
    this.starTile = null
    this.room = null
    this.sky = null
  }

  /* ---------------------------------------------------------------- */
  /* Was geschieht                                                     */
  /* ---------------------------------------------------------------- */

  private handle(event: StackEvent) {
    const c = this.colors
    switch (event.kind) {
      case 'land': {
        const { placed, points, chain } = event
        this.landed = { index: placed.index, t: this.clock, perfect: placed.perfect }
        const at = this.screenOfBook(placed)
        if (placed.perfect) {
          this.burst(at.x, at.y, '#fbbf24', 12)
          this.float(
            chain >= 2 ? `Genau! ${chain}×` : 'Genau!',
            at.x,
            at.y - this.unit * 0.35,
            '#d97706',
            20,
          )
          this.options.vibrate?.([8, 20, 8])
        } else {
          this.options.vibrate?.(8)
        }
        this.float(
          `+${points}`,
          at.x + this.unit * 0.42,
          at.y - this.unit * 0.12,
          c.hud.note,
          18 + points * 2,
        )
        this.bump()
        break
      }
      case 'complete': {
        this.banner = { text: `${event.collection.label} komplett!`, life: 1 }
        const x = this.width / 2
        const y = this.refY - this.unit * 0.4
        this.burst(x - this.unit * 0.4, y, '#fbbf24', 16)
        this.burst(x + this.unit * 0.4, y, '#f472b6', 16)
        this.float(`+${event.points}`, x, y - this.unit * 0.3, '#d97706', 26)
        if (event.healed) this.heal(this.round.lives, x, y - this.unit * 0.55)
        this.options.vibrate?.([12, 30, 12, 30, 12])
        break
      }
      case 'miss': {
        const top = this.towerTop()
        const side = event.x >= this.round.topX ? 1 : -1
        this.bodies.push({
          index: this.round.next,
          x: event.x,
          y: top,
          vx: event.slid ? side * 1.1 : side * 0.25,
          vy: event.slid ? 0.4 : 0,
          angle: 0,
          spin: side * (event.slid ? 2.6 : 0.9),
        })
        this.hurt(
          event.slid
            ? `Zu weit am Rand – «${event.book.label}» rutscht ab`
            : `Daneben – «${event.book.label}» nochmals`,
          this.round.lives,
        )
        break
      }
      case 'topple': {
        let bottom = this.heightBelow(event.level)
        event.fallen.forEach((placed, order) => {
          this.bodies.push({
            index: placed.index,
            x: placed.x,
            y: bottom,
            vx: event.side * (0.5 + 0.12 * order),
            vy: 0.3 + 0.05 * order,
            angle: 0,
            spin: event.side * (1.2 + 0.25 * order),
          })
          bottom += placed.book.thickness
        })
        const n = event.fallen.length
        this.hurt(`Zu schief – ${n} ${n === 1 ? 'Buch fällt' : 'Bücher fallen'}`, this.round.lives)
        break
      }
      case 'next':
        this.entry = 0
        break
      case 'over':
        this.finish()
        break
      case 'drop':
        break
    }
  }

  /* ---------------------------------------------------------------- */
  /* Masse und Umrechnung                                              */
  /* ---------------------------------------------------------------- */

  protected layout(): void {
    const playTop = this.hudBottom
    const playH = this.height - playTop - this.options.bottomInset
    // So breit, dass das Buch auch ganz aussen am Schwung noch fast im Bild ist.
    this.unit = Math.round(clamp(Math.min(this.width * 0.42, playH * 0.4), 120, 250))
    this.refY = playTop + playH * 0.62
    this.books.clear()
    if (this.phase === 'ready') this.camY = this.lowestCam()
    this.buildBackground()
    this.buildShelfTile()
    this.buildStarTile()
    this.buildRoom()
  }

  /** Bildschirm-x zu einer Mitte in Buchbreiten. */
  private sx(x: number): number {
    return this.width / 2 + (x - this.camX) * this.unit
  }

  /** Bildschirm-y zu einer Höhe in Buchbreiten über dem Tisch. */
  private sy(y: number): number {
    return this.refY - (y - this.camY) * this.unit
  }

  /** Höhe der Turmspitze über dem Tisch. */
  private towerTop(): number {
    return this.heightBelow(this.round.tower.length)
  }

  /** Höhe der Unterkante des Buches an einer Stelle im Turm. */
  private heightBelow(level: number): number {
    let height = 0
    for (let index = 0; index < level && index < this.round.tower.length; index += 1) {
      height += this.round.tower[index].book.thickness
    }
    return height
  }

  private screenOfBook(placed: StackPlaced) {
    const level = this.round.tower.indexOf(placed)
    const bottom = this.heightBelow(level < 0 ? this.round.tower.length : level)
    return { x: this.sx(placed.x), y: this.sy(bottom + placed.book.thickness / 2) }
  }

  /* ---------------------------------------------------------------- */
  /* Vorzeichnen                                                       */
  /* ---------------------------------------------------------------- */

  /** Der Himmel über dem Raum – hinter allem; der Raum davor blendet aus, je höher der Turm wird. */
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
    // Nicht als `background`: Solange der Raum alles deckt, wird der Himmel gar nicht gestempelt.
    this.sky = canvas
  }

  /**
   * Der Raum in einem Stück: Wand, Regale, Fenster und der Schein der
   * Lampe, so hoch, wie die Kamera im Raum steigen kann. Je Bild wird er
   * nur noch einmal gestempelt – langsamer verschoben als der Turm.
   */
  private buildRoom() {
    this.room = null
    if (!this.shelfTile) return
    const low = this.lowestCam()
    const high = ROOM_H + 2
    const rise = Math.max(0, (high - low) * this.unit * ROOM_PARALLAX)
    const w = this.width
    const h = Math.ceil(this.height + rise)
    const layer = makeLayer(w, h, this.dpr)
    if (!layer) return
    const { canvas, g } = layer
    const c = this.colors
    const u = this.unit
    const wall = g.createLinearGradient(0, 0, 0, h)
    wall.addColorStop(0, c.wallTop)
    wall.addColorStop(1, c.wallBottom)
    g.fillStyle = wall
    g.fillRect(0, 0, w, h)
    // Wo der Tisch steht, wenn die Kamera ganz unten ist – im Raum gemessen.
    const desk = this.refY + low * u + rise
    // Regale links und rechts
    const tw = this.shelfTile.width / this.dpr
    const th = this.shelfTile.height / this.dpr
    g.globalAlpha = this.options.dark ? 0.5 : 0.6
    for (let y = desk - th; y > -th; y -= th) {
      g.drawImage(this.shelfTile, 0, y, tw, th)
      g.drawImage(this.shelfTile, w - tw, y, tw, th)
    }
    g.globalAlpha = 1
    // Ein Fenster mit dem Mond
    const ww = u * 1.1
    const wh = u * 1.25
    const wx = w / 2 - ww / 2 - u * 0.05
    const wy = desk - u * 2.3 - wh
    g.fillStyle = c.windowFrame
    roundRect(g, wx - 8, wy - 8, ww + 16, wh + 16, 10)
    g.fill()
    g.fillStyle = c.window
    roundRect(g, wx, wy, ww, wh, 6)
    g.fill()
    g.fillStyle = c.moon
    g.beginPath()
    g.arc(wx + ww * 0.68, wy + wh * 0.3, u * 0.12, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = c.windowFrame
    g.fillRect(wx + ww / 2 - 3, wy, 6, wh)
    g.fillRect(wx, wy + wh / 2 - 3, ww, 6)
    // Der warme Schein der Lampe
    const lx = w / 2 - u * 0.8
    const glow = g.createRadialGradient(lx, desk - u * 0.6, 4, lx, desk - u * 0.3, u * 1.6)
    glow.addColorStop(0, c.lampGlow)
    glow.addColorStop(1, 'rgba(255, 200, 120, 0)')
    g.fillStyle = glow
    g.fillRect(lx - u * 1.7, desk - u * 2.2, u * 3.4, u * 2.2)
    this.room = { canvas, w, h }
  }

  /** Ein Regal mit bunten Buchrücken – links und rechts an der Wand, wiederholt nach oben. */
  private buildShelfTile() {
    const w = Math.round(clamp(this.width * 0.15, 48, 120))
    const h = Math.round(this.unit * 1.6)
    const layer = makeLayer(w, h, this.dpr)
    if (!layer) return
    const { canvas, g } = layer
    const c = this.colors
    g.fillStyle = c.shelfDark
    g.fillRect(0, 0, w, h)
    const board = Math.max(5, Math.round(h * 0.06))
    const rows = 2
    const rowH = h / rows
    let seed = 7
    const rand = () => {
      seed = (seed * 16807) % 2147483647
      return seed / 2147483647
    }
    for (let row = 0; row < rows; row += 1) {
      const baseY = (row + 1) * rowH - board
      let x = 4
      while (x < w - 6) {
        const bw = 6 + Math.round(rand() * 9)
        const bh = rowH * (0.55 + rand() * 0.33)
        g.fillStyle = c.spines[Math.floor(rand() * c.spines.length)]
        g.globalAlpha = 0.75
        g.fillRect(x, baseY - bh, bw, bh)
        g.globalAlpha = 0.35
        g.fillStyle = c.band
        g.fillRect(x, baseY - bh + bh * 0.14, bw, 1.5)
        g.fillRect(x, baseY - bh * 0.2, bw, 1.5)
        g.globalAlpha = 1
        x += bw + 1 + (rand() < 0.12 ? 6 : 0)
      }
      g.fillStyle = c.shelf
      g.fillRect(0, baseY, w, board)
    }
    this.shelfTile = canvas
  }

  /** Sterne auf Vorrat – gestempelt, sobald der Turm über den Raum wächst. */
  private buildStarTile() {
    const w = this.width
    const h = Math.round(this.height * 0.9)
    const layer = makeLayer(w, h, this.dpr)
    if (!layer) return
    const { canvas, g } = layer
    g.fillStyle = this.colors.star
    let seed = 11
    const rand = () => {
      seed = (seed * 16807) % 2147483647
      return seed / 2147483647
    }
    const count = Math.round((w * h) / 5200)
    for (let index = 0; index < count; index += 1) {
      g.globalAlpha = 0.35 + rand() * 0.65
      g.beginPath()
      g.arc(rand() * w, rand() * h, 0.6 + rand() * 1.4, 0, Math.PI * 2)
      g.fill()
    }
    g.globalAlpha = 1
    this.starTile = canvas
  }

  /** Ein Buchrücken: Farbe der Sammlung, zwei Goldbänder, der Name in der Mitte. */
  private bookSprite(index: number): Sprite | null {
    const cached = this.books.get(index)
    if (cached) return cached
    const book = stackBookAt(index)
    const w = this.unit
    const h = Math.max(14, Math.round(book.thickness * this.unit))
    const layer = makeLayer(w, h, this.dpr)
    if (!layer) return null
    const { canvas, g } = layer
    const c = this.colors
    const base = c.covers[book.collection]
    // Jedes Buch einen Hauch anders, damit zwei Nachbarn nicht verschmelzen.
    const shade = ((index * 37) % 5) / 5 - 0.4
    roundRect(g, 0.5, 0.5, w - 1, h - 1, Math.min(6, h * 0.25))
    const body = g.createLinearGradient(0, 0, 0, h)
    body.addColorStop(0, tint(base, 0.18 + shade * 0.12))
    body.addColorStop(0.45, tint(base, shade * 0.12))
    body.addColorStop(1, tint(base, -0.28 + shade * 0.12))
    g.fillStyle = body
    g.fill()
    g.lineWidth = 1
    g.strokeStyle = 'rgba(0, 0, 0, 0.35)'
    g.stroke()
    // Bünde und Goldbänder an beiden Enden
    g.fillStyle = c.band
    for (const x of [w * 0.07, w * 0.93]) {
      g.fillRect(x - 1.5, 2, 3, h - 4)
    }
    g.globalAlpha = 0.55
    for (const x of [w * 0.11, w * 0.89]) g.fillRect(x - 0.75, 3, 1.5, h - 6)
    g.globalAlpha = 1
    // Der Name
    const maxW = w * 0.72
    let size = Math.round(clamp(h * 0.5, 9, 17))
    g.font = `800 ${size}px ${UI_FONT}`
    while (size > 8 && g.measureText(book.label).width > maxW) {
      size -= 1
      g.font = `800 ${size}px ${UI_FONT}`
    }
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillStyle = 'rgba(0, 0, 0, 0.35)'
    g.fillText(book.label, w / 2, h / 2 + 1.5, maxW)
    g.fillStyle = c.title
    g.fillText(book.label, w / 2, h / 2 + 0.5, maxW)
    // Ein Glanz oben
    g.globalAlpha = 0.18
    g.fillStyle = '#ffffff'
    g.fillRect(4, 2, w - 8, Math.max(1, h * 0.12))
    g.globalAlpha = 1
    const sprite = { canvas, w, h }
    this.books.set(index, sprite)
    return sprite
  }

  /* ---------------------------------------------------------------- */
  /* Zeichnen                                                          */
  /* ---------------------------------------------------------------- */

  protected renderWorld(): void {
    this.drawSky()
    this.drawRoom()
    this.drawDesk()
    this.drawBrackets()
    this.drawTower()
    this.drawHover()
    this.drawBodies()
    if (this.phase === 'play' && this.round.placed < 2) {
      const fade = clamp((6 - this.round.time) / 0.6, 0, 1)
      this.drawHint(
        'Tippe, wenn das Buch genau über dem Turm schwebt',
        this.hudBottom + 16,
        this.colors.muted,
        fade,
      )
    }
  }

  protected renderHud(): void {
    const round = this.round
    let note = ''
    if (round.chain >= 2) note = `${round.chain}× genau am Stück`
    else if (this.phase !== 'ready') {
      const book = round.book
      const collection = stackCollection(book.collection)
      const have = round.tower.filter((placed) => placed.book.collection === book.collection).length
      note = `${have}/${collection.books.length} ${collection.label}`
    }
    this.drawHud(this.colors.hud, round.lives, note)
    this.drawBanner()
  }

  /** Je höher, desto später: Über dem Raum kommt der Himmel, in der Nacht mit Sternen. */
  private drawSky() {
    const k = clamp((this.camY - ROOM_H + 1) / 3, 0, 1)
    if (k <= 0) return
    const g = this.g
    if (this.sky) g.drawImage(this.sky, 0, 0, this.width, this.height)
    if (!this.starTile || !this.options.dark) return
    const th = this.starTile.height / this.dpr
    const offset = (((this.camY * this.unit * 0.25) % th) + th) % th
    g.globalAlpha = k
    for (let y = offset - th; y < this.height; y += th)
      g.drawImage(this.starTile, 0, y, this.width, th)
    g.globalAlpha = 1
  }

  /** Der Raum zieht langsamer vorbei als der Turm – und blendet aus, sobald der Turm über ihn hinauswächst. */
  private drawRoom() {
    if (!this.room) return
    const fade = clamp(1 - (this.camY - ROOM_H + 1) / 3, 0, 1)
    if (fade <= 0) return
    const g = this.g
    const low = this.lowestCam()
    const shift = Math.max(0, this.camY - low) * this.unit * ROOM_PARALLAX
    const y = Math.min(0, this.height - this.room.h + shift)
    g.globalAlpha = fade
    g.drawImage(this.room.canvas, 0, y, this.room.w, this.room.h)
    g.globalAlpha = 1
  }

  private drawDesk() {
    const g = this.g
    const c = this.colors
    const top = this.sy(0)
    if (top > this.height + 10) return
    const front = this.unit * 0.24
    g.fillStyle = c.deskTop
    g.fillRect(-10, top, this.width + 20, front * 0.35)
    g.fillStyle = c.deskFront
    g.fillRect(-10, top + front * 0.35, this.width + 20, this.height)
    g.fillStyle = c.deskEdge
    g.fillRect(-10, top + front * 0.35, this.width + 20, 2)
    // Schubladenknäufe
    g.fillStyle = c.deskEdge
    for (const x of [this.sx(-0.9), this.sx(0.9)]) {
      roundRect(g, x - this.unit * 0.12, top + front * 0.75, this.unit * 0.24, 6, 3)
      g.fill()
    }
    // Die Lampe: Fuss, Arm, ein Schirm, der aufs Holz leuchtet
    const lx = this.sx(-1.05)
    const u = this.unit
    g.fillStyle = c.lampMetal
    g.beginPath()
    g.ellipse(lx, top - u * 0.02, u * 0.16, u * 0.04, 0, 0, Math.PI * 2)
    g.fill()
    g.lineWidth = Math.max(3, u * 0.028)
    g.strokeStyle = c.lampMetal
    g.lineCap = 'round'
    g.lineJoin = 'round'
    g.beginPath()
    g.moveTo(lx, top - u * 0.04)
    g.lineTo(lx - u * 0.06, top - u * 0.5)
    g.lineTo(lx + u * 0.2, top - u * 0.78)
    g.stroke()
    g.fillStyle = c.lampMetal
    g.beginPath()
    g.arc(lx - u * 0.06, top - u * 0.5, u * 0.03, 0, Math.PI * 2)
    g.fill()
    g.save()
    g.translate(lx + u * 0.22, top - u * 0.76)
    g.rotate(0.5)
    g.fillStyle = c.lampShade
    g.beginPath()
    g.moveTo(-u * 0.07, -u * 0.05)
    g.lineTo(u * 0.07, -u * 0.05)
    g.lineTo(u * 0.16, u * 0.12)
    g.lineTo(-u * 0.16, u * 0.12)
    g.closePath()
    g.fill()
    g.fillStyle = 'rgba(255, 240, 200, 0.9)'
    g.fillRect(-u * 0.15, u * 0.11, u * 0.3, u * 0.02)
    g.restore()
  }

  private drawTower() {
    const g = this.g
    const tower = this.round.tower
    if (tower.length === 0) return
    const stability = stackStability(tower)
    let wobble = 0
    if (tower.length > 1 && stability.margin < WOBBLE_FROM && this.phase === 'play') {
      const k = (WOBBLE_FROM - stability.margin) / WOBBLE_FROM
      wobble = this.options.reducedMotion
        ? stability.side * 0.012 * k
        : stability.side * 0.035 * k * (0.55 + 0.45 * Math.sin(this.clock * 15))
    }
    const pivotLevel = stability.level
    const support = pivotLevel === 0 ? null : tower[pivotLevel - 1]
    const pivotX = this.sx((support?.x ?? 0) + stability.side * (support ? 0.5 : 1))
    const pivotY = this.sy(this.heightBelow(pivotLevel))
    let bottom = 0
    tower.forEach((placed, level) => {
      const h = placed.book.thickness
      const y = this.sy(bottom + h)
      bottom += h
      if (y > this.height + 4 || y + h * this.unit < -4) return
      const tilt = wobble !== 0 && level >= pivotLevel
      if (tilt) {
        g.save()
        g.translate(pivotX, pivotY)
        g.rotate(wobble)
        g.translate(-pivotX, -pivotY)
      }
      this.drawBook(placed.index, this.sx(placed.x), y)
      if (tilt) g.restore()
    })
  }

  /** Ein Buch mit seiner Oberkante auf `topY` – nach dem Aufsetzen kurz gestaucht, nach einem genauen Treffer golden umrandet. */
  private drawBook(index: number, centerX: number, topY: number, alpha = 1) {
    const sprite = this.bookSprite(index)
    if (!sprite) return
    const g = this.g
    let squash = 1
    let glow = 0
    if (this.landed?.index === index) {
      const age = this.clock - this.landed.t
      squash = 1 - 0.1 * Math.max(0, 1 - age / 0.12)
      glow = this.landed.perfect ? Math.max(0, 1 - age / 0.35) : 0
    }
    const h = sprite.h * squash
    const y = topY + (sprite.h - h)
    g.globalAlpha = alpha
    if (glow > 0) {
      g.fillStyle = `rgba(251, 191, 36, ${0.55 * glow})`
      roundRect(g, centerX - sprite.w / 2 - 5, y - 5, sprite.w + 10, h + 10, 9)
      g.fill()
    }
    g.drawImage(sprite.canvas, centerX - sprite.w / 2, y, sprite.w, h)
    g.globalAlpha = 1
  }

  /**
   * Links neben dem Turm eine Klammer je Sammlung, mit ihrem Namen der
   * Länge nach – so sieht man, wo das Buch Mormon aufhört und das Neue
   * Testament beginnt.
   */
  private drawBrackets() {
    const tower = this.round.tower
    if (tower.length === 0) return
    const g = this.g
    let start = 0
    let bottom = 0
    let segmentBottom = 0
    let minX = tower[0].x
    for (let level = 0; level <= tower.length; level += 1) {
      const placed = tower[level]
      const ends = !placed || placed.book.collection !== tower[start].book.collection
      if (ends) {
        this.drawBracket(tower[start].book.collection, segmentBottom, bottom, minX)
        if (!placed) break
        start = level
        segmentBottom = bottom
        minX = placed.x
      }
      minX = Math.min(minX, placed.x)
      bottom += placed.book.thickness
    }
    g.globalAlpha = 1
  }

  private drawBracket(collection: StackCollectionId, from: number, to: number, minX: number) {
    const g = this.g
    const x = Math.max(8, this.sx(minX) - this.unit / 2 - 10)
    const y0 = this.sy(from) - 3
    const y1 = this.sy(to) + 3
    if (y0 < 0 || y1 > this.height) {
      if (y1 > this.height && y0 > this.height) return
      if (y0 < 0 && y1 < 0) return
    }
    const color = tint(this.colors.covers[collection], this.options.dark ? 0.45 : 0.05)
    g.globalAlpha = 0.9
    g.strokeStyle = color
    g.lineWidth = 2
    g.beginPath()
    g.moveTo(x + 5, y0)
    g.lineTo(x, y0)
    g.lineTo(x, y1)
    g.lineTo(x + 5, y1)
    g.stroke()
    const label = stackCollection(collection).label.toUpperCase()
    g.font = `800 10px ${UI_FONT}`
    const textW = g.measureText(label).width
    // Mitten in den sichtbaren Teil der Klammer – passt der Name nicht hinein, bleibt sie ohne.
    const top = Math.max(y1, this.hudBottom + 4)
    const low = Math.min(y0, this.height - this.options.bottomInset - 4)
    if (low - top < textW + 12) return
    g.save()
    g.translate(x - 7, (top + low) / 2)
    g.rotate(-Math.PI / 2)
    g.fillStyle = color
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(label, 0, 0)
    g.restore()
  }

  /** Das schwebende oder fallende Buch, am Lesebändchen – und sein Schatten auf dem Turm. */
  private drawHover() {
    const round = this.round
    if (this.phase !== 'play' && this.phase !== 'ready') return
    if (round.state === 'wait') return
    const g = this.g
    const book = round.book
    const sprite = this.bookSprite(round.next)
    if (!sprite) return
    const top = this.towerTop()
    const hoverBottom = top + HOVER_GAP
    let x = round.hoverX()
    let bottom = hoverBottom
    let swingTilt = 0
    if (round.state === 'drop' && round.drop) {
      x = round.drop.x
      const k = clamp((round.time - round.drop.start) / STACK_TIMES.drop, 0, 1)
      bottom = hoverBottom - HOVER_GAP * easeIn(k)
    } else {
      // Es neigt sich ein wenig in die Richtung, in die es schwebt.
      const ahead = round.hoverX(round.time + 0.03)
      swingTilt = clamp((ahead - x) * 0.7, -0.06, 0.06)
    }
    // Schatten auf der Spitze, wo es gerade landen würde
    const shadowY = this.sy(top)
    const near = 1 - clamp((bottom - top) / HOVER_GAP, 0, 1)
    g.fillStyle = this.colors.shadow
    g.globalAlpha = 0.5 + 0.5 * near
    g.beginPath()
    g.ellipse(
      this.sx(x),
      shadowY + 1,
      this.unit * 0.46,
      Math.max(2, this.unit * 0.03),
      0,
      0,
      Math.PI * 2,
    )
    g.fill()
    g.globalAlpha = 1
    const cx = this.sx(x)
    const topY = this.sy(bottom + book.thickness)
    const pop = easeOut(this.entry)
    g.save()
    g.translate(cx, topY + sprite.h / 2)
    g.rotate(swingTilt)
    g.scale(0.85 + 0.15 * pop, 0.85 + 0.15 * pop)
    g.globalAlpha = 0.4 + 0.6 * pop
    // Das Lesebändchen hängt unten heraus und schwingt nach
    if (round.state === 'swing') {
      g.strokeStyle = this.colors.ribbon
      g.lineWidth = 3
      g.lineCap = 'round'
      g.beginPath()
      const rx = sprite.w * 0.28
      g.moveTo(rx, sprite.h / 2 - 1)
      g.quadraticCurveTo(
        rx - swingTilt * 60,
        sprite.h / 2 + 10,
        rx - swingTilt * 110,
        sprite.h / 2 + 18,
      )
      g.stroke()
    }
    g.drawImage(sprite.canvas, -sprite.w / 2, -sprite.h / 2, sprite.w, sprite.h)
    g.restore()
    g.globalAlpha = 1
  }

  private drawBodies() {
    const g = this.g
    for (const body of this.bodies) {
      const sprite = this.bookSprite(body.index)
      if (!sprite) continue
      const thickness = stackBookAt(body.index).thickness
      const cx = this.sx(body.x)
      const cy = this.sy(body.y + thickness / 2)
      g.save()
      g.translate(cx, cy)
      g.rotate(-body.angle)
      g.drawImage(sprite.canvas, -sprite.w / 2, -sprite.h / 2, sprite.w, sprite.h)
      g.restore()
    }
  }

  private drawBanner() {
    if (!this.banner) return
    const g = this.g
    const k = this.banner.life
    const appear = easeOut(clamp((1 - k) / 0.12, 0, 1))
    g.globalAlpha = clamp(k * 4, 0, 1)
    g.font = `900 20px ${UI_FONT}`
    const textW = g.measureText(this.banner.text).width
    const w = Math.min(this.width - 24, textW + 36)
    const h = 40
    const x = this.width / 2 - w / 2
    const y = this.hudBottom + 44 - (1 - appear) * 16
    g.fillStyle = this.options.dark ? 'rgba(120, 53, 15, 0.92)' : 'rgba(254, 243, 199, 0.97)'
    roundRect(g, x, y, w, h, h / 2)
    g.fill()
    g.strokeStyle = '#f59e0b'
    g.lineWidth = 2
    g.stroke()
    g.fillStyle = this.options.dark ? '#fde68a' : '#92400e'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(this.banner.text, this.width / 2, y + h / 2 + 0.5, this.width - 40)
    g.globalAlpha = 1
  }
}

/** Eine Farbe heller (k > 0) oder dunkler (k < 0). */
function tint(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16)
  const channel = (shift: number) => {
    const value = (n >> shift) & 255
    const mixed = k >= 0 ? value + (255 - value) * k : value * (1 + k)
    return Math.round(clamp(mixed, 0, 255))
  }
  return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`
}

/* ------------------------------------------------------------------ */
/* Die Steuerung                                                       */
/* ------------------------------------------------------------------ */

const DROP_KEYS = new Set([' ', 'Enter', 'ArrowDown', 'Spacebar'])

/**
 * Tippen und Tasten: Ein Finger irgendwo auf der Fläche lässt das Buch
 * fallen, am Rechner die Leertaste, Enter oder Pfeil nach unten.
 * Gibt das Abmelden zurück.
 */
export function attachStackControls(surface: HTMLElement, press: () => void): () => void {
  const down = (event: PointerEvent) => {
    if ((event.target as HTMLElement | null)?.closest('button, a, input')) return
    press()
  }
  const key = (event: KeyboardEvent) => {
    if (!DROP_KEYS.has(event.key) || event.altKey || event.ctrlKey || event.metaKey) return
    if ((event.target as HTMLElement | null)?.closest('input, textarea, button')) return
    event.preventDefault()
    if (event.repeat) return
    press()
  }
  surface.addEventListener('pointerdown', down)
  window.addEventListener('keydown', key)
  return () => {
    surface.removeEventListener('pointerdown', down)
    window.removeEventListener('keydown', key)
  }
}
