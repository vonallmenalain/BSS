import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, random, spring, useCurrentFrame } from "remotion";
import { Sfx, beat, beats, voiceFrame } from "../../lib/sfx";
import { FPS, type TimelineScene } from "../../lib/timing";
import type { Scene as SceneData } from "../../schema";
import { wordsOfTexts } from "../w45/kitA";

/*
 * «Habt ihr gefragt?» als Bildergeschichte (1 Nephi 10–11, 15). Jede Szene ist eine Comicseite:
 * oben ein grosses Panel, unten – unter den Untertiteln – ein Streifen mit kleinen Panels. Dicke
 * Tuschekonturen, flache Farben mit einer Schattenstufe, Rasterpunkte, Sprech-, Schrei- und
 * Gedankenblasen in der Comicschrift. Die Figuren sind über ihre Haltung erzählt: Lehi mit
 * erhobenem Arm, Laman und Lemuel mit fuchtelnden und dann verschränkten Armen, Nephi nachsinnend
 * auf dem Fels, später aufrecht mit dem Finger zum Himmel. Gesichter sind nur angedeutet (Auge,
 * Braue, Nase).
 *
 * Der Hintergrund (`ComicBg`) ist die dunkle Heftseite; alle Panels, Blasen und Boxen erscheinen
 * bei der Phrase, die die Stimme gerade sagt.
 */

type ComicSceneT = Extract<SceneData, { type: "comic" }>;
type P = [number, number];

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = Easing.inOut(Easing.sin);
const fade = (t: number, at: number, d = 0.4) => interpolate(t, [at, at + d], [0, 1], clamp);

const INK = "#15110E";
const PAPER = "#FFF8E8";
const YELLOW = "#FFE14D";
const RED = "#E8443A";
const NIGHT = "#141A33";

/* Das grosse Panel oben und der Streifen unten */
const MX = 54;
const MY = 262;
const MW = 972;
const MH = 918;
const SY = 1500;
const SH = 330;

const hex = (s: string) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
const mix = (a: string, b: string, k: number) => {
  const pa = hex(a);
  const pb = hex(b);
  const q = Math.max(0, Math.min(1, k));
  return `#${pa.map((v, i) => Math.round(v + (pb[i] - v) * q).toString(16).padStart(2, "0")).join("")}`;
};
const lerp = (a: P, b: P, k: number): P => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];

/* ------------------------------------------------------------------ */
/* Figuren                                                             */
/* ------------------------------------------------------------------ */

type J = Record<"hip" | "kneeF" | "footF" | "kneeB" | "footB" | "shoulder" | "elbowF" | "handF" | "elbowB" | "handB" | "head", P>;

const STAND: J = {
  hip: [0, -140],
  kneeF: [6, -72],
  footF: [12, 0],
  kneeB: [-6, -72],
  footB: [-12, 0],
  shoulder: [0, -250],
  elbowF: [14, -196],
  handF: [22, -146],
  elbowB: [-12, -196],
  handB: [-18, -146],
  head: [6, -288],
};
const pose = (o: Partial<J>, base: J = STAND): J => ({ ...base, ...o });
/** Lehi erzählt: der Arm geht hoch */
const TELL = pose({ elbowF: [46, -272], handF: [76, -328], head: [10, -290] });
/** Nephi zeigt zum Himmel */
const UP = pose({ elbowF: [36, -296], handF: [46, -362], head: [10, -292] });
/** Mit offener Hand nach vorn – eine Frage */
const ASK = pose({ elbowF: [58, -230], handF: [114, -226], head: [12, -288] });
/** Streit: beide Arme in der Luft */
const ARGUE = pose({ shoulder: [8, -246], elbowF: [48, -262], handF: [72, -318], elbowB: [-40, -254], handB: [-24, -310], head: [20, -282] });
/** Verschränkte Arme, Kinn hoch */
const CROSS = pose({ elbowF: [34, -188], handF: [-20, -206], elbowB: [-28, -190], handB: [26, -212], head: [-2, -294] });
/** Hand aufs Herz */
const HEART = pose({ elbowF: [34, -196], handF: [10, -226], head: [12, -284] });
/** Sitzend, die Hand am Kinn – nachsinnen */
const SIT: J = {
  hip: [-6, -96],
  kneeF: [56, -102],
  footF: [62, -4],
  kneeB: [46, -98],
  footB: [46, -4],
  shoulder: [-2, -208],
  elbowF: [50, -146],
  handF: [40, -196],
  elbowB: [-14, -150],
  handB: [24, -110],
  head: [18, -244],
};
/** Sitzend, die Hände im Schoss – zuhören */
const SIT_LAP = pose({ elbowF: [28, -140], handF: [60, -112], elbowB: [16, -142], handB: [50, -110], head: [14, -246] }, SIT);
/** Sitzend und den Kopf geneigt – demütig */
const SIT_BOW = pose({ shoulder: [6, -202], head: [34, -228], elbowF: [30, -138], handF: [62, -112], elbowB: [18, -140], handB: [52, -110] }, SIT);
/** Sitzend und erklärend */
const SIT_TALK = pose({ elbowF: [52, -178], handF: [98, -200], head: [16, -248] }, SIT);

const blend = (a: J, b: J, k: number): J => {
  const out = {} as J;
  (Object.keys(a) as Array<keyof J>).forEach((key) => {
    out[key] = lerp(a[key], b[key], k);
  });
  return out;
};

/** Arme wackeln lassen (Streit) */
const wave = (j: J, frame: number, amp: number, seed: number): J => ({
  ...j,
  handF: [j.handF[0] + Math.sin(frame / 3.1 + seed) * 16 * amp, j.handF[1] + Math.cos(frame / 2.7 + seed) * 18 * amp],
  elbowF: [j.elbowF[0] + Math.sin(frame / 3.1 + seed) * 6 * amp, j.elbowF[1]],
  handB: [j.handB[0] + Math.sin(frame / 2.6 + seed * 2) * 14 * amp, j.handB[1] + Math.cos(frame / 3.3 + seed) * 16 * amp],
  head: [j.head[0] + Math.sin(frame / 4 + seed) * 3 * amp, j.head[1]],
});

type Colors = { tunic: string; shade: string; legs: string; skin: string; hair: string; belt: string; band?: string; hood?: string; beard?: string; hem: number };

const NEPHI: Colors = { tunic: "#3D7CC9", shade: "#285A96", legs: "#2B3550", skin: "#C98E62", hair: "#2B1B12", belt: "#E3B04B", band: "#E3B04B", hem: 54 };
const LAMAN: Colors = { tunic: "#C0392B", shade: "#8E2A20", legs: "#4A2520", skin: "#B47A52", hair: "#1C110B", belt: "#5C2F1C", hem: 54 };
const LEMUEL: Colors = { tunic: "#D9822B", shade: "#A65F1C", legs: "#4D3A22", skin: "#BC8458", hair: "#24160E", belt: "#6B4420", hem: 54 };
const LEHI: Colors = { tunic: "#E9DFC6", shade: "#BFAF8C", legs: "#6D5A44", skin: "#B98058", hair: "#DADADA", belt: "#8A6A3E", hood: "#CDBB94", beard: "#F0F0EC", hem: 128 };

/** Farben in die Nacht tönen (k = 0: wie gemalt, 1: ganz dunkel) */
const tone = (c: Colors, k: number, tint = NIGHT): Colors => ({
  ...c,
  tunic: mix(c.tunic, tint, k),
  shade: mix(c.shade, tint, k),
  legs: mix(c.legs, tint, k),
  skin: mix(c.skin, tint, k),
  hair: mix(c.hair, tint, k * 0.7),
  belt: mix(c.belt, tint, k),
  band: c.band ? mix(c.band, tint, k) : undefined,
  hood: c.hood ? mix(c.hood, tint, k) : undefined,
  beard: c.beard ? mix(c.beard, tint, k * 0.8) : undefined,
});

type Face = { brow?: "angry" | "sad" | "calm"; shout?: number; tilt?: number };

