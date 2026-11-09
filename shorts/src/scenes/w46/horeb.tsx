import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, random, useCurrentFrame } from "remotion";
import { useLook } from "../../looks";
import { Sfx, beat, beats, voiceFrame } from "../../lib/sfx";
import { type TimelineScene, findCue } from "../../lib/timing";
import type { Scene as SceneData } from "../../schema";
import { Motes, Robed, clamp, useT, wordsOfTexts } from "../w45/kitA";

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

const ROBE = "#241B15";
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
    // Am fernen Hang des Gottesbergs, klein
    for (let i = 0; i < 12; i++) {
      const f = random(`hff${i}`);
      out.push({ x: 600 + f * 460, y: 1110 - Math.sin(f * Math.PI) * 150 + random(`hfy${i}`) * 40, h: 40 + random(`hfh${i}`) * 70, w: 14 + random(`hfw${i}`) * 14, ph: random(`hfp${i}`) * 6, d: 0.15 + f * 0.3 });
    }
    // Vorn auf dem Felsvorsprung, rechts der Höhle – unterschiedlich gross, ineinander
    for (let i = 0; i < 13; i++) {
      const big = random(`hgb${i}`);
      out.push({ x: 540 + random(`hgx${i}`) * 500, y: LEDGE + 4 + random(`hgy${i}`) * 8, h: 70 + big * big * 260, w: 26 + big * 40, ph: random(`hgp${i}`) * 6, d: random(`hgd${i}`) * 0.4 });
    }
    out.sort((a, b) => b.h - a.h);
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
        const y0 = 700 + i * 80;
        const shift = wrap(frame * (1.6 + i * 0.25) + i * 230, 1500) - 400;
        const pts: string[] = [];
        for (let s = 0; s <= 24; s++) {
          const x = 1180 - s * 34 - shift;
          pts.push(`${x.toFixed(1)} ${(y0 + Math.sin(s / 3 + frame / 30 + i) * (14 + i * 3)).toFixed(1)}`);
        }
        return <path key={i} d={`M ${pts.join(" L ")}`} fill="none" stroke="url(#hbBreath)" strokeWidth={3.5 + (i % 3) * 1.5} strokeLinecap="round" opacity={0.5 + 0.3 * Math.sin(frame / 20 + i)} />;
      })}
    </g>
  );
};

/* ------------------------------------------------------------------ */
/* Der Berg: Fels mit Höhle und Vorsprung                              */
/* ------------------------------------------------------------------ */

const CLIFF = "M -40 1190 L -40 500 L 40 478 L 110 506 L 180 488 L 240 530 L 310 540 L 360 600 L 395 680 L 415 780 L 430 900 L 440 1020 L 452 1120 L 470 1190 Z";
const CLIFF_RIM = "M 40 478 L 110 506 L 180 488 L 240 530 L 310 540 L 360 600 L 395 680 L 415 780 L 430 900";
/** Der Felsvorsprung vor der Höhle – darunter fällt der Berg steil ab */
const PLATFORM =
  "M -40 1176 C 200 1170, 420 1184, 620 1176 C 760 1171, 900 1180, 1010 1184 L 1032 1198 L 990 1224 L 930 1232 L 862 1254 L 760 1246 L 680 1268 L 560 1262 L 470 1292 L 420 1362 L 384 1500 L 336 1700 L 300 1940 L -40 1940 Z";
