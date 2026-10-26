import React, { useMemo } from "react";
import { AbsoluteFill, random, useCurrentFrame } from "remotion";
import { FPS, HEIGHT, WIDTH } from "../../../lib/timing";

/*
 * Wüste bei Nacht (Matthäus 4): tiefblauer Himmel mit vielen Sternen, ein voller Mond, der
 * die Kämme der Dünen silbern zeichnet, drei Dünenreihen in die Tiefe und feiner Sand, der
 * über die Kämme weht. Ruhig und weit – die Szene davor erzählt.
 */

/** Eine weiche Dünenlinie: Grundhöhe, Wellen, Phase. */
const dune = (base: number, amp: number, waves: number, phase: number, steps = 36) => {
  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * WIDTH;
    const y = base - Math.sin((i / steps) * Math.PI * waves + phase) * amp - Math.sin((i / steps) * Math.PI * waves * 2.3 + phase * 1.7) * amp * 0.25;
    pts.push(`${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return pts;
};

export const DesertBg: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const stars = useMemo(
    () =>
      Array.from({ length: 150 }, (_, i) => ({
        x: random(`dsx${i}`) * WIDTH,
        y: 40 + random(`dsy${i}`) * 1050,
        r: 0.7 + random(`dsr${i}`) * 2,
        p: random(`dsp${i}`) * 6.28,
        v: 0.8 + random(`dsv${i}`) * 1.8,
      })),
    [],
  );
  const layers = useMemo(
    () => [
      { pts: dune(1190, 46, 1.6, 0.4), fill: "#2B1F3A", ridge: "#7E6C9A" },
      { pts: dune(1330, 70, 1.2, 2.1), fill: "#3A2734", ridge: "#B49AA0" },
      { pts: dune(1560, 90, 0.9, 4.0), fill: "#1E141C", ridge: "#6A5260" },
    ],
    [],
  );
  const sand = useMemo(
    () => Array.from({ length: 60 }, (_, i) => ({ y: 1100 + random(`sdy${i}`) * 700, x0: random(`sdx${i}`) * WIDTH, v: 30 + random(`sdv${i}`) * 60, r: 1 + random(`sdr${i}`) * 1.6 })),
    [],
  );
  return (
    <AbsoluteFill>
      <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <linearGradient id="dbSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#050720" />
            <stop offset="45%" stopColor="#111A44" />
            <stop offset="72%" stopColor="#2C2650" />
            <stop offset="100%" stopColor="#4A3048" />
          </linearGradient>
          <radialGradient id="dbMoonHalo">
            <stop offset="0%" stopColor="#F4ECD6" stopOpacity="0.5" />
            <stop offset="40%" stopColor="#C9D6FF" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#C9D6FF" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="dbMoon" cx="0.42" cy="0.4" r="0.62">
            <stop offset="0%" stopColor="#FFFBEE" />
            <stop offset="70%" stopColor="#EDE3C6" />
            <stop offset="100%" stopColor="#CFC2A0" />
          </radialGradient>
        </defs>
        <rect width={WIDTH} height={HEIGHT} fill="url(#dbSky)" />
        {/* Milchstrasse: ein schwaches Band schräg über den Himmel */}
        <path d="M -100 900 C 200 640, 600 460, 1200 160 L 1200 330 C 640 600, 260 780, -100 1060 Z" fill="#B8C6FF" opacity={0.05} />
        {stars.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#F2F4FF" opacity={0.2 + 0.55 * (0.5 + 0.5 * Math.sin(t * s.v + s.p))} />
        ))}
        <circle cx={820} cy={470} r={260} fill="url(#dbMoonHalo)" />
        <circle cx={820} cy={470} r={58} fill="url(#dbMoon)" />
        <circle cx={803} cy={458} r={9} fill="#D9CDAE" opacity={0.6} />
        <circle cx={838} cy={490} r={6} fill="#D9CDAE" opacity={0.5} />
        {layers.map((l, i) => (
          <g key={i}>
            <path d={`M 0 ${HEIGHT} L ${l.pts.join(" L ")} L ${WIDTH} ${HEIGHT} Z`} fill={l.fill} />
            <path d={`M ${l.pts.join(" L ")}`} fill="none" stroke={l.ridge} strokeWidth={i === 1 ? 3 : 2} opacity={0.55} />
          </g>
        ))}
        {sand.map((p, i) => {
          const x = ((p.x0 + t * p.v) % (WIDTH + 40)) - 20;
          return <circle key={i} cx={x} cy={p.y + Math.sin(t * 2 + i) * 6} r={p.r} fill="#E8D6C0" opacity={0.18} />;
        })}
      </svg>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 90% 70% at 50% 45%, rgba(0,0,0,0) 55%, rgba(2,3,14,0.65) 100%)" }} />
    </AbsoluteFill>
  );
};
