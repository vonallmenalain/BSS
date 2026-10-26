import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, random, spring, useCurrentFrame } from "remotion";
import { useLook } from "../../looks";
import { Sfx, beat, beats, voiceFrame } from "../../lib/sfx";
import { FPS, type TimelineScene } from "../../lib/timing";
import type { Scene as SceneDef } from "../../schema";
import { theme } from "../../theme";

/*
 * Kochshow: Snack oder Festmahl? Links ein Tütchen mit einem einzelnen Vers, rechts eine
 * gedeckte Tafel. Ein Vers zwischen zwei Videos ist ein Snack – das Satt-o-Meter bleibt
 * fast leer. Nephi sagt nicht «Lest», sondern «Weidet euch» (2 Nephi 31:20): Die Tafel füllt
 * sich, das Meter auch. Danach die Menükarte mit den Rezepten von Jugendlichen aus dem Heft,
 * Gang für Gang in Handschrift. Was die Worte von Christus versprechen, sagt die Folge nicht.
 */

type MenuSceneT = Extract<SceneDef, { type: "menu" }>;
type P = { ts: TimelineScene; s: MenuSceneT; t: number; frame: number };
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const BODY = theme.font.body;
const HAND = "Caveat";
const INK = "#3B2A1C";
const PAPER = "#FBF3E4";
const RED = "#E4574E";
const GREEN = "#55C27A";

const useT = (ts: TimelineScene) => (useCurrentFrame() - ts.audioOffsetFrames) / FPS;
const popAt = (frame: number, ts: TimelineScene, at: number, stiffness = 180, damping = 12) =>
  spring({ frame: frame - voiceFrame(ts, at), fps: FPS, config: { damping, stiffness } });

/* ------------------------------------------------------------------ */
/* Bausteine                                                           */
/* ------------------------------------------------------------------ */

/** Ein Chips-Tütchen – (x, y) = Mitte */
const SnackBag: React.FC<{ x: number; y: number; s: number; label?: string }> = ({ x, y, s, label = "1 VERS" }) => {
  const zig = Array.from({ length: 11 }, (_, i) => `${-130 + i * 26} ${i % 2 ? -196 : -210}`).join(" L ");
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx={0} cy={214} rx={150} ry={20} fill="#000" opacity={0.35} />
      <path d={`M -130 -200 L ${zig} L 130 -200 C 150 -60 150 80 130 200 L -130 200 C -150 80 -150 -60 -130 -200 Z`} fill="#E94F6A" />
      <path d="M -112 -170 C -126 -40 -126 80 -110 180" stroke="#FFFFFF" strokeWidth={10} opacity={0.2} fill="none" strokeLinecap="round" />
      <rect x={-112} y={-70} width={224} height={110} rx={18} fill="#FFE07A" />
      <text x={0} y={6} textAnchor="middle" fontFamily={theme.font.display} fontSize={64} fill="#7A2135">
        SNACK
      </text>
      <text x={0} y={30} textAnchor="middle" fontFamily={BODY} fontWeight={800} fontSize={22} letterSpacing={3} fill="#7A2135">
        {label}
      </text>
      <path d="M -40 92 Q 0 70 40 92 Q 20 120 -10 118 Q -40 112 -40 92 Z" fill="#F7C25A" stroke="#C98A2E" strokeWidth={3} />
    </g>
  );
};

