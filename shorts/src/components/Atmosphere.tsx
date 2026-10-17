import React, { useMemo } from "react";
import { AbsoluteFill, random, useCurrentFrame } from "remotion";
import { FPS, HEIGHT, WIDTH } from "../lib/timing";

/** Schwebende Staubpartikel – geben Tiefe, ohne vom Text abzulenken. */
export const Particles: React.FC<{ s: number }> = ({ s }) => {
  const frame = useCurrentFrame();
  const motes = useMemo(
    () =>
      Array.from({ length: 42 }, (_, i) => ({
        x: random(`px${i}`) * WIDTH,
        y: random(`py${i}`) * HEIGHT,
        v: 14 + random(`pv${i}`) * 34,
        r: 1.4 + random(`pr${i}`) * 3.2,
        sway: 10 + random(`pw${i}`) * 26,
        p: random(`pp${i}`) * 6.28,
        o: 0.15 + random(`po${i}`) * 0.4,
      })),
    [],
  );
  const t = frame / FPS;
  return (
    <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", inset: 0 }}>
      {motes.map((m, i) => {
        const y = (((m.y - m.v * t) % HEIGHT) + HEIGHT) % HEIGHT;
        const x = m.x + Math.sin(t * 0.6 + m.p) * m.sway;
        return <circle key={i} cx={x} cy={y} r={m.r} fill="#FFE2A8" opacity={m.o * (0.4 + 0.6 * s)} />;
      })}
    </svg>
  );
};

const GRAIN_TILE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='256' height='256'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 1.2 -0.1'/></filter><rect width='256' height='256' filter='url(#n)'/></svg>`,
  );

/** Filmkorn als gekachelte Textur; pro Frame leicht versetzt, damit es lebt. Günstig zu rendern. */
export const Grain: React.FC = () => {
  const frame = useCurrentFrame();
  const dx = Math.floor(random(`gx${frame}`) * 256);
  const dy = Math.floor(random(`gy${frame}`) * 256);
  return (
    <AbsoluteFill
      style={{
        backgroundImage: `url("${GRAIN_TILE}")`,
        backgroundPosition: `${dx}px ${dy}px`,
        opacity: 0.09,
        mixBlendMode: "overlay",
        pointerEvents: "none",
      }}
    />
  );
};
