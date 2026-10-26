import React, { useMemo } from 'react'
import { AbsoluteFill, Easing, interpolate, random, spring, useCurrentFrame } from 'remotion'
import { useLook } from '../../looks'
import { Sfx, beat, voiceFrame } from '../../lib/sfx'
import { FPS, type TimelineScene } from '../../lib/timing'
import type { Scene as SceneSpec } from '../../schema'

/*
 * Game-Look: Vorschau auf das Minispiel «Bücherturm». In der Mitte ein Spielfeld wie auf dem
 * Telefon – Bibliothek bei Nacht, Schreibtisch mit Lampe, darauf der Turm aus den Büchern der
 * Schriften, jedes mit seinem Namen auf dem Rücken. Darüber schwebt das nächste Buch hin und
 * her; ein Finger tippt, das Buch fällt. Etappen: `names` (die ersten Bücher fallen, während
 * die Stimme sie nennt), `play` (schweben, tippen, genau drauf), `topple` (der schiefe Turm
 * wackelt und kippt, ein Herz geht), `complete` (das ganze Buch Mormon, ein Leben zurück).
 * Gezeichnet wie im Spiel (`src/components/impulse/game/stackGame.ts` der App).
 */

type StackSceneT = Extract<SceneSpec, { type: 'stack' }>
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const
const PIXEL = '"Press Start 2P"'

/* Das Spielfeld */
const PX = 110
const PY = 300
const PW = 860
const PH = 880
const DESK = PY + PH - 118
const CX = PX + PW / 2

/* Kapitel je Buch – sie machen ein Buch dick oder dünn, wie im Spiel */
const CHAPTERS: Record<string, number> = {
  '1 Nephi': 22,
  '2 Nephi': 33,
  Jakob: 7,
  Enos: 1,
  Jarom: 1,
  Omni: 1,
  'Worte Mormons': 1,
  Mosia: 29,
  Alma: 63,
  Helaman: 16,
  '3 Nephi': 30,
  '4 Nephi': 1,
  Mormon: 9,
  Ether: 15,
  Moroni: 10,
}
const thickness = (label: string) =>
  Math.min(0.32, Math.max(0.15, 0.13 + 0.018 * Math.sqrt(CHAPTERS[label] ?? 12)))
const COVER = '#27427E'
const GOLD = '#F6D98E'
const BAND = '#D6AD55'

/** So lange fällt ein Buch – es landet genau auf seiner Phrase. */
const DROP = 0.24

const Defs: React.FC = () => (
  <defs>
    <linearGradient id="stkWall" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#1D1730" />
      <stop offset="100%" stopColor="#2B2034" />
    </linearGradient>
    <linearGradient id="stkBook" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#4A64A0" />
      <stop offset="45%" stopColor={COVER} />
      <stop offset="100%" stopColor="#1B2E5A" />
    </linearGradient>
    <radialGradient id="stkLamp" cx="0.5" cy="0.75" r="0.6">
      <stop offset="0%" stopColor="#FFC878" stopOpacity="0.32" />
      <stop offset="100%" stopColor="#FFC878" stopOpacity="0" />
    </radialGradient>
    <clipPath id="stkClip">
      <rect x={PX} y={PY} width={PW} height={PH} rx={44} />
    </clipPath>
  </defs>
)

