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
type Pt = [number, number];
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = Easing.inOut(Easing.cubic);

/** Wo Petrus am Feuer sitzt */
const PETER_X = 800;
const PETER_K = 1.2;
/** Wo die Ankläger stehen */
const ACCUSER_X = 230;
const ACCUSER_K = 1.0;
/** Petrus im Morgenlicht */
const STAND_X = 650;
const STAND_K = 0.98;
/** Sprechblasen: links für die Ankläger, rechts für Petrus */
const BUBBLE_W = 480;
const BUBBLE_TOP = { left: 405, right: 445 } as const;

/** Zwei Farben mischen (#rrggbb) */
const mix = (a: string, b: string, k: number) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * Math.max(0, Math.min(1, k))));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
};

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

const FIRE_LAYERS: Array<{ color: string; k: number; o: number }> = [
  { color: "#E8461E", k: 1, o: 0.9 },
  { color: "#FF8A2A", k: 0.78, o: 0.95 },
  { color: "#FFC85A", k: 0.55, o: 0.95 },
  { color: "#FFF3C8", k: 0.3, o: 0.9 },
];

/** Feuerstelle: Steinring, Scheite, Flammen in Schichten, Funken. `heat` 0 = Glut, 1 = volles Feuer */
const Fire: React.FC<{ t: number; heat: number }> = ({ t, heat }) => {
  const base = GROUND_Y - 40;
  const f = flicker(t);
  const sparks = useMemo(
    () => Array.from({ length: 18 }, (_, i) => ({ dx: (random(`fs${i}`) - 0.5) * 160, v: 140 + random(`fv${i}`) * 180, p: random(`fp${i}`), r: 2 + random(`fr${i}`) * 3 })),
    [],
  );
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
      <rect x={FIRE_X - 120} y={base - 12} width={240} height={26} rx={13} fill="#3A2214" transform={`rotate(-12 ${FIRE_X} ${base})`} />
      <rect x={FIRE_X - 120} y={base - 12} width={240} height={26} rx={13} fill="#2C190F" transform={`rotate(14 ${FIRE_X} ${base})`} />
      <ellipse cx={FIRE_X} cy={base + 4} rx={110} ry={16} fill="#FF7A2A" opacity={0.35 + 0.35 * heat} />
      {/* Flammen */}
      {FIRE_LAYERS.map((l, li) => (
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

/** Ein Kettenglied von vorne (Ring) oder von der Seite (Steg) */
const ChainLink: React.FC<{ x: number; y: number; ang: number; face: boolean; s: number; metal: string }> = ({ x, y, ang, face, s, metal }) =>
  face ? (
    <g transform={`translate(${x} ${y}) rotate(${ang}) scale(${s})`}>
      <ellipse cx={0} cy={0} rx={20} ry={12} fill="none" stroke="#15181D" strokeWidth={12} />
      <ellipse cx={0} cy={0} rx={20} ry={12} fill="none" stroke={metal} strokeWidth={7} />
      <path d="M -14 -6 Q 0 -12 14 -6" stroke="#F2F5F8" strokeWidth={2} fill="none" opacity={0.7} />
    </g>
  ) : (
    <g transform={`translate(${x} ${y}) rotate(${ang}) scale(${s})`}>
      <rect x={-19} y={-5.5} width={38} height={11} rx={5.5} fill="#15181D" />
      <rect x={-17} y={-3} width={34} height={6} rx={3} fill={metal} />
    </g>
  );

/** Halber Ring um den Oberkörper: hinten (oben im Bild) oder vorne. `level` 1 Schnur, 2 Strick, 3 Kette */
const Bond: React.FC<{ cx: number; cy: number; rx: number; ry: number; level: number; half: "back" | "front"; flash?: number }> = ({ cx, cy, rx, ry, level, half, flash = 0 }) => {
  if (level <= 0) return null;
  const a0 = half === "back" ? Math.PI : 0;
  const a1 = half === "back" ? Math.PI * 2 : Math.PI;
  const pt = (a: number): Pt => [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry];
  const [sx, sy] = pt(a0);
  const [ex, ey] = pt(a1);
  const arc = `M ${sx} ${sy} A ${rx} ${ry} 0 0 1 ${ex} ${ey}`;
  const dim = half === "back" ? 0.5 : 1;
  if (level === 1) {
    return (
      <g opacity={dim}>
        <path d={arc} stroke="#3A2A14" strokeWidth={8} fill="none" strokeLinecap="round" />
        <path d={arc} stroke="#E2C88E" strokeWidth={5} fill="none" strokeLinecap="round" />
        <path d={arc} stroke="#8C6A35" strokeWidth={5} fill="none" strokeDasharray="3 8" strokeLinecap="round" />
      </g>
    );
  }
  if (level === 2) {
    return (
      <g opacity={dim}>
        <path d={arc} stroke="#2A1608" strokeWidth={22} fill="none" strokeLinecap="round" />
        <path d={arc} stroke="#A0632C" strokeWidth={16} fill="none" strokeLinecap="round" />
        <path d={arc} stroke="#DCA866" strokeWidth={16} fill="none" strokeDasharray="5 10" />
      </g>
    );
  }
  /* Kette: Glieder entlang der Ellipse, abwechselnd von vorne und von der Seite */
  const n = 10;
  const metal = flash > 0 ? mix("#B9C0CA", "#FF7A4A", flash) : "#B9C0CA";
  return (
    <g opacity={dim}>
      {Array.from({ length: n + 1 }, (_, i) => {
        const a = a0 + ((a1 - a0) * i) / n;
        const [x, y] = pt(a);
        const ang = (Math.atan2(Math.cos(a) * ry, -Math.sin(a) * rx) * 180) / Math.PI;
        return <ChainLink key={i} x={x} y={y} ang={ang} face={i % 2 === 0} s={1.15} metal={metal} />;
      })}
    </g>
  );
};

/* ------------------------------------------------------------------ */
/* Figuren: dunkle Silhouetten mit Streiflicht vom Feuer                */
/* ------------------------------------------------------------------ */

type FigureProps = { fill: string; arm: string };

/** Petrus sitzend, Blick nach links (zum Feuer). Ursprung: Boden unter dem Sitz */
const SeatedShape: React.FC<FigureProps> = ({ fill, arm }) => (
  <g>
    <path
      d="M 52 -72 C 66 -150, 50 -245, 14 -290 C -6 -306, -42 -300, -56 -282 C -70 -250, -66 -170, -54 -118 L -64 -104 C -100 -112, -140 -116, -158 -100 C -168 -90, -162 -60, -156 -24 L -160 -6 L -112 -6 C -116 -40, -116 -70, -104 -82 C -60 -84, -10 -86, 52 -72 Z"
      fill={fill}
    />
    <ellipse cx={-150} cy={-4} rx={28} ry={8} fill={fill} />
    {/* Arm zum Feuer, Hände wärmen sich */}
    <path d="M -26 -268 C -54 -246, -74 -222, -86 -200 L -146 -214" stroke={arm} strokeWidth={30} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    {/* Kopf leicht gesenkt, Kopftuch, Bart */}
    <circle cx={-36} cy={-322} r={33} fill={fill} />
    <path d="M -70 -326 C -68 -370, -18 -380, 6 -352 C 16 -334, 14 -300, 24 -274 L -4 -280 C -4 -300, -10 -316, -30 -326 C -46 -330, -60 -326, -70 -318 Z" fill={fill} />
    <path d="M -64 -310 C -72 -290, -58 -280, -42 -284 L -38 -304 Z" fill={fill} />
  </g>
);

const SeatedPeter: React.FC<{ x: number; light: number; bond: number; bondScale: number; flash: number; shake: number }> = ({ x, light, bond, bondScale, flash, shake }) => {
  const ring = { cx: -18, cy: -196, rx: 68 * bondScale, ry: 19 * bondScale };
  const rim = mix("#3A1A0C", "#FF9A4A", light);
  return (
    <g transform={`translate(${x + shake} ${GROUND_Y}) scale(${PETER_K})`}>
      <ellipse cx={-50} cy={2} rx={150} ry={12} fill="#000" opacity={0.4} />
      {/* Sitzstein */}
      <path d="M -52 0 C -60 -40, -50 -76, -10 -80 C 30 -84, 66 -70, 70 -36 C 72 -14, 64 0, 60 0 Z" fill="#241913" stroke="#120C09" strokeWidth={3} />
      <path d="M -40 -50 C -30 -70, 10 -76, 40 -62" stroke={rim} strokeWidth={4} fill="none" opacity={0.5} />
      <Bond {...ring} level={bond} half="back" flash={flash} />
      {/* Streiflicht links (zum Feuer), darüber die dunkle Gestalt */}
      <g transform="translate(-6 -1)">
        <SeatedShape fill={rim} arm={rim} />
      </g>
      <SeatedShape fill="#120B08" arm="#160E0A" />
      <circle cx={-150} cy={-214} r={11} fill={mix("#3A1C0E", "#F2A060", light)} />
      <Bond {...ring} level={bond} half="front" flash={flash} />
    </g>
  );
};

/** Stehende Gestalt, Blick nach rechts. Ursprung zwischen den Füssen */
const StandingShape: React.FC<FigureProps & { head: "scarf" | "cloth" | "beard"; point: number; open: number; bow: number }> = ({ fill, arm, head, point, open, bow }) => {
  const shoulder: Pt = [26, -350];
  const hang: { e: Pt; h: Pt } = { e: [42, -282], h: [46, -214] };
  const aim: { e: Pt; h: Pt } = { e: [104, -372], h: [184, -402] };
  const lift: { e: Pt; h: Pt } = { e: [92, -420], h: [150, -478] };
  const lerp = (a: Pt, b: Pt, k: number): Pt => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  const target = point > 0 ? aim : lift;
  const m = Math.max(point, open);
  const e = lerp(hang.e, target.e, m);
  const h = lerp(hang.h, target.h, m);
  const be: Pt = open > 0 ? lerp([-28, -282], [-92, -420], open) : [-28, -282];
  const bh: Pt = open > 0 ? lerp([-24, -214], [-150, -478], open) : [-24, -214];
  const hx = 8 + bow * 16;
  const hy = -404 + bow * 20;
  return (
    <g>
      <path d={`M -20 -350 L ${be[0]} ${be[1]} L ${bh[0]} ${bh[1]}`} stroke={arm} strokeWidth={24} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M -66 0 C -62 -90, -56 -170, -50 -236 C -48 -290, -58 -330, -42 -358 C -24 -382, 26 -384, 44 -362 C 58 -336, 54 -296, 50 -246 C 54 -170, 62 -90, 72 0 Z" fill={fill} />
      <circle cx={hx} cy={hy} r={31} fill={fill} />
      {head === "scarf" ? (
        <path d={`M ${hx - 38} ${hy + 12} C ${hx - 46} ${hy - 48}, ${hx + 42} ${hy - 50}, ${hx + 34} ${hy + 4} C ${hx + 32} ${hy + 18}, ${hx + 26} ${hy + 30}, ${hx + 44} ${hy + 58} L ${hx - 62} ${hy + 60} C ${hx - 50} ${hy + 38}, ${hx - 40} ${hy + 26}, ${hx - 38} ${hy + 12} Z`} fill={fill} />
      ) : (
        <path d={`M ${hx - 34} ${hy + 6} C ${hx - 38} ${hy - 40}, ${hx + 32} ${hy - 46}, ${hx + 34} ${hy - 4} L ${hx + 26} ${hy - 12} C ${hx + 12} ${hy - 22}, ${hx - 18} ${hy - 20}, ${hx - 24} ${hy + 4} L ${hx - 40} ${hy + 54} L ${hx - 52} ${hy + 44} Z`} fill={fill} />
      )}
      {head === "beard" ? <path d={`M ${hx + 10} ${hy + 12} C ${hx + 30} ${hy + 18}, ${hx + 34} ${hy + 44}, ${hx + 18} ${hy + 54} C ${hx + 4} ${hy + 48}, ${hx} ${hy + 28}, ${hx + 10} ${hy + 12} Z`} fill={fill} /> : null}
      <path d={`M ${shoulder[0]} ${shoulder[1]} L ${e[0]} ${e[1]} L ${h[0]} ${h[1]}`} stroke={arm} strokeWidth={24} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </g>
  );
};

const Standing: React.FC<{
  x: number;
  k: number;
  dir?: 1 | -1;
  head?: "scarf" | "cloth" | "beard";
  point?: number;
  open?: number;
  bow?: number;
  fill?: string;
  /** Streiflicht: Farbe und Seite (in Blickrichtung +1 vorne, −1 hinten, 0 beidseitig) */
  rim: string;
  rimSide?: 1 | -1 | 0;
}> = ({ x, k, dir = 1, head = "cloth", point = 0, open = 0, bow = 0, fill = "#130C09", rim, rimSide = 1 }) => {
  const shape = { head, point, open, bow };
  const sides = rimSide === 0 ? [-1, 1] : [rimSide];
  return (
    <g transform={`translate(${x} ${GROUND_Y}) scale(${dir * k} ${k})`}>
      <ellipse cx={0} cy={2} rx={95} ry={11} fill="#000" opacity={0.35} />
      {sides.map((sd) => (
        <g key={sd} transform={`translate(${sd * 5} -1)`}>
          <StandingShape fill={rim} arm={rim} {...shape} />
        </g>
      ))}
      <StandingShape fill={fill} arm={fill} {...shape} />
    </g>
  );
};

/* ------------------------------------------------------------------ */
/* Sprechblasen und Zähler                                             */
/* ------------------------------------------------------------------ */

const SpeechBubble: React.FC<{ b: Bubble; pop: number; targetX: number; left: number; top: number; width: number; tone: "lie" | "truth" | "plain"; dim: number }> = ({
  b,
  pop,
  targetX,
  left,
  top,
  width,
  tone,
  dim,
}) => {
  const look = useLook();
  if (pop <= 0.001) return null;
  const border = tone === "lie" ? "#E2483D" : tone === "truth" ? look.accent2 : "#1A120C";
  const tailX = Math.max(40, Math.min(width - 90, targetX - left - 28));
  const size = b.text.length > 40 ? 46 : b.text.length > 24 ? 50 : 54;
  const towardsRight = targetX - left - 28 > width / 2;
  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width,
        opacity: Math.min(1, pop * 1.4) * dim,
        transform: `scale(${interpolate(pop, [0, 1], [0.5, 1])}) rotate(${(1 - pop) * (b.side === "left" ? -6 : 6)}deg)`,
        transformOrigin: `${tailX + 28}px 120%`,
      }}
    >
      {b.who ? (
        <div
          style={{
            display: "inline-block",
            marginLeft: 22,
            marginBottom: -8,
            padding: "8px 18px",
            borderRadius: 12,
            background: "#1A120C",
            border: `3px solid ${border}`,
            fontFamily: theme.font.body,
            fontWeight: 800,
            fontSize: 24,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: tone === "truth" ? look.accent2 : look.accent,
            position: "relative",
            zIndex: 2,
          }}
        >
          {b.who}
        </div>
      ) : null}
      <div
        style={{
          position: "relative",
          padding: "24px 30px 26px",
          borderRadius: 38,
          background: "#FFF4E2",
          border: `6px solid ${border}`,
          boxShadow: tone === "truth" ? `0 0 60px ${look.accent2}, 0 18px 40px rgba(0,0,0,0.5)` : "0 18px 40px rgba(0,0,0,0.55)",
          fontFamily: theme.font.body,
          fontWeight: 800,
          fontSize: size,
          lineHeight: 1.12,
          color: "#1A120C",
        }}
      >
        {b.text}
        <svg width={70} height={70} style={{ position: "absolute", left: tailX, bottom: -60, overflow: "visible" }}>
          <path d={towardsRight ? "M 4 -4 L 56 -4 L 48 60 Z" : "M 4 -4 L 56 -4 L 12 60 Z"} fill="#FFF4E2" stroke={border} strokeWidth={6} strokeLinejoin="round" />
          <rect x={0} y={-14} width={62} height={10} fill="#FFF4E2" />
        </svg>
      </div>
    </div>
  );
};

/** Zählstein: ein Kettenglied, leer (gestrichelt) oder glühend */
const CounterLink: React.FC<{ x: number; y: number; on: number; pop: number }> = ({ x, y, on, pop }) => (
  <g transform={`translate(${x} ${y}) scale(${0.95 + 0.6 * pop * (1 - pop) * 4})`}>
    {on > 0 ? <ellipse cx={0} cy={0} rx={54} ry={36} fill="#FF5A2A" opacity={0.28 * on} /> : null}
    <ellipse cx={0} cy={0} rx={34} ry={20} fill="none" stroke="#1A0E0A" strokeWidth={15} opacity={on > 0 ? 1 : 0.4} />
    <ellipse cx={0} cy={0} rx={34} ry={20} fill="none" stroke={on > 0 ? mix("#8C929C", "#FF7A4A", on) : "rgba(255,241,224,0.4)"} strokeWidth={8} strokeDasharray={on > 0 ? undefined : "10 8"} />
  </g>
);

const LieCounter: React.FC<{ count: number; popAt: number; t: number }> = ({ count, popAt, t }) => {
  const look = useLook();
  const pop = Number.isFinite(popAt) ? interpolate(t, [popAt, popAt + 0.5], [0, 1], clamp) : 1;
  return (
    <>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        {[0, 1, 2].map((i) => {
          const justNow = i === count - 1 && Number.isFinite(popAt);
          return <CounterLink key={i} x={430 + i * 110} y={286} on={i < count ? (justNow ? pop : 1) : 0} pop={justNow ? pop : 0} />;
        })}
      </svg>
      <div style={{ position: "absolute", top: 322, width: "100%", textAlign: "center", fontFamily: theme.font.body, fontWeight: 800, fontSize: 24, letterSpacing: "0.3em", color: count > 0 ? look.accent : look.dim }}>
        LÜGEN {count}/3
      </div>
    </>
  );
};

/* ------------------------------------------------------------------ */
/* Szene                                                               */
/* ------------------------------------------------------------------ */

const ACCUSERS: Array<"scarf" | "cloth" | "beard"> = ["scarf", "cloth", "beard"];

export const FireScene: React.FC<{ ts: TimelineScene }> = ({ ts }) => {
  const s = ts.scene as FireSceneT;
  const frame = useCurrentFrame();
  const t = (frame - ts.audioOffsetFrames) / FPS;
  const tScene = frame / FPS;
  const end = Math.max(1, ts.speechEndSec);
  const cue = (i: number, frac: number) => beat(ts, s.cues[i], ts.speechStartSec + frac * (end - ts.speechStartSec));

  if (s.stage === "dawn") return <Dawn ts={ts} s={s} frame={frame} t={t} />;

  /* Schnur: Stufe zu Beginn, eine Stufe dicker bei bindAt */
  const bindAt = s.bindAt ? beat(ts, s.bindAt, end * 0.85) : Infinity;
  const bound = s.bind + (t >= bindAt ? 1 : 0);
  const tighten = Number.isFinite(bindAt) ? spring({ frame: frame - voiceFrame(ts, bindAt), fps: FPS, config: { damping: 9, stiffness: 160 } }) : 1;
  const bondScale = t >= bindAt ? interpolate(tighten, [0, 1], [1.5, 1]) : 1;
  const flash = t >= bindAt ? interpolate(t, [bindAt, bindAt + 0.9], [1, 0], clamp) : 0;

  /* Sprechblasen */
  const bubbles = s.bubbles.map((b) => ({ b, at: beat(ts, b.at, end * 0.5) }));
  const left = bubbles.find((x) => x.b.side === "left");
  const right = bubbles.find((x) => x.b.side === "right");
  const popOf = (at: number) => spring({ frame: frame - voiceFrame(ts, at - 0.05), fps: FPS, config: { damping: 11, stiffness: 190, mass: 0.7 } });

  /* Feuer */
  let heat = 1;
  const fireAt = s.stage === "intro" ? cue(1, 0.45) : 0;
  if (s.stage === "intro") {
    heat = t < fireAt ? 0.16 : 0.16 + 0.84 * spring({ frame: frame - voiceFrame(ts, fireAt), fps: FPS, config: { damping: 6, stiffness: 90 } });
  }
  const weinAt = s.stage === "rooster" ? cue(2, 0.85) : 1e9;
  if (s.stage === "rooster") heat = interpolate(t, [weinAt - 0.4, weinAt + 0.8], [1, 0.3], clamp);
  const light = interpolate(heat, [0.16, 1], [0.15, 1], clamp) * flicker(tScene);

  /* Petrus steht auf und geht hinaus (Hahn) */
  const leaveStart = weinAt - 1.1;
  const leave = interpolate(t, [leaveStart, leaveStart + 2.0], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  const standUp = interpolate(t, [leaveStart - 0.25, leaveStart + 0.1], [0, 1], clamp);

  const accuser = left ? ACCUSERS[/magd/i.test(left.b.who ?? "") ? 0 : /anderer/i.test(left.b.who ?? "") ? 1 : 2] : "cloth";
  const enterAt = left ? Math.max(0.15, left.at - 1.3) : 0;
  const accuserIn = left ? interpolate(t, [enterAt, enterAt + 0.6], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) }) : 0;
  const pointing = left ? interpolate(t, [left.at - 0.15, left.at + 0.25], [0, 1], { ...clamp, easing: ease }) : 0;

  /* Petrus flucht und schwört: Er zittert vor der dritten Lüge */
  const curseAt = s.stage === "accuse" && s.bind === 2 && right ? right.at - 1.5 : 1e9;
  const shake = t > curseAt && t < curseAt + 1.7 ? Math.sin(frame * 2.3) * 5 : 0;

  /* Petrus wird hervorgehoben, wenn die Stimme ihn am Feuer nennt */
  const atFire = findCue(ts.words, "Petrus sitzt im Hof") ? beat(ts, "Petrus sitzt im Hof", 0) : -1;
  const spot = atFire >= 0 ? interpolate(t, [atFire, atFire + 0.4, atFire + 1.6, atFire + 2.2], [0, 1, 1, 0], clamp) : 0;

  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id="peterSpot">
            <stop offset="0%" stopColor="#FFC27A" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#FFC27A" stopOpacity="0" />
          </radialGradient>
        </defs>
        {s.stage === "intro" ? <Night t={t} at={cue(0, 0.12)} /> : null}
        {s.stage === "accuse" && findCue(ts.words, "verhaftet") ? <Procession t={t} /> : null}
        {s.stage === "rooster" ? <Gallery t={t} at={cue(1, 0.55)} /> : null}
        {spot > 0 ? <ellipse cx={PETER_X - 40} cy={GROUND_Y - 220} rx={260} ry={300} fill="url(#peterSpot)" opacity={spot} /> : null}
        <Fire t={tScene} heat={heat} />
        {s.stage === "rooster" && standUp > 0 ? (
          <g opacity={(1 - leave) * standUp}>
            <Standing x={PETER_X + leave * 440} k={1.0} dir={1} head="beard" bow={1} rim={mix("#3A1A0C", "#E07A3A", heat)} rimSide={-1} />
          </g>
        ) : null}
        <g opacity={1 - standUp}>
          <SeatedPeter x={PETER_X} light={light} bond={bound} bondScale={bondScale} flash={flash} shake={shake} />
        </g>
        {left ? (
          <g opacity={accuserIn} transform={`translate(${(1 - accuserIn) * -160} 0)`}>
            <Standing x={ACCUSER_X} k={ACCUSER_K} dir={1} head={accuser} point={pointing} rim={mix("#3A1A0C", "#FF9A4A", light)} rimSide={1} />
          </g>
        ) : null}
        {s.stage === "intro" ? <BigLinks t={t} at={cue(2, 0.8)} /> : null}
      </svg>

      {/* Zähler der Lügen */}
      {s.stage === "accuse" || s.stage === "rooster" ? <LieCounter count={bound} popAt={bindAt} t={t} /> : null}

      {/* Rotes Aufblitzen, wenn die Schnur dicker wird */}
      {flash > 0 ? <AbsoluteFill style={{ background: `radial-gradient(circle at ${PETER_X - 20}px ${GROUND_Y - 240}px, rgba(226,72,61,${0.4 * flash}) 0%, rgba(226,72,61,0) 45%)` }} /> : null}

      {s.stage === "rooster" ? <Rooster t={t} at={cue(0, 0.2)} /> : null}

      {left ? <SpeechBubble b={left.b} pop={popOf(left.at)} targetX={ACCUSER_X + 14} left={40} top={BUBBLE_TOP.left} width={BUBBLE_W} tone="plain" dim={right && t > right.at ? 0.75 : 1} /> : null}
      {right ? <SpeechBubble b={right.b} pop={popOf(right.at)} targetX={PETER_X - 44} left={1080 - 40 - BUBBLE_W} top={BUBBLE_TOP.right} width={BUBBLE_W} tone="lie" dim={1} /> : null}

      {/* Töne */}
      {bubbles.map(({ at }, i) => (
        <Sfx key={i} frame={voiceFrame(ts, at - 0.05)} name="pop" volume={0.4} />
      ))}
      {Number.isFinite(bindAt) ? <Sfx frame={voiceFrame(ts, bindAt)} name={bound >= 3 ? "clash" : "swipe"} volume={bound >= 3 ? 0.5 : 0.4} /> : null}
      {s.stage === "intro" ? (
        <>
          <Sfx frame={voiceFrame(ts, cue(0, 0.12))} name="chime" volume={0.2} />
          <Sfx frame={voiceFrame(ts, fireAt)} name="whoosh" volume={0.45} />
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
      <defs>
        <radialGradient id="moonHalo">
          <stop offset="0%" stopColor="#F4E9C8" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#F4E9C8" stopOpacity="0" />
        </radialGradient>
        <mask id="moonCut">
          <rect x={cx - 80} y={cy - 80} width={160} height={160} fill="white" />
          <circle cx={cx + 26} cy={cy - 12} r={52} fill="black" />
        </mask>
      </defs>
      <circle cx={cx} cy={cy} r={150} fill="url(#moonHalo)" />
      <circle cx={cx} cy={cy} r={58} fill="#F6EED6" mask="url(#moonCut)" />
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
              <path d="M -20 0 L -14 -70 Q 0 -80 14 -70 L 20 0 Z" fill={i === 1 ? "#6A5646" : "#0C0806"} />
              <circle cx={0} cy={-86} r={13} fill={i === 1 ? "#7A6452" : "#0C0806"} />
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
  const halo = 0.25 + 0.75 * turn;
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
      <path d={`M ${cx + 10} ${rail - 120} L ${cx + 60} ${rail - 140} L ${PETER_X - 10} ${GROUND_Y - 340} L ${PETER_X - 130} ${GROUND_Y - 300} Z`} fill="url(#beamGrad)" opacity={beam * 0.85} />
      <g clipPath="url(#galleryClip2)">
        <circle cx={cx} cy={rail - 110} r={150} fill="url(#jesusHalo)" opacity={halo} />
        <g transform={`translate(${cx} ${rail}) scale(${face} 1)`} opacity={0.6 + 0.4 * turn}>
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
  if (t < at - 0.15) return null;
  const p = spring({ frame: Math.round((t - at + 0.15) * FPS), fps: FPS, config: { damping: 9, stiffness: 170 } });
  const crow = interpolate(t, [at, at + 0.2, at + 1.7, at + 2.3], [0, 1, 1, 0], clamp);
  const x = 900;
  const y = WALL_TOP + 4;
  const beak = interpolate(t, [at, at + 0.15, at + 1.4, at + 1.6], [0, 1, 1, 0], clamp);
  const shake = crow > 0.5 ? Math.sin(t * 60) * 3 : 0;
  return (
    <>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <g transform={`translate(${x} ${y}) scale(${interpolate(p, [0, 1], [0.5, 1.5])})`} opacity={Math.min(1, p * 1.5)}>
          {/* Schwanzfedern */}
          <path d="M 30 -60 Q 90 -150 70 -40 Q 96 -110 60 -20 Z" fill="#0A0605" />
          <path d="M 40 -50 Q 110 -110 64 -10 Z" fill="#0A0605" />
          {/* Körper */}
          <path d="M -50 -40 Q -60 -90 -20 -96 Q 30 -80 60 -30 Q 50 0 0 0 Q -40 0 -50 -40 Z" fill="#0A0605" />
          {/* Hals, Kopf, Kamm, Kehllappen, Schnabel */}
          <path d="M -40 -70 Q -52 -120 -30 -140 Q -10 -126 -18 -86 Z" fill="#0A0605" />
          <circle cx={-34} cy={-142} r={16} fill="#0A0605" />
          <path d="M -48 -156 Q -44 -176 -36 -160 Q -32 -180 -24 -160 Q -18 -176 -16 -152 Z" fill="#C8382E" />
          <path d="M -42 -132 Q -46 -118 -38 -116 Q -34 -124 -36 -132 Z" fill="#C8382E" />
          <path d={`M -48 -146 L -66 ${-140 - beak * 7} L -50 -140 Z`} fill="#E0A030" />
          <path d={`M -48 -140 L -64 ${-134 + beak * 9} L -50 -136 Z`} fill="#E0A030" />
          {/* Beine */}
          <path d="M -8 -2 L -12 4 M 14 -2 L 16 4" stroke="#0A0605" strokeWidth={6} />
        </g>
        {/* Schallwellen */}
        <g opacity={crow}>
          {[0, 1, 2].map((i) => {
            const r = 40 + (((t - at) * 300 + i * 80) % 240);
            const cx = x - 100;
            const cy = y - 205;
            return <path key={i} d={`M ${cx - r * 0.35} ${cy - r * 0.6} A ${r} ${r} 0 0 0 ${cx - r * 0.35} ${cy + r * 0.6}`} stroke={look.accent2} strokeWidth={7} strokeLinecap="round" fill="none" opacity={Math.max(0, 1 - r / 280)} />;
          })}
        </g>
      </svg>
      {/* Schriftzug */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 470,
          textAlign: "center",
          fontFamily: theme.font.display,
          fontSize: 170,
          lineHeight: 1,
          color: look.accent2,
          opacity: crow,
          transform: `translateX(${shake}px) rotate(-8deg) scale(${interpolate(crow, [0, 1], [0.6, 1])})`,
          textShadow: `0 0 30px ${look.accent}, 0 8px 0 #3A1A0C, 0 14px 40px rgba(0,0,0,0.7)`,
          letterSpacing: 6,
        }}
      >
        KIKERIKI!
      </div>
    </>
  );
};

/** «Drei Lügen»: drei Glieder einer Kette springen ins Bild */
const BigLinks: React.FC<{ t: number; at: number }> = ({ t, at }) => {
  const pops = [0, 1, 2].map((i) => {
    const a = at + i * 0.16;
    return t < a ? 0 : spring({ frame: Math.round((t - a) * FPS), fps: FPS, config: { damping: 10, stiffness: 200 } });
  });
  const ring = (x: number, p: number, key: string) =>
    p > 0 ? (
      <g key={key} transform={`translate(${x} 640) scale(${interpolate(p, [0, 1], [1.7, 1])})`} opacity={Math.min(1, p * 1.3)}>
        <ellipse cx={0} cy={0} rx={128} ry={86} fill="#E2483D" opacity={0.16} />
        <ellipse cx={0} cy={0} rx={92} ry={56} fill="none" stroke="#120A08" strokeWidth={34} />
        <ellipse cx={0} cy={0} rx={92} ry={56} fill="none" stroke="#A9B0BA" strokeWidth={22} />
        <path d="M -70 -30 Q 0 -60 70 -30" stroke="#EEF2F6" strokeWidth={5} fill="none" opacity={0.6} />
      </g>
    ) : null;
  const p1 = pops[1];
  return (
    <g>
      {ring(370, pops[0], "a")}
      {ring(710, pops[2], "c")}
      {p1 > 0 ? (
        <g transform={`translate(540 640) scale(${interpolate(p1, [0, 1], [1.7, 1])})`} opacity={Math.min(1, p1 * 1.3)}>
          <rect x={-115} y={-20} width={230} height={40} rx={20} fill="#120A08" />
          <rect x={-108} y={-11} width={216} height={22} rx={11} fill="#A9B0BA" />
          <path d="M -96 -4 L 96 -4" stroke="#EEF2F6" strokeWidth={4} opacity={0.6} />
        </g>
      ) : null}
      {/* Vorderkanten der äusseren Ringe über dem mittleren Glied, damit die Kette ineinandergreift */}
      {pops[0] > 0 && p1 > 0 ? (
        <g transform={`translate(370 640) scale(${interpolate(pops[0], [0, 1], [1.7, 1])})`}>
          <path d="M 92 0 A 92 56 0 0 1 60 42" stroke="#120A08" strokeWidth={34} fill="none" />
          <path d="M 92 0 A 92 56 0 0 1 60 42" stroke="#A9B0BA" strokeWidth={22} fill="none" />
        </g>
      ) : null}
      {pops[2] > 0 && p1 > 0 ? (
        <g transform={`translate(710 640) scale(${interpolate(pops[2], [0, 1], [1.7, 1])})`}>
          <path d="M -92 0 A 92 56 0 0 0 -60 42" stroke="#120A08" strokeWidth={34} fill="none" />
          <path d="M -92 0 A 92 56 0 0 0 -60 42" stroke="#A9B0BA" strokeWidth={22} fill="none" />
        </g>
      ) : null}
    </g>
  );
};

/* ------------------------------------------------------------------ */
/* Morgen: vor dem Hohen Rat – die Kette springt                        */
/* ------------------------------------------------------------------ */

const Dawn: React.FC<{ ts: TimelineScene; s: FireSceneT; frame: number; t: number }> = ({ ts, s, frame, t }) => {
  const look = useLook();
  const end = Math.max(1, ts.speechEndSec);
  const breakAt = s.breakAt ? beat(ts, s.breakAt, end * 0.7) : 1e9;
  const broken = t >= breakAt;
  const burst = broken ? interpolate(t, [breakAt, breakAt + 1.2], [0, 1], clamp) : 0;
  const open = broken ? interpolate(t, [breakAt + 0.05, breakAt + 0.6], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.4)) }) : 0;
  const morning = interpolate(t, [-0.4, 0.6], [0.7, 1], clamp);
  const councilAt = beat(ts, "Sie verbieten ihm", end * 0.35) - 0.5;
  const council = interpolate(t, [councilAt, councilAt + 0.6], [0, 1], clamp);
  const bubble = s.bubbles[0];
  const bubbleAt = bubble ? beat(ts, bubble.at, breakAt) : 1e9;
  const pop = bubble ? spring({ frame: frame - voiceFrame(ts, bubbleAt - 0.05), fps: FPS, config: { damping: 11, stiffness: 190, mass: 0.7 } }) : 0;
  const shards = useMemo(
    () => Array.from({ length: 16 }, (_, i) => ({ a: (i / 16) * Math.PI * 2 + random(`sh${i}`) * 0.3, v: 380 + random(`sv${i}`) * 420, rot: (random(`sr${i}`) - 0.5) * 720, face: i % 2 === 0 })),
    [],
  );
  const ringY = GROUND_Y - 300 * STAND_K;
  const ring = { cx: STAND_X, cy: ringY, rx: 80, ry: 22 };
  const glow = broken ? 1 : 0.35;
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <linearGradient id="dawnSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#14254A" />
            <stop offset="55%" stopColor="#4E6FA8" />
            <stop offset="85%" stopColor="#E9B98A" />
            <stop offset="100%" stopColor="#FFD9A0" />
          </linearGradient>
          <linearGradient id="dawnWash" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FFE7B8" stopOpacity="0.28" />
            <stop offset="60%" stopColor="#9FC2F0" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#0B0706" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="truthBurst">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="35%" stopColor="#FFE7A0" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#FFD36B" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="peterGlow">
            <stop offset="0%" stopColor="#FFE7A8" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#FFE7A8" stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* Morgenhimmel und Licht in der Galerie */}
        <rect x={0} y={0} width={1080} height={WALL_TOP + 30} fill="url(#dawnSky)" opacity={morning} />
        <path d={galleryPath()} fill="#FFE2B0" opacity={0.5 * morning} />
        <rect x={0} y={0} width={1080} height={1920} fill="url(#dawnWash)" opacity={morning} />
        {/* Lichtstrahlen von links oben */}
        {[0, 1, 2].map((i) => (
          <path key={i} d={`M ${-100 + i * 160} ${WALL_TOP} L ${40 + i * 160} ${WALL_TOP} L ${520 + i * 200} 1200 L ${300 + i * 200} 1200 Z`} fill="#FFF0C8" opacity={(0.06 + 0.03 * Math.sin(t * 1.2 + i)) * morning} />
        ))}
        {/* Hoher Rat */}
        <g opacity={council}>
          {[80, 205, 330].map((x, i) => (
            <Standing
              key={i}
              x={x}
              k={0.76}
              dir={1}
              head={i === 1 ? "beard" : "cloth"}
              point={i === 1 ? interpolate(t, [councilAt + 0.5, councilAt + 1.0], [0, 1], clamp) : 0}
              fill="#1C1620"
              rim="#E8C08A"
              rimSide={-1}
            />
          ))}
        </g>
        {/* Petrus steht – nach dem Satz leuchtet er */}
        <ellipse cx={STAND_X} cy={GROUND_Y - 250} rx={260} ry={340} fill="url(#peterGlow)" opacity={glow} />
        {broken ? <circle cx={STAND_X} cy={ringY} r={interpolate(burst, [0, 1], [60, 900])} fill="url(#truthBurst)" opacity={1 - burst * 0.75} /> : null}
        <Bond {...ring} level={broken ? 0 : 3} half="back" />
        <Standing x={STAND_X} k={STAND_K} dir={-1} head="beard" open={open} fill="#21160F" rim={look.accent2} rimSide={0} />
        {!broken ? (
          <Bond {...ring} level={3} half="front" />
        ) : (
          shards.map((sh, i) => {
            const d = burst * sh.v;
            const x = STAND_X + Math.cos(sh.a) * d;
            const y = ringY + Math.sin(sh.a) * d * 0.7 + 420 * burst * burst;
            return (
              <g key={i} opacity={1 - burst}>
                <ChainLink x={x} y={y} ang={sh.rot * burst} face={sh.face} s={1.3} metal="#C9D0DA" />
              </g>
            );
          })
        )}
      </svg>
      {bubble ? <SpeechBubble b={bubble} pop={pop} targetX={STAND_X + 6} left={1080 - 40 - 600} top={360} width={600} tone="truth" dim={1} /> : null}
      {s.breakAt ? (
        <>
          <Sfx frame={voiceFrame(ts, breakAt)} name="unlock" volume={0.5} />
          <Sfx frame={voiceFrame(ts, breakAt) + 3} name="levelup" volume={0.35} />
        </>
      ) : null}
      {bubble ? <Sfx frame={voiceFrame(ts, bubbleAt - 0.05)} name="pop" volume={0.35} /> : null}
    </AbsoluteFill>
  );
};
