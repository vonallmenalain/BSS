import React from "react";
import { interpolate, spring, useCurrentFrame } from "remotion";
import { FPS, type TimelineScene, findCue } from "../../lib/timing";

/*
 * Bausteine für drei Folgen der Woche zum Schriftstudium – die Messingplatten (`quest`), die
 * Versuchung in der Wüste (`wilderness`) und Josias Fund im Tempel (`templefind`): Gestalten im
 * Gewand als Silhouette mit Streiflicht, die Messingplatten, eine Schriftrolle und ein Stempel.
 */

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Sekunden ab Einsatz der Stimme. */
export const useT = (ts: TimelineScene) => (useCurrentFrame() - ts.audioOffsetFrames) / FPS;

/** Die Wort-Indizes, die einen der Texte wörtlich sprechen – auch Stück für Stück (an Satzzeichen getrennt). */
export const wordsOfTexts = (ts: TimelineScene, texts: Array<string | undefined>): Set<number> => {
  const out = new Set<number>();
  for (const text of texts) {
    if (!text) continue;
    const parts = [text, ...text.split(/[.!?:;–—]+/)].map((p) => p.trim()).filter((p) => p.length > 1);
    for (const part of parts) {
      const c = findCue(ts.words, part);
      if (c) for (let k = c.first; k <= c.last; k++) out.add(ts.words[k].index);
    }
  }
  return out;
};

/** Ein weicher Auftritt ab einem Zeitpunkt (Sekunden ab Stimme). */
export const usePop = (ts: TimelineScene, at: number, config = { damping: 13, stiffness: 190 }) => {
  const frame = useCurrentFrame();
  return spring({ frame: frame - ts.audioOffsetFrames - Math.round(at * FPS), fps: FPS, config });
};

/* ------------------------------------------------------------------ */
/* Gestalt im Gewand                                                   */
/* ------------------------------------------------------------------ */

type Pt = [number, number];
const lerp = (a: Pt, b: Pt, k: number): Pt => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];

/** Pose: Arme (0 hängend … 1 Ziel), Schritt (Phase in Radiant) und Neigung des Kopfes. */
export type RobePose = { reach?: number; raise?: number; hold?: number; step?: number; bow?: number; hood?: boolean; crown?: number };

const RobeShape: React.FC<{ fill: string; pose: RobePose }> = ({ fill, pose }) => {
  const { reach = 0, raise = 0, hold = 0, step, bow = 0, hood = true, crown = 0 } = pose;
  const walking = step !== undefined;
  const sway = walking ? Math.sin(step) * 10 : 0;
  const bob = walking ? Math.abs(Math.sin(step)) * -5 : 0;
  // Arm vorne: hängend → nach vorn gestreckt (reach) → hochgehoben (raise) → vor der Brust haltend (hold)
  const hang = { e: [34, -178] as Pt, h: [40, -120] as Pt };
  const fwd = { e: [78, -206] as Pt, h: [128, -214] as Pt };
  const up = { e: [52, -290] as Pt, h: [62, -352] as Pt };
  const chest = { e: [52, -170] as Pt, h: [20, -196] as Pt };
  let e = hang.e;
  let h = hang.h;
  if (raise > 0) {
    e = lerp(hang.e, up.e, raise);
    h = lerp(hang.h, up.h, raise);
  } else if (hold > 0) {
    e = lerp(hang.e, chest.e, hold);
    h = lerp(hang.h, chest.h, hold);
  } else if (reach > 0) {
    e = lerp(hang.e, fwd.e, reach);
    h = lerp(hang.h, fwd.h, reach);
  }
  const be = raise > 0 ? lerp([-30, -178], [-50, -290], raise) : hold > 0 ? lerp([-30, -178], [-40, -168], hold) : ([-30 + sway * 0.4, -178] as Pt);
  const bh = raise > 0 ? lerp([-34, -120], [-58, -352], raise) : hold > 0 ? lerp([-34, -120], [0, -192], hold) : ([-36 + sway * 0.8, -120] as Pt);
  const hx = 4 + bow * 14;
  const hy = -282 + bow * 16 + bob;
  return (
    <g>
      {/* Arm hinten */}
      <path d={`M -24 ${-236 + bob} L ${be[0]} ${be[1] + bob} L ${bh[0]} ${bh[1] + bob}`} stroke={fill} strokeWidth={21} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Gewand */}
      <path
        d={`M -30 ${-246 + bob} C -44 -180, ${-54 - sway * 0.3} -90, ${-62 + sway} 0 L ${62 + sway} 0 C ${56 + sway * 0.3} -90, 46 -180, 30 ${-246 + bob} Q 0 ${-262 + bob} -30 ${-246 + bob} Z`}
        fill={fill}
      />
      {/* Kopf, Tuch */}
      <circle cx={hx} cy={hy} r={25} fill={fill} />
      {hood ? <path d={`M ${hx - 31} ${hy + 2} C ${hx - 34} ${hy - 40}, ${hx + 30} ${hy - 42}, ${hx + 30} ${hy - 2} L ${hx + 34} ${hy + 44} L ${hx - 38} ${hy + 46} Z`} fill={fill} /> : null}
      {crown > 0 ? (
        <g transform={`translate(${hx} ${hy - 30 - (1 - crown) * 60})`} opacity={Math.min(1, crown * 1.5)}>
          <path d="M -22 8 L -24 -14 L -12 -2 L 0 -20 L 12 -2 L 24 -14 L 22 8 Z" fill="#F5C451" stroke="#FFF0B8" strokeWidth={2} />
          <circle cx={0} cy={-20} r={3.5} fill="#FFF0B8" />
        </g>
      ) : null}
      {/* Arm vorne */}
      <path d={`M 24 ${-236 + bob} L ${e[0]} ${e[1] + bob} L ${h[0]} ${h[1] + bob}`} stroke={fill} strokeWidth={21} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </g>
  );
};

