import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame } from "remotion";
import { FPS, HEIGHT, WIDTH } from "../lib/timing";

/*
 * Durchgehende Hintergründe der Looks. Sie liegen wie der Himmel ausserhalb der
 * Szenen-Überblendungen, damit die Welt eines Videos ruhig stehen bleibt.
 */

const Vignette: React.FC<{ strength?: number }> = ({ strength = 0.55 }) => (
  <AbsoluteFill
    style={{ background: `radial-gradient(ellipse 85% 70% at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,${strength}) 100%)` }}
  />
);

/* ---------------- Arcade: Synthwave-Sonne über Neon-Raster ---------------- */

export const ArcadeBg: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const H = 1610; // Horizont – tief, damit die Sonne nicht hinter den Untertiteln steht
  const vx = WIDTH / 2;
  const stars = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => ({
        x: random(`as${i}`) * WIDTH,
        y: random(`ay${i}`) * (H - 300),
        r: 1 + random(`ar${i}`) * 2.2,
        p: random(`ap${i}`) * 6.28,
      })),
    [],
  );
  const scroll = (t * 0.55) % 1;
  const rows = Array.from({ length: 18 }, (_, k) => {
    const z = (k + 1 - scroll) * 0.55;
    return H + 210 / z;
  }).filter((y) => y < HEIGHT + 4);
  const sunY = H - 40;
  return (
    <AbsoluteFill style={{ background: "linear-gradient(to bottom, #07021A 0%, #1A0838 45%, #3D0C55 74%, #6A1468 83.8%, #12051F 83.9%, #0A0316 100%)" }}>
      <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <linearGradient id="arcSun" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFE66D" />
            <stop offset="55%" stopColor="#FF8A5B" />
            <stop offset="100%" stopColor="#FF3FB4" />
          </linearGradient>
          <radialGradient id="arcGlow">
            <stop offset="0%" stopColor="#FF4FD8" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#FF4FD8" stopOpacity="0" />
          </radialGradient>
          <mask id="arcStripes">
            <rect x={0} y={0} width={WIDTH} height={HEIGHT} fill="white" />
            {Array.from({ length: 7 }, (_, i) => {
              const y = sunY - 120 + i * 30 - ((t * 14) % 30);
              return <rect key={i} x={0} y={y} width={WIDTH} height={6 + i * 2.2} fill="black" />;
            })}
          </mask>
          <linearGradient id="arcFade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5CF3FF" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#5CF3FF" stopOpacity="0.9" />
          </linearGradient>
        </defs>
        {stars.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#FFFFFF" opacity={0.25 + 0.5 * (0.5 + 0.5 * Math.sin(t * 2 + s.p))} />
        ))}
        <circle cx={vx} cy={sunY} r={620} fill="url(#arcGlow)" />
        <circle cx={vx} cy={sunY} r={200} fill="url(#arcSun)" mask="url(#arcStripes)" />
        {/* Bergkette mit Neonkante */}
        <path
          d={`M0 ${H} L 90 ${H - 90} L 180 ${H - 40} L 290 ${H - 160} L 400 ${H - 60} L 470 ${H - 105} L 540 ${H - 30} L 640 ${H - 130} L 760 ${H - 50} L 860 ${H - 175} L 970 ${H - 70} L ${WIDTH} ${H - 120} L ${WIDTH} ${H} Z`}
          fill="#14062A"
          stroke="#5CF3FF"
          strokeWidth={3}
          strokeOpacity={0.7}
        />
        <rect x={0} y={H} width={WIDTH} height={HEIGHT - H} fill="#0A0316" />
        {/* Raster */}
        <g stroke="#FF4FD8" strokeWidth={3} opacity={0.85} style={{ filter: "drop-shadow(0 0 6px #FF4FD8)" }}>
          {Array.from({ length: 23 }, (_, i) => {
            const k = i - 11;
            return <line key={`v${i}`} x1={vx + k * 18} y1={H} x2={vx + k * 210} y2={HEIGHT} />;
          })}
          {rows.map((y, i) => (
            <line key={`h${i}`} x1={0} y1={y} x2={WIDTH} y2={y} strokeOpacity={interpolate(y, [H, H + 120, HEIGHT], [0.2, 0.7, 1])} />
          ))}
        </g>
        <line x1={0} y1={H} x2={WIDTH} y2={H} stroke="url(#arcFade)" strokeWidth={4} />
      </svg>
      {/* Bildschirmzeilen wie bei einem alten Monitor */}
      <AbsoluteFill style={{ backgroundImage: "repeating-linear-gradient(0deg, rgba(0,0,0,0.16) 0px, rgba(0,0,0,0.16) 2px, rgba(0,0,0,0) 2px, rgba(0,0,0,0) 6px)" }} />
      <Vignette strength={0.6} />
    </AbsoluteFill>
  );
};

