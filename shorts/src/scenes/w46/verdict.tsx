import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, random, useCurrentFrame } from "remotion";
import { useLook } from "../../looks";
import { Sfx, beat, beats, voiceFrame } from "../../lib/sfx";
import type { TimelineScene } from "../../lib/timing";
import type { Scene as SceneData } from "../../schema";
import { Robed, Stamp, clamp, usePop, useT, wordsOfTexts } from "../w45/kitA";

/*
 * Salomos Urteil (1 Könige 3:7–28). Zwei Frauen im Lichtkegel, in der Mitte ein Kind in
 * Tüchern auf einem Kissen. Der junge König hat um ein hörendes Herz gebeten statt um
 * Reichtum. Rückblick: ein Haus in der Nacht, zwei Fenster, eines erlischt. Gegenüberstellung
 * mit einer Waage, die zu der schwingt, die gerade redet – Zeugen gibt es keine. Ein Wächter
 * bringt das Schwert und hebt es; es senkt sich nie zum Kind. Die eine fällt auf die Knie,
 * die andere bleibt kalt. Das Kind geht zur Mutter, Licht fällt auf sie, und ganz Israel
 * erkennt Gottes Weisheit. Alle Figuren sind Silhouetten mit Streiflicht.
 *
 * Takte (`cues`) je Etappe, in dieser Reihenfolge:
 *   hook   – [Frauen im Licht, Kind]
 *   wish   – [Name des Königs, Reichtum, hörendes Herz, Gut und Böse]
 *   women  – [Haus, zwei Babys, Nacht]
 *   claims – [die eine, die andere, keine Zeugen, Frage]
 *   sword  – [Schwert bringen, erheben]
 *   mother – [die eine kniet, die andere]
 *   verdict– [König hebt die Hand, Kind zur Mutter, «seine Mutter»]
 *   wisdom – [Volk, Weisheit, ans Licht]
 */

type VerdictT = Extract<SceneData, { type: "verdict" }>;
type P = { ts: TimelineScene; s: VerdictT };
type Pt = [number, number];

const GOLD = "#E8C27A";
const RIM = "#FFD58A";
const COLD = "#9CC3FF";
const INK = "#160C08";
/** Füsse der Frauen in der Gegenüberstellung */
const FEET = 1150;
/** Die Frauen: A links, B rechts */
const AX = 250;
const BX = 830;
/** Das Kissen mit dem Kind */
const CX = 540;
const CY = 1112;

const lerp = (a: Pt, b: Pt, k: number): Pt => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
const fade = (t: number, at: number, d = 0.35) => interpolate(t, [at, at + d], [0, 1], clamp);

/* ------------------------------------------------------------------ */
/* Gemeinsame Formen                                                   */
/* ------------------------------------------------------------------ */

const Defs: React.FC = () => (
  <defs>
    <linearGradient id="vdGold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stopColor="#FFF0B8" />
      <stop offset="45%" stopColor="#E3B04F" />
      <stop offset="100%" stopColor="#8A5E1A" />
    </linearGradient>
    <linearGradient id="vdIvory" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stopColor="#9C8A66" />
      <stop offset="35%" stopColor="#F4EAD2" />
      <stop offset="70%" stopColor="#DCCBA4" />
      <stop offset="100%" stopColor="#8E7C5A" />
    </linearGradient>
    <linearGradient id="vdSteel" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#F4F8FF" />
      <stop offset="50%" stopColor="#AEB8C8" />
      <stop offset="100%" stopColor="#6C7688" />
    </linearGradient>
    <radialGradient id="vdGlow">
      <stop offset="0%" stopColor="#FFF4C8" stopOpacity="0.9" />
      <stop offset="40%" stopColor="#F2C46D" stopOpacity="0.35" />
      <stop offset="100%" stopColor="#F2C46D" stopOpacity="0" />
    </radialGradient>
    <radialGradient id="vdCold">
      <stop offset="0%" stopColor="#CFE2FF" stopOpacity="0.7" />
      <stop offset="100%" stopColor="#7FA7E8" stopOpacity="0" />
    </radialGradient>
    <linearGradient id="vdSpot" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#FFF3D6" stopOpacity="0.55" />
      <stop offset="100%" stopColor="#FFF3D6" stopOpacity="0.05" />
    </linearGradient>
    <linearGradient id="vdSpotCold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#CFE0FF" stopOpacity="0.5" />
      <stop offset="100%" stopColor="#CFE0FF" stopOpacity="0.04" />
    </linearGradient>
    <linearGradient id="vdHeart" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#FFF0C2" />
      <stop offset="55%" stopColor="#F2B65A" />
      <stop offset="100%" stopColor="#C2722A" />
    </linearGradient>
  </defs>
);

/** Ein Lichtkegel von oben auf eine Figur. */
const Spot: React.FC<{ x: number; k: number; cold?: number }> = ({ x, k, cold = 0 }) => {
  if (k <= 0.01) return null;
  return (
    <g opacity={k}>
      <path d={`M ${x - 46} 236 L ${x + 46} 236 L ${x + 215} ${FEET + 30} L ${x - 215} ${FEET + 30} Z`} fill="url(#vdSpot)" opacity={1 - cold} />
      {cold > 0 ? <path d={`M ${x - 46} 236 L ${x + 46} 236 L ${x + 215} ${FEET + 30} L ${x - 215} ${FEET + 30} Z`} fill="url(#vdSpotCold)" opacity={cold} /> : null}
      <ellipse cx={x} cy={FEET + 10} rx={200} ry={34} fill={cold > 0.5 ? "#BFD6FF" : "#FFEFC8"} opacity={0.28} />
    </g>
  );
};

/** Pose einer Frau: Arme nach vorn (reach), Kind halten (hold), Hände hoch (recoil), knien. */
type WomanPose = { reach?: number; hold?: number; recoil?: number; kneel?: number; lean?: number };

const WomanShape: React.FC<{ body: string; veil: string; pose: WomanPose }> = ({ body, veil, pose }) => {
  const { reach = 0, hold = 0, recoil = 0, kneel = 0 } = pose;
  const d = 104 * kneel;
  // Arm vorne: hängend → nach vorn → halten → Hände hoch
  let e: Pt = [26, -172 + d];
  let h: Pt = [32, -112 + d];
  const fwdE: Pt = [72, -206 + d];
  const fwdH: Pt = [126, kneel > 0 ? -238 + d : -204 + d];
  e = lerp(e, fwdE, reach);
  h = lerp(h, fwdH, reach);
  e = lerp(e, [52, -168 + d], hold);
  h = lerp(h, [14, -192 + d], hold);
  e = lerp(e, [46, -226 + d], recoil);
  h = lerp(h, [40, -296 + d], recoil);
  const be: Pt = lerp(lerp(lerp([-22, -172 + d], [56, -214 + d], reach), [36, -160 + d], hold), [30, -232 + d], recoil);
  const bh: Pt = lerp(lerp(lerp([-26, -112 + d], [108, -218 + d], reach), [-4, -176 + d], hold), [22, -300 + d], recoil);
  const hx = 8;
  const hy = -282 + d;
  const top = -246 + d;
  return (
    <g>
      {/* Arm hinten */}
      <path d={`M -16 ${top + 12} L ${be[0]} ${be[1]} L ${bh[0]} ${bh[1]}`} stroke={body} strokeWidth={19} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Kleid – kniend kürzer, mit Knien nach vorn */}
      <path
        d={`M -28 ${top} C -46 ${-170 + d * 0.8}, -58 ${-80 + d * 0.4}, ${-66 - 8 * kneel} 0 L ${60 + 40 * kneel} 0 C ${56 + 30 * kneel} ${-60 + d * 0.3}, 42 ${-170 + d * 0.8}, 28 ${top} Q 0 ${top - 14} -28 ${top} Z`}
        fill={body}
      />
      {/* Kopf und Schleier, der über den Rücken fällt */}
      <circle cx={hx} cy={hy} r={23} fill={body} />
      <path d={`M ${hx + 20} ${hy - 12} C ${hx + 10} ${hy - 40}, ${hx - 34} ${hy - 38}, ${hx - 30} ${hy + 4} C ${hx - 40} ${hy + 60}, -52 ${-150 + d * 0.6}, -50 ${-112 + d * 0.5} L -26 ${top + 40} C ${hx - 10} ${hy + 40}, ${hx + 6} ${hy + 22}, ${hx + 14} ${hy + 18} Z`} fill={veil} />
      {/* Arm vorne */}
      <path d={`M 18 ${top + 14} L ${e[0]} ${e[1]} L ${h[0]} ${h[1]}`} stroke={body} strokeWidth={19} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </g>
  );
};

