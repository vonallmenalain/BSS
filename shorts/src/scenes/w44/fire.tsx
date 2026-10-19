import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, random, spring, useCurrentFrame } from "remotion";
import { FIRE_X, GALLERY, GROUND_Y, WALL_TOP, flicker, galleryPath } from "../../components/backgrounds/EmberBg";
import { useLook } from "../../looks";
import { Sfx, beat, voiceFrame } from "../../lib/sfx";
import { FPS, type TimelineScene, findCue } from "../../lib/timing";
import type { Scene } from "../../schema";
import { theme } from "../../theme";

/*
 * Hof bei Nacht (Lukas 22:54–62): Petrus sitzt am Feuer, Leute zeigen auf ihn, er lügt – und mit
 * jeder Lüge wird die Schnur um ihn dicker: dünne Schnur, Strick, Kette (vgl. 2 Nephi 26:22).
 * Dann kräht der Hahn. Wochen später steht derselbe Petrus vor dem Hohen Rat und sagt die
 * Wahrheit – die Kette springt (Apostelgeschichte 4:18–20).
 */

type FireSceneT = Extract<Scene, { type: "fire" }>;
type Bubble = FireSceneT["bubbles"][number];
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = Easing.inOut(Easing.cubic);

/** Wo Petrus am Feuer sitzt */
const PETER_X = 800;
const PETER_K = 1.25;
/** Wo die Ankläger stehen */
const ACCUSER_X = 225;
const ACCUSER_K = 1.12;
/** Petrus im Morgenlicht */
const STAND_X = 640;
const STAND_K = 1.12;

/* ------------------------------------------------------------------ */
/* Feuer                                                               */
/* ------------------------------------------------------------------ */

const flame = (cx: number, base: number, h: number, w: number, sway: number) => {
  const tip = cx + sway;
  return `M ${cx - w / 2} ${base} C ${cx - w / 2} ${base - h * 0.45}, ${tip - w * 0.18} ${base - h * 0.7}, ${tip} ${base - h} C ${tip + w * 0.18} ${base - h * 0.7}, ${cx + w / 2} ${base - h * 0.45}, ${cx + w / 2} ${base} Z`;
};

const FLAMES = [
  { dx: -70, h: 150, w: 90, p: 0.3 },
  { dx: 62, h: 170, w: 96, p: 1.9 },
  { dx: -22, h: 250, w: 130, p: 3.1 },
  { dx: 24, h: 230, w: 120, p: 4.4 },
  { dx: 0, h: 300, w: 150, p: 5.2 },
];

/** Feuerstelle: Steinring, Scheite, Flammen in Schichten, Funken. `heat` 0 = Glut, 1 = volles Feuer */
const Fire: React.FC<{ t: number; heat: number }> = ({ t, heat }) => {
  const base = GROUND_Y - 40;
  const f = flicker(t);
  const sparks = useMemo(
    () => Array.from({ length: 18 }, (_, i) => ({ dx: (random(`fs${i}`) - 0.5) * 160, v: 140 + random(`fv${i}`) * 180, p: random(`fp${i}`), r: 2 + random(`fr${i}`) * 3 })),
    [],
  );
  const layers: Array<{ color: string; k: number; o: number }> = [
    { color: "#E8461E", k: 1, o: 0.9 },
    { color: "#FF8A2A", k: 0.78, o: 0.95 },
    { color: "#FFC85A", k: 0.55, o: 0.95 },
    { color: "#FFF3C8", k: 0.3, o: 0.9 },
  ];
  return (
    <g>
      <defs>
        <radialGradient id="fireHalo">
          <stop offset="0%" stopColor="#FFC46B" stopOpacity="0.55" />
          <stop offset="45%" stopColor="#FF7A2A" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#FF7A2A" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={FIRE_X} cy={base - 110} r={360} fill="url(#fireHalo)" opacity={Math.min(1, heat) * f} />
      {/* Scheite */}
      <g opacity={0.95}>
        <rect x={FIRE_X - 120} y={base - 12} width={240} height={26} rx={13} fill="#3A2214" transform={`rotate(-12 ${FIRE_X} ${base})`} />
        <rect x={FIRE_X - 120} y={base - 12} width={240} height={26} rx={13} fill="#2C190F" transform={`rotate(14 ${FIRE_X} ${base})`} />
        <ellipse cx={FIRE_X} cy={base + 4} rx={110} ry={16} fill="#FF7A2A" opacity={0.35 + 0.35 * heat} />
      </g>
      {/* Flammen */}
      {layers.map((l, li) => (
        <g key={li} opacity={l.o}>
          {FLAMES.map((fl, i) => {
            const n = 0.82 + 0.12 * Math.sin(t * 9 + fl.p * 3 + li) + 0.08 * Math.sin(t * 15.3 + fl.p * 5);
            const h = fl.h * l.k * n * heat;
            if (h < 6) return null;
            const w = fl.w * (0.55 + 0.45 * l.k) * Math.min(1, 0.4 + heat);
            const sway = Math.sin(t * 5.5 + fl.p * 2) * w * 0.28;
            return <path key={i} d={flame(FIRE_X + fl.dx * (0.6 + 0.4 * l.k), base, h, w, sway)} fill={l.color} />;
          })}
        </g>
      ))}
      {/* Steinring davor */}
      {Array.from({ length: 9 }, (_, i) => {
        const a = Math.PI * (0.05 + (0.9 * i) / 8);
        return <ellipse key={i} cx={FIRE_X - Math.cos(a) * 150} cy={base + 22 + Math.sin(a) * 14} rx={34} ry={18} fill="#2A201B" stroke="#140E0B" strokeWidth={3} />;
      })}
      {/* Funken */}
      {sparks.map((s, i) => {
        const life = 1.6;
        const k = ((t + s.p * life) % life) / life;
        const y = base - 120 - k * s.v * 2.2;
        const x = FIRE_X + s.dx * (0.4 + k) + Math.sin(t * 3 + i) * 18;
        return <circle key={i} cx={x} cy={y} r={s.r * (1 - k * 0.6)} fill="#FFD27A" opacity={(1 - k) * Math.min(1, heat)} />;
      })}
    </g>
  );
};

