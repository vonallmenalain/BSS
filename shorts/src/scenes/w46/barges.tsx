import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { HORIZON, stormAt } from "../../components/backgrounds/w46/SeaBg";
import { useLook } from "../../looks";
import { Sfx, beat, beats, voiceFrame } from "../../lib/sfx";
import { FPS, type TimelineScene } from "../../lib/timing";
import type { Scene as SceneData } from "../../schema";
import { Robed, wordsOfTexts } from "../w45/kitA";

/*
 * Sechzehn Steine (Ether 2–3, 6). Die Schiffe der Jarediten von der Seite: klein, mit spitzen
 * Enden, «dicht wie eine Schüssel» – zwei Schüsseln, die aufeinanderpassen. Am Ufer die Werft,
 * im Querschnitt die Familien und die Löcher oben und unten, drinnen die Dunkelheit, in der die
 * Frage zurückkommt. Am Berg Schelem das Schmelzfeuer und sechzehn Steine, die erst glühen und
 * dann klar werden wie Glas; auf dem Gipfel leuchten sie einer nach dem anderen auf. Der Herr
 * selbst ist nie zu sehen – nur Licht, das von oben kommt. Zum Schluss der Sturm: acht Schiffe,
 * je zwei Lichter, 344 Tage.
 */

type BargesSceneT = Extract<SceneData, { type: "barges" }>;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = Easing.inOut(Easing.sin);
const fade = (t: number, at: number, d = 0.35) => interpolate(t, [at, at + d], [0, 1], clamp);
const pop = (t: number, at: number, d = 0.28) => interpolate(t, [at, at + d], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.7)) });

/** Farben mischen – Hex oder schon gemischtes rgb(…) */
const rgbOf = (c: string) =>
  c.startsWith("#") ? [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) : (c.match(/\d+(\.\d+)?/g) ?? ["0", "0", "0"]).slice(0, 3).map(Number);
const mixHex = (a: string, b: string, k: number) => {
  const pa = rgbOf(a);
  const pb = rgbOf(b);
  const kk = Math.max(0, Math.min(1, k));
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * kk)).join(",")})`;
};

const WOOD = "#4B301C";
const WOOD_D = "#22150B";
const SEAM = "#120A04";
const MOON = "#9CC9DD";
const LIGHT = "#BFF3FF";
const WARM = "#FFB25A";
const RED = "#FF7A62";

/* ------------------------------------------------------------------ */
/* Das Schiff                                                          */
/* ------------------------------------------------------------------ */

/** Rumpf von der Seite: Ursprung in der Mitte, 428 lang; spitze Enden, oben und unten dicht. */
const HULL = "M -214 -10 C -176 -66, -96 -88, 0 -90 C 96 -88, 176 -66, 214 -10 C 172 50, 92 80, 0 82 C -92 80, -172 50, -214 -10 Z";
/** Die obere und die untere Schüssel */
const BOWL_TOP = "M -214 -10 C -176 -66, -96 -88, 0 -90 C 96 -88, 176 -66, 214 -10 Z";
const BOWL_BOTTOM = "M -214 -10 C -172 50, -92 80, 0 82 C 92 80, 172 50, 214 -10 Z";
const topY = (x: number) => -10 - 80 * Math.max(0, 1 - (x / 214) ** 2) ** 0.75;
const botY = (x: number) => -10 + 92 * Math.max(0, 1 - (x / 214) ** 2) ** 0.75;
const seam = (s: number, up: boolean) => {
  const pts: string[] = [];
  for (let x = -206; x <= 206; x += 14) pts.push(`${x} ${(-10 + ((up ? topY(x) : botY(x)) + 10) * s).toFixed(1)}`);
  return `M ${pts.join(" L ")}`;
};

type BargeProps = {
  x: number;
  y: number;
  k?: number;
  rot?: number;
  /** Licht der beiden Steine (0 … 1), je Ende */
  glow?: [number, number];
  /** Bau: 0 = nur Spanten, 1 = fertig beplankt */
  build?: number;
  /** Abdunkeln in der Ferne */
  dim?: number;
  o?: number;
  frame: number;
  /** Mondlicht auf der Oberkante */
  rim?: string;
  id: string;
};

const Barge: React.FC<BargeProps> = ({ x, y, k = 1, rot = 0, glow = [0, 0], build = 1, dim = 0, o = 1, frame, rim = MOON, id }) => {
  if (o <= 0.01) return null;
  const fl = 0.9 + 0.1 * Math.sin(frame / 5 + x) * Math.sin(frame / 3.1);
  const wood = mixHex(WOOD, "#0A0D14", dim);
  const woodD = mixHex(WOOD_D, "#05070C", dim);
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${k})`} opacity={o}>
      <defs>
        <clipPath id={`bp-${id}`}>
          <rect x={-230} y={86 - 186 * build} width={460} height={200} />
        </clipPath>
      </defs>
      {/* Spanten (sichtbar, solange gebaut wird) */}
      {build < 1
        ? Array.from({ length: 11 }, (_, i) => {
            const rx = -180 + i * 36;
            return <path key={i} d={`M ${rx} ${topY(rx)} Q ${rx - 6} ${(topY(rx) + botY(rx)) / 2} ${rx} ${botY(rx)}`} stroke={woodD} strokeWidth={9} fill="none" strokeLinecap="round" />;
          })
        : null}
      {build < 1 ? <path d={HULL} fill="none" stroke={woodD} strokeWidth={7} /> : null}
      {/* Beplankung */}
      <g clipPath={build < 1 ? `url(#bp-${id})` : undefined}>
        <path d={HULL} fill={`url(#bgWood)`} />
        <path d={HULL} fill={woodD} opacity={0.25 + 0.6 * dim} />
        {[0.72, 0.42].map((s) => (
          <path key={`u${s}`} d={seam(s, true)} stroke={SEAM} strokeWidth={3} fill="none" opacity={0.7} />
        ))}
        {[0.35, 0.7].map((s) => (
          <path key={`d${s}`} d={seam(s, false)} stroke={SEAM} strokeWidth={3} fill="none" opacity={0.7} />
        ))}
        {/* Tür oben, dicht verschlossen */}
        <rect x={-34} y={-100} width={68} height={16} rx={6} fill={woodD} stroke={SEAM} strokeWidth={3} />
        <rect x={-8} y={-108} width={16} height={9} rx={3} fill={wood} />
        {/* Mondlicht auf der Oberkante */}
        <path d={seam(1, true)} stroke={rim} strokeWidth={4} fill="none" opacity={0.55 * (1 - dim)} />
      </g>
      {/* Licht der Steine: es dringt durch die Fugen an beiden Enden */}
      {[-1, 1].map((side, i) => {
        const g = glow[i];
        if (g <= 0.01) return null;
        const cx = side * 150;
        return (
          <g key={side} style={{ mixBlendMode: "screen" }}>
            <circle cx={cx} cy={-8} r={150 * g} fill="url(#bgHalo)" opacity={0.85 * fl} />
            {[0.35, 0.72].map((s) => (
              <path
                key={s}
                d={`M ${cx - 46} ${(-10 + (topY(cx - 46) + 10) * s).toFixed(1)} L ${cx + 46} ${(-10 + (topY(cx + 46) + 10) * s).toFixed(1)}`}
                stroke="#F2FEFF"
                strokeWidth={4}
                opacity={0.8 * g * fl}
                strokeLinecap="round"
              />
            ))}
            <circle cx={cx} cy={-8} r={11} fill="#F6FFFF" opacity={0.9 * g} />
          </g>
        );
      })}
    </g>
  );
};

/* ------------------------------------------------------------------ */
/* Ein Stein                                                           */
/* ------------------------------------------------------------------ */

