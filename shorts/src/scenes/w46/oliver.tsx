import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, random, useCurrentFrame } from "remotion";
import { useLook } from "../../looks";
import { Sfx, beats, voiceFrame } from "../../lib/sfx";
import { FPS, type TimelineScene, findCue } from "../../lib/timing";
import type { Scene as SceneData } from "../../schema";
import { wordsOfTexts } from "../w45/kitA";

/*
 * «Niemand wusste es» – Oliver Cowdery und das Gebet, von dem nur Gott wusste (LuB 6:14–24).
 *
 * Winter 1828: Das Farmhaus der Familie Smith bei Manchester im Schnitt, alle schlafen – nur in
 * einer Kammer steigt ein Gebet auf. Oliver kommt mit seinen Schulbüchern durch den Schnee und
 * hört von Joseph und den goldenen Platten. Nachts im Bett betet er still; die Kerze geht aus,
 * Mondlicht – und dann Frieden. Er erzählt es niemandem: ein Brief, versiegelt «Nur Gott und
 * Oliver». Im Frühling 1829 die Reise auf der Karte nach Harmony, er wird Josephs Schreiber. Am
 * Tisch erscheinen die Worte der Offenbarung in Handschrift – und Oliver erstarrt: Das Siegel
 * bricht auf.
 *
 * Joseph und Oliver sind Silhouetten mit Streiflicht, ohne Gesicht im Detail. Den Raum (Wand,
 * Fenster, Kerzenlicht, Winter → Frühling) zeichnet `CandleBg`; Haus im Schnee und Karte decken
 * ihn ganz zu.
 */

type OliverSceneT = Extract<SceneData, { type: "oliver" }>;
type P = [number, number];

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = Easing.inOut(Easing.sin);
const fade = (t: number, at: number, d = 0.4) => interpolate(t, [at, at + d], [0, 1], clamp);
const out = (t: number, at: number, d = 0.4) => interpolate(t, [at, at + d], [1, 0], clamp);
const hex = (s: string) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
const mix = (a: string, b: string, k: number) => {
  const pa = hex(a);
  const pb = hex(b);
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * Math.max(0, Math.min(1, k)))).join(",")})`;
};
const lerp = (a: P, b: P, k: number): P => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];

const INK = "#2A1A0E";

/* ------------------------------------------------------------------ */
/* Figur: ein junger Mann um 1829, von der Seite                       */
/* ------------------------------------------------------------------ */

type Joints = { hip: P; kneeF: P; footF: P; kneeB: P; footB: P; shoulder: P; elbow: P; hand: P; elbow2: P; hand2: P; head: P };

const STAND: Joints = {
  hip: [0, -150],
  kneeF: [6, -76],
  footF: [12, 0],
  kneeB: [-4, -76],
  footB: [-8, 0],
  shoulder: [0, -272],
  elbow: [10, -212],
  hand: [18, -154],
  elbow2: [-8, -212],
  hand2: [-10, -156],
  head: [6, -310],
};

/** Sitzend am Tisch (Tischplatte bei y −150, Hand darauf) */
const SIT: Joints = {
  hip: [-6, -112],
  kneeF: [60, -116],
  footF: [58, 0],
  kneeB: [52, -114],
  footB: [46, 0],
  shoulder: [8, -250],
  elbow: [44, -178],
  hand: [94, -158],
  elbow2: [32, -182],
  hand2: [80, -160],
  head: [16, -290],
};
const TABLE_Y = -150;

type Dress = { coat: string; coatDark: string; legs: string; skin: string; hair: string; shirt: string };

const OLIVER: Dress = { coat: "#2E3650", coatDark: "#1E2438", legs: "#3A3026", skin: "#C79A78", hair: "#3A2414", shirt: "#E6DED0" };
const JOSEPH: Dress = { coat: "#4A3424", coatDark: "#30221A", legs: "#2E2620", skin: "#CFA07C", hair: "#7A5432", shirt: "#E6DED0" };

const shadeDress = (d: Dress, dark: number): Dress => ({
  coat: mix(d.coat, "#06040A", dark),
  coatDark: mix(d.coatDark, "#06040A", dark),
  legs: mix(d.legs, "#06040A", dark),
  skin: mix(d.skin, "#06040A", dark * 0.9),
  hair: mix(d.hair, "#06040A", dark),
  shirt: mix(d.shirt, "#06040A", dark * 0.85),
});
const flat = (c: string): Dress => ({ coat: c, coatDark: c, legs: c, skin: c, hair: c, shirt: c });

const limb = (pts: P[], color: string, w: number) => (
  <path d={`M ${pts.map((q) => q.join(" ")).join(" L ")}`} stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" fill="none" />
);

const Boot: React.FC<{ at: P; c: string }> = ({ at, c }) => <path d={`M ${at[0] - 14} ${at[1] - 16} L ${at[0] + 18} ${at[1] - 12} Q ${at[0] + 30} ${at[1] - 4} ${at[0] + 24} ${at[1]} L ${at[0] - 14} ${at[1]} Z`} fill={c} />;

const GentBody: React.FC<{ j: Joints; d: Dress; hat?: boolean; books?: boolean; quill?: boolean; quillO?: number; lift?: number }> = ({ j, d, hat = false, books = false, quill = false, quillO = 1, lift = 0 }) => {
  const [sx, sy] = j.shoulder;
  const [hx, hy] = j.hip;
  const my = (sy + hy) / 2;
  const [cx, cy] = [j.head[0] - lift * 4, j.head[1] - lift * 6];
  return (
    <g>
      {/* hinteres Bein, hinterer Arm */}
      {limb([j.hip, j.kneeB, j.footB], d.legs, 24)}
      <Boot at={j.footB} c={mix(d.legs, "#000000", 0.4)} />
      {limb([[sx - 4, sy + 10], j.elbow2, j.hand2], d.coatDark, 19)}
      <circle cx={j.hand2[0]} cy={j.hand2[1] + 3} r={9} fill={d.skin} />
      {/* vorderes Bein */}
      {limb([j.hip, j.kneeF, j.footF], d.legs, 25)}
      <Boot at={j.footF} c={mix(d.legs, "#000000", 0.4)} />
      {/* Rock mit Schössen */}
      <path
        d={`M ${sx - 26} ${sy + 4} Q ${sx - 36} ${my} ${hx - 26} ${hy - 4} L ${hx - 36} ${hy + 62} L ${hx - 12} ${hy + 58} L ${hx - 4} ${hy + 8} L ${hx + 24} ${hy + 4} Q ${sx + 30} ${my} ${sx + 22} ${sy} Q ${sx} ${sy - 12} ${sx - 26} ${sy + 4} Z`}
        fill={d.coat}
      />
      {/* Weste und Kragen */}
      <path d={`M ${sx + 14} ${sy + 6} Q ${sx + 24} ${my} ${hx + 18} ${hy}`} stroke={d.coatDark} strokeWidth={6} fill="none" opacity={0.8} />
      <rect x={cx - 9} y={cy + 16} width={18} height={20} fill={d.skin} />
      <path d={`M ${sx - 4} ${sy - 8} L ${sx + 18} ${sy + 14} L ${sx + 24} ${sy - 6} Z`} fill={d.shirt} />
      <path d={`M ${sx - 6} ${sy - 4} L ${sx + 20} ${sy - 4}`} stroke={d.coatDark} strokeWidth={7} strokeLinecap="round" />
      {/* Kopf */}
      <circle cx={cx} cy={cy} r={26} fill={d.skin} />
      <path d={`M ${cx + 23} ${cy - 4} L ${cx + 32} ${cy + 7} L ${cx + 23} ${cy + 10} Z`} fill={d.skin} />
      <path d={`M ${cx - 27} ${cy + 8} C ${cx - 32} ${cy - 30}, ${cx + 20} ${cy - 40}, ${cx + 26} ${cy - 12} C ${cx + 12} ${cy - 20}, ${cx - 6} ${cy - 16}, ${cx - 10} ${cy + 12} Z`} fill={d.hair} />
      <path d={`M ${cx - 2} ${cy + 2} L ${cx + 4} ${cy + 18}`} stroke={d.hair} strokeWidth={5} strokeLinecap="round" />
      {hat ? (
        <g>
          <ellipse cx={cx + 2} cy={cy - 20} rx={38} ry={7} fill={d.coatDark} />
          <path d={`M ${cx - 22} ${cy - 22} L ${cx - 26} ${cy - 86} L ${cx + 30} ${cy - 86} L ${cx + 26} ${cy - 22} Z`} fill={d.coatDark} />
          <rect x={cx - 24} y={cy - 34} width={50} height={7} fill={d.coat} opacity={0.8} />
        </g>
      ) : null}
      {/* vorderer Arm */}
      {limb([[sx + 4, sy + 8], j.elbow, j.hand], d.coat, 21)}
      <circle cx={j.hand[0]} cy={j.hand[1] + 3} r={10} fill={d.skin} />
      {books ? (
        <g transform={`translate(${j.hand[0] - 34} ${j.hand[1] - 6}) rotate(-6)`}>
          <rect x={0} y={0} width={76} height={14} rx={2} fill="#5A2A1E" />
          <rect x={4} y={14} width={70} height={13} rx={2} fill="#2E4A38" />
          <rect x={-2} y={27} width={78} height={14} rx={2} fill="#6A4A22" />
          <rect x={30} y={-4} width={8} height={50} fill="#1A120C" opacity={0.85} />
        </g>
      ) : null}
      {quill ? (
        <g transform={`translate(${j.hand[0] + 4} ${j.hand[1] - 2})`} opacity={quillO}>
          <path d="M 0 0 L 34 -64" stroke="#EDE6D6" strokeWidth={3} />
          <path d="M 10 -18 C 26 -40, 38 -62, 40 -76 C 28 -64, 16 -44, 10 -18 Z" fill="#EDE6D6" />
        </g>
      ) : null}
    </g>
  );
};

/** Eine Figur mit Streiflicht. Ursprung zwischen den Füssen; `dir` −1 schaut nach links. */
const Gent: React.FC<{
  x: number;
  y: number;
  k: number;
  j: Joints;
  d: Dress;
  rim?: string;
  rimO?: number;
  dir?: 1 | -1;
  hat?: boolean;
  books?: boolean;
  quill?: boolean;
  quillO?: number;
  lift?: number;
  o?: number;
  shadow?: boolean;
  glow?: number;
}> = ({ x, y, k, j, d, rim, rimO = 1, dir = 1, hat, books, quill, quillO, lift, o = 1, shadow = true, glow = 0 }) => (
  <g transform={`translate(${x} ${y}) scale(${dir * k} ${k})`} opacity={o}>
    {shadow ? <ellipse cx={0} cy={2} rx={74} ry={9} fill="#000" opacity={0.35} /> : null}
    {glow > 0 ? <ellipse cx={10} cy={-200} rx={150} ry={200} fill="url(#olWarm)" opacity={glow} /> : null}
    {rim ? (
      <g transform="translate(4 -2)" opacity={rimO}>
        <GentBody j={j} d={flat(rim)} hat={hat} books={books} lift={lift} />
      </g>
    ) : null}
    <GentBody j={j} d={d} hat={hat} books={books} quill={quill} quillO={quillO} lift={lift} />
  </g>
);

const walkPose = (ph: number, w: number): Joints => {
  const j: Joints = { ...STAND };
  const sw = Math.sin(ph) * w;
  j.footF = [STAND.footF[0] + 32 * sw, STAND.footF[1] - Math.max(0, Math.cos(ph)) * 10 * w];
  j.footB = [STAND.footB[0] - 32 * sw, STAND.footB[1] - Math.max(0, -Math.cos(ph)) * 10 * w];
  j.kneeF = [STAND.kneeF[0] + 18 * sw + 6 * w, STAND.kneeF[1]];
  j.kneeB = [STAND.kneeB[0] - 18 * sw + 6 * w, STAND.kneeB[1]];
  j.hand2 = [STAND.hand2[0] + 22 * sw, STAND.hand2[1]];
  j.elbow2 = [STAND.elbow2[0] + 10 * sw, STAND.elbow2[1]];
  // Bücher unter dem Arm: die vordere Hand bleibt nah am Körper
  j.elbow = [20, -206];
  j.hand = [34, -168];
  return j;
};

/* ------------------------------------------------------------------ */
/* Dinge                                                               */
/* ------------------------------------------------------------------ */

/** Kerze im Halter. Ursprung: Fuss des Halters. `lit` 0 … 1, danach Rauch (`smoke` 0 … 1). */
const Candle: React.FC<{ x: number; y: number; k: number; lit: number; smoke?: number; frame: number }> = ({ x, y, k, lit, smoke = 0, frame }) => {
  const fl = 1 + 0.08 * Math.sin(frame / 2.3) + 0.05 * Math.sin(frame / 3.7);
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`}>
      {lit > 0.01 ? <circle cx={0} cy={-96} r={150} fill="url(#olFlame)" opacity={lit * fl} /> : null}
      <ellipse cx={0} cy={-6} rx={34} ry={9} fill="#8A6A3A" />
      <path d="M -30 -6 Q 0 4 30 -6 L 26 -14 Q 0 -6 -26 -14 Z" fill="#B88A4A" />
      <path d="M 30 -10 C 50 -14, 52 -34, 36 -36" stroke="#8A6A3A" strokeWidth={5} fill="none" />
      <rect x={-11} y={-72} width={22} height={62} rx={3} fill="#EFE4CC" />
      <rect x={-11} y={-72} width={7} height={62} fill="#FFF6E4" opacity={0.6} />
      <path d="M -11 -70 Q -4 -60 -2 -72" stroke="#E2D2B2" strokeWidth={3} fill="none" />
      <line x1={0} y1={-72} x2={0} y2={-80} stroke="#2A1A10" strokeWidth={2.5} />
      {lit > 0.01 ? (
        <g transform={`translate(0 -78) scale(${lit * fl} ${lit * (0.9 + 0.2 * Math.sin(frame / 1.9))})`}>
          <path d="M 0 -40 C 12 -24, 12 -6, 0 0 C -12 -6, -12 -24, 0 -40 Z" fill="#FFB347" />
          <path d="M 0 -24 C 6 -14, 6 -4, 0 0 C -6 -4, -6 -14, 0 -24 Z" fill="#FFF1B8" />
        </g>
      ) : null}
      {smoke > 0.01 && smoke < 1
        ? [0, 1, 2].map((i) => {
            const q = Math.max(0, Math.min(1, smoke * 1.4 - i * 0.18));
            return <path key={i} d={`M 0 ${-82 - q * 120} q ${10 + i * 4} -14 0 -28 q -12 -14 0 -28`} stroke="#C9C2D6" strokeWidth={3} fill="none" opacity={(1 - q) * 0.55} />;
          })
        : null}
    </g>
  );
};

