import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { FPS, HEIGHT, WIDTH } from "../../../lib/timing";

/*
 * Nachrichtenstudio (Apostelgeschichte 17): dunkles Blau, ein Globus aus feinen Linien, der sich
 * langsam dreht, Lichtbahnen und Punkte wie auf einer Weltkarte. Unten läuft die ganze Folge
 * über ein Laufband mit den Meldungen aus Thessalonich, Beröa und Athen, oben rechts blinkt
 * «LIVE». Eine eigene, erfundene Gestaltung – kein echter Sender. Den Bildschirm mit der
 * Live-Schaltung und die Bauchbinde zeichnet die Szene davor.
 */

const RED = "#FF3B3B";
const BLUE = "#3FA9FF";

/** Das Laufband: Meldungen aus der Apostelgeschichte 17, eine nach der anderen */
const SEP = "\u00A0\u00A0+++\u00A0\u00A0";
const TICKER = [
  "Thessalonich: Menge zieht vor das Haus des Jason",
  "Beröa: Menschen forschen jeden Tag in den Schriften",
  "Athen: Neue Lehre auf dem Areopag",
  "Paulus und Silas weiter unterwegs",
].join(SEP) + SEP;
/** So breit ist eine Runde des Laufbands (SVG `textLength` zwingt den Text genau auf diese Länge) */
const TICKER_W = 3820;
const TICKER_Y = 1600;

/** Der Globus: Breiten- und Längenkreise, die Längenkreise drehen sich */
const Globe: React.FC<{ t: number }> = ({ t }) => {
  const cx = WIDTH / 2;
  const cy = 700;
  const r = 560;
  const meridians = 12;
  return (
    <g opacity={0.22}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={BLUE} strokeWidth={2.5} />
      {[-0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75].map((k) => {
        const y = cy + k * r;
        const rx = Math.sqrt(1 - k * k) * r;
        return <ellipse key={k} cx={cx} cy={y} rx={rx} ry={rx * 0.12} fill="none" stroke={BLUE} strokeWidth={1.5} />;
      })}
      {Array.from({ length: meridians }, (_, i) => {
        const a = ((i / meridians) * Math.PI + t * 0.12) % Math.PI;
        const rx = Math.abs(Math.cos(a)) * r;
        const front = Math.sin(a) > 0;
        return <ellipse key={i} cx={cx} cy={cy} rx={rx} ry={r} fill="none" stroke={BLUE} strokeWidth={front ? 1.6 : 0.8} opacity={front ? 1 : 0.5} />;
      })}
    </g>
  );
};

export const NewsBg: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = frame / FPS;
  const p = frame / Math.max(1, durationInFrames);
  // Punkte wie Städte auf einer Weltkarte, die leise pulsieren
  const dots = useMemo(
    () => Array.from({ length: 70 }, (_, i) => ({ x: random(`nd${i}`) * WIDTH, y: 220 + random(`ne${i}`) * 1300, ph: random(`nf${i}`) * 6.28, r: 1.5 + random(`ng${i}`) * 2.5 })),
    [],
  );
  const shift = -((frame * 3.4) % TICKER_W);
  const sweep = interpolate((t * 0.18) % 1, [0, 1], [-600, WIDTH + 600]);
  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg, #050A19 0%, #0A1631 38%, #0B1735 62%, #050915 100%)" }}>
      <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id="nbGlow" cx="50%" cy="36%" r="60%">
            <stop offset="0%" stopColor="#1B4C9A" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#1B4C9A" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="nbBeam" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
            <stop offset="50%" stopColor="#9FD0FF" stopOpacity="0.09" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="nbFloor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0D1D40" stopOpacity="0" />
            <stop offset="100%" stopColor="#02040C" stopOpacity="0.9" />
          </linearGradient>
        </defs>
        <rect x={0} y={0} width={WIDTH} height={HEIGHT} fill="url(#nbGlow)" />
        <Globe t={t} />
        {dots.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={BLUE} opacity={0.12 + 0.18 * (0.5 + 0.5 * Math.sin(t * 1.6 + d.ph))} />
        ))}
        {/* Lichtbahn, die schräg durchs Studio wandert */}
        <g transform={`translate(${sweep} 0) skewX(-18)`}>
          <rect x={-160} y={0} width={320} height={HEIGHT} fill="url(#nbBeam)" />
        </g>
        {/* Studioboden mit Linien, die zur Mitte laufen */}
        <rect x={0} y={1180} width={WIDTH} height={HEIGHT - 1180} fill="url(#nbFloor)" />
        {Array.from({ length: 13 }, (_, i) => {
          const x = -400 + i * 156;
          return <line key={i} x1={WIDTH / 2 + (x - WIDTH / 2) * 0.25} y1={1480} x2={x} y2={HEIGHT} stroke={BLUE} strokeWidth={1.5} opacity={0.12} />;
        })}
        {[1500, 1530, 1575].map((y, i) => (
          <line key={y} x1={0} y1={y + 0} x2={WIDTH} y2={y} stroke={BLUE} strokeWidth={1} opacity={0.08 + i * 0.03} />
        ))}

      </svg>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 85% 70% at 50% 42%, rgba(0,0,0,0) 50%, rgba(1,3,10,0.7) 100%)" }} />
      <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", inset: 0 }}>
        {/* Laufband */}
        <rect x={0} y={TICKER_Y - 4} width={WIDTH} height={4} fill={RED} />
        <rect x={0} y={TICKER_Y} width={WIDTH} height={78} fill="#0A1228" opacity={0.96} />
        <g clipPath="url(#nbTickerClip)">
          {[0, 1, 2].map((k) => (
            <text
              key={k}
              x={250 + shift + k * TICKER_W}
              y={TICKER_Y + 52}
              textLength={TICKER_W}
              lengthAdjust="spacing"
              fontFamily="Inter"
              fontWeight={700}
              fontSize={34}
              fill="#EAF2FF"
            >
              {TICKER}
            </text>
          ))}
        </g>
        <defs>
          <clipPath id="nbTickerClip">
            <rect x={230} y={TICKER_Y} width={WIDTH - 230} height={78} />
          </clipPath>
        </defs>
        <rect x={0} y={TICKER_Y} width={230} height={78} fill={RED} />
        <text x={115} y={TICKER_Y + 51} textAnchor="middle" fontFamily="Inter" fontWeight={800} fontSize={30} letterSpacing={3} fill="#FFFFFF">
          AKTUELL
        </text>
        <path d={`M 230 ${TICKER_Y} L 252 ${TICKER_Y + 39} L 230 ${TICKER_Y + 78} Z`} fill={RED} />
        <rect x={0} y={TICKER_Y + 78} width={WIDTH} height={3} fill={BLUE} opacity={0.6} />
        {/* Fortschritt der Sendung, ganz fein unter dem Laufband */}
        <rect x={0} y={TICKER_Y + 78} width={WIDTH * p} height={3} fill="#FFFFFF" opacity={0.5} />

      </svg>
    </AbsoluteFill>
  );
};
