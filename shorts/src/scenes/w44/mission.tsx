import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, random, spring, useCurrentFrame } from "remotion";
import { useLook } from "../../looks";
import { Sfx, beat, beats, voiceFrame } from "../../lib/sfx";
import { FPS, type TimelineScene } from "../../lib/timing";
import type { Scene } from "../../schema";
import { theme } from "../../theme";

/*
 * Weltraum-Look: die Mission des Mars-Rovers in Etappen – Start, Flug, Landung – und danach
 * Michelle Amos mit ihrem Ausweis und ihrem Rat als Checkliste. Zahlen und Abzeichen erscheinen,
 * wenn die Stimme sie nennt (`cues`, `lines`). Keine Logos von Raumfahrtbehörden, nur Text.
 */

type MissionSceneT = Extract<Scene, { type: "mission" }>;
type P = { ts: TimelineScene; s: MissionSceneT; t: number; frame: number };
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const MONO = '"Space Mono"';

const pad = (n: number, w = 2) => String(Math.max(0, Math.floor(n))).padStart(w, "0");
/** 470000000 → «470 000 000» */
const grouped = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

/* ------------------------------------------------------------------ */
/* HUD-Zeile oben                                                      */
/* ------------------------------------------------------------------ */

const HudBar: React.FC<{ label?: string; right?: string; frame: number }> = ({ label, right, frame }) => {
  const look = useLook();
  if (!label && !right) return null;
  const blink = Math.floor(frame / 15) % 2 === 0;
  return (
    <div style={{ position: "absolute", top: 236, left: 72, right: 72, height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: MONO, fontWeight: 700, fontSize: 34, letterSpacing: "0.08em", color: look.accent2 }}>
      <span style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <span style={{ width: 18, height: 18, borderRadius: 9, background: look.accent, opacity: blink ? 1 : 0.3, boxShadow: `0 0 14px ${look.accent}` }} />
        {label?.toUpperCase()}
      </span>
      <span style={{ color: "#FFFFFF", opacity: 0.9 }}>{right}</span>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Start                                                               */
/* ------------------------------------------------------------------ */

const Rocket: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  // Fusspunkt (x, y); etwa 560 hoch
  <g transform={`translate(${x} ${y})`}>
    {/* Seitenbooster */}
    {[-1, 1].map((d) => (
      <g key={d}>
        <rect x={d * 52 - 13} y={-170} width={26} height={170} rx={10} fill="#E9ECF2" />
        <path d={`M ${d * 52 - 13} -170 Q ${d * 52} -205 ${d * 52 + 13} -170 Z`} fill="#E9ECF2" />
        <rect x={d * 52 - 10} y={-6} width={20} height={12} fill="#3A3F4B" />
      </g>
    ))}
    {/* Erste Stufe: kupferfarben */}
    <rect x={-40} y={-330} width={80} height={330} fill="url(#rkCopper)" />
    <rect x={-40} y={-330} width={80} height={10} fill="#8C4A22" />
    {/* Zweite Stufe und Nutzlastverkleidung */}
    <rect x={-40} y={-420} width={80} height={90} fill="#F2F4F8" />
    <path d="M -46 -420 L -46 -500 C -46 -560, 46 -560, 46 -500 L 46 -420 Z" fill="url(#rkFairing)" />
    <rect x={-46} y={-424} width={92} height={8} fill="#C9CED8" />
    <text x={0} y={-460} textAnchor="middle" fontFamily={MONO} fontWeight={700} fontSize={16} fill="#3A3F4B" letterSpacing={2}>
      MARS 2020
    </text>
    {/* Düse */}
    <path d="M -26 0 L 26 0 L 34 22 L -34 22 Z" fill="#2B2F38" />
  </g>
);

const Tower: React.FC<{ x: number; ground: number }> = ({ x, ground }) => (
  <g opacity={0.95}>
    <rect x={x - 30} y={ground - 640} width={60} height={640} fill="none" stroke="#1D2433" strokeWidth={8} />
    {Array.from({ length: 16 }, (_, i) => {
      const y = ground - 640 + i * 40;
      return <path key={i} d={`M ${x - 30} ${y} L ${x + 30} ${y + 40} M ${x + 30} ${y} L ${x - 30} ${y + 40}`} stroke="#1D2433" strokeWidth={4} />;
    })}
    {[0.25, 0.55].map((k, i) => (
      <rect key={i} x={x + 30} y={ground - 640 * (1 - k)} width={70} height={12} fill="#1D2433" />
    ))}
    {[0, 1, 2].map((i) => (
      <circle key={i} cx={x} cy={ground - 650 + i * 3} r={6} fill="#FF4A3D" opacity={0.85} />
    ))}
  </g>
);

const Launch: React.FC<P> = ({ ts, s, t, frame }) => {
  const look = useLook();
  const [c3, c2, c1, go] = beats(ts, s.cues, 4);
  const dateAt = Math.max(beat(ts, "Juli 2020", go + 1.1), go + 1.1);
  const lift = Math.max(0, t - (go + 0.35));
  const rise = 210 * lift * lift; // beschleunigt
  const ignite = interpolate(t, [go - 0.05, go + 0.25], [0, 1], clamp);
  const shake = t > go && t < go + 2.2 ? Math.sin(frame * 2.7) * 5 * (1 - (t - go) / 2.2) : 0;
  const ground = 1160;
  const rocketY = ground - 6 - rise;
  const smoke = useMemo(
    () => Array.from({ length: 26 }, (_, i) => ({ side: i % 2 ? 1 : -1, v: 140 + random(`sm${i}`) * 380, d: random(`sd${i}`) * 0.9, r: 40 + random(`sr${i}`) * 70, y: random(`sy${i}`) * 40 })),
    [],
  );
  // Countdown: welche Zahl gerade steht
  const marks: Array<[number, string]> = [
    [c3, "3"],
    [c2, "2"],
    [c1, "1"],
    [go, "START"],
  ];
  const T = t - go;
  const timer = T < 0 ? `T-00:${pad(Math.ceil(-T))}` : `T+00:${pad(T)}`;
  const date = spring({ frame: frame - voiceFrame(ts, dateAt), fps: FPS, config: { damping: 14, stiffness: 160 } });

  return (
    <AbsoluteFill style={{ transform: `translate(${shake}px, ${shake * 0.6}px)` }}>
      {/* Luft und Horizont – hinter Zahlen und Rakete */}
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <rect x={0} y={0} width={1080} height={1920} fill="url(#lnAirBg)" />
        <defs>
          <linearGradient id="lnAirBg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0B1636" stopOpacity="0" />
            <stop offset="38%" stopColor="#0E1D45" stopOpacity="0.55" />
            <stop offset="56%" stopColor="#2A2552" stopOpacity="0.92" />
            <stop offset="62%" stopColor="#B4604A" stopOpacity="1" />
            <stop offset="66%" stopColor="#140E1C" stopOpacity="1" />
            <stop offset="100%" stopColor="#06050A" stopOpacity="1" />
          </linearGradient>
        </defs>
      </svg>
      {/* Countdown */}
      {marks.map(([at, label], i) => {
        const dt = t - at;
        if (dt < 0 || dt > (label === "START" ? 1.6 : 1.0)) return null;
        const pop = spring({ frame: frame - voiceFrame(ts, at), fps: FPS, config: { damping: 11, stiffness: 190 } });
        const out = interpolate(dt, [label === "START" ? 1.2 : 0.7, label === "START" ? 1.6 : 1.0], [1, 0], clamp);
        return (
          <React.Fragment key={i}>
            <Sfx frame={voiceFrame(ts, at)} name={label === "START" ? "whoosh" : "tick"} volume={label === "START" ? 0.5 : 0.45} />
            {label === "START" ? <Sfx frame={voiceFrame(ts, at) + 4} name="drum" volume={0.55} /> : <Sfx frame={voiceFrame(ts, at)} name="blip" volume={0.25} />}
            <div
              style={{
                position: "absolute",
                top: label === "START" ? 330 : 270,
                width: "100%",
                textAlign: "center",
                fontFamily: theme.font.display,
                fontSize: label === "START" ? 200 : 300,
                lineHeight: 1,
                color: label === "START" ? look.accent : "#FFFFFF",
                textShadow: label === "START" ? `0 0 40px ${look.accent}` : `0 0 30px ${look.accent2}`,
                opacity: pop * out,
                transform: `scale(${interpolate(pop, [0, 1], [1.6, 1])})`,
              }}
            >
              {label}
            </div>
          </React.Fragment>
        );
      })}

      {/* Datum, sobald die Rakete unterwegs ist */}
      {t > dateAt ? (
        <div style={{ position: "absolute", top: 290, width: "100%", textAlign: "center", opacity: date, transform: `translateY(${interpolate(date, [0, 1], [30, 0])}px)` }}>
          <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 30, letterSpacing: "0.3em", color: look.accent2 }}>START</div>
          <div style={{ fontFamily: theme.font.display, fontSize: 170, lineHeight: 1.05, color: "#FFFFFF", textShadow: `0 0 30px rgba(110,231,249,0.45)` }}>JULI 2020</div>
        </div>
      ) : null}
      {t > dateAt ? <Sfx frame={voiceFrame(ts, dateAt)} name="blip" volume={0.3} /> : null}

      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <linearGradient id="lnAir" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0B1636" stopOpacity="0" />
            <stop offset="38%" stopColor="#0E1D45" stopOpacity="0.55" />
            <stop offset="56%" stopColor="#2A2552" stopOpacity="0.92" />
            <stop offset="62%" stopColor="#B4604A" stopOpacity="1" />
            <stop offset="66%" stopColor="#140E1C" stopOpacity="1" />
            <stop offset="100%" stopColor="#06050A" stopOpacity="1" />
          </linearGradient>
          <linearGradient id="rkCopper" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#A9542A" />
            <stop offset="45%" stopColor="#E58B4F" />
            <stop offset="100%" stopColor="#8E4421" />
          </linearGradient>
          <linearGradient id="rkFairing" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#D5DAE3" />
            <stop offset="45%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#BFC5D0" />
          </linearGradient>
          <radialGradient id="lnFlame" cx="0.5" cy="0.15" r="0.85">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="30%" stopColor="#FFE9A8" />
            <stop offset="65%" stopColor="#FF9A3C" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#FF5A1F" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="lnSmokeA">
            <stop offset="0%" stopColor="#D9D4DE" stopOpacity="0.95" />
            <stop offset="60%" stopColor="#B9B3C2" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#B9B3C2" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="lnSmokeB">
            <stop offset="0%" stopColor="#FFF4E6" stopOpacity="0.95" />
            <stop offset="55%" stopColor="#F2D7C0" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#F2D7C0" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="lnGlow">
            <stop offset="0%" stopColor="#FFB054" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#FFB054" stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* Leuchten der Triebwerke über dem Boden */}
        <ellipse cx={540} cy={ground} rx={520} ry={220} fill="url(#lnGlow)" opacity={ignite * interpolate(lift, [0, 3], [1, 0.25], clamp)} />
        <Tower x={360} ground={ground} />
        {/* Abgasspur nach dem Abheben */}
        {lift > 0 ? <rect x={530} y={rocketY + 40} width={20} height={Math.max(0, ground - rocketY - 40)} fill="#FFD9A0" opacity={0.25 * interpolate(lift, [0, 3.5], [1, 0], clamp)} /> : null}
        {/* Flamme */}
        {ignite > 0 ? (
          <ellipse cx={540} cy={rocketY + 22 + (110 + 30 * Math.sin(frame * 1.7)) * ignite * 0.5} rx={34 + 8 * Math.sin(frame * 2.3)} ry={(110 + 30 * Math.sin(frame * 1.7)) * ignite * 0.5 + 10} fill="url(#lnFlame)" />
        ) : null}
        <Rocket x={540} y={rocketY} />
        {/* Startplattform */}
        <rect x={380} y={ground} width={320} height={26} fill="#1A1F2B" />
        <path d={`M 0 ${ground + 18} L 1080 ${ground + 18} L 1080 1920 L 0 1920 Z`} fill="#07060B" />
        {/* Rauchwolken, die am Boden zur Seite quellen */}
        {smoke.map((p, i) => {
          const dt = t - go - p.d * 0.6;
          if (dt <= 0) return null;
          const k = Math.min(1, dt / 3);
          return (
            <circle
              key={i}
              cx={540 + p.side * p.v * Easing.out(Easing.cubic)(k) * 1.4}
              cy={ground - 10 - p.y - 40 * k}
              r={p.r * (0.6 + 1.6 * k)}
              fill={i % 3 ? "url(#lnSmokeA)" : "url(#lnSmokeB)"}
              opacity={0.9 * (1 - k * 0.5)}
            />
          );
        })}
      </svg>

      <HudBar label={s.hud} right={timer} frame={frame} />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* Flug                                                                */
/* ------------------------------------------------------------------ */

const Planet: React.FC<{ cx: number; cy: number; r: number; kind: "earth" | "mars"; frame: number }> = ({ cx, cy, r, kind, frame }) => {
  const id = `pl-${kind}`;
  const spin = (frame / FPS) * (kind === "earth" ? 10 : 6);
  return (
    <g>
      <defs>
        <radialGradient id={`${id}-body`} cx="0.35" cy="0.32" r="0.8">
          {kind === "earth" ? (
            <>
              <stop offset="0%" stopColor="#6EC3FF" />
              <stop offset="55%" stopColor="#2266C4" />
              <stop offset="100%" stopColor="#0B2350" />
            </>
          ) : (
            <>
              <stop offset="0%" stopColor="#FFB07A" />
              <stop offset="55%" stopColor="#D2582E" />
              <stop offset="100%" stopColor="#5A1C0E" />
            </>
          )}
        </radialGradient>
        <radialGradient id={`${id}-halo`}>
          <stop offset="60%" stopColor={kind === "earth" ? "#5DB6FF" : "#FF8A4C"} stopOpacity="0.45" />
          <stop offset="100%" stopColor={kind === "earth" ? "#5DB6FF" : "#FF8A4C"} stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${id}-clip`}>
          <circle cx={cx} cy={cy} r={r} />
        </clipPath>
      </defs>
      <circle cx={cx} cy={cy} r={r * 1.45} fill={`url(#${id}-halo)`} />
      <circle cx={cx} cy={cy} r={r} fill={`url(#${id}-body)`} />
      <g clipPath={`url(#${id}-clip)`}>
        {kind === "earth"
          ? [0, 1, 2, 3].map((i) => {
              const x = cx - r + ((i * 0.55 * r + spin * 2) % (2.6 * r));
              return <path key={i} d={`M ${x - 40} ${cy - r * 0.5 + i * 28} q 40 -24 90 0 t 80 6`} stroke="#FFFFFF" strokeWidth={12} strokeLinecap="round" fill="none" opacity={0.55} />;
            })
          : [0, 1, 2, 3, 4].map((i) => {
              const x = cx - r + ((i * 0.5 * r + spin * 2) % (2.4 * r));
              return <ellipse key={i} cx={x} cy={cy - r * 0.45 + i * r * 0.22} rx={r * 0.22} ry={r * 0.08} fill="#7A2A14" opacity={0.45} />;
            })}
        {kind === "earth"
          ? [0, 1].map((i) => {
              const x = cx - r + ((i * 1.1 * r + spin * 1.4) % (2.6 * r));
              return <ellipse key={`l${i}`} cx={x} cy={cy + (i ? 20 : -26)} rx={r * 0.32} ry={r * 0.2} fill="#3E9A4E" opacity={0.75} />;
            })
          : null}
        {/* Schatten der Nachtseite */}
        <circle cx={cx + r * 0.45} cy={cy + r * 0.4} r={r * 1.05} fill="#000000" opacity={0.35} />
      </g>
    </g>
  );
};

const Craft: React.FC<{ x: number; y: number; a: number }> = ({ x, y, a }) => (
  <g transform={`translate(${x} ${y}) rotate(${a})`}>
    <rect x={-58} y={-8} width={40} height={16} fill="#4B7BD6" stroke="#9CC2FF" strokeWidth={2} />
    <rect x={18} y={-8} width={40} height={16} fill="#4B7BD6" stroke="#9CC2FF" strokeWidth={2} />
    <circle cx={0} cy={0} r={18} fill="#E8EBF2" stroke="#B5BCC9" strokeWidth={3} />
    <circle cx={0} cy={0} r={6} fill="#C88A3A" />
  </g>
);

const bez = (t: number, p0: number, p1: number, p2: number, p3: number) => {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
};

const Cruise: React.FC<P> = ({ ts, s, t, frame }) => {
  const look = useLook();
  const [daysAt, distAt, sevenAt, autoAt] = beats(ts, s.cues, 4);
  const E = { x: 250, y: 1030 };
  const M = { x: 820, y: 660 };
  const C1 = { x: 120, y: 640 };
  const C2 = { x: 470, y: 470 };
  const durSec = ts.durationInFrames / FPS;
  const k = interpolate(frame / FPS, [0.2, durSec], [0.08, 0.9], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const pos = { x: bez(k, E.x, C1.x, C2.x, M.x), y: bez(k, E.y, C1.y, C2.y, M.y) };
  const k2 = Math.min(1, k + 0.01);
  const ang = (Math.atan2(bez(k2, E.y, C1.y, C2.y, M.y) - pos.y, bez(k2, E.x, C1.x, C2.x, M.x) - pos.x) * 180) / Math.PI;
  const days = Math.round(203 * interpolate(t, [daysAt, daysAt + 1.4], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) }));
  const dist = 470_000_000 * interpolate(t, [distAt, distAt + 1.6], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const clock = Math.max(0, 7 * 60 - Math.max(0, t - sevenAt));
  const seven = spring({ frame: frame - voiceFrame(ts, sevenAt), fps: FPS, config: { damping: 13, stiffness: 170 } });
  const auto = spring({ frame: frame - voiceFrame(ts, autoAt), fps: FPS, config: { damping: 9, stiffness: 190 } });
  const path = `M ${E.x} ${E.y} C ${C1.x} ${C1.y}, ${C2.x} ${C2.y}, ${M.x} ${M.y}`;

  const counter = (label: string, value: string, on: number, unit?: string) => (
    <div style={{ flex: 1, padding: "18px 24px", border: `3px solid ${on > 0 ? look.accent2 : "rgba(110,231,249,0.25)"}`, background: "rgba(4,12,28,0.72)", borderRadius: 14, boxShadow: on > 0 ? "0 0 22px rgba(110,231,249,0.35)" : "none" }}>
      <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 26, letterSpacing: "0.2em", color: look.accent2 }}>{label}</div>
      <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 52, color: "#FFFFFF", whiteSpace: "nowrap" }}>
        {value}
        {unit ? <span style={{ fontSize: 30, color: look.dim }}> {unit}</span> : null}
      </div>
    </div>
  );

  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <path d={path} stroke={look.accent2} strokeWidth={4} strokeDasharray="16 14" strokeDashoffset={-frame * 1.2} fill="none" opacity={0.55} />
        <Planet cx={E.x} cy={E.y} r={118} kind="earth" frame={frame} />
        <Planet cx={M.x} cy={M.y} r={92} kind="mars" frame={frame} />
        <text x={E.x} y={E.y + 170} textAnchor="middle" fontFamily={MONO} fontWeight={700} fontSize={28} fill={look.dim} letterSpacing={4}>
          ERDE
        </text>
        <text x={M.x} y={M.y + 150} textAnchor="middle" fontFamily={MONO} fontWeight={700} fontSize={28} fill={look.accent} letterSpacing={4}>
          MARS
        </text>
        {/* Spur hinter dem Raumschiff */}
        <path d={path} stroke="#FFFFFF" strokeWidth={5} fill="none" pathLength={1} strokeDasharray={`${k} 1`} opacity={0.35} />
        <Craft x={pos.x} y={pos.y} a={ang} />
      </svg>

      <div style={{ position: "absolute", top: 316, left: 72, right: 72, display: "flex", gap: 20 }}>
        {counter("TAG", pad(days, 3), t >= daysAt ? 1 : 0)}
        {counter("DISTANZ", grouped(dist), t >= distAt ? 1 : 0, "km")}
      </div>
      <Sfx frame={voiceFrame(ts, daysAt)} name="blip" volume={0.3} />
      <Sfx frame={voiceFrame(ts, daysAt + 1.4)} name="coin" volume={0.22} />
      <Sfx frame={voiceFrame(ts, distAt)} name="blip" volume={0.3} />
      <Sfx frame={voiceFrame(ts, distAt + 1.6)} name="coin" volume={0.22} />

      {/* Sieben Minuten bis zur Landung */}
      {t >= sevenAt ? (
        <div style={{ position: "absolute", left: 560, right: 72, top: 820, padding: "20px 26px", borderRadius: 16, border: `4px solid ${look.accent}`, background: "rgba(40,10,4,0.75)", boxShadow: `0 0 30px rgba(255,138,76,0.45)`, opacity: seven, transform: `scale(${interpolate(seven, [0, 1], [0.7, 1])})` }}>
          <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 24, letterSpacing: "0.16em", color: look.accent }}>LANDUNG IN</div>
          <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 92, lineHeight: 1.05, color: "#FFFFFF" }}>
            {pad(clock / 60)}:{pad(clock % 60)}
          </div>
        </div>
      ) : null}
      <Sfx frame={voiceFrame(ts, sevenAt)} name="tick" volume={0.45} />

      {/* Autonom: Die Erde kann nicht mehr eingreifen */}
      {t >= autoAt ? (
        <div style={{ position: "absolute", left: 560, right: 72, top: 1040, padding: "14px 22px", borderRadius: 12, border: `4px solid ${look.accent2}`, background: "rgba(2,20,30,0.8)", textAlign: "center", opacity: Math.min(1, auto * 1.3), transform: `scale(${interpolate(auto, [0, 1], [1.5, 1])}) rotate(${interpolate(auto, [0, 1], [-6, -2])}deg)` }}>
          <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 50, letterSpacing: "0.12em", color: look.accent2 }}>AUTONOM</div>
          <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 20, letterSpacing: "0.1em", color: "#FFFFFF", opacity: 0.8 }}>KEIN EINGRIFF MÖGLICH</div>
        </div>
      ) : null}
      <Sfx frame={voiceFrame(ts, autoAt)} name="glitch" volume={0.3} />

      <HudBar label={s.hud} right="KURS: MARS" frame={frame} />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* Landung                                                             */
