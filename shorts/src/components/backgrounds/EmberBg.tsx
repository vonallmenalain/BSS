import React, { useMemo } from "react";
import { AbsoluteFill, random, useCurrentFrame } from "remotion";
import { FPS, HEIGHT, WIDTH } from "../../lib/timing";

/*
 * Ember-Look: ein Hof bei Nacht (Lukas 22:55). Oben ein Streifen Sternenhimmel, darunter eine
 * dunkle Steinmauer mit einer Galerie, unten das Pflaster. Das Feuer selbst zeichnet die Szene;
 * hier liegt nur sein Widerschein auf Mauer und Boden – er flackert – und Funken steigen auf.
 */

/** Oberkante der Mauer – darüber Himmel */
export const WALL_TOP = 360;
/** Boden des Hofs, auf dem die Figuren stehen */
export const GROUND_Y = 1190;
/** Wo das Feuer brennt (Mitte der Feuerstelle) */
export const FIRE_X = 520;
/** Die Galerie: Bogenöffnung in der Mauer, darunter die Brüstung */
export const GALLERY = { x0: 400, x1: 680, spring: 560, rail: 700 } as const;

/** Bogenöffnung der Galerie als Pfad (auch zum Zuschneiden in der Szene) */
export const galleryPath = () => {
  const { x0, x1, spring, rail } = GALLERY;
  const r = (x1 - x0) / 2;
  return `M ${x0} ${rail} L ${x0} ${spring} A ${r} ${r} 0 0 1 ${x1} ${spring} L ${x1} ${rail} Z`;
};

/** Flackern des Feuers – dieselbe Kurve für Widerschein und Flammen */
export const flicker = (t: number) => 0.86 + 0.07 * Math.sin(t * 9.3) + 0.05 * Math.sin(t * 15.7 + 1.3) + 0.03 * Math.sin(t * 23.1 + 0.4);

