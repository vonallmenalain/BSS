import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, random, spring, useCurrentFrame } from "remotion";
import { useLook } from "../../looks";
import { Sfx, beats, voiceFrame } from "../../lib/sfx";
import { FPS, type TimelineScene } from "../../lib/timing";
import type { Scene } from "../../schema";

/*
 * Palast: Ester und das goldene Zepter (Ester 3–5). Der König sitzt oben auf dem Thron; wer
 * ungerufen kommt, vor dem kreuzen die Wachen die Speere. Hamans Erlass mit Siegel, drei Tage
 * Fasten, und am dritten Tag streckt der König Ester das Zepter entgegen. Alle Takte (`cues`)
 * sind Phrasen der Stimme.
 */

type PalaceSceneT = Extract<Scene, { type: "palace" }>;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const GOLD = "#F5C451";
const GOLD_DEEP = "#B98422";
const SIL = "#150A2B";
/** Boden der Bühne – darauf stehen Wachen, Ester und das Volk */
const GROUND = 1180;
/** Hand des Königs, um die sich das Zepter dreht */
const HAND: [number, number] = [624, 728];
const SCEPTER_LEN = 250;
/** Zepter in Ruhe (leicht schräg nach oben) und ausgestreckt (zu Ester hin) – Grad im Uhrzeigersinn ab «oben» */
const REST = 14;
const OUT = 204;

const rad = (d: number) => (d * Math.PI) / 180;
const tip = (deg: number, len = SCEPTER_LEN): [number, number] => [HAND[0] + Math.sin(rad(deg)) * len, HAND[1] - Math.cos(rad(deg)) * len];

/* ------------------------------------------------------------------ */
/* Bausteine                                                           */
/* ------------------------------------------------------------------ */

const Defs: React.FC = () => (
  <defs>
    <linearGradient id="palGold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stopColor="#FFF0B8" />
      <stop offset="45%" stopColor={GOLD} />
      <stop offset="100%" stopColor={GOLD_DEEP} />
    </linearGradient>
    <linearGradient id="palThrone" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stopColor="#7A4E12" />
      <stop offset="30%" stopColor={GOLD} />
      <stop offset="55%" stopColor="#FFE7A0" />
      <stop offset="100%" stopColor="#6E4410" />
    </linearGradient>
    <radialGradient id="palGlow">
      <stop offset="0%" stopColor="#FFF4C8" stopOpacity="0.95" />
      <stop offset="35%" stopColor={GOLD} stopOpacity="0.45" />
      <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
    </radialGradient>
    <radialGradient id="palRed">
      <stop offset="0%" stopColor="#FF4A3D" stopOpacity="0.55" />
      <stop offset="60%" stopColor="#C21E3A" stopOpacity="0.18" />
      <stop offset="100%" stopColor="#C21E3A" stopOpacity="0" />
    </radialGradient>
    <linearGradient id="palBeam" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#FFF3C4" stopOpacity="0.05" />
      <stop offset="60%" stopColor="#FFE9A8" stopOpacity="0.22" />
      <stop offset="100%" stopColor="#FFE9A8" stopOpacity="0.32" />
    </linearGradient>
    <linearGradient id="palParch" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stopColor="#F4E2B8" />
      <stop offset="70%" stopColor="#E2C68E" />
      <stop offset="100%" stopColor="#C9A867" />
    </linearGradient>
  </defs>
);

/** Geflügelte Sonnenscheibe über dem Thron */
const WingedDisc: React.FC<{ y: number; glow: number }> = ({ y, glow }) => (
  <g transform={`translate(540 ${y})`}>
    <circle r={70} fill="url(#palGlow)" opacity={0.35 + 0.4 * glow} />
    {[1, -1].map((s) => (
      <g key={s} transform={`scale(${s} 1)`}>
        {[0, 1, 2].map((k) => (
          <path key={k} d={`M 26 ${-10 + k * 9} Q ${80 + k * 6} ${-26 + k * 10} ${140 - k * 22} ${-14 + k * 12} Q ${90} ${0 + k * 8} 26 ${4 + k * 8} Z`} fill={GOLD} opacity={0.9 - k * 0.18} />
        ))}
      </g>
    ))}
    <circle r={24} fill="url(#palGold)" stroke="#FFF0B8" strokeWidth={3} />
  </g>
);

