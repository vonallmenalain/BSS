import React, { useMemo } from "react";
import { AbsoluteFill, random, useCurrentFrame, useVideoConfig } from "remotion";
import { FPS, HEIGHT, WIDTH } from "../../../lib/timing";

/*
 * Labor mit Pflanzenlicht (Alma 32): ein dunkler Raum, oben eine Pflanzenleuchte, die
 * magenta und grün auf den Tisch strahlt. Links und rechts Regale mit Glaskolben,
 * Bechergläsern und kleinen Töpfen als Silhouetten, im Licht schweben Sporen nach oben.
 * Unten die Laborbank – ihre Kante liegt bei y 1162, dort stehen die Töpfe der Szene.
 * Über die Folge wird das Licht langsam wärmer und heller: Der Versuch läuft.
 */

export const LAB_BENCH = 1162;

/** Ein Glaskolben, Becherglas oder Reagenzglas als Silhouette mit grünem Streiflicht. */
const Glass: React.FC<{ x: number; y: number; kind: number; s: number; liquid: string }> = ({ x, y, kind, s, liquid }) => {
  const rim = "rgba(170,255,214,0.35)";
  if (kind === 0) {
    // Erlenmeyerkolben
    return (
      <g transform={`translate(${x} ${y}) scale(${s})`}>
        <path d="M -12 -90 L -12 -52 L -44 0 L 44 0 L 12 -52 L 12 -90 Z" fill="rgba(12,34,30,0.85)" stroke={rim} strokeWidth={2.5} />
        <path d="M -30 -22 L 30 -22 L 44 0 L -44 0 Z" fill={liquid} opacity={0.55} />
        <path d="M -8 -84 L -8 -54" stroke="rgba(220,255,240,0.35)" strokeWidth={3} strokeLinecap="round" />
      </g>
    );
  }
  if (kind === 1) {
    // Becherglas
    return (
      <g transform={`translate(${x} ${y}) scale(${s})`}>
        <path d="M -34 -80 L -30 0 L 30 0 L 34 -80 Z" fill="rgba(12,34,30,0.85)" stroke={rim} strokeWidth={2.5} />
        <path d="M -32 -36 L 32 -36 L 30 0 L -30 0 Z" fill={liquid} opacity={0.45} />
        {[-60, -46, -32].map((ty) => (
          <line key={ty} x1={-30} y1={ty} x2={-18} y2={ty} stroke={rim} strokeWidth={2} />
        ))}
      </g>
    );
  }
  if (kind === 2) {
    // Drei Reagenzgläser im Ständer
    return (
      <g transform={`translate(${x} ${y}) scale(${s})`}>
        <rect x={-50} y={-30} width={100} height={10} fill="rgba(20,40,34,0.9)" stroke={rim} strokeWidth={2} />
        <rect x={-50} y={-6} width={100} height={6} fill="rgba(20,40,34,0.9)" />
        {[-30, 0, 30].map((tx, i) => (
          <g key={tx}>
            <rect x={tx - 8} y={-96} width={16} height={92} rx={8} fill="rgba(12,34,30,0.85)" stroke={rim} strokeWidth={2} />
            <rect x={tx - 6} y={-50 + i * 10} width={12} height={44 - i * 10} rx={6} fill={liquid} opacity={0.5} />
          </g>
        ))}
      </g>
    );
  }
  // Kleiner Topf mit Pflänzchen
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M -30 -50 L 30 -50 L 24 0 L -24 0 Z" fill="rgba(30,26,22,0.9)" stroke={rim} strokeWidth={2} />
      <path d="M 0 -50 C -2 -70, -4 -84, 0 -100" stroke="rgba(90,170,110,0.8)" strokeWidth={4} fill="none" />
      <path d="M 0 -78 C -16 -92, -34 -88, -40 -80 C -30 -72, -12 -70, 0 -78 Z" fill="rgba(90,170,110,0.75)" />
      <path d="M 0 -92 C 14 -106, 32 -104, 38 -96 C 28 -88, 12 -86, 0 -92 Z" fill="rgba(90,170,110,0.75)" />
    </g>
  );
};

const Shelf: React.FC<{ x: number; y: number; w: number; items: Array<{ dx: number; kind: number; s: number; liquid: string }> }> = ({ x, y, w, items }) => (
  <g>
    {items.map((it, i) => (
      <Glass key={i} x={x + it.dx} y={y} kind={it.kind} s={it.s} liquid={it.liquid} />
    ))}
    <rect x={x} y={y} width={w} height={14} fill="#0D221E" />
    <rect x={x} y={y} width={w} height={3} fill="rgba(170,255,214,0.28)" />
    <rect x={x} y={y + 14} width={w} height={22} fill="rgba(0,0,0,0.35)" />
  </g>
);

