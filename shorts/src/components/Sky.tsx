import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame } from "remotion";
import { mix, skyAt } from "../lib/color";
import { HEIGHT, WIDTH } from "../lib/timing";
import { theme } from "../theme";

/**
 * Durchgehender Hintergrund: Himmel, Sterne, aufgehende Sonne, Hügel.
 * Liegt ausserhalb der Szenen-Überblendungen, deshalb wirkt der Sonnenaufgang wie eine Einstellung.
 */
export const Sky: React.FC<{ s: number }> = ({ s }) => {
  const frame = useCurrentFrame();
  const c = skyAt(s);
  const H = theme.layout.horizonY;
  // Sonne steigt nur knapp über die Hügel – sonst läge sie hinter den Untertiteln und schluckt Kontrast.
  const sunY = interpolate(s, [0, 1], [H + 170, H - 60]);
  const starOpacity = interpolate(s, [0, 0.55], [1, 0], { extrapolateRight: "clamp" });

  const stars = useMemo(
    () =>
      Array.from({ length: 90 }, (_, i) => ({
        x: random(`sx${i}`) * WIDTH,
        y: random(`sy${i}`) * H * 0.75,
        r: 0.8 + random(`sr${i}`) * 1.8,
        p: random(`sp${i}`) * Math.PI * 2,
      })),
    [H],
  );

  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          background: `linear-gradient(to bottom, ${c.top} 0%, ${c.mid} 52%, ${c.horizon} ${(H / HEIGHT) * 100}%, ${c.horizon} 100%)`,
        }}
      />
      <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id="sunCore">
            <stop offset="0%" stopColor="#FFF4D6" />
            <stop offset="55%" stopColor="#FFD58A" />
            <stop offset="100%" stopColor="#FFB45E" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="sunGlow">
            <stop offset="0%" stopColor="#FFC877" stopOpacity="0.75" />
            <stop offset="45%" stopColor="#FF9C5A" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#FF9C5A" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="nearHill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0B0912" />
            <stop offset="100%" stopColor="#030308" />
          </linearGradient>
        </defs>

        <g opacity={starOpacity}>
          {stars.map((st, i) => (
            <circle
              key={i}
              cx={st.x}
              cy={st.y}
              r={st.r}
              fill="#FFF6E6"
              opacity={0.35 + 0.45 * (0.5 + 0.5 * Math.sin(frame / 18 + st.p))}
            />
          ))}
        </g>

        <circle cx={WIDTH / 2} cy={sunY} r={760} fill="url(#sunGlow)" opacity={interpolate(s, [0, 0.3, 1], [0.15, 0.55, 1])} />
        <circle cx={WIDTH / 2} cy={sunY} r={125} fill="url(#sunCore)" opacity={interpolate(s, [0, 0.25, 1], [0, 0.6, 1])} />

        {/* Ferne Hügel */}
        <path
          d={`M0 ${H - 10} C 180 ${H - 70}, 330 ${H - 40}, 470 ${H - 60} S 760 ${H - 110}, 900 ${H - 55} S 1060 ${H - 30}, ${WIDTH} ${H - 50} L ${WIDTH} ${HEIGHT} L 0 ${HEIGHT} Z`}
          fill={mix("#0E0B1A", "#3B2A40", s * 0.6)}
          opacity={0.92}
        />
        {/* Nahe Hügel */}
        <path
          d={`M0 ${H + 60} C 200 ${H + 10}, 360 ${H + 50}, 540 ${H + 30} S 860 ${H + 80}, ${WIDTH} ${H + 20} L ${WIDTH} ${HEIGHT} L 0 ${HEIGHT} Z`}
          fill="url(#nearHill)"
        />
      </svg>
      {/* Vignette für Lesbarkeit an den Rändern */}
      <AbsoluteFill
        style={{
          background: "radial-gradient(ellipse 85% 70% at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.5) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