const Body: React.FC<{ j: J; c: Colors; solid?: string; face?: Face }> = ({ j, c, solid, face = {} }) => {
  const ink = solid ?? INK;
  const limb = (pts: P[], color: string, w: number) => {
    const d = `M ${pts.map((q) => `${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join(" L ")}`;
    return (
      <g>
        <path d={d} stroke={ink} strokeWidth={w + 10} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        {solid ? null : <path d={d} stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" fill="none" />}
      </g>
    );
  };
  const [sx, sy] = j.shoulder;
  const [hx, hy] = j.hip;
  const sitK = Math.max(0, Math.min(1, 1 - (j.kneeF[1] - hy) / 60));
  const fb = lerp([hx + 40, hy + c.hem], [j.kneeF[0] + 8, j.kneeF[1] + 26], sitK);
  const bb = lerp([hx - 40, hy + c.hem], [hx - 36, hy + 36], sitK);
  const mid = (sy + hy) / 2;
  const tunic = `M ${sx - 28} ${sy + 6} Q ${sx - 36} ${mid} ${hx - 28} ${hy - 8} L ${bb[0]} ${bb[1]} Q ${(bb[0] + fb[0]) / 2} ${Math.max(bb[1], fb[1]) + 10} ${fb[0]} ${fb[1]} L ${hx + 28} ${hy - 8} Q ${sx + 36} ${mid} ${sx + 26} ${sy + 4} Q ${sx} ${sy - 14} ${sx - 28} ${sy + 6} Z`;
  const shadeStrip = `M ${sx - 28} ${sy + 6} Q ${sx - 36} ${mid} ${hx - 28} ${hy - 8} L ${bb[0]} ${bb[1]} L ${bb[0] + 22} ${bb[1] + 4} L ${hx - 10} ${hy - 8} Q ${sx - 16} ${mid} ${sx - 8} ${sy + 2} Z`;
  const [kx, ky] = j.head;
  const tilt = face.tilt ?? 0;
  return (
    <g>
      {/* Hinteres Bein und hinterer Arm */}
      {limb([j.hip, j.kneeB, j.footB], c.legs, 22)}
      {limb([[sx - 8, sy + 10], j.elbowB, j.handB], c.shade, 17)}
      {solid ? null : <circle cx={j.handB[0]} cy={j.handB[1] + 2} r={9} fill={c.skin} stroke={INK} strokeWidth={4} />}
      {/* Vorderes Bein, Füsse */}
      {limb([j.hip, j.kneeF, j.footF], c.legs, 23)}
      <ellipse cx={j.footF[0] + 9} cy={j.footF[1] - 4} rx={17} ry={8} fill={solid ?? c.legs} stroke={ink} strokeWidth={5} />
      <ellipse cx={j.footB[0] + 9} cy={j.footB[1] - 4} rx={17} ry={8} fill={solid ?? c.legs} stroke={ink} strokeWidth={5} />
      {/* Gewand */}
      <path d={tunic} fill={solid ?? c.tunic} stroke={ink} strokeWidth={solid ? 10 : 6} strokeLinejoin="round" />
      {solid ? null : <path d={shadeStrip} fill={c.shade} />}
      {solid ? null : <path d={`M ${hx - 28} ${hy - 8} L ${hx + 28} ${hy - 8}`} stroke={c.belt} strokeWidth={10} strokeLinecap="round" />}
      {solid ? null : <path d={tunic} fill="none" stroke={INK} strokeWidth={6} strokeLinejoin="round" />}
      {/* Kopf */}
      <g transform={`rotate(${tilt} ${kx} ${ky + 26})`}>
        <path d={`M ${kx - 10} ${ky + 14} L ${kx - 10} ${sy + 2} L ${kx + 10} ${sy + 2} L ${kx + 10} ${ky + 14} Z`} fill={solid ?? c.skin} stroke={ink} strokeWidth={4} />
        {c.hood && !solid ? (
          <path d={`M ${kx - 36} ${ky + 54} C ${kx - 46} ${ky - 10}, ${kx - 22} ${ky - 44}, ${kx + 6} ${ky - 40} C ${kx + 26} ${ky - 38}, ${kx + 34} ${ky - 22}, ${kx + 30} ${ky - 14} L ${kx - 10} ${ky - 4} L ${kx - 14} ${ky + 58} Z`} fill={c.hood} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
        ) : null}
        <circle cx={kx} cy={ky} r={solid ? 29 : 26} fill={solid ?? c.skin} stroke={solid ? "none" : INK} strokeWidth={5} />
        {solid ? null : (
          <>
            <path d={`M ${kx + 24} ${ky - 6} L ${kx + 35} ${ky + 6} L ${kx + 23} ${ky + 10}`} fill={c.skin} stroke={INK} strokeWidth={4} strokeLinejoin="round" />
            {c.hood ? (
              <path d={`M ${kx - 26} ${ky - 2} C ${kx - 24} ${ky - 30}, ${kx + 10} ${ky - 38}, ${kx + 28} ${ky - 10}`} fill="none" stroke={c.hood} strokeWidth={14} strokeLinecap="round" />
            ) : (
              <path d={`M ${kx - 27} ${ky + 8} C ${kx - 32} ${ky - 34}, ${kx + 22} ${ky - 42}, ${kx + 26} ${ky - 12} C ${kx + 12} ${ky - 20}, ${kx - 2} ${ky - 16}, ${kx - 8} ${ky + 10} Z`} fill={c.hair} stroke={INK} strokeWidth={4} strokeLinejoin="round" />
            )}
            {c.band ? <path d={`M ${kx - 25} ${ky - 6} Q ${kx} ${ky - 26} ${kx + 24} ${ky - 15}`} stroke={c.band} strokeWidth={6} fill="none" strokeLinecap="round" /> : null}
            {c.beard ? (
              <path d={`M ${kx + 24} ${ky + 10} C ${kx + 30} ${ky + 38}, ${kx + 18} ${ky + 60}, ${kx + 8} ${ky + 66} C ${kx + 2} ${ky + 48}, ${kx - 4} ${ky + 32}, ${kx - 6} ${ky + 18} C ${kx + 6} ${ky + 22}, ${kx + 14} ${ky + 18}, ${kx + 24} ${ky + 10} Z`} fill={c.beard} stroke={INK} strokeWidth={4} strokeLinejoin="round" />
            ) : null}
            {/* Auge und Braue */}
            <circle cx={kx + 14} cy={ky - 1} r={3.4} fill={INK} />
            {face.brow === "angry" ? <path d={`M ${kx + 4} ${ky - 16} L ${kx + 23} ${ky - 7}`} stroke={INK} strokeWidth={5} strokeLinecap="round" /> : null}
            {face.brow === "sad" ? <path d={`M ${kx + 5} ${ky - 8} L ${kx + 22} ${ky - 15}`} stroke={INK} strokeWidth={4} strokeLinecap="round" /> : null}
            {face.brow === "calm" ? <path d={`M ${kx + 6} ${ky - 11} Q ${kx + 14} ${ky - 15} ${kx + 22} ${ky - 11}`} stroke={INK} strokeWidth={4} fill="none" strokeLinecap="round" /> : null}
            {face.shout ? <path d={`M ${kx + 19} ${ky + 11} L ${kx + 30} ${ky + 12 + 3 * face.shout} L ${kx + 21} ${ky + 16 + 6 * face.shout} Z`} fill={INK} /> : null}
          </>
        )}
      </g>
      {/* Vorderer Arm */}
      {limb([[sx + 4, sy + 10], j.elbowF, j.handF], c.tunic, 18)}
      {solid ? null : <circle cx={j.handF[0]} cy={j.handF[1]} r={10} fill={c.skin} stroke={INK} strokeWidth={4} />}
    </g>
  );
};

const Fig: React.FC<{ x: number; y: number; k?: number; dir?: 1 | -1; j: J; c: Colors; rim?: string; rimO?: number; rimDx?: number; o?: number; face?: Face; shadow?: boolean }> = ({
  x,
  y,
  k = 1,
  dir = 1,
  j,
  c,
  rim,
  rimO = 0,
  rimDx = 6,
  o = 1,
  face,
  shadow = true,
}) =>
  o <= 0.01 ? null : (
    <g transform={`translate(${x} ${y}) scale(${dir * k} ${k})`} opacity={o}>
      {shadow ? <ellipse cx={4} cy={2} rx={74} ry={10} fill="#000" opacity={0.35} /> : null}
      {rim && rimO > 0 ? (
        <g transform={`translate(${rimDx} -3)`} opacity={rimO}>
          <Body j={j} c={c} solid={rim} />
        </g>
      ) : null}
      <Body j={j} c={c} face={face} />
    </g>
  );

/* ------------------------------------------------------------------ */
/* Comic-Bausteine                                                     */
/* ------------------------------------------------------------------ */

/** Ein Panel mit Tuscherahmen; der Inhalt wird auf das Panel beschnitten */
const Panel: React.FC<{ id: string; x: number; y: number; w: number; h: number; k: number; tilt?: number; glow?: number; children: React.ReactNode }> = ({ id, x, y, w, h, k, tilt = 0, glow = 0, children }) => {
  if (k <= 0.01) return null;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const s = 0.82 + 0.18 * k;
  return (
    <g transform={`translate(${cx} ${cy}) rotate(${tilt * (1 - k) + tilt * 0.15}) scale(${s}) translate(${-cx} ${-cy})`} opacity={Math.min(1, k * 1.6)}>
      <rect x={x + 16} y={y + 18} width={w} height={h} fill="#000" opacity={0.45} />
      <clipPath id={id}>
        <rect x={x} y={y} width={w} height={h} />
      </clipPath>
      <g clipPath={`url(#${id})`}>{children}</g>
      {glow > 0 ? <rect x={x - 6} y={y - 6} width={w + 12} height={h + 12} fill="none" stroke={YELLOW} strokeWidth={10} opacity={glow} /> : null}
      <rect x={x} y={y} width={w} height={h} fill="none" stroke="#F3E6C8" strokeWidth={16} />
      <rect x={x} y={y} width={w} height={h} fill="none" stroke={INK} strokeWidth={7} />
    </g>
  );
};

/** Gelbe Erzählbox oben links im Panel */
const CaptionBox: React.FC<{ x: number; y: number; text: string; k: number }> = ({ x, y, text, k }) => {
  if (k <= 0.01) return null;
  const w = text.length * 22 + 50;
  return (
    <g transform={`translate(${x} ${y}) rotate(-1.5) scale(${0.8 + 0.2 * k})`} opacity={Math.min(1, k * 1.5)}>
      <rect x={6} y={8} width={w} height={64} fill="#000" opacity={0.4} />
      <rect width={w} height={64} fill={YELLOW} stroke={INK} strokeWidth={5} />
      <text x={w / 2} y={47} textAnchor="middle" fontFamily="Bangers" fontSize={42} letterSpacing={2} fill={INK}>
        {text.toUpperCase()}
      </text>
    </g>
  );
};

/** Text in Zeilen umbrechen */
const wrap = (text: string, max: number) => {
  const lines: string[] = [];
  let cur = "";
  for (const w of text.split(/\s+/)) {
    if (cur && (cur + " " + w).length > max) {
      lines.push(cur);
      cur = w;
    } else cur = cur ? `${cur} ${w}` : w;
  }
  if (cur) lines.push(cur);
  return lines;
};

/** Sprech-, Schrei- oder Gedankenblase mit Schwanz zur Figur */
const Bubble: React.FC<{ cx: number; cy: number; text: string; max: number; fs: number; k: number; tail: P; kind?: "speech" | "shout" | "thought"; frame: number; color?: string; size?: P }> = ({
  cx,
  cy,
  text,
  max,
  fs,
  k,
  tail,
  kind = "speech",
  frame,
  color = PAPER,
  size,
}) => {
  if (k <= 0.01) return null;
  const lines = wrap(text.toUpperCase(), max).filter((l) => l.trim());
  const longest = Math.max(1, ...lines.map((l) => l.length));
  const w = Math.max(longest * fs * 0.5, fs * 1.6) + 40;
  const h = lines.length * fs * 1.04 + 26;
  const rx = size ? size[0] / 2 : w * 0.62;
  const ry = size ? size[1] / 2 : h * 0.72 + 10;
  const shake = kind === "shout" ? Math.sin(frame / 1.7) * 3 : 0;
  // Schwanz: zwei Punkte unten auf der Blase, Spitze bei der Figur
  const ang = Math.atan2(tail[1] - cy, tail[0] - cx);
  const a1: P = [cx + Math.cos(ang - 0.22) * rx * 0.86, cy + Math.sin(ang - 0.22) * ry * 0.86];
  const a2: P = [cx + Math.cos(ang + 0.22) * rx * 0.86, cy + Math.sin(ang + 0.22) * ry * 0.86];
  let outline: React.ReactNode;
  if (kind === "shout") {
    const n = 26;
    const pts = Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      const r = i % 2 ? 1.0 : 1.2 + 0.06 * Math.sin(i * 7.3);
      return `${(cx + Math.cos(a) * rx * r).toFixed(1)} ${(cy + Math.sin(a) * ry * r).toFixed(1)}`;
    });
    outline = (
      <>
        <path d={`M ${a1[0]} ${a1[1]} L ${tail[0]} ${tail[1]} L ${a2[0]} ${a2[1]} Z`} fill={color} stroke={INK} strokeWidth={7} strokeLinejoin="round" />
        <path d={`M ${pts.join(" L ")} Z`} fill={color} stroke={INK} strokeWidth={7} strokeLinejoin="round" />
        <path d={`M ${a1[0]} ${a1[1]} L ${tail[0]} ${tail[1]} L ${a2[0]} ${a2[1]}`} fill={color} />
      </>
    );
  } else if (kind === "thought") {
    const n = 11;
    const puffs = Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      return { x: cx + Math.cos(a) * rx * 0.92, y: cy + Math.sin(a) * ry * 0.9, r: Math.min(rx, ry) * (0.34 + 0.06 * Math.sin(i * 2.1)) };
    });
    const dots = [0.35, 0.62, 0.85].map((q, i) => ({ p: lerp([a1[0] / 2 + a2[0] / 2, a1[1] / 2 + a2[1] / 2], tail, q), r: 18 - i * 5 }));
    outline = (
      <>
        {dots.map((d, i) => (
          <circle key={`d${i}`} cx={d.p[0]} cy={d.p[1]} r={d.r} fill={color} stroke={INK} strokeWidth={5} />
        ))}
        {puffs.map((p, i) => (
          <circle key={`o${i}`} cx={p.x} cy={p.y} r={p.r} fill={color} stroke={INK} strokeWidth={7} />
        ))}
        <ellipse cx={cx} cy={cy} rx={rx * 0.95} ry={ry * 0.92} fill={color} />
        {puffs.map((p, i) => (
          <circle key={`i${i}`} cx={p.x} cy={p.y} r={p.r - 3.5} fill={color} />
        ))}
      </>
    );
  } else {
    outline = (
      <>
        <path d={`M ${a1[0]} ${a1[1]} L ${tail[0]} ${tail[1]} L ${a2[0]} ${a2[1]} Z`} fill={color} stroke={INK} strokeWidth={7} strokeLinejoin="round" />
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={color} stroke={INK} strokeWidth={7} />
        <path d={`M ${a1[0]} ${a1[1]} L ${tail[0]} ${tail[1]} L ${a2[0]} ${a2[1]}`} fill={color} />
        <ellipse cx={cx} cy={cy} rx={rx - 3.5} ry={ry - 3.5} fill={color} />
      </>
    );
  }
  const s = 0.55 + 0.45 * k;
  return (
    <g transform={`translate(${cx + shake} ${cy}) scale(${s}) translate(${-cx} ${-cy})`} opacity={Math.min(1, k * 1.8)}>
      {outline}
      {lines.map((l, i) => (
        <text key={i} x={cx} y={cy - ((lines.length - 1) * fs * 1.04) / 2 + i * fs * 1.04 + fs * 0.36} textAnchor="middle" fontFamily="Bangers" fontSize={fs} letterSpacing={1.5} fill={INK}>
          {l}
        </text>
      ))}
    </g>
  );
};

