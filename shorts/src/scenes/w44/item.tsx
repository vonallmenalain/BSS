import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, random, spring, useCurrentFrame } from "remotion";
import { useLook } from "../../looks";
import { mix } from "../../lib/color";
import { Sfx, beat, voiceFrame } from "../../lib/sfx";
import { FPS, type TimelineScene } from "../../lib/timing";
import type { Scene } from "../../schema";

/*
 * Game-Look: ein Item wie in einem Videospiel. Im Bossfight gegen die Matheprüfung fällt es
 * vom Himmel, zeigt auf seiner Karte die Werte – und fliegt als verflucht auf. Oder es ist
 * ein Segen. Am Schluss die Wahl: aufheben oder liegen lassen. Alle Zeitpunkte sind Phrasen
 * aus der narration.
 */

type ItemScene = Extract<Scene, { type: "item" }>;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const PIXEL = '"Press Start 2P"';
const CURSE = "#9B5CFF";
const CURSE_DEEP = "#4B1478";
const GOLD = "#F6C86A";
const BLESS = "#7CFFB2";

/* ---------------- Pixel-Bilder ---------------- */

const SCROLL = [
  "..rrrrrrrrrrrrrr..",
  ".rRRRRRRRRRRRRRRr.",
  "rRRrrrrrrrrrrrrRRr",
  ".rRwwwwwwwwwwwwRr.",
  "..wwwwwwwwwwwwww..",
  "..wkkkwkkwkkkwkw..",
  "..wwwwwwwwwwwwww..",
  "..wkkwkkkkwwkkkw..",
  "..wwwwwwwwwwwwww..",
  "..wkkkkwkkkwkkww..",
  "..wwwwwwwwwwwwww..",
  "..wkkwkkwkkkkwkw..",
  "..wwwwwwwwwwwwww..",
  ".rRwwwwwwwwwwwwRr.",
  "rRRrrrrrrrrrrrrRRr",
  ".rRRRRRRRRRRRRRRr.",
  "..rrrrrrrrrrrrrr..",
];
const SCROLL_PAL: Record<string, string> = { r: "#7A4A1E", R: "#D9A55B", w: "#FFF3D6", k: "#4A3A6A" };

const HEART = [
  "...RRRR....RRRR...",
  "..RrrrrR..RrrrrR..",
  ".RrWWrrrRRrrrrrrR.",
  "RrWWrrrrrrrrrrrrrR",
  "RrWrrrrrrrrrrrrrrR",
  "RrrrrrrrrrrrrrrrrR",
  "RrrrrrrrrrrrrrrrrR",
  ".RrrrrrrrrrrrrrrR.",
  "..RrrrrrrrrrrrrR..",
  "...RrrrrrrrrrrR...",
  "....RrrrrrrrrR....",
  ".....RrrrrrrR.....",
  "......RrrrrR......",
  ".......RrrR.......",
  "........RR........",
];
const HEART_PAL: Record<string, string> = { R: "#A0124A", r: "#FF4F86", W: "#FFFFFF" };

const SKULL = [
  "...wwwwww...",
  "..wwwwwwww..",
  ".wwwwwwwwww.",
  ".wkkwwwwkkw.",
  ".wkkkwwkkkw.",
  ".wwwwwwwwww.",
  "..wwwkkwww..",
  "...wwwwww...",
  "...wkwkwk...",
  "...wwwwww...",
];
const SKULL_PAL: Record<string, string> = { w: "#EDE4FF", k: "#2A0A3A" };

