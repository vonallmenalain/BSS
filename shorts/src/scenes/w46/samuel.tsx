import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, random, spring, useCurrentFrame } from "remotion";
import { ELI_ROOM, LAMP_FLOOR, MAT, VEIL, mixHex } from "../../components/backgrounds/w46/LampBg";
import { Sfx, beat, beats, voiceFrame } from "../../lib/sfx";
import { FPS, type TimelineScene, findCue } from "../../lib/timing";
import { useLook } from "../../looks";
import { normalize, type Scene as SceneData } from "../../schema";

/*
 * «Samuel!» (1 Samuel 3): das Heiligtum in Schilo bei Nacht, im Querschnitt. Links schläft der
 * junge Samuel auf seiner Matte, in der Mitte brennt der Leuchter – die Lampe Gottes ist noch
 * nicht erloschen –, dahinter hängt der Vorhang vor der Lade, rechts liegt Eli in seiner Kammer.
 * Ruft die Stimme, hallt der Name durch die Halle, Licht dringt unter dem Vorhang hervor, und
 * oben rechts zählt eine Tafel die Rufe. Samuel rennt zu Eli – dreimal. Beim vierten Ruf kniet
 * er und schaut zum Licht; was er sagt, bleibt versiegelt. Am Ende öffnet er im Morgenlicht die
 * Türen und wächst heran; keines seiner Worte fällt zu Boden.
 *
 * Figuren sind Silhouetten mit Streiflicht vom Leuchter, ohne Gesichter. Die Halle selbst kommt
 * aus `LampBg`.
 */

type SamuelSceneT = Extract<SceneData, { type: "samuel" }>;
type P = [number, number];

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = Easing.inOut(Easing.sin);
const fade = (t: number, at: number, d = 0.4) => interpolate(t, [at, at + d], [0, 1], clamp);
const ramp = (t: number, a: number, b: number) => interpolate(t, [a, b], [0, 1], { ...clamp, easing: ease });
const bump = (t: number, at: number, up = 0.25, hold = 0.5, down = 0.5) => interpolate(t, [at, at + up, at + up + hold, at + up + hold + down], [0, 1, 1, 0], clamp);

/** Der Leuchter steht vor dem Vorhang */
const LAMP_X = 520;
const LAMP_TOP = LAMP_FLOOR - 340;
/** Samuel: auf der Matte und an Elis Bett */
const MAT_X = 250;
const ELI_SIDE = 690;
/** Eli: Hüfte auf dem Bett */
const ELI_X = 905;
const ELI_GROUND = ELI_ROOM.bedTop - 6;
const K_S = 1.3;
const K_E = 1.25;
const NIGHT = "#06060F";

/* ------------------------------------------------------------------ */
/* Figuren von der Seite                                               */
/* ------------------------------------------------------------------ */

type Joints = { hip: P; kneeF: P; footF: P; kneeB: P; footB: P; shoulder: P; elbow: P; hand: P; elbow2: P; hand2: P; head: P };
const KEYS: Array<keyof Joints> = ["hip", "kneeF", "footF", "kneeB", "footB", "shoulder", "elbow", "hand", "elbow2", "hand2", "head"];

const STAND: Joints = {
  hip: [0, -96],
  kneeF: [5, -50],
  footF: [7, 0],
  kneeB: [-4, -50],
  footB: [-6, 0],
  shoulder: [0, -166],
  elbow: [9, -128],
  hand: [13, -94],
  elbow2: [-8, -128],
  hand2: [-11, -94],
  head: [3, -194],
};
/** Liegend, Kopf links (lokal) */
const LIE: Joints = {
  hip: [0, -18],
  kneeF: [46, -20],
  footF: [92, -16],
  kneeB: [46, -14],
  footB: [92, -12],
  shoulder: [-70, -22],
  elbow: [-44, -10],
  hand: [-16, -12],
  elbow2: [-46, -28],
  hand2: [-18, -26],
  head: [-100, -28],
};
/** Aufgesetzt, Beine nach vorn */
const SIT: Joints = {
  hip: [0, -18],
  kneeF: [44, -38],
  footF: [88, -12],
  kneeB: [42, -32],
  footB: [84, -10],
  shoulder: [-6, -88],
  elbow: [8, -56],
  hand: [32, -46],
  elbow2: [-2, -56],
  hand2: [26, -40],
  head: [-4, -118],
};
/** Kniend, aufrecht, die Hände offen nach vorn */
const KNEEL: Joints = {
  hip: [-6, -62],
  kneeF: [30, -52],
  footF: [32, 0],
  kneeB: [8, -6],
  footB: [-38, -4],
  shoulder: [0, -134],
  elbow: [18, -104],
  hand: [36, -112],
  elbow2: [12, -102],
  hand2: [30, -108],
  head: [5, -164],
};
const runPose = (ph: number): Joints => {
  const s = Math.sin(ph);
  const c = Math.cos(ph);
  return {
    hip: [0, -94 + Math.abs(c) * 4],
    kneeF: [12 + 16 * s, -54],
    footF: [30 * s - 2, -4 - 12 * Math.max(0, -c)],
    kneeB: [12 - 16 * s, -54],
    footB: [-30 * s - 2, -4 - 12 * Math.max(0, c)],
    shoulder: [12, -162],
    elbow: [12 - 18 * s, -130],
    hand: [26 - 26 * s, -108],
    elbow2: [10 + 18 * s, -130],
    hand2: [24 + 26 * s, -108],
    head: [18, -188],
  };
};

const lerp = (a: P, b: P, k: number): P => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
const mixJ = (a: Joints, b: Joints, k: number): Joints => {
  if (k <= 0) return a;
  if (k >= 1) return b;
  const out = {} as Joints;
  for (const key of KEYS) out[key] = lerp(a[key], b[key], k);
  return out;
};

type Pose = { lie?: number; sit?: number; kneel?: number; run?: number; ph?: number; reach?: number; lean?: number; bow?: number };

const poseOf = ({ lie = 0, sit = 0, kneel = 0, run = 0, ph = 0, reach = 0, lean = 0, bow = 0 }: Pose): Joints => {
  let j = STAND;
  j = mixJ(j, runPose(ph), run);
  j = mixJ(j, KNEEL, kneel);
  j = mixJ(j, SIT, sit);
  j = mixJ(j, LIE, lie);
  if (reach > 0) {
    // Arm nach vorn oben – zeigen, deuten
    j = { ...j, elbow: lerp(j.elbow, [j.shoulder[0] + 30, j.shoulder[1] - 14], reach), hand: lerp(j.hand, [j.shoulder[0] + 62, j.shoulder[1] - 46], reach) };
  }
  if (lean > 0) j = { ...j, shoulder: [j.shoulder[0] + 16 * lean, j.shoulder[1] + 6 * lean], head: [j.head[0] + 22 * lean, j.head[1] + 10 * lean] };
  if (bow > 0) j = { ...j, head: [j.head[0] + 8 * bow, j.head[1] + 6 * bow] };
  return j;
};

type Colors = { tunic: string; legs: string; skin: string; hair: string; beard?: string; blanket?: string };