/** Ein Buchrücken, Mitte unten auf (x, y). */
const Book: React.FC<{
  label: string
  x: number
  y: number
  u: number
  glow?: number
  squash?: number
  angle?: number
  pivot?: [number, number]
}> = ({ label, x, y, u, glow = 0, squash = 1, angle = 0, pivot }) => {
  const h = thickness(label) * u * squash
  const w = u
  const left = x - w / 2
  const top = y - h
  const size = Math.min(h * 0.52, u * 0.13, (w * 0.7) / Math.max(4, label.length * 0.56))
  const rotate = angle && pivot ? `rotate(${angle} ${pivot[0]} ${pivot[1]})` : undefined
  return (
    <g transform={rotate}>
      {glow > 0 ? (
        <rect
          x={left - 10}
          y={top - 10}
          width={w + 20}
          height={h + 20}
          rx={16}
          fill="#FBBF24"
          opacity={0.6 * glow}
        />
      ) : null}
      <rect x={left} y={top + 5} width={w} height={h} rx={10} fill="rgba(0,0,0,0.35)" />
      <rect
        x={left}
        y={top}
        width={w}
        height={h}
        rx={10}
        fill="url(#stkBook)"
        stroke="rgba(0,0,0,0.4)"
        strokeWidth={2}
      />
      {[0.07, 0.93].map((k) => (
        <rect
          key={k}
          x={left + w * k - 4}
          y={top + 4}
          width={8}
          height={Math.max(0, h - 8)}
          fill={BAND}
        />
      ))}
      {[0.11, 0.89].map((k) => (
        <rect
          key={k}
          x={left + w * k - 2}
          y={top + 6}
          width={4}
          height={Math.max(0, h - 12)}
          fill={BAND}
          opacity={0.55}
        />
      ))}
      <rect
        x={left + 8}
        y={top + 4}
        width={w - 16}
        height={Math.max(2, h * 0.12)}
        fill="#FFFFFF"
        opacity={0.16}
      />
      <text
        x={x}
        y={top + h / 2 + size * 0.36}
        textAnchor="middle"
        fontFamily="Inter"
        fontWeight={800}
        fontSize={size}
        fill={GOLD}
      >
        {label}
      </text>
    </g>
  )
}

/** Das Spielfeld: Wand, Regale, Fenster, Tisch und Lampe. */
const Room: React.FC = () => {
  const shelves = useMemo(() => {
    const out: Array<{ x: number; y: number; w: number; h: number; c: string }> = []
    const colors = [
      '#9A3412',
      '#1E3A8A',
      '#166534',
      '#854D0E',
      '#5B21B6',
      '#9F1239',
      '#115E59',
      '#3730A3',
    ]
    for (const side of [0, 1]) {
      for (let row = 0; row < 4; row += 1) {
        let x = side === 0 ? PX + 6 : PX + PW - 120
        const base = PY + 190 + row * 190
        while (x < (side === 0 ? PX + 120 : PX + PW - 8)) {
          const w = 10 + Math.round(random(`sw${side}${row}${x}`) * 14)
          const h = 90 + random(`sh${side}${row}${x}`) * 70
          out.push({
            x,
            y: base - h,
            w,
            h,
            c: colors[Math.floor(random(`sc${side}${row}${x}`) * colors.length)],
          })
          x += w + 2
        }
      }
    }
    return out
  }, [])
  return (
    <g>
      <rect x={PX} y={PY} width={PW} height={PH} fill="url(#stkWall)" />
      {/* Regale */}
      {[PX, PX + PW - 126].map((x) => (
        <rect key={x} x={x} y={PY} width={126} height={PH} fill="#2E1F14" opacity={0.75} />
      ))}
      {shelves.map((b, i) => (
        <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} fill={b.c} opacity={0.5} />
      ))}
      {[0, 1, 2, 3].map((row) =>
        [PX, PX + PW - 126].map((x) => (
          <rect
            key={`${row}${x}`}
            x={x}
            y={PY + 190 + row * 190}
            width={126}
            height={12}
            fill="#4A3322"
            opacity={0.85}
          />
        )),
      )}
      {/* Fenster mit Mond */}
      <g opacity={0.9}>
        <rect x={CX - 170} y={PY + 150} width={340} height={380} rx={14} fill="#4A3322" />
        <rect x={CX - 154} y={PY + 166} width={308} height={348} rx={8} fill="#141A3E" />
        <circle cx={CX + 60} cy={PY + 260} r={40} fill="#FFF1C4" />
        <rect x={CX - 6} y={PY + 166} width={12} height={348} fill="#4A3322" />
        <rect x={CX - 154} y={PY + 334} width={308} height={12} fill="#4A3322" />
      </g>
      {/* Schein der Lampe */}
      <ellipse cx={PX + 190} cy={DESK - 120} rx={330} ry={240} fill="url(#stkLamp)" />
    </g>
  )
}

