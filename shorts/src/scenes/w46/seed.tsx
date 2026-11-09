import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, random, spring, useCurrentFrame } from "remotion";
import { LAB_BENCH } from "../../components/backgrounds/w46/LabBg";
import { mix } from "../../lib/color";
import { Sfx, beat, beats, voiceFrame } from "../../lib/sfx";
import { FPS, type TimelineScene } from "../../lib/timing";
import { useLook } from "../../looks";
import type { Scene as SceneData } from "../../schema";
import { Robed, Stamp, usePop, wordsOfTexts } from "../w45/kitA";

/*
 * Das Experiment (Alma 32) als Laborversuch. Ein Samenkorn unter der Lupe, ein Glastopf im
 * Querschnitt – Erde, Wurzeln, Keimling –, ein Messlineal und oben das Versuchsprotokoll, in
 * dem die Beobachtungen getippt erscheinen, sobald die Stimme sie nennt. Die Vorgeschichte
 * läuft auf einem Bildschirm im Labor («Abb. 1», «Abb. 2»): die armen Zoramiten, die aus der
 * Synagoge geworfen werden, und ihre Frage an Alma auf dem Hügel Onidah. Die Gegenprobe zeigt
 * einen zweiten Topf ohne Pflege, der in der Hitze verdorrt; am Ende wächst ein Baum mit
 * weisser, leuchtender Frucht. Zum Schluss stehen Pflänzchen in allen Grössen auf der Bank.
 *
 * Das Licht des Labors kommt aus `LabBg`; die Bank liegt dort bei `LAB_BENCH`.
 */

type SeedSceneT = Extract<SceneData, { type: "seed" }>;
type P = [number, number];

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = Easing.inOut(Easing.sin);
const fade = (t: number, at: number, d = 0.4) => interpolate(t, [at, at + d], [0, 1], clamp);
const ramp = (t: number, a: number, b: number) => interpolate(t, [a, Math.max(a + 0.01, b)], [0, 1], { ...clamp, easing: ease });
const typed = (s: string, k: number) => s.slice(0, Math.round(s.length * Math.max(0, Math.min(1, k))));

const MONO = '"Space Mono"';
const BENCH = LAB_BENCH;

const LEAF = "#4FD27F";
const LEAF_DARK = "#2C8F52";
const LEAF_LIGHT = "#B4FFCF";
const DRY = "#9A7A44";
const DRY_DARK = "#5E4426";
const ROOT = "#EADFC6";

/* ------------------------------------------------------------------ */
/* Samenkorn                                                           */
/* ------------------------------------------------------------------ */

/** Ein Samenkorn, Mitte bei (x, y), etwa 28 × 18 bei s = 1. `split` öffnet die Schale, `glow` leuchtet golden. */
const Seed: React.FC<{ x: number; y: number; s: number; glow?: number; split?: number; rot?: number; frame: number }> = ({ x, y, s, glow = 0, split = 0, rot = -14, frame }) => {
  const pulse = 1 + 0.06 * Math.sin(frame / 6);
  const half = (top: boolean) => (
    <g transform={top ? `rotate(${-22 * split} -12 0) translate(0 ${-3 * split})` : `rotate(${10 * split} -12 0) translate(0 ${3 * split})`}>
      <path
        d={top ? "M -14 0 C -14 -9, -4 -10, 3 -9.5 C 11 -8, 15 -4, 14 0 Z" : "M -14 0 L 14 0 C 13 6, 4 9.5, -4 9 C -11 8, -14 4, -14 0 Z"}
        fill={top ? "#D9A458" : "#B9813E"}
        stroke="#6E4618"
        strokeWidth={1.4}
      />
      {top ? <path d="M -8 -5 C -2 -7.5, 5 -7.5, 9 -5" stroke="#FFE7B8" strokeWidth={1.6} fill="none" opacity={0.75} strokeLinecap="round" /> : null}
    </g>
  );
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
      {glow > 0 ? <circle r={34 * pulse} fill="url(#sdSeedGlow)" opacity={glow} /> : null}
      {split > 0 ? <path d="M -6 0 C -2 -1, 4 -1, 9 0" stroke="#F4FFE8" strokeWidth={2.2 * split} fill="none" /> : null}
      {half(false)}
      {half(true)}
    </g>
  );
};

/* ------------------------------------------------------------------ */
/* Keimling mit Wurzeln                                                */
/* ------------------------------------------------------------------ */

const bez = (p0: P, p1: P, p2: P, p3: P, u: number): P => {
  const v = 1 - u;
  return [
    v * v * v * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0],
    v * v * v * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1],
  ];
};

