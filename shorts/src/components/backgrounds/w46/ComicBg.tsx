import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { HEIGHT, WIDTH } from "../../../lib/timing";

/*
 * Bildergeschichte (1 Nephi 15): die dunkle Seite eines Comicheftes bei Nacht. Ein tiefes
 * Tintenblau mit Rasterpunkten wie im Druck – dichter in den Ecken, fast weg in der Mitte –, dazu
 * ganz leise Strahlen hinter den Panels, die sich im Lauf der Folge drehen. Die Panels, Figuren
 * und Blasen zeichnet die Szene davor.
 */

export const ComicBg: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = frame / Math.max(1, durationInFrames);
  const drift = frame * 0.12;
  const rays = Array.from({ length: 28 }, (_, i) => {
    const a = (i / 28) * Math.PI * 2 + p * 0.9;
    const d = Math.PI / 56;
    const cx = 540;
    const cy = 760;
    const r = 1500;
    return `M ${cx} ${cy} L ${cx + Math.cos(a - d) * r} ${cy + Math.sin(a - d) * r} L ${cx + Math.cos(a + d) * r} ${cy + Math.sin(a + d) * r} Z`;
  }).join(" ");
  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg, #0C1328 0%, #121A33 45%, #0A0F20 100%)" }}>
      <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <pattern id="cbDots" width={18} height={18} patternUnits="userSpaceOnUse" patternTransform={`translate(${drift} ${drift * 0.5})`}>
            <circle cx={4.5} cy={4.5} r={2.6} fill="#2A3A66" />
            <circle cx={13.5} cy={13.5} r={2.6} fill="#2A3A66" />
          </pattern>
          <pattern id="cbDotsBig" width={26} height={26} patternUnits="userSpaceOnUse" patternTransform={`translate(${-drift} ${drift * 0.3})`}>
            <circle cx={6.5} cy={6.5} r={5.2} fill="#24335C" />
            <circle cx={19.5} cy={19.5} r={5.2} fill="#24335C" />
          </pattern>
          <radialGradient id="cbHole" cx="50%" cy="42%" r="62%">
            <stop offset="0%" stopColor="#fff" stopOpacity="0" />
            <stop offset="55%" stopColor="#fff" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#fff" stopOpacity="1" />
          </radialGradient>
          <mask id="cbCorners">
            <rect width={WIDTH} height={HEIGHT} fill="url(#cbHole)" />
          </mask>
          <linearGradient id="cbBottom" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fff" stopOpacity="0" />
            <stop offset="70%" stopColor="#fff" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#fff" stopOpacity="1" />
          </linearGradient>
          <mask id="cbLow">
            <rect width={WIDTH} height={HEIGHT} fill="url(#cbBottom)" />
          </mask>
        </defs>
        {/* Leise Strahlen hinter allem */}
        <path d={rays} fill="#1B2647" opacity={0.55} />
        {/* Rasterpunkte: fein überall in den Ecken, grob am unteren Rand */}
        <rect width={WIDTH} height={HEIGHT} fill="url(#cbDots)" mask="url(#cbCorners)" opacity={0.9} />
        <rect width={WIDTH} height={HEIGHT} fill="url(#cbDotsBig)" mask="url(#cbLow)" opacity={0.7} />
        {/* Druckrand: eine feine Linie wie der Rand der Seite */}
        <rect x={22} y={22} width={WIDTH - 44} height={HEIGHT - 44} fill="none" stroke="#3A4A78" strokeWidth={2} opacity={0.35} />
      </svg>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 85% 70% at 50% 45%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.6) 100%)" }} />
    </AbsoluteFill>
  );
};