/** Ein Teller mit Glocke, die sich hebt (`lift` 0 … 1) und das Festessen zeigt */
const Cloche: React.FC<{ x: number; y: number; s: number; lift: number; frame: number }> = ({ x, y, s, lift, frame }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <ellipse cx={0} cy={150} rx={210} ry={30} fill="#000" opacity={0.35} />
    <ellipse cx={0} cy={130} rx={200} ry={40} fill="#E8E6E1" />
    <ellipse cx={0} cy={124} rx={160} ry={28} fill="#FFFFFF" />
    {/* Das Festessen */}
    <g opacity={lift}>
      <ellipse cx={0} cy={86} rx={120} ry={56} fill="#B5652E" />
      <ellipse cx={-20} cy={70} rx={70} ry={30} fill="#D9893F" />
      <circle cx={-110} cy={110} r={22} fill="#5DBB63" />
      <circle cx={110} cy={108} r={20} fill="#E84B3C" />
      <circle cx={90} cy={124} r={16} fill="#F2C14E" />
      {[0, 1, 2].map((i) => {
        const k = ((frame / 40 + i / 3) % 1 + 1) % 1;
        return <path key={i} d={`M ${-40 + i * 40} ${40 - k * 120} q 14 -20 0 -40 q -14 -20 0 -40`} stroke="#FFFFFF" strokeWidth={8} fill="none" strokeLinecap="round" opacity={0.5 * Math.sin(Math.PI * k) * lift} />;
      })}
    </g>
    {/* Glocke */}
    <g transform={`translate(${lift * 120} ${-lift * 230}) rotate(${lift * 28})`}>
      <path d="M -170 120 C -170 -40 -90 -110 0 -110 C 90 -110 170 -40 170 120 Z" fill="#D7DBE2" />
      <path d="M -130 90 C -128 -10 -80 -70 -20 -84" stroke="#FFFFFF" strokeWidth={14} fill="none" opacity={0.55} strokeLinecap="round" />
      <circle cx={0} cy={-122} r={20} fill="#B9BEC7" />
      <rect x={-176} y={112} width={352} height={14} rx={7} fill="#B9BEC7" />
    </g>
  </g>
);

/** Satt-o-Meter: ein Balken mit Etikett */
const Meter: React.FC<{ y: number; value: number; on: number; full: boolean; frame: number }> = ({ y, value, on, full, frame }) => {
  const look = useLook();
  const color = value > 0.66 ? GREEN : value > 0.33 ? look.accent : RED;
  const shake = !full && value < 0.2 ? Math.sin(frame / 2) * 2 : 0;
  return (
    <div style={{ position: "absolute", left: 140, right: 140, top: y, opacity: on, transform: `translate(${shake}px, ${interpolate(on, [0, 1], [30, 0])}px)` }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: BODY, fontWeight: 800, fontSize: 30, letterSpacing: "0.2em", color: "rgba(255,248,238,0.75)" }}>
        <span>SATT-O-METER</span>
        <span style={{ color }}>{full ? "SATT!" : `${Math.round(value * 100)} %`}</span>
      </div>
      <div style={{ marginTop: 14, height: 54, borderRadius: 27, background: "rgba(0,0,0,0.45)", border: "3px solid rgba(255,248,238,0.25)", overflow: "hidden" }}>
        <div style={{ width: `${Math.max(3, value * 100)}%`, height: "100%", borderRadius: 27, background: `linear-gradient(90deg, ${color}, ${full ? "#A7F3C0" : color})`, boxShadow: `0 0 24px ${color}` }} />
      </div>
    </div>
  );
};