const Leaf: React.FC<{ x: number; y: number; size: number; angle: number; fill: string; vein: string }> = ({ x, y, size, angle, fill, vein }) =>
  size > 0.01 ? (
    <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${size})`}>
      <path d="M 0 0 C 14 -16, 50 -20, 76 -2 C 52 16, 16 14, 0 0 Z" fill={fill} />
      <path d="M 4 0 C 26 -4, 50 -4, 70 -2" stroke={vein} strokeWidth={2} fill="none" opacity={0.8} />
    </g>
  ) : null;

/**
 * Keimling in Topf-Koordinaten: (0, 0) ist die Erdoberfläche, das Korn liegt bei `seedY`.
 * `g` 0 … 1 = Höhe über der Erde (bis `H`), `roots` 0 … 1, `dry` 0 … 1 lässt ihn welken.
 */
const Sprout: React.FC<{ g: number; dry: number; seedY: number; H: number; frame: number; phase?: number }> = ({ g, dry, seedY, H, frame, phase = 0 }) => {
  if (g <= 0.005) return null;
  const sway = Math.sin(frame / 38 + phase) * 6 * g * (1 - dry);
  const droop = dry;
  const top: P = [sway + 46 * droop * g, -g * H * (1 - 0.42 * droop)];
  const p0: P = [0, seedY - 6];
  const p1: P = [-10, seedY * 0.35];
  const p2: P = [sway * 0.3 - 6 * (1 - droop), top[1] * 0.55];
  const p3: P = top;
  const color = mix(LEAF, DRY, dry);
  const dark = mix(LEAF_DARK, DRY_DARK, dry);
  const light = mix(LEAF_LIGHT, "#D8C08A", dry);
  const width = 5 + 6 * g;
  const pts = Array.from({ length: 22 }, (_, i) => bez(p0, p1, p2, p3, i / 21));
  const d = `M ${pts.map((q) => `${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join(" L ")}`;
  // Blattpaare: oben die Keimblätter, darunter zwei weitere Paare
  const pairs = [
    { u: 1, thr: 0.08, size: 0.75 + 0.55 * g },
    { u: 0.66, thr: 0.36, size: 0.6 + 0.6 * g },
    { u: 0.4, thr: 0.62, size: 0.55 + 0.55 * g },
  ];
  return (
    <g>
      <path d={d} stroke={dark} strokeWidth={width + 3} fill="none" strokeLinecap="round" />
      <path d={d} stroke={color} strokeWidth={width} fill="none" strokeLinecap="round" />
      {pairs.map((pr, i) => {
        const k = interpolate(g, [pr.thr, pr.thr + 0.16], [0, 1], clamp);
        if (k <= 0) return null;
        const [lx, ly] = bez(p0, p1, p2, p3, pr.u);
        const size = k * pr.size;
        const fl = Math.sin(frame / 30 + i + phase) * 3 * (1 - dry);
        const down = 55 * droop;
        return (
          <g key={i}>
            <Leaf x={lx} y={ly} size={size} angle={-28 + fl + down} fill={color} vein={light} />
            <g transform={`translate(${lx} ${ly}) scale(-1 1)`}>
              <Leaf x={0} y={0} size={size} angle={-28 - fl + down} fill={dark} vein={light} />
            </g>
          </g>
        );
      })}
    </g>
  );
};

/** Wurzeln unter dem Korn – im Topf-Koordinatensystem, geschnitten auf die Erde. */
const Roots: React.FC<{ k: number; seedY: number; len: number; color?: string }> = ({ k, seedY, len, color = ROOT }) => {
  if (k <= 0.01) return null;
  const L = len * k;
  const main = `M 0 ${seedY + 6} C -10 ${seedY + L * 0.35}, 12 ${seedY + L * 0.6}, 2 ${seedY + L}`;
  const side = (u: number, dir: number, l: number) => {
    const y0 = seedY + 6 + L * u;
    return `M ${dir * 2} ${y0} C ${dir * l * 0.4} ${y0 + 8}, ${dir * l * 0.7} ${y0 + l * 0.3}, ${dir * l} ${y0 + l * 0.55}`;
  };
  return (
    <g stroke={color} fill="none" strokeLinecap="round">
      <path d={main} strokeWidth={5} />
      {[
        [0.25, -1, 70],
        [0.32, 1, 62],
        [0.55, -1, 56],
        [0.62, 1, 64],
        [0.8, -1, 34],
        [0.85, 1, 30],
      ].map(([u, dir, l], i) => {
        const kk = interpolate(k, [u * 0.6, u * 0.6 + 0.35], [0, 1], clamp);
        return kk > 0 ? <path key={i} d={side(u, dir, l * kk)} strokeWidth={2.6} opacity={0.9} /> : null;
      })}
    </g>
  );
};

/* ------------------------------------------------------------------ */
/* Glastopf im Querschnitt                                             */
/* ------------------------------------------------------------------ */

const POT_W = 280;
const POT_H = 360;
const SOIL = 250;
const SEED_Y = 70;
/** Der grosse Topf in der Mitte (Material, Beobachtung, Ergebnis, Baum) */
const MAIN_K = 1.15;
const RULER_X = 540 + (POT_W / 2) * MAIN_K + 70;

type PotProps = {
  id: string;
  x: number;
  k?: number;
  /** Keimling 0 … 1 */
  g?: number;
  roots?: number;
  swell?: number;
  split?: number;
  dry?: number;
  /** Herz in der Erde 0 … 1 */
  heart?: number;
  /** Korn fällt in die Erde 0 (oben) … 1 (liegt) – ohne Angabe liegt es schon */
  seedIn?: number;
  seedGlow?: number;
  seedS?: number;
  seedO?: number;
  seedHover?: number;
  /** Hitze von oben 0 … 1 */
  hot?: number;
  /** Fehlende Wurzeln: gestrichelter Umriss 0 … 1 */
  noRoots?: number;
  label?: string;
  labelO?: number;
  glow?: number;
  o?: number;
  frame: number;
  phase?: number;
};

const Pot: React.FC<PotProps> = ({
  id,
  x,
  k = 1,
  g = 0,
  roots = 0,
  swell = 0,
  split = 0,
  dry = 0,
  heart = 0,
  seedIn = 1,
  seedGlow = 0,
  seedS = 1.8,
  seedO = 1,
  seedHover = 0,
  hot = 0,
  noRoots = 0,
  label,
  labelO = 1,
  glow = 0,
  o = 1,
  frame,
  phase = 0,
}) => {
  const hw = POT_W / 2;
  const soilTop = -SOIL;
  const soilA = mix("#4A3426", "#8E7350", dry);
  const soilB = mix("#2A1C14", "#6E5638", dry);
  const pebbles = useMemo(
    () => Array.from({ length: 26 }, (_, i) => ({ x: (random(`pb${id}${i}`) - 0.5) * (POT_W - 30), y: soilTop + 16 + random(`py${id}${i}`) * (SOIL - 30), r: 2 + random(`pr${id}${i}`) * 4 })),
    [id, soilTop],
  );
  const seedLocalY = soilTop + SEED_Y;
  const fallY = interpolate(seedIn, [0, 1], [soilTop - 150, seedLocalY], { ...clamp, easing: Easing.in(Easing.quad) });
  const potPath = `M ${-hw} ${-POT_H} L ${-hw} -26 Q ${-hw} 0 ${-hw + 26} 0 L ${hw - 26} 0 Q ${hw} 0 ${hw} -26 L ${hw} ${-POT_H}`;
  const inner = `M ${-hw + 6} ${soilTop - 4} L ${-hw + 6} -28 Q ${-hw + 6} -6 ${-hw + 28} -6 L ${hw - 28} -6 Q ${hw - 6} -6 ${hw - 6} -28 L ${hw - 6} ${soilTop - 4} Z`;
  const surface = `M ${-hw + 6} ${soilTop + 4} C ${-hw + 60} ${soilTop - 6}, -20 ${soilTop + 8}, 20 ${soilTop} S ${hw - 50} ${soilTop - 4}, ${hw - 6} ${soilTop + 4}`;
  const heat = hot > 0.01;
  return (
    <g transform={`translate(${x} ${BENCH}) scale(${k})`} opacity={o}>
      <defs>
        <clipPath id={`sdSoil${id}`}>
          <path d={inner} />
        </clipPath>
        <linearGradient id={`sdSoilG${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={soilA} />
          <stop offset="100%" stopColor={soilB} />
        </linearGradient>
      </defs>
      <ellipse cx={0} cy={4} rx={hw + 30} ry={16} fill="#000" opacity={0.45} />
      {glow > 0 ? <ellipse cx={0} cy={soilTop - 80} rx={260} ry={300} fill="url(#sdPlantGlow)" opacity={glow} /> : null}
      {/* Glas hinten */}
      <path d={`${potPath} Z`} fill="rgba(150,255,215,0.05)" />
      {/* Erde */}
      <g clipPath={`url(#sdSoil${id})`}>
        <rect x={-hw} y={soilTop - 10} width={POT_W} height={SOIL + 10} fill={`url(#sdSoilG${id})`} />
        <path d={`${surface} L ${hw} ${soilTop - 20} L ${-hw} ${soilTop - 20} Z`} fill="rgba(0,0,0,0)" />
        {pebbles.map((pb, i) => (
          <ellipse key={i} cx={pb.x} cy={pb.y} rx={pb.r * 1.4} ry={pb.r} fill={mix("#6E5440", "#B49A72", dry)} opacity={0.55} />
        ))}
        {/* Schichten */}
        {[0.35, 0.68].map((q) => (
          <path key={q} d={`M ${-hw} ${soilTop + SOIL * q} C -40 ${soilTop + SOIL * q - 8}, 40 ${soilTop + SOIL * q + 8}, ${hw} ${soilTop + SOIL * q - 2}`} stroke="rgba(0,0,0,0.25)" strokeWidth={3} fill="none" />
        ))}
        {heart > 0.01 ? (
          <g transform={`translate(0 ${soilTop + 128}) scale(${0.9 + 0.25 * heart})`} opacity={heart}>
            <circle r={120} fill="url(#sdHeartGlow)" />
            <path d="M 0 52 C -70 6, -84 -50, -44 -64 C -18 -72, 0 -54, 0 -38 C 0 -54, 18 -72, 44 -64 C 84 -50, 70 6, 0 52 Z" fill="none" stroke="#FFC7DE" strokeWidth={4} opacity={0.85} />
          </g>
        ) : null}
        {/* Risse in trockener Erde */}
        {dry > 0.05 ? (
          <g stroke="#3E2C1A" strokeWidth={3} fill="none" opacity={dry}>
            <path d={`M -90 ${soilTop + 4} L -70 ${soilTop + 40} L -84 ${soilTop + 78}`} />
            <path d={`M 60 ${soilTop + 4} L 74 ${soilTop + 36} L 58 ${soilTop + 70} L 70 ${soilTop + 104}`} />
            <path d={`M -10 ${soilTop + 6} L 6 ${soilTop + 30}`} />
          </g>
        ) : null}
        <g transform={`translate(0 ${soilTop})`}>
          <Roots k={roots} seedY={SEED_Y} len={150} />
          {noRoots > 0.01 ? (
            <path d={`M 0 ${SEED_Y + 10} C -12 ${SEED_Y + 60}, 14 ${SEED_Y + 100}, 2 ${SEED_Y + 150} M -4 ${SEED_Y + 50} L -60 ${SEED_Y + 80} M 6 ${SEED_Y + 70} L 58 ${SEED_Y + 100}`} stroke="#FFE2C4" strokeWidth={3} strokeDasharray="8 10" fill="none" opacity={noRoots * 0.7} />
          ) : null}
        </g>
        {/* Oberfläche */}
        <path d={surface} stroke={mix("#6A4C34", "#B89A6E", dry)} strokeWidth={6} fill="none" />
      </g>
      {/* Korn und Keimling */}
      <g opacity={seedO}>
        <Seed x={0} y={fallY + seedHover} s={seedS * (1 + 0.45 * swell)} glow={seedGlow} split={split} frame={frame} />
      </g>
      <g transform={`translate(0 ${soilTop})`}>
        <Sprout g={g} dry={dry} seedY={SEED_Y} H={300} frame={frame} phase={phase} />
      </g>
      {/* Hitze */}
      {heat ? (
        <g opacity={hot}>
          {[-60, 0, 60].map((hx, i) => {
            const yy = soilTop - 220 + ((frame * 2 + i * 40) % 120);
            return <path key={i} d={`M ${hx} ${yy} c 10 -14, -10 -28, 0 -42 c 10 -14, -10 -28, 0 -42`} stroke="#FFB070" strokeWidth={4} fill="none" opacity={0.55} strokeLinecap="round" />;
          })}
        </g>
      ) : null}
      {/* Glas vorne */}
      <path d={potPath} fill="none" stroke="rgba(200,255,232,0.55)" strokeWidth={5} strokeLinejoin="round" />
      <path d={`M ${-hw - 10} ${-POT_H} L ${hw + 10} ${-POT_H}`} stroke="rgba(220,255,240,0.7)" strokeWidth={8} strokeLinecap="round" />
      <path d={`M ${-hw + 22} ${-POT_H + 30} L ${-hw + 22} -40`} stroke="rgba(235,255,245,0.32)" strokeWidth={10} strokeLinecap="round" />
      <path d={`M ${-hw + 44} ${-POT_H + 40} L ${-hw + 44} ${-POT_H + 140}`} stroke="rgba(235,255,245,0.18)" strokeWidth={5} strokeLinecap="round" />
      {[0.2, 0.4, 0.6, 0.8].map((q) => (
        <line key={q} x1={hw - 34} y1={-POT_H * q} x2={hw - 8} y2={-POT_H * q} stroke="rgba(200,255,232,0.45)" strokeWidth={3} />
      ))}
      {label ? (
        <g opacity={labelO}>
          <rect x={-(label.length * 25 + 40) / 2} y={14} width={label.length * 25 + 40} height={60} rx={8} fill="#E8F7EF" stroke="rgba(124,255,178,0.8)" strokeWidth={2} />
          <text x={0} y={57} textAnchor="middle" fontFamily={MONO} fontWeight={700} fontSize={42} fill="#0B2A20">
            {label}
          </text>
        </g>
      ) : null}
    </g>
  );
};

/* ------------------------------------------------------------------ */
/* Baum                                                                */
/* ------------------------------------------------------------------ */

/** Der Baum: Stamm ab der Erdoberfläche bei (x, y0), `k` 0 … 1 Wachstum, `fruit` 0 … 1. */
const Tree: React.FC<{ x: number; y0: number; k: number; fruit: number; frame: number; scale?: number }> = ({ x, y0, k, fruit, frame, scale = 1 }) => {
  const blobs = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => {
        const a = random(`tb${i}`) * Math.PI * 2;
        const r = Math.sqrt(random(`tr${i}`)) * 1;
        return { x: Math.cos(a) * r * 240, y: Math.sin(a) * r * 140, r: 62 + random(`ts${i}`) * 50, c: random(`tc${i}`) };
      }),
    [],
  );
  const fruits = useMemo(
    () =>
      Array.from({ length: 11 }, (_, i) => {
        const a = random(`fa${i}`) * Math.PI * 2;
        const r = 0.25 + Math.sqrt(random(`fr${i}`)) * 0.7;
        return { x: Math.cos(a) * r * 220, y: Math.sin(a) * r * 120 + 20, d: random(`fd${i}`) * 0.6 };
      }),
    [],
  );
  if (k <= 0.005) return null;
  const trunkK = interpolate(k, [0, 0.55], [0, 1], { ...clamp, easing: Easing.out(Easing.quad) });
  const crownK = interpolate(k, [0.3, 1], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.2)) });
  const H = 470 * scale;
  const top: P = [x, y0 - H * trunkK];
  const crownC: P = [x, y0 - H * 0.9];
  const sway = Math.sin(frame / 40) * 4;
  const tw = (26 + 18 * k) * scale;
  return (
    <g>
      {/* Stamm und Äste */}
      <path d={`M ${x - tw} ${y0 + 10} C ${x - tw * 0.6} ${y0 - H * 0.3}, ${x - 12} ${y0 - H * 0.5}, ${top[0] + sway} ${top[1]} L ${top[0] + sway + 10} ${top[1]} C ${x + 14} ${y0 - H * 0.5}, ${x + tw * 0.6} ${y0 - H * 0.3}, ${x + tw} ${y0 + 10} Z`} fill="#5A3B24" />
      <path d={`M ${x - tw * 0.3} ${y0} C ${x - tw * 0.2} ${y0 - H * 0.3}, ${x - 4} ${y0 - H * 0.5}, ${top[0] + sway} ${top[1]}`} stroke="#8A6040" strokeWidth={6 * scale} fill="none" opacity={0.6} />
      {trunkK > 0.5
        ? [
            [-1, 0.55, 150],
            [1, 0.6, 160],
            [-1, 0.75, 110],
            [1, 0.8, 120],
          ].map(([dir, u, l], i) => {
            const kk = interpolate(trunkK, [0.5 + i * 0.08, 0.8 + i * 0.05], [0, 1], clamp);
            const by = y0 - H * u;
            return <path key={i} d={`M ${x} ${by} Q ${x + dir * l * 0.5 * kk * scale} ${by - 30 * scale} ${x + dir * l * kk * scale} ${by - 90 * kk * scale}`} stroke="#5A3B24" strokeWidth={14 * scale} strokeLinecap="round" fill="none" />;
          })
        : null}
      {/* Krone */}
      {crownK > 0.01 ? (
        <g transform={`translate(${crownC[0] + sway} ${crownC[1]}) scale(${crownK * scale})`}>
          <ellipse cx={0} cy={0} rx={320} ry={230} fill="url(#sdPlantGlow)" opacity={0.6 + 0.4 * fruit} />
          {blobs.map((bl, i) => (
            <circle key={`o${i}`} cx={bl.x + 4} cy={bl.y + 8} r={bl.r + 5} fill="#17502F" />
          ))}
          {blobs.map((bl, i) => (
            <circle key={i} cx={bl.x} cy={bl.y} r={bl.r} fill={bl.c < 0.33 ? "#2C8F52" : bl.c < 0.66 ? "#3DB46A" : "#2A7A4C"} />
          ))}
          {blobs.slice(0, 12).map((bl, i) => (
            <circle key={`h${i}`} cx={bl.x - bl.r * 0.25} cy={bl.y - bl.r * 0.3} r={bl.r * 0.55} fill="#6FE39A" opacity={0.35} />
          ))}
          {fruits.map((fr, i) => {
            const fk = interpolate(fruit, [fr.d, fr.d + 0.4], [0, 1], { ...clamp, easing: Easing.out(Easing.back(2)) });
            if (fk <= 0) return null;
            const tw2 = 0.85 + 0.15 * Math.sin(frame / 7 + i);
            return (
              <g key={i} transform={`translate(${fr.x} ${fr.y}) scale(${fk})`}>
                <circle r={44 * tw2} fill="url(#sdFruitGlow)" />
                <circle r={17} fill="#FFFFFF" />
                <circle cx={-5} cy={-5} r={6} fill="#FFFFFF" opacity={0.9} />
                <path d="M 0 -17 L 3 -26" stroke="#3A5A2A" strokeWidth={3} strokeLinecap="round" />
              </g>
            );
          })}
        </g>
      ) : null}
    </g>
  );
};

