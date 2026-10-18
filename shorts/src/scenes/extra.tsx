import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, random, spring, useCurrentFrame } from "remotion";
import { useLook } from "../looks";
import { Sfx, beat, beats, voiceFrame } from "../lib/sfx";
import { FPS, type TimelineScene, findCue } from "../lib/timing";
import type { Scene } from "../schema";
import { theme } from "../theme";
import { Sprite } from "./game";

/*
 * Kurze Szenen für die Einführungsvideos vor den interaktiven Karten:
 * Gegenüberstellung (Detektiv), Buzzer (Quizshow), Wortblöcke (Vers-Puzzle),
 * Liste und Schatzkarte (Kartentisch), Notizbuch und das Hüpfspiel (Game-Look).
 * Alle Zeitpunkte sind Phrasen aus der narration.
 */

type Of<T extends Scene["type"]> = Extract<Scene, { type: T }>;
type P = { ts: TimelineScene };
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const PIXEL = '"Press Start 2P"';
const HAND = "Caveat";

const useVoiceT = (ts: TimelineScene) => (useCurrentFrame() - ts.audioOffsetFrames) / FPS;

/** Rechteck mit rauer Kante – Pergament und Papier */
const roughRect = (x: number, y: number, w: number, h: number, seed: string, jag = 10) => {
  const pts: string[] = [];
  const j = (k: string) => (random(`${seed}${k}`) - 0.5) * jag;
  const n = 18;
  for (let i = 0; i <= n; i++) pts.push(`${x + (i / n) * w + j(`t${i}`)} ${y + j(`ty${i}`)}`);
  for (let i = 0; i <= n; i++) pts.push(`${x + w + j(`rx${i}`)} ${y + (i / n) * h + j(`r${i}`)}`);
  for (let i = n; i >= 0; i--) pts.push(`${x + (i / n) * w + j(`b${i}`)} ${y + h + j(`by${i}`)}`);
  for (let i = n; i >= 0; i--) pts.push(`${x + j(`lx${i}`)} ${y + (i / n) * h + j(`l${i}`)}`);
  return `M ${pts.join(" L ")} Z`;
};

/* ================================================================== */
/* Gegenüberstellung                                                   */
/* ================================================================== */

const SuspectFigure: React.FC<{ kind: Of<"lineup">["suspects"][number]["figure"]; x: number; y: number; lit: number; t: number }> = ({ kind, x, y, lit, t }) => {
  const body = "#0B0A0E";
  const rim = `rgba(255,210,122,${0.25 + 0.75 * lit})`;
  const stroke = { stroke: rim, strokeWidth: 3 };
  if (kind === "dream") {
    const bob = Math.sin(t * 2) * 10;
    return (
      <g transform={`translate(${x} ${y - 300 + bob})`}>
        <path d="M -110 40 Q -130 -20 -70 -30 Q -60 -90 0 -80 Q 50 -120 90 -60 Q 150 -50 130 20 Q 140 70 70 60 L -70 60 Q -130 70 -110 40 Z" fill="#1A1922" {...stroke} />
        {[0, 1, 2].map((k) => (
          <text key={k} x={60 + k * 28} y={-110 - k * 34 - ((t * 30 + k * 20) % 30)} fontFamily="Anton" fontSize={36 + k * 10} fill={rim} opacity={0.8}>
            Z
          </text>
        ))}
      </g>
    );
  }
  if (kind === "mothers") {
    return (
      <g transform={`translate(${x} ${y})`}>
        {[-50, 50].map((dx, i) => (
          <g key={i} transform={`translate(${dx} ${i ? 10 : 0}) scale(${i ? 0.95 : 1})`}>
            <path d="M -50 0 L -26 -190 L 26 -190 L 52 0 Z" fill={body} {...stroke} />
            <path d="M -26 -186 L -20 -280 L 22 -280 L 28 -186 Z" fill={body} {...stroke} />
            <circle cx={2} cy={-312} r={28} fill={body} {...stroke} />
            <path d="M -30 -310 Q -10 -360 32 -332 L -38 -250 Z" fill={body} {...stroke} />
          </g>
        ))}
      </g>
    );
  }
  if (kind === "enemies") {
    return (
      <g transform={`translate(${x} ${y})`}>
        {[-55, 55].map((dx, i) => (
          <g key={i} transform={`translate(${dx} 0)`}>
            <path d="M -30 -200 Q 0 -214 30 -200 L 26 -120 L 32 -60 L 18 -60 L 15 0 L 4 0 L 2 -60 L -2 -60 L -4 0 L -15 0 L -18 -60 L -32 -60 L -26 -120 Z" fill={body} {...stroke} />
            <circle cx={0} cy={-232} r={24} fill={body} {...stroke} />
            <rect x={i ? -46 : 38} y={-340} width={6} height={250} fill={body} {...stroke} />
            <path d={`M ${i ? -43 : 41} -372 L ${i ? -33 : 51} -338 L ${i ? -53 : 31} -338 Z`} fill={body} {...stroke} />
          </g>
        ))}
      </g>
    );
  }
  // Hauptmann: Helm mit Federbusch, Banner an der Stange
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={52} y={-420} width={7} height={420} fill={body} {...stroke} />
      <path d={`M 59 -414 Q 120 ${-400 + Math.sin(t * 3) * 8} 160 -390 L 160 -300 Q 120 ${-310 + Math.sin(t * 3 + 1) * 8} 59 -320 Z`} fill="#3A1E22" {...stroke} />
      <path d="M -36 -220 Q 0 -236 36 -220 L 31 -132 L 38 -66 L 22 -66 L 18 0 L 5 0 L 3 -66 L -3 -66 L -5 0 L -18 0 L -22 -66 L -38 -66 L -31 -132 Z" fill={body} {...stroke} />
      <circle cx={0} cy={-256} r={27} fill={body} {...stroke} />
      <path d="M -30 -270 Q 0 -310 30 -270 Z" fill={body} {...stroke} />
      <path d="M -6 -300 Q 30 -360 -10 -380 Q 10 -340 -24 -300 Z" fill={body} {...stroke} />
    </g>
  );
};

