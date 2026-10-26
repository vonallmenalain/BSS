import React from "react";
import { AbsoluteFill, Easing, interpolate, random, useCurrentFrame } from "remotion";
import { useLook } from "../../looks";
import { Sfx, beat, beats, voiceFrame } from "../../lib/sfx";
import type { TimelineScene } from "../../lib/timing";
import type { Scene as SceneData } from "../../schema";
import { BrassPlates, Robed, Stamp, clamp, usePop, useT, wordsOfTexts } from "./kitA";

/*
 * Quest «Die Messingplatten» (1 Nephi 3–5) – Jerusalem bei Nacht als Spiel: oben das Quest-Log
 * mit den drei Versuchen, darunter die Bühne des jeweiligen Versuchs. Labans Tür, das Gold, die
 * Brüder, die aufgeben wollen, Nephi allein in der Nacht – und zum Schluss der Vergleich mit dem
 * Volk, das ohne Schriften aus Jerusalem kam (Omni 1:15–17). Alle Takte sind Phrasen der Stimme.
 */

type QuestSceneT = Extract<SceneData, { type: "quest" }>;
type Attempt = QuestSceneT["attempts"][number];

const RED = "#E2483D";
const GOLD = "#F4C25A";
const RIM = "#FFB45C";
/** Boden der Bühne */
const GROUND = 1150;

/* ------------------------------------------------------------------ */
/* Quest-Log                                                           */
/* ------------------------------------------------------------------ */

const statusAt = (ts: TimelineScene, a: Attempt, t: number): Attempt["result"] => {
  if (a.result === "open") return "open";
  if (!a.at) return a.result;
  return t >= beat(ts, a.at, 0) - 0.02 ? a.result : "open";
};

const QuestLog: React.FC<{ ts: TimelineScene; s: QuestSceneT; current?: number }> = ({ ts, s, current }) => {
  const look = useLook();
  const frame = useCurrentFrame();
  const t = useT(ts);
  const enter = interpolate(frame, [0, 10], [0, 1], clamp);
  return (
    <g opacity={enter} transform={`translate(0 ${(1 - enter) * -20})`}>
      <rect x={60} y={246} width={960} height={182} rx={26} fill="rgba(10,8,18,0.94)" stroke={GOLD} strokeOpacity={0.55} strokeWidth={3} />
      <rect x={84} y={268} width={128} height={40} rx={20} fill={look.accent2} />
      <text x={148} y={297} textAnchor="middle" fontFamily="Inter" fontWeight={800} fontSize={22} letterSpacing={4} fill="#1A0E06">
        QUEST
      </text>
      <text x={232} y={302} fontFamily={look.label} fontWeight={700} fontSize={40} letterSpacing={2} fill={look.text}>
        {s.title ?? "Die Messingplatten"}
      </text>
      {s.attempts.map((a, i) => {
        const st = statusAt(ts, a, t);
        const x = 84 + i * 308;
        const y = 330;
        const active = i === current;
        const pulse = active && st === "open" ? 0.5 + 0.5 * Math.sin(frame / 6) : 0;
        const border = st === "fail" ? RED : st === "win" ? GOLD : active ? look.accent : "rgba(255,244,226,0.25)";
        const changed = a.at && st !== "open" ? interpolate(t, [beat(ts, a.at, 0), beat(ts, a.at, 0) + 0.35], [1.25, 1], clamp) : 1;
        return (
          <g key={i} transform={`translate(${x + 142} ${y + 38}) scale(${changed}) translate(${-x - 142} ${-y - 38})`}>
            <rect x={x} y={y} width={284} height={76} rx={16} fill={st === "fail" ? "rgba(226,72,61,0.16)" : st === "win" ? "rgba(244,194,90,0.2)" : "rgba(255,255,255,0.05)"} stroke={border} strokeWidth={active ? 4 : 2.5} />
            {pulse > 0 ? <rect x={x - 4} y={y - 4} width={292} height={84} rx={19} fill="none" stroke={look.accent} strokeOpacity={0.5 * pulse} strokeWidth={4} /> : null}
            <circle cx={x + 38} cy={y + 38} r={22} fill={st === "fail" ? RED : st === "win" ? GOLD : "rgba(255,244,226,0.14)"} />
            <text x={x + 38} y={y + 47} textAnchor="middle" fontFamily="Anton" fontSize={28} fill={st === "open" ? look.text : "#1A0E06"}>
              {st === "fail" ? "✗" : st === "win" ? "✓" : i + 1}
            </text>
            <text x={x + 72} y={y + 30} fontFamily="Inter" fontWeight={800} fontSize={20} letterSpacing={2.5} fill={look.dim}>
              {a.label.toUpperCase()}
            </text>
            <text x={x + 72} y={y + 62} fontFamily={look.label} fontWeight={700} fontSize={30} fill={st === "fail" ? "#FF9A90" : st === "win" ? GOLD : look.text}>
              {a.text ?? "…"}
            </text>
          </g>
        );
      })}
    </g>
  );
};

/** Der Stempel zum Ergebnis eines Versuchs – mitten über der Bühne. */
const ResultStamp: React.FC<{ ts: TimelineScene; s: QuestSceneT; y?: number }> = ({ ts, s, y = 760 }) => {
  const look = useLook();
  const a = s.attempts.find((x) => x.at && x.result !== "open");
  const at = a?.at ? beat(ts, a.at, ts.speechEndSec) : 1e5;
  const pop = usePop(ts, at, { damping: 10, stiffness: 230 });
  if (!a?.at) return null;
  return (
    <>
      <Stamp x={540} y={y} text={a.result === "win" ? "GESCHAFFT" : "GESCHEITERT"} color={a.result === "win" ? GOLD : RED} pop={pop} rot={a.result === "win" ? -4 : -9} size={84} font={look.label} />
      <Sfx frame={voiceFrame(ts, at)} name={a.result === "win" ? "levelup" : "stamp"} volume={0.55} keep />
    </>
  );
};