/* ------------------------------------------------------------------ */
/* Messlineal                                                          */
/* ------------------------------------------------------------------ */

const Ruler: React.FC<{ x: number; top: number; mark: number | null; o: number }> = ({ x, top, mark, o }) => {
  if (o <= 0.01) return null;
  const n = Math.floor((BENCH - top) / 20);
  return (
    <g opacity={o}>
      <rect x={x - 22} y={top - 10} width={44} height={BENCH - top + 10} rx={6} fill="rgba(220,255,236,0.12)" stroke="rgba(200,255,232,0.4)" strokeWidth={2} />
      {Array.from({ length: n + 1 }, (_, i) => {
        const y = BENCH - i * 20;
        const major = i % 5 === 0;
        return (
          <g key={i}>
            <line x1={x - 22} y1={y} x2={x - 22 + (major ? 24 : 12)} y2={y} stroke="rgba(220,255,236,0.7)" strokeWidth={2} />
            {major && i > 0 ? (
              <text x={x + 8} y={y + 7} fontFamily={MONO} fontSize={20} fill="rgba(220,255,236,0.7)">
                {i / 5}
              </text>
            ) : null}
          </g>
        );
      })}
      {mark !== null ? (
        <g>
          <path d={`M ${x - 30} ${mark} L ${x - 52} ${mark - 12} L ${x - 52} ${mark + 12} Z`} fill="#7CFFB2" />
          <line x1={x - 52} y1={mark} x2={x - 140} y2={mark} stroke="#7CFFB2" strokeWidth={2} strokeDasharray="6 6" opacity={0.8} />
        </g>
      ) : null}
    </g>
  );
};

/* ------------------------------------------------------------------ */
/* Versuchsprotokoll                                                   */
/* ------------------------------------------------------------------ */

type Line = { label: string; text: string; k: number };

const Check: React.FC<{ x: number; y: number; k: number }> = ({ x, y, k }) => (
  <path d={`M ${x} ${y - 14} L ${x + 14} ${y} L ${x + 40} ${y - 30}`} stroke="#7CFFB2" strokeWidth={7} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={80} strokeDashoffset={80 * (1 - k)} />
);

