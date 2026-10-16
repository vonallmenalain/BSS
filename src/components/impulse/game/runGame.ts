import {
  RUN_HURDLE_SHAPES,
  RUN_HURDLES,
  RUN_LEVELS,
  RUN_LIVES,
  RUN_PACE,
  RUN_TASK_RADIUS,
  RUN_TASKS,
  RUN_WORLD,
  RunRound,
  type RunGap,
  type RunHurdle,
  type RunHurdleShape,
  type RunItem,
  type RunPlatform,
} from '@/lib/impulseGameRun'
import { CanvasGame, type HudColors } from '@/components/impulse/game/canvasGame'
import {
  clamp,
  emojiBadge,
  EMOJI_FONT,
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
 * **Der Läufer** ist kein Emoji, sondern eine gezeichnete Figur – ein
 * junger Krieger mit Helm, Federbusch, Tunika und Schild auf dem Rücken.
 * Seine Glieder folgen einem Laufzyklus, der an der zurückgelegten
 * Strecke hängt, nicht an der Uhr: Die Füsse rutschen nie über den
 * Boden, und je schneller die Welt, desto schneller die Schritte. Im
 * Sprung zieht er die Knie an, im Fallen streckt er die Beine zur
 * Landung; zwischen den Haltungen wird weich überblendet.
 *
 * **Die Tiefe**: Wolken, Berge und Hügel ziehen langsamer vorbei als der
 * Boden – jede Ebene ein vorgezeichneter Streifen, der zweimal gestempelt
 * wird. Lücken, Bretter und Brücken zeichnet jedes Bild neu: Es sind nur
 * ein paar Flächen.
 */

interface Palette {
  skyTop: string
  skyBottom: string
  sun: string
  sunHalo: string
  cloud: string
  mountains: string
  snow: string
  hills: string
  trees: string
  trunks: string
  grass: string
  grassLight: string
  grassDark: string
  soilTop: string
  soilBottom: string
  pebble: string
  strata: string
  holeTop: string
  holeBottom: string
  wall: string
  platformTop: string
  platformBottom: string
  platformEdge: string
  plank: string
  plankDark: string
  hurdleTop: string
  hurdleBottom: string
  hurdleEdge: string
  taskInner: string
  taskOuter: string
  taskRing: string
  label: string
  labelText: string
  dust: string
  wind: string
  shadow: string
  hud: HudColors
  muted: string
}

const LIGHT: Palette = {
  skyTop: '#7dd3fc',
  skyBottom: '#fef3c7',
  sun: 'rgba(253, 186, 116, 0.95)',
  sunHalo: 'rgba(253, 186, 116, 0.3)',
  cloud: 'rgba(255, 255, 255, 0.92)',
  mountains: 'rgba(129, 140, 248, 0.32)',
  snow: 'rgba(255, 255, 255, 0.85)',
  hills: 'rgba(74, 222, 128, 0.7)',
  trees: '#16a34a',
  trunks: '#7c4a24',
  grass: '#84cc16',
  grassLight: '#d9f99d',
  grassDark: '#4d7c0f',
  soilTop: '#c8935e',
  soilBottom: '#7c4a24',
  pebble: 'rgba(87, 52, 23, 0.32)',
  strata: 'rgba(120, 72, 30, 0.22)',
  holeTop: '#3f2a17',
  holeBottom: '#0f0904',
  wall: 'rgba(0, 0, 0, 0.28)',
  platformTop: '#e7e5e4',
  platformBottom: '#a8a29e',
  platformEdge: '#57534e',
  plank: '#c2853b',
  plankDark: '#7c4a1c',
  hurdleTop: '#8a8580',
  hurdleBottom: '#4b4642',
  hurdleEdge: '#292524',
  taskInner: '#ffffff',
  taskOuter: '#fef3c7',
  taskRing: '#f59e0b',
  label: 'rgba(15, 23, 42, 0.82)',
  labelText: '#ffffff',
  dust: '161, 112, 62',
  wind: 'rgba(255, 255, 255, 0.55)',
  shadow: 'rgba(0, 0, 0, 0.2)',
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
  sun: 'rgba(254, 240, 138, 0.9)',
  sunHalo: 'rgba(254, 240, 138, 0.16)',
  cloud: 'rgba(165, 180, 252, 0.13)',
  mountains: 'rgba(30, 27, 75, 0.85)',
  snow: 'rgba(199, 210, 254, 0.35)',
  hills: 'rgba(20, 50, 40, 0.95)',
  trees: '#14532d',
  trunks: '#1c1209',
  grass: '#4d7c0f',
  grassLight: '#84cc16',
  grassDark: '#1a2e05',
  soilTop: '#4a3320',
  soilBottom: '#1f140a',
  pebble: 'rgba(0, 0, 0, 0.32)',
  strata: 'rgba(0, 0, 0, 0.22)',
  holeTop: '#120c06',
  holeBottom: '#000000',
  wall: 'rgba(0, 0, 0, 0.4)',
  platformTop: '#79716b',
  platformBottom: '#3f3a36',
  platformEdge: '#1c1917',
  plank: '#8a5a24',
  plankDark: '#4a2e0e',
  hurdleTop: '#5f5a55',
  hurdleBottom: '#2b2724',
  hurdleEdge: '#0c0a09',
  taskInner: '#ffffff',
  taskOuter: '#fde68a',
  taskRing: '#fbbf24',
  label: 'rgba(2, 6, 23, 0.86)',
  labelText: '#ffffff',
  dust: '214, 211, 209',
  wind: 'rgba(199, 210, 254, 0.35)',
  shadow: 'rgba(0, 0, 0, 0.35)',
  hud: {
    text: '#f8fafc',
    note: '#fdba74',
    heart: '#f87171',
    heartEmpty: 'rgba(248, 250, 252, 0.2)',
  },
  muted: 'rgba(248, 250, 252, 0.65)',
}

/** Der Krieger – bei Tag und Nacht derselbe. */
const BODY = {
  skin: '#c98a52',
  skinFar: '#9c6639',
  tunic: '#dc2626',
  tunicFar: '#991b1b',
  belt: '#78350f',
  bronze: '#e0b04f',
  bronzeDark: '#a16207',
  plume: '#ef4444',
  plumeDark: '#b91c1c',
  sandal: '#5b3412',
  eye: '#1c1917',
  outline: 'rgba(28, 16, 6, 0.9)',
} as const

/** Wie lange der Hinweis zum Springen mindestens steht. */
const HINT_S = 4
/** So lange steht ein Hinweis auf etwas Neues (die erste Etage, die zweite …). */
const NOTICE_S = 3.2
/** Ein ganzer Laufzyklus – zwei Schritte – in Körperhöhen. */
const STRIDE = 2.1
/** Wie dick ein Brett aussieht. */
const PLATFORM_THICKNESS = 0.34
/** Die Ebenen dahinter: so viel langsamer als der Boden ziehen sie vorbei. */
const PARALLAX = { clouds: 0.06, mountains: 0.12, hills: 0.3 } as const

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

/** Ein Staubwölkchen – in Weltmassen, damit es mit dem Boden zurückbleibt. */
interface Puff {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  life: number
  max: number
}

/** Die Haltung des Läufers: Winkel in Bogenmass, 0 = senkrecht hinunter, positiv = nach vorn. */
interface Pose {
  thigh: [number, number]
  knee: [number, number]
  arm: [number, number]
  elbow: [number, number]
  /** Hüfthöhe über den Füssen. */
  hip: number
  /** Vorlage des Rumpfs. */
  lean: number
}

const IDLE: Pose = {
  thigh: [0.12, -0.1],
  knee: [0.14, 0.08],
  arm: [0.18, -0.12],
  elbow: [0.45, 0.35],
  hip: 0.48,
  lean: 0.05,
}
const RISE: Pose = {
  thigh: [1.15, -0.45],
  knee: [1.55, 0.8],
  arm: [2.3, -0.75],
  elbow: [0.55, 0.65],
  hip: 0.47,
  lean: 0.12,
}
const FALL: Pose = {
  thigh: [0.55, 0.05],
  knee: [0.5, 0.45],
  arm: [1.75, -1.25],
  elbow: [0.35, 0.3],
  hip: 0.47,
  lean: 0.04,
}

function runPose(phase: number): Pose {
  const pose: Pose = {
    thigh: [0, 0],
    knee: [0, 0],
    arm: [0, 0],
    elbow: [0, 0],
    hip: 0.47 - 0.035 * ((1 + Math.cos(2 * phase)) / 2),
    lean: 0.17,
  }
  for (const side of [0, 1] as const) {
    const a = phase + side * Math.PI
    // Schwingt der Oberschenkel nach vorn, ist der Fuss in der Luft – das Knie beugt sich stark.
    pose.thigh[side] = 0.78 * Math.sin(a)
    pose.knee[side] = 0.2 + 1.45 * Math.max(0, Math.cos(a))
    // Der Arm schwingt gegen das Bein derselben Seite.
    pose.arm[side] = -0.85 * Math.sin(a)
    pose.elbow[side] = 1.25 + 0.45 * Math.max(0, -Math.sin(a))
  }
  return pose
}

function mix(a: Pose, b: Pose, k: number): Pose {
  const l = (x: number, y: number) => x + (y - x) * k
  return {
    thigh: [l(a.thigh[0], b.thigh[0]), l(a.thigh[1], b.thigh[1])],
    knee: [l(a.knee[0], b.knee[0]), l(a.knee[1], b.knee[1])],
    arm: [l(a.arm[0], b.arm[0]), l(a.arm[1], b.arm[1])],
    elbow: [l(a.elbow[0], b.elbow[0]), l(a.elbow[1], b.elbow[1])],
    hip: l(a.hip, b.hip),
    lean: l(a.lean, b.lean),
  }
}

/** Ein fester Zufall je Zahl – für Kieselsteine, Bäume und Wolken, die bei jedem Aufbau gleich liegen. */
function hash(n: number): number {
  const x = Math.sin(n * 12.9898 + 4.1414) * 43758.5453
  return x - Math.floor(x)
}

export class RunGame extends CanvasGame {
  private readonly colors: Palette
  private round: RunRound
  private cleared = 0
  /** Hürden, die ihn getroffen haben – sie zerspringen und sind weg. */
  private smashed = new Set<number>()
  private debris: Debris[] = []
  private squash = 0

  /* Die Bewegung des Läufers */
  private stride = 0
  private lastDistance = 0
  private air = 0
  private running = 0
  private steps = 0
  private puffs: Puff[] = []
  /** Brücken über Lücken, in die er fiel – wann sie kamen, für das Einschwingen. */
  private bridges = new Map<number, number>()

  /* Hinweise auf Neues – je Runde einmal */
  private notice: { text: string; until: number } | null = null
  private noticed = new Set<string>()

  /* Masse */
  private unit = 40
  private groundY = 0
  private runnerX = 0

  /* Vorgezeichnetes */
  private clouds: Sprite | null = null
  private mountains: Sprite | null = null
  private hills: Sprite | null = null
  private ground: Sprite | null = null
  private glow: Sprite | null = null
  private hurdleSprites = new Map<string, Sprite>()
  private taskSprites = new Map<RunItem, Sprite & { centerY: number }>()
  private holeFill: CanvasGradient | null = null
  private platformFill: CanvasGradient[] = []

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
    this.stride = 0
    this.lastDistance = 0
    this.air = 0
    this.steps = 0
    this.puffs = []
    this.bridges.clear()
    this.notice = null
    this.noticed.clear()
  }

  protected update(dt: number): void {
    const u = this.unit
    for (const event of this.round.step(dt)) {
      switch (event.kind) {
        case 'land': {
          this.squash = clamp(event.impact / 9, 0.35, 1)
          if (event.impact > 5) this.dustBurst(Math.round(clamp(event.impact / 2, 3, 7)))
          break
        }
        case 'clear': {
          this.cleared += 1
          this.bump()
          const { hurdle } = event
          const x = this.screenX(hurdle.x + hurdle.w / 2)
          this.float(
            '+1',
            x,
            this.groundY - (hurdle.base + hurdle.h) * u - 16,
            this.colors.hud.note,
          )
          if (event.healed) this.heal(this.round.lives, this.width / 2, this.hudBottom + 10)
          break
        }
        case 'leap': {
          this.cleared += 1
          this.bump()
          const x = this.screenX(event.gap.x + event.gap.w / 2)
          this.float('+1', x, this.groundY - u * 0.6, this.colors.hud.note)
          if (event.healed) this.heal(this.round.lives, this.width / 2, this.hudBottom + 10)
          break
        }
        case 'task': {
          const x = this.runnerX
          const y = this.groundY - event.task.y * u
          this.bump()
          this.burst(x, y, '#f59e0b', 10)
          this.float(`+1 ${event.task.item.label}`, x + u * 0.6, y - 10, '#d97706', 16)
          this.options.vibrate?.(8)
          break
        }
        case 'hit':
          this.smashed.add(event.hurdle.id)
          this.shatter(event.hurdle)
          this.hurt(`Verwundet: «${event.hurdle.item.label}»`, this.round.lives)
          break
        case 'fall': {
          this.bridges.set(event.gap.id, this.clock)
          const x = this.screenX(event.gap.x + event.gap.w / 2)
          this.burst(x, this.groundY, this.colors.plank, 8)
          if (event.hurt) this.hurt(`Verwundet: «${event.gap.item.label}»`, this.round.lives)
          break
        }
        case 'over':
          this.finish()
          break
      }
    }
    this.watchForNews()
  }

  protected tick(dt: number): void {
    const round = this.round
    this.squash = Math.max(0, this.squash - dt / 0.18)

    // Der Laufzyklus hängt an der Strecke: So rutschen die Füsse nie.
    const moved = round.distance - this.lastDistance
    this.lastDistance = round.distance
    if (moved > 0) {
      const stride = STRIDE * (0.85 + 0.15 * round.tempo)
      this.stride += (moved / stride) * Math.PI * 2
    }
    const airTarget = round.grounded ? 0 : 1
    this.air += (airTarget - this.air) * Math.min(1, dt * (airTarget ? 14 : 24))
    const runTarget = this.phase === 'play' ? 1 : 0
    this.running += (runTarget - this.running) * Math.min(1, dt * 6)

    // Bei jedem Auftreten ein Wölkchen Staub hinter dem Fuss.
    const steps = Math.floor((this.stride - Math.PI / 2) / Math.PI)
    if (steps !== this.steps) {
      this.steps = steps
      if (round.grounded && this.phase === 'play' && this.air < 0.3) this.dustStep()
    }

    for (let index = this.puffs.length - 1; index >= 0; index -= 1) {
      const puff = this.puffs[index]
      puff.x += puff.vx * dt
      puff.y += puff.vy * dt
      puff.vy *= 1 - dt * 2
      puff.life -= dt
      if (puff.life <= 0) this.puffs.splice(index, 1)
    }
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
    this.clouds = null
    this.mountains = null
    this.hills = null
    this.ground = null
    this.glow = null
  }

  /* ---------------------------------------------------------------- */
  /* Neues ansagen                                                     */
  /* ---------------------------------------------------------------- */

  /** Taucht zum ersten Mal etwas Neues auf, sagt es ein Satz unten an. */
  private watchForNews() {
    const round = this.round
    // Erst ansagen, wenn es wirklich im Bild ist – nicht schon knapp ausserhalb.
    const visible = (x: number) => this.screenX(x) < this.width - this.unit * 0.5
    const say = (key: string, text: string) => {
      if (this.noticed.has(key)) return
      this.noticed.add(key)
      this.notice = { text, until: this.clock + NOTICE_S }
    }
    const platform = (kind: RunPlatform['kind']) =>
      round.platforms.some((p) => p.kind === kind && visible(p.x))
    if (round.gaps.some((g) => !g.chasm && g.w >= RUN_PACE.preciseMin && visible(g.x))) {
      say('precise', 'Weite Lücke – lang drücken, genau abspringen')
    } else if (platform('deadEnd')) {
      say('fork', 'Das untere Brett endet – rechtzeitig hinauf!')
    } else if (platform('stone')) {
      say('stone', 'Trittsteine – genau landen, dann weiter')
    } else if (platform('bridge')) {
      say('bridge', 'Zu breit zum Springen – nur oben hinüber')
    } else if (round.hurdles.some((h) => h.base > 0 && visible(h.x))) {
      say('upHurdle', 'Auch oben gibt es Ausreden')
    } else if (platform('ledge')) {
      say('first', 'Lücke! Hinüberspringen – oder lang drücken und hinauf')
    }
  }

  /* ---------------------------------------------------------------- */
  /* Masse und Vorzeichnen                                             */
  /* ---------------------------------------------------------------- */

  protected layout(): void {
    const w = RUN_WORLD
    const top = this.hudBottom + 8
    const bottom = this.height - this.options.bottomInset - 8
    // Über dem Boden: die zweite Etage, ein voller Sprung von dort und der Läufer selbst.
    // Darunter: Platz für die Wörter der Ausreden.
    const above = 6.1
    const below = 1.3
    this.unit = clamp(
      Math.min(this.width / (w.ahead + w.behind), (bottom - top) / (above + below)),
      26,
      96,
    )
    const spare = Math.max(0, bottom - top - this.unit * (above + below))
    this.groundY = top + spare * 0.7 + this.unit * above
    this.runnerX = this.unit * w.behind
    this.buildBackground()
    this.buildStrips()
    this.buildSprites()
  }

  private screenX(worldX: number): number {
    return this.runnerX + (worldX - this.round.distance) * this.unit
  }

  private levelY(height: number): number {
    return this.groundY - height * this.unit
  }

  private shatter(hurdle: RunHurdle) {
    const sprite = this.hurdleSprites.get(spriteKey(hurdle.shape, hurdle.item))
    if (!sprite) return
    this.debris.push({
      sprite,
      x: this.screenX(hurdle.x) + sprite.w / 2,
      y: this.levelY(hurdle.base) - sprite.h / 2,
      vx: 220,
      vy: -380,
      spin: 5,
      t: 0,
    })
  }

  /** Staub beim Auftreten: ein, zwei Wölkchen hinter dem Fuss. */
  private dustStep() {
    const round = this.round
    this.puffs.push({
      x: round.distance - 0.12,
      y: round.y + 0.05,
      vx: -0.4,
      vy: 0.5,
      r: 0.07 + 0.04 * this.random(),
      life: 0.35,
      max: 0.35,
    })
  }

  /** Staub bei der Landung – nach beiden Seiten. */
  private dustBurst(count: number) {
    const round = this.round
    for (let index = 0; index < count; index += 1) {
      const side = index % 2 === 0 ? -1 : 1
      this.puffs.push({
        x: round.distance + side * 0.1,
        y: round.y + 0.04,
        vx: side * (0.8 + 1.2 * this.random()),
        vy: 0.4 + 0.6 * this.random(),
        r: 0.08 + 0.06 * this.random(),
        life: 0.45,
        max: 0.45,
      })
    }
    if (this.puffs.length > 40) this.puffs.splice(0, this.puffs.length - 40)
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
    g.fillRect(0, 0, this.width, this.height)
    // Sonne bei Tag, Mond bei Nacht – «zu allen Zeiten».
    const sunX = this.width * 0.8
    const sunY = Math.max(this.hudBottom + this.unit * 0.9, this.groundY - this.unit * 5.6)
    const r = this.unit * 0.7
    const halo = g.createRadialGradient(sunX, sunY, r * 0.8, sunX, sunY, r * 3.2)
    halo.addColorStop(0, c.sunHalo)
    halo.addColorStop(1, 'rgba(255, 255, 255, 0)')
    g.fillStyle = halo
    g.fillRect(sunX - r * 3.2, sunY - r * 3.2, r * 6.4, r * 6.4)
    // Die Scheibe auf einer eigenen Leinwand – nachts schneidet ein zweiter Kreis die Sichel aus.
    const disc = makeLayer(r * 2 + 2, r * 2 + 2, this.dpr)
    if (disc) {
      disc.g.fillStyle = c.sun
      disc.g.beginPath()
      disc.g.arc(r + 1, r + 1, r, 0, Math.PI * 2)
      disc.g.fill()
      if (this.options.dark) {
        disc.g.globalCompositeOperation = 'destination-out'
        disc.g.beginPath()
        disc.g.arc(r + 1 - r * 0.42, r + 1 - r * 0.24, r * 0.86, 0, Math.PI * 2)
        disc.g.fill()
      }
      g.drawImage(disc.canvas, sunX - r - 1, sunY - r - 1, r * 2 + 2, r * 2 + 2)
    }
    if (this.options.dark) {
      for (let index = 0; index < 60; index += 1) {
        const size = index % 5 === 0 ? 1.5 : index % 2 === 0 ? 1 : 0.7
        g.globalAlpha = 0.35 + 0.55 * hash(index * 3.3)
        g.fillStyle = '#ffffff'
        g.beginPath()
        g.arc(
          hash(index) * this.width,
          hash(index + 100) * this.groundY * 0.8,
          size,
          0,
          Math.PI * 2,
        )
        g.fill()
      }
      g.globalAlpha = 1
    }
    this.background = canvas
  }

  /**
   * Die Streifen, die vorbeiziehen: so breit wie der Bildschirm, in ganzen
   * Gerätepixeln – sonst passt die Wiederholung nicht auf den Punkt. Alles
   * darauf liegt so, dass rechts genau anschliesst, was links beginnt.
   */
  private buildStrips() {
    const c = this.colors
    const u = this.unit
    const stripW = Math.ceil(this.width * this.dpr) / this.dpr
    /** Zeichnet etwas, das über die Naht reicht, auch auf der anderen Seite. */
    const wrap = (x: number, reach: number, draw: (x: number) => void) => {
      draw(x)
      if (x - reach < 0) draw(x + stripW)
      if (x + reach > stripW) draw(x - stripW)
    }
    const strip = (height: number, paint: (g: CanvasRenderingContext2D, h: number) => void) => {
      const h = Math.ceil(height)
      const layer = makeLayer(stripW, h, this.dpr)
      if (!layer) return null
      paint(layer.g, h)
      return { canvas: layer.canvas, w: stripW, h }
    }

    this.clouds = strip(u * 3, (g, h) => {
      const count = Math.max(2, Math.round(stripW / (u * 4.5)))
      g.fillStyle = c.cloud
      for (let index = 0; index < count; index += 1) {
        const cx = ((index + 0.5 * hash(index + 7)) / count) * stripW
        // Ganz im Streifen: oben reicht die grösste Wolke bis 1,55 × size, unten bis 0,75 × size.
        const cy = h * (0.5 + 0.25 * hash(index + 31))
        const size = u * (0.45 + 0.3 * hash(index + 53))
        wrap(cx, size * 3, (x) => {
          // Eine Fläche aus mehreren Teilen – je mit eigenem Anfang, sonst verbände
          // eine Linie die Bögen, und an der Naht blitzte der Himmel durch.
          g.beginPath()
          g.ellipse(x, cy, size * 2.2, size * 0.75, 0, 0, Math.PI * 2)
          for (const [dx, dy, r] of [
            [-0.8, -0.35, 0.75],
            [0.3, -0.6, 0.95],
            [1.2, -0.2, 0.65],
          ] as const) {
            g.moveTo(x + (dx + r) * size, cy + dy * size)
            g.arc(x + dx * size, cy + dy * size, r * size, 0, Math.PI * 2)
          }
          g.fill()
        })
      }
    })

    this.mountains = strip(u * 3.4, (g, h) => {
      const peaks = Math.max(2, Math.round(stripW / (u * 3.2)))
      const points: [number, number][] = []
      for (let index = 0; index <= peaks; index += 1) {
        const k = index % peaks
        points.push([(index / peaks) * stripW, h * (0.1 + 0.45 * hash(k + 11))])
        if (index < peaks)
          points.push([((index + 0.5) / peaks) * stripW, h * (0.6 + 0.25 * hash(k + 17))])
      }
      g.fillStyle = c.mountains
      g.beginPath()
      g.moveTo(0, h)
      for (const [x, y] of points) g.lineTo(x, y)
      g.lineTo(stripW, h)
      g.closePath()
      g.fill()
      // Schnee auf den Gipfeln.
      g.fillStyle = c.snow
      for (let index = 0; index < points.length - 2; index += 2) {
        const [x, y] = points[index]
        if (y > h * 0.3) continue
        const cap = h * 0.12
        const left = points[index - 1] ?? [x - stripW / peaks / 2, h * 0.7]
        const right = points[index + 1]
        const lerp = (to: [number, number]) => [
          x + ((to[0] - x) * cap) / Math.max(1, to[1] - y),
          y + cap,
        ]
        const [lx, ly] = lerp(left)
        const [rx, ry] = lerp(right)
        wrap(x, stripW / peaks, (dx) => {
          const shift = dx - x
          g.beginPath()
          g.moveTo(x + shift, y)
          g.lineTo(rx + shift, ry)
          g.lineTo(x + shift + (rx - x) * 0.3, ry - cap * 0.25)
          g.lineTo(x + shift, ry)
          g.lineTo(x + shift + (lx - x) * 0.4, ly - cap * 0.2)
          g.lineTo(lx + shift, ly)
          g.closePath()
          g.fill()
        })
      }
    })

    this.hills = strip(u * 2.2, (g, h) => {
      const bumps = Math.max(2, Math.round(stripW / (u * 4)))
      const curve = (x: number) =>
        h * (0.55 - 0.18 * Math.sin((x / stripW) * Math.PI * 2 * bumps + 0.7))
      g.fillStyle = c.hills
      g.beginPath()
      g.moveTo(0, h)
      for (let step = 0; step <= stripW + 3; step += 4) {
        const x = Math.min(step, stripW)
        g.lineTo(x, curve(x))
      }
      g.lineTo(stripW, h)
      g.closePath()
      g.fill()
      // Bäume auf den Hügeln – rund, wie Kinder sie malen.
      const trees = Math.max(3, Math.round(stripW / (u * 1.6)))
      for (let index = 0; index < trees; index += 1) {
        if (hash(index + 71) < 0.3) continue
        const x = ((index + hash(index + 73)) / trees) * stripW
        const size = u * (0.28 + 0.18 * hash(index + 79))
        wrap(x, size * 1.2, (tx) => {
          const ground = curve(((tx % stripW) + stripW) % stripW) + 2
          g.fillStyle = c.trunks
          g.fillRect(tx - size * 0.12, ground - size * 1.1, size * 0.24, size * 1.1)
          g.fillStyle = c.trees
          g.beginPath()
          for (const [dx, dy, r] of [
            [0, -1.35, 0.8],
            [-0.45, -1, 0.55],
            [0.45, -1.05, 0.55],
          ] as const) {
            g.moveTo(tx + (dx + r) * size, ground + dy * size)
            g.arc(tx + dx * size, ground + dy * size, r * size, 0, Math.PI * 2)
          }
          g.fill()
        })
      }
    })

    // Der Boden: Gras oben, darunter Erde mit Schichten und Kieseln.
    this.ground = strip(Math.max(u * 1.5, this.height - this.groundY + 2), (g, h) => {
      const soil = g.createLinearGradient(0, 0, 0, h)
      soil.addColorStop(0, c.soilTop)
      soil.addColorStop(1, c.soilBottom)
      g.fillStyle = soil
      g.fillRect(0, 0, stripW, h)
      g.strokeStyle = c.strata
      g.lineWidth = Math.max(1.5, u * 0.05)
      for (const [depth, waves] of [
        [0.75, 3],
        [1.35, 2],
        [2.1, 4],
      ] as const) {
        if (depth * u > h) continue
        g.beginPath()
        for (let step = 0; step <= stripW + 3; step += 6) {
          const x = Math.min(step, stripW)
          const y = depth * u + Math.sin((x / stripW) * Math.PI * 2 * waves) * u * 0.08
          if (step === 0) g.moveTo(x, y)
          else g.lineTo(x, y)
        }
        g.stroke()
      }
      g.fillStyle = c.pebble
      const pebbles = Math.round(stripW / (u * 0.45))
      for (let index = 0; index < pebbles; index += 1) {
        const x = hash(index + 201) * stripW
        const y = u * 0.35 + hash(index + 211) * Math.max(0, h - u * 0.45)
        const r = u * (0.03 + 0.05 * hash(index + 221))
        wrap(x, r, (px) => {
          g.beginPath()
          g.ellipse(px, y, r * 1.4, r, 0, 0, Math.PI * 2)
          g.fill()
        })
      }
      const grass = u * 0.17
      g.fillStyle = c.grass
      g.fillRect(0, 0, stripW, grass)
      // Die Grasnarbe franst nach unten in die Erde aus.
      g.fillStyle = c.grassDark
      const fringe = Math.round(stripW / (u * 0.18))
      for (let index = 0; index < fringe; index += 1) {
        const x = (index / fringe) * stripW
        const depth = grass + u * (0.04 + 0.06 * hash(index + 301))
        g.beginPath()
        g.moveTo(x, grass - 1)
        g.lineTo(x + stripW / fringe, grass - 1)
        g.lineTo(x + stripW / fringe / 2, depth)
        g.closePath()
        g.fill()
      }
      g.fillStyle = c.grassLight
      g.fillRect(0, 0, stripW, Math.max(2, u * 0.05))
    })

    // Der Schlund einer Lücke – ein Verlauf, der für alle Lücken gilt.
    const fill = this.g.createLinearGradient(0, this.groundY, 0, this.groundY + u * 2.2)
    fill.addColorStop(0, c.holeTop)
    fill.addColorStop(1, c.holeBottom)
    this.holeFill = fill
    this.platformFill = RUN_LEVELS.map((height) => {
      const top = this.levelY(height)
      const gradient = this.g.createLinearGradient(0, top, 0, top + PLATFORM_THICKNESS * u)
      gradient.addColorStop(0, c.platformTop)
      gradient.addColorStop(1, c.platformBottom)
      return gradient
    })
  }

  private buildSprites() {
    const u = this.unit
    const c = this.colors

    this.hurdleSprites.clear()
    for (const shape of Object.keys(RUN_HURDLE_SHAPES) as RunHurdleShape[]) {
      for (const item of RUN_HURDLES) {
        const { w, h } = RUN_HURDLE_SHAPES[shape]
        const pw = w * u
        const ph = h * u
        const layer = makeLayer(pw, ph, this.dpr)
        if (!layer) continue
        const g = layer.g
        const radius = Math.min(12, pw * 0.24)
        // Ein Steinblock: oben heller, unten dunkler, mit Kante und Glanz.
        const fill = g.createLinearGradient(0, 0, 0, ph)
        fill.addColorStop(0, c.hurdleTop)
        fill.addColorStop(1, c.hurdleBottom)
        roundRect(g, 1, 1, pw - 2, ph - 1, radius)
        g.fillStyle = fill
        g.fill()
        g.lineWidth = 2
        g.strokeStyle = c.hurdleEdge
        g.stroke()
        g.strokeStyle = 'rgba(255, 255, 255, 0.28)'
        g.lineWidth = Math.max(1.5, u * 0.04)
        g.beginPath()
        g.moveTo(radius, 3.5)
        g.lineTo(pw - radius, 3.5)
        g.stroke()
        g.strokeStyle = 'rgba(0, 0, 0, 0.25)'
        g.lineWidth = 1.2
        g.beginPath()
        g.moveTo(pw * 0.18, ph * 0.72)
        g.lineTo(pw * 0.26, ph * 0.84)
        g.lineTo(pw * 0.22, ph * 0.95)
        g.moveTo(pw * 0.84, ph * 0.3)
        g.lineTo(pw * 0.76, ph * 0.42)
        g.stroke()
        const emoji = Math.min(pw * (shape === 'double' ? 0.45 : 0.72), ph * 0.72)
        g.font = `${Math.round(emoji)}px ${EMOJI_FONT}`
        g.textAlign = 'center'
        g.textBaseline = 'middle'
        if (shape === 'double') {
          g.fillText(item.emoji, pw * 0.27, ph * 0.56)
          g.fillText(item.emoji, pw * 0.73, ph * 0.56)
        } else {
          g.fillText(item.emoji, pw / 2, ph - emoji * 0.64)
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

    // Der goldene Schein hinter jeder Aufgabe – er pulsiert leise.
    const r = RUN_TASK_RADIUS * u * 2
    const glow = makeLayer(r * 2, r * 2, this.dpr)
    if (glow) {
      const fill = glow.g.createRadialGradient(r, r, 0, r, r, r)
      fill.addColorStop(0, 'rgba(251, 191, 36, 0.55)')
      fill.addColorStop(1, 'rgba(251, 191, 36, 0)')
      glow.g.fillStyle = fill
      glow.g.fillRect(0, 0, r * 2, r * 2)
      this.glow = { canvas: glow.canvas, w: r * 2, h: r * 2 }
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
    const scroll = round.distance * u
    this.stamp(this.clouds, scroll * PARALLAX.clouds + this.clock * 6, this.groundY - u * 7)
    this.stamp(this.mountains, scroll * PARALLAX.mountains, this.groundY - u * 3.4 + 1)
    this.stamp(this.hills, scroll * PARALLAX.hills, this.groundY - u * 2.2 + 1)
    this.drawWind()
    this.stamp(this.ground, scroll, this.groundY)

    this.drawGaps()
    for (const hurdle of round.hurdles) if (hurdle.base === 0) this.drawHurdle(hurdle)
    for (const platform of round.platforms) this.drawPlatform(platform)
    for (const hurdle of round.hurdles) if (hurdle.base > 0) this.drawHurdle(hurdle)
    this.drawTasks()
    this.drawPuffs()
    this.drawRunner()
    this.drawDebris()

    if (this.phase === 'play') {
      const y = Math.min(this.height - this.options.bottomInset - 18, this.groundY + u * 1.15)
      const color = this.options.dark ? this.colors.muted : 'rgba(255, 255, 255, 0.95)'
      const notice = this.notice
      if (notice && this.clock < notice.until) {
        const left = notice.until - this.clock
        this.drawHint(notice.text, y, color, Math.min(1, left / 0.4, (NOTICE_S - left) / 0.25))
      } else {
        const fade = this.cleared >= 3 ? clamp((HINT_S + 0.5 - round.time) / 0.5, 0, 1) : 1
        this.drawHint('Tippe zum Springen – länger drücken springt höher', y, color, fade)
      }
    }
  }

  protected renderHud(): void {
    const streak = this.round.streak
    this.drawHud(this.colors.hud, this.round.lives, streak >= 5 ? `${streak} am Stück` : '')
  }

  /** Ein Streifen zweimal, Kante an Kante – in ganzen Gerätepixeln und ohne Skalieren. */
  private stamp(strip: Sprite | null, shift: number, y: number) {
    if (!strip) return
    const g = this.g
    const width = strip.canvas.width
    const offset = Math.round((((shift * this.dpr) % width) + width) % width)
    const top = Math.round(y * this.dpr)
    g.save()
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.drawImage(strip.canvas, -offset, top)
    g.drawImage(strip.canvas, width - offset, top)
    g.restore()
  }

  /** Bei hohem Tempo: feine Striche im Wind. */
  private drawWind() {
    const tempo = this.round.tempo
    if (this.phase !== 'play' || tempo < 1.7 || this.options.reducedMotion) return
    const g = this.g
    const u = this.unit
    g.strokeStyle = this.colors.wind
    g.lineWidth = 1.5
    g.globalAlpha = clamp((tempo - 1.7) / 1.2, 0, 1)
    const span = this.width + u * 4
    for (let index = 0; index < 7; index += 1) {
      const speed = 1.6 + hash(index + 401)
      const x = span - ((this.round.distance * u * speed + hash(index + 409) * span) % span) - u * 2
      const y = this.groundY - u * (0.6 + 5.2 * hash(index + 419))
      const length = u * (0.8 + 1.2 * hash(index + 421))
      g.beginPath()
      g.moveTo(x, y)
      g.lineTo(x + length, y)
      g.stroke()
    }
    g.globalAlpha = 1
  }

  /** Die Lücken: ein dunkler Schlund mit Wänden und Grasrand – oder schon eine Brücke. */
  private drawGaps() {
    const g = this.g
    const u = this.unit
    const c = this.colors
    for (const gap of this.round.gaps) {
      const x0 = this.screenX(gap.x)
      const x1 = this.screenX(gap.x + gap.w)
      if (x1 < -4 || x0 > this.width + 4) continue
      const ahead = (gap.x - this.round.distance) / RUN_WORLD.ahead
      g.fillStyle = this.holeFill ?? c.holeBottom
      g.fillRect(x0, this.groundY, x1 - x0, this.height - this.groundY)
      // Die Wände: links im Schatten, rechts im Licht.
      const wall = u * 0.14
      g.fillStyle = c.wall
      g.fillRect(x0, this.groundY, wall, this.height - this.groundY)
      g.fillStyle = 'rgba(255, 255, 255, 0.06)'
      g.fillRect(x1 - wall, this.groundY, wall, this.height - this.groundY)
      // Der Grasrand hängt ein wenig über.
      g.fillStyle = c.grass
      for (const [edge, dir] of [
        [x0, 1],
        [x1, -1],
      ] as const) {
        g.beginPath()
        g.ellipse(edge, this.groundY + u * 0.06, u * 0.12, u * 0.09, 0, 0, Math.PI * 2)
        g.fill()
        g.fillRect(dir > 0 ? edge - u * 0.12 : edge, this.groundY, u * 0.12, u * 0.06)
      }
      if (gap.bridged) {
        this.drawBridge(gap, x0, x1)
        continue
      }
      // Das Wort der Lücke unten im Schlund – solange sie vor ihm liegt.
      if (!gap.passed) {
        g.globalAlpha = clamp((1.12 - ahead) / 0.12, 0, 1)
        this.drawLabel(
          `${gap.item.emoji} ${gap.item.label}`,
          (x0 + x1) / 2,
          this.groundY + u * 0.55,
        )
        g.globalAlpha = 1
      }
    }
  }

  /** Die Brücke über einer Lücke, in die er fiel – sie schwingt kurz ein. */
  private drawBridge(gap: RunGap, x0: number, x1: number) {
    const g = this.g
    const u = this.unit
    const c = this.colors
    const since = this.clock - (this.bridges.get(gap.id) ?? -1)
    const settle = this.options.reducedMotion ? 1 : clamp(since / 0.3, 0, 1)
    const drop = (1 - settle) * u * 0.5
    const plank = u * 0.3
    const count = Math.max(2, Math.round((x1 - x0) / plank))
    const pw = (x1 - x0) / count
    const sag = u * 0.06
    for (let index = 0; index < count; index += 1) {
      const mid = (index + 0.5) / count
      const y = this.groundY - u * 0.02 + Math.sin(mid * Math.PI) * sag - drop * (1 - mid)
      g.fillStyle = index % 2 === 0 ? c.plank : c.plankDark
      g.fillRect(x0 + index * pw + 0.5, y, pw - 1, u * 0.14)
    }
    g.strokeStyle = c.plankDark
    g.lineWidth = Math.max(1.5, u * 0.035)
    g.beginPath()
    g.moveTo(x0, this.groundY - u * 0.28)
    g.quadraticCurveTo((x0 + x1) / 2, this.groundY - u * 0.12 + sag, x1, this.groundY - u * 0.28)
    g.stroke()
    g.fillStyle = c.plankDark
    g.fillRect(x0 - u * 0.04, this.groundY - u * 0.34, u * 0.08, u * 0.36)
    g.fillRect(x1 - u * 0.04, this.groundY - u * 0.34, u * 0.08, u * 0.36)
  }

  /** Ein Brett oder Trittstein mit Grasnarbe. */
  private drawPlatform(platform: RunPlatform) {
    const g = this.g
    const u = this.unit
    const c = this.colors
    const x = this.screenX(platform.x)
    const w = platform.w * u
    if (x > this.width + 4 || x + w < -4) return
    const top = this.levelY(platform.top)
    const t = PLATFORM_THICKNESS * u
    const ahead = (platform.x - this.round.distance) / RUN_WORLD.ahead
    g.globalAlpha = clamp((1.12 - ahead) / 0.12, 0, 1)
    if (platform.kind === 'stone') {
      // Ein Trittstein: oben flach, darunter ein Brocken, der sich nach unten verjüngt.
      g.beginPath()
      g.moveTo(x, top)
      g.lineTo(x + w, top)
      g.quadraticCurveTo(x + w + u * 0.06, top + u * 0.5, x + w * 0.56, top + u * 0.95)
      g.quadraticCurveTo(x - u * 0.06, top + u * 0.55, x, top)
      g.closePath()
      g.fillStyle = c.platformBottom
      g.fill()
      g.lineWidth = 1.5
      g.strokeStyle = c.platformEdge
      g.stroke()
      g.fillStyle = 'rgba(255, 255, 255, 0.18)'
      g.beginPath()
      g.ellipse(x + w * 0.35, top + u * 0.22, w * 0.22, u * 0.08, -0.2, 0, Math.PI * 2)
      g.fill()
    } else {
      this.drawSlab(platform, x, w, top, t)
    }
    roundRect(g, x - 1, top - u * 0.04, w + 2, u * 0.13, u * 0.06)
    g.fillStyle = c.grass
    g.fill()
    g.fillStyle = c.grassLight
    g.fillRect(x + u * 0.08, top - u * 0.04, Math.max(0, w - u * 0.16), Math.max(1.5, u * 0.035))
    g.globalAlpha = 1
  }

  /** Ein Brett als Steinplatte, darunter hängen ein paar Brocken. */
  private drawSlab(platform: RunPlatform, x: number, w: number, top: number, t: number) {
    const g = this.g
    const u = this.unit
    const c = this.colors
    g.fillStyle = c.platformEdge
    for (let k = 0.35; k < platform.w - 0.2; k += 0.7) {
      const hx = this.screenX(platform.x + k)
      const hang = u * (0.1 + 0.12 * hash(platform.id * 13 + k * 7))
      g.beginPath()
      g.moveTo(hx - u * 0.15, top + t - 1)
      g.lineTo(hx + u * 0.15, top + t - 1)
      g.lineTo(hx + u * 0.02, top + t + hang)
      g.closePath()
      g.fill()
    }
    roundRect(g, x, top, w, t, t * 0.4)
    g.fillStyle = this.platformFill[platform.level] ?? c.platformBottom
    g.fill()
    g.lineWidth = 1.5
    g.strokeStyle = c.platformEdge
    g.stroke()
  }

  private drawHurdle(hurdle: RunHurdle) {
    const g = this.g
    const u = this.unit
    const x = this.screenX(hurdle.x)
    if (x > this.width + 4 || x + hurdle.w * u < -4) return
    if (this.smashed.has(hurdle.id)) return
    const sprite = this.hurdleSprites.get(spriteKey(hurdle.shape, hurdle.item))
    if (!sprite) return
    const baseY = this.levelY(hurdle.base)
    // Weit vorne taucht sie sanft auf, statt am Rand hereinzuspringen; wer
    // nach einem Treffer hindurchläuft, sieht sie nur noch blass.
    const ahead = (hurdle.x - this.round.distance) / RUN_WORLD.ahead
    const alpha = hurdle.touched ? 0.35 : clamp((1.12 - ahead) / 0.12, 0, 1)
    g.globalAlpha = alpha * 0.8
    g.fillStyle = this.colors.shadow
    g.beginPath()
    g.ellipse(x + sprite.w / 2, baseY + 1, sprite.w * 0.6, u * 0.07, 0, 0, Math.PI * 2)
    g.fill()
    g.globalAlpha = alpha
    g.drawImage(sprite.canvas, x, baseY - sprite.h, sprite.w, sprite.h)
    // Das Wort der Ausrede: am Boden unten in der Erde, auf einem Brett knapp darüber –
    // darunter stünde es dem im Weg, der unten läuft.
    if (!hurdle.passed) {
      const y =
        hurdle.base === 0 ? this.groundY + u * 0.22 : baseY - sprite.h - u * 0.12 - this.labelHeight
      this.drawLabel(hurdle.item.label, x + sprite.w / 2, y)
    }
    g.globalAlpha = 1
  }

  /** Wie hoch die Kapsel eines Worts ist. */
  private get labelHeight(): number {
    return Math.round(clamp(this.unit * 0.3, 10, 14)) + 8
  }

  /** Ein Wort auf einer dunklen Kapsel – auf jedem Grund lesbar. `y` ist ihre Oberkante. */
  private drawLabel(text: string, cx: number, y: number) {
    const g = this.g
    const c = this.colors
    const h = this.labelHeight
    const size = h - 8
    g.font = `800 ${size}px ${UI_FONT}`
    const tw = g.measureText(text).width
    g.fillStyle = c.label
    roundRect(g, cx - tw / 2 - 7, y, tw + 14, h, h / 2)
    g.fill()
    g.fillStyle = c.labelText
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(text, cx, y + h / 2 + 0.5)
  }

  private drawTasks() {
    const g = this.g
    const glow = this.glow
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
      const alpha = clamp((1.12 - ahead) / 0.12, 0, 1)
      if (glow) {
        g.globalAlpha = alpha * (0.55 + 0.35 * Math.sin(this.clock * 5 + task.id * 1.7))
        g.drawImage(glow.canvas, x - glow.w / 2, y - glow.h / 2, glow.w, glow.h)
      }
      g.globalAlpha = alpha
      g.drawImage(sprite.canvas, x - sprite.w / 2, y - sprite.centerY, sprite.w, sprite.h)
    }
    g.globalAlpha = 1
  }

  private drawPuffs() {
    const g = this.g
    const u = this.unit
    for (const puff of this.puffs) {
      const k = puff.life / puff.max
      g.fillStyle = `rgba(${this.colors.dust}, ${0.45 * k})`
      g.beginPath()
      g.arc(
        this.screenX(puff.x),
        this.groundY - puff.y * u,
        puff.r * u * (1.6 - 0.6 * k),
        0,
        Math.PI * 2,
      )
      g.fill()
    }
  }

  /** Wo unter ihm die nächste Fläche ist – für den Schatten. `null` über einer Lücke. */
  private surfaceBelow(): number | null {
    const round = this.round
    for (let index = RUN_LEVELS.length - 1; index > 0; index -= 1) {
      const top = RUN_LEVELS[index]
      if (top <= round.y + 0.01 && round.platformAt(round.distance, top)) return top
    }
    return round.groundAt(round.distance) ? 0 : null
  }

  /**
   * Der junge Krieger, Glied für Glied. Gerechnet wird in Körperhöhen ab
   * den Füssen (y nach oben), gezeichnet in Pixeln. Erst die abgewandte
   * Seite (dunkler), dann Schild, Rumpf, Kopf – zuletzt Bein und Arm der
   * zugewandten Seite.
   */
  private drawRunner() {
    const g = this.g
    const u = this.unit
    const round = this.round
    const reduced = this.options.reducedMotion

    // Der Schatten auf der Fläche unter ihm – je höher, desto kleiner.
    const surface = this.surfaceBelow()
    if (surface !== null) {
      const lift = Math.max(0, round.y - surface)
      const k = clamp(1 - lift / 3, 0.3, 1)
      g.globalAlpha = 0.9 * k
      g.fillStyle = this.colors.shadow
      g.beginPath()
      g.ellipse(this.runnerX, this.levelY(surface) + 1, u * 0.32 * k, u * 0.07, 0, 0, Math.PI * 2)
      g.fill()
      g.globalAlpha = 1
    }

    // Getroffen: Er blinkt, solange ihn nichts treffen kann.
    const blink = round.invulnerable > 0 && Math.floor(this.clock * 14) % 2 === 0
    const k = clamp((round.vy / RUN_WORLD.jumpVelocity + 1) / 2, 0, 1)
    const stand = mix(IDLE, runPose(this.stride), this.running)
    const pose = mix(stand, mix(FALL, RISE, k), this.air)
    if (!reduced) pose.hip += 0.006 * Math.sin(this.clock * 2.4) * (1 - this.running)
    // Die Landung federt in den Knien.
    pose.knee[0] += 0.6 * this.squash
    pose.knee[1] += 0.6 * this.squash
    pose.hip -= 0.07 * this.squash
    pose.lean += 0.1 * this.squash

    const footY = this.levelY(round.y)
    const ox = this.runnerX
    const P = (x: number, y: number): [number, number] => [ox + x * u, footY - y * u]
    const along = (from: [number, number], angle: number, length: number): [number, number] => [
      from[0] + Math.sin(angle) * length * u,
      from[1] + Math.cos(angle) * length * u,
    ]
    const hip = P(0, pose.hip)
    const up = Math.PI - pose.lean
    const shoulder = along(hip, up, 0.28)
    const neck = along(hip, up, 0.33)
    const head = along(neck, up - 0.1, 0.11)

    g.save()
    if (blink) g.globalAlpha = 0.3
    if (!reduced && this.air > 0.05) {
      // In der Luft kippt er leicht – vorn hoch beim Steigen, vorn tief beim Fallen.
      const tilt = clamp(-round.vy * 0.016, -0.2, 0.2) * this.air
      g.translate(hip[0], hip[1])
      g.rotate(tilt)
      g.translate(-hip[0], -hip[1])
    }
    g.lineCap = 'round'
    g.lineJoin = 'round'

    const limb = (points: [number, number][], width: number, color: string) => {
      g.beginPath()
      g.moveTo(points[0][0], points[0][1])
      for (let index = 1; index < points.length; index += 1)
        g.lineTo(points[index][0], points[index][1])
      g.strokeStyle = BODY.outline
      g.lineWidth = (width + 0.045) * u
      g.stroke()
      g.strokeStyle = color
      g.lineWidth = width * u
      g.stroke()
    }
    const leg = (side: 0 | 1) => {
      const knee = along(hip, pose.thigh[side], 0.25)
      const foot = along(knee, pose.thigh[side] - pose.knee[side], 0.25)
      const toe: [number, number] = [foot[0] + 0.1 * u, foot[1] + 0.01 * u]
      const skin = side === 0 ? BODY.skin : BODY.skinFar
      limb([hip, knee, foot], 0.095, skin)
      limb([foot, toe], 0.07, BODY.sandal)
      // Die Riemen der Sandalen.
      const strap = along(knee, pose.thigh[side] - pose.knee[side], 0.17)
      g.strokeStyle = BODY.sandal
      g.lineWidth = 0.035 * u
      g.beginPath()
      g.moveTo(strap[0] - 0.045 * u, strap[1])
      g.lineTo(strap[0] + 0.045 * u, strap[1])
      g.stroke()
    }
    const arm = (side: 0 | 1) => {
      const elbow = along(shoulder, pose.arm[side], 0.17)
      const hand = along(elbow, pose.arm[side] + pose.elbow[side], 0.16)
      const skin = side === 0 ? BODY.skin : BODY.skinFar
      limb([shoulder, elbow, hand], 0.08, skin)
      // Die bronzene Armschiene am Unterarm.
      const cuff = along(elbow, pose.arm[side] + pose.elbow[side], 0.06)
      limb([elbow, cuff], 0.085, side === 0 ? BODY.bronze : BODY.bronzeDark)
    }

    arm(1)
    leg(1)

    // Der Schild auf dem Rücken.
    const shield = along(hip, up + 0.55, 0.27)
    const sr = 0.15 * u
    g.fillStyle = BODY.outline
    g.beginPath()
    g.arc(shield[0], shield[1], sr + 0.025 * u, 0, Math.PI * 2)
    g.fill()
    const face = g.createRadialGradient(
      shield[0] - sr * 0.3,
      shield[1] - sr * 0.3,
      sr * 0.1,
      shield[0],
      shield[1],
      sr,
    )
    face.addColorStop(0, '#f6d27a')
    face.addColorStop(1, BODY.bronzeDark)
    g.fillStyle = face
    g.beginPath()
    g.arc(shield[0], shield[1], sr, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = BODY.bronzeDark
    g.beginPath()
    g.arc(shield[0], shield[1], sr * 0.28, 0, Math.PI * 2)
    g.fill()

    // Rumpf, Tunika mit flatterndem Saum und Gürtel.
    limb([hip, shoulder], 0.2, BODY.tunic)
    const flutter = reduced ? 0 : Math.sin(this.stride * 2) * 0.025 * this.running
    const skirt: [number, number][] = [
      along(hip, up - 1.25, 0.11),
      along(hip, up + 1.25, 0.11),
      along(hip, -0.6 - pose.lean + flutter, 0.17),
      along(hip, 0.45 - pose.lean + flutter, 0.17),
    ]
    g.beginPath()
    g.moveTo(skirt[0][0], skirt[0][1])
    g.lineTo(skirt[1][0], skirt[1][1])
    g.lineTo(skirt[2][0], skirt[2][1])
    g.lineTo(skirt[3][0], skirt[3][1])
    g.closePath()
    g.fillStyle = BODY.tunic
    g.strokeStyle = BODY.outline
    g.lineWidth = 0.035 * u
    g.stroke()
    g.fill()
    limb([along(hip, up - 1.3, 0.1), along(hip, up + 1.3, 0.1)], 0.045, BODY.belt)

    leg(0)

    // Der Kopf mit Helm und Federbusch.
    const hr = 0.115 * u
    const [hx, hy] = head
    const sway = reduced ? 0 : Math.sin(this.stride * 2 + 0.6) * 0.04 * this.running
    const wind = this.air * clamp(round.vy / RUN_WORLD.jumpVelocity, -1, 1)
    const tail: [number, number] = [hx - hr * 2.5, hy - hr * (0.45 + wind * 0.6) + sway * u]
    g.fillStyle = BODY.outline
    g.beginPath()
    g.moveTo(hx - hr * 0.2, hy - hr * 1.4)
    g.quadraticCurveTo(hx - hr * 1.3, hy - hr * 1.95, tail[0] - hr * 0.15, tail[1])
    g.quadraticCurveTo(hx - hr * 1.2, hy - hr * 0.7, hx - hr * 0.6, hy - hr * 0.75)
    g.closePath()
    g.fill()
    g.fillStyle = BODY.plume
    g.beginPath()
    g.moveTo(hx - hr * 0.2, hy - hr * 1.3)
    g.quadraticCurveTo(hx - hr * 1.25, hy - hr * 1.8, tail[0], tail[1])
    g.quadraticCurveTo(hx - hr * 1.1, hy - hr * 0.8, hx - hr * 0.6, hy - hr * 0.85)
    g.closePath()
    g.fill()
    g.fillStyle = BODY.outline
    g.beginPath()
    g.arc(hx, hy, hr + 0.022 * u, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = BODY.skin
    g.beginPath()
    g.arc(hx, hy, hr, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = BODY.eye
    g.beginPath()
    g.arc(hx + hr * 0.5, hy + hr * 0.05, Math.max(1, hr * 0.13), 0, Math.PI * 2)
    g.fill()
    // Der Helm: eine Haube über der oberen Hälfte, hinten mit Nackenschutz.
    g.beginPath()
    g.arc(hx, hy, hr * 1.12, Math.PI * 0.98, Math.PI * 2.02)
    g.lineTo(hx + hr * 1.15, hy - hr * 0.05)
    g.lineTo(hx - hr * 1.1, hy + hr * 0.15)
    g.closePath()
    g.fillStyle = BODY.bronze
    g.fill()
    g.strokeStyle = BODY.outline
    g.lineWidth = 0.03 * u
    g.stroke()
    g.fillStyle = BODY.bronzeDark
    g.fillRect(hx - hr * 1.12, hy - hr * 0.2, hr * 2.25, hr * 0.22)
    g.fillStyle = 'rgba(255, 255, 255, 0.45)'
    g.beginPath()
    g.ellipse(hx + hr * 0.25, hy - hr * 0.7, hr * 0.35, hr * 0.14, -0.3, 0, Math.PI * 2)
    g.fill()

    arm(0)
    g.restore()
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