/** Ein grosses Fragezeichen in einer Blase */
const QBubble: React.FC<{ x: number; y: number; k: number; tail: P; lit: number; dim: number; frame: number; uid: string }> = ({ x, y, k, tail, lit, dim, frame, uid }) => {
  if (k <= 0.01) return null;
  const fill = mix(mix(PAPER, "#8C93A8", dim), "#FFE9A0", lit);
  return (
    <g>
      {lit > 0.01 ? <circle cx={x} cy={y} r={120 + 10 * Math.sin(frame / 6)} fill={`url(#${uid}-gold)`} opacity={lit} /> : null}
      <Bubble cx={x} cy={y} text="" max={4} fs={10} k={k} tail={tail} frame={frame} color={fill} size={[150, 132]} />
      <text
        x={x}
        y={y + 36}
        textAnchor="middle"
        fontFamily="Bangers"
        fontSize={108}
        fill={mix(INK, "#B07A10", lit)}
        opacity={Math.min(1, k * 1.8)}
        transform={`translate(${x} ${y}) scale(${0.55 + 0.45 * k}) translate(${-x} ${-y})`}
      >
        ?
      </text>
    </g>
  );
};

/** Zornzeichen über dem Kopf */
const Anger: React.FC<{ x: number; y: number; k: number; frame: number; s?: number }> = ({ x, y, k, frame, s = 1 }) => {
  if (k <= 0.01) return null;
  const pulse = 1 + 0.12 * Math.sin(frame / 2.2);
  const d = "M -6 -22 Q -6 -6 -22 -6 M 6 -22 Q 6 -6 22 -6 M -6 22 Q -6 6 -22 6 M 6 22 Q 6 6 22 6";
  return (
    <g transform={`translate(${x} ${y}) scale(${s * pulse * k})`} opacity={k}>
      <path d={d} stroke={INK} strokeWidth={13} fill="none" strokeLinecap="round" />
      <path d={d} stroke={RED} strokeWidth={7} fill="none" strokeLinecap="round" />
    </g>
  );
};

/** Bewegungsstriche an einer Hand */
const Motion: React.FC<{ x: number; y: number; k: number; flip?: boolean }> = ({ x, y, k, flip }) =>
  k <= 0.01 ? null : (
    <g transform={`translate(${x} ${y}) scale(${flip ? -1 : 1} 1)`} opacity={k}>
      {[0, 1, 2].map((i) => (
        <path key={i} d={`M ${18 + i * 4} ${-24 + i * 22} q 18 -6 30 -2`} stroke={INK} strokeWidth={5} fill="none" strokeLinecap="round" />
      ))}
    </g>
  );

/** Strahlen hinter einer Figur – dramatischer Moment */
const Burst: React.FC<{ cx: number; cy: number; n: number; r1: number; r2: number; color: string; o: number; spin?: number }> = ({ cx, cy, n, r1, r2, color, o, spin = 0 }) => {
  if (o <= 0.01) return null;
  const d = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + spin;
    const dd = (Math.PI / n) * 0.55;
    const rr = r2 * (i % 2 ? 0.8 : 1);
    return `M ${cx + Math.cos(a - dd) * r1} ${cy + Math.sin(a - dd) * r1} L ${cx + Math.cos(a) * rr} ${cy + Math.sin(a) * rr} L ${cx + Math.cos(a + dd) * r1} ${cy + Math.sin(a + dd) * r1} Z`;
  }).join(" ");
  return <path d={d} fill={color} opacity={o} />;
};

/* ------------------------------------------------------------------ */
/* Landschaft                                                          */
/* ------------------------------------------------------------------ */

const Sky: React.FC<{ uid: string; x: number; y: number; w: number; h: number; frame: number; seed: string; n?: number; warm?: number }> = ({ uid, x, y, w, h, frame, seed, n = 60, warm = 0 }) => {
  const stars = useMemo(() => Array.from({ length: n }, (_, i) => ({ x: x + random(`${seed}x${i}`) * w, y: y + random(`${seed}y${i}`) * h * 0.7, r: 1.5 + random(`${seed}r${i}`) * 3, p: random(`${seed}p${i}`) * 6 })), [x, y, w, h, n, seed]);
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={`url(#${uid}-sky)`} />
      {warm > 0 ? <rect x={x} y={y} width={w} height={h} fill={`url(#${uid}-warmsky)`} opacity={warm} /> : null}
      <rect x={x} y={y} width={w} height={h} fill={`url(#${uid}-dots)`} opacity={0.35} />
      {stars.map((st, i) => (
        <g key={i} transform={`translate(${st.x} ${st.y})`} opacity={0.55 + 0.45 * Math.sin(frame / 14 + st.p)}>
          {st.r > 3.4 ? <path d={`M 0 ${-st.r * 2.4} L ${st.r * 0.5} 0 L 0 ${st.r * 2.4} L ${-st.r * 0.5} 0 Z M ${-st.r * 2.4} 0 L 0 ${st.r * 0.5} L ${st.r * 2.4} 0 L 0 ${-st.r * 0.5} Z`} fill="#FFF6D8" /> : <circle r={st.r * 0.7} fill="#FFF6D8" />}
        </g>
      ))}
    </g>
  );
};

const Ridge: React.FC<{ x: number; w: number; y: number; amp: number; seed: number; fill: string; bottom: number; stroke?: boolean }> = ({ x, w, y, amp, seed, fill, bottom, stroke = true }) => {
  const pts: string[] = [];
  for (let i = 0; i <= 24; i++) {
    const xx = x - 20 + ((w + 40) * i) / 24;
    pts.push(`${xx.toFixed(1)} ${(y - Math.sin(xx / 170 + seed) * amp - Math.sin(xx / 67 + seed * 2) * amp * 0.35).toFixed(1)}`);
  }
  return <path d={`M ${x - 20} ${bottom} L ${pts.join(" L ")} L ${x + w + 20} ${bottom} Z`} fill={fill} stroke={stroke ? INK : "none"} strokeWidth={6} strokeLinejoin="round" />;
};

