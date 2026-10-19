import {
  CHAIN_LIVES,
  CHAIN_ROUND_S,
  ChainRound,
  chainPoints,
  chainStage,
  type ChainQuestion,
} from '@/lib/impulseGameChain'
import { CanvasGame, type HudColors } from '@/components/impulse/game/canvasGame'
import {
  clamp,
  easeOut,
  EMOJI_FONT,
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
 * Oben die Frage in einer Sprechblase (wer fragt, was), in der Mitte die
 * Figur mit der Schnur, die sich zusammenzieht, dicker und dunkler wird
 * und am Ende als Kette zuschnappt, unten die Antworten als grosse
 * Knöpfe (Regeln: `lib/impulseGameChain`). Die kleine Zahl an der Schnur
 * sagt, was eine ehrliche Antwort gerade wert ist. Nach jeder Antwort
 * bleibt das Ergebnis kurz stehen: grün die ehrliche, rot die Notlüge –
 * wer daneben lag, sieht, was ehrlich gewesen wäre. Jede verlorene Kette
 * bleibt um die Figur liegen, bis der Schlüssel sie sprengt.
 *
 * Am Rechner gehen die Ziffern 1 bis 3 (auch auf dem Ziffernblock) und
 * bei zwei Antworten die Pfeile links und rechts – dann stehen die
 * Ziffern auch in den Knöpfen.
 */

interface Palette {
  skyTop: string
  skyBottom: string
  bubble: string
  bubbleEdge: string
  bubbleText: string
  who: string
  button: string
  buttonEdge: string
  buttonText: string
  honest: string
  honestSoft: string
  wrong: string
  wrongSoft: string
  avatar: string
  /** Schnur, Strick, Kette – die Farbe des Rings je Stufe … */
  cord: [string, string, string]
  /** … und die der kleinen Zahl daneben (+3, +2, +1), dunkel genug für weisse Schrift. */
  badge: [string, string, string]
  /** Die Ketten, die nach einem Fehler um die Figur liegen bleiben. */
  chain: string
  timer: string
  timerLate: string
  timerTrack: string
  hud: HudColors
  muted: string
}

const LIGHT: Palette = {
  skyTop: '#f5f3ff',
  skyBottom: '#ede9fe',
  bubble: '#ffffff',
  bubbleEdge: 'rgba(124, 58, 237, 0.18)',
  bubbleText: '#1e1b4b',
  who: '#6d28d9',
  button: '#ffffff',
  buttonEdge: 'rgba(124, 58, 237, 0.28)',
  buttonText: '#1e1b4b',
  honest: '#16a34a',
  honestSoft: '#dcfce7',
  wrong: '#dc2626',
  wrongSoft: '#fee2e2',
  avatar: '#fffbeb',
  cord: ['#d6b77a', '#9a5b1e', '#334155'],
  badge: ['#7c3aed', '#b45309', '#475569'],
  chain: '#475569',
  timer: '#8b5cf6',
  timerLate: '#f97316',
  timerTrack: 'rgba(124, 58, 237, 0.14)',
  hud: {
    text: '#0f172a',
    note: '#7c3aed',
    heart: '#ef4444',
    heartEmpty: 'rgba(15, 23, 42, 0.18)',
  },
  muted: 'rgba(15, 23, 42, 0.55)',
}

const DARK: Palette = {
  skyTop: '#140b2e',
  skyBottom: '#2e1065',
  bubble: '#ffffff',
  bubbleEdge: 'rgba(255, 255, 255, 0.4)',
  bubbleText: '#1e1b4b',
  who: '#6d28d9',
  button: 'rgba(30, 27, 75, 0.92)',
  buttonEdge: 'rgba(196, 181, 253, 0.45)',
  buttonText: '#f8fafc',
  honest: '#22c55e',
  honestSoft: 'rgba(22, 101, 52, 0.92)',
  wrong: '#dc2626',
  wrongSoft: 'rgba(127, 29, 29, 0.92)',
  avatar: '#fffbeb',
  cord: ['#e7cf9c', '#c27c3a', '#94a3b8'],
  badge: ['#8b5cf6', '#c2410c', '#64748b'],
  chain: '#cbd5e1',
  timer: '#a78bfa',
  timerLate: '#fb923c',
  timerTrack: 'rgba(196, 181, 253, 0.16)',
  hud: {
    text: '#f8fafc',
    note: '#c4b5fd',
    heart: '#f87171',
    heartEmpty: 'rgba(248, 250, 252, 0.2)',
  },
  muted: 'rgba(248, 250, 252, 0.62)',
}

/** Die Gesichter der Figur – vorgezeichnet. */
const FACES = { calm: '🙂', worried: '😬', glad: '😄', sad: '😣', free: '😌' } as const
type Face = keyof typeof FACES

/** Innenabstand der Knöpfe links und rechts – dort stehen Ziffer und Haken. */
const BUTTON_PAD = 38
/** Wie lange der Hinweis am Anfang mindestens steht. */
const HINT_S = 5
/** So viele Sekunden vor Schluss wird die Uhr oben orange. */
const LATE_S = 10

interface Sprite {
  canvas: HTMLCanvasElement
  size: number
}

/** Ein Knopf, wie er gerade steht – in CSS-Pixeln. */
interface ButtonBox {
  x: number
  y: number
  w: number
  h: number
  lines: string[]
}

/** Die vorbereitete Frage: umbrochener Text und die Knöpfe. */
interface QuestionLayout {
  question: ChainQuestion
  lines: string[]
  bubbleH: number
  buttons: ButtonBox[]
}

/** Eine Kette, die eben gesprengt wurde – fliegt in Gliedern auseinander. */
interface Shatter {
  t: number
  ring: number
}

/** Text in Zeilen, die in `maxW` passen – an Leerzeichen, zur Not mitten im Wort. */
function wrapLines(g: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (g.measureText(next).width <= maxW || !line) {
      line = next
    } else {
      lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  return lines.length ? lines : ['']
}

export class ChainGame extends CanvasGame {
  private readonly colors: Palette
  private round: ChainRound
  /** Einmal mit der Tastatur gespielt: die Ziffern in den Knöpfen zeigen. */
  private showKeys = false

  /* Masse */
  private colX = 0
  private colW = 0
  private bubbleY = 0
  private avatarY = 0
  private avatarR = 0
  /** Wo die Figur steht, wenn Frage und Knöpfe Platz lassen – sie springt nicht von Frage zu Frage. */
  private homeY = 0
  private homeR = 0
  private buttonsBottom = 0
  private questionSize = 20
  private answerSize = 17

  /* Was gerade steht */
  private current: QuestionLayout | null = null
  /** Seit wann die Frage steht (Rundensekunde) – für das Auftauchen. */
  private shownAt = 0
  /** Wann das Ergebnis der letzten Antwort kam – für das Aufleuchten. */
  private judgedAt = 0
  private face: Face = 'calm'
  /** Ketten um die Figur – je verlorenes Leben eine. */
  private chains = 0
  private shatters: Shatter[] = []
  /** Die Schnur reisst: 1 → 0. */
  private snapBurst = 0
  /** Goldenes Aufleuchten beim Schlüssel: 1 → 0. */
  private freed = 0

  /* Vorgezeichnetes */
  private faces = new Map<Face, Sprite>()
  private askers = new Map<string, Sprite>()

  constructor(options: GameEngineOptions, events: GameEngineEvents) {
    super(options, events, CHAIN_LIVES)
    this.colors = options.dark ? DARK : LIGHT
    this.round = new ChainRound(this.random)
    this.boot()
  }

  /** Ein Finger auf der Leinwand (CSS-Pixel): der Knopf darunter. Daneben zählt nichts. */
  tapAt(x: number, y: number): void {
    const layout = this.current
    if (!layout || this.round.question !== layout.question) return
    const pad = 4
    const index = layout.buttons.findIndex(
      (box) =>
        x >= box.x - pad &&
        x <= box.x + box.w + pad &&
        y >= box.y - pad &&
        y <= box.y + box.h + pad,
    )
    if (index >= 0) this.choose(index)
  }

  /** Eine Taste: der Knopf direkt (0, 1, 2). */
  tapOption(option: number, fromKeyboard = false): void {
    if (fromKeyboard) this.showKeys = true
    this.choose(option)
  }

  private choose(option: number) {
    if (this.phase !== 'play' || this.isPaused) return
    const layout = this.current
    for (const event of this.round.pick(option)) {
      switch (event.kind) {
        case 'honest': {
          const box = layout?.buttons[event.option]
          this.judgedAt = this.round.time
          this.face = 'glad'
          this.snapBurst = 1
          this.burst(this.width / 2, this.avatarY, this.colors.badge[3 - event.points], 10)
          this.float(
            `+${event.points}`,
            this.width / 2 + this.avatarR * 1.3,
            this.avatarY - this.avatarR,
            this.colors.hud.note,
            22 + event.points * 2,
          )
          if (box) this.burst(box.x + box.w / 2, box.y + box.h / 2, this.colors.honest, 6)
          this.bump()
          this.options.vibrate?.(8)
          break
        }
        case 'key': {
          this.freed = 1
          this.face = 'free'
          this.float(
            'Die Wahrheit befreit!',
            this.width / 2,
            this.avatarY - this.avatarR * 1.9,
            '#d97706',
            18,
          )
          if (event.healed) {
            this.shatters.push({ t: 0, ring: this.chains - 1 })
            this.chains = Math.max(0, this.chains - 1)
            this.heal(this.round.lives, this.width / 2, this.avatarY - this.avatarR * 1.4)
          } else {
            this.float(
              `+${event.bonus}`,
              this.width / 2,
              this.avatarY + this.avatarR * 1.8,
              '#d97706',
              22,
            )
            this.bump()
          }
          this.burst(this.width / 2, this.avatarY, '#fbbf24', 16)
          this.options.vibrate?.([10, 30, 10])
          break
        }
        case 'lie':
          this.wrong('Notlüge – die Schnur wird zur Kette')
          break
      }
    }
  }

  /** Eine Notlüge oder zu langes Zögern: Die Schnur schnappt zu. */
  private wrong(reason: string) {
    this.judgedAt = this.round.time
    this.face = 'sad'
    this.chains = Math.min(CHAIN_LIVES, this.chains + 1)
    this.hurt(reason, this.round.lives)
  }

  protected get score(): number {
    return this.round.points
  }

  protected get toastY(): number {
    // Unter der Figur, über den Knöpfen – oben steht die Frage.
    const below = this.avatarY + this.avatarR * 1.45
    const buttons = this.current?.buttons[0]?.y
    return buttons === undefined ? below : Math.min(below, buttons - 32 - 16)
  }

  protected newRound(): void {
    this.round = new ChainRound(this.random)
    this.current = null
    this.face = 'calm'
    this.chains = 0
    this.shatters = []
    this.snapBurst = 0
    this.freed = 0
  }

  protected update(dt: number): void {
    for (const event of this.round.step(dt)) {
      switch (event.kind) {
        case 'ask':
          this.current = this.prepare(event.question)
          this.shownAt = this.round.time
          this.face = 'calm'
          break
        case 'timeout':
          this.wrong('Zu lange gezögert')
          break
        case 'over':
          if (event.reason === 'time')
            this.float('Zeit um!', this.width / 2, this.avatarY, this.colors.hud.note, 26)
          this.finish()
          break
      }
    }
    // Läuft die Zeit der Frage ab, wird die Figur unruhig.
    const question = this.round.question
    if (question && this.face === 'calm' && this.round.time - question.spawn > question.life * 0.67)
      this.face = 'worried'
  }

  protected tick(dt: number): void {
    this.snapBurst = Math.max(0, this.snapBurst - dt / 0.45)
    this.freed = Math.max(0, this.freed - dt / 0.8)
    for (let index = this.shatters.length - 1; index >= 0; index -= 1) {
      this.shatters[index].t += dt / 0.6
      if (this.shatters[index].t >= 1) this.shatters.splice(index, 1)
    }
  }

  protected teardown(): void {
    this.faces.clear()
    this.askers.clear()
  }

  /* ---------------------------------------------------------------- */
  /* Masse und Vorzeichnen                                             */
  /* ---------------------------------------------------------------- */

  protected layout(): void {
    this.colW = Math.min(this.width - 28, 480)
    this.colX = (this.width - this.colW) / 2
    this.questionSize = clamp(Math.round(this.width * 0.054), 19, 24)
    this.answerSize = clamp(Math.round(this.width * 0.045), 16, 20)
    this.bubbleY = this.hudBottom + 22
    this.buttonsBottom = this.height - this.options.bottomInset - 18
    // Die Figur steht zwischen einer zweizeiligen Frage und drei Knöpfen.
    const nominalBubble = 16 + 20 + 6 + 2 * Math.round(this.questionSize * 1.22) + 16
    const nominalButtons = 3 * 58 + 2 * 10
    this.placeAvatar(this.bubbleY + nominalBubble + 16, this.buttonsBottom - nominalButtons - 16)
    this.homeY = this.avatarY
    this.homeR = this.avatarR
    this.buildBackground()
    this.buildFaces()
    if (this.current) this.current = this.prepare(this.current.question)
  }

  /** Frage umbrechen, Knöpfe von unten her stapeln, die Figur in die Lücke dazwischen. */
  private prepare(question: ChainQuestion): QuestionLayout {
    const g = this.g
    const padX = 18
    g.font = `800 ${this.questionSize}px ${UI_FONT}`
    const lines = wrapLines(g, question.situation.question, this.colW - padX * 2)
    const qLine = Math.round(this.questionSize * 1.22)
    const bubbleH = 16 + 20 + 6 + lines.length * qLine + 16

    g.font = `800 ${this.answerSize}px ${UI_FONT}`
    const aLine = Math.round(this.answerSize * 1.25)
    const gap = 10
    // Links Platz für die Ziffer, rechts für Haken oder Kreuz – der Text bleibt mittig.
    const wrapped = question.options.map((option) =>
      wrapLines(g, option.text, this.colW - BUTTON_PAD * 2),
    )
    const heights = wrapped.map((entry) => Math.max(58, entry.length * aLine + 26))
    let y = this.buttonsBottom - heights.reduce((sum, h) => sum + h, 0) - gap * (heights.length - 1)
    const buttons = wrapped.map((entry, index) => {
      const box = { x: this.colX, y, w: this.colW, h: heights[index], lines: entry }
      y += heights[index] + gap
      return box
    })
    // Lange Frage oder lange Antworten auf kleinem Bildschirm: Die Figur rückt in die Lücke.
    const top = this.bubbleY + bubbleH + 16
    const bottom = buttons[0].y - 16
    if (this.homeY - this.homeR * 1.75 < top || this.homeY + this.homeR * 1.75 > bottom) {
      this.placeAvatar(top, bottom)
    } else {
      this.avatarY = this.homeY
      this.avatarR = this.homeR
    }
    return { question, lines, bubbleH, buttons }
  }

  /** Die Figur mittig in die Lücke – Platz für die Schnur rundum. */
  private placeAvatar(top: number, bottom: number) {
    const space = Math.max(70, bottom - top)
    this.avatarR = clamp(Math.min(space / 3.5, this.width * 0.17), 22, 80)
    this.avatarY = top + space / 2
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
    this.background = canvas
  }

  private buildFaces() {
    this.faces.clear()
    this.askers.clear()
    // Gross vorgezeichnet und beim Stempeln verkleinert – die Figur wechselt die Grösse je nach Platz.
    for (const face of Object.keys(FACES) as Face[]) {
      const sprite = this.emojiSprite(FACES[face], 112)
      if (sprite) this.faces.set(face, sprite)
    }
  }

  private emojiSprite(emoji: string, size: number): Sprite | null {
    const s = Math.ceil(size * 1.25)
    const layer = makeLayer(s, s, this.dpr)
    if (!layer) return null
    const { canvas, g } = layer
    g.font = `${Math.round(size)}px ${EMOJI_FONT}`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(emoji, s / 2, s / 2 + size * 0.06)
    return { canvas, size: s }
  }

  private asker(emoji: string): Sprite | null {
    let sprite = this.askers.get(emoji)
    if (!sprite) {
      sprite = this.emojiSprite(emoji, 24) ?? undefined
      if (sprite) this.askers.set(emoji, sprite)
    }
    return sprite ?? null
  }

  /* ---------------------------------------------------------------- */
  /* Zeichnen                                                          */
  /* ---------------------------------------------------------------- */

  protected renderWorld(): void {
    const g = this.g
    if (this.freed > 0) {
      g.globalAlpha = this.freed * 0.3
      g.fillStyle = '#fde68a'
      g.fillRect(-10, 0, this.width + 20, this.height)
      g.globalAlpha = 1
    }
    this.drawTimer()
    const layout = this.current
    const round = this.round
    const verdict = round.verdict
    const open = layout && round.question === layout.question
    const judged = layout && verdict?.question === layout.question
    if (layout && (open || judged)) {
      const appear = this.options.reducedMotion
        ? 1
        : easeOut(clamp((round.time - this.shownAt) / 0.22, 0, 1))
      this.drawBubble(layout, appear)
      this.drawButtons(layout, appear, judged ? verdict : null)
    }
    this.drawAvatar()
    if (this.phase === 'play' && this.round.asked <= 1) {
      const fade = clamp((HINT_S + 0.5 - round.time) / 0.5, 0, 1)
      const top = layout ? layout.buttons[0].y : this.buttonsBottom
      this.drawHint(
        'Tippe die ehrliche Antwort – bevor die Schnur zur Kette wird',
        top - 14,
        this.colors.muted,
        fade,
      )
    }
  }

  protected renderHud(): void {
    const streak = this.round.streak
    this.drawHud(this.colors.hud, this.round.lives, streak >= 3 ? `${streak} ehrlich am Stück` : '')
  }

  /** Die Minute als dünner Balken unter der Anzeige – die letzten Sekunden in Orange. */
  private drawTimer() {
    if (this.phase === 'ready') return
    const g = this.g
    const left = Math.max(0, CHAIN_ROUND_S - this.round.time)
    const late = left <= LATE_S
    const x = this.colX
    const y = this.hudBottom + 4
    const w = this.colW
    const h = 5
    g.fillStyle = this.colors.timerTrack
    roundRect(g, x, y, w, h, h / 2)
    g.fill()
    g.fillStyle = late ? this.colors.timerLate : this.colors.timer
    roundRect(g, x, y, Math.max(h, (w * left) / CHAIN_ROUND_S), h, h / 2)
    g.fill()
    if (late && this.phase === 'play') {
      g.fillStyle = this.colors.timerLate
      g.font = `900 13px ${UI_FONT}`
      g.textAlign = 'right'
      g.textBaseline = 'top'
      g.fillText(`${Math.ceil(left)} s`, x + w, y + h + 4)
    }
  }

  private drawBubble(layout: QuestionLayout, appear: number) {
    const g = this.g
    const c = this.colors
    const x = this.colX
    const y = this.bubbleY + (1 - appear) * -10
    const w = this.colW
    const h = layout.bubbleH
    g.globalAlpha = appear
    g.save()
    g.shadowColor = this.options.dark ? 'rgba(0, 0, 0, 0.45)' : 'rgba(76, 29, 149, 0.16)'
    g.shadowBlur = 16
    g.shadowOffsetY = 4
    g.fillStyle = c.bubble
    roundRect(g, x, y, w, h, 22)
    g.fill()
    g.restore()
    // Der Zipfel zeigt auf die Figur.
    g.fillStyle = c.bubble
    g.beginPath()
    g.moveTo(this.width / 2 - 12, y + h - 1)
    g.lineTo(this.width / 2, y + h + 12)
    g.lineTo(this.width / 2 + 12, y + h - 1)
    g.closePath()
    g.fill()
    g.lineWidth = 1.5
    g.strokeStyle = c.bubbleEdge
    roundRect(g, x, y, w, h, 22)
    g.stroke()

    const situation = layout.question.situation
    const sprite = this.asker(situation.emoji)
    if (sprite) g.drawImage(sprite.canvas, x + 12, y + 8, sprite.size, sprite.size)
    g.fillStyle = c.who
    g.font = `800 14px ${UI_FONT}`
    g.textAlign = 'left'
    g.textBaseline = 'middle'
    g.fillText(situation.who, x + 18 + (sprite ? sprite.size : 0), y + 26)

    g.fillStyle = c.bubbleText
    g.font = `800 ${this.questionSize}px ${UI_FONT}`
    g.textAlign = 'center'
    g.textBaseline = 'top'
    const qLine = Math.round(this.questionSize * 1.22)
    layout.lines.forEach((line, index) => {
      g.fillText(line, this.width / 2, y + 42 + index * qLine)
    })
    g.globalAlpha = 1
  }

  private drawButtons(
    layout: QuestionLayout,
    appear: number,
    verdict: { picked: number | null; honest: boolean } | null,
  ) {
    const g = this.g
    const c = this.colors
    const aLine = Math.round(this.answerSize * 1.25)
    const glow = verdict ? clamp(1 - (this.round.time - this.judgedAt) / 0.5, 0, 1) : 0
    layout.buttons.forEach((box, index) => {
      const option = layout.question.options[index]
      // Gestaffelt von unten herein.
      const k = this.options.reducedMotion
        ? appear
        : easeOut(clamp((this.round.time - this.shownAt - index * 0.06) / 0.24, 0, 1))
      const y = box.y + (1 - k) * 18
      let fill = c.button
      let edge = c.buttonEdge
      let text = c.buttonText
      let mark = ''
      let alpha = k
      if (verdict) {
        if (option.honest) {
          fill = verdict.picked === index ? c.honest : c.honestSoft
          edge = c.honest
          text = verdict.picked === index ? '#ffffff' : this.options.dark ? '#ffffff' : '#14532d'
          mark = '✓'
        } else if (verdict.picked === index) {
          fill = c.wrong
          edge = c.wrong
          text = '#ffffff'
          mark = '✗'
        } else {
          alpha = 0.4
        }
      }
      g.globalAlpha = alpha
      if (verdict && option.honest && verdict.picked !== index && glow > 0) {
        g.save()
        g.shadowColor = c.honest
        g.shadowBlur = 18 * glow
        g.fillStyle = fill
        roundRect(g, box.x, y, box.w, box.h, 18)
        g.fill()
        g.restore()
      }
      g.fillStyle = fill
      roundRect(g, box.x, y, box.w, box.h, 18)
      g.fill()
      g.lineWidth = verdict && (option.honest || verdict.picked === index) ? 3 : 2
      g.strokeStyle = edge
      roundRect(g, box.x, y, box.w, box.h, 18)
      g.stroke()

      if (this.showKeys) {
        g.fillStyle = verdict ? text : c.who
        g.font = `900 13px ${UI_FONT}`
        g.textAlign = 'center'
        g.textBaseline = 'middle'
        g.globalAlpha = alpha * 0.75
        g.fillText(String(index + 1), box.x + 18, y + box.h / 2)
        g.globalAlpha = alpha
      }
      g.fillStyle = text
      g.font = `800 ${this.answerSize}px ${UI_FONT}`
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      const cx = box.x + box.w / 2
      const top = y + box.h / 2 - ((box.lines.length - 1) * aLine) / 2
      box.lines.forEach((line, row) => g.fillText(line, cx, top + row * aLine + 0.5))
      if (mark) {
        g.font = `900 20px ${UI_FONT}`
        g.textAlign = 'right'
        g.fillText(mark, box.x + box.w - 14, y + box.h / 2 + 0.5)
      }
      if (verdict && option.honest && verdict.picked !== index) {
        // Was ehrlich gewesen wäre – klein über dem Knopf.
        g.font = `900 11px ${UI_FONT}`
        g.textAlign = 'left'
        g.textBaseline = 'middle'
        g.fillStyle = c.honest
        const label = 'EHRLICH WÄRE'
        const lw = g.measureText(label).width + 14
        g.fillStyle = c.honest
        roundRect(g, box.x + 14, y - 9, lw, 18, 9)
        g.fill()
        g.fillStyle = '#ffffff'
        g.fillText(label, box.x + 21, y + 0.5)
      }
    })
    g.globalAlpha = 1
  }

  private drawAvatar() {
    const g = this.g
    const c = this.colors
    const round = this.round
    const r = this.avatarR
    const cx = this.width / 2
    const cy = this.avatarY
    const question = round.question
    let x = cx

    // Die Schnur um die Figur – nur, solange eine Frage offen ist.
    if (question && this.phase === 'play') {
      const age = round.time - question.spawn
      const k = clamp(age / question.life, 0, 1)
      if (k > 0.8 && !this.options.reducedMotion)
        x += Math.sin(this.clock * 60) * 2 * ((k - 0.8) / 0.2)
      const stage = chainStage(age, question.life)
      const ringR = r * (1.62 - 0.36 * k)
      if (stage === 2) {
        // Die Kette: Glieder, abwechselnd von vorn und von der Seite.
        this.drawLinks(x, cy, ringR, ringR, 0, Math.round(ringR / 7), c.cord[2], 2.5 + 2 * k, 1)
      } else {
        this.drawCord(x, cy, ringR, 2.5 + 7 * k, c.cord[stage])
      }
      // Was eine ehrliche Antwort jetzt wert ist: +3, +2, +1.
      const points = chainPoints(age, question.life)
      const bx = x + ringR * 0.72
      const by = cy - ringR * 0.72
      g.fillStyle = c.badge[3 - points]
      g.beginPath()
      g.arc(bx, by, 13, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = '#ffffff'
      g.font = `900 13px ${UI_FONT}`
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText(`+${points}`, bx, by + 0.5)
    }

    // Die Schnur reisst: ein Ring, der auseinanderfliegt.
    if (this.snapBurst > 0) {
      const k = 1 - this.snapBurst
      g.globalAlpha = this.snapBurst
      g.strokeStyle = c.cord[0]
      g.lineWidth = 3
      for (let index = 0; index < 8; index += 1) {
        const a = (index / 8) * Math.PI * 2 + 0.2
        const rr = r * (1.4 + 0.9 * k)
        g.beginPath()
        g.arc(cx, cy, rr, a, a + 0.42)
        g.stroke()
      }
      g.globalAlpha = 1
    }

    // Die Figur.
    g.fillStyle = c.avatar
    g.save()
    g.shadowColor = this.options.dark ? 'rgba(0, 0, 0, 0.5)' : 'rgba(76, 29, 149, 0.22)'
    g.shadowBlur = r * 0.35
    g.shadowOffsetY = r * 0.1
    g.beginPath()
    g.arc(x, cy, r, 0, Math.PI * 2)
    g.fill()
    g.restore()
    const sprite = this.faces.get(this.face)
    if (sprite) {
      const size = (r * 1.25 * sprite.size) / 112
      g.drawImage(sprite.canvas, x - size / 2, cy - size / 2, size, size)
    }

    // Die Ketten der Fehler – quer um die Figur, bis der Schlüssel eine sprengt.
    for (let ring = 0; ring < this.chains; ring += 1) this.drawChainLoop(x, cy, ring, 1)
    for (const shatter of this.shatters)
      this.drawChainLoop(cx, cy, shatter.ring, 1 - shatter.t, shatter.t)
  }

  /** Eine Kette schräg über die Figur – `spread` lässt sie auseinanderfliegen. */
  private drawChainLoop(cx: number, cy: number, ring: number, alpha: number, spread = 0) {
    const r = this.avatarR
    const tilt = [-0.45, 0.4, 0.05][ring % 3]
    const y = cy + [-0.12, 0.14, 0.38][ring % 3] * r
    this.drawLinks(
      cx,
      y,
      r * 1.18,
      r * 0.36,
      tilt,
      16,
      this.colors.chain,
      Math.max(2.5, r * 0.07),
      alpha,
      spread,
    )
  }

  /** Eine geschlossene Kette aus `count` Gliedern auf einer Ellipse um (cx, cy), um `tilt` gedreht. */
  private drawLinks(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    tilt: number,
    count: number,
    color: string,
    width: number,
    alpha: number,
    spread = 0,
  ) {
    const g = this.g
    const n = Math.max(8, count)
    // Die Länge eines Glieds: etwas mehr als der Abstand, damit sie ineinandergreifen.
    const length = ((Math.PI * (rx + ry)) / n) * 0.72
    const cos = Math.cos(tilt)
    const sin = Math.sin(tilt)
    g.globalAlpha = clamp(alpha, 0, 1)
    g.strokeStyle = color
    g.lineWidth = width
    for (let index = 0; index < n; index += 1) {
      const a = (index / n) * Math.PI * 2
      const px = Math.cos(a) * rx
      const py = Math.sin(a) * ry
      const tangent = Math.atan2(Math.cos(a) * ry, -Math.sin(a) * rx) + tilt
      const out = spread * this.avatarR * 1.3
      g.save()
      g.translate(
        cx + px * cos - py * sin + Math.cos(a + tilt) * out,
        cy + px * sin + py * cos + Math.sin(a + tilt) * out + spread * spread * this.avatarR,
      )
      g.rotate(tangent + spread * (index % 2 ? 2 : -2))
      g.beginPath()
      // Von vorn ein offenes Oval, von der Seite ein schmaler Steg.
      g.ellipse(0, 0, length * 0.62, index % 2 ? width * 0.55 : length * 0.34, 0, 0, Math.PI * 2)
      g.stroke()
      g.restore()
    }
    g.globalAlpha = 1
  }

  /** Schnur oder Strick: ein Kreis mit schrägen Windungen – je dicker, desto deutlicher. */
  private drawCord(cx: number, cy: number, radius: number, thick: number, color: string) {
    const g = this.g
    g.strokeStyle = color
    g.lineWidth = thick
    g.beginPath()
    g.arc(cx, cy, radius, 0, Math.PI * 2)
    g.stroke()
    // Die Windungen – dunkle Striche quer über den Faden.
    const turns = Math.max(18, Math.round(radius / 3.2))
    g.strokeStyle = this.options.dark ? 'rgba(0, 0, 0, 0.35)' : 'rgba(60, 30, 0, 0.28)'
    g.lineWidth = Math.max(1, thick * 0.22)
    g.beginPath()
    for (let index = 0; index < turns; index += 1) {
      const a = (index / turns) * Math.PI * 2
      const inner = radius - thick * 0.48
      const outer = radius + thick * 0.48
      g.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner)
      g.lineTo(cx + Math.cos(a + 0.09) * outer, cy + Math.sin(a + 0.09) * outer)
    }
    g.stroke()
  }
}

/* ------------------------------------------------------------------ */
/* Die Steuerung                                                       */
/* ------------------------------------------------------------------ */

/**
 * Die Tasten je Knopf – nach der Lage auf der Tastatur (`event.code`):
 * Ziffern oben und auf dem Ziffernblock, bei zwei Antworten auch die
 * Pfeile links und rechts.
 */
const KEY_OPTIONS: Record<string, number> = {
  Digit1: 0,
  Digit2: 1,
  Digit3: 2,
  Numpad1: 0,
  Numpad2: 1,
  Numpad3: 2,
  ArrowLeft: 0,
  ArrowRight: 1,
}

/**
 * Tippen und Tasten.
 *
 * Jeder Finger zählt beim Aufsetzen; was er trifft, entscheidet das Spiel
 * (`ChainGame.tapAt`) – ein Tipp neben die Knöpfe zählt nicht. Am Rechner
 * gehen die Ziffern 1 bis 3 und die Pfeile (`KEY_OPTIONS`); mit der Maus
 * klickt man einfach.
 *
 * Gibt das Abmelden zurück.
 */
export function attachChainControls(
  surface: HTMLElement,
  handlers: { point: (x: number, y: number) => void; option: (option: number) => void },
): () => void {
  const down = (event: PointerEvent) => {
    if ((event.target as HTMLElement | null)?.closest('button, a, input')) return
    const rect = surface.getBoundingClientRect()
    handlers.point(event.clientX - rect.left, event.clientY - rect.top)
  }
  const key = (event: KeyboardEvent) => {
    if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return
    if ((event.target as HTMLElement | null)?.closest('input, textarea')) return
    const option = KEY_OPTIONS[event.code]
    if (option === undefined) return
    event.preventDefault()
    handlers.option(option)
  }
  surface.addEventListener('pointerdown', down)
  window.addEventListener('keydown', key)
  return () => {
    surface.removeEventListener('pointerdown', down)
    window.removeEventListener('keydown', key)
  }
}