/* ------------------------------------------------------------------ */

const Rover: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  // (x, y) = Mitte unten an den Rädern; etwa 260 breit
  <g transform={`translate(${x} ${y})`}>
    {/* Beine (Rocker-Bogie) */}
    <path d="M -100 -40 L -70 -70 L -10 -70 L 30 -40 M 30 -40 L 70 -70 L 100 -40" stroke="#5B5F68" strokeWidth={7} fill="none" strokeLinejoin="round" />
    {[-100, 0, 100].map((wx) => (
      <g key={wx}>
        <circle cx={wx} cy={-26} r={26} fill="#2A2D33" />
        <circle cx={wx} cy={-26} r={12} fill="#9AA0AA" />
      </g>
    ))}
    {/* Körper */}
    <rect x={-120} y={-128} width={220} height={58} rx={8} fill="#E9ECF1" stroke="#9AA0AA" strokeWidth={3} />
    <rect x={-120} y={-80} width={220} height={10} fill="#C8CDD6" />
    {/* Radioisotopen-Generator hinten */}
    <path d="M -120 -122 L -160 -150 L -150 -164 L -112 -138 Z" fill="#3A3D44" />
    {/* Mast mit Kamerakopf */}
    <rect x={64} y={-250} width={10} height={124} fill="#D7DBE3" />
    <rect x={44} y={-280} width={58} height={34} rx={6} fill="#E9ECF1" stroke="#9AA0AA" strokeWidth={3} />
    <circle cx={92} cy={-263} r={8} fill="#1E2C4A" />
    {/* Arm vorne */}
    <path d="M 100 -100 L 140 -90 L 150 -54" stroke="#9AA0AA" strokeWidth={7} fill="none" />
  </g>
);

