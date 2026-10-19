import React, { useMemo } from "react";
import { AbsoluteFill, random, useCurrentFrame } from "remotion";
import { FPS, HEIGHT, WIDTH } from "../../lib/timing";

/*
 * Jerusalem bei Nacht: oben ein Streifen Nachthimmel, darunter eine Mauer aus grossen
 * Sandsteinquadern, links und rechts je eine Fackel, deren Licht leise flackert.
 * Bewusst dunkel und ruhig – davor stehen Zeilen, Ketten und das Pergament.
 */

const WALL_TOP = 470;
const ROW_H = 148;
const TORCHES = [
  { x: 118, y: 820, p: 0 },
  { x: 962, y: 820, p: 2.3 },
];

/** Flackern aus zwei Sinuswellen – wirkt unruhig, bleibt aber weich. */
const flicker = (t: number, p: number) => 0.82 + 0.1 * Math.sin(t * 7.3 + p) + 0.08 * Math.sin(t * 12.9 + p * 1.7);

const Flame: React.FC<{ x: number; y: number; t: number; p: number }> = ({ x, y, t, p }) => {
  const w = (k: number, a: number) => Math.sin(t * k + p) * a;
  const outer = `M ${x - 26} ${y} C ${x - 34} ${y - 40 + w(9, 6)}, ${x - 8 + w(11, 8)} ${y - 70}, ${x + w(7, 10)} ${y - 118 + w(13, 8)} C ${x + 10 + w(10, 6)} ${y - 72}, ${x + 36} ${y - 44 + w(8, 6)}, ${x + 26} ${y} Z`;
  const inner = `M ${x - 13} ${y - 2} C ${x - 18} ${y - 26}, ${x - 4 + w(12, 5)} ${y - 46}, ${x + w(9, 6)} ${y - 76 + w(15, 6)} C ${x + 6} ${y - 46}, ${x + 18} ${y - 28}, ${x + 13} ${y - 2} Z`;
  return (
    <g>
      <path d={outer} fill="#FF8A2B" opacity={0.92} />
      <path d={inner} fill="#FFE08A" />
    </g>
  );
};

export const StoneBg: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  /* Quader: jede Reihe versetzt, Breiten leicht zufällig – wie gewachsen, nicht gemustert */
  const blocks = useMemo(() => {
    const out: Array<{ x: number; y: number; w: number; h: number; tone: number }> = [];
    for (let row = 0; WALL_TOP + row * ROW_H < HEIGHT; row++) {
      let x = row % 2 ? -150 : -40;
      let k = 0;
      while (x < WIDTH) {
        const w = 250 + random(`sw${row}-${k}`) * 150;
        out.push({ x, y: WALL_TOP + row * ROW_H, w, h: ROW_H, tone: random(`st${row}-${k}`) });
        x += w;
        k++;
      }
    }
    return out;
  }, []);
  const stars = useMemo(
    () => Array.from({ length: 46 }, (_, i) => ({ x: random(`sx${i}`) * WIDTH, y: 40 + random(`sy${i}`) * (WALL_TOP - 80), r: 0.8 + random(`sr${i}`) * 1.8, p: random(`sp${i}`) * 6.28 })),
    [],
  );
  const glow = TORCHES.map((tc) => flicker(t, tc.p));

  return (
    <AbsoluteFill style={{ background: "#0A0F24" }}>
      <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <linearGradient id="stoneSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#060A1E" />
            <stop offset="70%" stopColor="#141C42" />
            <stop offset="100%" stopColor="#2A2A4A" />
          </linearGradient>
          <linearGradient id="stoneBlock" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8A6C4C" />
            <stop offset="100%" stopColor="#5E4630" />
          </linearGradient>
          {TORCHES.map((tc, i) => (
            <radialGradient key={i} id={`torchLight${i}`} gradientUnits="userSpaceOnUse" cx={tc.x} cy={tc.y - 40} r={640}>
              <stop offset="0%" stopColor="#FFB45C" stopOpacity={0.55 * glow[i]} />
              <stop offset="35%" stopColor="#E07A2E" stopOpacity={0.22 * glow[i]} />
              <stop offset="100%" stopColor="#E07A2E" stopOpacity="0" />
            </radialGradient>
          ))}
          <linearGradient id="stoneShade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0A0816" stopOpacity="0.35" />
            <stop offset="55%" stopColor="#0A0816" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#05040B" stopOpacity="0.85" />
          </linearGradient>
        </defs>

        {/* Himmel mit Sternen und Mondsichel */}
        <rect x={0} y={0} width={WIDTH} height={WALL_TOP + 40} fill="url(#stoneSky)" />
        {stars.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#FFFFFF" opacity={0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t * 1.6 + s.p))} />
        ))}
        <g transform="translate(860 300)" opacity={0.85}>
          <circle r={40} fill="#F4E6C0" />
          <circle cx={16} cy={-8} r={36} fill="#10173A" />
        </g>

        {/* Mauerkrone mit Zinnen */}
        <path
          d={`M 0 ${WALL_TOP} ${Array.from({ length: 10 }, (_, i) => {
            const x0 = i * 108;
            return `L ${x0} ${WALL_TOP - 46} L ${x0 + 62} ${WALL_TOP - 46} L ${x0 + 62} ${WALL_TOP} L ${x0 + 108} ${WALL_TOP}`;
          }).join(" ")} L ${WIDTH} ${WALL_TOP} L ${WIDTH} ${WALL_TOP + 20} L 0 ${WALL_TOP + 20} Z`}
          fill="#4A3826"
        />

        {/* Quader */}
        {blocks.map((b, i) => (
          <g key={i}>
            <rect x={b.x + 3} y={b.y + 3} width={b.w - 6} height={b.h - 6} rx={6} fill="url(#stoneBlock)" opacity={0.78 + 0.22 * b.tone} />
            <rect x={b.x + 3} y={b.y + 3} width={b.w - 6} height={5} rx={2} fill="#C9A273" opacity={0.25} />
            <rect x={b.x + 3} y={b.y + b.h - 9} width={b.w - 6} height={6} rx={2} fill="#2A1C10" opacity={0.4} />
          </g>
        ))}

        {/* Dunkel über allem – Nacht –, dann das Fackellicht */}
        <rect x={0} y={WALL_TOP - 50} width={WIDTH} height={HEIGHT - WALL_TOP + 50} fill="url(#stoneShade)" />
        {TORCHES.map((_, i) => (
          <rect key={i} x={0} y={0} width={WIDTH} height={HEIGHT} fill={`url(#torchLight${i})`} style={{ mixBlendMode: "screen" }} />
        ))}

        {/* Fackeln */}
        {TORCHES.map((tc, i) => (
          <g key={i}>
            <circle cx={tc.x} cy={tc.y - 40} r={90 * glow[i]} fill="#FFB45C" opacity={0.16} />
            <path d={`M ${tc.x - 12} ${tc.y} L ${tc.x + 12} ${tc.y} L ${tc.x + 6} ${tc.y + 120} L ${tc.x - 6} ${tc.y + 120} Z`} fill="#3A2614" />
            <rect x={tc.x - 22} y={tc.y + 50} width={44} height={14} rx={4} fill="#2A2420" />
            <rect x={tc.x - 18} y={tc.y - 8} width={36} height={18} rx={6} fill="#5A3A1E" />
            <Flame x={tc.x} y={tc.y - 4} t={t} p={tc.p} />
          </g>
        ))}
      </svg>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 85% 70% at 50% 45%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.7) 100%)" }} />
    </AbsoluteFill>
  );
};