/** Das Zepter: goldener Stab mit Knauf; `glint` 0 … 1 lässt ein Funkeln den Stab hinauflaufen */
const Scepter: React.FC<{ deg: number; glint: number; flare: number }> = ({ deg, glint, flare }) => {
  const [tx, ty] = tip(deg);
  const [bx, by] = tip(deg, -38);
  const g = Math.max(0, Math.min(1, glint));
  const gx = bx + (tx - bx) * g;
  const gy = by + (ty - by) * g;
  return (
    <g>
      <line x1={bx} y1={by} x2={tx} y2={ty} stroke="#5A3A0E" strokeWidth={14} strokeLinecap="round" />
      <line x1={bx} y1={by} x2={tx} y2={ty} stroke="url(#palGold)" strokeWidth={9} strokeLinecap="round" />
      <circle cx={tx} cy={ty} r={60 + 50 * flare} fill="url(#palGlow)" opacity={0.35 + 0.65 * flare} />
      <circle cx={tx} cy={ty} r={19} fill="url(#palGold)" stroke="#FFF2C0" strokeWidth={3} />
      <circle cx={tx - 5} cy={ty - 6} r={6} fill="#FFFBEA" opacity={0.85} />
      {glint > 0 && glint < 1.15 ? <Sparkle x={gx} y={gy} r={34} o={Math.sin(Math.PI * Math.min(1, glint))} /> : null}
    </g>
  );
};

/** Vierzackiger Funke */
const Sparkle: React.FC<{ x: number; y: number; r: number; o: number }> = ({ x, y, r, o }) => (
  <g transform={`translate(${x} ${y})`} opacity={o}>
    <circle r={r * 0.9} fill="url(#palGlow)" />
    <path d={`M 0 ${-r} L ${r * 0.16} ${-r * 0.16} L ${r} 0 L ${r * 0.16} ${r * 0.16} L 0 ${r} L ${-r * 0.16} ${r * 0.16} L ${-r} 0 L ${-r * 0.16} ${-r * 0.16} Z`} fill="#FFFBEA" />
  </g>
);

/** Thron mit dem König (von vorn) und dem Zepter in seiner Hand */
const Throne: React.FC<{ scepterDeg: number; glint: number; flare: number; seen: number }> = ({ scepterDeg, glint, flare, seen }) => {
  const frame = useCurrentFrame();
  const breathe = Math.sin(frame / 22) * 2;
  return (
    <g>
      <WingedDisc y={392} glow={flare} />
      {/* Stufen */}
      {[0, 1, 2].map((k) => (
        <g key={k}>
          <rect x={300 + k * 34} y={932 - k * 30} width={480 - k * 68} height={30} fill={k === 0 ? "#2A1550" : "#341A60"} />
          <rect x={300 + k * 34} y={932 - k * 30} width={480 - k * 68} height={4} fill={GOLD} opacity={0.75} />
        </g>
      ))}
      {/* Rückenlehne */}
      <path d="M 392 872 L 392 590 Q 392 470 540 438 Q 688 470 688 590 L 688 872 Z" fill="url(#palThrone)" />
      <path d="M 418 872 L 418 600 Q 418 500 540 474 Q 662 500 662 600 L 662 872 Z" fill="#4A1F6E" />
      <path d="M 418 872 L 418 600 Q 418 500 540 474 Q 662 500 662 600 L 662 872" fill="none" stroke="#FFE7A0" strokeWidth={3} opacity={0.6} />
      {/* Armlehnen */}
      <rect x={366} y={760} width={86} height={22} rx={8} fill="url(#palThrone)" />
      <rect x={628} y={760} width={86} height={22} rx={8} fill="url(#palThrone)" />
      <rect x={372} y={782} width={20} height={90} fill="#8A5A16" />
      <rect x={688} y={782} width={20} height={90} fill="#8A5A16" />
      {/* Sitzfläche */}
      <rect x={400} y={830} width={280} height={42} rx={6} fill="url(#palThrone)" />
      {/* König */}
      {seen > 0 ? <circle cx={540} cy={640} r={190} fill="url(#palGlow)" opacity={0.3 * seen} /> : null}
      <g transform={`translate(0 ${breathe * 0.4})`}>
        {/* Gewand: Schultern, Körper, Knie */}
        <path d={`M 452 632 Q 540 600 628 632 L 650 760 L 668 870 L 412 870 L 430 760 Z`} fill={SIL} stroke={GOLD} strokeOpacity={0.55} strokeWidth={3} />
        <path d="M 540 640 L 540 868" stroke={GOLD} strokeWidth={4} opacity={0.5} />
        {/* Linker Arm auf der Lehne */}
        <path d="M 458 650 Q 420 710 430 766" stroke={SIL} strokeWidth={34} strokeLinecap="round" fill="none" />
        {/* Rechter Arm hält das Zepter */}
        <path d={`M 622 650 Q 650 690 ${HAND[0]} ${HAND[1]}`} stroke={SIL} strokeWidth={34} strokeLinecap="round" fill="none" />
        {/* Kopf, Bart, Krone */}
        <rect x={514} y={596} width={52} height={40} rx={10} fill={SIL} />
        <circle cx={540} cy={566} r={40} fill={SIL} stroke={GOLD} strokeOpacity={0.5} strokeWidth={3} />
        <path d="M 512 584 L 568 584 L 562 632 Q 540 642 518 632 Z" fill="#0C0518" />
        <path d="M 504 536 L 504 488 L 516 504 L 528 482 L 540 502 L 552 482 L 564 504 L 576 488 L 576 536 Z" fill="url(#palGold)" stroke="#FFF0B8" strokeWidth={2} />
        <rect x={502} y={530} width={76} height={10} fill={GOLD_DEEP} />
      </g>
      <Scepter deg={scepterDeg} glint={glint} flare={flare} />
      <circle cx={HAND[0]} cy={HAND[1]} r={15} fill={SIL} />
    </g>
  );
};

