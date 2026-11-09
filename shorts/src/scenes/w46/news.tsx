import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, random, spring, useCurrentFrame } from "remotion";
import { Sfx, beats, voiceFrame } from "../../lib/sfx";
import { FPS, type TimelineScene } from "../../lib/timing";
import type { Scene as SceneDef } from "../../schema";
import { theme } from "../../theme";
import { Robed, Scroll, Stamp, wordsOfTexts } from "../w45/kitA";

/*
 * «Eilmeldung aus Beröa» (Apostelgeschichte 17) als Nachrichtensendung: Über allen Etappen steht
 * derselbe Bildschirm mit der Live-Schaltung, darunter die Bauchbinde – rotes Etikett und
 * Schlagzeile. In den Bildschirm zeichnet jede Etappe, was gerade berichtet wird: zwei Wanderer
 * vor der Stadt, die Karte mit den drei Städten, Paulus in der Synagoge von Thessalonich, die
 * Menge mit Fackeln und den wütenden Kommentaren, die Flucht in der Nacht, die offenen Zuhörer in
 * Beröa, der Faktencheck Tag für Tag, Athen mit der Trend-Liste – und zuletzt die drei Städte
 * nebeneinander. Eine eigene, erfundene Gestaltung; kein echter Sender.
 */

type NewsSceneT = Extract<SceneDef, { type: "news" }>;
type P = { ts: TimelineScene; s: NewsSceneT; t: number; frame: number; b: number[] };

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const BODY = theme.font.body;
const RED = "#FF3B3B";
const BLUE = "#3FA9FF";
const GOLD = "#FFC94A";
const OK = "#3DDC97";
const INK = "#0A1228";

/** Der Bildschirm der Live-Schaltung – in allen Etappen an derselben Stelle */
const MON = { x: 56, y: 262, w: 968, h: 726 };
/** Die Bauchbinde darunter */
const LT = { y: 1012 };

const popAt = (frame: number, ts: TimelineScene, at: number, stiffness = 190, damping = 14) =>
  spring({ frame: frame - voiceFrame(ts, at), fps: FPS, config: { damping, stiffness } });
const fadeIn = (t: number, at: number, d = 0.35) => interpolate(t, [at, at + d], [0, 1], clamp);

/* ------------------------------------------------------------------ */
/* Rahmen: Bildschirm und Bauchbinde                                   */
/* ------------------------------------------------------------------ */

const Monitor: React.FC<{ children: React.ReactNode; frame: number; live?: boolean; station?: string; stationOn?: number; enter?: number; overlay?: React.ReactNode }> = ({
  children,
  frame,
  live = true,
  station,
  stationOn = 1,
  enter = 1,
  overlay,
}) => {
  const blink = Math.sin(frame / 4.5) > 0 ? 1 : 0.35;
  return (
    <div
      style={{
        position: "absolute",
        left: MON.x,
        top: MON.y,
        width: MON.w,
        height: MON.h,
        borderRadius: 26,
        overflow: "hidden",
        background: "#02050D",
        boxShadow: "0 40px 90px rgba(0,0,0,0.6), 0 0 0 3px rgba(63,169,255,0.28), 0 0 40px rgba(63,169,255,0.18)",
        opacity: Math.min(1, enter * 1.4),
        transform: `scale(${interpolate(enter, [0, 1], [0.86, 1])})`,
      }}
    >
      <svg width={MON.w} height={MON.h} viewBox={`0 0 ${MON.w} ${MON.h}`} style={{ position: "absolute", inset: 0 }}>
        {children}
      </svg>
      {overlay}
      {/* feine Bildschirmzeilen */}
      <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(0deg, rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 2px, rgba(0,0,0,0) 2px, rgba(0,0,0,0) 5px)" }} />
      <div style={{ position: "absolute", inset: 0, boxShadow: "inset 0 0 80px rgba(0,0,0,0.55)" }} />
      {live ? (
        <div style={{ position: "absolute", left: 26, top: 24, display: "flex", alignItems: "center", gap: 10, padding: "8px 18px", borderRadius: 10, background: "rgba(5,8,20,0.72)", fontFamily: BODY, fontWeight: 800, fontSize: 26, letterSpacing: "0.14em", color: "#FFFFFF" }}>
          <span style={{ width: 14, height: 14, borderRadius: 7, background: RED, opacity: blink, boxShadow: `0 0 10px ${RED}` }} />
          LIVE
        </div>
      ) : null}
      {station ? (
        <div
          style={{
            position: "absolute",
            right: 24,
            top: 24,
            padding: "8px 18px",
            borderRadius: 10,
            background: "rgba(5,8,20,0.72)",
            border: `2px solid ${GOLD}`,
            fontFamily: BODY,
            fontWeight: 800,
            fontSize: 26,
            letterSpacing: "0.12em",
            color: GOLD,
            opacity: stationOn,
            transform: `translateY(${interpolate(stationOn, [0, 1], [-16, 0])}px)`,
          }}
        >
          {station}
        </div>
      ) : null}
    </div>
  );
};

/** Bauchbinde: rotes Etikett (steht von Anfang an) und die Schlagzeile, die sich aufzieht */
const LowerThird: React.FC<{ tag?: string; headline?: string; tagOn?: number; headOn: number }> = ({ tag, headline, tagOn = 1, headOn }) => {
  const size = headline ? Math.round(Math.max(36, Math.min(52, 880 / (0.56 * headline.length)))) : 52;
  return (
    <>
      {tag ? (
        <div
          style={{
            position: "absolute",
            left: MON.x,
            top: LT.y,
            height: 60,
            padding: "0 28px",
            display: "flex",
            alignItems: "center",
            background: RED,
            fontFamily: BODY,
            fontWeight: 800,
            fontSize: 30,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#FFFFFF",
            clipPath: `inset(0 ${100 - tagOn * 100}% 0 0)`,
          }}
        >
          {tag}
        </div>
      ) : null}
      {headline ? (
        <div
          style={{
            position: "absolute",
            left: MON.x,
            width: MON.w,
            top: LT.y + 60,
            height: 102,
            display: "flex",
            alignItems: "center",
            paddingLeft: 40,
            background: "linear-gradient(90deg, #FFFFFF 0%, #EEF3FB 100%)",
            boxShadow: "0 20px 50px rgba(0,0,0,0.45)",
            clipPath: `inset(0 ${100 - headOn * 100}% 0 0)`,
          }}
        >
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 12, background: BLUE }} />
          <span style={{ fontFamily: BODY, fontWeight: 800, fontSize: size, color: INK, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>{headline}</span>
        </div>
      ) : null}
    </>
  );
};

/* ------------------------------------------------------------------ */
/* Figuren                                                             */
/* ------------------------------------------------------------------ */

/** Sitzende Gestalt im Gewand, von der Seite (schaut nach rechts; `dir` −1 nach links). Ursprung: Boden unter dem Sitz. */
const Sitter: React.FC<{ x: number; y: number; k?: number; dir?: 1 | -1; fill: string; rim?: string; lean?: number; glow?: number; frame: number; scroll?: boolean }> = ({
  x,
  y,
  k = 1,
  dir = 1,
  fill,
  rim,
  lean = 0,
  glow = 0,
  frame,
  scroll = false,
}) => {
  const body = (c: string) => (
    <g>
      {/* Schoss und Beine */}
      <path d="M -30 -66 C -30 -80, 40 -82, 62 -70 C 70 -64, 72 -54, 66 -48 L 62 -4 C 60 2, 44 2, 42 -4 L 40 -44 L -26 -40 Z" fill={c} />
      <ellipse cx={58} cy={-3} rx={16} ry={6} fill={c} />
      {/* Oberkörper und Kopf, um die Hüfte geneigt */}
      <g transform={`rotate(${lean * 14} -6 -60)`}>
        <path d="M -32 -60 C -40 -110, -30 -150, -6 -160 C 16 -156, 28 -128, 26 -64 Z" fill={c} />
        <circle cx={4} cy={-180} r={22} fill={c} />
        <path d="M -24 -168 C -28 -206, 30 -212, 32 -182 L 30 -150 L -28 -146 Z" fill={c} />
        {scroll ? <rect x={14} y={-118} width={40} height={16} rx={6} fill="#E9D3A4" opacity={c === fill ? 1 : 0} /> : null}
        {/* Arm vorne */}
        <path d="M 6 -140 Q 30 -106 46 -96" stroke={c} strokeWidth={17} strokeLinecap="round" fill="none" />
      </g>
    </g>
  );
  return (
    <g transform={`translate(${x} ${y}) scale(${dir * k} ${k})`}>
      {glow > 0.01 ? (
        <g opacity={glow}>
          <circle cx={4} cy={-120} r={110} fill="url(#nwGold)" opacity={0.6 + 0.2 * Math.sin(frame / 8)} />
          <circle cx={4} cy={-232} r={9} fill="#FFF1B8" />
          <circle cx={4} cy={-232} r={22} fill="#FFE08A" opacity={0.35} />
        </g>
      ) : null}
      {rim ? <g transform="translate(-4 -2)">{body(rim)}</g> : null}
      {body(fill)}
    </g>
  );
};