/* ---------------- Chat: weiche Lichter hinter dem Handy ---------------- */

export const ChatBg: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const blobs = useMemo(
    () =>
      Array.from({ length: 13 }, (_, i) => ({
        x: random(`cx${i}`) * WIDTH,
        y: random(`cy${i}`) * HEIGHT,
        r: 120 + random(`cr${i}`) * 260,
        c: ["94,234,212", "167,139,250", "255,211,110", "96,165,250"][i % 4],
        o: 0.1 + random(`co${i}`) * 0.18,
        v: 8 + random(`cv${i}`) * 16,
        p: random(`cp${i}`) * 6.28,
      })),
    [],
  );
  return (
    <AbsoluteFill style={{ background: "linear-gradient(160deg, #0B1124 0%, #12224A 48%, #1C2E5A 72%, #0C1630 100%)" }}>
      {blobs.map((b, i) => {
        const x = b.x + Math.sin(t * 0.25 + b.p) * b.v * 4;
        const y = b.y + Math.cos(t * 0.2 + b.p) * b.v * 3;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x - b.r,
              top: y - b.r,
              width: b.r * 2,
              height: b.r * 2,
              borderRadius: "50%",
              background: `radial-gradient(circle, rgba(${b.c},${b.o}) 0%, rgba(${b.c},0) 70%)`,
            }}
          />
        );
      })}
      <Vignette strength={0.5} />
    </AbsoluteFill>
  );
};

/* ---------------- Karte: dunkler Holztisch im Lampenlicht ---------------- */