/** Tisch und Lampe – sie rücken mit dem Turm nach unten, wenn er hoch wird. */
const Desk: React.FC = () => (
  <g>
    {/* Tisch */}
    <rect x={PX} y={DESK} width={PW} height={24} fill="#6B4426" />
    <rect x={PX} y={DESK + 24} width={PW} height={PH} fill="#4A2C16" />
    <rect x={PX} y={DESK + 24} width={PW} height={3} fill="#2A170A" />
    <rect x={CX - 270} y={DESK + 56} width={90} height={12} rx={6} fill="#2A170A" />
    <rect x={CX + 180} y={DESK + 56} width={90} height={12} rx={6} fill="#2A170A" />
    {/* Lampe */}
    <ellipse cx={PX + 150} cy={DESK - 4} rx={58} ry={14} fill="#C7A24A" />
    <path
      d={`M ${PX + 150} ${DESK - 10} L ${PX + 128} ${DESK - 190} L ${PX + 226} ${DESK - 290}`}
      stroke="#C7A24A"
      strokeWidth={11}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx={PX + 128} cy={DESK - 190} r={11} fill="#C7A24A" />
    <g transform={`translate(${PX + 236} ${DESK - 282}) rotate(28)`}>
      <path d="M -26 -18 L 26 -18 L 60 44 L -60 44 Z" fill="#2F6B4F" />
      <rect x={-56} y={40} width={112} height={8} fill="#FFF0C8" opacity={0.9} />
    </g>
  </g>
)

const Heart: React.FC<{ x: number; y: number; s: number; on: boolean; pop: number }> = ({
  x,
  y,
  s,
  on,
  pop,
}) => {
  const k = s * (1 + 0.35 * pop)
  return (
    <path
      transform={`translate(${x} ${y}) scale(${k / 24})`}
      d="M 0 10 C -15 0 -9 -14 0 -6 C 9 -14 15 0 0 10 Z"
      fill={on ? '#F87171' : 'rgba(253,246,227,0.22)'}
      style={on ? { filter: 'drop-shadow(0 0 8px rgba(248,113,113,0.8))' } : undefined}
    />
  )
}

type Drop = { label: string; land: number; x: number; perfect: boolean; points: number }

