import React, { useMemo } from "react";
import { AbsoluteFill, random, useCurrentFrame } from "remotion";
import { FPS, HEIGHT, WIDTH } from "../../lib/timing";

/*
 * Lehis Traum (1 Nephi 8): tiefblaue Nacht, ein paar schwache Sterne, weiche Nebelbänke,
 * die langsam durchziehen, und von oben ein Hauch vom Licht des Baumes. Bewusst ruhig –
 * die Szene darüber erzählt.
 */

export const DreamBg: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const stars = useMemo(
    () =>
      Array.from({ length: 80 }, (_, i) => ({
        x: random(`ds${i}`) * WIDTH,
        y: random(`dy${i}`) * HEIGHT * 0.9,
        r: 0.8 + random(`dr${i}`) * 1.8,
        p: random(`dp${i}`) * 6.28,
        v: 0.6 + random(`dv${i}`) * 1.4,
      })),
    [],
  );
  const bands = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => ({
        y: 180 + i * 200 + random(`by${i}`) * 80,
        w: 700 + random(`bw${i}`) * 600,
        h: 90 + random(`bh${i}`) * 90,
        x0: random(`bx${i}`) * WIDTH,
        v: (8 + random(`bv${i}`) * 14) * (i % 2 ? 1 : -1),
        o: 0.05 + random(`bo${i}`) * 0.07,
      })),
    [],
  );
  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg, #050A22 0%, #0A1338 38%, #111C4A 70%, #0B1233 100%)" }}>
      <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id="dreamFog">
            <stop offset="0%" stopColor="#B9D6FF" stopOpacity="1" />
            <stop offset="100%" stopColor="#B9D6FF" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="dreamHalo" cx="0.5" cy="0.2" r="0.6">
            <stop offset="0%" stopColor="#FFF1C2" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#FFF1C2" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width={WIDTH} height={HEIGHT} fill="url(#dreamHalo)" />
        {stars.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#E8F0FF" opacity={0.15 + 0.4 * (0.5 + 0.5 * Math.sin(t * s.v + s.p))} />
        ))}
        {bands.map((b, i) => {
          const span = WIDTH + b.w;
          const x = ((((b.x0 + t * b.v) % span) + span) % span) - b.w / 2;
          return <ellipse key={i} cx={x} cy={b.y + Math.sin(t * 0.3 + i) * 12} rx={b.w / 2} ry={b.h} fill="url(#dreamFog)" opacity={b.o} />;
        })}
      </svg>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 85% 70% at 50% 42%, rgba(0,0,0,0) 50%, rgba(2,4,16,0.7) 100%)" }} />
    </AbsoluteFill>
  );
};
