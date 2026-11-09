import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, random, useCurrentFrame } from "remotion";
import { useLook } from "../../looks";
import { Sfx, beats, voiceFrame } from "../../lib/sfx";
import type { TimelineScene } from "../../lib/timing";
import type { Scene as SceneData } from "../../schema";
import { clamp, useT, wordsOfTexts } from "../w45/kitA";

/*
 * «Echt oder Fälschung?» – Mose auf dem sehr hohen Berg (Mose 1). Gott selbst wird nicht
 * gezeigt, nur seine Herrlichkeit als Licht, das von oben auf Mose fällt. Als das Licht geht,
 * sinkt Mose zu Boden, und die Sterne ziehen stundenlang ihre Bahnen. Dann kommt eine dunkle
 * Gestalt – ohne Glanz, flackernd, mit Worten wie ein Fehldruck. Mose kennt das Original, und
 * die Echtheitsprüfung zeigt es: «ECHT» gegen «FÄLSCHUNG». Bei «Weiche, Satan!» zerfällt die
 * Gestalt zu Staub. Danach die Erde, Menschen ohne Zahl, Welten – und eine Steintafel mit der
 * Stelle, die Gottes Antwort trägt. Was darauf steht, bleibt versiegelt.
 */

type MosesT = Extract<SceneData, { type: "moses" }>;
type P = [number, number];

/** Die Füsse stehen hier auf dem Gipfel. */
const GROUND = 1152;
const GOLD = "#FFD98A";
const GOLD_HI = "#FFF3CF";
const COLD = "#8C9CFF";
const ROBE = "#120E22";
const MANTLE = "#2A2346";
const VOID = "#05030A";