/* ------------------------------------------------------------------ */
/* Bausteine der Bühne                                                 */
/* ------------------------------------------------------------------ */

/** Labans Tür: Rundbogen in der Mauer, Holz mit Nieten; `open` 0 … 1, `rage` färbt das Licht rot. */
const LabanDoor: React.FC<{ open: number; rage: number }> = ({ open, rage }) => {
  const x = 540;
  const w = 300;
  const top = 640;
  const bottom = GROUND;
  const arch = `M ${x - w / 2} ${bottom} L ${x - w / 2} ${top + w / 2} A ${w / 2} ${w / 2} 0 0 1 ${x + w / 2} ${top + w / 2} L ${x + w / 2} ${bottom} Z`;
  const leaf = (w / 2) * (1 - open * 0.75);
  return (
    <g>
      <defs>
        <radialGradient id="qDoorLight" cx="0.5" cy="0.7" r="0.7">
          <stop offset="0%" stopColor={rage > 0 ? "#FF6A4A" : "#FFC36E"} stopOpacity="0.95" />
          <stop offset="100%" stopColor={rage > 0 ? "#7A1410" : "#7A3E12"} stopOpacity="0.9" />
        </radialGradient>
        <linearGradient id="qWood" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#3A2412" />
          <stop offset="50%" stopColor="#5C3A1C" />
          <stop offset="100%" stopColor="#2E1C0C" />
        </linearGradient>
      </defs>
      {/* Rahmen aus Stein */}
      <path d={`M ${x - w / 2 - 34} ${bottom} L ${x - w / 2 - 34} ${top + w / 2} A ${w / 2 + 34} ${w / 2 + 34} 0 0 1 ${x + w / 2 + 34} ${top + w / 2} L ${x + w / 2 + 34} ${bottom} Z`} fill="#6E5236" stroke="#2A1C10" strokeWidth={4} />
      <path d={arch} fill="url(#qDoorLight)" opacity={0.25 + 0.75 * open} />
      <path d={arch} fill="#140C06" opacity={1 - open} />
      {/* Zwei Flügel, die nach innen aufgehen */}
      {[-1, 1].map((sd) => (
        <g key={sd}>
          <rect x={sd < 0 ? x - w / 2 : x + w / 2 - leaf} y={top + 40} width={leaf} height={bottom - top - 40} fill="url(#qWood)" stroke="#1A0E06" strokeWidth={3} />
          {Array.from({ length: 5 }, (_, r) => (
            <circle key={r} cx={sd < 0 ? x - w / 2 + leaf * 0.5 : x + w / 2 - leaf * 0.5} cy={top + 110 + r * 82} r={7} fill="#1A120A" stroke="#8A6A3A" strokeWidth={2} opacity={leaf > 20 ? 1 : 0} />
          ))}
        </g>
      ))}
      <path d={`M ${x - w / 2} ${top + w / 2} A ${w / 2} ${w / 2} 0 0 1 ${x + w / 2} ${top + w / 2}`} fill="none" stroke="#2A1C10" strokeWidth={10} />
      {/* Schwelle */}
      <rect x={x - w / 2 - 50} y={bottom - 6} width={w + 100} height={18} rx={4} fill="#4A3826" />
    </g>
  );
};

/** Gold, Silber, eine Truhe – `pull` zieht alles in die Tür. */
const Treasure: React.FC<{ show: number; pull: number }> = ({ show, pull }) => {
  if (show <= 0.001) return null;
  const items = Array.from({ length: 16 }, (_, i) => ({
    x: 360 + random(`tx${i}`) * 360,
    y: GROUND - 40 - random(`ty${i}`) * 90,
    kind: i % 4 === 0 ? "bar" : "coin",
    silver: i % 3 === 0,
  }));
  return (
    <g>
      {items.map((it, i) => {
        const k = Math.max(0, Math.min(1, pull * 1.6 - (i / items.length) * 0.6));
        const e = Easing.in(Easing.cubic)(k);
        const x = it.x + (540 - it.x) * e;
        const y = it.y + (900 - it.y) * e;
        const sc = (1 - e * 0.8) * interpolate(show, [0, 1], [0.3, 1]);
        const fill = it.silver ? "#D8DEE8" : "#F2BE4A";
        const edge = it.silver ? "#7A8496" : "#8A5A14";
        return (
          <g key={i} transform={`translate(${x} ${y}) scale(${sc})`} opacity={1 - e}>
            {it.kind === "coin" ? (
              <>
                <ellipse cx={0} cy={6} rx={30} ry={11} fill={edge} />
                <ellipse cx={0} cy={0} rx={30} ry={11} fill={fill} stroke={edge} strokeWidth={2} />
              </>
            ) : (
              <path d="M -38 10 L -26 -12 L 26 -12 L 38 10 Z" fill={fill} stroke={edge} strokeWidth={3} />
            )}
          </g>
        );
      })}
      {/* Truhe */}
      <g transform={`translate(${780 - pull * 200} ${GROUND - 70}) scale(${interpolate(show, [0, 1], [0.4, 1]) * (1 - pull * 0.7)})`} opacity={1 - pull}>
        <rect x={-70} y={-20} width={140} height={80} rx={8} fill="#6A3E18" stroke="#2A160A" strokeWidth={4} />
        <path d="M -70 -20 Q 0 -84 70 -20 Z" fill="#7E4C20" stroke="#2A160A" strokeWidth={4} />
        <rect x={-12} y={-4} width={24} height={30} rx={4} fill={GOLD} />
        <ellipse cx={0} cy={-26} rx={52} ry={12} fill="#FFD36E" opacity={0.85} />
      </g>
    </g>
  );
};