const Tent: React.FC<{ x: number; y: number; s: number; lit: number; dark?: number }> = ({ x, y, s, lit, dark = 0.35 }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path d="M -200 2 L -150 0 M 150 0 L 200 4" stroke={INK} strokeWidth={4} />
    <path d="M -150 0 L 0 -190 L 150 0 Z" fill={mix("#C59A60", NIGHT, dark)} stroke={INK} strokeWidth={7} strokeLinejoin="round" />
    <path d="M 0 -190 L 150 0 L 52 0 Z" fill={mix("#94703F", NIGHT, dark)} />
    <path d="M -150 0 L 0 -190 L 150 0 Z" fill="none" stroke={INK} strokeWidth={7} strokeLinejoin="round" />
    <path d="M -44 0 L 0 -118 L 44 0 Z" fill={lit > 0 ? mix("#1A1210", "#FFB85C", lit) : "#1A1210"} stroke={INK} strokeWidth={6} strokeLinejoin="round" />
    <line x1={0} y1={-190} x2={0} y2={-222} stroke={INK} strokeWidth={7} strokeLinecap="round" />
    <path d="M -100 -66 L -70 -60 M -60 -120 L -40 -112 M 70 -84 L 96 -90" stroke={INK} strokeWidth={3} opacity={0.5} />
  </g>
);

const Fire: React.FC<{ x: number; y: number; s: number; frame: number; uid: string; glow?: number }> = ({ x, y, s, frame, uid, glow = 1 }) => {
  const f1 = Math.sin(frame / 2.3) * 6;
  const f2 = Math.sin(frame / 3.1 + 1) * 8;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <circle cy={-30} r={260} fill={`url(#${uid}-fire)`} opacity={glow * (0.85 + 0.1 * Math.sin(frame / 3))} />
      <ellipse cy={4} rx={86} ry={16} fill="#000" opacity={0.35} />
      {[-1, 1].map((d) => (
        <rect key={d} x={-70} y={-12} width={140} height={22} rx={10} fill="#5A3A22" stroke={INK} strokeWidth={5} transform={`rotate(${d * 14})`} />
      ))}
      <path d={`M -48 -6 C -60 -60, -20 -80, ${-10 + f1} -150 C 10 -100, 30 -96, 26 -60 C 40 -80, ${54 + f2} -70, 48 -6 Z`} fill="#F2702E" stroke={INK} strokeWidth={6} strokeLinejoin="round" />
      <path d={`M -28 -6 C -34 -46, -8 -60, ${-2 + f2 * 0.5} -106 C 14 -70, 26 -60, 28 -6 Z`} fill="#FFB347" />
      <path d={`M -12 -6 C -14 -30, 0 -40, ${2 + f1 * 0.4} -64 C 10 -40, 16 -30, 12 -6 Z`} fill="#FFF0A8" />
      {[0, 1, 2, 3].map((i) => {
        const q = ((frame / 30 + i * 0.27) % 1 + 1) % 1;
        return <circle key={i} cx={Math.sin(i * 2.4 + q * 5) * 30} cy={-80 - q * 160} r={4 * (1 - q)} fill="#FFD27A" opacity={1 - q} />;
      })}
    </g>
  );
};

/** Ölbaum: Stamm, drei Äste. scatter: die Äste fliegen weg, graft: sie kommen zurück und leuchten */
const OliveTree: React.FC<{ x: number; y: number; s: number; scatter?: number; graft?: number; frame: number; uid: string }> = ({ x, y, s, scatter = 0, graft = 0, frame, uid }) => {
  const branches: Array<{ at: P; to: P; dir: P }> = [
    { at: [-8, -110], to: [-86, -170], dir: [-1.4, -0.6] },
    { at: [0, -122], to: [4, -222], dir: [0.3, -1.6] },
    { at: [8, -106], to: [88, -164], dir: [1.4, -0.5] },
  ];
  const leaf = "#7F9A5C";
  const leaf2 = "#A9BC8A";
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M -18 0 C -22 -46, -6 -84, -12 -124 L 12 -124 C 8 -82, 22 -44, 20 0 Z" fill="#6B4A2E" stroke={INK} strokeWidth={6} strokeLinejoin="round" />
      <path d="M -4 -20 C -8 -50, 2 -70, -2 -100" stroke="#4A3220" strokeWidth={4} fill="none" />
      <ellipse cy={4} rx={70} ry={10} fill="#000" opacity={0.3} />
      {branches.map((br, i) => {
        const sc = Math.max(0, scatter - graft);
        const fly = Math.min(1, sc * (1 + i * 0.15));
        const ox = br.dir[0] * 36 * fly;
        const oy = br.dir[1] * 46 * fly + 64 * fly * fly;
        const rot = (i - 1) * 55 * fly + (i === 1 ? 35 * fly : 0);
        const g = graft;
        return (
          <g key={i}>
            {scatter > 0.05 && g < 0.95 ? <path d={`M ${br.at[0] - 10} ${br.at[1] - 6} l 8 6 l -6 6 l 10 4`} stroke={INK} strokeWidth={4} fill="none" opacity={Math.min(1, scatter * 2) * (1 - g)} /> : null}
            {fly > 0.05 ? <path d={`M ${br.at[0]} ${br.at[1]} Q ${br.at[0] + ox * 0.5} ${br.at[1] + oy * 0.2 - 40} ${br.at[0] + ox} ${br.at[1] + oy}`} stroke="#FFF1C8" strokeWidth={4} strokeDasharray="4 12" fill="none" opacity={0.7 * fly} /> : null}
            <g transform={`translate(${ox} ${oy}) rotate(${rot} ${br.at[0]} ${br.at[1]})`}>
              <path d={`M ${br.at[0]} ${br.at[1]} Q ${(br.at[0] + br.to[0]) / 2} ${(br.at[1] + br.to[1]) / 2 + 14} ${br.to[0]} ${br.to[1]}`} stroke={INK} strokeWidth={17} fill="none" strokeLinecap="round" />
              <path d={`M ${br.at[0]} ${br.at[1]} Q ${(br.at[0] + br.to[0]) / 2} ${(br.at[1] + br.to[1]) / 2 + 14} ${br.to[0]} ${br.to[1]}`} stroke="#6B4A2E" strokeWidth={9} fill="none" strokeLinecap="round" />
              {[
                [0, 0, 38],
                [-30, 14, 28],
                [30, 12, 28],
                [-8, -26, 30],
              ].map(([dx, dy, r], q) => (
                <ellipse key={q} cx={br.to[0] + dx} cy={br.to[1] + dy} rx={r} ry={r * 0.74} fill={q % 2 ? leaf2 : leaf} stroke={INK} strokeWidth={5} />
              ))}
            </g>
            {g > 0.05 ? <circle cx={br.at[0]} cy={br.at[1]} r={26 + 4 * Math.sin(frame / 5 + i)} fill={`url(#${uid}-gold)`} opacity={g} /> : null}
          </g>
        );
      })}
    </g>
  );
};

/* Kleine Bilder für den Streifen unten */
const Icon: React.FC<{ kind: "eye" | "ear" | "light" | "heart" | "hands" | "tablets"; x: number; y: number; s: number; frame: number; lit?: number }> = ({ kind, x, y, s, frame, lit = 0 }) => {
  const pulse = 1 + 0.03 * Math.sin(frame / 6);
  let body: React.ReactNode = null;
  if (kind === "eye") {
    body = (
      <g>
        <path d="M -90 0 Q 0 -70 90 0 Q 0 70 -90 0 Z" fill={PAPER} stroke={INK} strokeWidth={8} strokeLinejoin="round" />
        <circle r={34} fill="#3D7CC9" stroke={INK} strokeWidth={6} />
        <circle r={14} fill={INK} />
        <circle cx={10} cy={-12} r={7} fill="#fff" />
        {[-50, -20, 10, 40].map((lx, i) => (
          <line key={i} x1={lx} y1={-40 + Math.abs(lx) * 0.25} x2={lx - 6 + i * 4} y2={-62 + Math.abs(lx) * 0.25} stroke={INK} strokeWidth={6} strokeLinecap="round" />
        ))}
      </g>
    );
  } else if (kind === "ear") {
    body = (
      <g>
        <path d="M -40 60 C -70 30, -60 -80, 10 -84 C 70 -86, 80 -20, 50 10 C 30 30, 20 40, 22 64 C 24 90, -20 96, -40 60 Z" fill="#C98E62" stroke={INK} strokeWidth={8} strokeLinejoin="round" />
        <path d="M -14 30 C -34 0, -20 -50, 14 -52 C 44 -52, 46 -20, 30 -6 C 18 4, 10 10, 12 30" stroke={INK} strokeWidth={7} fill="none" strokeLinecap="round" />
        {[0, 1, 2].map((i) => (
          <path key={i} d={`M ${-80 - i * 22} ${-40 + i * 4} q -14 34 0 68`} stroke={YELLOW} strokeWidth={7} fill="none" strokeLinecap="round" opacity={0.5 + 0.5 * Math.sin(frame / 5 - i)} />
        ))}
      </g>
    );
  } else if (kind === "light") {
    body = (
      <g>
        <Burst cx={0} cy={0} n={16} r1={44} r2={110} color={YELLOW} o={0.9} spin={frame / 40} />
        <circle r={50} fill="#FFF3B0" stroke={INK} strokeWidth={8} />
        <circle r={24} fill="#FFFFFF" />
      </g>
    );
  } else if (kind === "heart") {
    body = (
      <g>
        <path d="M 0 74 C -110 0, -86 -86, -36 -80 C -14 -78, -4 -64, 0 -50 C 4 -64, 14 -78, 36 -80 C 86 -86, 110 0, 0 74 Z" fill={RED} stroke={INK} strokeWidth={8} strokeLinejoin="round" />
        <path d="M -54 -36 C -60 -56, -40 -64, -30 -58" stroke="#FFC2B8" strokeWidth={9} fill="none" strokeLinecap="round" />
      </g>
    );
  } else if (kind === "hands") {
    body = (
      <g>
        <path d="M -6 -84 C -30 -70, -44 -10, -44 40 L -40 80 L -4 80 Z" fill="#C98E62" stroke={INK} strokeWidth={8} strokeLinejoin="round" />
        <path d="M 6 -84 C 30 -70, 44 -10, 44 40 L 40 80 L 4 80 Z" fill="#B47A52" stroke={INK} strokeWidth={8} strokeLinejoin="round" />
        <rect x={-50} y={74} width={100} height={36} fill="#3D7CC9" stroke={INK} strokeWidth={7} />
      </g>
    );
  } else {
    body = (
      <g>
        {[-1, 1].map((d) => (
          <g key={d} transform={`translate(${d * 46} 0) rotate(${d * 4})`}>
            <path d="M -42 84 L -42 -50 C -42 -94, 42 -94, 42 -50 L 42 84 Z" fill="#B9B1A0" stroke={INK} strokeWidth={8} strokeLinejoin="round" />
            {[0, 1, 2, 3].map((l) => (
              <line key={l} x1={-24} y1={-34 + l * 28} x2={24} y2={-34 + l * 28} stroke={INK} strokeWidth={5} opacity={0.6} />
            ))}
          </g>
        ))}
      </g>
    );
  }
  return (
    <g transform={`translate(${x} ${y}) scale(${s * pulse})`}>
      {lit > 0 ? <circle r={130} fill="url(#cmGoldIcon)" opacity={lit} /> : null}
      {body}
    </g>
  );
};

