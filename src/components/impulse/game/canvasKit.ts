/*
 * Was alle Minispiele auf der Leinwand teilen: die Schnittstelle zur
 * Bühne, die Schriften, ein paar Masse und kleine Zeichenhelfer.
 *
 * Jedes Spiel ist eine eigene Klasse mit eigenem Bild – aber die Bühne
 * (`ImpulseGameStage`) spricht mit allen gleich: starten, anhalten,
 * weiter, abbrechen, Grösse ändern, abbauen (`GameEngine`). Welches
 * Spiel auf die Leinwand kommt, sagt `games.ts`.
 */

export interface GameEngineOptions {
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

export interface GameEngineEvents {
  /** Die Runde ist vorbei – nach dem letzten Leben und dem Ausklang. */
  onEnd: (points: number) => void
}

/** Was die Bühne von jedem Spiel braucht. */
export interface GameEngine {
  /** Die Runde beginnt – von vorn, auch nach einer früheren. */
  start(): void
  /** Anhalten – etwa wenn das Telefon die App in den Hintergrund schickt. */
  pause(): void
  resume(): void
  /** Abbrechen: Die Runde endet sofort, ohne Ausklang – zurück kommen die Punkte bis hier. */
  stop(): number
  /** Die Leinwand hat eine neue Grösse – beim Drehen des Telefons. */
  resize(): void
  destroy(): void
  readonly isPaused: boolean
  readonly isPlaying: boolean
}

/** Länger als das rechnet ein einzelner Schritt nie – nach einem Tabwechsel. */
export const MAX_STEP = 0.05
/** Schärfer sieht niemand – jede Stufe mehr kostet die Grafik ein Vielfaches. */
export const MAX_DPR = 2

export const EMOJI_FONT =
  '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Segoe UI Symbol",sans-serif'
export const UI_FONT =
  'ui-rounded,"SF Pro Rounded",system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif'

export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value))
export const easeOut = (k: number) => 1 - (1 - k) * (1 - k)
export const easeIn = (k: number) => k * k

/** Ein Rechteck mit runden Ecken – ohne `roundRect`, das ältere Browser nicht kennen. */
export function roundRect(
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
export function drawHeart(
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

/**
 * Eine zweite Leinwand zum Vorzeichnen, in CSS-Pixeln skaliert. Was
 * darauf liegt, wird danach nur noch gestempelt – Schatten, Verläufe und
 * Emoji je Bild neu zu zeichnen kostet ein Vielfaches.
 */
export function makeLayer(
  width: number,
  height: number,
  dpr: number,
): { canvas: HTMLCanvasElement; g: CanvasRenderingContext2D } | null {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.ceil(width * dpr))
  canvas.height = Math.max(1, Math.ceil(height * dpr))
  const g = canvas.getContext('2d')
  if (!g) return null
  g.scale(dpr, dpr)
  return { canvas, g }
}

/**
 * Ein Emoji auf einer Scheibe, darunter das Wort auf einer dunklen
 * Kapsel – wie bei «Gut für dich?», auf jedem Hintergrund lesbar.
 * `centerY` sagt, wo im Bild die Mitte der Scheibe liegt.
 */
export function emojiBadge(
  dpr: number,
  r: number,
  emoji: string,
  label: string,
  style: {
    /** Die Scheibe – Farbe oder Verlauf, den die Funktion erst baut. */
    fill: (
      g: CanvasRenderingContext2D,
      cx: number,
      cy: number,
      r: number,
    ) => string | CanvasGradient
    ring?: string
    shadow: string
    labelFill: string
    labelText: string
  },
): { canvas: HTMLCanvasElement; w: number; h: number; centerY: number } | null {
  const pad = Math.ceil(r * 0.45)
  const labelSize = Math.round(clamp(r * 0.36, 10, 14))
  const labelH = label ? labelSize + 8 : 0
  const probe = document.createElement('canvas').getContext('2d')
  if (probe) probe.font = `700 ${labelSize}px ${UI_FONT}`
  const textW = label && probe ? probe.measureText(label).width : 0
  const w = Math.ceil(Math.max(r * 2 + pad * 2, textW + 22))
  const h = Math.ceil(r * 2 + pad * 2 + labelH * 0.75)
  const layer = makeLayer(w, h, dpr)
  if (!layer) return null
  const { canvas, g } = layer
  const cx = w / 2
  const cy = pad + r
  g.save()
  g.shadowColor = style.shadow
  g.shadowBlur = r * 0.4
  g.shadowOffsetY = r * 0.12
  g.fillStyle = style.fill(g, cx, cy, r)
  g.beginPath()
  g.arc(cx, cy, r, 0, Math.PI * 2)
  g.fill()
  g.restore()
  if (style.ring) {
    g.strokeStyle = style.ring
    g.lineWidth = Math.max(2, r * 0.09)
    g.beginPath()
    g.arc(cx, cy, r - g.lineWidth / 2, 0, Math.PI * 2)
    g.stroke()
  }
  g.font = `${Math.round(r * 1.08)}px ${EMOJI_FONT}`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(emoji, cx, cy + r * 0.06)
  if (label) {
    g.font = `700 ${labelSize}px ${UI_FONT}`
    const pillW = textW + 14
    const pillY = cy + r - labelH * 0.25
    g.fillStyle = style.labelFill
    roundRect(g, cx - pillW / 2, pillY, pillW, labelH, labelH / 2)
    g.fill()
    g.fillStyle = style.labelText
    g.fillText(label, cx, pillY + labelH / 2 + 0.5)
  }
  return { canvas, w, h, centerY: cy }
}