const Stone: React.FC<{ x: number; y: number; r: number; lit?: number; hot?: number; o?: number; i: number; frame: number; halo?: number }> = ({ x, y, r, lit = 0, hot = 0, o = 1, i, frame, halo = 1 }) => {
  const pts = useMemo(
    () =>
      Array.from({ length: 7 }, (_, k) => {
        const a = (k / 7) * Math.PI * 2 - Math.PI / 2;
        const rr = r * (0.82 + random(`st${i}-${k}`) * 0.3);
        return [Math.cos(a) * rr, Math.sin(a) * rr * 0.86] as const;
      }),
    [i, r],
  );
  if (o <= 0.01) return null;
  const d = `M ${pts.map(([px, py]) => `${px.toFixed(1)} ${py.toFixed(1)}`).join(" L ")} Z`;
  const body = mixHex(mixHex("#7FA2B0", "#FF7A2E", hot), "#F4FEFF", lit);
  const shimmer = 0.85 + 0.15 * Math.sin(frame / 6 + i * 1.3);
  return (
    <g transform={`translate(${x} ${y})`} opacity={o}>
      {lit > 0.01 ? <circle r={r * 4.2 * halo} fill="url(#bgHalo)" opacity={lit * shimmer} style={{ mixBlendMode: "screen" }} /> : null}
      {hot > 0.01 ? <circle r={r * 2.4} fill="url(#bgEmber)" opacity={hot * shimmer} style={{ mixBlendMode: "screen" }} /> : null}
      <path d={d} fill={body} opacity={0.5 + 0.5 * Math.max(lit, hot)} stroke={mixHex("#CFE9F2", "#FFE2B0", hot)} strokeWidth={Math.max(1.5, r * 0.09)} strokeLinejoin="round" />
      {/* Facetten und Glanz wie bei Glas */}
      <path d={`M ${pts[0][0] * 0.2} ${pts[0][1] * 0.9} L ${pts[2][0] * 0.55} ${pts[2][1] * 0.5} L ${pts[5][0] * 0.4} ${pts[5][1] * 0.2} Z`} fill="#FFFFFF" opacity={0.35 + 0.4 * lit} />
      <circle cx={-r * 0.3} cy={-r * 0.35} r={r * 0.16} fill="#FFFFFF" opacity={0.7} />
    </g>
  );
};

/* ------------------------------------------------------------------ */
/* Kniende Gestalt                                                     */
/* ------------------------------------------------------------------ */

/**
 * Kniend, nach rechts gewandt. Ursprung: Knie am Boden. `bow` 0 = aufrecht, 1 = Stirn am Boden;
 * `raise` hebt die Arme zum Himmel.
 */