const ease = Easing.inOut(Easing.cubic);
const lerp = (a: P, b: P, k: number): P => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
const hex = (s: string) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
const mix = (a: string, b: string, k: number) => {
  const pa = hex(a);
  const pb = hex(b);
  const kk = Math.max(0, Math.min(1, k));
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * kk)).join(",")})`;
};
/** Ein Auftritt mit leichtem Überschwingen, 0 … 1 – eine Rechnung, kein Hook. */
const popAt = (t: number, at: number, d = 0.35) => Easing.out(Easing.back(1.7))(Math.max(0, Math.min(1, (t - at + 0.06) / d)));
/** Wann ein Wort mit diesem Muster gesprochen wird (für «1:39», das findCue nicht als zwei Wörter kennt). */
const wordTime = (ts: TimelineScene, re: RegExp, fallback: number) => ts.words.find((w) => re.test(w.text))?.start ?? fallback;

/* ------------------------------------------------------------------ */
/* Mose                                                                */
/* ------------------------------------------------------------------ */

type Pose = { kneel?: number; bow?: number; raise?: number; command?: number; look?: number; ground?: number };

/** Punkt (x, y) um (cx, cy) im Uhrzeigersinn drehen (Grad, SVG-Koordinaten). */
const rot = ([x, y]: P, cx: number, cy: number, deg: number): P => {
  const a = (deg * Math.PI) / 180;
  const dx = x - cx;
  const dy = y - cy;
  return [cx + dx * Math.cos(a) - dy * Math.sin(a), cy + dx * Math.sin(a) + dy * Math.cos(a)];
};

/**
 * Die Gestalt im Gewand mit Bart und Mantel, von der Seite, Blick nach rechts. Ursprung zwischen
 * den Füssen. `kneel` lässt sie knien, `bow` beugt den Oberkörper vor, `ground` stützt die Hand
 * auf den Boden, `raise` hebt die Arme zum Himmel, `command` streckt den Arm gebietend aus.
 */
const MoseShape: React.FC<{ fill: string; mantle: string; pose: Pose }> = ({ fill, mantle, pose }) => {
  const { kneel = 0, bow = 0, raise = 0, command = 0, look = 0, ground = 0 } = pose;
  const hipY = -122 + 52 * kneel;
  const sh = hipY - 118;
  const deg = bow * 58;
  // Rock: stehend schmal bis zum Boden, kniend breit aufliegend, das Knie vorn
  const sStand: P[] = [[-34, -122], [-44, -82], [-56, -60], [-60, 0], [64, 0], [56, -60], [44, -82], [34, -122]];
  const sKneel: P[] = [[-34, -70], [-62, -56], [-94, -24], [-98, 0], [80, 0], [92, -30], [72, -62], [34, -70]];
  const sk = sStand.map((p, i) => lerp(p, sKneel[i], kneel));
  const skirt = `M ${sk[0][0]} ${sk[0][1]} C ${sk[1][0]} ${sk[1][1]}, ${sk[2][0]} ${sk[2][1]}, ${sk[3][0]} ${sk[3][1]} L ${sk[4][0]} ${sk[4][1]} C ${sk[5][0]} ${sk[5][1]}, ${sk[6][0]} ${sk[6][1]}, ${sk[7][0]} ${sk[7][1]} Z`;
  // Arme: hängend → zum Himmel erhoben → nach vorn gebietend; vorne in Weltkoordinaten (für die Hand am Boden)
  const bS: P = [-18, sh + 14];
  let fe: P = lerp([34, sh + 70], [46, sh - 44], raise);
  let fh: P = lerp([40, sh + 124], [62, sh - 104], raise);
  fe = lerp(fe, [86, sh - 2], command);
  fh = lerp(fh, [150, sh - 30], command);
  const fSw = rot([22, sh + 14], 0, hipY, deg);
  let few = rot(fe, 0, hipY, deg);
  let fhw = rot(fh, 0, hipY, deg);
  if (ground > 0) {
    const gh: P = [fSw[0] + 40, -10];
    const ge: P = [(fSw[0] + gh[0]) / 2 + 22, (fSw[1] + gh[1]) / 2];
    few = lerp(few, ge, ground);
    fhw = lerp(fhw, gh, ground);
  }
  const be: P = lerp([-28, sh + 70], [-34, sh - 44], raise);
  const bh: P = lerp([-30, sh + 124], [-22, sh - 104], raise);
  const hx = 6;
  const hy = sh - 34;
  return (
    <g>
      <g transform={`rotate(${deg} 0 ${hipY})`}>
        <path d={`M ${bS[0]} ${bS[1]} L ${be[0]} ${be[1]} L ${bh[0]} ${bh[1]}`} stroke={mantle} strokeWidth={19} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </g>
      <path d={skirt} fill={fill} />
      <g transform={`rotate(${deg} 0 ${hipY})`}>
        <path d={`M -36 ${hipY + 4} L -33 ${sh + 22} Q -28 ${sh} 0 ${sh - 6} Q 28 ${sh} 33 ${sh + 22} L 36 ${hipY + 4} Z`} fill={fill} />
        {/* Mantel über Schultern und Rücken */}
        <path d={`M -36 ${sh + 18} Q -30 ${sh - 4} 0 ${sh - 8} Q 26 ${sh - 4} 30 ${sh + 14} L 14 ${sh + 40} Q -6 ${sh + 30} -18 ${sh + 44} L -42 ${hipY + 30} Q -52 ${hipY - 30} -36 ${sh + 18} Z`} fill={mantle} />
        <g transform={`rotate(${-look * 22} 0 ${sh})`}>
          <rect x={-10} y={sh - 14} width={20} height={20} fill={fill} />
          <circle cx={hx} cy={hy} r={25} fill={fill} />
          {/* Bart */}
          <path d={`M ${hx + 12} ${hy + 6} Q ${hx + 34} ${hy + 30} ${hx + 16} ${hy + 60} Q ${hx} ${hy + 50} ${hx - 12} ${hy + 18} Z`} fill={fill} />
          {/* Tuch über dem Kopf, hinten lang */}
          <path d={`M ${hx - 30} ${hy + 4} C ${hx - 34} ${hy - 40}, ${hx + 26} ${hy - 44}, ${hx + 28} ${hy - 6} L ${hx + 18} ${hy - 4} C ${hx + 8} ${hy - 22}, ${hx - 14} ${hy - 20}, ${hx - 12} ${hy + 8} L ${hx - 20} ${hy + 64} L ${hx - 40} ${hy + 60} Z`} fill={mantle} />
        </g>
      </g>
      <path d={`M ${fSw[0]} ${fSw[1]} L ${few[0]} ${few[1]} L ${fhw[0]} ${fhw[1]}`} stroke={mantle} strokeWidth={20} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx={fhw[0]} cy={fhw[1]} r={11} fill={fill} />
    </g>
  );
};

/** Mose mit Streiflicht (`rim`) und – wenn die Herrlichkeit auf ihm ist – einem Schein (`aura`). */
const Mose: React.FC<{ x: number; y?: number; k?: number; dir?: 1 | -1; pose?: Pose; rim: string; rimO?: number; aura?: number; o?: number }> = ({ x, y = GROUND, k = 1, dir = 1, pose = {}, rim, rimO = 1, aura = 0, o = 1 }) => {
  const frame = useCurrentFrame();
  return (
    <g transform={`translate(${x} ${y}) scale(${dir * k} ${k})`} opacity={o}>
      <defs>
        <radialGradient id="msAura">
          <stop offset="0%" stopColor={GOLD_HI} stopOpacity="0.85" />
          <stop offset="40%" stopColor={GOLD} stopOpacity="0.32" />
          <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
        </radialGradient>
      </defs>
      {aura > 0.01 ? <ellipse cx={0} cy={-170} rx={190} ry={260} fill="url(#msAura)" opacity={aura * (0.88 + 0.12 * Math.sin(frame / 8))} /> : null}
      <ellipse cx={10} cy={4} rx={96} ry={11} fill="#000" opacity={0.4} />
      <g transform="translate(-6 -4)" opacity={rimO}>
        <MoseShape fill={rim} mantle={rim} pose={pose} />
      </g>
      <MoseShape fill={ROBE} mantle={MANTLE} pose={pose} />
    </g>
  );
};

/* ------------------------------------------------------------------ */
/* Die dunkle Gestalt                                                  */
/* ------------------------------------------------------------------ */

/** Umhang mit Kapuze, ohne Gesicht – bei `rage` breiten sich die Ärmel aus. */
const CloakShape: React.FC<{ fill: string; rage: number }> = ({ fill, rage }) => (
  <g>
    <path
      d={`M -30 -290 Q ${-110 - 60 * rage} ${-250 - 70 * rage} ${-130 - 70 * rage} ${-150 - 120 * rage} L ${-90 - 30 * rage} ${-140 - 70 * rage} Q -70 -200 -40 -230 Z`}
      fill={fill}
    />
    <path
      d={`M 30 -290 Q ${110 + 60 * rage} ${-250 - 70 * rage} ${130 + 70 * rage} ${-150 - 120 * rage} L ${90 + 30 * rage} ${-140 - 70 * rage} Q 70 -200 40 -230 Z`}
      fill={fill}
    />
    <path d="M -76 0 C -66 -120, -58 -228, -44 -300 C -38 -352, -12 -384, 8 -382 C 34 -378, 48 -346, 46 -300 C 56 -228, 68 -120, 82 0 Q 40 -14 0 -6 Q -40 -14 -76 0 Z" fill={fill} />
  </g>
);

/**
 * Satan: Dunkelheit in Menschengestalt, flackernd, ohne Glanz. `gone` lässt ihn von oben her zu
 * Staub zerfallen, `rage` lässt ihn wachsen und toben.
 */
const Dark: React.FC<{ id: string; x: number; y?: number; k?: number; o?: number; rage?: number; gone?: number; smoke?: number }> = ({ id, x, y = GROUND, k = 1, o = 1, rage = 0, gone = 0, smoke = 1 }) => {
  const frame = useCurrentFrame();
  const dust = useMemo(
    () =>
      Array.from({ length: 90 }, (_, i) => ({
        x: (random(`${id}dx${i}`) - 0.5) * 150,
        y: -random(`${id}dy${i}`) * 380,
        r: 2 + random(`${id}dr${i}`) * 5,
        vx: 120 + random(`${id}vx${i}`) * 260,
        vy: -60 - random(`${id}vy${i}`) * 220,
      })),
    [id],
  );
  const puffs = useMemo(
    () => Array.from({ length: 12 }, (_, i) => ({ x: (random(`${id}px${i}`) - 0.5) * 300, y: -random(`${id}py${i}`) * 420, r: 90 + random(`${id}pr${i}`) * 120, p: random(`${id}pp${i}`) * 6.28 })),
    [id],
  );
  if (o <= 0.005) return null;
  const flick = 0.82 + 0.18 * Math.sin(frame * 1.9) * Math.sin(frame * 0.7 + 1.3);
  const jit = (1 + rage * 3) * (1 - gone);
  const grow = 1 + rage * 0.16;
  // Zerfall: die Grenze wandert von oben nach unten
  const edge = -420 + gone * 440;
  return (
    <g transform={`translate(${x} ${y})`} opacity={o}>
      <defs>
        <radialGradient id={`${id}Smoke`}>
          <stop offset="0%" stopColor="#000000" stopOpacity="0.75" />
          <stop offset="50%" stopColor="#1C1030" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#1C1030" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${id}Clip`}>
          <rect x={-400} y={edge} width={800} height={500} />
        </clipPath>
      </defs>
      {/* Rauch um ihn */}
      <g opacity={smoke * (1 - gone)}>
        {puffs.map((p, i) => (
          <circle key={i} cx={p.x * grow + Math.sin(frame / 23 + p.p) * 20} cy={p.y - ((frame * 0.8 + p.p * 40) % 60)} r={p.r * grow} fill={`url(#${id}Smoke)`} />
        ))}
      </g>
      <g transform={`scale(${k * grow})`}>
        <g clipPath={`url(#${id}Clip)`}>
          {/* Flackernde Ränder in stumpfem Violett – Kopien, die nicht ganz deckungsgleich sind */}
          {[0, 1, 2].map((i) => (
            <g key={i} transform={`translate(${Math.sin(frame * (1.3 + i) + i * 2) * 4 * jit} ${Math.cos(frame * (1.1 + i * 0.7)) * 3 * jit})`} opacity={0.42 * flick}>
              <CloakShape fill={i === 1 ? "#4A3A6E" : "#2E2448"} rage={rage} />
            </g>
          ))}
          <CloakShape fill={VOID} rage={rage} />
          {/* Unter der Kapuze nur Leere */}
          <ellipse cx={14} cy={-326} rx={17} ry={24} fill="#000" />
        </g>
      </g>
      {/* Staub, der davonweht */}
      {gone > 0
        ? dust.map((d, i) => {
            const yy = d.y * k * grow;
            const born = (yy + 420) / 440; // wann die Grenze dieses Korn erreicht
            const age = Math.max(0, gone - born) * 2.2;
            if (age <= 0 || age > 1.4) return null;
            return <circle key={i} cx={d.x * k + d.vx * age} cy={yy + d.vy * age} r={d.r * (1 - age * 0.5)} fill={i % 3 ? "#3A2E58" : "#6A5A90"} opacity={(1 - age / 1.4) * 0.9} />;
          })
        : null}
    </g>
  );
};