/** Eine Frau von der Seite, Ursprung zwischen den Füssen; bei k = 1 knapp 330 hoch. */
const Woman: React.FC<{ x: number; y?: number; k?: number; dir?: 1 | -1; rim?: string; pose?: WomanPose; o?: number; glow?: number; tone?: "a" | "b" }> = ({
  x,
  y = FEET,
  k = 1,
  dir = 1,
  rim = RIM,
  pose = {},
  o = 1,
  glow = 0,
  tone = "a",
}) => {
  const frame = useCurrentFrame();
  if (o <= 0.01) return null;
  const body = tone === "a" ? "#1C100B" : "#15111A";
  const veil = tone === "a" ? "#2C1A12" : "#221C2C";
  const lean = pose.lean ?? 0;
  return (
    <g transform={`translate(${x} ${y}) scale(${dir * k} ${k}) rotate(${lean * 7})`} opacity={o}>
      <ellipse cx={0} cy={3} rx={78} ry={10} fill="#000" opacity={0.4} />
      {glow > 0 ? <ellipse cx={10} cy={-170} rx={150} ry={230} fill="url(#vdGlow)" opacity={glow * (0.85 + 0.15 * Math.sin(frame / 9))} /> : null}
      <g transform="translate(-5 -2)">
        <WomanShape body={rim} veil={rim} pose={pose} />
      </g>
      <WomanShape body={body} veil={veil} pose={pose} />
    </g>
  );
};

/** Das Kind in Tüchern – Mitte (x, y). Kein Gesicht, nur Tuch und Köpfchen. */
const Bundle: React.FC<{ x: number; y: number; s?: number; glow?: number; rot?: number }> = ({ x, y, s = 1, glow = 0, rot = -8 }) => {
  const frame = useCurrentFrame();
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
      {glow > 0 ? <circle r={150} fill="url(#vdGlow)" opacity={glow * (0.8 + 0.2 * Math.sin(frame / 12))} /> : null}
      <ellipse cx={-6} cy={4} rx={74} ry={34} fill="#F3E7CC" stroke="#B89B68" strokeWidth={3} />
      <path d="M -60 -10 Q -20 20 24 -22 M -66 10 Q -16 34 34 4 M -40 -26 Q 0 -4 40 -30" stroke="#C9B080" strokeWidth={4} fill="none" />
      <circle cx={56} cy={-4} r={23} fill="#B98458" />
      <path d="M 40 -28 C 70 -38, 92 -8, 78 18 C 72 2, 60 -16, 40 -20 Z" fill="#E7D7B2" stroke="#B89B68" strokeWidth={2} />
    </g>
  );
};

/** Das Kissen, auf dem das Kind liegt. */
const Cushion: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <g transform={`translate(${x} ${y})`}>
    <ellipse cx={0} cy={44} rx={150} ry={14} fill="#000" opacity={0.45} />
    <path d="M -128 16 Q -140 -18 -100 -22 L 100 -22 Q 140 -18 128 16 Q 140 44 100 44 L -100 44 Q -140 44 -128 16 Z" fill="#7A2424" />
    <path d="M -110 -16 L 110 -16" stroke="#C25A4A" strokeWidth={5} opacity={0.6} />
    <path d="M -128 16 Q -140 44 -100 44 L 100 44 Q 140 44 128 16" stroke="url(#vdGold)" strokeWidth={5} fill="none" />
    {[-130, 130].map((tx) => (
      <g key={tx}>
        <circle cx={tx} cy={36} r={8} fill="#E3B04F" />
        <path d={`M ${tx - 6} 40 L ${tx - 8} 62 M ${tx} 42 L ${tx} 66 M ${tx + 6} 40 L ${tx + 8} 62`} stroke="#E3B04F" strokeWidth={3} />
      </g>
    ))}
  </g>
);

/** Ein sitzender Löwe aus Gold, schaut nach +x. */
const Lion: React.FC<{ x: number; y: number; s: number; dir?: 1 | -1 }> = ({ x, y, s, dir = 1 }) => (
  <g transform={`translate(${x} ${y}) scale(${dir * s} ${s})`}>
    <path d="M -34 -20 q -18 -4 -14 -26" stroke="#B8862E" strokeWidth={5} fill="none" strokeLinecap="round" />
    <ellipse cx={-10} cy={-18} rx={26} ry={16} fill="url(#vdGold)" />
    <circle cx={-26} cy={-16} r={15} fill="url(#vdGold)" />
    <rect x={6} y={-34} width={10} height={34} rx={4} fill="url(#vdGold)" />
    <rect x={-30} y={-6} width={22} height={8} rx={4} fill="url(#vdGold)" />
    <circle cx={14} cy={-44} r={19} fill="#C9902E" />
    <circle cx={22} cy={-44} r={11} fill="url(#vdGold)" />
    <ellipse cx={31} cy={-40} rx={6} ry={4.5} fill="#F2CF7A" />
  </g>
);

/** Der Thron aus Elfenbein mit sechs Stufen und Löwen (1 Könige 10:18–20) – Ursprung: Mitte des Sitzes. */
const Throne: React.FC<{ x: number; y: number; k?: number }> = ({ x, y, k = 1 }) => (
  <g transform={`translate(${x} ${y}) scale(${k})`}>
    {/* Stufen */}
    {Array.from({ length: 6 }, (_, i) => {
      const w = 360 + i * 60;
      const sy = 30 + i * 30;
      return (
        <g key={i}>
          <rect x={-w / 2} y={sy} width={w} height={30} fill="url(#vdIvory)" opacity={1 - i * 0.07} />
          <rect x={-w / 2} y={sy} width={w} height={4} fill="#E3B04F" opacity={0.8} />
          <rect x={-w / 2} y={sy + 26} width={w} height={4} fill="#3A2A18" opacity={0.5} />
          {i % 2 === 1 ? (
            <>
              <Lion x={-w / 2 + 22} y={sy} s={0.62} dir={-1} />
              <Lion x={w / 2 - 22} y={sy} s={0.62} dir={1} />
            </>
          ) : null}
        </g>
      );
    })}
    {/* Rückenlehne, oben gerundet */}
    <path d="M -150 20 L -150 -250 Q -150 -350 0 -360 Q 150 -350 150 -250 L 150 20 Z" fill="url(#vdIvory)" stroke="url(#vdGold)" strokeWidth={10} />
    <path d="M -118 0 L -118 -244 Q -118 -322 0 -330 Q 118 -322 118 -244 L 118 0 Z" fill="#17423F" />
    <path d="M 0 -386 L 9 -362 L 0 -350 L -9 -362 Z" fill="url(#vdGold)" />
    <circle cx={0} cy={-352} r={9} fill="#FFF0B8" />
    {/* Armlehnen mit Löwen */}
    {[-1, 1].map((sd) => (
      <g key={sd}>
        <rect x={sd > 0 ? 140 : -196} y={-110} width={56} height={130} rx={10} fill="url(#vdIvory)" stroke="url(#vdGold)" strokeWidth={5} />
        <Lion x={sd * 172} y={-110} s={1.05} dir={sd as 1 | -1} />
      </g>
    ))}
    {/* Sitzkissen */}
    <rect x={-160} y={-8} width={320} height={40} rx={12} fill="#7A2424" stroke="url(#vdGold)" strokeWidth={4} />
  </g>
);

