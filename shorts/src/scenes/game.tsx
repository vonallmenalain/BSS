import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, random, spring, useCurrentFrame } from "remotion";
import { useLook } from "../looks";
import { Sfx, beat, voiceFrame } from "../lib/sfx";
import { FPS, type TimelineScene } from "../lib/timing";
import type { Scene } from "../schema";

/*
 * Game-Look: eine Charakterkarte wie in einem Videospiel. Die Pixel-Figur baut sich beim
 * Szenenstart auf, Chips und Werte erscheinen genau dann, wenn die Stimme sie nennt,
 * und am Schluss wird eine Fähigkeit freigeschaltet.
 */

type HeroScene = Extract<Scene, { type: "hero" }>;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
/* Ohne Anführungszeichen wäre der Name in CSS ungültig (Ziffer am Wortanfang) */
const PIXEL = '"Press Start 2P"';

/* Pixel-Figur: ein junger Krieger mit Helm, Schild und Speer (18 × 22 Pixel). */
const SPRITE = [
  "..............K...",
  ".............KKK..",
  "..............P...",
  ".....hHHHHh...P...",
  "....hHHHHHHh..P...",
  "....HHHHHHHH..P...",
  "....hSSSSSSh..P...",
  "....SSESSESS..P...",
  "....SSSSSSSS..P...",
  ".....SSmmSS...P...",
  "...TTTTTTTTTT.P...",
  "..dTTTTTTTTTTSSP..",
  ".dDDdTTTTTTTT.P...",
  "dDDGDdTTTTTTT.P...",
  "dDGGGdBBBBBBB.P...",
  "dDDGDdTTTTTTT.P...",
  ".dDDdTTTTTTTT.P...",
  "..dd.tTTttTTt.P...",
  ".....LL...LL..P...",
  ".....LL...LL..P...",
  ".....LL...LL..P...",
  "....FFF...FFF.P...",
];
const PALETTE: Record<string, string> = {
  K: "#E9EEF6",
  P: "#9A7448",
  H: "#F6C86A",
  h: "#C38A2E",
  S: "#E9B48C",
  E: "#1A1030",
  m: "#B9765A",
  T: "#D2453B",
  t: "#8E2B2A",
  B: "#3A2A22",
  L: "#7A5A40",
  F: "#2E211B",
  D: "#2E6CC7",
  d: "#F6C86A",
  G: "#F6C86A",
};