/* ------------------------------------------------------------------ */
/* Schnur, Strick, Kette                                               */
/* ------------------------------------------------------------------ */

/** Halber Ring um den Oberkörper: hinten (oben im Bild) oder vorne */
const Bond: React.FC<{ cx: number; cy: number; rx: number; ry: number; level: number; half: "back" | "front"; flash?: number }> = ({ cx, cy, rx, ry, level, half, flash = 0 }) => {
  if (level <= 0) return null;
  const a0 = half === "back" ? Math.PI : 0;
  const a1 = half === "back" ? Math.PI * 2 : Math.PI;
  const pt = (a: number) => [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry] as const;
  const arc = (() => {
    const [sx, sy] = pt(a0);
    const [ex, ey] = pt(a1);
    return `M ${sx} ${sy} A ${rx} ${ry} 0 0 ${half === "back" ? 1 : 1} ${ex} ${ey}`;
  })();
  const dim = half === "back" ? 0.55 : 1;
  if (level === 1) {
    return (
      <g opacity={dim}>
        <path d={arc} stroke="#D9BF86" strokeWidth={5} fill="none" strokeLinecap="round" />
        <path d={arc} stroke="#8C6A35" strokeWidth={5} fill="none" strokeDasharray="3 9" strokeLinecap="round" />
      </g>
    );
  }
  if (level === 2) {
    return (
      <g opacity={dim}>
        <path d={arc} stroke="#3A2210" strokeWidth={19} fill="none" strokeLinecap="round" />
        <path d={arc} stroke="#9A5E2A" strokeWidth={14} fill="none" strokeLinecap="round" />
        <path d={arc} stroke="#D29A5A" strokeWidth={14} fill="none" strokeDasharray="5 11" strokeLinecap="butt" />
      </g>
    );
  }
  /* Kette: Glieder entlang der Ellipse, abwechselnd von vorne und von der Seite */
  const n = 9;
  return (
    <g opacity={dim}>
      {Array.from({ length: n + 1 }, (_, i) => {
        const a = a0 + ((a1 - a0) * i) / n;
        const [x, y] = pt(a);
        const tx = -Math.sin(a) * rx;
        const ty = Math.cos(a) * ry;
        const ang = (Math.atan2(ty, tx) * 180) / Math.PI;
        return i % 2 === 0 ? (
          <ellipse key={i} cx={x} cy={y} rx={20} ry={12} transform={`rotate(${ang} ${x} ${y})`} fill="none" stroke="#2A2E35" strokeWidth={11} />
        ) : (
          <rect key={i} x={x - 18} y={y - 4} width={36} height={8} rx={4} transform={`rotate(${ang} ${x} ${y})`} fill="#2A2E35" />
        );
      })}
      {Array.from({ length: n + 1 }, (_, i) => {
        const a = a0 + ((a1 - a0) * i) / n;
        const [x, y] = pt(a);
        const tx = -Math.sin(a) * rx;
        const ty = Math.cos(a) * ry;
        const ang = (Math.atan2(ty, tx) * 180) / Math.PI;
        return i % 2 === 0 ? (
          <ellipse key={i} cx={x} cy={y} rx={20} ry={12} transform={`rotate(${ang} ${x} ${y})`} fill="none" stroke={flash > 0 ? mix("#B7BEC8", "#FF7A4A", flash) : "#B7BEC8"} strokeWidth={6} />
        ) : (
          <rect key={i} x={x - 16} y={y - 2.5} width={32} height={5} rx={2.5} transform={`rotate(${ang} ${x} ${y})`} fill={flash > 0 ? mix("#9AA3AE", "#FF7A4A", flash) : "#9AA3AE"} />
        );
      })}
    </g>
  );
};

/** Zwei Farben mischen (#rrggbb) */
const mix = (a: string, b: string, k: number) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * Math.max(0, Math.min(1, k))));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
};

/* ------------------------------------------------------------------ */
/* Figuren                                                             */
/* ------------------------------------------------------------------ */