/**
 * Eine Gestalt im langen Gewand, von der Seite – dunkel, mit einem Streiflicht in `rim`.
 * Ursprung zwischen den Füssen; bei k = 1 knapp 310 hoch. `dir` −1 schaut nach links.
 */
export const Robed: React.FC<{
  x: number;
  y: number;
  k?: number;
  dir?: 1 | -1;
  fill?: string;
  rim?: string;
  rimSide?: 1 | -1;
  pose?: RobePose;
  o?: number;
  shadow?: boolean;
}> = ({ x, y, k = 1, dir = 1, fill = "#120C0A", rim, rimSide = 1, pose = {}, o = 1, shadow = true }) => (
  <g transform={`translate(${x} ${y}) scale(${dir * k} ${k})`} opacity={o}>
    {shadow ? <ellipse cx={0} cy={3} rx={78} ry={10} fill="#000" opacity={0.35} /> : null}
    {rim ? (
      <g transform={`translate(${rimSide * 5} -2)`}>
        <RobeShape fill={rim} pose={pose} />
      </g>
    ) : null}
    <RobeShape fill={fill} pose={pose} />
  </g>
);

/* ------------------------------------------------------------------ */
/* Die Messingplatten                                                  */
/* ------------------------------------------------------------------ */

/** Ein Stapel gravierter Messingtafeln mit drei Ringen – Mitte bei (x, y), `w` breit. */
export const BrassPlates: React.FC<{ x: number; y: number; w?: number; glow?: number; seed?: string; tilt?: number }> = ({ x, y, w = 300, glow = 0, tilt = -6 }) => {
  const frame = useCurrentFrame();
  const h = w * 1.25;
  const sheets = 4;
  return (
    <g transform={`translate(${x} ${y}) rotate(${tilt})`}>
      <defs>
        <linearGradient id="kaBrass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFE7A3" />
          <stop offset="35%" stopColor="#E0A93E" />
          <stop offset="70%" stopColor="#B57A22" />
          <stop offset="100%" stopColor="#7A4E14" />
        </linearGradient>
        <radialGradient id="kaBrassGlow">
          <stop offset="0%" stopColor="#FFE9A8" stopOpacity="0.9" />
          <stop offset="45%" stopColor="#F6B94A" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#F6B94A" stopOpacity="0" />
        </radialGradient>
      </defs>
      {glow > 0 ? <circle r={w * 1.15} fill="url(#kaBrassGlow)" opacity={glow * (0.85 + 0.15 * Math.sin(frame / 7))} /> : null}
      {Array.from({ length: sheets }, (_, i) => {
        const off = (sheets - 1 - i) * w * 0.035;
        return (
          <g key={i} transform={`translate(${off} ${-off})`}>
            <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={w * 0.03} fill={i === sheets - 1 ? "url(#kaBrass)" : "#8C5C1A"} stroke="#5A3A0E" strokeWidth={w * 0.012} />
          </g>
        );
      })}
      {/* Gravur: Zeilen aus kleinen Zeichen */}
      {Array.from({ length: 11 }, (_, r) => (
        <g key={r}>
          {Array.from({ length: 9 }, (_, c) => {
            const len = w * (0.045 + ((r * 7 + c * 13) % 5) * 0.012);
            const gx = -w / 2 + w * 0.2 + c * w * 0.078;
            const gy = -h / 2 + h * 0.12 + r * h * 0.075;
            return <rect key={c} x={gx} y={gy} width={len} height={w * 0.016} rx={w * 0.006} fill="#6E4410" opacity={0.65} />;
          })}
        </g>
      ))}
      {/* Ringe */}
      {[-0.32, 0, 0.32].map((f, i) => (
        <g key={i}>
          <ellipse cx={-w / 2 + w * 0.08} cy={f * h} rx={w * 0.07} ry={w * 0.05} fill="none" stroke="#4A2E0A" strokeWidth={w * 0.03} />
          <ellipse cx={-w / 2 + w * 0.08} cy={f * h} rx={w * 0.07} ry={w * 0.05} fill="none" stroke="#F0C35A" strokeWidth={w * 0.014} />
        </g>
      ))}
      {/* Glanzlicht */}
      <path d={`M ${-w * 0.35} ${-h * 0.5} L ${-w * 0.15} ${-h * 0.5} L ${w * 0.25} ${h * 0.5} L ${w * 0.05} ${h * 0.5} Z`} fill="#FFF6D6" opacity={0.18 + 0.12 * Math.sin(frame / 11)} />
    </g>
  );
};

