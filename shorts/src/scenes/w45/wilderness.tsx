import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, random, useCurrentFrame } from "remotion";
import { useLook } from "../../looks";
import { Sfx, beat, beats, voiceFrame } from "../../lib/sfx";
import type { TimelineScene } from "../../lib/timing";
import type { Scene as SceneData } from "../../schema";
import { Robed, Scroll, clamp, useT, wordsOfTexts } from "./kitA";

/*
 * Die Versuchung in der Wüste (Matthäus 4:1–11). Ehrfürchtig erzählt: Jesus ist nur eine kleine
 * helle Gestalt in der Weite, der Versucher ist Dunkelheit – Rauch, der heranzieht und mit
 * dunkler Schrift spricht. Jede Antwort ist eine Schriftrolle, die sich öffnet: «Es steht
 * geschrieben» – und das Dunkle weicht. Woher die drei Antworten stammen, verrät das Video nicht.
 */

type WildT = Extract<SceneData, { type: "wilderness" }>;

const LIGHT_ROBE = "#EEE7D8";
const HALO = "#FFE9B0";
const GROUND = 1140;

/* ------------------------------------------------------------------ */
/* Rauch und dunkle Schrift                                            */
/* ------------------------------------------------------------------ */

/** Dunkler Rauch, der von der Seite hereinzieht; `k` 0 … 1. */
const Smoke: React.FC<{ k: number; side?: 1 | -1; cy?: number; spread?: number }> = ({ k, side = 1, cy = 560, spread = 1 }) => {
  const frame = useCurrentFrame();
  const puffs = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => ({
        x: random(`smx${i}`),
        y: random(`smy${i}`),
        r: 160 + random(`smr${i}`) * 200,
        p: random(`smp${i}`) * 6.28,
      })),
    [],
  );
  if (k <= 0.002) return null;
  return (
    <g>
      <defs>
        <radialGradient id="wSmoke">
          <stop offset="0%" stopColor="#0A0614" stopOpacity="0.8" />
          <stop offset="45%" stopColor="#241238" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#2A1640" stopOpacity="0" />
        </radialGradient>
      </defs>
      {puffs.map((m, i) => {
        const enter = (1 - k) * 700 * side;
        const x = 540 + side * (m.x * 760 - 120) * spread + enter + Math.sin(frame / 40 + m.p) * 30;
        const y = cy + (m.y - 0.5) * 620 + Math.cos(frame / 47 + m.p) * 20;
        return <circle key={i} cx={x} cy={y} r={m.r} fill="url(#wSmoke)" opacity={k} />;
      })}
    </g>
  );
};

/** Was der Versucher sagt: dunkle Schrift in einem rauchigen Feld. */
const Attack: React.FC<{ text: string; k: number; out: number }> = ({ text, k, out }) => {
  const frame = useCurrentFrame();
  if (k <= 0.002) return null;
  const jitter = Math.sin(frame / 3) * 1.6;
  const size = text.length > 46 ? 66 : text.length > 32 ? 74 : 86;
  return (
    <div
      style={{
        position: "absolute",
        left: 80,
        right: 80,
        top: 360,
        minHeight: 260,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        fontFamily: "Cormorant Garamond",
        fontStyle: "italic",
        fontWeight: 600,
        fontSize: size,
        lineHeight: 1.12,
        color: "#C9B8E8",
        textShadow: "0 0 18px rgba(60,20,90,0.95), 0 0 46px rgba(10,4,20,0.95), 0 6px 20px rgba(0,0,0,0.9)",
        opacity: Math.min(1, k * 1.3) * (1 - out),
        filter: `blur(${(1 - Math.min(1, k * 1.2)) * 8 + out * 10}px)`,
        transform: `translate(${jitter + out * 120}px, ${(1 - k) * 20 - out * 40}px) scale(${1 - out * 0.15})`,
      }}
    >
      «{text}»
    </div>
  );
};

