import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { HEIGHT, WIDTH } from "../../../lib/timing";

/*
 * Wald (Enos 1): Die Folge läuft über einen ganzen Tag und eine Nacht – Nachmittag im Wald,
 * die Sonne sinkt hinter die Bäume, während Enos betet («den ganzen Tag»), Nacht mit Mond,
 * Sternen und Glühwürmchen, am Ende der Morgen. Der Hintergrund kennt nur den Fortschritt der
 * Folge (Frame / Länge); Enos selbst zeichnet die Szene.
 */

const STOPS: Array<{ p: number; top: string; hor: string; far: string; mid: string; near: string; floor: string; day: number }> = [
  { p: 0, top: "#6FA8C8", hor: "#F4E2A8", far: "#6F8F78", mid: "#3E5E46", near: "#1C2E22", floor: "#2E3A22", day: 1 },
  { p: 0.3, top: "#6A98BE", hor: "#F6D08E", far: "#66846C", mid: "#38553E", near: "#1A2A1F", floor: "#2B3520", day: 0.9 },
  { p: 0.5, top: "#4A5E92", hor: "#F2A066", far: "#4E5E5A", mid: "#2C3E34", near: "#15201A", floor: "#232A1C", day: 0.6 },
  { p: 0.6, top: "#1E2350", hor: "#7A4A62", far: "#2A3040", mid: "#1A2430", near: "#0D1418", floor: "#151A16", day: 0.25 },
  { p: 0.66, top: "#070B22", hor: "#16204A", far: "#141C30", mid: "#0E1622", near: "#070C10", floor: "#0B100E", day: 0 },
  { p: 0.8, top: "#070B22", hor: "#16204A", far: "#141C30", mid: "#0E1622", near: "#070C10", floor: "#0B100E", day: 0 },
  { p: 0.9, top: "#262B5E", hor: "#C9806E", far: "#3A4650", mid: "#22302E", near: "#101816", floor: "#19201A", day: 0.4 },
  { p: 1, top: "#34507E", hor: "#E8A878", far: "#4A6458", mid: "#2C4234", near: "#141F18", floor: "#222B1C", day: 0.6 },
];

