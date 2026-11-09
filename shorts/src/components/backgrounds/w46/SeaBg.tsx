import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { HEIGHT, WIDTH } from "../../../lib/timing";

/*
 * Meer bei Nacht (Ether 2–3, 6): Die Folge spielt am Ufer, auf dem Berg und auf dem Wasser – der
 * Himmel darüber läuft mit der ganzen Folge. Mond, Sterne und ruhige Dünung am Anfang; gegen
 * Ende zieht der Sturm auf (Wolken, Blitze, hohe See), und ganz am Schluss wird es über dem
 * Horizont hell. Der Hintergrund kennt nur den Fortschritt der Folge (Frame / Länge); Schiffe,
 * Berg und Figuren zeichnet die Szene davor.
 */

export const HORIZON = 880;
/** Der Mond: rechts, unter den grossen Zeilen oben */
const MOON_X = 940;
const MOON_Y = 700;

const STOPS: Array<{ p: number; top: string; mid: string; hor: string; sea: string; deep: string }> = [
  { p: 0, top: "#040817", mid: "#0A1A33", hor: "#1E3F5C", sea: "#0B2638", deep: "#020A12" },
  { p: 0.4, top: "#03060F", mid: "#081426", hor: "#173248", sea: "#091F2F", deep: "#02080F" },
  { p: 0.7, top: "#05091A", mid: "#0E1D35", hor: "#22405A", sea: "#0B2536", deep: "#030B13" },
  { p: 0.8, top: "#05070F", mid: "#0E1520", hor: "#1C2A36", sea: "#0A1C26", deep: "#02080C" },
  { p: 0.88, top: "#070A16", mid: "#121C30", hor: "#2C3A4E", sea: "#0E2232", deep: "#030A10" },
  { p: 1, top: "#172447", mid: "#4A4C72", hor: "#E3A27C", sea: "#1F3A52", deep: "#07121C" },
];