/** Diener mit Speeren, die aus der Tür stürmen. */
const Servants: React.FC<{ k: number }> = ({ k }) => {
  if (k <= 0.001) return null;
  return (
    <g>
      {[0, 1, 2].map((i) => {
        const kk = Math.max(0, Math.min(1, k * 1.4 - i * 0.2));
        const x = 540 + (i - 1) * 40 - kk * (160 + i * 90);
        return (
          <g key={i} opacity={Math.min(1, kk * 2)}>
            <line x1={x + 30} y1={GROUND - 300} x2={x - 70} y2={GROUND - 420} stroke="#2A1C10" strokeWidth={8} strokeLinecap="round" />
            <path d={`M ${x - 70} ${GROUND - 420} l -10 -26 l 22 14 Z`} fill="#C9C9C9" />
            <Robed x={x} y={GROUND} k={0.95} dir={-1} rim="#FF5A3A" rimSide={-1} pose={{ reach: 0.7, step: kk * 14 + i }} />
          </g>
        );
      })}
    </g>
  );
};

/** Sprechblase über einer Stelle der Bühne. */
const Bubble: React.FC<{ x: number; y: number; text: string; pop: number; tone: "red" | "gold"; w?: number; size?: number }> = ({ x, y, text, pop, tone, w = 560, size = 58 }) => {
  const look = useLook();
  if (pop <= 0.001) return null;
  const col = tone === "red" ? RED : GOLD;
  return (
    <div
      style={{
        position: "absolute",
        left: x - w / 2,
        top: y,
        width: w,
        padding: "24px 30px",
        borderRadius: 30,
        background: "rgba(16,10,6,0.92)",
        border: `4px solid ${col}`,
        boxShadow: `0 0 40px ${col}55, 0 20px 50px rgba(0,0,0,0.5)`,
        textAlign: "center",
        fontFamily: tone === "red" ? "Anton" : look.label,
        fontWeight: 700,
        fontSize: size,
        lineHeight: 1.12,
        letterSpacing: tone === "red" ? "0.06em" : "0.01em",
        color: tone === "red" ? "#FFB0A8" : look.text,
        opacity: Math.min(1, pop * 1.5),
        transform: `scale(${interpolate(pop, [0, 1], [0.5, 1])})`,
        transformOrigin: "50% 120%",
      }}
    >
      {text}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Etappen                                                             */
/* ------------------------------------------------------------------ */

/** Quest-Titel, die Platten, drei leere Plätze – zwei davon gehen schief. */
const Intro: React.FC<{ ts: TimelineScene; s: QuestSceneT }> = ({ ts, s }) => {
  const look = useLook();
  const frame = useCurrentFrame();
  const t = useT(ts);
  const [drei, schief, buch] = beats(ts, s.cues, 3);
  const title = interpolate(frame, [2, 16], [0, 1], clamp);
  const glow = interpolate(t, [buch - 0.1, buch + 0.5], [0.35, 1], clamp);
  const float = Math.sin(frame / 18) * 10;
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <g opacity={title} transform={`translate(0 ${(1 - title) * -30})`}>
          <rect x={466} y={330} width={148} height={46} rx={23} fill={look.accent2} />
          <text x={540} y={363} textAnchor="middle" fontFamily="Inter" fontWeight={800} fontSize={26} letterSpacing={5} fill="#1A0E06">
            QUEST
          </text>
          <text x={540} y={448} textAnchor="middle" fontFamily={look.label} fontWeight={700} fontSize={64} letterSpacing={3} fill={look.text} style={{ textShadow: look.glow }}>
            {(s.title ?? "Die Messingplatten").toUpperCase()}
          </text>
        </g>
        <BrassPlates x={540} y={700 + float} w={260} glow={glow} />
        {[0, 1, 2].map((i) => {
          const pop = Math.min(1, Math.max(0, (t - drei - i * 0.16) * 5));
          const fail = i < 2 && t >= schief + i * 0.22;
          const failPop = interpolate(t, [schief + i * 0.22, schief + i * 0.22 + 0.25], [1.4, 1], clamp);
          const x = 222 + i * 318;
          const y = 1020;
          return (
            <g key={i} opacity={pop} transform={`translate(${x} ${y}) scale(${interpolate(pop, [0, 1], [0.6, 1]) * (fail ? failPop : 1)})`}>
              <rect x={-130} y={-80} width={260} height={160} rx={24} fill={fail ? "rgba(226,72,61,0.18)" : "rgba(10,8,18,0.75)"} stroke={fail ? RED : i === 2 ? GOLD : "rgba(255,244,226,0.4)"} strokeWidth={4} />
              <text x={0} y={-30} textAnchor="middle" fontFamily="Inter" fontWeight={800} fontSize={22} letterSpacing={3} fill={look.dim}>
                VERSUCH {i + 1}
              </text>
              <text x={0} y={52} textAnchor="middle" fontFamily="Anton" fontSize={84} fill={fail ? RED : i === 2 && t >= schief ? GOLD : look.text} opacity={i === 2 && t >= schief ? 0.6 + 0.4 * Math.sin(frame / 5) : 1}>
                {fail ? "✗" : "?"}
              </text>
            </g>
          );
        })}
      </svg>
      <Sfx frame={voiceFrame(ts, drei)} name="blip" volume={0.4} />
      <Sfx frame={voiceFrame(ts, schief)} name="glitch" volume={0.35} />
      <Sfx frame={voiceFrame(ts, buch)} name="chime" volume={0.45} />
    </AbsoluteFill>
  );
};

/** Der Auftrag: Quest-Karte mit Zelt in der Wildnis, Jerusalem und dem Ziel. */
const Brief: React.FC<{ ts: TimelineScene; s: QuestSceneT }> = ({ ts, s }) => {
  const look = useLook();
  const frame = useCurrentFrame();
  const t = useT(ts);
  const [schickt, platten, schriften] = beats(ts, s.cues, 3);
  const card = interpolate(frame, [0, 14], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const walk = interpolate(t, [schickt, schickt + 4.2], [0, 1], clamp);
  const marker = usePop(ts, platten, { damping: 9, stiffness: 200 });
  const label = usePop(ts, schriften);
  // Weg vom Zelt zum Tor
  const P0: [number, number] = [260, 990];
  const P1: [number, number] = [470, 1110];
  const P2: [number, number] = [742, 905];
  const pathAt = (k: number): [number, number] => {
    const u = 1 - k;
    return [u * u * P0[0] + 2 * u * k * P1[0] + k * k * P2[0], u * u * P0[1] + 2 * u * k * P1[1] + k * k * P2[1]];
  };
  const bounce = Math.abs(Math.sin(frame / 8)) * -14;
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <linearGradient id="qMapSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0B1030" />
            <stop offset="100%" stopColor="#2E2448" />
          </linearGradient>
          <linearGradient id="qMapSand" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8A6640" />
            <stop offset="100%" stopColor="#3E2A18" />
          </linearGradient>
        </defs>
        <g opacity={card} transform={`translate(540 760) scale(${interpolate(card, [0, 1], [0.92, 1])}) translate(-540 -760)`}>
          <rect x={60} y={300} width={960} height={880} rx={34} fill="url(#qMapSky)" stroke={GOLD} strokeOpacity={0.6} strokeWidth={4} />
          <clipPath id="qMapClip">
            <rect x={60} y={300} width={960} height={880} rx={34} />
          </clipPath>
          <g clipPath="url(#qMapClip)">
            {Array.from({ length: 50 }, (_, i) => (
              <circle key={i} cx={80 + random(`qs${i}`) * 920} cy={400 + random(`qsy${i}`) * 400} r={1 + random(`qsr${i}`) * 1.8} fill="#FFF" opacity={0.3 + 0.4 * Math.abs(Math.sin(frame / 20 + i))} />
            ))}
            <path d="M 60 880 Q 260 820 480 870 T 1020 850 L 1020 1180 L 60 1180 Z" fill="url(#qMapSand)" />
            <path d="M 60 960 Q 300 920 560 980 T 1020 960 L 1020 1180 L 60 1180 Z" fill="#2E1E10" opacity={0.45} />
            {/* Jerusalem */}
            <g>
              <rect x={570} y={680} width={430} height={230} fill="#4A3826" />
              {Array.from({ length: 9 }, (_, i) => (
                <rect key={i} x={570 + i * 48} y={662} width={28} height={22} fill="#4A3826" />
              ))}
              {[590, 690, 830, 930].map((tx, i) => (
                <g key={i}>
                  <rect x={tx} y={600 - (i % 2) * 50} width={58} height={310} fill="#5A4430" />
                  <path d={`M ${tx - 6} ${600 - (i % 2) * 50} l 35 -38 l 35 38 Z`} fill="#3A2A1C" />
                  <rect x={tx + 20} y={660 - (i % 2) * 50} width={18} height={28} rx={9} fill="#FFC36E" opacity={0.7 + 0.3 * Math.sin(frame / 9 + i)} />
                </g>
              ))}
              <path d="M 700 910 L 700 830 A 42 42 0 0 1 784 830 L 784 910 Z" fill="#1A1008" />
              <text x={880} y={966} textAnchor="middle" fontFamily={look.label} fontWeight={700} fontSize={34} letterSpacing={4} fill={look.text}>
                JERUSALEM
              </text>
            </g>
            {/* Zelt in der Wildnis */}
            <g>
              <path d="M 120 970 L 255 790 L 390 970 Z" fill="#B88A52" stroke="#3A2614" strokeWidth={5} />
              <path d="M 255 790 L 226 970 L 284 970 Z" fill="#2A1A0C" />
              {[0, 1, 2, 3].map((i) => (
                <line key={i} x1={150 + i * 30} y1={970 - (i + 1) * 36} x2={360 - i * 30} y2={970 - (i + 1) * 36} stroke="#7A5630" strokeWidth={5} />
              ))}
              <text x={235} y={1052} textAnchor="middle" fontFamily={look.label} fontWeight={700} fontSize={32} letterSpacing={4} fill={look.dim}>
                LAGER
              </text>
            </g>
            {/* Weg */}
            <path d={`M ${P0[0]} ${P0[1]} Q ${P1[0]} ${P1[1]} ${P2[0]} ${P2[1]}`} fill="none" stroke={GOLD} strokeWidth={6} strokeDasharray="16 16" opacity={0.25 + 0.75 * Math.min(1, walk * 3)} />
            {/* Die vier Söhne */}
            {[0, 1, 2, 3].map((i) => {
              const k = Math.max(0, walk - i * 0.06);
              const [px, py] = pathAt(Math.min(0.85, k));
              return k > 0 ? <Robed key={i} x={px - i * 8} y={py} k={0.34} rim={RIM} pose={{ step: frame / 3 + i }} shadow={false} /> : null;
            })}
            {/* Lehi am Zelt */}
            <Robed x={118} y={990} k={0.42} rim={RIM} pose={{ reach: interpolate(t, [schickt - 0.2, schickt + 0.3], [0, 1], clamp) }} shadow={false} />
            {/* Ziel über der Stadt */}
            {marker > 0.001 ? (
              <g transform={`translate(785 ${470 + bounce}) scale(${marker})`}>
                <circle r={84} fill="rgba(244,194,90,0.18)" stroke={GOLD} strokeWidth={4} />
                <BrassPlates x={0} y={0} w={74} glow={0.6} tilt={-4} />
                <circle cx={64} cy={-64} r={24} fill={RED} />
                <text x={64} y={-53} textAnchor="middle" fontFamily="Anton" fontSize={32} fill="#FFF">
                  !
                </text>
              </g>
            ) : null}
          </g>
        </g>
        {/* Ziel oben */}
        <g opacity={card}>
          <rect x={84} y={330} width={128} height={40} rx={20} fill={look.accent2} />
          <text x={148} y={359} textAnchor="middle" fontFamily="Inter" fontWeight={800} fontSize={22} letterSpacing={4} fill="#1A0E06">
            ZIEL
          </text>
          <text x={232} y={364} fontFamily={look.label} fontWeight={700} fontSize={40} fill={look.text} opacity={interpolate(t, [platten - 0.1, platten + 0.3], [0.35, 1], clamp)}>
            Die Messingplatten holen
          </text>
        </g>
      </svg>
      <div
        style={{
          position: "absolute",
          left: 120,
          right: 120,
          top: 1072,
          textAlign: "center",
          padding: "16px 20px",
          borderRadius: 18,
          background: "rgba(10,8,18,0.88)",
          border: `2px solid ${GOLD}`,
          fontFamily: look.label,
          fontWeight: 700,
          fontSize: 38,
          lineHeight: 1.2,
          color: GOLD,
          opacity: Math.min(1, label * 1.4),
          transform: `translateY(${(1 - label) * 20}px)`,
        }}
      >
        Die heiligen Schriften ihres Volkes
      </div>
      <Sfx frame={voiceFrame(ts, schickt)} name="swipe" volume={0.3} />
      <Sfx frame={voiceFrame(ts, platten)} name="coin" volume={0.45} />
      <Sfx frame={voiceFrame(ts, schriften)} name="chime" volume={0.35} />
    </AbsoluteFill>
  );
};

/** Versuch 1: Laman an der Tür – Laban schreit «Räuber!» und wirft ihn hinaus. */
const Ask: React.FC<{ ts: TimelineScene; s: QuestSceneT }> = ({ ts, s }) => {
  const t = useT(ts);
  const frame = useCurrentFrame();
  const [fragt, wuetend] = beats(ts, s.cues, 2);
  const out = beat(ts, s.attempts[0]?.at, ts.speechEndSec);
  const open = interpolate(t, [wuetend - 0.15, wuetend + 0.2], [0, 1], clamp);
  const rage = t >= wuetend - 0.15 ? 1 : 0;
  const bubble = usePop(ts, wuetend + 0.1, { damping: 9, stiffness: 240 });
  const thrown = interpolate(t, [out - 0.05, out + 0.6], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const shake = t > wuetend && t < wuetend + 0.4 ? Math.sin(frame * 2.3) * 7 : 0;
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <g transform={`translate(${shake} 0)`}>
          <LabanDoor open={open} rage={rage} />
        </g>
        <g transform={`translate(${-thrown * 260} ${-Math.sin(thrown * Math.PI) * 120}) rotate(${-thrown * 28} 300 ${GROUND})`} opacity={1 - thrown * 0.2}>
          <Robed x={300} y={GROUND} k={0.92} rim={RIM} pose={{ reach: interpolate(t, [fragt - 0.2, fragt + 0.3], [0, 0.8], clamp) * (1 - thrown) }} />
        </g>
      </svg>
      <Bubble x={640} y={520} text="RÄUBER!" pop={bubble * (1 - interpolate(t, [out + 0.4, out + 0.8], [0, 1], clamp))} tone="red" w={420} size={92} />
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <QuestLog ts={ts} s={s} current={0} />
        <ResultStamp ts={ts} s={s} y={800} />
      </svg>
      <Sfx frame={voiceFrame(ts, wuetend)} name="clash" volume={0.5} />
      <Sfx frame={voiceFrame(ts, out)} name="whoosh" volume={0.4} />
    </AbsoluteFill>
  );
};

/** Versuch 2: Gold und Silber – Laban will das Gold und schickt seine Diener. */
const Buy: React.FC<{ ts: TimelineScene; s: QuestSceneT }> = ({ ts, s }) => {
  const t = useT(ts);
  const [gold, will] = beats(ts, s.cues, 2);
  const kill = beat(ts, s.attempts[1]?.at, ts.speechEndSec);
  const show = interpolate(t, [gold - 0.2, gold + 0.3], [0, 1], clamp);
  const open = interpolate(t, [will - 0.2, will + 0.2], [0, 1], clamp);
  const pull = interpolate(t, [will, will + 1.1], [0, 1], clamp);
  const servants = interpolate(t, [kill - 0.9, kill + 0.6], [0, 1], clamp);
  const flee = interpolate(t, [kill - 0.4, kill + 0.9], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <LabanDoor open={open} rage={servants > 0 ? 1 : 0} />
        <Treasure show={show} pull={pull} />
        <Servants k={servants} />
        {[0, 1].map((i) => (
          <Robed key={i} x={170 + i * 110 - flee * 420} y={GROUND} k={0.85} dir={flee > 0 ? -1 : 1} rim={RIM} rimSide={-1} pose={flee > 0 ? { step: frame / 2.2 + i } : { reach: show * (i === 1 ? 0.6 : 0) }} />
        ))}
        <QuestLog ts={ts} s={s} current={1} />
        <ResultStamp ts={ts} s={s} y={780} />
      </svg>
      <Sfx frame={voiceFrame(ts, gold)} name="coin" volume={0.5} />
      <Sfx frame={voiceFrame(ts, will)} name="whoosh" volume={0.35} />
    </AbsoluteFill>
  );
};

/** Die älteren Brüder wenden sich ab, Nephi bleibt stehen. */
const Quit: React.FC<{ ts: TimelineScene; s: QuestSceneT }> = ({ ts, s }) => {
  const frame = useCurrentFrame();
  const t = useT(ts);
  const [aufgeben, sagt] = beats(ts, s.cues, 2);
  const turn = interpolate(t, [aufgeben - 0.1, aufgeben + 1.6], [0, 1], clamp);
  const light = interpolate(t, [sagt - 0.3, sagt + 0.4], [0, 1], clamp);
  const bubble = usePop(ts, s.say ? beat(ts, s.say.at, sagt + 0.4) - 0.1 : 1e5);
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id="qNephiLight">
            <stop offset="0%" stopColor="#FFD58A" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#FFD58A" stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* Die beiden Älteren gehen nach links davon */}
        {[0, 1].map((i) => (
          <Robed
            key={i}
            x={340 - i * 120 - turn * (220 + i * 60)}
            y={GROUND}
            k={0.95}
            dir={turn > 0.05 ? -1 : 1}
            rim="#8A90B8"
            rimSide={-1}
            o={1 - turn * 0.55}
            pose={turn > 0.05 ? { step: frame / 3.4 + i * 1.7, bow: 0.4 } : { bow: 0.5 }}
          />
        ))}
        <circle cx={720} cy={GROUND - 170} r={260} fill="url(#qNephiLight)" opacity={light} />
        <Robed x={720} y={GROUND} k={1} rim={GOLD} pose={{ reach: light * 0.35 }} />
        <text x={720} y={GROUND + 52} textAnchor="middle" fontFamily="Cinzel" fontWeight={700} fontSize={30} letterSpacing={4} fill={GOLD} opacity={light}>
          NEPHI
        </text>
        <QuestLog ts={ts} s={s} current={2} />
      </svg>
      {s.say ? <Bubble x={640} y={520} text={s.say.text} pop={bubble} tone="gold" w={660} size={50} /> : null}
      <Sfx frame={voiceFrame(ts, aufgeben)} name="swipe" volume={0.25} />
      {s.say ? <Sfx frame={voiceFrame(ts, beat(ts, s.say.at, sagt))} name="drum" volume={0.45} /> : null}
    </AbsoluteFill>
  );
};

