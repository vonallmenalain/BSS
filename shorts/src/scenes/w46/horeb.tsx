import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, random, useCurrentFrame } from "remotion";
import { useLook } from "../../looks";
import { Sfx, beat, beats, voiceFrame } from "../../lib/sfx";
import { type TimelineScene, findCue } from "../../lib/timing";
import type { Scene as SceneData } from "../../schema";
import { Motes, Robed, type RobePose, clamp, useT, wordsOfTexts } from "../w45/kitA";

/*
 * Nicht im Sturm (1 Könige 19:2–13) – und heute im Hallenbad.
 *
 * Elija am Ende seiner Kraft unter dem Ginsterstrauch, der Engel mit Brot und Wasser, vierzig
 * Tage bis zum Gottesberg. Am Horeb steht er im Eingang einer Höhle, klein gegen den Fels, und
 * draussen tobt es: Ein Sturm zerbricht die Felsen, die Erde bebt, Feuer läuft über den Hang –
 * und jedes Mal steht gross im Bild, dass der Herr nicht darin war. Dann wird es still: Die Glut
 * verglimmt, ein leiser Lichthauch zieht vorbei, und Elija verhüllt sein Gesicht mit dem Mantel.
 *
 * Danach dasselbe im Heute, ohne Drama: James auf dem Hochsitz im Hallenbad, ein leiser Gedanke
 * als kleiner Lichtpunkt, die Frau am Beckenrand. Er zögert, meldet es – und am Ende geht es ihr
 * gut. Die Effekte bleiben massvoll: Blitze als sanftes Aufhellen, das Beben klingt rasch ab.
 */

type HorebT = Extract<SceneData, { type: "horeb" }>;
type Line = HorebT["lines"][number];

/** Oberkante des Felsvorsprungs vor der Höhle */
const LEDGE = 1180;
/** Boden der Wüste */
const SAND = 1168;
/** Höhleneingang: Mitte und Breite */
const CAVE_X = 268;
/** Elija im Höhleneingang */
const ELIJA_X = 276;

const ROBE = "#1B1511";
const MOON_RIM = "#8FA6DA";
const FIRE_RIM = "#FF9A4A";

const ease = Easing.inOut(Easing.cubic);
const fade = (t: number, at: number, d = 0.4) => interpolate(t, [at, at + d], [0, 1], clamp);
/** Ein Auftritt ab `at` mit leichtem Überschwingen – 0 … 1 */
const popAt = (t: number, at: number, d = 0.35) => Easing.out(Easing.back(1.6))(Math.max(0, Math.min(1, (t - at + 0.05) / d)));