const Crane: React.FC<{ x: number; y: number; frame: number; firing: number }> = ({ x, y, frame, firing }) => (
  <g transform={`translate(${x} ${y})`}>
    {[-1, 1].map((d) =>
      [0, 1].map((k) => {
        const nx = d * (70 + k * 34);
        const len = (34 + 10 * Math.sin(frame * 1.9 + k + d)) * firing;
        return (
          <g key={`${d}-${k}`}>
            <path d={`M ${nx - 8} 18 L ${nx + 8} 18 L ${nx + d * 6 + 6} 34 L ${nx + d * 6 - 6} 34 Z`} fill="#3A3D44" />
            {len > 2 ? <path d={`M ${nx + d * 6 - 8} 34 L ${nx + d * 6 + 8} 34 L ${nx + d * 16} ${34 + len} Z`} fill="#FFB054" opacity={0.85} /> : null}
          </g>
        );
      }),
    )}
    <rect x={-120} y={-30} width={240} height={50} rx={6} fill="#C9A24A" stroke="#7A5E22" strokeWidth={3} />
    <rect x={-120} y={-30} width={240} height={12} fill="#E8C871" />
    {[-80, -30, 20, 70].map((tx) => (
      <rect key={tx} x={tx} y={-14} width={26} height={22} fill="#8E6E2A" opacity={0.6} />
    ))}
  </g>
);