/** Ein kleines Bild je Gang */
const CourseIcon: React.FC<{ label: string; size: number }> = ({ label, size }) => {
  const k = label.toLowerCase();
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <circle cx={50} cy={50} r={46} fill="#FFFFFF" stroke="#E2D6C2" strokeWidth={4} />
      {k.startsWith("vor") ? (
        <>
          <path d="M 20 52 Q 50 86 80 52 Z" fill="#E9A03B" />
          <ellipse cx={50} cy={52} rx={30} ry={7} fill="#F6C36A" />
          <path d="M 40 40 q 6 -8 0 -16 M 54 40 q 6 -8 0 -16" stroke="#C9B8A0" strokeWidth={4} fill="none" strokeLinecap="round" />
        </>
      ) : k.startsWith("haupt") ? (
        <>
          <circle cx={50} cy={52} r={24} fill="#F1ECE4" stroke="#D8CDBD" strokeWidth={3} />
          <ellipse cx={46} cy={52} rx={13} ry={9} fill="#B5652E" />
          <circle cx={60} cy={46} r={6} fill="#5DBB63" />
          <rect x={18} y={30} width={5} height={42} rx={2} fill="#9AA1AB" />
          <rect x={78} y={30} width={5} height={42} rx={2} fill="#9AA1AB" />
        </>
      ) : k.startsWith("dess") ? (
        <>
          <path d="M 34 52 L 66 52 L 58 80 L 42 80 Z" fill="#F2A65A" />
          <circle cx={50} cy={44} r={16} fill="#FF8FB1" />
          <circle cx={50} cy={28} r={6} fill="#E4574E" />
        </>
      ) : (
        <>
          <path d="M 50 18 L 57 42 L 82 42 L 62 57 L 69 82 L 50 67 L 31 82 L 38 57 L 18 42 L 43 42 Z" fill="#FFD36B" stroke="#E0A93A" strokeWidth={3} />
        </>
      )}
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/* Etappen                                                             */
/* ------------------------------------------------------------------ */

/** Snack gegen Festmahl */
const Versus: React.FC<P> = ({ ts, s, t, frame }) => {
  const look = useLook();
  const [snack, feast] = beats(ts, s.cues, 2);
  const left = popAt(frame, ts, snack - 0.15, 200, 11);
  const right = popAt(frame, ts, feast - 0.1, 170, 12);
  const lift = interpolate(t, [feast + 0.1, feast + 0.7], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const vs = spring({ frame: frame - 2, fps: FPS, config: { damping: 8, stiffness: 200 } });
  const pulse = 1 + 0.05 * Math.sin(frame / 4);
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <g opacity={Math.min(1, left * 1.5)}>
          <SnackBag x={270} y={720} s={interpolate(left, [0, 1], [0.5, 0.95])} />
        </g>
        <g opacity={Math.min(1, right * 1.5)}>
          <Cloche x={800} y={700} s={interpolate(right, [0, 1], [0.5, 1.05])} lift={lift} frame={frame} />
        </g>
      </svg>
      <div style={{ position: "absolute", top: 1010, left: 70, width: 400, textAlign: "center", fontFamily: theme.font.display, fontSize: 96, color: "#FFFFFF", opacity: left, textTransform: "uppercase" }}>Snack</div>
      <div style={{ position: "absolute", top: 1010, right: 40, width: 440, textAlign: "center", fontFamily: theme.font.display, fontSize: 96, color: look.accent, opacity: right, textTransform: "uppercase", textShadow: `0 0 30px rgba(255,181,71,0.4)` }}>Festmahl</div>
      <div style={{ position: "absolute", top: 620, width: "100%", textAlign: "center", fontFamily: theme.font.display, fontSize: 150, color: look.accent2, textShadow: `0 0 30px ${look.accent2}, 0 10px 30px rgba(0,0,0,0.6)`, transform: `scale(${interpolate(vs, [0, 1], [2.2, 1]) * pulse}) rotate(-6deg)`, opacity: Math.min(1, vs * 1.5) }}>VS</div>
      <Sfx frame={2} name="clash" volume={0.4} />
      <Sfx frame={voiceFrame(ts, snack - 0.15)} name="pop" volume={0.45} />
      <Sfx frame={voiceFrame(ts, feast + 0.1)} name="chime" volume={0.45} />
    </AbsoluteFill>
  );
};

/** Ein einzelner Vers als Chip – Krümel fallen, das Meter bleibt leer */
const Snack: React.FC<P> = ({ ts, s, t, frame }) => {
  const [chipAt, better, hungry] = beats(ts, s.cues, 3);
  const chip = popAt(frame, ts, chipAt - 0.2, 200, 10);
  const meterOn = popAt(frame, ts, better - 0.1);
  const value = interpolate(t, [better, better + 0.5], [0, 0.08], clamp);
  const crumble = interpolate(t, [hungry, hungry + 1.2], [0, 1], clamp);
  const crumbs = useMemo(() => Array.from({ length: 14 }, (_, i) => ({ dx: (random(`cr${i}`) - 0.5) * 200, v: 300 + random(`cv${i}`) * 260, r: 5 + random(`cs${i}`) * 9 })), []);
  const wobble = Math.sin(frame / 9) * 4;
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <g transform={`translate(540 700)`}>
          <ellipse cx={0} cy={150} rx={210} ry={34} fill="#000" opacity={0.3} />
          <ellipse cx={0} cy={130} rx={200} ry={42} fill="#F4F1EA" />
          <ellipse cx={0} cy={124} rx={150} ry={28} fill="#FFFFFF" />
          <g transform={`scale(${interpolate(chip, [0, 1], [0.3, 1])}) rotate(${-8 + wobble})`} opacity={Math.min(1, chip * 1.6) * (1 - crumble * 0.5)}>
            <path d="M -150 40 C -110 -60 80 -80 150 -10 C 120 80 -60 120 -150 40 Z" fill="#F7C25A" stroke="#C98A2E" strokeWidth={6} />
            <path d="M -120 30 C -80 -30 60 -50 120 -8" stroke="#FFE3A0" strokeWidth={10} fill="none" opacity={0.7} strokeLinecap="round" />
            <text x={0} y={30} textAnchor="middle" fontFamily={HAND} fontWeight={700} fontSize={62} fill="#7A4A12" transform="rotate(-6)">
              1 Vers
            </text>
          </g>
          {crumbs.map((c, i) => {
            const k = Math.max(0, crumble - i * 0.03);
            if (k <= 0) return null;
            return <circle key={i} cx={c.dx * k} cy={60 + c.v * k * k} r={c.r} fill="#E2A94A" opacity={1 - k * 0.6} />;
          })}
        </g>
      </svg>
      <Meter y={980} value={value} on={meterOn} full={false} frame={frame} />
      <Sfx frame={voiceFrame(ts, chipAt - 0.2)} name="pop" volume={0.45} />
      <Sfx frame={voiceFrame(ts, better)} name="blip" volume={0.3} />
      <Sfx frame={voiceFrame(ts, hungry)} name="glitch" volume={0.25} />
    </AbsoluteFill>
  );
};