const Kneeling: React.FC<{ x: number; y: number; k?: number; bow?: number; raise?: number; fill?: string; rim?: string; o?: number }> = ({ x, y, k = 1, bow = 0, raise = 0, fill = "#0E0B0A", rim = MOON, o = 1 }) => {
  if (o <= 0.01) return null;
  const ang = 84 * bow;
  const lerp = (a: number, c: number) => a + (c - a) * raise;
  // Arm: Schulter → Ellbogen → Hände; vor der Brust gefaltet oder zum Himmel gehoben
  const elbow: [number, number] = [lerp(30, 30), lerp(-134, -206)];
  const hand: [number, number] = [lerp(40, 58), lerp(-170, -244)];
  const elbowB: [number, number] = [lerp(22, -12), lerp(-136, -212)];
  const handB: [number, number] = [lerp(34, -18), lerp(-166, -256)];
  const shape = (c: string, back = false) => (
    <g>
      {/* Beine, unter dem Gewand gefaltet: Füsse hinten, Knie vorn */}
      <path d="M -96 0 L -92 -12 C -78 -40, -46 -60, -12 -62 L 38 -58 C 58 -50, 68 -26, 66 0 Z" fill={c} />
      <g transform={`rotate(${ang} -20 -58)`}>
        <path d="M -54 -56 C -62 -100, -56 -150, -38 -178 C -24 -194, 4 -196, 14 -180 C 24 -150, 22 -100, 16 -56 Z" fill={c} />
        <circle cx={-10} cy={-206} r={23} fill={c} />
        <path d="M -38 -200 C -42 -240, 18 -244, 16 -206 L 20 -176 L -46 -174 Z" fill={c} />
        <path
          d={back ? `M -12 -172 L ${elbowB[0]} ${elbowB[1]} L ${handB[0]} ${handB[1]}` : `M -2 -170 L ${elbow[0]} ${elbow[1]} L ${hand[0]} ${hand[1]}`}
          stroke={c}
          strokeWidth={16}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <circle cx={back ? handB[0] : hand[0]} cy={back ? handB[1] : hand[1]} r={9.5} fill={c} />
      </g>
    </g>
  );
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`} opacity={o}>
      <ellipse cx={-10} cy={3} rx={96} ry={10} fill="#000" opacity={0.35} />
      <g opacity={0.8}>{shape(mixHex(fill, "#000000", 0.3), true)}</g>
      <g transform="translate(-5 -2)">{shape(rim)}</g>
      {shape(fill)}
    </g>
  );
};

/* ------------------------------------------------------------------ */
/* Kleine Bausteine                                                    */
/* ------------------------------------------------------------------ */

const Flame: React.FC<{ x: number; y: number; k: number; frame: number; o?: number }> = ({ x, y, k, frame, o = 1 }) => {
  if (o <= 0.01 || k <= 0.01) return null;
  const fl = 1 + 0.1 * Math.sin(frame / 2.3) + 0.06 * Math.sin(frame / 3.7);
  return (
    <g transform={`translate(${x} ${y}) scale(${k * fl} ${k * (2 - fl)})`} opacity={o}>
      <path d="M 0 -96 C 30 -60, 44 -20, 0 0 C -44 -20, -30 -60, 0 -96 Z" fill="#FF7A2A" />
      <path d="M 4 -64 C 22 -40, 24 -12, 0 0 C -22 -12, -18 -40, 4 -64 Z" fill="#FFB347" />
      <path d="M 0 -34 C 10 -22, 10 -6, 0 0 C -10 -6, -10 -22, 0 -34 Z" fill="#FFF1B8" />
    </g>
  );
};

/** Ein Haken oder ein Kreuz im Kreis */
const Mark: React.FC<{ x: number; y: number; ok: boolean; k: number; size?: number }> = ({ x, y, ok, k, size = 38 }) =>
  k > 0.01 ? (
    <g transform={`translate(${x} ${y}) scale(${k})`}>
      <circle r={size} fill={ok ? "rgba(124,255,178,0.16)" : "rgba(255,122,98,0.16)"} stroke={ok ? "#7CFFB2" : RED} strokeWidth={5} />
      {ok ? (
        <path d={`M ${-size * 0.45} 0 L ${-size * 0.1} ${size * 0.36} L ${size * 0.5} ${-size * 0.38}`} stroke="#7CFFB2" strokeWidth={7} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d={`M ${-size * 0.38} ${-size * 0.38} L ${size * 0.38} ${size * 0.38} M ${size * 0.38} ${-size * 0.38} L ${-size * 0.38} ${size * 0.38}`} stroke={RED} strokeWidth={7} strokeLinecap="round" />
      )}
    </g>
  ) : null;

/** Weiche Wolkenbank */
const CloudBank: React.FC<{ y: number; frame: number; color: string; top?: string; o?: number; speed?: number; seed: string; solid?: boolean; scale?: number }> = ({
  y,
  frame,
  color,
  top,
  o = 1,
  speed = 0.4,
  seed,
  solid = true,
  scale = 1,
}) => {
  const puffs = useMemo(() => Array.from({ length: 10 }, (_, i) => ({ x: i * 150 + random(`${seed}x${i}`) * 60, r: 90 + random(`${seed}r${i}`) * 70, dy: random(`${seed}y${i}`) * 50 })), [seed]);
  const wrap = (x: number) => ((x % 1500) + 1500) % 1500 - 210;
  return (
    <g opacity={o}>
      {top
        ? puffs.map((p, i) => <ellipse key={`t${i}`} cx={wrap(p.x + frame * speed) - 6} cy={y + p.dy - 7} rx={p.r * 1.5 * scale} ry={p.r * 0.62 * scale} fill={top} />)
        : null}
      {puffs.map((p, i) => (
        <ellipse key={i} cx={wrap(p.x + frame * speed)} cy={y + p.dy} rx={p.r * 1.5 * scale} ry={p.r * 0.62 * scale} fill={color} />
      ))}
      {solid ? <rect x={0} y={y + 30} width={1080} height={300} fill={color} /> : null}
    </g>
  );
};

/** Ein weicher Lichtkegel von oben: drei Lagen, damit die Ränder nicht hart wirken */
const Beam: React.FC<{ x: number; top: number; bottom: number; w0: number; w1: number; o: number }> = ({ x, top, bottom, w0, w1, o }) =>
  o > 0.01 ? (
    <g style={{ mixBlendMode: "screen" }}>
      {[1, 0.66, 0.36].map((k, i) => (
        <path key={i} d={`M ${x - (w0 * k) / 2} ${top} L ${x + (w0 * k) / 2} ${top} L ${x + (w1 * k) / 2} ${bottom} L ${x - (w1 * k) / 2} ${bottom} Z`} fill="url(#bgBeam)" opacity={o * (i === 2 ? 0.55 : 0.32)} />
      ))}
    </g>
  ) : null;

/* ------------------------------------------------------------------ */
/* Etappen                                                             */
/* ------------------------------------------------------------------ */

type StageP = { s: BargesSceneT; ts: TimelineScene; t: number; frame: number; b: number[] };

/** Acht Schiffe auf dem nächtlichen Meer, von nah nach fern */
const FLEET: Array<{ x: number; y: number; k: number }> = [
  { x: 990, y: 912, k: 0.2 },
  { x: 690, y: 922, k: 0.25 },
  { x: 390, y: 936, k: 0.3 },
  { x: 930, y: 958, k: 0.38 },
  { x: 140, y: 982, k: 0.45 },
  { x: 540, y: 1012, k: 0.56 },
  { x: 820, y: 1078, k: 0.76 },
  { x: 255, y: 1128, k: 0.94 },
];

const HookStage: React.FC<StageP> = ({ s, ts, t, frame }) => {
  const at = [0, 1, 2].map((i) => beat(ts, s.lines[i]?.at, 0.2 + i * 1.3));
  const dark = fade(t, at[2], 0.7);
  return (
    <g>
      {/* Sechzehn Steine im Bogen – noch ohne Licht */}
      {Array.from({ length: 16 }, (_, j) => {
        const u = (j - 7.5) / 7.5;
        const k = pop(t, at[1] - 0.05 + j * 0.035, 0.3);
        return <Stone key={j} x={540 + u * 440} y={812 - 46 * (1 - u * u)} r={22 * k} i={j} frame={frame} o={Math.min(1, k * 2) * (1 - 0.45 * dark)} lit={0.08 * (1 - dark)} halo={0.6} />;
      })}
      {FLEET.map((f, i) => {
        const o = fade(t, at[0] - 0.62 + i * 0.05, 0.4);
        const bob = Math.sin(frame / 17 + i * 1.7) * 5 * f.k;
        return <Barge key={i} id={`h${i}`} x={f.x} y={f.y + bob + (1 - o) * 30} k={f.k} rot={Math.sin(frame / 23 + i) * 2.5} dim={0.55 * (1 - f.k) + 0.3 * dark} o={o} frame={frame} />;
      })}
    </g>
  );
};

const BuildStage: React.FC<StageP> = ({ t, frame, b }) => {
  const build = interpolate(t, [b[0] - 0.5, b[1] + 0.2], [0.12, 1], { ...clamp, easing: ease });
  const bowl = interpolate(t, [b[1] - 0.15, b[1] + 0.6], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const bowlO = fade(t, b[1] - 0.15, 0.25) * interpolate(t, [b[1] + 1.1, b[1] + 1.8], [1, 0.55], clamp);
  const outline = interpolate(t, [b[1] + 0.55, b[1] + 0.8, b[1] + 1.6], [0, 1, 0.5], clamp);
  const hammer = Math.max(0, Math.sin(frame / 3.2)) ** 2;
  const fireK = 0.9 + 0.1 * Math.sin(frame / 2.4);
  return (
    <g>
      {/* Schon fertige Schiffe draussen im Wasser */}
      {[
        [150, 938, 0.26],
        [930, 930, 0.22],
        [700, 952, 0.3],
      ].map(([x, y, k], i) => (
        <Barge key={i} id={`w${i}`} x={x} y={y + Math.sin(frame / 19 + i) * 3} k={k} dim={0.6} frame={frame} />
      ))}
      {/* Ufer */}
      <path d="M 0 1040 C 260 1010, 640 1036, 1080 1000 L 1080 1920 L 0 1920 Z" fill="url(#bgSand)" />
      <path d="M 0 1040 C 260 1010, 640 1036, 1080 1000" stroke="#7FA8BC" strokeWidth={3} fill="none" opacity={0.35} />
      {/* Feuer am Ufer */}
      <circle cx={70} cy={1070} r={460} fill="url(#bgFire)" opacity={0.75 * fireK} style={{ mixBlendMode: "screen" }} />
      <path d="M 30 1096 L 110 1096 L 96 1082 L 44 1082 Z" fill="#2A1A10" />
      <Flame x={70} y={1088} k={0.8} frame={frame} />
      {/* Böcke */}
      {[330, 750].map((bx) => (
        <g key={bx} stroke="#1A0F08" strokeWidth={14} strokeLinecap="round">
          <line x1={bx - 60} y1={1100} x2={bx} y2={1010} />
          <line x1={bx + 60} y1={1100} x2={bx} y2={1010} />
          <line x1={bx - 70} y1={1004} x2={bx + 70} y2={1004} />
        </g>
      ))}
      {/* Das Schiff auf der Werft */}
      <Barge id="werft" x={540} y={882} k={1.55} build={build} rim={mixHex(MOON, WARM, 0.5)} frame={frame} />
      {/* Zwei Schüsseln, die aufeinanderpassen */}
      {bowlO > 0.01 ? (
        <g transform="translate(540 882) scale(1.55)" opacity={bowlO}>
          <path d={BOWL_TOP} transform={`translate(0 ${-150 * (1 - bowl)})`} fill="rgba(191,243,255,0.08)" stroke={LIGHT} strokeWidth={4} strokeLinejoin="round" />
          <g transform={`translate(0 ${150 * (1 - bowl)})`}>
            <path d="M -186 2 C -146 46, -82 70, 0 72 C 82 70, 146 46, 186 2 Z" fill="#6EAFCD" opacity={0.45} />
            <path d={`M -186 2 Q -93 ${2 + 5 * Math.sin(frame / 5)} 0 2 T 186 2`} stroke="#DDF6FF" strokeWidth={3} fill="none" opacity={0.7} />
            <path d={BOWL_BOTTOM} fill="rgba(191,243,255,0.08)" stroke={LIGHT} strokeWidth={4} strokeLinejoin="round" />
          </g>
          {outline > 0.01 ? <path d={HULL} fill="none" stroke={LIGHT} strokeWidth={10} opacity={0.35 * outline} /> : null}
        </g>
      ) : null}
      {/* Arbeiter mit Streiflicht vom Feuer */}
      <Robed x={178} y={1104} k={0.72} rim={WARM} rimSide={-1} pose={{ reach: 0.85 }} />
      <Robed x={930} y={1104} k={0.72} dir={-1} rim={mixHex(WARM, MOON, 0.5)} rimSide={1} pose={{ raise: 0.2 + 0.6 * hammer }} />
    </g>
  );
};

const AirStage: React.FC<StageP> = ({ s, ts, t, frame, b }) => {
  const at = [0, 1].map((i) => beat(ts, s.lines[i]?.at, 1.2 + i * 1.1));
  const stuffy = fade(t, at[0], 0.6) * (1 - fade(t, b[2] + 0.4, 1.0));
  const dark = fade(t, at[1], 0.6);
  const hole1 = pop(t, b[1] + 0.05, 0.35);
  const hole2 = pop(t, b[2] + 0.05, 0.35);
  const flow = fade(t, b[1] + 0.35, 0.6);
  const breathe = fade(t, b[2] + 0.4, 0.9);
  const hint = interpolate(t, [b[0] - 0.1, b[0] + 0.4, b[1] + 0.2, b[1] + 0.6], [0, 1, 1, 0], clamp);
  const K = 2.2;
  const people = [-140, -78, -14, 52, 118];
  return (
    <g>
      <g transform={`translate(540 950) scale(${K})`}>
        {/* Rumpf im Querschnitt */}
        <path d={HULL} fill={WOOD_D} />
        <path d="M -196 -10 C -160 -58, -90 -76, 0 -78 C 90 -76, 160 -58, 196 -10 C 158 40, 86 66, 0 68 C -86 66, -158 40, -196 -10 Z" fill="#100A06" />
        {/* Spanten innen */}
        {Array.from({ length: 9 }, (_, i) => {
          const rx = -160 + i * 40;
          return <line key={i} x1={rx} y1={topY(rx) + 10} x2={rx} y2={botY(rx) - 10} stroke="#24170D" strokeWidth={5} />;
        })}
        {/* Boden */}
        <path d="M -170 36 C -90 50, 90 50, 170 36" stroke="#2E1E12" strokeWidth={5} fill="none" />
        {/* Familie und Tiere, sitzend */}
        {people.map((px, i) => {
          const slump = 6 * stuffy * (1 - breathe) + Math.sin(frame / 20 + i) * 0.8;
          const h = i % 2 ? 46 : 54;
          return (
            <g key={i} transform={`translate(${px} ${42 + slump * 0.3})`}>
              <path d={`M -15 0 C -17 ${-h * 0.5}, -11 ${-h * 0.8}, 0 ${-h * 0.82} C 11 ${-h * 0.8}, 17 ${-h * 0.5}, 15 0 Z`} fill="#46342A" stroke="#9DBDCB" strokeWidth={1.2} strokeOpacity={0.5 * (1 - dark * 0.6)} />
              <circle cx={i % 2 ? 2 : -2} cy={-h + slump} r={9.5} fill="#46342A" stroke="#9DBDCB" strokeWidth={1.2} strokeOpacity={0.55 * (1 - dark * 0.6)} />
            </g>
          );
        })}
        <g transform="translate(164 38)">
          <ellipse cx={0} cy={-14} rx={20} ry={13} fill="#5A4A3E" />
          <circle cx={18} cy={-24} r={7} fill="#5A4A3E" />
        </g>
        {/* Stickig: rötlicher Schleier; dunkel: Schwärze */}
        <path d="M -196 -10 C -160 -58, -90 -76, 0 -78 C 90 -76, 160 -58, 196 -10 C 158 40, 86 66, 0 68 C -86 66, -158 40, -196 -10 Z" fill="#5A1A10" opacity={0.32 * stuffy} />
        <path d="M -196 -10 C -160 -58, -90 -76, 0 -78 C 90 -76, 160 -58, 196 -10 C 158 40, 86 66, 0 68 C -86 66, -158 40, -196 -10 Z" fill="#000" opacity={0.38 * dark} />
        {/* Fugen aussen */}
        <path d={seam(1, true)} stroke={MOON} strokeWidth={2.2} fill="none" opacity={0.6} />
        <path d={HULL} fill="none" stroke={SEAM} strokeWidth={3} />
        {/* Hinweis von oben: hier */}
        {hint > 0.01 ? (
          <g opacity={hint}>
            <circle cx={0} cy={-90} r={22 + 4 * Math.sin(frame / 4)} fill="none" stroke={LIGHT} strokeWidth={2} />
            <circle cx={0} cy={80} r={22 + 4 * Math.sin(frame / 4 + 1)} fill="none" stroke={LIGHT} strokeWidth={2} opacity={0.6} />
          </g>
        ) : null}
        {/* Loch oben mit Stöpsel */}
        {hole1 > 0.01 ? (
          <g>
            <ellipse cx={0} cy={-88} rx={10 * hole1} ry={4 * hole1} fill="#000" />
            <g transform={`translate(${16 * hole1} ${-96 - 22 * hole1}) rotate(${40 * hole1})`}>
              <rect x={-7} y={-8} width={14} height={16} rx={3} fill="#7A5434" stroke={SEAM} strokeWidth={1.5} />
            </g>
          </g>
        ) : null}
        {/* Loch unten – verstöpselt, damit kein Wasser kommt */}
        {hole2 > 0.01 ? (
          <g>
            <ellipse cx={0} cy={80} rx={10 * hole2} ry={4 * hole2} fill="#000" />
            <rect x={-7} y={78} width={14} height={14 * hole2} rx={3} fill="#7A5434" stroke={SEAM} strokeWidth={1.5} />
          </g>
        ) : null}
        {/* Frische Luft strömt herein */}
        {flow > 0.01 ? (
          <g opacity={flow}>
            {[-1, 1].map((sd) => (
              <path
                key={sd}
                d={`M ${sd * 70} -170 C ${sd * 40} -150, ${sd * 6} -120, 0 -88 C ${-sd * 10} -50, ${sd * 60} -40, ${sd * 110} -20`}
                stroke={LIGHT}
                strokeWidth={3}
                fill="none"
                strokeDasharray="8 10"
                strokeDashoffset={-frame * 1.6}
                strokeLinecap="round"
              />
            ))}
          </g>
        ) : null}
      </g>
      {/* Wasser bis zur halben Höhe */}
      <path d={`M 0 1012 ${Array.from({ length: 19 }, (_, i) => `L ${i * 60} ${1012 + 7 * Math.sin(i * 0.9 + frame / 9)}`).join(" ")} L 1080 1012 L 1080 1240 L 0 1240 Z`} fill="#0A2A3C" opacity={0.6} />
      <path d={`M 0 1012 ${Array.from({ length: 19 }, (_, i) => `L ${i * 60} ${1012 + 7 * Math.sin(i * 0.9 + frame / 9)}`).join(" ")}`} stroke="#6E9BB8" strokeWidth={3} fill="none" opacity={0.5} />
    </g>
  );
};

const DarkStage: React.FC<StageP> = ({ s, ts, t, frame, b }) => {
  const q = beat(ts, s.say?.at, 2);
  const glowQ = fade(t, q - 0.15, 0.6);
  const win = fade(t, b[0] - 0.15, 0.3);
  const crack = b[0] + 0.85;
  const shatter = interpolate(t, [crack, crack + 0.9], [0, 1], { ...clamp, easing: Easing.out(Easing.quad) });
  const fire = fade(t, b[1] - 0.15, 0.25);
  const snuff = interpolate(t, [b[1] + 0.6, b[1] + 1.0], [1, 0], clamp);
  const smoke = interpolate(t, [b[1] + 0.6, b[1] + 2.2], [0, 1], clamp);
  const shards = useMemo(() => Array.from({ length: 12 }, (_, i) => ({ a: (i / 12) * Math.PI * 2 + random(`sh${i}`) * 0.4, v: 160 + random(`sv${i}`) * 220, r: random(`sr${i}`) * 360, sz: 14 + random(`sz${i}`) * 22 })), []);
  const drops = useMemo(() => Array.from({ length: 22 }, (_, i) => ({ a: -0.6 + random(`da${i}`) * 1.2, v: 120 + random(`dv${i}`) * 300 })), []);
  return (
    <g>
      {/* Drinnen: der Blick durch den Rumpf – Spanten als Ringe, Planken laufen in die Tiefe */}
      <rect x={0} y={0} width={1080} height={1920} fill="#050308" />
      {Array.from({ length: 22 }, (_, i) => {
        const a = (i / 22) * Math.PI * 2;
        return <line key={i} x1={540} y1={720} x2={540 + Math.cos(a) * 1500} y2={720 + Math.sin(a) * 1500} stroke="#130C07" strokeWidth={5} />;
      })}
      {Array.from({ length: 7 }, (_, i) => {
        const k = 1 / (1 + i * 0.62);
        const rx = 700 * k;
        const ry = 760 * k;
        return (
          <g key={i} opacity={1 - i * 0.1}>
            <ellipse cx={540} cy={720} rx={rx} ry={ry} fill="none" stroke="#1A100A" strokeWidth={52 * k} />
            <path d={`M ${540 - rx * 0.97} ${720 - ry * 0.25} A ${rx} ${ry} 0 0 1 ${540 - rx * 0.25} ${720 - ry * 0.97}`} stroke="#3A4250" strokeWidth={3.5 * k + 1} fill="none" opacity={0.55} />
          </g>
        );
      })}
      <ellipse cx={540} cy={720} rx={90} ry={98} fill="#020104" />
      {/* Boden aus Brettern */}
      <path d="M -40 1920 L 470 900 L 610 900 L 1120 1920 Z" fill="#0B0705" />
      {Array.from({ length: 6 }, (_, i) => (
        <line key={i} x1={490 + i * 20} y1={900} x2={-40 + i * 232} y2={1920} stroke="#1A110A" strokeWidth={3} />
      ))}
      {/* Schultern und Köpfe im Dunkeln */}
      {[150, 330, 520, 720, 900].map((x, i) => (
        <g key={x} transform={`translate(${x} ${1140 + (i % 2) * 18})`} opacity={0.95}>
          <path d="M -70 60 C -66 -10, -40 -30, 0 -32 C 40 -30, 66 -10, 70 60 Z" fill="#0D0907" />
          <circle cx={0} cy={-62} r={34} fill="#0D0907" />
          <path d="M -34 -62 A 34 34 0 0 1 22 -88" stroke="#33414E" strokeWidth={2} fill="none" opacity={0.45} />
        </g>
      ))}
      {/* Licht der Frage */}
      <ellipse cx={540} cy={460} rx={520} ry={240} fill="url(#bgHalo)" opacity={0.28 * glowQ} style={{ mixBlendMode: "screen" }} />
      {/* Fenster? – würde zerschmettert */}
      {win > 0.01 ? (
        <g transform="translate(300 860)" opacity={win * (1 - 0.45 * fade(t, crack + 1.3, 0.6))}>
          <rect x={-120} y={-120} width={240} height={240} rx={10} fill="#0C2436" />
          {/* draussen: Wellen */}
          <g opacity={1 - shatter}>
            {[0, 1, 2].map((i) => (
              <path key={i} d={`M -116 ${-30 + i * 46} q 29 -18 58 0 t 58 0 t 58 0 t 58 0`} stroke="#6E9BB8" strokeWidth={4} fill="none" transform={`translate(${((frame * 2 + i * 20) % 58) - 58} 0)`} />
            ))}
            <line x1={-120} y1={0} x2={120} y2={0} stroke="#3A2616" strokeWidth={10} />
            <line x1={0} y1={-120} x2={0} y2={120} stroke="#3A2616" strokeWidth={10} />
            <path d="M -40 -110 L 10 -20 L -10 30 L 40 110" stroke="#BFE3F2" strokeWidth={3} fill="none" opacity={fade(t, crack - 0.35, 0.3)} />
          </g>
          {shatter > 0 && shatter < 1
            ? shards.map((sh, i) => (
                <path
                  key={i}
                  d={`M 0 ${-sh.sz} L ${sh.sz * 0.8} ${sh.sz * 0.6} L ${-sh.sz * 0.7} ${sh.sz * 0.5} Z`}
                  transform={`translate(${Math.cos(sh.a) * sh.v * shatter} ${Math.sin(sh.a) * sh.v * shatter + 260 * shatter * shatter}) rotate(${sh.r * shatter})`}
                  fill="#CFEAF6"
                  opacity={0.85 * (1 - shatter)}
                />
              ))
            : null}
          {shatter > 0 && shatter < 1
            ? drops.map((d, i) => <circle key={i} cx={Math.sin(d.a) * d.v * shatter} cy={Math.cos(d.a) * d.v * shatter * 1.2} r={5} fill="#6E9BB8" opacity={0.8 * (1 - shatter)} />)
            : null}
          <rect x={-120} y={-120} width={240} height={240} rx={10} fill="none" stroke="#3A2616" strokeWidth={16} />
          <Mark x={110} y={-110} ok={false} k={pop(t, crack + 0.25)} />
        </g>
      ) : null}
      {/* Feuer? – geht nicht */}
      {fire > 0.01 ? (
        <g transform="translate(780 900)" opacity={fire}>
          <circle cx={0} cy={-80} r={260} fill="url(#bgFire)" opacity={0.7 * snuff} style={{ mixBlendMode: "screen" }} />
          <ellipse cx={0} cy={0} rx={72} ry={24} fill="#8A5A30" stroke="#3A2414" strokeWidth={4} />
          <path d="M 56 -6 L 92 -22 L 86 -2 Z" fill="#8A5A30" stroke="#3A2414" strokeWidth={4} />
          <Flame x={88} y={-22} k={0.9 * snuff} frame={frame} />
          {smoke > 0 && smoke < 1
            ? [0, 1, 2].map((i) => (
                <path
                  key={i}
                  d={`M 88 -30 c ${12 - i * 8} -40, ${-30 + i * 10} -60, ${-6 + i * 6} -${110 + i * 20}`}
                  stroke="#8A8A96"
                  strokeWidth={8 - i * 2}
                  fill="none"
                  strokeLinecap="round"
                  opacity={0.5 * (1 - smoke)}
                  transform={`translate(0 ${-60 * smoke})`}
                />
              ))
            : null}
          <Mark x={110} y={-150} ok={false} k={pop(t, b[1] + 0.85)} />
        </g>
      ) : null}
      {/* Vignette */}
      <rect x={0} y={0} width={1080} height={1920} fill="url(#bgVignette)" />
    </g>
  );
};

/** Der Berg Schelem: hoch über dem Meer */
const MOUNT = "M 150 1320 L 330 1100 L 420 1020 L 500 880 L 560 820 L 640 640 L 700 560 L 760 360 L 800 420 L 830 400 L 900 500 L 960 540 L 1040 640 L 1080 660 L 1080 1320 Z";
/** Die Flanke im Mondlicht – ein Band entlang des linken Grats */
const MOUNT_FACE = "M 150 1320 L 330 1100 L 420 1020 L 500 880 L 560 820 L 640 640 L 700 560 L 760 360 L 776 470 L 744 600 L 706 700 L 650 860 L 600 960 L 540 1080 L 500 1320 Z";
const MOUNT_RIM = "M 330 1100 L 420 1020 L 500 880 L 560 820 L 640 640 L 700 560 L 760 360";
/** Rinnen und Grate im Fels */
const MOUNT_LINES = ["M 760 360 L 790 520 L 860 640 L 900 800", "M 830 400 L 860 520 L 940 620", "M 700 560 L 740 700 L 760 860 L 820 1000", "M 560 820 L 610 940 L 640 1100"];

const StonesStage: React.FC<StageP> = ({ t, frame, b }) => {
  const think = fade(t, b[0] + 0.9, 0.5) * (1 - fade(t, b[1], 0.4));
  const fireO = fade(t, b[1] - 0.2, 0.5);
  const fl = 0.88 + 0.12 * Math.sin(frame / 2.5);
  const t0 = b[1] + 0.45;
  const t1 = b[2] + 0.9;
  const cool = (j: number) => interpolate(t, [b[3] - 0.1 + j * 0.03, b[3] + 0.7 + j * 0.03], [1, 0], clamp);
  const slots = Array.from({ length: 16 }, (_, j) => ({ x: 668 + (j % 8) * 46, y: 1052 + Math.floor(j / 8) * 50 }));
  const FIRE: [number, number] = [520, 1010];
  const glint = interpolate(t, [b[3] + 0.4, b[3] + 1.3], [-0.2, 1.2], clamp);
  return (
    <g>
      {/* Der Berg */}
      <path d={MOUNT} fill="#0B0F18" />
      <path d={MOUNT_FACE} fill="url(#bgFace)" />
      {MOUNT_LINES.map((d, i) => (
        <path key={i} d={d} stroke="#05070C" strokeWidth={5} fill="none" opacity={0.8} strokeLinejoin="round" />
      ))}
      <path d="M 760 360 L 772 430 L 752 418 L 744 470 L 730 440 L 716 470 L 726 420 Z" fill="#D6E6EE" opacity={0.75} />
      <path d="M 760 360 L 800 420 L 788 432 L 776 414 Z" fill="#AFC4D0" opacity={0.5} />
      <path d={MOUNT_RIM} stroke={MOON} strokeWidth={4} fill="none" opacity={0.6} />
      <CloudBank y={640} frame={frame} color="#16223A" top="#3A4E6A" o={0.6} speed={0.5} seed="bm" solid={false} scale={0.7} />
      <text x={790} y={300} textAnchor="middle" fontFamily="Cinzel" fontWeight={700} fontSize={36} letterSpacing={6} fill="#D8EEF6" opacity={0.85} stroke="#05070C" strokeWidth={6} paintOrder="stroke">
        BERG SCHELEM
      </text>
      {/* Felsband vorne */}
      <path d="M 0 1110 C 200 1086, 420 1100, 640 1094 C 820 1090, 960 1100, 1080 1092 L 1080 1920 L 0 1920 Z" fill="#0B0D12" />
      <path d="M 0 1110 C 200 1086, 420 1100, 640 1094 C 820 1090, 960 1100, 1080 1092" stroke={MOON} strokeWidth={3} fill="none" opacity={0.35} />
      {/* Schmelzfeuer am Felsen */}
      <g opacity={fireO}>
        <circle cx={FIRE[0]} cy={FIRE[1]} r={420} fill="url(#bgFire)" opacity={0.8 * fl} style={{ mixBlendMode: "screen" }} />
        <path d="M 400 1104 C 396 1030, 440 970, 520 962 C 600 966, 640 1020, 636 1104 Z" fill="#1A1410" stroke="#3A2A1E" strokeWidth={4} />
        <path d="M 470 1040 L 500 1010 L 520 1036 L 556 1000 L 578 1030" stroke="#FF8A3A" strokeWidth={6} fill="none" opacity={0.85 * fl} strokeLinecap="round" />
        <Flame x={520} y={968} k={0.75} frame={frame} />
        <Flame x={556} y={972} k={0.45} frame={frame + 7} />
      </g>
      {/* Sechzehn Steine fliegen aus dem Feuer in die Reihe – glühend, dann klar */}
      {slots.map((sl, j) => {
        const tj = t0 + (j / 16) * (t1 - t0);
        const fly = interpolate(t, [tj, tj + 0.35], [0, 1], { ...clamp, easing: Easing.out(Easing.quad) });
        if (fly <= 0) return null;
        const x = FIRE[0] + (sl.x - FIRE[0]) * fly;
        const y = FIRE[1] - 40 + (sl.y - FIRE[1] + 40) * fly - 120 * Math.sin(Math.PI * fly);
        const sweep = Math.max(0, 1 - Math.abs((sl.x - 668) / 322 - glint) * 5);
        return <Stone key={j} x={x} y={y} r={19} i={j} frame={frame} hot={cool(j)} lit={0.25 * (1 - cool(j)) + 0.6 * sweep} halo={0.5} />;
      })}
      {/* Der Bruder Jareds – denkt nach, dann ans Werk */}
      <Robed x={250} y={1106} k={1.15} rim={mixHex(MOON, WARM, fireO)} rimSide={1} pose={{ bow: 0.35 * (1 - fireO), reach: 0.75 * fireO }} />
      {think > 0.01 ? (
        <g transform="translate(262 732)" opacity={think}>
          <circle r={50 + 6 * Math.sin(frame / 5)} fill="url(#bgHalo)" opacity={0.6} />
          <path d="M 0 -26 L 6 -6 L 26 0 L 6 6 L 0 26 L -6 6 L -26 0 L -6 -6 Z" fill="#F2FEFF" transform={`scale(${0.8 + 0.2 * Math.sin(frame / 4)})`} />
        </g>
      ) : null}
    </g>
  );
};

const SUMMIT = "M 0 1330 L 0 1040 C 90 1010, 170 990, 250 1000 C 330 1008, 380 978, 470 976 L 930 970 C 980 990, 1030 1030, 1080 1060 L 1080 1330 Z";

const MountStage: React.FC<StageP> = ({ t, frame, b }) => {
  const kneelAt = b[0] + 1.05;
  const climb = interpolate(t, [-0.2, kneelAt - 0.15], [0, 1], { ...clamp, easing: Easing.out(Easing.sin) });
  const kneel = fade(t, kneelAt - 0.15, 0.4);
  const raise = interpolate(t, [b[1] - 0.2, b[1] + 0.6], [0, 1], { ...clamp, easing: ease });
  const beam = interpolate(t, [b[1] + 0.2, b[1] + 1.6], [0, 0.45], clamp);
  const wx = 70 + 340 * climb;
  const wy = 1110 - 128 * climb;
  return (
    <g>
      <CloudBank y={1040} frame={frame} color="#2C3D56" top="#6A84A2" o={0.95} speed={0.6} seed="mc" />
      <CloudBank y={1130} frame={frame + 400} color="#1C2A40" top="#40587A" o={1} speed={0.9} seed="mc2" />
      <path d={SUMMIT} fill="url(#bgRock)" />
      <path d="M 0 1040 C 90 1010, 170 990, 250 1000 C 330 1008, 380 978, 470 976 L 930 970" stroke={MOON} strokeWidth={3} fill="none" opacity={0.4} />
      {/* Ein flacher Stein, darauf die sechzehn */}
      <path d="M 560 974 L 590 940 L 900 936 L 930 970 Z" fill="#2A2E38" stroke={MOON} strokeWidth={2} strokeOpacity={0.4} />
      {Array.from({ length: 16 }, (_, j) => (
        <Stone key={j} x={612 + (j % 8) * 38} y={950 - Math.floor(j / 8) * 2 + (j >= 8 ? -14 : 8)} r={13} i={j} frame={frame} o={fade(t, kneelAt + 0.1 + j * 0.03, 0.25)} lit={0.15 + beam * 0.4} halo={0.5} />
      ))}
      {/* Licht von oben, das sich auf die Steine legt */}
      <Beam x={748} top={230} bottom={962} w0={160} w1={420} o={beam * 1.6} />
      {/* Er steigt hinauf, das Bündel vor der Brust – dann kniet er */}
      <Robed x={wx} y={wy} k={1.05} rim={MOON} rimSide={1} pose={{ step: frame * 0.17, hold: 1 }} o={1 - kneel} />
      {1 - kneel > 0.01 ? <ellipse cx={wx + 22} cy={wy - 200} rx={20} ry={14} fill="#CFE3EA" opacity={0.7 * (1 - kneel)} /> : null}
      <Kneeling x={460} y={978} k={1.05} raise={raise} o={kneel} />
    </g>
  );
};

const TouchStage: React.FC<StageP> = ({ t, frame, b }) => {
  const t0 = b[0] + 0.25;
  const t1 = b[2] - 0.15;
  const slots = Array.from({ length: 16 }, (_, j) => {
    const row = Math.floor(j / 8);
    const col = row === 0 ? j % 8 : 7 - (j % 8);
    return { x: 130 + col * 117, y: row === 0 ? 806 : 914 };
  });
  const tj = (j: number) => t0 + (j / 16) * (t1 - t0);
  const lit = (j: number) => interpolate(t, [tj(j), tj(j) + 0.18], [0, 1], clamp);
  const count = slots.reduce((n, _, j) => n + (t >= tj(j) ? 1 : 0), 0);
  // Der Lichtpunkt: von Stein zu Stein, mit kleinem Bogen
  const seg = Math.min(15, Math.max(0, Math.floor(((t - t0) / (t1 - t0)) * 16)));
  const u = Math.max(0, Math.min(1, ((t - tj(seg)) / ((t1 - t0) / 16))));
  const a = slots[seg];
  const nb = slots[Math.min(15, seg + 1)];
  const px = a.x + (nb.x - a.x) * u;
  const py = a.y - 70 - 60 * Math.sin(Math.PI * u) + 50 * Math.max(0, 1 - u * 6);
  const pointO = interpolate(t, [t0 - 0.4, t0, t1 + 0.1, t1 + 0.5], [0, 1, 1, 0], clamp);
  const all = interpolate(t, [b[2] - 0.05, b[2] + 0.35, b[2] + 1.2], [0, 1, 0.55], clamp);
  const see = interpolate(t, [b[3] + 0.4, b[3] + 1.4], [0, 1], { ...clamp, easing: ease });
  const bow = interpolate(t, [b[3] + 1.0, b[3] + 1.7], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  return (
    <g>
      <CloudBank y={660} frame={frame} color="#24344C" o={0.85} speed={0.4} seed="tc" />
      {/* Felsplatte */}
      <path d="M 0 760 C 200 740, 880 736, 1080 756 L 1080 1330 L 0 1330 Z" fill="url(#bgRock)" />
      <path d="M 40 760 C 240 742, 840 738, 1040 754 L 1060 980 C 840 996, 240 996, 20 982 Z" fill="#2A303C" />
      <path d="M 40 760 C 240 742, 840 738, 1040 754" stroke={MOON} strokeWidth={3} fill="none" opacity={0.45} />
      <ellipse cx={540} cy={860} rx={560} ry={200} fill="url(#bgHalo)" opacity={0.35 * all + 0.12 * (count / 16)} style={{ mixBlendMode: "screen" }} />
      {slots.map((sl, j) => (
        <Stone key={j} x={sl.x} y={sl.y} r={40} i={j} frame={frame} lit={Math.max(0.12, lit(j))} halo={0.8 + 0.5 * all} />
      ))}
      {/* Kein Bild vom Herrn – nur Licht von oben */}
      {pointO > 0.01 ? (
        <g opacity={pointO} style={{ mixBlendMode: "screen" }}>
          <path d={`M ${px - 30} 230 L ${px + 30} 230 L ${px + 8} ${py} L ${px - 8} ${py} Z`} fill="url(#bgBeam)" opacity={0.45} />
          <circle cx={px} cy={py} r={70} fill="url(#bgHalo)" />
          <circle cx={px} cy={py} r={11} fill="#FFFFFF" />
        </g>
      ) : null}
      {/* Er sieht den Finger des Herrn: Licht von oben über allem */}
      {see > 0.01 ? (
        <g style={{ mixBlendMode: "screen" }}>
          <ellipse cx={540} cy={160} rx={760} ry={860} fill="url(#bgHalo)" opacity={0.9 * see} />
        </g>
      ) : null}
      {see > 0.01 ? (
        <g>
          <Beam x={540} top={0} bottom={1060} w0={340} w1={1060} o={see * 1.1} />
        </g>
      ) : null}
      <Kneeling x={170} y={1186} k={0.9} raise={1 - bow} bow={bow} rim={mixHex(MOON, "#F2FEFF", Math.max(all, see))} />
    </g>
  );
};

const VoyageStage: React.FC<StageP> = ({ t, frame, b, ts }) => {
  const { durationInFrames } = useVideoConfig();
  const global = ts.from + frame;
  const storm = stormAt(global / Math.max(1, durationInFrames));
  const gt = global / FPS;
  const amp = 0.5 + 1.0 * storm;
  const ripple = (x: number, ph = 0) => amp * (58 * Math.sin(x / 230 + gt * 1.5 + ph) + 30 * Math.sin(x / 113 - gt * 2.2 + ph));
  const dRipple = (x: number, ph = 0) => amp * ((58 / 230) * Math.cos(x / 230 + gt * 1.5 + ph) + (30 / 113) * Math.cos(x / 113 - gt * 2.2 + ph));
  const tilt = (x: number, ph = 0) => ((Math.atan(dRipple(x, ph)) * 180) / Math.PI) * 0.9;
  const zoom = interpolate(t, [b[1] - 0.45, b[1] + 0.7], [0, 1], { ...clamp, easing: ease });
  // Zwei Steine fliegen in das Schiff, je einer an ein Ende
  const s1 = interpolate(t, [b[0] + 0.1, b[0] + 0.6], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  const s2 = interpolate(t, [b[0] + 0.5, b[0] + 1.0], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  const g1 = fade(t, b[0] + 0.55, 0.3);
  const g2 = fade(t, b[0] + 0.95, 0.3);
  const ever = 1 + 0.4 * fade(t, b[3] - 0.1, 0.4) * (0.8 + 0.2 * Math.sin(frame / 4));
  // Ein Wellenberg rollt durchs Bild und begräbt ein Schiff – das Licht leuchtet unter Wasser weiter
  const rise = interpolate(t, [b[1] - 0.3, b[1] + 0.7, b[2] + 1.4, b[2] + 2.6], [0, 1, 1, 0.25], { ...clamp, easing: ease });
  const crestX = interpolate(t, [b[1] - 0.3, b[3] + 0.6], [-60, 560], clamp);
  const bump = (x: number) => 430 * rise * Math.exp(-(((x - crestX) / 220) ** 2));
  const heroK = 1.6 - 0.86 * zoom;
  const heroBaseY = 1070;
  const heroX = 600;
  const heroY = interpolate(zoom, [0, 1], [880 + 0.3 * ripple(540), heroBaseY + ripple(heroX)]);
  const heroRot = tilt(heroX) * zoom + Math.sin(frame / 15) * 3 * (1 - zoom);
  const fleet = [
    { x: 120, base: 925, k: 0.34, ph: 0.6 },
    { x: 380, base: 915, k: 0.3, ph: 1.9 },
    { x: 700, base: 922, k: 0.32, ph: 2.6 },
    { x: 960, base: 930, k: 0.36, ph: 3.4 },
    { x: 250, base: 1020, k: 0.56, ph: 4.2 },
    { x: 930, base: 1010, k: 0.54, ph: 5.1 },
    { x: 1060, base: 960, k: 0.4, ph: 0.2 },
  ];
  const surface = (base: number, ph: number, k: number, withBump: boolean) => {
    const pts: string[] = [];
    for (let x = -40; x <= 1120; x += 16) pts.push(`${x} ${(base + k * ripple(x, ph) - (withBump ? bump(x) : 0)).toFixed(1)}`);
    return pts;
  };
  const wave1 = surface(1150, 1.2, 1.35, true);
  const wave2 = surface(1270, 2.4, 1.6, false);
  const buried = Math.min(1, bump(fleet[4].x) / 200);
  const near = interpolate(zoom, [0, 1], [0, 1]);
  return (
    <g>
      {/* Die anderen Schiffe, alle mit zwei Lichtern */}
      {fleet.map((o, i) => (
        <Barge key={i} id={`v${i}`} x={o.x} y={o.base + (o.base > 990 ? 1 : 0.55) * ripple(o.x, o.ph)} k={o.k} rot={tilt(o.x, o.ph)} glow={[ever * zoom, ever * zoom]} dim={o.base > 990 ? 0.15 : 0.35} o={zoom} frame={frame} />
      ))}
      {/* Das nahe Schiff: zwei Steine, je einer an jedem Ende */}
      <Barge id="held" x={interpolate(zoom, [0, 1], [540, heroX])} y={heroY} k={heroK} rot={heroRot} glow={[g1 * ever, g2 * ever]} frame={frame} />
      {s1 > 0 && s1 < 1 ? <Stone x={540 + (540 - 150 * heroK - 540) * s1} y={300 + (heroY - 8 - 300) * s1} r={30} i={1} frame={frame} lit={1} /> : null}
      {s2 > 0 && s2 < 1 ? <Stone x={540 + (540 + 150 * heroK - 540) * s2} y={300 + (heroY - 8 - 300) * s2} r={30} i={2} frame={frame} lit={1} /> : null}
      {/* Wasser vor dem nahen Schiff in der Nahaufnahme */}
      {1 - near > 0.01 ? (
        <g opacity={1 - near}>
          <path d={`M -40 1920 L ${surface(heroY + 52, 0.4, 0.35, false).join(" L ")} L 1120 1920 Z`} fill="#0A2232" opacity={0.92} />
          <path d={`M ${surface(heroY + 52, 0.4, 0.35, false).join(" L ")}`} stroke="#9FC2D2" strokeWidth={4} fill="none" opacity={0.5} />
        </g>
      ) : null}
      {/* Hohe Wellen vorne – mit dem Wellenberg */}
      <g opacity={near}>
        <path d={`M -40 1920 L ${wave1.join(" L ")} L 1120 1920 Z`} fill="url(#bgWave)" opacity={0.9} />
        {buried > 0.05 ? (
          <circle cx={fleet[4].x} cy={fleet[4].base + ripple(fleet[4].x, fleet[4].ph)} r={150} fill="url(#bgHalo)" opacity={0.6 * buried * ever} style={{ mixBlendMode: "screen" }} />
        ) : null}
        <path d={`M ${wave1.join(" L ")}`} stroke="#D8EAF2" strokeWidth={5} fill="none" opacity={0.75} />
        <path d={`M ${wave1.join(" L ")}`} stroke="#F2FAFF" strokeWidth={12} fill="none" opacity={0.35} strokeDasharray="70 30 26 40" strokeDashoffset={-frame * 4} strokeLinecap="round" />
        <path d={`M -40 1920 L ${wave2.join(" L ")} L 1120 1920 Z`} fill="url(#bgWave)" opacity={0.75} />
        <path d={`M -40 1920 L ${wave2.join(" L ")} L 1120 1920 Z`} fill="#04111A" opacity={0.5} />
        <path d={`M ${wave2.join(" L ")}`} stroke="#A8C8D6" strokeWidth={5} fill="none" opacity={0.5} strokeDasharray="40 22" strokeDashoffset={frame * 3} />
      </g>
      {/* Gischt über dem Wellenberg */}
      {rise > 0.2
        ? Array.from({ length: 26 }, (_, i) => {
            const life = ((frame + i * 7) % 26) / 26;
            const x0 = crestX - 160 + (i * 37) % 320;
            const y0 = 1150 + 1.35 * ripple(x0, 1.2) - bump(x0);
            return <circle key={i} cx={x0 + life * 60} cy={y0 - life * 70 + life * life * 60} r={3 + (i % 4)} fill="#E6F2F8" opacity={0.7 * (1 - life) * rise} />;
          })
        : null}
    </g>
  );
};

const RecapStage: React.FC<StageP> = ({ frame }) => (
  <g>
    {/* Ruhiges Meer am Morgen: acht Lichter am Horizont */}
    {Array.from({ length: 8 }, (_, i) => {
      const x = 120 + i * 120 + ((frame * 0.25) % 120);
      const k = 0.2 + (i % 3) * 0.04;
      const y = HORIZON + 34 + (i % 3) * 22 + Math.sin(frame / 20 + i) * 3;
      return <Barge key={i} id={`r${i}`} x={x} y={y} k={k} rot={Math.sin(frame / 25 + i) * 2} glow={[1, 1]} dim={0.4} frame={frame} rim="#FFD2A6" />;
    })}
  </g>
);

/* ------------------------------------------------------------------ */
/* Szene                                                               */
/* ------------------------------------------------------------------ */

export const Scene: React.FC<{ ts: TimelineScene }> = ({ ts }) => {
  const s = ts.scene as BargesSceneT;
  const frame = useCurrentFrame();
  const look = useLook();
  const t = (frame - ts.audioOffsetFrames) / FPS;
  const b = beats(ts, s.cues, Math.max(4, s.cues.length));
  const f = (sec: number) => voiceFrame(ts, sec);
  const p: StageP = { s, ts, t, frame, b };
  const lineAt = s.lines.map((l, i) => beat(ts, l.at, 0.3 + i * 1.2));
  const sayAt = beat(ts, s.say?.at, ts.speechEndSec - 1);

  /* Grosse Zeilen: hook – Zähler; air – Probleme; recap – die Liste */
  const counters =
    s.stage === "hook" ? (
      <div style={{ position: "absolute", top: 300, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        {s.lines.map((l, i) => {
          const k = pop(t, lineAt[i] - 0.05, 0.3);
          const [num, ...rest] = l.text.split(" ");
          const zero = num === "0";
          return (
            <div
              key={i}
              style={{
                fontFamily: look.display,
                fontSize: 132,
                lineHeight: 1.04,
                textTransform: "uppercase",
                color: look.text,
                opacity: Math.min(1, k * 1.6),
                transform: `scale(${interpolate(k, [0, 1], [1.5, 1])})`,
                textShadow: look.glow,
                letterSpacing: "0.02em",
              }}
            >
              <span style={{ color: zero ? RED : look.accent }}>{num}</span> {rest.join(" ")}
            </div>
          );
        })}
      </div>
    ) : null;

  const board =
    s.stage === "air" ? (
      <div style={{ position: "absolute", top: 268, left: 150, right: 150, padding: "26px 44px 22px", borderRadius: 26, background: "rgba(6,14,24,0.72)", border: `2px solid rgba(191,243,255,0.35)`, opacity: fade(t, lineAt[0] - 0.3, 0.3) }}>
        <div style={{ fontFamily: look.label, fontWeight: 800, fontSize: 30, letterSpacing: "0.3em", color: look.dim, textAlign: "center" }}>PROBLEME</div>
        {s.lines.map((l, i) => {
          const k = pop(t, lineAt[i] - 0.05, 0.3);
          const solved = i === 0 && t >= b[2] + 0.35;
          const flip = i === 0 ? pop(t, b[2] + 0.35, 0.3) : 0;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, opacity: Math.min(1, k * 1.6), transform: `translateX(${(1 - k) * -40}px)` }}>
              <span style={{ fontFamily: look.display, fontSize: 104, lineHeight: 1.1, textTransform: "uppercase", color: solved ? "#7CFFB2" : look.text, textShadow: look.glow }}>{l.text}</span>
              <svg width={96} height={96} viewBox="-48 -48 96 96">
                <Mark x={0} y={0} ok={solved} k={solved ? flip : k} size={40} />
              </svg>
            </div>
          );
        })}
      </div>
    ) : null;

  const recap =
    s.stage === "recap" ? (
      <div style={{ position: "absolute", top: 292, left: 120, right: 120 }}>
        {s.lines.map((l, i) => {
          const k = pop(t, lineAt[i] - 0.05, 0.3);
          const check = pop(t, lineAt[i] + 0.35, 0.3);
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 28, height: 118, opacity: Math.min(1, k * 1.6), transform: `translateY(${(1 - k) * 30}px)` }}>
              <svg width={92} height={92} viewBox="-46 -46 92 92" style={{ flexShrink: 0 }}>
                <circle r={38} fill="rgba(191,243,255,0.08)" stroke="rgba(191,243,255,0.4)" strokeWidth={4} />
                <Mark x={0} y={0} ok k={check} size={38} />
              </svg>
              <span style={{ fontFamily: look.display, fontSize: 96, textTransform: "uppercase", color: look.text, textShadow: look.glow, whiteSpace: "nowrap" }}>{l.text}</span>
            </div>
          );
        })}
        {s.say ? (
          <div
            style={{
              marginTop: 54,
              textAlign: "center",
              fontFamily: look.display,
              fontSize: 118,
              lineHeight: 1,
              whiteSpace: "nowrap",
              textTransform: "uppercase",
              color: look.accent,
              textShadow: look.glow,
              opacity: Math.min(1, pop(t, sayAt - 0.05, 0.35) * 1.6),
              transform: `scale(${interpolate(pop(t, sayAt - 0.05, 0.35), [0, 1], [1.4, 1])})`,
            }}
          >
            {s.say.text}
          </div>
        ) : null}
      </div>
    ) : null;

  /* Die Frage zurück – leise, im Dunkeln */
  const question =
    s.stage === "dark" && s.say ? (
      <div style={{ position: "absolute", top: 330, left: 70, right: 70, textAlign: "center" }}>
        {s.say.text.split(/(?<=,)\s+/).map((part, i) => {
          const k = fade(t, sayAt - 0.1 + i * 0.55, 0.5);
          return (
            <div
              key={i}
              style={{
                fontFamily: "Cormorant Garamond",
                fontStyle: "italic",
                fontWeight: 600,
                fontSize: 104,
                lineHeight: 1.12,
                color: "#EAF9FF",
                opacity: k,
                transform: `translateY(${(1 - k) * 24}px)`,
                textShadow: "0 0 30px rgba(191,243,255,0.55), 0 6px 30px rgba(0,0,0,0.8)",
              }}
            >
              {part}
            </div>
          );
        })}
      </div>
    ) : null;

  /* Zähler: Steine am Feuer, Steine im Licht, Tage auf dem Meer */
  let hud: { label: string; value: string; o: number; left?: boolean } | null = null;
  if (s.stage === "stones") {
    const t0 = b[1] + 0.45;
    const t1 = b[2] + 0.9;
    const n = Math.max(0, Math.min(16, Math.floor(((t - t0) / (t1 - t0)) * 16) + 1));
    hud = { label: "STEINE", value: `${t < t0 ? 0 : n} / 16`, o: fade(t, t0 - 0.2, 0.3), left: true };
  } else if (s.stage === "touch") {
    const t0 = b[0] + 0.25;
    const t1 = b[2] - 0.15;
    const n = Math.max(0, Math.min(16, Math.floor(((t - t0) / (t1 - t0)) * 16) + 1));
    hud = { label: "LEUCHTEN", value: `${t < t0 ? 0 : n} / 16`, o: fade(t, t0 - 0.3, 0.3) * (1 - fade(t, b[3] + 0.3, 0.5)) };
  } else if (s.stage === "voyage") {
    const n = Math.round(interpolate(t, [b[1] + 0.1, b[2] + 0.45], [1, 344], { ...clamp, easing: Easing.out(Easing.cubic) }));
    hud = { label: "AUF DEM MEER", value: `Tag ${n}`, o: fade(t, b[1], 0.3) };
  }

  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id="bgHalo">
            <stop offset="0%" stopColor="#F4FEFF" stopOpacity="0.95" />
            <stop offset="30%" stopColor={LIGHT} stopOpacity="0.45" />
            <stop offset="100%" stopColor={LIGHT} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="bgEmber">
            <stop offset="0%" stopColor="#FFD08A" stopOpacity="0.9" />
            <stop offset="45%" stopColor="#FF7A2E" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#FF7A2E" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="bgFire">
            <stop offset="0%" stopColor="#FFB25A" stopOpacity="0.55" />
            <stop offset="50%" stopColor="#E0702E" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#E0702E" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="bgBeam" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F4FEFF" stopOpacity="0" />
            <stop offset="35%" stopColor="#E8FBFF" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#F4FEFF" stopOpacity="0.75" />
          </linearGradient>
          <linearGradient id="bgWood" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6A4428" />
            <stop offset="45%" stopColor={WOOD} />
            <stop offset="100%" stopColor="#1E120A" />
          </linearGradient>
          <linearGradient id="bgSand" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3A3024" />
            <stop offset="30%" stopColor="#211A12" />
            <stop offset="100%" stopColor="#0A0806" />
          </linearGradient>
          <linearGradient id="bgRock" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#2A3140" />
            <stop offset="55%" stopColor="#151A24" />
            <stop offset="100%" stopColor="#07090E" />
          </linearGradient>
          <linearGradient id="bgFace" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3A4C66" />
            <stop offset="45%" stopColor="#223047" />
            <stop offset="100%" stopColor="#0F1520" />
          </linearGradient>
          <linearGradient id="bgWave" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2C6E8A" />
            <stop offset="22%" stopColor="#164660" />
            <stop offset="60%" stopColor="#0A2536" />
            <stop offset="100%" stopColor="#04111A" />
          </linearGradient>
          <radialGradient id="bgVignette" cx="50%" cy="45%" r="75%">
            <stop offset="55%" stopColor="#000" stopOpacity="0" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.75" />
          </radialGradient>
        </defs>
        {s.stage === "hook" ? <HookStage {...p} /> : null}
        {s.stage === "build" ? <BuildStage {...p} /> : null}
        {s.stage === "air" ? <AirStage {...p} /> : null}
        {s.stage === "dark" ? <DarkStage {...p} /> : null}
        {s.stage === "stones" ? <StonesStage {...p} /> : null}
        {s.stage === "mount" ? <MountStage {...p} /> : null}
        {s.stage === "touch" ? <TouchStage {...p} /> : null}
        {s.stage === "voyage" ? <VoyageStage {...p} /> : null}
        {s.stage === "recap" ? <RecapStage {...p} /> : null}
      </svg>

      {counters}
      {board}
      {question}
      {recap}
      {hud && hud.o > 0.01 ? (
        <div style={{ position: "absolute", top: 268, left: hud.left ? 72 : 0, right: 0, textAlign: hud.left ? "left" : "center", opacity: hud.o }}>
          <div style={{ fontFamily: look.label, fontWeight: 800, fontSize: 30, letterSpacing: "0.32em", color: look.dim }}>{hud.label}</div>
          <div style={{ fontFamily: look.display, fontSize: 120, lineHeight: 1.05, color: look.accent, textShadow: look.glow, fontVariantNumeric: "tabular-nums" }}>{hud.value}</div>
        </div>
      ) : null}

      {/* Wenige, tiefe Klänge */}
      {s.stage === "hook" ? <Sfx frame={f(lineAt[2])} name="thud" volume={0.4} keep /> : null}
      {s.stage === "dark" ? <Sfx frame={f(b[0] + 0.85)} name="thud" volume={0.45} keep /> : null}
      {s.stage === "touch" ? <Sfx frame={f(b[2])} name="warm" volume={0.4} keep /> : null}
      {s.stage === "recap" ? <Sfx frame={f(sayAt)} name="warm" volume={0.35} keep /> : null}
    </AbsoluteFill>
  );
};

/** Was gross im Bild steht – Zähler, Probleme, die Frage, die Liste –, wird nicht untertitelt. */
export const hidden = (ts: TimelineScene): Set<number> => {
  const s = ts.scene as BargesSceneT;
  return wordsOfTexts(ts, [...s.lines.map((l) => l.at), s.say?.at]);
};