/** Wache mit Speer. `side` −1 links, 1 rechts; `cross` 0 … 1 kippt den Speer zur Mitte. */
const Guard: React.FC<{ x: number; side: -1 | 1; cross: number; opacity?: number }> = ({ x, side, cross, opacity = 1 }) => {
  const s = -side; // Blick zur Mitte
  const hand: [number, number] = [x + s * 58, 970];
  const deg = s * 40 * cross;
  const up = 430;
  const down = 190;
  const tx = hand[0] + Math.sin(rad(deg)) * up;
  const ty = hand[1] - Math.cos(rad(deg)) * up;
  const ex = hand[0] - Math.sin(rad(deg)) * down;
  const ey = hand[1] + Math.cos(rad(deg)) * down;
  return (
    <g opacity={opacity}>
      <ellipse cx={x} cy={GROUND + 4} rx={80} ry={12} fill="#000" opacity={0.35} />
      {/* Beine, Gewand, Oberkörper */}
      <path d={`M ${x - 26} ${GROUND} L ${x - 20} ${GROUND - 120} M ${x + 26} ${GROUND} L ${x + 20} ${GROUND - 120}`} stroke={SIL} strokeWidth={26} strokeLinecap="round" />
      <path d={`M ${x - 62} ${GROUND - 90} L ${x - 44} ${GROUND - 300} L ${x + 44} ${GROUND - 300} L ${x + 62} ${GROUND - 90} Z`} fill={SIL} stroke={GOLD} strokeOpacity={0.4} strokeWidth={2} />
      <path d={`M ${x - 62} ${GROUND - 120} L ${x + 62} ${GROUND - 120}`} stroke={GOLD} strokeWidth={6} opacity={0.6} />
      {/* Schild auf der äusseren Seite */}
      <ellipse cx={x - s * 52} cy={GROUND - 210} rx={42} ry={58} fill="#241046" stroke={GOLD} strokeWidth={4} opacity={0.95} />
      <circle cx={x - s * 52} cy={GROUND - 210} r={10} fill={GOLD} />
      {/* Kopf mit hoher Mütze */}
      <circle cx={x} cy={GROUND - 336} r={30} fill={SIL} />
      <path d={`M ${x - 30} ${GROUND - 350} L ${x - 22} ${GROUND - 420} L ${x + 22} ${GROUND - 420} L ${x + 30} ${GROUND - 350} Z`} fill={SIL} stroke={GOLD} strokeOpacity={0.5} strokeWidth={2} />
      <path d={`M ${x - 26} ${GROUND - 384} L ${x + 26} ${GROUND - 384}`} stroke={GOLD} strokeWidth={4} opacity={0.6} />
      {/* Arm zum Speer */}
      <path d={`M ${x + s * 30} ${GROUND - 280} Q ${x + s * 54} ${GROUND - 250} ${hand[0]} ${hand[1]}`} stroke={SIL} strokeWidth={20} strokeLinecap="round" fill="none" />
      {/* Speer */}
      <line x1={ex} y1={ey} x2={tx} y2={ty} stroke="#6B4A22" strokeWidth={9} strokeLinecap="round" />
      <path
        d={`M ${tx} ${ty} l ${Math.sin(rad(deg + 90)) * 12} ${-Math.cos(rad(deg + 90)) * 12} l ${Math.sin(rad(deg)) * 44 - Math.sin(rad(deg + 90)) * 12} ${-Math.cos(rad(deg)) * 44 + Math.cos(rad(deg + 90)) * 12} l ${-Math.sin(rad(deg)) * 44 - Math.sin(rad(deg + 90)) * 12} ${Math.cos(rad(deg)) * 44 + Math.cos(rad(deg + 90)) * 12} Z`}
        fill="url(#palGold)"
      />
      <circle cx={hand[0]} cy={hand[1]} r={12} fill={SIL} />
    </g>
  );
};