const Protocol: React.FC<{ title: string; titleK: number; lines: Line[]; o: number; slide: number; stamp?: { text: string; pop: number }; frame: number }> = ({ title, titleK, lines, o, slide, stamp, frame }) => {
  if (o <= 0.01) return null;
  const x = 80;
  const w = 920;
  const y = 262 - (1 - slide) * 40;
  const twoCols = lines.length > 3;
  const rows = twoCols ? Math.ceil(lines.length / 2) : lines.length;
  const h = 156 + rows * 66 + (stamp ? 118 : 26);
  const cursorOn = Math.floor(frame / 8) % 2 === 0;
  const colW = twoCols ? (w - 72) / 2 : w - 72;
  const colLines = (c: number) => (twoCols ? lines.filter((_, i) => (c === 0 ? i < rows : i >= rows)) : c === 0 ? lines : []);
  return (
    <g opacity={o}>
      <rect x={x} y={y} width={w} height={h} rx={22} fill="rgba(3,18,15,0.82)" stroke="rgba(124,255,178,0.55)" strokeWidth={2.5} />
      {[
        [x, y, 1, 1],
        [x + w, y, -1, 1],
        [x, y + h, 1, -1],
        [x + w, y + h, -1, -1],
      ].map(([cx, cy, sx, sy], i) => (
        <path key={i} d={`M ${cx + sx * 6} ${cy + sy * 40} L ${cx + sx * 6} ${cy + sy * 6} L ${cx + sx * 40} ${cy + sy * 6}`} stroke="#7CFFB2" strokeWidth={5} fill="none" />
      ))}
      <text x={x + 36} y={y + 50} fontFamily={MONO} fontSize={26} letterSpacing={4} fill="rgba(200,255,228,0.6)">
        VERSUCHSPROTOKOLL
      </text>
      <circle cx={x + w - 50} cy={y + 41} r={9} fill="#FF7AD9" opacity={cursorOn ? 1 : 0.35} />
      <text x={x + w - 70} y={y + 50} textAnchor="end" fontFamily={MONO} fontSize={26} letterSpacing={4} fill="rgba(200,255,228,0.6)">
        ALMA 32
      </text>
      <line x1={x + 30} y1={y + 70} x2={x + w - 30} y2={y + 70} stroke="rgba(124,255,178,0.25)" strokeWidth={2} />
      <text x={x + 36} y={y + 124} fontFamily={MONO} fontWeight={700} fontSize={48} letterSpacing={2} fill="#7CFFB2">
        {typed(title.toUpperCase(), titleK)}
        {titleK > 0 && titleK < 1 && cursorOn ? "▌" : ""}
      </text>
      {[0, 1].map((c) =>
        colLines(c).map((ln, r) => {
          const lx = x + 36 + c * (colW + 0);
          const ly = y + 196 + r * 66;
          const labelLen = Math.max(...colLines(c).map((l) => l.label.length));
          const tx = lx + Math.max(96, labelLen * 20.5 + 56);
          const avail = lx + colW - tx - 10;
          const longest = Math.max(...colLines(c).map((l) => l.text.length));
          const fs = Math.min(46, avail / (longest * 0.62));
          const isCheck = ln.text === "✓";
          return (
            <g key={`${c}-${r}`} opacity={ln.k > 0 ? 1 : 0.28}>
              <text x={lx} y={ly} fontFamily={MONO} fontSize={34} fill="rgba(200,255,228,0.66)">
                {ln.label}
              </text>
              <path d={`M ${tx - 40} ${ly - 11} L ${tx - 14} ${ly - 11} M ${tx - 22} ${ly - 19} L ${tx - 14} ${ly - 11} L ${tx - 22} ${ly - 3}`} stroke="rgba(124,255,178,0.7)" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              {isCheck ? (
                <Check x={tx} y={ly - 4} k={ln.k} />
              ) : (
                <text x={tx} y={ly} fontFamily={MONO} fontWeight={700} fontSize={fs} fill="#F2FFF8">
                  {ln.k > 0 ? typed(ln.text, ln.k) : "…"}
                  {ln.k > 0 && ln.k < 1 && cursorOn ? "▌" : ""}
                </text>
              )}
            </g>
          );
        }),
      )}
      {stamp ? <Stamp x={x + w / 2} y={y + h - 64} text={stamp.text.toUpperCase()} color="#7CFFB2" pop={stamp.pop} rot={-4} size={50} font={MONO} /> : null}
    </g>
  );
};

/* ------------------------------------------------------------------ */
/* Bildschirm mit der Vorgeschichte                                    */
/* ------------------------------------------------------------------ */

const PX = 70;
const PY = 300;
const PW = 940;
const PH = 850;
const GROUND = 1040;

const Panel: React.FC<{ id: string; header: string; o: number; k: number; children: React.ReactNode }> = ({ id, header, o, k, children }) => (
  <g opacity={o} transform={`translate(540 ${PY + PH / 2}) scale(${0.94 + 0.06 * k}) translate(-540 ${-(PY + PH / 2)})`}>
    <defs>
      <clipPath id={`sdPanel${id}`}>
        <rect x={PX} y={PY} width={PW} height={PH} rx={26} />
      </clipPath>
    </defs>
    <rect x={PX + 8} y={PY + 14} width={PW} height={PH} rx={26} fill="rgba(0,0,0,0.5)" />
    <g clipPath={`url(#sdPanel${id})`}>{children}</g>
    {/* Kopfzeile */}
    <rect x={PX} y={PY} width={PW} height={58} rx={0} fill="rgba(3,18,15,0.72)" clipPath={`url(#sdPanel${id})`} />
    <text x={PX + 30} y={PY + 40} fontFamily={MONO} fontWeight={700} fontSize={28} letterSpacing={3} fill="#7CFFB2">
      {header}
    </text>
    {/* Abtastzeilen */}
    <g clipPath={`url(#sdPanel${id})`} opacity={0.08}>
      {Array.from({ length: 40 }, (_, i) => (
        <rect key={i} x={PX} y={PY + i * 22} width={PW} height={3} fill="#000" />
      ))}
    </g>
    <rect x={PX} y={PY} width={PW} height={PH} rx={26} fill="none" stroke="rgba(124,255,178,0.6)" strokeWidth={3} />
  </g>
);

/** Ein Flicken auf dem groben Gewand – in den Koordinaten einer `Robed`-Figur. */
const Patches: React.FC<{ x: number; y: number; k: number; dir: 1 | -1 }> = ({ x, y, k, dir }) => (
  <g transform={`translate(${x} ${y}) scale(${dir * k} ${k})`}>
    <rect x={-30} y={-130} width={30} height={28} fill="#6E5A42" transform="rotate(-8 -15 -116)" />
    <rect x={8} y={-70} width={26} height={24} fill="#5E4C36" transform="rotate(10 21 -58)" />
    <path d="M -30 -130 l 30 -4 M -28 -104 l 30 -4" stroke="#C9B48A" strokeWidth={2} strokeDasharray="4 4" transform="rotate(-8 -15 -116)" />
  </g>
);

/** Ein Hinweisschild mit Linie zu einem Punkt – wie in einer wissenschaftlichen Abbildung. */
const Callout: React.FC<{ from: P; at: P; text: string; k: number; align?: "left" | "right" }> = ({ from, at, text, k, align = "left" }) => {
  if (k <= 0.01) return null;
  const w = text.length * 19 + 34;
  const bx = align === "left" ? at[0] : at[0] - w;
  const anchor: P = [align === "left" ? bx : bx + w, at[1]];
  const lk = Math.min(1, k * 1.5);
  const end: P = [from[0] + (anchor[0] - from[0]) * lk, from[1] + (anchor[1] - from[1]) * lk];
  return (
    <g>
      <circle cx={from[0]} cy={from[1]} r={9} fill="none" stroke="#7CFFB2" strokeWidth={3} opacity={k} />
      <circle cx={from[0]} cy={from[1]} r={3.5} fill="#7CFFB2" opacity={k} />
      <line x1={from[0]} y1={from[1]} x2={end[0]} y2={end[1]} stroke="#7CFFB2" strokeWidth={3} />
      <g opacity={interpolate(k, [0.5, 1], [0, 1], clamp)}>
        <rect x={bx} y={at[1] - 30} width={w} height={56} rx={8} fill="rgba(3,18,15,0.88)" stroke="#7CFFB2" strokeWidth={2} />
        <text x={bx + 17} y={at[1] + 9} fontFamily={MONO} fontWeight={700} fontSize={30} fill="#DFFFEF">
          {text}
        </text>
      </g>
    </g>
  );
};

