import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, random, spring, useCurrentFrame } from "remotion";
import { useLook } from "../../looks";
import { Sfx, type SfxName, beat, voiceFrame } from "../../lib/sfx";
import { FPS, type TimelineScene } from "../../lib/timing";
import type { Scene } from "../../schema";
import { theme } from "../../theme";

/*
 * Ketten: Um eine Figur legt sich erst eine dünne Schnur, dann ein Strick, dann eine Kette
 * (vgl. 2 Nephi 26:22) – und am Schluss springt alles auf: durch Licht oder durch den Schlüssel
 * aus dem Minispiel «Ketten sprengen». Mit `field` wird daraus die Spielvorschau wie im Minispiel:
 * neun Plätze, auf denen Notlügen mit ihrer Schnur auftauchen; der Finger tippt eine weg, eine
 * schnappt zu und kostet ein Leben, und der Schlüssel sprengt alles.
 *
 * Jede Phrase in `cues` legt eine Stufe drauf; die letzte macht die Kette fertig («… bis sie zur
 * Kette wird»), auch wenn die Szene erst bei der Schnur beginnt.
 */

type ChainsSceneT = Extract<Scene, { type: "chains" }>;
type Level = 0 | 1 | 2 | 3;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const MATERIAL = ["", "Schnur", "Strick", "Kette"] as const;
const TIGHTEN_SFX: Record<1 | 2 | 3, SfxName> = { 1: "swipe", 2: "drum", 3: "clash" };
const EMOJI = /\p{Extended_Pictographic}/u;

/** interpolate, das auch mit einem Stichwort «nie» (Infinity) zurechtkommt: dann gilt der Anfangswert. */
const lerp = (x: number, input: number[], output: number[], opts: Parameters<typeof interpolate>[3] = clamp) =>
  input.every(Number.isFinite) ? interpolate(x, input, output, opts) : x < input[0] ? output[0] : output[output.length - 1];

/* ---------------- Die Ringe ---------------- */