/** Gestalt in der Menge, von hinten, mit erhobenem Arm und Fackel. Ursprung: Füsse. */
const Rioter: React.FC<{ x: number; y: number; k: number; fill: string; torch: boolean; arm: number; frame: number; seed: number; heat: number }> = ({ x, y, k, fill, torch, arm, frame, seed, heat }) => {
  const sway = Math.sin(frame / 6 + seed) * 4 * heat;
  const hand: [number, number] = [34 + sway, -150 - 70 * arm];
  const fl = 1 + 0.18 * Math.sin(frame / 2.2 + seed * 3) + 0.1 * Math.sin(frame / 3.7 + seed);
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`}>
      {torch ? <circle cx={hand[0] + 4} cy={hand[1] - 46} r={70} fill="url(#nwFire)" opacity={0.55 * fl} /> : null}
      <path d={`M -34 0 C -38 -60, -36 -110, -22 -128 C -8 -136, 10 -136, 24 -128 C 36 -110, 38 -60, 36 0 Z`} fill={fill} />
      <circle cx={sway * 0.3} cy={-152} r={20} fill={fill} />
      <path d={`M 20 -122 L ${hand[0]} ${hand[1]}`} stroke={fill} strokeWidth={14} strokeLinecap="round" />
      {torch ? (
        <g transform={`translate(${hand[0] + 4} ${hand[1]})`}>
          <rect x={-5} y={-36} width={10} height={52} rx={4} fill="#3A2416" />
          <g transform={`translate(0 -40) scale(${fl} ${fl * 1.1})`}>
            <path d="M 0 -40 C 16 -22, 18 -4, 0 6 C -18 -4, -16 -22, 0 -40 Z" fill="#FF7A2A" />
            <path d="M 0 -24 C 8 -14, 9 -4, 0 2 C -9 -4, -8 -14, 0 -24 Z" fill="#FFE08A" />
          </g>
        </g>
      ) : null}
    </g>
  );
};

/* ------------------------------------------------------------------ */
/* Die Karte                                                           */
/* ------------------------------------------------------------------ */

type LL = [number, number];
/** Länge/Breite → Bildschirm: Thessalonich bei (470, 150), Athen bei (563, 549) */
const proj = ([lon, lat]: LL): [number, number] => [470 + (lon - 22.94) * 118, 150 + (40.64 - lat) * 150];
const poly = (pts: LL[]) => `M ${pts.map((p) => proj(p).map((v) => v.toFixed(1)).join(" ")).join(" L ")} Z`;

const MAINLAND: LL[] = [
  [18.5, 42.6], [27.6, 42.6], [27.6, 41.1], [26.6, 40.9], [26.0, 40.75], [25.6, 40.88], [25.0, 40.96], [24.4, 40.9], [23.95, 40.76],
  [23.88, 40.5], [24.05, 40.35], [24.42, 40.14], [24.18, 40.3], [23.98, 40.32], [23.98, 39.96], [23.78, 40.2], [23.68, 40.22], [23.72, 39.94],
  [23.36, 40.24], [23.02, 40.46], [22.95, 40.61], [22.78, 40.55], [22.63, 40.44], [22.58, 40.24], [22.63, 40.04], [22.84, 39.76], [22.96, 39.55],
  [23.27, 39.38], [23.15, 39.15], [22.9, 39.25], [22.95, 39.05], [22.75, 38.95], [22.58, 38.86], [22.9, 38.74], [23.3, 38.46], [23.7, 38.35],
  [24.06, 38.2], [24.06, 37.78], [24.02, 37.66], [23.75, 37.86], [23.63, 37.94], [23.4, 37.99], [23.18, 38.0], [23.0, 37.9],
  [23.15, 37.72], [23.05, 37.5], [22.78, 37.24], [22.98, 36.88], [23.18, 36.45], [22.72, 36.78], [22.46, 36.42], [22.18, 36.78], [21.92, 36.86],
  [21.72, 37.12], [21.62, 37.56], [21.32, 37.76], [21.14, 37.92], [21.4, 38.22], [21.86, 38.3], [22.42, 38.14], [22.92, 37.98],
  [22.42, 38.36], [21.82, 38.42], [21.32, 38.36], [21.06, 38.62], [20.76, 39.02], [20.3, 39.42], [20.0, 39.72], [19.5, 40.32], [19.4, 41.0], [19.5, 41.8],
];
const EUBOEA: LL[] = [[22.85, 38.85], [23.3, 39.03], [23.45, 38.95], [23.95, 38.7], [24.25, 38.55], [24.6, 38.15], [24.5, 38.0], [24.15, 38.2], [23.75, 38.35], [23.4, 38.5], [23.1, 38.65]];
const ANATOLIA: LL[] = [[27.6, 40.42], [26.7, 40.38], [26.2, 40.05], [26.12, 39.5], [26.6, 39.3], [26.86, 38.96], [26.42, 38.62], [26.62, 38.34], [27.0, 38.2], [27.6, 38.0], [27.6, 36.2]];
const ISLANDS: Array<[number, number, number]> = [
  [23.45, 39.17, 7], [23.72, 39.12, 8], [23.9, 39.16, 6], [24.7, 40.7, 14], [25.55, 40.47, 10], [25.25, 39.9, 18], [26.3, 39.2, 26], [24.55, 38.85, 12], [24.85, 37.85, 12], [24.33, 37.62, 7], [23.5, 37.74, 7], [23.48, 37.92, 6], [25.1, 37.4, 9],
];

const CITY = { thess: [22.94, 40.64] as LL, beroea: [22.2, 40.52] as LL, athens: [23.73, 37.98] as LL };
/** Die Reise: zu Land nach Beröa, zu Wasser um Euböa herum nach Athen (17:10, 14–15) */
const ROUTE: LL[] = [
  CITY.thess, [22.7, 40.62], [22.42, 40.6], CITY.beroea,
  [22.45, 40.38], [22.66, 40.2], [23.05, 39.9], [23.55, 39.42], [24.1, 39.05], [24.82, 38.5], [24.82, 38.0], [24.4, 37.6], [24.05, 37.52], [23.78, 37.82], CITY.athens,
];
/** Bis hierher (Anteil der Strecke) reicht der Landweg nach Beröa */
const ROUTE_PTS = ROUTE.map(proj);
const ROUTE_LEN = (() => {
  const seg = ROUTE_PTS.slice(1).map((p, i) => Math.hypot(p[0] - ROUTE_PTS[i][0], p[1] - ROUTE_PTS[i][1]));
  const total = seg.reduce((a, c) => a + c, 0);
  const cum = [0];
  seg.forEach((l) => cum.push(cum[cum.length - 1] + l));
  return { total, cum };
})();
const BEROEA_AT = ROUTE_LEN.cum[3] / ROUTE_LEN.total;
const routeD = `M ${ROUTE_PTS.map((p) => p.map((v) => v.toFixed(1)).join(" ")).join(" L ")}`;
/** Ein Punkt auf der Strecke beim Anteil `p` */
const along = (p: number): [number, number] => {
  const d = Math.max(0, Math.min(1, p)) * ROUTE_LEN.total;
  let i = 0;
  while (i < ROUTE_LEN.cum.length - 2 && ROUTE_LEN.cum[i + 1] < d) i++;
  const seg = ROUTE_LEN.cum[i + 1] - ROUTE_LEN.cum[i] || 1;
  const k = (d - ROUTE_LEN.cum[i]) / seg;
  const a = ROUTE_PTS[i];
  const c = ROUTE_PTS[i + 1];
  return [a[0] + (c[0] - a[0]) * k, a[1] + (c[1] - a[1]) * k];
};

const Pin: React.FC<{ at: LL; on: number; label: string; side: 1 | -1; color?: string; frame: number; q?: { on: number; color: string } }> = ({ at, on, label, side, color = RED, frame, q }) => {
  if (on <= 0.01) return null;
  const [x, y] = proj(at);
  const pulse = (frame % 40) / 40;
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={14 + 40 * pulse} fill={color} opacity={0.35 * (1 - pulse) * on} />
      <g transform={`scale(${on})`}>
        <path d="M 0 0 C -9 -18, -26 -28, -26 -48 A 26 26 0 1 1 26 -48 C 26 -28, 9 -18, 0 0 Z" fill={color} stroke="#FFFFFF" strokeWidth={3} />
        <circle cx={0} cy={-48} r={9} fill="#FFFFFF" />
      </g>
      <text
        x={side * 34}
        y={-34}
        textAnchor={side > 0 ? "start" : "end"}
        fontFamily={BODY}
        fontWeight={800}
        fontSize={36}
        fill="#FFFFFF"
        stroke="#06112A"
        strokeWidth={8}
        paintOrder="stroke"
        opacity={Math.min(1, on * 1.5)}
      >
        {label}
      </text>
      {q && q.on > 0.01 ? (
        <g transform={`translate(${-side * 6} -116) scale(${q.on * (1 + 0.06 * Math.sin(frame / 5))})`}>
          <circle r={30} fill={q.color} stroke="#FFFFFF" strokeWidth={4} />
          <text y={13} textAnchor="middle" fontFamily={theme.font.display} fontSize={40} fill="#FFFFFF">
            ?
          </text>
        </g>
      ) : null}
    </g>
  );
};

/** Die Karte Griechenlands mit den drei Städten. `route`: gezeichneter Anteil der Reise, `mover`: Position der beiden Reisenden. */
const GreeceMap: React.FC<{
  frame: number;
  pins: [number, number, number];
  route: number;
  mover?: number;
  night?: number;
  zoom?: { cx: number; cy: number; s: number };
  foes?: number;
  q?: number;
}> = ({ frame, pins, route, mover, night = 0, zoom, foes = -1, q = 0 }) => {
  const z = zoom ?? { cx: MON.w / 2, cy: MON.h / 2, s: 1 };
  const moverPt = mover !== undefined ? along(mover) : null;
  const sea = night > 0.5 ? ["#050E22", "#081631"] : ["#0B2850", "#0A1B38"];
  const seaId = night > 0.5 ? "nwSeaN" : "nwSeaD";
  return (
    <g>
      <defs>
        <linearGradient id={seaId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={sea[0]} />
          <stop offset="100%" stopColor={sea[1]} />
        </linearGradient>
        <mask id="nwRouteMask">
          <path d={routeD} stroke="#FFFFFF" strokeWidth={30} fill="none" pathLength={1} strokeDasharray={`${route} 2`} strokeLinecap="round" strokeLinejoin="round" />
        </mask>
      </defs>
      <rect x={0} y={0} width={MON.w} height={MON.h} fill={`url(#${seaId})`} />
      <g transform={`translate(${MON.w / 2} ${MON.h / 2}) scale(${z.s}) translate(${-z.cx} ${-z.cy})`}>
        {/* Gitter */}
        {Array.from({ length: 9 }, (_, i) => (
          <line key={`v${i}`} x1={-200 + i * 160} y1={-300} x2={-200 + i * 160} y2={1100} stroke={BLUE} strokeWidth={1.2 / z.s} opacity={0.12} />
        ))}
        {Array.from({ length: 8 }, (_, i) => (
          <line key={`h${i}`} x1={-300} y1={-150 + i * 150} x2={1300} y2={-150 + i * 150} stroke={BLUE} strokeWidth={1.2 / z.s} opacity={0.12} />
        ))}
        {[MAINLAND, EUBOEA, ANATOLIA].map((pts, i) => (
          <g key={i}>
            <path d={poly(pts)} fill="none" stroke={BLUE} strokeWidth={10 / z.s} opacity={0.18} strokeLinejoin="round" />
            <path d={poly(pts)} fill={night > 0.5 ? "#13223F" : "#1C3A63"} stroke="#7CC4FF" strokeWidth={2.5 / z.s} strokeLinejoin="round" />
          </g>
        ))}
        {ISLANDS.map(([lon, lat, r], i) => {
          const [x, y] = proj([lon, lat]);
          return <ellipse key={i} cx={x} cy={y} rx={r} ry={r * 0.7} fill={night > 0.5 ? "#13223F" : "#1C3A63"} stroke="#7CC4FF" strokeWidth={2 / z.s} transform={`rotate(${(i * 37) % 60 - 30} ${x} ${y})`} />;
        })}
        {/* Landschaften */}
        <text x={proj([21.2, 41.25])[0]} y={proj([21.2, 41.25])[1]} fontFamily="Cinzel" fontWeight={700} fontSize={30} letterSpacing={8} fill="#9CCBFF" opacity={0.55}>
          MAKEDONIEN
        </text>
        <text x={proj([21.75, 37.4])[0]} y={proj([21.75, 37.4])[1]} fontFamily="Cinzel" fontWeight={700} fontSize={30} letterSpacing={8} fill="#9CCBFF" opacity={0.55}>
          ACHAIA
        </text>
        <text x={proj([24.85, 39.45])[0]} y={proj([24.85, 39.45])[1]} fontFamily="Cormorant Garamond" fontStyle="italic" fontWeight={600} fontSize={46} fill="#6FA8E8" opacity={0.6}>
          Ägäis
        </text>
        {/* Die Reise */}
        <g mask="url(#nwRouteMask)">
          <path d={routeD} stroke={GOLD} strokeWidth={6 / Math.sqrt(z.s)} fill="none" strokeDasharray={`${16 / z.s} ${12 / z.s}`} strokeDashoffset={-frame * 1.2} strokeLinecap="round" />
        </g>
        {/* Gegner hinterher: rote Punkte von Thessalonich nach Beröa (17:13) */}
        {foes >= 0
          ? [0, 1, 2].map((i) => {
              const p = Math.max(0, Math.min(1, foes - i * 0.08));
              const [x, y] = along(p * BEROEA_AT);
              return (
                <g key={i} opacity={foes > i * 0.08 ? 1 : 0}>
                  <circle cx={x} cy={y + i * 8 - 8} r={24} fill={RED} opacity={0.25} />
                  <circle cx={x} cy={y + i * 8 - 8} r={11} fill={RED} stroke="#FFFFFF" strokeWidth={2.5} />
                </g>
              );
            })
          : null}
        <Pin at={CITY.thess} on={pins[0]} label="Thessalonich" side={1} frame={frame} q={{ on: q, color: RED }} />
        <Pin at={CITY.beroea} on={pins[1]} label="Beröa" side={-1} frame={frame} q={{ on: q, color: GOLD }} />
        <Pin at={CITY.athens} on={pins[2]} label="Athen" side={1} frame={frame} q={{ on: q, color: BLUE }} />
        {/* Paulus und Silas: zwei Punkte – oder ein Schiff auf dem Meer */}
        {moverPt
          ? (() => {
              const atSea = (mover ?? 0) > BEROEA_AT + 0.02;
              const [x, y] = moverPt;
              return (
                <g transform={`translate(${x} ${y}) scale(${1 / Math.sqrt(z.s)})`}>
                  <circle r={30} fill="#FFFFFF" opacity={0.18 + 0.1 * Math.sin(frame / 4)} />
                  {atSea ? (
                    <g transform="translate(0 4)">
                      <path d="M -26 0 L 26 0 L 18 14 L -18 14 Z" fill="#F4E3C1" stroke="#3A2416" strokeWidth={2.5} />
                      <line x1={0} y1={0} x2={0} y2={-36} stroke="#3A2416" strokeWidth={3} />
                      <path d="M 2 -34 L 24 -8 L 2 -6 Z" fill="#FFFFFF" />
                    </g>
                  ) : (
                    <>
                      <circle cx={-8} cy={0} r={9} fill={GOLD} stroke="#FFFFFF" strokeWidth={2.5} />
                      <circle cx={10} cy={2} r={9} fill={GOLD} stroke="#FFFFFF" strokeWidth={2.5} />
                    </>
                  )}
                </g>
              );
            })()
          : null}
      </g>
      {night > 0.01 ? <rect x={0} y={0} width={MON.w} height={MON.h} fill="#020616" opacity={0.25 * night} /> : null}
    </g>
  );
};

