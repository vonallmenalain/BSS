import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { FPS, HEIGHT, WIDTH } from "../../../lib/timing";

/*
 * Berg Horeb bei Nacht (1 Könige 19): ein tiefer Nachthimmel mit Mond und Sternen, ferne
 * Bergketten und rechts der Gottesberg selbst, kantig und hoch. Wolkenbänke ziehen langsam
 * vorbei. Das Unwetter – Sturm, Beben, Feuer – zeichnet die Szene davor; der Hintergrund bleibt
 * ruhig und wird erst ganz am Ende, wenn es still geworden ist, am Horizont ein wenig heller.
 */

const hex = (s: string) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
const mix = (a: string, b: string, k: number) => {
  const pa = hex(a);
  const pb = hex(b);
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * Math.max(0, Math.min(1, k)))).join(",")})`;
};

/** Ein Bergkamm als Fläche bis zum unteren Rand. */
const ridge = (seed: string, y: number, amp: number, n: number) => {
  const pts: string[] = [];
  for (let i = 0; i <= n; i++) {
    const x = (i / n) * (WIDTH + 200) - 100;
    const h = Math.sin(x / 140 + random(`${seed}a`) * 6) * amp * 0.55 + Math.sin(x / 61 + random(`${seed}b`) * 6) * amp * 0.3 + (random(`${seed}${i}`) - 0.5) * amp * 0.5;
    pts.push(`${x.toFixed(1)} ${(y - h).toFixed(1)}`);
  }
  return `M -100 ${HEIGHT} L ${pts.join(" L ")} L ${WIDTH + 100} ${HEIGHT} Z`;
};

/** Der Gottesberg: kantiger Gipfel rechts, Flanke nach links abfallend. */
const HOREB = "M 360 1300 L 470 1120 L 540 1060 L 600 960 L 650 905 L 700 830 L 742 790 L 772 742 L 806 700 L 838 728 L 870 704 L 912 770 L 960 820 L 1010 900 L 1060 960 L 1180 1060 L 1180 1300 Z";
/** Die mondbeschienene Kante des Gipfels */
const HOREB_RIM = "M 600 960 L 650 905 L 700 830 L 742 790 L 772 742 L 806 700 L 838 728 L 870 704";

export const StormBg: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = frame / FPS;
  const p = frame / Math.max(1, durationInFrames);
  // Ganz am Ende wird es am Horizont heller – die Nacht ist vorbei
  const dawn = interpolate(p, [0.84, 1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const stars = useMemo(
    () =>
      Array.from({ length: 170 }, (_, i) => ({
        x: random(`sbx${i}`) * WIDTH,
        y: 30 + random(`sby${i}`) * 1000,
        r: 0.6 + random(`sbr${i}`) * 1.9,
        ph: random(`sbp${i}`) * 6.28,
        v: 0.6 + random(`sbv${i}`) * 1.6,
      })),
    [],
  );
  const clouds = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => ({
        x: random(`scx${i}`) * 1600,
        y: 260 + random(`scy${i}`) * 520,
        w: 260 + random(`scw${i}`) * 300,
        h: 50 + random(`sch${i}`) * 50,
        v: 4 + random(`scv${i}`) * 6,
      })),
    [],
  );
  const far = useMemo(() => ridge("hbFar", 1150, 90, 30), []);
  const mid = useMemo(() => ridge("hbMid", 1240, 70, 26), []);
  const top = mix("#03051A", "#0E1438", dawn);
  const midC = mix("#0B1234", "#2A2C5A", dawn);
  const hor = mix("#1E2A52", "#B0736A", dawn);
  return (
    <AbsoluteFill>
      <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <linearGradient id="sbSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={top} />
            <stop offset="45%" stopColor={midC} />
            <stop offset="66%" stopColor={hor} />
            <stop offset="100%" stopColor="#0A0D1E" />
          </linearGradient>
          <radialGradient id="sbMoonHalo">
            <stop offset="0%" stopColor="#E6EEFF" stopOpacity="0.42" />
            <stop offset="45%" stopColor="#9FB8FF" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#9FB8FF" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="sbMoon" cx="0.4" cy="0.38" r="0.65">
            <stop offset="0%" stopColor="#FBFCFF" />
            <stop offset="75%" stopColor="#D9E2F6" />
            <stop offset="100%" stopColor="#B4C0DA" />
          </radialGradient>
          <linearGradient id="sbHoreb" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#1C2440" />
            <stop offset="100%" stopColor="#0C1022" />
          </linearGradient>
          <radialGradient id="sbCloud" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#2A3352" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#2A3352" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width={WIDTH} height={HEIGHT} fill="url(#sbSky)" />
        {/* Milchstrasse */}
        <path d="M -100 760 C 260 560, 640 380, 1200 120 L 1200 280 C 660 520, 280 700, -100 900 Z" fill="#AFC0FF" opacity={0.045} />
        {stars.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#EEF3FF" opacity={(0.18 + 0.5 * (0.5 + 0.5 * Math.sin(t * s.v + s.ph))) * (1 - dawn * 0.5)} />
        ))}
        <circle cx={250} cy={430} r={240} fill="url(#sbMoonHalo)" />
        <circle cx={250} cy={430} r={50} fill="url(#sbMoon)" />
        <circle cx={236} cy={420} r={8} fill="#C3CDE2" opacity={0.55} />
        <circle cx={266} cy={446} r={5} fill="#C3CDE2" opacity={0.45} />
        {/* Wolkenbänke, langsam */}
        {clouds.map((c, i) => {
          const x = ((((c.x - t * c.v * 6) % 1700) + 1700) % 1700) - 300;
          return <ellipse key={i} cx={x} cy={c.y} rx={c.w} ry={c.h} fill="url(#sbCloud)" opacity={0.55} />;
        })}
        {/* Morgenschein am Horizont */}
        {dawn > 0 ? <ellipse cx={540} cy={1120} rx={900} ry={260} fill="#FFB27A" opacity={0.16 * dawn} /> : null}
        {/* Ferne Ketten */}
        <path d={far} fill="#141B36" />
        <path d={mid} fill="#0F1428" />
        {/* Der Gottesberg */}
        <path d={HOREB} fill="url(#sbHoreb)" />
        <path d={HOREB_RIM} fill="none" stroke="#8EA3D6" strokeWidth={3} opacity={0.5} strokeLinejoin="round" />
        <path d="M 806 700 L 790 790 L 760 860 M 870 704 L 884 800 L 930 880 M 742 790 L 728 880" stroke="#26304F" strokeWidth={4} fill="none" opacity={0.8} />
        {/* Boden */}
        <rect x={0} y={1290} width={WIDTH} height={HEIGHT - 1290} fill="#090C1A" />
      </svg>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 95% 70% at 50% 45%, rgba(0,0,0,0) 55%, rgba(1,2,10,0.7) 100%)" }} />
    </AbsoluteFill>
  );
};