const Land: React.FC<P> = ({ ts, s, t, frame }) => {
  const look = useLook();
  const [dateAt, touchAt] = beats(ts, s.cues, 2);
  const ground = 1040;
  // Abstieg bis zum Aufsetzen, dann fliegt der Kran davon
  const d = interpolate(t, [-0.4, touchAt], [0, 1], { ...clamp, easing: Easing.out(Easing.quad) });
  const craneY0 = 540;
  const after = Math.max(0, t - touchAt - 0.25);
  const cable = interpolate(d, [0, 0.35], [40, 230], clamp);
  const craneY = interpolate(d, [0, 1], [craneY0, ground - 120 - 230 - 30]) - 260 * after * after;
  const craneX = 540 - 340 * after * after;
  const touched = t >= touchAt;
  // Nach dem Aufsetzen bleibt der Rover stehen; nur der Kran fliegt weg
  const roverY = touched ? ground : Math.min(ground, craneY + 30 + cable + 120);
  const alt = Math.max(0, (ground - roverY) / 22);
  const date = spring({ frame: frame - voiceFrame(ts, dateAt), fps: FPS, config: { damping: 14, stiffness: 160 } });
  const td = spring({ frame: frame - voiceFrame(ts, touchAt), fps: FPS, config: { damping: 10, stiffness: 170 } });
  const dust = useMemo(() => Array.from({ length: 30 }, (_, i) => ({ side: i % 2 ? 1 : -1, v: 60 + random(`du${i}`) * 260, r: 16 + random(`dr${i}`) * 36, d: random(`dd${i}`) })), []);
  const nearGround = interpolate(roverY, [ground - 260, ground], [0, 1], clamp);

  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <linearGradient id="ldSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1A0F22" stopOpacity="0.55" />
            <stop offset="35%" stopColor="#5A2C2E" stopOpacity="0.8" />
            <stop offset="55%" stopColor="#B8673F" stopOpacity="0.95" />
            <stop offset="62%" stopColor="#D98A5C" />
            <stop offset="100%" stopColor="#D98A5C" />
          </linearGradient>
        </defs>
        <rect x={0} y={0} width={1080} height={1920} fill="url(#ldSky)" />
        {/* Ferne Hügel und Dünen */}
        <path d={`M 0 ${ground - 70} C 200 ${ground - 120}, 380 ${ground - 60}, 560 ${ground - 95} S 900 ${ground - 70}, 1080 ${ground - 110} L 1080 1920 L 0 1920 Z`} fill="#A24A2A" opacity={0.85} />
        <path d={`M 0 ${ground + 10} C 240 ${ground - 25}, 470 ${ground + 20}, 700 ${ground - 10} S 980 ${ground + 15}, 1080 ${ground - 5} L 1080 1920 L 0 1920 Z`} fill="#7E3519" />
        <path d={`M 0 ${ground + 160} C 300 ${ground + 120}, 560 ${ground + 190}, 820 ${ground + 150} S 1000 ${ground + 160}, 1080 ${ground + 140} L 1080 1920 L 0 1920 Z`} fill="#4E1F10" />
        {[...Array(9)].map((_, i) => (
          <ellipse key={i} cx={80 + i * 120 + (i % 2) * 30} cy={ground + 40 + (i % 3) * 22} rx={14 + (i % 3) * 6} ry={6} fill="#5C2614" opacity={0.7} />
        ))}

        {/* Seile */}
        {!touched || t < touchAt + 0.2
          ? [-60, 0, 60].map((cx) => <line key={cx} x1={craneX + cx * 0.6} y1={craneY + 20} x2={540 + cx} y2={roverY - 128} stroke="#DADDE3" strokeWidth={3} opacity={0.9} />)
          : null}
        <Crane x={craneX} y={craneY} frame={frame} firing={touched ? 1 : interpolate(d, [0, 0.1], [0.5, 1], clamp)} />
        <Rover x={540} y={roverY} />

        {/* Staub, aufgewirbelt von den Triebwerken */}
        {dust.map((p, i) => {
          const dt = (t - (touchAt - 1.6) - p.d * 0.8) % 2.4;
          if (t < touchAt - 1.8 || dt < 0) return null;
          const k = dt / 2.4;
          return (
            <circle
              key={i}
              cx={540 + p.side * (90 + p.v * k)}
              cy={ground - 10 - 50 * k}
              r={p.r * (0.5 + k)}
              fill="#E3A57A"
              opacity={0.55 * (1 - k) * Math.max(nearGround, touched ? interpolate(t, [touchAt, touchAt + 2], [1, 0.3], clamp) : 0)}
            />
          );
        })}
      </svg>

      {/* Datum */}
      {t >= dateAt ? (
        <div style={{ position: "absolute", top: 320, width: "100%", textAlign: "center", opacity: date * (touched ? 0 : 1) }}>
          <div style={{ fontFamily: theme.font.display, fontSize: 150, lineHeight: 1, color: "#FFFFFF", textShadow: "0 0 30px rgba(255,138,76,0.5)", transform: `scale(${interpolate(date, [0, 1], [0.7, 1])})` }}>FEB 2021</div>
        </div>
      ) : null}
      <Sfx frame={voiceFrame(ts, dateAt)} name="blip" volume={0.3} />

      {/* Aufgesetzt */}
      {touched ? (
        <div style={{ position: "absolute", top: 320, width: "100%", textAlign: "center", opacity: Math.min(1, td * 1.4) }}>
          <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 30, letterSpacing: "0.3em", color: look.accent2 }}>FEB 2021 · JEZERO-KRATER</div>
          <div style={{ fontFamily: theme.font.display, fontSize: 168, lineHeight: 1.05, color: look.accent2, textShadow: "0 0 34px rgba(110,231,249,0.6)", transform: `scale(${interpolate(td, [0, 1], [1.5, 1])})` }}>
            TOUCHDOWN
          </div>
        </div>
      ) : null}
      <Sfx frame={voiceFrame(ts, touchAt)} name="drum" volume={0.5} />
      <Sfx frame={voiceFrame(ts, touchAt) + 3} name="levelup" volume={0.4} />

      <HudBar label={s.hud} right={`HÖHE ${alt.toFixed(1).replace(".", ",")} m`} frame={frame} />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* Ausweis                                                             */