/** Versuch 3: Nachts schleicht Nephi allein in die Stadt – ein Licht geht ihm voraus. */
const Night: React.FC<{ ts: TimelineScene; s: QuestSceneT }> = ({ ts, s }) => {
  const frame = useCurrentFrame();
  const t = useT(ts);
  const [nacht, allein, geist] = beats(ts, s.cues, 3);
  const dark = interpolate(t, [nacht - 0.3, nacht + 0.6], [0.15, 0.55], clamp);
  const walk = interpolate(t, [allein - 0.3, ts.speechEndSec + 0.6], [0, 1], clamp);
  const guide = interpolate(t, [geist - 0.2, geist + 0.8], [0, 1], clamp);
  const nx = 170 + walk * 470;
  const lead = nx + 190;
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id="qGuide">
            <stop offset="0%" stopColor="#FFF4D0" stopOpacity="0.95" />
            <stop offset="30%" stopColor="#FFD58A" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#FFD58A" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="qPath" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#FFD58A" stopOpacity="0" />
            <stop offset="100%" stopColor="#FFD58A" stopOpacity="0.55" />
          </linearGradient>
        </defs>
        <rect x={0} y={0} width={1080} height={1920} fill="#050818" opacity={dark} />
        {/* Gasse: Boden und ein Torbogen der Stadt */}
        <rect x={0} y={GROUND} width={1080} height={120} fill="#1A120C" />
        <path d={`M 860 ${GROUND} L 860 760 A 110 110 0 0 1 1080 760 L 1080 ${GROUND} Z`} fill="#0A0604" stroke="#3A2A1C" strokeWidth={8} />
        {/* Das Licht, das führt: ein Schein auf dem Weg voraus */}
        <rect x={nx} y={GROUND - 8} width={Math.max(0, (lead - nx) * guide + 120 * guide)} height={14} rx={7} fill="url(#qPath)" opacity={guide} />
        <circle cx={lead} cy={GROUND - 260 + Math.sin(frame / 14) * 12} r={150} fill="url(#qGuide)" opacity={guide} />
        <circle cx={lead} cy={GROUND - 260 + Math.sin(frame / 14) * 12} r={10} fill="#FFFBEA" opacity={guide * 0.9} />
        <Robed x={nx} y={GROUND} k={0.98} rim={guide > 0 ? GOLD : "#6E78A8"} pose={walk > 0 && walk < 1 ? { step: frame / 4.2, bow: 0.2 } : { bow: 0.2 }} />
        <QuestLog ts={ts} s={s} current={2} />
      </svg>
      <Sfx frame={voiceFrame(ts, allein)} name="swipe" volume={0.25} />
      <Sfx frame={voiceFrame(ts, geist)} name="chime" volume={0.45} />
    </AbsoluteFill>
  );
};

