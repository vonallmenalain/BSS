import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { FPS, HEIGHT, WIDTH } from "../../../lib/timing";

/*
 * Ein sehr hoher Berg unter einem Himmel voller Welten (Mose 1): tiefes Indigo mit Nebeln in
 * Violett und Türkis, ein Band der Milchstrasse, zwei langsam drehende Galaxien und unzählige
 * Sterne. Weit unten ein Meer aus Wolken, aus dem ferne Gipfel ragen – man steht höher als alles.
 * Zum Schluss der Folge wird der Himmel ein wenig heller («Welten ohne Zahl»). Den Gipfel selbst,
 * das Licht und die Gestalten zeichnet die Szene davor.
 */

/** Ein ferner Gebirgskamm über dem Wolkenmeer. */
const ridge = (seed: string, base: number, amp: number, n: number) => {
  const pts: string[] = [];
  for (let i = 0; i <= n; i++) {
    const x = (i / n) * (WIDTH + 200) - 100;
    const peak = Math.abs(Math.sin(i * 1.7 + random(`${seed}p`) * 6)) ** 3;
    const y = base - amp * (0.25 + 0.75 * peak) * (0.6 + 0.4 * random(`${seed}${i}`));
    pts.push(`${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return pts;
};

/** Eine Spiralgalaxie: heller Kern, zwei Arme aus Lichtpunkten, leicht schräg. */
const Galaxy: React.FC<{ x: number; y: number; r: number; tilt: number; spin: number; hue: string; seed: string; o: number }> = ({ x, y, r, tilt, spin, hue, seed, o }) => {
  const dots = useMemo(
    () =>
      Array.from({ length: 140 }, (_, i) => {
        const arm = i % 2;
        const d = random(`${seed}d${i}`);
        const a = d * 4.6 + arm * Math.PI + (random(`${seed}a${i}`) - 0.5) * 0.5;
        return { a, d, s: 0.6 + random(`${seed}s${i}`) * 1.6 };
      }),
    [seed],
  );
  return (
    <g transform={`translate(${x} ${y}) rotate(${tilt}) scale(1 0.42)`} opacity={o}>
      <circle r={r * 1.1} fill={`url(#sgHalo${seed})`} />
      <defs>
        <radialGradient id={`sgHalo${seed}`}>
          <stop offset="0%" stopColor="#FFF4DA" stopOpacity="0.85" />
          <stop offset="18%" stopColor={hue} stopOpacity="0.45" />
          <stop offset="60%" stopColor={hue} stopOpacity="0.08" />
          <stop offset="100%" stopColor={hue} stopOpacity="0" />
        </radialGradient>
      </defs>
      {dots.map((p, i) => {
        const a = p.a + spin;
        const rr = r * (0.12 + p.d * 0.9);
        return <circle key={i} cx={Math.cos(a) * rr} cy={Math.sin(a) * rr} r={p.s * (1.4 - p.d * 0.6)} fill="#F4EEFF" opacity={0.35 + 0.5 * (1 - p.d)} />;
      })}
    </g>
  );
};

export const SummitBg: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = frame / FPS;
  const p = frame / Math.max(1, durationInFrames);
  /* Gegen Schluss («Welten ohne Zahl») hellt der Himmel auf */
  const bloom = interpolate(p, [0.72, 0.86, 1], [0, 1, 0.85], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const stars = useMemo(
    () =>
      Array.from({ length: 260 }, (_, i) => ({
        x: random(`ssx${i}`) * WIDTH,
        y: random(`ssy${i}`) * 1260,
        r: 0.6 + random(`ssr${i}`) ** 3 * 2.6,
        p: random(`ssp${i}`) * 6.28,
        v: 0.6 + random(`ssv${i}`) * 1.8,
      })),
    [],
  );
  /* Dichte kleine Sterne im Band der Milchstrasse */
  const band = useMemo(
    () =>
      Array.from({ length: 220 }, (_, i) => {
        const u = random(`sbu${i}`);
        const off = (random(`sbo${i}`) - 0.5) * 220 * (0.4 + random(`sbq${i}`));
        return { x: -60 + u * 1220 + off * 0.5, y: 1080 - u * 900 + off, r: 0.5 + random(`sbr${i}`) * 1.2, p: random(`sbp${i}`) * 6.28 };
      }),
    [],
  );
  const bright = useMemo(
    () => Array.from({ length: 7 }, (_, i) => ({ x: 80 + random(`sfx${i}`) * 920, y: 120 + random(`sfy${i}`) * 900, p: random(`sfp${i}`) * 6.28 })),
    [],
  );
  const ridges = useMemo(
    () => [
      { pts: ridge("r1", 1270, 120, 18), fill: "#1A1840", rim: "#6E78C8" },
      { pts: ridge("r2", 1330, 80, 24), fill: "#141235", rim: "#5A62AA" },
    ],
    [],
  );
  const clouds = useMemo(
    () => Array.from({ length: 34 }, (_, i) => ({ x: random(`scx${i}`) * 1400 - 160, y: 1300 + random(`scy${i}`) * 260, rx: 140 + random(`scr${i}`) * 220, ry: 30 + random(`scq${i}`) * 40, v: 4 + random(`scv${i}`) * 8 })),
    [],
  );

  return (
    <AbsoluteFill>
      <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <linearGradient id="sgSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#03020C" />
            <stop offset="35%" stopColor="#0B0928" />
            <stop offset="62%" stopColor="#1A1446" />
            <stop offset="80%" stopColor="#2A2660" />
            <stop offset="100%" stopColor="#141232" />
          </linearGradient>
          <radialGradient id="sgNebV">
            <stop offset="0%" stopColor="#8A5CFF" stopOpacity="0.32" />
            <stop offset="55%" stopColor="#6A3CD8" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#6A3CD8" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="sgNebT">
            <stop offset="0%" stopColor="#3FD0E8" stopOpacity="0.24" />
            <stop offset="60%" stopColor="#2A8FB8" stopOpacity="0.07" />
            <stop offset="100%" stopColor="#2A8FB8" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="sgNebM">
            <stop offset="0%" stopColor="#E05CC8" stopOpacity="0.2" />
            <stop offset="60%" stopColor="#A03CA0" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#A03CA0" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="sgBloom" cx="0.5" cy="0.32" r="0.7">
            <stop offset="0%" stopColor="#FFF0C8" stopOpacity="0.5" />
            <stop offset="45%" stopColor="#B48CFF" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#B48CFF" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="sgCloud" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5E64A8" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#1C1A44" stopOpacity="0.95" />
          </linearGradient>
          <filter id="sgSoft" x="-20%" y="-50%" width="140%" height="200%">
            <feGaussianBlur stdDeviation="14" />
          </filter>
        </defs>
        <rect width={WIDTH} height={HEIGHT} fill="url(#sgSky)" />

        {/* Nebel, die langsam treiben */}
        <ellipse cx={260 + Math.sin(t / 9) * 30} cy={520} rx={560} ry={460} fill="url(#sgNebV)" />
        <ellipse cx={860 + Math.cos(t / 11) * 30} cy={860} rx={480} ry={380} fill="url(#sgNebT)" />
        <ellipse cx={700} cy={300 + Math.sin(t / 13) * 20} rx={420} ry={300} fill="url(#sgNebM)" />

        {/* Milchstrasse */}
        <path d="M -120 1180 C 220 900, 620 620, 1200 160 L 1200 360 C 660 760, 280 1020, -120 1330 Z" fill="#C8C2FF" opacity={0.06} />
        <path d="M -120 1220 C 240 960, 640 680, 1200 230 L 1200 290 C 640 730, 260 990, -120 1270 Z" fill="#FFFFFF" opacity={0.05} />
        {band.map((s, i) => (
          <circle key={`b${i}`} cx={s.x} cy={s.y} r={s.r} fill="#E8E6FF" opacity={0.25 + 0.3 * (0.5 + 0.5 * Math.sin(t * 1.3 + s.p))} />
        ))}

        <Galaxy x={210} y={330} r={130} tilt={-28} spin={t * 0.05} hue="#B48CFF" seed="ga" o={0.85} />
        <Galaxy x={880} y={640} r={84} tilt={22} spin={-t * 0.07} hue="#6EC8FF" seed="gb" o={0.7} />

        {stars.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#F6F4FF" opacity={0.25 + 0.6 * (0.5 + 0.5 * Math.sin(t * s.v + s.p))} />
        ))}
        {bright.map((b, i) => {
          const tw = 0.65 + 0.35 * Math.sin(t * 1.6 + b.p);
          return (
            <g key={`f${i}`} transform={`translate(${b.x} ${b.y})`} opacity={tw}>
              <circle r={3} fill="#FFFFFF" />
              <path d="M -18 0 L 18 0 M 0 -18 L 0 18" stroke="#FFFFFF" strokeWidth={1.4} opacity={0.6} />
            </g>
          );
        })}

        <rect width={WIDTH} height={HEIGHT} fill="url(#sgBloom)" opacity={bloom} />

        {/* Weit unten: ferne Gipfel und ein Meer aus Wolken */}
        {ridges.map((r, i) => (
          <g key={i}>
            <path d={`M -100 ${HEIGHT} L ${r.pts.join(" L ")} L ${WIDTH + 100} ${HEIGHT} Z`} fill={r.fill} />
            <path d={`M ${r.pts.join(" L ")}`} fill="none" stroke={r.rim} strokeWidth={2} opacity={0.45} />
          </g>
        ))}
        <rect x={0} y={1360} width={WIDTH} height={HEIGHT - 1360} fill="#1A1844" />
        <g filter="url(#sgSoft)">
          {clouds.map((c, i) => {
            const x = ((c.x + t * c.v) % 1500) - 200;
            return <ellipse key={i} cx={x} cy={c.y} rx={c.rx} ry={c.ry} fill="url(#sgCloud)" opacity={0.75} />;
          })}
        </g>
        <rect x={0} y={1290} width={WIDTH} height={60} fill="#8E96E0" opacity={0.05} />
      </svg>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 95% 75% at 50% 42%, rgba(0,0,0,0) 55%, rgba(2,2,12,0.6) 100%)" }} />
    </AbsoluteFill>
  );
};