/** Krone – Mitte unten bei (x, y). */
const Crown: React.FC<{ x: number; y: number; s: number }> = ({ x, y, s }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path d="M -26 0 L -30 -26 L -14 -12 L 0 -32 L 14 -12 L 30 -26 L 26 0 Z" fill="url(#vdGold)" stroke="#FFF0B8" strokeWidth={2} />
    <circle cx={0} cy={-32} r={4} fill="#FFF0B8" />
  </g>
);

const KingShape: React.FC<{ fill: string; mantle: string; gesture: number }> = ({ fill, mantle, gesture }) => {
  const re: Pt = lerp([-94, -82], [-118, -176], gesture);
  const rh: Pt = lerp([-116, -36], [-150, -262], gesture);
  return (
    <g>
      {/* Gewand über den Knien bis zu den Füssen */}
      <path d="M -94 0 C -98 60, -84 132, -72 160 L 72 160 C 84 132, 98 60, 94 0 Z" fill={fill} />
      {/* Oberkörper */}
      <path d="M -62 -170 C -80 -120, -98 -40, -98 6 L 98 6 C 98 -40, 80 -120, 62 -170 Q 0 -190 -62 -170 Z" fill={fill} />
      {/* Mantel */}
      <path d="M -66 -168 L -36 -30 L 0 -118 L 36 -30 L 66 -168 Q 0 -190 -66 -168 Z" fill={mantle} />
      {/* Arme */}
      <path d={`M 58 -150 L 94 -82 L 116 -36`} stroke={fill} strokeWidth={24} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d={`M -58 -150 L ${re[0]} ${re[1]} L ${rh[0]} ${rh[1]}`} stroke={fill} strokeWidth={24} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx={0} cy={-214} r={31} fill={fill} />
      <rect x={-14} y={-190} width={28} height={24} fill={fill} />
    </g>
  );
};

/** Der junge König auf dem Thron, von vorn – Ursprung: Mitte des Sitzes. */
const King: React.FC<{ x: number; y: number; k?: number; gesture?: number }> = ({ x, y, k = 1, gesture = 0 }) => (
  <g transform={`translate(${x} ${y}) scale(${k})`}>
    <g transform="translate(-5 -3)">
      <KingShape fill={RIM} mantle={RIM} gesture={gesture} />
    </g>
    <KingShape fill={INK} mantle="#123A37" gesture={gesture} />
    <path d="M -66 -168 L -36 -30 L 0 -118 L 36 -30 L 66 -168" stroke="url(#vdGold)" strokeWidth={4} fill="none" opacity={0.85} />
    <path d="M -72 156 L 72 156" stroke="url(#vdGold)" strokeWidth={6} opacity={0.8} />
    <path d="M -94 4 Q 0 18 94 4" stroke="url(#vdGold)" strokeWidth={5} fill="none" opacity={0.7} />
    <path d="M -40 30 C -44 80, -40 120, -36 150 M 40 30 C 44 80, 40 120, 36 150" stroke="#2A1C14" strokeWidth={4} fill="none" opacity={0.8} />
    <Crown x={0} y={-238} s={1.2} />
  </g>
);

/** Der Wächter mit dem Schwert. `raise` 0 = Schwert gesenkt, 1 = hoch erhoben. */
const Guard: React.FC<{ x: number; y: number; k?: number; dir?: 1 | -1; raise: number; gleam?: number; o?: number }> = ({ x, y, k = 1, dir = -1, raise, gleam = -1, o = 1 }) => {
  if (o <= 0.01) return null;
  const h: Pt = lerp([40, -120], [62, -352], raise);
  const ang = interpolate(raise, [0, 1], [96, -84]);
  const L = 250;
  return (
    <g opacity={o}>
      <Robed x={x} y={y} k={k} dir={dir} fill="#120B0A" rim="#D9C7A8" rimSide={-1} pose={{ raise, hood: false }} />
      <g transform={`translate(${x} ${y}) scale(${dir * k} ${k})`}>
        {/* Helm */}
        <path d="M -24 -286 C -24 -320, 32 -322, 32 -286 L 36 -278 L -28 -278 Z" fill="#3A3A40" stroke="#9AA3B4" strokeWidth={3} />
        <path d="M 4 -318 C 0 -340, 20 -350, 30 -338" stroke="#8C2A2A" strokeWidth={8} fill="none" strokeLinecap="round" />
        {/* Schwert in der Hand */}
        <g transform={`translate(${h[0]} ${h[1]}) rotate(${ang})`}>
          <rect x={-44} y={-6} width={40} height={12} rx={5} fill="#5A3A1A" />
          <circle cx={-48} cy={0} r={8} fill="url(#vdGold)" />
          <rect x={-6} y={-24} width={12} height={48} rx={4} fill="url(#vdGold)" />
          <path d={`M 6 -9 L ${L - 30} -7 L ${L} 0 L ${L - 30} 7 L 6 9 Z`} fill="url(#vdSteel)" stroke="#4A5262" strokeWidth={2} />
          <line x1={14} y1={0} x2={L - 34} y2={0} stroke="#FFFFFF" strokeWidth={2} opacity={0.6} />
          {gleam >= 0 && gleam <= 1 ? (
            <g transform={`translate(${14 + gleam * (L - 40)} 0)`}>
              <ellipse rx={26} ry={8} fill="#FFFFFF" opacity={0.85} />
              <path d="M 0 -26 L 4 -4 L 26 0 L 4 4 L 0 26 L -4 4 L -26 0 L -4 -4 Z" fill="#FFFFFF" opacity={0.9} />
            </g>
          ) : null}
        </g>
      </g>
    </g>
  );
};

/** Text auf Zeilen mit höchstens `max` Zeichen umbrechen. */
const wrap = (text: string, max: number): string[] => {
  const out: string[] = [];
  let cur = "";
  for (const w of text.split(/\s+/)) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > max && cur) {
      out.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) out.push(cur);
  return out;
};