const Body: React.FC<{ j: Joints; c: Colors; headR: number }> = ({ j, c, headR }) => {
  const d0: P = [j.shoulder[0] - j.hip[0], j.shoulder[1] - j.hip[1]];
  const len = Math.hypot(d0[0], d0[1]) || 1;
  const d: P = [d0[0] / len, d0[1] / len];
  const n: P = [-d[1], d[0]];
  const knee = lerp(j.kneeF, j.kneeB, 0.5);
  const e0: P = [knee[0] - j.hip[0], knee[1] - j.hip[1]];
  const elen = Math.hypot(e0[0], e0[1]) || 1;
  const en: P = [-e0[1] / elen, e0[0] / elen];
  const hem: P = [j.hip[0] + e0[0] * 0.9, j.hip[1] + e0[1] * 0.9];
  const pt = (p: P) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
  const tunic = [
    [j.shoulder[0] + n[0] * 19, j.shoulder[1] + n[1] * 19],
    [j.hip[0] + n[0] * 25, j.hip[1] + n[1] * 25],
    [hem[0] + en[0] * 30, hem[1] + en[1] * 30],
    [hem[0] - en[0] * 30, hem[1] - en[1] * 30],
    [j.hip[0] - n[0] * 25, j.hip[1] - n[1] * 25],
    [j.shoulder[0] - n[0] * 19, j.shoulder[1] - n[1] * 19],
  ] as P[];
  const beardAt: P = [j.head[0] - d[0] * headR * 0.85 + n[0] * -4, j.head[1] - d[1] * headR * 0.85 + n[1] * -4];
  return (
    <g>
      <path d={`M ${pt(j.hip)} L ${pt(j.kneeB)} L ${pt(j.footB)}`} stroke={c.legs} strokeWidth={17} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d={`M ${pt(j.shoulder)} L ${pt(j.elbow2)} L ${pt(j.hand2)}`} stroke={c.tunic} strokeWidth={15} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d={`M ${pt(j.hip)} L ${pt(j.kneeF)} L ${pt(j.footF)}`} stroke={c.legs} strokeWidth={17} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d={`M ${tunic.map(pt).join(" L ")} Z`} fill={c.tunic} stroke={c.tunic} strokeWidth={8} strokeLinejoin="round" />
      <circle cx={j.head[0]} cy={j.head[1]} r={headR} fill={c.skin} />
      <path
        d={`M ${j.head[0] - headR} ${j.head[1] + 2} A ${headR} ${headR} 0 0 1 ${j.head[0] + headR} ${j.head[1] - 2} L ${j.head[0] + headR * 0.4} ${j.head[1] - headR * 0.35} Z`}
        fill={c.hair}
      />
      {c.beard ? <ellipse cx={beardAt[0]} cy={beardAt[1]} rx={headR * 0.62} ry={headR * 0.8} fill={c.beard} transform={`rotate(${(Math.atan2(d[1], d[0]) * 180) / Math.PI + 90} ${beardAt[0]} ${beardAt[1]})`} /> : null}
      <path d={`M ${pt(j.shoulder)} L ${pt(j.elbow)} L ${pt(j.hand)}`} stroke={c.tunic} strokeWidth={15} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx={j.hand[0]} cy={j.hand[1]} r={7} fill={c.skin} />
    </g>
  );
};

/** Eine Gestalt von der Seite mit Streiflicht vom Leuchter. `dir` −1 schaut nach links. */
const Figure: React.FC<{ x: number; ground: number; k: number; dir: 1 | -1; j: Joints; c: Colors; rim: string; rimO: number; o?: number; headR?: number; blanket?: number }> = ({
  x,
  ground,
  k,
  dir,
  j,
  c,
  rim,
  rimO,
  o = 1,
  headR = 21,
  blanket = 0,
}) => {
  if (o <= 0.01) return null;
  const rimDx = x < LAMP_X ? 5 : -5;
  const rc: Colors = { tunic: rim, legs: rim, skin: rim, hair: rim, beard: c.beard ? rim : undefined };
  const pt = (p: P) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
  return (
    <g opacity={o}>
      <ellipse cx={x} cy={ground + 2} rx={70 * k} ry={8} fill="#000" opacity={0.35} />
      <g transform={`translate(${x + rimDx} ${ground - 3}) scale(${dir * k} ${k})`} opacity={rimO}>
        <Body j={j} c={rc} headR={headR} />
      </g>
      <g transform={`translate(${x} ${ground}) scale(${dir * k} ${k})`}>
        <Body j={j} c={c} headR={headR} />
        {blanket > 0.01 && c.blanket ? (
          <g opacity={blanket}>
            <path d={`M ${pt(j.hip)} L ${pt(j.kneeF)} L ${pt(j.footF)}`} stroke={c.blanket} strokeWidth={44} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <path d={`M ${pt(lerp(j.hip, j.shoulder, 0.85))} L ${pt(j.hip)}`} stroke={c.blanket} strokeWidth={50} strokeLinecap="round" fill="none" opacity={Math.max(0, 1 - Math.abs(j.shoulder[1] - j.hip[1]) / 40)} />
          </g>
        ) : null}
      </g>
    </g>
  );
};

const shadeColors = (c: Colors, light: number): Colors => ({
  tunic: mixHex(c.tunic, NIGHT, 0.5 + 0.35 * (1 - light)),
  legs: mixHex(c.legs, NIGHT, 0.55 + 0.35 * (1 - light)),
  skin: mixHex(c.skin, NIGHT, 0.5 + 0.35 * (1 - light)),
  hair: mixHex(c.hair, NIGHT, 0.5 + 0.35 * (1 - light)),
  beard: c.beard ? mixHex(c.beard, NIGHT, 0.25 + 0.35 * (1 - light)) : undefined,
  blanket: c.blanket ? mixHex(c.blanket, NIGHT, 0.45 + 0.35 * (1 - light)) : undefined,
});

const SAMUEL_C: Colors = { tunic: "#E6D6AE", legs: "#6A4A34", skin: "#9A6A4A", hair: "#2A1A12", blanket: "#7A3A2A" };
const ELI_C: Colors = { tunic: "#5A3A6E", legs: "#3A2A3E", skin: "#9A7058", hair: "#D8D4CC", beard: "#E4E0D8", blanket: "#3A4A6A" };

/* ------------------------------------------------------------------ */
/* Leuchter, Licht, Hall                                               */
/* ------------------------------------------------------------------ */

