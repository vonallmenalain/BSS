import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { HEIGHT, WIDTH } from "../../../lib/timing";

/*
 * Abendweg nach Emmaus (Lukas 24): Der Himmel läuft mit der ganzen Folge vom goldenen
 * Nachmittag über den Sonnenuntergang in die Nacht – «es wird Abend, der Tag hat sich schon
 * geneigt» (24:29). Die Sonne sinkt hinter die fernen Hügel, dann kommen die Sterne. Der
 * Hintergrund kennt nur den Fortschritt der Folge (Frame / Länge); Weg, Bäume und Figuren
 * zeichnet die Szene davor.
 */

/** Himmelsfarben entlang der Folge: oben, Mitte, Horizont */
const STOPS: Array<{ p: number; top: string; mid: string; hor: string; hill: string; hill2: string }> = [
  { p: 0, top: "#34478A", mid: "#B97A92", hor: "#FFCB86", hill: "#7A5470", hill2: "#5C3E5C" },
  { p: 0.3, top: "#2C3170", mid: "#A65A7C", hor: "#FFA060", hill: "#64405E", hill2: "#4A2E4C" },
  { p: 0.5, top: "#1D2154", mid: "#6E3B68", hor: "#EC6B48", hill: "#43284A", hill2: "#331E3C" },
  { p: 0.62, top: "#10143C", mid: "#2E2252", hor: "#7A3452", hill: "#24183A", hill2: "#1C1330" },
  { p: 0.74, top: "#060A22", mid: "#0E1338", hor: "#221C46", hill: "#120E26", hill2: "#0D0A1E" },
  { p: 1, top: "#050820", mid: "#0B1034", hor: "#1C1840", hill: "#100C22", hill2: "#0B091A" },
];

const hex = (s: string) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
const mixHex = (a: string, b: string, k: number) => {
  const pa = hex(a);
  const pb = hex(b);
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * Math.max(0, Math.min(1, k)))).join(",")})`;
};

/** Farben zum Fortschritt p (0 … 1). */
export const duskColors = (p: number) => {
  let i = 0;
  while (i < STOPS.length - 2 && p > STOPS[i + 1].p) i++;
  const a = STOPS[i];
  const b = STOPS[i + 1];
  const k = Math.max(0, Math.min(1, (p - a.p) / (b.p - a.p)));
  return {
    top: mixHex(a.top, b.top, k),
    mid: mixHex(a.mid, b.mid, k),
    hor: mixHex(a.hor, b.hor, k),
    hill: mixHex(a.hill, b.hill, k),
    hill2: mixHex(a.hill2, b.hill2, k),
  };
};

/** Hügelkamm als Fläche bis zum Bildrand unten. */
const ridge = (seed: string, y: number, amp: number, n: number, offset: number) => {
  const pts: string[] = [];
  const w = WIDTH + 400;
  for (let i = 0; i <= n; i++) {
    const x = (i / n) * w - 200;
    const xx = x + offset;
    const h = Math.sin(xx / 210 + random(`${seed}a`) * 6) * amp * 0.6 + Math.sin(xx / 97 + random(`${seed}b`) * 6) * amp * 0.3 + Math.sin(xx / 41) * amp * 0.1;
    pts.push(`${x.toFixed(1)} ${(y - h).toFixed(1)}`);
  }
  return `M -200 ${HEIGHT} L ${pts.join(" L ")} L ${WIDTH + 200} ${HEIGHT} Z`;
};

export const DuskBg: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = frame / Math.max(1, durationInFrames);
  const c = duskColors(p);
  const sunY = interpolate(p, [0, 0.52], [770, 1035], { extrapolateRight: "clamp" });
  const sunO = interpolate(p, [0.46, 0.56], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const starO = interpolate(p, [0.52, 0.74], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  // Bis zur Ankunft am Haus ziehen die fernen Hügel langsam vorbei
  const walk = Math.min(frame, durationInFrames * 0.56);
  const stars = useMemo(
    () => Array.from({ length: 90 }, (_, i) => ({ x: random(`dk${i}`) * WIDTH, y: random(`dy${i}`) * 900, r: 0.9 + random(`dr${i}`) * 2, ph: random(`dp${i}`) * 6.28 })),
    [],
  );
  const clouds = useMemo(
    () => Array.from({ length: 6 }, (_, i) => ({ x: random(`cx${i}`) * WIDTH, y: 360 + i * 85 + random(`cy${i}`) * 40, w: 260 + random(`cw${i}`) * 300, v: 0.15 + random(`cv${i}`) * 0.2 })),
    [],
  );
  const glow = interpolate(p, [0, 0.5, 0.62], [1, 1, 0.2], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: c.top }}>
      <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <linearGradient id="dkSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c.top} />
            <stop offset="42%" stopColor={c.mid} />
            <stop offset="56%" stopColor={c.hor} />
            <stop offset="100%" stopColor={c.hor} />
          </linearGradient>
          <radialGradient id="dkSun">
            <stop offset="0%" stopColor="#FFF4CC" stopOpacity="1" />
            <stop offset="18%" stopColor="#FFD58A" stopOpacity="0.9" />
            <stop offset="45%" stopColor="#FF9A5C" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#FF9A5C" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width={WIDTH} height={HEIGHT} fill="url(#dkSky)" />
        {stars.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#F3F0FF" opacity={starO * (0.35 + 0.55 * (0.5 + 0.5 * Math.sin(frame / 14 + s.ph)))} />
        ))}
        {/* Sonne mit Hof */}
        <g opacity={sunO}>
          <circle cx={720} cy={sunY} r={430} fill="url(#dkSun)" opacity={0.85 * glow} />
          <circle cx={720} cy={sunY} r={74} fill="#FFE3A1" />
        </g>
        {/* Lange, flache Wolken im Abendlicht */}
        {clouds.map((cl, i) => {
          const span = WIDTH + cl.w;
          const x = ((((cl.x - frame * cl.v) % span) + span) % span) - cl.w / 2;
          return (
            <g key={i} opacity={0.5 * (1 - starO * 0.7)}>
              <ellipse cx={x} cy={cl.y} rx={cl.w / 2} ry={16} fill={mixHex("#FFD9B0", "#3A2A55", p * 1.4)} />
              <ellipse cx={x + cl.w * 0.12} cy={cl.y - 12} rx={cl.w / 3} ry={13} fill={mixHex("#FFE6C8", "#3A2A55", p * 1.4)} opacity={0.8} />
            </g>
          );
        })}
        {/* Vögel am Nachmittag */}
        {p < 0.4
          ? [0, 1, 2].map((i) => {
              const bx = 1180 - frame * 1.6 - i * 60;
              const by = 520 + i * 24 + Math.sin(frame / 12 + i) * 8;
              const wing = 10 * Math.sin(frame / 4 + i);
              return <path key={i} d={`M ${bx - 16} ${by - wing} Q ${bx - 8} ${by - 6} ${bx} ${by} Q ${bx + 8} ${by - 6} ${bx + 16} ${by - wing}`} stroke="#3A2440" strokeWidth={3} fill="none" opacity={interpolate(p, [0.3, 0.4], [0.7, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />;
            })
          : null}
        {/* Ferne Hügel in zwei Schichten */}
        <path d={ridge("far", 950, 70, 60, walk * 0.25)} fill={c.hill} />
        <path d={ridge("near", 1010, 50, 60, walk * 0.5 + 300)} fill={c.hill2} />
      </svg>
    </AbsoluteFill>
  );
};