/** Die Antwort: eine Schriftrolle öffnet sich – «Es steht geschrieben». */
const Answer: React.FC<{ s: WildT; open: number; words: number; header: string }> = ({ s, open, words, header }) => {
  const look = useLook();
  if (!s.answer || open <= 0.002) return null;
  const tokens = s.answer.text.split(/\s+/);
  const shown = Math.ceil(tokens.length * words);
  return (
    <>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id="wScrollGlow">
            <stop offset="0%" stopColor="#FFF1C4" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#FFF1C4" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx={540} cy={570} rx={620 * open} ry={360 * open} fill="url(#wScrollGlow)" />
        <Scroll x={540} y={570} w={900} h={440} open={Easing.out(Easing.cubic)(open)} id="wScroll" />
      </svg>
      <div
        style={{
          position: "absolute",
          left: 150,
          right: 150,
          top: 380,
          height: 380,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          opacity: interpolate(open, [0.55, 0.9], [0, 1], clamp),
        }}
      >
        <div style={{ fontFamily: look.label, fontWeight: 700, fontSize: 44, letterSpacing: "0.1em", color: "#7A4A12" }}>{header}</div>
        <div style={{ width: 380, height: 3, background: "#A8783A", opacity: 0.6, margin: "18px 0 22px" }} />
        <div style={{ fontFamily: "Cormorant Garamond", fontStyle: "italic", fontWeight: 600, fontSize: s.answer.text.length > 60 ? 50 : 56, lineHeight: 1.14, color: "#2E1A08" }}>
          {tokens.map((w, i) => (
            <span key={i} style={{ opacity: i < shown ? 1 : 0.12 }}>
              {w}
              {i < tokens.length - 1 ? " " : ""}
            </span>
          ))}
        </div>
        {s.answer.ref ? (
          <div style={{ marginTop: 18, fontFamily: "Inter", fontWeight: 800, fontSize: 24, letterSpacing: "0.2em", color: "#8A5A20" }}>{s.answer.ref.toUpperCase()}</div>
        ) : null}
      </div>
    </>
  );
};

/* ------------------------------------------------------------------ */
/* Die Gestalt in der Weite                                            */
/* ------------------------------------------------------------------ */

/** Eine kleine helle Gestalt, von Licht umgeben – ehrfürchtig, ohne Gesicht. */
const Figure: React.FC<{ x: number; y: number; k: number; glow: number; dir?: 1 | -1 }> = ({ x, y, k, glow, dir = 1 }) => {
  const frame = useCurrentFrame();
  return (
    <g>
      <defs>
        <radialGradient id="wHalo">
          <stop offset="0%" stopColor={HALO} stopOpacity="0.75" />
          <stop offset="45%" stopColor={HALO} stopOpacity="0.2" />
          <stop offset="100%" stopColor={HALO} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={x} cy={y - 150 * k} r={360 * k * (0.9 + 0.1 * Math.sin(frame / 20))} fill="url(#wHalo)" opacity={glow} />
      <Robed x={x} y={y} k={k} dir={dir} fill={LIGHT_ROBE} rim={HALO} pose={{ bow: 0.15 }} shadow={false} />
    </g>
  );
};

/** Ein Dünenkamm unter der Gestalt, mondbeschienen. */
const Crest: React.FC<{ y: number }> = ({ y }) => (
  <g>
    <path d={`M 200 ${y + 90} Q 540 ${y - 30} 880 ${y + 90} Z`} fill="#2E2132" />
    <path d={`M 230 ${y + 76} Q 540 ${y - 26} 850 ${y + 76}`} fill="none" stroke="#C7B2B4" strokeWidth={3} opacity={0.5} />
  </g>
);

/* ------------------------------------------------------------------ */
/* Bühnen der Etappen                                                   */
/* ------------------------------------------------------------------ */