/** Zwei verdrehte Flachsfäden – kaum zu spüren. */
const Cord: React.FC<{ r: number; cx: number; cy: number }> = ({ r, cx, cy }) => {
  // Die Fäden wandern langsam – die Schnur lebt, kaum merklich
  const drift = useCurrentFrame() / 9;
  const strand = (phase0: number) => {
    const phase = phase0 + drift;
    const pts: string[] = [];
    for (let i = 0; i <= 240; i++) {
      const a = (i / 240) * Math.PI * 2;
      const rr = r + 5 * Math.sin(a * 30 + phase);
      pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)} ${(cy + Math.sin(a) * rr).toFixed(1)}`);
    }
    return `M ${pts.join(" L ")} Z`;
  };
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth={10} transform="translate(0 6)" />
      <path d={strand(0)} fill="none" stroke="#F3E6C4" strokeWidth={5} />
      <path d={strand(Math.PI)} fill="none" stroke="#C9B17E" strokeWidth={5} />
    </g>
  );
};

/** Ein dicker, gedrehter Strick. */
const Rope: React.FC<{ r: number; cx: number; cy: number }> = ({ r, cx, cy }) => {
  const n = Math.round((2 * Math.PI * r) / 15);
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(0,0,0,0.4)" strokeWidth={28} transform="translate(0 8)" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#6E4321" strokeWidth={24} />
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2;
        const b = a + 0.06;
        return (
          <line
            key={i}
            x1={cx + Math.cos(a) * (r - 11)}
            y1={cy + Math.sin(a) * (r - 11)}
            x2={cx + Math.cos(b) * (r + 11)}
            y2={cy + Math.sin(b) * (r + 11)}
            stroke="#B07A42"
            strokeWidth={7}
            strokeLinecap="round"
          />
        );
      })}
      <circle cx={cx} cy={cy} r={r - 6} fill="none" stroke="rgba(255,226,180,0.25)" strokeWidth={2} />
    </g>
  );
};

/** Eiserne Kette: Glieder abwechselnd von vorn und von der Seite. */
const linkCount = (r: number) => Math.max(10, Math.round((2 * Math.PI * r) / 44));

const Link: React.FC<{ k: number; x: number; y: number; deg: number }> = ({ k, x, y, deg }) =>
  k % 2 === 0 ? (
    <g transform={`translate(${x} ${y}) rotate(${deg})`}>
      <ellipse rx={28} ry={16} fill="none" stroke="rgba(0,0,0,0.45)" strokeWidth={11} transform="translate(0 5)" />
      <ellipse rx={28} ry={16} fill="none" stroke="url(#chainMetal)" strokeWidth={10} />
      <ellipse rx={28} ry={16} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth={2} transform="translate(-1 -3)" />
    </g>
  ) : (
    <g transform={`translate(${x} ${y}) rotate(${deg})`}>
      <rect x={-27} y={-6} width={54} height={12} rx={6} fill="url(#chainMetalSide)" stroke="rgba(0,0,0,0.5)" strokeWidth={2} />
      <rect x={-21} y={-3} width={42} height={2.5} rx={1} fill="rgba(255,255,255,0.6)" />
    </g>
  );

const Chain: React.FC<{ r: number; cx: number; cy: number }> = ({ r, cx, cy }) => {
  const n = linkCount(r);
  return (
    <g>
      {Array.from({ length: n }, (_, k) => {
        const a = (k / n) * Math.PI * 2;
        return <Link key={k} k={k} x={cx + Math.cos(a) * r} y={cy + Math.sin(a) * r} deg={(a * 180) / Math.PI + 90} />;
      })}
    </g>
  );
};

/** Vorhängeschloss unten an der Kette. */
const Padlock: React.FC<{ x: number; y: number; open: number }> = ({ x, y, open }) => (
  <g transform={`translate(${x} ${y})`}>
    <path d={`M -22 ${-6 - open * 26} L -22 -34 A 22 22 0 0 1 22 -34 L 22 -6`} transform={`translate(0 ${-open * 18})`} fill="none" stroke="url(#chainMetal)" strokeWidth={10} strokeLinecap="round" />
    <rect x={-38} y={-12} width={76} height={62} rx={12} fill="url(#lockBody)" stroke="rgba(0,0,0,0.55)" strokeWidth={3} />
    <circle cx={0} cy={12} r={8} fill="#1B1B22" />
    <rect x={-3} y={14} width={6} height={18} rx={2} fill="#1B1B22" />
  </g>
);

/** Ein Ring der Stufe, als Ganzes. */
const Ring: React.FC<{ level: Level; r: number; cx: number; cy: number }> = ({ level, r, cx, cy }) => {
  if (level === 1) return <Cord r={r} cx={cx} cy={cy} />;
  if (level === 2) return <Rope r={r} cx={cx} cy={cy} />;
  if (level === 3) return <Chain r={r} cx={cx} cy={cy} />;
  return null;
};

/** Beim Zerspringen: der Ring in Stücken, die nach aussen fliegen. */
const Shards: React.FC<{ level: Level; r: number; cx: number; cy: number; p: number }> = ({ level, r, cx, cy, p }) => {
  if (level === 0 || p >= 1) return null;
  const e = Easing.out(Easing.cubic)(p);
  if (level === 3) {
    const n = linkCount(r);
    return (
      <g opacity={1 - p}>
        {Array.from({ length: n }, (_, k) => {
          const a = (k / n) * Math.PI * 2;
          const v = 260 + random(`lv${k}`) * 420;
          const d = v * e;
          const spin = (random(`ls${k}`) - 0.5) * 540 * e;
          return (
            <Link key={k} k={k} x={cx + Math.cos(a) * (r + d)} y={cy + Math.sin(a) * (r + d) + 260 * p * p} deg={(a * 180) / Math.PI + 90 + spin} />
          );
        })}
      </g>
    );
  }
  const n = 14;
  const color = level === 1 ? "#E9D9B0" : "#8B5A2B";
  const width = level === 1 ? 6 : 22;
  return (
    <g opacity={1 - p}>
      {Array.from({ length: n }, (_, k) => {
        const a0 = (k / n) * Math.PI * 2 + 0.06;
        const a1 = ((k + 1) / n) * Math.PI * 2 - 0.06;
        const mid = (a0 + a1) / 2;
        const d = (200 + random(`cv${k}`) * 300) * e;
        const ox = Math.cos(mid) * d;
        const oy = Math.sin(mid) * d + 220 * p * p;
        const arc = `M ${cx + Math.cos(a0) * r} ${cy + Math.sin(a0) * r} A ${r} ${r} 0 0 1 ${cx + Math.cos(a1) * r} ${cy + Math.sin(a1) * r}`;
        return (
          <path
            key={k}
            d={arc}
            transform={`translate(${ox} ${oy}) rotate(${(random(`cs${k}`) - 0.5) * 120 * e} ${cx + Math.cos(mid) * r} ${cy + Math.sin(mid) * r})`}
            fill="none"
            stroke={color}
            strokeWidth={width}
            strokeLinecap="round"
          />
        );
      })}
    </g>
  );
};

/** Verläufe, die Figur und Spielfeld teilen. */
const Gradients: React.FC<{ accent: string; accent2: string }> = ({ accent, accent2 }) => (
  <defs>
    <linearGradient id="chainMetal" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stopColor="#F4F6FA" />
      <stop offset="45%" stopColor="#9AA3B2" />
      <stop offset="100%" stopColor="#4B5260" />
    </linearGradient>
    <linearGradient id="chainMetalSide" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#E7EAF0" />
      <stop offset="100%" stopColor="#5A6170" />
    </linearGradient>
    <linearGradient id="lockBody" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stopColor="#B9C0CC" />
      <stop offset="100%" stopColor="#4A505C" />
    </linearGradient>
    <radialGradient id="discFree" cx="0.4" cy="0.35" r="0.8">
      <stop offset="0%" stopColor="#FFF6D6" />
      <stop offset="60%" stopColor={accent} />
      <stop offset="100%" stopColor={accent2} />
    </radialGradient>
    <radialGradient id="burst">
      <stop offset="0%" stopColor={accent} stopOpacity="0.85" />
      <stop offset="45%" stopColor={accent} stopOpacity="0.25" />
      <stop offset="100%" stopColor={accent} stopOpacity="0" />
    </radialGradient>
    <linearGradient id="keyGold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stopColor="#FFF3C4" />
      <stop offset="50%" stopColor="#F6C86A" />
      <stop offset="100%" stopColor="#C98A1E" />
    </linearGradient>
  </defs>
);

/** Lichtstoss mit Strahlen – beim Zerspringen. */
const Burst: React.FC<{ cx: number; cy: number; r: number; p: number; color: string; reach?: number }> = ({ cx, cy, r, p, color, reach = 760 }) => {
  const frame = useCurrentFrame();
  return (
    <g>
      <circle cx={cx} cy={cy} r={interpolate(p, [0, 1], [r, reach])} fill="url(#burst)" opacity={interpolate(p, [0, 0.15, 1], [0, 1, 0.35])} />
      {Array.from({ length: 14 }, (_, i) => {
        const a = (i / 14) * Math.PI * 2 + frame / 50;
        const r0 = r + 30;
        const r1 = r + 120 + (reach - 440) * Easing.out(Easing.cubic)(p);
        return (
          <path
            key={i}
            d={`M ${cx + Math.cos(a - 0.05) * r0} ${cy + Math.sin(a - 0.05) * r0} L ${cx + Math.cos(a) * r1} ${cy + Math.sin(a) * r1} L ${cx + Math.cos(a + 0.05) * r0} ${cy + Math.sin(a + 0.05) * r0} Z`}
            fill={color}
            opacity={0.28 * Math.min(1, p * 4)}
          />
        );
      })}
    </g>
  );
};

/** Der goldene Schlüssel aus dem Spiel. */
const KeyShape: React.FC = () => (
  <g>
    <circle cx={70} cy={0} r={30} fill="none" stroke="url(#keyGold)" strokeWidth={14} />
    <rect x={-40} y={-7} width={84} height={14} rx={6} fill="url(#keyGold)" />
    <rect x={-40} y={4} width={12} height={20} rx={3} fill="url(#keyGold)" />
    <rect x={-20} y={4} width={10} height={14} rx={3} fill="url(#keyGold)" />
  </g>
);

/* ---------------- Szene ---------------- */

export const ChainsScene: React.FC<{ ts: TimelineScene }> = ({ ts }) => {
  const s = ts.scene as ChainsSceneT;
  return s.field.length ? <ChainsField ts={ts} /> : <ChainsFigure ts={ts} />;
};

/* ---------------- Die Figur mit ihrem Ring ---------------- */

const ChainsFigure: React.FC<{ ts: TimelineScene }> = ({ ts }) => {
  const s = ts.scene as ChainsSceneT;
  const frame = useCurrentFrame();
  const look = useLook();
  const t = (frame - ts.audioOffsetFrames) / FPS;
  const arcade = look.id === "arcade";

  /* Stufen über die Zeit: jede Phrase eine Stufe, die letzte macht die Kette fertig */
  const steps = useMemo(() => {
    const out: Array<{ at: number; level: Level }> = [];
    s.cues.forEach((c, i) => {
      const level = (i === s.cues.length - 1 ? 3 : Math.min(3, s.from + i + 1)) as Level;
      out.push({ at: beat(ts, c, 0.6 + i * 1.2), level });
    });
    return out;
  }, [s.cues, s.from, ts]);
  let level = s.from as Level;
  let prev = s.from as Level;
  let stepAt = -Infinity;
  for (const st of steps) {
    if (t >= st.at) {
      prev = level;
      level = st.level;
      stepAt = st.at;
    }
  }

  const breakAt = s.breakAt ? beat(ts, s.breakAt, ts.speechEndSec - 0.6) : Infinity;
  const broken = t >= breakAt;
  const breakP = lerp(t, [breakAt, breakAt + 1.1], [0, 1], clamp);
  const keyMode = s.breakWith === "key";
  /* Der Schlüssel fliegt kurz vorher heran und dreht sich beim Stichwort */
  const keyIn = keyMode ? lerp(t, [breakAt - 0.9, breakAt - 0.15], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.4)) }) : 0;
  const keyTurn = keyMode ? lerp(t, [breakAt - 0.15, breakAt + 0.1], [0, 1], clamp) : 0;

  /* Masse */
  const cx = 540;
  const cy = 700;
  const R = 150;
  const ringBase = (lv: Level) => R + (lv === 1 ? 30 : lv === 2 ? 26 : 34);
  // Zuziehen: der neue Ring kommt von aussen und zieht sich zusammen
  const stepped = Number.isFinite(stepAt);
  const tight = stepped ? spring({ frame: frame - voiceFrame(ts, stepAt), fps: FPS, config: { damping: 11, stiffness: 140, mass: 0.8 } }) : 1;
  const ringR = ringBase(level) + (stepped ? (1 - tight) * 90 : 0);
  const shake = stepped && t - stepAt < 0.4 && t >= stepAt ? Math.sin((t - stepAt) * 70) * 9 * (1 - (t - stepAt) / 0.4) : 0;
  const entry = spring({ frame, fps: FPS, config: { damping: 16, stiffness: 130 } });

  const isEmoji = EMOJI.test(s.center);
  // Das Standardgesicht leidet mit: je enger, desto gequälter – und frei wieder froh
  const face = s.center === "🙂" ? (broken ? "😄" : level === 3 ? "😣" : level === 2 ? "😕" : "🙂") : s.center;
  const freed = broken ? Easing.out(Easing.cubic)(lerp(t, [breakAt, breakAt + 0.5], [0, 1], clamp)) : 0;
  const discFill = freed > 0 ? `url(#discFree)` : arcade ? "#140A2E" : "rgba(14,10,8,0.86)";

  const labelFont = look.label;
  const pillSize = arcade ? 22 : labelFont === "Cinzel" ? 34 : 30;
  const material = broken ? "Frei" : MATERIAL[level];
  const materialColor = broken ? look.accent : level === 1 ? "#E9D9B0" : level === 2 ? "#C98A4B" : "#C9CED6";

  return (
    <AbsoluteFill style={{ opacity: entry }}>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <Gradients accent={look.accent} accent2={look.accent2} />

        {/* Lichtstoss beim Zerspringen */}
        {broken ? <Burst cx={cx} cy={cy} r={R} p={breakP} color={look.accent} /> : null}

        <g transform={`translate(${shake} 0)`}>
          {/* Die Figur */}
          <circle cx={cx} cy={cy + 10} r={R} fill="rgba(0,0,0,0.4)" />
          <circle
            cx={cx}
            cy={cy}
            r={R * (1 + 0.06 * freed)}
            fill={discFill}
            stroke={freed > 0 ? "#FFF3C4" : look.accent}
            strokeWidth={arcade ? 7 : 6}
            style={{ filter: arcade || freed > 0 ? `drop-shadow(0 0 ${18 + 30 * freed}px ${look.accent})` : undefined }}
          />
          {/* Der alte Ring blendet aus, der neue zieht sich zu */}
          {stepped && t - stepAt < 0.35 && prev > 0 && !broken ? (
            <g opacity={1 - (t - stepAt) / 0.35}>
              <Ring level={prev} r={ringBase(prev)} cx={cx} cy={cy} />
            </g>
          ) : null}
          {!broken ? (
            <g opacity={stepped ? Math.min(1, tight * 1.6) : 1}>
              <Ring level={level} r={ringR} cx={cx} cy={cy} />
            </g>
          ) : (
            <Shards level={level} r={ringR} cx={cx} cy={cy} p={breakP} />
          )}
          {level === 3 && (!broken || breakP < 0.25) ? (
            <g opacity={broken ? 1 - breakP * 4 : stepped ? Math.min(1, tight * 1.6) : 1}>
              <Padlock x={cx} y={cy + ringR + 26} open={keyTurn} />
            </g>
          ) : null}
        </g>

        {/* Der Schlüssel aus dem Spiel */}
        {keyMode && keyIn > 0 && breakP < 1 ? (
          <g
            transform={`translate(${interpolate(keyIn, [0, 1], [1180, cx + 92])} ${cy + ringR + 34}) rotate(${-90 * keyTurn}) scale(${1 + 0.2 * breakP})`}
            opacity={1 - breakP}
            style={{ filter: "drop-shadow(0 0 16px rgba(246,200,106,0.9))" }}
          >
            <KeyShape />
          </g>
        ) : null}
      </svg>

      {/* Mitte: Emoji oder Wort */}
      <div
        style={{
          position: "absolute",
          left: cx - R,
          top: cy - R,
          width: 2 * R,
          height: 2 * R,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `translate(${shake}px, 0) scale(${1 + 0.06 * freed})`,
          fontFamily: isEmoji ? undefined : look.display,
          fontSize: isEmoji ? R * 1.05 : R * 0.82,
          lineHeight: 1,
          color: freed > 0.5 ? "#2A1A06" : look.text,
          textTransform: "uppercase",
          textShadow: isEmoji || freed > 0.5 ? undefined : look.glow,
        }}
      >
        {face}
      </div>
      {s.label ? (
        <div
          style={{
            position: "absolute",
            top: cy + ringBase(3) + (level === 3 && !broken ? 92 : 50),
            width: "100%",
            textAlign: "center",
            fontFamily: labelFont,
            fontSize: arcade ? 26 : 34,
            letterSpacing: arcade ? 2 : 4,
            color: look.text,
            opacity: 0.85,
          }}
        >
          {s.label}
        </div>
      ) : null}

      {/* Was gerade drum ist: Schnur, Strick, Kette – oder frei */}
      {level > 0 || broken ? (
        <div style={{ position: "absolute", top: cy - ringBase(3) - 150, width: "100%", display: "flex", justifyContent: "center" }}>
          <div
            key={material}
            style={{
              padding: arcade ? "16px 24px" : "10px 34px 12px",
              border: `4px solid ${materialColor}`,
              borderRadius: arcade ? 0 : 999,
              background: "rgba(8,6,14,0.72)",
              fontFamily: labelFont,
              fontWeight: 700,
              fontSize: broken ? pillSize * 1.5 : pillSize,
              letterSpacing: arcade ? 2 : 6,
              textTransform: "uppercase",
              color: materialColor,
              boxShadow: broken ? `0 0 30px ${look.accent}` : "0 8px 24px rgba(0,0,0,0.4)",
              transform: `scale(${broken ? interpolate(breakP, [0, 0.25], [0.6, 1], clamp) : stepped ? interpolate(tight, [0, 1], [1.25, 1]) : 1})`,
            }}
          >
            {material}
          </div>
        </div>
      ) : null}

      {/* Geräusche */}
      {steps.map((st, i) => (st.level > 0 ? <Sfx key={i} frame={voiceFrame(ts, st.at)} name={TIGHTEN_SFX[st.level as 1 | 2 | 3]} volume={0.42} /> : null))}
      {Number.isFinite(breakAt) ? (
        <>
          <Sfx frame={voiceFrame(ts, breakAt)} name={keyMode ? "unlock" : "clash"} volume={0.5} />
          <Sfx frame={voiceFrame(ts, breakAt) + 3} name="chime" volume={0.4} />
          <Sfx frame={voiceFrame(ts, breakAt) + 6} name="levelup" volume={0.3} />
        </>
      ) : null}
    </AbsoluteFill>
  );
};

/* ---------------- Spielvorschau: neun Plätze wie im Minispiel ---------------- */

/** Das Feld: drei mal drei Plätze zwischen Herzen und Untertiteln. */
const GRID = { left: 140, top: 380, cell: 250, gap: 25 } as const;
const BUBBLE_R = 66;
/** Wie im Spiel: als Schnur drei Punkte, als Strick zwei, als Kette einer – mit der Farbe der kleinen Zahl. */
const POINTS: Record<1 | 2 | 3, number> = { 1: 3, 2: 2, 3: 1 };
const BADGE: Record<1 | 2 | 3, string> = { 1: "#8B5CF6", 2: "#C2410C", 3: "#64748B" };

const slotCenter = (slot: number) => ({
  x: GRID.left + (slot % 3) * (GRID.cell + GRID.gap) + GRID.cell / 2,
  y: GRID.top + Math.floor(slot / 3) * (GRID.cell + GRID.gap) + GRID.cell / 2 - 16,
});

const Heart: React.FC<{ x: number; y: number; full: boolean; scale: number }> = ({ x, y, full, scale }) => (
  <path
    d="M 0 12 C 0 -4 -26 -6 -26 12 C -26 26 -8 34 0 44 C 8 34 26 26 26 12 C 26 -6 0 -4 0 12 Z"
    transform={`translate(${x} ${y - 20}) scale(${scale})`}
    fill={full ? "#EF4444" : "rgba(255,255,255,0.16)"}
    stroke={full ? "#FCA5A5" : "rgba(255,255,255,0.35)"}
    strokeWidth={3}
    style={{ filter: full ? "drop-shadow(0 0 10px rgba(239,68,68,0.7))" : undefined }}
  />
);

const ChainsField: React.FC<{ ts: TimelineScene }> = ({ ts }) => {
  const s = ts.scene as ChainsSceneT;
  const frame = useCurrentFrame();
  const look = useLook();
  const t = (frame - ts.audioOffsetFrames) / FPS;
  const arcade = look.id === "arcade";
  const entry = spring({ frame, fps: FPS, config: { damping: 16, stiffness: 130 } });

  /* Stufen wie bei der Figur – sie gelten für alle Notlügen auf dem Feld */
  const start = Math.max(1, s.from) as 1 | 2 | 3;
  const steps = useMemo(
    () => s.cues.map((c, i) => ({ at: beat(ts, c, 0.6 + i * 1.2), level: (i === s.cues.length - 1 ? 3 : Math.min(3, start + i + 1)) as 1 | 2 | 3 })),
    [s.cues, start, ts],
  );
  let level: 1 | 2 | 3 = start;
  let stepAt = -Infinity;
  for (const st of steps) {
    if (t >= st.at) {
      level = st.level;
      stepAt = st.at;
    }
  }
  const stepped = Number.isFinite(stepAt);
  const tight = stepped ? spring({ frame: frame - voiceFrame(ts, stepAt), fps: FPS, config: { damping: 11, stiffness: 140, mass: 0.8 } }) : 1;

  const breakAt = s.breakAt ? beat(ts, s.breakAt, ts.speechEndSec - 0.6) : Infinity;
  const keyMode = s.breakWith === "key" && Number.isFinite(breakAt);
  const keyAt = keyMode ? beat(ts, s.keyAt, breakAt - 1.4) : Infinity;
  const pickAt = s.pickAt ? beat(ts, s.pickAt, 1) : Infinity;
  const hurtAt = s.hurtAt ? beat(ts, s.hurtAt, 1) : Infinity;
  const broken = t >= breakAt;
  const breakP = lerp(t, [breakAt, breakAt + 1.1], [0, 1], clamp);

  const lies = s.field.map((x, j) => ({ ...x, appear: x.at ? beat(ts, x.at, 0.3 + j * 0.8) : -Infinity, ...slotCenter(x.slot) }));
  /* Die erste Notlüge tippt der Finger weg, die nächste schnappt zu */
  const picked = Number.isFinite(pickAt) ? 0 : -1;
  const hurt = Number.isFinite(hurtAt) && lies.length > picked + 1 ? picked + 1 : -1;
  const used = new Set(s.field.map((x) => x.slot));
  const keySlot = [4, 1, 0, 2, 3, 5, 6, 7, 8].find((k) => !used.has(k)) ?? 4;
  const key = slotCenter(keySlot);
  const pickLevel = steps.filter((st) => st.at <= pickAt).reduce<1 | 2 | 3>((_, st) => st.level, start);

  /* Herzen: drei; das Zuschnappen kostet eines, der Schlüssel bringt es zurück */
  const lost = hurt >= 0 && t >= hurtAt && !(keyMode && broken);
  const heartPop = (at: number) => lerp(t, [at, at + 0.12, at + 0.35], [1, 1.35, 1], clamp);

  /* Der Finger: erst zur Notlüge, dann zum Schlüssel */
  const target = t < pickAt + 0.6 && picked >= 0 ? { x: lies[picked].x, y: lies[picked].y, at: pickAt } : keyMode ? { x: key.x, y: key.y, at: breakAt } : null;
  const tapP = target ? lerp(t, [target.at - 0.55, target.at], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) }) : 0;
  const press = target ? lerp(t, [target.at, target.at + 0.08, target.at + 0.22], [1, 0.9, 1], clamp) : 1;
  const fingerOut = target ? lerp(t, [target.at + 0.3, target.at + 0.6], [1, 0], clamp) : 0;

  const cellFill = arcade ? "rgba(92,243,255,0.06)" : "rgba(255,255,255,0.06)";
  const cellEdge = arcade ? "rgba(92,243,255,0.28)" : "rgba(255,255,255,0.18)";
  const keyPulse = 0.5 + 0.5 * Math.sin(frame / 3);
  const keyPop = keyMode ? spring({ frame: frame - voiceFrame(ts, keyAt), fps: FPS, config: { damping: 12, stiffness: 190, mass: 0.6 } }) : 0;

  return (
    <AbsoluteFill style={{ opacity: entry }}>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <Gradients accent={look.accent} accent2={look.accent2} />

        {/* Die Herzen */}
        {[0, 1, 2].map((i) => (
          <Heart key={i} x={540 + (i - 1) * 84} y={GRID.top - 70} full={!(lost && i === 2)} scale={i === 2 ? heartPop(lost ? hurtAt : breakAt) : 1} />
        ))}

        {/* Die neun Plätze */}
        {Array.from({ length: 9 }, (_, k) => (
          <rect
            key={k}
            x={GRID.left + (k % 3) * (GRID.cell + GRID.gap)}
            y={GRID.top + Math.floor(k / 3) * (GRID.cell + GRID.gap)}
            width={GRID.cell}
            height={GRID.cell}
            rx={arcade ? 6 : 34}
            fill={cellFill}
            stroke={cellEdge}
            strokeWidth={3}
          />
        ))}

        {/* Lichtstoss, wenn der Schlüssel alles sprengt */}
        {broken ? <Burst cx={keyMode ? key.x : 540} cy={keyMode ? key.y : GRID.top + 400} r={BUBBLE_R} p={breakP} color={look.accent} reach={900} /> : null}

        {lies.map((lie, j) => {
          if (t < lie.appear) return null;
          const pop = Number.isFinite(lie.appear) ? spring({ frame: frame - voiceFrame(ts, lie.appear), fps: FPS, config: { damping: 12, stiffness: 200, mass: 0.6 } }) : 1;
          const age = Number.isFinite(lie.appear) ? t - lie.appear : 4;
          const lv = j === picked ? pickLevel : level;
          // Die Schnur zieht sich langsam zu; eine neue Stufe kommt von aussen
          const rr = BUBBLE_R + (lv === 1 ? 34 : lv === 2 ? 30 : 34) - 10 * Math.min(1, age / 4) + (stepped && j !== picked ? (1 - tight) * 50 : 0);
          if (j === hurt && t >= hurtAt + 0.9) return null;
          const pickedNow = j === picked && t >= pickAt;
          if (pickedNow || broken) {
            const p = pickedNow ? lerp(t, [pickAt, pickAt + 0.9], [0, 1], clamp) : breakP;
            return <Shards key={j} level={lv} r={rr} cx={lie.x} cy={lie.y} p={p} />;
          }
          // Zugeschnappt: kurz rot und zitternd – dann weg
          const snap = j === hurt && t >= hurtAt;
          const sx = snap ? Math.sin((t - hurtAt) * 70) * 8 * Math.max(0, 1 - (t - hurtAt) / 0.5) : 0;
          return (
            <g key={j} transform={`translate(${sx} 0)`} opacity={snap ? lerp(t, [hurtAt + 0.5, hurtAt + 0.9], [1, 0], clamp) : 1}>
              <g opacity={Math.min(1, pop * 1.4)}>
                <Ring level={snap ? 3 : lv} r={snap ? BUBBLE_R + 30 : rr} cx={lie.x} cy={lie.y} />
              </g>
              <circle cx={lie.x} cy={lie.y + 6} r={BUBBLE_R * pop} fill="rgba(0,0,0,0.35)" />
              <circle cx={lie.x} cy={lie.y} r={BUBBLE_R * pop} fill={snap ? "#FECACA" : "#FFFFFF"} />
              {!snap && pop > 0.5 ? (
                <g transform={`translate(${lie.x + BUBBLE_R * 0.95} ${lie.y - BUBBLE_R * 0.95})`}>
                  <circle r={24} fill={BADGE[lv]} stroke="#FFFFFF" strokeWidth={3} />
                  <text y={8} textAnchor="middle" fontFamily={theme.font.body} fontWeight={800} fontSize={22} fill="#FFFFFF">
                    +{POINTS[lv]}
                  </text>
                </g>
              ) : null}
            </g>
          );
        })}

        {/* Der Schlüssel der Wahrheit */}
        {keyMode && t >= keyAt && breakP < 1 ? (
          <g opacity={1 - breakP} transform={`translate(${key.x} ${key.y}) scale(${keyPop * (1 + 0.25 * breakP)})`}>
            <circle r={BUBBLE_R * (1.3 + 0.12 * keyPulse)} fill="#FDE68A" opacity={0.3 + 0.25 * keyPulse} />
            <circle r={BUBBLE_R} fill="#FFFBEB" stroke="#F59E0B" strokeWidth={6} style={{ filter: "drop-shadow(0 0 16px rgba(246,200,106,0.9))" }} />
            <g transform="translate(-16 0) rotate(-35) scale(0.62)">
              <KeyShape />
            </g>
          </g>
        ) : null}

        {/* +3, wenn die erste Schnur reisst */}
        {picked >= 0 && t >= pickAt && t < pickAt + 1.2 ? (
          <text
            x={lies[picked].x}
            y={lies[picked].y - 10 - lerp(t, [pickAt, pickAt + 1.2], [0, 120], clamp)}
            textAnchor="middle"
            fontFamily={arcade ? '"Press Start 2P"' : look.display}
            fontSize={arcade ? 54 : 90}
            fill={look.accent}
            opacity={lerp(t, [pickAt, pickAt + 0.1, pickAt + 0.9, pickAt + 1.2], [0, 1, 1, 0], clamp)}
            style={{ filter: `drop-shadow(0 0 12px ${look.accent})` }}
          >
            +{POINTS[pickLevel]}
          </text>
        ) : null}
      </svg>

      {/* Emoji und Notlüge, wie im Spiel unter der Blase */}
      {lies.map((lie, j) => {
        if (t < lie.appear) return null;
        const pop = Number.isFinite(lie.appear) ? spring({ frame: frame - voiceFrame(ts, lie.appear), fps: FPS, config: { damping: 12, stiffness: 200, mass: 0.6 } }) : 1;
        const snap = j === hurt && t >= hurtAt;
        if (snap && t >= hurtAt + 0.9) return null;
        const out =
          j === picked && t >= pickAt
            ? lerp(t, [pickAt, pickAt + 0.3], [1, 0], clamp)
            : broken
              ? lerp(t, [breakAt, breakAt + 0.3], [1, 0], clamp)
              : snap
                ? lerp(t, [hurtAt + 0.5, hurtAt + 0.9], [1, 0], clamp)
                : 1;
        if (out <= 0) return null;
        const sx = snap ? Math.sin((t - hurtAt) * 70) * 8 * Math.max(0, 1 - (t - hurtAt) / 0.5) : 0;
        return (
          <React.Fragment key={j}>
            <div
              style={{
                position: "absolute",
                left: lie.x - BUBBLE_R + sx,
                top: lie.y - BUBBLE_R,
                width: 2 * BUBBLE_R,
                height: 2 * BUBBLE_R,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 74,
                lineHeight: 1,
                opacity: out,
                transform: `scale(${pop * (2 - out)})`,
              }}
            >
              {lie.emoji}
            </div>
            <div style={{ position: "absolute", left: lie.x - GRID.cell / 2 + sx, width: GRID.cell, top: lie.y + BUBBLE_R + 14, display: "flex", justifyContent: "center", opacity: out * Math.min(1, pop) }}>
              <div
                style={{
                  padding: "6px 14px 8px",
                  borderRadius: arcade ? 0 : 14,
                  background: snap ? "#B91C1C" : "rgba(2,6,23,0.86)",
                  border: arcade ? `2px solid ${look.accent}` : undefined,
                  fontFamily: theme.font.body,
                  fontWeight: 800,
                  fontSize: 27,
                  lineHeight: 1.1,
                  color: "#FFFFFF",
                  whiteSpace: "nowrap",
                }}
              >
                {lie.text}
              </div>
            </div>
          </React.Fragment>
        );
      })}

      {/* Der Finger tippt */}
      {target && tapP > 0 && fingerOut > 0 ? (
        <div
          style={{
            position: "absolute",
            left: interpolate(tapP, [0, 1], [target.x + 200, target.x]) - 30,
            top: interpolate(tapP, [0, 1], [target.y + 360, target.y]) - 6,
            fontSize: 96,
            transform: `scale(${press})`,
            opacity: fingerOut,
          }}
        >
          👆
        </div>
      ) : null}

      {/* Geräusche */}
      {lies.map((lie, j) => (Number.isFinite(lie.appear) ? <Sfx key={`a${j}`} frame={voiceFrame(ts, lie.appear)} name="pop" volume={0.4} /> : null))}
      {steps.map((st, i) => (
        <Sfx key={`s${i}`} frame={voiceFrame(ts, st.at)} name={TIGHTEN_SFX[st.level]} volume={0.42} />
      ))}
      {picked >= 0 ? (
        <>
          <Sfx frame={voiceFrame(ts, pickAt)} name="clash" volume={0.42} />
          <Sfx frame={voiceFrame(ts, pickAt) + 3} name="coin" volume={0.4} />
        </>
      ) : null}
      {hurt >= 0 ? <Sfx frame={voiceFrame(ts, hurtAt)} name="glitch" volume={0.4} /> : null}
      {keyMode ? <Sfx frame={voiceFrame(ts, keyAt)} name="ding" volume={0.4} /> : null}
      {Number.isFinite(breakAt) ? (
        <>
          <Sfx frame={voiceFrame(ts, breakAt)} name={keyMode ? "unlock" : "clash"} volume={0.5} />
          <Sfx frame={voiceFrame(ts, breakAt) + 3} name="chime" volume={0.4} />
          <Sfx frame={voiceFrame(ts, breakAt) + 6} name="levelup" volume={0.3} />
        </>
      ) : null}
    </AbsoluteFill>
  );
};