/* ------------------------------------------------------------------ */

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#%&@";

const Badge: React.FC<P> = ({ ts, s, t, frame }) => {
  const look = useLook();
  const name = (s.title ?? "").toUpperCase();
  const nameAt = beat(ts, s.title, ts.speechEndSec * 0.5);
  const enter = spring({ frame, fps: FPS, config: { damping: 15, stiffness: 120 } });
  const swing = Math.sin(frame / 22) * 1.2 * (1 - Math.min(1, frame / 200)) + interpolate(enter, [0, 1], [-8, 0]);
  // Name entschlüsselt sich Buchstabe für Buchstabe
  const reveal = interpolate(t, [nameAt - 0.1, nameAt + 0.7], [0, 1], clamp);
  const shown = name
    .split("")
    .map((ch, i) => {
      if (ch === " ") return " ";
      if (i / name.length < reveal) return ch;
      return t < nameAt - 0.1 ? "•" : GLYPHS[Math.floor(random(`g${i}-${Math.floor(frame / 2)}`) * GLYPHS.length)];
    })
    .join("");
  const X = 150;
  const Y = 350;
  const Wd = 780;
  const Ht = 800;
  const nameSize = Math.min(104, 700 / (0.47 * Math.max(6, name.length)));

  return (
    <AbsoluteFill style={{ transform: `translateY(${interpolate(enter, [0, 1], [700, 0])}px) rotate(${swing}deg)`, transformOrigin: "540px 0px" }}>
      {/* Band */}
      <div style={{ position: "absolute", left: 500, width: 80, top: 200, height: Y - 200, background: `repeating-linear-gradient(180deg, #1E3A6E 0 40px, #234582 40px 80px)` }} />
      <div style={{ position: "absolute", left: 505, width: 70, top: Y - 70, height: 90, borderRadius: 12, background: "#B9C0CC", border: "4px solid #8A92A0" }} />
      <div style={{ position: "absolute", left: X, top: Y, width: Wd, height: Ht, borderRadius: 36, background: "linear-gradient(160deg, #FFFFFF 0%, #EEF2F8 60%, #DDE4EE 100%)", boxShadow: "0 40px 100px rgba(0,0,0,0.55)", overflow: "hidden" }}>
        {/* Kopfband */}
        <div style={{ height: 120, background: `linear-gradient(90deg, ${look.accent} 0%, #E0522B 100%)`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 40px" }}>
          <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 32, letterSpacing: "0.16em", color: "#FFFFFF" }}>MISSION MARS</span>
          <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 26, letterSpacing: "0.12em", color: "rgba(255,255,255,0.85)" }}>CREW</span>
        </div>
        {/* Helm statt Foto */}
        <svg width={Wd} height={280} style={{ display: "block" }}>
          <circle cx={Wd / 2} cy={150} r={112} fill="#1C2A44" />
          <circle cx={Wd / 2} cy={150} r={92} fill="#E9EDF3" />
          <path d={`M ${Wd / 2 - 66} 140 Q ${Wd / 2} 84 ${Wd / 2 + 66} 140 L ${Wd / 2 + 58} 184 Q ${Wd / 2} 208 ${Wd / 2 - 58} 184 Z`} fill="#1E2C4A" />
          <path d={`M ${Wd / 2 - 38} 130 Q ${Wd / 2 - 10} 110 ${Wd / 2 + 18} 120`} stroke="#6EE7F9" strokeWidth={8} strokeLinecap="round" fill="none" opacity={0.7} />
          <rect x={Wd / 2 - 66} y={228} width={132} height={22} rx={6} fill="#C9CED8" />
        </svg>
        <div style={{ textAlign: "center", fontFamily: theme.font.display, fontSize: nameSize, lineHeight: 1.05, color: "#111827", letterSpacing: "0.02em", whiteSpace: "pre" }}>{shown}</div>
        <div style={{ marginTop: 26, padding: "0 56px", display: "flex", flexDirection: "column", gap: 16 }}>
          {s.lines.map((line, i) => {
            const at = beat(ts, line.at, 1 + i);
            const sp = spring({ frame: frame - voiceFrame(ts, at), fps: FPS, config: { damping: 14, stiffness: 180 } });
            return (
              <React.Fragment key={i}>
                <Sfx frame={voiceFrame(ts, at)} name="blip" volume={0.3} />
                <div style={{ display: "flex", alignItems: "center", gap: 18, opacity: sp, transform: `translateX(${interpolate(sp, [0, 1], [-40, 0])}px)` }}>
                  <span style={{ width: 22, height: 22, borderRadius: 4, background: look.accent2, flexShrink: 0 }} />
                  <span style={{ fontFamily: theme.font.body, fontWeight: 800, fontSize: 40, color: "#1F2937" }}>{line.text}</span>
                </div>
              </React.Fragment>
            );
          })}
        </div>
        {/* Strichcode und Hologramm */}
        <div style={{ position: "absolute", left: 56, bottom: 40, display: "flex", gap: 4, alignItems: "flex-end" }}>
          {Array.from({ length: 34 }, (_, i) => (
            <span key={i} style={{ width: 2 + (random(`bc${i}`) > 0.6 ? 4 : 0), height: 46, background: "#111827" }} />
          ))}
        </div>
        <div
          style={{
            position: "absolute",
            right: 50,
            bottom: 34,
            width: 92,
            height: 92,
            borderRadius: 46,
            background: `conic-gradient(from ${frame * 4}deg, #6EE7F9, #C08CFF, #FF8A4C, #FFE45C, #6EE7F9)`,
            opacity: 0.55,
          }}
        />
      </div>
      <Sfx frame={voiceFrame(ts, nameAt)} name="type" volume={0.3} />
      <Sfx frame={voiceFrame(ts, nameAt + 0.7)} name="unlock" volume={0.3} />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* Checkliste                                                          */