/** Geschafft: die Platten gross, der Stempel, dazu ihr Wert. */
const Done: React.FC<{ ts: TimelineScene; s: QuestSceneT }> = ({ ts, s }) => {
  const look = useLook();
  const frame = useCurrentFrame();
  const t = useT(ts);
  const back = beat(ts, s.attempts[2]?.at, 0.3);
  const [wert] = beats(ts, s.cues, 1);
  const rise = interpolate(frame, [2, 22], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.4)) });
  const card = usePop(ts, wert - 0.1);
  const rays = interpolate(t, [back, back + 0.8], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <g opacity={rays}>
          {Array.from({ length: 16 }, (_, i) => {
            const a = (i / 16) * Math.PI * 2 + frame / 80;
            return (
              <path
                key={i}
                d={`M ${540 + Math.cos(a - 0.06) * 120} ${700 + Math.sin(a - 0.06) * 120} L ${540 + Math.cos(a) * 560} ${700 + Math.sin(a) * 560} L ${540 + Math.cos(a + 0.06) * 120} ${700 + Math.sin(a + 0.06) * 120} Z`}
                fill="#FFE29A"
                opacity={0.09}
              />
            );
          })}
        </g>
        <g transform={`translate(0 ${(1 - rise) * 160})`} opacity={Math.min(1, rise * 1.5)}>
          <BrassPlates x={540} y={700 + Math.sin(frame / 18) * 8} w={290} glow={0.5 + 0.5 * rays} />
        </g>
        <ResultStamp ts={ts} s={s} y={900} />
        <g opacity={Math.min(1, card * 1.4)} transform={`translate(540 1060) scale(${interpolate(card, [0, 1], [0.7, 1])})`}>
          <rect x={-330} y={-62} width={660} height={124} rx={22} fill="rgba(10,8,18,0.85)" stroke={GOLD} strokeWidth={4} />
          <text x={-290} y={-12} fontFamily="Inter" fontWeight={800} fontSize={22} letterSpacing={4} fill={look.dim}>
            WERT
          </text>
          <text x={-290} y={36} fontFamily={look.label} fontWeight={700} fontSize={44} fill={GOLD}>
            unbezahlbar
          </text>
          {Array.from({ length: 5 }, (_, i) => {
            const on = interpolate(t, [wert + i * 0.1, wert + i * 0.1 + 0.15], [0, 1], clamp);
            return (
              <text key={i} x={70 + i * 52} y={22} textAnchor="middle" fontSize={48} fill={GOLD} opacity={0.25 + 0.75 * on} transform={`translate(0 0)`}>
                ★
              </text>
            );
          })}
        </g>
        <QuestLog ts={ts} s={s} current={2} />
      </svg>
      <Sfx frame={voiceFrame(ts, wert)} name="coin" volume={0.45} />
    </AbsoluteFill>
  );
};