/** Abendhimmel, Hügel und Boden auf dem Bildschirm */
const PanelLand: React.FC<{ dusk: number }> = ({ dusk }) => (
  <g>
    <rect x={PX} y={PY} width={PW} height={PH} fill="url(#sdPanelSky)" />
    <rect x={PX} y={PY} width={PW} height={PH} fill="#120A24" opacity={dusk * 0.45} />
    <circle cx={250} cy={860} r={70} fill="#FFD9A0" opacity={0.85 - dusk * 0.5} />
    <path d={`M ${PX} 900 C 220 850, 340 880, 460 860 S 760 820, 880 850 S 1000 870, ${PX + PW} 860 L ${PX + PW} ${PY + PH} L ${PX} ${PY + PH} Z`} fill="#5A3A52" opacity={0.85} />
    <path d={`M ${PX} 960 C 240 930, 420 950, 600 940 S 900 925, ${PX + PW} 945 L ${PX + PW} ${PY + PH} L ${PX} ${PY + PH} Z`} fill="#3A2440" />
    <rect x={PX} y={GROUND} width={PW} height={PY + PH - GROUND} fill="#24162C" />
    <rect x={PX} y={GROUND} width={PW} height={4} fill="#FFB070" opacity={0.25} />
  </g>
);

/** Die Synagoge mit dem Rameumptom davor (Alma 31:13, 21) */
const Synagogue: React.FC<{ door: number; bricks: number; frame: number }> = ({ door, bricks, frame }) => {
  const sx = 600;
  const sw = 340;
  const top = 760;
  const base = GROUND - 42;
  const brick = "#FFD48A";
  return (
    <g>
      {/* Rameumptom: der hohe Stand, oben Platz für einen */}
      <path d={`M 452 ${GROUND} L 470 520 L 520 520 L 538 ${GROUND} Z`} fill="#3A2232" />
      <path d={`M 470 520 L 470 ${GROUND}`} stroke="#FFB070" strokeWidth={3} opacity={0.35} />
      <rect x={446} y={500} width={98} height={22} fill="#4A2C3C" />
      <rect x={446} y={500} width={98} height={4} fill="#FFB070" opacity={0.4} />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={452 + i * 26} y={474} width={6} height={28} fill="#4A2C3C" />
      ))}
      <rect x={446} y={472} width={98} height={6} fill="#4A2C3C" />
      <Robed x={495} y={500} k={0.3} dir={1} fill="#1E1222" rim="#FFB070" pose={{ raise: 0.9 + 0.1 * Math.sin(frame / 20) }} shadow={false} />
      {/* Stufen */}
      {[0, 1, 2].map((i) => (
        <rect key={i} x={sx - 40 + i * 14} y={GROUND - 14 * (i + 1)} width={sw + 80 - i * 28} height={14} fill={i % 2 ? "#5E4058" : "#6A4A62"} />
      ))}
      {/* Mauer */}
      <rect x={sx} y={top} width={sw} height={base - top} fill="#6A4A62" />
      <g opacity={0.5 + 0.5 * bricks}>
        {Array.from({ length: 9 }, (_, r) =>
          Array.from({ length: 6 }, (_, c) => {
            const bw = sw / 5.5;
            const bx = sx + c * bw - (r % 2 ? bw / 2 : 0);
            const by = top + 30 + r * 23;
            if (bx < sx - 2 || bx + bw > sx + sw + 2) return null;
            return (
              <rect
                key={`${r}-${c}`}
                x={bx}
                y={by}
                width={bw - 4}
                height={19}
                fill="none"
                stroke={bricks > 0.01 ? brick : "#4A3044"}
                strokeWidth={bricks > 0.01 ? 2.5 : 2}
                opacity={bricks > 0.01 ? 0.35 + 0.5 * bricks * (0.7 + 0.3 * Math.sin(frame / 5 + r + c)) : 0.8}
              />
            );
          }),
        )}
      </g>
      {/* Säulen und Gesims */}
      {[sx + 10, sx + sw - 46].map((cx) => (
        <rect key={cx} x={cx} y={top + 20} width={36} height={base - top - 20} fill="#7A5872" />
      ))}
      <path d={`M ${sx - 26} ${top + 22} L ${sx + sw / 2} ${top - 70} L ${sx + sw + 26} ${top + 22} Z`} fill="#5A3A52" />
      <rect x={sx - 30} y={top + 14} width={sw + 60} height={16} fill="#7A5872" />
      <path d={`M ${sx - 26} ${top + 22} L ${sx + sw / 2} ${top - 70} L ${sx + sw + 26} ${top + 22}`} stroke="#FFB070" strokeWidth={3} fill="none" opacity={0.4} />
      {/* Tür: innen warmes Licht, zwei Flügel schliessen sich */}
      <rect x={sx + sw / 2 - 50} y={base - 140} width={100} height={140} fill="#FFC77A" opacity={0.75} />
      <rect x={sx + sw / 2 - 50} y={base - 140} width={50 * door} height={140} fill="#3A2232" />
      <rect x={sx + sw / 2 + 50 - 50 * door} y={base - 140} width={50 * door} height={140} fill="#33202E" />
      <path d={`M ${sx + sw / 2 - 50} ${base - 140} Q ${sx + sw / 2} ${base - 180} ${sx + sw / 2 + 50} ${base - 140}`} fill="#3A2232" />
    </g>
  );
};

/* ------------------------------------------------------------------ */
/* Sprechblase                                                         */
/* ------------------------------------------------------------------ */

const Bubble: React.FC<{ x: number; y: number; lines: string[]; k: number; tail: P; size?: number; highlight?: string }> = ({ x, y, lines, k, tail, size = 42, highlight }) => {
  if (k <= 0.01) return null;
  const w = Math.max(...lines.map((l) => l.length)) * size * 0.56 + 64;
  const h = lines.length * size * 1.22 + 44;
  return (
    <g transform={`translate(${x} ${y}) scale(${interpolate(k, [0, 1], [0.6, 1])})`} opacity={Math.min(1, k * 1.6)}>
      <path d={`M ${-w * 0.12} ${h / 2 - 6} L ${tail[0] - x} ${tail[1] - y} L ${w * 0.08} ${h / 2 - 6} Z`} fill="#FFF8EC" />
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={28} fill="#FFF8EC" />
      {lines.map((l, i) => (
        <text key={i} x={0} y={-h / 2 + 22 + size * 0.95 + i * size * 1.22} textAnchor="middle" fontFamily="Inter" fontWeight={800} fontSize={size} fill="#1A1420">
          {highlight && l.includes(highlight) ? (
            <>
              {l.split(highlight)[0]}
              <tspan fill="#0E8A4E">{highlight}</tspan>
              {l.split(highlight)[1]}
            </>
          ) : (
            l
          )}
        </text>
      ))}
    </g>
  );
};

/** Text auf zwei Zeilen brechen, ungefähr in der Mitte. */
const twoLines = (s: string): string[] => {
  const words = s.split(" ");
  if (words.length < 3) return [s];
  let best = 1;
  let diff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const d = Math.abs(words.slice(0, i).join(" ").length - words.slice(i).join(" ").length);
    if (d < diff) {
      diff = d;
      best = i;
    }
  }
  return [words.slice(0, best).join(" "), words.slice(best).join(" ")];
};

/* ------------------------------------------------------------------ */
/* Lichtschalter                                                       */
/* ------------------------------------------------------------------ */

const Switch: React.FC<{ x: number; y: number; on: number; strike: number; o: number }> = ({ x, y, on, strike, o }) =>
  o > 0.01 ? (
    <g transform={`translate(${x} ${y})`} opacity={o}>
      <rect x={-80} y={-120} width={160} height={240} rx={24} fill="#DDEFE6" stroke="#9FC2B2" strokeWidth={4} />
      <rect x={-40} y={-74} width={80} height={148} rx={14} fill="#B9D3C6" />
      <rect x={-34} y={interpolate(on, [0, 1], [-4, -68])} width={68} height={72} rx={12} fill="#F4FFF9" stroke="#8FB0A2" strokeWidth={3} />
      <text x={0} y={-90} textAnchor="middle" fontFamily={MONO} fontWeight={700} fontSize={22} fill="#4A6A5C">
        EIN
      </text>
      <text x={0} y={106} textAnchor="middle" fontFamily={MONO} fontWeight={700} fontSize={22} fill="#4A6A5C">
        AUS
      </text>
      {strike > 0.01 ? <line x1={-130} y1={150} x2={-130 + 260 * strike} y2={150 - 300 * strike} stroke="#FF7AD9" strokeWidth={14} strokeLinecap="round" /> : null}
    </g>
  ) : null;

/* ------------------------------------------------------------------ */
/* Szene                                                               */
/* ------------------------------------------------------------------ */

