import React, { useMemo } from "react";
import { AbsoluteFill, random, useCurrentFrame } from "remotion";
import { FPS, HEIGHT, WIDTH } from "../../../lib/timing";
import { mix } from "../../../lib/color";

/*
 * Kurzvideo-Feed spät in der Nacht: ein dunkles Zimmer, nur das Licht des Bildschirms. Es
 * flackert in den Farben der Clips (pink, violett, blau) über die Decke, unten liegt die
 * Bettdecke im Dunkeln, ein paar Staubkörner schweben im Licht.
 */

const GLOW = ["#FF3D71", "#8B7CFF", "#3EA8FF", "#FFB347"];

export const FeedBg: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const k = (t * 0.35) % GLOW.length;
  const i = Math.floor(k);
  const glow = mix(GLOW[i], GLOW[(i + 1) % GLOW.length], k - i);
  const flicker = 0.82 + 0.1 * Math.sin(t * 7.3) + 0.08 * Math.sin(t * 13.1);
  const dust = useMemo(
    () =>
      Array.from({ length: 40 }, (_, n) => ({
        x: 200 + random(`fx${n}`) * 680,
        y: random(`fy${n}`) * HEIGHT,
        r: 1 + random(`fr${n}`) * 2.2,
        v: 6 + random(`fv${n}`) * 14,
        p: random(`fp${n}`) * 6.28,
      })),
    [],
  );
  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg, #07060E 0%, #0C0A18 50%, #05040A 100%)" }}>
      <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id="feedGlow">
            <stop offset="0%" stopColor={glow} stopOpacity="0.42" />
            <stop offset="55%" stopColor={glow} stopOpacity="0.1" />
            <stop offset="100%" stopColor={glow} stopOpacity="0" />
          </radialGradient>
          <linearGradient id="feedBlanket" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1A1838" />
            <stop offset="100%" stopColor="#07060E" />
          </linearGradient>
        </defs>
        <ellipse cx={540} cy={760} rx={760} ry={820} fill="url(#feedGlow)" opacity={flicker} />
        {dust.map((d, n) => {
          const y = (((d.y - t * d.v) % HEIGHT) + HEIGHT) % HEIGHT;
          return <circle key={n} cx={d.x + Math.sin(t * 0.6 + d.p) * 20} cy={y} r={d.r} fill="#FFFFFF" opacity={0.08 + 0.12 * Math.sin(t + d.p) ** 2} />;
        })}
        {/* Bettdecke */}
        <path d={`M 0 1560 C 220 1490, 380 1620, 600 1560 S 940 1480, 1080 1540 L 1080 1920 L 0 1920 Z`} fill="url(#feedBlanket)" />
        <path d={`M 0 1560 C 220 1490, 380 1620, 600 1560 S 940 1480, 1080 1540`} stroke={glow} strokeWidth={3} fill="none" opacity={0.25 * flicker} />
        <path d={`M 0 1700 C 260 1650, 520 1760, 760 1690 S 1000 1660, 1080 1680`} stroke="#000000" strokeWidth={40} fill="none" opacity={0.25} />
      </svg>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 80% 70% at 50% 40%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.75) 100%)" }} />
    </AbsoluteFill>
  );
};