/** Ein Gericht auf der Tafel */
const Dish: React.FC<{ x: number; y: number; s: number; kind: number; on: number; frame: number }> = ({ x, y, s, kind, on, frame }) => (
  <g transform={`translate(${x} ${y + (1 - on) * 40}) scale(${s * (0.6 + 0.4 * on)})`} opacity={on}>
    <ellipse cx={0} cy={18} rx={70} ry={20} fill="#000" opacity={0.25} />
    <ellipse cx={0} cy={10} rx={66} ry={20} fill="#F4F1EA" />
    {kind === 0 ? (
      <>
        <ellipse cx={0} cy={-4} rx={46} ry={26} fill="#B5652E" />
        <ellipse cx={-8} cy={-12} rx={26} ry={12} fill="#D9893F" />
      </>
    ) : kind === 1 ? (
      <>
        <circle cx={-18} cy={-8} r={16} fill="#E84B3C" />
        <circle cx={10} cy={-12} r={15} fill="#F2C14E" />
        <circle cx={26} cy={2} r={13} fill="#7DC45B" />
        <circle cx={-4} cy={4} r={13} fill="#9B59B6" />
      </>
    ) : kind === 2 ? (
      <path d="M -50 4 C -46 -40 46 -40 50 4 Z" fill="#E4B36A" stroke="#B9813A" strokeWidth={4} />
    ) : (
      <>
        <path d="M -30 6 L 30 6 L 22 -36 L -22 -36 Z" fill="#7BC6E8" opacity={0.8} />
        <ellipse cx={0} cy={-36} rx={22} ry={6} fill="#B9E6F7" />
      </>
    )}
    {kind !== 3
      ? [0, 1].map((i) => {
          const k = ((frame / 45 + i / 2 + kind * 0.13) % 1 + 1) % 1;
          return <path key={i} d={`M ${-14 + i * 26} ${-30 - k * 70} q 10 -14 0 -28 q -10 -14 0 -28`} stroke="#FFFFFF" strokeWidth={6} fill="none" strokeLinecap="round" opacity={0.45 * Math.sin(Math.PI * k)} />;
        })
      : null}
  </g>
);