export const Scene: React.FC<{ ts: TimelineScene }> = ({ ts }) => {
  const s = ts.scene as SeedSceneT;
  const frame = useCurrentFrame();
  const look = useLook();
  const t = (frame - ts.audioOffsetFrames) / FPS;
  const b = beats(ts, s.cues, Math.max(3, s.cues.length));
  const f = (sec: number) => voiceFrame(ts, sec);
  const stage = s.stage;
  const end = ts.speechEndSec;
  const lineAt = (i: number) => {
    const ln = s.lines[i];
    return ln?.at ? beat(ts, ln.at, 1 + i * 1.2) : -1;
  };
  const lines: Line[] = s.lines.map((ln, i) => {
    const at = lineAt(i);
    return { label: ln.label, text: ln.text, k: ln.at ? interpolate(t, [at - 0.05, at + 0.25 + 0.03 * ln.text.length], [0, 1], clamp) : 1 };
  });
  const stampAt = s.stamp ? beat(ts, s.stamp.at, end - 0.6) : 99;
  const stampPop = usePop(ts, stampAt, { damping: 11, stiffness: 220 });
  const titleK = interpolate(t, [-0.35, 0.25], [0, 1], clamp);
  const slide = interpolate(t, [-0.4, 0.1], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });

  /* Gemeinsame Verläufe */
  const defs = (
    <defs>
      <radialGradient id="sdSeedGlow">
        <stop offset="0%" stopColor="#FFF2C4" stopOpacity="0.95" />
        <stop offset="45%" stopColor="#FFD27A" stopOpacity="0.35" />
        <stop offset="100%" stopColor="#FFD27A" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="sdPlantGlow">
        <stop offset="0%" stopColor="#C8FFE0" stopOpacity="0.55" />
        <stop offset="55%" stopColor="#7CFFB2" stopOpacity="0.15" />
        <stop offset="100%" stopColor="#7CFFB2" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="sdHeartGlow">
        <stop offset="0%" stopColor="#FFB3D1" stopOpacity="0.75" />
        <stop offset="60%" stopColor="#FF7AB0" stopOpacity="0.18" />
        <stop offset="100%" stopColor="#FF7AB0" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="sdFruitGlow">
        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
        <stop offset="40%" stopColor="#FFF6D8" stopOpacity="0.4" />
        <stop offset="100%" stopColor="#FFF6D8" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="sdSpot" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#FFE3F6" stopOpacity="0.32" />
        <stop offset="100%" stopColor="#FFE3F6" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="sdBeam" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#FFF6E0" stopOpacity="0.6" />
        <stop offset="70%" stopColor="#E0FFEE" stopOpacity="0.18" />
        <stop offset="100%" stopColor="#E0FFEE" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="sdPanelSky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#2C2350" />
        <stop offset="45%" stopColor="#8A4A6E" />
        <stop offset="80%" stopColor="#F09A5E" />
        <stop offset="100%" stopColor="#FFC98A" />
      </linearGradient>
    </defs>
  );

  let body: React.ReactNode = null;
  let sounds: React.ReactNode = null;
  let protocol: React.ReactNode = null;
  const proto = (o: number, stamp?: { text: string; pop: number }) => (
    <Protocol title={s.title ?? ""} titleK={titleK} lines={lines} o={o} slide={slide} stamp={stamp} frame={frame} />
  );

  if (stage === "hook") {
    /* Das Licht geht an, unter der Lupe liegt ein einziges Korn */
    const on = t < -0.1 ? 0 : t < 0.0 ? 0.7 : t < 0.08 ? 0.15 : fade(t, 0.08, 0.3);
    const lock = popAt(ts, frame, b[1] - 0.05);
    const glow = fade(t, b[1] - 0.05, 0.5) * (0.85 + 0.15 * Math.sin(frame / 5));
    const cx = 540;
    const cy = 790;
    const bw = 230 + 30 * (1 - lock);
    const bh = 170 + 30 * (1 - lock);
    body = (
      <g>
        <ellipse cx={cx} cy={cy + 40} rx={420} ry={360} fill="url(#sdSpot)" opacity={on} />
        {/* Petrischale */}
        <ellipse cx={cx} cy={cy + 130} rx={330} ry={70} fill="rgba(160,255,220,0.07)" stroke="rgba(210,255,236,0.55)" strokeWidth={4} />
        <ellipse cx={cx} cy={cy + 118} rx={300} ry={56} fill="none" stroke="rgba(210,255,236,0.25)" strokeWidth={3} />
        <path d={`M ${cx - 260} ${cy + 110} Q ${cx - 200} ${cy + 86} ${cx - 120} ${cy + 82}`} stroke="rgba(240,255,248,0.5)" strokeWidth={6} fill="none" strokeLinecap="round" />
        <ellipse cx={cx} cy={cy + 118} rx={160} ry={22} fill="#000" opacity={0.35} />
        <Seed x={cx} y={cy + 30 + Math.sin(frame / 22) * 4} s={7.2} glow={glow} rot={-12} frame={frame} />
        {/* Zielrahmen */}
        <g opacity={on * (0.35 + 0.65 * lock)} stroke="#7CFFB2" strokeWidth={6} fill="none">
          {[
            [-1, -1],
            [1, -1],
            [-1, 1],
            [1, 1],
          ].map(([sx, sy], i) => (
            <path key={i} d={`M ${cx + sx * bw} ${cy + 30 + sy * (bh - 50)} L ${cx + sx * bw} ${cy + 30 + sy * bh} L ${cx + sx * (bw - 50)} ${cy + 30 + sy * bh}`} />
          ))}
          <line x1={cx - bw - 30} y1={cy + 30} x2={cx - bw + 14} y2={cy + 30} strokeWidth={3} />
          <line x1={cx + bw - 14} y1={cy + 30} x2={cx + bw + 30} y2={cy + 30} strokeWidth={3} />
        </g>
        <text x={cx - bw} y={cy + 30 - bh - 22} fontFamily={MONO} fontWeight={700} fontSize={32} fill="#7CFFB2" opacity={on}>
          PROBE 01
        </text>
        <text x={cx + bw} y={cy + 30 + bh + 50} textAnchor="end" fontFamily={MONO} fontWeight={700} fontSize={30} fill="#FF7AD9" opacity={on * fade(t, b[1] + 0.3, 0.4)}>
          STATUS: UNGETESTET
        </text>
        <rect x={0} y={0} width={1080} height={1920} fill="#000" opacity={0.86 * (1 - on)} />
      </g>
    );
    protocol = proto(on);
    sounds = <Sfx frame={f(b[1])} name="warm" volume={0.45} keep />;
  } else if (stage === "outcast" || stage === "ask") {
    const pk = interpolate(t, [-0.4, 0.3], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
    if (stage === "outcast") {
      /* Abb. 1: Die Armen werden hinausgeworfen, die Tür fällt zu */
      const outAt = b[1];
      const out = interpolate(t, [outAt - 0.2, outAt + 1.4], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });
      const slamAt = Math.min(b[2] - 0.5, outAt + 1.5);
      const door = interpolate(t, [slamAt - 0.25, slamAt], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
      const bricks = fade(t, b[2] - 0.1, 0.5);
      const poor = [
        { from: [720, 998], to: [180, GROUND], k: 0.54 },
        { from: [760, 998], to: [260, GROUND], k: 0.5 },
        { from: [790, 998], to: [345, GROUND], k: 0.56 },
        { from: [740, 998], to: [410, GROUND], k: 0.46 },
      ];
      body = (
        <Panel id="o" header="ABB. 1 · LAND DER ZORAMITEN" o={pk} k={pk}>
          <PanelLand dusk={0} />
          <Synagogue door={door} bricks={bricks} frame={frame} />
          {/* Die Vornehmen an der Tür */}
          <Robed x={640} y={GROUND - 42} k={0.56} dir={-1} fill="#2A1632" rim="#FFC890" pose={{ reach: fade(t, outAt - 0.3, 0.4) }} />
          <Robed x={905} y={GROUND - 42} k={0.58} dir={-1} fill="#2A1632" rim="#FFC890" pose={{ hold: 0.8 }} />
          {/* Die Armen */}
          {poor.map((pp, i) => {
            const q = interpolate(out, [i * 0.08, 0.7 + i * 0.08], [0, 1], { ...clamp, easing: Easing.out(Easing.quad) });
            const x = pp.from[0] + (pp.to[0] - pp.from[0]) * q;
            const y = pp.from[1] + (pp.to[1] - pp.from[1]) * q;
            const moving = q > 0.02 && q < 0.98;
            const vis = Math.min(1, interpolate(t, [-0.4, 0.2], [0.4, 1], clamp) + q);
            return (
              <g key={i} opacity={vis}>
                <Robed x={x} y={y} k={pp.k} dir={-1} fill="#20140F" rim="#FFB070" pose={{ step: moving ? frame * 0.35 + i : undefined, bow: 0.5 }} />
                <Patches x={x} y={y} k={pp.k} dir={-1} />
              </g>
            );
          })}
          <Callout from={[700, 860]} at={[690, 640]} text="selbst gebaut" k={fade(t, b[2] - 0.05, 0.6)} align="left" />
          <Callout from={[348, GROUND - 0.56 * 110]} at={[180, 700]} text="grobe Kleidung" k={fade(t, b[3] - 0.05, 0.6)} align="left" />
        </Panel>
      );
      sounds = <Sfx frame={f(slamAt)} name="thud" volume={0.5} keep />;
    } else {
      /* Abb. 2: Auf dem Hügel Onidah – die Frage und Almas Antwort */
      const qAt = s.say[0] ? beat(ts, s.say[0].at, 1.2) : 1.2;
      const aAt = s.say[1] ? beat(ts, s.say[1].at, 4.4) : 4.4;
      const qk = popAt(ts, frame, qAt - 0.1);
      const ak = popAt(ts, frame, aAt - 0.1);
      const crowd = [
        { x: 170, k: 0.5 },
        { x: 230, k: 0.56 },
        { x: 290, k: 0.48 },
        { x: 340, k: 0.54 },
        { x: 405, k: 0.5 },
        { x: 470, k: 0.58 },
      ];
      body = (
        <Panel id="a" header="ABB. 2 · HÜGEL ONIDAH" o={pk} k={pk}>
          <PanelLand dusk={0.45} />
          {/* Hügel */}
          <path d={`M 540 ${GROUND} C 640 ${GROUND - 40}, 700 790, 820 770 C 880 760, 960 770, ${PX + PW} 780 L ${PX + PW} ${PY + PH} L 540 ${PY + PH} Z`} fill="#2E1C36" />
          <path d={`M 700 800 C 760 776, 820 770, 860 768`} stroke="#FFB070" strokeWidth={3} fill="none" opacity={0.4} />
          <Robed x={850} y={772} k={0.62} dir={-1} fill="#1C1024" rim="#FFD27A" pose={{ reach: 0.35 + 0.65 * fade(t, aAt - 0.3, 0.6) }} />
          {crowd.map((c, i) => (
            <g key={i}>
              <Robed x={c.x} y={GROUND} k={c.k} dir={1} fill="#20140F" rim="#FFB070" pose={i === crowd.length - 1 ? { reach: 0.7 * fade(t, qAt - 0.3, 0.5) } : { bow: 0.2 }} />
              <Patches x={c.x} y={GROUND} k={c.k} dir={1} />
            </g>
          ))}
          <Bubble x={330} y={640} lines={twoLines(s.say[0]?.text ?? "")} k={qk} tail={[440, 830]} size={44} />
          <Bubble x={650} y={470} lines={twoLines(s.say[1]?.text ?? "")} k={ak} tail={[810, 560]} size={44} highlight="Versuch" />
        </Panel>
      );
    }
  } else if (stage === "material") {
    /* Korn, Boden, Herz – und das Korn fällt in die Erde */
    const seedOn = fade(t, b[0] - 0.2, 0.4);
    const wordAt = lineAt(0);
    const soilAt = beat(ts, "Der Boden", 2.7);
    const heartAt = lineAt(1);
    const wishAt = lineAt(2);
    const drop = interpolate(t, [wishAt + 0.6, wishAt + 1.4], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
    const soilGlow = fade(t, soilAt - 0.1, 0.4) * (1 - fade(t, heartAt + 0.2, 0.6));
    body = (
      <g>
        <ellipse cx={540} cy={900} rx={420} ry={380} fill="url(#sdSpot)" />
        <Pot
          id="m"
          x={540}
          k={MAIN_K}
          seedO={seedOn}
          seedS={2}
          seedIn={drop}
          seedHover={(1 - drop) * Math.sin(frame / 12) * 8}
          seedGlow={fade(t, wordAt - 0.1, 0.5) * (0.7 + 0.3 * drop)}
          heart={fade(t, heartAt - 0.1, 0.6)}
          glow={soilGlow * 0.6}
          frame={frame}
          o={1}
        />
        <Ruler x={RULER_X} top={660} mark={null} o={fade(t, -0.2, 0.5)} />
      </g>
    );
    protocol = proto(1);
  } else if (stage === "swell" || stage === "know") {
    /* Es quillt, keimt, wächst – Seele und Verstand */
    let swell = 1;
    let split = 1;
    let g = 0.62;
    let roots = 1;
    let rings = 0;
    let bright = 0;
    let ringsAt = 0;
    if (stage === "swell") {
      const a1 = lineAt(0);
      const a2 = lineAt(1);
      const a3 = lineAt(2);
      const a4 = lineAt(3);
      const a5 = lineAt(4);
      swell = ramp(t, a1 - 0.1, a1 + 0.8);
      split = ramp(t, a2 - 0.1, a2 + 0.35);
      g = interpolate(t, [a2, a3, a4 + 0.6], [0, 0.24, 0.62], { ...clamp, easing: ease });
      roots = interpolate(t, [a2 - 0.1, a3 + 0.2, a4 + 0.8], [0, 0.55, 1], { ...clamp, easing: ease });
      ringsAt = a4;
      rings = fade(t, a4 - 0.1, 0.3);
      bright = fade(t, a5 - 0.1, 0.6);
    } else {
      bright = 1;
    }
    const plantTop = BENCH - (SOIL + g * 300 * (1 - 0)) * MAIN_K;
    body = (
      <g>
        <ellipse cx={540} cy={900} rx={420} ry={380} fill="url(#sdSpot)" />
        {bright > 0 ? <path d={`M 400 230 L 680 230 L 820 ${BENCH} L 260 ${BENCH} Z`} fill="url(#sdBeam)" opacity={bright * (0.75 + 0.1 * Math.sin(frame / 10))} /> : null}
        {rings > 0
          ? [0, 1, 2].map((i) => {
              const life = ((t - ringsAt + i * 0.6) % 1.8) / 1.8;
              if (t < ringsAt + i * 0.0 || life < 0) return null;
              return <circle key={i} cx={540} cy={plantTop + 80} r={60 + life * 360} fill="none" stroke="#7CFFB2" strokeWidth={5 * (1 - life)} opacity={rings * (1 - life) * 0.8} />;
            })
          : null}
        <Pot id="s" x={540} k={MAIN_K} swell={swell} split={split} g={g} roots={roots} seedGlow={stage === "know" ? fade(t, stampAt - 0.1, 0.5) : 0.25 * swell} glow={0.35 * bright + 0.25 * rings} frame={frame} />
        <Ruler x={RULER_X} top={660} mark={g > 0.02 ? plantTop : null} o={1} />
      </g>
    );
    protocol = proto(1, s.stamp ? { text: s.stamp.text, pop: stampPop } : undefined);
    if (stage === "know") sounds = <Sfx frame={f(stampAt)} name="thud" volume={0.5} keep />;
  } else if (stage === "neglect") {
    /* Gegenprobe: B ohne Pflege – keine Wurzeln, Hitze, verdorrt. Das Korn war gut. */
    const careAt = lineAt(0);
    const rootAt = lineAt(1);
    const dryAt = lineAt(2);
    const goodAt = lineAt(3);
    const hot = fade(t, dryAt - 0.4, 0.6);
    const dry = ramp(t, dryAt, dryAt + 1.4);
    const ab = interpolate(t, [-0.4, 0.4], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
    const xa = 540 - 245 * ab;
    const xb = 540 + 245 * ab;
    body = (
      <g>
        <ellipse cx={xa} cy={920} rx={300} ry={320} fill="url(#sdSpot)" />
        {/* Heisses Licht über B */}
        {hot > 0 ? (
          <g opacity={hot}>
            <path d={`M ${xb - 90} 600 L ${xb + 90} 600 L ${xb + 210} ${BENCH} L ${xb - 210} ${BENCH} Z`} fill="#FF9A4A" opacity={0.16 + 0.04 * Math.sin(frame / 4)} />
            <circle cx={xb} cy={640} r={46} fill="#FFB25A" />
            <circle cx={xb} cy={640} r={80} fill="#FF9A4A" opacity={0.3} />
            {Array.from({ length: 10 }, (_, i) => {
              const a = (i / 10) * Math.PI * 2 + frame / 40;
              return <line key={i} x1={xb + Math.cos(a) * 60} y1={640 + Math.sin(a) * 60} x2={xb + Math.cos(a) * 86} y2={640 + Math.sin(a) * 86} stroke="#FFB25A" strokeWidth={6} strokeLinecap="round" />;
            })}
          </g>
        ) : null}
        <Pot id="na" x={xa} k={0.82} swell={1} split={1} g={0.62} roots={1} label="A · GEPFLEGT" labelO={fade(t, careAt - 0.3, 0.4)} frame={frame} glow={0.25} />
        <Pot
          id="nb"
          x={xb}
          k={0.82}
          swell={1}
          split={1}
          g={0.42}
          roots={0}
          dry={dry}
          hot={hot * (1 - 0.4 * dry)}
          noRoots={fade(t, rootAt - 0.1, 0.4)}
          seedGlow={fade(t, goodAt - 0.1, 0.5) * 1.2}
          label="B · OHNE PFLEGE"
          labelO={fade(t, careAt - 0.1, 0.4)}
          frame={frame}
          phase={2}
        />
      </g>
    );
    protocol = proto(1);
  } else if (stage === "tree") {
    /* Sorgfalt (Wasser), Eifer (Licht), Geduld (Zeitraffer) – dann der Baum mit Frucht */
    const careAt = lineAt(0);
    const zealAt = lineAt(1);
    const patienceAt = lineAt(2);
    const treeAt = b[0];
    const lifeAt = b[1];
    const g = interpolate(t, [patienceAt, treeAt], [0.62, 1], { ...clamp, easing: ease });
    const treeK = interpolate(t, [treeAt - 0.2, lifeAt + 0.3], [0, 1], { ...clamp, easing: Easing.out(Easing.quad) });
    const fruit = interpolate(t, [lifeAt - 0.1, lifeAt + 1.2], [0, 1], clamp);
    const lapse = fade(t, patienceAt - 0.1, 0.3) * (1 - fade(t, lifeAt + 0.6, 0.5));
    const pulse = lapse * (0.5 + 0.5 * Math.sin(frame / 3.2));
    const bright = fade(t, zealAt - 0.1, 0.5);
    const potO = 1 - 0.75 * fade(t, treeAt + 0.2, 0.8);
    const sproutO = 1 - fade(t, treeAt, 0.5);
    const drops = Array.from({ length: 6 }, (_, i) => {
      const at = careAt + i * 0.12;
      const q = interpolate(t, [at, at + 0.55], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
      return { x: 482 + (i % 3) * 14, y: 812 + q * 66, o: q > 0 && q < 1 ? 1 : 0 };
    });
    body = (
      <g>
        <ellipse cx={540} cy={820} rx={500} ry={560} fill="url(#sdSpot)" opacity={1 + 0.4 * fruit} />
        <rect x={0} y={0} width={1080} height={1920} fill="#FFE8F6" opacity={0.06 * pulse} />
        {bright > 0 ? <path d={`M 400 230 L 680 230 L 860 ${BENCH} L 220 ${BENCH} Z`} fill="url(#sdBeam)" opacity={bright * (0.6 + 0.4 * fruit)} /> : null}
        {fruit > 0 ? <path d={`M 440 0 L 640 0 L 700 600 L 380 600 Z`} fill="url(#sdBeam)" opacity={fruit * 0.7} /> : null}
        {/* Pipette */}
        <g opacity={fade(t, careAt - 0.4, 0.3) * (1 - fade(t, careAt + 1.0, 0.3))}>
          <g transform="rotate(-28 450 760)">
            <rect x={426} y={650} width={48} height={100} rx={20} fill="#FF7AD9" opacity={0.85} />
            <path d="M 434 750 L 466 750 L 454 812 L 446 812 Z" fill="rgba(220,255,240,0.75)" />
          </g>
        </g>
        {drops.map((d, i) => (d.o ? <path key={i} d={`M ${d.x} ${d.y - 12} C ${d.x + 9} ${d.y}, ${d.x + 7} ${d.y + 10}, ${d.x} ${d.y + 10} C ${d.x - 7} ${d.y + 10}, ${d.x - 9} ${d.y}, ${d.x} ${d.y - 12} Z`} fill="#9FE8FF" /> : null))}
        <Pot id="t" x={540} k={MAIN_K} swell={1} split={1} g={g * sproutO} roots={1} o={potO} glow={0.3 * bright} frame={frame} />
        <Tree x={540} y0={BENCH - SOIL * MAIN_K} k={treeK} fruit={fruit} frame={frame} />
        {lapse > 0.01 ? (
          <g opacity={lapse}>
            <rect x={680} y={BENCH - 120} width={330} height={64} rx={10} fill="rgba(3,18,15,0.8)" stroke="#FF7AD9" strokeWidth={2} />
            <text x={700} y={BENCH - 76} fontFamily={MONO} fontWeight={700} fontSize={30} fill="#FF7AD9">
              ▶▶ ZEITRAFFER
            </text>
          </g>
        ) : null}
      </g>
    );
    protocol = proto(1 - fade(t, treeAt - 0.1, 0.6));
    sounds = <Sfx frame={f(lifeAt)} name="warm" volume={0.45} keep />;
  } else if (stage === "you") {
    /* Kein Schalter – Pflänzchen in allen Grössen, und die Frage */
    const sAt = b[0];
    const growAt = b[1];
    const qAt = b[2];
    const on = ramp(t, sAt + 0.3, sAt + 0.55);
    const strike = ramp(t, sAt + 0.9, sAt + 1.3);
    const firstO = fade(t, sAt - 0.3, 0.4) * (1 - fade(t, qAt - 0.3, 0.4));
    const qO = fade(t, qAt - 0.15, 0.4);
    const pots = [
      { x: 150, g: 0 },
      { x: 345, g: 0.2 },
      { x: 540, g: 0.42 },
      { x: 735, g: 0.7 },
      { x: 930, g: 1 },
    ];
    const sweep = qO > 0 ? 540 + Math.sin((t - qAt) * 1.6) * 390 : -999;
    const headline = (text: string[], y: number, o: number, size: number) =>
      o > 0.01 ? (
        <g opacity={o}>
          {text.map((l, i) => (
            <text key={i} x={540} y={y + i * size * 1.06} textAnchor="middle" fontFamily="Anton" fontSize={size} fill={i === text.length - 1 ? look.accent : look.text} style={{ textTransform: "uppercase" }} stroke="#03100D" strokeWidth={8} paintOrder="stroke">
              {l.toUpperCase()}
            </text>
          ))}
        </g>
      ) : null;
    body = (
      <g>
        {headline(["Glaube ist", "kein Schalter."], 400, firstO, 120)}
        <Switch x={540} y={720} on={on} strike={strike} o={firstO} />
        {headline(["Wo steht dein", "Pflänzchen", "gerade?"], 410, qO, 128)}
        {qO > 0 ? <ellipse cx={sweep} cy={BENCH - 120} rx={150} ry={210} fill="url(#sdPlantGlow)" opacity={qO} /> : null}
        {pots.map((pp, i) => {
          const k = ramp(t, growAt - 0.1 + i * 0.16, growAt + 0.5 + i * 0.16);
          const o = fade(t, growAt - 0.3 + i * 0.12, 0.3);
          return (
            <g key={i} opacity={o}>
              {i < 4 ? (
                <Pot id={`y${i}`} x={pp.x} k={0.55} swell={pp.g > 0 ? 1 : 0.4} split={pp.g > 0 ? 1 : 0} g={pp.g * k} roots={pp.g > 0 ? Math.min(1, pp.g * 1.6) * k : 0} seedS={2.2} frame={frame} phase={i} />
              ) : (
                <g>
                  <Pot id={`y${i}`} x={pp.x} k={0.55} swell={1} split={1} g={0} roots={k} frame={frame} />
                  <Tree x={pp.x} y0={BENCH - SOIL * 0.5} k={k} fruit={k} frame={frame} scale={0.36} />
                </g>
              )}
            </g>
          );
        })}
      </g>
    );
    sounds = null;
  }

  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        {defs}
        {body}
        {protocol}
      </svg>
      {sounds}
    </AbsoluteFill>
  );
};

/** Ein weicher Auftritt ab `at` (Sekunden ab Stimme) – ohne Hook, damit er auch in Zweigen geht. */
const popAt = (ts: TimelineScene, frame: number, at: number) =>
  spring({ frame: frame - ts.audioOffsetFrames - Math.round(at * FPS), fps: FPS, config: { damping: 13, stiffness: 190 } });

/** Was gross im Bild steht, wird nicht noch einmal untertitelt. */
export const hidden = (ts: TimelineScene): Set<number> => {
  const s = ts.scene as SeedSceneT;
  if (s.stage === "ask") return wordsOfTexts(ts, s.say.map((x) => x.text));
  if (s.stage === "material") return wordsOfTexts(ts, s.lines.map((l) => l.text));
  if (s.stage === "know") return wordsOfTexts(ts, [s.stamp?.text]);
  if (s.stage === "you") return wordsOfTexts(ts, ["Glaube ist kein Schalter", "Wo steht dein Pflänzchen gerade"]);
  return new Set();
};