export const Scene: React.FC<{ ts: TimelineScene }> = ({ ts }) => {
  const s = ts.scene as StackSceneT
  const frame = useCurrentFrame()
  const look = useLook()
  const t = (frame - ts.audioOffsetFrames) / FPS
  const u = s.stage === 'complete' ? 200 : 300
  const entry = spring({ frame, fps: FPS, config: { damping: 16, stiffness: 120 } })

  /* Wo jedes Buch liegt – und wann die fallenden landen */
  const plan = useMemo(() => {
    let x = CX
    let chain = 0
    let fallback = 0.5
    return s.books.map((b, i) => {
      x += i === 0 ? b.offset * u : b.offset * u
      const land = b.at ? beat(ts, b.at, fallback) : -Infinity
      if (b.at) fallback = land + 0.9
      chain = b.perfect ? chain + 1 : 0
      return {
        label: b.label,
        land,
        x,
        perfect: b.perfect,
        points: 1 + (b.perfect ? Math.min(4, chain) : 0),
      } satisfies Drop
    })
  }, [s.books, ts, u])

  /* Die Takte der Etappe */
  const cue = (i: number, fallback: number) =>
    s.cues[i] ? beat(ts, s.cues[i], fallback) : fallback
  const c0 = cue(0, 0.6)
  const c1 = cue(1, 1.6)
  const c2 = cue(2, 2.6)

  /* Kippen: ab dem dritten Buch fällt alles nach rechts aus dem Bild */
  const toppleAt = s.stage === 'topple' ? c1 : Infinity
  const fallLevel = 2
  const wobble = s.stage === 'topple' ? interpolate(t, [c0 - 0.2, c1], [0.25, 1], clamp) : 0
  const fallT = Math.max(0, t - toppleAt)

  /* Leben: Beim Kippen geht eines, beim Buch Mormon kommt eines zurück */
  const lifeLost = s.stage === 'topple' && t >= c2
  const lifeBack = s.stage === 'complete' && t >= c2
  const lives = s.lives - (lifeLost ? 1 : 0) + (lifeBack ? 1 : 0)
  const heartPop = lifeLost
    ? Math.max(0, 1 - (t - c2) / 0.4)
    : lifeBack
      ? Math.max(0, 1 - (t - c2) / 0.4)
      : 0

  /* Punkte */
  const score =
    s.score +
    plan.filter((d) => t >= d.land && Number.isFinite(d.land)).reduce((a, d) => a + d.points, 0) +
    (lifeBack ? 5 : 0)

  /* Der Turm, von unten nach oben */
  let bottom = DESK
  const placed: React.ReactNode[] = []
  let topY = DESK
  let topX = CX
  let next: Drop | null = null
  const pivot: [number, number] = [0, 0]
  plan.forEach((d, i) => {
    const h = thickness(d.label) * u
    if (t < d.land - DROP) {
      if (!next) next = d
      return
    }
    const k = Math.min(1, Math.max(0, (t - (d.land - DROP)) / DROP))
    const falling = k < 1
    const y = falling ? bottom - 150 + 150 * Easing.in(Easing.quad)(k) : bottom
    const age = t - d.land
    const squash = !falling && age < 0.12 ? 1 - 0.1 * (1 - age / 0.12) : 1
    const glow = d.perfect && !falling ? Math.max(0, 1 - age / 0.45) : 0
    let angle = 0
    let dx = 0
    let dy = 0
    if (s.stage === 'topple' && i >= fallLevel) {
      if (i === fallLevel && pivot[0] === 0) {
        pivot[0] = plan[i - 1].x + u / 2
        pivot[1] = bottom
      }
      if (fallT > 0) {
        angle = 70 * fallT * fallT + 25 * fallT
        dx = 260 * fallT + 120 * fallT * fallT
        dy = 900 * fallT * fallT
      } else {
        angle = 2.4 * wobble * (0.55 + 0.45 * Math.sin(t * 15))
      }
    }
    placed.push(
      <g key={i} transform={`translate(${dx} ${dy})`}>
        <Book
          label={d.label}
          x={d.x}
          y={y}
          u={u}
          glow={glow}
          squash={squash}
          angle={angle}
          pivot={pivot}
        />
      </g>,
    )
    bottom = y - h * squash
    if (!falling) {
      topY = bottom
      topX = d.x
    }
  })

  /* Das schwebende Buch: das nächste, das fallen wird – oder `hover` */
  const pending: Drop | null = next
  const hoverLabel = pending ? (pending as Drop).label : s.hover
  const hoverY = topY - 120
  /* Wird der Turm hoch, rückt alles nach unten – wie die Kamera im Spiel. Gemessen am fertigen Turm, damit nichts springt. */
  const finalTop = plan.reduce((y, d) => y - thickness(d.label) * u, DESK)
  const shift = Math.max(0, PY + 250 - (finalTop - 120))
  let hover: React.ReactNode = null
  if (hoverLabel && !(s.stage === 'topple' && fallT > 0)) {
    const target = pending ? (pending as Drop).x : topX
    const phase = pending ? (t - ((pending as Drop).land - DROP)) / 1.8 : t / 1.8
    const x = target + 0.42 * u * Math.sin(phase * Math.PI * 2)
    const tilt = 4 * Math.cos(phase * Math.PI * 2)
    hover = (
      <g transform={`rotate(${tilt} ${x} ${hoverY})`}>
        <path
          d={`M ${x - u * 0.22} ${hoverY} q ${-tilt * 3} 18 ${-tilt * 6} 34`}
          stroke="#E0383F"
          strokeWidth={7}
          fill="none"
          strokeLinecap="round"
        />
        <Book label={hoverLabel} x={x} y={hoverY} u={u} />
      </g>
    )
  }

  /* Der Finger, der tippt */
  const taps = plan.filter((d) => Number.isFinite(d.land)).map((d) => d.land - DROP)
  const lastTap = taps.filter((x) => x <= t).pop()
  const tapAge = lastTap !== undefined ? t - lastTap : Infinity

  /* Texte, die aufploppen */
  const floaters = plan
    .filter((d) => Number.isFinite(d.land) && t >= d.land && t < d.land + 0.9)
    .map((d) => {
      const age = t - d.land
      return { d, age }
    })

  /* Die Reihenfolge als Leiste über dem Spielfeld (Etappe play, erster Takt) */
  const order = ['1 Nephi', '2 Nephi', 'Jakob', 'Enos', 'Jarom', 'Omni', '…']
  const orderIn =
    s.stage === 'play' && s.cues.length > 0
      ? spring({
          frame: frame - voiceFrame(ts, c0),
          fps: FPS,
          config: { damping: 14, stiffness: 160 },
        })
      : 0

  /* Buch Mormon komplett */
  const bracketIn = s.stage === 'complete' ? interpolate(t, [c0, c0 + 0.5], [0, 1], clamp) : 0
  const bannerIn =
    s.stage === 'complete'
      ? spring({
          frame: frame - voiceFrame(ts, c2),
          fps: FPS,
          config: { damping: 11, stiffness: 180 },
        })
      : 0
  const have = plan.filter((d) => !Number.isFinite(d.land) || t >= d.land).length

  return (
    <AbsoluteFill style={{ opacity: entry, transform: `scale(${0.94 + 0.06 * entry})` }}>
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
        <Defs />
        {/* Rahmen wie ein Bildschirm */}
        <rect
          x={PX - 14}
          y={PY - 14}
          width={PW + 28}
          height={PH + 28}
          rx={56}
          fill="#0B0618"
          stroke={look.accent2}
          strokeWidth={4}
          opacity={0.9}
        />
        <g clipPath="url(#stkClip)">
          <Room />
          <g transform={`translate(0 ${shift})`}>
            <Desk />
            {/* Klammer «Buch Mormon» */}
            {bracketIn > 0 ? (
              <g opacity={bracketIn}>
                <path
                  d={`M ${CX - u / 2 - 18} ${DESK - 4} L ${CX - u / 2 - 34} ${DESK - 4} L ${CX - u / 2 - 34} ${topY + 4} L ${CX - u / 2 - 18} ${topY + 4}`}
                  stroke="#8EA6E8"
                  strokeWidth={5}
                  fill="none"
                />
                <text
                  transform={`translate(${CX - u / 2 - 52} ${(DESK + topY) / 2}) rotate(-90)`}
                  textAnchor="middle"
                  fontFamily="Inter"
                  fontWeight={800}
                  fontSize={30}
                  letterSpacing={3}
                  fill="#8EA6E8"
                >
                  BUCH MORMON
                </text>
              </g>
            ) : null}
            {placed}
            {hover}
            {/* Was ein Treffer bringt */}
            {floaters.map(({ d, age }, i) => (
              <g
                key={i}
                opacity={Math.max(0, 1 - age / 0.9)}
                transform={`translate(0 ${-age * 70})`}
              >
                <text
                  x={d.x + u * 0.5 + 30}
                  y={topY + 10}
                  fontFamily={PIXEL}
                  fontSize={34}
                  fill="#FCD34D"
                >
                  +{d.points}
                </text>
              </g>
            ))}
          </g>
          {/* «Genau!» gross unter den Herzen, wo nichts im Weg ist */}
          {floaters
            .filter(({ d }) => d.perfect)
            .map(({ d, age }, i) => (
              <g
                key={i}
                opacity={Math.max(0, 1 - age / 0.9)}
                transform={`translate(${CX} ${PY + 210}) scale(${1 + 0.25 * Math.max(0, 1 - age / 0.15)})`}
              >
                <rect x={-250} y={-46} width={500} height={70} rx={14} fill="rgba(11,6,24,0.75)" />
                <text
                  x={0}
                  y={2}
                  textAnchor="middle"
                  fontFamily={PIXEL}
                  fontSize={38}
                  fill="#FBBF24"
                  style={{ filter: 'drop-shadow(0 0 10px rgba(251,191,36,0.8))' }}
                >
                  {d.points > 2 ? `GENAU! ${d.points - 1}×` : 'GENAU!'}
                </text>
              </g>
            ))}
          {/* Oben im Spielfeld: Punkte, Herzen, Sammlung */}
          <text
            x={PX + 44}
            y={PY + 96}
            fontFamily="Inter"
            fontWeight={800}
            fontSize={72}
            fill="#FDF6E3"
          >
            {score}
          </text>
          <text
            x={PX + 46}
            y={PY + 136}
            fontFamily="Inter"
            fontWeight={800}
            fontSize={26}
            fill="#FCD34D"
          >
            {`${Math.min(15, have)}/15 Buch Mormon`}
          </text>
          {[0, 1, 2].map((k) => (
            <Heart
              key={k}
              x={CX - 70 + k * 70}
              y={PY + 74}
              s={44}
              on={k < lives}
              pop={(lifeLost && k === lives) || (lifeBack && k === lives - 1) ? heartPop : 0}
            />
          ))}
          {/* Banner */}
          {bannerIn > 0 ? (
            <g
              transform={`translate(${CX} ${PY + 220}) scale(${0.6 + 0.4 * bannerIn})`}
              opacity={Math.min(1, bannerIn * 1.4)}
            >
              <rect
                x={-330}
                y={-42}
                width={660}
                height={84}
                rx={42}
                fill="rgba(120,53,15,0.95)"
                stroke="#F59E0B"
                strokeWidth={4}
              />
              <text
                x={0}
                y={14}
                textAnchor="middle"
                fontFamily="Inter"
                fontWeight={900}
                fontSize={40}
                fill="#FDE68A"
              >
                Buch Mormon komplett!
              </text>
            </g>
          ) : null}
          {bannerIn > 0
            ? Array.from({ length: 26 }, (_, i) => {
                const age = t - c2
                const a = random(`cf${i}`) * Math.PI * 2
                const v = 260 + random(`cv${i}`) * 380
                const x = CX + Math.cos(a) * v * age
                const y = PY + 220 + Math.sin(a) * v * age + 500 * age * age
                return (
                  <rect
                    key={i}
                    x={x}
                    y={y}
                    width={14}
                    height={8}
                    fill={['#FBBF24', '#F472B6', '#5CF3FF', '#4ADE80'][i % 4]}
                    transform={`rotate(${age * 400 + i * 30} ${x} ${y})`}
                    opacity={Math.max(0, 1 - age / 1.6)}
                  />
                )
              })
            : null}
          {/* Kippen: roter Blitz */}
          {lifeLost ? (
            <rect
              x={PX}
              y={PY}
              width={PW}
              height={PH}
              fill="#EF4444"
              opacity={0.3 * Math.max(0, 1 - (t - c2) / 0.35)}
            />
          ) : null}
        </g>
        {/* Der Finger */}
        {Number.isFinite(tapAge) && tapAge < 0.7 ? (
          <g
            transform={`translate(${PX + PW - 150} ${PY + PH - 200})`}
            opacity={Math.max(0, 1 - tapAge / 0.7)}
          >
            <circle
              r={30 + tapAge * 160}
              fill="none"
              stroke={look.accent}
              strokeWidth={5}
              opacity={Math.max(0, 1 - tapAge / 0.5)}
            />
            <text x={-34} y={40} fontSize={84}>
              👆
            </text>
          </g>
        ) : null}
      </svg>
      {/* Die Reihenfolge */}
      {orderIn > 0 ? (
        <div
          style={{
            position: 'absolute',
            top: PY + PH + 46,
            left: 40,
            right: 40,
            display: 'flex',
            justifyContent: 'center',
            gap: 10,
            flexWrap: 'nowrap',
          }}
        >
          {order.map((label, i) => (
            <div
              key={label}
              style={{
                padding: '10px 12px',
                border: `3px solid ${i === 4 ? look.accent : 'rgba(92,243,255,0.45)'}`,
                background: 'rgba(10,4,30,0.8)',
                fontFamily: PIXEL,
                fontSize: 16,
                color: i === 4 ? look.accent : look.text,
                opacity:
                  interpolate(orderIn, [0, 1], [0, 1]) *
                  Math.min(1, Math.max(0, (t - c0) * 6 - i * 0.6)),
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </div>
          ))}
        </div>
      ) : null}
      {/* Ton */}
      {plan.map((d, i) =>
        Number.isFinite(d.land) ? (
          <React.Fragment key={i}>
            <Sfx frame={voiceFrame(ts, d.land - DROP)} name="blip" volume={0.3} />
            <Sfx frame={voiceFrame(ts, d.land)} name={d.perfect ? 'coin' : 'pop'} volume={0.45} />
          </React.Fragment>
        ) : null,
      )}
      {s.stage === 'topple' ? (
        <>
          <Sfx frame={voiceFrame(ts, c1)} name="clash" volume={0.5} />
          <Sfx frame={voiceFrame(ts, c2)} name="glitch" volume={0.45} />
        </>
      ) : null}
      {s.stage === 'complete' ? (
        <Sfx frame={voiceFrame(ts, c2)} name="levelup" volume={0.5} />
      ) : null}
    </AbsoluteFill>
  )
}

/** Nichts steht gross im Bild, was gesprochen wird – die Untertitel bleiben. */
export const hidden = (_ts: TimelineScene): Set<number> => new Set()
