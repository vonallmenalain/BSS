import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, random, useCurrentFrame } from "remotion";
import { useLook } from "../../looks";
import { Sfx, beat, beats, voiceFrame } from "../../lib/sfx";
import { FPS, type TimelineScene } from "../../lib/timing";
import type { Scene as SceneData } from "../../schema";

/*
 * Enos im Wald (Enos 1:1–8): ein junger Jäger mit Bogen geht allein in den Wald. Da kommen ihm
 * die Worte seines Vaters in den Sinn – eine Erinnerung wie eine Blase: Jakob am Abend zu Hause,
 * der Junge hört zu. Die Worte sinken ihm ins Herz, er kniet nieder und betet, den ganzen Tag
 * und bis in die Nacht. Dann ein Licht von oben, und die dunkle Last auf seinem Rücken zerstiebt.
 * Gott wird nicht gezeigt – nur das Licht.
 *
 * Die Tageszeit kommt aus `ForestBg` (über die ganze Folge); die Szene tönt Enos dazu passend
 * nach ihrem Himmelswert (`sky`).
 */

type EnosSceneT = Extract<SceneData, { type: "enos" }>;
type P = [number, number];

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = Easing.inOut(Easing.sin);
const fade = (t: number, at: number, d = 0.4) => interpolate(t, [at, at + d], [0, 1], clamp);

const GROUND = 1110;
const K = 1.32;
const NIGHT = "#0A1016";