export const LineupScene: React.FC<P> = ({ ts }) => {
  const s = ts.scene as Of<"lineup">;
  const frame = useCurrentFrame();
  const look = useLook();
  const t = useVoiceT(ts);
  const n = s.suspects.length;
  const xs = s.suspects.map((_, i) => 80 + ((i + 0.5) * 920) / n);
  const ats = s.suspects.map((x, i) => beat(ts, x.at, 0.5 + i * 0.8));
  const current = ats.reduce((acc, a, i) => (t >= a - 0.05 ? i : acc), -1);
  const lastAt = ats[ats.length - 1] ?? 0;
  // Nach dem letzten Namen wandert das Licht über alle – unentschieden
  const sweep = t > lastAt + 0.9;
  // Danach geht der Lichtkegel aus und alle stehen gleich da – das Video verrät die Antwort nicht
  const spotOff = interpolate(t, [lastAt + 0.9, lastAt + 1.3], [1, 0], clamp);
  const spotX = current >= 0 ? xs[current] : 540 + Math.sin(t * 1.4) * 300;
  const FLOOR = 1110;
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id="spot" cx="0.5" cy="0" r="1">
            <stop offset="0%" stopColor="#FFE7B8" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#FFE7B8" stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* Wand mit Messlatte */}
        <rect x={60} y={300} width={960} height={FLOOR - 300} fill="#1B181D" />
        {Array.from({ length: 9 }, (_, i) => {
          const y = FLOOR - 70 - i * 80;
          return (
            <g key={i}>
              <line x1={60} y1={y} x2={1020} y2={y} stroke="#FFFFFF" strokeOpacity={0.13} strokeWidth={3} />
              <text x={74} y={y - 8} fontFamily={theme.font.body} fontWeight={700} fontSize={22} fill="#FFFFFF" opacity={0.3}>
                {120 + i * 10}
              </text>
            </g>
          );
        })}
        <rect x={60} y={FLOOR} width={960} height={10} fill="#2C2730" />
        {/* Lichtkegel */}
        <g opacity={spotOff}>
          <path d={`M ${spotX - 30} 290 L ${spotX + 30} 290 L ${spotX + 190} ${FLOOR} L ${spotX - 190} ${FLOOR} Z`} fill="url(#spot)" />
          <ellipse cx={spotX} cy={FLOOR} rx={190} ry={26} fill="#FFE7B8" opacity={0.22} />
        </g>
        {s.suspects.map((x, i) => {
          const lit = sweep ? 0.45 : i === current ? 1 : 0;
          return (
            <g key={i} opacity={0.5 + 0.5 * lit}>
              <SuspectFigure kind={x.figure} x={xs[i]} y={FLOOR} lit={lit} t={t} />
            </g>
          );
        })}
      </svg>
      {/* Namensschilder */}
      {s.suspects.map((x, i) => {
        const on = sweep ? 0 : i === current ? 1 : 0;
        const pop = spring({ frame: frame - voiceFrame(ts, ats[i]), fps: FPS, config: { damping: 12, stiffness: 200 } });
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: xs[i] - 110,
              width: 220,
              top: FLOOR + 22,
              padding: "10px 8px",
              textAlign: "center",
              background: on > 0.5 ? look.accent : "#E9E4DA",
              color: "#120F12",
              fontFamily: theme.font.body,
              fontWeight: 800,
              fontSize: x.name.length > 12 ? 24 : 28,
              lineHeight: 1.1,
              borderRadius: 6,
              transform: `rotate(${(i % 2 ? 1 : -1) * 2}deg) scale(${0.85 + 0.15 * pop})`,
              boxShadow: "0 8px 20px rgba(0,0,0,0.5)",
            }}
          >
            {x.name}
          </div>
        );
      })}
      {s.title ? (
        <div style={{ position: "absolute", top: 320, right: 90, padding: "12px 22px", background: "#F2D46B", color: "#2A2108", fontFamily: HAND, fontWeight: 700, fontSize: 44, transform: "rotate(4deg)", boxShadow: "0 8px 20px rgba(0,0,0,0.4)" }}>
          {s.title}
        </div>
      ) : null}
      {sweep ? (
        <div style={{ position: "absolute", top: 560, width: "100%", textAlign: "center", fontFamily: "Anton", fontSize: 260, color: look.accent, opacity: interpolate(t, [lastAt + 0.9, lastAt + 1.3], [0, 0.9], clamp), textShadow: "0 0 40px rgba(255,210,122,0.5)" }}>
          ?
        </div>
      ) : null}
      {ats.map((a, i) => (
        <React.Fragment key={i}>
          <Sfx frame={voiceFrame(ts, a)} name="tick" volume={0.5} />
          <Sfx frame={voiceFrame(ts, a)} name="drum" volume={0.18} />
        </React.Fragment>
      ))}
      <Sfx frame={voiceFrame(ts, lastAt + 0.9)} name="question" volume={0.35} />
    </AbsoluteFill>
  );
};