/** Die goldenen Platten: ein Stapel dünner Platten, links von drei Ringen gehalten. */
const Plates: React.FC<{ x: number; y: number; k: number; o?: number; glow?: number; frame: number }> = ({ x, y, k, o = 1, glow = 0, frame }) => (
  <g transform={`translate(${x} ${y}) scale(${k})`} opacity={o}>
    {glow > 0 ? <circle r={170} fill="url(#olWarm)" opacity={glow * (0.85 + 0.15 * Math.sin(frame / 7))} /> : null}
    {[5, 4, 3, 2, 1, 0].map((i) => (
      <rect key={i} x={-84 + i * 1.5} y={-62 + i * 5} width={168} height={118} rx={4} fill={i === 0 ? "url(#olGold)" : "#B8862E"} stroke="#6E4A14" strokeWidth={2} />
    ))}
    {[-30, -8, 14, 36].map((ly, i) => (
      <path key={i} d={`M -40 ${ly} q 10 -6 20 0 t 20 0 t 20 0 t 20 0 t 20 0`} stroke="#7A5418" strokeWidth={2.5} fill="none" opacity={0.65} />
    ))}
    {[-38, -2, 34].map((ry) => (
      <path key={ry} d={`M -72 ${ry - 12} a 13 13 0 1 0 0 26`} stroke="#5A3A10" strokeWidth={6} fill="none" />
    ))}
  </g>
);

/** Das Wachssiegel «Nur Gott und Oliver». `crack` öffnet es mit Licht aus dem Spalt. */
const SealFace: React.FC<{ text: string }> = ({ text }) => (
  <g>
    <path d="M 0 -128 C 40 -134, 92 -110, 116 -70 C 140 -30, 132 30, 112 72 C 88 116, 34 136, -8 130 C -58 126, -106 100, -124 56 C -140 12, -132 -50, -104 -88 C -80 -118, -40 -126, 0 -128 Z" fill="#8E2224" />
    <circle r={108} fill="#A7302C" />
    <circle r={108} fill="none" stroke="#C9504A" strokeWidth={3} opacity={0.6} />
    <circle r={74} fill="#952826" stroke="#6E1A1A" strokeWidth={4} />
    <text fontFamily="Cinzel" fontWeight={700} fontSize={23} letterSpacing="0.06em" fill="#F2B8A8" opacity={0.95}>
      <textPath href="#olSealRing" startOffset="50%" textAnchor="middle">
        {text}
      </textPath>
    </text>
    {/* Flamme in der Mitte */}
    <path d="M 0 -46 C 22 -18, 24 10, 0 26 C -24 10, -22 -18, 0 -46 Z" fill="#C2423A" stroke="#F2B8A8" strokeWidth={3} />
    <path d="M 0 -18 C 8 -6, 8 6, 0 14 C -8 6, -8 -6, 0 -18 Z" fill="#F2B8A8" opacity={0.8} />
    <path d="M -60 -80 Q -20 -100 30 -96" stroke="#E0807A" strokeWidth={5} fill="none" opacity={0.35} strokeLinecap="round" />
  </g>
);

