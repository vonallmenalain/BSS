import React, { useMemo } from "react";
import { Easing, interpolate, random } from "remotion";
import { HEIGHT, WIDTH, type Word, cueTime } from "../lib/timing";
import { Warrior } from "./Figures";

const ridge = (x: number) =>
  880 + 26 * Math.sin(x * 0.0062 + 1.3) + 14 * Math.sin(x * 0.017 + 0.4) + 6 * Math.sin(x * 0.05);

/**
 * Szene "Heer": Am Horizont wächst eine Wand aus Speeren. Vorne eine kleine Gruppe,
 * die aufleuchtet, sobald Helaman die Frage stellt.
 */
export const HorizonMotif: React.FC<{ t: number; words: Word[]; duration: number; cue?: string }> = ({
  t,
  words,
  duration,
  cue = "Helaman fragt",
}) => {
  const askAt = cueTime(words, cue, 2.4);
  const armyEnd = Math.max(1.2, askAt - 0.3);

  const spears = useMemo(
    () =>
      Array.from({ length: 340 }, (_, i) => {
        const x = random(`spx${i}`) * WIDTH;
        return {
          x,
          h: 50 + random(`sph${i}`) * 90,
          d: random(`spd${i}`),
          lean: (random(`spl${i}`) - 0.5) * 6,
        };
      }),
    [],
  );

  const ridgePath = useMemo(() => {
    let d = `M 0 ${ridge(0)}`;
    for (let x = 12; x <= WIDTH; x += 12) d += ` L ${x} ${ridge(x).toFixed(1)}`;
    return d;
  }, []);

  const push = interpolate(t, [0, duration], [1, 1.07]);
  const glow = interpolate(t, [0, armyEnd], [0.15, 0.55], { extrapolateRight: "clamp" });
  const rim = interpolate(t, [askAt - 0.2, askAt + 0.6], [0.25, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <svg
      width={WIDTH}
      height={HEIGHT}
      style={{ position: "absolute", inset: 0, transform: `scale(${push})`, transformOrigin: "50% 48%" }}
    >
      <defs>
        <radialGradient id="ember" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#C2453A" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#C2453A" stopOpacity="0" />
        </radialGradient>
        <clipPath id="aboveRidge">
          <path d={`${ridgePath} L ${WIDTH} 0 L 0 0 Z`} />
        </clipPath>
        <linearGradient id="plain" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#140F22" />
          <stop offset="100%" stopColor="#050409" />
        </linearGradient>
        <linearGradient id="fog" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2A1E36" stopOpacity="0" />
          <stop offset="50%" stopColor="#2A1E36" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#2A1E36" stopOpacity="0" />
        </linearGradient>
      </defs>

      <ellipse cx={WIDTH / 2} cy={890} rx={760} ry={240} fill="url(#ember)" opacity={glow} />

      {/* Speerwand: steigt hinter dem Kamm auf */}
      <g clipPath="url(#aboveRidge)">
        {spears.map((s, i) => {
          const start = s.d * armyEnd * 0.85;
          const up = interpolate(t, [start, start + 0.7], [s.h + 40, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.out(Easing.cubic),
          });
          const base = ridge(s.x) + 6 + up;
          return (
            <g key={i} transform={`translate(${s.x} ${base}) rotate(${s.lean})`} fill="#07060D">
              <rect x={-1.6} y={-s.h} width={3.2} height={s.h + 10} />
              <path d={`M 0 ${-s.h - 16} L 5 ${-s.h} L -5 ${-s.h} Z`} />
            </g>
          );
        })}
      </g>

      <path d={`${ridgePath} L ${WIDTH} ${HEIGHT} L 0 ${HEIGHT} Z`} fill="url(#plain)" />
      <rect x={0} y={930} width={WIDTH} height={200} fill="url(#fog)" />

      {/* Naher Hügel mit der kleinen Gruppe */}
      <path
        d={`M 0 1190 C 220 1120, 420 1150, 560 1185 S 900 1250, ${WIDTH} 1230 L ${WIDTH} ${HEIGHT} L 0 ${HEIGHT} Z`}
        fill="#030207"
      />
      {[150, 225, 300, 372, 445].map((x, i) => (
        <Warrior key={x} x={x} y={1176 + i * 3} scale={0.62} rim={rim} fill="#030207" />
      ))}
    </svg>
  );
};