/** Petrus sitzt am Feuer (Blick nach links), Ursprung am Boden unter dem Sitz */
const SeatedPeter: React.FC<{ x: number; light: number; bond: number; bondScale: number; flash: number; shake: number }> = ({ x, light, bond, bondScale, flash, shake }) => {
  const K = PETER_K;
  const ring = { cx: -18, cy: -190, rx: 66 * bondScale, ry: 19 * bondScale };
  return (
    <g transform={`translate(${x + shake} ${GROUND_Y}) scale(${K})`}>
      <defs>
        <linearGradient id="peterRim" x1={-170} y1={0} x2={40} y2={0} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={mix("#4A2412", "#C2602A", light)} />
          <stop offset="45%" stopColor={mix("#21130C", "#5A2A14", light)} />
          <stop offset="100%" stopColor="#0E0907" />
        </linearGradient>
      </defs>
      <ellipse cx={-40} cy={2} rx={150} ry={12} fill="#000" opacity={0.35} />
      {/* Sitzstein */}
      <rect x={-60} y={-82} width={130} height={82} rx={10} fill="#2A1E18" stroke="#140E0B" strokeWidth={3} />
      <Bond {...ring} level={bond} half="back" flash={flash} />
      {/* Gewand mit Beinen */}
      <path
        d="M 40 -82 L 18 -292 Q -18 -312 -58 -282 L -54 -205 L -46 -118 L -128 -128 L -140 -96 L -128 -8 L -156 0 L -96 0 L -94 -78 L -20 -80 Z"
        fill="url(#peterRim)"
      />
      {/* Arme zum Feuer */}
      <path d="M -36 -268 Q -82 -230 -100 -206 L -148 -214" stroke="url(#peterRim)" strokeWidth={28} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx={-152} cy={-214} r={14} fill={mix("#3A1C0E", "#E08A4A", light)} />
      {/* Kopf, Kopftuch, Bart */}
      <circle cx={-36} cy={-330} r={36} fill={mix("#20120A", "#7A3A1C", light * 0.8)} />
      <path d="M -74 -336 Q -70 -384 -26 -378 Q 14 -372 12 -330 L 20 -270 L -6 -280 L -8 -330 Z" fill="#160D09" />
      <path d="M -70 -322 Q -76 -292 -52 -286 L -40 -302 Z" fill="#160D09" />
      <Bond {...ring} level={bond} half="front" flash={flash} />
    </g>
  );
};

/** Stehende Figur im Gewand, Ursprung zwischen den Füssen. `dir` 1 = Blick nach rechts */
const Standing: React.FC<{
  x: number;
  k: number;
  dir?: 1 | -1;
  head?: "scarf" | "cloth" | "beard";
  point?: number;
  open?: number;
  bow?: number;
  robe: [string, string];
  id: string;
}> = ({ x, k, dir = 1, head = "cloth", point = 0, open = 0, bow = 0, robe, id }) => {
  // Arm: hängend → zeigend (vorne) bzw. geöffnet (beide)
  const shoulder: [number, number] = [44, -360];
  const hang: [number, number] = [70, -190];
  const aim: [number, number] = [210, -410];
  const lift: [number, number] = [190, -470];
  const target = point > 0 ? aim : lift;
  const m = Math.max(point, open);
  const hand: [number, number] = [hang[0] + (target[0] - hang[0]) * m, hang[1] + (target[1] - hang[1]) * m];
  const elbow: [number, number] = [(shoulder[0] + hand[0]) / 2 + 14 * (1 - m), (shoulder[1] + hand[1]) / 2 + 24 * (1 - m)];
  const backHand: [number, number] = open > 0 ? [-hand[0], hand[1]] : [-68, -190];
  const backElbow: [number, number] = open > 0 ? [-elbow[0], elbow[1]] : [-56, -270];
  const headY = -430 + bow * 18;
  const headX = 8 + bow * 14;
  return (
    <g transform={`translate(${x} ${GROUND_Y}) scale(${dir * k} ${k})`}>
      <defs>
        <linearGradient id={`robe-${id}`} x1={-90} y1={0} x2={90} y2={0} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={robe[0]} />
          <stop offset="100%" stopColor={robe[1]} />
        </linearGradient>
      </defs>
      <ellipse cx={0} cy={2} rx={100} ry={11} fill="#000" opacity={0.35} />
      <path d={`M -44 -350 L ${backElbow[0]} ${backElbow[1]} L ${backHand[0]} ${backHand[1]}`} stroke={robe[0]} strokeWidth={26} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M -88 0 L -62 -240 L -76 -360 Q -40 -392 0 -392 Q 40 -392 76 -360 L 62 -240 L 88 0 Z" fill={`url(#robe-${id})`} />
      <circle cx={headX} cy={headY} r={36} fill="#24150E" />
      {head === "scarf" ? (
        <path d={`M ${headX - 44} ${headY + 10} Q ${headX - 46} ${headY - 52} ${headX + 2} ${headY - 50} Q ${headX + 46} ${headY - 46} ${headX + 34} ${headY + 4} L ${headX + 22} ${headY + 70} L ${headX - 50} ${headY + 72} Z`} fill={robe[0]} opacity={0.95} />
      ) : (
        <path d={`M ${headX - 40} ${headY + 4} Q ${headX - 40} ${headY - 48} ${headX} ${headY - 46} Q ${headX + 36} ${headY - 44} ${headX + 34} ${headY - 8} L ${headX - 30} ${headY - 14} L ${headX - 46} ${headY + 64} L ${headX - 50} ${headY + 18} Z`} fill="#140C08" />
      )}
      {head !== "scarf" ? <rect x={headX - 40} y={headY - 22} width={74} height={9} rx={4} fill="#5A3A22" /> : null}
      {head === "beard" ? <path d={`M ${headX + 10} ${headY + 18} Q ${headX + 34} ${headY + 56} ${headX + 8} ${headY + 62} Q ${headX - 10} ${headY + 40} ${headX + 10} ${headY + 18} Z`} fill="#140C08" /> : null}
      <path d={`M ${shoulder[0]} ${shoulder[1]} L ${elbow[0]} ${elbow[1]} L ${hand[0]} ${hand[1]}`} stroke={robe[1]} strokeWidth={26} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx={hand[0]} cy={hand[1]} r={13} fill="#3A2214" />
    </g>
  );
};