/** Ester von hinten. `rise` 0 = kniend im Gebet, 1 = stehend; `royal` = Krone und Gold am Gewand */
const Esther: React.FC<{ x: number; y: number; rise: number; royal: boolean; scale?: number; lit?: number }> = ({ x, y, rise, royal, scale = 1, lit = 0 }) => {
  const r = Math.max(0, Math.min(1, rise));
  const gownH = 130 + 180 * r;
  const gownW = 300 - 90 * r;
  const waistW = 110 - 26 * r;
  const torsoH = 96 + 24 * r;
  const waistY = -gownH;
  const shoulderY = waistY - torsoH;
  const headY = shoulderY - 36 + 26 * (1 - r);
  const fill = royal ? "#2C1052" : "#1A0C30";
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      {lit > 0 ? <ellipse cx={0} cy={-150} rx={240} ry={300} fill="url(#palGlow)" opacity={0.45 * lit} /> : null}
      <ellipse cx={0} cy={4} rx={gownW * 0.6} ry={14} fill="#000" opacity={0.35} />
      {/* Gewand */}
      <path d={`M ${-waistW / 2} ${waistY} Q ${-gownW * 0.45} ${waistY + gownH * 0.55} ${-gownW / 2} 0 L ${gownW / 2} 0 Q ${gownW * 0.45} ${waistY + gownH * 0.55} ${waistW / 2} ${waistY} Z`} fill={fill} />
      {royal ? <path d={`M ${-gownW / 2} -4 L ${gownW / 2} -4`} stroke={GOLD} strokeWidth={8} opacity={0.85} /> : null}
      {/* Oberkörper */}
      <path d={`M ${-waistW / 2} ${waistY} L ${-62} ${shoulderY + 12} Q 0 ${shoulderY - 6} 62 ${shoulderY + 12} L ${waistW / 2} ${waistY} Z`} fill={fill} />
      {royal ? <path d={`M ${-waistW / 2} ${waistY} L ${waistW / 2} ${waistY}`} stroke={GOLD} strokeWidth={6} opacity={0.8} /> : null}
      {/* Kopf und Schleier, der über den Rücken fällt */}
      <circle cx={0} cy={headY} r={34} fill={fill} />
      <path d={`M -36 ${headY - 6} Q -58 ${shoulderY + 60} -44 ${waistY + gownH * 0.5} L 44 ${waistY + gownH * 0.5} Q 58 ${shoulderY + 60} 36 ${headY - 6} Q 0 ${headY - 44} -36 ${headY - 6} Z`} fill={royal ? "#5A2A86" : "#3A2058"} opacity={0.9} />
      {royal ? (
        <path d={`M -28 ${headY - 26} L -24 ${headY - 52} L -12 ${headY - 38} L 0 ${headY - 58} L 12 ${headY - 38} L 24 ${headY - 52} L 28 ${headY - 26} Z`} fill="url(#palGold)" stroke="#FFF0B8" strokeWidth={2} />
      ) : null}
      {/* Lichtkante */}
      <path d={`M -36 ${headY - 6} Q 0 ${headY - 44} 36 ${headY - 6}`} stroke={GOLD} strokeWidth={3} fill="none" opacity={0.5 + 0.5 * lit} />
    </g>
  );
};

type PersonSpot = { x: number; y: number; s: number; d: number };

/** Das Volk: kleine Figuren in Reihen. `show` blendet sie ein, `gold` färbt sie golden, `red` lässt sie bedroht wirken. */
const People: React.FC<{ spots: PersonSpot[]; show: number; gold: number; red: number }> = ({ spots, show, gold, red }) => (
  <g>
    {spots.map((p, i) => {
      const o = interpolate(show, [p.d, p.d + 0.25], [0, 1], clamp);
      if (o <= 0) return null;
      const g = interpolate(gold, [p.d, p.d + 0.3], [0, 1], clamp);
      const pop = interpolate(o, [0, 1], [10, 0]);
      const base = red > 0 ? `rgba(${Math.round(140 + 80 * red)},${Math.round(120 - 60 * red)},${Math.round(190 - 110 * red)},1)` : "#8C7AC0";
      const col = g > 0.5 ? GOLD : base;
      return (
        <g key={i} transform={`translate(${p.x} ${p.y + pop}) scale(${p.s})`} opacity={o * (0.55 + 0.45 * g)}>
          {g > 0 ? <circle cx={0} cy={-26} r={34} fill="url(#palGlow)" opacity={0.6 * g} /> : null}
          <circle cx={0} cy={-44} r={9} fill={col} />
          <path d="M -13 0 Q -14 -26 0 -32 Q 14 -26 13 0 Z" fill={col} />
        </g>
      );
    })}
  </g>
);