/** «Lest.» – durchgestrichen. «Weidet euch!» Die Tafel füllt sich, das Meter auch. */
const Feast: React.FC<P> = ({ ts, s, t, frame }) => {
  const look = useLook();
  const [notJust, feed, full] = beats(ts, s.cues, 3);
  const board = popAt(frame, ts, notJust - 0.2, 160, 14);
  const strikeAt = beat(ts, "Er sagt", notJust + 1.3) - 0.15;
  const strike = interpolate(t, [strikeAt, strikeAt + 0.35], [0, 1], clamp);
  const write = interpolate(t, [feed - 0.05, feed + 0.9], [0, 1], clamp);
  const meterOn = popAt(frame, ts, full - 0.6);
  const value = interpolate(t, [full - 0.4, full + 0.8], [0.08, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const dishes = useMemo(
    () =>
      Array.from({ length: 11 }, (_, i) => {
        const row = i < 4 ? 0 : i < 8 ? 1 : 2;
        const inRow = row === 0 ? i : row === 1 ? i - 4 : i - 8;
        const n = row === 0 ? 4 : row === 1 ? 4 : 3;
        const spread = [520, 640, 760][row];
        return { x: 540 - spread / 2 + (spread / (n - 1)) * inRow + (row === 2 ? 0 : 0), y: [790, 880, 980][row], s: [0.72, 0.86, 1][row], kind: (i * 7) % 4, d: i * 0.12 };
      }),
    [],
  );
  return (
    <AbsoluteFill>
      {/* Kreidetafel */}
      <div style={{ position: "absolute", left: 150, right: 150, top: 300, height: 320, borderRadius: 18, background: "#1F2A24", border: "14px solid #7A4E2C", boxShadow: "0 24px 50px rgba(0,0,0,0.45)", opacity: board, transform: `rotate(-1.5deg) scale(${interpolate(board, [0, 1], [0.85, 1])})` }}>
        <div style={{ position: "absolute", top: 30, width: "100%", textAlign: "center", fontFamily: HAND, fontWeight: 700, fontSize: 88, color: "rgba(255,255,255,0.75)" }}>
          <span style={{ position: "relative" }}>
            Lest.
            <span style={{ position: "absolute", left: -10, right: -10, top: "52%", height: 8, borderRadius: 4, background: RED, transform: `scaleX(${strike})`, transformOrigin: "left center" }} />
          </span>
        </div>
        <div style={{ position: "absolute", top: 150, width: "100%", textAlign: "center", fontFamily: HAND, fontWeight: 700, fontSize: 116, color: look.accent, clipPath: `inset(0 ${100 - write * 100}% 0 0)`, textShadow: "0 0 20px rgba(255,181,71,0.35)" }}>
          Weidet euch!
        </div>
      </div>
      {/* Die Tafel */}
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <path d="M 220 760 L 860 760 L 1000 1060 L 80 1060 Z" fill="#F6EEDF" />
        <path d="M 80 1060 L 1000 1060 L 1000 1090 L 80 1090 Z" fill="#D9CDB8" />
        <path d="M 220 760 L 860 760" stroke="#E2D4BD" strokeWidth={4} />
        {[-1, 1].map((d) => (
          <g key={d} transform={`translate(${540 + d * 330} 770)`}>
            <rect x={-8} y={-70} width={16} height={70} rx={4} fill="#FFF7E6" />
            <path d={`M 0 -100 C 10 -86 10 -76 0 -70 C -10 -76 -10 -86 0 -100 Z`} fill="#FFC94A" opacity={0.85 + 0.15 * Math.sin(frame / 3 + d)} />
            <circle cx={0} cy={-86} r={40} fill="#FFC94A" opacity={0.15} />
          </g>
        ))}
        {dishes.map((dsh, i) => {
          const on = spring({ frame: frame - voiceFrame(ts, feed + dsh.d), fps: FPS, config: { damping: 12, stiffness: 180 } });
          return <Dish key={i} x={dsh.x} y={dsh.y} s={dsh.s} kind={dsh.kind} on={t >= feed + dsh.d - 0.05 ? on : 0} frame={frame} />;
        })}
      </svg>
      <Meter y={1110} value={value} on={meterOn} full={value > 0.97} frame={frame} />
      <Sfx frame={voiceFrame(ts, notJust - 0.2)} name="pop" volume={0.35} />
      <Sfx frame={voiceFrame(ts, strikeAt)} name="swipe" volume={0.35} />
      <Sfx frame={voiceFrame(ts, feed)} name="chime" volume={0.45} />
      <Sfx frame={voiceFrame(ts, full + 0.8)} name="levelup" volume={0.4} />
    </AbsoluteFill>
  );
};

/** Die Menükarte: Gang für Gang, in Handschrift */
const Courses: React.FC<P> = ({ ts, s, t, frame }) => {
  const card = interpolate(frame, [0, 10], [0, 1], clamp);
  const ats = s.courses.map((c) => (c.at ? beats(ts, [c.at], 1)[0] : -99));
  const newest = s.courses.length - 1;
  // Jede Zeile so hoch, wie ihr Text braucht: Caveat ≈ 0.35 × Schriftgrösse je Zeichen, 630 px Platz
  const SIZE = 52;
  const rows = s.courses.map((c) => {
    const lines = c.text.length * 0.35 * SIZE > 630 ? 2 : 1;
    return Math.max(112, 34 + lines * SIZE * 1.04 + (c.who ? 34 : 0)) + 22;
  });
  const ys = rows.map((_, i) => 478 + rows.slice(0, i).reduce((a, h) => a + h, 0));
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 110, right: 110, top: 262, height: 924, borderRadius: 14, background: PAPER, boxShadow: "0 40px 80px rgba(0,0,0,0.5)", transform: "rotate(-1deg)", opacity: card }}>
        <div style={{ position: "absolute", inset: 18, border: `3px double #C9B48E`, borderRadius: 8 }} />
        <div style={{ position: "absolute", top: 50, width: "100%", textAlign: "center", fontFamily: "Cinzel", fontWeight: 700, fontSize: 76, letterSpacing: "0.2em", color: INK }}>MENÜ</div>
        <div style={{ position: "absolute", top: 140, width: "100%", textAlign: "center", fontFamily: BODY, fontWeight: 700, fontSize: 24, letterSpacing: "0.18em", color: "#8A7456" }}>VON JUGENDLICHEN AUS ALLER WELT</div>
        <svg width={860} height={30} style={{ position: "absolute", top: 178, left: 0 }}>
          <path d="M 250 15 L 400 15 M 460 15 L 610 15" stroke="#C9B48E" strokeWidth={3} />
          <circle cx={430} cy={15} r={7} fill="#C9B48E" />
        </svg>
      </div>
      {s.courses.map((c, i) => {
        const at = ats[i];
        const fresh = c.at !== undefined;
        const write = fresh ? interpolate(t, [at - 0.05, at + 1.0], [0, 1], clamp) : 1;
        const icon = fresh ? spring({ frame: frame - voiceFrame(ts, at - 0.1), fps: FPS, config: { damping: 10, stiffness: 190 } }) : 1;
        const current = i === newest && fresh;
        const y = ys[i];
        const rowH = rows[i];
        if (fresh && t < at - 0.12) return null;
        return (
          <React.Fragment key={i}>
            {current ? <div style={{ position: "absolute", left: 138, right: 138, top: y - 14, height: rowH - 8, borderRadius: 18, background: "rgba(255,181,71,0.2)", transform: "rotate(-1deg)", opacity: icon }} /> : null}
            <div style={{ position: "absolute", left: 160, top: y, transform: `scale(${icon}) rotate(-1deg)` }}>
              <CourseIcon label={c.label} size={108} />
            </div>
            <div style={{ position: "absolute", left: 296, right: 150, top: y - 4, transform: "rotate(-1deg)" }}>
              <div style={{ fontFamily: BODY, fontWeight: 800, fontSize: 24, letterSpacing: "0.22em", color: "#3E8E5A", opacity: icon }}>{c.label.toUpperCase()}</div>
              <div style={{ fontFamily: HAND, fontWeight: 700, fontSize: SIZE, lineHeight: 1.04, color: INK, clipPath: `inset(0 ${100 - write * 100}% 0 0)` }}>{c.text}</div>
              {c.who ? <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 25, color: "#8A7456", marginTop: 2, opacity: interpolate(write, [0.6, 1], [0, 1], clamp) }}>{c.who}</div> : null}
            </div>
            {fresh ? <Sfx frame={voiceFrame(ts, at)} name={c.label.toLowerCase().startsWith("geheim") ? "chime" : "ding"} volume={0.35} /> : null}
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};

export const Scene: React.FC<{ ts: TimelineScene }> = ({ ts }) => {
  const s = ts.scene as MenuSceneT;
  const frame = useCurrentFrame();
  const t = useT(ts);
  const p = { ts, s, t, frame };
  switch (s.stage) {
    case "versus":
      return <Versus {...p} />;
    case "snack":
      return <Snack {...p} />;
    case "feast":
      return <Feast {...p} />;
    case "courses":
      return <Courses {...p} />;
  }
};

/**
 * «Snack oder Festmahl?» steht gross über Tütchen und Tafel – nicht noch einmal untertiteln. Sonst
 * weicht der Wortlaut auf Tafel und Karte ab und bleibt untertitelt.
 */
export const hidden = (ts: TimelineScene): Set<number> =>
  (ts.scene as MenuSceneT).stage === "versus" ? new Set(ts.words.map((w) => w.index)) : new Set();
