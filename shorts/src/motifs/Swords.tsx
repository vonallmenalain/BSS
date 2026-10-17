import React from "react";
import { Easing, interpolate, spring } from "remotion";
import { FPS, HEIGHT, WIDTH, type Word, cueTime } from "../lib/timing";
import { Sword, Warrior } from "./Figures";

/** Hügel-Oberkante: Parabel, Scheitel bei y=1000 in der Bildmitte. */
const moundY = (x: number) => {
  const t = x / WIDTH;
  return 1150 - 600 * t * (1 - t);
};
const moundTop = `M 0 0 L ${WIDTH} 0 L ${WIDTH} 1150 Q ${WIDTH / 2} 850 0 1150 Z`;

const SWORDS = [
  { x: 250, r: -9 },
  { x: 350, r: 5 },
  { x: 445, r: -4 },
  { x: 540, r: 2 },
  { x: 635, r: -6 },
  { x: 730, r: 7 },
  { x: 830, r: -3 },
];

/**
 * Szene "Bund": Die Väter begraben ihre Schwerter (Alma 24), dann steigen die Söhne
 * hinter dem Hügel auf. Zeitsteuerung über Cues in der Narration.
 */
export const SwordsMotif: React.FC<{ t: number; words: Word[]; cue?: string }> = ({ t, words, cue = "Also traten" }) => {
  const sonsAt = cueTime(words, cue, 2.6);
  const frameOf = (sec: number) => Math.round(sec * FPS);
  const tf = frameOf(t);

  return (
    <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", inset: 0 }}>
      <defs>
        <clipPath id="aboveMound">
          <path d={moundTop} />
        </clipPath>
        <linearGradient id="earth" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1A1220" />
          <stop offset="35%" stopColor="#0B0810" />
          <stop offset="100%" stopColor="#040306" />
        </linearGradient>
      </defs>

      {/* Söhne hinter dem Hügel */}
      <g clipPath="url(#aboveMound)">
        {Array.from({ length: 11 }, (_, i) => {
          const x = 115 + i * 85;
          const delay = (Math.abs(i - 5) * 0.07 + 0.05) * FPS;
          const s = spring({ frame: tf - frameOf(sonsAt) - delay, fps: FPS, config: { damping: 16, stiffness: 90 } });
          const rise = interpolate(s, [0, 1], [420, 0]);
          const sc = 0.95 + 0.2 * Math.cos(((i - 5) / 5) * Math.PI * 0.5);
          return <Warrior key={i} x={x} y={moundY(x) + 26 + rise} scale={sc} rim={s} />;
        })}
      </g>

      {/* Schwerter sinken in die Erde */}
      <g clipPath="url(#aboveMound)">
        {SWORDS.map((sw, i) => {
          const start = 0.15 + i * 0.22;
          // Bis auf Griff und Parierstange versenkt – die Söhne stehen danach klar davor
          const sink = interpolate(t, [start, start + 1.3], [0, 335], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.inOut(Easing.cubic),
          });
          const fade = interpolate(t, [sonsAt - 0.2, sonsAt + 0.8], [1, 0.55], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const baseY = moundY(sw.x) - 372 + 10;
          return (
            <g key={i} opacity={fade}>
              <Sword x={sw.x} y={baseY + sink} rotate={sw.r} scale={0.92} />
            </g>
          );
        })}
      </g>

      {/* Hügel / Erde im Vordergrund – zugleich ruhiger Untergrund für die Untertitel */}
      <path d={`M 0 1150 Q ${WIDTH / 2} 850 ${WIDTH} 1150 L ${WIDTH} ${HEIGHT} L 0 ${HEIGHT} Z`} fill="url(#earth)" />
      <path
        d={`M 0 1150 Q ${WIDTH / 2} 850 ${WIDTH} 1150`}
        fill="none"
        stroke="#F6C86A"
        strokeOpacity={0.35}
        strokeWidth={2}
      />
    </svg>
  );
};