/** Steine im Sand – bei `lure` schimmern sie wie Brot. */
const Stones: React.FC<{ lure: number }> = ({ lure }) => {
  const frame = useCurrentFrame();
  const stones = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => {
        const left = i % 2 === 0;
        return {
          x: left ? 170 + random(`stx${i}`) * 230 : 680 + random(`stx${i}`) * 230,
          y: GROUND + 24 + random(`sty${i}`) * 50,
          r: 34 + random(`str${i}`) * 26,
        };
      }),
    [],
  );
  return (
    <g>
      <defs>
        <radialGradient id="wStone" cx="0.4" cy="0.3" r="0.7">
          <stop offset="0%" stopColor="#8E8494" />
          <stop offset="100%" stopColor="#3A3240" />
        </radialGradient>
        <radialGradient id="wBread" cx="0.4" cy="0.3" r="0.7">
          <stop offset="0%" stopColor="#F2C27A" />
          <stop offset="100%" stopColor="#9A5A22" />
        </radialGradient>
      </defs>
      {stones.map((st, i) => {
        const shimmer = lure * (0.7 + 0.3 * Math.sin(frame / 6 + i));
        return (
          <g key={i} transform={`translate(${st.x} ${st.y})`}>
            <ellipse cx={0} cy={st.r * 0.55} rx={st.r * 1.05} ry={st.r * 0.22} fill="#000" opacity={0.35} />
            {shimmer > 0.02 ? <ellipse cx={0} cy={0} rx={st.r * 1.6} ry={st.r * 1.1} fill="#FFC36E" opacity={0.18 * shimmer} /> : null}
            <ellipse cx={0} cy={0} rx={st.r} ry={st.r * 0.68} fill="url(#wStone)" />
            <ellipse cx={0} cy={0} rx={st.r} ry={st.r * 0.68} fill="url(#wBread)" opacity={shimmer} />
            {shimmer > 0.05
              ? [-0.4, 0, 0.4].map((f, k) => (
                  <path key={k} d={`M ${st.r * f - 8} ${-st.r * 0.42} q 8 10 16 0`} stroke="#6E3A10" strokeWidth={3} fill="none" opacity={shimmer} />
                ))
              : null}
          </g>
        );
      })}
    </g>
  );
};

/** Die Tempelzinne hoch über Jerusalem – tief unten die Lichter der Stadt. */
const Pinnacle: React.FC<{ lift: number }> = ({ lift }) => {
  const frame = useCurrentFrame();
  const lights = useMemo(
    () => Array.from({ length: 70 }, (_, i) => ({ x: random(`plx${i}`) * 1080, y: 1250 + random(`ply${i}`) * 260, r: 2 + random(`plr${i}`) * 3, p: random(`plp${i}`) * 6.28 })),
    [],
  );
  const dy = (1 - lift) * 260;
  return (
    <g transform={`translate(0 ${dy})`}>
      {/* Stadt tief unten */}
      {lights.map((l, i) => (
        <circle key={i} cx={l.x} cy={l.y} r={l.r} fill="#FFC36E" opacity={0.35 + 0.35 * Math.sin(frame / 10 + l.p)} />
      ))}
      {/* Turm der Zinne */}
      <path d="M 600 1700 L 630 960 L 830 960 L 860 1700 Z" fill="#3A2C26" />
      <path d="M 630 960 L 830 960 L 830 990 L 630 990 Z" fill="#6E5642" />
      {Array.from({ length: 9 }, (_, i) => (
        <g key={i}>
          <line x1={626 - i * 3} y1={1040 + i * 76} x2={834 + i * 3} y2={1040 + i * 76} stroke="#251C18" strokeWidth={4} />
          <line x1={680 + (i % 2) * 50} y1={1040 + i * 76} x2={680 + (i % 2) * 50} y2={1116 + i * 76} stroke="#251C18" strokeWidth={3} />
          <line x1={780 - (i % 2) * 40} y1={1040 + i * 76} x2={780 - (i % 2) * 40} y2={1116 + i * 76} stroke="#251C18" strokeWidth={3} />
        </g>
      ))}
      {[636, 712, 788].map((x, i) => (
        <rect key={i} x={x} y={932} width={40} height={30} fill="#4A3A30" />
      ))}
      <path d="M 630 960 L 640 1700" stroke="#C2A27E" strokeWidth={3} opacity={0.35} />
    </g>
  );
};