/* ------------------------------------------------------------------ */
/* Licht, Gipfel, Sterne                                               */
/* ------------------------------------------------------------------ */

/** Gottes Herrlichkeit: gleissendes Licht von oben, ein Strahl auf Mose – ohne Gestalt. */
const Glory: React.FC<{ k: number; x: number; spread?: number; lift?: number }> = ({ k, x, spread = 1, lift = 0 }) => {
  const frame = useCurrentFrame();
  if (k <= 0.005) return null;
  const srcY = 90 - lift * 300;
  return (
    <g>
      <defs>
        <radialGradient id="msSrc">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
          <stop offset="18%" stopColor={GOLD_HI} stopOpacity="0.85" />
          <stop offset="50%" stopColor={GOLD} stopOpacity="0.25" />
          <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="msBeam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
          <stop offset="55%" stopColor={GOLD_HI} stopOpacity="0.32" />
          <stop offset="100%" stopColor={GOLD} stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <rect width={1080} height={1920} fill="#FFE2A0" opacity={0.12 * k} />
      {Array.from({ length: 18 }, (_, i) => {
        const a = (i / 18) * Math.PI * 2 + frame / 160;
        return (
          <path
            key={i}
            d={`M ${x} ${srcY} L ${x + Math.cos(a - 0.04) * 1500} ${srcY + Math.sin(a - 0.04) * 1500} L ${x + Math.cos(a + 0.04) * 1500} ${srcY + Math.sin(a + 0.04) * 1500} Z`}
            fill={GOLD_HI}
            opacity={0.06 * k}
          />
        );
      })}
      <path d={`M ${x - 70 * spread} ${srcY} L ${x + 70 * spread} ${srcY} L ${x + 230 * spread} ${GROUND + 20} L ${x - 230 * spread} ${GROUND + 20} Z`} fill="url(#msBeam)" opacity={0.6 * k} />
      <circle cx={x} cy={srcY} r={620 * (0.6 + 0.4 * k) * (0.97 + 0.03 * Math.sin(frame / 9))} fill="url(#msSrc)" opacity={k} />
      {/* Lichtteilchen im Strahl */}
      {Array.from({ length: 26 }, (_, i) => {
        const life = 90 + random(`mmL${i}`) * 80;
        const p = ((frame + random(`mmP${i}`) * life) % life) / life;
        const xx = x + (random(`mmX${i}`) - 0.5) * 340 * spread * (0.3 + p);
        const yy = GROUND - 40 - p * 900;
        return <circle key={i} cx={xx} cy={yy} r={2 + random(`mmR${i}`) * 3} fill="#FFFFFF" opacity={Math.sin(p * Math.PI) * 0.8 * k} />;
      })}
    </g>
  );
};

/**
 * Der Gipfel im Vordergrund: Plateau, Felsflanken mit Kanten, Schnee. `light` 0 = kaltes
 * Sternenlicht, 1 = Gold der Herrlichkeit.
 */
const Peak: React.FC<{ light: number; glowO?: number }> = ({ light, glowO = 1 }) => {
  const rim = mix(COLD, GOLD, light);
  const left = mix("#22204A", "#4A3A3A", light * 0.7);
  const right = mix("#0E0C22", "#1E1620", light * 0.5);
  const face = mix("#171538", "#2E2434", light * 0.6);
  const top =
    "M -40 2700 L -40 1640 L 90 1500 L 190 1360 L 250 1240 L 300 1176 L 380 1156 L 470 1150 L 560 1147 L 660 1150 L 760 1156 L 830 1170 L 890 1220 L 960 1330 L 1040 1450 L 1120 1540 L 1120 2700 Z";
  return (
    <g>
      <path d={top} fill={face} />
      {/* Flanken: links im Licht, rechts im Schatten */}
      <path d="M 300 1176 L 380 1156 L 400 1260 L 330 1420 L 230 1640 L 120 1820 L -40 1900 L -40 1640 L 90 1500 L 190 1360 L 250 1240 Z" fill={left} />
      <path d="M 760 1156 L 830 1170 L 890 1220 L 960 1330 L 1040 1450 L 1120 1540 L 1120 2000 L 960 1900 L 860 1640 L 800 1420 L 740 1260 Z" fill={right} />
      <path d="M 470 1150 L 520 1240 L 500 1380 L 560 1560 M 660 1150 L 640 1270 L 700 1430 L 680 1640 M 380 1156 L 400 1260" stroke={mix("#0A0918", "#1A1218", light)} strokeWidth={4} fill="none" opacity={0.45} />
      {/* Schnee am Rand */}
      <path d="M 300 1176 L 380 1156 L 470 1150 L 440 1168 L 380 1172 L 330 1192 Z" fill={mix("#B8C2FF", "#FFF0D0", light)} opacity={0.55} />
      <path d="M 660 1150 L 760 1156 L 830 1170 L 790 1176 L 720 1166 Z" fill={mix("#AAB4F0", "#FFE8C0", light)} opacity={0.4} />
      {/* Streiflicht auf der Kante */}
      <path d="M 190 1360 L 250 1240 L 300 1176 L 380 1156 L 470 1150 L 560 1147 L 660 1150 L 760 1156 L 830 1170 L 890 1220" fill="none" stroke={rim} strokeWidth={4} opacity={0.7 * glowO} strokeLinejoin="round" />
    </g>
  );
};

/** Sterne, die stundenlang ihre Bahnen ziehen – um einen Pol über dem Gipfel. */
const StarTrails: React.FC<{ k: number }> = ({ k }) => {
  const trails = useMemo(
    () => Array.from({ length: 46 }, (_, i) => ({ r: 50 + i * 22 + random(`stR${i}`) * 14, a: random(`stA${i}`) * 6.28, w: 1.2 + random(`stW${i}`) * 2, o: 0.25 + random(`stO${i}`) * 0.45 })),
    [],
  );
  if (k <= 0.005) return null;
  const cx = 540;
  const cy = 330;
  return (
    <g>
      <defs>
        <clipPath id="msSky">
          <rect x={0} y={0} width={1080} height={1150} />
        </clipPath>
      </defs>
      <g clipPath="url(#msSky)">
        {trails.map((tr, i) => {
          const sweep = k * (0.6 + (i % 5) * 0.12);
          const a0 = tr.a;
          const a1 = tr.a + sweep;
          const large = sweep > Math.PI ? 1 : 0;
          return (
            <path
              key={i}
              d={`M ${cx + Math.cos(a0) * tr.r} ${cy + Math.sin(a0) * tr.r} A ${tr.r} ${tr.r} 0 ${large} 1 ${cx + Math.cos(a1) * tr.r} ${cy + Math.sin(a1) * tr.r}`}
              fill="none"
              stroke={i % 7 === 0 ? "#FFE7C0" : "#D6DEFF"}
              strokeWidth={tr.w}
              strokeLinecap="round"
              opacity={tr.o * Math.min(1, k * 2)}
            />
          );
        })}
        <circle cx={cx} cy={cy} r={4} fill="#FFFFFF" opacity={Math.min(1, k * 2)} />
      </g>
    </g>
  );
};