/* Die Matheprüfung als Endgegner: ein Blatt mit bösen Augen und Zähnen */
const BOSS = [
  "...SSSSSSSSSSSSSS....",
  "...SwwwwwwwwwwwwSS...",
  "...SwkkwkwkkwwwwSwS..",
  "...SwwwwwwwwwwwwSSSS.",
  "...SwEEEwwwwwwEEEwwS.",
  "...SwwEEEwwwwEEEwwwS.",
  "...SwwwRRwwwwRRwwwwS.",
  "...SwwwRRwwwwRRwwwwS.",
  ".AASwwwwwwwwwwwwwwwSAA",
  ".A.SwMMMMMMMMMMMMMwS.A",
  "...SwMTMTMTMTMTMTMwS..",
  "...SwMMMMMMMMMMMMMwS..",
  "...SwwwwwwwwwwwwwwwS..",
  "...SwkkwkkkwkwkkwwwS..",
  "...SwwwwwwwwwwwwwwwS..",
  "...SwkkkwkkwkkkwkwwS..",
  "...SwwwwwwwwwwwwwwwS..",
  "...SSSSSSSSSSSSSSSSS..",
  "......LL.....LL.......",
  "......LL.....LL.......",
  ".....FFF.....FFF......",
];
const BOSS_PAL: Record<string, string> = {
  S: "#1B1030",
  w: "#F4F1FF",
  k: "#8A86B8",
  E: "#1B1030",
  R: "#FF3B5C",
  M: "#2A0A3A",
  T: "#FFFFFF",
  A: "#1B1030",
  L: "#1B1030",
  F: "#FF4FD8",
};

const PixelArt: React.FC<{
  rows: string[];
  pal: Record<string, string>;
  x: number;
  y: number;
  px: number;
  tint?: string;
  tintAmt?: number;
  /** 0 → 1: Pixel bauen sich auf */
  build?: number;
  seed?: string;
}> = ({ rows, pal, x, y, px, tint, tintAmt = 0, build = 1, seed = "pa" }) => {
  const cells = useMemo(
    () => rows.flatMap((row, r) => row.split("").flatMap((ch, c) => (ch === "." || !pal[ch] ? [] : [{ r, c, ch, d: random(`${seed}${r}-${c}`) * 0.6 }]))),
    [rows, pal, seed],
  );
  return (
    <g transform={`translate(${x} ${y})`}>
      {cells.map(({ r, c, ch, d }) => {
        const p = interpolate(build, [d, d + 0.4], [0, 1], clamp);
        if (p <= 0) return null;
        const color = tint && tintAmt > 0 ? mix(pal[ch], tint, tintAmt) : pal[ch];
        return <rect key={`${r}-${c}`} x={c * px} y={r * px - (1 - p) * 40} width={px + 0.5} height={px + 0.5} fill={color} opacity={p} />;
      })}
    </g>
  );
};

const artSize = (rows: string[], px: number) => ({ w: Math.max(...rows.map((r) => r.length)) * px, h: rows.length * px });

/** Rahmen mit Neonkante und Eckwinkeln – wie die Charakterkarte */
const Frame: React.FC<{ x: number; y: number; w: number; h: number; c1: string; c2: string; fill: string }> = ({ x, y, w, h, c1, c2, fill }) => {
  const corner = 46;
  return (
    <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
      <defs>
        <linearGradient id="itemEdge" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={c1} />
          <stop offset="100%" stopColor={c2} />
        </linearGradient>
      </defs>
      <rect x={x} y={y} width={w} height={h} rx={26} fill={fill} stroke="url(#itemEdge)" strokeWidth={5} style={{ filter: `drop-shadow(0 0 14px ${c1})` }} />
      {[
        [x - 12, y - 12, 1, 1],
        [x + w + 12, y - 12, -1, 1],
        [x - 12, y + h + 12, 1, -1],
        [x + w + 12, y + h + 12, -1, -1],
      ].map(([cx, cy, sx, sy], i) => (
        <path key={i} d={`M ${cx} ${cy + sy * corner} L ${cx} ${cy} L ${cx + sx * corner} ${cy}`} stroke={c2} strokeWidth={7} fill="none" />
      ))}
    </svg>
  );
};