/** Ein kleines Panel im Streifen unten, mit Bild und Wort */
const StripPanel: React.FC<{ id: string; x: number; w: number; k: number; label?: string; bg: string; glow?: number; children: React.ReactNode }> = ({ id, x, w, k, label, bg, glow = 0, children }) => (
  <Panel id={id} x={x} y={SY} w={w} h={SH} k={k} glow={glow}>
    <rect x={x} y={SY} width={w} height={SH} fill={bg} />
    <rect x={x} y={SY} width={w} height={SH} fill="url(#cmDotsDark)" opacity={0.35} />
    {children}
    {label ? (
      <g>
        <rect x={x + w / 2 - Math.min(w - 20, label.length * 18 + 44) / 2} y={SY + SH - 70} width={Math.min(w - 20, label.length * 18 + 44)} height={52} fill={YELLOW} stroke={INK} strokeWidth={5} />
        <text x={x + w / 2} y={SY + SH - 31} textAnchor="middle" fontFamily="Bangers" fontSize={38} letterSpacing={2} fill={INK}>
          {label.toUpperCase()}
        </text>
      </g>
    ) : null}
  </Panel>
);

/* ------------------------------------------------------------------ */
/* Szene                                                               */
/* ------------------------------------------------------------------ */

export const Scene: React.FC<{ ts: TimelineScene }> = ({ ts }) => {
  const s = ts.scene as ComicSceneT;
  const frame = useCurrentFrame();
  const t = (frame - ts.audioOffsetFrames) / FPS;
  const b = beats(ts, s.cues, Math.max(5, s.cues.length));
  const f = (sec: number) => voiceFrame(ts, sec);
  const end = ts.speechEndSec;
  const uid = `cm-${s.id}`;
  const sp = (at: number, cfg = { damping: 12, stiffness: 170 }) =>
    spring({ frame: frame - ts.audioOffsetFrames - Math.round(at * FPS), fps: FPS, config: cfg });
  const mainK = sp(-0.38, { damping: 14, stiffness: 160 });
  const prog = frame / Math.max(1, ts.durationInFrames);
  const bubbleAt = s.bubble ? beat(ts, s.bubble.at, 1) : 99;
  const bubbleK = s.bubble ? sp(bubbleAt - 0.08, { damping: 11, stiffness: 200 }) : 0;
  const stage = s.stage;

  /* Kamera: langsam ins grosse Panel hinein */
  const zoom = (fx: number, fy: number, z0: number, z1: number) => {
    const z = interpolate(prog, [0, 1], [z0, z1], { ...clamp, easing: ease });
    return `translate(${fx} ${fy}) scale(${z}) translate(${-fx} ${-fy})`;
  };

  const defs = (
    <defs>
      <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#0B1230" />
        <stop offset="60%" stopColor="#25306A" />
        <stop offset="100%" stopColor="#4C3A72" />
      </linearGradient>
      <linearGradient id={`${uid}-warmsky`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#3A2A5A" stopOpacity="0" />
        <stop offset="100%" stopColor="#B85A3A" stopOpacity="0.8" />
      </linearGradient>
      <radialGradient id={`${uid}-fire`}>
        <stop offset="0%" stopColor="#FFB45A" stopOpacity="0.85" />
        <stop offset="45%" stopColor="#FF7A2E" stopOpacity="0.28" />
        <stop offset="100%" stopColor="#FF7A2E" stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`${uid}-gold`}>
        <stop offset="0%" stopColor="#FFF4C2" stopOpacity="0.95" />
        <stop offset="50%" stopColor="#FFD65A" stopOpacity="0.4" />
        <stop offset="100%" stopColor="#FFD65A" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="cmGoldIcon">
        <stop offset="0%" stopColor="#FFF4C2" stopOpacity="0.9" />
        <stop offset="100%" stopColor="#FFD65A" stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`${uid}-lamp`}>
        <stop offset="0%" stopColor="#FFC870" stopOpacity="0.75" />
        <stop offset="100%" stopColor="#FFC870" stopOpacity="0" />
      </radialGradient>
      <linearGradient id={`${uid}-beam`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#FFF6D6" stopOpacity="0.95" />
        <stop offset="75%" stopColor="#FFE9A8" stopOpacity="0.35" />
        <stop offset="100%" stopColor="#FFE9A8" stopOpacity="0" />
      </linearGradient>
      <pattern id={`${uid}-dots`} width={14} height={14} patternUnits="userSpaceOnUse">
        <circle cx={3.5} cy={3.5} r={2.2} fill="#060A1C" />
        <circle cx={10.5} cy={10.5} r={2.2} fill="#060A1C" />
      </pattern>
      <pattern id="cmDotsDark" width={14} height={14} patternUnits="userSpaceOnUse">
        <circle cx={3.5} cy={3.5} r={2.4} fill="#000" />
        <circle cx={10.5} cy={10.5} r={2.4} fill="#000" />
      </pattern>
      <pattern id={`${uid}-warmdots`} width={16} height={16} patternUnits="userSpaceOnUse">
        <circle cx={4} cy={4} r={3} fill="#FFD27A" />
        <circle cx={12} cy={12} r={3} fill="#FFD27A" />
      </pattern>
    </defs>
  );

  let main: React.ReactNode = null;
  let strip: React.ReactNode = null;
  let sfx: React.ReactNode = null;
  const ground = 1084;

  if (stage === "hook") {
    /* Drei Brüder auf dem Hügel, drei Fragezeichen – und Licht auf einen */
    const figs = sp(b[0] - 0.25);
    const q = [0, 1, 2].map((i) => sp(b[1] - 0.05 + i * 0.12, { damping: 10, stiffness: 220 }));
    const light = fade(t, b[2] - 0.05, 0.5);
    const look = interpolate(t, [b[2], b[2] + 0.6], [0, 1], { ...clamp, easing: ease });
    const silK = 0.72;
    main = (
      <g transform={zoom(760, 820, 1.0, 1.06)}>
        <Sky uid={uid} x={MX} y={MY} w={MW} h={MH} frame={frame} seed="hk" n={80} />
        {/* Mond */}
        <circle cx={250} cy={420} r={70} fill="#F4EBCF" stroke={INK} strokeWidth={6} />
        <circle cx={226} cy={402} r={14} fill="#D9CFAF" />
        <circle cx={270} cy={446} r={9} fill="#D9CFAF" />
        <Ridge x={MX} w={MW} y={990} amp={30} seed={1.2} fill="#1C1B38" bottom={MY + MH} />
        {/* Licht von oben auf Nephi */}
        {light > 0 ? (
          <g opacity={light}>
            <path d={`M 690 ${MY} L 830 ${MY} L 930 ${ground + 20} L 590 ${ground + 20} Z`} fill={`url(#${uid}-beam)`} />
            <ellipse cx={760} cy={ground + 8} rx={190} ry={26} fill="#FFE9A8" opacity={0.5} />
          </g>
        ) : null}
        <Fig x={270} y={ground} k={1.32 * (0.9 + 0.1 * figs)} j={STAND} c={tone(LAMAN, silK)} rim="#9FC4FF" rimO={0.9} o={Math.min(1, figs * 1.5)} face={{ brow: "angry" }} />
        <Fig x={450} y={ground} k={1.26 * (0.9 + 0.1 * figs)} j={STAND} c={tone(LEMUEL, silK)} rim="#9FC4FF" rimO={0.9} o={Math.min(1, figs * 1.5)} face={{ brow: "angry" }} />
        <Fig
          x={760}
          y={ground}
          k={1.3 * (0.9 + 0.1 * figs)}
          dir={-1}
          j={blend(STAND, pose({ head: [14, -296] }), look)}
          c={tone(NEPHI, silK * (1 - 0.7 * light))}
          rim={light > 0.2 ? "#FFE9A8" : "#9FC4FF"}
          rimO={0.9}
          rimDx={-6}
          o={Math.min(1, figs * 1.5)}
          face={{ brow: "calm", tilt: -14 * look }}
        />
        <QBubble x={250} y={540} k={q[0]} tail={[268, 668]} lit={0} dim={light} frame={frame} uid={uid} />
        <QBubble x={470} y={540} k={q[1]} tail={[458, 676]} lit={0} dim={light} frame={frame} uid={uid} />
        <QBubble x={790} y={530} k={q[2]} tail={[768, 666]} lit={light} dim={0} frame={frame} uid={uid} />
      </g>
    );
    /* Titel unten */
    const title = sp(0.15, { damping: 13, stiffness: 150 });
    const shake = Math.sin(frame / 2) * 2 * (1 - fade(t, 1, 1));
    strip = (
      <g transform={`translate(${540 + shake} 1660) rotate(-3) scale(${0.7 + 0.3 * title}) translate(-540 -1660)`} opacity={Math.min(1, title * 1.5)}>
        <text x={548} y={1622} textAnchor="middle" fontFamily="Bangers" fontSize={150} letterSpacing={4} fill="#000" opacity={0.55}>
          HABT IHR
        </text>
        <text x={540} y={1612} textAnchor="middle" fontFamily="Bangers" fontSize={150} letterSpacing={4} fill={YELLOW} stroke={INK} strokeWidth={10} paintOrder="stroke">
          HABT IHR
        </text>
        <text x={548} y={1782} textAnchor="middle" fontFamily="Bangers" fontSize={170} letterSpacing={4} fill="#000" opacity={0.55}>
          GEFRAGT?
        </text>
        <text x={540} y={1772} textAnchor="middle" fontFamily="Bangers" fontSize={170} letterSpacing={4} fill={PAPER} stroke={INK} strokeWidth={10} paintOrder="stroke">
          GEFRAGT?
        </text>
      </g>
    );
    sfx = (
      <>
        <Sfx frame={f(b[1])} name="pop" volume={0.3} />
        <Sfx frame={f(b[2])} name="warm" volume={0.4} keep />
      </>
    );
  } else if (stage === "dream") {
    /* Lehi erzählt am Lager vom Ölbaum; unten die drei Bilder: Baum – zerstreut – eingepfropft */
    const raise = interpolate(t, [0.1, 0.9], [0, 1], { ...clamp, easing: ease });
    const lit = 0.32;
    main = (
      <g transform={zoom(400, 760, 1.0, 1.07)}>
        <Sky uid={uid} x={MX} y={MY} w={MW} h={MH} frame={frame} seed="dr" n={50} warm={0.5} />
        <Ridge x={MX} w={MW} y={820} amp={40} seed={2.1} fill="#241E40" bottom={MY + MH} />
        <Ridge x={MX} w={MW} y={930} amp={18} seed={0.4} fill="#3A2A3A" bottom={MY + MH} />
        <Tent x={180} y={960} s={0.9} lit={0.7} />
        <Tent x={900} y={940} s={0.75} lit={0} />
        <rect x={MX} y={1010} width={MW} height={MY + MH - 1010} fill="#4A3426" />
        <path d={`M ${MX} 1010 L ${MX + MW} 1010`} stroke={INK} strokeWidth={6} />
        <rect x={MX} y={1010} width={MW} height={MY + MH - 1010} fill={`url(#${uid}-dots)`} opacity={0.4} />
        <Fire x={560} y={1090} s={0.85} frame={frame} uid={uid} />
        <Fig x={360} y={1100} k={1.25} j={blend(STAND, TELL, raise)} c={tone(LEHI, lit)} rim="#FFB15A" rimO={0.85} face={{ brow: "calm", shout: 0.3 + 0.3 * Math.abs(Math.sin(frame / 3)) * (t < end ? 1 : 0) }} />
        <Fig x={690} y={1100} k={1.12} dir={-1} j={SIT_LAP} c={tone(NEPHI, lit)} rim="#FFB15A" rimO={0.85} face={{ brow: "calm", tilt: -6 }} />
        <Fig x={805} y={1104} k={1.16} dir={-1} j={SIT_LAP} c={tone(LAMAN, lit)} rim="#FFB15A" rimO={0.85} />
        <Fig x={915} y={1108} k={1.12} dir={-1} j={SIT_LAP} c={tone(LEMUEL, lit)} rim="#FFB15A" rimO={0.85} />
      </g>
    );
    const p1 = sp(b[0] - 0.1);
    const p2 = sp(b[1] - 0.1);
    const p3 = sp(b[2] - 0.1);
    const scatter = interpolate(t, [b[1] + 0.1, b[1] + 1.4], [0, 1], { ...clamp, easing: Easing.out(Easing.quad) });
    const graft = interpolate(t, [b[2] + 0.2, b[2] + 1.1], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
    const w3 = 306;
    strip = (
      <g>
        <StripPanel id={`${uid}-s1`} x={MX} w={w3} k={p1} label="Der Ölbaum" bg="#2E3F5C">
          <OliveTree x={MX + w3 / 2} y={SY + 252} s={0.8} frame={frame} uid={uid} />
        </StripPanel>
        <StripPanel id={`${uid}-s2`} x={MX + w3 + 27} w={w3} k={p2} label="Verstreut" bg="#4A2E48">
          <OliveTree x={MX + w3 + 27 + w3 / 2} y={SY + 252} s={0.8} scatter={scatter} frame={frame} uid={uid} />
        </StripPanel>
        <StripPanel id={`${uid}-s3`} x={MX + 2 * (w3 + 27)} w={w3} k={p3} label="Eingepfropft" bg="#2F4A3A" glow={graft * 0.8}>
          <OliveTree x={MX + 2 * (w3 + 27) + w3 / 2} y={SY + 252} s={0.8} scatter={1} graft={graft} frame={frame} uid={uid} />
        </StripPanel>
      </g>
    );
    sfx = (
      <>
        <Sfx frame={f(b[0])} name="pop" volume={0.3} />
        <Sfx frame={f(b[1] + 0.1)} name="whoosh" volume={0.3} />
        <Sfx frame={f(b[2] + 0.3)} name="chime" volume={0.3} />
      </>
    );
  } else if (stage === "ponder") {
    /* Nephi allein auf dem Fels über dem Lager; dann Licht, und er ist auf dem hohen Berg */
    const think = sp(b[0] - 0.1);
    const belief = fade(t, b[3] - 0.05, 0.6);
    const away = b[4];
    const flash = interpolate(t, [away - 0.1, away + 0.25, away + 0.9], [0, 1, 0], clamp);
    const gone = fade(t, away + 0.1, 0.5);
    const mount = interpolate(t, [away - 0.2, away + 1.2], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
    const beam = fade(t, away - 0.3, 0.4) * (1 - 0.7 * fade(t, away + 0.8, 0.8));
    main = (
      <g transform={zoom(460, 900, 1.0, 1.05)}>
        <Sky uid={uid} x={MX} y={MY} w={MW} h={MH} frame={frame} seed="pd" n={110} />
        {/* Milchstrasse */}
        <path d={`M ${MX} 620 C 300 520, 700 380, ${MX + MW} 300`} stroke="#B9B6FF" strokeWidth={90} opacity={0.08} fill="none" />
        {/* Der hohe Berg steigt auf */}
        <g transform={`translate(0 ${(1 - mount) * 420})`} opacity={mount}>
          <path d={`M 520 ${MY + MH} L 820 440 L 860 470 L 900 410 L ${MX + MW + 40} 700 L ${MX + MW + 40} ${MY + MH} Z`} fill="#2A2652" stroke={INK} strokeWidth={7} strokeLinejoin="round" />
          <path d="M 820 440 L 860 470 L 900 410 L 930 470 L 880 520 L 840 490 Z" fill="#E8ECFF" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
          <circle cx={880} cy={410} r={110} fill={`url(#${uid}-gold)`} opacity={0.9} />
          <Fig x={880} y={418} k={0.32} dir={-1} j={UP} c={tone(NEPHI, 0)} rim="#FFF4C2" rimO={1} shadow={false} o={gone} />
        </g>
        <Ridge x={MX} w={MW} y={1010} amp={20} seed={3.3} fill="#1E1A36" bottom={MY + MH} />
        {/* Das Lager tief unten */}
        <g opacity={1 - mount * 0.8}>
          <Tent x={860} y={1040} s={0.32} lit={0.8} />
          <Tent x={960} y={1046} s={0.26} lit={0} />
        </g>
        {/* Fels */}
        <path d="M 230 1100 C 240 1010, 300 990, 380 996 C 460 1000, 520 1030, 530 1100 Z" fill="#3B3554" stroke={INK} strokeWidth={7} strokeLinejoin="round" />
        <path d="M 260 1060 C 300 1040, 340 1036, 380 1040" stroke={INK} strokeWidth={4} fill="none" opacity={0.6} />
        {beam > 0 ? <path d={`M 340 ${MY} L 520 ${MY} L 620 1110 L 240 1110 Z`} fill={`url(#${uid}-beam)`} opacity={beam} /> : null}
        <Fig x={380} y={1010} k={1.36} j={SIT} c={tone(NEPHI, 0.42)} rim="#9FC4FF" rimO={0.8} face={{ brow: "calm", tilt: -4 }} o={1 - gone} shadow={false} />
        <Bubble cx={640} cy={540} text="" max={4} fs={10} k={think * (1 - gone)} tail={[470, 700]} kind="thought" frame={frame} color={mix(PAPER, "#FFF0B0", belief)} size={[250, 210]} />
        {think * (1 - gone) > 0.01 ? (
          <g transform={`translate(640 540) scale(${0.55 + 0.45 * think})`} opacity={(1 - gone) * Math.min(1, think * 1.8)}>
            <circle r={90} fill={`url(#${uid}-gold)`} opacity={belief} />
            <text y={40} textAnchor="middle" fontFamily="Bangers" fontSize={120} fill={mix(INK, "#B07A10", belief)}>
              ?
            </text>
          </g>
        ) : null}
        <rect x={MX} y={MY} width={MW} height={MH} fill="#FFF8DE" opacity={flash * 0.85} />
      </g>
    );
    const w3 = 306;
    const icons: Array<{ kind: "eye" | "ear" | "light"; label: string; at: number; bg: string }> = [
      { kind: "eye", label: "Sehen", at: b[0], bg: "#2E3F5C" },
      { kind: "ear", label: "Hören", at: b[1], bg: "#4A2E48" },
      { kind: "light", label: "Wissen", at: b[2], bg: "#2F4A3A" },
    ];
    strip = (
      <g>
        {icons.map((ic, i) => (
          <StripPanel key={ic.kind} id={`${uid}-s${i}`} x={MX + i * (w3 + 27)} w={w3} k={sp(ic.at - 0.1)} label={ic.label} bg={ic.bg} glow={belief * 0.7}>
            <Icon kind={ic.kind} x={MX + i * (w3 + 27) + w3 / 2} y={SY + 128} s={1.05} frame={frame} lit={belief * 0.6} />
          </StripPanel>
        ))}
      </g>
    );
    sfx = (
      <>
        {icons.map((ic, i) => (
          <Sfx key={i} frame={f(ic.at)} name="pop" volume={0.3} />
        ))}
        <Sfx frame={f(away)} name="whoosh" volume={0.35} />
      </>
    );
  } else if (stage === "dispute") {
    /* Im Zelt: Laman und Lemuel streiten, Nephi steht im Eingang */
    const fight = sp(b[0] - 0.3);
    const shout = 0.5 + 0.5 * Math.abs(Math.sin(frame / 2.4));
    const jl = wave(ARGUE, frame, 1, 0);
    const jr = wave(blend(ARGUE, ASK, 0.4), frame, 1, 2.2);
    main = (
      <g transform={zoom(540, 760, 1.0, 1.05)}>
        <TentInside uid={uid} frame={frame} />
        <Fig x={330} y={1120} k={1.26} j={jl} c={tone(LAMAN, 0.2, "#3A2418")} rim="#FFC870" rimO={0.8} face={{ brow: "angry", shout }} o={Math.min(1, fight * 1.4)} />
        <Fig x={760} y={1120} k={1.22} dir={-1} j={jr} c={tone(LEMUEL, 0.2, "#3A2418")} rim="#FFC870" rimO={0.8} face={{ brow: "angry", shout: 1 - shout * 0.6 }} o={Math.min(1, fight * 1.4)} />
        <Anger x={210} y={690} k={fight} frame={frame} s={1.3} />
        <Anger x={880} y={700} k={fight} frame={frame + 10} s={1.2} />
        <Motion x={420} y={830} k={fight * 0.9} />
        <Motion x={660} y={840} k={fight * 0.9} flip />
        <Bubble cx={560} cy={570} text={s.bubble?.text ?? ""} max={20} fs={52} k={bubbleK} tail={[452, 720]} kind="shout" frame={frame} />
      </g>
    );
    const nk = sp(0.4);
    strip = (
      <Panel id={`${uid}-s1`} x={MX} y={SY} w={MW} h={SH} k={nk} tilt={1.5}>
        {/* Von innen: der Eingang, draussen die Nacht, Nephi im Mondlicht */}
        <rect x={MX} y={SY} width={MW} height={SH} fill="#6A4A2C" />
        {Array.from({ length: 8 }, (_, i) => (
          <path key={i} d={`M ${MX + i * 130} ${SY} C ${MX + i * 130 + 30} ${SY + 120}, ${MX + i * 130 - 20} ${SY + 220}, ${MX + i * 130 + 20} ${SY + SH}`} stroke="#4E3420" strokeWidth={34} fill="none" opacity={0.7} />
        ))}
        <rect x={MX} y={SY} width={MW} height={SH} fill={`url(#${uid}-dots)`} opacity={0.35} />
        <clipPath id={`${uid}-door`}>
          <path d={`M 330 ${SY + SH} L 540 ${SY + 18} L 750 ${SY + SH} Z`} />
        </clipPath>
        <g clipPath={`url(#${uid}-door)`}>
          <Sky uid={uid} x={330} y={SY} w={420} h={SH} frame={frame} seed="dsn" n={22} />
          <circle cx={640} cy={SY + 120} r={34} fill="#F4EBCF" stroke={INK} strokeWidth={5} />
          <Ridge x={330} w={420} y={SY + 270} amp={10} seed={1.7} fill="#1A1934" bottom={SY + SH} />
          <Fig x={520} y={SY + SH + 150} k={1.2} j={pose({ head: [8, -286] })} c={tone(NEPHI, 0.78)} rim="#9FC4FF" rimO={1} shadow={false} face={{ brow: "sad" }} />
        </g>
        <path d={`M 330 ${SY + SH} L 540 ${SY + 18} L 750 ${SY + SH}`} fill="none" stroke={INK} strokeWidth={9} strokeLinejoin="round" />
        <path d={`M 330 ${SY + SH} L 540 ${SY + 18} L 750 ${SY + SH}`} fill="none" stroke="#C59A60" strokeWidth={4} strokeLinejoin="round" />
        <Bubble cx={800} cy={SY + 110} text="…" max={4} fs={60} k={sp(1.0)} tail={[640, SY + 150]} kind="thought" frame={frame} size={[170, 110]} />
      </Panel>
    );
    sfx = (
      <>
        <Sfx frame={f(b[0])} name="clash" volume={0.3} />
        <Sfx frame={f(bubbleAt)} name="glitch" volume={0.25} />
      </>
    );
  } else if (stage === "ask") {
    /* Nahaufnahme: Nephi fragt – Strahlen hinter ihm */
    const raise = interpolate(t, [b[0] - 0.1, b[0] + 0.8], [0, 1], { ...clamp, easing: ease });
    const burst = fade(t, bubbleAt - 0.15, 0.3);
    main = (
      <g>
        <rect x={MX} y={MY} width={MW} height={MH} fill="#24305E" />
        <Burst cx={770} cy={900} n={40} r1={40} r2={1300} color="#3B4C8C" o={1} spin={frame / 300} />
        <Burst cx={770} cy={900} n={40} r1={40} r2={1300} color={YELLOW} o={burst * 0.35} spin={frame / 300 + 0.05} />
        <rect x={MX} y={MY} width={MW} height={MH} fill={`url(#${uid}-dots)`} opacity={0.3} />
        <g transform={`translate(${-10 * (1 - mainK)} 0)`}>
          <Fig x={790} y={1640} k={2.5} dir={-1} j={blend(STAND, ASK, raise)} c={tone(NEPHI, 0.12)} rim="#FFE9A8" rimO={0.9} rimDx={-7} face={{ brow: "calm" }} shadow={false} />
        </g>
        <Bubble cx={380} cy={470} text={s.bubble?.text ?? ""} max={11} fs={78} k={bubbleK} tail={[560, 640]} frame={frame} />
      </g>
    );
    const freeze = sp(bubbleAt + 0.9);
    const w2 = 472;
    strip = (
      <g>
        {[0, 1].map((i) => (
          <Panel key={i} id={`${uid}-s${i}`} x={MX + i * (w2 + 28)} y={SY} w={w2} h={SH} k={sp(bubbleAt + 0.9 + i * 0.12)} tilt={i ? 1.5 : -1.5}>
            <rect x={MX + i * (w2 + 28)} y={SY} width={w2} height={SH} fill={i ? "#5A3A22" : "#4A2C24"} />
            <rect x={MX + i * (w2 + 28)} y={SY} width={w2} height={SH} fill={`url(#${uid}-dots)`} opacity={0.35} />
            <Fig
              x={MX + i * (w2 + 28) + w2 / 2 - 20}
              y={SY + 700}
              k={1.9}
              j={pose({ elbowF: [40, -250], handF: [50, -310], head: [10, -286] }, ARGUE)}
              c={tone(i ? LEMUEL : LAMAN, 0.2, "#3A2418")}
              rim="#FFC870"
              rimO={0.6}
              shadow={false}
              face={{ brow: "sad" }}
            />
            <text x={MX + i * (w2 + 28) + w2 - 70} y={SY + 110} textAnchor="middle" fontFamily="Bangers" fontSize={86} fill={PAPER} stroke={INK} strokeWidth={7} paintOrder="stroke" opacity={Math.min(1, freeze * 1.4)}>
              !?
            </text>
          </Panel>
        ))}
      </g>
    );
    sfx = <Sfx frame={f(bubbleAt)} name="thud" volume={0.45} keep />;
  } else if (stage === "reply") {
    /* Die Brüder wenden sich ab, Arme verschränkt */
    const turn = interpolate(t, [-0.2, 0.5], [0, 1], { ...clamp, easing: ease });
    main = (
      <g transform={zoom(540, 800, 1.02, 1.07)}>
        <TentInside uid={uid} frame={frame} cold={0.5} />
        <Fig x={400} y={1120} k={1.36} dir={-1} j={blend(ARGUE, CROSS, turn)} c={tone(LAMAN, 0.25, "#2A2238")} rim="#FFC870" rimO={0.6} face={{ brow: "angry" }} />
        <Fig x={640} y={1120} k={1.3} dir={-1} j={blend(ARGUE, CROSS, turn)} c={tone(LEMUEL, 0.25, "#2A2238")} rim="#FFC870" rimO={0.6} face={{ brow: "angry" }} />
        <Bubble cx={600} cy={480} text={s.bubble?.text ?? ""} max={16} fs={62} k={bubbleK} tail={[470, 690]} frame={frame} />
      </g>
    );
    const nk = sp(bubbleAt + 1.2);
    strip = (
      <Panel id={`${uid}-s1`} x={MX} y={SY} w={MW} h={SH} k={nk} tilt={-1.2}>
        <rect x={MX} y={SY} width={MW} height={SH} fill="#2A3358" />
        <rect x={MX} y={SY} width={MW} height={SH} fill={`url(#${uid}-dots)`} opacity={0.4} />
        <Fig x={680} y={SY + 590} k={1.7} dir={-1} j={HEART} c={tone(NEPHI, 0.2)} rim="#9FC4FF" rimO={0.7} rimDx={-6} shadow={false} face={{ brow: "sad", tilt: 8 }} />
        <Bubble cx={330} cy={SY + 120} text="…" max={4} fs={60} k={sp(bubbleAt + 1.5)} tail={[560, SY + 130]} kind="thought" frame={frame} size={[180, 116]} />
      </Panel>
    );
    sfx = <Sfx frame={f(bubbleAt)} name="thud" volume={0.3} />;
  } else if (stage === "answer") {
    /* Nephi zeigt zum Himmel: Gottes Versprechen. Unten drei Bilder: Herz, Hände, Gebote */
    const up = interpolate(t, [b[0] - 0.1, b[0] + 0.9], [0, 1], { ...clamp, easing: ease });
    const reveal = b[1];
    const burst = fade(t, reveal - 0.1, 0.6);
    main = (
      <g transform={zoom(470, 700, 1.0, 1.06)}>
        <Sky uid={uid} x={MX} y={MY} w={MW} h={MH} frame={frame} seed="an" n={70} />
        <Burst cx={470} cy={MY - 40} n={30} r1={40} r2={1300} color="#FFE7A0" o={burst * 0.35} spin={frame / 400} />
        <path d={`M 330 ${MY} L 610 ${MY} L 720 1110 L 220 1110 Z`} fill={`url(#${uid}-beam)`} opacity={0.25 + 0.6 * burst} />
        <Ridge x={MX} w={MW} y={1000} amp={22} seed={4.1} fill="#1F1C3A" bottom={MY + MH} />
        <Tent x={880} y={1040} s={0.7} lit={0.8} />
        <Fig x={470} y={1110} k={1.55} j={blend(STAND, UP, up)} c={tone(NEPHI, 0.35 * (1 - burst))} rim={burst > 0.2 ? "#FFF4C2" : "#9FC4FF"} rimO={0.9} face={{ brow: "calm", tilt: -10 * up }} />
        {/* Die Brüder hören zu, klein am Rand */}
        <Fig x={760} y={1130} k={1.0} dir={-1} j={CROSS} c={tone(LAMAN, 0.55)} rim="#9FC4FF" rimO={0.5} />
        <Fig x={860} y={1136} k={0.96} dir={-1} j={CROSS} c={tone(LEMUEL, 0.55)} rim="#9FC4FF" rimO={0.5} />
        {burst > 0
          ? Array.from({ length: 18 }, (_, i) => {
              const q = ((t - reveal) * 0.6 + random(`ans${i}`)) % 1;
              return <circle key={i} cx={260 + random(`anx${i}`) * 420} cy={MY + 40 + q * 700} r={4 + 4 * random(`anr${i}`)} fill="#FFF4C2" opacity={burst * (1 - q)} />;
            })
          : null}
      </g>
    );
    const w3 = 306;
    strip = (
      <g>
        {s.items.map((it, i) => {
          const at = beat(ts, it.at, 2 + i);
          return (
            <StripPanel key={i} id={`${uid}-s${i}`} x={MX + i * (w3 + 27)} w={w3} k={sp(at - 0.1)} label={it.text} bg={["#4A2E48", "#2E3F5C", "#3E3A2E"][i]} glow={burst}>
              <Icon kind={it.icon} x={MX + i * (w3 + 27) + w3 / 2} y={SY + 128} s={0.95} frame={frame} lit={burst * 0.8} />
            </StripPanel>
          );
        })}
      </g>
    );
    sfx = (
      <>
        {s.items.map((it, i) => (
          <Sfx key={i} frame={f(beat(ts, it.at, 2 + i))} name="pop" volume={0.3} />
        ))}
        <Sfx frame={f(reveal)} name="warm" volume={0.4} keep />
      </>
    );
  } else {
    /* peace: Am Feuer erklärt Nephi den Ölbaum; die Brüder werden ruhig */
    const vision = sp(b[0] + 0.3);
    const calm = interpolate(t, [b[1] - 0.1, b[1] + 1.0], [0, 1], { ...clamp, easing: ease });
    const graft = interpolate(t, [b[0] + 0.8, b[0] + 1.8], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
    const lit = 0.28;
    main = (
      <g transform={zoom(560, 860, 1.0, 1.06)}>
        <Sky uid={uid} x={MX} y={MY} w={MW} h={MH} frame={frame} seed="pc" n={60} warm={0.6} />
        <Ridge x={MX} w={MW} y={860} amp={30} seed={5.2} fill="#241E40" bottom={MY + MH} />
        <rect x={MX} y={1010} width={MW} height={MY + MH - 1010} fill="#4A3426" />
        <path d={`M ${MX} 1010 L ${MX + MW} 1010`} stroke={INK} strokeWidth={6} />
        <rect x={MX} y={1010} width={MW} height={MY + MH - 1010} fill={`url(#${uid}-dots)`} opacity={0.4} />
        <Fire x={560} y={1090} s={0.8} frame={frame} uid={uid} glow={1 + 0.3 * calm} />
        <Fig x={330} y={1100} k={1.2} j={SIT_TALK} c={tone(NEPHI, lit)} rim="#FFB15A" rimO={0.85} face={{ brow: "calm", shout: 0.25 * Math.abs(Math.sin(frame / 3)) * (t < b[1] ? 1 : 0) }} />
        <Fig x={760} y={1104} k={1.18} dir={-1} j={blend(SIT_LAP, SIT_BOW, calm)} c={tone(LAMAN, lit)} rim="#FFB15A" rimO={0.85} face={{ brow: calm > 0.5 ? "calm" : undefined }} />
        <Fig x={890} y={1108} k={1.14} dir={-1} j={blend(SIT_LAP, SIT_BOW, calm)} c={tone(LEMUEL, lit)} rim="#FFB15A" rimO={0.85} face={{ brow: calm > 0.5 ? "calm" : undefined }} />
        <Bubble cx={560} cy={520} text="" max={4} fs={10} k={vision} tail={[390, 740]} kind="thought" frame={frame} color="#E9F0FF" size={[400, 330]} />
        {vision > 0.01 ? (
          <g opacity={Math.min(1, vision * 1.6)} transform={`translate(560 520) scale(${0.55 + 0.45 * vision}) translate(-560 -520)`}>
            <OliveTree x={560} y={640} s={0.95} scatter={1} graft={graft} frame={frame} uid={uid} />
          </g>
        ) : null}
      </g>
    );
    const nk = sp(b[1] - 0.4);
    strip = (
      <Panel id={`${uid}-s1`} x={MX} y={SY} w={MW} h={SH} k={nk} tilt={1.2}>
        <Sky uid={uid} x={MX} y={SY} w={MW} h={SH} frame={frame} seed="pcs" n={40} />
        <Ridge x={MX} w={MW} y={SY + 230} amp={16} seed={0.8} fill="#1C1A34" bottom={SY + SH} />
        <Tent x={420} y={SY + 260} s={0.42} lit={0.9} />
        <Tent x={640} y={SY + 264} s={0.36} lit={0.6} />
        <Fire x={530} y={SY + 290} s={0.3} frame={frame} uid={uid} />
      </Panel>
    );
    sfx = (
      <>
        <Sfx frame={f(b[0] + 0.3)} name="chime" volume={0.3} />
        <Sfx frame={f(b[1])} name="warm" volume={0.4} keep />
      </>
    );
  }

  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        {defs}
        <Panel id={`${uid}-main`} x={MX} y={MY} w={MW} h={MH} k={mainK} tilt={stage === "ask" ? -1.2 : stage === "hook" ? 1 : 0}>
          {main}
          <CaptionBox x={MX + 30} y={MY + 30} text={s.caption ?? ""} k={s.caption ? sp(-0.2) : 0} />
        </Panel>
        {strip}
      </svg>
      {sfx}
    </AbsoluteFill>
  );
};

/** Innen im Zelt: Stoffbahnen, Mittelstange, eine Öllampe */
const TentInside: React.FC<{ uid: string; frame: number; cold?: number }> = ({ uid, frame, cold = 0 }) => {
  const fl = 0.88 + 0.08 * Math.sin(frame / 3) + 0.04 * Math.sin(frame / 5.3);
  const cloth = mix("#9A6E40", "#3A3458", cold);
  const cloth2 = mix("#7A5430", "#2C2846", cold);
  return (
    <g>
      <rect x={MX} y={MY} width={MW} height={MH} fill={cloth} />
      {/* Stoffbahnen */}
      {Array.from({ length: 7 }, (_, i) => {
        const x = MX + i * 150 - 20;
        return <path key={i} d={`M ${x} ${MY} C ${x + 40} ${MY + 300}, ${x - 20} ${MY + 600}, ${x + 30} ${MY + MH}`} stroke={cloth2} strokeWidth={46} fill="none" opacity={0.7} />;
      })}
      {Array.from({ length: 7 }, (_, i) => {
        const x = MX + i * 150 - 20;
        return <path key={`l${i}`} d={`M ${x + 24} ${MY} C ${x + 64} ${MY + 300}, ${x + 4} ${MY + 600}, ${x + 54} ${MY + MH}`} stroke={INK} strokeWidth={3} fill="none" opacity={0.35} />;
      })}
      <rect x={MX} y={MY} width={MW} height={MH} fill={`url(#${uid}-dots)`} opacity={0.35} />
      {/* Boden */}
      <rect x={MX} y={1060} width={MW} height={MY + MH - 1060} fill={mix("#4A3020", "#24203A", cold)} />
      <path d={`M ${MX} 1060 L ${MX + MW} 1060`} stroke={INK} strokeWidth={6} />
      {/* Mittelstange */}
      <rect x={530} y={MY} width={20} height={1060 - MY} fill="#4A3020" stroke={INK} strokeWidth={5} />
      {/* Lampe */}
      <circle cx={540} cy={330} r={300} fill={`url(#${uid}-lamp)`} opacity={fl * (1 - cold * 0.6)} />
      <line x1={540} y1={MY} x2={540} y2={300} stroke={INK} strokeWidth={4} />
      <path d="M 510 330 Q 540 300 570 330 Q 540 350 510 330 Z" fill="#B9814A" stroke={INK} strokeWidth={5} />
      <path d={`M 566 326 C ${574 + Math.sin(frame / 2.5) * 3} 312, 574 302, 568 294 C 562 302, 560 312, 566 326 Z`} fill="#FFD27A" />
    </g>
  );
};

/** Die Worte in den Sprechblasen stehen gross im Bild – sie werden nicht noch einmal untertitelt. */
export const hidden = (ts: TimelineScene): Set<number> => {
  const s = ts.scene as ComicSceneT;
  return wordsOfTexts(ts, [s.bubble?.text]);
};