/** Ein sehr hoher Berg – unten glitzern die Reiche der Welt. */
const Kingdoms: React.FC<{ glitter: number }> = ({ glitter }) => {
  const frame = useCurrentFrame();
  const cities = useMemo(
    () =>
      Array.from({ length: 11 }, (_, i) => ({
        x: 60 + i * 96 + random(`kcx${i}`) * 30,
        y: 1170 + random(`kcy${i}`) * 40,
        h: 40 + random(`kch${i}`) * 60,
        dome: random(`kcd${i}`) > 0.5,
      })),
    [],
  );
  return (
    <g>
      {/* Reiche am Horizont */}
      {cities.map((c, i) => {
        const k = Math.max(0, Math.min(1, glitter * 1.6 - i * 0.05));
        return (
          <g key={i} opacity={0.35 + 0.65 * k}>
            <rect x={c.x - 30} y={c.y - c.h} width={60} height={c.h} fill="#2A2034" />
            {c.dome ? <circle cx={c.x} cy={c.y - c.h} r={26} fill="#2A2034" /> : <path d={`M ${c.x - 34} ${c.y - c.h} L ${c.x} ${c.y - c.h - 40} L ${c.x + 34} ${c.y - c.h} Z`} fill="#2A2034" />}
            <circle cx={c.x} cy={c.y - c.h - (c.dome ? 30 : 46)} r={6 + 6 * k} fill="#FFD36E" opacity={k * (0.6 + 0.4 * Math.sin(frame / 5 + i))} />
            {Array.from({ length: 3 }, (_, w) => (
              <rect key={w} x={c.x - 18 + w * 14} y={c.y - c.h + 14} width={8} height={12} fill="#FFC36E" opacity={k * 0.9} />
            ))}
          </g>
        );
      })}
      {/* Kronen und Gold, die aufsteigen */}
      {glitter > 0
        ? Array.from({ length: 12 }, (_, i) => {
            const p = ((frame / 70 + random(`kgp${i}`)) % 1) * glitter;
            const x = 80 + random(`kgx${i}`) * 920;
            const y = 1150 - p * 340;
            return (
              <g key={i} transform={`translate(${x} ${y}) scale(${0.6 + random(`kgs${i}`) * 0.6})`} opacity={Math.sin(p * Math.PI) * glitter}>
                {i % 3 === 0 ? <path d="M -18 6 L -20 -12 L -10 -2 L 0 -16 L 10 -2 L 20 -12 L 18 6 Z" fill="#F5C451" /> : <circle r={7} fill="#FFE08A" />}
              </g>
            );
          })
        : null}
      {/* Der Berg */}
      <path d="M 160 1320 L 380 1090 L 470 960 L 540 912 L 610 960 L 700 1080 L 920 1320 Z" fill="#1C1426" />
      <path d="M 470 960 L 540 912 L 610 960 L 586 1000 L 548 978 L 506 1012 Z" fill="#8E82A8" opacity={0.55} />
      <path d="M 540 912 L 520 1060 L 470 1180 M 610 960 L 640 1090 L 700 1200" stroke="#2E2440" strokeWidth={5} fill="none" />
    </g>
  );
};