/** Strahlen hinter einem Gegenstand */
const Rays: React.FC<{ cx: number; cy: number; color: string; amount: number; frame: number; r0?: number; r1?: number }> = ({ cx, cy, color, amount, frame, r0 = 110, r1 = 330 }) => (
  <>
    {Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2 + frame / 50;
      return (
        <path
          key={i}
          d={`M ${cx + Math.cos(a - 0.09) * r0} ${cy + Math.sin(a - 0.09) * r0} L ${cx + Math.cos(a) * r1} ${cy + Math.sin(a) * r1} L ${cx + Math.cos(a + 0.09) * r0} ${cy + Math.sin(a + 0.09) * r0} Z`}
          fill={color}
          opacity={0.2 * amount}
        />
      );
    })}
  </>
);

/** Pixel-Funken, die von einem Punkt auseinanderfliegen */
const Burst: React.FC<{ cx: number; cy: number; dt: number; colors: string[]; seed: string; n?: number }> = ({ cx, cy, dt, colors, seed, n = 30 }) => {
  if (dt < 0 || dt > 1.4) return null;
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const a = random(`${seed}a${i}`) * Math.PI * 2;
        const v = 260 + random(`${seed}v${i}`) * 480;
        const s = 8 + random(`${seed}s${i}`) * 12;
        return (
          <rect key={i} x={cx + Math.cos(a) * v * dt} y={cy + Math.sin(a) * v * dt + 280 * dt * dt} width={s} height={s} fill={colors[i % colors.length]} opacity={Math.max(0, 1 - dt / 1.4)} />
        );
      })}
    </>
  );
};

/** Kleine Pixel-Raute als Verzierung im Banner */
const Pip: React.FC = () => <span style={{ display: "inline-block", width: 10, height: 10, background: "currentColor", transform: "rotate(45deg)" }} />;

/** Segmentbalken wie eine Lebensleiste */
const SegBar: React.FC<{ x: number; y: number; w: number; h: number; fill: number; color: string; segs?: number }> = ({ x, y, w, h, fill, color, segs = 12 }) => {
  const gap = 6;
  const sw = (w - gap * (segs - 1)) / segs;
  const lit = fill * segs;
  return (
    <g>
      <rect x={x - 6} y={y - 6} width={w + 12} height={h + 12} fill="rgba(0,0,0,0.55)" stroke="rgba(255,255,255,0.25)" strokeWidth={3} />
      {Array.from({ length: segs }, (_, k) => {
        const on = Math.max(0, Math.min(1, lit - k));
        return <rect key={k} x={x + k * (sw + gap)} y={y} width={sw} height={h} fill={on > 0 ? color : "rgba(255,255,255,0.08)"} opacity={on > 0 ? 0.35 + 0.65 * on : 1} />;
      })}
    </g>
  );
};

/* ================================================================== */
/* Etappe 1: Bossfight, das Item fällt                                 */
/* ================================================================== */