/* ================================================================== */
/* Buzzer                                                              */
/* ================================================================== */

export const BuzzerScene: React.FC<P> = ({ ts }) => {
  const s = ts.scene as Of<"buzzer">;
  const frame = useCurrentFrame();
  const look = useLook();
  const t = useVoiceT(ts);
  const cue = s.at ? findCue(ts.words, s.at) : null;
  const at = cue ? ts.words[cue.first].start : 0.1;
  const show = spring({ frame: frame - voiceFrame(ts, at - 0.1), fps: FPS, config: { damping: 15, stiffness: 140 } });
  const tokens = s.statement.split(/\s+/);
  const stCue = findCue(ts.words, s.statement);
  // Countdown, sobald die Aussage steht
  const cdStart = (stCue ? ts.words[stCue.last].end : at + 2) + 0.2;
  const left = Math.max(0, 3 - Math.floor(t - cdStart));
  const counting = t >= cdStart;
  return (
    <AbsoluteFill>
      {/* Leinwand */}
      <div
        style={{
          position: "absolute",
          left: 80,
          right: 80,
          top: 300,
          height: 470,
          borderRadius: 30,
          border: `5px solid ${look.accent2}`,
          background: "radial-gradient(circle, rgba(57,213,255,0.16) 1.5px, rgba(0,0,0,0) 2px) 0 0 / 14px 14px, linear-gradient(180deg, #0D0A2A, #160F3D)",
          boxShadow: `0 0 50px ${look.accent2}66, inset 0 0 60px rgba(0,0,0,0.6)`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 54px",
          opacity: show,
          transform: `scale(${interpolate(show, [0, 1], [0.85, 1])})`,
        }}
      >
        <div style={{ fontFamily: theme.font.body, fontWeight: 800, fontSize: 30, letterSpacing: "0.22em", color: look.accent, marginBottom: 24 }}>FAKT ODER MYTHOS?</div>
        <div style={{ fontFamily: theme.font.body, fontWeight: 800, fontSize: s.statement.length > 70 ? 50 : 58, lineHeight: 1.18, textAlign: "center" }}>
          {tokens.map((tok, i) => {
            const w = stCue ? ts.words[stCue.first + i] : null;
            const o = w ? interpolate(t, [w.start - 0.05, w.start + 0.15], [0.15, 1], clamp) : 1;
            return (
              <span key={i} style={{ color: "#FFFFFF", opacity: o }}>
                {i === 0 ? "«" : ""}
                {tok}
                {i === tokens.length - 1 ? "»" : ""}
                {i < tokens.length - 1 ? " " : ""}
              </span>
            );
          })}
        </div>
      </div>
      {/* Countdown */}
      <div style={{ position: "absolute", top: 800, width: "100%", textAlign: "center", fontFamily: "Anton", fontSize: 110, color: look.accent, opacity: counting ? 1 : 0, textShadow: `0 0 30px ${look.accent}` }}>
        {left > 0 ? left : "?"}
      </div>
      {/* Buzzer */}
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        {[
          { x: 300, c: "#22C55E", d: "#15803D", label: s.buttons[0], ph: 0 },
          { x: 780, c: "#EF4444", d: "#B91C1C", label: s.buttons[1], ph: Math.PI },
        ].map((b, i) => {
          const glow = 0.5 + 0.5 * Math.sin(frame / 6 + b.ph);
          const press = counting && Math.floor(t * 2.5) % 2 === i ? 8 : 0;
          return (
            <g key={i} transform={`translate(${b.x} 1050)`} opacity={show}>
              <ellipse cx={0} cy={70} rx={170} ry={44} fill="#0A0620" />
              <rect x={-150} y={10} width={300} height={60} fill="#2B2350" />
              <ellipse cx={0} cy={70} rx={150} ry={40} fill="#2B2350" />
              <ellipse cx={0} cy={10} rx={150} ry={40} fill="#3B3170" />
              <ellipse cx={0} cy={press - 10} rx={120} ry={34} fill={b.d} />
              <ellipse cx={0} cy={press - 22} rx={120} ry={34} fill={b.c} style={{ filter: `drop-shadow(0 0 ${20 + 30 * glow}px ${b.c})` }} />
              <ellipse cx={-30} cy={press - 34} rx={46} ry={12} fill="#FFFFFF" opacity={0.35} />
              <text y={150} textAnchor="middle" fontFamily="Anton" fontSize={64} fill="#FFFFFF" letterSpacing={3}>
                {b.label.toUpperCase()}
              </text>
            </g>
          );
        })}
      </svg>
      <Sfx frame={voiceFrame(ts, at - 0.1)} name="whoosh" volume={0.35} />
      {[0, 1, 2, 3].map((k) => (
        <Sfx key={k} frame={voiceFrame(ts, cdStart + k)} name={k < 3 ? "tick" : "question"} volume={0.4} />
      ))}
    </AbsoluteFill>
  );
};

