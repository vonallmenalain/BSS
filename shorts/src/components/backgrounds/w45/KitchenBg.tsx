import React, { useMemo } from "react";
import { AbsoluteFill, random, useCurrentFrame } from "remotion";
import { FPS, HEIGHT, WIDTH } from "../../../lib/timing";

/*
 * Kochshow: ein warmes Studio – Kachelwand, zwei Hängelampen mit Lichtkegeln, unten die
 * Theke aus Holz mit Stahlkante. Ein Hauch Dampf steigt auf. Die Szene stellt Teller, Tafel
 * und Menükarte davor.
 */

export const KitchenBg: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const steam = useMemo(
    () => Array.from({ length: 10 }, (_, i) => ({ x: 120 + random(`kx${i}`) * 840, v: 30 + random(`kv${i}`) * 30, r: 40 + random(`kr${i}`) * 50, p: random(`kp${i}`) })),
    [],
  );
  const tiles: React.ReactNode[] = [];
  for (let row = 0; row < 26; row++) {
    const y = 0 + row * 58;
    tiles.push(<line key={`h${row}`} x1={0} y1={y} x2={WIDTH} y2={y} stroke="#FFF1DE" strokeWidth={2} opacity={0.05} />);
    for (let col = 0; col < 10; col++) {
      const x = col * 120 + (row % 2 ? 60 : 0);
      tiles.push(<line key={`v${row}-${col}`} x1={x} y1={y} x2={x} y2={y + 58} stroke="#FFF1DE" strokeWidth={2} opacity={0.05} />);
    }
  }
  const flicker = 0.92 + 0.08 * Math.sin(t * 2.1);
  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg, #2B2018 0%, #3A2A1E 40%, #24190F 100%)" }}>
      <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id="kLamp">
            <stop offset="0%" stopColor="#FFD9A0" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#FFD9A0" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="kCone" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFE2B0" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#FFE2B0" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="kWood" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7A4E2C" />
            <stop offset="100%" stopColor="#3B2414" />
          </linearGradient>
          <radialGradient id="kSteam">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </radialGradient>
        </defs>
        {tiles}
        {[640, 920].map((x, i) => (
          <g key={x} opacity={flicker}>
            <path d={`M ${x - 70} 190 L ${x - 330} 1480 L ${x + 330} 1480 L ${x + 70} 190 Z`} fill="url(#kCone)" />
            <line x1={x} y1={0} x2={x} y2={130} stroke="#140D08" strokeWidth={5} />
            <path d={`M ${x - 80} 196 Q ${x} 110 ${x + 80} 196 Z`} fill="#1E140C" />
            <ellipse cx={x} cy={196} rx={80} ry={12} fill="#FFE6B8" />
            <circle cx={x} cy={210} r={180 + i * 10} fill="url(#kLamp)" />
          </g>
        ))}
        {steam.map((st, i) => {
          const k = ((t * 0.18 + st.p) % 1 + 1) % 1;
          return <circle key={i} cx={st.x + Math.sin(t + i) * 30} cy={1460 - k * 900} r={st.r * (0.6 + k)} fill="url(#kSteam)" opacity={0.12 * Math.sin(Math.PI * k)} />;
        })}
        {/* Theke */}
        <rect x={0} y={1470} width={WIDTH} height={30} fill="#C9CED6" />
        <rect x={0} y={1470} width={WIDTH} height={6} fill="#F2F4F7" />
        <rect x={0} y={1500} width={WIDTH} height={HEIGHT - 1500} fill="url(#kWood)" />
        {Array.from({ length: 6 }, (_, i) => (
          <rect key={i} x={40 + i * 180} y={1560} width={150} height={300} rx={10} fill="none" stroke="#2A190D" strokeWidth={5} opacity={0.7} />
        ))}
      </svg>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 85% 70% at 50% 42%, rgba(0,0,0,0) 50%, rgba(10,6,3,0.65) 100%)" }} />
    </AbsoluteFill>
  );
};
