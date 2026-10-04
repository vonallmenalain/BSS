import { useId, useState, type CSSProperties } from 'react'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { seededShuffle, type ImpulseCrestStars } from '@/lib/impulse'
import { CREST_PALETTES, CREST_SYMBOLS, revealedCells } from '@/lib/impulseCrest'
import type { ImpulseCrest } from '@/lib/types'

/*
 * Das Wochen-Wappen des Bereichs «Anti Doom».
 *
 * Ein Schild im Rautenmuster – in der Heraldik heisst das «gerautet» –,
 * dessen Felder sich mit jeder geschafften Karte der Woche färben. Der
 * Rand füllt sich dazu als Linie, wie ein Ladebalken ums Schild herum.
 * Erst wenn **alles** geschafft ist, erscheint das Zeichen der Woche in
 * der Mitte, der Rand wird golden, Strahlen gehen auf und das Band mit
 * dem Spruch entrollt sich. Vorher steht dort ein Fragezeichen: Was es
 * wird, zeigt sich am Schluss.
 *
 * Wie viele Felder sich färben, hängt am Anteil, nicht an der Zahl der
 * Karten – eine Woche mit zehn Karten baut dasselbe Schild wie eine mit
 * sechzehn. Die Reihenfolge der Felder ist je Woche gemischt, aber fest
 * (`seededShuffle` mit der Woche als Schlüssel): Das Muster wächst wie
 * ein Mosaik und sieht beim Wiederkommen gleich aus.
 *
 * Bewegung zeigt den Wechsel, nicht den Bestand: Beim Öffnen steht das
 * Wappen still da. Nur Felder, die **jetzt** dazukommen, springen
 * herein – und die Feier (`celebrate`) läuft genau dann, wenn die Seite
 * sie verlangt. Die globale Regel für reduzierte Bewegung hält alles an.
 */

/* ------------------------------------------------------------------ */
/* Die Geometrie – einmal gerechnet, für jedes Wappen gleich           */
/* ------------------------------------------------------------------ */

/* Das Schild in einem Feld von 200 × 260: oben Platz für die Sterne,
   unten für das Band. */
const SHIELD_PATH =
  'M100 34 L182 58 L182 128 C182 184 146 222 100 246 C54 222 18 184 18 128 L18 58 Z'
const CENTER = { x: 100, y: 138 }

type Point = [number, number]

function cubic(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const u = 1 - t
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ]
}

/** Das Schild als Vieleck – für die Frage, welche Felder hineinfallen. */
const SHIELD_POLYGON: Point[] = (() => {
  const points: Point[] = [
    [100, 34],
    [182, 58],
    [182, 128],
  ]
  for (let i = 1; i <= 12; i += 1)
    points.push(cubic([182, 128], [182, 184], [146, 222], [100, 246], i / 12))
  for (let i = 1; i <= 12; i += 1)
    points.push(cubic([100, 246], [54, 222], [18, 184], [18, 128], i / 12))
  points.push([18, 58])
  return points
})()