const hex = (s: string) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
const mix = (a: string, b: string, k: number) => {
  const pa = hex(a);
  const pb = hex(b);
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * Math.max(0, Math.min(1, k)))).join(",")})`;
};
const lerp = (a: P, b: P, k: number): P => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];

/* ------------------------------------------------------------------ */
/* Enos – Gelenke für Stehen, Gehen und Knien                          */
/* ------------------------------------------------------------------ */

type Joints = { hip: P; kneeF: P; footF: P; kneeB: P; footB: P; shoulder: P; elbow: P; hand: P; elbow2: P; hand2: P; head: P };

const STAND: Joints = {
  hip: [0, -150],
  kneeF: [8, -78],
  footF: [12, 0],
  kneeB: [-6, -78],
  footB: [-10, 0],
  shoulder: [2, -282],
  elbow: [16, -222],
  hand: [30, -170],
  elbow2: [-8, -222],
  hand2: [-12, -166],
  head: [10, -318],
};
const KNEEL: Joints = {
  hip: [-8, -98],
  kneeF: [30, -16],
  footF: [-56, -8],
  kneeB: [18, -14],
  footB: [-66, -6],
  shoulder: [2, -236],
  elbow: [34, -190],
  hand: [40, -214],
  elbow2: [26, -186],
  hand2: [38, -210],
  head: [20, -268],
};

const poseOf = (kneel: number, ph: number, walk: number, look: number): Joints => {
  const j = {} as Joints;
  (Object.keys(STAND) as Array<keyof Joints>).forEach((key) => {
    j[key] = lerp(STAND[key], KNEEL[key], kneel);
  });
  if (walk > 0) {
    const sw = Math.sin(ph) * walk;
    j.footF = [j.footF[0] + 30 * sw, j.footF[1] - Math.max(0, Math.cos(ph)) * 10 * walk];
    j.footB = [j.footB[0] - 30 * sw, j.footB[1] - Math.max(0, -Math.cos(ph)) * 10 * walk];
    j.kneeF = [j.kneeF[0] + 18 * sw + 6 * walk, j.kneeF[1]];
    j.kneeB = [j.kneeB[0] - 18 * sw + 6 * walk, j.kneeB[1]];
    j.hand = [j.hand[0] - 22 * sw, j.hand[1]];
    j.hand2 = [j.hand2[0] + 22 * sw, j.hand2[1]];
    j.elbow = [j.elbow[0] - 10 * sw, j.elbow[1]];
    j.elbow2 = [j.elbow2[0] + 10 * sw, j.elbow2[1]];
  }
  // Kopf heben (zum Licht)
  j.head = [j.head[0] - 6 * look, j.head[1] - 14 * look];
  return j;
};

type Colors = { tunic: string; legs: string; skin: string; hair: string; belt: string };

const Body: React.FC<{ j: Joints; c: Colors; bow: boolean }> = ({ j, c, bow }) => {
  const limb = (pts: P[], color: string, w: number) => (
    <path d={`M ${pts.map((q) => q.join(" ")).join(" L ")}`} stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" fill="none" />
  );
  const [sx, sy] = j.shoulder;
  const [hx, hy] = j.hip;
  return (
    <g>
      {/* Bogen und Köcher auf dem Rücken */}
      {bow ? (
        <g>
          <path d={`M ${sx - 30} ${sy - 30} Q ${sx - 70} ${(sy + hy) / 2} ${hx - 26} ${hy + 30}`} stroke="#5A3A1E" strokeWidth={7} fill="none" strokeLinecap="round" />
          <line x1={sx - 30} y1={sy - 30} x2={hx - 26} y2={hy + 30} stroke="#D9C9A8" strokeWidth={1.5} opacity={0.7} />
          <rect x={sx - 34} y={sy - 6} width={20} height={70} rx={6} fill="#4A3020" transform={`rotate(-14 ${sx - 24} ${sy})`} />
          {[0, 1, 2].map((i) => (
            <line key={i} x1={sx - 30 + i * 5} y1={sy - 4} x2={sx - 38 + i * 5} y2={sy - 34} stroke="#C9B48A" strokeWidth={3} transform={`rotate(-14 ${sx - 24} ${sy})`} />
          ))}
        </g>
      ) : null}
      {/* Hinteres Bein und hinterer Arm */}
      {limb([j.hip, j.kneeB, j.footB], c.legs, 22)}
      {limb([[sx - 6, sy + 8], j.elbow2, j.hand2], mix(c.tunic, "#000000", 0.25), 17)}
      {/* Vorderes Bein */}
      {limb([j.hip, j.kneeF, j.footF], c.legs, 23)}
      <ellipse cx={j.footF[0] + 8} cy={j.footF[1] - 4} rx={14} ry={6} fill={c.legs} />
      <ellipse cx={j.footB[0] + 8} cy={j.footB[1] - 4} rx={14} ry={6} fill={c.legs} />
      {/* Tunika */}
      <path d={`M ${sx - 26} ${sy + 6} Q ${sx - 32} ${(sy + hy) / 2} ${hx - 24} ${hy - 12} L ${hx - 38} ${hy + 40} Q ${hx} ${hy + 50} ${hx + 40} ${hy + 40} L ${hx + 26} ${hy - 12} Q ${sx + 32} ${(sy + hy) / 2} ${sx + 24} ${sy + 4} Q ${sx} ${sy - 12} ${sx - 26} ${sy + 6} Z`} fill={c.tunic} />
      <path d={`M ${sx - 6} ${sy - 4} L ${sx + 6} ${sy + 34} L ${sx + 16} ${sy - 2}`} stroke={c.belt} strokeWidth={4} fill="none" opacity={0.7} />
      <path d={`M ${hx - 26} ${hy - 8} L ${hx + 28} ${hy - 8}`} stroke={c.belt} strokeWidth={9} strokeLinecap="round" />
      {/* Kopf */}
      <rect x={j.head[0] - 9} y={j.head[1] + 18} width={18} height={18} fill={c.skin} />
      <circle cx={j.head[0]} cy={j.head[1]} r={27} fill={c.skin} />
      <path d={`M ${j.head[0] + 24} ${j.head[1] - 4} L ${j.head[0] + 33} ${j.head[1] + 7} L ${j.head[0] + 24} ${j.head[1] + 11} Z`} fill={c.skin} />
      <path d={`M ${j.head[0] - 28} ${j.head[1] + 4} C ${j.head[0] - 32} ${j.head[1] - 34}, ${j.head[0] + 24} ${j.head[1] - 40}, ${j.head[0] + 26} ${j.head[1] - 10} C ${j.head[0] + 12} ${j.head[1] - 20}, ${j.head[0] - 6} ${j.head[1] - 16}, ${j.head[0] - 12} ${j.head[1] + 8} Z`} fill={c.hair} />
      {/* Vorderer Arm */}
      {limb([[sx + 4, sy + 8], j.elbow, j.hand], c.belt, 22)}
      {limb([[sx + 4, sy + 8], j.elbow, j.hand], c.tunic, 15)}
      <circle cx={j.hand[0] + 2} cy={j.hand[1] + 4} r={10} fill={c.skin} />
    </g>
  );
};

const Enos: React.FC<{ x: number; j: Joints; c: Colors; rim: string; rimO: number; dir?: 1 | -1; bow: boolean; glow?: number; burden?: number; heart?: number; hunger?: number; frame: number; o?: number }> = ({
  x,
  j,
  c,
  rim,
  rimO,
  dir = 1,
  bow,
  glow = 0,
  burden = 0,
  heart = 0,
  hunger = 0,
  frame,
  o = 1,
}) => {
  const rimC: Colors = { tunic: rim, legs: rim, skin: rim, hair: rim, belt: rim };
  const chest: P = [j.shoulder[0] + 6, j.shoulder[1] + 50];
  return (
    <g transform={`translate(${x} ${GROUND}) scale(${dir * K} ${K})`} opacity={o}>
      <ellipse cx={0} cy={2} rx={80} ry={9} fill="#000" opacity={0.35} />
      {glow > 0 ? <ellipse cx={0} cy={-160} rx={150} ry={230} fill="url(#enGold)" opacity={glow} /> : null}
      {rimO > 0 ? (
        <g transform="translate(4 -2)" opacity={rimO}>
          <Body j={j} c={rimC} bow={bow} />
        </g>
      ) : null}
      <Body j={j} c={c} bow={bow} />
      {/* Die Last auf dem Rücken */}
      {burden > 0.01 ? (
        <g opacity={burden} transform={`translate(${j.shoulder[0] - 44} ${j.shoulder[1] + 44})`}>
          {/* Eine schwere Last, auf den Rücken geschnürt */}
          <path d="M -10 -58 L 22 -54" stroke="#2A1E14" strokeWidth={5} />
          <path d="M -34 -40 C -46 -10, -42 34, -10 44 C 18 50, 34 26, 30 -6 C 28 -36, 12 -58, -10 -58 C -22 -58, -30 -50, -34 -40 Z" fill="#1A1222" stroke="#3A2C48" strokeWidth={3} />
          <path d="M -24 -30 C -28 -10, -26 10, -16 22" stroke="#4A3A5A" strokeWidth={3} fill="none" opacity={0.7} />
          <path d="M 8 -50 C 30 -30, 30 10, 22 30" stroke="#2A1E14" strokeWidth={5} fill="none" />
        </g>
      ) : null}
      {heart > 0 || hunger > 0 ? (
        <g transform={`translate(${chest[0]} ${chest[1]})`}>
          <circle r={50 * (heart + hunger * (0.6 + 0.4 * Math.sin(frame / 5)))} fill="url(#enHeart)" opacity={Math.min(1, heart + hunger)} />
          {hunger > 0 ? <circle r={16 + 6 * Math.sin(frame / 5)} fill="none" stroke="#FFE3A8" strokeWidth={3} opacity={hunger * 0.8} /> : null}
        </g>
      ) : null}
    </g>
  );
};

/* ------------------------------------------------------------------ */
/* Erinnerung: Jakob spricht zu Hause, der Junge hört zu               */
/* ------------------------------------------------------------------ */

const Memory: React.FC<{ k: number; talk: number; frame: number }> = ({ k, talk, frame }) => {
  if (k <= 0.01) return null;
  const cx = 750;
  const cy = 480;
  const r = 205;
  const lampFl = 0.85 + 0.1 * Math.sin(frame / 3);
  return (
    <g transform={`translate(${cx} ${cy}) scale(${0.6 + 0.4 * k}) translate(${-cx} ${-cy})`} opacity={Math.min(1, k * 1.3)}>
      <circle cx={cx} cy={cy} r={r + 10} fill="#FFE9C4" opacity={0.25} />
      <clipPath id="enMem">
        <circle cx={cx} cy={cy} r={r} />
      </clipPath>
      <g clipPath="url(#enMem)">
        <rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} fill="#5A3A22" />
        <circle cx={cx + 40} cy={cy - 30} r={200} fill="url(#enLamp)" opacity={lampFl} />
        <rect x={cx - r} y={cy + 110} width={r * 2} height={140} fill="#3A2414" />
        {/* Lampe */}
        <ellipse cx={cx + 40} cy={cy + 96} rx={26} ry={10} fill="#B9814A" />
        <path d={`M ${cx + 56} ${cy + 86} C ${cx + 64} ${cy + 74}, ${cx + 64} ${cy + 62}, ${cx + 58} ${cy + 54} C ${cx + 52} ${cy + 62}, ${cx + 50} ${cy + 74}, ${cx + 56} ${cy + 86} Z`} fill="#FFD27A" />
        {/* Jakob, sitzend, Blick nach links */}
        <g transform={`translate(${cx + 130} ${cy + 116})`}>
          <path d="M 40 0 C 44 -70, 30 -130, 0 -150 C -26 -150, -40 -110, -36 -60 L -70 -50 L -74 0 Z" fill="#2A1A10" />
          <circle cx={-6} cy={-174} r={28} fill="#2A1A10" />
          <path d="M -30 -164 C -40 -140, -26 -126, -10 -130 L -6 -150 Z" fill="#2A1A10" />
          <path d={`M -20 -120 Q -60 ${-120 - 20 * talk} -86 ${-110 - 14 * talk}`} stroke="#2A1A10" strokeWidth={16} strokeLinecap="round" fill="none" />
        </g>
        {/* Der Junge, sitzend, Blick nach rechts */}
        <g transform={`translate(${cx - 120} ${cy + 116})`}>
          <path d="M -30 0 C -32 -50, -20 -96, 4 -104 C 26 -104, 34 -70, 30 -40 L 56 -34 L 58 0 Z" fill="#2A1A10" />
          <circle cx={8} cy={-124} r={22} fill="#2A1A10" />
        </g>
        {/* Er sagt es oft: Wellen von Worten */}
        {[0, 1, 2].map((i) => {
          const w = (frame / 26 + i / 3) % 1;
          return <path key={i} d={`M ${cx + 30 - w * 110} ${cy - 30 - i * 4} q -14 -16 0 -32`} stroke="#FFE9C4" strokeWidth={5} fill="none" strokeLinecap="round" opacity={talk * (1 - w) * 0.9} transform={`translate(0 ${-i * 22})`} />;
        })}
      </g>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#FFE9C4" strokeWidth={6} opacity={0.8} />
      <text x={cx} y={cy - r - 22} textAnchor="middle" fontFamily="Cormorant Garamond" fontStyle="italic" fontWeight={600} fontSize={44} fill="#FFF4E0" stroke="#0A1016" strokeWidth={6} paintOrder="stroke">
        zu Hause, bei seinem Vater
      </text>
    </g>
  );
};

/** Leuchtende Schrift, die herüberschwebt */
const FloatWord: React.FC<{ text: string; from: P; to: P; k: number; sink: number; heart: P; frame: number; i: number }> = ({ text, from, to, k, sink, heart, frame, i }) => {
  if (k <= 0.01) return null;
  const pos = lerp(lerp(from, to, Math.min(1, k)), heart, sink);
  const bob = Math.sin(frame / 16 + i * 2) * 8 * (1 - sink);
  return (
    <text
      x={pos[0]}
      y={pos[1] + bob}
      textAnchor="middle"
      fontFamily="Cormorant Garamond"
      fontStyle="italic"
      fontWeight={600}
      fontSize={68 * (1 - 0.8 * sink)}
      fill="#FFF1C8"
      opacity={Math.min(1, k * 1.5) * (1 - sink * 0.9)}
      style={{ filter: "drop-shadow(0 0 14px rgba(255,214,140,0.9))" }}
    >
      {text}
    </text>
  );
};

/** Der Bogen des Tages oben: Sonne oder Mond wandern mit */
const SkyArc: React.FC<{ k: number; moon: boolean; o: number }> = ({ k, moon, o }) => {
  if (o <= 0.01) return null;
  const pt = (q: number): P => {
    const a = Math.PI * (1 - q);
    return [540 + Math.cos(a) * 360, 470 - Math.sin(a) * 150];
  };
  const [x, y] = pt(k);
  return (
    <g opacity={o}>
      <path d={`M 180 470 A 360 150 0 0 1 900 470`} fill="none" stroke="#FFF4E0" strokeWidth={3} strokeDasharray="4 12" opacity={0.6} />
      {moon ? (
        <path transform={`translate(${x} ${y})`} d="M 6 -34 A 34 34 0 1 0 30 18 A 28 28 0 1 1 6 -34 Z" fill="#EEF2FF" />
      ) : (
        <g transform={`translate(${x} ${y})`}>
          {Array.from({ length: 8 }, (_, i) => (
            <line key={i} x1={0} y1={-44} x2={0} y2={-58} stroke="#FFE08A" strokeWidth={5} strokeLinecap="round" transform={`rotate(${i * 45})`} />
          ))}
          <circle r={32} fill="#FFE08A" />
        </g>
      )}
    </g>
  );
};

/** Stammbaum: Lehi – Nephi und Jakob – Enos */
const Lineage: React.FC<{ k: number; t: number; enosAt: number; brotherAt: number; look: { text: string; accent: string } }> = ({ k, t, enosAt, brotherAt, look }) => {
  if (k <= 0.01) return null;
  const node = (x: number, y: number, name: string, on: number, hot = false) => (
    <g transform={`translate(${x} ${y}) scale(${0.8 + 0.2 * on})`} opacity={Math.min(1, on * 1.4)}>
      <rect x={-130} y={-44} width={260} height={88} rx={20} fill={hot ? "rgba(14,30,18,0.92)" : "rgba(10,16,22,0.8)"} stroke={hot ? look.accent : "rgba(244,255,240,0.55)"} strokeWidth={hot ? 5 : 3} />
      <text y={16} textAnchor="middle" fontFamily="Cinzel" fontWeight={700} fontSize={46} fill={hot ? look.accent : look.text}>
        {name}
      </text>
    </g>
  );
  const enosOn = fade(t, enosAt - 0.2, 0.4);
  const bro = fade(t, brotherAt - 0.2, 0.4);
  return (
    <g opacity={k}>
      {node(540, 330, "Lehi", 1)}
      <path d="M 540 374 L 540 410 L 330 410 L 330 446 M 540 410 L 750 410 L 750 446" stroke="rgba(244,255,240,0.6)" strokeWidth={4} fill="none" />
      {node(330, 490, "Nephi", 1)}
      {node(750, 490, "Jakob", 1)}
      <text x={540} y={505} textAnchor="middle" fontFamily="Cormorant Garamond" fontStyle="italic" fontWeight={600} fontSize={42} fill={look.text} opacity={bro} stroke="#0A1016" strokeWidth={6} paintOrder="stroke">
        Brüder
      </text>
      <path d="M 750 534 L 750 590" stroke="rgba(244,255,240,0.6)" strokeWidth={4} opacity={enosOn} />
      {node(750, 636, "Enos", enosOn, true)}
    </g>
  );
};

/* ------------------------------------------------------------------ */
/* Szene                                                               */
/* ------------------------------------------------------------------ */

export const Scene: React.FC<{ ts: TimelineScene }> = ({ ts }) => {
  const s = ts.scene as EnosSceneT;
  const frame = useCurrentFrame();
  const look = useLook();
  const t = (frame - ts.audioOffsetFrames) / FPS;
  const b = beats(ts, s.cues, Math.max(4, s.cues.length));
  const f = (sec: number) => voiceFrame(ts, sec);
  const stage = s.stage;
  const end = ts.speechEndSec;

  /* Licht auf Enos */
  const base = Math.max(0.08, Math.min(1, s.sky / 0.55));
  const light = stage === "pray" ? base - interpolate(t, [b[3] - 0.2, end + 0.6], [0, 0.35], clamp) : base;
  const shadeK = 0.35 + 0.55 * (1 - light);
  const c: Colors = {
    tunic: mix("#7A5232", NIGHT, shadeK),
    legs: mix("#4A3424", NIGHT, shadeK),
    skin: mix("#A4724E", NIGHT, shadeK),
    hair: mix("#2A1C12", NIGHT, shadeK * 0.8),
    belt: mix("#3A2414", NIGHT, shadeK),
  };
  const night = light < 0.3;
  const rim = night ? "#9FB4E8" : "#FFD9A0";
  let rimO = night ? 0.55 : 0.85;

  /* Gehen, Stehen, Knien */
  let x = 560;
  let walk = 0;
  let dir: 1 | -1 = 1;
  let kneel = 0;
  let lookUp = 0;
  let glow = 0;
  let burden = 0;
  let heart = 0;
  let hunger = 0;
  let bowOnBack = true;
  const ph = frame * 0.2;
  const hook = s.hook;
  if (stage === "hunt") {
    if (hook) {
      const turnAt = b[1];
      const go = interpolate(t, [-0.3, turnAt + 0.1], [0, 1], { ...clamp, easing: Easing.out(Easing.quad) });
      const back = interpolate(t, [turnAt + 0.2, end + 1.0], [0, 1], clamp);
      x = 140 + 420 * go - 160 * back;
      walk = t < turnAt ? 1 : t < turnAt + 0.25 ? 0 : 1;
      dir = t >= turnAt + 0.1 ? -1 : 1;
      glow = 0.75 * fade(t, turnAt, 0.5);
      rimO = t >= turnAt ? 1 : rimO;
    } else {
      const go = interpolate(t, [b[1] - 0.4, end + 0.6], [0, 1], { ...clamp, easing: Easing.out(Easing.quad) });
      x = -120 + 640 * go;
      walk = go > 0 && go < 0.98 ? 1 : 0;
    }
  } else if (stage === "words") {
    x = 300;
  } else if (stage === "pray") {
    x = 360;
    kneel = interpolate(t, [b[2] - 0.1, b[2] + 0.8], [0, 1], { ...clamp, easing: ease });
    heart = fade(t, b[0] + 0.4, 0.8) * 0.7;
    hunger = fade(t, b[1] - 0.1, 0.4) * (1 - 0.5 * kneel);
    burden = fade(t, b[1] + 0.3, 0.8) * 0.8;
    bowOnBack = kneel < 0.5;
  } else if (stage === "night") {
    x = 360;
    kneel = 1;
    burden = 0.8;
    heart = 0.5;
    bowOnBack = false;
  } else if (stage === "voice") {
    x = 360;
    kneel = 1;
    bowOnBack = false;
    const freeAt = b[1];
    burden = 0.8 * (1 - fade(t, freeAt + 0.2, 0.9));
    lookUp = fade(t, b[0] + 0.2, 0.8);
    glow = fade(t, b[0] - 0.1, 0.8) * 0.9;
    heart = 0.5 + 0.5 * fade(t, freeAt + 0.3, 0.8);
    rimO = 0.6 + 0.4 * glow;
  }
  const j = poseOf(kneel, ph, walk, lookUp);
  const chestWorld: P = [x + (j.shoulder[0] + 6) * K, GROUND + (j.shoulder[1] + 50) * K];
  const headWorld: P = [x + j.head[0] * K, GROUND + j.head[1] * K];

  /* Erinnerung und Worte */
  const memK = stage === "words" ? fade(t, b[0] - 0.1, 0.6) : stage === "pray" ? 1 - fade(t, b[0] - 0.2, 0.6) : 0;
  const talk = stage === "words" ? fade(t, b[1] - 0.1, 0.4) : 0.6;
  const wordSink = stage === "pray" ? interpolate(t, [b[0] - 0.1, b[0] + 0.9], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) }) : 0;
  const wordsShown = stage === "words" || (stage === "pray" && wordSink < 1);
  const wordTargets: P[] = [
    [300, 520],
    [330, 610],
  ];
  const wordList = s.words.length ? s.words : [];
  const prevWords = stage === "pray" ? [{ text: "ewiges Leben" }, { text: "Freude der Heiligen" }] : [];

  /* Tagesbogen */
  const arcO = stage === "pray" ? fade(t, b[3] - 0.3, 0.4) : stage === "night" ? 1 : 0;
  const arcK = stage === "pray" ? interpolate(t, [b[3] - 0.1, end + 0.6], [0.12, 0.95], { ...clamp, easing: ease }) : stage === "night" ? interpolate(t, [b[0] - 0.3, end + 0.5], [0.1, 0.55], clamp) : 0;

  /* Licht von oben */
  const beam = stage === "voice" ? fade(t, b[0] - 0.1, 0.8) : 0;
  const sparks = useMemo(() => Array.from({ length: 26 }, (_, i) => ({ dx: (random(`sp${i}`) - 0.5) * 160, v: 120 + random(`sv${i}`) * 220, d: random(`sd${i}`) * 0.6 })), []);
  const freeAt = stage === "voice" ? b[1] : 99;

  /* Reh, das davonspringt */
  const deer = stage === "hunt" && !hook;
  const deerRun = deer ? interpolate(t, [b[1] + 0.8, b[1] + 2.0], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) }) : 0;

  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id="enGold">
            <stop offset="0%" stopColor="#FFF2C4" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#FFE08A" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#FFE08A" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="enHeart">
            <stop offset="0%" stopColor="#FFE3A8" stopOpacity="0.95" />
            <stop offset="50%" stopColor="#FFB45A" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#FFB45A" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="enLamp">
            <stop offset="0%" stopColor="#FFC870" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#FFC870" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="enBeam" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFF6D6" stopOpacity="0.75" />
            <stop offset="70%" stopColor="#FFE9A8" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#FFE9A8" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Licht von oben – ohne Gestalt */}
        {beam > 0 ? (
          <g opacity={beam}>
            <path d={`M ${x - 60} 0 L ${x + 60} 0 L ${x + 260} ${GROUND + 40} L ${x - 260} ${GROUND + 40} Z`} fill="url(#enBeam)" opacity={0.75 + 0.1 * Math.sin(frame / 9)} />
            <ellipse cx={x} cy={GROUND} rx={300} ry={40} fill="#FFE9A8" opacity={0.35} />
          </g>
        ) : null}

        {/* Reh im Hintergrund */}
        {deer ? (
          <g transform={`translate(${830 + deerRun * 420} ${1086 - Math.abs(Math.sin(deerRun * 12)) * 30 * deerRun}) scale(1.6)`} opacity={fade(t, 0, 0.5) * (1 - deerRun * 0.5)}>
            {/* Reh: Rumpf, Hals, Kopf mit Ohren, vier dünne Beine */}
            <ellipse cx={0} cy={-46} rx={44} ry={17} fill="#1A2A1E" />
            <path d={`M 30 -54 L 44 ${-86 + 20 * (1 - deerRun) * 0} L 54 -84 L 44 -50 Z`} fill="#1A2A1E" />
            <ellipse cx={56} cy={-88} rx={14} ry={8} fill="#1A2A1E" transform="rotate(20 56 -88)" />
            <path d="M 46 -94 L 42 -108 L 50 -98 Z M 52 -96 L 52 -110 L 56 -98 Z" fill="#1A2A1E" />
            {[-32, -22, 22, 32].map((lx, i) => (
              <line key={i} x1={lx} y1={-36} x2={lx + Math.sin(deerRun * 30 + i * 1.6) * 10 * deerRun} y2={0} stroke="#1A2A1E" strokeWidth={5} strokeLinecap="round" />
            ))}
            <path d="M -44 -50 L -54 -58 L -48 -44 Z" fill="#1A2A1E" />
          </g>
        ) : null}

        <Lineage k={stage === "hunt" && !hook ? 1 - fade(t, b[1] - 0.3, 0.6) : 0} t={t} enosAt={beat(ts, "Enos", 0)} brotherAt={beat(ts, "Nephis Bruder", b[0] + 1.2)} look={look} />
        <Memory k={memK} talk={talk} frame={frame} />
        {/* Gedankenblasen vom Kopf zur Erinnerung */}
        {memK > 0.05
          ? [0.25, 0.5, 0.72].map((q, i) => {
              const p = lerp(headWorld, [570, 610], q);
              return <circle key={i} cx={p[0] + 20} cy={p[1] - 30} r={8 + i * 6} fill="#FFE9C4" opacity={memK * 0.8} />;
            })
          : null}

        {/* Der Bogen liegt neben ihm, wenn er kniet */}
        {!bowOnBack ? <path d={`M ${x - 230} ${GROUND - 4} Q ${x - 150} ${GROUND - 40} ${x - 70} ${GROUND - 4}`} stroke="#4A3020" strokeWidth={8} fill="none" strokeLinecap="round" /> : null}

        <Enos x={x} j={j} c={c} rim={rim} rimO={rimO} dir={dir} bow={bowOnBack} glow={glow} burden={burden} heart={heart} hunger={hunger} frame={frame} />

        {/* Worte, die ihm einfallen */}
        {wordsShown
          ? (stage === "words" ? wordList : prevWords).map((w, i) => {
              const at = "at" in w ? beat(ts, (w as { at: string }).at, 2 + i) : -1;
              const k = stage === "words" ? interpolate(t, [at - 0.1, at + 0.9], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) }) : 1;
              return <FloatWord key={w.text} text={w.text} from={[750, 480]} to={wordTargets[i] ?? [400, 800]} k={k} sink={wordSink} heart={chestWorld} frame={frame} i={i} />;
            })
          : null}

        {/* Die Last zerstiebt */}
        {stage === "voice"
          ? sparks.map((sp, i) => {
              const k = interpolate(t, [freeAt + 0.2 + sp.d, freeAt + 1.4 + sp.d], [0, 1], clamp);
              if (k <= 0 || k >= 1) return null;
              const sx = x - 30 * K + sp.dx * k;
              const sy = GROUND - 300 * K * (kneel ? 0.82 : 1) - sp.v * k;
              return <circle key={i} cx={sx} cy={sy} r={4 + 3 * (1 - k)} fill="#FFE9A8" opacity={1 - k} />;
            })
          : null}

        <SkyArc k={arcK} moon={stage === "night"} o={arcO} />
      </svg>

      {/* Geräusche */}
      {stage === "hunt" && hook ? (
        <>
          <Sfx frame={2} name="whoosh" volume={0.3} />
          <Sfx frame={f(b[1])} name="chime" volume={0.45} />
        </>
      ) : null}
      {stage === "hunt" && !hook ? (
        <>
          <Sfx frame={f(b[0])} name="pop" volume={0.3} />
          <Sfx frame={f(beat(ts, "Enos", 0) + 0.1)} name="ding" volume={0.3} />
          <Sfx frame={f(b[1] + 0.8)} name="whoosh" volume={0.3} />
        </>
      ) : null}
      {stage === "words" ? (
        <>
          <Sfx frame={f(b[0])} name="whoosh" volume={0.3} />
          {wordList.map((w, i) => (
            <Sfx key={i} frame={f(beat(ts, w.at, 2 + i))} name="chime" volume={0.35} />
          ))}
        </>
      ) : null}
      {stage === "pray" ? (
        <>
          <Sfx frame={f(b[0] + 0.5)} name="ding" volume={0.3} />
          <Sfx frame={f(b[2])} name="drum" volume={0.35} keep />
          <Sfx frame={f(b[3])} name="tick" volume={0.35} />
        </>
      ) : null}
      {stage === "night" ? <Sfx frame={f(b[0])} name="whoosh" volume={0.3} /> : null}
      {stage === "voice" ? (
        <>
          <Sfx frame={f(b[0])} name="chime" volume={0.45} keep />
          <Sfx frame={f(freeAt + 0.2)} name="levelup" volume={0.35} />
        </>
      ) : null}
    </AbsoluteFill>
  );
};

/** Die Worte des Vaters stehen gross im Bild; alles andere bleibt in den Untertiteln. */
export const hidden = (_ts: TimelineScene): Set<number> => new Set();