export const EmberBg: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const stars = useMemo(
    () =>
      Array.from({ length: 46 }, (_, i) => ({
        x: random(`es${i}`) * WIDTH,
        y: 20 + random(`ey${i}`) * (WALL_TOP - 40),
        r: 0.8 + random(`er${i}`) * 1.8,
        p: random(`ep${i}`) * 6.28,
      })),
    [],
  );
  /* Mauerquader: Reihen mit versetzten Fugen, jeder Stein etwas anders getönt */
  const blocks = useMemo(() => {
    const out: Array<{ x: number; y: number; w: number; h: number; s: number }> = [];
    const rowH = 74;
    for (let r = 0, y = WALL_TOP + 26; y < GROUND_Y; r++, y += rowH) {
      let x = -random(`bo${r}`) * 120;
      let k = 0;
      while (x < WIDTH) {
        const w = 130 + random(`bw${r}-${k}`) * 90;
        out.push({ x, y, w, h: rowH, s: random(`bs${r}-${k}`) });
        x += w;
        k++;
      }
    }
    return out;
  }, []);
  const sparks = useMemo(
    () =>
      Array.from({ length: 42 }, (_, i) => ({
        x0: FIRE_X + (random(`fx${i}`) - 0.5) * 220,
        v: 60 + random(`fv${i}`) * 120,
        off: random(`fo${i}`) * 30,
        sway: 20 + random(`fs${i}`) * 60,
        p: random(`fp${i}`) * 6.28,
        r: 1.4 + random(`fr${i}`) * 2.6,
      })),
    [],
  );
  const glow = flicker(t);
  const { x0, x1, spring, rail } = GALLERY;
  return (
    <AbsoluteFill style={{ background: "#0B0706" }}>
      <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <linearGradient id="emSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#05060F" />
            <stop offset="70%" stopColor="#120E24" />
            <stop offset="100%" stopColor="#2A1824" />
          </linearGradient>
          <radialGradient id="emWallGlow" cx={FIRE_X} cy={1080} r={760} gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF9A45" stopOpacity="0.42" />
            <stop offset="45%" stopColor="#C2512A" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#C2512A" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="emFloorGlow" cx={FIRE_X} cy={GROUND_Y + 10} r={620} gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFB062" stopOpacity="0.5" />
            <stop offset="40%" stopColor="#B8502A" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#B8502A" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="emFloor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#24170F" />
            <stop offset="100%" stopColor="#070504" />
          </linearGradient>
          <radialGradient id="emGallery" cx={(x0 + x1) / 2} cy={rail} r={220} gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#3A2216" />
            <stop offset="100%" stopColor="#0A0605" />
          </radialGradient>
        </defs>

        {/* Himmel und Sterne */}
        <rect x={0} y={0} width={WIDTH} height={WALL_TOP + 30} fill="url(#emSky)" />
        {stars.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#FFFFFF" opacity={0.25 + 0.45 * (0.5 + 0.5 * Math.sin(t * 1.6 + s.p))} />
        ))}

        {/* Mauer */}
        <rect x={0} y={WALL_TOP} width={WIDTH} height={GROUND_Y - WALL_TOP} fill="#1B120F" />
        {blocks.map((b, i) => (
          <rect key={i} x={b.x + 3} y={b.y + 3} width={b.w - 6} height={b.h - 6} rx={6} fill={b.s > 0.5 ? "#231713" : "#1E1411"} opacity={0.75 + 0.25 * b.s} />
        ))}
        {/* Gesims oben */}
        <rect x={0} y={WALL_TOP} width={WIDTH} height={28} fill="#2B1D16" />
        <rect x={0} y={WALL_TOP + 28} width={WIDTH} height={6} fill="#0E0907" opacity={0.8} />

        {/* Galerie mit Bogen und Brüstung */}
        <path d={galleryPath()} fill="url(#emGallery)" stroke="#2E2018" strokeWidth={26} />
        <path d={`M ${x0 - 13} ${rail} L ${x0 - 13} ${spring} A ${(x1 - x0) / 2 + 13} ${(x1 - x0) / 2 + 13} 0 0 1 ${x1 + 13} ${spring} L ${x1 + 13} ${rail}`} fill="none" stroke="#3A291E" strokeWidth={4} opacity={0.7} />
        <rect x={x0 - 30} y={rail - 6} width={x1 - x0 + 60} height={30} fill="#2B1D16" />
        {Array.from({ length: 9 }, (_, i) => (
          <rect key={i} x={x0 - 10 + i * ((x1 - x0 + 20) / 8) - 7} y={rail + 24} width={14} height={46} rx={5} fill="#23170F" />
        ))}
        <rect x={x0 - 30} y={rail + 68} width={x1 - x0 + 60} height={16} fill="#2B1D16" />

        {/* Widerschein des Feuers auf der Mauer */}
        <rect x={0} y={WALL_TOP} width={WIDTH} height={GROUND_Y - WALL_TOP} fill="url(#emWallGlow)" opacity={glow} style={{ mixBlendMode: "screen" }} />

        {/* Boden */}
        <rect x={0} y={GROUND_Y} width={WIDTH} height={HEIGHT - GROUND_Y} fill="url(#emFloor)" />
        <line x1={0} y1={GROUND_Y} x2={WIDTH} y2={GROUND_Y} stroke="#3A2618" strokeWidth={4} />
        {Array.from({ length: 13 }, (_, i) => {
          const k = i - 6;
          return <line key={`v${i}`} x1={FIRE_X + k * 70} y1={GROUND_Y} x2={FIRE_X + k * 330} y2={HEIGHT} stroke="#0A0605" strokeWidth={3} opacity={0.7} />;
        })}
        {[1250, 1330, 1440, 1590, 1780].map((y, i) => (
          <line key={`h${i}`} x1={0} y1={y} x2={WIDTH} y2={y} stroke="#0A0605" strokeWidth={3} opacity={0.6} />
        ))}
        <ellipse cx={FIRE_X} cy={GROUND_Y + 20} rx={620} ry={210} fill="url(#emFloorGlow)" opacity={glow} />

        {/* Funken, die vom Feuer aufsteigen */}
        {sparks.map((s, i) => {
          const range = 1100;
          const d = (t * s.v + s.off * 37) % range;
          const y = GROUND_Y - 120 - d;
          const x = s.x0 + Math.sin(t * 1.3 + s.p + d / 140) * s.sway;
          const fade = Math.max(0, 1 - d / range);
          return <circle key={i} cx={x} cy={y} r={s.r * (0.6 + 0.4 * fade)} fill="#FFB766" opacity={0.75 * fade * (0.6 + 0.4 * Math.sin(t * 7 + s.p))} />;
        })}
      </svg>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 85% 70% at 50% 50%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.7) 100%)" }} />
    </AbsoluteFill>
  );
};