const hex = (s: string) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
const mixHex = (a: string, b: string, k: number) => {
  const pa = hex(a);
  const pb = hex(b);
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * Math.max(0, Math.min(1, k)))).join(",")})`;
};

export const forestColors = (p: number) => {
  let i = 0;
  while (i < STOPS.length - 2 && p > STOPS[i + 1].p) i++;
  const a = STOPS[i];
  const b = STOPS[i + 1];
  const k = Math.max(0, Math.min(1, (p - a.p) / (b.p - a.p)));
  const m = (key: "top" | "hor" | "far" | "mid" | "near" | "floor") => mixHex(a[key], b[key], k);
  return { top: m("top"), hor: m("hor"), far: m("far"), mid: m("mid"), near: m("near"), floor: m("floor"), day: a.day + (b.day - a.day) * k };
};

/** Ein Nadelbaum als Silhouette, Fuss bei (x, y) */
const fir = (x: number, y: number, h: number, w: number) => {
  const tiers = 5;
  let d = `M ${x - 6} ${y} L ${x - 6} ${y - h * 0.12} `;
  for (let i = 0; i < tiers; i++) {
    const ty = y - h * 0.12 - (i * h * 0.85) / tiers;
    const tw = w * (1 - i / (tiers + 0.5));
    d += `L ${x - tw / 2} ${ty} L ${x - tw * 0.18} ${ty - h * 0.2} `;
  }
  d += `L ${x} ${y - h} `;
  for (let i = tiers - 1; i >= 0; i--) {
    const ty = y - h * 0.12 - (i * h * 0.85) / tiers;
    const tw = w * (1 - i / (tiers + 0.5));
    d += `L ${x + tw * 0.18} ${ty - h * 0.2} L ${x + tw / 2} ${ty} `;
  }
  return `${d}L ${x + 6} ${y - h * 0.12} L ${x + 6} ${y} Z`;
};

export const ForestBg: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = frame / Math.max(1, durationInFrames);
  const c = forestColors(p);
  const night = interpolate(p, [0.56, 0.64, 0.82, 0.9], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const sunY = interpolate(p, [0, 0.58], [430, 1010], { extrapolateRight: "clamp" });
  const sunX = interpolate(p, [0, 0.58], [780, 880], { extrapolateRight: "clamp" });
  const dawn = interpolate(p, [0.84, 1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const moonY = interpolate(p, [0.58, 0.86], [700, 360], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const far = useMemo(() => Array.from({ length: 16 }, (_, i) => ({ x: -40 + i * 75 + random(`ff${i}`) * 30, h: 260 + random(`fh${i}`) * 140, w: 120 + random(`fw${i}`) * 50 })), []);
  const mid = useMemo(() => Array.from({ length: 9 }, (_, i) => ({ x: -60 + i * 140 + random(`mf${i}`) * 50, h: 420 + random(`mh${i}`) * 200, w: 190 + random(`mw${i}`) * 70 })), []);
  const stars = useMemo(() => Array.from({ length: 110 }, (_, i) => ({ x: random(`fs${i}`) * WIDTH, y: random(`fy${i}`) * 820, r: 0.9 + random(`fr${i}`) * 2, ph: random(`fp${i}`) * 6.28 })), []);
  const flies = useMemo(() => Array.from({ length: 26 }, (_, i) => ({ x: random(`gx${i}`) * WIDTH, y: 900 + random(`gy${i}`) * 300, ph: random(`gp${i}`) * 6.28, v: 0.6 + random(`gv${i}`) })), []);
  const ferns = useMemo(() => Array.from({ length: 9 }, (_, i) => ({ x: 40 + i * 125 + random(`fx${i}`) * 40, y: 1104 + random(`fy${i}`) * 50, s: 0.7 + random(`fs${i}`) * 0.6 })), []);
  const stones = useMemo(() => Array.from({ length: 12 }, (_, i) => ({ x: random(`sx${i}`) * WIDTH, y: 1110 + random(`sy${i}`) * 70, r: 6 + random(`sr${i}`) * 10 })), []);
  const rays = c.day * (1 - dawn * 0.4);
  return (
    <AbsoluteFill style={{ background: c.top }}>
      <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <linearGradient id="fbSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c.top} />
            <stop offset="55%" stopColor={c.hor} />
            <stop offset="100%" stopColor={c.hor} />
          </linearGradient>
          <radialGradient id="fbSun">
            <stop offset="0%" stopColor="#FFF6D0" stopOpacity="1" />
            <stop offset="20%" stopColor="#FFE3A0" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#FFC27A" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="fbMoon">
            <stop offset="0%" stopColor="#E8EEFF" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#E8EEFF" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="fbRay" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFF2C8" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#FFF2C8" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="fbFly">
            <stop offset="0%" stopColor="#EFFFA8" stopOpacity="1" />
            <stop offset="100%" stopColor="#C7F59B" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width={WIDTH} height={HEIGHT} fill="url(#fbSky)" />
        {stars.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#F2F4FF" opacity={night * (0.35 + 0.55 * (0.5 + 0.5 * Math.sin(frame / 15 + s.ph)))} />
        ))}
        {/* Sonne am Nachmittag, sinkt hinter die Bäume */}
        <g opacity={interpolate(p, [0.5, 0.6], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}>
          <circle cx={sunX} cy={sunY} r={360} fill="url(#fbSun)" opacity={0.7} />
          <circle cx={sunX} cy={sunY} r={62} fill="#FFF0C0" />
        </g>
        {/* Mond in der Nacht */}
        <g opacity={night}>
          <circle cx={250} cy={moonY} r={200} fill="url(#fbMoon)" />
          <path transform={`translate(250 ${moonY})`} d="M 8 -52 A 52 52 0 1 0 46 26 A 44 44 0 1 1 8 -52 Z" fill="#EEF2FF" />
        </g>
        {/* Morgenrot */}
        {dawn > 0 ? <ellipse cx={860} cy={1010} rx={700} ry={360} fill="url(#fbSun)" opacity={0.55 * dawn} /> : null}
        {/* Bäume in drei Tiefen */}
        {far.map((tr, i) => (
          <path key={i} d={fir(tr.x, 1040, tr.h, tr.w)} fill={c.far} />
        ))}
        <rect x={0} y={1030} width={WIDTH} height={HEIGHT - 1030} fill={c.far} />
        {/* Lichtbahnen durch die Bäume am Tag */}
        {rays > 0.05
          ? [0, 1, 2, 3].map((i) => (
              <path key={i} d={`M ${sunX - 120 + i * 70} 300 L ${180 + i * 150} 1150 L ${290 + i * 150} 1150 Z`} fill="url(#fbRay)" opacity={rays * (0.6 + 0.4 * Math.sin(frame / 40 + i))} />
            ))
          : null}
        {mid.map((tr, i) => (
          <path key={i} d={fir(tr.x, 1080, tr.h, tr.w)} fill={c.mid} />
        ))}
        {/* Waldboden */}
        <path d="M 0 1090 C 200 1070, 420 1100, 600 1084 C 780 1070, 920 1096, 1080 1080 L 1080 1920 L 0 1920 Z" fill={c.floor} />
        {/* Farne und Steine am Boden */}
        {ferns.map((fe, i) => (
          <g key={i} transform={`translate(${fe.x} ${fe.y}) scale(${fe.s})`}>
            {[-60, -30, 0, 30, 60].map((a, k) => (
              <path key={k} d={`M 0 0 Q ${Math.sin((a * Math.PI) / 180) * 50} -40 ${Math.sin((a * Math.PI) / 180) * 90} ${-60 + Math.abs(a) * 0.6}`} stroke={c.mid} strokeWidth={7} fill="none" strokeLinecap="round" />
            ))}
          </g>
        ))}
        {stones.map((st, i) => (
          <ellipse key={i} cx={st.x} cy={st.y} rx={st.r * 1.6} ry={st.r} fill={c.near} opacity={0.7} />
        ))}
        {/* Nahe Stämme am Rand */}
        {[
          [-30, 120],
          [1010, 140],
          [930, 60],
        ].map(([x, w], i) => (
          <g key={i}>
            <rect x={x} y={0} width={w} height={1200} fill={c.near} />
            <path d={`M ${x - 40} 1200 Q ${x + w / 2} 1150 ${x + w + 40} 1200 Z`} fill={c.near} />
          </g>
        ))}
        <path d="M -40 0 L 420 0 C 360 80, 240 120, 120 170 C 60 200, 0 260, -40 300 Z" fill={c.near} />
        <path d="M 1120 0 L 700 0 C 760 70, 860 110, 960 150 C 1020 180, 1080 230, 1120 280 Z" fill={c.near} />
        {/* Glühwürmchen in der Nacht */}
        {flies.map((fl, i) => {
          const x = fl.x + Math.sin(frame / 30 * fl.v + fl.ph) * 40;
          const y = fl.y + Math.cos(frame / 24 * fl.v + fl.ph) * 30;
          const o = night * (0.3 + 0.7 * Math.max(0, Math.sin(frame / 10 * fl.v + fl.ph)));
          return o > 0.02 ? <circle key={i} cx={x} cy={y} r={14} fill="url(#fbFly)" opacity={o} /> : null;
        })}
        {/* Morgennebel */}
        {dawn > 0
          ? [0, 1, 2].map((i) => <ellipse key={i} cx={((frame * (0.5 + i * 0.3) + i * 400) % 1600) - 260} cy={1050 + i * 30} rx={420} ry={60} fill="#FFF4E0" opacity={0.12 * dawn} />)
          : null}
      </svg>
    </AbsoluteFill>
  );
};