/** Mit und ohne Schriften: Lehis Volk und das Volk von Zarahemla. */
const Contrast: React.FC<{ ts: TimelineScene; s: QuestSceneT }> = ({ ts, s }) => {
  const look = useLook();
  const frame = useCurrentFrame();
  const t = useT(ts);
  const [warum, ohne, sprache, schoepfer] = beats(ts, s.cues, 4);
  const later = beat(ts, "Jahrhunderte danach", sprache - 0.6);
  const head = usePop(ts, warum - 0.1);
  const left = interpolate(t, [warum + 0.2, warum + 0.7], [0, 1], clamp);
  const right = interpolate(t, [ohne - 1.2, ohne - 0.4], [0, 1], clamp);
  const decay = interpolate(t, [sprache - 0.1, sprache + 1.2], [0, 1], clamp);
  const out = interpolate(t, [schoepfer - 0.1, schoepfer + 0.8], [0, 1], clamp);
  const years = usePop(ts, later - 0.1);
  const col = (x: number, o: number, title: string, sub: string, good: boolean) => (
    <g opacity={o} transform={`translate(0 ${(1 - o) * 30})`}>
      <rect x={x - 230} y={470} width={460} height={690} rx={30} fill={good ? "rgba(34,24,12,0.92)" : "rgba(14,16,30,0.92)"} stroke={good ? GOLD : "rgba(160,170,210,0.4)"} strokeWidth={3} />
      <text x={x} y={530} textAnchor="middle" fontFamily={look.label} fontWeight={700} fontSize={34} letterSpacing={2} fill={good ? GOLD : "#B9C0DE"}>
        {title}
      </text>
      <text x={x} y={570} textAnchor="middle" fontFamily="Inter" fontWeight={700} fontSize={24} letterSpacing={1} fill={look.dim}>
        {sub}
      </text>
    </g>
  );
  /** Ein Wort, das hält – oder dessen Buchstaben zerfallen. */
  const word = (x: number, y: number, text: string, k: number, seed: string, color: string) => (
    <g>
      {text.split("").map((ch, i) => {
        const n = text.length;
        const cx = x + (i - (n - 1) / 2) * 40;
        const dx = (random(`${seed}x${i}`) - 0.5) * 60 * k;
        const dy = random(`${seed}y${i}`) * 70 * k * k;
        const rot = (random(`${seed}r${i}`) - 0.5) * 140 * k;
        return (
          <text key={i} x={cx + dx} y={y + dy} textAnchor="middle" fontFamily="Anton" fontSize={58} fill={color} opacity={1 - k * 0.75} transform={`rotate(${rot} ${cx + dx} ${y + dy - 20})`}>
            {ch}
          </text>
        );
      })}
    </g>
  );
  const flame = (x: number, y: number, k: number) => {
    const w = (a: number, b: number) => Math.sin(frame / a) * b;
    return (
      <g opacity={1 - k} transform={`translate(${x} ${y}) scale(${1 - k * 0.6})`}>
        <circle r={70} fill="#FFB45C" opacity={0.18} />
        <path d={`M -22 30 C -30 -6, ${-6 + w(5, 5)} -30, ${w(4, 6)} -76 C ${10 + w(6, 4)} -32, 30 -8, 22 30 Z`} fill="#FF8A2B" />
        <path d={`M -10 28 C -14 8, ${w(3, 3)} -12, ${w(5, 4)} -40 C 8 -12, 14 8, 10 28 Z`} fill="#FFE08A" />
        <rect x={-26} y={30} width={52} height={16} rx={6} fill="#5A3A1E" />
      </g>
    );
  };
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <g opacity={Math.min(1, head * 1.4)} transform={`translate(540 390) scale(${interpolate(head, [0, 1], [1.4, 1])})`}>
          <text x={0} y={0} textAnchor="middle" fontFamily="Anton" fontSize={120} letterSpacing={4} fill={look.text} style={{ textShadow: look.glow }}>
            WARUM?
          </text>
        </g>
        {col(290, left, "LEHIS VOLK", "mit den Platten", true)}
        {col(790, right, "VOLK VON ZARAHEMLA", "ohne Aufzeichnungen", false)}
        <g opacity={left}>
          <BrassPlates x={290} y={720} w={130} glow={0.7} />
          {flame(290, 900, 0)}
          {word(290, 1060, "SPRACHE", 0, "l", look.text)}
          {word(290, 1130, "GLAUBE", 0, "lg", GOLD)}
        </g>
        <g opacity={right}>
          {/* Wo die Platten wären: nur ein Umriss */}
          <rect x={725} y={640} width={130} height={162} rx={6} fill="none" stroke="rgba(185,192,222,0.5)" strokeWidth={4} strokeDasharray="12 10" transform="rotate(-6 790 720)" />
          {flame(790, 900, out)}
          {out > 0 ? (
            <g opacity={out * (1 - interpolate(t, [schoepfer + 0.8, schoepfer + 2.4], [0, 1], clamp))}>
              {[0, 1, 2].map((i) => (
                <circle key={i} cx={790 + Math.sin(frame / 9 + i) * 14} cy={860 - out * 80 - i * 36} r={16 + i * 6} fill="#8A90A8" opacity={0.3} />
              ))}
            </g>
          ) : null}
          {word(790, 1060, "SPRACHE", decay, "r", "#B9C0DE")}
          {word(790, 1130, "GLAUBE", out, "rg", "#B9C0DE")}
          <g opacity={Math.min(1, years * 1.4)} transform={`translate(790 610) scale(${interpolate(years, [0, 1], [0.6, 1])})`}>
            <rect x={-190} y={-26} width={380} height={52} rx={26} fill="rgba(226,72,61,0.2)" stroke={RED} strokeWidth={3} />
            <text x={0} y={10} textAnchor="middle" fontFamily="Inter" fontWeight={800} fontSize={24} letterSpacing={3} fill="#FFB0A8">
              JAHRHUNDERTE SPÄTER
            </text>
          </g>
        </g>
      </svg>
      <Sfx frame={voiceFrame(ts, warum)} name="drum" volume={0.45} keep />
      <Sfx frame={voiceFrame(ts, sprache)} name="glitch" volume={0.35} />
      <Sfx frame={voiceFrame(ts, schoepfer)} name="whoosh" volume={0.35} />
    </AbsoluteFill>
  );
};

export const Scene: React.FC<{ ts: TimelineScene }> = ({ ts }) => {
  const s = ts.scene as QuestSceneT;
  switch (s.stage) {
    case "intro":
      return <Intro ts={ts} s={s} />;
    case "brief":
      return <Brief ts={ts} s={s} />;
    case "ask":
      return <Ask ts={ts} s={s} />;
    case "buy":
      return <Buy ts={ts} s={s} />;
    case "quit":
      return <Quit ts={ts} s={s} />;
    case "night":
      return <Night ts={ts} s={s} />;
    case "done":
      return <Done ts={ts} s={s} />;
    case "contrast":
      return <Contrast ts={ts} s={s} />;
  }
};

/** Die Sprechblase (quit) und das Schild zum Ziel (brief) lesen sich selbst. */
export const hidden = (ts: TimelineScene): Set<number> => {
  const s = ts.scene as QuestSceneT;
  return wordsOfTexts(ts, [s.say?.text, s.stage === "brief" ? "die heiligen Schriften ihres Volkes" : undefined]);
};