const hex = (s: string) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
const mix = (a: string, b: string, k: number) => {
  const pa = hex(a);
  const pb = hex(b);
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * Math.max(0, Math.min(1, k)))).join(",")})`;
};
const wrap = (x: number, span: number) => ((x % span) + span) % span;

/* ------------------------------------------------------------------ */
/* Wetter                                                              */
/* ------------------------------------------------------------------ */

/** Regen, vom Wind schräg nach links getrieben. */
const Rain: React.FC<{ k: number; slant?: number; n?: number }> = ({ k, slant = 0.42, n = 170 }) => {
  const frame = useCurrentFrame();
  const drops = useMemo(
    () =>
      Array.from({ length: n }, (_, i) => ({
        x: random(`hrx${i}`) * 1900,
        y: random(`hry${i}`) * 2100,
        v: 40 + random(`hrv${i}`) * 26,
        l: 44 + random(`hrl${i}`) * 56,
        o: 0.2 + random(`hro${i}`) * 0.4,
      })),
    [n],
  );
  if (k <= 0.01) return null;
  return (
    <g opacity={k}>
      {drops.map((d, i) => {
        const y = wrap(d.y + frame * d.v, 2100) - 100;
        const x = d.x - y * slant;
        return <line key={i} x1={x} y1={y} x2={x - d.l * slant} y2={y + d.l} stroke="#C9D8FF" strokeWidth={2.2} opacity={d.o} strokeLinecap="round" />;
      })}
    </g>
  );
};

/** Dunkle Wolken, die schnell über den Himmel jagen, und ein Abdunkeln des ganzen Bildes. */
const StormClouds: React.FC<{ k: number; speed?: number }> = ({ k, speed = 1 }) => {
  const frame = useCurrentFrame();
  const puffs = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        x: random(`hcx${i}`) * 1800,
        y: 230 + random(`hcy${i}`) * 520,
        rx: 200 + random(`hcr${i}`) * 220,
        ry: 80 + random(`hcq${i}`) * 70,
        v: 9 + random(`hcv${i}`) * 9,
      })),
    [],
  );
  if (k <= 0.01) return null;
  return (
    <g>
      <defs>
        <radialGradient id="hbStormPuff">
          <stop offset="0%" stopColor="#05070F" stopOpacity="0.92" />
          <stop offset="60%" stopColor="#141A2E" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#141A2E" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={1080} height={1920} fill="#02030A" opacity={0.38 * k} />
      {puffs.map((c, i) => (
        <ellipse key={i} cx={wrap(c.x - frame * c.v * speed, 1800) - 360} cy={c.y + Math.sin(frame / 25 + i) * 8} rx={c.rx} ry={c.ry} fill="url(#hbStormPuff)" opacity={k} />
      ))}
    </g>
  );
};

/** Wie hell ein Blitz zum Zeitpunkt t ist: kurzer Schein mit einem leisen Nachflackern. */
const flashAt = (t: number, at: number) => {
  const d = t - at;
  if (d < 0 || d > 0.9) return 0;
  return Math.min(1, Math.exp(-d * 7) + (d > 0.16 ? 0.45 * Math.exp(-(d - 0.16) * 9) : 0));
};

/** Ein Blitz über dem Gottesberg – sanftes Aufhellen, kein grelles Flackern. */
const Lightning: React.FC<{ f: number; x?: number }> = ({ f, x = 840 }) => {
  if (f <= 0.01) return null;
  const d = `M ${x - 40} 420 L ${x + 10} 520 L ${x - 22} 540 L ${x + 30} 650 L ${x} 664 L ${x + 44} 770`;
  return (
    <g>
      <rect width={1080} height={1920} fill="#DCE6FF" opacity={0.14 * f} />
      <path d={d} fill="none" stroke="#9FC2FF" strokeWidth={18} opacity={0.25 * f} strokeLinejoin="round" />
      <path d={d} fill="none" stroke="#F4F8FF" strokeWidth={5} opacity={f} strokeLinejoin="round" />
    </g>
  );
};

/** Kleine Steine, die der Sturm über den Hang treibt. */
const Debris: React.FC<{ k: number }> = ({ k }) => {
  const frame = useCurrentFrame();
  const bits = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => ({
        x: random(`hdx${i}`) * 1400,
        y: 520 + random(`hdy${i}`) * 560,
        r: 6 + random(`hdr${i}`) * 12,
        v: 22 + random(`hdv${i}`) * 20,
        spin: (random(`hds${i}`) - 0.5) * 30,
      })),
    [],
  );
  if (k <= 0.01) return null;
  return (
    <g opacity={k}>
      {bits.map((b, i) => {
        const x = wrap(b.x - frame * b.v, 1400) - 160;
        const y = b.y + Math.sin(frame / 6 + i) * 14 + ((frame * 2) % 60) * 0.3;
        return (
          <path
            key={i}
            d={`M ${-b.r} 0 L ${-b.r * 0.2} ${-b.r} L ${b.r} ${-b.r * 0.3} L ${b.r * 0.6} ${b.r * 0.8} Z`}
            transform={`translate(${x} ${y}) rotate(${frame * b.spin})`}
            fill="#2E3446"
            stroke="#6F7FA8"
            strokeWidth={1.5}
          />
        );
      })}
    </g>
  );
};

/** Eine Flamme mit Fuss bei (x, y). */
const Flame: React.FC<{ x: number; y: number; h: number; w: number; ph: number; frame: number }> = ({ x, y, h, w, ph, frame }) => {
  const fl = 1 + 0.16 * Math.sin(frame / 2.3 + ph) + 0.08 * Math.sin(frame / 3.7 + ph * 2);
  const sway = Math.sin(frame / 5 + ph) * w * 0.35;
  const hh = h * fl;
  const outer = `M ${x - w} ${y} C ${x - w} ${y - hh * 0.4}, ${x - w * 0.3 + sway * 0.5} ${y - hh * 0.62}, ${x + sway} ${y - hh} C ${x + w * 0.3 + sway * 0.5} ${y - hh * 0.62}, ${x + w} ${y - hh * 0.4}, ${x + w} ${y} Z`;
  const ih = hh * 0.58;
  const iw = w * 0.55;
  const inner = `M ${x - iw} ${y} C ${x - iw} ${y - ih * 0.4}, ${x + sway * 0.3} ${y - ih * 0.7}, ${x + sway * 0.6} ${y - ih} C ${x + sway * 0.3 + iw * 0.3} ${y - ih * 0.6}, ${x + iw} ${y - ih * 0.4}, ${x + iw} ${y} Z`;
  return (
    <g>
      <path d={outer} fill="url(#hbFlameOut)" />
      <path d={inner} fill="url(#hbFlameIn)" />
    </g>
  );
};

/** Feuer, das über den Hang und den Felsvorsprung läuft; `k` 0 … 1. */
const Fire: React.FC<{ k: number }> = ({ k }) => {
  const frame = useCurrentFrame();
  const flames = useMemo(() => {
    const out: Array<{ x: number; y: number; h: number; w: number; ph: number; d: number }> = [];
    // Am fernen Hang des Gottesbergs
    for (let i = 0; i < 9; i++) {
      const f = i / 8;
      out.push({ x: 600 + f * 440 + random(`hfx${i}`) * 20, y: 1060 - Math.sin(f * Math.PI) * 120 + random(`hfy${i}`) * 20, h: 70 + random(`hfh${i}`) * 50, w: 22 + random(`hfw${i}`) * 10, ph: random(`hfp${i}`) * 6, d: 0.15 + f * 0.25 });
    }
    // Vorn auf dem Felsvorsprung, rechts der Höhle
    for (let i = 0; i < 9; i++) {
      out.push({ x: 560 + i * 62 + random(`hgx${i}`) * 18, y: LEDGE + 6, h: 120 + random(`hgh${i}`) * 110, w: 32 + random(`hgw${i}`) * 14, ph: random(`hgp${i}`) * 6, d: i * 0.05 });
    }
    return out;
  }, []);
  if (k <= 0.01) return null;
  return (
    <g>
      <defs>
        <linearGradient id="hbFlameOut" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#FF6A1E" stopOpacity="0.95" />
          <stop offset="60%" stopColor="#FF9A3A" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#FFC56A" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="hbFlameIn" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#FFE9A8" />
          <stop offset="100%" stopColor="#FFD36E" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="hbFireGlow">
          <stop offset="0%" stopColor="#FF8A3A" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#FF8A3A" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={1080} height={1920} fill="#FF5A10" opacity={0.08 * k} />
      <ellipse cx={820} cy={1080} rx={520} ry={300} fill="url(#hbFireGlow)" opacity={k * (0.85 + 0.15 * Math.sin(frame / 4))} />
      {flames.map((f, i) => {
        const kk = Math.max(0, Math.min(1, (k - f.d * 0.5) * 1.6));
        if (kk <= 0.01) return null;
        return <Flame key={i} x={f.x} y={f.y} h={f.h * kk} w={f.w * (0.6 + 0.4 * kk)} ph={f.ph} frame={frame} />;
      })}
      <Motes n={36} x={520} y={680} w={560} h={500} color="#FFB060" seed="hbEmber" o={k} speed={2.2} />
    </g>
  );
};

/** Rauch, der nach dem Feuer aufsteigt. */
const Smoke: React.FC<{ k: number }> = ({ k }) => {
  const frame = useCurrentFrame();
  if (k <= 0.01) return null;
  return (
    <g opacity={k}>
      {Array.from({ length: 10 }, (_, i) => {
        const p = wrap(frame / 140 + random(`hsp${i}`), 1);
        const x = 600 + random(`hsx${i}`) * 440 + Math.sin(frame / 40 + i) * 30;
        const y = 1160 - p * 520;
        return <ellipse key={i} cx={x} cy={y} rx={60 + p * 90} ry={40 + p * 50} fill="#5A5F72" opacity={0.16 * Math.sin(p * Math.PI)} />;
      })}
    </g>
  );
};

/** Das leise Säuseln: feine Lichtfäden, die langsam vorbeiziehen. */
const Breath: React.FC<{ k: number }> = ({ k }) => {
  const frame = useCurrentFrame();
  if (k <= 0.01) return null;
  return (
    <g opacity={k}>
      <defs>
        <linearGradient id="hbBreath" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="45%" stopColor="#F4F8FF" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#CFE4FF" stopOpacity="0" />
        </linearGradient>
      </defs>
      {Array.from({ length: 6 }, (_, i) => {
        const y0 = 640 + i * 90;
        const shift = wrap(frame * (1.6 + i * 0.25) + i * 230, 1500) - 400;
        const pts: string[] = [];
        for (let s = 0; s <= 24; s++) {
          const x = 1180 - s * 34 - shift;
          pts.push(`${x.toFixed(1)} ${(y0 + Math.sin(s / 3 + frame / 30 + i) * (14 + i * 3)).toFixed(1)}`);
        }
        return <path key={i} d={`M ${pts.join(" L ")}`} fill="none" stroke="url(#hbBreath)" strokeWidth={2.5 + (i % 3)} strokeLinecap="round" opacity={0.35 + 0.25 * Math.sin(frame / 20 + i)} />;
      })}
    </g>
  );
};

/* ------------------------------------------------------------------ */
/* Der Berg: Fels mit Höhle und Vorsprung                              */
/* ------------------------------------------------------------------ */

const CLIFF = "M -40 1190 L -40 500 L 40 478 L 110 506 L 180 488 L 240 530 L 310 540 L 360 600 L 395 680 L 415 780 L 430 900 L 440 1020 L 452 1120 L 470 1190 Z";
const CLIFF_RIM = "M 40 478 L 110 506 L 180 488 L 240 530 L 310 540 L 360 600 L 395 680 L 415 780 L 430 900";
const PLATFORM = "M -40 1176 C 200 1170, 420 1184, 620 1176 C 800 1170, 960 1184, 1120 1178 L 1120 1920 L -40 1920 Z";
const CAVE = `M ${CAVE_X - 122} ${LEDGE} L ${CAVE_X - 122} 1030 C ${CAVE_X - 122} 920, ${CAVE_X - 40} 868, ${CAVE_X} 868 C ${CAVE_X + 52} 868, ${CAVE_X + 124} 914, ${CAVE_X + 124} 1030 L ${CAVE_X + 124} ${LEDGE} Z`;
/** Risse im Fels – sie wachsen beim Beben */
const CRACKS = [
  "M 452 1180 L 500 1236 L 488 1290 L 540 1360 L 530 1440",
  "M 760 1178 L 740 1230 L 790 1290 L 772 1350",
  "M 980 1180 L 1010 1250 L 990 1300 L 1040 1380",
  "M 300 560 L 280 640 L 320 700 L 300 790",
  "M 120 520 L 150 600 L 120 690 L 160 760 L 140 860",
];

/** Der Felsblock oben auf der Klippe – zerbricht im Sturm. Splitter: Umriss und Flugrichtung. */
const SHARDS: Array<{ d: string; vx: number; vy: number; spin: number }> = [
  { d: "M -60 0 L -70 -46 L -20 -64 L -8 -10 Z", vx: -520, vy: -260, spin: -260 },
  { d: "M -20 -64 L 30 -70 L 22 -20 L -8 -10 Z", vx: -380, vy: -420, spin: 300 },
  { d: "M 30 -70 L 74 -40 L 64 0 L 22 -20 Z", vx: -260, vy: -300, spin: -180 },
  { d: "M -60 0 L -8 -10 L 22 -20 L 64 0 Z", vx: -440, vy: -120, spin: 220 },
];

const Boulder: React.FC<{ x: number; y: number; breakAt: number; t: number; rim: string }> = ({ x, y, breakAt, t, rim }) => {
  const dt = t - breakAt;
  if (dt < 0) {
    const shiver = dt > -0.5 ? Math.sin(t * 60) * 2 * (1 + dt * 2) : 0;
    return (
      <g transform={`translate(${x + shiver} ${y})`}>
        {SHARDS.map((s, i) => (
          <path key={i} d={s.d} fill="#1A2034" stroke="#1A2034" strokeWidth={1.5} />
        ))}
        <path d="M -70 -46 L -20 -64 L 30 -70 L 74 -40" fill="none" stroke={rim} strokeWidth={3} opacity={0.6} />
      </g>
    );
  }
  return (
    <g>
      {SHARDS.map((s, i) => {
        const px = x + s.vx * dt;
        const py = y + s.vy * dt + 900 * dt * dt;
        return (
          <g key={i} transform={`translate(${px} ${py}) rotate(${s.spin * dt})`} opacity={interpolate(dt, [0, 1.6], [1, 0], clamp)}>
            <path d={s.d} fill="#1A2034" stroke={rim} strokeWidth={2} />
          </g>
        );
      })}
      {/* Staub, wo der Block war */}
      <circle cx={x} cy={y - 30} r={40 + dt * 160} fill="#8A93AE" opacity={interpolate(dt, [0, 0.9], [0.35, 0], clamp)} />
    </g>
  );
};

/** Fels mit Höhleneingang und Vorsprung. `crack` 0 … 1 lässt Risse wachsen, `fire` färbt das Streiflicht. */
const Mountain: React.FC<{ crack?: number; fire?: number; light?: number; children?: React.ReactNode }> = ({ crack = 0, fire = 0, light = 0, children }) => {
  const rim = mix(MOON_RIM, FIRE_RIM, fire);
  return (
    <g>
      <defs>
        <linearGradient id="hbRock" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1E2438" />
          <stop offset="100%" stopColor="#0B0E1A" />
        </linearGradient>
        <linearGradient id="hbLedge" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1A2033" />
          <stop offset="30%" stopColor="#0F1322" />
          <stop offset="100%" stopColor="#070912" />
        </linearGradient>
        <radialGradient id="hbCaveIn" cx="0.5" cy="0.75" r="0.7">
          <stop offset="0%" stopColor="#1A1A26" />
          <stop offset="100%" stopColor="#030308" />
        </radialGradient>
        <radialGradient id="hbCaveLight" cx="0.5" cy="0.8" r="0.6">
          <stop offset="0%" stopColor="#FFF2D2" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#FFF2D2" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d={CLIFF} fill="url(#hbRock)" />
      {/* Schichten im Fels */}
      {[620, 720, 820, 930, 1050].map((y, i) => (
        <path key={i} d={`M -40 ${y} C 100 ${y - 14}, 260 ${y + 12}, ${400 + i * 8} ${y - 6}`} stroke="#252C44" strokeWidth={3} fill="none" opacity={0.7} />
      ))}
      <path d={CLIFF_RIM} fill="none" stroke={rim} strokeWidth={3.5} opacity={0.55} strokeLinejoin="round" />
      <path d={CAVE} fill="url(#hbCaveIn)" />
      {light > 0 ? <ellipse cx={CAVE_X} cy={LEDGE - 60} rx={170} ry={150} fill="url(#hbCaveLight)" opacity={light} /> : null}
      <path d={CAVE.replace(/ Z$/, "")} fill="none" stroke={rim} strokeWidth={3} opacity={0.4} />
      {children}
      <path d={PLATFORM} fill="url(#hbLedge)" />
      <path d="M -40 1176 C 200 1170, 420 1184, 620 1176 C 800 1170, 960 1184, 1120 1178" fill="none" stroke={rim} strokeWidth={3} opacity={0.5} />
      {/* Steine am Rand */}
      {[520, 690, 880, 1010].map((x, i) => (
        <path key={i} d={`M ${x - 26} ${LEDGE + 2} L ${x - 14} ${LEDGE - 22} L ${x + 12} ${LEDGE - 26} L ${x + 28} ${LEDGE + 2} Z`} fill="#141A2C" stroke={rim} strokeWidth={1.5} strokeOpacity={0.4} />
      ))}
      {crack > 0
        ? CRACKS.map((d, i) => (
            <path key={i} d={d} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - Math.min(1, crack * 1.3 - i * 0.06)} fill="none" stroke="#04050A" strokeWidth={6} strokeLinejoin="round" />
          ))
        : null}
    </g>
  );
};

/* ------------------------------------------------------------------ */
/* Wüste und Ginsterstrauch                                            */
/* ------------------------------------------------------------------ */

const Desert: React.FC = () => (
  <g>
    <path d="M -20 1150 C 200 1150, 380 1172, 560 1168 C 760 1162, 900 1140, 1100 1156 L 1100 1920 L -20 1920 Z" fill="#2A2238" />
    <path d="M -20 1150 C 200 1150, 380 1172, 560 1168 C 760 1162, 900 1140, 1100 1156" fill="none" stroke="#8E86B0" strokeWidth={3} opacity={0.4} />
    <path d="M -20 1300 C 260 1250, 520 1320, 800 1280 C 940 1262, 1020 1268, 1100 1276 L 1100 1920 L -20 1920 Z" fill="#1C1628" />
    <path d="M -20 1300 C 260 1250, 520 1320, 800 1280 C 940 1262, 1020 1268, 1100 1276" fill="none" stroke="#6E6690" strokeWidth={2} opacity={0.35} />
    {[120, 210, 860, 990].map((x, i) => (
      <ellipse key={i} cx={x} cy={1170 + (i % 2) * 20} rx={18 + i * 3} ry={9} fill="#16121F" />
    ))}
  </g>
);

/** Ein Ginsterstrauch: viele dünne Ruten, oben mit kleinen hellen Blüten. */
const Broom: React.FC<{ x: number; y: number; s?: number; rustle?: number }> = ({ x, y, s = 1, rustle = 0 }) => {
  const frame = useCurrentFrame();
  const stems = useMemo(
    () =>
      Array.from({ length: 30 }, (_, i) => {
        const a = (random(`hbs${i}`) - 0.5) * 2.2;
        const h = 230 + random(`hbh${i}`) * 170;
        return { a, h, bx: (random(`hbb${i}`) - 0.5) * 40, c: (random(`hbc${i}`) - 0.5) * 60 };
      }),
    [],
  );
  const sway = Math.sin(frame / 34) * 6 + rustle * Math.sin(frame / 2.5) * 10;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {stems.map((st, i) => {
        const tx = st.bx + Math.sin(st.a) * st.h + sway * (st.h / 400);
        const ty = -Math.cos(st.a * 0.7) * st.h;
        const d = `M ${st.bx * 0.3} 0 Q ${st.bx + st.c} ${ty * 0.5} ${tx} ${ty}`;
        return (
          <g key={i}>
            <path d={d} stroke="#151C17" strokeWidth={5} fill="none" strokeLinecap="round" />
            <path d={d} stroke={MOON_RIM} strokeWidth={1.5} fill="none" opacity={tx < 0 ? 0.45 : 0.15} transform="translate(-2 -1)" />
            {[0.55, 0.72, 0.88, 1].map((f, k) => (
              <circle key={k} cx={st.bx * 0.3 + (tx - st.bx * 0.3) * f + (k % 2 ? 6 : -6)} cy={ty * f} r={3.2} fill="#E4E2CC" opacity={0.55} />
            ))}
          </g>
        );
      })}
    </g>
  );
};

/* ------------------------------------------------------------------ */
/* Figuren                                                             */
/* ------------------------------------------------------------------ */

/** Elija sitzend, die Knie angezogen, der Kopf gesenkt – Blick nach rechts. Ursprung unter der Hüfte. */
const SitShape: React.FC<{ fill: string; bow: number }> = ({ fill, bow }) => {
  const hx = 30 + bow * 26;
  const hy = -214 + bow * 44;
  return (
    <g>
      {/* Gewand über Rücken und Beinen */}
      <path d="M -78 0 C -92 -70, -82 -150, -44 -196 C -18 -226, 30 -222, 46 -190 C 58 -166, 62 -150, 70 -128 C 96 -120, 110 -96, 104 -60 C 100 -30, 96 -8, 92 0 Z" fill={fill} />
      {/* Kopf mit Tuch */}
      <circle cx={hx} cy={hy} r={25} fill={fill} />
      <path d={`M ${hx - 32} ${hy + 6} C ${hx - 34} ${hy - 40}, ${hx + 28} ${hy - 44}, ${hx + 30} ${hy - 4} L ${hx + 26} ${hy + 30} L ${hx - 40} ${hy + 46} Z`} fill={fill} />
      {/* Arme um die Knie */}
      <path d={`M -14 -178 C 20 -150, 60 -128, 96 -112`} stroke={fill} strokeWidth={22} strokeLinecap="round" fill="none" />
      {/* Füsse */}
      <ellipse cx={100} cy={-6} rx={22} ry={8} fill={fill} />
    </g>
  );
};

const Sitting: React.FC<{ x: number; y: number; k?: number; bow?: number; rim?: string; rimSide?: 1 | -1; dir?: 1 | -1; o?: number }> = ({ x, y, k = 1, bow = 0.6, rim = MOON_RIM, rimSide = -1, dir = 1, o = 1 }) => (
  <g transform={`translate(${x} ${y}) scale(${dir * k} ${k})`} opacity={o}>
    <ellipse cx={10} cy={4} rx={110} ry={11} fill="#000" opacity={0.35} />
    <g transform={`translate(${rimSide * 5} -3)`}>
      <SitShape fill={rim} bow={bow} />
    </g>
    <SitShape fill={ROBE} bow={bow} />
  </g>
);

/** Elija schlafend auf der Seite, den Kopf links. Ursprung unter der Körpermitte. */
const LieShape: React.FC<{ fill: string }> = ({ fill }) => (
  <g>
    <path d="M -128 0 C -138 -34, -108 -62, -60 -66 C 0 -72, 84 -60, 132 -38 C 162 -24, 160 0, 140 0 Z" fill={fill} />
    <circle cx={-148} cy={-34} r={25} fill={fill} />
    <path d="M -178 -22 C -186 -62, -126 -76, -118 -40 L -110 -2 L -170 0 Z" fill={fill} />
  </g>
);

const Lying: React.FC<{ x: number; y: number; k?: number; o?: number; breathe: number }> = ({ x, y, k = 1, o = 1, breathe }) => (
  <g transform={`translate(${x} ${y}) scale(${k} ${k * (1 + 0.015 * breathe)})`} opacity={o}>
    <ellipse cx={0} cy={4} rx={170} ry={12} fill="#000" opacity={0.35} />
    <g transform="translate(-4 -4)">
      <LieShape fill={MOON_RIM} />
    </g>
    <LieShape fill={ROBE} />
  </g>
);

/** Elija stehend; mit `veil` legt sich der Mantel über das Gesicht, mit `flap` weht er im Sturm. */
const Elija: React.FC<{ x: number; y: number; k: number; pose?: RobePose; rim?: string; veil?: number; flap?: number; o?: number }> = ({ x, y, k, pose = {}, rim = MOON_RIM, veil = 0, flap = 0, o = 1 }) => {
  const frame = useCurrentFrame();
  const bow = pose.bow ?? 0;
  const hx = 4 + bow * 14;
  const hy = -282 + bow * 16;
  const wave = Math.sin(frame / 2.2) * 18 * flap;
  return (
    <g opacity={o}>
      {flap > 0.01 ? (
        <g transform={`translate(${x} ${y}) scale(${k})`}>
          <path d={`M -24 -236 C ${-90 - 40 * flap} ${-230 + wave}, ${-150 - 60 * flap} ${-200 - wave}, ${-180 - 70 * flap} ${-150 + wave} C ${-130 - 40 * flap} ${-150 - wave * 0.5}, -70 -170, -30 -160 Z`} fill="#2A2018" opacity={0.95} />
        </g>
      ) : null}
      <Robed x={x} y={y} k={k} fill={ROBE} rim={rim} rimSide={-1} pose={pose} />
      {veil > 0.01 ? (
        <g transform={`translate(${x} ${y}) scale(${k})`} opacity={Math.min(1, veil * 1.4)}>
          <path
            d={`M ${hx - 36} ${hy - 4} C ${hx - 30} ${hy - 50}, ${hx + 34} ${hy - 50}, ${hx + 30 + 16 * veil} ${hy + 4} C ${hx + 28 + 14 * veil} ${hy + 34}, ${hx + 18} ${hy + 64}, 22 -190 L -30 -196 C -36 -220, ${hx - 40} ${hy + 20}, ${hx - 36} ${hy - 4} Z`}
            fill="#3A2C20"
          />
          <path d={`M ${hx - 30} ${hy - 44} C ${hx - 4} ${hy - 56}, ${hx + 26} ${hy - 44}, ${hx + 30 + 16 * veil} ${hy + 4}`} fill="none" stroke={rim} strokeWidth={4} opacity={0.6} />
        </g>
      ) : null}
    </g>
  );
};

/** Der Engel: eine helle Gestalt ohne Gesicht, von Licht umgeben. */
const Angel: React.FC<{ x: number; y: number; k: number; o: number; reach: number }> = ({ x, y, k, o, reach }) => {
  const frame = useCurrentFrame();
  if (o <= 0.01) return null;
  return (
    <g opacity={o}>
      <defs>
        <radialGradient id="hbAngel" cx="0.5" cy="0.45" r="0.55">
          <stop offset="0%" stopColor="#FFFBEA" stopOpacity="0.85" />
          <stop offset="45%" stopColor="#E8F0FF" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#E8F0FF" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx={x} cy={y - 160 * k} rx={240 * k} ry={330 * k * (0.96 + 0.04 * Math.sin(frame / 16))} fill="url(#hbAngel)" />
      <g transform={`rotate(${-10 * reach} ${x} ${y})`}>
        <Robed x={x} y={y} k={k} dir={-1} fill="#EEF2FF" rim="#FFFFFF" pose={{ reach, bow: 0.5 * reach }} shadow={false} />
      </g>
    </g>
  );
};

/** Ein moderner Mensch als klare Silhouette mit Farben. Ursprung: Füsse (stehend) bzw. Sitzfläche (sitzend). */
const Person: React.FC<{
  x: number;
  y: number;
  k?: number;
  dir?: 1 | -1;
  sit?: boolean;
  kneel?: boolean;
  armUp?: number;
  lean?: number;
  shirt: string;
  skin: string;
  legs: string;
  hair: string;
  bun?: boolean;
  towel?: number;
  step?: number;
}> = ({ x, y, k = 1, dir = 1, sit = false, kneel = false, armUp = 0, lean = 0, shirt, skin, legs, hair, bun = false, towel = 0, step }) => {
  const sw = step !== undefined ? Math.sin(step) * 16 : 0;
  // Hüfte, Schulter, Kopf im eigenen Koordinatensystem
  const hip: [number, number] = sit ? [0, -6] : kneel ? [0, -62] : [0, -96];
  const sh: [number, number] = [hip[0] + 4, hip[1] - 92];
  const head: [number, number] = [sh[0] + 4, sh[1] - 30];
  const hand = armUp > 0 ? [sh[0] + 18 + 10 * armUp, sh[1] - 70 * armUp] : sit ? [sh[0] + 46, hip[1] - 16] : [sh[0] + 10 + sw * 0.5, sh[1] + 76];
  return (
    <g transform={`translate(${x} ${y}) scale(${dir * k} ${k}) rotate(${lean} ${hip[0]} ${hip[1]})`}>
      {/* Beine */}
      {sit ? (
        <>
          <path d={`M ${hip[0]} ${hip[1]} L ${hip[0] + 54} ${hip[1]} L ${hip[0] + 60} ${hip[1] + 78}`} stroke={legs} strokeWidth={22} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d={`M ${hip[0] + 60} ${hip[1] + 78} L ${hip[0] + 60} ${hip[1] + 86}`} stroke={skin} strokeWidth={20} strokeLinecap="round" />
        </>
      ) : kneel ? (
        <>
          <path d={`M ${hip[0]} ${hip[1]} L ${hip[0] - 6} -6 L ${hip[0] - 56} -6`} stroke={legs} strokeWidth={22} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d={`M ${hip[0]} ${hip[1]} L ${hip[0] + 46} ${hip[1] + 6} L ${hip[0] + 50} -4`} stroke={legs} strokeWidth={22} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </>
      ) : (
        <>
          <path d={`M ${hip[0]} ${hip[1]} L ${-6 - sw} -4`} stroke={legs} strokeWidth={22} strokeLinecap="round" fill="none" />
          <path d={`M ${hip[0]} ${hip[1]} L ${6 + sw} -4`} stroke={legs} strokeWidth={22} strokeLinecap="round" fill="none" />
        </>
      )}
      {/* Oberkörper */}
      <path d={`M ${hip[0] - 4} ${hip[1] + 6} L ${sh[0]} ${sh[1]}`} stroke={shirt} strokeWidth={50} strokeLinecap="round" />
      {towel > 0.01 ? <path d={`M ${sh[0] - 30} ${sh[1] - 6} C ${sh[0] - 10} ${sh[1] + 20}, ${sh[0] + 20} ${sh[1] + 20}, ${sh[0] + 34} ${sh[1] - 4} L ${sh[0] + 30} ${sh[1] + 40} L ${sh[0] - 30} ${sh[1] + 50} Z`} fill="#E8F4F8" opacity={towel} /> : null}
      {/* Arm */}
      <path d={`M ${sh[0]} ${sh[1] + 6} L ${hand[0]} ${hand[1]}`} stroke={skin} strokeWidth={17} strokeLinecap="round" />
      {/* Kopf */}
      <circle cx={head[0]} cy={head[1]} r={24} fill={skin} />
      <path d={`M ${head[0] - 25} ${head[1] - 2} C ${head[0] - 26} ${head[1] - 30}, ${head[0] + 24} ${head[1] - 34}, ${head[0] + 25} ${head[1] - 6} C ${head[0] + 10} ${head[1] - 16}, ${head[0] - 6} ${head[1] - 12}, ${head[0] - 25} ${head[1] - 2} Z`} fill={hair} />
      {bun ? <circle cx={head[0] - 22} cy={head[1] - 20} r={12} fill={hair} /> : null}
    </g>
  );
};

/* ------------------------------------------------------------------ */
/* Zeilen im Bild                                                      */
/* ------------------------------------------------------------------ */

/** Eine Zeile Wort für Wort, so wie sie gesprochen wird. */
const Spoken: React.FC<{ ts: TimelineScene; text: string; t: number }> = ({ ts, text, t }) => {
  const tokens = text.split(/\s+/);
  const cue = findCue(ts.words, text);
  const ok = cue && cue.last - cue.first + 1 === tokens.length;
  return (
    <>
      {tokens.map((w, i) => {
        const at = ok ? ts.words[cue.first + i].start : beat(ts, text, 0.5) + i * 0.25;
        return (
          <span key={i} style={{ opacity: interpolate(t, [at - 0.1, at + 0.15], [0.12, 1], clamp) }}>
            {w}
            {i < tokens.length - 1 ? " " : ""}
          </span>
        );
      })}
    </>
  );
};

/** Schlagzeile: gross, in Versalien, springt herein. */
const Headline: React.FC<{ text: string; k: number; y: number; size?: number; color?: string; dim?: number; strike?: number; x?: number }> = ({ text, k, y, size = 104, color, dim = 0, strike = 0, x = 540 }) => {
  const look = useLook();
  if (k <= 0.01) return null;
  return (
    <div style={{ position: "absolute", left: x - 520, width: 1040, top: y - size * 0.6, textAlign: "center", opacity: Math.min(1, k * 1.4) * (1 - dim * 0.72) }}>
      <span
        style={{
          position: "relative",
          display: "inline-block",
          fontFamily: look.display,
          fontSize: size,
          lineHeight: 1.05,
          textTransform: "uppercase",
          letterSpacing: "0.02em",
          color: color ?? look.text,
          textShadow: look.glow,
          transform: `scale(${interpolate(k, [0, 1], [1.4, 1])})`,
        }}
      >
        {text}
        {strike > 0 ? <span style={{ position: "absolute", left: -10, top: "52%", height: 6, width: `calc(${strike * 100}% + 20px)`, background: look.accent, borderRadius: 3, opacity: 0.85 }} /> : null}
      </span>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Etappen                                                             */
/* ------------------------------------------------------------------ */

type StageP = { ts: TimelineScene; s: HorebT; t: number };

const lineK = (ts: TimelineScene, t: number, l: Line | undefined) => (l ? popAt(t, beat(ts, l.at, 0.5)) : 0);

/** Einstieg: Sturm, Erdbeben, Feuer – und dann ist es still. */
const HookStage: React.FC<StageP> = ({ ts, s, t }) => {
  const frame = useCurrentFrame();
  const look = useLook();
  const [sturmAt, bebenAt, feuerAt] = s.lines.map((l) => beat(ts, l.at, 0.5));
  const [stillAt] = beats(ts, s.cues, 1);
  const calm = 1 - fade(t, stillAt - 0.1, 0.9);
  const storm = Math.max(0.75, fade(t, sturmAt - 0.2, 0.3)) * calm;
  const shake = t > bebenAt ? 12 * Math.exp(-(t - bebenAt) * 1.8) * calm : 0;
  const fire = fade(t, feuerAt - 0.1, 0.5) * (1 - fade(t, stillAt, 1.2));
  const crack = fade(t, bebenAt, 0.8);
  const dimAll = fade(t, stillAt, 0.6);
  const glowK = fade(t, stillAt + 0.6, 0.9);
  const dx = Math.sin(frame * 2.1) * shake;
  const dy = Math.cos(frame * 2.7) * shake * 0.6;
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <StormClouds k={storm} speed={1.3} />
        <Lightning f={flashAt(t, sturmAt + 0.05) * calm} />
        <g transform={`translate(${dx} ${dy})`}>
          <Fire k={fire} />
          <Mountain crack={crack} fire={fire} light={glowK * 0.7}>
            <Elija x={ELIJA_X} y={LEDGE} k={0.6} pose={{ hold: 0.8 * calm, bow: 0.4 }} rim={mix(MOON_RIM, FIRE_RIM, fire)} />
          </Mountain>
          <Debris k={storm * 0.8} />
        </g>
        <Rain k={storm} />
        {glowK > 0 ? (
          <g opacity={glowK}>
            <circle cx={CAVE_X + 70} cy={1000} r={60} fill="url(#hbCaveLight)" />
            <circle cx={CAVE_X + 70} cy={1000} r={6 + 2 * Math.sin(frame / 8)} fill="#FFF6DC" />
          </g>
        ) : null}
      </svg>
      {s.lines.map((l, i) => (
        <Headline key={i} text={l.text} k={lineK(ts, t, l)} y={340 + i * 128} x={600} size={118} color={i === 2 && fire > 0.3 ? "#FFC27A" : look.text} dim={dimAll} strike={fade(t, stillAt + 0.2 + i * 0.15, 0.4)} />
      ))}
      <Sfx frame={voiceFrame(ts, bebenAt)} name="thud" volume={0.5} keep />
    </AbsoluteFill>
  );
};

/** Elija unter dem Ginsterstrauch; die Drohung der Königin kommt als versiegelte Botschaft. */
const BroomStage: React.FC<StageP> = ({ ts, s, t }) => {
  const frame = useCurrentFrame();
  const [drohtAt, ginsterAt] = beats(ts, s.cues, 2);
  const say = s.lines[0];
  const sayAt = beat(ts, say?.at, ts.speechEndSec - 0.8);
  const msg = popAt(t, drohtAt - 0.1, 0.5);
  const msgOut = fade(t, drohtAt + 1.9, 0.6);
  const zoom = 1 + 0.08 * ease(fade(t, ginsterAt - 0.3, 1.6));
  const bow = 0.45 + 0.4 * fade(t, drohtAt + 0.4, 1.2);
  const sayK = popAt(t, sayAt, 0.5);
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <g transform={`translate(560 ${SAND}) scale(${zoom}) translate(-560 ${-SAND})`}>
          <Desert />
          <Broom x={640} y={SAND} s={1.05} rustle={fade(t, ginsterAt, 0.3) * (1 - fade(t, ginsterAt + 1.2, 0.5))} />
          <Sitting x={560} y={SAND + 2} k={1.02} bow={bow} />
        </g>
        {/* Die Botschaft der Königin: eine Rolle mit rotem Siegel */}
        {msg > 0.01 && msgOut < 1 ? (
          <g transform={`translate(${interpolate(msg, [0, 1], [1180, 720])} ${520 + Math.sin(frame / 14) * 6}) rotate(${-8 + (1 - msg) * 30}) scale(${0.9 + 0.1 * msg})`} opacity={(1 - msgOut) * Math.min(1, msg * 1.5)}>
            <ellipse cx={0} cy={10} rx={220} ry={120} fill="#7A1A1A" opacity={0.2} />
            <rect x={-150} y={-60} width={300} height={120} fill="#D9C6A0" stroke="#5A4224" strokeWidth={4} />
            {[-28, -4, 20].map((y, i) => (
              <path key={i} d={`M -120 ${y} q 20 -6 40 0 t 40 0 t 40 0 t 40 0 t 40 0`} stroke="#5A1E1E" strokeWidth={3} fill="none" opacity={0.55} />
            ))}
            <rect x={-170} y={-72} width={26} height={144} rx={12} fill="#6A4A22" />
            <rect x={144} y={-72} width={26} height={144} rx={12} fill="#6A4A22" />
            <circle cx={96} cy={44} r={34} fill="#A3201E" stroke="#5E0E0E" strokeWidth={4} />
            <path d="M 78 52 L 76 34 L 86 44 L 96 30 L 106 44 L 116 34 L 114 52 Z" fill="#E8B04A" />
          </g>
        ) : null}
      </svg>
      {sayK > 0.01 ? (
        <div
          style={{
            position: "absolute",
            left: 120,
            right: 120,
            top: 640,
            textAlign: "center",
            fontFamily: "Cormorant Garamond",
            fontStyle: "italic",
            fontWeight: 600,
            fontSize: 92,
            color: "#F3F0FF",
            textShadow: "0 0 30px rgba(143,166,218,0.5), 0 6px 26px rgba(0,0,0,0.85)",
            opacity: Math.min(1, sayK * 1.4),
            transform: `translateY(${(1 - sayK) * 20}px)`,
          }}
        >
          «{say?.text}»
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

/** Der Engel weckt ihn, Brot und Wasser – dann vierzig Tage bis zum Gottesberg. */
const AngelStage: React.FC<StageP> = ({ ts, s, t }) => {
  const frame = useCurrentFrame();
  const look = useLook();
  const [engelAt, issAt, tageAt, horebAt] = beats(ts, s.cues, 4);
  const angel = fade(t, engelAt - 0.1, 0.7);
  const touch = fade(t, engelAt + 0.4, 0.6);
  const food = popAt(t, issAt, 0.5);
  const walk = fade(t, tageAt - 0.35, 0.6);
  const sleepO = 1 - walk;
  const route = interpolate(t, [tageAt, horebAt + 0.6], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const horeb = popAt(t, horebAt, 0.5);
  // Die Route: vom Rand der Wüste bis zum Fuss des Gottesbergs, 40 Punkte
  const routePts = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => {
        const f = i / 39;
        return { x: 110 + f * 640, y: 1110 - Math.sin(f * Math.PI * 0.5) * 240 - Math.sin(f * 9) * 14 };
      }),
    [],
  );
  const lit = Math.round(route * 40);
  const walkerX = 130 + route * 520;
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <Desert />
        {sleepO > 0.01 ? (
          <g opacity={sleepO}>
            <Broom x={330} y={SAND} s={0.95} />
            <Lying x={560} y={SAND + 2} k={1} breathe={Math.sin(frame / 18)} />
            {/* Berührung */}
            {touch > 0 ? <circle cx={600} cy={SAND - 56} r={20 + 50 * touch} fill="#FFF6DC" opacity={0.3 * touch * (1 - fade(t, engelAt + 1.2, 0.6))} /> : null}
            <Angel x={730} y={SAND} k={0.95} o={angel} reach={touch} />
            {/* Brot auf glühenden Steinen, ein Krug Wasser */}
            {food > 0.01 ? (
              <g transform={`translate(330 ${SAND - 6}) scale(${food})`}>
                <ellipse cx={0} cy={0} rx={110} ry={50} fill="#FF9A4A" opacity={0.18 + 0.06 * Math.sin(frame / 5)} />
                {[-36, -12, 14, 38].map((x, i) => (
                  <ellipse key={i} cx={x} cy={2} rx={16} ry={9} fill={i % 2 ? "#FF7A2A" : "#C9461A"} />
                ))}
                <ellipse cx={0} cy={-10} rx={52} ry={15} fill="#D9A25C" stroke="#8A5A22" strokeWidth={3} />
                <path d="M -26 -14 q 8 -6 16 0 M 4 -16 q 8 -6 16 0" stroke="#8A5A22" strokeWidth={2.5} fill="none" />
                <g transform="translate(-96 -2)">
                  <path d="M -16 0 C -26 -20, -24 -50, -12 -58 L -10 -72 L 10 -72 L 12 -58 C 24 -50, 26 -20, 16 0 Z" fill="#9A5A3A" stroke="#5A321E" strokeWidth={3} />
                  <path d="M 12 -58 C 26 -60, 28 -40, 18 -34" stroke="#5A321E" strokeWidth={4} fill="none" />
                </g>
              </g>
            ) : null}
          </g>
        ) : null}
        {walk > 0.01 ? (
          <g opacity={walk}>
            {routePts.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={i < lit ? 7 : 4.5} fill={i < lit ? look.accent : "#5A6488"} opacity={i < lit ? 0.95 : 0.5} />
            ))}
            <Elija x={walkerX} y={SAND} k={0.62} pose={{ step: frame * 0.32, bow: 0.15 }} />
          </g>
        ) : null}
        {horeb > 0.01 ? (
          <g opacity={Math.min(1, horeb * 1.4)}>
            <circle cx={806} cy={700} r={120} fill="url(#hbCaveLight)" opacity={0.6} />
          </g>
        ) : null}
      </svg>
      {walk > 0.01 ? (
        <div style={{ position: "absolute", top: 330, left: 0, right: 0, textAlign: "center", opacity: walk }}>
          <div style={{ fontFamily: "Cinzel", fontWeight: 700, fontSize: 132, lineHeight: 1, color: look.accent, textShadow: look.glow }}>{Math.max(1, lit)}</div>
          <div style={{ marginTop: 10, fontFamily: "Cinzel", fontWeight: 700, fontSize: 40, letterSpacing: "0.18em", color: look.text, opacity: 0.85 }}>TAGE UND NÄCHTE</div>
        </div>
      ) : null}
      {horeb > 0.01 ? (
        <div style={{ position: "absolute", left: 806 - 220, width: 440, top: 560, textAlign: "center", fontFamily: "Cinzel", fontWeight: 700, fontSize: 64, letterSpacing: "0.16em", color: "#FFF4DA", textShadow: "0 0 26px rgba(255,230,170,0.7), 0 6px 20px rgba(0,0,0,0.8)", opacity: Math.min(1, horeb * 1.4), transform: `scale(${interpolate(horeb, [0, 1], [0.8, 1])})` }}>
          HOREB
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

/** In der Höhle: der Blick hinaus, und die Frage. */
const CaveStage: React.FC<StageP> = ({ ts, s, t }) => {
  const [inAt] = beats(ts, s.cues, 1);
  const q = s.lines[0];
  const qAt = beat(ts, q?.at, 2);
  const zoom = 1 + 0.06 * ease(fade(t, inAt - 0.4, 3.5));
  const qK = fade(t, qAt - 0.25, 0.5);
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id="hbCaveWall" cx="0.5" cy="0.45" r="0.75">
            <stop offset="55%" stopColor="#0E0D14" />
            <stop offset="100%" stopColor="#040308" />
          </radialGradient>
          <linearGradient id="hbMoonBeam" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#CFDBFF" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#CFDBFF" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g transform={`translate(540 980) scale(${zoom}) translate(-540 -980)`}>
          {/* Höhlenwand mit Öffnung */}
          <path
            fillRule="evenodd"
            d="M -60 -60 L 1140 -60 L 1140 1980 L -60 1980 Z M 230 1150 L 236 760 C 250 520, 380 380, 560 372 C 740 380, 860 520, 872 760 L 880 1150 Z"
            fill="url(#hbCaveWall)"
          />
          <path d="M 230 1150 L 236 760 C 250 520, 380 380, 560 372 C 740 380, 860 520, 872 760 L 880 1150" fill="none" stroke={MOON_RIM} strokeWidth={5} opacity={0.45} />
          {[[120, 520, 200], [960, 640, 180], [80, 1000, 260], [990, 1080, 220]].map(([x, y, w], i) => (
            <path key={i} d={`M ${x - w / 2} ${y} C ${x - w / 4} ${y - 20}, ${x + w / 4} ${y + 14}, ${x + w / 2} ${y - 6}`} stroke="#1D1B28" strokeWidth={5} fill="none" />
          ))}
          {/* Mondlicht fällt herein */}
          <path d="M 300 1150 L 820 1150 L 980 1460 L 140 1460 Z" fill="url(#hbMoonBeam)" />
          {/* Boden der Höhle */}
          <path d="M -60 1150 L 1140 1150 L 1140 1980 L -60 1980 Z" fill="#08070D" />
          <path d="M 230 1150 L 880 1150" stroke={MOON_RIM} strokeWidth={3} opacity={0.3} />
          <Sitting x={300} y={1150} k={1.12} bow={0.15 + 0.15 * (1 - qK)} rimSide={1} />
        </g>
      </svg>
      {qK > 0.01 && q ? (
        <div
          style={{
            position: "absolute",
            left: 260,
            right: 220,
            top: 520,
            textAlign: "center",
            fontFamily: "Cormorant Garamond",
            fontStyle: "italic",
            fontWeight: 600,
            fontSize: 96,
            lineHeight: 1.08,
            color: "#F2F6FF",
            textShadow: "0 0 34px rgba(159,216,255,0.55), 0 6px 26px rgba(0,0,0,0.85)",
            opacity: qK,
          }}
        >
          <Spoken ts={ts} text={q.text} t={t} />
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

/** Der Sturm zerbricht die Felsen. */
const WindStage: React.FC<StageP> = ({ ts, s, t }) => {
  const frame = useCurrentFrame();
  const [bergAt, sturmAt, felsAt] = beats(ts, s.cues, 3);
  const nicht = s.lines[0];
  const nichtAt = beat(ts, nicht?.at, ts.speechEndSec - 1);
  const storm = 0.35 + 0.65 * fade(t, sturmAt - 0.3, 0.6) - 0.35 * fade(t, nichtAt + 0.6, 1.2);
  const stand = fade(t, bergAt - 0.2, 0.6);
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <StormClouds k={storm} speed={1.6} />
        <Lightning f={flashAt(t, sturmAt + 0.1) * 0.9} x={880} />
        <Mountain>
          <Elija x={ELIJA_X} y={LEDGE} k={0.62} pose={{ hold: 0.9, bow: 0.25 + 0.25 * stand }} flap={storm * 0.8} />
        </Mountain>
        <Boulder x={150} y={482} breakAt={felsAt + 0.35} t={t} rim={MOON_RIM} />
        <Debris k={storm} />
        <Rain k={storm} slant={0.5} />
        {/* Windböen */}
        {Array.from({ length: 7 }, (_, i) => {
          const x = wrap(1300 - frame * (34 + i * 5) + i * 300, 1600) - 300;
          const y = 560 + i * 82;
          return <path key={i} d={`M ${x} ${y} q 60 -18 120 0 t 120 0`} stroke="#DDE6FF" strokeWidth={3} fill="none" opacity={0.25 * storm} strokeLinecap="round" />;
        })}
      </svg>
      <Headline text={nicht?.text ?? ""} k={lineK(ts, t, nicht)} y={360} size={112} />
      <Sfx frame={voiceFrame(ts, felsAt + 0.35)} name="thud" volume={0.5} keep />
    </AbsoluteFill>
  );
};

/** Erdbeben und Feuer. */
const QuakeFireStage: React.FC<StageP> = ({ ts, s, t }) => {
  const frame = useCurrentFrame();
  const [bebenAt, feuerAt] = beats(ts, s.cues, 2);
  const [l1, l2] = s.lines;
  const shake = t > bebenAt - 0.05 && t < feuerAt ? 14 * Math.exp(-(t - bebenAt) * 1.5) : 0;
  const crack = fade(t, bebenAt, 0.9);
  const fire = fade(t, feuerAt - 0.15, 0.6);
  const dust = t > bebenAt ? interpolate(t - bebenAt, [0, 1.6], [0.5, 0], clamp) : 0;
  const dx = Math.sin(frame * 2.3) * shake;
  const dy = Math.cos(frame * 3.1) * shake * 0.7;
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <StormClouds k={0.45} speed={0.7} />
        <g transform={`translate(${dx} ${dy})`}>
          <Fire k={fire} />
          <Mountain crack={crack} fire={fire}>
            <Elija x={ELIJA_X} y={LEDGE} k={0.62} pose={{ hold: 0.9, bow: 0.4 }} rim={mix(MOON_RIM, FIRE_RIM, fire)} />
          </Mountain>
          {dust > 0
            ? [140, 420, 760, 980].map((x, i) => <ellipse key={i} cx={x} cy={LEDGE - 10} rx={80 + (1 - dust) * 160} ry={40 + (1 - dust) * 60} fill="#7A819A" opacity={dust * 0.5} />)
            : null}
          {/* Steine, die von der Klippe fallen */}
          {t > bebenAt
            ? [90, 200, 330].map((x, i) => {
                const d = t - bebenAt - i * 0.18;
                if (d < 0 || d > 1.4) return null;
                return <circle key={i} cx={x + d * 30} cy={520 + 500 * d * d + 60 * d} r={12 + i * 4} fill="#1A2034" stroke={MOON_RIM} strokeWidth={1.5} />;
              })
            : null}
        </g>
      </svg>
      <Headline text={l1?.text ?? ""} k={lineK(ts, t, l1)} y={340} size={104} />
      <Headline text={l2?.text ?? ""} k={lineK(ts, t, l2)} y={470} size={104} color="#FFC27A" />
    </AbsoluteFill>
  );
};

/** Stille. Ein leises Säuseln – Elija verhüllt sein Gesicht und tritt hinaus. */
const WhisperStage: React.FC<StageP> = ({ ts, s, t }) => {
  const frame = useCurrentFrame();
  const [hauchAt, huellAt, hinausAt] = beats(ts, s.cues, 3);
  const embers = 1 - fade(t, -0.3, 2.2);
  const breath = fade(t, hauchAt - 0.2, 1.2);
  const veil = ease(fade(t, huellAt, 1.1));
  const out = ease(fade(t, hinausAt - 0.1, 1.2));
  const zoom = 1 + 0.18 * ease(interpolate(frame, [0, ts.durationInFrames], [0, 1], clamp));
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <g transform={`translate(330 1030) scale(${zoom}) translate(-330 -1030)`}>
          <Mountain crack={1} light={breath * 0.55}>
            <Elija x={ELIJA_X + out * 120} y={LEDGE} k={0.66} pose={{ hold: veil, bow: 0.25 + 0.2 * veil, step: out > 0 && out < 1 ? frame * 0.3 : undefined }} veil={veil} />
          </Mountain>
          {/* Glut, die verglimmt */}
          {embers > 0.01
            ? Array.from({ length: 14 }, (_, i) => (
                <circle key={i} cx={560 + i * 38 + random(`hwe${i}`) * 20} cy={LEDGE - 4 - random(`hwy${i}`) * 10} r={4 + random(`hwr${i}`) * 4} fill="#FF7A2A" opacity={embers * (0.4 + 0.4 * Math.sin(frame / 6 + i))} />
              ))
            : null}
        </g>
        <Smoke k={0.8 * (1 - breath * 0.6)} />
        <Breath k={breath} />
      </svg>
      <Sfx frame={voiceFrame(ts, hauchAt - 0.1)} name="breath" volume={0.45} keep />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* Das Hallenbad                                                       */
/* ------------------------------------------------------------------ */

const WATER_TOP = 840;
const NEAR_DECK = 1196;
const CHAIR_X = 210;
const SEAT_Y = 880;
const WOMAN_X = 840;
const BENCH_Y = 812;

/** Das Hallenbad bei Nacht: Fenster, Kacheln, Wasserlicht. */
const Pool: React.FC = () => {
  const frame = useCurrentFrame();
  const stars = useMemo(() => Array.from({ length: 40 }, (_, i) => ({ x: random(`hps${i}`), y: random(`hpy${i}`), r: 0.8 + random(`hpr${i}`) * 1.6 })), []);
  return (
    <g>
      <defs>
        <linearGradient id="hpWall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0A2430" />
          <stop offset="100%" stopColor="#123E4C" />
        </linearGradient>
        <linearGradient id="hpWater" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1C9CC0" />
          <stop offset="100%" stopColor="#0B5E86" />
        </linearGradient>
        <linearGradient id="hpDeck" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#35505C" />
          <stop offset="100%" stopColor="#16242C" />
        </linearGradient>
        <linearGradient id="hpWin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#060A22" />
          <stop offset="100%" stopColor="#1A2450" />
        </linearGradient>
        <radialGradient id="hpLamp">
          <stop offset="0%" stopColor="#FFF4DA" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#FFF4DA" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={1080} height={WATER_TOP} fill="url(#hpWall)" />
      {/* Kacheln an der Wand */}
      {Array.from({ length: 14 }, (_, i) => (
        <line key={`h${i}`} x1={0} x2={1080} y1={680 + i * 12} y2={680 + i * 12} stroke="#1E5868" strokeWidth={1} opacity={0.5} />
      ))}
      {/* Fenster mit Nachthimmel */}
      {[70, 330, 590, 850].map((x, i) => (
        <g key={i}>
          <rect x={x} y={300} width={180} height={330} fill="url(#hpWin)" />
          {stars.map((st, k) =>
            k % 4 === i ? <circle key={k} cx={x + 10 + st.x * 160} cy={310 + st.y * 300} r={st.r} fill="#EEF3FF" opacity={0.6} /> : null,
          )}
          <rect x={x} y={300} width={180} height={330} fill="none" stroke="#7FA0AA" strokeWidth={6} />
          <line x1={x + 90} x2={x + 90} y1={300} y2={630} stroke="#7FA0AA" strokeWidth={4} />
        </g>
      ))}
      {/* Deckenlampen */}
      {[180, 540, 900].map((x, i) => (
        <g key={i}>
          <circle cx={x} cy={256} r={90} fill="url(#hpLamp)" opacity={0.5} />
          <rect x={x - 60} y={248} width={120} height={14} rx={7} fill="#FFF4DA" />
        </g>
      ))}
      {/* Hinterer Beckenrand */}
      <rect x={0} y={760} width={1080} height={WATER_TOP - 760} fill="#9CB6BC" />
      {Array.from({ length: 18 }, (_, i) => (
        <line key={i} x1={i * 64} x2={i * 64 - 10} y1={760} y2={WATER_TOP} stroke="#7F9AA2" strokeWidth={2} />
      ))}
      <rect x={0} y={WATER_TOP - 8} width={1080} height={8} fill="#5E7E88" />
      {/* Wasser */}
      <rect x={0} y={WATER_TOP} width={1080} height={NEAR_DECK - WATER_TOP} fill="url(#hpWater)" />
      {Array.from({ length: 12 }, (_, i) => {
        const y = WATER_TOP + 20 + i * 30;
        const pts: string[] = [];
        for (let s = 0; s <= 30; s++) pts.push(`${s * 38} ${(y + Math.sin(s * 0.9 + frame / 14 + i * 1.7) * (4 + i * 0.6)).toFixed(1)}`);
        return <path key={i} d={`M ${pts.join(" L ")}`} stroke="#B9F0FF" strokeWidth={2 + i * 0.15} fill="none" opacity={0.18 + 0.05 * Math.sin(frame / 20 + i)} />;
      })}
      {/* Leinen */}
      {[920, 1030, 1150].map((y, li) => {
        const r = 7 + li * 3;
        return (
          <g key={li}>
            {Array.from({ length: Math.ceil(1080 / (r * 2.4)) + 1 }, (_, i) => (
              <circle key={i} cx={i * r * 2.4} cy={y + Math.sin(frame / 12 + i * 0.6) * 2} r={r} fill={Math.floor(i / 3) % 2 ? "#F4F4F4" : "#E0453A"} />
            ))}
          </g>
        );
      })}
      {/* Vorderer Beckenrand */}
      <rect x={0} y={NEAR_DECK - 10} width={1080} height={14} fill="#8AA6AE" />
      <rect x={0} y={NEAR_DECK} width={1080} height={1920 - NEAR_DECK} fill="url(#hpDeck)" />
      {Array.from({ length: 10 }, (_, i) => (
        <line key={i} x1={0} x2={1080} y1={NEAR_DECK + 40 + i * 60} y2={NEAR_DECK + 40 + i * 60} stroke="#0E1A20" strokeWidth={2} opacity={0.5} />
      ))}
      {/* Bank am hinteren Rand */}
      <rect x={WOMAN_X - 90} y={BENCH_Y} width={200} height={14} rx={4} fill="#C9D6D9" />
      <rect x={WOMAN_X - 80} y={BENCH_Y + 14} width={10} height={30} fill="#8AA0A6" />
      <rect x={WOMAN_X + 90} y={BENCH_Y + 14} width={10} height={30} fill="#8AA0A6" />
    </g>
  );
};

/** Der Hochsitz mit Rettungsring. */
const Chair: React.FC = () => (
  <g>
    <path d={`M ${CHAIR_X - 70} ${NEAR_DECK + 120} L ${CHAIR_X - 30} ${SEAT_Y + 10} M ${CHAIR_X + 70} ${NEAR_DECK + 120} L ${CHAIR_X + 30} ${SEAT_Y + 10}`} stroke="#E8EEF0" strokeWidth={14} strokeLinecap="round" />
    {[0.25, 0.5, 0.75].map((f, i) => {
      const y = SEAT_Y + 10 + (NEAR_DECK + 120 - SEAT_Y - 10) * f;
      const half = 30 + 40 * f;
      return <line key={i} x1={CHAIR_X - half} x2={CHAIR_X + half} y1={y} y2={y} stroke="#E8EEF0" strokeWidth={9} />;
    })}
    <rect x={CHAIR_X - 54} y={SEAT_Y} width={108} height={16} rx={5} fill="#F4F7F8" />
    <rect x={CHAIR_X - 56} y={SEAT_Y - 120} width={14} height={124} rx={5} fill="#F4F7F8" />
    <g transform={`translate(${CHAIR_X + 4} ${SEAT_Y + 120})`}>
      <circle r={40} fill="none" stroke="#E0453A" strokeWidth={18} />
      {[0, 90, 180, 270].map((a) => (
        <path key={a} d="M 31 0 L 49 0" transform={`rotate(${a + 45})`} stroke="#F4F4F4" strokeWidth={18} />
      ))}
    </g>
  </g>
);

const JAMES = { shirt: "#E0453A", skin: "#C99A78", legs: "#1E2A3A", hair: "#3A2A1E" };
const WOMAN = { shirt: "#2E7D8C", skin: "#E0B896", legs: "#2E7D8C", hair: "#5A3A26" };
const HELPER = { shirt: "#E0453A", skin: "#A87A5A", legs: "#1E2A3A", hair: "#1A1410" };

/** Ein leiser Gedanke: ein kleiner Lichtpunkt, der zweimal aufleuchtet. */
const ThoughtDot: React.FC<{ x: number; y: number; k: number; pulse: number }> = ({ x, y, k, pulse }) => {
  const frame = useCurrentFrame();
  if (k <= 0.01) return null;
  return (
    <g opacity={k}>
      <circle cx={x} cy={y} r={34 + 70 * pulse} fill="#FFF6DC" opacity={0.25 * (1 - pulse)} />
      <circle cx={x} cy={y} r={30} fill="url(#hpLamp)" opacity={0.8} />
      <circle cx={x} cy={y} r={8 + 1.5 * Math.sin(frame / 7)} fill="#FFF8E6" />
    </g>
  );
};

const PoolStage: React.FC<StageP> = ({ ts, s, t }) => {
  const frame = useCurrentFrame();
  const look = useLook();
  const [heute, thought] = s.lines;
  const heuteK = lineK(ts, t, heute) * (1 - fade(t, beat(ts, heute?.at, 0) + 1.6, 0.5));
  const [schwimmerAt, zweimalAt] = beats(ts, s.cues, 2);
  const thoughtAt = beat(ts, thought?.at, ts.speechEndSec - 1.6);
  const dot = fade(t, zweimalAt - 0.1, 0.4);
  const p1 = interpolate(t, [zweimalAt + 0.1, zweimalAt + 0.9], [0, 1], clamp);
  const p2 = interpolate(t, [thoughtAt - 0.2, thoughtAt + 0.6], [0, 1], clamp);
  const pulse = t < thoughtAt - 0.2 ? p1 : p2;
  const bubble = popAt(t, thoughtAt - 0.05, 0.45);
  const trail = ease(fade(t, thoughtAt + 0.2, 1.2));
  const buoy = fade(t, schwimmerAt, 0.5);
  const headX = CHAIR_X + 12;
  const headY = SEAT_Y - 128;
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <Pool />
        {/* Spot auf der Frau */}
        <ellipse cx={WOMAN_X} cy={BENCH_Y - 40} rx={140} ry={150} fill="#FFF6DC" opacity={0.12 * trail} />
        <Person x={WOMAN_X} y={BENCH_Y} k={0.62} dir={-1} sit {...WOMAN} bun />
        <Chair />
        <circle cx={CHAIR_X + 4} cy={SEAT_Y + 120} r={64} fill="#FF8A6A" opacity={0.25 * buoy * (1 - fade(t, schwimmerAt + 0.9, 0.6))} />
        <Person x={CHAIR_X - 6} y={SEAT_Y} k={1} sit {...JAMES} />
        {/* Der Gedanke wandert zur Frau */}
        {trail > 0.01 ? (
          <path
            d={`M ${headX + 40} ${headY - 30} Q 560 ${560} ${WOMAN_X - 30} ${BENCH_Y - 120}`}
            pathLength={1}
            strokeDasharray="0.012 0.02"
            strokeDashoffset={-frame * 0.002}
            fill="none"
            stroke="#FFF2CC"
            strokeWidth={6}
            strokeLinecap="round"
            opacity={0.85}
            style={{ clipPath: `inset(0 ${(1 - trail) * 100}% 0 0)` }}
          />
        ) : null}
        <ThoughtDot x={headX + 52} y={headY - 46} k={dot} pulse={pulse} />
      </svg>
      {heuteK > 0.01 ? (
        <div style={{ position: "absolute", top: 300, left: 0, right: 0, textAlign: "center", opacity: Math.min(1, heuteK * 1.4) }}>
          <span style={{ display: "inline-block", padding: "10px 46px", borderRadius: 14, background: look.accent, color: "#0A1A2A", fontFamily: look.display, fontSize: 96, letterSpacing: "0.12em", textTransform: "uppercase", transform: `scale(${interpolate(heuteK, [0, 1], [1.3, 1])})`, boxShadow: "0 18px 50px rgba(0,0,0,0.45)" }}>
            {heute?.text}
          </span>
        </div>
      ) : null}
      {bubble > 0.01 && thought ? (
        <div
          style={{
            position: "absolute",
            left: 330,
            right: 60,
            top: 420,
            padding: "26px 34px",
            borderRadius: 40,
            background: "rgba(255,250,236,0.95)",
            color: "#1A2A36",
            fontFamily: "Caveat",
            fontWeight: 700,
            fontSize: 64,
            lineHeight: 1.08,
            textAlign: "center",
            boxShadow: "0 18px 50px rgba(0,0,0,0.4)",
            opacity: Math.min(1, bubble * 1.4),
            transform: `scale(${interpolate(bubble, [0, 1], [0.6, 1])})`,
            transformOrigin: "10% 100%",
          }}
        >
          <Spoken ts={ts} text={thought.text} t={t} />
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

const ReportStage: React.FC<StageP> = ({ ts, s, t }) => {
  const frame = useCurrentFrame();
  const [zoegertAt, meldetAt, ohnmAt, gutAt] = beats(ts, s.cues, 4);
  const hesitate = fade(t, zoegertAt - 0.1, 0.3) * (1 - fade(t, meldetAt - 0.1, 0.3));
  const signal = fade(t, meldetAt - 0.1, 0.4);
  const ring = t > meldetAt ? wrap((t - meldetAt) / 0.9, 1) : 0;
  const slump = ease(fade(t, ohnmAt + 0.3, 1.0)) * (1 - ease(fade(t, gutAt - 0.1, 1.0)));
  const walkIn = ease(fade(t, meldetAt + 0.3, 1.6));
  const kneel = fade(t, meldetAt + 1.8, 0.3);
  const good = fade(t, gutAt, 0.8);
  const heart = popAt(t, gutAt + 0.3, 0.5);
  const helperX = interpolate(walkIn, [0, 1], [1160, WOMAN_X - 110]);
  const headX = CHAIR_X + 12;
  const headY = SEAT_Y - 128;
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <Pool />
        {good > 0 ? <ellipse cx={WOMAN_X - 30} cy={BENCH_Y - 50} rx={190} ry={150} fill="#FFD9A0" opacity={0.22 * good} /> : null}
        <Person x={WOMAN_X} y={BENCH_Y} k={0.62} dir={-1} sit lean={-62 * slump} towel={good} {...WOMAN} bun />
        {kneel > 0.5 ? (
          <Person x={WOMAN_X - 100} y={BENCH_Y + 24} k={0.62} kneel {...HELPER} />
        ) : walkIn > 0.01 ? (
          <Person x={helperX} y={BENCH_Y + 24} k={0.62} dir={-1} step={frame * 0.35} {...HELPER} />
        ) : null}
        <Chair />
        {signal > 0.01 ? (
          <g>
            {[0, 0.33, 0.66].map((o, i) => {
              const r = wrap(ring + o, 1);
              return <circle key={i} cx={headX + 40} cy={headY - 110} r={20 + r * 140} fill="none" stroke="#FFF2CC" strokeWidth={4} opacity={signal * (1 - r) * 0.7 * (1 - good)} />;
            })}
          </g>
        ) : null}
        <Person x={CHAIR_X - 6} y={SEAT_Y} k={1} sit armUp={signal} {...JAMES} />
        {/* Der Gedanke noch da – beim Zögern flackert er */}
        <ThoughtDot x={headX + 52} y={headY - 46} k={(1 - signal) * (0.6 + 0.4 * Math.abs(Math.sin(frame / 5)) * hesitate + 0.4 * (1 - hesitate))} pulse={0} />
        {heart > 0.01 ? (
          <g transform={`translate(${WOMAN_X - 20} ${BENCH_Y - 190 - heart * 30}) scale(${heart * 1.3})`} opacity={Math.min(1, heart * 1.4)}>
            <path d="M 0 18 C -30 -2, -30 -30, -12 -32 C -4 -33, 0 -26, 0 -20 C 0 -26, 4 -33, 12 -32 C 30 -30, 30 -2, 0 18 Z" fill="#FF7A6A" stroke="#FFF2E6" strokeWidth={3} />
          </g>
        ) : null}
      </svg>
      <Sfx frame={voiceFrame(ts, gutAt)} name="warm" volume={0.45} keep />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* Schluss                                                             */
/* ------------------------------------------------------------------ */

const EndStage: React.FC<StageP> = ({ ts, s, t }) => {
  const look = useLook();
  const [quote, donner, frage] = s.lines;
  const qK = fade(t, beat(ts, quote?.at, 1) - 0.25, 0.5);
  const dK = popAt(t, beat(ts, donner?.at, 3), 0.45);
  const fK = popAt(t, beat(ts, frage?.at, 5), 0.5);
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <g opacity={0.9}>
          <Mountain crack={1} light={0.5}>
            <Elija x={ELIJA_X + 120} y={LEDGE} k={0.66} pose={{ hold: 1, bow: 0.45 }} veil={1} />
          </Mountain>
        </g>
        <Breath k={0.6} />
      </svg>
      {quote ? (
        <div style={{ position: "absolute", left: 90, right: 90, top: 300, textAlign: "center", opacity: qK, transform: `translateY(${(1 - qK) * 16}px)` }}>
          <div style={{ fontFamily: "Cormorant Garamond", fontStyle: "italic", fontWeight: 600, fontSize: 76, lineHeight: 1.1, color: "#F4F7FF", textShadow: "0 0 30px rgba(159,216,255,0.45), 0 6px 24px rgba(0,0,0,0.8)" }}>
            «<Spoken ts={ts} text={quote.text} t={t} />»
          </div>
          {quote.by ? <div style={{ marginTop: 18, fontFamily: look.label, fontWeight: 800, fontSize: 30, letterSpacing: "0.22em", color: look.accent, textTransform: "uppercase" }}>– {quote.by}</div> : null}
        </div>
      ) : null}
      {donner && dK > 0.01 ? (
        <div style={{ position: "absolute", left: 60, right: 60, top: 590, textAlign: "center", fontFamily: look.display, fontSize: 62, textTransform: "uppercase", letterSpacing: "0.02em", color: look.dim, textShadow: look.glow, opacity: Math.min(1, dK * 1.4), transform: `scale(${interpolate(dK, [0, 1], [1.2, 1])})` }}>
          {donner.text}
        </div>
      ) : null}
      {frage && fK > 0.01 ? (
        <div style={{ position: "absolute", left: 60, right: 60, top: 700, textAlign: "center", fontFamily: look.display, fontSize: 112, lineHeight: 1.02, textTransform: "uppercase", color: look.accent, textShadow: look.glow, opacity: Math.min(1, fK * 1.4), transform: `scale(${interpolate(fK, [0, 1], [1.3, 1])})` }}>
          {frage.text}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* Szene                                                               */
/* ------------------------------------------------------------------ */

export const Scene: React.FC<{ ts: TimelineScene }> = ({ ts }) => {
  const s = ts.scene as HorebT;
  const t = useT(ts);
  const p = { ts, s, t };
  switch (s.stage) {
    case "hook":
      return <HookStage {...p} />;
    case "broom":
      return <BroomStage {...p} />;
    case "angel":
      return <AngelStage {...p} />;
    case "cave":
      return <CaveStage {...p} />;
    case "wind":
      return <WindStage {...p} />;
    case "quakefire":
      return <QuakeFireStage {...p} />;
    case "whisper":
      return <WhisperStage {...p} />;
    case "pool":
      return <PoolStage {...p} />;
    case "report":
      return <ReportStage {...p} />;
    case "end":
      return <EndStage {...p} />;
    default:
      return null;
  }
};

/** Was gross im Bild steht, wird nicht noch einmal untertitelt – im Einstieg auch das «Ein» davor. */
export const hidden = (ts: TimelineScene): Set<number> => {
  const s = ts.scene as HorebT;
  return wordsOfTexts(
    ts,
    s.lines.flatMap((l) => (s.stage === "hook" ? [l.text, l.at] : [l.text])),
  );
};