/** Volk am Boden der Bühne, links und rechts (Mitte frei für Ester) oder über die ganze Breite */
const useCrowd = (key: string, gapCenter: boolean): PersonSpot[] =>
  useMemo(() => {
    const out: PersonSpot[] = [];
    const rows = [
      { y: 1040, s: 1.25, n: 16 },
      { y: 1110, s: 1.45, n: 14 },
      { y: 1178, s: 1.65, n: 12 },
    ];
    rows.forEach((row, r) => {
      for (let i = 0; i < row.n; i++) {
        const x = 70 + ((i + (r % 2) * 0.5) / (row.n - 0.5)) * 940 + (random(`${key}x${r}-${i}`) - 0.5) * 22;
        if (gapCenter && x > 400 && x < 680) continue;
        // Von der Mitte nach aussen einblenden
        const d = Math.abs(x - 540) / 540 * 0.75 + random(`${key}d${r}-${i}`) * 0.12;
        out.push({ x, y: row.y + (random(`${key}y${r}-${i}`) - 0.5) * 12, s: row.s, d });
      }
    });
    return out;
  }, [key, gapCenter]);

/** Mondsichel – leuchtet, wenn ihr Tag gefastet ist */
const Moon: React.FC<{ x: number; y: number; lit: number; label: string; font: string }> = ({ x, y, lit, label, font }) => (
  <g>
    <circle cx={x} cy={y} r={110} fill="url(#palGlow)" opacity={0.55 * lit} />
    <mask id={`moonMask${x}`}>
      <rect x={x - 80} y={y - 80} width={160} height={160} fill="white" />
      <circle cx={x + 26} cy={y - 16} r={50} fill="black" />
    </mask>
    <circle cx={x} cy={y} r={56} fill={lit > 0.5 ? GOLD : "#3A2A62"} mask={`url(#moonMask${x})`} opacity={0.5 + 0.5 * lit} />
    <circle cx={x} cy={y} r={56} fill="none" stroke={GOLD} strokeWidth={2} strokeDasharray="4 8" opacity={0.4 * (1 - lit)} />
    <text x={x} y={y + 108} textAnchor="middle" fontFamily={font} fontWeight={700} fontSize={34} letterSpacing={4} fill={lit > 0.5 ? GOLD : "rgba(255,247,230,0.45)"}>
      {label}
    </text>
  </g>
);

/** Kleine Keilschrift-Zeile aus Strichen und Keilen */
const Cuneiform: React.FC<{ x: number; y: number; w: number; seed: string; reveal: number }> = ({ x, y, w, seed, reveal }) => {
  const marks = useMemo(() => {
    const out: Array<{ dx: number; kind: number; rot: number }> = [];
    let dx = 0;
    let k = 0;
    while (dx < w) {
      const kind = Math.floor(random(`${seed}k${k}`) * 3);
      out.push({ dx, kind, rot: random(`${seed}r${k}`) > 0.6 ? 90 : 0 });
      dx += 22 + random(`${seed}g${k}`) * 16 + (random(`${seed}s${k}`) > 0.86 ? 24 : 0);
      k++;
    }
    return out;
  }, [seed, w]);
  return (
    <g>
      {marks.map((m, i) => {
        if (m.dx > w * reveal) return null;
        const cx = x + m.dx;
        return (
          <g key={i} transform={`rotate(${m.rot} ${cx} ${y})`} fill="#5A3A1C">
            <path d={`M ${cx - 7} ${y - 10} L ${cx + 7} ${y - 10} L ${cx} ${y - 2} Z`} />
            {m.kind > 0 ? <rect x={cx - 1.5} y={y - 4} width={3} height={14} /> : null}
            {m.kind > 1 ? <path d={`M ${cx + 6} ${y + 2} L ${cx + 14} ${y + 6} L ${cx + 6} ${y + 10} Z`} /> : null}
          </g>
        );
      })}
    </g>
  );
};