/* ================================================================== */
/* Wortblöcke                                                          */
/* ================================================================== */

const BLOCK_COLORS = ["#5CF3FF", "#FF4FD8", "#FFE66D", "#7CFF8A", "#FF9B5C", "#B48CFF"];

export const BlocksScene: React.FC<P> = ({ ts }) => {
  const s = ts.scene as Of<"blocks">;
  const frame = useCurrentFrame();
  const look = useLook();
  const t = useVoiceT(ts);
  const X = 160;
  const W = 760;
  const BOTTOM = 1160;
  const TOP = 560;
  const H = 112;
  // Gemischt – aber immer gleich gemischt
  const layout = useMemo(() => {
    const order = s.words.map((w, i) => ({ w, k: random(`blk${w}${i}`) })).sort((a, b) => a.k - b.k).map((x) => x.w);
    // Reihen wie beim Tetris: so viele Blöcke, wie hineinpassen, dann auf die volle Breite gestreckt
    const rows: string[][] = [[]];
    const need = (w: string) => Math.max(150, w.length * 32 + 70);
    let used = 0;
    for (const w of order) {
      if (used + need(w) > W && rows[rows.length - 1].length) {
        rows.push([]);
        used = 0;
      }
      rows[rows.length - 1].push(w);
      used += need(w);
    }
    const out: { w: string; x: number; y: number; width: number; color: string }[] = [];
    let k = 0;
    rows.forEach((row, r) => {
      const total = row.reduce((a, w) => a + need(w), 0);
      let cx = 0;
      for (const w of row) {
        const width = (need(w) / total) * W;
        out.push({ w, x: X + cx, y: BOTTOM - (r + 1) * H, width, color: BLOCK_COLORS[k % BLOCK_COLORS.length] });
        cx += width;
        k += 1;
      }
    });
    return out;
  }, [s.words]);
  const n = layout.length;
  const span = Math.max(1.5, ts.speechEndSec * 0.85);
  return (
    <AbsoluteFill>
      {/* Schacht */}
      <div style={{ position: "absolute", left: X - 14, top: TOP, width: W + 28, height: BOTTOM - TOP + 14, border: `6px solid ${look.accent}`, borderTop: "none", boxShadow: `0 0 24px ${look.accent}88`, background: "linear-gradient(rgba(255,255,255,0.04) 2px, transparent 2px) 0 0 / 100% 112px, rgba(8,2,26,0.55)" }} />
      {layout.map((b, i) => {
        const at = s.mode === "fall" ? (i / n) * span : -10;
        const land = interpolate(t, [at, at + 0.45], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
        const bounce = s.mode === "fall" ? Math.max(0, Math.sin(Math.min(1, (t - at - 0.45) / 0.25) * Math.PI)) * -14 * (t > at + 0.45 ? 1 : 0) : 0;
        const y = interpolate(land, [0, 1], [-160, b.y]) + bounce;
        const shake = s.mode === "stack" ? Math.sin(frame * 1.7 + i * 2) * 3 + (Math.floor(frame / 9 + i) % 7 === 0 ? 8 : 0) : 0;
        if (s.mode === "fall" && t < at) return null;
        return (
          <React.Fragment key={i}>
            {s.mode === "fall" ? <Sfx frame={voiceFrame(ts, at + 0.45)} name="blip" volume={0.28} /> : null}
            <div
              style={{
                position: "absolute",
                left: b.x + 3 + shake,
                top: y + 3,
                width: b.width - 6,
                height: H - 6,
                background: b.color,
                borderTop: "8px solid rgba(255,255,255,0.55)",
                borderLeft: "8px solid rgba(255,255,255,0.35)",
                borderBottom: "8px solid rgba(0,0,0,0.3)",
                borderRight: "8px solid rgba(0,0,0,0.22)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: PIXEL,
                fontSize: 30,
                color: "#120A2A",
                boxSizing: "border-box",
              }}
            >
              {b.w}
            </div>
          </React.Fragment>
        );
      })}
      {s.mode === "stack" ? (
        <div style={{ position: "absolute", top: 330, width: "100%", textAlign: "center", fontFamily: PIXEL, fontSize: 130, color: look.accent2, opacity: 0.6 + 0.4 * Math.sin(frame / 5), textShadow: `0 0 30px ${look.accent2}` }}>
          ?
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

/* ================================================================== */
/* Liste auf Pergament                                                 */
/* ================================================================== */

const INK = "#3B2A1A";

export const LedgerScene: React.FC<P> = ({ ts }) => {
  const s = ts.scene as Of<"ledger">;
  const t = useVoiceT(ts);
  const edge = useMemo(() => roughRect(150, 280, 780, 890, "ledger"), []);
  const ats = s.lines.map((l, i) => beat(ts, l.at, 0.5 + i));
  const rowY = (i: number) => 560 + i * 150;
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id="ledgerParch" cx="0.45" cy="0.35" r="0.9">
            <stop offset="0%" stopColor="#F3E4C2" />
            <stop offset="75%" stopColor="#E0C793" />
            <stop offset="100%" stopColor="#BFA06A" />
          </radialGradient>
        </defs>
        <g transform="rotate(-1.5 540 725)">
          <path d={edge} fill="rgba(0,0,0,0.45)" transform="translate(12 16)" />
          <path d={edge} fill="url(#ledgerParch)" />
          <text x={540} y={390} textAnchor="middle" fontFamily={HAND} fontWeight={700} fontSize={72} fill={INK}>
            {s.title}
          </text>
          <path d="M 240 422 Q 540 440 840 418" stroke={INK} strokeWidth={4} fill="none" opacity={0.7} />
          {s.lines.map((l, i) => {
            const at = ats[i];
            const write = interpolate(t, [at - 0.05, at + 0.55], [0, 1], { ...clamp, easing: Easing.out(Easing.quad) });
            const mark = interpolate(t, [at + 0.45, at + 0.85], [0, 1], clamp);
            const y = rowY(i);
            return (
              <g key={i}>
                <clipPath id={`lw${i}`}>
                  <rect x={200} y={y - 70} width={680 * write} height={100} />
                </clipPath>
                <g clipPath={`url(#lw${i})`}>
                  <text x={220} y={y} fontFamily={HAND} fontWeight={700} fontSize={66} fill={INK}>
                    {l.label}
                  </text>
                  <text x={770} y={y} textAnchor="end" fontFamily={HAND} fontWeight={700} fontSize={76} fill={INK}>
                    {l.value}
                  </text>
                </g>
                <line x1={220} y1={y + 26} x2={860} y2={y + 26} stroke={INK} strokeOpacity={0.18} strokeWidth={2} />
                {l.mark === "check" ? (
                  <path d={`M 800 ${y - 22} L 818 ${y} L 852 ${y - 46}`} stroke="#2F6B2B" strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" fill="none" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - mark} />
                ) : null}
                {l.mark === "cross" ? (
                  <path d={`M 804 ${y - 44} L 848 ${y} M 848 ${y - 44} L 804 ${y}`} stroke="#9C2A22" strokeWidth={9} strokeLinecap="round" fill="none" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - mark} />
                ) : null}
                {l.mark === "circle" ? (
                  <ellipse cx={735} cy={y - 20} rx={85} ry={56} stroke="#B5302A" strokeWidth={8} fill="none" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - mark} transform={`rotate(-6 735 ${y - 20})`} />
                ) : null}
              </g>
            );
          })}
        </g>
      </svg>
      {ats.map((a, i) => (
        <React.Fragment key={i}>
          <Sfx frame={voiceFrame(ts, a)} name="type" volume={0.22} />
          {s.lines[i].mark !== "none" ? <Sfx frame={voiceFrame(ts, a + 0.5)} name={s.lines[i].mark === "circle" ? "stamp" : "tick"} volume={0.4} /> : null}
        </React.Fragment>
      ))}
    </AbsoluteFill>
  );
};

/* ================================================================== */
/* Schatzkarte                                                         */
/* ================================================================== */

export const TreasureScene: React.FC<P> = ({ ts }) => {
  const s = ts.scene as Of<"treasure">;
  const frame = useCurrentFrame();
  const t = useVoiceT(ts);
  const [pathAt, xAt] = beats(ts, s.cues, 2);
  const edge = useMemo(() => roughRect(70, 270, 940, 900, "treasure", 16), []);
  const draw = interpolate(t, [pathAt, pathAt + 1.6], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const xIn = spring({ frame: frame - voiceFrame(ts, xAt), fps: FPS, config: { damping: 9, stiffness: 160 } });
  const route = "M 200 1060 C 260 940, 420 1000, 430 880 S 280 720, 420 640 S 700 700, 760 560";
  const trees = useMemo(() => Array.from({ length: 14 }, (_, i) => ({ x: 140 + random(`tt${i}`) * 820, y: 330 + random(`tty${i}`) * 220 })), []);
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id="tParch" cx="0.45" cy="0.4" r="0.85">
            <stop offset="0%" stopColor="#F2E2BE" />
            <stop offset="70%" stopColor="#E0C793" />
            <stop offset="100%" stopColor="#B99A62" />
          </radialGradient>
          <radialGradient id="tGlow">
            <stop offset="0%" stopColor="#FFE7A8" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#FFE7A8" stopOpacity="0" />
          </radialGradient>
        </defs>
        <path d={edge} fill="rgba(0,0,0,0.45)" transform="translate(12 16)" />
        <path d={edge} fill="url(#tParch)" />
        {trees.map((tr, i) => (
          <path key={i} d={`M ${tr.x - 16} ${tr.y + 14} L ${tr.x} ${tr.y - 20} L ${tr.x + 16} ${tr.y + 14} Z`} fill="#5F7444" opacity={0.75} />
        ))}
        {/* Weg */}
        <path d={route} stroke={INK} strokeWidth={8} strokeDasharray="4 18" strokeLinecap="round" fill="none" opacity={0.25} />
        <path d={route} stroke="#B5302A" strokeWidth={9} strokeDasharray="4 18" strokeLinecap="round" fill="none" opacity={draw > 0 ? 1 : 0} mask="url(#routeMask)" />
        <mask id="routeMask">
          <path d={route} stroke="white" strokeWidth={30} fill="none" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
        </mask>
        {/* Start: Fussspuren */}
        <text x={150} y={1120} fontFamily={HAND} fontWeight={700} fontSize={46} fill={INK}>
          Du
        </text>
        {/* Ziel */}
        <g transform={`translate(760 560) scale(${xIn})`}>
          <circle r={150} fill="url(#tGlow)" opacity={0.7} />
          <path d="M -48 -48 L 48 48 M 48 -48 L -48 48" stroke="#B5302A" strokeWidth={18} strokeLinecap="round" />
        </g>
        <g transform={`translate(760 700)`} opacity={xIn}>
          <rect x={-70} y={-30} width={140} height={86} rx={10} fill="#8A5A2B" stroke={INK} strokeWidth={5} />
          <path d={`M -70 -30 Q 0 ${-90 - 20 * xIn} 70 -30 Z`} fill="#A06A34" stroke={INK} strokeWidth={5} transform={`rotate(${-22 * xIn} -70 -30)`} />
          <rect x={-10} y={-6} width={20} height={26} fill="#F6C86A" stroke={INK} strokeWidth={3} />
        </g>
        <g transform="translate(540 420) rotate(-4)" opacity={xIn}>
          <rect x={-250} y={-60} width={500} height={110} rx={14} fill="#F7EBD0" stroke={INK} strokeWidth={5} />
          <text textAnchor="middle" y={22} fontFamily={HAND} fontWeight={700} fontSize={72} fill={INK}>
            {s.target}
          </text>
        </g>
        {/* Lupe wandert den Weg entlang */}
        <g opacity={draw > 0 && draw < 1 ? 1 : 0}>
          <circle cx={200 + 560 * draw} cy={1060 - 500 * draw} r={46} fill="rgba(255,255,255,0.25)" stroke={INK} strokeWidth={8} />
          <line x1={232 + 560 * draw} y1={1092 - 500 * draw} x2={276 + 560 * draw} y2={1136 - 500 * draw} stroke={INK} strokeWidth={14} strokeLinecap="round" />
        </g>
      </svg>
      <Sfx frame={voiceFrame(ts, pathAt)} name="whoosh" volume={0.3} />
      <Sfx frame={voiceFrame(ts, xAt)} name="stamp" volume={0.5} />
      <Sfx frame={voiceFrame(ts, xAt) + 4} name="unlock" volume={0.3} />
    </AbsoluteFill>
  );
};

/* ================================================================== */
/* Notizbuch                                                           */
/* ================================================================== */

const BLUE_INK = "#23395B";

const Doodle: React.FC<{ icon: Of<"journal">["entries"][number]["icon"]; x: number; y: number; p: number }> = ({ icon, x, y, p }) => {
  const st = { stroke: BLUE_INK, strokeWidth: 6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none", pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - p };
  const paths: Record<string, string[]> = {
    runner: ["M 6 -40 m -10 0 a 10 10 0 1 0 20 0 a 10 10 0 1 0 -20 0", "M 4 -28 L -4 0 L -22 22 M -4 0 L 14 20 M 2 -20 L -18 -12 M 2 -20 L 20 -8"],
    shield: ["M 0 -44 L 34 -30 L 30 6 Q 22 30 0 44 Q -22 30 -30 6 L -34 -30 Z", "M 0 -24 L 0 24 M -16 -2 L 16 -2"],
    sword: ["M 0 -46 L 8 -36 L 8 18 L -8 18 L -8 -36 Z", "M -24 18 L 24 18 M 0 18 L 0 40"],
    heart: ["M 0 36 Q -40 6 -34 -18 Q -26 -40 0 -22 Q 26 -40 34 -18 Q 40 6 0 36 Z"],
    star: ["M 0 -40 L 12 -12 L 40 -10 L 18 8 L 26 36 L 0 20 L -26 36 L -18 8 L -40 -10 L -12 -12 Z"],
  };
  return (
    <g transform={`translate(${x} ${y})`}>
      {paths[icon].map((d, i) => (
        <path key={i} d={d} {...st} />
      ))}
    </g>
  );
};

export const JournalScene: React.FC<P> = ({ ts }) => {
  const s = ts.scene as Of<"journal">;
  const look = useLook();
  const t = useVoiceT(ts);
  const ats = s.entries.map((e, i) => beat(ts, e.at, 0.6 + i));
  const X = 120;
  const Y = 280;
  const W = 840;
  const H = 890;
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <g transform={`rotate(-1.2 540 725)`}>
          <rect x={X + 10} y={Y + 16} width={W} height={H} rx={18} fill="rgba(0,0,0,0.45)" />
          <rect x={X} y={Y} width={W} height={H} rx={18} fill="#FBF6E9" />
          {Array.from({ length: 13 }, (_, i) => (
            <line key={i} x1={X + 20} y1={Y + 130 + i * 62} x2={X + W - 20} y2={Y + 130 + i * 62} stroke="#9CC3E6" strokeWidth={2.5} />
          ))}
          <line x1={X + 120} y1={Y} x2={X + 120} y2={Y + H} stroke="#E7848A" strokeWidth={3} />
          {Array.from({ length: 11 }, (_, i) => (
            <circle key={i} cx={X + 40} cy={Y + 60 + i * 78} r={14} fill="#123036" />
          ))}
          <text x={X + 150} y={Y + 104} fontFamily={HAND} fontWeight={700} fontSize={Math.min(66, 640 / (0.43 * s.title.length))} fill={BLUE_INK}>
            {s.title}
          </text>
          {s.entries.map((e, i) => {
            const at = ats[i];
            const write = interpolate(t, [at - 0.05, at + 0.7], [0, 1], { ...clamp, easing: Easing.out(Easing.quad) });
            const doodle = interpolate(t, [at, at + 0.9], [0, 1], clamp);
            const hl = interpolate(t, [at + 0.7, at + 1.1], [0, 1], clamp);
            const y = Y + 300 + i * 210;
            return (
              <g key={i}>
                <rect x={X + 150} y={y - 54} width={(W - 190) * hl} height={68} fill={look.accent} opacity={0.38} rx={8} />
                <clipPath id={`jw${i}`}>
                  <rect x={X + 140} y={y - 80} width={(W - 160) * write} height={120} />
                </clipPath>
                <text x={X + 250} y={y} fontFamily={HAND} fontWeight={700} fontSize={Math.min(72, 560 / (0.43 * e.text.length))} fill={BLUE_INK} clipPath={`url(#jw${i})`}>
                  {e.text}
                </text>
                <Doodle icon={e.icon} x={X + 192} y={y - 22} p={doodle} />
              </g>
            );
          })}
        </g>
      </svg>
      {ats.map((a, i) => (
        <Sfx key={i} frame={voiceFrame(ts, a)} name="type" volume={0.22} />
      ))}
    </AbsoluteFill>
  );
};

/* ================================================================== */
/* Hüpfspiel                                                           */
/* ================================================================== */

export const JumperScene: React.FC<P> = ({ ts }) => {
  const s = ts.scene as Of<"jumper">;
  const frame = useCurrentFrame();
  const look = useLook();
  const t = useVoiceT(ts);
  const GROUND = 1090;
  const HERO_X = 230;
  const SPEED = 640;
  const px = 14;
  const hurdles = s.hurdles.map((h, i) => ({ ...h, at: beat(ts, h.at, 1 + i) }));
  const pickups = s.pickups.map((h, i) => ({ ...h, at: beat(ts, h.at, 1.5 + i) }));
  // Sprung: rund um jeden Zeitpunkt, an dem etwas die Figur erreicht
  const jumpTimes = [...hurdles, ...pickups].map((x) => x.at).sort((a, b) => a - b);
  const jump = jumpTimes.reduce((acc, at) => {
    const u = (t - (at - 0.36)) / 0.72;
    return u > 0 && u < 1 ? Math.max(acc, 4 * u * (1 - u)) : acc;
  }, 0);
  const heroY = GROUND - 22 * px - jump * 300;
  const score = pickups.filter((p) => t >= p.at).length;
  const scroll = (frame / FPS) * SPEED;
  return (
    <AbsoluteFill>
      {/* Boden aus Pixelblöcken */}
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        {Array.from({ length: 14 }, (_, i) => {
          const x = ((i * 90 - (scroll % 90)) % 1260) - 90;
          return (
            <g key={i}>
              <rect x={x} y={GROUND} width={88} height={60} fill="#3D1B6B" stroke="#5CF3FF" strokeWidth={3} />
              <rect x={x + 8} y={GROUND + 8} width={30} height={10} fill="#5CF3FF" opacity={0.5} />
            </g>
          );
        })}
        {hurdles.map((h, i) => {
          const x = HERO_X + 60 + (h.at - t) * SPEED;
          if (x < -200 || x > 1200) return null;
          return (
            <g key={i}>
              <rect x={x - 70} y={GROUND - 140} width={140} height={140} fill="#FF4FD8" stroke="#FFFFFF" strokeWidth={6} />
              <rect x={x - 58} y={GROUND - 128} width={36} height={12} fill="#FFFFFF" opacity={0.6} />
            </g>
          );
        })}
      </svg>
      {hurdles.map((h, i) => {
        const x = HERO_X + 60 + (h.at - t) * SPEED;
        if (x < -200 || x > 1200) return null;
        return (
          <React.Fragment key={i}>
            <div style={{ position: "absolute", left: x - 70, width: 140, top: GROUND - 126, textAlign: "center", fontSize: 78 }}>{h.emoji}</div>
            <div style={{ position: "absolute", left: x - 180, width: 360, top: GROUND - 200 - (i % 2) * 46, textAlign: "center", fontFamily: PIXEL, fontSize: 24, color: "#FFFFFF", textShadow: "0 0 10px #FF4FD8" }}>
              {h.label.toUpperCase()}
            </div>
          </React.Fragment>
        );
      })}
      {pickups.map((p, i) => {
        const taken = t >= p.at;
        const x = HERO_X + 60 + (p.at - t) * SPEED;
        const fly = interpolate(t, [p.at, p.at + 0.5], [0, 1], clamp);
        const left = taken ? x + (900 - x) * fly : x;
        const top = taken ? 700 + (300 - 700) * fly : 700 + Math.sin(frame / 6 + i) * 10;
        if (!taken && (x < -200 || x > 1200)) return null;
        if (fly >= 1) return null;
        return (
          <React.Fragment key={i}>
            <div style={{ position: "absolute", left: left - 60, top, width: 120, textAlign: "center", fontSize: 92, opacity: 1 - fly * 0.7, filter: "drop-shadow(0 0 16px #FFE66D)", transform: `scale(${1 - fly * 0.5})` }}>{p.emoji}</div>
            {!taken ? (
              <div style={{ position: "absolute", left: x - 160, width: 320, top: 820, textAlign: "center", fontFamily: PIXEL, fontSize: 22, color: "#FFE66D" }}>{p.label.toUpperCase()}</div>
            ) : null}
          </React.Fragment>
        );
      })}
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <Sprite x={HERO_X - 9 * px} y={heroY} px={px} t={10} gold={0} />
      </svg>
      {/* HUD */}
      <div style={{ position: "absolute", top: 290, left: 80, fontFamily: PIXEL, fontSize: 40, color: "#FF4FD8", letterSpacing: 8, textShadow: "0 0 12px #FF4FD8" }}>♥♥♥</div>
      <div style={{ position: "absolute", top: 296, right: 80, fontFamily: PIXEL, fontSize: 30, color: look.accent, textShadow: `0 0 12px ${look.accent}` }}>
        {String(score * 100).padStart(5, "0")}
      </div>
      {jumpTimes.map((a, i) => (
        <Sfx key={`j${i}`} frame={voiceFrame(ts, a - 0.36)} name="blip" volume={0.25} />
      ))}
      {pickups.map((p, i) => (
        <Sfx key={`p${i}`} frame={voiceFrame(ts, p.at)} name="coin" volume={0.35} />
      ))}
    </AbsoluteFill>
  );
};
