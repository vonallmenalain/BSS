import React, { useMemo } from "react";
import { AbsoluteFill, random, useCurrentFrame } from "remotion";
import { FPS, HEIGHT, WIDTH } from "../../lib/timing";

/*
 * Weltraum: tiefes Blau-Schwarz, ein schwacher Nebel und Sterne in drei Ebenen, die langsam
 * vorbeiziehen (Parallaxe) und funkeln. Ruhig – die Mission spielt sich in den Szenen ab.
 */

const LAYERS = [
  { n: 110, r: [0.6, 1.3], speed: 3, alpha: 0.5 },
  { n: 55, r: [1.1, 2.0], speed: 7, alpha: 0.7 },
  { n: 18, r: [1.8, 3.0], speed: 14, alpha: 0.95 },
] as const;

export const SpaceBg: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const stars = useMemo(
    () =>
      LAYERS.map((layer, l) =>
        Array.from({ length: layer.n }, (_, i) => ({
          x: random(`spx${l}-${i}`) * WIDTH,
          y: random(`spy${l}-${i}`) * HEIGHT,
          r: layer.r[0] + random(`spr${l}-${i}`) * (layer.r[1] - layer.r[0]),
          p: random(`spp${l}-${i}`) * Math.PI * 2,
          warm: random(`spw${l}-${i}`) < 0.18,
        })),
      ),
    [],
  );
  const drift = (base: number, speed: number) => (((base - t * speed) % WIDTH) + WIDTH) % WIDTH;
  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg, #02030B 0%, #060B22 42%, #0D0E2B 75%, #140B26 100%)" }}>
      <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id="nebA">
            <stop offset="0%" stopColor="#6B3FA0" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#6B3FA0" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="nebB">
            <stop offset="0%" stopColor="#1E7F9E" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#1E7F9E" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="nebC">
            <stop offset="0%" stopColor="#C2553A" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#C2553A" stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* Nebel: grosse, weiche Flecken, die kaum merklich wandern */}
        <ellipse cx={260 + Math.sin(t * 0.05) * 30} cy={560} rx={620} ry={380} fill="url(#nebA)" />
        <ellipse cx={860 + Math.cos(t * 0.04) * 30} cy={1180} rx={560} ry={420} fill="url(#nebB)" />
        <ellipse cx={720} cy={300} rx={420} ry={260} fill="url(#nebC)" />
        {stars.map((layer, l) =>
          layer.map((s, i) => {
            const tw = 0.55 + 0.45 * Math.sin(t * (1.2 + l * 0.6) + s.p);
            return (
              <circle
                key={`${l}-${i}`}
                cx={drift(s.x, LAYERS[l].speed)}
                cy={s.y}
                r={s.r}
                fill={s.warm ? "#FFE2C4" : "#EAF2FF"}
                opacity={LAYERS[l].alpha * tw}
              />
            );
          }),
        )}
      </svg>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 85% 70% at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)" }} />
    </AbsoluteFill>
  );
};