/** Eine Sprechblase, unten Mitte bei (x, bottom); der Zipfel zeigt nach `tail`. */
const Bubble: React.FC<{ x: number; bottom: number; text: string; tail: Pt; pop: number; o?: number; tone?: "warm" | "cold" | "plain" }> = ({ x, bottom, text, tail, pop, o = 1, tone = "plain" }) => {
  if (pop <= 0.01 || o <= 0.01) return null;
  const lines = wrap(text, 18);
  const fs = 42;
  const w = Math.max(...lines.map((l) => l.length)) * fs * 0.56 + 76;
  const h = lines.length * fs * 1.2 + 46;
  const top = bottom - h;
  const stroke = tone === "warm" ? "#F2B65A" : tone === "cold" ? "#8FB2F0" : GOLD;
  const fill = tone === "cold" ? "#EEF3FF" : "#FFF6E3";
  const tx = Math.max(x - w / 2 + 40, Math.min(x + w / 2 - 40, tail[0]));
  return (
    <g transform={`translate(${tail[0]} ${tail[1]}) scale(${interpolate(pop, [0, 1], [0.55, 1])}) translate(${-tail[0]} ${-tail[1]})`} opacity={Math.min(1, pop * 1.6) * o}>
      <rect x={x - w / 2 + 6} y={top + 10} width={w} height={h} rx={30} fill="#000" opacity={0.35} />
      <path d={`M ${tx - 26} ${bottom - 4} L ${tail[0]} ${tail[1]} L ${tx + 22} ${bottom - 4} Z`} fill={fill} stroke={stroke} strokeWidth={5} strokeLinejoin="round" />
      <rect x={x - w / 2} y={top} width={w} height={h} rx={30} fill={fill} stroke={stroke} strokeWidth={5} />
      <rect x={tx - 24} y={bottom - 10} width={46} height={12} fill={fill} />
      {lines.map((l, i) => (
        <text key={i} x={x} y={top + 23 + fs * 0.95 + i * fs * 1.2} textAnchor="middle" fontFamily="Inter" fontWeight={800} fontSize={fs} fill="#2A1A0E">
          {l}
        </text>
      ))}
    </g>
  );
};

/** Eine hängende Waage – Drehpunkt (x, y); `angle` > 0 senkt die rechte Schale. */
const Balance: React.FC<{ x: number; y: number; angle: number; o?: number; arm?: number; labels?: [string, string]; labelO?: number; top?: number }> = ({
  x,
  y,
  angle,
  o = 1,
  arm = 210,
  labels,
  labelO = 1,
  top = 236,
}) => {
  if (o <= 0.01) return null;
  const a = (angle * Math.PI) / 180;
  const ends: Pt[] = [
    [x - Math.cos(a) * arm, y - Math.sin(a) * arm],
    [x + Math.cos(a) * arm, y + Math.sin(a) * arm],
  ];
  const chain = 120;
  return (
    <g opacity={o}>
      <line x1={x} y1={top} x2={x} y2={y - 22} stroke="#B8862E" strokeWidth={5} strokeDasharray="10 6" />
      <circle cx={x} cy={y - 26} r={10} fill="none" stroke="#E3B04F" strokeWidth={5} />
      <g transform={`translate(${x} ${y}) rotate(${angle})`}>
        <rect x={-arm} y={-7} width={arm * 2} height={14} rx={7} fill="url(#vdGold)" />
        {[-arm, arm].map((ex) => (
          <circle key={ex} cx={ex} cy={0} r={11} fill="#E3B04F" />
        ))}
      </g>
      <path d={`M ${x - 16} ${y + 2} L ${x} ${y - 34} L ${x + 16} ${y + 2} Z`} fill="url(#vdGold)" />
      {ends.map(([ex, ey], i) => (
        <g key={i}>
          {[-56, 0, 56].map((dx) => (
            <line key={dx} x1={ex} y1={ey} x2={ex + dx} y2={ey + chain} stroke="#C9993F" strokeWidth={3} />
          ))}
          <path d={`M ${ex - 72} ${ey + chain} Q ${ex} ${ey + chain + 62} ${ex + 72} ${ey + chain} Z`} fill="url(#vdGold)" stroke="#8A5E1A" strokeWidth={3} />
          {labels ? (
            <text x={ex} y={ey + chain + 104} textAnchor="middle" fontFamily="Cinzel" fontWeight={700} fontSize={44} fill={i === 0 ? "#FFF3D6" : "#C9B9DC"} stroke="#140A05" strokeWidth={8} paintOrder="stroke" opacity={labelO} style={{ letterSpacing: 4 }}>
              {labels[i]}
            </text>
          ) : null}
        </g>
      ))}
    </g>
  );
};

/** Ein Herz, das hört: Herz mit Schallringen. */
const ListeningHeart: React.FC<{ x: number; y: number; k: number; s?: number; rays?: number }> = ({ x, y, k, s = 1, rays = 0 }) => {
  const frame = useCurrentFrame();
  if (k <= 0.01) return null;
  return (
    <g transform={`translate(${x} ${y})`} opacity={Math.min(1, k * 1.4)}>
      <circle r={200 * s} fill="url(#vdGlow)" opacity={0.7 + 0.3 * rays} />
      {rays > 0
        ? Array.from({ length: 14 }, (_, i) => {
            const a = (i / 14) * Math.PI * 2 + frame / 120;
            return <path key={i} d={`M ${Math.cos(a - 0.05) * 90} ${Math.sin(a - 0.05) * 90} L ${Math.cos(a) * 330} ${Math.sin(a) * 330} L ${Math.cos(a + 0.05) * 90} ${Math.sin(a + 0.05) * 90} Z`} fill="#FFE6A8" opacity={0.14 * rays} />;
          })
        : null}
      {[0, 1, 2].map((i) => {
        const p = ((frame / 40 + i / 3) % 1 + 1) % 1;
        return <circle key={i} r={(70 + p * 150) * s} fill="none" stroke="#FFE6A8" strokeWidth={4} opacity={(1 - p) * 0.6 * k} />;
      })}
      <g transform={`scale(${s * interpolate(k, [0, 1], [0.5, 1]) * (1 + 0.04 * Math.sin(frame / 7))})`}>
        <path d="M 0 52 C -96 -6, -84 -92, 0 -52 C 84 -92, 96 -6, 0 52 Z" fill="url(#vdHeart)" stroke="#FFF0C2" strokeWidth={5} />
        <path d="M -44 -50 C -62 -44, -66 -20, -56 -6" stroke="#FFF8E0" strokeWidth={7} fill="none" strokeLinecap="round" opacity={0.8} />
      </g>
    </g>
  );
};

/** Dunkle Bühne für die Gegenüberstellung. */
const Dim: React.FC<{ o: number; color?: string }> = ({ o, color = "#070403" }) => <rect x={0} y={0} width={1080} height={1920} fill={color} opacity={o} />;

/** Namensschild vor den Füssen. */
const Plate: React.FC<{ x: number; text: string; o: number }> = ({ x, text, o }) =>
  o > 0.01 ? (
    <g opacity={o}>
      <rect x={x - 110} y={FEET + 26} width={220} height={52} rx={10} fill="#1A0F08" stroke={GOLD} strokeWidth={3} opacity={0.92} />
      <text x={x} y={FEET + 64} textAnchor="middle" fontFamily="Cinzel" fontWeight={700} fontSize={34} fill={GOLD} style={{ letterSpacing: 4 }}>
        {text}
      </text>
    </g>
  ) : null;

/* ------------------------------------------------------------------ */
/* Etappen                                                             */
/* ------------------------------------------------------------------ */

const bubbleOf = (s: VerdictT, who: "a" | "b") => s.bubbles.filter((b) => b.who === who);

