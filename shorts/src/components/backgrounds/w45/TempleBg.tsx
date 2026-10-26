import React, { useMemo } from "react";
import { AbsoluteFill, random, useCurrentFrame } from "remotion";
import { FPS, HEIGHT, WIDTH } from "../../../lib/timing";

/*
 * Der Tempel in Jerusalem als Baustelle (2 Könige 22): eine hohe Halle aus warmen Quadern,
 * links und rechts mächtige Säulen, durch ein Fenster oben fallen Sonnenstrahlen schräg in die
 * Halle, und im Licht tanzt Staub. Unten ein Boden aus Steinplatten. Bewusst ruhig und warm –
 * davor stehen König, Handwerker, das Buch und das Volk.
 */

const WALL_TOP = 260;
const FLOOR = 1300;
const ROW_H = 120;

export const TempleBg: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const blocks = useMemo(() => {
    const out: Array<{ x: number; y: number; w: number; tone: number }> = [];
    for (let row = 0; WALL_TOP + row * ROW_H < FLOOR; row++) {
      let x = row % 2 ? -120 : -30;
      let k = 0;
      while (x < WIDTH) {
        const w = 220 + random(`tbw${row}-${k}`) * 140;
        out.push({ x, y: WALL_TOP + row * ROW_H, w, tone: random(`tbt${row}-${k}`) });
        x += w;
        k++;
      }
    }
    return out;
  }, []);
  const dust = useMemo(
    () => Array.from({ length: 70 }, (_, i) => ({ u: random(`tdu${i}`), v: random(`tdv${i}`), r: 1.2 + random(`tdr${i}`) * 2.6, p: random(`tdp${i}`) * 6.28, s: 6 + random(`tds${i}`) * 14 })),
    [],
  );
  /* Drei Strahlen vom Fenster oben links schräg nach rechts unten */
  const beams = [
    { x0: 250, w0: 90, x1: 640, w1: 260, o: 0.2 },
    { x0: 380, w0: 70, x1: 860, w1: 220, o: 0.14 },
    { x0: 140, w0: 60, x1: 430, w1: 180, o: 0.12 },
  ];
  const breathe = 0.85 + 0.15 * Math.sin(t * 0.7);
  return (
    <AbsoluteFill style={{ background: "#140D08" }}>
      <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <linearGradient id="tbBlock" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#9A7A52" />
            <stop offset="100%" stopColor="#6A4E32" />
          </linearGradient>
          <linearGradient id="tbShade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0E0804" stopOpacity="0.7" />
            <stop offset="45%" stopColor="#0E0804" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#0E0804" stopOpacity="0.6" />
          </linearGradient>
          <linearGradient id="tbBeam" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFE6B0" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#FFE6B0" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="tbFloor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5A4028" />
            <stop offset="100%" stopColor="#1E140C" />
          </linearGradient>
          <linearGradient id="tbColumn" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#3E2C1C" />
            <stop offset="35%" stopColor="#A88660" />
            <stop offset="60%" stopColor="#8A6A48" />
            <stop offset="100%" stopColor="#2E2014" />
          </linearGradient>
        </defs>
        {/* Decke im Dunkel, darunter die Quadermauer */}
        <rect x={0} y={0} width={WIDTH} height={WALL_TOP} fill="#0E0804" />
        {blocks.map((b, i) => (
          <g key={i}>
            <rect x={b.x + 3} y={b.y + 3} width={b.w - 6} height={ROW_H - 6} rx={4} fill="url(#tbBlock)" opacity={0.7 + 0.3 * b.tone} />
            <rect x={b.x + 3} y={b.y + 3} width={b.w - 6} height={4} fill="#E2C08E" opacity={0.25} />
          </g>
        ))}
        {/* Fenster oben links, aus dem das Licht kommt */}
        <rect x={180} y={WALL_TOP + 20} width={150} height={190} rx={70} fill="#FFE9B8" opacity={0.85 * breathe} />
        <rect x={250} y={WALL_TOP + 20} width={10} height={190} fill="#6A4E32" />
        <rect x={0} y={WALL_TOP} width={WIDTH} height={FLOOR - WALL_TOP} fill="url(#tbShade)" />
        {/* Boden */}
        <path d={`M 0 ${FLOOR} L ${WIDTH} ${FLOOR} L ${WIDTH} ${HEIGHT} L 0 ${HEIGHT} Z`} fill="url(#tbFloor)" />
        {Array.from({ length: 7 }, (_, i) => (
          <line key={`h${i}`} x1={0} y1={FLOOR + 14 + i * i * 14} x2={WIDTH} y2={FLOOR + 14 + i * i * 14} stroke="#1A100A" strokeWidth={3} opacity={0.6} />
        ))}
        {Array.from({ length: 13 }, (_, i) => {
          const x = (i - 6) * 90;
          return <line key={`v${i}`} x1={540 + x} y1={FLOOR} x2={540 + x * 3.2} y2={HEIGHT} stroke="#1A100A" strokeWidth={3} opacity={0.5} />;
        })}
        {/* Strahlen und Staub darin */}
        {beams.map((b, i) => (
          <path
            key={i}
            d={`M ${b.x0} ${WALL_TOP + 100} L ${b.x0 + b.w0} ${WALL_TOP + 100} L ${b.x1 + b.w1} ${FLOOR + 80} L ${b.x1} ${FLOOR + 80} Z`}
            fill="url(#tbBeam)"
            opacity={b.o * breathe}
            style={{ mixBlendMode: "screen" }}
          />
        ))}
        {dust.map((d, i) => {
          const b = beams[i % 3];
          const v = (d.v + t * 0.012 * d.s) % 1;
          const y = WALL_TOP + 100 + v * (FLOOR - WALL_TOP - 20);
          const x = b.x0 + (b.x1 - b.x0) * v + (b.w0 + (b.w1 - b.w0) * v) * d.u + Math.sin(t * 0.8 + d.p) * 14;
          return <circle key={i} cx={x} cy={y} r={d.r} fill="#FFF1CC" opacity={(0.25 + 0.35 * Math.sin(t * 1.3 + d.p) ** 2) * breathe} />;
        })}
        {/* Säulen links und rechts */}
        {[40, 900].map((x, i) => (
          <g key={i}>
            <rect x={x} y={WALL_TOP - 40} width={140} height={FLOOR - WALL_TOP + 60} fill="url(#tbColumn)" />
            {[0.25, 0.5, 0.75].map((f, k) => (
              <line key={k} x1={x + 140 * f} y1={WALL_TOP} x2={x + 140 * f} y2={FLOOR} stroke="#2E2014" strokeWidth={4} opacity={0.5} />
            ))}
            <rect x={x - 20} y={WALL_TOP - 70} width={180} height={44} rx={6} fill="#7A5A3A" />
            <rect x={x - 26} y={FLOOR - 10} width={192} height={40} rx={6} fill="#5A422A" />
          </g>
        ))}
      </svg>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 85% 70% at 50% 48%, rgba(0,0,0,0) 50%, rgba(8,4,2,0.75) 100%)" }} />
    </AbsoluteFill>
  );
};