/* ------------------------------------------------------------------ */

const Checklist: React.FC<P> = ({ ts, s, t, frame }) => {
  const look = useLook();
  const enter = spring({ frame, fps: FPS, config: { damping: 16, stiffness: 140 } });
  const X = 80;
  const Y = 320;
  const Wd = 920;
  const rowH = s.lines.length > 3 ? 150 : 170;
  const Ht = 150 + s.lines.length * rowH + 30;
  const done = s.lines.filter((l, i) => t >= beat(ts, l.at, 1 + i) + 0.3).length;
  const scan = (frame * 6) % (Ht + 200);

  return (
    <AbsoluteFill style={{ opacity: enter, transform: `scale(${interpolate(enter, [0, 1], [0.94, 1])})` }}>
      <div style={{ position: "absolute", left: X, top: Y, width: Wd, height: Ht, borderRadius: 20, background: "rgba(4,12,28,0.8)", border: `3px solid rgba(110,231,249,0.55)`, boxShadow: "0 0 40px rgba(110,231,249,0.18)", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: scan - 200, height: 140, background: "linear-gradient(180deg, rgba(110,231,249,0) 0%, rgba(110,231,249,0.08) 50%, rgba(110,231,249,0) 100%)" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "34px 40px 20px", borderBottom: "2px solid rgba(110,231,249,0.25)" }}>
          <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 40, letterSpacing: "0.08em", color: look.accent2 }}>▸ {(s.title ?? "").toUpperCase()}</span>
          <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 32, color: look.accent }}>
            {done}/{s.lines.length}
          </span>
        </div>
        <div style={{ padding: "16px 40px", display: "flex", flexDirection: "column" }}>
          {s.lines.map((line, i) => {
            const at = beat(ts, line.at, 1 + i);
            const sp = spring({ frame: frame - voiceFrame(ts, at), fps: FPS, config: { damping: 14, stiffness: 180 } });
            const tick = interpolate(t, [at + 0.25, at + 0.55], [0, 1], clamp);
            const question = line.text.trim().endsWith("?");
            const live = t >= at;
            return (
              <div key={i} style={{ height: rowH, display: "flex", alignItems: "center", gap: 30, opacity: live ? 0.35 + 0.65 * sp : 0.22 }}>
                <Sfx frame={voiceFrame(ts, at)} name="blip" volume={0.3} />
                {!question ? <Sfx frame={voiceFrame(ts, at + 0.3)} name="coin" volume={0.25} /> : null}
                {question ? (
                  <div style={{ width: 84, height: 84, borderRadius: 14, border: `4px solid ${live ? look.accent : "rgba(255,255,255,0.3)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontWeight: 700, fontSize: 36, color: live ? look.accent : "rgba(255,255,255,0.4)", flexShrink: 0, boxShadow: live ? `0 0 18px rgba(255,138,76,0.5)` : "none" }}>
                    {pad(i + 1)}
                  </div>
                ) : (
                  <svg width={84} height={84} style={{ flexShrink: 0 }}>
                    <rect x={4} y={4} width={76} height={76} rx={14} fill="none" stroke={live ? look.accent2 : "rgba(255,255,255,0.3)"} strokeWidth={5} />
                    <path d="M 20 44 L 36 60 L 66 24" stroke={look.accent} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" fill="none" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - tick} />
                  </svg>
                )}
                <div style={{ fontFamily: theme.font.body, fontWeight: 800, fontSize: 50, lineHeight: 1.12, color: "#FFFFFF", transform: `translateX(${interpolate(sp, [0, 1], [30, 0])}px)` }}>{line.text}</div>
              </div>
            );
          })}
        </div>
      </div>
      {/* Eckwinkel */}
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        {[
          [X - 14, Y - 14, 1, 1],
          [X + Wd + 14, Y - 14, -1, 1],
          [X - 14, Y + Ht + 14, 1, -1],
          [X + Wd + 14, Y + Ht + 14, -1, -1],
        ].map(([cx, cy, sx, sy], i) => (
          <path key={i} d={`M ${cx} ${cy + sy * 44} L ${cx} ${cy} L ${cx + sx * 44} ${cy}`} stroke={look.accent2} strokeWidth={6} fill="none" />
        ))}
      </svg>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */

export const MissionScene: React.FC<{ ts: TimelineScene }> = ({ ts }) => {
  const s = ts.scene as MissionSceneT;
  const frame = useCurrentFrame();
  const t = (frame - ts.audioOffsetFrames) / FPS;
  const props = { ts, s, t, frame };
  switch (s.stage) {
    case "launch":
      return <Launch {...props} />;
    case "cruise":
      return <Cruise {...props} />;
    case "land":
      return <Land {...props} />;
    case "badge":
      return <Badge {...props} />;
    case "checklist":
      return <Checklist {...props} />;
  }
};