const Seal: React.FC<{ x: number; y: number; k: number; crack?: number; o?: number; frame: number }> = ({ x, y, k, crack = 0, o = 1, frame }) => {
  const text = "· NUR GOTT UND OLIVER · NUR GOTT UND OLIVER";
  const gap = crack * 46;
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`} opacity={o}>
      <defs>
        <path id="olSealRing" d="M -91 0 A 91 91 0 1 1 91 0 A 91 91 0 1 1 -91 0" />
        <clipPath id="olSealL">
          <path d="M -200 -200 L 6 -200 L -10 -60 L 12 0 L -8 70 L 6 200 L -200 200 Z" />
        </clipPath>
        <clipPath id="olSealR">
          <path d="M 200 -200 L 6 -200 L -10 -60 L 12 0 L -8 70 L 6 200 L 200 200 Z" />
        </clipPath>
      </defs>
      {crack > 0.01 ? (
        <g opacity={Math.min(1, crack * 2)}>
          <circle r={220 + 40 * crack} fill="url(#olWarm)" opacity={0.9} />
          {Array.from({ length: 12 }, (_, i) => (
            <path key={i} d={`M 0 0 L ${Math.cos((i / 12) * 6.283 + frame / 90) * 420} ${Math.sin((i / 12) * 6.283 + frame / 90) * 420}`} stroke="#FFE7A8" strokeWidth={10 + (i % 3) * 6} opacity={0.18 * crack} strokeLinecap="round" />
          ))}
          <ellipse rx={18 + gap * 0.4} ry={150} fill="#FFF4D2" opacity={0.85 * crack} />
        </g>
      ) : null}
      <g clipPath="url(#olSealL)" transform={`translate(${-gap} ${gap * 0.2}) rotate(${-crack * 10})`}>
        <SealFace text={text} />
      </g>
      <g clipPath="url(#olSealR)" transform={`translate(${gap} ${gap * 0.2}) rotate(${crack * 10})`}>
        <SealFace text={text} />
      </g>
    </g>
  );
};

/** Ein Bett von der Seite, der Schläfer liegt auf dem Rücken. Ursprung: Boden am Kopfende. */
const Bed: React.FC<{
  id: string;
  x: number;
  y: number;
  k: number;
  w?: number;
  wood: string;
  linen: string;
  quiltA: string;
  quiltB: string;
  skin: string;
  hair: string;
  pray?: number;
  two?: boolean;
  frame: number;
}> = ({ id, x, y, k, w = 520, wood, linen, quiltA, quiltB, skin, hair, pray = 0, two = false, frame }) => {
  const quilt = `M 112 -128 C 140 -150, 190 -146, 232 -136 C 280 -126, 320 -128, 360 -122 C 400 -118, 440 -122, ${w - 60} -112 C ${w - 34} -108, ${w - 20} -96, ${w - 16} -60 L 112 -60 Z`;
  const head = (hx: number, hy: number) => (
    <g>
      <circle cx={hx} cy={hy} r={26} fill={skin} />
      <path d={`M ${hx + 6} ${hy - 24} L ${hx + 16} ${hy - 34} L ${hx + 20} ${hy - 22} Z`} fill={skin} />
      <path d={`M ${hx - 26} ${hy + 6} C ${hx - 30} ${hy - 18}, ${hx - 18} ${hy - 30}, ${hx - 2} ${hy - 26} C ${hx - 12} ${hy - 14}, ${hx - 14} ${hy}, ${hx - 6} ${hy + 22} C ${hx - 16} ${hy + 22}, ${hx - 24} ${hy + 16}, ${hx - 26} ${hy + 6} Z`} fill={hair} />
    </g>
  );
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`}>
      <defs>
        <clipPath id={`olQuilt-${id}`}>
          <path d={quilt} />
        </clipPath>
      </defs>
      <ellipse cx={w / 2} cy={2} rx={w * 0.55} ry={12} fill="#000" opacity={0.35} />
      {/* Kopfteil, Fussteil, Beine */}
      <path d={`M 0 0 L 0 -210 Q 12 -236 26 -210 L 26 0 Z`} fill={wood} />
      <rect x={w - 26} y={-150} width={26} height={150} fill={wood} />
      <circle cx={w - 13} cy={-154} r={13} fill={wood} />
      <rect x={10} y={-62} width={w - 20} height={22} fill={mix(wood, "#000000", 0.25)} />
      {/* Matratze, Kissen */}
      <rect x={20} y={-104} width={w - 40} height={46} rx={10} fill={linen} />
      <ellipse cx={84} cy={-112} rx={62} ry={22} fill={linen} />
      {two ? head(150, -140) : null}
      {head(86, -136)}
      {/* Decke mit Flickenmuster */}
      <path d={quilt} fill={quiltA} />
      <g clipPath={`url(#olQuilt-${id})`}>
        {Array.from({ length: Math.ceil(w / 40) }, (_, c) =>
          Array.from({ length: 3 }, (_, r) => ((c + r) % 2 ? <rect key={`${c}-${r}`} x={100 + c * 40} y={-160 + r * 40} width={40} height={40} fill={quiltB} /> : null)),
        )}
        <path d={`M 100 -96 L ${w} -96`} stroke={linen} strokeWidth={3} strokeDasharray="8 8" opacity={0.4} />
      </g>
      <path d={quilt} fill="none" stroke={mix(quiltA, "#000000", 0.4)} strokeWidth={3} />
      {/* Gefaltete Hände */}
      {pray > 0 ? (
        <g opacity={Math.min(1, pray * 1.5)}>
          <circle cx={186} cy={-152} r={46} fill="url(#olWarm)" opacity={pray * (0.7 + 0.3 * Math.sin(frame / 8))} />
          <ellipse cx={180} cy={-150} rx={14} ry={20} fill={skin} transform="rotate(-30 180 -150)" />
          <ellipse cx={192} cy={-152} rx={13} ry={19} fill={skin} transform="rotate(-24 192 -152)" />
        </g>
      ) : null}
    </g>
  );
};

/** Leise fallender Schnee über dem ganzen Bild */
const Snowfall: React.FC<{ frame: number; n?: number; o?: number; seed: string; front?: boolean }> = ({ frame, n = 80, o = 1, seed, front = false }) => {
  const flakes = useMemo(
    () => Array.from({ length: n }, (_, i) => ({ x: random(`${seed}x${i}`) * 1100, y: random(`${seed}y${i}`) * 1920, r: (front ? 3 : 1.6) + random(`${seed}r${i}`) * (front ? 4 : 2.4), v: (front ? 2.4 : 1.2) + random(`${seed}v${i}`) * 1.4, ph: random(`${seed}p${i}`) * 6.28 })),
    [n, seed, front],
  );
  return (
    <g opacity={o}>
      {flakes.map((fk, i) => (
        <circle key={i} cx={(fk.x + Math.sin(frame / 25 + fk.ph) * 18) % 1100} cy={(fk.y + frame * fk.v) % 1920} r={fk.r} fill="#F2F5FF" opacity={front ? 0.75 : 0.6} />
      ))}
    </g>
  );
};

/** Ein «z», das aus einem Schlafenden aufsteigt */
const Zzz: React.FC<{ x: number; y: number; frame: number; o: number; i: number }> = ({ x, y, frame, o, i }) => (
  <g opacity={o}>
    {[0, 1].map((n) => {
      const q = (frame / 50 + i * 0.37 + n * 0.5) % 1;
      return (
        <text key={n} x={x + q * 30} y={y - q * 70} fontFamily="Cormorant Garamond" fontStyle="italic" fontWeight={600} fontSize={30 + q * 14} fill="#C9D2F2" opacity={Math.sin(q * Math.PI) * 0.9}>
          z
        </text>
      );
    })}
  </g>
);

/** Tisch von vorn: Platte bei `y`, dunkle Front darunter */
const TableFront: React.FC<{ y: number }> = ({ y }) => (
  <g>
    <rect x={-20} y={y - 6} width={1120} height={40} fill="#6A4426" />
    <rect x={-20} y={y - 6} width={1120} height={6} fill="#9A6A3E" opacity={0.6} />
    <rect x={-20} y={y + 34} width={1120} height={1920 - y} fill="#2E1C10" />
    <rect x={-20} y={y + 34} width={1120} height={14} fill="#1A0F08" opacity={0.7} />
    {[120, 420, 720, 1000].map((gx) => (
      <path key={gx} d={`M ${gx} ${y + 60} q 40 30 10 90 t 20 140`} stroke="#3E2616" strokeWidth={4} fill="none" opacity={0.5} />
    ))}
  </g>
);

/* ------------------------------------------------------------------ */
/* Die Etappen                                                         */
/* ------------------------------------------------------------------ */

type StageProps = { t: number; frame: number; b: number[]; s: OliverSceneT; ts: TimelineScene; end: number };