export const LabBg: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = Math.min(1, frame / Math.max(1, durationInFrames - 1));
  const t = frame / FPS;
  const lampOn = 0.62 + 0.38 * p;
  const hum = 0.96 + 0.04 * Math.sin(t * 2.1);
  const spores = useMemo(
    () =>
      Array.from({ length: 46 }, (_, n) => ({
        x: 160 + random(`lx${n}`) * 760,
        y: random(`ly${n}`) * 1200,
        r: 1.2 + random(`lr${n}`) * 2.6,
        v: 8 + random(`lv${n}`) * 18,
        ph: random(`lp${n}`) * 6.28,
        c: random(`lc${n}`) > 0.5 ? "#C8FFE0" : "#FFC2EE",
      })),
    [],
  );
  const tiles = useMemo(() => {
    const out: Array<{ x: number; y: number; o: number }> = [];
    for (let r = 0; r < 14; r++) for (let c = 0; c < 9; c++) out.push({ x: c * 124 + (r % 2 ? 62 : 0) - 30, y: 180 + r * 72, o: 0.025 + random(`tile${r}-${c}`) * 0.03 });
    return out;
  }, []);
  const left = [
    { dx: 40, kind: 0, s: 1, liquid: "#3BE08A" },
    { dx: 130, kind: 1, s: 0.9, liquid: "#FF7AD9" },
  ];
  const left2 = [
    { dx: 60, kind: 2, s: 1, liquid: "#7CFFB2" },
    { dx: 150, kind: 3, s: 0.9, liquid: "" },
  ];
  const right = [
    { dx: 50, kind: 3, s: 1, liquid: "" },
    { dx: 140, kind: 0, s: 0.8, liquid: "#FF7AD9" },
  ];
  const right2 = [
    { dx: 46, kind: 1, s: 1, liquid: "#3BE08A" },
    { dx: 140, kind: 2, s: 0.85, liquid: "#FFB86B" },
  ];

  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg, #030B0A 0%, #06171A 38%, #071A16 64%, #020605 100%)" }}>
      <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id="labLamp" cx="50%" cy="0%" r="100%">
            <stop offset="0%" stopColor="#FFB3EC" stopOpacity="0.55" />
            <stop offset="30%" stopColor="#C77DFF" stopOpacity="0.2" />
            <stop offset="65%" stopColor="#3BE08A" stopOpacity="0.07" />
            <stop offset="100%" stopColor="#3BE08A" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="labCone" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFD6F4" stopOpacity="0.22" />
            <stop offset="60%" stopColor="#B8FFD8" stopOpacity="0.07" />
            <stop offset="100%" stopColor="#B8FFD8" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="labBench" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1C2E2A" />
            <stop offset="8%" stopColor="#0E1C19" />
            <stop offset="100%" stopColor="#030807" />
          </linearGradient>
        </defs>

        {/* Kachelwand */}
        {tiles.map((tl, i) => (
          <rect key={i} x={tl.x} y={tl.y} width={118} height={66} rx={6} fill="none" stroke="#9CFFD0" strokeWidth={1.5} opacity={tl.o} />
        ))}

        {/* Regale */}
        <Shelf x={-20} y={700} w={230} items={left} />
        <Shelf x={-20} y={960} w={230} items={left2} />
        <Shelf x={870} y={640} w={230} items={right} />
        <Shelf x={870} y={920} w={230} items={right2} />

        {/* Pflanzenleuchte */}
        <ellipse cx={540} cy={180} rx={760} ry={1040} fill="url(#labLamp)" opacity={lampOn * hum} />
        <path d={`M 330 210 L 750 210 L 1000 ${LAB_BENCH} L 80 ${LAB_BENCH} Z`} fill="url(#labCone)" opacity={lampOn * hum} />

        {/* Sporen im Licht */}
        {spores.map((sp, n) => {
          const y = (((sp.y - t * sp.v) % 1200) + 1200) % 1200;
          return <circle key={n} cx={sp.x + Math.sin(t * 0.5 + sp.ph) * 18} cy={y} r={sp.r} fill={sp.c} opacity={(0.08 + 0.16 * Math.sin(t * 0.8 + sp.ph) ** 2) * lampOn} />;
        })}

        {/* Laborbank */}
        <rect x={0} y={LAB_BENCH} width={WIDTH} height={HEIGHT - LAB_BENCH} fill="url(#labBench)" />
        <rect x={0} y={LAB_BENCH - 3} width={WIDTH} height={5} fill="rgba(200,255,228,0.32)" />
        <ellipse cx={540} cy={LAB_BENCH + 6} rx={420} ry={22} fill="#FFC6F0" opacity={0.08 * lampOn} />
        <line x1={0} y1={LAB_BENCH + 120} x2={WIDTH} y2={LAB_BENCH + 120} stroke="rgba(160,255,210,0.06)" strokeWidth={3} />
        <line x1={540} y1={LAB_BENCH + 120} x2={540} y2={HEIGHT} stroke="rgba(160,255,210,0.05)" strokeWidth={3} />
        {/* Schranktüren unter der Bank – unterhalb der Untertitel */}
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <rect x={30 + i * 262} y={1530} width={240} height={360} rx={10} fill="rgba(160,255,210,0.025)" stroke="rgba(160,255,210,0.07)" strokeWidth={3} />
            <rect x={i % 2 ? 46 + i * 262 : 238 + i * 262} y={1640} width={12} height={90} rx={6} fill="rgba(160,255,210,0.12)" />
          </g>
        ))}
        <rect x={60} y={1548} width={160} height={46} rx={4} fill="rgba(230,255,240,0.06)" />
        <text x={140} y={1580} textAnchor="middle" fontFamily="Space Mono" fontSize={22} fill="rgba(200,255,228,0.22)">
          PROBEN
        </text>
      </svg>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 85% 70% at 50% 42%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.72) 100%)" }} />
    </AbsoluteFill>
  );
};