/* ------------------------------------------------------------------ */
/* Sprechblasen und Zähler                                             */
/* ------------------------------------------------------------------ */

const SpeechBubble: React.FC<{ b: Bubble; pop: number; targetX: number; top: number; tone: "lie" | "truth" | "plain"; dim: number }> = ({ b, pop, targetX, top, tone, dim }) => {
  const look = useLook();
  if (pop <= 0.001) return null;
  const left = b.side === "left" ? 56 : 1080 - 56 - 590;
  const width = 590;
  const border = tone === "lie" ? "#E2483D" : tone === "truth" ? look.accent2 : "#1A120C";
  const tailX = Math.max(60, Math.min(width - 90, targetX - left - 20));
  const size = b.text.length > 40 ? 46 : 56;
  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width,
        opacity: Math.min(1, pop * 1.4) * dim,
        transform: `scale(${interpolate(pop, [0, 1], [0.5, 1])}) rotate(${(1 - pop) * (b.side === "left" ? -6 : 6)}deg)`,
        transformOrigin: `${tailX + 20}px 110%`,
      }}
    >
      {b.who ? (
        <div style={{ display: "inline-block", marginLeft: 18, marginBottom: -6, padding: "8px 18px", borderRadius: 12, background: "#1A120C", border: `3px solid ${border}`, fontFamily: theme.font.body, fontWeight: 800, fontSize: 26, letterSpacing: "0.14em", textTransform: "uppercase", color: tone === "truth" ? look.accent2 : look.accent, position: "relative", zIndex: 2 }}>
          {b.who}
        </div>
      ) : null}
      <div
        style={{
          position: "relative",
          padding: "26px 34px 28px",
          borderRadius: 40,
          background: "#FFF4E2",
          border: `6px solid ${border}`,
          boxShadow: tone === "truth" ? `0 0 50px ${look.accent2}, 0 18px 40px rgba(0,0,0,0.5)` : "0 18px 40px rgba(0,0,0,0.55)",
          fontFamily: theme.font.body,
          fontWeight: 800,
          fontSize: size,
          lineHeight: 1.12,
          color: "#1A120C",
        }}
      >
        {b.text}
        <svg width={70} height={70} style={{ position: "absolute", left: tailX, bottom: -62, overflow: "visible" }}>
          <path d={b.side === "left" ? "M 4 -4 L 56 -4 L 14 60 Z" : "M 4 -4 L 56 -4 L 48 60 Z"} fill="#FFF4E2" stroke={border} strokeWidth={6} strokeLinejoin="round" />
          <rect x={0} y={-14} width={62} height={10} fill="#FFF4E2" />
        </svg>
      </div>
    </div>
  );
};

/** Ein Kettenglied als Zählstein */
const Link: React.FC<{ x: number; y: number; s: number; on: number; pop: number }> = ({ x, y, s, on, pop }) => (
  <g transform={`translate(${x} ${y}) scale(${s * (1 + 0.35 * pop * (1 - pop) * 4)})`}>
    {on > 0 ? <ellipse cx={0} cy={0} rx={52} ry={34} fill="#FF5A2A" opacity={0.25 * on} /> : null}
    <ellipse cx={0} cy={0} rx={34} ry={20} fill="none" stroke="#1A0E0A" strokeWidth={15} />
    <ellipse cx={0} cy={0} rx={34} ry={20} fill="none" stroke={on > 0 ? mix("#8C929C", "#FF7A4A", on) : "rgba(255,241,224,0.35)"} strokeWidth={8} strokeDasharray={on > 0 ? undefined : "10 8"} />
  </g>
);

const LieCounter: React.FC<{ count: number; popAt: number; t: number }> = ({ count, popAt, t }) => {
  const look = useLook();
  const pop = Number.isFinite(popAt) ? interpolate(t, [popAt, popAt + 0.5], [0, 1], clamp) : 1;
  return (
    <>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        {[0, 1, 2].map((i) => {
          const filled = i < count;
          const justNow = i === count - 1 && Number.isFinite(popAt);
          return <Link key={i} x={430 + i * 110} y={292} s={0.9} on={filled ? (justNow ? pop : 1) : 0} pop={justNow ? pop : 0} />;
        })}
      </svg>
      <div style={{ position: "absolute", top: 330, width: "100%", textAlign: "center", fontFamily: theme.font.body, fontWeight: 800, fontSize: 24, letterSpacing: "0.3em", color: look.dim }}>
        LÜGEN {count}/3
      </div>
    </>
  );
};

/* ------------------------------------------------------------------ */
/* Szene                                                               */
/* ------------------------------------------------------------------ */

const ACCUSER_LOOKS: Array<{ head: "scarf" | "cloth" | "beard"; robe: [string, string] }> = [
  { head: "scarf", robe: ["#1C120D", "#7A4A2A"] },
  { head: "cloth", robe: ["#16110F", "#6A4630"] },
  { head: "beard", robe: ["#140E0C", "#7E5232"] },
];