/* ------------------------------------------------------------------ */
/* Schrift im Bild                                                     */
/* ------------------------------------------------------------------ */

/** Grosse Zeilen, jede erscheint, wenn sie gesprochen wird; die aktuelle leuchtet golden. */
const Lines: React.FC<{ items: Array<{ text: string; at: number; size: number }>; t: number; top: number; font: string; caps?: boolean }> = ({ items, t, top, font, caps }) => {
  const look = useLook();
  const current = items.reduce((acc, it, i) => (t >= it.at - 0.05 ? i : acc), -1);
  return (
    <div style={{ position: "absolute", top, left: 70, right: 70, display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
      {items.map((it, i) => {
        const k = popAt(t, it.at);
        if (k <= 0.001) return null;
        const cur = i === current;
        return (
          <div
            key={i}
            style={{
              fontFamily: font,
              fontWeight: 700,
              fontSize: it.size,
              lineHeight: 1.08,
              textAlign: "center",
              textTransform: caps ? "uppercase" : "none",
              color: cur ? look.accent : look.text,
              opacity: Math.min(1, k * 1.4) * (cur ? 1 : 0.62),
              transform: `scale(${interpolate(k, [0, 1], [1.25, 1])})`,
              textShadow: cur ? "0 0 28px rgba(255,217,138,0.55), 0 6px 26px rgba(0,0,0,0.75)" : "0 6px 26px rgba(0,0,0,0.75)",
            }}
          >
            {it.text}
          </div>
        );
      })}
    </div>
  );
};

/** Was Satan sagt: stumpfe Schrift wie ein Fehldruck – die Farbschichten sitzen nicht. */
const Counterfeit: React.FC<{ text: string; k: number; out?: number }> = ({ text, k, out = 0 }) => {
  const frame = useCurrentFrame();
  if (k <= 0.002) return null;
  const dx = 3 + 3 * Math.sin(frame / 2.3);
  const dy = 2 * Math.cos(frame / 3.1);
  const on = Math.sin(frame * 1.7) > -0.85 ? 1 : 0.55;
  return (
    <div
      style={{
        position: "absolute",
        top: 330,
        left: 90,
        right: 90,
        minHeight: 300,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        fontFamily: "Cinzel",
        fontWeight: 700,
        fontSize: 74,
        lineHeight: 1.18,
        color: "#A89EBE",
        textShadow: `${dx}px ${dy}px 0 rgba(120,60,170,0.55), ${-dx}px ${-dy}px 0 rgba(40,140,150,0.4), 0 0 30px rgba(0,0,0,0.95), 0 8px 26px rgba(0,0,0,0.9)`,
        opacity: Math.min(1, k * 1.3) * on * (1 - out),
        filter: `blur(${(1 - Math.min(1, k * 1.2)) * 6}px)`,
        transform: `translateY(${(1 - k) * 24}px)`,
      }}
    >
      «{text}»
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Echtheitsprüfung                                                    */
/* ------------------------------------------------------------------ */

/** Ecken eines Suchers. */
const Brackets: React.FC<{ x: number; y: number; w: number; h: number; color: string; o: number; len?: number }> = ({ x, y, w, h, color, o, len = 60 }) => (
  <g stroke={color} strokeWidth={5} fill="none" opacity={o} strokeLinecap="square">
    <path d={`M ${x} ${y + len} L ${x} ${y} L ${x + len} ${y}`} />
    <path d={`M ${x + w - len} ${y} L ${x + w} ${y} L ${x + w} ${y + len}`} />
    <path d={`M ${x} ${y + h - len} L ${x} ${y + h} L ${x + len} ${y + h}`} />
    <path d={`M ${x + w - len} ${y + h} L ${x + w} ${y + h} L ${x + w} ${y + h - len}`} />
  </g>
);

/** Ein Stempel, der aufs Prüffeld fällt. */
const Verdict: React.FC<{ x: number; y: number; text: string; color: string; k: number; rot: number; size?: number }> = ({ x, y, text, color, k, rot, size = 62 }) => {
  if (k <= 0.001) return null;
  const w = text.length * size * 0.68 + size * 0.9;
  const h = size * 1.55;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${interpolate(k, [0, 1], [2.2, 1])})`} opacity={Math.min(1, k * 1.8)}>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={10} fill="rgba(6,4,14,0.55)" stroke={color} strokeWidth={7} />
      <rect x={-w / 2 + 10} y={-h / 2 + 10} width={w - 20} height={h - 20} rx={6} fill="none" stroke={color} strokeWidth={2.5} opacity={0.7} />
      <text x={0} y={size * 0.36} textAnchor="middle" fontFamily="Anton" fontSize={size} letterSpacing={size * 0.06} fill={color}>
        {text}
      </text>
    </g>
  );
};

/** Ein Prüffeld: Rahmen, Titel, Inhalt, Messbalken «Licht». */
const Card: React.FC<{ x: number; y: number; w: number; h: number; title: string; meter: number; meterColor: string; scan: number; children: React.ReactNode; o: number; id: string }> = ({ x, y, w, h, title, meter, meterColor, scan, children, o, id }) => (
  <g opacity={o}>
    <defs>
      <clipPath id={`${id}Clip`}>
        <rect x={x} y={y} width={w} height={h} rx={18} />
      </clipPath>
      <linearGradient id={`${id}Scan`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#9FE8FF" stopOpacity="0" />
        <stop offset="100%" stopColor="#9FE8FF" stopOpacity="0.55" />
      </linearGradient>
    </defs>
    <rect x={x} y={y} width={w} height={h} rx={18} fill="rgba(8,6,24,0.78)" stroke="rgba(190,200,255,0.45)" strokeWidth={3} />
    <g clipPath={`url(#${id}Clip)`}>
      {children}
      {scan > 0 && scan < 1 ? (
        <g>
          <rect x={x} y={y + scan * h - 90} width={w} height={90} fill={`url(#${id}Scan)`} />
          <rect x={x} y={y + scan * h - 3} width={w} height={4} fill="#CFF4FF" />
        </g>
      ) : null}
    </g>
    <text x={x + 26} y={y + 50} fontFamily="Space Mono" fontWeight={700} fontSize={30} letterSpacing={4} fill="#DDE2FF">
      {title}
    </text>
    {/* Messbalken */}
    <text x={x + 26} y={y + h - 34} fontFamily="Space Mono" fontWeight={700} fontSize={26} fill="#AEB6E8">
      LICHT
    </text>
    <rect x={x + 130} y={y + h - 56} width={w - 160} height={26} rx={13} fill="rgba(255,255,255,0.1)" />
    <rect x={x + 130} y={y + h - 56} width={Math.max(0, (w - 160) * meter)} height={26} rx={13} fill={meterColor} />
  </g>
);

/* ------------------------------------------------------------------ */
/* Erde, Menschen, Welten, Tafel                                       */
/* ------------------------------------------------------------------ */

const Earth: React.FC<{ x: number; y: number; r: number; o: number }> = ({ x, y, r, o }) => {
  const frame = useCurrentFrame();
  if (o <= 0.005) return null;
  const spin = (frame * 0.9) % (r * 4);
  const lands = [
    "M 0 -60 C 40 -90, 110 -70, 120 -20 C 130 30, 70 40, 60 90 C 50 130, 10 120, 0 70 C -10 30, -40 10, -30 -30 Z",
    "M 180 -120 C 230 -140, 300 -110, 290 -60 C 280 -20, 230 -30, 210 0 C 190 30, 150 0, 160 -50 Z",
    "M 220 40 C 260 30, 300 60, 280 110 C 260 150, 210 140, 200 100 Z",
  ];
  return (
    <g transform={`translate(${x} ${y})`} opacity={o}>
      <defs>
        <radialGradient id="msOcean" cx="0.38" cy="0.35" r="0.75">
          <stop offset="0%" stopColor="#4FA6FF" />
          <stop offset="60%" stopColor="#1E5BBF" />
          <stop offset="100%" stopColor="#0A2560" />
        </radialGradient>
        <radialGradient id="msAtmo">
          <stop offset="80%" stopColor="#7FD0FF" stopOpacity="0" />
          <stop offset="90%" stopColor="#7FD0FF" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#7FD0FF" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="msNight" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#000" stopOpacity="0" />
          <stop offset="55%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#020414" stopOpacity="0.75" />
        </linearGradient>
        <clipPath id="msGlobe">
          <circle r={r} />
        </clipPath>
      </defs>
      <circle r={r * 1.22} fill="url(#msAtmo)" />
      <circle r={r} fill="url(#msOcean)" />
      <g clipPath="url(#msGlobe)">
        {[-1, 0, 1].map((rep) => (
          <g key={rep} transform={`translate(${-r * 2.2 + spin * 0.5 + rep * r * 2} 0) scale(${r / 170})`}>
            {lands.map((d, i) => (
              <path key={i} d={d} fill={i === 1 ? "#C9B36A" : "#3FA65A"} opacity={0.92} />
            ))}
          </g>
        ))}
        {/* Wolkenstreifen */}
        <path d={`M ${-r} ${-r * 0.3} q ${r * 0.5} ${-r * 0.12} ${r} 0 t ${r} 0`} stroke="#FFFFFF" strokeWidth={r * 0.05} fill="none" opacity={0.35} />
        <path d={`M ${-r} ${r * 0.4} q ${r * 0.5} ${r * 0.1} ${r} 0 t ${r} 0`} stroke="#FFFFFF" strokeWidth={r * 0.04} fill="none" opacity={0.3} />
        <rect x={-r} y={-r} width={r * 2} height={r * 2} fill="url(#msNight)" />
      </g>
      <circle r={r} fill="none" stroke="#BFE6FF" strokeWidth={3} opacity={0.6} />
    </g>
  );
};

/** Menschen ohne Zahl – wie Sand am Meer: goldene Körner, die um die Erde ziehen. */
const Sand: React.FC<{ x: number; y: number; r: number; lit: number }> = ({ x, y, r, lit }) => {
  const frame = useCurrentFrame();
  const grains = useMemo(
    () => Array.from({ length: 900 }, (_, i) => ({ a: random(`sgA${i}`) * 6.28, d: 1.08 + random(`sgD${i}`) ** 1.6 * 1.05, v: 0.002 + random(`sgV${i}`) * 0.006, s: 0.8 + random(`sgS${i}`) * 2 })),
    [],
  );
  const n = Math.round(grains.length * lit);
  if (n <= 0) return null;
  return (
    <g transform={`translate(${x} ${y})`}>
      {grains.slice(0, n).map((g, i) => {
        const a = g.a + frame * g.v;
        const rr = r * g.d;
        return <circle key={i} cx={Math.cos(a) * rr} cy={Math.sin(a) * rr * 0.42} r={g.s} fill={i % 4 ? "#FFE3A0" : "#FFFFFF"} opacity={0.75} />;
      })}
    </g>
  );
};

const WORLDS = [
  { x: 170, y: 520, r: 46, c: ["#FFB37A", "#8A3E2A"], ring: false },
  { x: 900, y: 470, r: 58, c: ["#E7D6A0", "#8A6A3A"], ring: true },
  { x: 120, y: 820, r: 30, c: ["#9AE6C8", "#2A6A5A"], ring: false },
  { x: 960, y: 820, r: 36, c: ["#C8A8FF", "#4A2E8A"], ring: false },
  { x: 300, y: 360, r: 20, c: ["#FFFFFF", "#8A9AC8"], ring: false },
  { x: 780, y: 330, r: 24, c: ["#FF9AB8", "#7A2A4A"], ring: false },
  { x: 250, y: 1010, r: 24, c: ["#8AD0FF", "#1E4A8A"], ring: true },
  { x: 850, y: 1040, r: 22, c: ["#FFD27A", "#8A5A1A"], ring: false },
  { x: 60, y: 660, r: 16, c: ["#E0E0FF", "#5A5A8A"], ring: false },
  { x: 1020, y: 640, r: 18, c: ["#A8FFB0", "#2A7A3A"], ring: false },
  { x: 420, y: 300, r: 12, c: ["#FFC8A0", "#8A4A2A"], ring: false },
  { x: 680, y: 1000, r: 14, c: ["#C0F0FF", "#3A7A9A"], ring: false },
  { x: 380, y: 1090, r: 10, c: ["#FFFFFF", "#8888AA"], ring: false },
  { x: 990, y: 300, r: 12, c: ["#FFE0A0", "#8A6A2A"], ring: false },
];

/** Welten ohne Zahl – sie gehen nacheinander auf. */
const Worlds: React.FC<{ k: number }> = ({ k }) => {
  const frame = useCurrentFrame();
  if (k <= 0.005) return null;
  return (
    <g>
      {WORLDS.map((w, i) => {
        const kk = Easing.out(Easing.back(1.8))(Math.max(0, Math.min(1, k * 2.4 - i * 0.1)));
        if (kk <= 0.001) return null;
        const bob = Math.sin(frame / 30 + i) * 6;
        return (
          <g key={i} transform={`translate(${w.x} ${w.y + bob}) scale(${kk})`}>
            <defs>
              <radialGradient id={`msW${i}`} cx="0.35" cy="0.32" r="0.75">
                <stop offset="0%" stopColor={w.c[0]} />
                <stop offset="100%" stopColor={w.c[1]} />
              </radialGradient>
            </defs>
            <circle r={w.r * 1.8} fill={w.c[0]} opacity={0.12} />
            {w.ring ? <ellipse rx={w.r * 1.8} ry={w.r * 0.45} fill="none" stroke={w.c[0]} strokeWidth={w.r * 0.14} opacity={0.6} transform="rotate(-18)" /> : null}
            <circle r={w.r} fill={`url(#msW${i})`} />
            {w.ring ? <path d={`M ${-w.r * 1.72} ${w.r * 0.18} A ${w.r * 1.8} ${w.r * 0.45} 0 0 0 ${w.r * 1.72} ${-w.r * 0.18}`} fill="none" stroke={w.c[0]} strokeWidth={w.r * 0.14} opacity={0.85} transform="rotate(-18)" /> : null}
          </g>
        );
      })}
    </g>
  );
};

/** Eine Steintafel: oben eingraviert die Stelle, darunter Zeilen aus Licht – versiegelt, nicht lesbar. */
const Tablet: React.FC<{ k: number; engrave: number }> = ({ k, engrave }) => {
  const frame = useCurrentFrame();
  if (k <= 0.005) return null;
  const w = 560;
  const h = 470;
  return (
    <g transform={`translate(540 ${525 + (1 - k) * 80})`} opacity={Math.min(1, k * 1.3)}>
      <defs>
        <linearGradient id="msStone" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6A6890" />
          <stop offset="55%" stopColor="#3E3C62" />
          <stop offset="100%" stopColor="#24223E" />
        </linearGradient>
        <radialGradient id="msTabGlow">
          <stop offset="0%" stopColor={GOLD_HI} stopOpacity="0.55" />
          <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="msSeal" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={GOLD} stopOpacity="0.25" />
          <stop offset={`${(0.5 + 0.5 * Math.sin(frame / 14)) * 100}%`} stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="100%" stopColor={GOLD} stopOpacity="0.25" />
        </linearGradient>
        <clipPath id="msEngrave">
          <rect x={-w / 2} y={-h / 2} width={w * engrave} height={150} />
        </clipPath>
      </defs>
      <ellipse rx={w * 0.95} ry={h * 0.85} fill="url(#msTabGlow)" opacity={0.8} />
      <path d={`M ${-w / 2} ${h / 2} L ${-w / 2} ${-h / 2 + 110} Q ${-w / 2} ${-h / 2} ${-w / 2 + 110} ${-h / 2} L ${w / 2 - 110} ${-h / 2} Q ${w / 2} ${-h / 2} ${w / 2} ${-h / 2 + 110} L ${w / 2} ${h / 2} Z`} fill="url(#msStone)" stroke="#9A98C8" strokeWidth={4} />
      <path d={`M ${-w / 2 + 24} ${h / 2 - 24} L ${-w / 2 + 24} ${-h / 2 + 116} Q ${-w / 2 + 24} ${-h / 2 + 24} ${-w / 2 + 116} ${-h / 2 + 24} L ${w / 2 - 116} ${-h / 2 + 24} Q ${w / 2 - 24} ${-h / 2 + 24} ${w / 2 - 24} ${-h / 2 + 116} L ${w / 2 - 24} ${h / 2 - 24} Z`} fill="none" stroke="#2A2846" strokeWidth={3} opacity={0.8} />
      <g clipPath="url(#msEngrave)">
        <text x={0} y={-h / 2 + 118} textAnchor="middle" fontFamily="Cinzel" fontWeight={700} fontSize={72} letterSpacing={6} fill={GOLD_HI} style={{ filter: "drop-shadow(0 0 14px rgba(255,217,138,0.8))" }}>
          MOSE 1:39
        </text>
      </g>
      {/* Versiegelte Zeilen */}
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={-w / 2 + 70 + (i === 3 ? 60 : 0)} y={-30 + i * 62} width={w - 140 - (i === 3 ? 120 : 0)} height={22} rx={11} fill="url(#msSeal)" opacity={0.75 * engrave} />
      ))}
    </g>
  );
};

/* ------------------------------------------------------------------ */
/* Szene                                                               */
/* ------------------------------------------------------------------ */

export const Scene: React.FC<{ ts: TimelineScene }> = ({ ts }) => {
  const s = ts.scene as MosesT;
  const frame = useCurrentFrame();
  const t = useT(ts);
  const end = ts.speechEndSec;
  const lineAt = (i: number, fb: number) => beats(ts, s.lines.map((l) => l.at), s.lines.length)[i] ?? fb;

  let back: React.ReactNode = null; // hinter dem Gipfel (Licht, Sterne, Welten)
  let front: React.ReactNode = null; // vor allem (Schrift, Prüfung)
  let fx: React.ReactNode = null;
  let light = 0; // Gold auf dem Gipfel
  let mose: React.ReactNode = null;
  let dark: React.ReactNode = null;
  let cam = { z: 1, dy: 0, shake: 0 };
  let tint = { cold: 0.25, gold: 0, black: 0 };

  if (s.stage === "hook") {
    const [echt, fake, allein] = beats(ts, s.cues, 3);
    const kE = popAt(t, echt);
    const kF = popAt(t, fake);
    const reveal = interpolate(t, [allein - 0.3, allein + 1.3], [0, 1], { ...clamp, easing: ease });
    const scanY = 300 + ((frame * 9) % 460);
    const searching = t < fake + 0.2;
    cam = { z: interpolate(reveal, [0, 1], [0.74, 0.5]), dy: interpolate(reveal, [0, 1], [70, 170]), shake: 0 };
    light = 0;
    mose = <Mose x={540} pose={{ look: 0.6 }} rim={COLD} rimO={0.9} />;
    front = (
      <>
        <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
          <Brackets x={90} y={290} w={900} h={480} color="#CFE0FF" o={0.85 - reveal * 0.4} />
          {searching ? <rect x={90} y={scanY} width={900} height={3} fill="#BFE8FF" opacity={0.6} /> : null}
        </svg>
        <div style={{ position: "absolute", top: 320, left: 0, right: 0, textAlign: "center" }}>
          <div
            style={{
              fontFamily: "Anton",
              fontSize: 250,
              lineHeight: 1,
              letterSpacing: "0.02em",
              background: `linear-gradient(180deg, #FFFBEA 0%, ${GOLD} 55%, #E0A24A 100%)`,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              filter: "drop-shadow(0 0 30px rgba(255,217,138,0.55))",
              opacity: Math.min(1, kE * 1.5),
              transform: `scale(${interpolate(kE, [0, 1], [1.4, 1])})`,
            }}
          >
            ECHT
          </div>
          <div style={{ marginTop: 6, fontFamily: "Space Mono", fontWeight: 700, fontSize: 40, letterSpacing: "0.4em", color: "#C8CEF0", opacity: Math.min(1, kF * 1.5) }}>ODER</div>
          <div
            style={{
              fontFamily: "Anton",
              fontSize: 150,
              lineHeight: 1.05,
              color: "#9A90B8",
              textShadow: `${4 + 3 * Math.sin(frame / 2)}px 0 0 rgba(140,70,200,0.6), ${-4 - 3 * Math.sin(frame / 2)}px 0 0 rgba(50,160,170,0.5), 0 10px 30px rgba(0,0,0,0.8)`,
              opacity: Math.min(1, kF * 1.5) * (Math.sin(frame * 1.3) > -0.9 ? 1 : 0.5),
              transform: `scale(${interpolate(kF, [0, 1], [1.4, 1])}) skewX(${(1 - kF) * -10}deg)`,
            }}
          >
            FÄLSCHUNG?
          </div>
        </div>
        <div style={{ position: "absolute", top: 800, left: 0, right: 0, textAlign: "center", fontFamily: "Space Mono", fontWeight: 700, fontSize: 34, letterSpacing: "0.2em", color: "#BFE8FF", opacity: searching ? 0.55 + 0.45 * Math.sin(frame / 4) : 0 }}>
          PRÜFUNG LÄUFT …
        </div>
      </>
    );
  } else if (s.stage === "glory") {
    const [berg, angesicht, sohn] = beats(ts, s.cues, 3);
    const rise = interpolate(t, [berg - 0.5, berg + 1.4], [0, 1], { ...clamp, easing: ease });
    const g = interpolate(t, [angesicht - 0.3, angesicht + 0.9], [0.12, 1], { ...clamp, easing: ease });
    light = g;
    cam = { z: 1, dy: (1 - rise) * 420, shake: 0 };
    back = <Glory k={g} x={540} />;
    mose = <Mose x={540} pose={{ look: 0.9, raise: 0.12 * g }} rim={mix(COLD, GOLD, g)} aura={g} />;
    front = <Lines t={t} top={500} font="Cinzel" items={s.lines.map((l, i) => ({ text: l.text, at: lineAt(i, sohn), size: 78 }))} />;
    fx = <Sfx frame={voiceFrame(ts, sohn)} name="warm" volume={0.4} keep />;
    tint = { cold: 0.1 * (1 - g), gold: 0.15 * g, black: 0 };
  } else if (s.stage === "weak") {
    const [weg, boden, stunden] = beats(ts, s.cues, 3);
    const g = 1 - interpolate(t, [weg - 0.3, weg + 0.9], [0, 1], { ...clamp, easing: ease });
    const fall = interpolate(t, [boden - 0.15, boden + 0.55], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
    const trails = interpolate(t, [stunden - 0.3, end + 0.6], [0, 1], clamp);
    light = g;
    back = (
      <>
        <Glory k={g} x={540} lift={1 - g} spread={0.5 + 0.5 * g} />
        <StarTrails k={trails} />
      </>
    );
    mose = <Mose x={540} pose={{ kneel: fall, bow: fall * 0.72, ground: fall, look: 0.9 - 1.4 * fall }} rim={mix(COLD, GOLD, g)} rimO={0.5 + 0.5 * g} aura={g} />;
    tint = { cold: 0.3 * (1 - g), gold: 0.12 * g, black: 0.15 * fall };
  } else if (s.stage === "tempter") {
    const [kommt] = beats(ts, s.cues, 1);
    const atk = s.attack ? beats(ts, [s.attack.at], 1)[0] : 1.4;
    const form = interpolate(t, [kommt - 0.3, kommt + 0.9], [0, 1], { ...clamp, easing: ease });
    const say = interpolate(t, [atk - 0.3, atk + 0.2], [0, 1], clamp);
    dark = <Dark id="mT" x={750} k={interpolate(form, [0, 1], [0.85, 1.05])} o={form} smoke={form} />;
    mose = <Mose x={350} pose={{ kneel: 1, bow: 0.2, look: 0.25 }} rim={COLD} rimO={0.8} />;
    front = s.attack ? <Counterfeit text={s.attack.text} k={say} /> : null;
    tint = { cold: 0.3, gold: 0, black: 0.2 * form };
  } else if (s.stage === "compare") {
    const wer = lineAt(0, 1.6);
    const sohn = lineAt(1, 2.7);
    const up = interpolate(t, [wer - 0.7, wer + 0.3], [1, 0], { ...clamp, easing: ease });
    const inner = interpolate(t, [sohn - 0.2, sohn + 0.8], [0, 0.55], clamp);
    dark = <Dark id="mC" x={750} k={1.05} />;
    mose = <Mose x={340} pose={{ kneel: up, bow: 0.2 * up, look: 0.2 }} rim={mix(COLD, GOLD, inner)} aura={inner * 0.5} />;
    light = inner * 0.4;
    front = <Lines t={t} top={330} font="Cinzel" items={s.lines.map((l, i) => ({ text: l.text, at: lineAt(i, 1.6 + i), size: i === 0 ? 92 : 70 }))} />;
    tint = { cold: 0.28, gold: 0, black: 0.18 };
  } else if (s.stage === "judge") {
    const [gesehen, unterscheiden, original, faelschung] = beats(ts, s.cues, 4);
    const show = interpolate(t, [gesehen - 0.4, gesehen + 0.2], [0, 1], clamp);
    const remember = interpolate(t, [gesehen, gesehen + 1], [0.2, 1], { ...clamp, easing: ease });
    const scan = interpolate(t, [unterscheiden - 0.1, unterscheiden + 1.3], [0, 1], clamp);
    const kE = popAt(t, original);
    const kF = popAt(t, faelschung);
    const L = 70;
    const R = 560;
    const top = 320;
    const cw = 450;
    const ch = 420;
    dark = <Dark id="mJ" x={750} k={1.05} />;
    mose = <Mose x={330} pose={{ look: 0.2 }} rim={GOLD} rimO={0.75} aura={0.3 * remember} />;
    light = 0.35;
    front = (
      <>
        <div style={{ position: "absolute", top: 262, left: 0, right: 0, textAlign: "center", fontFamily: "Space Mono", fontWeight: 700, fontSize: 32, letterSpacing: "0.32em", color: "#CFE0FF", opacity: show }}>
          ECHTHEITSPRÜFUNG
        </div>
        <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
          <defs>
            <radialGradient id="msTable" cx="0.5" cy="0.5" r="0.6">
              <stop offset="0%" stopColor="#7C88C8" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#2A3060" stopOpacity="0.4" />
            </radialGradient>
          <radialGradient id="msMem">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
              <stop offset="25%" stopColor={GOLD_HI} stopOpacity="0.8" />
              <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
            </radialGradient>
          </defs>
          <g transform={`translate(0 ${(1 - show) * 40})`}>
            <Card id="msCa" x={L} y={top} w={cw} h={ch} title="ORIGINAL" meter={remember * Math.min(1, scan * 1.6)} meterColor={GOLD} scan={scan} o={show}>
              <circle cx={L + cw / 2} cy={top + 190} r={170 * (0.7 + 0.3 * remember)} fill="url(#msMem)" opacity={remember} />
              {Array.from({ length: 12 }, (_, i) => {
                const a = (i / 12) * Math.PI * 2 + frame / 90;
                const cx = L + cw / 2;
                const cy = top + 190;
                return <path key={i} d={`M ${cx} ${cy} L ${cx + Math.cos(a - 0.06) * 260} ${cy + Math.sin(a - 0.06) * 260} L ${cx + Math.cos(a + 0.06) * 260} ${cy + Math.sin(a + 0.06) * 260} Z`} fill={GOLD_HI} opacity={0.18 * remember} />;
              })}
            </Card>
            <Card id="msCb" x={R} y={top} w={cw} h={ch} title="PRÜFLING" meter={0.015} meterColor="#E2483D" scan={scan} o={show}>
              <rect x={R} y={top} width={cw} height={ch} fill="url(#msTable)" />
              <Dark id="mJm" x={R + cw / 2} y={top + 330} k={0.62} smoke={0.7} />
            </Card>
            <Verdict x={L + cw / 2} y={top + 200} text="ECHT" color="#FFE08A" k={kE} rot={-9} size={84} />
            <Verdict x={R + cw / 2} y={top + 200} text="FÄLSCHUNG" color="#FF5A4A" k={kF} rot={7} size={62} />
          </g>
        </svg>
        <Sfx frame={voiceFrame(ts, faelschung)} name="thud" volume={0.45} keep />
      </>
    );
    tint = { cold: 0.22, gold: 0, black: 0.1 };
  } else if (s.stage === "depart") {
    const [tobt, angst, ruft, kraft, namen] = beats(ts, s.cues, 5);
    const weiche = lineAt(0, end - 1);
    const rage = interpolate(t, [tobt - 0.2, tobt + 0.5], [0, 1], clamp);
    const fear = interpolate(t, [angst - 0.15, angst + 0.45], [0, 1], { ...clamp, easing: ease });
    const call = interpolate(t, [ruft - 0.1, ruft + 0.6], [0, 1], { ...clamp, easing: ease });
    const strength = interpolate(t, [kraft - 0.2, kraft + 0.6], [0, 1], { ...clamp, easing: ease });
    const cmd = interpolate(t, [namen - 0.1, namen + 0.6], [0, 1], { ...clamp, easing: ease });
    const gone = interpolate(t, [weiche - 0.05, weiche + 1.5], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
    const beam = Math.max(call * 0.45, strength) * (0.7 + 0.3 * cmd);
    const kneel = Math.max(0, fear - strength);
    light = beam;
    cam = { z: 1, dy: 0, shake: rage * (1 - gone) * (1 - 0.5 * strength) };
    back = <Glory k={beam * 0.85} x={340} spread={0.7} />;
    dark = <Dark id="mD" x={750} k={1.05} rage={rage * (1 - gone)} gone={gone} smoke={1} />;
    mose = (
      <Mose
        x={340}
        pose={{ kneel, bow: 0.55 * fear * (1 - call), raise: call * (1 - cmd), command: cmd, look: 0.3 + 0.4 * call }}
        rim={mix(COLD, GOLD, strength)}
        aura={strength * 0.8}
      />
    );
    front = <Lines t={t} top={360} font="Anton" caps items={s.lines.map((l, i) => ({ text: l.text, at: lineAt(i, weiche), size: 150 }))} />;
    fx = <Sfx frame={voiceFrame(ts, weiche)} name="breath" volume={0.45} keep />;
    tint = { cold: 0.25 * (1 - strength), gold: 0.1 * strength, black: 0.35 * fear * (1 - strength) };
  } else if (s.stage === "worlds") {
    const [erde, menschen, sand] = beats(ts, s.cues, 3);
    const warum = lineAt(0, end - 1);
    const kEarth = popAt(t, erde, 0.6);
    const lit = interpolate(t, [menschen - 0.1, menschen + 1.2, sand, sand + 1.2], [0, 0.45, 0.45, 1], clamp);
    const out = interpolate(t, [warum - 0.4, warum + 0.8], [0, 1], { ...clamp, easing: ease });
    const r = interpolate(out, [0, 1], [190, 120]);
    const ey = interpolate(out, [0, 1], [680, 700]);
    light = 0.75;
    cam = { z: 0.78, dy: 70, shake: 0 };
    back = (
      <>
        <Glory k={0.35} x={540} spread={0.5} />
        <Worlds k={out} />
        <Sand x={540} y={ey} r={r} lit={lit * (1 - 0.3 * out)} />
        <Earth x={540} y={ey} r={r} o={Math.min(1, kEarth * 1.4)} />
      </>
    );
    mose = <Mose x={540} pose={{ look: 1, raise: 0.25 }} rim={GOLD} aura={0.5} />;
    front = <Lines t={t} top={300} font="Cinzel" items={s.lines.map((l, i) => ({ text: l.text, at: lineAt(i, warum), size: 74 }))} />;
    tint = { cold: 0, gold: 0.1, black: 0 };
  } else if (s.stage === "answer") {
    const [werk] = beats(ts, s.cues, 1);
    const ref = wordTime(ts, /1:39/, werk + 1.2);
    const tab = interpolate(t, [werk - 0.5, werk + 0.5], [0, 1], { ...clamp, easing: ease });
    const engrave = interpolate(t, [ref - 0.1, ref + 0.9], [0, 1], clamp);
    light = 0.7;
    cam = { z: 0.8, dy: 120, shake: 0 };
    back = (
      <>
        <Glory k={0.3} x={540} spread={0.5} />
        <Worlds k={1} />
        <Tablet k={tab} engrave={engrave} />
      </>
    );
    mose = <Mose x={540} pose={{ look: 1, raise: 0.15 }} rim={GOLD} aura={0.4} />;
    front = <Lines t={t} top={830} font="Anton" caps items={s.lines.map((l, i) => ({ text: l.text, at: lineAt(i, end - 1.4), size: 76 }))} />;
    fx = <Sfx frame={voiceFrame(ts, ref)} name="warm" volume={0.35} keep />;
    tint = { cold: 0, gold: 0.08, black: 0 };
  }

  const sx = cam.shake ? Math.sin(frame * 1.9) * 9 * cam.shake : 0;
  const sy = cam.shake ? Math.cos(frame * 2.3) * 6 * cam.shake : 0;
  const camT = `translate(${sx} ${cam.dy + sy}) translate(540 ${GROUND}) scale(${cam.z}) translate(-540 ${-GROUND})`;

  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        {back}
        <g transform={camT}>
          <Peak light={light} />
          {dark}
          {mose}
        </g>
        {tint.cold > 0 ? <rect width={1080} height={1920} fill="#1A2A7A" opacity={tint.cold * 0.35} /> : null}
        {tint.gold > 0 ? <rect width={1080} height={1920} fill="#FFC870" opacity={tint.gold * 0.4} /> : null}
        {tint.black > 0 ? <rect width={1080} height={1920} fill="url(#msVig)" opacity={tint.black * 2} /> : null}
        <defs>
          <radialGradient id="msVig" cx="0.5" cy="0.45" r="0.75">
            <stop offset="55%" stopColor="#000" stopOpacity="0" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.85" />
          </radialGradient>
        </defs>
      </svg>
      {front}
      {fx}
    </AbsoluteFill>
  );
};

/** Was gross im Bild steht, wird nicht noch einmal untertitelt. */
export const hidden = (ts: TimelineScene): Set<number> => {
  const s = ts.scene as MosesT;
  const texts: Array<string | undefined> = [s.attack?.text, ...s.lines.map((l) => l.text)];
  if (s.stage === "hook") texts.push("Echt oder Fälschung?");
  const out = wordsOfTexts(ts, texts);
  if (s.stage === "answer") for (const w of ts.words) if (/^Mose$|1:39/.test(w.text)) out.add(w.index);
  return out;
};