export const MapBg: React.FC = () => {
  const frame = useCurrentFrame();
  const flicker = 0.92 + 0.05 * Math.sin(frame / 5.3) + 0.03 * Math.sin(frame / 2.1);
  const planks = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => ({
        y: i * 230 + random(`pl${i}`) * 30,
        tone: random(`pt${i}`) * 0.08,
        grain: Array.from({ length: 5 }, (_, k) => ({
          y: random(`pg${i}-${k}`) * 200,
          a: random(`pa${i}-${k}`) * 40 - 20,
        })),
      })),
    [],
  );
  return (
    <AbsoluteFill style={{ background: "#120D08" }}>
      <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", inset: 0 }}>
        {planks.map((p, i) => (
          <g key={i}>
            <rect x={0} y={p.y} width={WIDTH} height={226} fill={`rgba(${70 + p.tone * 400},${46 + p.tone * 250},${24},0.55)`} />
            <rect x={0} y={p.y + 226} width={WIDTH} height={4} fill="rgba(0,0,0,0.55)" />
            {p.grain.map((g, k) => (
              <path
                key={k}
                d={`M0 ${p.y + g.y} C 300 ${p.y + g.y + g.a}, 700 ${p.y + g.y - g.a}, ${WIDTH} ${p.y + g.y + g.a * 0.5}`}
                stroke="rgba(0,0,0,0.22)"
                strokeWidth={2}
                fill="none"
              />
            ))}
          </g>
        ))}
      </svg>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 70% 45% at 50% 38%, rgba(255,196,110,${0.28 * flicker}) 0%, rgba(255,160,80,${0.08 * flicker}) 55%, rgba(0,0,0,0) 100%)`,
        }}
      />
      <Vignette strength={0.75} />
    </AbsoluteFill>
  );
};

/* ---------------- Stadion in der Abenddämmerung ---------------- */

/** Oberkante der Laufbahn – darauf laufen die Figuren der Staffel-Szenen. */
export const TRACK_TOP = 1130;

export const TrackBg: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const H = TRACK_TOP;
  const crowd = useMemo(
    () =>
      Array.from({ length: 240 }, (_, i) => ({
        x: random(`tx${i}`) * WIDTH,
        y: 935 + random(`ty${i}`) * 180,
        c: ["#FFB347", "#FFFFFF", "#7DD3FC", "#F472B6"][i % 4],
        p: random(`tp${i}`) * 6.28,
      })),
    [],
  );
  const tower = (x: number, flip: number) => (
    <g key={x}>
      {/* Lichtmasten hoch oben, damit grosse Zeilen darunter frei stehen */}
      <rect x={x - 6} y={300} width={12} height={640} fill="#120A1E" />
      <rect x={x - 70} y={240} width={140} height={60} rx={8} fill="#1D1230" />
      {Array.from({ length: 8 }, (_, i) => (
        <circle key={i} cx={x - 56 + (i % 4) * 37} cy={255 + Math.floor(i / 4) * 30} r={11} fill="#FFF6D8" />
      ))}
      <ellipse cx={x} cy={270} rx={240} ry={130} fill="url(#flare)" opacity={0.8 + 0.1 * Math.sin(t * 3 + flip)} />
    </g>
  );
  return (
    <AbsoluteFill style={{ background: "linear-gradient(to bottom, #120E33 0%, #2B1650 25%, #6E2A62 40%, #D45E52 47%, #F59A57 48.6%, #2A1530 48.7%, #1A0F24 100%)" }}>
      <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id="flare">
            <stop offset="0%" stopColor="#FFF4D0" stopOpacity="0.9" />
            <stop offset="30%" stopColor="#FFD58A" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#FFB347" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="lane" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#B24A33" />
            <stop offset="100%" stopColor="#7E2E22" />
          </linearGradient>
        </defs>
        {/* Tribüne */}
        <path d={`M0 920 L ${WIDTH} 920 L ${WIDTH} ${H} L 0 ${H} Z`} fill="#1E1230" />
        <path d={`M0 920 L ${WIDTH} 920`} stroke="#3B2556" strokeWidth={6} />
        {crowd.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r={3} fill={c.c} opacity={0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t * 4 + c.p))} />
        ))}
        {tower(120, 0)}
        {tower(WIDTH - 120, 2)}
        {/* Bahn: oben die Linie, auf der gelaufen wird, nach unten in die Tiefe */}
        <path d={`M0 ${H} L ${WIDTH} ${H} L ${WIDTH} ${HEIGHT} L 0 ${HEIGHT} Z`} fill="url(#lane)" />
        {[0, 1, 2, 3, 4].map((k) => {
          const y = H + 50 + k * k * 34 + k * 40;
          return <rect key={k} x={0} y={y} width={WIDTH} height={4 + k * 1.5} fill="#FFFFFF" opacity={0.55} />;
        })}
        <rect x={0} y={H - 4} width={WIDTH} height={6} fill="#FFFFFF" opacity={0.85} />
      </svg>
      {/* Dunkler Streifen hinter den Untertiteln */}
      <AbsoluteFill style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0) 62%, rgba(10,5,20,0.45) 68%, rgba(10,5,20,0.45) 76%, rgba(0,0,0,0) 82%)" }} />
      <Vignette strength={0.5} />
    </AbsoluteFill>
  );
};

/* ---------------- Detektiv: Licht durch die Jalousie ---------------- */

export const NoirBg: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const dust = useMemo(
    () => Array.from({ length: 50 }, (_, i) => ({ x: random(`nx${i}`) * WIDTH, y: random(`ny${i}`) * HEIGHT, r: 1 + random(`nr${i}`) * 2.4, v: 6 + random(`nv${i}`) * 14, p: random(`np${i}`) * 6.28 })),
    [],
  );
  const slide = Math.sin(t * 0.25) * 30;
  return (
    <AbsoluteFill style={{ background: "radial-gradient(ellipse 90% 70% at 60% 30%, #2A2420 0%, #141114 55%, #08070A 100%)" }}>
      <AbsoluteFill style={{ transform: `rotate(-24deg) translateX(${slide}px) scale(1.6)` }}>
        {Array.from({ length: 9 }, (_, i) => (
          <div key={i} style={{ position: "absolute", left: 0, right: 0, top: 380 + i * 92, height: 46, background: "linear-gradient(90deg, rgba(255,214,150,0) 10%, rgba(255,214,150,0.05) 45%, rgba(255,214,150,0.015) 80%)" }} />
        ))}
      </AbsoluteFill>
      <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", inset: 0 }}>
        {dust.map((d, i) => (
          <circle key={i} cx={d.x + Math.sin(t * 0.5 + d.p) * 20} cy={(((d.y - d.v * t) % HEIGHT) + HEIGHT) % HEIGHT} r={d.r} fill="#FFE2B0" opacity={0.18 + 0.15 * Math.sin(t + d.p)} />
        ))}
      </svg>
      <Vignette strength={0.8} />
    </AbsoluteFill>
  );
};

/* ---------------- Quizshow: Studio mit Scheinwerfern ---------------- */

export const ShowBg: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const beams = [
    { x: 160, c: "57,213,255", p: 0 },
    { x: 400, c: "255,228,92", p: 1.7 },
    { x: 680, c: "255,92,190", p: 3.1 },
    { x: 920, c: "57,213,255", p: 4.4 },
  ];
  return (
    <AbsoluteFill style={{ background: "linear-gradient(to bottom, #0B0630 0%, #1B0B4A 45%, #2A0E5A 70%, #0A0420 100%)" }}>
      <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", inset: 0 }}>
        <defs>
          {beams.map((b, i) => (
            <linearGradient key={i} id={`beam${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={`rgb(${b.c})`} stopOpacity="0.2" />
              <stop offset="100%" stopColor={`rgb(${b.c})`} stopOpacity="0" />
            </linearGradient>
          ))}
          <radialGradient id="stageGlow">
            <stop offset="0%" stopColor="#FFE45C" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#FFE45C" stopOpacity="0" />
          </radialGradient>
        </defs>
        {beams.map((b, i) => {
          const a = Math.sin(t * 0.6 + b.p) * 18;
          return <path key={i} d={`M ${b.x - 18} 0 L ${b.x + 18} 0 L ${b.x + 260} 1900 L ${b.x - 260} 1900 Z`} fill={`url(#beam${i})`} transform={`rotate(${a} ${b.x} 0)`} style={{ mixBlendMode: "screen" }} />;
        })}
        {/* Bühne mit Leuchtkante */}
        <ellipse cx={540} cy={1640} rx={720} ry={170} fill="url(#stageGlow)" />
        <path d="M -40 1560 Q 540 1480 1120 1560 L 1120 1920 L -40 1920 Z" fill="#12082E" />
        <path d="M -40 1560 Q 540 1480 1120 1560" stroke="#FFE45C" strokeWidth={6} fill="none" opacity={0.8} />
        {/* Lauflichter oben */}
        {Array.from({ length: 22 }, (_, i) => {
          const on = (Math.floor(t * 6) + i) % 3 === 0;
          return <circle key={i} cx={30 + i * 49} cy={232} r={9} fill={on ? "#FFE45C" : "#5B4A20"} opacity={on ? 1 : 0.6} style={on ? { filter: "drop-shadow(0 0 8px #FFE45C)" } : undefined} />;
        })}
      </svg>
      <Vignette strength={0.55} />
    </AbsoluteFill>
  );
};

/* ---------------- Schreibtisch mit Schneidematte ---------------- */

export const JournalBg: React.FC = () => {
  const frame = useCurrentFrame();
  const flicker = 0.95 + 0.05 * Math.sin(frame / 9);
  return (
    <AbsoluteFill style={{ background: "linear-gradient(160deg, #123036 0%, #0D2328 55%, #081619 100%)" }}>
      <AbsoluteFill
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.05) 2px, transparent 2px), linear-gradient(90deg, rgba(255,255,255,0.05) 2px, transparent 2px), linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
          backgroundSize: "180px 180px, 180px 180px, 36px 36px, 36px 36px",
        }}
      />
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 70% 50% at 25% 15%, rgba(255,214,140,${0.22 * flicker}) 0%, rgba(255,214,140,0) 70%)` }} />
      <Vignette strength={0.6} />
    </AbsoluteFill>
  );
};