/** Engel: hohe, sanfte Lichtgestalten im Morgenlicht – ohne Gesichter. */
const Angels: React.FC<{ k: number }> = ({ k }) => {
  const frame = useCurrentFrame();
  if (k <= 0.002) return null;
  return (
    <g>
      <defs>
        <radialGradient id="wAngel" cx="0.5" cy="0.35" r="0.6">
          <stop offset="0%" stopColor="#FFFBEA" stopOpacity="0.9" />
          <stop offset="50%" stopColor="#FFE9B0" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#FFE9B0" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="wBeam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFF6D6" stopOpacity="0" />
          <stop offset="100%" stopColor="#FFF6D6" stopOpacity="0.35" />
        </linearGradient>
      </defs>
      {[300, 430, 650, 780].map((x, i) => {
        const kk = Math.max(0, Math.min(1, k * 1.5 - i * 0.12));
        const y = 940 + Math.sin(frame / 22 + i) * 12 - (i % 2) * 40;
        return (
          <g key={i} opacity={kk}>
            <ellipse cx={x} cy={y} rx={70} ry={210} fill="url(#wAngel)" />
            <rect x={x - 26} y={0} width={52} height={y} fill="url(#wBeam)" opacity={0.5} />
            <ellipse cx={x - 46} cy={y - 50} rx={34} ry={110} fill="url(#wAngel)" transform={`rotate(-16 ${x - 46} ${y - 50})`} opacity={0.32} />
            <ellipse cx={x + 46} cy={y - 50} rx={34} ry={110} fill="url(#wAngel)" transform={`rotate(16 ${x + 46} ${y - 50})`} opacity={0.32} />
          </g>
        );
      })}
    </g>
  );
};

/* ------------------------------------------------------------------ */
/* Szene                                                               */
/* ------------------------------------------------------------------ */

const headerOf = (s: WildT) => (s.answer && /auch/i.test(s.answer.at) ? "ES STEHT AUCH GESCHRIEBEN" : "ES STEHT GESCHRIEBEN");