/** Der siebenarmige Leuchter – die Lampe Gottes. `boost` lässt die Flammen grösser brennen. */
const Lampstand: React.FC<{ frame: number; boost: number; calm: number }> = ({ frame, boost, calm }) => {
  const arms = [60, 104, 148];
  const flames: P[] = [[LAMP_X, LAMP_TOP], ...arms.flatMap((r) => [[LAMP_X - r, LAMP_TOP], [LAMP_X + r, LAMP_TOP]] as P[])];
  return (
    <g>
      <defs>
        <linearGradient id="smGold" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#7A5216" />
          <stop offset="45%" stopColor="#E7B24E" />
          <stop offset="100%" stopColor="#8A5E1A" />
        </linearGradient>
      </defs>
      {/* Fuss und Schaft */}
      <path d={`M ${LAMP_X - 64} ${LAMP_FLOOR} L ${LAMP_X - 30} ${LAMP_FLOOR - 40} L ${LAMP_X + 30} ${LAMP_FLOOR - 40} L ${LAMP_X + 64} ${LAMP_FLOOR} Z`} fill="url(#smGold)" />
      <rect x={LAMP_X - 9} y={LAMP_TOP + 6} width={18} height={LAMP_FLOOR - LAMP_TOP - 40} fill="url(#smGold)" />
      {[0.25, 0.5, 0.75].map((f) => (
        <ellipse key={f} cx={LAMP_X} cy={LAMP_TOP + (LAMP_FLOOR - LAMP_TOP) * f * 0.7 + 20} rx={16} ry={8} fill="#C99A3E" />
      ))}
      {/* Arme */}
      {arms.map((r) => (
        <path key={r} d={`M ${LAMP_X - r} ${LAMP_TOP + 8} C ${LAMP_X - r} ${LAMP_TOP + r * 1.25}, ${LAMP_X + r} ${LAMP_TOP + r * 1.25}, ${LAMP_X + r} ${LAMP_TOP + 8}`} stroke="url(#smGold)" strokeWidth={12} fill="none" />
      ))}
      {/* Schalen und Flammen */}
      {flames.map(([fx, fy], i) => {
        const fl = (1 + (0.12 * Math.sin(frame / 2.3 + i * 1.7) + 0.07 * Math.sin(frame / 3.9 + i)) * (1 - 0.7 * calm)) * (0.8 + 0.45 * boost);
        return (
          <g key={i}>
            <path d={`M ${fx - 16} ${fy + 8} Q ${fx} ${fy + 22} ${fx + 16} ${fy + 8} Z`} fill="#D9A43E" />
            <g transform={`translate(${fx} ${fy + 6}) scale(${fl})`}>
              <path d="M 0 -30 C 9 -18, 9 -6, 0 0 C -9 -6, -9 -18, 0 -30 Z" fill="#FFB347" />
              <path d="M 0 -17 C 4 -10, 4 -3, 0 0 C -4 -3, -4 -10, 0 -17 Z" fill="#FFF3C4" />
            </g>
          </g>
        );
      })}
    </g>
  );
};

/** Der Name hallt: grosse Schrift mit Echos, Ringe vom Vorhang her. */
const Echo: React.FC<{ parts: Array<{ text: string; at: number }>; t: number; font: string }> = ({ parts, t, font }) => {
  const first = parts[0]?.at ?? 0;
  const last = parts[parts.length - 1]?.at ?? 0;
  if (t < first - 0.1 || t > last + 2.6) return null;
  const out = interpolate(t, [last + 1.6, last + 2.4], [1, 0], clamp);
  const two = parts.length > 1;
  return (
    <g>
      {/* Ringe vom Vorhang her */}
      {parts.map((p, pi) =>
        [0, 0.35, 0.7].map((dl, i) => {
          const e = (t - p.at - dl) / 1.6;
          if (e <= 0 || e >= 1) return null;
          return <ellipse key={`${pi}-${i}`} cx={(VEIL.x0 + VEIL.x1) / 2} cy={860} rx={60 + 760 * e} ry={(60 + 760 * e) * 0.62} fill="none" stroke="#FFE6A8" strokeWidth={10 * (1 - e)} opacity={0.55 * (1 - e)} />;
        }),
      )}
      {parts.map((p, i) => {
        const k = interpolate(t, [p.at - 0.06, p.at + 0.16], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.8)) });
        if (k <= 0) return null;
        const y = two ? 520 + i * 170 : 600;
        const size = two ? 150 : 190;
        return (
          <g key={i} opacity={out}>
            {[1, 2, 3].map((n) => {
              const e = (t - p.at - n * 0.12) / 1.2;
              if (e <= 0 || e >= 1) return null;
              return (
                <text key={n} x={540} y={y} textAnchor="middle" fontFamily={font} fontSize={size} letterSpacing="0.04em" fill="none" stroke="#FFE6A8" strokeWidth={3} opacity={0.5 * (1 - e)} transform={`translate(540 ${y - size * 0.35}) scale(${1 + 0.45 * e}) translate(-540 ${-(y - size * 0.35)})`}>
                  {p.text}
                </text>
              );
            })}
            <text
              x={540}
              y={y}
              textAnchor="middle"
              fontFamily={font}
              fontSize={size}
              letterSpacing="0.04em"
              fill="#FFF4D2"
              opacity={k}
              transform={`translate(540 ${y - size * 0.35}) scale(${0.7 + 0.3 * k}) translate(-540 ${-(y - size * 0.35)})`}
              style={{ filter: "drop-shadow(0 0 22px rgba(255,214,130,0.85)) drop-shadow(0 8px 30px rgba(0,0,0,0.6))" }}
            >
              {p.text}
            </text>
          </g>
        );
      })}
    </g>
  );
};

/** Licht hinter dem Vorhang: ein Saum unten, Strahlen an den Rändern */
const VeilLight: React.FC<{ k: number; frame: number }> = ({ k, frame }) => {
  if (k <= 0.01) return null;
  const cx = (VEIL.x0 + VEIL.x1) / 2;
  return (
    <g opacity={Math.min(1, k)}>
      <rect x={VEIL.x0} y={VEIL.top} width={VEIL.x1 - VEIL.x0} height={LAMP_FLOOR - VEIL.top} fill="url(#smVeilGlow)" />
      {[-1, 1].map((sd) => (
        <path key={sd} d={`M ${cx + sd * 220} ${VEIL.top + 10} L ${cx + sd * (300 + 30 * Math.sin(frame / 20))} ${LAMP_FLOOR} L ${cx + sd * 212} ${LAMP_FLOOR} Z`} fill="#FFE6A8" opacity={0.18 * k} />
      ))}
      <ellipse cx={cx} cy={LAMP_FLOOR} rx={(VEIL.x1 - VEIL.x0) * 0.62} ry={60} fill="url(#smFloorGlow)" opacity={k} />
    </g>
  );
};