const Sprite: React.FC<{ x: number; y: number; px: number; t: number; gold: number }> = ({ x, y, px, t, gold }) => {
  const frame = useCurrentFrame();
  const cells = useMemo(
    () =>
      SPRITE.flatMap((row, r) =>
        row.split("").flatMap((ch, c) => (ch === "." ? [] : [{ r, c, ch, d: random(`px${r}-${c}`) * 0.55 }])),
      ),
    [],
  );
  // Leben: Wippen in Pixelschritten, ab und zu blinzeln
  const bob = Math.floor((frame / FPS) * 2.5) % 2 === 0 ? 0 : -px * 0.5;
  const blink = (frame % 96) < 4;
  return (
    <g transform={`translate(${x} ${y + bob})`}>
      {gold > 0 ? (
        <ellipse cx={(18 * px) / 2} cy={(22 * px) / 2} rx={18 * px * 0.75} ry={22 * px * 0.62} fill="#F6C86A" opacity={0.18 * gold} />
      ) : null}
      {cells.map(({ r, c, ch, d }) => {
        const p = interpolate(t, [d, d + 0.18], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
        if (p <= 0) return null;
        const color = blink && ch === "E" ? PALETTE.S : PALETTE[ch];
        return <rect key={`${r}-${c}`} x={c * px} y={r * px - (1 - p) * 60} width={px + 0.5} height={px + 0.5} fill={color} opacity={p} />;
      })}
    </g>
  );
};

/** Rahmen mit Neonkante und Eckwinkeln */
const CardFrame: React.FC<{ x: number; y: number; w: number; h: number; gold: number }> = ({ x, y, w, h, gold }) => {
  const look = useLook();
  const c1 = gold > 0.5 ? "#F6C86A" : look.accent2;
  const c2 = gold > 0.5 ? "#FFE7B0" : look.accent;
  const corner = 46;
  return (
    <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
      <defs>
        <linearGradient id="cardEdge" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={c1} />
          <stop offset="100%" stopColor={c2} />
        </linearGradient>
      </defs>
      <rect x={x} y={y} width={w} height={h} rx={26} fill="rgba(10,4,30,0.72)" stroke="url(#cardEdge)" strokeWidth={5} style={{ filter: `drop-shadow(0 0 14px ${c1})` }} />
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

export const HeroScene: React.FC<{ ts: TimelineScene }> = ({ ts }) => {
  const s = ts.scene as HeroScene;
  const frame = useCurrentFrame();
  const look = useLook();
  const t = (frame - ts.audioOffsetFrames) / FPS;
  const tScene = frame / FPS;

  const unlockAt = s.unlock ? beat(ts, s.unlock.at, ts.speechEndSec * 0.6) : 0;
  const unlock = s.unlock ? spring({ frame: frame - voiceFrame(ts, unlockAt), fps: FPS, config: { damping: 12, stiffness: 120 } }) : 0;
  const gold = s.unlock ? unlock : 0;
  const cardIn = spring({ frame, fps: FPS, config: { damping: 16, stiffness: 140 } });

  const px = 15;
  const spriteW = 18 * px;
  // Kartenhöhe nach Inhalt, mittig auf der Bühne (250–1180)
  const chipRows = Math.ceil(s.chips.length / 2);
  const lower = s.stats.length ? 60 + s.stats.length * 84 : s.chips.length ? 50 + chipRows * 96 : 0;
  const X = 130;
  const W = 820;
  const H = Math.max(560 + lower, s.unlock ? 900 : 0, 620);
  const Y = 260 + Math.max(0, (920 - H) / 2);
  const spriteY = Y + 60;
  // Sprung beim Freischalten
  const jump = s.unlock ? -Math.sin(Math.PI * interpolate(frame - voiceFrame(ts, unlockAt), [0, 14], [0, 1], clamp)) * 50 : 0;

  return (
    <AbsoluteFill style={{ transform: `scale(${interpolate(cardIn, [0, 1], [0.92, 1])})`, opacity: cardIn }}>
      <CardFrame x={X} y={Y} w={W} h={H} gold={gold} />
      <Sfx frame={2} name="glitch" volume={0.25} />
      {/* Kopfzeile der Karte */}
      <div style={{ position: "absolute", left: X + 34, top: Y + 30, fontFamily: PIXEL, fontSize: 22, color: look.accent, letterSpacing: 2 }}>
        SPIELER 1
      </div>
      <div style={{ position: "absolute", right: 1080 - X - W + 34, top: Y + 30, fontFamily: PIXEL, fontSize: 22, color: gold > 0.5 ? "#F6C86A" : look.accent2 }}>
        {gold > 0.5 ? "LVL ★" : "LVL 1"}
      </div>

      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <ellipse cx={540} cy={spriteY + 22 * px + 18} rx={170} ry={26} fill={look.accent} opacity={0.22} />
        <Sprite x={540 - spriteW / 2} y={spriteY + 30 + jump} px={px} t={tScene} gold={gold} />
        {s.select
          ? [-1, 1].map((dir) => {
              const pulse = 0.5 + 0.5 * Math.sin(frame / 6);
              const cx = 540 + dir * 300 + dir * pulse * 10;
              const cy = spriteY + 200;
              return (
                <path key={dir} d={`M ${cx} ${cy - 34} L ${cx + dir * 40} ${cy} L ${cx} ${cy + 34} Z`} fill={look.accent} opacity={0.6 + 0.4 * pulse} />
              );
            })
          : null}
        {/* Strahlen hinter der Figur, wenn freigeschaltet */}
        {gold > 0.01
          ? Array.from({ length: 12 }, (_, i) => {
              const a = (i / 12) * Math.PI * 2 + frame / 40;
              const r0 = 120;
              const r1 = 330;
              const cx = 540;
              const cy = spriteY + 190;
              return (
                <path
                  key={i}
                  d={`M ${cx + Math.cos(a - 0.08) * r0} ${cy + Math.sin(a - 0.08) * r0} L ${cx + Math.cos(a) * r1} ${cy + Math.sin(a) * r1} L ${cx + Math.cos(a + 0.08) * r0} ${cy + Math.sin(a + 0.08) * r0} Z`}
                  fill="#F6C86A"
                  opacity={0.18 * gold}
                />
              );
            })
          : null}
      </svg>

      {/* Name */}
      <div
        style={{
          position: "absolute",
          top: spriteY + 22 * px + 60,
          width: "100%",
          textAlign: "center",
          fontFamily: PIXEL,
          fontSize: 38,
          color: "#FFFFFF",
          textShadow: `0 0 14px ${look.accent2}`,
        }}
      >
        {s.title}
      </div>
      {s.subtitle ? (
        <div style={{ position: "absolute", top: spriteY + 22 * px + 118, width: "100%", textAlign: "center", fontFamily: PIXEL, fontSize: 21, color: look.accent }}>
          {s.subtitle}
        </div>
      ) : null}

      {/* Chips: Werte, die aufpoppen */}
      {s.chips.length ? (
        <div style={{ position: "absolute", top: spriteY + 22 * px + 180, left: X + 40, right: 1080 - X - W + 40, display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 18 }}>
          {s.chips.map((c, i) => {
            const at = c.at ? beat(ts, c.at, 0.3 + i * 0.8) : -1;
            const sp = c.at ? spring({ frame: frame - voiceFrame(ts, at), fps: FPS, config: { damping: 10, stiffness: 200, mass: 0.6 } }) : 1;
            const col = c.tone === "zero" ? look.accent2 : look.accent;
            return (
              <React.Fragment key={i}>
                {c.at ? <Sfx frame={voiceFrame(ts, at)} name={c.tone === "zero" ? "glitch" : "coin"} volume={0.3} /> : null}
                <div
                  style={{
                    fontFamily: PIXEL,
                    fontSize: 25,
                    color: "#FFFFFF",
                    padding: "16px 20px",
                    border: `4px solid ${col}`,
                    background: c.tone === "zero" ? "rgba(255,79,216,0.16)" : "rgba(92,243,255,0.14)",
                    boxShadow: `0 0 16px ${col}`,
                    opacity: sp,
                    transform: `scale(${interpolate(sp, [0, 1], [0.4, 1])}) rotate(${(1 - sp) * (i % 2 ? 8 : -8)}deg)`,
                  }}
                >
                  {c.tone === "plus" ? "+ " : ""}
                  {c.text}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      ) : null}

      {/* Wertebalken */}
      {s.stats.length ? (
        <div style={{ position: "absolute", top: spriteY + 22 * px + 175, left: X + 44, right: 1080 - X - W + 44, opacity: interpolate(gold, [0, 1], [1, 0.35]) }}>
          {s.stats.map((st, i) => {
            const at = st.at ? beat(ts, st.at, 0.4 + i) : -10;
            const fill = interpolate(t, [at, at + 0.7], [0, st.value / 100], { ...clamp, easing: Easing.out(Easing.cubic) });
            const segs = 10;
            const lit = Math.round(fill * segs * 10) / 10;
            const pop = st.at ? spring({ frame: frame - voiceFrame(ts, at), fps: FPS, config: { damping: 12, stiffness: 180 } }) : 1;
            const plusY = interpolate(t, [at + 0.3, at + 1.3], [0, -70], clamp);
            const plusO = interpolate(t, [at + 0.3, at + 0.5, at + 1.1, at + 1.3], [0, 1, 1, 0], clamp);
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", height: 84, gap: 22, position: "relative" }}>
                {st.at ? <Sfx frame={voiceFrame(ts, at)} name="blip" volume={0.3} /> : null}
                {st.at ? <Sfx frame={voiceFrame(ts, at + 0.7)} name="coin" volume={0.28} /> : null}
                <div style={{ width: 300, fontFamily: PIXEL, fontSize: 25, color: fill > 0 ? "#FFFFFF" : look.dim, transform: `scale(${interpolate(pop, [0, 1], [1, 1])})` }}>
                  {st.label}
                </div>
                <div style={{ flex: 1, display: "flex", gap: 6 }}>
                  {Array.from({ length: segs }, (_, k) => {
                    const on = Math.max(0, Math.min(1, lit - k));
                    return (
                      <div
                        key={k}
                        style={{
                          flex: 1,
                          height: 34,
                          background: on > 0 ? (k >= 8 ? look.accent2 : look.accent) : "rgba(255,255,255,0.1)",
                          opacity: on > 0 ? 0.35 + 0.65 * on : 1,
                          boxShadow: on > 0.9 ? `0 0 10px ${k >= 8 ? look.accent2 : look.accent}` : "none",
                        }}
                      />
                    );
                  })}
                </div>
                <div style={{ position: "absolute", right: 0, top: -10 + plusY, fontFamily: PIXEL, fontSize: 24, color: look.accent, opacity: plusO }}>
                  {st.value === 100 ? "MAX" : `+${st.value}`}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Freigeschaltete Fähigkeit */}
      {s.unlock && unlock > 0.001 ? (
        <>
          <Sfx frame={voiceFrame(ts, unlockAt)} name="levelup" volume={0.4} />
          <Sfx frame={voiceFrame(ts, unlockAt) + 4} name="unlock" volume={0.35} />
          <div
            style={{
              position: "absolute",
              left: X + 40,
              right: 1080 - X - W + 40,
              top: Y + H - 330,
              padding: "26px 30px 34px",
              border: "5px solid #F6C86A",
              background: "linear-gradient(180deg, rgba(60,30,4,0.92), rgba(30,12,2,0.92))",
              boxShadow: "0 0 40px rgba(246,200,106,0.7)",
              textAlign: "center",
              transform: `scale(${interpolate(unlock, [0, 1], [0.3, 1])})`,
              opacity: Math.min(1, unlock * 1.4),
            }}
          >
            <div style={{ fontFamily: PIXEL, fontSize: 24, color: "#FFE7B0", letterSpacing: 3 }}>★ {s.unlock.badge} ★</div>
            <div
              style={{
                marginTop: 18,
                fontFamily: look.display,
                fontSize: 86,
                lineHeight: 1,
                textTransform: "uppercase",
                background: "linear-gradient(180deg, #FFF3C4 0%, #F6C86A 55%, #E39B3A 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
                filter: "drop-shadow(0 4px 18px rgba(246,200,106,0.5))",
              }}
            >
              {s.unlock.text}
            </div>
          </div>
          <Sparkles at={unlockAt} t={t} />
        </>
      ) : null}
    </AbsoluteFill>
  );
};

/** Pixel-Funken, die beim Freischalten auseinanderfliegen */
const Sparkles: React.FC<{ at: number; t: number }> = ({ at, t }) => {
  const parts = useMemo(
    () =>
      Array.from({ length: 34 }, (_, i) => ({
        a: random(`sa${i}`) * Math.PI * 2,
        v: 300 + random(`sv${i}`) * 520,
        c: ["#F6C86A", "#5CF3FF", "#FF4FD8", "#FFFFFF"][i % 4],
        s: 10 + random(`ss${i}`) * 12,
      })),
    [],
  );
  const dt = t - at;
  if (dt < 0 || dt > 1.6) return null;
  return (
    <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
      {parts.map((p, i) => {
        const x = 540 + Math.cos(p.a) * p.v * dt;
        const y = 980 + Math.sin(p.a) * p.v * dt + 300 * dt * dt;
        return <rect key={i} x={x} y={y} width={p.s} height={p.s} fill={p.c} opacity={Math.max(0, 1 - dt / 1.6)} />;
      })}
    </svg>
  );
};