export const Scene: React.FC<{ ts: TimelineScene }> = ({ ts }) => {
  const s = ts.scene as WildT;
  const look = useLook();
  const frame = useCurrentFrame();
  const t = useT(ts);
  const attackAt = s.attack ? beat(ts, s.attack.at, 0.4) : 1e5;
  const answerAt = s.answer ? beat(ts, s.answer.at, 0.6) : 1e5;
  const attackK = interpolate(t, [attackAt - 0.35, attackAt + 0.1], [0, 1], clamp);
  const open = interpolate(t, [answerAt - 0.15, answerAt + 0.6], [0, 1], clamp);
  const words = s.answer ? interpolate(t, [answerAt + 0.6, Math.max(answerAt + 0.8, ts.speechEndSec - 0.2)], [0, 1], clamp) : 0;
  // Rauch: zieht mit dem Angriff heran; in einer Antwort-Szene liegt er noch da und weicht
  const smoke = s.answer ? 0.75 * (1 - interpolate(t, [answerAt - 0.1, answerAt + 0.9], [0, 1], clamp)) : s.attack ? attackK : 0;
  const rays = s.answer ? interpolate(t, [answerAt - 0.1, answerAt + 0.5, answerAt + 1.6], [0, 1, 0.4], clamp) : 0;
  const sfx: React.ReactNode[] = [];
  if (s.attack) sfx.push(<Sfx key="a" frame={voiceFrame(ts, attackAt - 0.3)} name="glitch" volume={0.3} />);
  if (s.answer) sfx.push(<Sfx key="b" frame={voiceFrame(ts, answerAt - 0.1)} name="swipe" volume={0.35} />, <Sfx key="c" frame={voiceFrame(ts, answerAt + 0.3)} name="chime" volume={0.5} />);

  let stage: React.ReactNode = null;
  let figure: { x: number; y: number; k: number } = { x: 540, y: GROUND, k: 0.44 };
  if (s.stage === "fast") {
    const [vierzig, essen, versucher] = beats(ts, s.cues, 3);
    const count = Math.max(1, Math.min(40, Math.round(interpolate(frame, [4, ts.audioOffsetFrames + Math.round((vierzig + 0.9) * 30)], [1, 40], clamp))));
    const eat = usePopLike(t, essen);
    const dark = interpolate(t, [versucher - 0.2, versucher + 1], [0, 1], clamp);
    stage = (
      <>
        <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
          <rect width={1080} height={1920} fill="#04020A" opacity={0.45 * dark} />
          <Smoke k={dark * 0.9} side={1} cy={760} spread={1.2} />
        </svg>
        <div style={{ position: "absolute", top: 330, left: 0, right: 0, textAlign: "center" }}>
          <div style={{ fontFamily: look.label, fontWeight: 700, fontSize: 40, letterSpacing: "0.3em", color: look.dim }}>TAG</div>
          <div style={{ fontFamily: look.label, fontWeight: 700, fontSize: 230, lineHeight: 1, color: look.accent, textShadow: look.glow }}>{count}</div>
          <div style={{ fontFamily: look.label, fontWeight: 700, fontSize: 34, letterSpacing: "0.24em", color: look.text, opacity: count >= 40 ? 1 : 0.4 }}>TAGE UND NÄCHTE</div>
        </div>
        <div
          style={{
            position: "absolute",
            top: 800,
            left: 0,
            right: 0,
            textAlign: "center",
            fontFamily: "Inter",
            fontWeight: 800,
            fontSize: 34,
            letterSpacing: "0.22em",
            color: "#E8D6C0",
            opacity: Math.min(1, eat * 1.4) * (1 - dark * 0.6),
            transform: `scale(${interpolate(eat, [0, 1], [0.7, 1])})`,
          }}
        >
          <svg width={140} height={70} viewBox="-70 -40 140 70" style={{ display: "block", margin: "0 auto 10px" }}>
            <path d="M -60 -10 Q 0 50 60 -10 Z" fill="none" stroke="#E8D6C0" strokeWidth={5} />
            <line x1={-60} y1={-10} x2={60} y2={-10} stroke="#E8D6C0" strokeWidth={5} />
          </svg>
          KEIN ESSEN
        </div>
        <Sfx frame={voiceFrame(ts, versucher)} name="whoosh" volume={0.4} />
      </>
    );
    figure = { x: 540, y: GROUND, k: 0.44 };
  } else if (s.stage === "bread") {
    const lure = s.attack ? attackK : 1 - open;
    stage = (
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <Stones lure={lure} />
      </svg>
    );
  } else if (s.stage === "temple") {
    const [hoch, zitiert] = beats(ts, s.cues, 2);
    const lift = s.attack ? interpolate(t, [hoch - 0.6, hoch + 0.8], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) }) : 1;
    const darkScroll = s.attack ? usePopLike(t, zitiert) : 0;
    figure = { x: 730, y: 932 + (1 - lift) * 260, k: 0.36 };
    stage = (
      <>
        <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
          <Pinnacle lift={lift} />
          {darkScroll > 0.01 ? (
            <g transform={`translate(240 700) rotate(-10) scale(${darkScroll})`} opacity={Math.min(1, darkScroll * 1.2) * (1 - interpolate(t, [ts.speechEndSec, ts.speechEndSec + 0.5], [0, 0.4], clamp))}>
              <rect x={-90} y={-60} width={180} height={120} fill="#1A1024" stroke="#5A3A7A" strokeWidth={4} />
              <path d="M -90 60 l 20 -14 l 18 16 l 22 -12 l 20 14 l 24 -10 l 22 12 l 20 -10 l 24 14 L 90 60" fill="#1A1024" />
              {[-30, -6, 18].map((y, i) => (
                <line key={i} x1={-62} y1={y} x2={62 - i * 14} y2={y} stroke="#7A5A9A" strokeWidth={5} strokeLinecap="round" opacity={0.7} />
              ))}
              <rect x={-104} y={-74} width={24} height={148} rx={12} fill="#2A1A36" />
              <rect x={80} y={-74} width={24} height={148} rx={12} fill="#2A1A36" />
            </g>
          ) : null}
        </svg>
        {s.attack ? <Sfx frame={voiceFrame(ts, zitiert)} name="glitch" volume={0.3} /> : null}
      </>
    );
  } else if (s.stage === "kingdoms") {
    const glitter = s.attack ? interpolate(t, [attackAt - 0.2, attackAt + 1.2], [0, 1], clamp) : 1 - open * 0.8;
    figure = { x: 540, y: 916, k: 0.3 };
    stage = (
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <Kingdoms glitter={glitter} />
      </svg>
    );
  } else if (s.stage === "angels") {
    const [ab, engel] = beats(ts, s.cues, 2);
    const flee = interpolate(t, [ab - 0.2, ab + 1.2], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
    const dawn = interpolate(frame, [0, ts.durationInFrames], [0.2, 1], clamp);
    const come = interpolate(t, [engel - 0.3, engel + 1.2], [0, 1], clamp);
    stage = (
      <>
        <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
          <defs>
            <linearGradient id="wDawn" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#FFB86A" stopOpacity="0.6" />
              <stop offset="40%" stopColor="#E88A7A" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#7A6AB0" stopOpacity="0" />
            </linearGradient>
          </defs>
          <rect width={1080} height={1920} fill="url(#wDawn)" opacity={dawn} />
          <g opacity={1 - flee}>
            <Smoke k={0.6} side={-1} cy={600} spread={0.8 + flee} />
          </g>
          <Angels k={come} />
        </svg>
        <Sfx frame={voiceFrame(ts, engel)} name="chime" volume={0.5} />
      </>
    );
  }

  const glow = s.stage === "angels" ? 1 : s.answer ? 0.55 + 0.45 * open : s.attack ? 0.5 - 0.2 * attackK : 0.7;
  return (
    <AbsoluteFill>
      {stage}
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        {s.stage !== "temple" && s.stage !== "kingdoms" ? <Crest y={GROUND - 4} /> : null}
        <Figure x={figure.x} y={figure.y} k={figure.k} glow={glow} />
        {rays > 0 ? (
          <g opacity={rays}>
            {Array.from({ length: 14 }, (_, i) => {
              const a = (i / 14) * Math.PI * 2 + frame / 90;
              const cx = 540;
              const cy = 570;
              return (
                <path
                  key={i}
                  d={`M ${cx + Math.cos(a - 0.05) * 200} ${cy + Math.sin(a - 0.05) * 200} L ${cx + Math.cos(a) * 900} ${cy + Math.sin(a) * 900} L ${cx + Math.cos(a + 0.05) * 200} ${cy + Math.sin(a + 0.05) * 200} Z`}
                  fill="#FFF1C4"
                  opacity={0.08}
                />
              );
            })}
          </g>
        ) : null}
        {s.stage !== "fast" && s.stage !== "angels" ? <Smoke k={smoke} side={1} cy={560} /> : null}
      </svg>
      {s.attack ? <Attack text={s.attack.text} k={attackK} out={0} /> : null}
      <Answer s={s} open={open} words={words} header={headerOf(s)} />
      {sfx}
    </AbsoluteFill>
  );
};

/** Ein Auftritt ohne Hook (in Bedingungen erlaubt): 0 … 1 mit leichtem Überschwingen. */
function usePopLike(t: number, at: number): number {
  const k = Math.max(0, Math.min(1, (t - at + 0.1) / 0.35));
  return Easing.out(Easing.back(1.6))(k);
}

/** Angriff und Antwort stehen gross im Bild – sie werden nicht noch einmal untertitelt. */
export const hidden = (ts: TimelineScene): Set<number> => {
  const s = ts.scene as WildT;
  return wordsOfTexts(ts, [s.attack?.text, s.answer?.text, s.answer?.at]);
};