/* ------------------------------------------------------------------ */
/* Die Synagoge (Thessalonich am Abend, Beröa am Tag)                  */
/* ------------------------------------------------------------------ */

const Synagogue: React.FC<{ day: boolean; frame: number; ark: number }> = ({ day, frame, ark }) => {
  const wall = day ? ["#D2AE80", "#9C7650"] : ["#6A4E36", "#2E2016"];
  const stone = day ? "#8E6A44" : "#24180F";
  const floor = day ? "#6E5034" : "#1E140C";
  const lampGlow = day ? 0.35 : 1;
  const flick = (i: number) => 1 + 0.12 * Math.sin(frame / 2.6 + i * 2) + 0.06 * Math.sin(frame / 4.1 + i);
  return (
    <g>
      <defs>
        <linearGradient id={`nwWall${day ? "D" : "N"}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={wall[1]} />
          <stop offset="55%" stopColor={wall[0]} />
          <stop offset="100%" stopColor={wall[1]} />
        </linearGradient>
        <linearGradient id="nwBeam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFF4D6" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#FFF4D6" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={MON.w} height={MON.h} fill={`url(#nwWall${day ? "D" : "N"})`} />
      {/* Steinlagen */}
      {Array.from({ length: 9 }, (_, r) => (
        <g key={r}>
          <line x1={0} y1={60 + r * 58} x2={MON.w} y2={60 + r * 58} stroke={stone} strokeWidth={2} opacity={0.5} />
          {Array.from({ length: 9 }, (_, c) => {
            const x = ((c * 128 + (r % 2) * 64) % 1100) - 40;
            return <line key={c} x1={x} y1={60 + r * 58} x2={x} y2={118 + r * 58} stroke={stone} strokeWidth={2} opacity={0.4} />;
          })}
        </g>
      ))}
      {/* Bögen mit Fenstern */}
      {[150, 818].map((cx, i) => (
        <g key={cx}>
          <path d={`M ${cx - 70} 380 L ${cx - 70} 170 A 70 70 0 0 1 ${cx + 70} 170 L ${cx + 70} 380 Z`} fill={day ? "#FFF0C8" : "#0D0A14"} opacity={day ? 0.95 : 1} />
          {day ? <path d={`M ${cx - 70} 200 L ${cx + 70} 200 L ${cx + 260 * (i ? -1 : 1) + 70} 726 L ${cx + 260 * (i ? -1 : 1) - 140} 726 Z`} fill="url(#nwBeam)" opacity={0.45} /> : <circle cx={cx + 30} cy={150} r={4} fill="#FFFFFF" opacity={0.7} />}
          <path d={`M ${cx - 70} 380 L ${cx - 70} 170 A 70 70 0 0 1 ${cx + 70} 170 L ${cx + 70} 380`} fill="none" stroke={stone} strokeWidth={10} />
        </g>
      ))}
      {/* Schrein mit den Schriftrollen */}
      <g transform="translate(484 150)">
        <rect x={-120} y={-30} width={240} height={30} fill={day ? "#7A5232" : "#3A2414"} />
        <rect x={-110} y={0} width={220} height={250} fill={day ? "#3E2616" : "#160D07"} />
        {/* Rollen im Schrein */}
        {[-70, -24, 24, 70].map((x, i) => (
          <g key={i} opacity={ark}>
            <rect x={x - 16} y={30} width={32} height={190} rx={14} fill="#F2DDB0" />
            <rect x={x - 6} y={14} width={12} height={20} rx={4} fill="#C9A13A" />
            <rect x={x - 6} y={216} width={12} height={20} rx={4} fill="#C9A13A" />
          </g>
        ))}
        {ark > 0.05 ? <ellipse cx={0} cy={125} rx={140} ry={150} fill="url(#nwGold)" opacity={0.5 * ark} /> : null}
        {/* Türen */}
        {[-1, 1].map((sd) => (
          <g key={sd} transform={`translate(${sd * 110} 0) scale(${1 - 0.86 * ark} 1) translate(${-sd * 110} 0)`}>
            <rect x={sd < 0 ? -110 : 0} y={0} width={110} height={250} fill={day ? "#8C5E36" : "#4A2E18"} stroke={day ? "#5A3A1E" : "#24160A"} strokeWidth={5} />
            <rect x={sd < 0 ? -92 : 18} y={22} width={74} height={206} fill="none" stroke={day ? "#C9A13A" : "#7A5A22"} strokeWidth={3} />
          </g>
        ))}
      </g>
      {/* Öllampen */}
      {[310, 658].map((x, i) => (
        <g key={x}>
          <line x1={x} y1={0} x2={x} y2={150} stroke="#2A1A10" strokeWidth={3} />
          <circle cx={x} cy={160} r={120} fill="url(#nwFire)" opacity={0.5 * lampGlow * flick(i)} />
          <path d={`M ${x - 26} 156 Q ${x} 182 ${x + 26} 156 Z`} fill="#8A5A2A" />
          <g transform={`translate(${x + 18} 150) scale(${flick(i)})`}>
            <path d="M 0 -18 C 7 -10, 8 -2, 0 3 C -8 -2, -7 -10, 0 -18 Z" fill="#FFD27A" />
          </g>
        </g>
      ))}
      {/* Boden und Podest */}
      <rect x={0} y={600} width={MON.w} height={126} fill={floor} />
      <rect x={110} y={590} width={250} height={26} fill={day ? "#8A6A48" : "#3A2A1C"} />
      <rect x={110} y={614} width={250} height={14} fill="#000" opacity={0.25} />
      {/* Bänke */}
      <rect x={470} y={600} width={460} height={20} fill={day ? "#5A3A22" : "#24160C"} />
      <rect x={530} y={668} width={420} height={20} fill={day ? "#5A3A22" : "#24160C"} />
    </g>
  );
};

/* ------------------------------------------------------------------ */
/* Etappen                                                             */
/* ------------------------------------------------------------------ */

/** Eilmeldung: Das Banner knallt ins Bild, dann öffnet sich die Live-Schaltung: zwei Wanderer vor der Stadt */
const Breaking: React.FC<P> = ({ ts, s, t, frame, b }) => {
  const [eil, fremde, messias] = b;
  const slam = spring({ frame: frame - 2, fps: FPS, config: { damping: 11, stiffness: 160 } });
  const away = interpolate(t, [fremde - 0.2, fremde + 0.4], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const enter = spring({ frame: frame - voiceFrame(ts, fremde - 0.15), fps: FPS, config: { damping: 15, stiffness: 120 } });
  const step = frame / 4.2;
  const walkX = interpolate(t, [fremde - 0.2, ts.speechEndSec + 1], [250, 360], clamp);
  return (
    <AbsoluteFill>
      <Monitor frame={frame} enter={enter}>
        <defs>
          <linearGradient id="nwDusk" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1E1B4A" />
            <stop offset="55%" stopColor="#8E4A6A" />
            <stop offset="85%" stopColor="#F49A5A" />
            <stop offset="100%" stopColor="#FFC985" />
          </linearGradient>
        </defs>
        <rect x={0} y={0} width={MON.w} height={MON.h} fill="url(#nwDusk)" />
        <circle cx={300} cy={480} r={70} fill="#FFE2A8" opacity={0.85} />
        <circle cx={300} cy={480} r={150} fill="#FFD08A" opacity={0.18} />
        {/* Hügel */}
        <path d="M 0 520 C 160 470, 300 500, 460 470 C 620 440, 800 480, 968 450 L 968 726 L 0 726 Z" fill="#5A3456" />
        {/* Die Stadt auf dem Hügel */}
        <g transform="translate(560 452)" fill="#2C1A34">
          <path d="M 0 40 L 0 -40 L 30 -40 L 30 -70 L 60 -70 L 60 -40 L 140 -40 L 140 -96 L 190 -96 L 190 -40 L 300 -40 L 300 -70 L 330 -70 L 330 -40 L 380 -40 L 380 40 Z" />
          <path d="M 150 40 L 150 -10 A 25 25 0 0 1 200 -10 L 200 40 Z" fill="#160C1C" />
          {[[70, -20], [240, -24], [100, -60], [350, -20]].map(([x, y], i) => (
            <rect key={i} x={x} y={y} width={12} height={14} fill="#FFC27A" opacity={0.75} />
          ))}
        </g>
        <path d="M 0 600 C 240 560, 420 590, 620 548 C 760 520, 880 540, 968 520 L 968 726 L 0 726 Z" fill="#3A2238" />
        {/* Weg zur Stadt */}
        <path d="M 120 726 C 300 640, 520 600, 720 500 L 745 500 C 560 620, 420 680, 360 726 Z" fill="#C88A62" opacity={0.55} />
        {/* Paulus und Silas */}
        <Robed x={walkX} y={688} k={0.95} dir={1} fill="#1A0F1C" rim="#FFB27A" rimSide={-1} pose={{ step, hood: true }} />
        <Robed x={walkX - 110} y={700} k={0.9} dir={1} fill="#1A0F1C" rim="#FFB27A" rimSide={-1} pose={{ step: step + 1.6, hood: true }} />
      </Monitor>
      {/* Das grosse Banner, das in die Bauchbinde wandert */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 520,
          height: 260,
          opacity: 1 - away,
          transform: `translateY(${away * 480}px) scale(${interpolate(slam, [0, 1], [1.5, 1]) * (1 - 0.6 * away)})`,
        }}
      >
        <div style={{ position: "absolute", left: -40, right: -40, top: 0, bottom: 0, background: RED, transform: "skewY(-4deg)", boxShadow: "0 30px 80px rgba(255,59,59,0.45)" }} />
        <div style={{ position: "absolute", left: -40, right: -40, top: -26, height: 14, background: "#FFFFFF", transform: `skewY(-4deg) scaleX(${slam})`, transformOrigin: "left" }} />
        <div style={{ position: "absolute", left: -40, right: -40, bottom: -26, height: 14, background: "#FFFFFF", transform: `skewY(-4deg) scaleX(${slam})`, transformOrigin: "right" }} />
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", transform: "skewY(-4deg)" }}>
          <span style={{ fontFamily: theme.font.display, fontSize: 172, color: "#FFFFFF", letterSpacing: "0.03em", textTransform: "uppercase", textShadow: "0 8px 30px rgba(120,0,0,0.5)" }}>Eilmeldung</span>
        </div>
      </div>
      <LowerThird tag={s.tag} headline={s.headline} tagOn={fadeIn(t, fremde + 0.05, 0.3)} headOn={fadeIn(t, messias - 0.1, 0.5)} />
      <Sfx frame={2} name="thud" volume={0.5} keep />
      <Sfx frame={voiceFrame(ts, eil)} name="whoosh" volume={0.3} />
    </AbsoluteFill>
  );
};

/** Die Karte: Paulus und Silas unterwegs, drei Städte – jede mit einem Fragezeichen */
const Route: React.FC<P> = ({ ts, s, t, frame, b }) => {
  const [go, three, diff] = b;
  const route = interpolate(t, [go, diff + 0.6], [0, 1], { ...clamp, easing: Easing.inOut(Easing.sin) });
  const pins: [number, number, number] = [popAt(frame, ts, three), popAt(frame, ts, three + 0.35), popAt(frame, ts, three + 0.7)];
  const q = popAt(frame, ts, diff, 170, 11);
  return (
    <AbsoluteFill>
      <Monitor frame={frame} live={false}>
        <GreeceMap frame={frame} pins={pins} route={route} mover={route} q={q} />
      </Monitor>
      <LowerThird tag={s.tag} headline={s.headline} headOn={fadeIn(t, go - 0.1, 0.5)} />
      <Sfx frame={voiceFrame(ts, three)} name="thud" volume={0.3} />
    </AbsoluteFill>
  );
};

/** Thessalonich: Paulus erklärt aus den Schriften, einige glauben */
const Thessalonich: React.FC<P> = ({ ts, s, t, frame, b }) => {
  const [station, explain, messiah, believe] = b;
  const open = interpolate(t, [explain - 0.1, explain + 0.7], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const bubble = popAt(frame, ts, messiah - 0.1, 200, 13);
  const raise = interpolate(t, [messiah - 0.2, messiah + 0.3, believe + 0.4, believe + 1.0], [0, 0.55, 0.55, 0.15], clamp);
  const sitters: Array<[number, number, number]> = [
    [575, 600, 0.9],
    [705, 600, 0.9],
    [835, 600, 0.9],
    [640, 668, 1],
    [770, 668, 1],
    [900, 668, 1],
  ];
  const believers = [1, 3, 5];
  return (
    <AbsoluteFill>
      <Monitor frame={frame} station="STATION 1/3" stationOn={popAt(frame, ts, station)}>
        <defs>
          <radialGradient id="nwGold">
            <stop offset="0%" stopColor="#FFE08A" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#FFE08A" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="nwFire">
            <stop offset="0%" stopColor="#FFB04A" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#FF6A2A" stopOpacity="0" />
          </radialGradient>
        </defs>
        <Synagogue day={false} frame={frame} ark={0.15} />
        <Robed x={235} y={592} k={1.12} dir={1} fill="#1C120C" rim="#F2B661" rimSide={-1} pose={{ hold: raise > 0.05 ? 0 : 1, raise, hood: true }} />
        {open > 0.01 && raise < 0.05 ? (
          <Scroll x={300} y={372} w={130} h={58} open={open} id="nwScrollP" />
        ) : null}
        {sitters.map(([x, y, k], i) => {
          const isB = believers.includes(i);
          const glow = isB ? popAt(frame, ts, believe + believers.indexOf(i) * 0.18, 150, 14) : 0;
          return <Sitter key={i} x={x} y={y} k={k} dir={-1} fill="#140C08" rim={glow > 0.05 ? "#FFD27A" : "#6A4A2E"} lean={0.15} glow={glow} frame={frame} />;
        })}
      </Monitor>
      {/* Sprechblase */}
      {bubble > 0.01 ? (
        <div
          style={{
            position: "absolute",
            left: MON.x + 60,
            top: MON.y + 96,
            padding: "22px 34px",
            borderRadius: 30,
            background: "#FFFFFF",
            boxShadow: "0 16px 40px rgba(0,0,0,0.45)",
            fontFamily: BODY,
            fontWeight: 800,
            fontSize: 50,
            color: INK,
            transform: `scale(${bubble})`,
            transformOrigin: "20% 100%",
          }}
        >
          {s.bubble}
          <div style={{ position: "absolute", left: 140, bottom: -26, width: 0, height: 0, borderLeft: "20px solid transparent", borderRight: "20px solid transparent", borderTop: "30px solid #FFFFFF" }} />
        </div>
      ) : null}
      <LowerThird tag={s.tag} headline={s.headline} headOn={fadeIn(t, explain - 0.1, 0.5)} />
    </AbsoluteFill>
  );
};

/** Aufruhr: erst ein paar Neider, dann eine Menge mit Fackeln; Kommentare poppen auf */
const Riot: React.FC<P> = ({ ts, s, t, frame, b }) => {
  const [envy, crowd, uproar] = b;
  const people = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => {
        const row = i < 3 ? 0 : 1 + ((i - 3) % 3);
        return {
          x: i < 3 ? 120 + i * 62 : 60 + random(`rx${i}`) * 560,
          y: i < 3 ? 640 : 560 + row * 52 + random(`ry${i}`) * 20,
          k: i < 3 ? 0.95 : 0.62 + row * 0.12,
          torch: i >= 3 && random(`rt${i}`) > 0.45,
          seed: random(`rs${i}`) * 10,
          at: i < 3 ? envy - 0.2 + i * 0.12 : crowd - 0.1 + ((i - 3) / 19) * 1.5,
        };
      }).sort((a, c) => a.y - c.y),
    [envy, crowd],
  );
  const heat = interpolate(t, [crowd, uproar + 0.4], [0, 1], clamp);
  const quake = interpolate(t, [uproar - 0.05, uproar + 0.2, ts.speechEndSec + 0.6], [0, 1, 0.5], clamp);
  const shake = quake * 7;
  const sx = (random(`sx${frame}`) - 0.5) * shake;
  const sy = (random(`sy${frame}`) - 0.5) * shake;
  const comments = s.items;
  const cAt = comments.map((_, i) => crowd + 0.25 + i * 0.62);
  const pulse = quake * (0.5 + 0.5 * Math.sin(frame / 3));
  return (
    <AbsoluteFill>
      <Monitor
        frame={frame}
        overlay={
          <div style={{ position: "absolute", right: 22, bottom: 22, width: 470, height: 560 }}>
            {comments.map((text, i) => {
              const on = spring({ frame: frame - voiceFrame(ts, cAt[i]), fps: FPS, config: { damping: 14, stiffness: 210 } });
              if (on <= 0.01) return null;
              const newer = cAt.filter((a, j) => j > i && t >= a).length;
              const rise = cAt.reduce((acc, a, j) => (j > i ? acc + interpolate(t, [a, a + 0.25], [0, 1], clamp) : acc), 0);
              const likes = Math.round(interpolate(t, [cAt[i], cAt[i] + 2.5], [3, 120 + i * 90], clamp));
              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    right: 0,
                    left: 0,
                    bottom: rise * 140,
                    padding: "14px 18px 14px 18px",
                    borderRadius: 18,
                    background: "rgba(8,10,24,0.88)",
                    borderLeft: `8px solid ${RED}`,
                    boxShadow: "0 12px 30px rgba(0,0,0,0.5)",
                    display: "flex",
                    gap: 14,
                    alignItems: "flex-start",
                    opacity: Math.min(1, on * 1.4) * (newer >= 4 ? 0 : 1),
                    transform: `translateX(${interpolate(on, [0, 1], [60, 0])}px)`,
                  }}
                >
                  <div style={{ flex: "0 0 auto", width: 44, height: 44, borderRadius: 22, background: ["#7A3B3B", "#5B3B7A", "#7A5A2B", "#3B5B7A"][i % 4], display: "flex", alignItems: "center", justifyContent: "center", fontFamily: BODY, fontWeight: 800, fontSize: 24, color: "#FFFFFF" }}>
                    {"MKTA"[i % 4]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: BODY, fontWeight: 700, fontSize: 31, lineHeight: 1.18, color: "#FFFFFF" }}>{text}</div>
                    <div style={{ marginTop: 6, fontFamily: BODY, fontWeight: 800, fontSize: 22, color: RED, letterSpacing: "0.04em" }}>▲ {likes}</div>
                  </div>
                </div>
              );
            })}
          </div>
        }
      >
        <defs>
          <linearGradient id="nwNight" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#070B1E" />
            <stop offset="70%" stopColor="#22122A" />
            <stop offset="100%" stopColor="#4A1A1E" />
          </linearGradient>
          <radialGradient id="nwFire">
            <stop offset="0%" stopColor="#FFB04A" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#FF6A2A" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="nwGold">
            <stop offset="0%" stopColor="#FFE08A" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#FFE08A" stopOpacity="0" />
          </radialGradient>
        </defs>
        <g transform={`translate(${sx} ${sy})`}>
          <rect x={-20} y={-20} width={MON.w + 40} height={MON.h + 40} fill="url(#nwNight)" />
          <ellipse cx={360} cy={700} rx={600} ry={260} fill="#FF6A2A" opacity={0.08 + 0.28 * heat} />
          {/* Häuser hinten */}
          <path d="M -20 420 L 60 420 L 60 360 L 150 360 L 150 400 L 260 400 L 260 330 L 330 330 L 330 390 L 470 390 L 470 350 L 600 350 L 600 410 L 720 410 L 720 340 L 840 340 L 840 400 L 990 400 L 990 760 L -20 760 Z" fill="#160F22" />
          {/* Das Haus des Jason */}
          <g transform="translate(250 300)">
            <rect x={0} y={0} width={300} height={300} fill="#2A1C2C" />
            <rect x={-14} y={-18} width={328} height={22} fill="#1C1220" />
            <rect x={40} y={60} width={46} height={58} fill="#FFB060" opacity={0.25 + 0.5 * heat} />
            <rect x={214} y={60} width={46} height={58} fill="#FFB060" opacity={0.25 + 0.5 * heat} />
            <path d="M 112 300 L 112 190 A 38 38 0 0 1 188 190 L 188 300 Z" fill="#120A12" />
            <text x={150} y={150} textAnchor="middle" fontFamily="Cinzel" fontWeight={700} fontSize={28} fill="#E8C9A0" opacity={0.85}>
              JASON
            </text>
          </g>
          <rect x={-20} y={600} width={MON.w + 40} height={160} fill="#1A1016" />
          {/* Die Menge */}
          {people.map((pp, i) => {
            const on = interpolate(t, [pp.at, pp.at + 0.3], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.6)) });
            if (on <= 0.01) return null;
            const arm = pp.torch ? 0.6 + 0.4 * heat * (0.5 + 0.5 * Math.sin(frame / 4 + pp.seed)) : heat * (0.4 + 0.4 * Math.sin(frame / 3.5 + pp.seed));
            return (
              <g key={i} transform={`translate(0 ${(1 - on) * 80})`} opacity={on}>
                <Rioter x={pp.x} y={pp.y} k={pp.k} fill={i % 3 === 0 ? "#0A0610" : "#120A14"} torch={pp.torch} arm={arm} frame={frame} seed={pp.seed} heat={heat} />
              </g>
            );
          })}
          {/* Neid: ein roter Schimmer um die ersten drei */}
          <ellipse cx={180} cy={560} rx={150} ry={120} fill={RED} opacity={0.18 * interpolate(t, [envy, envy + 0.5, crowd + 0.5], [0, 1, 0], clamp)} />
        </g>
        <rect x={0} y={0} width={MON.w} height={MON.h} fill={RED} opacity={0.14 * pulse} />
      </Monitor>
      <LowerThird tag={s.tag} headline={s.headline} headOn={fadeIn(t, uproar - 0.1, 0.45)} />
      <Sfx frame={voiceFrame(ts, uproar)} name="thud" volume={0.5} keep />
    </AbsoluteFill>
  );
};