const PLATFORM_TOP = "M -40 1176 C 200 1170, 420 1184, 620 1176 C 760 1171, 900 1180, 1010 1184 L 1032 1198";
const CAVE = `M ${CAVE_X - 122} ${LEDGE} L ${CAVE_X - 122} 1030 C ${CAVE_X - 122} 920, ${CAVE_X - 40} 868, ${CAVE_X} 868 C ${CAVE_X + 52} 868, ${CAVE_X + 124} 914, ${CAVE_X + 124} 1030 L ${CAVE_X + 124} ${LEDGE} Z`;
/** Risse im Fels – sie wachsen beim Beben */
const CRACKS = [
  "M 520 1178 L 546 1214 L 530 1262",
  "M 760 1176 L 742 1208 L 770 1244",
  "M 930 1180 L 956 1208 L 940 1230",
  "M 300 560 L 280 640 L 320 700 L 300 790",
  "M 120 520 L 150 600 L 120 690 L 160 760 L 140 860",
  "M 360 1300 L 330 1400 L 352 1480 L 318 1600",
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

/** Tief unter dem Vorsprung: ein Tal im Nebel, ferne Kämme. */
const Abyss: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <g>
      <defs>
        <linearGradient id="hbAbyss" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1E2848" />
          <stop offset="55%" stopColor="#0E1328" />
          <stop offset="100%" stopColor="#05060E" />
        </linearGradient>
      </defs>
      <rect x={0} y={1150} width={1080} height={790} fill="url(#hbAbyss)" />
      <path d="M 300 1500 L 420 1440 L 520 1470 L 640 1400 L 760 1450 L 880 1410 L 1000 1460 L 1100 1430 L 1100 1940 L 300 1940 Z" fill="#141B34" />
      <path d="M 300 1660 L 460 1600 L 600 1640 L 740 1580 L 900 1630 L 1100 1590 L 1100 1940 L 300 1940 Z" fill="#0D1226" />
      {[1320, 1520, 1700].map((y, i) => (
        <ellipse key={i} cx={wrap(700 + i * 260 - frame * (0.5 + i * 0.2), 1400) - 160} cy={y} rx={420} ry={44} fill="#9FB4E8" opacity={0.07} />
      ))}
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
          <stop offset="0%" stopColor="#2C3248" />
          <stop offset="100%" stopColor="#0A0B14" />
        </radialGradient>
        <radialGradient id="hbCaveLight" cx="0.5" cy="0.8" r="0.6">
          <stop offset="0%" stopColor="#FFF2D2" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#FFF2D2" stopOpacity="0" />
        </radialGradient>
      </defs>
      <Abyss />
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
      <path d={PLATFORM_TOP} fill="none" stroke={rim} strokeWidth={3} opacity={0.5} />
      {[1330, 1460, 1600, 1760].map((y, i) => (
        <path key={i} d={`M -40 ${y} C 80 ${y - 16}, 220 ${y + 10}, ${400 - i * 22} ${y - 8}`} stroke="#1A2034" strokeWidth={3} fill="none" opacity={0.8} />
      ))}
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

/** Ein Ginsterstrauch: ein Busch aus vielen Ruten mit kleinen hellen Blüten, im Mondlicht. */
const Broom: React.FC<{ x: number; y: number; s?: number; rustle?: number }> = ({ x, y, s = 1, rustle = 0 }) => {
  const frame = useCurrentFrame();
  const parts = useMemo(() => {
    const branches = Array.from({ length: 9 }, (_, i) => {
      const a = -1.15 + i * 0.29 + (random(`hba${i}`) - 0.5) * 0.12;
      const len = 210 + random(`hbl${i}`) * 110 - Math.abs(a) * 40;
      return { a, len };
    });
    const twigs = branches.flatMap((b, i) =>
      Array.from({ length: 7 }, (_, j) => {
        const f = 0.35 + j * 0.11;
        const da = (j % 2 ? 1 : -1) * (0.25 + random(`hbt${i}-${j}`) * 0.35);
        return { b: i, f, a: b.a + da, len: 60 + random(`hbn${i}-${j}`) * 70 };
      }),
    );
    return { branches, twigs };
  }, []);
  const sway = Math.sin(frame / 34) * 0.02 + rustle * Math.sin(frame / 2.5) * 0.04;
  const tip = (a: number, len: number): [number, number] => [Math.sin(a + sway) * len, -Math.cos(a + sway) * len * 0.92];
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx={0} cy={4} rx={190} ry={14} fill="#000" opacity={0.3} />
      {/* Die Krone als dunkle Masse */}
      {[[-110, -170, 120, 90], [0, -230, 150, 100], [110, -170, 120, 90], [-40, -120, 120, 70], [60, -120, 120, 70]].map(([cx, cy, rx, ry], i) => (
        <ellipse key={i} cx={cx} cy={cy} rx={rx} ry={ry} fill="#141C18" opacity={0.75} />
      ))}
      {parts.branches.map((b, i) => {
        const [tx, ty] = tip(b.a, b.len);
        return <path key={i} d={`M ${i * 3 - 12} 0 Q ${tx * 0.25} ${ty * 0.55} ${tx} ${ty}`} stroke="#1C2620" strokeWidth={7} fill="none" strokeLinecap="round" />;
      })}
      {parts.twigs.map((tw, i) => {
        const b = parts.branches[tw.b];
        const [bx, by] = tip(b.a, b.len * tw.f);
        const [dx, dy] = tip(tw.a, tw.len);
        const ex = bx + dx;
        const ey = by + dy;
        const lit = ex < 0;
        return (
          <g key={i}>
            <path d={`M ${bx} ${by} q ${dx * 0.4} ${dy * 0.7} ${dx} ${dy}`} stroke={lit ? "#35473A" : "#1E2A22"} strokeWidth={3.5} fill="none" strokeLinecap="round" />
            <circle cx={ex} cy={ey} r={3.6} fill="#ECE8D0" opacity={lit ? 0.85 : 0.45} />
            <circle cx={bx + dx * 0.6} cy={by + dy * 0.6} r={2.8} fill="#ECE8D0" opacity={lit ? 0.6 : 0.3} />
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
  const hx = 34 + bow * 22;
  const hy = -206 + bow * 34;
  return (
    <g>
      {/* Rücken und Gesäss */}
      <path d="M -70 0 C -88 -52, -84 -122, -50 -160 C -32 -178, -4 -182, 14 -172 C 26 -150, 22 -100, 12 -60 L 34 0 Z" fill={fill} />
      {/* Oberschenkel zum Knie, Schienbein zum Fuss */}
      <path d="M -8 -18 L 74 -116 L 108 -6" stroke={fill} strokeWidth={48} strokeLinejoin="round" strokeLinecap="round" fill="none" />
      {/* Kopf mit Tuch */}
      <path d={`M 2 -168 L ${hx - 4} ${hy + 14}`} stroke={fill} strokeWidth={26} strokeLinecap="round" />
      <circle cx={hx} cy={hy} r={25} fill={fill} />
      <path d={`M ${hx - 31} ${hy + 6} C ${hx - 33} ${hy - 38}, ${hx + 27} ${hy - 42}, ${hx + 30} ${hy - 2} L ${hx + 14} ${hy + 18} L ${hx - 44} ${hy + 46} Z`} fill={fill} />
      {/* Arm um die Knie */}
      <path d="M -26 -150 C 8 -126, 48 -110, 92 -104" stroke={fill} strokeWidth={21} strokeLinecap="round" fill="none" />
      <ellipse cx={118} cy={-6} rx={22} ry={8} fill={fill} />
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

/** Elija schlafend auf der Seite, den Kopf links auf dem Arm, den Mantel über sich. Ursprung unter der Körpermitte. */
const LieShape: React.FC<{ c: Tones; flat?: string }> = ({ c, flat }) => {
  const col = (x: string) => flat ?? x;
  return (
    <g>
      <ellipse cx={150} cy={-8} rx={20} ry={9} fill={col(c.hair)} />
      <path d="M -116 0 C -126 -30, -100 -54, -60 -58 C 0 -64, 84 -54, 132 -34 C 160 -22, 158 0, 140 0 Z" fill={col(c.robe)} />
      <path d="M -92 -50 C -30 -72, 60 -64, 124 -38 C 96 -18, 10 -12, -84 -16 Z" fill={col(c.mantle)} />
      <path d="M -104 -40 L -150 -8" stroke={col(c.robe)} strokeWidth={20} strokeLinecap="round" />
      <circle cx={-146} cy={-40} r={23} fill={col(c.skin)} />
      <path d="M -170 -36 C -176 -66, -132 -74, -124 -52 C -136 -56, -150 -52, -156 -40 C -160 -28, -166 -24, -170 -36 Z" fill={col(c.hair)} />
      <path d="M -150 -22 C -144 -18, -130 -20, -124 -28 C -116 -14, -122 2, -136 6 C -146 2, -152 -10, -150 -22 Z" fill={col(c.hair)} />
    </g>
  );
};

const Lying: React.FC<{ x: number; y: number; k?: number; o?: number; breathe: number }> = ({ x, y, k = 1, o = 1, breathe }) => {
  const c = toned(0.45);
  return (
    <g transform={`translate(${x} ${y}) scale(${k} ${k * (1 + 0.015 * breathe)})`} opacity={o}>
      <ellipse cx={0} cy={4} rx={170} ry={12} fill="#000" opacity={0.35} />
      <g transform="translate(-4 -4)">
        <LieShape c={c} flat={MOON_RIM} />
      </g>
      <LieShape c={c} />
    </g>
  );
};

type ProphetPose = {
  /** Schrittphase (Bogenmass); ohne Angabe steht er */
  step?: number;
  /** Unterarm vor dem Gesicht – Schutz vor Sturm und Feuer, 0 … 1 */
  shield?: number;
  /** Den Mantel über Kopf und Gesicht gezogen, 0 … 1 */
  veil?: number;
  /** Kopf gesenkt, 0 … 1 */
  bow?: number;
};

type Tones = { robe: string; mantle: string; skin: string; hair: string; belt: string; staff: string };
const NIGHT = "#0B0E1C";
const toned = (light: number): Tones => ({
  robe: mix("#5A4432", NIGHT, 0.62 - 0.3 * light),
  mantle: mix("#7A6248", NIGHT, 0.6 - 0.3 * light),
  skin: mix("#9A7258", NIGHT, 0.6 - 0.3 * light),
  hair: mix("#2A2018", NIGHT, 0.3),
  belt: mix("#3A2614", NIGHT, 0.4),
  staff: mix("#6A4A2A", NIGHT, 0.5 - 0.2 * light),
});

/** Elija von der Seite, Blick nach rechts: Gewand mit Ledergürtel, Mantel, Bart, Stab. Ursprung zwischen den Füssen, gut 300 hoch. */
const ProphetShape: React.FC<{ c: Tones; pose: ProphetPose; flat?: string }> = ({ c, pose, flat }) => {
  const { step, shield = 0, veil = 0, bow = 0 } = pose;
  const col = (x: string) => flat ?? x;
  const walking = step !== undefined;
  const sw = walking ? Math.sin(step) : 0;
  const bob = walking ? -Math.abs(Math.sin(step)) * 5 : 0;
  const hx = 10 + bow * 12;
  const hy = -266 + bow * 12 + bob;
  // Vorderer Arm: am Stab, vor dem Gesicht oder den Mantel haltend
  const guard = Math.max(shield, veil);
  const elbow: [number, number] = [26 + 18 * guard, -186 - 20 * guard + bob];
  const hand: [number, number] = [44 - 6 * guard + 10 * veil, -150 - 108 * guard + 26 * veil + bob];
  const staffOn = 1 - guard;
  const staffX = hand[0] + 6 + sw * 4;
  return (
    <g>
      {/* hinterer Arm */}
      <path d={`M -16 ${-222 + bob} L ${-24 - sw * 10} ${-170 + bob} L ${-20 - sw * 16} ${-128 + bob}`} stroke={col(c.robe)} strokeWidth={19} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Füsse */}
      <ellipse cx={-10 + sw * 22} cy={-5} rx={17} ry={7} fill={col(c.hair)} />
      <ellipse cx={14 - sw * 22} cy={-5} rx={17} ry={7} fill={col(c.hair)} />
      {/* Mantel hinten */}
      <path d={`M -28 ${-236 + bob} C -58 -196, -68 -120, ${-62 + sw * 4} -46 L -38 -56 C -32 -130, -18 -196, 6 ${-240 + bob} Z`} fill={col(c.mantle)} />
      {/* Gewand */}
      <path d={`M -30 ${-234 + bob} C -40 -170, -48 -90, ${-50 + sw * 6} -10 L ${50 + sw * 6} -10 C 44 -90, 40 -170, 30 ${-234 + bob} Q 0 ${-248 + bob} -30 ${-234 + bob} Z`} fill={col(c.robe)} />
      {/* Ledergürtel */}
      <path d={`M -42 ${-150 + bob} L 42 ${-150 + bob} L 43 ${-138 + bob} L -43 ${-138 + bob} Z`} fill={col(c.belt)} />
      {/* Mantel über den Schultern */}
      <path d={`M -32 ${-234 + bob} Q 0 ${-252 + bob} 32 ${-232 + bob} L 26 ${-198 + bob} Q -4 ${-212 + bob} -34 ${-204 + bob} Z`} fill={col(c.mantle)} />
      {/* Kopf: Haar, Gesicht, Bart */}
      <rect x={hx - 9} y={hy + 14} width={18} height={20} fill={col(c.skin)} />
      <circle cx={hx} cy={hy} r={23} fill={col(c.skin)} />
      <path d={`M ${hx - 24} ${hy + 4} C ${hx - 28} ${hy - 30}, ${hx + 16} ${hy - 36}, ${hx + 22} ${hy - 12} C ${hx + 8} ${hy - 18}, ${hx - 4} ${hy - 10}, ${hx - 8} ${hy + 4} C ${hx - 10} ${hy + 18}, ${hx - 18} ${hy + 22}, ${hx - 24} ${hy + 4} Z`} fill={col(c.hair)} />
      <path d={`M ${hx - 4} ${hy + 8} C ${hx + 8} ${hy + 12}, ${hx + 22} ${hy + 8}, ${hx + 24} ${hy + 2} C ${hx + 28} ${hy + 24}, ${hx + 20} ${hy + 46}, ${hx + 4} ${hy + 50} C ${hx - 6} ${hy + 40}, ${hx - 8} ${hy + 24}, ${hx - 4} ${hy + 8} Z`} fill={col(c.hair)} />
      {/* Stab */}
      {staffOn > 0.02 ? <line x1={staffX + 6} y1={-318 + bob} x2={staffX + 16 + sw * 8} y2={-4} stroke={col(c.staff)} strokeWidth={8} strokeLinecap="round" opacity={staffOn} /> : null}
      {/* Mantel über Kopf und Gesicht */}
      {veil > 0.01 ? (
        <path
          d={`M ${hx - 30} ${hy + 14} C ${hx - 36} ${hy - 34}, ${hx + 26} ${hy - 46}, ${hx + 28 + 6 * veil} ${hy - 6} C ${hx + 34 + 6 * veil} ${hy + 22}, ${hx + 30} ${hy + 50}, 24 ${-200 + bob} L -34 ${-206 + bob} C -40 ${-226 + bob}, ${hx - 34} ${hy + 30}, ${hx - 30} ${hy + 14} Z`}
          fill={col(c.mantle)}
          opacity={Math.min(1, veil * 1.3)}
        />
      ) : null}
      {/* vorderer Arm */}
      <path d={`M 18 ${-222 + bob} L ${elbow[0]} ${elbow[1]} L ${hand[0]} ${hand[1]}`} stroke={col(c.robe)} strokeWidth={20} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx={hand[0]} cy={hand[1]} r={9} fill={col(c.skin)} />
    </g>
  );
};

/** Elija stehend oder gehend; mit `flap` weht der Mantel im Sturm. `light` hellt die Farben auf (Feuer, Morgen). */
const Elija: React.FC<{ x: number; y: number; k: number; pose?: ProphetPose; rim?: string; light?: number; flap?: number; o?: number; dir?: 1 | -1 }> = ({ x, y, k, pose = {}, rim = MOON_RIM, light = 0.3, flap = 0, o = 1, dir = 1 }) => {
  const frame = useCurrentFrame();
  const c = toned(light);
  const wave = Math.sin(frame / 2.2) * 18 * flap;
  return (
    <g transform={`translate(${x} ${y}) scale(${dir * k} ${k})`} opacity={o}>
      <ellipse cx={0} cy={3} rx={70} ry={9} fill="#000" opacity={0.35} />
      {flap > 0.01 ? (
        <path d={`M -24 -236 C ${-90 - 40 * flap} ${-230 + wave}, ${-150 - 60 * flap} ${-200 - wave}, ${-180 - 70 * flap} ${-150 + wave} C ${-130 - 40 * flap} ${-150 - wave * 0.5}, -70 -170, -30 -160 Z`} fill={c.mantle} />
      ) : null}
      <g transform="translate(-4 -2)">
        <ProphetShape c={c} pose={pose} flat={rim} />
      </g>
      <ProphetShape c={c} pose={pose} />
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
            <Elija x={ELIJA_X} y={LEDGE} k={0.72} pose={{ shield: 0.8 * calm, bow: 0.3 }} rim={mix(MOON_RIM, FIRE_RIM, fire)} />
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
        <Headline key={i} text={l.text} k={i === 0 ? popAt(t, -0.38) : lineK(ts, t, l)} y={340 + i * 128} x={600} size={118} color={i === 2 && fire > 0.3 ? "#FFC27A" : look.text} dim={dimAll} strike={fade(t, stillAt + 0.2 + i * 0.15, 0.4)} />
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
  // Der Weg durch die Wüste bis zum Gottesberg: 40 Punkte, einer je Tag
  const routePts = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => {
        const f = i / 39;
        return { x: 70 + f * 900, y: SAND + 40 + Math.sin(f * 5.2) * 10 };
      }),
    [],
  );
  const lit = Math.round(route * 40);
  const walkerX = 90 + route * 700;
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <Desert />
        {sleepO > 0.01 ? (
          <g opacity={sleepO}>
            <Broom x={330} y={SAND} s={0.95} />
            <Lying x={560} y={SAND + 2} k={1} breathe={Math.sin(frame / 18)} />
            {/* Berührung */}
            {touch > 0 ? <circle cx={530} cy={SAND - 50} r={20 + 50 * touch} fill="#FFF6DC" opacity={0.3 * touch * (1 - fade(t, engelAt + 1.2, 0.6))} /> : null}
            <Angel x={790} y={SAND} k={0.95} o={angel} reach={touch} />
            {/* Brot auf glühenden Steinen, ein Krug Wasser */}
            {food > 0.01 ? (
              <g transform={`translate(296 ${SAND - 6}) scale(${food})`}>
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
            <Elija x={walkerX} y={SAND + 4} k={0.8} pose={{ step: frame * 0.32, bow: 0.1 }} light={0.5} />
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
            <stop offset="0%" stopColor="#CFDBFF" stopOpacity="0.3" />
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
          <path d="M 300 1150 L 820 1150 L 980 1460 L 140 1460 Z" fill="url(#hbMoonBeam)" />
          {[[120, 1250, 70], [880, 1300, 90], [980, 1180, 50], [60, 1400, 110], [700, 1520, 60]].map(([x, y, r], i) => (
            <g key={i}>
              <ellipse cx={x} cy={y} rx={r} ry={r * 0.45} fill="#120F18" />
              <path d={`M ${x - r * 0.8} ${y - r * 0.2} C ${x - r * 0.4} ${y - r * 0.5}, ${x + r * 0.4} ${y - r * 0.5}, ${x + r * 0.8} ${y - r * 0.2}`} stroke={MOON_RIM} strokeWidth={2} fill="none" opacity={0.3} />
            </g>
          ))}
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
          <Elija x={ELIJA_X} y={LEDGE} k={0.72} pose={{ shield: 0.3 + 0.6 * stand, bow: 0.2 + 0.25 * stand }} flap={storm * 0.8} />
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
            <Elija x={ELIJA_X} y={LEDGE} k={0.72} pose={{ shield: 0.9, bow: 0.35 }} rim={mix(MOON_RIM, FIRE_RIM, fire)} light={0.3 + 0.4 * fire} />
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
  const zoom = 1.15 + 0.4 * ease(interpolate(frame, [0, ts.durationInFrames], [0, 1], clamp));
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <rect width={1080} height={1920} fill="#BFD6FF" opacity={0.05 * breath} />
        <g transform={`translate(400 1060) scale(${zoom}) translate(-360 -1060)`}>
          <Mountain crack={1} light={breath * 0.65}>
            <Elija x={ELIJA_X + out * 110} y={LEDGE} k={0.72} pose={{ veil, bow: 0.15 + 0.2 * veil, step: out > 0 && out < 1 ? frame * 0.3 : undefined }} light={0.3 + 0.3 * breath} />
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

/** Hinterer Beckenrand (Oberkante) und Wasser */
const FAR_DECK = 600;
const WATER_TOP = 690;
const NEAR_DECK = 1190;
const CHAIR_X = 200;
const SEAT_Y = 900;
/** James sitzt so gross im Bild */
const JK = 1.5;
const WOMAN_X = 830;
const BENCH_Y = 604;
/** Die Frau und die Helferin am hinteren Rand */
const WK = 1.05;

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
      {Array.from({ length: 6 }, (_, i) => (
        <line key={`h${i}`} x1={0} x2={1080} y1={540 + i * 11} y2={540 + i * 11} stroke="#1E5868" strokeWidth={1} opacity={0.5} />
      ))}
      {/* Fenster mit Nachthimmel */}
      {[70, 330, 590, 850].map((x, i) => (
        <g key={i}>
          <rect x={x} y={290} width={180} height={230} fill="url(#hpWin)" />
          {stars.map((st, k) =>
            k % 4 === i ? <circle key={k} cx={x + 10 + st.x * 160} cy={300 + st.y * 210} r={st.r} fill="#EEF3FF" opacity={0.6} /> : null,
          )}
          <rect x={x} y={290} width={180} height={230} fill="none" stroke="#7FA0AA" strokeWidth={6} />
          <line x1={x + 90} x2={x + 90} y1={290} y2={520} stroke="#7FA0AA" strokeWidth={4} />
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
      <rect x={0} y={FAR_DECK} width={1080} height={WATER_TOP - FAR_DECK} fill="#9CB6BC" />
      {Array.from({ length: 18 }, (_, i) => (
        <line key={i} x1={i * 64} x2={i * 64 - 14} y1={FAR_DECK} y2={WATER_TOP} stroke="#7F9AA2" strokeWidth={2} />
      ))}
      <rect x={0} y={WATER_TOP - 8} width={1080} height={8} fill="#5E7E88" />
      {/* Wasser */}
      <rect x={0} y={WATER_TOP} width={1080} height={NEAR_DECK - WATER_TOP} fill="url(#hpWater)" />
      {Array.from({ length: 15 }, (_, i) => {
        const y = WATER_TOP + 20 + i * 32;
        const pts: string[] = [];
        for (let s = 0; s <= 30; s++) pts.push(`${s * 38} ${(y + Math.sin(s * 0.9 + frame / 14 + i * 1.7) * (4 + i * 0.6)).toFixed(1)}`);
        return <path key={i} d={`M ${pts.join(" L ")}`} stroke="#B9F0FF" strokeWidth={2 + i * 0.15} fill="none" opacity={0.18 + 0.05 * Math.sin(frame / 20 + i)} />;
      })}
      {/* Leinen */}
      {[780, 920, 1110].map((y, li) => {
        const r = 8 + li * 4;
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
      <rect x={WOMAN_X - 120} y={BENCH_Y} width={290} height={16} rx={5} fill="#D6E2E4" />
      <rect x={WOMAN_X - 108} y={BENCH_Y + 16} width={12} height={FAR_DECK + 76 - BENCH_Y - 16} fill="#8AA0A6" />
      <rect x={WOMAN_X + 146} y={BENCH_Y + 16} width={12} height={FAR_DECK + 76 - BENCH_Y - 16} fill="#8AA0A6" />
    </g>
  );
};

/** Der Hochsitz mit Rettungsring. */
const Chair: React.FC = () => {
  const foot = NEAR_DECK + 34;
  return (
    <g>
      <path d={`M ${CHAIR_X - 96} ${foot} L ${CHAIR_X - 40} ${SEAT_Y + 14} M ${CHAIR_X + 96} ${foot} L ${CHAIR_X + 40} ${SEAT_Y + 14}`} stroke="#E8EEF0" strokeWidth={18} strokeLinecap="round" />
      {[0.22, 0.44, 0.66, 0.88].map((f, i) => {
        const y = SEAT_Y + 14 + (foot - SEAT_Y - 14) * f;
        const half = 40 + 56 * f;
        return <line key={i} x1={CHAIR_X - half} x2={CHAIR_X + half} y1={y} y2={y} stroke="#E8EEF0" strokeWidth={11} />;
      })}
      <rect x={CHAIR_X - 74} y={SEAT_Y} width={150} height={20} rx={6} fill="#F4F7F8" />
      <rect x={CHAIR_X - 78} y={SEAT_Y - 170} width={18} height={176} rx={6} fill="#F4F7F8" />
      <g transform={`translate(${CHAIR_X + 4} ${SEAT_Y + 170})`}>
        <circle r={52} fill="none" stroke="#E0453A" strokeWidth={22} />
        {[0, 90, 180, 270].map((a) => (
          <path key={a} d="M 41 0 L 63 0" transform={`rotate(${a + 45})`} stroke="#F4F4F4" strokeWidth={22} />
        ))}
      </g>
    </g>
  );
};

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
  const headX = CHAIR_X - 10 + 8 * JK;
  const headY = SEAT_Y - 128 * JK;
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <Pool />
        {/* Spot auf der Frau */}
        <ellipse cx={WOMAN_X} cy={BENCH_Y - 60} rx={190} ry={200} fill="#FFF6DC" opacity={0.14 * trail} />
        <Person x={WOMAN_X} y={BENCH_Y} k={WK} dir={-1} sit {...WOMAN} bun />
        <Chair />
        <circle cx={CHAIR_X + 4} cy={SEAT_Y + 170} r={84} fill="#FF8A6A" opacity={0.25 * buoy * (1 - fade(t, schwimmerAt + 0.9, 0.6))} />
        <Person x={CHAIR_X - 10} y={SEAT_Y} k={JK} sit {...JAMES} />
        {/* Der Gedanke wandert zur Frau */}
        {trail > 0.01 ? (
          <path
            d={`M ${headX + 90} ${headY - 70} Q 560 ${330} ${WOMAN_X - 20} ${BENCH_Y - 190}`}
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
        <ThoughtDot x={headX + 80} y={headY - 64} k={dot} pulse={pulse} />
      </svg>
      {heuteK > 0.01 ? (
        <div style={{ position: "absolute", top: 330, left: 0, right: 0, textAlign: "center", opacity: Math.min(1, heuteK * 1.4) }}>
          <span style={{ display: "inline-block", padding: "10px 46px", borderRadius: 14, background: look.accent, color: "#0A1A2A", fontFamily: look.display, fontSize: 96, letterSpacing: "0.12em", textTransform: "uppercase", transform: `scale(${interpolate(heuteK, [0, 1], [1.3, 1])})`, boxShadow: "0 18px 50px rgba(0,0,0,0.45)" }}>
            {heute?.text}
          </span>
        </div>
      ) : null}
      {bubble > 0.01 && thought ? (
        <div
          style={{
            position: "absolute",
            left: 360,
            right: 50,
            top: 250,
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
  const slump = ease(fade(t, ohnmAt - 0.1, 0.6)) * (1 - ease(fade(t, gutAt + 0.2, 0.9)));
  const walkIn = ease(fade(t, meldetAt + 0.2, Math.max(0.8, ohnmAt - meldetAt - 0.4)));
  const kneel = fade(t, ohnmAt - 0.15, 0.3);
  const good = fade(t, gutAt, 0.8);
  const heart = popAt(t, gutAt + 0.3, 0.5);
  const helperX = interpolate(walkIn, [0, 1], [1180, WOMAN_X - 150]);
  const headX = CHAIR_X - 10 + 8 * JK;
  const headY = SEAT_Y - 128 * JK;
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <Pool />
        {good > 0 ? <ellipse cx={WOMAN_X - 60} cy={BENCH_Y - 70} rx={240} ry={190} fill="#FFD9A0" opacity={0.22 * good} /> : null}
        <Person x={WOMAN_X} y={BENCH_Y} k={WK} dir={-1} sit lean={-62 * slump} towel={good} {...WOMAN} bun />
        {kneel > 0.5 ? (
          <Person x={WOMAN_X - 150} y={FAR_DECK + 52} k={WK} kneel {...HELPER} />
        ) : walkIn > 0.01 ? (
          <Person x={helperX} y={FAR_DECK + 52} k={WK} dir={-1} step={frame * 0.35} {...HELPER} />
        ) : null}
        <Chair />
        {signal > 0.01 ? (
          <g>
            {[0, 0.33, 0.66].map((o, i) => {
              const r = wrap(ring + o, 1);
              return <circle key={i} cx={headX + 40} cy={headY - 150} r={20 + r * 170} fill="none" stroke="#FFF2CC" strokeWidth={4} opacity={signal * (1 - r) * 0.7 * (1 - good)} />;
            })}
          </g>
        ) : null}
        <Person x={CHAIR_X - 10} y={SEAT_Y} k={JK} sit armUp={signal} {...JAMES} />
        {/* Der Gedanke noch da – beim Zögern flackert er */}
        <ThoughtDot x={headX + 80} y={headY - 64} k={(1 - signal) * (0.6 + 0.4 * Math.abs(Math.sin(frame / 5)) * hesitate + 0.4 * (1 - hesitate))} pulse={0} />
        {heart > 0.01 ? (
          <g transform={`translate(${WOMAN_X - 40} ${BENCH_Y - 250 - heart * 30}) scale(${heart * 1.6})`} opacity={Math.min(1, heart * 1.4)}>
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
        <g transform="translate(400 1060) scale(1.25) translate(-380 -1060)">
          <Mountain crack={1} light={0.6}>
            <Elija x={ELIJA_X + 110} y={LEDGE} k={0.72} pose={{ veil: 1, bow: 0.35 }} light={0.55} />
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