const hex = (s: string) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
export const mixHex = (a: string, b: string, k: number) => {
  const pa = hex(a);
  const pb = hex(b);
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * Math.max(0, Math.min(1, k)))).join(",")})`;
};

const colorsAt = (p: number) => {
  let i = 0;
  while (i < STOPS.length - 2 && p > STOPS[i + 1].p) i++;
  const a = STOPS[i];
  const b = STOPS[i + 1];
  const k = Math.max(0, Math.min(1, (p - a.p) / (b.p - a.p)));
  const m = (key: "top" | "mid" | "hor" | "sea" | "deep") => mixHex(a[key], b[key], k);
  return { top: m("top"), mid: m("mid"), hor: m("hor"), sea: m("sea"), deep: m("deep") };
};

/** Wie stark der Sturm gerade ist (0 … 1) – auch für die Szene, die Schiffe schaukeln lässt. */
export const stormAt = (p: number) => interpolate(p, [0.74, 0.79, 0.87, 0.92], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

/** Blitze im Sturm: kurze Aufhellung an festen Stellen der Folge. */
const LIGHTNING = [0.775, 0.81, 0.835, 0.86];
export const flashAt = (p: number, total: number) =>
  LIGHTNING.reduce((acc, at) => {
    const d = (p - at) * total;
    return Math.max(acc, d >= 0 && d < 9 ? (d < 2 ? 1 : d < 4 ? 0.35 : d < 5 ? 0.8 : (9 - d) / 9) : 0);
  }, 0);

/** Eine Wellenlinie über die ganze Breite. */
const waveLine = (y: number, amp: number, len: number, phase: number) => {
  const pts: string[] = [];
  for (let x = -40; x <= WIDTH + 40; x += 24) {
    pts.push(`${x} ${(y + amp * Math.sin(x / len + phase) + amp * 0.4 * Math.sin(x / (len * 0.43) - phase * 1.3)).toFixed(1)}`);
  }
  return `M ${pts.join(" L ")}`;
};

export const SeaBg: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = frame / Math.max(1, durationInFrames);
  const c = colorsAt(p);
  const storm = stormAt(p);
  const flash = flashAt(p, durationInFrames) * storm;
  const dawn = interpolate(p, [0.88, 1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const stars = useMemo(() => Array.from({ length: 140 }, (_, i) => ({ x: random(`ss${i}`) * WIDTH, y: 40 + random(`sy${i}`) * 780, r: 0.8 + random(`sr${i}`) * 2.1, ph: random(`sp${i}`) * 6.28 })), []);
  const clouds = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => ({
        x: random(`cx${i}`) * 1500 - 200,
        y: 180 + random(`cy${i}`) * 560,
        w: 320 + random(`cw${i}`) * 420,
        h: 60 + random(`ch${i}`) * 70,
        v: 0.15 + random(`cv${i}`) * 0.25,
      })),
    [],
  );
  const moonO = (1 - storm) * (1 - Math.min(1, dawn * 3));
  const starO = (1 - storm) * (1 - dawn);
  const wrap = (x: number, span: number) => ((x % span) + span) % span;
  const amp = 1 + storm * 3.2;
  const bolt = flash > 0.5 ? LIGHTNING.findIndex((at) => p >= at && (p - at) * durationInFrames < 9) : -1;
  return (
    <AbsoluteFill style={{ background: c.top }}>
      <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <linearGradient id="sbSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c.top} />
            <stop offset="62%" stopColor={c.mid} />
            <stop offset="100%" stopColor={c.hor} />
          </linearGradient>
          <linearGradient id="sbSea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c.sea} />
            <stop offset="45%" stopColor={c.deep} />
            <stop offset="100%" stopColor="#01050A" />
          </linearGradient>
          <radialGradient id="sbMoon">
            <stop offset="0%" stopColor="#F4F8FF" stopOpacity="0.55" />
            <stop offset="35%" stopColor="#BFD9F2" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#BFD9F2" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="sbDawn" cx="50%" cy="100%" r="70%">
            <stop offset="0%" stopColor="#FFC992" stopOpacity="0.75" />
            <stop offset="60%" stopColor="#E08A7A" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#E08A7A" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect x={0} y={0} width={WIDTH} height={HORIZON + 4} fill="url(#sbSky)" />
        {/* Sterne */}
        {starO > 0.02
          ? stars.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#EAF4FF" opacity={starO * (0.35 + 0.45 * Math.sin(frame / 14 + s.ph) ** 2)} />)
          : null}
        {/* Mond mit Hof */}
        {moonO > 0.02 ? (
          <g opacity={moonO}>
            <circle cx={MOON_X} cy={MOON_Y} r={240} fill="url(#sbMoon)" />
            <circle cx={MOON_X} cy={MOON_Y} r={44} fill="#EEF4FA" />
            <circle cx={MOON_X - 13} cy={MOON_Y - 9} r={9} fill="#D2DEE8" opacity={0.7} />
            <circle cx={MOON_X + 15} cy={MOON_Y + 13} r={6} fill="#D2DEE8" opacity={0.6} />
          </g>
        ) : null}
        {/* Morgenlicht am Horizont */}
        {dawn > 0.01 ? <ellipse cx={540} cy={HORIZON} rx={900} ry={420} fill="url(#sbDawn)" opacity={dawn} /> : null}
        {/* Wolken – im Sturm dichter, dunkler, schneller */}
        {clouds.map((cl, i) => {
          const x = wrap(cl.x + frame * cl.v * (1 + storm * 5), 1700) - 400;
          const o = 0.18 + 0.5 * storm;
          const col = mixHex("#16263C", "#0A0E16", storm);
          return (
            <g key={i} opacity={o}>
              <ellipse cx={x} cy={cl.y} rx={cl.w / 2} ry={cl.h / 2} fill={col} />
              <ellipse cx={x + cl.w * 0.22} cy={cl.y - cl.h * 0.35} rx={cl.w * 0.3} ry={cl.h * 0.45} fill={col} />
              <ellipse cx={x - cl.w * 0.2} cy={cl.y - cl.h * 0.2} rx={cl.w * 0.24} ry={cl.h * 0.38} fill={col} />
            </g>
          );
        })}
        {/* Blitz */}
        {bolt >= 0 ? (
          <path
            d={`M ${260 + bolt * 190} 210 L ${230 + bolt * 190} 420 L ${290 + bolt * 190} 430 L ${240 + bolt * 190} ${HORIZON - 20}`}
            stroke="#EAF6FF"
            strokeWidth={6}
            fill="none"
            strokeLinejoin="bevel"
            opacity={flash}
          />
        ) : null}
        {/* Meer */}
        <rect x={0} y={HORIZON} width={WIDTH} height={HEIGHT - HORIZON} fill="url(#sbSea)" />
        <rect x={0} y={HORIZON - 1} width={WIDTH} height={3} fill={mixHex("#6E9BB8", "#FFD2A6", dawn)} opacity={0.35} />
        {/* Mondspur auf dem Wasser */}
        {moonO > 0.02
          ? Array.from({ length: 22 }, (_, i) => {
              const y = HORIZON + 10 + i * i * 1.6;
              const w = 30 + i * 9 + 18 * Math.sin(frame / 7 + i * 1.7);
              return <rect key={i} x={MOON_X - w / 2 + 10 * Math.sin(frame / 11 + i)} y={y} width={w} height={2 + i * 0.25} rx={2} fill="#DDEBF7" opacity={moonO * (0.5 - i * 0.018)} />;
            })
          : null}
        {/* Dünung: Linien, nach vorn höher und schneller */}
        {Array.from({ length: 13 }, (_, i) => {
          const y = HORIZON + 14 + i * i * 6.2;
          const a = (2 + i * 1.6) * amp;
          return <path key={i} d={waveLine(y, a, 90 + i * 22, frame * (0.03 + i * 0.006) * (1 + storm * 2) + i * 1.3)} stroke={mixHex("#5D8CA8", "#9DB8C8", storm)} strokeWidth={1.5 + i * 0.35} fill="none" opacity={0.16 + i * 0.012} />;
        })}
        {/* Blitzlicht über allem */}
        {flash > 0.01 ? <rect x={0} y={0} width={WIDTH} height={HEIGHT} fill="#DCEBFF" opacity={0.28 * flash} /> : null}
      </svg>
    </AbsoluteFill>
  );
};