/** Beröa: Flucht in der Nacht auf der Karte, dann die Synagoge am Tag – der Schrein geht auf */
const Beroea: React.FC<P> = ({ ts, s, t, frame, b }) => {
  const [flee, station, openAt] = b;
  const cut = interpolate(t, [station - 0.35, station + 0.05], [0, 1], clamp);
  const route = interpolate(t, [flee - 0.2, station - 0.4], [0, BEROEA_AT], { ...clamp, easing: Easing.inOut(Easing.sin) });
  const ark = interpolate(t, [openAt - 0.1, openAt + 0.8], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const lean = interpolate(t, [openAt, openAt + 0.8], [0, 1], clamp);
  const sitters: Array<[number, number, number, boolean]> = [
    [575, 600, 0.9, true],
    [705, 600, 0.9, false],
    [835, 600, 0.9, true],
    [640, 668, 1, false],
    [770, 668, 1, true],
    [900, 668, 1, false],
  ];
  return (
    <AbsoluteFill>
      <Monitor frame={frame} station={cut > 0.5 ? "STATION 2/3" : undefined} stationOn={popAt(frame, ts, station)}>
        <defs>
          <radialGradient id="nwGold">
            <stop offset="0%" stopColor="#FFE08A" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#FFE08A" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="nwFire">
            <stop offset="0%" stopColor="#FFB04A" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#FF6A2A" stopOpacity="0" />
          </radialGradient>
        </defs>
        {cut < 1 ? (
          <g opacity={1 - cut}>
            <GreeceMap frame={frame} pins={[1, 1, 0]} route={route} mover={route} night={1} zoom={{ cx: 425, cy: 190, s: 2.3 }} />
            {/* Mond */}
            <circle cx={820} cy={130} r={46} fill="#FFF3CF" opacity={0.9} />
            <circle cx={842} cy={118} r={42} fill="#071226" />
          </g>
        ) : null}
        {cut > 0 ? (
          <g opacity={cut}>
            <Synagogue day frame={frame} ark={ark} />
            <Robed x={235} y={592} k={1.12} dir={1} fill="#2A1C14" rim="#FFE2A8" rimSide={-1} pose={{ reach: 0.5 + 0.3 * Math.sin(frame / 14), hood: true }} />
            {sitters.map(([x, y, k, sc], i) => (
              <Sitter key={i} x={x} y={y} k={k} dir={-1} fill="#2A1A10" rim="#FFE2A8" lean={0.1 + 0.55 * lean} frame={frame} scroll={sc} />
            ))}
          </g>
        ) : null}
      </Monitor>
      {cut < 0.5 ? (
        <div style={{ position: "absolute", left: MON.x + 26, top: MON.y + 24, padding: "8px 18px", borderRadius: 10, background: "rgba(5,8,20,0.8)", fontFamily: BODY, fontWeight: 800, fontSize: 26, letterSpacing: "0.14em", color: "#9CCBFF", opacity: 1 - cut * 2 }}>
          ☾ NACHTS UNTERWEGS
        </div>
      ) : null}
      <LowerThird tag={s.tag} headline={s.headline} headOn={fadeIn(t, openAt - 0.1, 0.5)} />
    </AbsoluteFill>
  );
};

/** Faktencheck: Schriftrolle, Lupe, Tag für Tag ein Haken, der Stempel – und viele glauben */
const Check: React.FC<P> = ({ ts, s, t, frame, b }) => {
  const [notAll, daily, true_, many] = b;
  const open = interpolate(frame, [2, 22], [0.08, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const badge = popAt(frame, ts, notAll - 0.1);
  const lupeP = interpolate(t, [daily - 0.2, true_ + 0.2], [0, 1], clamp);
  const lines = 5;
  const lineY = (i: number) => -100 + i * 46;
  const lupeLine = Math.min(lines - 1, Math.floor(lupeP * lines));
  const lupeX = interpolate((lupeP * lines) % 1, [0, 1], [-300, 300]);
  const stamp = popAt(frame, ts, true_, 200, 11);
  const calOut = interpolate(t, [many - 0.2, many + 0.3], [0, 1], clamp);
  const days = 7;
  return (
    <AbsoluteFill>
      <Monitor frame={frame} live={false}>
        <defs>
          <linearGradient id="nwTable" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#5A3A22" />
            <stop offset="100%" stopColor="#2E1C10" />
          </linearGradient>
          <radialGradient id="nwLamp" cx="50%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#FFD9A0" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#FFD9A0" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="nwGold">
            <stop offset="0%" stopColor="#FFE08A" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#FFE08A" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect x={0} y={0} width={MON.w} height={MON.h} fill="url(#nwTable)" />
        {Array.from({ length: 14 }, (_, i) => (
          <path key={i} d={`M -20 ${30 + i * 52} C 300 ${20 + i * 52 + (i % 3) * 8}, 600 ${44 + i * 52}, 1000 ${28 + i * 52}`} stroke="#2A170A" strokeWidth={3} fill="none" opacity={0.45} />
        ))}
        <rect x={0} y={0} width={MON.w} height={MON.h} fill="url(#nwLamp)" />
        <Scroll x={484} y={290} w={800} h={300} open={open} id="nwScrollC">
          {Array.from({ length: lines }, (_, i) => (
            <g key={i}>
              {t >= daily - 0.2 && (i < lupeLine || (i === lupeLine && lupeP > 0)) ? (
                <rect x={-330} y={lineY(i) - 18} width={i < lupeLine ? 660 : lupeX + 330} height={34} rx={6} fill="#FFE45C" opacity={0.55} />
              ) : null}
              <path
                d={`M -320 ${lineY(i)} ${Array.from({ length: 16 }, (_, k) => `q 10 ${k % 2 ? -12 : 10} 20 0 t 20 0`).join(" ")}`}
                stroke="#4A2E12"
                strokeWidth={4}
                fill="none"
                opacity={0.7}
                strokeLinecap="round"
                transform={`scale(${i === lines - 1 ? 0.6 : 1} 1)`}
              />
            </g>
          ))}
        </Scroll>
        {/* Lupe */}
        {lupeP > 0 && lupeP < 1 ? (
          <g transform={`translate(${484 + lupeX + 40} ${290 + lineY(lupeLine) + 40})`}>
            <line x1={46} y1={46} x2={120} y2={120} stroke="#2A1A0E" strokeWidth={20} strokeLinecap="round" />
            <circle r={64} fill="#CFE8FF" opacity={0.22} stroke="#E8EEF6" strokeWidth={10} />
            <path d="M -36 -30 A 44 44 0 0 1 4 -50" stroke="#FFFFFF" strokeWidth={7} fill="none" opacity={0.6} />
          </g>
        ) : null}
        {/* Kalender: Tag für Tag ein Haken */}
        <g opacity={1 - calOut} transform={`translate(0 ${calOut * 40})`}>
          {Array.from({ length: days }, (_, i) => {
            const x = 40 + i * 128;
            const k = popAt(frame, ts, daily + i * 0.32, 220, 12);
            return (
              <g key={i}>
                <rect x={x} y={526} width={116} height={150} rx={16} fill="#0B1430" stroke={k > 0.5 ? OK : "#2C3B66"} strokeWidth={3} />
                <rect x={x} y={526} width={116} height={40} rx={16} fill={k > 0.5 ? OK : "#2C3B66"} />
                <rect x={x} y={550} width={116} height={16} fill={k > 0.5 ? OK : "#2C3B66"} />
                <text x={x + 58} y={556} textAnchor="middle" fontFamily={BODY} fontWeight={800} fontSize={24} fill={k > 0.5 ? INK : "#C9D6F2"}>
                  TAG {i + 1}
                </text>
                <path d={`M ${x + 34} ${618} L ${x + 52} ${636} L ${x + 84} ${598}`} stroke={OK} strokeWidth={10} fill="none" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={`${Math.max(0, k)} 1`} />
              </g>
            );
          })}
        </g>
        {/* Viele kommen zum Glauben */}
        {calOut > 0.01
          ? Array.from({ length: 11 }, (_, i) => {
              const x = 64 + i * 84;
              const k = popAt(frame, ts, many + 0.1 + i * 0.08, 170, 13);
              return (
                <g key={i} transform={`translate(${x} ${700 - 60 * k})`} opacity={k}>
                  <circle cx={0} cy={-120} r={50} fill="url(#nwGold)" />
                  <circle cx={0} cy={-128} r={20} fill="#2A1A10" stroke="#FFD27A" strokeWidth={3} />
                  <path d="M -30 -10 C -30 -70, -22 -100, 0 -104 C 22 -100, 30 -70, 30 -10 Z" fill="#2A1A10" stroke="#FFD27A" strokeWidth={3} />
                </g>
              );
            })
          : null}
        <Stamp x={700} y={180} text="GEPRÜFT" color={OK} pop={stamp} rot={-10} size={70} font={theme.font.display} />
      </Monitor>
      {/* Faktencheck-Etikett */}
      <div
        style={{
          position: "absolute",
          left: MON.x + 26,
          top: MON.y + 24,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "8px 18px",
          borderRadius: 10,
          background: "rgba(5,8,20,0.82)",
          border: `2px solid ${OK}`,
          fontFamily: BODY,
          fontWeight: 800,
          fontSize: 28,
          letterSpacing: "0.12em",
          color: OK,
          opacity: badge,
          transform: `scale(${interpolate(badge, [0, 1], [0.7, 1])})`,
          transformOrigin: "left center",
        }}
      >
        <span style={{ display: "inline-flex", width: 34, height: 34, borderRadius: 17, background: OK, color: INK, alignItems: "center", justifyContent: "center", fontSize: 26 }}>?</span>
        STIMMT DAS?
      </div>
      <LowerThird tag={s.tag} headline={s.headline} headOn={fadeIn(t, daily - 0.1, 0.5)} />
      <Sfx frame={voiceFrame(ts, true_)} name="stamp" volume={0.5} keep />
    </AbsoluteFill>
  );
};

/** Ein Tempel auf dem Felsen – Säulen, Giebel, Stufen */
const Parthenon: React.FC<{ x: number; y: number; k: number; color: string; shade: string }> = ({ x, y, k, color, shade }) => (
  <g transform={`translate(${x} ${y}) scale(${k})`}>
    <path d="M -150 0 L 150 0 L 150 -10 L -150 -10 Z" fill={shade} />
    <path d="M -142 -10 L 142 -10 L 142 -20 L -142 -20 Z" fill={color} />
    {Array.from({ length: 8 }, (_, i) => (
      <rect key={i} x={-128 + i * 34} y={-96} width={18} height={76} fill={color} />
    ))}
    <rect x={-138} y={-110} width={276} height={16} fill={color} />
    <path d="M -144 -110 L 0 -150 L 144 -110 Z" fill={color} />
    <path d="M -120 -114 L 0 -144 L 120 -114 Z" fill={shade} opacity={0.5} />
  </g>
);

/** Athen: Gegner hinterher, Paulus übers Meer – dann die Stadt und die Trend-Liste, die sich ständig neu sortiert */
const Athens: React.FC<P> = ({ ts, s, t, frame, b }) => {
  const [foes, station, lust, newest] = b;
  const cut = interpolate(t, [station - 0.35, station + 0.05], [0, 1], clamp);
  const foeP = interpolate(t, [foes - 0.1, station - 0.6], [0, 1], { ...clamp, easing: Easing.inOut(Easing.sin) });
  const sail = interpolate(t, [foes + 0.4, station - 0.3], [BEROEA_AT, 1], { ...clamp, easing: Easing.inOut(Easing.sin) });
  const items = s.items;
  const n = items.length;
  /* Die Reihenfolge der Trends: ab «nichts lieber» alle 0.55 s neu gemischt, ab «das Neueste» schneller */
  const orders = useMemo(() => {
    const out: number[][] = [Array.from({ length: n }, (_, i) => i)];
    for (let k = 1; k < 30; k++) {
      const prev = out[k - 1].slice();
      const a = Math.floor(random(`ta${k}`) * n);
      let c = Math.floor(random(`tb${k}`) * n);
      if (c === a) c = (a + 1) % n;
      [prev[a], prev[c]] = [prev[c], prev[a]];
      // ab und zu springt ein Eintrag ganz nach oben
      if (random(`tc${k}`) > 0.55) {
        const top = prev.splice(Math.floor(random(`td${k}`) * n), 1)[0];
        prev.unshift(top);
      }
      out.push(prev);
    }
    return out;
  }, [n]);
  const stepAt = (k: number) => (k <= 0 ? -99 : lust + 0.2 + Math.min(k, 4) * 0.55 + Math.max(0, k - 4) * 0.3);
  let k = 0;
  while (k < orders.length - 1 && t >= stepAt(k + 1)) k++;
  const kp = Math.max(0, k - 1);
  const mv = k === 0 ? 1 : interpolate(t, [stepAt(k), stepAt(k) + 0.26], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const panel = popAt(frame, ts, lust - 0.3, 160, 15);
  const ROW = 82;
  return (
    <AbsoluteFill>
      <Monitor frame={frame} live={cut > 0.5} station={cut > 0.5 ? "STATION 3/3" : undefined} stationOn={popAt(frame, ts, station)}>
        <defs>
          <linearGradient id="nwAthSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2C4A8A" />
            <stop offset="55%" stopColor="#C98A6A" />
            <stop offset="100%" stopColor="#F6C27A" />
          </linearGradient>
        </defs>
        {cut < 1 ? (
          <g opacity={1 - cut}>
            <GreeceMap frame={frame} pins={[1, 1, popAt(frame, ts, station - 0.6)]} route={1} mover={sail} foes={foeP} />
          </g>
        ) : null}
        {cut > 0 ? (
          <g opacity={cut}>
            <rect x={0} y={0} width={MON.w} height={MON.h} fill="url(#nwAthSky)" />
            <circle cx={180} cy={420} r={90} fill="#FFE6B0" opacity={0.6} />
            {/* Akropolis */}
            <path d="M -20 470 C 40 380, 120 330, 230 322 C 330 318, 420 340, 470 400 C 500 440, 520 470, 540 500 L -20 500 Z" fill="#6E5560" />
            <Parthenon x={260} y={328} k={1.02} color="#F4E6CC" shade="#B89C88" />
            {/* Häuser der Stadt */}
            {Array.from({ length: 16 }, (_, i) => {
              const x = -20 + i * 64 + (i % 2) * 14;
              const h = 60 + ((i * 37) % 5) * 18;
              return <rect key={i} x={x} y={560 - h} width={58} height={h + 200} fill={i % 2 ? "#B88F74" : "#A07A64"} stroke="#7A5A4A" strokeWidth={2} />;
            })}
            <rect x={0} y={560} width={MON.w} height={170} fill="#8A6A58" />
            {/* Leute auf dem Markt, die hin und her eilen */}
            {Array.from({ length: 9 }, (_, i) => {
              const dir = i % 2 ? 1 : -1;
              const x = ((random(`ax${i}`) * 1100 + dir * frame * (1.6 + random(`av${i}`) * 1.4)) % 1100 + 1100) % 1100 - 70;
              return <Robed key={i} x={x} y={700 - (i % 3) * 18} k={0.42 + (i % 3) * 0.04} dir={dir as 1 | -1} fill="#3A2420" rim="#FFD8A0" rimSide={-dir as 1 | -1} pose={{ step: frame / 3.5 + i, hood: i % 3 !== 0 }} shadow={false} />;
            })}
          </g>
        ) : null}
      </Monitor>
      {/* Trend-Liste */}
      {cut > 0.5 && panel > 0.01 ? (
        <div
          style={{
            position: "absolute",
            right: 1080 - MON.x - MON.w + 22,
            top: MON.y + 96,
            width: 540,
            height: 74 + n * ROW + 14,
            borderRadius: 22,
            background: "rgba(8,12,30,0.9)",
            border: `2px solid rgba(63,169,255,0.5)`,
            boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
            overflow: "hidden",
            opacity: panel,
            transform: `translateX(${interpolate(panel, [0, 1], [80, 0])}px)`,
          }}
        >
          <div style={{ height: 66, display: "flex", alignItems: "center", gap: 12, paddingLeft: 24, background: BLUE, fontFamily: BODY, fontWeight: 800, fontSize: 28, letterSpacing: "0.14em", color: "#FFFFFF" }}>
            <svg width={30} height={30} viewBox="0 0 30 30">
              <path d="M 3 22 L 11 13 L 17 18 L 27 6" stroke="#FFFFFF" strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M 19 6 L 27 6 L 27 14" stroke="#FFFFFF" strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            TRENDS · ATHEN
          </div>
          {items.map((text, i) => {
            const from = orders[kp].indexOf(i);
            const to = orders[k].indexOf(i);
            const pos = from + (to - from) * mv;
            const up = to < from;
            const fresh = k > 0 && to === 0 && from !== 0 && t < stepAt(k) + 0.5;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: 74 + pos * ROW,
                  height: ROW - 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  padding: "0 20px",
                  background: fresh ? "rgba(255,59,59,0.18)" : "transparent",
                }}
              >
                <span style={{ width: 42, fontFamily: theme.font.display, fontSize: 44, color: to === 0 ? GOLD : "rgba(255,255,255,0.55)", textAlign: "center" }}>{to + 1}</span>
                <span style={{ flex: 1, fontFamily: BODY, fontWeight: 700, fontSize: 30, color: "#FFFFFF", whiteSpace: "nowrap", overflow: "hidden" }}>{text}</span>
                {fresh ? (
                  <span style={{ padding: "4px 10px", borderRadius: 8, background: RED, fontFamily: BODY, fontWeight: 800, fontSize: 20, color: "#FFFFFF" }}>NEU</span>
                ) : (
                  <span style={{ fontFamily: BODY, fontWeight: 800, fontSize: 26, color: k === 0 ? "rgba(255,255,255,0.3)" : up ? OK : RED }}>{k === 0 ? "–" : up ? "▲" : to > from ? "▼" : "–"}</span>
                )}
              </div>
            );
          })}
        </div>
      ) : null}
      {cut < 0.5 ? (
        <div style={{ position: "absolute", left: MON.x + 26, top: MON.y + 24, padding: "8px 18px", borderRadius: 10, background: "rgba(5,8,20,0.8)", border: `2px solid ${RED}`, fontFamily: BODY, fontWeight: 800, fontSize: 26, letterSpacing: "0.12em", color: "#FFFFFF", opacity: 1 - cut * 2 }}>
          <span style={{ color: RED }}>●</span> GEGNER UNTERWEGS
        </div>
      ) : null}
      <LowerThird tag={cut > 0.5 ? s.tag : "Unterwegs"} headline={s.headline} headOn={fadeIn(t, newest - 0.1, 0.45)} />
      <Sfx frame={voiceFrame(ts, newest)} name="swipe" volume={0.25} />
    </AbsoluteFill>
  );
};

/* Symbole für die drei Kacheln */
const TorchIcon: React.FC<{ frame: number }> = ({ frame }) => {
  const fl = 1 + 0.14 * Math.sin(frame / 2.3) + 0.07 * Math.sin(frame / 3.9);
  return (
    <g>
      <circle cx={0} cy={-40} r={90} fill="url(#nwFire)" opacity={0.8} />
      <rect x={-10} y={-10} width={20} height={110} rx={8} fill="#5A3A22" />
      <rect x={-18} y={-18} width={36} height={22} rx={6} fill="#3A2416" />
      <g transform={`translate(0 -20) scale(${fl} ${fl * 1.1})`}>
        <path d="M 0 -80 C 34 -44, 36 -8, 0 12 C -36 -8, -34 -44, 0 -80 Z" fill="#FF6A2A" />
        <path d="M 0 -48 C 16 -28, 18 -8, 0 4 C -18 -8, -16 -28, 0 -48 Z" fill="#FFD27A" />
      </g>
    </g>
  );
};
const RefreshIcon: React.FC<{ frame: number }> = ({ frame }) => (
  <g>
    <g transform={`rotate(${frame * 6})`}>
      <path d="M -60 -10 A 62 62 0 0 1 50 -36" stroke={BLUE} strokeWidth={16} fill="none" strokeLinecap="round" />
      <path d="M 36 -64 L 60 -30 L 22 -22 Z" fill={BLUE} />
      <path d="M 60 10 A 62 62 0 0 1 -50 36" stroke={BLUE} strokeWidth={16} fill="none" strokeLinecap="round" />
      <path d="M -36 64 L -60 30 L -22 22 Z" fill={BLUE} />
    </g>
    <g transform="translate(40 70) rotate(-8)">
      <rect x={-44} y={-22} width={88} height={44} rx={10} fill={RED} />
      <text y={12} textAnchor="middle" fontFamily={BODY} fontWeight={800} fontSize={28} fill="#FFFFFF">
        NEU
      </text>
    </g>
  </g>
);
const ScrollCheckIcon: React.FC<{ check: number }> = ({ check }) => (
  <g>
    <rect x={-70} y={-56} width={140} height={112} fill="#F7E7C2" stroke="#B88A3A" strokeWidth={3} />
    {[-70, 70].map((x) => (
      <rect key={x} x={x - 12} y={-70} width={24} height={140} rx={11} fill="#B07A3A" stroke="#6E4A1E" strokeWidth={2} />
    ))}
    {[0, 1, 2, 3].map((l) => (
      <path key={l} d={`M -46 ${-30 + l * 20} q 12 -5 23 0 t 23 0 t 23 0 t 23 0`} stroke="#6E4A1E" strokeWidth={3} fill="none" opacity={0.5} />
    ))}
    <g transform="translate(50 50)">
      <circle r={40} fill={OK} opacity={check} />
      <path d="M -18 0 L -4 14 L 20 -12" stroke={INK} strokeWidth={9} fill="none" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={`${check} 1`} />
    </g>
  </g>
);

/** Die drei Städte nebeneinander: aufregen, nur Neues – und Beröa: offen und prüfen */
const Choice: React.FC<P> = ({ ts, t, frame, b, s }) => {
  const [three, upset, novel, beroea, check] = b;
  const tiles = [
    { name: "Thessalonich", label: ["AUFREGEN"], color: RED, at: upset },
    { name: "Athen", label: ["NUR", "NEUES"], color: BLUE, at: novel },
    { name: "Beröa", label: ["OFFEN", "+ PRÜFEN"], color: GOLD, at: beroea },
  ];
  const win = popAt(frame, ts, check, 150, 12);
  const checkK = interpolate(t, [check, check + 0.5], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Monitor frame={frame} live={false}>
        <defs>
          <radialGradient id="nwFire">
            <stop offset="0%" stopColor="#FFB04A" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#FF6A2A" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="nwGold">
            <stop offset="0%" stopColor="#FFE08A" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#FFE08A" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect x={0} y={0} width={MON.w} height={MON.h} fill="#081028" />
        {Array.from({ length: 12 }, (_, i) => (
          <line key={i} x1={i * 88} y1={0} x2={i * 88} y2={MON.h} stroke={BLUE} strokeWidth={1} opacity={0.08} />
        ))}
        {tiles.map((tile, i) => {
          const frameOn = popAt(frame, ts, three + i * 0.15, 200, 15);
          const fill = popAt(frame, ts, tile.at, 170, 13);
          const isB = i === 2;
          const dim = isB ? 1 : 1 - 0.55 * win;
          const grow = isB ? 1 + 0.05 * win : 1 - 0.03 * win;
          const x = 26 + i * 314;
          const w = 290;
          return (
            <g key={i} transform={`translate(${x + w / 2} 363) scale(${grow * interpolate(frameOn, [0, 1], [0.85, 1])}) translate(${-(x + w / 2)} -363)`} opacity={Math.min(1, frameOn * 1.5) * dim}>
              {isB && win > 0.01 ? <rect x={x - 14} y={14} width={w + 28} height={698} rx={34} fill={GOLD} opacity={0.18 * win} /> : null}
              <rect x={x} y={30} width={w} height={666} rx={26} fill="#0E1838" stroke={tile.color} strokeWidth={isB ? 4 + 4 * win : 4} />
              <rect x={x} y={30} width={w} height={666} rx={26} fill={tile.color} opacity={0.16 * fill} />
              <text x={x + w / 2} y={104} textAnchor="middle" fontFamily={theme.font.display} fontSize={i === 0 ? 46 : 54} fill="#FFFFFF" letterSpacing={1} style={{ textTransform: "uppercase" }}>
                {tile.name.toUpperCase()}
              </text>
              <line x1={x + 40} y1={128} x2={x + w - 40} y2={128} stroke={tile.color} strokeWidth={3} opacity={0.7} />
              {fill < 0.5 ? (
                <text x={x + w / 2} y={420} textAnchor="middle" fontFamily={theme.font.display} fontSize={150} fill={tile.color} opacity={0.35 * (1 - fill * 2)}>
                  ?
                </text>
              ) : null}
              <g transform={`translate(${x + w / 2} 370) scale(${fill})`} opacity={fill}>
                {i === 0 ? <TorchIcon frame={frame} /> : i === 1 ? <RefreshIcon frame={frame} /> : <ScrollCheckIcon check={checkK} />}
              </g>
              {tile.label.map((line, j) => (
                <text
                  key={j}
                  x={x + w / 2}
                  y={(tile.label.length > 1 ? 580 : 612) + j * 66}
                  textAnchor="middle"
                  fontFamily={theme.font.display}
                  fontSize={62}
                  fill={tile.color}
                  opacity={isB && j === 1 ? checkK : fill}
                >
                  {line}
                </text>
              ))}
            </g>
          );
        })}
      </Monitor>
      <LowerThird tag={s.tag} headline={s.headline} headOn={fadeIn(t, three - 0.1, 0.5)} />
      <Sfx frame={voiceFrame(ts, check)} name="warm" volume={0.45} keep />
    </AbsoluteFill>
  );
};

export const Scene: React.FC<{ ts: TimelineScene }> = ({ ts }) => {
  const s = ts.scene as NewsSceneT;
  const frame = useCurrentFrame();
  const t = (frame - ts.audioOffsetFrames) / FPS;
  const b = beats(ts, s.cues, Math.max(4, s.cues.length));
  const p = { ts, s, t, frame, b };
  switch (s.stage) {
    case "breaking":
      return <Breaking {...p} />;
    case "route":
      return <Route {...p} />;
    case "thessalonich":
      return <Thessalonich {...p} />;
    case "riot":
      return <Riot {...p} />;
    case "beroea":
      return <Beroea {...p} />;
    case "check":
      return <Check {...p} />;
    case "athens":
      return <Athens {...p} />;
    case "choice":
      return <Choice {...p} />;
    default:
      return null;
  }
};

/** «Eilmeldung» steht als Banner gross im Bild, die Sprechblase in Thessalonich ebenso – nicht noch einmal untertiteln. */
export const hidden = (ts: TimelineScene): Set<number> => {
  const s = ts.scene as NewsSceneT;
  if (s.stage === "breaking") return wordsOfTexts(ts, ["Eilmeldung"]);
  if (s.stage === "thessalonich") return wordsOfTexts(ts, [s.bubble]);
  return new Set();
};
