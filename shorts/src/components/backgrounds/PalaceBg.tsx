import React, { useMemo } from "react";
import { AbsoluteFill, random, useCurrentFrame } from "remotion";
import { FPS, HEIGHT, WIDTH } from "../../lib/timing";

/*
 * Palast-Look: der Thronsaal eines persischen Königs bei Lampenlicht. Goldene Säulen an den
 * Seiten, ein Bogen in der Tiefe, Vorhänge, ein gemusterter Boden in Perspektive. Die Mitte
 * bleibt ruhig – dort stehen Thron, Schriftrolle oder Text.
 */

const GOLD = "#F5C451";
const GOLD_DEEP = "#B98422";
/** Fluchtpunkt des Bodens */
const VX = WIDTH / 2;
const VY = 960;
/** Oberkante des Bodens */
const FLOOR = 1180;

/** Eine kannelierte Säule mit Kapitell (Doppelvoluten wie in Persepolis, vereinfacht) */
const Column: React.FC<{ x: number; w: number; top: number; bottom: number; dim: number; id: string }> = ({ x, w, top, bottom, dim, id }) => (
  <g opacity={dim}>
    <defs>
      <linearGradient id={`col-${id}`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#5A3A12" />
        <stop offset="28%" stopColor={GOLD} />
        <stop offset="46%" stopColor="#FFE9A8" />
        <stop offset="70%" stopColor={GOLD_DEEP} />
        <stop offset="100%" stopColor="#3B2408" />
      </linearGradient>
    </defs>
    {/* Schaft */}
    <rect x={x - w / 2} y={top + w * 0.9} width={w} height={bottom - top - w * 1.3} fill={`url(#col-${id})`} />
    {Array.from({ length: 5 }, (_, k) => (
      <line key={k} x1={x - w / 2 + ((k + 1) * w) / 6} y1={top + w} x2={x - w / 2 + ((k + 1) * w) / 6} y2={bottom - w * 0.5} stroke="rgba(60,32,6,0.45)" strokeWidth={Math.max(1.5, w * 0.03)} />
    ))}
    {/* Kapitell: zwei Voluten */}
    <rect x={x - w * 0.85} y={top + w * 0.55} width={w * 1.7} height={w * 0.38} rx={w * 0.1} fill={`url(#col-${id})`} />
    <circle cx={x - w * 0.72} cy={top + w * 0.4} r={w * 0.32} fill="none" stroke={GOLD} strokeWidth={w * 0.12} />
    <circle cx={x + w * 0.72} cy={top + w * 0.4} r={w * 0.32} fill="none" stroke={GOLD} strokeWidth={w * 0.12} />
    <rect x={x - w * 1.05} y={top - w * 0.08} width={w * 2.1} height={w * 0.22} fill={GOLD_DEEP} />
    {/* Basis */}
    <rect x={x - w * 0.72} y={bottom - w * 0.5} width={w * 1.44} height={w * 0.22} fill={GOLD_DEEP} />
    <rect x={x - w * 0.85} y={bottom - w * 0.28} width={w * 1.7} height={w * 0.28} fill={`url(#col-${id})`} />
  </g>
);

/** Hängelampe an einer Kette, mit flackerndem Schein */
const Lamp: React.FC<{ x: number; y: number; flicker: number }> = ({ x, y, flicker }) => (
  <g>
    <line x1={x} y1={0} x2={x} y2={y - 34} stroke="#7A5A1E" strokeWidth={3} strokeDasharray="7 5" />
    <circle cx={x} cy={y} r={190} fill="url(#lampHalo)" opacity={0.55 * flicker} />
    <path d={`M ${x - 34} ${y - 30} L ${x + 34} ${y - 30} L ${x + 22} ${y + 18} Q ${x} ${y + 40} ${x - 22} ${y + 18} Z`} fill={GOLD_DEEP} stroke={GOLD} strokeWidth={3} />
    <path d={`M ${x - 18} ${y - 22} L ${x + 18} ${y - 22} L ${x + 12} ${y + 10} Q ${x} ${y + 24} ${x - 12} ${y + 10} Z`} fill="#FFE7A0" opacity={0.75 + 0.25 * flicker} />
    <path d={`M ${x - 10} ${y - 30} L ${x} ${y - 48} L ${x + 10} ${y - 30} Z`} fill={GOLD} />
  </g>
);

/** Vorhang-Bahn mit Falten, oben gerafft */
const Drape: React.FC<{ side: 1 | -1; sway: number }> = ({ side, sway }) => {
  const x0 = side === 1 ? 0 : WIDTH;
  const s = side;
  const d = `M ${x0} 0 L ${x0 + s * 420} 0 Q ${x0 + s * (300 + sway)} 120 ${x0 + s * 170} 210 Q ${x0 + s * 120} 420 ${x0 + s * 150} 760 L ${x0} 820 Z`;
  return (
    <g>
      <path d={d} fill="url(#drape)" />
      {[0.25, 0.5, 0.75].map((k) => (
        <path
          key={k}
          d={`M ${x0 + s * 420 * k} 0 Q ${x0 + s * (300 * k + sway * k)} ${150 * k + 40} ${x0 + s * 150 * k} ${200 + 500 * k}`}
          stroke="rgba(0,0,0,0.28)"
          strokeWidth={6}
          fill="none"
        />
      ))}
      <path d={`M ${x0} 30 Q ${x0 + s * 220} 120 ${x0 + s * 430} 20`} stroke={GOLD} strokeWidth={5} fill="none" opacity={0.8} />
      <circle cx={x0 + s * 170} cy={212} r={13} fill={GOLD} />
    </g>
  );
};

export const PalaceBg: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const flicker = 0.9 + 0.06 * Math.sin(frame / 4.7) + 0.04 * Math.sin(frame / 1.9);
  const dust = useMemo(
    () =>
      Array.from({ length: 46 }, (_, i) => ({
        x: random(`pdx${i}`) * WIDTH,
        y: random(`pdy${i}`) * HEIGHT,
        r: 1.2 + random(`pdr${i}`) * 2.6,
        v: 6 + random(`pdv${i}`) * 14,
        p: random(`pdp${i}`) * 6.28,
      })),
    [],
  );
  // Bodenlinien in Perspektive: Längslinien zum Fluchtpunkt, Querlinien immer enger
  const rays = Array.from({ length: 17 }, (_, i) => i - 8);
  const rows = Array.from({ length: 11 }, (_, k) => FLOOR + (HEIGHT - FLOOR) * Math.pow(k / 10, 1.9));
  const xAt = (k: number, y: number) => VX + (k * 150 * (y - VY)) / (HEIGHT - VY);

  return (
    <AbsoluteFill style={{ background: "linear-gradient(to bottom, #07031A 0%, #140A33 30%, #23104A 62%, #1A0B36 100%)" }}>
      <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id="lampHalo">
            <stop offset="0%" stopColor="#FFD98A" stopOpacity="0.85" />
            <stop offset="40%" stopColor="#F5A84A" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#F5A84A" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="drape" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5B1E6E" />
            <stop offset="100%" stopColor="#2A0B3A" />
          </linearGradient>
          <linearGradient id="archFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2E1858" />
            <stop offset="100%" stopColor="#3A1C5E" />
          </linearGradient>
          <linearGradient id="floorFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2B1450" />
            <stop offset="100%" stopColor="#0F0624" />
          </linearGradient>
          <pattern id="lattice" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M30 0 L60 30 L30 60 L0 30 Z" fill="none" stroke={GOLD} strokeWidth={1.4} />
            <circle cx={30} cy={30} r={3} fill={GOLD} />
          </pattern>
          <radialGradient id="hallGlow" cx="0.5" cy="0.42" r="0.6">
            <stop offset="0%" stopColor="#B07CFF" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#B07CFF" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Bogen in der Tiefe mit feinem Gitter */}
        <path d={`M 230 ${FLOOR} L 230 560 Q 230 300 540 250 Q 850 300 850 560 L 850 ${FLOOR} Z`} fill="url(#archFill)" />
        <path d={`M 230 ${FLOOR} L 230 560 Q 230 300 540 250 Q 850 300 850 560 L 850 ${FLOOR} Z`} fill="url(#lattice)" opacity={0.07} />
        <path d={`M 230 ${FLOOR} L 230 560 Q 230 300 540 250 Q 850 300 850 560 L 850 ${FLOOR}`} fill="none" stroke={GOLD} strokeWidth={4} opacity={0.45} />
        <path d={`M 262 ${FLOOR} L 262 572 Q 262 334 540 286 Q 818 334 818 572 L 818 ${FLOOR}`} fill="none" stroke={GOLD} strokeWidth={2} opacity={0.25} />
        <rect x={0} y={0} width={WIDTH} height={HEIGHT} fill="url(#hallGlow)" />

        {/* Boden */}
        <rect x={0} y={FLOOR} width={WIDTH} height={HEIGHT - FLOOR} fill="url(#floorFill)" />
        <g stroke={GOLD} strokeWidth={2}>
          {rays.map((k) => (
            <line key={`r${k}`} x1={xAt(k, FLOOR)} y1={FLOOR} x2={xAt(k, HEIGHT)} y2={HEIGHT} opacity={0.18} />
          ))}
          {rows.map((y, i) => (
            <line key={`f${i}`} x1={0} y1={y} x2={WIDTH} y2={y} opacity={0.08 + 0.12 * (i / rows.length)} />
          ))}
        </g>
        <line x1={0} y1={FLOOR} x2={WIDTH} y2={FLOOR} stroke={GOLD} strokeWidth={3} opacity={0.35} />
        {/* Läufer zum Thron */}
        <path d={`M ${VX - 70} ${FLOOR} L ${VX + 70} ${FLOOR} L ${VX + 260} ${HEIGHT} L ${VX - 260} ${HEIGHT} Z`} fill="#6B1530" opacity={0.55} />
        <path d={`M ${VX - 58} ${FLOOR} L ${VX - 236} ${HEIGHT} M ${VX + 58} ${FLOOR} L ${VX + 236} ${HEIGHT}`} stroke={GOLD} strokeWidth={3} opacity={0.4} />

        {/* Hintere Säulen (kleiner, dunkler) und vordere Säulen an den Rändern */}
        <Column x={200} w={44} top={420} bottom={FLOOR} dim={0.55} id="b1" />
        <Column x={880} w={44} top={420} bottom={FLOOR} dim={0.55} id="b2" />
        <Column x={58} w={82} top={250} bottom={HEIGHT - 40} dim={0.95} id="f1" />
        <Column x={1022} w={82} top={250} bottom={HEIGHT - 40} dim={0.95} id="f2" />

        <Drape side={1} sway={Math.sin(t * 0.7) * 10} />
        <Drape side={-1} sway={Math.sin(t * 0.7 + 1.3) * 10} />
        <Lamp x={300} y={250} flicker={flicker} />
        <Lamp x={780} y={250} flicker={0.9 + 0.06 * Math.sin(frame / 5.3 + 1) + 0.04 * Math.sin(frame / 2.3)} />

        {/* Goldstaub im Lampenlicht */}
        {dust.map((m, i) => {
          const y = (((m.y - m.v * t) % HEIGHT) + HEIGHT) % HEIGHT;
          const x = m.x + Math.sin(t * 0.5 + m.p) * 14;
          const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 2.2 + m.p * 3));
          return <circle key={i} cx={x} cy={y} r={m.r} fill="#FFE2A0" opacity={0.28 * tw} />;
        })}
      </svg>
      {/* Lampenlicht und Vignette */}
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 75% 50% at 50% 40%, rgba(255,200,120,${0.1 * flicker}) 0%, rgba(0,0,0,0) 70%)` }} />
      <AbsoluteFill style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0) 62%, rgba(6,2,16,0.55) 78%, rgba(6,2,16,0.7) 100%)" }} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 85% 70% at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.6) 100%)" }} />
    </AbsoluteFill>
  );
};