/** Sprechblase – Text oder versiegelt */
const Bubble: React.FC<{ x: number; y: number; text: string; k: number; tail: P; sealed: boolean; frame: number }> = ({ x, y, text, k, tail, sealed, frame }) => {
  if (k <= 0.01) return null;
  const words = text.split(" ");
  const lines: string[] = [];
  for (const w of words) {
    const lastLine = lines[lines.length - 1];
    if (lastLine !== undefined && (lastLine + " " + w).length <= 16) lines[lines.length - 1] = `${lastLine} ${w}`;
    else lines.push(w);
  }
  const fs = 48;
  const w = sealed ? 330 : Math.max(...lines.map((l) => l.length)) * fs * 0.56 + 84;
  const h = sealed ? 150 : lines.length * fs * 1.18 + 56;
  const bx = Math.max(60 + w / 2, Math.min(1020 - w / 2, x));
  const top = y - h;
  const s = 0.6 + 0.4 * k;
  const tx = Math.max(bx - w / 2 + 40, Math.min(bx + w / 2 - 40, tail[0]));
  return (
    <g transform={`translate(${tail[0]} ${tail[1]}) scale(${s}) translate(${-tail[0]} ${-tail[1]})`} opacity={Math.min(1, k * 1.4)}>
      <path d={`M ${tx - 26} ${y - 4} L ${tail[0]} ${tail[1]} L ${tx + 22} ${y - 4} Z`} fill="#F7EBD0" />
      <rect x={bx - w / 2} y={top} width={w} height={h} rx={34} fill="#F7EBD0" stroke="#3A2A1A" strokeWidth={4} />
      <path d={`M ${tx - 24} ${y - 2} L ${tail[0]} ${tail[1]} L ${tx + 20} ${y - 2}`} fill="none" stroke="#3A2A1A" strokeWidth={4} strokeLinejoin="round" />
      <rect x={tx - 28} y={y - 10} width={54} height={10} fill="#F7EBD0" />
      {sealed ? (
        <g>
          {[0, 1, 2].map((r) => (
            <rect key={r} x={bx - w / 2 + 40} y={top + 34 + r * 30} width={[190, 150, 170][r]} height={14} rx={7} fill="#A89A80" opacity={0.6} />
          ))}
          <g transform={`translate(${bx + w / 2 - 70} ${top + h / 2}) rotate(${-8 + 3 * Math.sin(frame / 15)})`}>
            <circle r={44} fill="#8E2420" />
            <circle r={34} fill="none" stroke="#C2483E" strokeWidth={4} />
            <text y={17} textAnchor="middle" fontFamily="Cinzel" fontWeight={700} fontSize={50} fill="#F2C2A0">
              ?
            </text>
          </g>
        </g>
      ) : (
        lines.map((l, i) => (
          <text key={i} x={bx} y={top + 28 + fs * 0.95 + i * fs * 1.18} textAnchor="middle" fontFamily="Inter" fontWeight={800} fontSize={fs} fill="#2A1A10">
            {l}
          </text>
        ))
      )}
    </g>
  );
};

/** Schwebendes Zeichen über einem Kopf: «?», «!», «z» */
const Mark: React.FC<{ x: number; y: number; text: string; k: number; frame: number; color?: string; size?: number }> = ({ x, y, text, k, frame, color = "#FFE9C4", size = 96 }) =>
  k > 0.01 ? (
    <text x={x} y={y - 20 * k + 4 * Math.sin(frame / 9)} textAnchor="middle" fontFamily="Cormorant Garamond" fontStyle="italic" fontWeight={600} fontSize={size} fill={color} opacity={Math.min(1, k)} stroke="#120C1E" strokeWidth={6} paintOrder="stroke">
      {text}
    </text>
  ) : null;

/** Beschriftung mit Strich zur Figur */
const Tag: React.FC<{ x: number; y: number; to: P; text: string; k: number; color: string }> = ({ x, y, to, text, k, color }) =>
  k > 0.01 ? (
    <g opacity={k}>
      <line x1={x} y1={y + 12} x2={to[0]} y2={to[1]} stroke={color} strokeWidth={2.5} opacity={0.7} />
      <circle cx={to[0]} cy={to[1]} r={5} fill={color} />
      <text x={x} y={y} textAnchor="middle" fontFamily="Cinzel" fontWeight={700} fontSize={44} letterSpacing="0.14em" fill={color} stroke="#0A0A16" strokeWidth={6} paintOrder="stroke">
        {text}
      </text>
    </g>
  ) : null;

/* ------------------------------------------------------------------ */
/* Morgen: die offene Tür                                              */
/* ------------------------------------------------------------------ */