/* ------------------------------------------------------------------ */
/* Etappen                                                             */
/* ------------------------------------------------------------------ */

const useT = (ts: TimelineScene) => (useCurrentFrame() - ts.audioOffsetFrames) / FPS;

/** Das Gesetz: Wachen kreuzen die Speere – nur das Zepter rettet */
const Law: React.FC<{ ts: TimelineScene; s: PalaceSceneT }> = ({ ts, s }) => {
  const frame = useCurrentFrame();
  const t = useT(ts);
  const [die, zep] = beats(ts, s.cues, 2);
  const walk = interpolate(t, [die - 0.35, die + 0.25], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const crossAt = die + 0.2;
  const cross = spring({ frame: frame - voiceFrame(ts, crossAt), fps: FPS, config: { damping: 11, stiffness: 160 } });
  const red = interpolate(t, [crossAt, crossAt + 0.3], [0, 1], clamp) * interpolate(t, [zep, zep + 1], [1, 0.35], clamp);
  const pulse = 0.75 + 0.25 * Math.sin(frame / 4);
  const glint = interpolate(t, [zep, zep + 0.9], [0, 1.1], clamp);
  const flare = interpolate(t, [zep + 0.6, zep + 1.0, zep + 2.4], [0, 1, 0.55], clamp);
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <Defs />
        <Throne scepterDeg={REST - 8 * flare} glint={glint} flare={flare} seen={0} />
        {red > 0 ? <ellipse cx={540} cy={820} rx={520} ry={420} fill="url(#palRed)" opacity={red * pulse} /> : null}
        <Guard x={interpolate(walk, [0, 1], [-140, 300])} side={-1} cross={cross} />
        <Guard x={interpolate(walk, [0, 1], [1220, 780])} side={1} cross={cross} />
      </svg>
      <Sfx frame={voiceFrame(ts, die - 0.3)} name="whoosh" volume={0.35} />
      <Sfx frame={voiceFrame(ts, crossAt + 0.12)} name="clash" volume={0.5} />
      <Sfx frame={voiceFrame(ts, zep + 0.1)} name="chime" volume={0.45} />
    </AbsoluteFill>
  );
};