function insideShield([x, y]: Point): boolean {
  let inside = false
  for (let i = 0, j = SHIELD_POLYGON.length - 1; i < SHIELD_POLYGON.length; j = i, i += 1) {
    const [xi, yi] = SHIELD_POLYGON[i]
    const [xj, yj] = SHIELD_POLYGON[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

interface CrestCell {
  path: string
  /** Welcher der drei Glastöne – fest je Feld, damit es nach Glas aussieht. */
  tone: 0 | 1 | 2
}

/*
 * Die Rauten: Reihen im Abstand von 20, versetzt um eine halbe Breite.
 * Ein Feld gehört dazu, wenn mindestens drei seiner fünf Punkte (Mitte
 * und Ecken) im Schild liegen – so ist am Rand jedes Feld noch gut zu
 * sehen, und der Zuschnitt aufs Schild (`clipPath`) erledigt den Rest.
 * Das Medaillon in der Mitte bleibt frei.
 */
const CELLS: CrestCell[] = (() => {
  const width = 32
  const height = 40
  const cells: CrestCell[] = []
  let index = 0
  for (let row = 0, cy = 40; cy < 252; row += 1, cy += height / 2) {
    for (let cx = 18 + (row % 2 === 0 ? 0 : width / 2); cx <= 182 + width / 2; cx += width) {
      const corners: Point[] = [
        [cx, cy],
        [cx, cy - height / 2],
        [cx + width / 2, cy],
        [cx, cy + height / 2],
        [cx - width / 2, cy],
      ]
      const hits = corners.filter(insideShield).length
      const nearCenter = Math.hypot(cx - CENTER.x, cy - CENTER.y) < 24
      if (hits < 3 || nearCenter) continue
      cells.push({
        path: `M${cx} ${cy - height / 2} L${cx + width / 2} ${cy} L${cx} ${cy + height / 2} L${cx - width / 2} ${cy} Z`,
        tone: ((index * 7 + row * 3) % 3) as 0 | 1 | 2,
      })
      index += 1
    }
  }
  return cells
})()

/** Die Strahlen hinter dem vollendeten Wappen – zwölf schmale Keile. */
const RAYS = Array.from({ length: 12 }, (_, index) => {
  const angle = (index * Math.PI * 2) / 12
  const spread = 0.075
  const r = 150
  const a = [CENTER.x + Math.sin(angle - spread) * r, CENTER.y - Math.cos(angle - spread) * r]
  const b = [CENTER.x + Math.sin(angle + spread) * r, CENTER.y - Math.cos(angle + spread) * r]
  return `M${CENTER.x} ${CENTER.y} L${a[0].toFixed(1)} ${a[1].toFixed(1)} L${b[0].toFixed(1)} ${b[1].toFixed(1)} Z`
})

/** Ein fünfzackiger Stern – für die Sterne über dem Wappen. */
function starPath(cx: number, cy: number, outer: number): string {
  const inner = outer * 0.45
  const points = Array.from({ length: 10 }, (_, index) => {
    const radius = index % 2 === 0 ? outer : inner
    const angle = (index * Math.PI) / 5
    return `${(cx + Math.sin(angle) * radius).toFixed(1)} ${(cy - Math.cos(angle) * radius).toFixed(1)}`
  })
  return `M${points.join(' L')} Z`
}

/* ------------------------------------------------------------------ */
/* Die Anzeige                                                         */
/* ------------------------------------------------------------------ */

export function ImpulseCrestEmblem({
  crest,
  week,
  done,
  total,
  stars = null,
  celebrate = false,
  size = 180,
  showMotto = true,
  className,
}: {
  crest: ImpulseCrest
  /** Die Woche – der Schlüssel für das Muster, in dem sich die Felder füllen. */
  week: string
  done: number
  total: number
  /** Die Sterne über dem Wappen – `null` blendet die ganze Reihe aus. */
  stars?: ImpulseCrestStars | null
  /** Die Feier abspielen: Glanz, Funken, Band – genau dann, wenn die Seite es sagt. */
  celebrate?: boolean
  /** Breite in Pixeln; die Höhe folgt dem Seitenverhältnis. */
  size?: number
  showMotto?: boolean
  className?: string
}) {
  /* Eine eigene Kennung je Wappen – mehrere auf derselben Seite dürfen
     sich ihre Verläufe und Zuschnitte nicht gegenseitig wegnehmen. Nur
     Buchstaben und Ziffern: Sie landet in `url(#…)`. */
  const uid = `crest-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const colors = CREST_PALETTES[crest.palette] ?? CREST_PALETTES.smaragd
  const Symbol = CREST_SYMBOLS[crest.symbol] ?? Star
  const complete = total > 0 && done >= total
  const count = revealedCells(done, total, CELLS.length)
  const share = total > 0 ? Math.min(done / total, 1) : 0

  /* Das Muster dieser Woche – fest gemischt. */
  const order = seededShuffle(
    CELLS.map((_, index) => index),
    `wappen:${week}`,
  )
  const rank = new Map(order.map((cellIndex, position) => [cellIndex, position]))

  /* Welche Felder eben erst dazugekommen sind: Gemerkt wird der
     zuletzt gezeigte Stand; was darüber hinaus geht, springt herein. */
  const [shown, setShown] = useState(count)
  const [fresh, setFresh] = useState<{ from: number; to: number } | null>(null)
  if (count !== shown) {
    setFresh(count > shown ? { from: shown, to: count } : null)
    setShown(count)
  }

  const small = size < 72
  const visibleStars = stars
    ? (
        [
          ['sunday', stars.sunday],
          ['goal', stars.goal],
          ['challenge', stars.challenge],
        ] as const
      ).filter(([, value]) => value !== null)
    : []
  const motto = crest.motto.trim()
  const mottoSize = Math.min(12, 150 / Math.max(motto.length * 0.62, 1))

  return (
    <div
      className={cn('relative inline-block shrink-0', className)}
      style={{ width: size, height: (size * 260) / 200 }}
    >
      <svg
        viewBox="0 0 200 260"
        width={size}
        height={(size * 260) / 200}
        role="img"
        aria-label={
          complete
            ? `Wochen-Wappen vollendet${motto ? `: ${motto}` : ''}`
            : `Wochen-Wappen: ${done} von ${total} Karten geschafft`
        }
        className="overflow-visible"
      >
        <defs>
          <clipPath id={`${uid}-clip`}>
            <path d={SHIELD_PATH} />
          </clipPath>
          <linearGradient id={`${uid}-gold`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fde68a" />
            <stop offset="45%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>
          <radialGradient id={`${uid}-medal`} cx="50%" cy="40%" r="65%">
            <stop offset="0%" stopColor={complete ? '#fffbeb' : '#334155'} />
            <stop offset="100%" stopColor={complete ? '#f59e0b' : '#0f172a'} />
          </radialGradient>
          <radialGradient
            id={`${uid}-rays`}
            cx={CENTER.x}
            cy={CENTER.y}
            r={150}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="15%" stopColor={colors.glow} stopOpacity="0.55" />
            <stop offset="100%" stopColor={colors.glow} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${uid}-gloss`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
            <stop offset="45%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${uid}-shine`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Die Strahlen – nur hinter dem vollendeten Wappen. */}
        {complete && !small && (
          <g
            className="animate-imp-spin"
            style={{ transformOrigin: `${CENTER.x}px ${CENTER.y}px` }}
          >
            {RAYS.map((ray, index) => (
              <path key={index} d={ray} fill={`url(#${uid}-rays)`} />
            ))}
          </g>
        )}

        {/* Der Grund des Schilds – der «Bauplan», auf dem sich alles füllt. */}
        <path d={SHIELD_PATH} fill="#0f172a" />
        <g clipPath={`url(#${uid}-clip)`}>
          {CELLS.map((cell, index) => {
            const position = rank.get(index) ?? index
            const lit = position < count
            const isFresh = lit && fresh !== null && position >= fresh.from && position < fresh.to
            const fill = [colors.deep, colors.mid, colors.light][cell.tone]
            return (
              <path
                key={index}
                d={cell.path}
                fill={lit ? fill : '#1e293b'}
                stroke={lit ? 'rgba(15,23,42,0.55)' : 'rgba(148,163,184,0.18)'}
                strokeWidth={small ? 2.5 : 1.5}
                className={isFresh ? 'animate-imp-cell' : undefined}
                style={
                  isFresh
                    ? ({
                        transformBox: 'fill-box',
                        transformOrigin: 'center',
                        animationDelay: `${Math.min(position - (fresh?.from ?? 0), 8) * 70}ms`,
                      } as CSSProperties)
                    : undefined
                }
              />
            )
          })}
          {/* Ein Hauch Licht von oben – Glas, nicht Plastik. */}
          <path d={SHIELD_PATH} fill={`url(#${uid}-gloss)`} />
          {celebrate && complete && (
            <path
              d="M-60 20 L-10 20 L-60 260 L-110 260 Z"
              fill={`url(#${uid}-shine)`}
              className="animate-imp-shine"
            />
          )}
        </g>

        {/* Der Rand: grau als Bahn, darüber die Linie des Fortschritts –
            golden, sobald das Wappen vollendet ist. */}
        <path d={SHIELD_PATH} fill="none" stroke="#334155" strokeWidth={small ? 10 : 6} />
        <path
          d={SHIELD_PATH}
          fill="none"
          pathLength={100}
          stroke={complete ? `url(#${uid}-gold)` : colors.light}
          strokeWidth={small ? 10 : 6}
          strokeLinejoin="round"
          strokeDasharray={100}
          strokeDashoffset={100 - share * 100}
          className="imp-crest-rim"
        />

        {/* Das Medaillon: ein Fragezeichen, bis alles geschafft ist. */}
        <circle
          cx={CENTER.x}
          cy={CENTER.y}
          r={24}
          fill={`url(#${uid}-medal)`}
          stroke={complete ? '#fde68a' : '#475569'}
          strokeWidth={3}
        />
        {complete ? (
          <g
            className={celebrate ? 'animate-imp-medal' : undefined}
            style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          >
            <Symbol
              x={CENTER.x - 15}
              y={CENTER.y - 15}
              width={30}
              height={30}
              color="#78350f"
              strokeWidth={2.4}
              aria-hidden
            />
          </g>
        ) : (
          <text
            x={CENTER.x}
            y={CENTER.y + 9}
            textAnchor="middle"
            fontSize={26}
            fontWeight={800}
            fill="#94a3b8"
          >
            ?
          </text>
        )}

        {/* Die Sterne: vor Sonntag vollendet, Wochenziel, Tages-Challenge. */}
        {!small &&
          visibleStars.map(([key, earned], index) => {
            const spacing = 30
            const cx = CENTER.x + (index - (visibleStars.length - 1) / 2) * spacing
            return (
              <path
                key={key}
                d={starPath(cx, 16, 11)}
                fill={earned ? '#fbbf24' : 'none'}
                stroke={earned ? '#b45309' : '#64748b'}
                strokeWidth={1.5}
                strokeLinejoin="round"
              />
            )
          })}

        {/* Das Band mit dem Spruch – es entrollt sich mit der Vollendung. */}
        {complete && showMotto && motto && !small && (
          <g
            className={celebrate ? 'animate-imp-unfurl' : undefined}
            style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          >
            <path d="M14 226 H186 L176 240 L186 254 H14 L24 240 Z" fill={colors.deep} />
            <path d="M30 228 H170 V252 H30 Z" fill={colors.mid} />
            <text
              x={100}
              y={244}
              textAnchor="middle"
              fontSize={mottoSize}
              fontWeight={700}
              letterSpacing={0.6}
              fill="#ffffff"
            >
              {motto.toLocaleUpperCase('de-CH')}
            </text>
          </g>
        )}
      </svg>

      {/* Die Funken der Feier – ein einziger Ausbruch aus der Mitte. */}
      {celebrate && complete && !small && (
        <span aria-hidden className="pointer-events-none absolute inset-0">
          {Array.from({ length: 18 }, (_, index) => {
            const angle = (index / 18) * Math.PI * 2
            const distance = size * (0.45 + (index % 3) * 0.12)
            return (
              <span
                key={index}
                className="animate-imp-burst absolute size-2 rounded-full"
                style={
                  {
                    left: '50%',
                    top: `${(CENTER.y / 260) * 100}%`,
                    background:
                      index % 3 === 0 ? '#fbbf24' : index % 3 === 1 ? colors.light : colors.glow,
                    '--imp-dx': `${Math.sin(angle) * distance}px`,
                    '--imp-dy': `${-Math.cos(angle) * distance}px`,
                    animationDelay: `${(index % 4) * 40}ms`,
                  } as CSSProperties
                }
              />
            )
          })}
        </span>
      )}
    </div>
  )
}