/* ------------------------------------------------------------------ */
/* Stempel                                                             */
/* ------------------------------------------------------------------ */

/** Ein Stempel, der aufs Bild knallt – `pop` 0 … 1 (Feder). */
export const Stamp: React.FC<{ x: number; y: number; text: string; color: string; pop: number; rot?: number; size?: number; font: string }> = ({ x, y, text, color, pop, rot = -8, size = 64, font }) => {
  if (pop <= 0.001) return null;
  const w = text.length * size * 0.72 + size * 1.1;
  const hgt = size * 1.6;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${interpolate(pop, [0, 1], [2.3, 1])})`} opacity={Math.min(1, pop * 1.8)}>
      <rect x={-w / 2} y={-hgt / 2} width={w} height={hgt} rx={size * 0.22} fill="rgba(0,0,0,0.25)" stroke={color} strokeWidth={size * 0.13} />
      <rect x={-w / 2 + size * 0.16} y={-hgt / 2 + size * 0.16} width={w - size * 0.32} height={hgt - size * 0.32} rx={size * 0.14} fill="none" stroke={color} strokeWidth={size * 0.04} opacity={0.7} />
      <text x={0} y={size * 0.36} textAnchor="middle" fontFamily={font} fontWeight={700} fontSize={size} letterSpacing={size * 0.08} fill={color}>
        {text}
      </text>
    </g>
  );
};

/* ------------------------------------------------------------------ */
/* Schriftrolle                                                        */
/* ------------------------------------------------------------------ */

/** Eine waagrecht aufrollende Schriftrolle, Mitte bei (x, y). `open` 0 … 1; Inhalt als Kinder (Koordinaten relativ zur Mitte). */
export const Scroll: React.FC<{ x: number; y: number; w: number; h: number; open: number; children?: React.ReactNode; id: string; tone?: "light" | "old" }> = ({
  x,
  y,
  w,
  h,
  open,
  children,
  id,
  tone = "light",
}) => {
  const half = Math.max(8, (w / 2) * open);
  const paper = tone === "old" ? ["#E9D3A4", "#C9A66A", "#9C7A44"] : ["#FBEBC8", "#EBCF96", "#C9A266"];
  return (
    <g transform={`translate(${x} ${y})`}>
      <defs>
        <linearGradient id={`${id}Paper`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={paper[0]} />
          <stop offset="70%" stopColor={paper[1]} />
          <stop offset="100%" stopColor={paper[2]} />
        </linearGradient>
        <linearGradient id={`${id}Rod`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#5A3A16" />
          <stop offset="50%" stopColor="#B07A36" />
          <stop offset="100%" stopColor="#4A2E10" />
        </linearGradient>
        <clipPath id={`${id}Clip`}>
          <rect x={-half} y={-h / 2} width={half * 2} height={h} />
        </clipPath>
      </defs>
      <rect x={-half + 10} y={-h / 2 + 14} width={half * 2} height={h} fill="rgba(0,0,0,0.35)" />
      <rect x={-half} y={-h / 2} width={half * 2} height={h} fill={`url(#${id}Paper)`} />
      <g clipPath={`url(#${id}Clip)`}>{children}</g>
      {[-1, 1].map((s) => (
        <g key={s} transform={`translate(${s * half} 0)`}>
          <rect x={-18} y={-h / 2 - 22} width={36} height={h + 44} rx={18} fill={`url(#${id}Rod)`} />
          <rect x={-10} y={-h / 2 - 42} width={20} height={24} rx={6} fill="#3A2410" />
          <rect x={-10} y={h / 2 + 18} width={20} height={24} rx={6} fill="#3A2410" />
        </g>
      ))}
    </g>
  );
};

/** Helle Funken, die aufsteigen (Licht, Staub im Strahl). */
export const Motes: React.FC<{ n: number; x: number; y: number; w: number; h: number; color: string; seed: string; o?: number; speed?: number }> = ({ n, x, y, w, h, color, seed, o = 1, speed = 1 }) => {
  const frame = useCurrentFrame();
  return (
    <g opacity={o}>
      {Array.from({ length: n }, (_, i) => {
        const r1 = Math.abs(Math.sin((i + 1) * 12.9898 + seed.length * 3.1)) % 1;
        const r2 = Math.abs(Math.sin((i + 1) * 78.233 + seed.length)) % 1;
        const r3 = Math.abs(Math.sin((i + 1) * 37.719)) % 1;
        const life = 120 + r3 * 90;
        const p = ((frame * speed + r2 * life) % life) / life;
        const mx = x + r1 * w + Math.sin(frame / 30 + i) * 12;
        const my = y + h - p * h;
        return <circle key={i} cx={mx} cy={my} r={1.6 + r3 * 2.6} fill={color} opacity={Math.sin(p * Math.PI) * (0.4 + 0.5 * r2)} />;
      })}
    </g>
  );
};