/** Hamans Erlass: Schriftrolle, Siegel, das ganze Volk, ein Datum */
const Decree: React.FC<{ ts: TimelineScene; s: PalaceSceneT }> = ({ ts, s }) => {
  const frame = useCurrentFrame();
  const look = useLook();
  const t = useT(ts);
  const [haman, volk, tag] = beats(ts, s.cues, 3);
  const crowd = useCrowd("dec", false);
  const unroll = interpolate(frame, [4, 30], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const top = 320;
  const bottom = top + 560 * unroll;
  const seal = spring({ frame: frame - voiceFrame(ts, haman), fps: FPS, config: { damping: 9, stiffness: 220 } });
  const sealOn = t >= haman - 0.02;
  const date = spring({ frame: frame - voiceFrame(ts, tag), fps: FPS, config: { damping: 10, stiffness: 200 } });
  const dateOn = t >= tag - 0.02;
  const show = interpolate(t, [volk - 0.05, volk + 0.9], [0, 1.1], clamp);
  const red = interpolate(t, [tag + 0.1, tag + 0.6], [0, 1], clamp);
  const shake = dateOn && frame - voiceFrame(ts, tag) < 8 ? Math.sin((frame - voiceFrame(ts, tag)) * 2.4) * 6 : 0;
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <Defs />
        <g transform={`translate(${shake} 0)`}>
          {/* Rolle */}
          <rect x={232} y={top + 6} width={616} height={bottom - top} fill="rgba(0,0,0,0.4)" transform="translate(10 14)" />
          <rect x={232} y={top} width={616} height={bottom - top} fill="url(#palParch)" />
          <rect x={232} y={top} width={616} height={bottom - top} fill="none" stroke="#A9823F" strokeWidth={3} />
          {[top, bottom].map((y, i) => (
            <g key={i}>
              <rect x={208} y={y - 18} width={664} height={36} rx={18} fill="url(#palThrone)" />
              <circle cx={204} cy={y} r={20} fill={GOLD_DEEP} />
              <circle cx={876} cy={y} r={20} fill={GOLD_DEEP} />
            </g>
          ))}
          <clipPath id="decClip">
            <rect x={232} y={top + 18} width={616} height={Math.max(0, bottom - top - 36)} />
          </clipPath>
          <g clipPath="url(#decClip)">
            <text x={540} y={top + 96} textAnchor="middle" fontFamily={look.label} fontWeight={700} fontSize={46} letterSpacing={6} fill="#5A3A1C">
              ERLASS
            </text>
            <path d={`M 330 ${top + 120} L 750 ${top + 120}`} stroke="#5A3A1C" strokeWidth={2} opacity={0.5} />
            {Array.from({ length: 8 }, (_, i) => (
              <Cuneiform key={i} x={290} y={top + 175 + i * 46} w={i === 7 ? 260 : 480} seed={`cu${i}`} reveal={interpolate(frame, [10 + i * 4, 34 + i * 4], [0, 1], clamp)} />
            ))}
          </g>
          {/* Siegel */}
          {sealOn ? (
            <g transform={`translate(704 ${top + 486}) scale(${interpolate(seal, [0, 1], [2.4, 1])}) rotate(${interpolate(seal, [0, 1], [-30, -8])})`} opacity={Math.min(1, seal * 2)}>
              <circle r={62} fill="#9E1B26" />
              <circle r={62} fill="none" stroke="#6E0F18" strokeWidth={6} />
              {Array.from({ length: 10 }, (_, k) => (
                <circle key={k} cx={Math.cos((k / 10) * Math.PI * 2) * 66} cy={Math.sin((k / 10) * Math.PI * 2) * 66} r={9} fill="#9E1B26" />
              ))}
              <circle r={38} fill="none" stroke="#D9535C" strokeWidth={3} opacity={0.7} />
              {Array.from({ length: 8 }, (_, k) => (
                <ellipse key={k} cx={0} cy={-18} rx={6} ry={16} fill="#D9535C" opacity={0.75} transform={`rotate(${k * 45})`} />
              ))}
            </g>
          ) : null}
          {sealOn ? (
            <text x={604} y={top + 500} textAnchor="end" fontFamily={look.label} fontWeight={700} fontSize={40} letterSpacing={4} fill="#9E1B26" opacity={interpolate(t, [haman + 0.15, haman + 0.5], [0, 1], clamp)}>
              HAMAN
            </text>
          ) : null}
          {/* Datum */}
          {dateOn ? (
            <g transform={`translate(540 ${top + 330}) rotate(-7) scale(${interpolate(date, [0, 1], [2.2, 1])})`} opacity={Math.min(1, date * 1.6)}>
              <rect x={-250} y={-82} width={500} height={150} rx={18} fill="rgba(158,27,38,0.1)" stroke="#B5212F" strokeWidth={9} />
              <text x={0} y={36} textAnchor="middle" fontFamily={look.label} fontWeight={700} fontSize={104} letterSpacing={6} fill="#B5212F">
                13. ADAR
              </text>
            </g>
          ) : null}
        </g>
        <People spots={crowd} show={show} gold={0} red={red} />
      </svg>
      <Sfx frame={4} name="swipe" volume={0.3} />
      <Sfx frame={voiceFrame(ts, haman)} name="stamp" volume={0.55} />
      <Sfx frame={voiceFrame(ts, volk)} name="whoosh" volume={0.3} />
      <Sfx frame={voiceFrame(ts, tag)} name="drum" volume={0.55} />
    </AbsoluteFill>
  );
};

/** Drei Tage fasten: drei Monde, das Tor zum König, Ester steht auf */
const Days: React.FC<{ ts: TimelineScene; s: PalaceSceneT }> = ({ ts, s }) => {
  const look = useLook();
  const t = useT(ts);
  const [tage, koenig, um] = beats(ts, s.cues, 3);
  const moonAt = [tage, tage + 0.38, tage + 0.76];
  const lit = moonAt.map((a) => interpolate(t, [a, a + 0.25], [0, 1], clamp));
  const door = interpolate(t, [koenig, koenig + 0.6], [0, 1], clamp);
  const rise = interpolate(t, [um, um + 0.9], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <Defs />
        {["TAG 1", "TAG 2", "TAG 3"].map((label, i) => (
          <Moon key={i} x={300 + i * 240} y={400} lit={lit[i]} label={label} font={look.label} />
        ))}
        {/* Tor zum Thronsaal */}
        <g>
          <path d="M 400 1040 L 400 760 Q 400 640 540 618 Q 680 640 680 760 L 680 1040 Z" fill="#12082A" stroke={GOLD} strokeWidth={4} opacity={0.9} />
          <path d="M 400 1040 L 400 760 Q 400 640 540 618 Q 680 640 680 760 L 680 1040 Z" fill="url(#palGlow)" opacity={0.85 * door} />
          <path d="M 540 625 L 540 1040" stroke={GOLD} strokeWidth={3} opacity={0.5 * (1 - door)} />
          {door > 0 ? <path d={`M 400 1040 L 680 1040 L ${760 + 80 * door} 1180 L ${320 - 80 * door} 1180 Z`} fill="url(#palBeam)" opacity={door} /> : null}
        </g>
        <Esther x={540} y={1172} rise={rise} royal={false} lit={door * 0.7} />
      </svg>
      {moonAt.map((a, i) => (
        <Sfx key={i} frame={voiceFrame(ts, a)} name="tick" volume={0.4} />
      ))}
      <Sfx frame={voiceFrame(ts, koenig)} name="chime" volume={0.35} />
      <Sfx frame={voiceFrame(ts, um)} name="drum" volume={0.45} />
    </AbsoluteFill>
  );
};

