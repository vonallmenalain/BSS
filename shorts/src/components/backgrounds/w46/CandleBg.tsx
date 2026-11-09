import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";

/*
 * Farmhaus 1829 bei Kerzenlicht (Oliver Cowdery, LuB 6): eine Wand aus dunklen Holzbohlen, oben
 * links ein Sprossenfenster mit Mond. Draussen schneit es – über die Folge hinweg wird aus dem
 * Winter 1828 der Frühling 1829: Der Schnee hört auf, die Eisblumen schmelzen, am Zweig vor dem
 * Fenster kommen Knospen. Unten rechts flackert eine Kerze, ihr Licht wärmt die Wand.
 *
 * Der Hintergrund kennt nur den Fortschritt der Folge (Frame / Länge). Was im Raum steht – Bett,
 * Tisch, Figuren –, zeichnet die Szene davor; manche Etappen (Haus im Schnee, Karte) decken ihn
 * ganz zu.
 */

/** Das Fenster – die Szenen richten Mondlicht und Möbel danach aus. */
export const CANDLE_WINDOW = { x: 96, y: 330, w: 308, h: 430 } as const;

const smooth = (a: number, b: number, x: number) => {
  const k = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

export const CandleBg: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = frame / Math.max(1, durationInFrames);
  /* Winter → Frühling: ab gut einem Drittel der Folge */
  const spring = smooth(0.4, 0.55, p);
  const snow = 1 - spring;
  const fl = 0.86 + 0.08 * Math.sin(frame / 2.9) + 0.06 * Math.sin(frame / 5.1 + 1) + 0.03 * Math.sin(frame / 1.7);
  const W = CANDLE_WINDOW;

  const flakes = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => ({
        x: random(`cbx${i}`) * W.w,
        y: random(`cby${i}`) * W.h,
        r: 1.6 + random(`cbr${i}`) * 2.6,
        v: 0.9 + random(`cbv${i}`) * 1.4,
        ph: random(`cbp${i}`) * 6.28,
      })),
    [W.w, W.h],
  );
  const stars = useMemo(
    () => Array.from({ length: 26 }, (_, i) => ({ x: 14 + random(`cbs${i}`) * (W.w - 28), y: 14 + random(`cbt${i}`) * (W.h * 0.6), r: 1 + random(`cbq${i}`) * 1.8, ph: random(`cbw${i}`) * 6 })),
    [W.w, W.h],
  );
  const planks = useMemo(() => Array.from({ length: 22 }, (_, i) => ({ y: i * 92 - 20 + random(`pk${i}`) * 8, knot: random(`kn${i}`) })), []);

  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <linearGradient id="cbWall" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#140C08" />
            <stop offset="45%" stopColor="#24160E" />
            <stop offset="100%" stopColor="#0E0805" />
          </linearGradient>
          <linearGradient id="cbSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={spring > 0.5 ? "#101C46" : "#070C24"} />
            <stop offset="100%" stopColor={spring > 0.5 ? "#2E3A6E" : "#1A2450"} />
          </linearGradient>
          <radialGradient id="cbCandle" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#FFC27A" stopOpacity="0.42" />
            <stop offset="45%" stopColor="#E08A40" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#E08A40" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="cbBeam" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#AFC6FF" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#AFC6FF" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="cbVig" cx="0.5" cy="0.45" r="0.75">
            <stop offset="55%" stopColor="#000" stopOpacity="0" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.7" />
          </radialGradient>
          <clipPath id="cbWin">
            <rect x={W.x} y={W.y} width={W.w} height={W.h} />
          </clipPath>
        </defs>

        {/* Wand aus Bohlen */}
        <rect x={0} y={0} width={1080} height={1920} fill="url(#cbWall)" />
        {planks.map((pl, i) => (
          <g key={i}>
            <rect x={0} y={pl.y} width={1080} height={4} fill="#000" opacity={0.45} />
            <rect x={0} y={pl.y + 4} width={1080} height={2} fill="#6A4A30" opacity={0.18} />
            <ellipse cx={120 + pl.knot * 840} cy={pl.y + 46} rx={16} ry={7} fill="#0A0604" opacity={0.35} />
          </g>
        ))}

        {/* Mondlicht fällt schräg in den Raum */}
        <path d={`M ${W.x} ${W.y + W.h} L ${W.x + W.w} ${W.y + W.h} L 1080 1560 L 520 1700 Z`} fill="url(#cbBeam)" opacity={0.9} />

        {/* Fenster */}
        <rect x={W.x - 22} y={W.y - 22} width={W.w + 44} height={W.h + 44} fill="#1A0F08" />
        <rect x={W.x - 22} y={W.y - 22} width={W.w + 44} height={W.h + 44} fill="none" stroke="#5A3A22" strokeWidth={6} opacity={0.5} />
        <g clipPath="url(#cbWin)">
          <rect x={W.x} y={W.y} width={W.w} height={W.h} fill="url(#cbSky)" />
          {stars.map((st, i) => (
            <circle key={i} cx={W.x + st.x} cy={W.y + st.y} r={st.r} fill="#F2F0FF" opacity={0.35 + 0.35 * Math.sin(frame / 14 + st.ph)} />
          ))}
          {/* Mond */}
          <circle cx={W.x + W.w * 0.7} cy={W.y + 110} r={70} fill="#DDE6FF" opacity={0.12} />
          <circle cx={W.x + W.w * 0.7} cy={W.y + 110} r={42} fill="#EEF2FF" />
          <circle cx={W.x + W.w * 0.7 + 12} cy={W.y + 100} r={8} fill="#CBD4EE" opacity={0.6} />
          {/* Ferne Hügel und Bäume */}
          <path d={`M ${W.x} ${W.y + W.h - 90} Q ${W.x + 90} ${W.y + W.h - 140} ${W.x + 180} ${W.y + W.h - 100} T ${W.x + W.w} ${W.y + W.h - 120} L ${W.x + W.w} ${W.y + W.h} L ${W.x} ${W.y + W.h} Z`} fill={snow > 0.5 ? "#4A5680" : "#1E2A3E"} />
          <path d={`M ${W.x} ${W.y + W.h - 40} Q ${W.x + 150} ${W.y + W.h - 80} ${W.x + W.w} ${W.y + W.h - 50} L ${W.x + W.w} ${W.y + W.h} L ${W.x} ${W.y + W.h} Z`} fill={snow > 0.5 ? "#6A78A6" : "#26323E"} opacity={0.9} />
          {/* Zweig vor dem Fenster – im Frühling mit Knospen */}
          <path d={`M ${W.x + W.w + 10} ${W.y + 230} C ${W.x + 220} ${W.y + 240}, ${W.x + 150} ${W.y + 200}, ${W.x + 60} ${W.y + 214} M ${W.x + 190} ${W.y + 232} C ${W.x + 160} ${W.y + 270}, ${W.x + 120} ${W.y + 280}, ${W.x + 90} ${W.y + 300}`} stroke="#0A0608" strokeWidth={7} fill="none" strokeLinecap="round" />
          {snow > 0.02 ? <path d={`M ${W.x + 230} ${W.y + 228} C ${W.x + 180} ${W.y + 218}, ${W.x + 140} ${W.y + 206}, ${W.x + 80} ${W.y + 208}`} stroke="#E8EEFF" strokeWidth={4} fill="none" strokeLinecap="round" opacity={0.8 * snow} /> : null}
          {spring > 0.02
            ? [
                [W.x + 120, W.y + 210],
                [W.x + 170, W.y + 220],
                [W.x + 230, W.y + 228],
                [W.x + 140, W.y + 276],
                [W.x + 100, W.y + 296],
              ].map(([bx, by], i) => <circle key={i} cx={bx} cy={by - 6} r={6 * spring} fill="#8FCB6A" opacity={0.85} />)
            : null}
          {/* Schnee fällt */}
          {snow > 0.02
            ? flakes.map((fk, i) => {
                const y = (fk.y + frame * fk.v * 1.6) % W.h;
                const x = fk.x + Math.sin(frame / 22 + fk.ph) * 10;
                return <circle key={i} cx={W.x + x} cy={W.y + y} r={fk.r} fill="#F4F7FF" opacity={0.8 * snow} />;
              })
            : null}
          {/* Eisblumen an den Ecken */}
          {snow > 0.02
            ? [
                [W.x, W.y, 1, 1],
                [W.x + W.w, W.y + W.h, -1, -1],
                [W.x, W.y + W.h, 1, -1],
              ].map(([cx, cy, sx, sy], i) => (
                <g key={i} transform={`translate(${cx} ${cy}) scale(${sx} ${sy})`} opacity={0.5 * snow}>
                  <path d="M 0 0 Q 70 10 120 0 Q 60 30 0 70 Z" fill="#DCE6FF" opacity={0.35} />
                  <path d="M 4 4 L 70 40 M 20 10 L 30 34 M 40 22 L 58 14 M 10 30 L 34 30" stroke="#E8EEFF" strokeWidth={2} opacity={0.6} />
                </g>
              ))
            : null}
        </g>
        {/* Sprossen */}
        <rect x={W.x + W.w / 2 - 6} y={W.y} width={12} height={W.h} fill="#1A0F08" />
        <rect x={W.x} y={W.y + W.h / 3 - 5} width={W.w} height={10} fill="#1A0F08" />
        <rect x={W.x} y={W.y + (2 * W.h) / 3 - 5} width={W.w} height={10} fill="#1A0F08" />
        {/* Fensterbank, im Winter mit Schnee draussen */}
        <rect x={W.x - 36} y={W.y + W.h + 20} width={W.w + 72} height={22} rx={4} fill="#3A2416" />
        <rect x={W.x - 36} y={W.y + W.h + 20} width={W.w + 72} height={5} fill="#7A5434" opacity={0.6} />

        {/* Kerzenlicht wärmt die Wand */}
        <ellipse cx={800} cy={1080} rx={760} ry={820} fill="url(#cbCandle)" opacity={fl} />
        <rect x={0} y={0} width={1080} height={1920} fill="url(#cbVig)" />
      </svg>
      {/* Ein Hauch Wärme, der mit dem Frühling zunimmt */}
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 70% 45% at 60% 62%, rgba(255,190,110,${(0.04 + 0.04 * spring) * fl}) 0%, rgba(255,190,110,0) 100%)` }} />
      <AbsoluteFill style={{ opacity: interpolate(p, [0, 1], [0, 0]) }} />
    </AbsoluteFill>
  );
};