const Drop: React.FC<{ ts: TimelineScene; s: ItemScene }> = ({ ts, s }) => {
  const frame = useCurrentFrame();
  const look = useLook();
  const t = (frame - ts.audioOffsetFrames) / FPS;
  const kopfAt = beat(ts, "Dein Kopf", 1.9);
  const leerAt = beat(ts, "leer", kopfAt + 0.8);
  const dropAt = beat(ts, s.dropAt, ts.speechEndSec - 1);
  const intro = spring({ frame, fps: FPS, config: { damping: 15, stiffness: 140 } });

  // Kopf-Balken: voll, dann leer
  const head = interpolate(t, [kopfAt + 0.1, leerAt + 0.25], [1, 0], { ...clamp, easing: Easing.in(Easing.quad) });
  const empty = t > leerAt + 0.25;
  const blink = Math.floor(frame / 8) % 2 === 0;

  // Der Boss wippt und stampft
  const bossPx = 18;
  const boss = artSize(BOSS, bossPx);
  const bob = Math.floor((frame / FPS) * 3) % 2 === 0 ? 0 : -bossPx * 0.6;
  const bossX = 540 - boss.w / 2;
  const bossY = 400;

  // Das Item fällt von oben, prallt auf und leuchtet
  // Es fällt schon bei «droppt» und liegt, wenn «Item» gesagt wird
  const fall = interpolate(t, [dropAt - 0.3, dropAt + 0.12], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  const landT = dropAt + 0.12;
  const bounce = t > landT ? Math.abs(Math.sin((t - landT) * 9)) * 60 * Math.exp(-(t - landT) * 4.5) : 0;
  const itemPx = 10;
  const item = artSize(SCROLL, itemPx);
  const itemCY = interpolate(fall, [0, 1], [-200, 900]) - bounce;
  const glow = interpolate(t, [landT, landT + 0.5], [0, 1], clamp);
  const shown = t > dropAt - 0.3;

  return (
    <AbsoluteFill style={{ opacity: intro }}>
      <Sfx frame={2} name="glitch" volume={0.22} />
      <Sfx frame={voiceFrame(ts, leerAt + 0.2)} name="glitch" volume={0.3} />
      <Sfx frame={voiceFrame(ts, dropAt - 0.3)} name="whoosh" volume={0.35} />
      <Sfx frame={voiceFrame(ts, landT)} name="coin" volume={0.4} />
      <Sfx frame={voiceFrame(ts, landT + 0.1)} name="levelup" volume={0.3} />

      {/* Boss-Leiste */}
      <div style={{ position: "absolute", left: 130, right: 130, top: 280, display: "flex", justifyContent: "space-between", fontFamily: PIXEL, fontSize: 24, color: look.accent2, textShadow: `0 0 12px ${look.accent2}` }}>
        <span>BOSS</span>
        <span style={{ color: "#FFFFFF" }}>MATHEPRÜFUNG</span>
      </div>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <SegBar x={136} y={326} w={808} h={30} fill={1} color={look.accent2} segs={16} />
        <ellipse cx={540} cy={bossY + boss.h + 26} rx={190} ry={26} fill={look.accent2} opacity={0.22} />
        <PixelArt rows={BOSS} pal={BOSS_PAL} x={bossX} y={bossY + bob} px={bossPx} build={interpolate(frame, [0, 22], [0, 1], clamp)} seed="boss" />
        {/* Mathe-Zeichen kreisen um den Boss */}
        {["x²", "√", "π", "÷", "∑", "%"].map((g, i) => {
          const a = (i / 6) * Math.PI * 2 + frame / 26;
          const cx = 540 + Math.cos(a) * 300;
          const cy = bossY + boss.h / 2 + Math.sin(a) * 120;
          return (
            <text key={i} x={cx} y={cy} textAnchor="middle" fontFamily="Inter" fontWeight={800} fontSize={44} fill={i % 2 ? look.accent : "#FFE66D"} opacity={0.55 + 0.35 * Math.sin(a)}>
              {g}
            </text>
          );
        })}

        {/* Das Item */}
        {shown ? (
          <>
            <Rays cx={540} cy={itemCY} color={GOLD} amount={glow} frame={frame} r0={90} r1={250} />
            <circle cx={540} cy={itemCY} r={110} fill={GOLD} opacity={0.18 * glow + 0.06 * Math.sin(frame / 4) * glow} />
            <PixelArt rows={SCROLL} pal={SCROLL_PAL} x={540 - item.w / 2} y={itemCY - item.h / 2} px={itemPx} />
            <Burst cx={540} cy={900} dt={t - landT} colors={[GOLD, look.accent, "#FFFFFF"]} seed="drop" />
          </>
        ) : null}
        {glow > 0 ? (
          <text x={540} y={itemCY - item.h / 2 - 40} textAnchor="middle" fontFamily={PIXEL} fontSize={30} fill={GOLD} opacity={glow * (blink ? 1 : 0.6)} style={{ filter: `drop-shadow(0 0 10px ${GOLD})` }}>
            ITEM!
          </text>
        ) : null}

        {/* Kopf-Leiste */}
        <SegBar x={330} y={1090} w={614} h={30} fill={head} color={look.accent} segs={10} />
      </svg>
      <div style={{ position: "absolute", left: 136, top: 1092, fontFamily: PIXEL, fontSize: 26, color: "#FFFFFF" }}>KOPF</div>
      {empty ? (
        <div style={{ position: "absolute", left: 330, width: 614, top: 1092, textAlign: "center", fontFamily: PIXEL, fontSize: 26, color: look.accent2, opacity: blink ? 1 : 0.35, textShadow: `0 0 10px ${look.accent2}` }}>
          LEER
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

/* ================================================================== */
/* Etappe 2: die Item-Karte                                            */
/* ================================================================== */

const Card: React.FC<{ ts: TimelineScene; s: ItemScene }> = ({ ts, s }) => {
  const frame = useCurrentFrame();
  const look = useLook();
  const t = (frame - ts.audioOffsetFrames) / FPS;
  const blessed = /segen/i.test(s.rarity ?? "");
  const cardIn = spring({ frame, fps: FPS, config: { damping: 16, stiffness: 140 } });

  const curseAt = s.curseAt ? beat(ts, s.curseAt, 1.5) : 9999;
  const curse = interpolate(t, [curseAt, curseAt + 0.45], [0, 1], clamp);
  const glitching = t >= curseAt && t < curseAt + 0.6;
  const jx = glitching ? (random(`gx${frame}`) - 0.5) * 34 : 0;
  const jy = glitching ? (random(`gy${frame}`) - 0.5) * 14 : 0;

  const rarityColor = blessed ? BLESS : GOLD;
  const c1 = curse > 0.5 ? CURSE : blessed ? BLESS : GOLD;
  const c2 = curse > 0.5 ? "#FF4FD8" : blessed ? look.accent : "#FFE7B0";
  const fill = curse > 0.5 ? "rgba(36,6,58,0.86)" : blessed ? "rgba(4,30,34,0.78)" : "rgba(10,4,30,0.76)";

  const X = 130;
  const W = 820;
  const Y = 270;
  const H = 900;
  const iconPx = s.icon === "heart" ? 13 : 12;
  const art = s.icon === "heart" ? HEART : SCROLL;
  const pal = s.icon === "heart" ? HEART_PAL : SCROLL_PAL;
  const size = artSize(art, iconPx);
  const iconCY = Y + 230;
  const float = Math.sin(frame / 10) * 8;

  const statY = (i: number) => Y + 560 + i * 82;
  const statAt = s.stats.map((st, i) => (st.at ? beat(ts, st.at, 1 + i) : -10));

  return (
    <AbsoluteFill style={{ opacity: cardIn, transform: `translate(${jx}px, ${jy}px) scale(${interpolate(cardIn, [0, 1], [0.92, 1])})` }}>
      {/* Farbverschiebung beim Auffliegen des Fluchs */}
      {glitching ? (
        <AbsoluteFill style={{ background: `rgba(155,92,255,${0.18 + 0.12 * Math.sin(frame * 3)})`, mixBlendMode: "screen" }} />
      ) : null}
      <Frame x={X} y={Y} w={W} h={H} c1={c1} c2={c2} fill={fill} />
      <Sfx frame={2} name="glitch" volume={0.2} />
      {s.curseAt ? (
        <>
          <Sfx frame={voiceFrame(ts, curseAt)} name="glitch" volume={0.5} />
          <Sfx frame={voiceFrame(ts, curseAt) + 7} name="glitch" volume={0.35} />
        </>
      ) : null}

      {/* Kopfzeile */}
      <div style={{ position: "absolute", left: X + 34, top: Y + 30, fontFamily: PIXEL, fontSize: 22, color: c1 }}>ITEM</div>
      <div style={{ position: "absolute", right: 1080 - X - W + 34, top: Y + 30, fontFamily: PIXEL, fontSize: 22, color: curse > 0.5 ? "#FF4FD8" : look.accent }}>
        {curse > 0.5 ? "LVL 0" : blessed ? "LVL MAX" : "LVL ?"}
      </div>

      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <Rays cx={540} cy={iconCY} color={curse > 0.5 ? CURSE : blessed ? BLESS : GOLD} amount={blessed ? 1.6 : 1} frame={frame} r0={100} r1={blessed ? 360 : 280} />
        <circle cx={540} cy={iconCY} r={150} fill={curse > 0.5 ? CURSE : rarityColor} opacity={0.14 + 0.04 * Math.sin(frame / 6)} />
        <PixelArt rows={art} pal={pal} x={540 - size.w / 2} y={iconCY - size.h / 2 + float} px={iconPx} tint={CURSE_DEEP} tintAmt={curse * 0.55} build={interpolate(frame, [0, 20], [0, 1], clamp)} seed={s.icon} />
        {curse > 0 ? (
          <g opacity={curse} transform={`translate(${540 + size.w / 2 - 30} ${iconCY - size.h / 2 - 50 + float}) scale(${interpolate(curse, [0, 1], [2, 1])})`}>
            <PixelArt rows={SKULL} pal={SKULL_PAL} x={0} y={0} px={9} />
          </g>
        ) : null}
        {/* Segen: Herzchen steigen auf */}
        {blessed
          ? Array.from({ length: 10 }, (_, i) => {
              const life = ((frame / FPS) * 0.6 + random(`hp${i}`)) % 1;
              const x = 540 + (random(`hx${i}`) - 0.5) * 520;
              const y = iconCY + 140 - life * 300;
              return <rect key={i} x={x} y={y} width={10} height={10} fill={i % 2 ? BLESS : "#FFFFFF"} opacity={Math.sin(life * Math.PI) * 0.8} />;
            })
          : null}
      </svg>

      {/* Name und Seltenheit */}
      <div style={{ position: "absolute", top: Y + 410, width: "100%", textAlign: "center", fontFamily: PIXEL, fontSize: 44, color: "#FFFFFF", textShadow: `0 0 16px ${c1}` }}>
        {s.name.toUpperCase()}
      </div>
      {s.rarity ? (
        <div style={{ position: "absolute", top: Y + 478, width: "100%", display: "flex", justifyContent: "center" }}>
          <div
            style={{
              fontFamily: PIXEL,
              fontSize: 22,
              padding: "12px 22px",
              color: curse > 0.5 ? "#FFFFFF" : "#1B1030",
              background: curse > 0.5 ? CURSE : rarityColor,
              boxShadow: `0 0 18px ${curse > 0.5 ? CURSE : rarityColor}`,
              letterSpacing: 2,
              display: "flex",
              alignItems: "center",
              gap: 16,
            }}
          >
            <Pip />
            {curse > 0.5 ? "VERFLUCHT" : s.rarity.toUpperCase()}
            <Pip />
          </div>
        </div>
      ) : null}

      {/* Werte */}
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        {s.stats.map((st, i) => {
          const at = statAt[i];
          const pop = st.at ? spring({ frame: frame - voiceFrame(ts, at), fps: FPS, config: { damping: 11, stiffness: 190, mass: 0.6 } }) : 1;
          if (pop <= 0.001) return null;
          const plus = st.tone === "plus";
          const color = plus ? (blessed ? BLESS : look.accent) : "#FF4F86";
          const y = statY(i);
          const value = st.value ? 1 : plus ? interpolate(t, [at, at + 0.7], [0.15, 1], { ...clamp, easing: Easing.out(Easing.cubic) }) : interpolate(t, [at, at + 0.9], [1, 0.12], { ...clamp, easing: Easing.out(Easing.cubic) });
          const ax = 860;
          const ay = y + 6;
          const arrowBob = Math.sin(frame / 5) * 4 * (plus ? -1 : 1);
          return (
            <g key={i} opacity={pop} transform={`translate(${(1 - pop) * 60} 0)`}>
              <text x={X + 46} y={y + 18} fontFamily={PIXEL} fontSize={24} fill="#FFFFFF">
                {st.label.toUpperCase()}
              </text>
              {st.value ? (
                <text x={ax - 40} y={y + 20} textAnchor="end" fontFamily={PIXEL} fontSize={34} fill={color} style={{ filter: `drop-shadow(0 0 8px ${color})` }}>
                  {st.value}
                </text>
              ) : (
                <SegBar x={520} y={y - 8} w={250} h={26} fill={value} color={color} segs={8} />
              )}
              <path
                d={plus ? `M ${ax} ${ay - 22 + arrowBob} L ${ax + 24} ${ay + 10 + arrowBob} L ${ax - 24} ${ay + 10 + arrowBob} Z` : `M ${ax} ${ay + 16 + arrowBob} L ${ax + 24} ${ay - 16 + arrowBob} L ${ax - 24} ${ay - 16 + arrowBob} Z`}
                fill={color}
                style={{ filter: `drop-shadow(0 0 8px ${color})` }}
              />
              {st.at ? <Sfx frame={voiceFrame(ts, at)} name={plus ? "coin" : "glitch"} volume={plus ? 0.32 : 0.28} /> : null}
            </g>
          );
        })}
      </svg>

      {/* Noch unbekannte Effekte – das Item ist noch nicht ganz durchschaut */}
      {!s.curseAt && !blessed
        ? Array.from({ length: Math.max(0, 4 - s.stats.length) }, (_, k) => {
            const i = s.stats.length + k;
            const show = interpolate(frame, [20 + k * 6, 30 + k * 6], [0, 1], clamp);
            return (
              <div key={k} style={{ position: "absolute", left: X + 46, right: 1080 - X - W + 60, top: statY(i) - 8, display: "flex", justifyContent: "space-between", fontFamily: PIXEL, fontSize: 24, color: look.dim, opacity: show * (0.35 + 0.25 * Math.sin(frame / 6 + k)) }}>
                <span>???</span>
                <span>???</span>
              </div>
            );
          })
        : null}

      {/* Verflucht: Banner quer über die Karte */}
      {curse > 0 ? (
        <div
          style={{
            position: "absolute",
            left: X - 30,
            right: 1080 - X - W - 30,
            top: Y + 140,
            textAlign: "center",
            fontFamily: PIXEL,
            fontSize: 54,
            color: "#FFFFFF",
            padding: "20px 0",
            background: `linear-gradient(90deg, rgba(75,20,120,0), ${CURSE} 18%, ${CURSE} 82%, rgba(75,20,120,0))`,
            textShadow: `4px 0 0 #FF4FD8, -4px 0 0 #5CF3FF`,
            transform: `rotate(-8deg) scale(${interpolate(curse, [0, 1], [1.8, 1])})`,
            opacity: curse * interpolate(t, [curseAt + 1.6, curseAt + 2.2], [1, 0.0], clamp),
          }}
        >
          VERFLUCHT!
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

/* ================================================================== */
/* Etappe 3: Aufheben oder liegen lassen?                              */
/* ================================================================== */

const Choice: React.FC<{ ts: TimelineScene; s: ItemScene }> = ({ ts, s }) => {
  const frame = useCurrentFrame();
  const look = useLook();
  const t = (frame - ts.audioOffsetFrames) / FPS;
  const [a, b] = s.choices ?? ["Aufheben", "Liegen lassen"];
  const secondAt = beat(ts, "Oder", 2);
  const askAt = beat(ts, "Was würdest du tun", ts.speechEndSec - 1);
  const intro = spring({ frame, fps: FPS, config: { damping: 15, stiffness: 140 } });
  // Der Pfeil zeigt zuerst auf «Aufheben», dann auf «Liegen lassen» – und kann sich danach nicht entscheiden
  const side = t < secondAt ? 0 : t < askAt ? 1 : Math.floor((t - askAt) / 0.38) % 2 === 0 ? 0 : 1;
  const blink = Math.floor(frame / 7) % 2 === 0;
  const itemPx = 11;
  const item = artSize(SCROLL, itemPx);
  const float = Math.sin(frame / 9) * 14;
  const tilt = Math.sin(frame / 13) * 6;
  const cy = 560;
  const ask = spring({ frame: frame - voiceFrame(ts, askAt), fps: FPS, config: { damping: 12, stiffness: 160 } });
  // Ab und zu flackert das Item violett – irgendetwas stimmt damit nicht
  const flicker = frame % 54 >= 50;
  const switches = [secondAt, ...Array.from({ length: 8 }, (_, k) => askAt + k * 0.38)].filter((x) => x < ts.voiceEndSec + 2);

  const button = (label: string, i: number) => {
    const on = side === i;
    const color = i === 0 ? look.accent2 : look.accent;
    return (
      <div
        key={i}
        style={{
          position: "relative",
          width: 380,
          padding: "30px 0",
          textAlign: "center",
          fontFamily: PIXEL,
          fontSize: label.length > 10 ? 24 : 28,
          color: on ? "#0A0316" : "#FFFFFF",
          background: on ? color : "rgba(10,4,30,0.75)",
          border: `5px solid ${color}`,
          boxShadow: on ? `0 0 26px ${color}` : "none",
          transform: `scale(${on ? 1.05 : 1})`,
        }}
      >
        {label.toUpperCase()}
        {on ? (
          <span style={{ position: "absolute", left: -50, top: 26, fontFamily: PIXEL, fontSize: 34, color: "#FFFFFF", opacity: blink ? 1 : 0.2 }}>▶</span>
        ) : null}
      </div>
    );
  };

  return (
    <AbsoluteFill style={{ opacity: intro }}>
      {switches.map((x, k) => (
        <Sfx key={k} frame={voiceFrame(ts, x)} name="blip" volume={0.25} />
      ))}
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <Rays cx={540} cy={cy + float} color={GOLD} amount={0.8} frame={frame} r0={100} r1={290} />
        <circle cx={540} cy={cy + float} r={140} fill={GOLD} opacity={0.12} />
        <g transform={`rotate(${tilt} 540 ${cy + float}) translate(${flicker ? 10 : 0} 0)`}>
          <PixelArt rows={SCROLL} pal={SCROLL_PAL} x={540 - item.w / 2} y={cy - item.h / 2 + float} px={itemPx} tint={CURSE} tintAmt={flicker ? 0.6 : 0} />
        </g>
        {flicker ? <PixelArt rows={SKULL} pal={SKULL_PAL} x={540 + item.w / 2 - 10} y={cy - item.h / 2 - 60 + float} px={7} /> : null}
        <ellipse cx={540} cy={cy + 210} rx={150 - float * 2} ry={20} fill={look.accent} opacity={0.18} />
      </svg>
      <div style={{ position: "absolute", top: 320, width: "100%", textAlign: "center", fontFamily: PIXEL, fontSize: 30, color: GOLD, textShadow: `0 0 12px ${GOLD}` }}>
        {s.name.toUpperCase()}
      </div>
      {/* Dialogfenster mit zwei Möglichkeiten */}
      <div style={{ position: "absolute", left: 70, right: 70, top: 860, padding: "34px 0 40px", background: "rgba(10,4,30,0.82)", border: `5px solid ${look.accent}`, boxShadow: `0 0 22px rgba(92,243,255,0.45)` }}>
        <div style={{ textAlign: "center", fontFamily: PIXEL, fontSize: 26, color: "#FFFFFF", marginBottom: 30, opacity: ask > 0.01 ? (blink ? 1 : 0.55) : 1 }}>
          {ask > 0.01 ? "DEINE WAHL?" : "ITEM GEFUNDEN"}
        </div>
        <div style={{ display: "flex", justifyContent: "space-evenly" }}>
          {button(a, 0)}
          {button(b, 1)}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const ItemScene: React.FC<{ ts: TimelineScene }> = ({ ts }) => {
  const s = ts.scene as ItemScene;
  if (s.stage === "drop") return <Drop ts={ts} s={s} />;
  if (s.stage === "choice") return <Choice ts={ts} s={s} />;
  return <Card ts={ts} s={s} />;
};