/** Am dritten Tag: Ester tritt ein, der König sieht sie, das Zepter – und das Volk ist gerettet */
const ScepterStage: React.FC<{ ts: TimelineScene; s: PalaceSceneT }> = ({ ts, s }) => {
  const frame = useCurrentFrame();
  const t = useT(ts);
  const [enter, seen, reach, saved] = beats(ts, s.cues, 4);
  const crowd = useCrowd("sav", true);
  const walk = interpolate(t, [enter, enter + 1.8], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const sway = walk < 1 ? Math.sin(t * 7) * 2.2 * (1 - walk) : 0;
  const spot = interpolate(t, [seen, seen + 0.5], [0, 1], clamp);
  const ext = spring({ frame: frame - voiceFrame(ts, reach + 0.15), fps: FPS, config: { damping: 13, stiffness: 70, mass: 1.1 } });
  const deg = REST + (OUT - REST) * ext;
  const flare = interpolate(ext, [0.7, 1], [0, 1], clamp);
  const burstT = t - (reach + 1.0);
  const warm = interpolate(t, [reach + 0.8, reach + 1.6], [0, 1], clamp);
  const savedShow = interpolate(t, [saved - 0.05, saved + 1.1], [0, 1.1], clamp);
  const guardsOut = interpolate(t, [saved - 0.1, saved + 0.5], [1, 0], clamp);
  const [tx, ty] = tip(deg);
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <Defs />
        <Throne scepterDeg={deg} glint={interpolate(t, [reach + 0.15, reach + 0.9], [0, 1.1], clamp)} flare={flare} seen={spot} />
        <Guard x={190} side={-1} cross={0} opacity={guardsOut} />
        <Guard x={890} side={1} cross={0} opacity={guardsOut} />
        {spot > 0 ? <path d={`M 470 300 L 610 300 L ${720} 1180 L ${360} 1180 Z`} fill="url(#palBeam)" opacity={spot} /> : null}
        <People spots={crowd} show={savedShow} gold={savedShow} red={0} />
        <g transform={`rotate(${sway} 540 1180)`}>
          <Esther x={540} y={1180 + 460 * (1 - walk)} rise={1} royal scale={1 + 0.1 * (1 - walk)} lit={spot} />
        </g>
        {burstT > 0 && burstT < 1.4
          ? Array.from({ length: 14 }, (_, i) => {
              const a = (i / 14) * Math.PI * 2;
              const r = 30 + burstT * 260;
              return <Sparkle key={i} x={tx + Math.cos(a) * r} y={ty + Math.sin(a) * r} r={14 + 8 * (i % 2)} o={Math.max(0, 1 - burstT / 1.4)} />;
            })
          : null}
      </svg>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 70% 50% at 50% 55%, rgba(255,210,120,${0.16 * warm}) 0%, rgba(0,0,0,0) 70%)` }} />
      <Sfx frame={voiceFrame(ts, enter)} name="whoosh" volume={0.3} />
      <Sfx frame={voiceFrame(ts, seen)} name="question" volume={0.3} />
      <Sfx frame={voiceFrame(ts, reach + 0.9)} name="chime" volume={0.5} />
      <Sfx frame={voiceFrame(ts, reach + 1.0)} name="unlock" volume={0.35} />
      <Sfx frame={voiceFrame(ts, saved)} name="levelup" volume={0.4} />
    </AbsoluteFill>
  );
};

export const PalaceScene: React.FC<{ ts: TimelineScene }> = ({ ts }) => {
  const s = ts.scene as PalaceSceneT;
  switch (s.stage) {
    case "law":
      return <Law ts={ts} s={s} />;
    case "decree":
      return <Decree ts={ts} s={s} />;
    case "days":
      return <Days ts={ts} s={s} />;
    case "scepter":
      return <ScepterStage ts={ts} s={s} />;
  }
};