export const FireScene: React.FC<{ ts: TimelineScene }> = ({ ts }) => {
  const s = ts.scene as FireSceneT;
  const frame = useCurrentFrame();
  const t = (frame - ts.audioOffsetFrames) / FPS;
  const tScene = frame / FPS;
  const end = Math.max(1, ts.speechEndSec);
  const cue = (i: number, frac: number) => beat(ts, s.cues[i], ts.speechStartSec + frac * (end - ts.speechStartSec));

  /* Schnur: Stufe zu Beginn, eine Stufe dicker bei bindAt */
  const bindAt = s.bindAt ? beat(ts, s.bindAt, end * 0.85) : Infinity;
  const bound = s.bind + (t >= bindAt ? 1 : 0);
  const tighten = Number.isFinite(bindAt) ? spring({ frame: frame - voiceFrame(ts, bindAt), fps: FPS, config: { damping: 9, stiffness: 160 } }) : 1;
  const bondScale = t >= bindAt ? interpolate(tighten, [0, 1], [1.45, 1]) : 1;
  const flash = t >= bindAt ? interpolate(t, [bindAt, bindAt + 0.9], [1, 0], clamp) : 0;

  /* Sprechblasen */
  const bubbles = s.bubbles.map((b) => ({ b, at: beat(ts, b.at, end * 0.5) }));
  const left = bubbles.find((x) => x.b.side === "left");
  const right = bubbles.find((x) => x.b.side === "right");
  const popOf = (at: number) => spring({ frame: frame - voiceFrame(ts, at - 0.05), fps: FPS, config: { damping: 11, stiffness: 190, mass: 0.7 } });

  /* Feuer */
  let heat = 1;
  if (s.stage === "intro") {
    const fireAt = cue(1, 0.45);
    heat = t < fireAt ? 0.16 : 0.16 + 0.84 * spring({ frame: frame - voiceFrame(ts, fireAt), fps: FPS, config: { damping: 6, stiffness: 90 } });
  }
  const weinAt = s.stage === "rooster" ? cue(2, 0.85) : Infinity;
  if (s.stage === "rooster") heat = interpolate(t, [weinAt - 0.4, weinAt + 0.8], [1, 0.32], clamp);
  const light = interpolate(heat, [0.16, 1], [0.2, 1], clamp) * flicker(tScene);

  /* Petrus steht auf und geht (Hahn) */
  const leaveStart = Number.isFinite(weinAt) ? weinAt - 1.1 : 1e9;
  const leave = interpolate(t, [leaveStart, leaveStart + 1.9], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  const standUp = interpolate(t, [leaveStart - 0.2, leaveStart + 0.15], [0, 1], clamp);

  const accuserIdx = (() => {
    const who = left?.b.who ?? "";
    if (/magd/i.test(who)) return 0;
    if (/anderer/i.test(who)) return 1;
    return 2;
  })();
  const accuserIn = left ? interpolate(t, [Math.max(0.15, left.at - 1.3), Math.max(0.15, left.at - 1.3) + 0.6], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) }) : 0;
  const pointing = left ? interpolate(t, [left.at - 0.15, left.at + 0.25], [0, 1], { ...clamp, easing: ease }) : 0;

  /* Petrus flucht: kurz vor seiner dritten Lüge zittert er */
  const curseAt = s.stage === "accuse" && s.bind === 2 && right ? right.at - 1.4 : Infinity;
  const shake = t > curseAt && t < curseAt + 1.6 ? Math.sin(frame * 2.3) * 5 : 0;

  const peterBubbleTop = 640;
  const leftBubbleTop = 440;

  return (
    <AbsoluteFill>
      {s.stage === "dawn" ? <Dawn t={t} ts={ts} s={s} frame={frame} bound={bound} /> : null}

      {s.stage !== "dawn" ? (
        <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
          {s.stage === "intro" ? <Night t={t} at={cue(0, 0.12)} /> : null}
          {s.stage === "accuse" && findCue(ts.words, "verhaftet") ? <Procession t={t} /> : null}
          {s.stage === "rooster" ? <Gallery t={t} at={cue(1, 0.55)} /> : null}
          <Fire t={tScene} heat={heat} />
          {s.stage === "rooster" && standUp > 0 ? (
            <g opacity={(1 - leave) * standUp}>
              <Standing x={PETER_X + leave * 420} k={1.05} dir={1} head="beard" bow={1} robe={["#1A100B", "#4A2A18"]} id="leave" />
            </g>
          ) : null}
          <g opacity={1 - standUp}>
            <SeatedPeter x={PETER_X} light={light} bond={bound} bondScale={bondScale} flash={flash} shake={shake} />
          </g>
          {left ? (
            <g opacity={accuserIn} transform={`translate(${(1 - accuserIn) * -160} 0)`}>
              <Standing x={ACCUSER_X} k={ACCUSER_K} dir={1} head={ACCUSER_LOOKS[accuserIdx].head} point={pointing} robe={ACCUSER_LOOKS[accuserIdx].robe} id={`acc${accuserIdx}`} />
            </g>
          ) : null}
          {s.stage === "rooster" ? <Rooster t={t} at={cue(0, 0.2)} /> : null}
          {s.stage === "intro" ? <BigLinks t={t} at={cue(2, 0.8)} /> : null}
        </svg>
      ) : null}

      {/* Zähler der Lügen */}
      {s.stage === "accuse" || s.stage === "rooster" ? <LieCounter count={bound} popAt={bindAt} t={t} /> : null}

      {/* Rotes Aufblitzen, wenn die Schnur dicker wird */}
      {flash > 0 ? <AbsoluteFill style={{ background: `radial-gradient(circle at ${PETER_X - 20}px ${GROUND_Y - 240}px, rgba(226,72,61,${0.35 * flash}) 0%, rgba(226,72,61,0) 45%)` }} /> : null}

      {left ? <SpeechBubble b={left.b} pop={popOf(left.at)} targetX={ACCUSER_X + 10} top={leftBubbleTop} tone="plain" dim={right && t > right.at ? 0.72 : 1} /> : null}
      {right && s.stage !== "dawn" ? <SpeechBubble b={right.b} pop={popOf(right.at)} targetX={PETER_X - 45} top={peterBubbleTop} tone="lie" dim={1} /> : null}

      {/* Töne */}
      {bubbles.map(({ at }, i) => (
        <Sfx key={i} frame={voiceFrame(ts, at - 0.05)} name="pop" volume={0.4} />
      ))}
      {Number.isFinite(bindAt) ? <Sfx frame={voiceFrame(ts, bindAt)} name={bound >= 3 ? "clash" : "swipe"} volume={bound >= 3 ? 0.5 : 0.4} /> : null}
      {s.stage === "intro" ? (
        <>
          <Sfx frame={voiceFrame(ts, cue(1, 0.45))} name="whoosh" volume={0.45} />
          {[0, 1, 2].map((i) => (
            <Sfx key={i} frame={voiceFrame(ts, cue(2, 0.8) + i * 0.16)} name="clash" volume={0.32} />
          ))}
        </>
      ) : null}
      {s.stage === "rooster" ? (
        <>
          <Sfx frame={voiceFrame(ts, cue(0, 0.2))} name="drum" volume={0.6} />
          <Sfx frame={voiceFrame(ts, cue(0, 0.2)) + 2} name="whoosh" volume={0.45} />
          <Sfx frame={voiceFrame(ts, cue(1, 0.55))} name="chime" volume={0.3} />
        </>
      ) : null}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* Nacht, Prozession, Galerie, Hahn, grosse Glieder                    */
/* ------------------------------------------------------------------ */

const Night: React.FC<{ t: number; at: number }> = ({ t, at }) => {
  const k = interpolate(t, [at - 0.1, at + 0.9], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const cx = 830;
  const cy = 250 - 40 * k;
  return (
    <g opacity={k}>
      <circle cx={cx} cy={cy} r={140} fill="#F4E9C8" opacity={0.08} />
      <circle cx={cx} cy={cy} r={58} fill="#F6EED6" />
      <circle cx={cx + 26} cy={cy - 12} r={52} fill="#0B0A18" />
    </g>
  );
};

/** Jesus wird abgeführt – Fackeln ziehen durch die Galerie */
const Procession: React.FC<{ t: number }> = ({ t }) => {
  const { x0, x1, rail } = GALLERY;
  const p = interpolate(t, [0.2, 3.6], [0, 1], clamp);
  const fade = interpolate(t, [0.1, 0.5, 3.0, 3.8], [0, 1, 1, 0], clamp);
  if (fade <= 0) return null;
  return (
    <g opacity={fade}>
      <defs>
        <clipPath id="galleryClip">
          <path d={galleryPath()} />
        </clipPath>
        <radialGradient id="torchGlow">
          <stop offset="0%" stopColor="#FFD27A" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#FF8A2A" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g clipPath="url(#galleryClip)">
        {[0, 1, 2, 3].map((i) => {
          const x = x0 - 120 + (x1 - x0 + 260) * p - i * 64;
          const bob = Math.abs(Math.sin(t * 6 + i)) * 4;
          const torch = i === 0 || i === 3;
          return (
            <g key={i} transform={`translate(${x} ${rail - bob})`}>
              {torch ? <circle cx={22} cy={-122} r={46} fill="url(#torchGlow)" /> : null}
              {torch ? <line x1={14} y1={-60} x2={22} y2={-118} stroke="#3A2214" strokeWidth={5} /> : null}
              {torch ? <circle cx={22} cy={-122} r={8} fill="#FFE2A0" /> : null}
              <path d="M -20 0 L -14 -70 Q 0 -80 14 -70 L 20 0 Z" fill={i === 1 ? "#4A3A30" : "#0C0806"} />
              <circle cx={0} cy={-86} r={13} fill={i === 1 ? "#5A463A" : "#0C0806"} />
            </g>
          );
        })}
      </g>
    </g>
  );
};

/** Jesus in der Galerie – er dreht sich um und sieht Petrus an */
const Gallery: React.FC<{ t: number; at: number }> = ({ t, at }) => {
  const { x0, x1, rail } = GALLERY;
  const cx = (x0 + x1) / 2;
  const show = interpolate(t, [0, 0.8], [0, 1], clamp);
  const turn = interpolate(t, [at - 0.2, at + 0.45], [0, 1], { ...clamp, easing: ease });
  const face = Math.cos(turn * Math.PI); // 1 → −1: dreht sich von links nach rechts
  const beam = interpolate(t, [at + 0.2, at + 1.0], [0, 1], clamp);
  const halo = 0.35 + 0.65 * turn;
  return (
    <g opacity={show}>
      <defs>
        <radialGradient id="jesusHalo">
          <stop offset="0%" stopColor="#FFF6DD" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#FFE2A0" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="beamGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFF3D0" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#FFE2A0" stopOpacity="0" />
        </linearGradient>
        <clipPath id="galleryClip2">
          <path d={galleryPath()} />
        </clipPath>
      </defs>
      <path d={`M ${cx + 10} ${rail - 120} L ${cx + 60} ${rail - 140} L ${PETER_X - 10} ${GROUND_Y - 330} L ${PETER_X - 120} ${GROUND_Y - 300} Z`} fill="url(#beamGrad)" opacity={beam * 0.8} />
      <g clipPath="url(#galleryClip2)">
        <circle cx={cx} cy={rail - 110} r={150} fill="url(#jesusHalo)" opacity={halo} />
        <g transform={`translate(${cx} ${rail}) scale(${face} 1)`}>
          <path d="M -58 10 L -50 -86 Q -30 -106 0 -106 Q 30 -106 50 -86 L 58 10 Z" fill="#E9DFC9" />
          <circle cx={-4} cy={-136} r={27} fill="#D8C9AE" />
          <path d="M -32 -132 Q -30 -170 0 -168 Q 26 -166 26 -140 L 14 -100 L -36 -104 Z" fill="#C9B595" />
          {/* Nase zeigt die Blickrichtung */}
          <path d="M -30 -138 L -40 -128 L -29 -126 Z" fill="#D8C9AE" />
        </g>
      </g>
    </g>
  );
};

/** Der Hahn auf der Mauer – mit grossem KIKERIKI */
const Rooster: React.FC<{ t: number; at: number }> = ({ t, at }) => {
  const look = useLook();
  const p = spring({ frame: Math.round((t - at + 0.1) * FPS), fps: FPS, config: { damping: 9, stiffness: 170 } });
  if (t < at - 0.15) return null;
  const crow = interpolate(t, [at, at + 0.25, at + 1.6, at + 2.4], [0, 1, 1, 0.0], clamp);
  const x = 900;
  const y = WALL_TOP;
  const beak = interpolate(t, [at, at + 0.15, at + 1.4, at + 1.6], [0, 1, 1, 0], clamp);
  return (
    <g>
      <g transform={`translate(${x} ${y}) scale(${interpolate(p, [0, 1], [0.4, 1.25])})`} opacity={Math.min(1, p * 1.5)}>
        {/* Schwanzfedern */}
        <path d="M 30 -60 Q 90 -150 70 -40 Q 96 -110 60 -20 Z" fill="#0A0605" />
        <path d="M 40 -50 Q 110 -110 64 -10 Z" fill="#0A0605" />
        {/* Körper */}
        <path d="M -50 -40 Q -60 -90 -20 -96 Q 30 -80 60 -30 Q 50 0 0 0 Q -40 0 -50 -40 Z" fill="#0A0605" />
        {/* Hals, Kopf, Kamm, Kehllappen, Schnabel */}
        <path d="M -40 -70 Q -52 -120 -30 -140 Q -10 -126 -18 -86 Z" fill="#0A0605" />
        <circle cx={-34} cy={-142} r={16} fill="#0A0605" />
        <path d="M -48 -156 Q -44 -176 -36 -160 Q -32 -180 -24 -160 Q -18 -176 -16 -152 Z" fill="#B5302A" />
        <path d="M -42 -132 Q -46 -118 -38 -116 Q -34 -124 -36 -132 Z" fill="#B5302A" />
        <path d={`M -48 -146 L -66 ${-140 - beak * 6} L -50 -140 Z`} fill="#E0A030" />
        <path d={`M -48 -140 L -64 ${-134 + beak * 8} L -50 -136 Z`} fill="#E0A030" />
        {/* Beine */}
        <path d="M -8 -2 L -12 22 M 14 -2 L 16 22" stroke="#0A0605" strokeWidth={6} />
      </g>
      {/* Schallwellen und Schriftzug */}
      <g opacity={crow}>
        {[0, 1, 2].map((i) => {
          const r = 60 + ((t - at) * 260 + i * 70) % 220;
          return <path key={i} d={`M ${x - 80} ${y - 150 - r * 0.5} A ${r} ${r} 0 0 0 ${x - 80} ${y - 150 + r * 0.5}`} stroke={look.accent2} strokeWidth={6} fill="none" opacity={Math.max(0, 1 - r / 280)} transform={`translate(${-r * 0.4} 0)`} />;
        })}
        <text x={x - 130} y={y - 210} textAnchor="end" fontFamily={theme.font.display} fontSize={interpolate(crow, [0, 1], [60, 118])} fill={look.accent2} transform={`rotate(-9 ${x - 130} ${y - 210})`} style={{ filter: `drop-shadow(0 0 22px ${look.accent})`, letterSpacing: 4 }}>
          KIKERIKI!
        </text>
      </g>
    </g>
  );
};

/** «Drei Lügen»: drei leere Kettenglieder springen ins Bild */
const BigLinks: React.FC<{ t: number; at: number }> = ({ t, at }) => (
  <g>
    {[0, 1, 2].map((i) => {
      const a = at + i * 0.16;
      const p = spring({ frame: Math.round((t - a) * FPS), fps: FPS, config: { damping: 10, stiffness: 200 } });
      if (t < a) return null;
      const x = 540 + (i - 1) * 190;
      return (
        <g key={i} transform={`translate(${x} 640) scale(${interpolate(p, [0, 1], [1.8, 2.2])}) rotate(${i === 1 ? 0 : i === 0 ? -8 : 8})`} opacity={Math.min(1, p * 1.3)}>
          <ellipse cx={0} cy={0} rx={60} ry={42} fill="#E2483D" opacity={0.18} />
          <ellipse cx={0} cy={0} rx={38} ry={23} fill="none" stroke="#120A08" strokeWidth={16} />
          <ellipse cx={0} cy={0} rx={38} ry={23} fill="none" stroke="#A9B0BA" strokeWidth={9} />
          <ellipse cx={-4} cy={-6} rx={30} ry={14} fill="none" stroke="#E7ECF2" strokeWidth={2.5} opacity={0.7} />
        </g>
      );
    })}
  </g>
);

/* ------------------------------------------------------------------ */
/* Morgen: vor dem Hohen Rat – die Kette springt                        */
/* ------------------------------------------------------------------ */

const Dawn: React.FC<{ t: number; ts: TimelineScene; s: FireSceneT; frame: number; bound: number }> = ({ t, ts, s, frame, bound }) => {
  const end = Math.max(1, ts.speechEndSec);
  const breakAt = s.breakAt ? beat(ts, s.breakAt, end * 0.7) : Infinity;
  const broken = t >= breakAt;
  const burst = broken ? interpolate(t, [breakAt, breakAt + 1.1], [0, 1], clamp) : 0;
  const open = broken ? interpolate(t, [breakAt + 0.05, breakAt + 0.6], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.4)) }) : 0;
  const morning = interpolate(t, [-0.4, 0.6], [0.7, 1], clamp);
  const councilAt = beat(ts, "Sie verbieten ihm", end * 0.35) - 0.6;
  const council = interpolate(t, [councilAt, councilAt + 0.6], [0, 1], clamp);
  const bubble = s.bubbles[0];
  const bubbleAt = bubble ? beat(ts, bubble.at, breakAt) : Infinity;
  const pop = Number.isFinite(bubbleAt) ? spring({ frame: frame - voiceFrame(ts, bubbleAt - 0.05), fps: FPS, config: { damping: 11, stiffness: 190, mass: 0.7 } }) : 0;
  const shards = useMemo(
    () => Array.from({ length: 14 }, (_, i) => ({ a: (i / 14) * Math.PI * 2 + random(`sh${i}`) * 0.3, v: 380 + random(`sv${i}`) * 420, rot: (random(`sr${i}`) - 0.5) * 720 })),
    [],
  );
  const ringY = GROUND_Y - 300 * STAND_K;
  return (
    <>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <linearGradient id="dawnSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5E8FD0" />
            <stop offset="65%" stopColor="#F2C892" />
            <stop offset="100%" stopColor="#FFD9A0" />
          </linearGradient>
          <linearGradient id="dawnWash" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FFE7B8" stopOpacity="0.32" />
            <stop offset="60%" stopColor="#9FC2F0" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#0B0706" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="truthBurst">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="35%" stopColor="#FFE7A0" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#FFD36B" stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* Morgenhimmel und Licht in der Galerie */}
        <rect x={0} y={0} width={1080} height={WALL_TOP + 30} fill="url(#dawnSky)" opacity={morning} />
        <path d={galleryPath()} fill="#FFE2B0" opacity={0.55 * morning} />
        <rect x={0} y={0} width={1080} height={1920} fill="url(#dawnWash)" opacity={morning} />
        {/* Lichtstrahlen von links oben */}
        {[0, 1, 2].map((i) => (
          <path key={i} d={`M ${-100 + i * 160} 0 L ${40 + i * 160} 0 L ${520 + i * 200} 1200 L ${300 + i * 200} 1200 Z`} fill="#FFF0C8" opacity={(0.07 + 0.03 * Math.sin(t * 1.2 + i)) * morning} />
        ))}
        {/* Hoher Rat */}
        <g opacity={council}>
          {[110, 235].map((x, i) => (
            <Standing key={i} x={x} k={0.82} dir={1} head={i === 0 ? "beard" : "cloth"} point={i === 1 ? interpolate(t, [councilAt + 0.5, councilAt + 1.0], [0, 1], clamp) : 0} robe={["#2A2230", "#5A4A5E"]} id={`rat${i}`} />
          ))}
          {[ -10, 350].map((x, i) => (
            <Standing key={`b${i}`} x={x} k={0.74} dir={1} head="cloth" robe={["#221B28", "#463A4C"]} id={`ratb${i}`} />
          ))}
        </g>
        {/* Lichtausbruch */}
        {broken ? <circle cx={STAND_X} cy={ringY} r={interpolate(burst, [0, 1], [60, 900])} fill="url(#truthBurst)" opacity={1 - burst * 0.75} /> : null}
        {/* Petrus steht */}
        <Standing x={STAND_X} k={STAND_K} dir={-1} head="beard" open={open} robe={["#3A2A1E", "#7A5A3A"]} id="stand" />
        {!broken ? (
          <>
            <Bond cx={STAND_X} cy={ringY} rx={92} ry={24} level={bound} half="front" />
          </>
        ) : (
          shards.map((sh, i) => {
            const d = burst * sh.v;
            const x = STAND_X + Math.cos(sh.a) * d;
            const y = ringY + Math.sin(sh.a) * d * 0.7 + 400 * burst * burst;
            return (
              <g key={i} transform={`translate(${x} ${y}) rotate(${sh.rot * burst})`} opacity={1 - burst}>
                <ellipse cx={0} cy={0} rx={20} ry={12} fill="none" stroke="#B7BEC8" strokeWidth={6} />
              </g>
            );
          })
        )}
      </svg>
      {bubble ? <SpeechBubble b={bubble} pop={pop} targetX={STAND_X + 10} top={400} tone="truth" dim={1} /> : null}
      {Number.isFinite(breakAt) ? (
        <>
          <Sfx frame={voiceFrame(ts, breakAt)} name="unlock" volume={0.5} />
          <Sfx frame={voiceFrame(ts, breakAt) + 3} name="levelup" volume={0.35} />
        </>
      ) : null}
    </>
  );
};
