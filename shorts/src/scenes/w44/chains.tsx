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
 * aus dem Minispiel «Ketten sprengen». Mit `question` wird daraus die Spielvorschau: Frage oben,
 * Figur mit Schnur in der Mitte, zwei Antworten unten; die ehrliche wird angetippt, die Schnur reisst.
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
  const strand = (phase: number) => {
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

/* ---------------- Szene ---------------- */

export const ChainsScene: React.FC<{ ts: TimelineScene }> = ({ ts }) => {
  const s = ts.scene as ChainsSceneT;
  const frame = useCurrentFrame();
  const look = useLook();
  const t = (frame - ts.audioOffsetFrames) / FPS;
  const game = Boolean(s.question);
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
  const pickAt = s.pickAt ? beat(ts, s.pickAt, breakAt - 1) : Infinity;
  const broken = t >= breakAt;
  const breakP = lerp(t, [breakAt, breakAt + 1.1], [0, 1], clamp);
  const keyMode = s.breakWith === "key";
  /* Der Schlüssel fliegt kurz vorher heran und dreht sich beim Stichwort */
  const keyIn = keyMode ? lerp(t, [breakAt - 0.9, breakAt - 0.15], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.4)) }) : 0;
  const keyTurn = keyMode ? lerp(t, [breakAt - 0.15, breakAt + 0.1], [0, 1], clamp) : 0;
  /* Fünf ehrliche Antworten am Stück: die Serie füllt sich, bevor der Schlüssel kommt */
  const lastStep = steps.length ? steps[steps.length - 1].at : 0;
  const streak = keyMode ? lerp(t, [Math.max(lastStep + 0.8, breakAt - 3.4), breakAt - 1.0], [0, 5], clamp) : 0;

  /* Masse */
  const cx = 540;
  const cy = game ? 745 : 700;
  const R = game ? 104 : 150;
  const ringBase = (lv: Level) => R + (lv === 1 ? 30 : lv === 2 ? 26 : 34);
  // Zuziehen: der neue Ring kommt von aussen und zieht sich zusammen
  const tight = spring({ frame: frame - voiceFrame(ts, stepAt), fps: FPS, config: { damping: 11, stiffness: 140, mass: 0.8 } });
  const stepped = Number.isFinite(stepAt);
  // In der Spielvorschau zieht sich die Schnur langsam zu, solange gewartet wird
  const qAt = s.question ? beat(ts, s.question.at, 0.3) : 0;
  const squeeze = game && !broken ? lerp(t, [qAt, Math.min(pickAt, breakAt)], [0, 1], clamp) : 0;
  const ringR = ringBase(level) + (stepped ? (1 - tight) * 90 : 0) - squeeze * 10;
  const shake = stepped && t - stepAt < 0.4 && t >= stepAt ? Math.sin((t - stepAt) * 70) * 9 * (1 - (t - stepAt) / 0.4) : 0;
  const entry = spring({ frame, fps: FPS, config: { damping: 16, stiffness: 130 } });

  const isEmoji = EMOJI.test(s.center);
  const freed = broken ? Easing.out(Easing.cubic)(lerp(t, [breakAt, breakAt + 0.5], [0, 1], clamp)) : 0;
  const discFill = freed > 0 ? `url(#discFree)` : arcade ? "#140A2E" : "rgba(14,10,8,0.86)";

  /* Spielvorschau */
  const q = s.question;
  const qSp = q ? spring({ frame: frame - voiceFrame(ts, qAt), fps: FPS, config: { damping: 14, stiffness: 170 } }) : 0;
  const answers = s.answers.map((a) => ({ ...a, t: beat(ts, a.at, qAt + 1) }));
  const picked = t >= pickAt;
  const tapP = lerp(t, [pickAt - 0.55, pickAt], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const press = lerp(t, [pickAt, pickAt + 0.08, pickAt + 0.22], [1, 0.93, 1], clamp);
  const points = Math.max(1, 3 - Math.floor(squeeze * 2.2));

  const labelFont = look.label;
  const pillSize = arcade ? 22 : labelFont === "Cinzel" ? 34 : 30;
  const material = broken ? "Frei" : MATERIAL[level];
  const materialColor = broken ? look.accent : level === 1 ? "#E9D9B0" : level === 2 ? "#C98A4B" : "#C9CED6";

  return (
    <AbsoluteFill style={{ opacity: entry }}>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
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
            <stop offset="60%" stopColor={look.accent} />
            <stop offset="100%" stopColor={look.accent2} />
          </radialGradient>
          <radialGradient id="burst">
            <stop offset="0%" stopColor={look.accent} stopOpacity="0.85" />
            <stop offset="45%" stopColor={look.accent} stopOpacity="0.25" />
            <stop offset="100%" stopColor={look.accent} stopOpacity="0" />
          </radialGradient>
          <linearGradient id="keyGold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FFF3C4" />
            <stop offset="50%" stopColor="#F6C86A" />
            <stop offset="100%" stopColor="#C98A1E" />
          </linearGradient>
        </defs>

        {/* Lichtstoss beim Zerspringen */}
        {broken ? (
          <g>
            <circle cx={cx} cy={cy} r={interpolate(breakP, [0, 1], [R, 760])} fill="url(#burst)" opacity={interpolate(breakP, [0, 0.15, 1], [0, 1, 0.35])} />
            {Array.from({ length: 14 }, (_, i) => {
              const a = (i / 14) * Math.PI * 2 + frame / 50;
              const r0 = R + 30;
              const r1 = R + 120 + 320 * Easing.out(Easing.cubic)(breakP);
              return (
                <path
                  key={i}
                  d={`M ${cx + Math.cos(a - 0.05) * r0} ${cy + Math.sin(a - 0.05) * r0} L ${cx + Math.cos(a) * r1} ${cy + Math.sin(a) * r1} L ${cx + Math.cos(a + 0.05) * r0} ${cy + Math.sin(a + 0.05) * r0} Z`}
                  fill={look.accent}
                  opacity={0.28 * Math.min(1, breakP * 4)}
                />
              );
            })}
          </g>
        ) : null}

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
            <circle cx={70} cy={0} r={30} fill="none" stroke="url(#keyGold)" strokeWidth={14} />
            <rect x={-40} y={-7} width={84} height={14} rx={6} fill="url(#keyGold)" />
            <rect x={-40} y={4} width={12} height={20} rx={3} fill="url(#keyGold)" />
            <rect x={-20} y={4} width={10} height={14} rx={3} fill="url(#keyGold)" />
          </g>
        ) : null}

        {/* +3, wenn die Schnur in der Spielvorschau reisst */}
        {game && broken ? (
          <text
            x={cx + 150}
            y={cy - R - interpolate(breakP, [0, 1], [10, 120])}
            textAnchor="middle"
            fontFamily={arcade ? '"Press Start 2P"' : look.display}
            fontSize={arcade ? 54 : 90}
            fill={look.accent}
            opacity={interpolate(breakP, [0, 0.1, 0.8, 1], [0, 1, 1, 0])}
            style={{ filter: `drop-shadow(0 0 12px ${look.accent})` }}
          >
            +{points}
          </text>
        ) : null}
        {/* Punktewert der Schnur – wie im Spiel */}
        {game && !broken && level > 0 ? (
          <g transform={`translate(${cx + R * 0.95} ${cy - R * 0.95})`}>
            <circle r={30} fill={points === 3 ? "#7C3AED" : points === 2 ? "#B45309" : "#475569"} stroke="#FFFFFF" strokeWidth={3} />
            <text y={10} textAnchor="middle" fontFamily={theme.font.body} fontWeight={800} fontSize={28} fill="#FFFFFF">
              +{points}
            </text>
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
        {isEmoji && broken && game ? "😄" : s.center}
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
      {!game && (level > 0 || broken) ? (
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

      {/* Serie bis zum Schlüssel */}
      {keyMode && streak > 0 && breakP < 1 ? (
        <div style={{ position: "absolute", top: cy - ringBase(3) - 150, width: "100%", display: "flex", justifyContent: "center", gap: 16, opacity: 1 - breakP }}>
          {Array.from({ length: 5 }, (_, i) => {
            const on = streak >= i + 1;
            return (
              <div
                key={i}
                style={{
                  width: 74,
                  height: 74,
                  border: `5px solid ${on ? "#7CFF8A" : "rgba(255,255,255,0.25)"}`,
                  background: on ? "rgba(124,255,138,0.18)" : "rgba(0,0,0,0.35)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: '"Press Start 2P"',
                  fontSize: 30,
                  color: "#7CFF8A",
                  boxShadow: on ? "0 0 16px #7CFF8A" : "none",
                  transform: `scale(${on ? interpolate(streak - i - 1, [0, 0.4], [1.3, 1], clamp) : 1})`,
                }}
              >
                {on ? "✓" : ""}
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Spielvorschau: wer fragt was */}
      {q && qSp > 0.01 ? (
        <div
          style={{
            position: "absolute",
            left: 110,
            right: 110,
            top: 300,
            padding: "26px 34px 30px",
            borderRadius: arcade ? 0 : 36,
            background: "#FFFFFF",
            border: arcade ? `6px solid ${look.accent2}` : undefined,
            boxShadow: arcade ? `0 0 26px ${look.accent2}` : "0 20px 50px rgba(0,0,0,0.45)",
            transform: `scale(${interpolate(qSp, [0, 1], [0.6, 1])})`,
            opacity: qSp,
          }}
        >
          <div style={{ fontFamily: arcade ? '"Press Start 2P"' : theme.font.body, fontWeight: 800, fontSize: arcade ? 24 : 30, color: "#7C3AED", letterSpacing: arcade ? 1 : 2, textTransform: "uppercase" }}>{q.who} fragt</div>
          <div style={{ marginTop: 14, fontFamily: theme.font.body, fontWeight: 800, fontSize: 50, lineHeight: 1.15, color: "#10131F" }}>«{q.text}»</div>
          <div style={{ position: "absolute", left: 80, bottom: -30, width: 0, height: 0, borderLeft: "26px solid transparent", borderRight: "26px solid transparent", borderTop: "32px solid #FFFFFF" }} />
        </div>
      ) : null}

      {answers.length ? (
        <div style={{ position: "absolute", left: 70, right: 70, top: 990, display: "flex", gap: 30 }}>
          {answers.map((a, i) => {
            const sp = spring({ frame: frame - voiceFrame(ts, a.t), fps: FPS, config: { damping: 12, stiffness: 200, mass: 0.6 } });
            const chosen = picked && a.honest;
            const dimmed = picked && !a.honest;
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  minHeight: 170,
                  padding: "20px 22px",
                  borderRadius: arcade ? 0 : 30,
                  border: `5px solid ${chosen ? "#4ADE80" : arcade ? look.accent : "rgba(255,255,255,0.7)"}`,
                  background: chosen ? "#16A34A" : "rgba(20,12,44,0.88)",
                  boxShadow: chosen ? "0 0 34px #4ADE80" : arcade ? `0 0 14px ${look.accent}` : "0 12px 30px rgba(0,0,0,0.4)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                  fontFamily: theme.font.body,
                  fontWeight: 800,
                  fontSize: 44,
                  lineHeight: 1.12,
                  color: "#FFFFFF",
                  opacity: sp * (dimmed ? 0.35 : 1),
                  transform: `scale(${interpolate(sp, [0, 1], [0.5, 1]) * (a.honest ? press : 1)}) translateY(${interpolate(sp, [0, 1], [60, 0])}px)`,
                }}
              >
                {chosen ? "✓ " : ""}
                {a.text}
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Der Finger tippt auf die ehrliche Antwort */}
      {answers.length && Number.isFinite(pickAt) && tapP > 0 && t < pickAt + 1.2 ? (
        (() => {
          const honest = answers.findIndex((a) => a.honest);
          const w = (1080 - 140 - 30 * (answers.length - 1)) / answers.length;
          const tx = 70 + honest * (w + 30) + w * 0.62;
          const x = interpolate(tapP, [0, 1], [tx + 180, tx]);
          const y = interpolate(tapP, [0, 1], [1300, 1110]);
          return (
            <div style={{ position: "absolute", left: x - 40, top: y - 10, fontSize: 96, transform: `scale(${press})`, opacity: lerp(t, [pickAt + 0.8, pickAt + 1.2], [1, 0], clamp) }}>
              👆
            </div>
          );
        })()
      ) : null}

      {/* Geräusche */}
      {steps.map((st, i) => (st.level > 0 ? <Sfx key={i} frame={voiceFrame(ts, st.at)} name={TIGHTEN_SFX[st.level as 1 | 2 | 3]} volume={0.42} /> : null))}
      {q ? <Sfx frame={voiceFrame(ts, qAt)} name="pop" volume={0.45} /> : null}
      {answers.map((a, i) => (
        <Sfx key={`a${i}`} frame={voiceFrame(ts, a.t)} name="blip" volume={0.32} />
      ))}
      {Number.isFinite(pickAt) ? <Sfx frame={voiceFrame(ts, pickAt)} name="tick" volume={0.5} /> : null}
      {keyMode && Number.isFinite(breakAt)
        ? [1, 2, 3, 4, 5].map((k) => {
            const from = Math.max(lastStep + 0.8, breakAt - 3.4);
            const at = from + ((breakAt - 1.0 - from) * (k - 0.5)) / 5;
            return <Sfx key={`s${k}`} frame={voiceFrame(ts, at)} name="coin" volume={0.22} />;
          })
        : null}
      {Number.isFinite(breakAt) ? (
        <>
          <Sfx frame={voiceFrame(ts, breakAt)} name={keyMode ? "unlock" : "clash"} volume={0.5} />
          <Sfx frame={voiceFrame(ts, breakAt) + 3} name={game ? "coin" : "chime"} volume={0.4} />
          <Sfx frame={voiceFrame(ts, breakAt) + 6} name="levelup" volume={0.3} />
        </>
      ) : null}
    </AbsoluteFill>
  );
};