/** Das Haus im Schnitt: Alle schlafen – in einer Kammer steigt ein Gebet auf. */
const HookStage: React.FC<StageProps> = ({ t, frame, b }) => {
  const rise = interpolate(t, [b[0] - 0.1, b[0] + 1.8], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const asleep = fade(t, b[1] - 0.2, 0.8);
  const zoom = interpolate(t, [-0.4, 5], [1.0, 1.07], clamp);
  const ember = 0.8 - 0.55 * asleep;
  const room = "#1C120C";
  const wall = "#4A3020";
  const wood = "#5A3C24";
  return (
    <g>
      <rect x={0} y={0} width={1080} height={1920} fill="url(#olNight)" />
      {Array.from({ length: 40 }, (_, i) => (
        <circle key={i} cx={random(`hs${i}`) * 1080} cy={240 + random(`ht${i}`) * 420} r={1 + random(`hr${i}`) * 1.8} fill="#EEF0FF" opacity={0.3 + 0.4 * Math.sin(frame / 16 + i)} />
      ))}
      <circle cx={880} cy={330} r={60} fill="#E8EEFF" opacity={0.12} />
      <circle cx={880} cy={330} r={36} fill="#EEF2FF" />
      <g transform={`translate(540 860) scale(${zoom}) translate(-540 -860)`}>
        {/* Schnee am Boden */}
        <path d="M -40 1160 Q 200 1130 540 1150 T 1120 1140 L 1120 1920 L -40 1920 Z" fill="#26304E" />
        <path d="M -40 1160 Q 200 1130 540 1150 T 1120 1140" stroke="#8C9CC8" strokeWidth={6} fill="none" opacity={0.6} />
        {/* Dach mit Schnee und Kamin */}
        <rect x={250} y={420} width={52} height={130} fill={wall} />
        <rect x={244} y={412} width={64} height={14} fill="#2E1E14" />
        <rect x={244} y={406} width={64} height={8} fill="#DDE4F6" opacity={0.85} />
        {[0, 1, 2].map((i) => {
          const q = (frame / 70 + i / 3) % 1;
          return <circle key={i} cx={276 + q * 50 + Math.sin(q * 6) * 10} cy={396 - q * 150} r={14 + q * 26} fill="#9AA6C8" opacity={(1 - q) * 0.25} />;
        })}
        <path d="M 140 612 L 540 352 L 940 612 Z" fill="#2E1E14" />
        <path d="M 140 612 L 540 352 L 940 612" stroke="#E4EAF8" strokeWidth={16} fill="none" strokeLinejoin="round" />
        <path d="M 170 600 L 540 372 L 910 600" stroke="#1A120C" strokeWidth={6} fill="none" opacity={0.6} />
        {/* Mauern im Schnitt */}
        <rect x={172} y={600} width={736} height={556} fill={wall} />
        {/* Räume */}
        <rect x={190} y={616} width={354} height={256} fill={room} />
        <rect x={562} y={616} width={328} height={256} fill={room} />
        <rect x={190} y={890} width={316} height={250} fill={room} />
        <rect x={524} y={890} width={366} height={250} fill={room} />
        {/* Licht in den Räumen */}
        <circle cx={240} cy={1100} r={170} fill="url(#olEmber)" opacity={ember * (0.85 + 0.15 * Math.sin(frame / 4))} />
        <circle cx={850} cy={760} r={190} fill="url(#olFlame)" opacity={0.55 + 0.1 * Math.sin(frame / 3)} />
        {/* Küche: Herd mit Glut, Tisch */}
        <rect x={192} y={1010} width={90} height={130} fill="#2A2420" />
        <rect x={206} y={1060} width={62} height={80} fill="#0C0806" />
        <ellipse cx={237} cy={1132} rx={26} ry={8} fill="#FF7A30" opacity={ember} />
        <rect x={340} y={1060} width={130} height={10} fill={wood} />
        <rect x={350} y={1070} width={8} height={70} fill={wood} />
        <rect x={452} y={1070} width={8} height={70} fill={wood} />
        {/* Schlafzimmer der Eltern */}
        <Bed id="hp" x={560} y={1140} k={0.56} w={520} wood={wood} linen="#7A7468" quiltA="#5A3A44" quiltB="#3E4A5E" skin="#6A4A3A" hair="#2A1C14" two frame={frame} />
        {/* Kammer der Geschwister */}
        <Bed id="hk" x={220} y={866} k={0.5} w={560} wood={wood} linen="#7A7468" quiltA="#3E5A44" quiltB="#5A4A30" skin="#6A4A3A" hair="#2A1C14" two frame={frame} />
        {/* Olivers Kammer */}
        <Bed id="ho" x={590} y={866} k={0.5} w={520} wood={wood} linen="#B8AE98" quiltA="#6A3A30" quiltB="#3A4A6A" skin="#B88A6A" hair="#3A2414" pray={fade(t, b[0] - 0.2, 0.6)} frame={frame} />
        <Candle x={852} y={866} k={0.55} lit={0.9} frame={frame} />
        {/* Zwischendecke und Wände */}
        <rect x={172} y={872} width={736} height={18} fill="#2E1E14" />
        <rect x={544} y={600} width={18} height={272} fill="#2E1E14" />
        <rect x={506} y={890} width={18} height={250} fill="#2E1E14" />
        {/* Sie schlafen */}
        <Zzz x={610} y={1040} frame={frame} o={0.35 + 0.65 * asleep} i={0} />
        <Zzz x={262} y={780} frame={frame} o={0.35 + 0.65 * asleep} i={1} />
        <Zzz x={330} y={790} frame={frame} o={0.25 + 0.55 * asleep} i={2} />
      </g>
      {/* Das Gebet steigt auf – durchs Dach zum Himmel */}
      {rise > 0.01 ? (
        <g transform={`translate(540 860) scale(${zoom}) translate(-540 -860)`}>
          <path d="M 683 790 C 690 690, 640 600, 700 500 S 820 380, 880 330" stroke="#FFD98A" strokeWidth={22} fill="none" opacity={0.18} pathLength={1} strokeDasharray={`${rise} 1`} strokeLinecap="round" />
          <path d="M 683 790 C 690 690, 640 600, 700 500 S 820 380, 880 330" stroke="#FFF1C8" strokeWidth={5} fill="none" pathLength={1} strokeDasharray={`${rise} 1`} strokeLinecap="round" />
          {Array.from({ length: 8 }, (_, i) => {
            const q = (frame / 40 + i / 8) % 1;
            const k = q * rise;
            const px = 683 + (880 - 683) * k + Math.sin(k * 9) * 20;
            const py = 790 + (330 - 790) * k;
            return <circle key={i} cx={px} cy={py} r={3 + 2 * Math.sin(i)} fill="#FFF1C8" opacity={(1 - q) * 0.8 * rise} />;
          })}
          <circle cx={880} cy={330} r={60 + 30 * rise} fill="url(#olWarm)" opacity={rise} />
        </g>
      ) : null}
      <Snowfall frame={frame} seed="hk" n={70} />
    </g>
  );
};

/** Das Farmhaus im Schnee: Oliver kommt mit den Schulbüchern; von Joseph und den Platten. */
const HouseStage: React.FC<StageProps> = ({ t, frame, b, ts }) => {
  const walkK = interpolate(t, [-0.4, 2.6], [0, 1], { ...clamp, easing: Easing.out(Easing.quad) });
  const x = -90 + 450 * walkK;
  const walking = interpolate(t, [2.0, 2.7], [1, 0], clamp);
  const ph = frame * 0.19;
  const card = fade(t, b[0] - 0.15, 0.4);
  const smith = fade(t, b[1] - 0.1, 0.5);
  const hearAt = (() => {
    const c = findCue(ts.words, "Dort hört er");
    return c ? ts.words[c.first].start : b[2] - 2.2;
  })();
  const bubble = fade(t, hearAt, 0.4);
  const plates = fade(t, b[2], 0.5);
  const winter = fade(t, 0.3, 0.5) * out(t, b[0] - 0.3, 0.4);
  const door = fade(t, b[1] + 0.2, 0.8);
  const dark = 0.55;
  return (
    <g>
      <rect x={0} y={0} width={1080} height={1920} fill="url(#olNight)" />
      {Array.from({ length: 30 }, (_, i) => (
        <circle key={i} cx={random(`es${i}`) * 1080} cy={240 + random(`et${i}`) * 500} r={1 + random(`er${i}`) * 1.6} fill="#EEF0FF" opacity={0.3 + 0.3 * Math.sin(frame / 14 + i)} />
      ))}
      <circle cx={960} cy={300} r={54} fill="#E8EEFF" opacity={0.12} />
      <circle cx={960} cy={300} r={32} fill="#EEF2FF" />
      {/* Waldrand */}
      <path d="M -20 1000 L 30 930 L 60 990 L 100 900 L 140 985 L 190 920 L 230 990 L 280 910 L 330 990 L 380 940 L 420 1000 L 1100 1000 L 1100 1060 L -20 1060 Z" fill="#141A30" />
      {/* Kahle Bäume */}
      {[
        [80, 1080, 1.1],
        [470, 1060, 0.8],
      ].map(([tx, ty, k], i) => (
        <g key={i} transform={`translate(${tx} ${ty}) scale(${k})`} stroke="#0C1020" fill="none" strokeLinecap="round">
          <path d="M 0 0 L 4 -300" strokeWidth={16} />
          <path d="M 2 -160 L -60 -250 M 3 -200 L 70 -290 M -30 -210 L -50 -300 M 40 -250 L 30 -330 M 4 -260 L -20 -350" strokeWidth={8} />
          <path d="M -60 -250 L -66 -258 M 70 -290 L 80 -298" stroke="#C9D2F0" strokeWidth={5} opacity={0.5} />
        </g>
      ))}
      {/* Schneefeld */}
      <path d="M -20 1060 Q 300 1030 600 1060 T 1100 1050 L 1100 1920 L -20 1920 Z" fill="#2A3454" />
      <path d="M -20 1060 Q 300 1030 600 1060 T 1100 1050" stroke="#9AA8D4" strokeWidth={6} fill="none" opacity={0.5} />
      {/* Das Farmhaus */}
      <g>
        <rect x={880} y={600} width={44} height={110} fill="#3A2A22" />
        <rect x={876} y={594} width={52} height={8} fill="#DDE4F6" />
        <path d="M 540 770 L 785 590 L 1030 770 Z" fill="#2A1E1A" />
        <path d="M 540 770 L 785 590 L 1030 770" stroke="#E4EAF8" strokeWidth={14} fill="none" strokeLinejoin="round" />
        <rect x={562} y={764} width={448} height={300} fill="#4A3A34" />
        {Array.from({ length: 13 }, (_, i) => (
          <rect key={i} x={562} y={776 + i * 22} width={448} height={2} fill="#2A1E1A" opacity={0.5} />
        ))}
        {/* Fenster */}
        {[
          [770, 880],
          [900, 880],
          [762, 680],
        ].map(([wx, wy], i) => (
          <g key={i}>
            <rect x={wx - 6} y={wy - 6} width={i === 2 ? 58 : 82} height={i === 2 ? 64 : 92} fill="#1E1410" />
            <rect x={wx} y={wy} width={i === 2 ? 46 : 70} height={i === 2 ? 52 : 80} fill={i === 0 ? mix("#FFC870", "#FFE08A", plates) : "#FFC870"} opacity={i === 0 ? 0.8 + 0.2 * plates : 0.75} />
            <rect x={wx + (i === 2 ? 21 : 33)} y={wy} width={4} height={i === 2 ? 52 : 80} fill="#1E1410" />
          </g>
        ))}
        <ellipse cx={805} cy={920} rx={120} ry={90} fill="url(#olFlame)" opacity={0.5 + 0.4 * plates} />
        {/* Tür */}
        <rect x={622} y={940} width={80} height={124} fill="#1A120E" />
        <rect x={622} y={940} width={80} height={124} fill="#FFC870" opacity={0.85 * door} />
        <path d={`M 622 940 L ${622 + 80 * (1 - door * 0.75)} 946 L ${622 + 80 * (1 - door * 0.75)} 1058 L 622 1064 Z`} fill="#3A2416" />
        {/* Licht aus der Tür auf den Schnee */}
        <path d="M 622 1064 L 702 1064 L 760 1240 L 560 1240 Z" fill="#FFC870" opacity={0.25 * door} />
      </g>
      {/* Zaun mit Schild SMITH */}
      {Array.from({ length: 12 }, (_, i) => (
        <rect key={i} x={20 + i * 92} y={1090} width={12} height={70} fill="#1A1420" />
      ))}
      <rect x={0} y={1104} width={1080} height={8} fill="#1A1420" />
      <rect x={0} y={1134} width={1080} height={8} fill="#1A1420" />
      <rect x={0} y={1100} width={1080} height={4} fill="#C9D2F0" opacity={0.4} />
      <g transform="translate(470 1020) rotate(-3)" opacity={smith}>
        <rect x={-6} y={0} width={12} height={110} fill="#2A1E16" />
        <rect x={-82} y={-46} width={164} height={64} rx={6} fill="#D9C8A4" stroke="#4A3420" strokeWidth={5} />
        <text x={0} y={2} textAnchor="middle" fontFamily="Cinzel" fontWeight={700} fontSize={40} fill="#3A2414">
          SMITH
        </text>
      </g>
      {/* Oliver */}
      <Gent x={x} y={1170} k={1.3} j={walkPose(ph, walking)} d={shadeDress(OLIVER, dark)} rim="#9FB6F0" rimO={0.55} hat books />
      {/* «?» über Oliver, sobald von den Platten die Rede ist */}
      {plates > 0.01 ? (
        <text x={x + 40} y={650 - 10 * plates} textAnchor="middle" fontFamily="Cormorant Garamond" fontStyle="italic" fontWeight={600} fontSize={110} fill="#FFE9C4" opacity={plates} stroke="#0B0710" strokeWidth={8} paintOrder="stroke">
          ?
        </text>
      ) : null}
      {/* Sprechblase aus dem Haus: erst Joseph, dann die Platten */}
      {bubble > 0.01 ? (
        <g transform={`translate(770 440) scale(${0.8 + 0.2 * bubble})`} opacity={bubble}>
          <path d="M -200 -100 Q -200 -130 -170 -130 L 170 -130 Q 200 -130 200 -100 L 200 90 Q 200 120 170 120 L 60 120 L 20 190 L 10 120 L -170 120 Q -200 120 -200 90 Z" fill="#F4E8CC" stroke="#4A3420" strokeWidth={5} />
          <text x={0} y={18} textAnchor="middle" fontFamily="Caveat" fontWeight={700} fontSize={64} fill={INK} opacity={1 - plates}>
            «unser Joseph …»
          </text>
          <Plates x={0} y={-4} k={0.9} o={plates} glow={plates} frame={frame} />
        </g>
      ) : null}
      {/* Namenskärtchen */}
      {card > 0.01 ? (
        <g transform={`translate(270 430) rotate(-3) scale(${0.85 + 0.15 * card})`} opacity={card * (1 - 0.3 * plates)}>
          <rect x={-200} y={-90} width={400} height={176} rx={8} fill="#F2E6CA" stroke="#6A4A2A" strokeWidth={4} />
          <rect x={-200} y={-90} width={400} height={176} rx={8} fill="none" stroke="#B8986A" strokeWidth={2} strokeDasharray="6 8" transform="translate(0 0)" opacity={0.6} />
          <text x={0} y={-12} textAnchor="middle" fontFamily="Caveat" fontWeight={700} fontSize={70} fill={INK}>
            Oliver Cowdery
          </text>
          <text x={0} y={58} textAnchor="middle" fontFamily="Caveat" fontWeight={700} fontSize={48} fill="#7A3A22">
            22 · Lehrer
          </text>
        </g>
      ) : null}
      {/* «Winter 1828» */}
      {winter > 0.01 ? (
        <text x={540} y={480} textAnchor="middle" fontFamily="Caveat" fontWeight={700} fontSize={110} fill="#F4EEFF" opacity={winter} stroke="#0B0710" strokeWidth={8} paintOrder="stroke">
          Winter 1828
        </text>
      ) : null}
      <Snowfall frame={frame} seed="hs" n={60} />
      <Snowfall frame={frame} seed="hf" n={14} front />
    </g>
  );
};

/** Nachts im Bett: Gedanken an die Platten, die Kerze geht aus, das Gebet – und Frieden. */
const NightStage: React.FC<StageProps> = ({ t, frame, b }) => {
  const thought = fade(t, b[0] - 0.1, 0.4) * out(t, b[1] - 0.2, 0.5);
  const snuff = interpolate(t, [b[1] - 0.1, b[1] + 0.35], [1, 0], clamp);
  const smoke = interpolate(t, [b[1] + 0.2, b[1] + 2.4], [0, 1], clamp);
  const pray = fade(t, b[1] + 0.1, 0.6);
  const peace = interpolate(t, [b[2] - 0.15, b[2] + 1.0], [0, 1], { ...clamp, easing: ease });
  const thread = interpolate(t, [b[1] + 0.4, b[2] - 0.3], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  return (
    <g>
      {/* Dunkel, sobald die Kerze aus ist */}
      <rect x={0} y={0} width={1080} height={1920} fill="#06081C" opacity={0.15 + 0.4 * (1 - snuff) * (1 - 0.5 * peace)} />
      {/* Boden */}
      <rect x={0} y={1180} width={1080} height={740} fill="#1A0F09" />
      {Array.from({ length: 9 }, (_, i) => (
        <line key={i} x1={i * 140 - 80} y1={1180} x2={i * 200 - 300} y2={1920} stroke="#0C0704" strokeWidth={4} opacity={0.6} />
      ))}
      {/* Nachttisch mit Kerze */}
      <rect x={110} y={1010} width={170} height={20} fill="#5A3A22" />
      <rect x={124} y={1030} width={142} height={150} fill="#3A2416" />
      <rect x={140} y={1060} width={110} height={8} fill="#1A0F08" opacity={0.6} />
      <Candle x={196} y={1010} k={1.2} lit={snuff} smoke={smoke} frame={frame} />
      {/* Das Bett */}
      <Bed id="nb" x={300} y={1180} k={1.42} w={530} wood="#4A2E1A" linen="#C9C0AC" quiltA="#7A3A30" quiltB="#3E4E74" skin="#C79A78" hair="#3A2414" pray={pray} frame={frame} />
      {/* Er denkt an die Platten */}
      {thought > 0.01 ? (
        <g opacity={thought}>
          <circle cx={470} cy={930} r={10} fill="#F4E8CC" />
          <circle cx={500} cy={880} r={16} fill="#F4E8CC" />
          <g transform={`translate(640 690) scale(${0.85 + 0.15 * thought})`}>
            <ellipse rx={210} ry={150} fill="#F4E8CC" stroke="#4A3420" strokeWidth={5} />
            <Plates x={-40} y={0} k={0.85} frame={frame} />
            <text x={120} y={40} textAnchor="middle" fontFamily="Cormorant Garamond" fontStyle="italic" fontWeight={600} fontSize={150} fill="#7A3A22">
              ?
            </text>
          </g>
        </g>
      ) : null}
      {/* Das Gebet steigt still auf */}
      {thread > 0.01 ? (
        <g>
          <path d="M 568 960 C 560 860, 480 820, 430 760 S 330 660, 300 560" stroke="#FFD98A" strokeWidth={18} fill="none" opacity={0.16} pathLength={1} strokeDasharray={`${thread} 1`} strokeLinecap="round" />
          <path d="M 568 960 C 560 860, 480 820, 430 760 S 330 660, 300 560" stroke="#FFF1C8" strokeWidth={4} fill="none" opacity={0.8} pathLength={1} strokeDasharray={`${thread} 1`} strokeLinecap="round" />
        </g>
      ) : null}
      {/* Frieden: warmes Licht von oben */}
      {peace > 0.01 ? (
        <g>
          <path d={`M 360 250 L 760 250 L ${880 + 60 * peace} 1180 L ${300 - 60 * peace} 1180 Z`} fill="url(#olBeam)" opacity={0.75 * peace} />
          <circle cx={560} cy={960} r={140 + 260 * peace} fill="url(#olWarm)" opacity={0.55 * peace} />
          {Array.from({ length: 14 }, (_, i) => {
            const q = (frame / 60 + i / 14) % 1;
            return <circle key={i} cx={380 + random(`pz${i}`) * 420} cy={300 + q * 760} r={2.5 + random(`pr${i}`) * 3} fill="#FFF1C8" opacity={peace * Math.sin(q * Math.PI) * 0.8} />;
          })}
          <text x={600} y={560 - 20 * peace} textAnchor="middle" fontFamily="Cormorant Garamond" fontStyle="italic" fontWeight={600} fontSize={150} fill="#FFE7A8" opacity={peace} style={{ filter: "drop-shadow(0 0 22px rgba(255,214,140,0.85))" }}>
            Frieden
          </text>
        </g>
      ) : null}
    </g>
  );
};

/** Ein Brief wird versiegelt: «Nur Gott und Oliver». */
const SecretStage: React.FC<StageProps> = ({ t, frame, b }) => {
  const noteIn = interpolate(t, [-0.4, 0.3], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const noteDown = interpolate(t, [b[0] - 0.2, b[0] + 0.5], [0, 1], { ...clamp, easing: ease });
  const flap = interpolate(t, [b[0] + 0.3, b[0] + 1.0], [1, -1], { ...clamp, easing: ease });
  const press = interpolate(t, [b[1] - 0.45, b[1], b[1] + 0.5], [0, 1, 0], clamp);
  const sealK = fade(t, b[1] - 0.02, 0.12);
  const squash = interpolate(t, [b[1], b[1] + 0.35], [1.14, 1], { ...clamp, easing: Easing.out(Easing.back(2)) });
  const EX = 540;
  const EY = 1000;
  const EW = 600;
  const EH = 360;
  const top = EY - EH / 2;
  return (
    <g>
      {/* Tischplatte */}
      <path d="M -20 780 L 1100 780 L 1100 1920 L -20 1920 Z" fill="#3E2614" />
      {Array.from({ length: 10 }, (_, i) => (
        <path key={i} d={`M -20 ${800 + i * 70 + i * i * 4} L 1100 ${790 + i * 70 + i * i * 4}`} stroke="#24140A" strokeWidth={4} opacity={0.6} />
      ))}
      <rect x={-20} y={776} width={1120} height={8} fill="#7A5434" opacity={0.6} />
      <ellipse cx={850} cy={900} rx={420} ry={260} fill="url(#olFlame)" opacity={0.45} />
      <Candle x={880} y={860} k={1.7} lit={1} frame={frame} />
      {/* Umschlag */}
      <g>
        <rect x={EX - EW / 2 + 10} y={top + 16} width={EW} height={EH} fill="#000" opacity={0.35} />
        {/* offener Deckel (hinter dem Zettel) */}
        {flap > 0 ? <path d={`M ${EX - EW / 2} ${top} L ${EX} ${top - 200 * flap} L ${EX + EW / 2} ${top} Z`} fill="#D9C8A4" stroke="#8A6A3E" strokeWidth={3} /> : null}
        {/* Zettel mit der Frage */}
        <g transform={`translate(${EX} ${top + 30 - 210 * noteIn * (1 - noteDown) + 60 * noteDown})`} opacity={Math.min(1, noteIn * 2)}>
          <rect x={-230} y={-120} width={460} height={240} rx={4} fill="#F7EEDA" stroke="#B8986A" strokeWidth={3} />
          <text x={0} y={-30} textAnchor="middle" fontFamily="Caveat" fontWeight={700} fontSize={66} fill={INK}>
            Ist es wahr?
          </text>
        </g>
        <rect x={EX - EW / 2} y={top} width={EW} height={EH} fill="#E8D9B6" stroke="#8A6A3E" strokeWidth={3} />
        <path d={`M ${EX - EW / 2} ${top + EH} L ${EX} ${top + EH * 0.48} L ${EX + EW / 2} ${top + EH}`} stroke="#B8986A" strokeWidth={3} fill="none" />
        <path d={`M ${EX - EW / 2} ${top} L ${EX - 40} ${top + EH * 0.5} M ${EX + EW / 2} ${top} L ${EX + 40} ${top + EH * 0.5}`} stroke="#C9AE80" strokeWidth={2} opacity={0.6} />
        {flap <= 0 ? <path d={`M ${EX - EW / 2} ${top} L ${EX} ${top - 200 * flap} L ${EX + EW / 2} ${top} Z`} fill="#DCCBA6" stroke="#8A6A3E" strokeWidth={3} /> : null}
      </g>
      {/* Das Siegel */}
      {sealK > 0.01 ? <Seal x={EX} y={top + 190} k={0.95 * squash} o={sealK} frame={frame} /> : null}
      {/* Petschaft, das herunterkommt */}
      {press > 0.01 ? (
        <g transform={`translate(${EX} ${top + 190 - 420 * (1 - press)})`} opacity={Math.min(1, press * 3)}>
          <rect x={-60} y={-40} width={120} height={36} rx={6} fill="#B8862E" stroke="#6E4A14" strokeWidth={3} />
          <path d="M -26 -40 C -30 -120, -40 -170, 0 -230 C 40 -170, 30 -120, 26 -40 Z" fill="#5A3A22" stroke="#2A1A10" strokeWidth={3} />
          <ellipse cx={0} cy={-232} rx={30} ry={20} fill="#6A4628" />
        </g>
      ) : null}
    </g>
  );
};

/** Karte von Manchester nach Harmony, Frühling 1829. */
const JourneyStage: React.FC<StageProps> = ({ t, frame, b }) => {
  const route = interpolate(t, [b[0] - 0.4, b[1]], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const home = fade(t, b[1] - 0.1, 0.4);
  const scribe = fade(t, b[2] - 0.1, 0.5);
  const title = fade(t, -0.3, 0.5);
  const routeD = "M 300 560 C 380 640, 470 700, 560 760 S 700 860, 790 960";
  // Punkt entlang der Route (grob angenähert über die Bezier-Strecken)
  const pt = (k: number): P => {
    const seg = (p0: P, p1: P, p2: P, p3: P, u: number): P => {
      const v = 1 - u;
      return [v * v * v * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0], v * v * v * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1]];
    };
    if (k < 0.5) return seg([300, 560], [380, 640], [470, 700], [560, 760], k * 2);
    return seg([560, 760], [650, 820], [700, 860], [790, 960], (k - 0.5) * 2);
  };
  const [mx, my] = pt(route);
  return (
    <g>
      <rect x={0} y={0} width={1080} height={1920} fill="#24160C" />
      {Array.from({ length: 14 }, (_, i) => (
        <line key={i} x1={-20} y1={i * 140} x2={1100} y2={i * 140 + 30} stroke="#140A04" strokeWidth={5} opacity={0.6} />
      ))}
      <g transform="rotate(-1.5 540 720)">
        <rect x={84} y={262} width={924} height={936} fill="#000" opacity={0.4} transform="translate(12 16)" />
        <rect x={84} y={262} width={924} height={936} fill="url(#olParch)" />
        <rect x={84} y={262} width={924} height={936} fill="none" stroke="#6A4A26" strokeWidth={6} />
        <rect x={104} y={282} width={884} height={896} fill="none" stroke="#9A7A4A" strokeWidth={2} opacity={0.6} />
        {/* Ontariosee */}
        <path d="M 110 380 C 260 340, 420 420, 600 380 S 880 350, 990 400 L 990 300 L 110 300 Z" fill="#7A9AB0" opacity={0.45} />
        <path d="M 110 380 C 260 340, 420 420, 600 380 S 880 350, 990 400" stroke="#4A6A82" strokeWidth={3} fill="none" />
        <text x={720} y={360} textAnchor="middle" fontFamily="Cormorant Garamond" fontStyle="italic" fontWeight={600} fontSize={38} fill="#3A5A72">
          Ontariosee
        </text>
        {/* Fingerseen */}
        {[430, 480, 540].map((lx, i) => (
          <path key={lx} d={`M ${lx} ${520 + i * 6} q 10 80 -6 ${150 - i * 20}`} stroke="#5A7A92" strokeWidth={9} fill="none" strokeLinecap="round" opacity={0.6} />
        ))}
        {/* Grenze */}
        <path d="M 110 870 L 990 870" stroke="#6A4A26" strokeWidth={4} strokeDasharray="18 12" />
        <text x={210} y={840} fontFamily="Cinzel" fontWeight={700} fontSize={36} letterSpacing="0.2em" fill="#6A4A26" opacity={0.85}>
          NEW YORK
        </text>
        <text x={160} y={930} fontFamily="Cinzel" fontWeight={700} fontSize={36} letterSpacing="0.2em" fill="#6A4A26" opacity={0.85}>
          PENNSYLVANIA
        </text>
        {/* Susquehanna */}
        <path d="M 990 760 C 920 790, 880 840, 840 900 C 810 950, 760 1000, 700 960 C 640 920, 620 860, 560 900 C 500 940, 460 1060, 380 1150" stroke="#4A6A82" strokeWidth={6} fill="none" opacity={0.75} />
        <text x={520} y={1110} fontFamily="Cormorant Garamond" fontStyle="italic" fontWeight={600} fontSize={34} fill="#3A5A72" transform="rotate(-38 520 1110)">
          Susquehanna
        </text>
        {/* Hügel */}
        {[
          [260, 1040],
          [330, 1080],
          [880, 1080],
          [930, 560],
          [820, 620],
        ].map(([hx, hy], i) => (
          <path key={i} d={`M ${hx - 30} ${hy} L ${hx} ${hy - 26} L ${hx + 30} ${hy}`} stroke="#8A6A3E" strokeWidth={3} fill="none" opacity={0.7} />
        ))}
        {/* Route */}
        <path d={routeD} stroke="#7A2A1A" strokeWidth={7} fill="none" strokeDasharray="2 16" strokeLinecap="round" pathLength={1} opacity={0.25} />
        <path d={routeD} stroke="#9A2E1E" strokeWidth={8} fill="none" pathLength={1} strokeDasharray={`${route} 1`} strokeLinecap="round" />
        {/* Orte */}
        <circle cx={300} cy={560} r={14} fill="#3A2414" />
        <text x={300} y={520} textAnchor="middle" fontFamily="Cinzel" fontWeight={700} fontSize={40} fill="#3A2414">
          Manchester
        </text>
        <text x={300} y={612} textAnchor="middle" fontFamily="Cormorant Garamond" fontStyle="italic" fontWeight={600} fontSize={34} fill="#5A3A22">
          bei Palmyra
        </text>
        <circle cx={790} cy={960} r={14} fill="#3A2414" />
        <text x={790} y={1030} textAnchor="middle" fontFamily="Cinzel" fontWeight={700} fontSize={40} fill="#3A2414">
          Harmony
        </text>
        {/* Reisender */}
        {route > 0.01 && route < 0.995 ? (
          <g>
            <circle cx={mx} cy={my} r={30} fill="url(#olWarm)" opacity={0.9} />
            <circle cx={mx} cy={my} r={11} fill="#9A2E1E" stroke="#F7EEDA" strokeWidth={3} />
          </g>
        ) : null}
        {/* Bei Joseph: das Haus */}
        {home > 0.01 ? (
          <g transform={`translate(790 920) scale(${0.6 + 0.4 * home})`} opacity={home}>
            <circle r={70} fill="url(#olWarm)" opacity={0.7} />
            <path d="M -34 0 L -34 -40 L 0 -66 L 34 -40 L 34 0 Z" fill="#7A2A1A" stroke="#3A1A10" strokeWidth={3} />
            <rect x={-10} y={-24} width={18} height={24} fill="#FFD27A" />
          </g>
        ) : null}
        {home > 0.01 ? (
          <text x={890} y={900} textAnchor="middle" fontFamily="Caveat" fontWeight={700} fontSize={60} fill="#7A2A1A" opacity={home}>
            Joseph
          </text>
        ) : null}
        {/* Titel */}
        <text x={560} y={480} textAnchor="middle" fontFamily="Caveat" fontWeight={700} fontSize={84} fill={INK} opacity={title}>
          Frühling 1829
        </text>
      </g>
      {/* Schreiber: Feder und Blatt */}
      {scribe > 0.01 ? (
        <g transform={`translate(740 640) rotate(${6 - 6 * scribe}) scale(${0.7 + 0.3 * scribe})`} opacity={scribe}>
          <rect x={-120} y={-80} width={240} height={170} rx={4} fill="#FBF4E4" stroke="#8A6A3E" strokeWidth={3} />
          {[0, 1, 2, 3].map((l) => (
            <path key={l} d={`M -90 ${-40 + l * 32} q 20 -8 40 0 t 40 0 t 40 0 t 40 0`} stroke={INK} strokeWidth={3} fill="none" opacity={0.6} pathLength={1} strokeDasharray={`${interpolate(t, [b[2] + l * 0.15, b[2] + 0.3 + l * 0.15], [0, 1], clamp)} 1`} />
          ))}
          <g transform="translate(110 40) rotate(-20)">
            <path d="M 0 0 L 40 -110" stroke="#EDE6D6" strokeWidth={4} />
            <path d="M 12 -30 C 30 -66, 46 -100, 48 -124 C 32 -104, 18 -70, 12 -30 Z" fill="#EDE6D6" stroke="#8A7A5A" strokeWidth={2} />
          </g>
          <text x={0} y={140} textAnchor="middle" fontFamily="Caveat" fontWeight={700} fontSize={58} fill="#FFE9C4" stroke="#24160C" strokeWidth={7} paintOrder="stroke">
            Schreiber
          </text>
        </g>
      ) : null}
    </g>
  );
};

/** Am Tisch in Harmony: Joseph empfängt eine Offenbarung, Oliver schreibt. */
const RevelationStage: React.FC<StageProps> = ({ t, frame, b, end }) => {
  const recv = fade(t, b[0] - 0.2, 0.8);
  const writing = t > b[0] - 0.4 && t < end ? 1 : 0;
  const w = writing * Math.sin(frame / 2.2);
  const oj: Joints = { ...SIT, hand: [SIT.hand[0] + 8 * w, SIT.hand[1] - 3 * Math.abs(w)], elbow: [SIT.elbow[0] + 4 * w, SIT.elbow[1]], shoulder: [SIT.shoulder[0] + 8, SIT.shoulder[1] + 4], head: [SIT.head[0] + 14, SIT.head[1] + 10] };
  const jj: Joints = { ...SIT, hand: [SIT.hand[0] - 20, SIT.hand[1] - 4], shoulder: [SIT.shoulder[0] - 2, SIT.shoulder[1] - 4], head: [SIT.head[0] - 2, SIT.head[1] - 8] };
  const K = 1.6;
  const TY = 1010;
  const floor = TY - TABLE_Y * K;
  return (
    <g>
      <ellipse cx={540} cy={980} rx={520} ry={360} fill="url(#olFlame)" opacity={0.45 + 0.05 * Math.sin(frame / 3)} />
      {/* Stühle */}
      {[
        [250, 1],
        [830, -1],
      ].map(([cx, dir]) => (
        <g key={cx} transform={`translate(${cx} ${floor}) scale(${dir * K} ${K})`}>
          <rect x={-46} y={-260} width={10} height={260} fill="#2A1A10" />
          <rect x={-46} y={-250} width={10} height={6} fill="#5A3A22" />
          {[-220, -190, -160].map((ry) => (
            <rect key={ry} x={-46} y={ry} width={30} height={7} fill="#3A2416" />
          ))}
        </g>
      ))}
      <Gent x={250} y={floor} k={K} j={jj} d={shadeDress(JOSEPH, 0.45)} rim="#FFC872" rimO={0.7} glow={recv * 0.8} shadow={false} />
      <Gent x={830} y={floor} k={K} j={oj} d={shadeDress(OLIVER, 0.45)} rim="#FFC872" rimO={0.7} dir={-1} quill shadow={false} />
      <TableFront y={TY} />
      {/* Papiere und Tinte auf dem Tisch */}
      <path d={`M 600 ${TY - 2} L 700 ${TY - 2} L 716 ${TY + 18} L 588 ${TY + 18} Z`} fill="#F2E6CA" />
      <rect x={316} y={TY - 14} width={26} height={22} rx={4} fill="#1A1A22" />
      <Candle x={470} y={TY + 6} k={1.35} lit={1} frame={frame} />
    </g>
  );
};

/** Oliver erstarrt – das Siegel bricht auf. */
const WitnessStage: React.FC<StageProps> = ({ t, frame, b }) => {
  const freeze = fade(t, b[0] - 0.05, 0.25);
  const drop = interpolate(t, [b[0] + 0.15, b[0] + 0.75], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  const sealIn = fade(t, b[1] - 0.2, 0.5);
  const crack = interpolate(t, [b[1] + 0.6, b[1] + 1.4], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const warm = interpolate(t, [b[2] - 0.2, b[2] + 1.2], [0, 1], { ...clamp, easing: ease });
  const pulse = interpolate(t, [b[0], b[0] + 0.9], [0, 1], clamp);
  const writing = t < b[0] ? Math.sin(frame / 2.2) : 0;
  const K = 2.3;
  const TY = 1130;
  const floor = TY - TABLE_Y * K;
  const j: Joints = {
    ...SIT,
    shoulder: [SIT.shoulder[0] + 8 - 6 * warm, SIT.shoulder[1] + 4 - 8 * warm],
    head: [SIT.head[0] + 14 - 10 * freeze - 6 * warm, SIT.head[1] + 10 - 14 * freeze - 6 * warm],
    hand: warm > 0.01 ? lerp([SIT.hand[0] + 8 * writing, SIT.hand[1]], [30, -214], warm) : [SIT.hand[0] + 8 * writing, SIT.hand[1]],
    elbow: warm > 0.01 ? lerp(SIT.elbow, [40, -170], warm) : SIT.elbow,
  };
  // Die Feder fällt aus der Hand auf den Tisch
  const handX = 760 - (SIT.hand[0] + 4) * K;
  return (
    <g>
      <ellipse cx={400} cy={1080} rx={560} ry={420} fill="url(#olFlame)" opacity={0.4} />
      {/* Erinnerung: das Siegel – und es bricht auf */}
      {sealIn > 0.01 ? <Seal x={540} y={520} k={1.25 * (0.8 + 0.2 * sealIn)} crack={crack} o={sealIn} frame={frame} /> : null}
      {warm > 0.01 ? <path d={`M 470 560 L 610 560 L ${1000} 1130 L ${420} 1130 Z`} fill="url(#olBeam)" opacity={0.6 * warm} /> : null}
      {/* Schreck: ein Ring um den Kopf */}
      {pulse > 0.01 && pulse < 1 ? <circle cx={760 - (SIT.head[0] + 4) * K} cy={floor + (SIT.head[1] - 4) * K} r={60 + 120 * pulse} fill="none" stroke="#FFE7A8" strokeWidth={5} opacity={(1 - pulse) * 0.7} /> : null}
      <g transform={`translate(760 ${floor}) scale(${-K} ${K})`}>
        <rect x={-46} y={-260} width={10} height={260} fill="#2A1A10" />
        {[-220, -190, -160].map((ry) => (
          <rect key={ry} x={-46} y={ry} width={30} height={7} fill="#3A2416" />
        ))}
      </g>
      <Gent x={760} y={floor} k={K} j={j} d={shadeDress(OLIVER, 0.4)} rim="#FFC872" rimO={0.8} dir={-1} quill={drop < 0.01} glow={warm * 0.9} shadow={false} />
      {warm > 0.01 ? <circle cx={760 - 26 * K} cy={floor - 206 * K} r={50 + 30 * warm} fill="url(#olWarm)" opacity={warm} /> : null}
      <TableFront y={TY} />
      {/* fallende Feder */}
      {drop > 0.01 ? (
        <g transform={`translate(${handX - 30 * drop} ${floor + (SIT.hand[1] - 2) * K + (TY - (floor + (SIT.hand[1] - 2) * K) - 8) * drop}) rotate(${-30 + 100 * drop}) scale(${K * 0.9})`}>
          <path d="M 0 0 L -34 -64" stroke="#EDE6D6" strokeWidth={3} />
          <path d="M -10 -18 C -26 -40, -38 -62, -40 -76 C -28 -64, -16 -44, -10 -18 Z" fill="#EDE6D6" />
        </g>
      ) : null}
      <Candle x={250} y={TY + 6} k={1.8} lit={1} frame={frame} />
      <path d={`M 470 ${TY - 2} L 640 ${TY - 2} L 660 ${TY + 24} L 452 ${TY + 24} Z`} fill="#F2E6CA" />
      {[0, 1, 2].map((l) => (
        <line key={l} x1={480 + l * 4} y1={TY + 4 + l * 6} x2={620 - l * 10} y2={TY + 4 + l * 6} stroke={INK} strokeWidth={2} opacity={0.4} />
      ))}
    </g>
  );
};

/* ------------------------------------------------------------------ */
/* Die Handschrift der Offenbarung (HTML, damit sie umbricht)          */
/* ------------------------------------------------------------------ */

const Handwriting: React.FC<{ ts: TimelineScene; s: OliverSceneT; t: number; show: number }> = ({ ts, s, t, show }) => {
  const glow = s.glowAt ? findCue(ts.words, s.glowAt) : null;
  if (show <= 0.01) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: 96,
        right: 96,
        top: 270,
        padding: "34px 46px 40px",
        background: "linear-gradient(170deg, #F8EFD8 0%, #EEDDB8 100%)",
        border: "4px solid #8A6A3E",
        borderRadius: 8,
        boxShadow: "0 24px 60px rgba(0,0,0,0.55), inset 0 0 60px rgba(160,110,50,0.25)",
        transform: `rotate(-1.2deg) translateY(${(1 - show) * 40}px) scale(${0.94 + 0.06 * show})`,
        opacity: show,
      }}
    >
      <div style={{ fontFamily: "Cinzel", fontWeight: 700, fontSize: 30, letterSpacing: "0.18em", color: "#7A3A22", marginBottom: 10 }}>FÜR OLIVER · HARMONY, 1829</div>
      {s.lines.map((line, li) => {
        const tokens = line.text.split(/\s+/).filter(Boolean);
        const cue = findCue(ts.words, line.text);
        const at = cue ? ts.words[cue.first].start : 1 + li * 3;
        const span = cue ? ts.words[cue.last].end - at : 2.5;
        return (
          <div key={li} style={{ fontFamily: "Caveat", fontWeight: 700, fontSize: 66, lineHeight: 1.12, color: INK, marginTop: li ? 14 : 0 }}>
            {tokens.map((tok, i) => {
              const w = cue && cue.last - cue.first + 1 === tokens.length ? ts.words[cue.first + i] : null;
              const ws = w ? w.start : at + (i / tokens.length) * span;
              const we = w ? w.end : ws + span / tokens.length;
              const k = interpolate(t, [ws - 0.05, Math.max(ws + 0.1, we)], [0, 1], clamp);
              const isGlow = glow && w && w.index >= glow.first && w.index <= glow.last;
              const g = isGlow ? fade(t, ts.words[glow.first].start, 0.4) : 0;
              return (
                <span
                  key={i}
                  style={{
                    display: "inline-block",
                    marginRight: 16,
                    clipPath: `inset(-20% ${(1 - k) * 100}% -30% -5%)`,
                    color: g > 0 ? mix("#2A1A0E", "#B8761A", g) : INK,
                    textShadow: g > 0 ? `0 0 ${18 * g}px rgba(255,190,80,${0.8 * g})` : undefined,
                  }}
                >
                  {tok}
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Szene                                                               */
/* ------------------------------------------------------------------ */

export const Scene: React.FC<{ ts: TimelineScene }> = ({ ts }) => {
  const s = ts.scene as OliverSceneT;
  const frame = useCurrentFrame();
  useLook();
  const t = (frame - ts.audioOffsetFrames) / FPS;
  const b = beats(ts, s.cues, Math.max(3, s.cues.length));
  const f = (sec: number) => voiceFrame(ts, sec);
  const props: StageProps = { t, frame, b, s, ts, end: ts.speechEndSec };
  const stage = s.stage;
  const cardShow = stage === "revelation" ? fade(t, b[0] + 0.4, 0.6) : 0;

  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id="olWarm">
            <stop offset="0%" stopColor="#FFF4D2" stopOpacity="0.9" />
            <stop offset="45%" stopColor="#FFD98A" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#FFD98A" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="olFlame">
            <stop offset="0%" stopColor="#FFC27A" stopOpacity="0.55" />
            <stop offset="50%" stopColor="#E08A40" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#E08A40" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="olEmber">
            <stop offset="0%" stopColor="#FF8A3A" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#FF8A3A" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="olBeam" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFE7A8" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#FFE7A8" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="olNight" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#050818" />
            <stop offset="50%" stopColor="#0E1634" />
            <stop offset="100%" stopColor="#1A2246" />
          </linearGradient>
          <linearGradient id="olGold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FFE9A8" />
            <stop offset="50%" stopColor="#E0A640" />
            <stop offset="100%" stopColor="#B8802A" />
          </linearGradient>
          <radialGradient id="olParch" cx="0.5" cy="0.45" r="0.7">
            <stop offset="0%" stopColor="#F4E6C4" />
            <stop offset="75%" stopColor="#E2CC9C" />
            <stop offset="100%" stopColor="#B8945E" />
          </radialGradient>
        </defs>
        {stage === "hook" ? <HookStage {...props} /> : null}
        {stage === "house" ? <HouseStage {...props} /> : null}
        {stage === "night" ? <NightStage {...props} /> : null}
        {stage === "secret" ? <SecretStage {...props} /> : null}
        {stage === "journey" ? <JourneyStage {...props} /> : null}
        {stage === "revelation" ? <RevelationStage {...props} /> : null}
        {stage === "witness" ? <WitnessStage {...props} /> : null}
      </svg>
      {stage === "revelation" ? <Handwriting ts={ts} s={s} t={t} show={cardShow} /> : null}

      {/* Wenige, leise Klänge an den Momenten, um die es geht */}
      {stage === "hook" ? <Sfx frame={f(b[0])} name="warm" volume={0.35} keep /> : null}
      {stage === "night" ? <Sfx frame={f(b[2])} name="warm" volume={0.4} keep /> : null}
      {stage === "secret" ? <Sfx frame={f(b[1])} name="thud" volume={0.45} keep /> : null}
      {stage === "witness" ? <Sfx frame={f(b[1] + 0.6)} name="warm" volume={0.4} keep /> : null}
    </AbsoluteFill>
  );
};

/** Was gross im Bild steht, wird nicht noch einmal untertitelt. */
export const hidden = (ts: TimelineScene): Set<number> => {
  const s = ts.scene as OliverSceneT;
  switch (s.stage) {
    case "house":
      return wordsOfTexts(ts, ["Winter 1828", "Oliver Cowdery, 22"]);
    case "night":
      return wordsOfTexts(ts, ["Frieden"]);
    case "secret":
      return wordsOfTexts(ts, ["Nur Gott und Oliver"]);
    case "journey":
      return wordsOfTexts(ts, ["Frühling 1829"]);
    case "revelation":
      return wordsOfTexts(ts, s.lines.map((l) => l.text));
    default:
      return new Set();
  }
};