/** Gestalt von vorn, als Silhouette in der Tür. `arms` 0 hängend … 1 ausgebreitet gegen die Türflügel */
const Front: React.FC<{ x: number; y: number; k: number; arms: number; fill: string; stroke?: string; o?: number; mantle?: number }> = ({ x, y, k, arms, fill, stroke, o = 1, mantle = 0 }) => {
  if (o <= 0.01) return null;
  const hand: P = lerp([52, -96], [150, -176], arms);
  const elbow: P = lerp([46, -146], [96, -176], arms);
  const sw = stroke ? 4 / k : 0;
  const robe = `M -50 0 C -46 -80, -40 -160, -34 -196 Q 0 -210, 34 -196 C 40 -160, 46 -80, 50 0 Z`;
  const cloak = `M -66 0 C -64 -90, -58 -170, -40 -200 Q 0 -214, 40 -200 C 58 -170, 64 -90, 66 0 Z`;
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`} opacity={o}>
      {mantle > 0 ? <path d={cloak} fill={stroke ? "none" : fill} stroke={stroke} strokeWidth={sw} opacity={mantle} /> : null}
      <path d={robe} fill={stroke ? "none" : fill} stroke={stroke} strokeWidth={sw} />
      {[-1, 1].map((sd) => (
        <path key={sd} d={`M ${sd * 30} -192 L ${sd * elbow[0]} ${elbow[1]} L ${sd * hand[0]} ${hand[1]}`} stroke={stroke ?? fill} strokeWidth={stroke ? sw : 17} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      ))}
      <rect x={-9} y={-214} width={18} height={14} fill={stroke ? "none" : fill} />
      <circle cx={0} cy={-232} r={24} fill={stroke ? "none" : fill} stroke={stroke} strokeWidth={sw} />
    </g>
  );
};

const Morning: React.FC<{ t: number; frame: number; b: number[]; wordsAt: number }> = ({ t, frame, b, wordsAt }) => {
  const open = interpolate(t, [b[0] - 0.2, b[0] + 1.3], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const push = bump(t, b[0] - 0.4, 0.4, 0.9, 0.6);
  const grow = interpolate(t, [b[1] - 0.1, b[1] + 1.4], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const withHim = fade(t, b[2] - 0.1, 0.8);
  const k = 1.15 + 0.55 * grow;
  const DX0 = 290;
  const DX1 = 790;
  const DTOP = 470;
  const half = (DX1 - DX0) / 2;
  const ang = open * (Math.PI / 2) * 0.86;
  const vis = half * Math.cos(ang);
  const shrink = 1 - 0.14 * Math.sin(ang);
  const light = 0.15 + 0.85 * open;
  const tokens = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const side = i % 2 ? 1 : -1;
        const ring = Math.floor(i / 2);
        return {
          x0: 540 + side * (60 + random(`smx${i}`) * 380),
          y0: 250 + random(`smy${i}`) * 260,
          tx: 540 + side * (150 + ring * 52),
          ty: 1030 - ring * 62 + random(`smty${i}`) * 30,
          dl: random(`smd${i}`) * 0.9,
          w: 60 + random(`smw${i}`) * 50,
        };
      }),
    [],
  );
  return (
    <g>
      <defs>
        <linearGradient id="smDawnSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3A5A9A" />
          <stop offset="55%" stopColor="#E9A27E" />
          <stop offset="100%" stopColor="#FFD9A0" />
        </linearGradient>
        <radialGradient id="smSun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#FFF6DA" stopOpacity="1" />
          <stop offset="35%" stopColor="#FFD9A0" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#FFB27A" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="smSpill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFD9A0" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#FFD9A0" stopOpacity="0" />
        </linearGradient>
        <clipPath id="smDoorClip">
          <rect x={DX0} y={DTOP} width={DX1 - DX0} height={LAMP_FLOOR - DTOP} />
        </clipPath>
      </defs>
      {/* Halle innen */}
      <rect x={0} y={0} width={1080} height={1920} fill={mixHex("#120E18", "#3A2A26", light)} />
      {Array.from({ length: 12 }, (_, r) => (
        <line key={r} x1={0} y1={260 + r * 72} x2={1080} y2={260 + r * 72} stroke="#000" strokeWidth={3} opacity={0.3} />
      ))}
      {/* Draussen: Morgen über den Hügeln */}
      <g clipPath="url(#smDoorClip)">
        <rect x={DX0} y={DTOP} width={DX1 - DX0} height={LAMP_FLOOR - DTOP} fill="url(#smDawnSky)" />
        <circle cx={540} cy={1010} r={260 + 60 * withHim} fill="url(#smSun)" />
        {withHim > 0
          ? Array.from({ length: 14 }, (_, i) => {
              const a = (i / 14) * Math.PI * 2 + frame / 160;
              return <path key={i} d={`M 540 1010 L ${540 + Math.cos(a - 0.06) * 900} ${1010 + Math.sin(a - 0.06) * 900} L ${540 + Math.cos(a + 0.06) * 900} ${1010 + Math.sin(a + 0.06) * 900} Z`} fill="#FFF0C8" opacity={0.16 * withHim} />;
            })
          : null}
        <path d="M 280 1060 C 360 1010, 430 1000, 520 1030 C 610 1060, 700 990, 800 1020 L 800 1160 L 280 1160 Z" fill="#8A6070" />
        <path d="M 280 1100 C 380 1070, 470 1090, 560 1080 C 650 1070, 720 1100, 800 1080 L 800 1160 L 280 1160 Z" fill="#6A4656" />
        {[350, 700].map((ox, i) => (
          <g key={i} transform={`translate(${ox} ${1078 - i * 8})`} fill="#5A3A48">
            <rect x={-3} y={-30} width={6} height={30} />
            <ellipse cx={0} cy={-40} rx={30} ry={20} />
          </g>
        ))}
      </g>
      {/* Licht fällt auf den Boden */}
      <path d={`M ${DX0} ${LAMP_FLOOR} L ${DX1} ${LAMP_FLOOR} L ${DX1 + 260} 1920 L ${DX0 - 260} 1920 Z`} fill="url(#smSpill)" opacity={open} />
      <rect x={0} y={LAMP_FLOOR} width={1080} height={770} fill={mixHex("#0A080E", "#2A1E1C", light)} opacity={0.75} />
      {/* Türflügel: drehen nach aussen weg */}
      {[-1, 1].map((sd) => {
        const hinge = sd < 0 ? DX0 : DX1;
        const free = hinge - sd * vis;
        const y0 = DTOP + (LAMP_FLOOR - DTOP) * (1 - shrink) * 0.5;
        const y1 = LAMP_FLOOR - (LAMP_FLOOR - DTOP) * (1 - shrink) * 0.5;
        return (
          <g key={sd}>
            <path d={`M ${hinge} ${DTOP} L ${free} ${y0} L ${free} ${y1} L ${hinge} ${LAMP_FLOOR} Z`} fill={mixHex("#3A2414", "#6A4426", light * 0.6)} stroke="#1A0E06" strokeWidth={6} />
            {[0.28, 0.72].map((f) => (
              <path key={f} d={`M ${hinge} ${DTOP + (LAMP_FLOOR - DTOP) * f} L ${free} ${y0 + (y1 - y0) * f}`} stroke="#1A0E06" strokeWidth={10} opacity={0.6} />
            ))}
          </g>
        );
      })}
      {/* Spalt zwischen den Flügeln leuchtet, solange zu */}
      <rect x={539 - 3} y={DTOP} width={6} height={LAMP_FLOOR - DTOP} fill="#FFE6B0" opacity={(1 - open) * 0.9} />
      {/* Türrahmen und Sturz */}
      <rect x={DX0 - 40} y={DTOP - 50} width={DX1 - DX0 + 80} height={50} fill="#24160E" />
      <rect x={DX0 - 40} y={DTOP - 50} width={40} height={LAMP_FLOOR - DTOP + 50} fill="#24160E" />
      <rect x={DX1} y={DTOP - 50} width={40} height={LAMP_FLOOR - DTOP + 50} fill="#24160E" />
      {/* Samuel in der Tür: wächst heran */}
      <ellipse cx={540} cy={1190} rx={260} ry={46} fill="#FFE6B0" opacity={0.35 * withHim} />
      {grow > 0.02 ? (
        <>
          <Front x={540} y={LAMP_FLOOR} k={1.15} arms={0} fill="none" stroke="#FFE6A8" o={0.7 * (1 - fade(t, b[2] + 0.4, 1.2))} />
          <Front x={540} y={LAMP_FLOOR} k={1.42} arms={0} fill="none" stroke="#FFE6A8" o={(grow > 0.5 ? 0.6 : 0) * (1 - fade(t, b[2] + 0.6, 1.2))} />
        </>
      ) : null}
      <Front x={540} y={LAMP_FLOOR} k={k} arms={push * (1 - open * 0.8)} fill="#120A0A" mantle={grow} />
      {withHim > 0 ? <circle cx={540} cy={LAMP_FLOOR - 270 * k * 0.86} r={70 * k} fill="url(#smSun)" opacity={0.35 * withHim} /> : null}
      {/* Worte, die nicht zu Boden fallen */}
      {tokens.map((tk, i) => {
        const s0 = wordsAt + tk.dl * 0.6;
        const tt = t - s0;
        if (tt <= 0) return null;
        const p = interpolate(tt, [0, 1.3], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
        const x = tk.x0 + (tk.tx - tk.x0) * p;
        const y = tk.y0 + (tk.ty - tk.y0) * p + (p >= 1 ? 6 * Math.sin(frame / 14 + i) : 0);
        const o = Math.min(1, tt * 3);
        return (
          <g key={i} transform={`translate(${x} ${y})`} opacity={o}>
            <rect x={-tk.w / 2 - 10} y={-24} width={tk.w + 20} height={48} rx={24} fill="#FFE6A8" opacity={0.25} />
            <rect x={-tk.w / 2} y={-16} width={tk.w} height={32} rx={16} fill="#FFF0C8" stroke="#E0A94A" strokeWidth={3} />
            <rect x={-tk.w / 2 + 14} y={-4} width={tk.w * 0.45} height={7} rx={3.5} fill="#B07A2A" opacity={0.7} />
            <rect x={-tk.w / 2 + 18 + tk.w * 0.45} y={-4} width={tk.w * 0.25} height={7} rx={3.5} fill="#B07A2A" opacity={0.7} />
          </g>
        );
      })}
    </g>
  );
};

/* ------------------------------------------------------------------ */
/* Szene                                                               */
/* ------------------------------------------------------------------ */

/** Zeitpunkt des letzten Wortes einer Phrase (für «Stimme: Samuel» der Name selbst) */
const callTimes = (ts: TimelineScene, at: string, text: string, fallback: number): number[] => {
  const c = findCue(ts.words, at);
  if (!c) return [fallback];
  const names = new Set(normalize(text).split(" "));
  const hits = ts.words.slice(c.first, c.last + 1).filter((w) => names.has(w.key));
  return hits.length ? hits.map((w) => w.start) : [ts.words[c.first].start];
};

/** Fahrplan für das Hin und Her: mit `start` vom Lager los, zuletzt bei Eli */
const shuttle = (t: number, start: number, end: number) => {
  const rest = 0.14;
  const span = Math.max(0.8, end - start);
  let n = Math.max(1, Math.floor(span / 0.78));
  if (n % 2 === 0) n -= 1;
  const leg = span / n - rest;
  if (t <= start) return { x: MAT_X, moving: 0, dir: 1 as 1 | -1, arrivals: [] as number[] };
  const arrivals = Array.from({ length: n }, (_, i) => start + i * (leg + rest) + leg).filter((a, i) => i % 2 === 0);
  const i = Math.min(n - 1, Math.floor((t - start) / (leg + rest)));
  const into = t - start - i * (leg + rest);
  const f = Math.min(1, into / leg);
  const fromX = i % 2 === 0 ? MAT_X : ELI_SIDE;
  const toX = i % 2 === 0 ? ELI_SIDE : MAT_X;
  const e = Easing.inOut(Easing.quad)(f);
  return { x: fromX + (toX - fromX) * e, moving: f < 1 ? 1 : 0, dir: (toX > fromX ? 1 : -1) as 1 | -1, arrivals };
};

export const Scene: React.FC<{ ts: TimelineScene }> = ({ ts }) => {
  const s = ts.scene as SamuelSceneT;
  const frame = useCurrentFrame();
  const look = useLook();
  const t = (frame - ts.audioOffsetFrames) / FPS;
  const f = (sec: number) => voiceFrame(ts, sec);
  const b = beats(ts, s.cues, Math.max(4, s.cues.length));
  const stage = s.stage;

  /* Rufe: Zeitpunkte und Zähler */
  const calls = s.calls.map((c, i) => ({ ...c, times: callTimes(ts, c.at, c.text, b[0] + i) }));
  const hookCall = stage === "hook" ? b[1] : null;
  const echoParts =
    hookCall !== null
      ? [[{ text: "SAMUEL!", at: hookCall }]]
      : calls.map((c) => {
          const texts = c.text.split(/,\s*/).map((x, i, all) => (i < all.length - 1 ? `${x},` : x));
          return texts.map((tx, i) => ({ text: tx, at: c.times[Math.min(i, c.times.length - 1)] + (c.times.length > i ? 0 : 0.6 * i) }));
        });
  const lastCall = calls.filter((c) => t >= c.times[0] - 0.02).pop();
  const count = lastCall ? lastCall.n : s.count;
  const countAt = lastCall ? lastCall.times[0] : -99;
  const callGlow = Math.max(0, ...calls.map((c) => bump(t, c.times[0] - 0.05, 0.2, 0.8 + (c.times.length - 1) * 0.8, 1.2)), hookCall !== null ? bump(t, hookCall - 0.05, 0.2, 0.8, 1.0) : 0);

  /* Samuel und Eli */
  let sx = MAT_X;
  let sdir: 1 | -1 = 1;
  let pose: Pose = { lie: 1, sit: 1 };
  let blanket = 1;
  let ghosts: Array<{ x: number; dir: 1 | -1; ph: number }> = [];
  let eli: Pose = { lie: 1, sit: 1 };
  let eliBlanket = 1;
  let question = 0;
  let qX = MAT_X;
  let zzz = 0;
  let eliMark = 0;
  let arc = 0;
  let thread = 0;
  let dark = 0.5;
  let boost = 0;
  let calm = 0;
  let presence = 0.12;

  if (stage === "hook") {
    dark = 0.86;
    const up = ramp(t, b[2] - 0.15, b[2] + 0.25);
    pose = { lie: 1 - up, sit: 1 };
    blanket = 1 - 0.5 * up;
    question = fade(t, b[2] + 0.1, 0.3);
    zzz = 1 - fade(t, b[1] - 0.2, 0.3);
  } else if (stage === "temple") {
    dark = interpolate(t, [b[0] - 0.3, b[0] + 1.2], [0.86, 0.48], clamp);
    zzz = fade(t, b[1], 0.6);
    presence = interpolate(t, [b[3] - 0.1, b[3] + 1.0], [0.16, 0.03], clamp);
  } else if (stage === "call") {
    const c1 = calls[0]?.times[0] ?? b[1] + 1.5;
    boost = bump(t, b[0] - 0.1, 0.4, 0.9, 0.6);
    dark = 0.5 + 0.18 * bump(t, b[0] - 0.1, 0.4, 0.9, 0.6);
    zzz = fade(t, b[1] - 0.1, 0.5) * (1 - fade(t, c1 - 0.1, 0.2));
    const up = ramp(t, c1 + 0.05, c1 + 0.3);
    const stand = ramp(t, b[2] - 0.05, b[2] + 0.3);
    const runK = interpolate(t, [b[3] - 0.1, b[3] + 1.0], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });
    const running = t > b[3] - 0.1 && t < b[3] + 1.0 ? 1 : 0;
    sx = MAT_X + (ELI_SIDE - MAT_X) * runK;
    pose = { lie: 1 - up, sit: 1 - stand, run: running, ph: (frame / FPS) * 15 };
    blanket = 1 - up;
    question = fade(t, c1 + 0.3, 0.25) * (1 - fade(t, b[2] - 0.1, 0.2));
  } else if (stage === "eli") {
    sx = ELI_SIDE;
    const back = interpolate(t, [b[1] + 0.5, ts.speechEndSec + 1.2], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
    if (t > b[1] + 0.35) sdir = -1;
    sx = ELI_SIDE - (ELI_SIDE - 480) * back;
    pose = { run: back > 0 && back < 1 ? 0.55 : 0, ph: (frame / FPS) * 9, bow: fade(t, b[1] + 0.3, 0.4) };
    blanket = 0;
    const sit = ramp(t, b[0] - 0.2, b[0] + 0.5);
    eli = { lie: 1 - sit, sit: 1, reach: bump(t, b[1] - 0.15, 0.3, 0.8, 0.5) * 0.8 };
    eliBlanket = 1;
  } else if (stage === "again") {
    const c2 = calls[0]?.times[0] ?? 0.2;
    const endAt = b[1] - 0.25;
    const up = ramp(t, c2 - 0.05, c2 + 0.25);
    const sh = shuttle(t, c2 + 0.25, endAt);
    sx = sh.x;
    sdir = t < c2 + 0.25 ? 1 : sh.dir;
    if (t >= endAt) sdir = 1;
    pose = { lie: 1 - up, sit: 1 - up, run: sh.moving, ph: (frame / FPS) * 17 };
    blanket = 1 - up;
    ghosts = sh.moving
      ? [0.06, 0.12, 0.18].map((dt) => {
          const g = shuttle(t - dt, c2 + 0.25, endAt);
          return { x: g.x, dir: g.dir, ph: ((frame - dt * FPS) / FPS) * 17 };
        })
      : [];
    const pat = Math.max(0, ...sh.arrivals.map((a) => bump(t, a - 0.05, 0.15, 0.3, 0.3)));
    eli = { lie: 0, sit: 1, reach: 0.7 * pat };
    arc = fade(t, b[1] - 0.1, 0.6);
    presence = 0.14 + 0.4 * arc;
    question = fade(t, b[1] + 0.2, 0.3);
    qX = ELI_SIDE;
  } else if (stage === "understand") {
    sx = ELI_SIDE;
    const look2 = t > b[1] + 0.25 && t < b[2] - 0.1 ? 1 : 0;
    sdir = look2 ? -1 : 1;
    pose = {};
    blanket = 0;
    eli = { lie: 0, sit: 1, reach: bump(t, b[1] - 0.1, 0.3, 1.0, 0.5), lean: ramp(t, b[2] - 0.1, b[2] + 0.4) };
    eliMark = fade(t, b[0] + 0.1, 0.25) * (1 - fade(t, b[2] - 0.1, 0.3));
    presence = 0.14 + 0.7 * bump(t, b[1] - 0.1, 0.4, 1.2, 0.8);
    arc = 0.6 * bump(t, b[0], 0.4, 1.4, 0.6);
  } else if (stage === "answer") {
    const c4 = calls[0]?.times ?? [b[1] + 2, b[1] + 2.8];
    const w1 = c4[0];
    const w2 = c4[1] ?? w1 + 0.7;
    const walk = interpolate(t, [-0.35, 1.25], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });
    sx = ELI_SIDE + (MAT_X - ELI_SIDE) * walk;
    sdir = t < 1.3 ? -1 : 1;
    const down = ramp(t, 1.3, 1.65);
    const lieK = ramp(t, 1.6, 2.05);
    const up = ramp(t, w1 + 0.08, w1 + 0.35);
    const kneel = ramp(t, w2 + 0.3, w2 + 0.85);
    const walking = walk > 0 && walk < 1 ? 0.55 : 0;
    pose = { run: walking, ph: (frame / FPS) * 9, sit: down * (1 - kneel), lie: lieK * (1 - up), kneel };
    blanket = lieK * (1 - up);
    const eliDown = ramp(t, 0.3, 1.2);
    eli = { lie: eliDown, sit: 1 };
    calm = fade(t, b[1] - 0.1, 0.8) * (1 - fade(t, w1 - 0.1, 0.3));
    dark = 0.5 + 0.22 * calm - 0.18 * fade(t, w1, 0.4);
    presence = 0.12 + 0.75 * fade(t, w1 - 0.05, 0.3);
    thread = fade(t, b[2] - 0.1, 0.6);
  }

  const lampFl = 0.88 + 0.08 * Math.sin(frame / 2.7) * (1 - calm) + 0.05 * Math.sin(frame / 5.3);
  const glowK = (0.6 + 0.4 * boost) * lampFl;
  presence = Math.max(presence, callGlow * 0.95);
  const rimS = 0.55 + 0.4 * (sx < LAMP_X ? 1 - Math.min(1, (LAMP_X - sx) / 500) : 1 - Math.min(1, (sx - LAMP_X) / 500));
  const sC = shadeColors(SAMUEL_C, 0.55);
  const eC = shadeColors(ELI_C, 0.45);
  const rim = "#FFC67A";
  const sj = poseOf(pose);
  const ej = poseOf(eli);

  /* Sprechblasen */
  const bubbles = s.say.map((sy, i) => {
    const at = beat(ts, sy.at, b[0] + i);
    const next = s.say[i + 1] && s.say[i + 1].who === sy.who ? beat(ts, s.say[i + 1].at, 99) : 99;
    const endAt = stage === "call" ? b[3] - 0.05 : next - 0.05;
    const k = spring({ frame: frame - f(at - 0.05), fps: FPS, config: { damping: 13, stiffness: 190 } }) * (1 - fade(t, endAt, 0.2));
    const isEli = sy.who === "eli";
    const head: P = isEli ? [ELI_X + 4, ELI_GROUND - 150] : [sx + sdir * 6, LAMP_FLOOR - (pose.kneel ? 166 : 196) * K_S];
    const tail: P = isEli ? [head[0] - 26, head[1] - 40] : [head[0] + 18, head[1] - 46];
    const bx = isEli ? 800 : sx + 60;
    const by = isEli ? head[1] - 90 : head[1] - 90;
    return { ...sy, k, tail, bx, by };
  });

  const showLamp = stage !== "grow";
  const veilCx = (VEIL.x0 + VEIL.x1) / 2;
  const sHead: P = [sx + sdir * 4 * K_S, LAMP_FLOOR + sj.head[1] * K_S];
  const titleK = stage === "temple" ? fade(t, b[0] - 0.1, 0.5) : 0;
  const tagS = stage === "temple" ? fade(t, b[1], 0.35) : 0;
  const tagE = stage === "temple" ? fade(t, b[2], 0.35) : 0;
  const counterPop = spring({ frame: frame - f(countAt), fps: FPS, config: { damping: 9, stiffness: 160 } });
  const counterO = stage === "grow" || stage === "hook" || stage === "temple" ? 0 : count > 0 ? 1 : 0;
  const wordsAt = beat(ts, "keines seiner Worte", (b[3] ?? 6) - 0.9);

  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id="smLampGlow" cx={LAMP_X} cy={LAMP_TOP} r={560} gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFCB7A" stopOpacity="0.55" />
            <stop offset="40%" stopColor="#E89A48" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#E89A48" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="smDark" cx={LAMP_X} cy={LAMP_TOP + 120} r={980} gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={NIGHT} stopOpacity={dark * 0.15} />
            <stop offset="30%" stopColor={NIGHT} stopOpacity={dark * 0.55} />
            <stop offset="70%" stopColor={NIGHT} stopOpacity={dark} />
            <stop offset="100%" stopColor={NIGHT} stopOpacity={Math.min(1, dark * 1.1)} />
          </radialGradient>
          <radialGradient id="smVeilGlow" cx="0.5" cy="1" r="0.9">
            <stop offset="0%" stopColor="#FFE6A8" stopOpacity="0.75" />
            <stop offset="45%" stopColor="#FFD08A" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#FFD08A" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="smFloorGlow">
            <stop offset="0%" stopColor="#FFE6A8" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#FFE6A8" stopOpacity="0" />
          </radialGradient>
        </defs>

        {stage === "grow" ? (
          <Morning t={t} frame={frame} b={b} wordsAt={wordsAt} />
        ) : (
          <g>
            {/* Licht hinter dem Vorhang – die Gegenwart des Herrn */}
            <VeilLight k={presence} frame={frame} />
            {/* Elis Kammer */}
            <Figure x={ELI_X} ground={ELI_GROUND} k={K_E} dir={-1} j={ej} c={eC} rim={rim} rimO={0.35 + 0.3 * presence} headR={22} blanket={eliBlanket} />
            {/* Leuchter und sein Licht */}
            {showLamp ? <circle cx={LAMP_X} cy={LAMP_TOP} r={560} fill="url(#smLampGlow)" opacity={glowK} /> : null}
            <Lampstand frame={frame} boost={boost} calm={calm} />
            {/* Bogen vom Vorhang zu Samuel: der Ruf kommt von dort – er schaut zu Eli */}
            {arc > 0.01 ? (
              <path
                d={`M ${veilCx} ${VEIL.top + 260} Q ${(veilCx + sHead[0]) / 2} ${VEIL.top + 40} ${sHead[0] - 10} ${sHead[1] - 20}`}
                stroke="#FFE6A8"
                strokeWidth={5}
                fill="none"
                strokeDasharray="4 16"
                strokeDashoffset={-frame * 1.5}
                strokeLinecap="round"
                opacity={0.85 * arc}
              />
            ) : null}
            {thread > 0.01 ? (
              <path d={`M ${veilCx} ${LAMP_FLOOR - 160} Q ${(veilCx + sHead[0]) / 2} ${sHead[1] - 120} ${sHead[0] + 30} ${sHead[1]}`} stroke="#FFE6A8" strokeWidth={6} fill="none" strokeLinecap="round" opacity={0.75 * thread} strokeDasharray={`${800 * thread} 2000`} />
            ) : null}
            {/* Samuels Decke bleibt liegen, wenn er aufsteht */}
            {blanket < 0.9 ? <path d={`M ${MAT.x0 + 120} ${LAMP_FLOOR - 10} C ${MAT.x0 + 150} ${LAMP_FLOOR - 44}, ${MAT.x0 + 230} ${LAMP_FLOOR - 40}, ${MAT.x0 + 270} ${LAMP_FLOOR - 10} Z`} fill={sC.blanket} opacity={1 - blanket} /> : null}
            {ghosts.map((g, i) => (
              <Figure key={i} x={g.x} ground={LAMP_FLOOR} k={K_S} dir={g.dir} j={poseOf({ run: 1, ph: g.ph })} c={sC} rim={rim} rimO={0.5} o={0.32 - i * 0.09} />
            ))}
            <Figure x={sx} ground={LAMP_FLOOR} k={K_S} dir={sdir} j={sj} c={sC} rim={rim} rimO={rimS} blanket={blanket} />
            {/* Dunkel ringsum, hell beim Leuchter */}
            <rect x={0} y={0} width={1080} height={1920} fill="url(#smDark)" />
            {/* Zeichen über den Köpfen */}
            {zzz > 0.01
              ? [0, 1, 2].map((i) => {
                  const ph = ((frame / FPS) * 0.6 + i / 3) % 1;
                  return (
                    <text key={i} x={MAT.x0 + 40 + ph * 70} y={LAMP_FLOOR - 80 - ph * 120} fontFamily="Cormorant Garamond" fontStyle="italic" fontWeight={600} fontSize={40 + 18 * i} fill="#D8D2FF" opacity={zzz * Math.sin(ph * Math.PI) * 0.8}>
                      z
                    </text>
                  );
                })
              : null}
            <Mark x={stage === "hook" ? MAT_X - 60 : qX} y={stage === "hook" ? LAMP_FLOOR - 190 : LAMP_FLOOR - 300} text="?" k={question} frame={frame} />
            <Mark x={stage === "call" ? MAT_X - 30 : qX} y={LAMP_FLOOR - 230} text="?" k={stage === "call" ? question : 0} frame={frame} />
            <Mark x={ELI_X + 10} y={ELI_GROUND - 210} text="!" k={eliMark} frame={frame} color="#FFE6A8" size={110} />
            {/* Namen der Figuren */}
            <Tag x={MAT_X - 40} y={LAMP_FLOOR - 190} to={[MAT_X - 110, LAMP_FLOOR - 50]} text="SAMUEL" k={tagS} color={look.accent} />
            <Tag x={ELI_X + 30} y={ELI_GROUND - 150} to={[ELI_X + 110, ELI_GROUND - 42]} text="ELI" k={tagE} color={look.accent} />
          </g>
        )}

        {/* Der Name hallt */}
        {echoParts.map((parts, i) => (
          <Echo key={i} parts={parts} t={t} font={look.display} />
        ))}
        {/* Sprechblasen */}
        {bubbles.map((bb, i) => (
          <Bubble key={i} x={bb.bx} y={bb.by} text={bb.text} k={bb.k} tail={bb.tail} sealed={bb.sealed} frame={frame} />
        ))}
      </svg>

      {/* Titel: das Heiligtum in Schilo */}
      {titleK > 0.01 ? (
        <div style={{ position: "absolute", top: 262, left: 0, right: 0, textAlign: "center", opacity: titleK, transform: `translateY(${(1 - titleK) * 24}px)` }}>
          <div style={{ fontFamily: "Cinzel", fontWeight: 700, fontSize: 34, letterSpacing: "0.32em", color: look.dim }}>DAS HEILIGTUM IN</div>
          <div style={{ fontFamily: "Cinzel", fontWeight: 700, fontSize: 96, letterSpacing: "0.16em", color: look.accent, textShadow: look.glow, lineHeight: 1.05 }}>SCHILO</div>
        </div>
      ) : null}

      {/* Zähler der Rufe */}
      {counterO > 0 ? (
        <div
          style={{
            position: "absolute",
            top: 252,
            right: 58,
            width: 196,
            padding: "14px 0 18px",
            borderRadius: 22,
            border: `2px solid ${look.accent}`,
            background: "rgba(8,8,22,0.62)",
            textAlign: "center",
            boxShadow: `0 0 ${18 + 30 * callGlow}px rgba(255,217,138,${0.25 + 0.5 * callGlow})`,
          }}
        >
          <div style={{ fontFamily: "Cinzel", fontWeight: 700, fontSize: 30, letterSpacing: "0.3em", color: look.dim, paddingLeft: 8 }}>RUF</div>
          <div style={{ fontFamily: "Cinzel", fontWeight: 700, fontSize: 92, lineHeight: 1, color: look.accent, transform: `scale(${t >= countAt ? 0.7 + 0.3 * counterPop : 1})`, textShadow: look.glow }}>{count}</div>
          <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 10 }}>
            {[1, 2, 3, 4].map((n) => (
              <div key={n} style={{ width: 22, height: 22, borderRadius: 11, border: `2px solid ${look.accent}`, background: n <= count ? look.accent : "transparent", opacity: n <= count ? 1 : 0.4 }} />
            ))}
          </div>
        </div>
      ) : null}

      {/* Geräusche: der erste und der vierte Ruf, die Türen am Morgen */}
      {stage === "call" && calls[0] ? <Sfx frame={f(calls[0].times[0])} name="warm" volume={0.4} keep /> : null}
      {stage === "answer" && calls[0] ? <Sfx frame={f(calls[0].times[0])} name="warm" volume={0.4} keep /> : null}
      {stage === "grow" ? <Sfx frame={f(b[0])} name="breath" volume={0.4} keep /> : null}
    </AbsoluteFill>
  );
};

/** Der gerufene Name steht gross im Bild, die Worte in den Blasen auch – sie werden nicht noch einmal untertitelt. */
export const hidden = (ts: TimelineScene): Set<number> => {
  const s = ts.scene as SamuelSceneT;
  const out = new Set<number>();
  for (const c of s.calls) {
    const cue = findCue(ts.words, c.at);
    if (!cue) continue;
    const names = new Set(normalize(c.text).split(" "));
    for (let k = cue.first; k <= cue.last; k++) if (names.has(ts.words[k].key)) out.add(ts.words[k].index);
  }
  for (const sy of s.say) {
    if (sy.sealed) continue;
    const cue = findCue(ts.words, sy.text);
    if (cue) for (let k = cue.first; k <= cue.last; k++) out.add(ts.words[k].index);
  }
  return out;
};