/** Die Sprechblasen einer Frau – jede neue löst die vorige ab. */
const Bubbles: React.FC<{ ts: TimelineScene; s: VerdictT; who: "a" | "b"; head: Pt; tone?: (i: number) => "warm" | "cold" | "plain"; o?: number }> = ({ ts, s, who, head, tone, o = 1 }) => {
  const t = useT(ts);
  const list = bubbleOf(s, who);
  const times = list.map((b, i) => beat(ts, b.at, ts.speechStartSec + 1 + i));
  return (
    <>
      {list.map((b, i) => {
        const next = times[i + 1];
        const out = next !== undefined ? 1 - fade(t, next - 0.25, 0.2) : 1;
        return <BubbleAt key={i} ts={ts} at={times[i]} text={b.text} who={who} head={head} out={out * o} tone={tone ? tone(i) : "plain"} />;
      })}
    </>
  );
};

const BubbleAt: React.FC<{ ts: TimelineScene; at: number; text: string; who: "a" | "b"; head: Pt; out: number; tone: "warm" | "cold" | "plain" }> = ({ ts, at, text, who, head, out, tone }) => {
  const pop = usePop(ts, at - 0.12, { damping: 13, stiffness: 200 });
  const x = who === "a" ? 300 : 790;
  return <Bubble x={x} bottom={head[1] - 40} text={text} tail={[head[0] + (who === "a" ? 30 : -30), head[1] - 6]} pop={pop} o={out} tone={tone} />;
};

/** Einstieg: zwei Frauen, ein Kind, beide greifen danach. */
const Hook: React.FC<P> = ({ ts, s }) => {
  const t = useT(ts);
  const [frauen, baby] = beats(ts, s.cues, 2);
  const meins = beat(ts, s.bubbles[0]?.at, baby + 1.5);
  const spot = fade(t, frauen - 0.08, 0.18);
  const babyGlow = fade(t, baby - 0.15, 0.6);
  const reach = interpolate(t, [meins - 0.25, meins + 0.45], [0, 0.8], { ...clamp, easing: Easing.out(Easing.cubic) });
  const head = (x: number): Pt => [x, FEET - 300];
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <Defs />
        <Dim o={0.8} />
        <Spot x={CX} k={0.55 * (1 - 0.5 * spot)} />
        <circle cx={CX} cy={CY - 30} r={260} fill="url(#vdGlow)" opacity={0.25 + 0.4 * babyGlow} />
        <Spot x={AX} k={spot} />
        <Spot x={BX} k={spot} />
        <Cushion x={CX} y={CY + 20} />
        <Bundle x={CX} y={CY - 18} glow={babyGlow} />
        <Woman x={AX} dir={1} o={spot} pose={{ reach }} tone="a" />
        <Woman x={BX} dir={-1} o={spot} pose={{ reach }} tone="b" />
        <Plate x={AX} text="FRAU A" o={spot} />
        <Plate x={BX} text="FRAU B" o={spot} />
        <Bubbles ts={ts} s={s} who="a" head={head(AX)} />
        <Bubbles ts={ts} s={s} who="b" head={head(BX)} />
      </svg>
      <Sfx frame={voiceFrame(ts, frauen)} name="thud" volume={0.5} keep />
    </AbsoluteFill>
  );
};

/** Gold, Münzen, eine Truhe. */
const Treasure: React.FC<{ x: number; y: number; k: number; dim: number }> = ({ x, y, k, dim }) => {
  const frame = useCurrentFrame();
  if (k <= 0.01) return null;
  const coins = [
    [-96, 46], [-60, 52], [-20, 56], [24, 54], [66, 50], [100, 44], [-78, 30], [-40, 34], [6, 36], [48, 32], [86, 28], [-56, 14], [-14, 16], [30, 14],
  ];
  return (
    <g transform={`translate(${x} ${y + (1 - k) * 60}) scale(${0.7 + 0.3 * k})`} opacity={Math.min(1, k * 1.5) * (1 - 0.72 * dim)}>
      <circle r={190} fill="url(#vdGlow)" opacity={0.6 * (1 - dim)} />
      <rect x={-96} y={-60} width={192} height={96} rx={10} fill="#6A3E1C" stroke="#3A2010" strokeWidth={4} />
      <path d="M -100 -58 Q 0 -150 100 -58 Z" fill="#7C4A22" stroke="#3A2010" strokeWidth={4} />
      {[-60, 0, 60].map((bx) => (
        <rect key={bx} x={bx - 9} y={-112 + Math.abs(bx) * 0.5} width={18} height={150 - Math.abs(bx) * 0.5} fill="url(#vdGold)" opacity={0.9} />
      ))}
      <path d="M -88 -60 Q 0 -100 88 -60 L 80 -40 Q 0 -70 -80 -40 Z" fill="#F2CF7A" opacity={0.95} />
      {coins.map(([cx, cy], i) => (
        <ellipse key={i} cx={cx} cy={cy} rx={20} ry={9} fill="url(#vdGold)" stroke="#8A5E1A" strokeWidth={2} />
      ))}
      {[0, 1, 2].map((i) => {
        const p = (frame / 26 + i * 0.37) % 1;
        const gx = [-70, 30, 80][i];
        const gy = [-80, -96, 20][i];
        return <path key={i} transform={`translate(${gx} ${gy}) scale(${Math.sin(p * Math.PI) * (1 - dim)})`} d="M 0 -18 L 4 -4 L 18 0 L 4 4 L 0 18 L -4 4 L -18 0 L -4 -4 Z" fill="#FFFBE6" />;
      })}
    </g>
  );
};

/** Der junge König hat um ein hörendes Herz gebeten – nicht um Reichtum. */
const Wish: React.FC<P> = ({ ts, s }) => {
  const look = useLook();
  const t = useT(ts);
  const [name, reichtum, herz, gut] = beats(ts, s.cues, 4);
  const plate = usePop(ts, name - 0.05);
  const gold = usePop(ts, reichtum - 0.1);
  const dim = fade(t, reichtum + 1.1, 0.5);
  const strike = interpolate(t, [reichtum + 1.0, reichtum + 1.4], [0, 1], clamp);
  const heart = usePop(ts, herz - 0.1, { damping: 12, stiffness: 150 });
  const scale = fade(t, gut - 0.1, 0.5);
  const sway = (1 - fade(t, gut + 0.3, 1.6)) * 9 * Math.sin((t - gut) * 4);
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <Defs />
        <circle cx={540} cy={760} r={380} fill="url(#vdGlow)" opacity={0.18 + 0.25 * heart} />
        <Throne x={540} y={910} k={0.86} />
        <King x={540} y={910} k={0.86} gesture={0.15 * heart} />
        {/* Name */}
        <g opacity={Math.min(1, plate * 1.5)} transform={`translate(540 ${1170 + (1 - plate) * 30})`}>
          <rect x={-300} y={-40} width={600} height={78} rx={14} fill="#1A0F08" stroke={GOLD} strokeWidth={4} opacity={0.94} />
          <text x={0} y={14} textAnchor="middle" fontFamily={look.label} fontWeight={700} fontSize={40} fill={GOLD} style={{ letterSpacing: 6 }}>
            SALOMO · KÖNIG
          </text>
        </g>
        {/* Reichtum – nicht das, worum er bittet; an seine Stelle tritt das Herz */}
        <Treasure x={540} y={450} k={gold * (1 - fade(t, herz - 0.4, 0.4))} dim={dim} />
        {gold > 0.01 ? (
          <g opacity={Math.min(1, gold * 1.5) * (1 - fade(t, herz - 0.4, 0.4))}>
            <text x={540} y={318} textAnchor="middle" fontFamily={look.label} fontWeight={700} fontSize={48} fill="#FFF3D6" stroke="#1A0F08" strokeWidth={8} paintOrder="stroke" style={{ letterSpacing: 6 }}>
              REICHTUM
            </text>
            <line x1={380} y1={302} x2={380 + 320 * strike} y2={302} stroke="#E0573F" strokeWidth={8} strokeLinecap="round" />
          </g>
        ) : null}
        {/* Das hörende Herz, und darin die Waage für Gut und Böse */}
        <Balance x={540} y={420} angle={sway} o={scale} arm={250} labels={["GUT", "BÖSE"]} top={330} />
        <ListeningHeart x={540} y={420} k={heart} s={0.9} />
      </svg>
      <Sfx frame={voiceFrame(ts, herz)} name="warm" volume={0.4} />
    </AbsoluteFill>
  );
};

/** Ein Rückblick: das Haus in der Nacht, zwei Fenster, eines erlischt. */
const Memory: React.FC<P> = ({ ts, s }) => {
  const look = useLook();
  const frame = useCurrentFrame();
  const t = useT(ts);
  const [haus, babys, nacht] = beats(ts, s.cues, 3);
  const frameIn = usePop(ts, haus - 0.3, { damping: 16, stiffness: 140 });
  const house = fade(t, haus - 0.1, 0.6);
  const kids = fade(t, babys - 0.1, 0.5);
  const night = fade(t, nacht - 0.2, 1.4);
  const out = interpolate(t, [nacht + 0.8, nacht + 2.4], [0, 1], clamp);
  const sky = (a: string, b: string) => {
    const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
    const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
    return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * night)).join(",")})`;
  };
  const stars = useMemo(() => Array.from({ length: 34 }, (_, i) => ({ x: 160 + random(`vs${i}`) * 760, y: 340 + random(`vsy${i}`) * 220, r: 1.5 + random(`vsr${i}`) * 2.5, p: random(`vsp${i}`) * 6 })), []);
  const win = (wx: number, lit: number, i: number) => (
    <g key={wx}>
      <path d={`M ${wx - 38} 650 L ${wx - 38} 590 Q ${wx} 552 ${wx + 38} 590 L ${wx + 38} 650 Z`} fill={`rgb(${Math.round(20 + 235 * lit)},${Math.round(22 + 190 * lit)},${Math.round(40 + 100 * lit)})`} />
      {lit > 0.05 ? <circle cx={wx} cy={612} r={70} fill="url(#vdGlow)" opacity={0.55 * lit} /> : null}
      {/* Kind in der Wiege, als kleine Silhouette */}
      <g opacity={kids} transform={`translate(${wx} 640)`}>
        <path d="M -26 0 Q 0 16 26 0 L 22 -10 L -22 -10 Z" fill="#3A2412" />
        <ellipse cx={-2} cy={-16} rx={18} ry={9} fill={lit > 0.2 ? "#5A3A1E" : "#1A1428"} />
        <circle cx={14} cy={-18} r={7} fill={lit > 0.2 ? "#5A3A1E" : "#1A1428"} />
        <path d={`M 0 -46 l 3 -8 l 3 8 l 8 3 l -8 3 l -3 8 l -3 -8 l -8 -3 Z`} fill="#FFF3C8" opacity={(1 - night * 0.6) * (0.6 + 0.4 * Math.sin(frame / 8 + i))} />
      </g>
    </g>
  );
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <Defs />
        <Dim o={0.45} />
        <Woman x={300} k={0.95} dir={1} tone="a" />
        <Woman x={780} k={0.95} dir={-1} tone="b" />
        <g opacity={Math.min(1, frameIn * 1.4)} transform={`translate(540 560) scale(${interpolate(frameIn, [0, 1], [0.9, 1])}) translate(-540 -560)`}>
          <rect x={126} y={306} width={828} height={528} rx={34} fill="#000" opacity={0.5} />
          <clipPath id="vdMem">
            <rect x={140} y={320} width={800} height={500} rx={26} />
          </clipPath>
          <g clipPath="url(#vdMem)">
            <rect x={140} y={320} width={800} height={500} fill={sky("#2C3A72", "#070A22")} />
            <rect x={140} y={560} width={800} height={200} fill={sky("#B9645A", "#121233")} opacity={0.7} />
            {stars.map((st, i) => (
              <circle key={i} cx={st.x} cy={st.y} r={st.r} fill="#FFF8E0" opacity={night * (0.5 + 0.5 * Math.sin(frame / 14 + st.p))} />
            ))}
            <circle cx={830} cy={400} r={36} fill="#F4F0DC" opacity={night} />
            <circle cx={846} cy={392} r={34} fill={sky("#2C3A72", "#070A22")} opacity={night} />
            {/* Hügel und Palme */}
            <path d="M 140 760 Q 300 690 470 740 T 940 720 L 940 820 L 140 820 Z" fill={sky("#3A2A30", "#0B0A18")} />
            <g opacity={house}>
              <path d="M 230 740 L 238 600" stroke={sky("#3A2412", "#0C0A16")} strokeWidth={12} />
              {[-60, -20, 20, 60, 100].map((a) => (
                <path key={a} d={`M 238 600 q ${Math.cos((a * Math.PI) / 180) * 50} ${-30 + Math.abs(a) * 0.3} ${Math.cos((a * Math.PI) / 180) * 90} ${-10 + Math.abs(a) * 0.6}`} stroke={sky("#3A4A2A", "#0C0F18")} strokeWidth={14} fill="none" strokeLinecap="round" />
              ))}
              {/* Das Haus mit flachem Dach und Aussentreppe */}
              <rect x={350} y={520} width={380} height={230} fill={sky("#C9A57C", "#2A2440")} />
              <rect x={340} y={506} width={400} height={22} fill={sky("#A9855C", "#221C36")} />
              <path d="M 730 750 L 830 750 L 730 560 Z" fill={sky("#A9855C", "#221C36")} />
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <rect key={i} x={730 + i * 16} y={560 + i * 32} width={100 - i * 16} height={6} fill={sky("#8A6A48", "#1A1630")} />
              ))}
              <path d="M 515 750 L 515 676 Q 540 652 565 676 L 565 750 Z" fill={sky("#3A2412", "#0C0A16")} />
              {win(440, 1, 0)}
              {win(640, 1 - out, 1)}
            </g>
          </g>
          <rect x={140} y={320} width={800} height={500} rx={26} fill="none" stroke={GOLD} strokeWidth={6} />
          <rect x={154} y={334} width={772} height={472} rx={18} fill="none" stroke={GOLD} strokeWidth={2} opacity={0.5} />
          <g opacity={house}>
            <rect x={400} y={792} width={280} height={52} rx={10} fill="#1A0F08" stroke={GOLD} strokeWidth={3} />
            <text x={540} y={830} textAnchor="middle" fontFamily={look.label} fontWeight={700} fontSize={32} fill={GOLD} style={{ letterSpacing: 4 }}>
              EIN HAUS
            </text>
          </g>
        </g>
      </svg>
    </AbsoluteFill>
  );
};

/** Gegenüberstellung: Wer sagt die Wahrheit? Die Waage schwingt zur Sprecherin. */
const Claims: React.FC<P> = ({ ts, s }) => {
  const t = useT(ts);
  const look = useLook();
  const frame = useCurrentFrame();
  const [eine, andere, zeugen, frage] = beats(ts, s.cues, 4);
  const aSays = beat(ts, bubbleOf(s, "a")[0]?.at, eine + 1);
  const bSays = beat(ts, bubbleOf(s, "b")[0]?.at, andere + 1);
  /* Die Waage neigt sich zu der, die redet – und kommt am Ende zur Ruhe, ohne Entscheid */
  const toA = interpolate(t, [aSays - 0.3, aSays + 0.5], [0, 1], { ...clamp, easing: Easing.inOut(Easing.sin) });
  const toB = interpolate(t, [bSays - 0.3, bSays + 0.5], [0, 1], { ...clamp, easing: Easing.inOut(Easing.sin) });
  const settle = interpolate(t, [zeugen, frage + 0.4], [0, 1], { ...clamp, easing: Easing.inOut(Easing.sin) });
  const wobble = 4 * Math.sin((t - zeugen) * 3.2) * settle * (1 - fade(t, frage + 0.4, 1.2));
  const angle = (-16 * toA + 32 * toB) * (1 - settle) + wobble;
  const stamp = usePop(ts, zeugen - 0.05, { damping: 10, stiffness: 170 });
  const q = usePop(ts, frage - 0.1);
  const speakA = fade(t, aSays - 0.2, 0.3) * (1 - fade(t, bSays - 0.3, 0.3));
  const speakB = fade(t, bSays - 0.2, 0.3) * (1 - fade(t, zeugen - 0.2, 0.3));
  const head = (x: number): Pt => [x, FEET - 300];
  const bubblesDim = 1 - 0.55 * fade(t, zeugen - 0.1, 0.3);
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <Defs />
        <Dim o={0.8} />
        <Spot x={AX} k={0.55 + 0.45 * speakA + 0.2 * settle} />
        <Spot x={BX} k={0.55 + 0.45 * speakB + 0.2 * settle} />
        <Balance x={540} y={360} angle={angle} arm={200} />
        {q > 0.01 ? (
          <text x={540} y={560} textAnchor="middle" fontFamily={look.label} fontWeight={700} fontSize={130} fill={GOLD} opacity={Math.min(1, q * 1.5) * (0.85 + 0.15 * Math.sin(frame / 8))} transform={`translate(540 520) scale(${q}) translate(-540 -520)`}>
            ?
          </text>
        ) : null}
        <Cushion x={CX} y={CY + 20} />
        <Bundle x={CX} y={CY - 18} glow={0.35} />
        <Woman x={AX} dir={1} pose={{ reach: 0.35 * speakA, lean: 0.4 * speakA }} tone="a" />
        <Woman x={BX} dir={-1} pose={{ reach: 0.35 * speakB, lean: 0.4 * speakB }} tone="b" />
        <Plate x={AX} text="FRAU A" o={1} />
        <Plate x={BX} text="FRAU B" o={1} />
        <Bubbles ts={ts} s={s} who="a" head={head(AX)} o={bubblesDim} />
        <Bubbles ts={ts} s={s} who="b" head={head(BX)} o={bubblesDim} />
        <Stamp x={540} y={985} text="KEINE ZEUGEN" color="#E0573F" pop={stamp} rot={-7} size={46} font="Cinzel" />
      </svg>
      <Sfx frame={voiceFrame(ts, zeugen)} name="thud" volume={0.5} keep />
    </AbsoluteFill>
  );
};

/** Das Schwert wird gebracht – und erhoben. Es senkt sich nie zum Kind. */
const Sword: React.FC<P> = ({ ts, s }) => {
  const t = useT(ts);
  const [bring, teilt] = beats(ts, s.cues, 2);
  const enter = interpolate(t, [bring - 0.3, bring + 0.7], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const raise = interpolate(t, [teilt - 0.35, teilt + 0.45], [0.15, 1], { ...clamp, easing: Easing.out(Easing.back(1.4)) });
  const gleam = interpolate(t, [teilt + 0.35, teilt + 1.1], [0, 1], clamp);
  const flash = interpolate(t, [teilt + 0.3, teilt + 0.45, teilt + 0.9], [0, 0.35, 0], clamp);
  const shock = interpolate(t, [teilt - 0.1, teilt + 0.4], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const cold = interpolate(t, [teilt - 0.2, teilt + 0.6], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <Defs />
        <Dim o={0.62 + 0.15 * cold} />
        <Dim o={0.12 * cold} color="#1A2A5A" />
        <Spot x={AX} k={0.7} />
        <Spot x={BX} k={0.7} />
        <Spot x={CX} k={0.5 * enter} cold={cold} />
        <Guard x={interpolate(enter, [0, 1], [900, 610])} y={1062} k={0.92} dir={-1} raise={t < teilt - 0.35 ? 0.15 : raise} gleam={t > teilt + 0.35 && t < teilt + 1.1 ? gleam : -1} o={enter} />
        <Cushion x={CX} y={CY + 20} />
        <Bundle x={CX} y={CY - 18} glow={0.3} />
        <Woman x={AX} dir={1} pose={{ recoil: 0.85 * shock, lean: -0.6 * shock }} tone="a" />
        <Woman x={BX} dir={-1} pose={{ recoil: 0.2 * shock }} tone="b" />
        <rect x={0} y={0} width={1080} height={1920} fill="#FFFFFF" opacity={flash} />
      </svg>
      <Sfx frame={voiceFrame(ts, teilt + 0.1)} name="breath" volume={0.45} keep />
    </AbsoluteFill>
  );
};

/** Die eine fällt auf die Knie, die andere bleibt kalt. */
const Mother: React.FC<P> = ({ ts, s }) => {
  const t = useT(ts);
  const [ruft, andere] = beats(ts, s.cues, 2);
  const kneel = interpolate(t, [ruft - 0.1, ruft + 0.6], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const reach = interpolate(t, [ruft + 0.3, ruft + 1.0], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const warm = fade(t, ruft, 0.8);
  const cold = fade(t, andere - 0.1, 0.8);
  const headA: Pt = [AX + 10, FEET - 300 + 104 * kneel];
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <Defs />
        <Dim o={0.78} />
        <Spot x={AX} k={0.75 + 0.25 * warm} />
        <Spot x={BX} k={0.75} cold={cold} />
        <Guard x={620} y={1060} k={0.88} dir={-1} raise={1} o={0.85} />
        <Cushion x={CX} y={CY + 20} />
        <Bundle x={CX} y={CY - 18} glow={0.3 + 0.4 * warm} />
        <Woman x={AX - 10} dir={1} pose={{ kneel, reach }} glow={0.6 * warm} tone="a" />
        <Woman x={BX} dir={-1} pose={{ lean: -0.2 * cold }} rim={cold > 0.3 ? COLD : RIM} tone="b" />
        {cold > 0.01 ? <ellipse cx={BX} cy={FEET - 170} rx={150} ry={230} fill="url(#vdCold)" opacity={0.35 * cold} /> : null}
        <Bubbles ts={ts} s={s} who="a" head={headA} tone={() => "warm"} />
        <Bubbles ts={ts} s={s} who="b" head={[BX, FEET - 300]} tone={() => "cold"} />
      </svg>
    </AbsoluteFill>
  );
};

/** Das Urteil: Das Schwert sinkt, das Kind geht zur Mutter, Licht fällt auf sie. */
const Verdict: React.FC<P> = ({ ts, s }) => {
  const t = useT(ts);
  const [koenig, gebt, mutter] = beats(ts, s.cues, 3);
  const gesture = interpolate(t, [koenig - 0.2, koenig + 0.5], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const lower = interpolate(t, [gebt - 0.2, gebt + 0.8], [1, 0], { ...clamp, easing: Easing.inOut(Easing.sin) });
  const move = interpolate(t, [gebt + 0.1, gebt + 1.3], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const hold = interpolate(t, [gebt + 0.5, gebt + 1.2], [0, 1], clamp);
  const light = fade(t, mutter - 0.2, 0.8);
  const bDim = fade(t, gebt + 0.4, 1);
  /* Bahn des Kindes: vom Kissen in die Arme der Mutter, in einem Bogen */
  const from: Pt = [CX, CY - 18];
  const to: Pt = [AX + 24, FEET - 182];
  const bx = from[0] + (to[0] - from[0]) * move;
  const by = from[1] + (to[1] - from[1]) * move - Math.sin(move * Math.PI) * 90;
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <Defs />
        <Dim o={0.25 + 0.15 * bDim} />
        <Throne x={540} y={800} k={0.82} />
        <King x={540} y={800} k={0.82} gesture={gesture} />
        {/* Lichtstrahl aus dem linken Fenster auf die Mutter */}
        <path d={`M 150 440 L 310 440 L ${AX + 190} ${FEET + 20} L ${AX - 170} ${FEET + 20} Z`} fill="url(#vdSpot)" opacity={0.15 + 0.75 * light} style={{ mixBlendMode: "screen" }} />
        <Guard x={760} y={1080} k={0.84} dir={-1} raise={lower} o={1} />
        <Cushion x={CX} y={CY + 20} />
        <Woman x={AX} dir={1} pose={{ hold }} glow={0.4 + 0.6 * light} tone="a" />
        <Woman x={BX + 20} dir={-1} o={1 - 0.6 * bDim} tone="b" />
        <Bundle x={bx} y={by} s={interpolate(move, [0, 1], [1, 0.82])} rot={interpolate(move, [0, 1], [-8, -20])} glow={0.4 + 0.5 * light} />
        {light > 0.01
          ? Array.from({ length: 12 }, (_, i) => {
              const a = (i / 12) * Math.PI * 2 + t * 0.3;
              const cx = AX + 20;
              const cy = FEET - 200;
              return <path key={i} d={`M ${cx + Math.cos(a - 0.06) * 120} ${cy + Math.sin(a - 0.06) * 120} L ${cx + Math.cos(a) * 300} ${cy + Math.sin(a) * 300} L ${cx + Math.cos(a + 0.06) * 120} ${cy + Math.sin(a + 0.06) * 120} Z`} fill="#FFE6A8" opacity={0.12 * light} />;
            })
          : null}
      </svg>
      <Sfx frame={voiceFrame(ts, mutter)} name="warm" volume={0.45} keep />
    </AbsoluteFill>
  );
};

/** Ganz Israel erkennt: Gottes Weisheit ist in ihm. */
const Wisdom: React.FC<P> = ({ ts, s }) => {
  const t = useT(ts);
  const frame = useCurrentFrame();
  const [volk, weisheit, licht] = beats(ts, s.cues, 3);
  const rise = interpolate(t, [volk - 0.4, volk + 0.9], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const heart = usePop(ts, weisheit - 0.15, { damping: 12, stiffness: 140 });
  const rays = fade(t, weisheit, 0.8);
  const light = fade(t, licht - 0.1, 1.2);
  const people = useMemo(() => {
    const out: Array<{ x: number; y: number; s: number; veil: boolean; d: number; child: boolean }> = [];
    const rows = [
      { y: 1110, n: 9, s: 0.62 },
      { y: 1190, n: 8, s: 0.8 },
      { y: 1290, n: 7, s: 1.0 },
    ];
    rows.forEach((row, r) => {
      for (let i = 0; i < row.n; i++) {
        const child = random(`vwc${r}-${i}`) > 0.75;
        out.push({
          x: 70 + (i + (r % 2) * 0.5) * (940 / row.n) + (random(`vwx${r}-${i}`) - 0.5) * 30,
          y: row.y + (child ? 22 * row.s : 0),
          s: row.s * (child ? 0.7 : 1),
          veil: random(`vwv${r}-${i}`) > 0.5,
          d: random(`vwd${r}-${i}`) * 0.4,
          child,
        });
      }
    });
    return out;
  }, []);
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <Defs />
        <Throne x={540} y={820} k={0.8} />
        <King x={540} y={820} k={0.8} gesture={0} />
        <ListeningHeart x={540} y={410} k={heart} s={0.8} rays={rays} />
        {/* Die Mutter mit dem Kind, im Licht */}
        <ellipse cx={210} cy={880} rx={170} ry={260} fill="url(#vdGlow)" opacity={0.35 + 0.5 * light} />
        <Woman x={200} y={1040} k={0.78} dir={1} pose={{ hold: 1 }} glow={0.5 + 0.5 * light} tone="a" />
        <Bundle x={200 + 24 * 0.78} y={1040 - 182 * 0.78} s={0.66} rot={-20} glow={0.5 + 0.5 * light} />
        {/* Das Volk, von hinten */}
        {people.map((p, i) => {
          const k = interpolate(rise, [p.d, Math.min(1, p.d + 0.6)], [0, 1], clamp);
          if (k <= 0.01) return null;
          const fill = "#140B07";
          return (
            <g key={i} transform={`translate(${p.x} ${p.y + (1 - k) * 160}) scale(${p.s})`} opacity={k}>
              <circle cx={0} cy={-80} r={90} fill="#FFD58A" opacity={0.12 * light} />
              <path d="M -66 70 C -66 4, -40 -26, 0 -26 C 40 -26, 66 4, 66 70 Z" fill={fill} />
              <circle cx={0} cy={-58} r={33} fill={fill} />
              {p.veil ? <path d="M -38 -60 C -40 -102, 40 -102, 38 -60 L 46 -10 L -46 -10 Z" fill="#1E120C" /> : null}
              <path d="M -64 66 C -64 4, -40 -24, 0 -24" stroke={RIM} strokeWidth={3} fill="none" opacity={0.3 + 0.4 * light} />
              <path d="M -33 -58 C -33 -86, 0 -94, 22 -82" stroke={RIM} strokeWidth={3} fill="none" opacity={0.3 + 0.4 * light} />
            </g>
          );
        })}
        <rect x={0} y={0} width={1080} height={1920} fill="#FFDCA0" opacity={0.1 * light * (0.85 + 0.15 * Math.sin(frame / 20))} style={{ mixBlendMode: "screen" }} />
      </svg>
    </AbsoluteFill>
  );
};

export const Scene: React.FC<{ ts: TimelineScene }> = ({ ts }) => {
  const s = ts.scene as VerdictT;
  switch (s.stage) {
    case "hook":
      return <Hook ts={ts} s={s} />;
    case "wish":
      return <Wish ts={ts} s={s} />;
    case "women":
      return <Memory ts={ts} s={s} />;
    case "claims":
      return <Claims ts={ts} s={s} />;
    case "sword":
      return <Sword ts={ts} s={s} />;
    case "mother":
      return <Mother ts={ts} s={s} />;
    case "verdict":
      return <Verdict ts={ts} s={s} />;
    case "wisdom":
      return <Wisdom ts={ts} s={s} />;
    default:
      return null;
  }
};

/** Was in den Sprechblasen steht, wird nicht noch einmal untertitelt. */
export const hidden = (ts: TimelineScene): Set<number> => {
  const s = ts.scene as VerdictT;
  return wordsOfTexts(
    ts,
    s.bubbles.map((b) => b.text),
  );
};
