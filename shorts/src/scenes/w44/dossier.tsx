import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, random, spring, useCurrentFrame } from "remotion";
import { Sfx, beat, voiceFrame } from "../../lib/sfx";
import { FPS, type TimelineScene } from "../../lib/timing";
import type { Scene } from "../../schema";

/*
 * Detektiv-Look: eine Akte auf dem Schreibtisch unter dem Licht der Jalousie. Die Zeilen tippt
 * eine Schreibmaschine, genau wenn die Stimme sie sagt; am Schluss knallt ein roter Stempel drauf.
 * Die Mappe liegt in jeder Szene an derselben Stelle, darum wirken die Überblendungen wie ein
 * Umblättern. Als Zettel («note») schreibt eine Hand die Zeilen.
 */

type DossierScene = Extract<Scene, { type: "dossier" }>;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const TYPE = '"Courier Prime"';
const HAND = "Caveat";
const PAPER = "#EFE6D2";
const INK = "#1E1A16";
const BLUE_INK = "#1F3A68";
const RED = "#B8261E";
const MANILA = "#C99F5C";
const MANILA_DARK = "#9C7637";

/** Bricht einen Text an Leerzeichen um – höchstens `max` Zeichen pro Zeile. */
const wrap = (text: string, max: number): string[] => {
  const lines: string[] = [];
  let cur = "";
  for (const word of text.split(/\s+/)) {
    if (cur && (cur + " " + word).length > max) {
      lines.push(cur);
      cur = word;
    } else cur = cur ? `${cur} ${word}` : word;
  }
  if (cur) lines.push(cur);
  return lines;
};

/** Zerrissene Kante oben und unten – für den Zettel */
const tornRect = (x: number, y: number, w: number, h: number, seed: string) => {
  const pts: string[] = [];
  const n = 28;
  for (let i = 0; i <= n; i++) pts.push(`${x + (i / n) * w} ${y + (random(`${seed}t${i}`) - 0.5) * 22}`);
  pts.push(`${x + w + 2} ${y + h * 0.5}`);
  for (let i = n; i >= 0; i--) pts.push(`${x + (i / n) * w} ${y + h + (random(`${seed}b${i}`) - 0.5) * 8}`);
  return `M ${pts.join(" L ")} Z`;
};

/* ---------------- Die Mappe ---------------- */

const X = 90;
const Y = 300;
const W = 900;
const H = 860;
/* Das Blatt in der Mappe */
const PX = 135;
const PY = 345;
const PW = 810;
const PH = 790;

/** Licht durch die Jalousie auf Mappe und Papier */
const Blinds: React.FC<{ t: number; id: string }> = ({ t, id }) => {
  const slide = Math.sin(t * 0.25) * 30;
  return (
    <>
      <defs>
        <pattern id={id} width={160} height={160} patternUnits="userSpaceOnUse" patternTransform={`rotate(-24) translate(${slide} 0)`}>
          <rect width={160} height={78} fill="rgba(255,226,170,0.13)" />
          <rect y={78} width={160} height={82} fill="rgba(0,0,0,0.12)" />
        </pattern>
      </defs>
      <rect x={X - 20} y={Y - 80} width={W + 40} height={H + 120} fill={`url(#${id})`} style={{ mixBlendMode: "soft-light" }} />
    </>
  );
};

const Folder: React.FC<{ dim?: number }> = ({ dim = 0 }) => (
  <g>
    {/* Schatten, hintere Klappe mit Reiter */}
    <rect x={X + 16} y={Y + 22} width={W} height={H} rx={14} fill="rgba(0,0,0,0.55)" />
    <path d={`M ${X + 30} ${Y} L ${X + 60} ${Y - 46} L ${X + 330} ${Y - 46} L ${X + 360} ${Y} Z`} fill={MANILA_DARK} />
    <text x={X + 195} y={Y - 14} textAnchor="middle" fontFamily={TYPE} fontWeight={700} fontSize={26} letterSpacing={4} fill="#5A1610">
      VERTRAULICH
    </text>
    <rect x={X} y={Y} width={W} height={H} rx={14} fill={MANILA} />
    <rect x={X} y={Y} width={W} height={H} rx={14} fill="url(#folderShade)" />
    {/* Kaffeering */}
    <circle cx={X + W - 120} cy={Y + H - 70} r={62} fill="none" stroke="#7A5428" strokeOpacity={0.35} strokeWidth={7} />
    <circle cx={X + W - 116} cy={Y + H - 66} r={55} fill="none" stroke="#7A5428" strokeOpacity={0.18} strokeWidth={3} />
    {/* Das Blatt */}
    <g transform={`rotate(1.2 ${PX + PW / 2} ${PY + PH / 2})`}>
      <rect x={PX + 6} y={PY + 8} width={PW} height={PH} fill="rgba(0,0,0,0.22)" />
      <rect x={PX} y={PY} width={PW} height={PH} fill={PAPER} />
      <rect x={PX} y={PY} width={PW} height={PH} fill="url(#paperShade)" />
    </g>
    {dim > 0 ? <rect x={X - 30} y={Y - 60} width={W + 60} height={H + 100} fill="#000" opacity={dim} /> : null}
  </g>
);

const FolderDefs: React.FC = () => (
  <defs>
    <linearGradient id="folderShade" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stopColor="#FFF0C8" stopOpacity="0.25" />
      <stop offset="100%" stopColor="#3A2508" stopOpacity="0.35" />
    </linearGradient>
    <radialGradient id="paperShade" cx="0.4" cy="0.3" r="0.95">
      <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.25" />
      <stop offset="100%" stopColor="#8A7650" stopOpacity="0.3" />
    </radialGradient>
    <linearGradient id="photoBg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#5C5650" />
      <stop offset="100%" stopColor="#24211E" />
    </linearGradient>
  </defs>
);

/** Polaroid mit Büroklammer: eine Gestalt mit Kapuze im Profil */
const Polaroid: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <g transform={`translate(${x} ${y}) rotate(5)`}>
    <rect x={6} y={8} width={200} height={238} fill="rgba(0,0,0,0.3)" />
    <rect x={0} y={0} width={200} height={238} fill="#FBF8F0" />
    <rect x={14} y={14} width={172} height={172} fill="url(#photoBg)" />
    {/* Kapuze und Schultern */}
    <path d="M 40 186 Q 46 132 80 120 Q 64 92 76 66 Q 96 34 128 44 Q 158 56 160 98 Q 160 120 148 134 Q 176 146 178 186 Z" fill="#0E0C0B" />
    <path d="M 82 74 Q 96 52 122 56 Q 104 64 98 92 Q 92 112 104 128 Q 84 120 82 96 Z" fill="#2E2A26" />
    <text x={100} y={222} textAnchor="middle" fontFamily={HAND} fontWeight={700} fontSize={30} fill="#4A4038">
      Verdächtiger
    </text>
    {/* Büroklammer */}
    <path d="M 70 -34 L 70 40 Q 70 56 84 56 Q 98 56 98 40 L 98 -22 Q 98 -32 88 -32 Q 78 -32 78 -22 L 78 30" fill="none" stroke="#B8BCC4" strokeWidth={6} strokeLinecap="round" />
  </g>
);

/** Gummistempel, abgenutzt, schräg */
const Stamp: React.FC<{ text: string; x: number; y: number; p: number }> = ({ text, x, y, p }) => {
  const holes = useMemo(
    () => Array.from({ length: 70 }, (_, i) => ({ x: (random(`sh${i}`) - 0.5) * 520, y: (random(`sv${i}`) - 0.5) * 220, r: 2 + random(`sr${i}`) * 7 })),
    [],
  );
  const fontSize = Math.min(150, 760 / Math.max(3, text.length * 0.62));
  const w = Math.max(300, text.length * fontSize * 0.55 + 90);
  const scale = interpolate(p, [0, 1], [2.4, 1]);
  return (
    <g transform={`translate(${x} ${y}) rotate(-13) scale(${scale})`} opacity={Math.min(1, p * 1.6) * 0.88}>
      <defs>
        <mask id={`stampMask-${text}`}>
          <rect x={-400} y={-200} width={800} height={400} fill="white" />
          {holes.map((h, i) => (
            <circle key={i} cx={h.x} cy={h.y} r={h.r} fill="black" />
          ))}
        </mask>
      </defs>
      <g mask={`url(#stampMask-${text})`}>
        <rect x={-w / 2} y={-fontSize * 0.62} width={w} height={fontSize * 1.24} rx={18} fill="none" stroke={RED} strokeWidth={12} />
        <rect x={-w / 2 + 16} y={-fontSize * 0.62 + 16} width={w - 32} height={fontSize * 1.24 - 32} rx={10} fill="none" stroke={RED} strokeWidth={4} />
        <text x={0} y={fontSize * 0.36} textAnchor="middle" fontFamily="Anton" fontSize={fontSize} letterSpacing={6} fill={RED}>
          {text.toUpperCase()}
        </text>
      </g>
    </g>
  );
};

/* ---------------- Akte ---------------- */

const FileView: React.FC<{ ts: TimelineScene; s: DossierScene }> = ({ ts, s }) => {
  const frame = useCurrentFrame();
  const t = (frame - ts.audioOffsetFrames) / FPS;
  const first = ts.from === 0;
  const enter = first ? spring({ frame, fps: FPS, config: { damping: 16, stiffness: 110 } }) : 1;

  const ats = s.entries.map((e, i) => beat(ts, e.at, 0.6 + i * 1.2));
  const stampAt = s.stamp ? beat(ts, s.stamp.at, ts.speechEndSec - 0.6) : 9999;
  const stampP = s.stamp ? spring({ frame: frame - voiceFrame(ts, stampAt), fps: FPS, config: { damping: 18, stiffness: 320, mass: 0.6 } }) : 0;
  const hitFrame = voiceFrame(ts, stampAt) + 4;
  const shake = s.stamp && frame >= hitFrame && frame < hitFrame + 10 ? Math.sin((frame - hitFrame) * 2.6) * 7 * (1 - (frame - hitFrame) / 10) : 0;

  const titleSize = Math.min(66, 470 / (0.6 * Math.max(6, s.title.length)));
  const lines = s.entries.map((e) => wrap(e.text, 23));
  let cursor = 690;
  const blocks = lines.map((ls) => {
    const y = cursor;
    cursor += ls.length * 62 + 32;
    return y;
  });
  const blink = Math.floor(frame / 9) % 2 === 0;

  return (
    <AbsoluteFill style={{ transform: `translate(${shake}px, ${interpolate(enter, [0, 1], [900, 0]) + shake * 0.4}px) rotate(${interpolate(enter, [0, 1], [8, 0])}deg)` }}>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <FolderDefs />
        <g transform="rotate(-1.5 540 730)">
          <Folder />
          <g transform={`rotate(1.2 ${PX + PW / 2} ${PY + PH / 2})`}>
            {/* Kopf des Blattes */}
            <text x={PX + 45} y={PY + 95} fontFamily={TYPE} fontWeight={700} fontSize={titleSize} fill={INK}>
              {s.title.toUpperCase()}
            </text>
            {s.subtitle ? (
              <text x={PX + 45} y={PY + 150} fontFamily={TYPE} fontSize={32} fill="#5A4A3A">
                {s.subtitle}
              </text>
            ) : null}
            <line x1={PX + 45} y1={PY + 185} x2={PX + 520} y2={PY + 185} stroke={INK} strokeWidth={3} />
            <line x1={PX + 45} y1={PY + 193} x2={PX + 520} y2={PY + 193} stroke={INK} strokeWidth={1.5} />
            <text x={PX + 45} y={PY + 245} fontFamily={TYPE} fontSize={26} fill="#7A6A5A" letterSpacing={2}>
              AKTENNOTIZ · GEHEIM
            </text>
            {/* Getippte Einträge */}
            {lines.map((ls, i) => {
              const at = ats[i];
              const total = s.entries[i].text.length;
              const dur = Math.min(1.5, Math.max(0.5, total / 22));
              const shown = Math.floor(interpolate(t, [at - 0.05, at - 0.05 + dur], [0, total], clamp));
              if (shown <= 0) return null;
              let left = shown;
              const typing = shown < total;
              return (
                <g key={i}>
                  <rect x={PX + 45} y={blocks[i] - 32} width={15} height={15} fill={RED} />
                  {ls.map((line, k) => {
                    const n = Math.max(0, Math.min(line.length, left));
                    left -= line.length + 1;
                    if (n <= 0) return null;
                    const isLast = typing && left < 0;
                    return (
                      <React.Fragment key={k}>
                        <text x={PX + 80} y={blocks[i] + k * 62} fontFamily={TYPE} fontWeight={700} fontSize={48} fill={INK} opacity={0.92}>
                          {line.slice(0, n)}
                        </text>
                        {isLast && blink ? <rect x={PX + 80 + n * 28.8 + 2} y={blocks[i] + k * 62 - 37} width={4} height={46} fill={INK} /> : null}
                      </React.Fragment>
                    );
                  })}
                </g>
              );
            })}
          </g>
          <Polaroid x={PX + 560} y={PY + 30} />
          <Blinds t={t} id={`blinds-${ts.scene.id}`} />
          {s.stamp && stampP > 0.001 ? <Stamp text={s.stamp.text} x={PX + 470} y={Math.min(PY + PH - 170, Math.max(cursor + 60, PY + 560))} p={stampP} /> : null}
        </g>
      </svg>
      {ats.map((a, i) => (
        <React.Fragment key={i}>
          <Sfx frame={voiceFrame(ts, a)} name="type" volume={0.3} />
          {s.entries[i].text.length > 20 ? <Sfx frame={voiceFrame(ts, a + 0.55)} name="type" volume={0.24} /> : null}
        </React.Fragment>
      ))}
      {s.stamp ? <Sfx frame={hitFrame} name="stamp" volume={0.6} /> : null}
    </AbsoluteFill>
  );
};

/* ---------------- Zettel ---------------- */

const NoteView: React.FC<{ ts: TimelineScene; s: DossierScene }> = ({ ts, s }) => {
  const frame = useCurrentFrame();
  const t = (frame - ts.audioOffsetFrames) / FPS;
  const slide = spring({ frame, fps: FPS, config: { damping: 15, stiffness: 120 } });
  const NX = 150;
  const NY = 400;
  const NW = 780;
  const NH = 700;
  const edge = useMemo(() => tornRect(NX, NY, NW, NH, "note"), []);
  const ats = s.entries.map((e, i) => beat(ts, e.at, 0.6 + i * 1.6));
  const all = s.entries.map((e) => wrap(e.text, 26));
  // Zeilen fortlaufend, jede Zeile ein Stück Schreibzeit
  let y = NY + 150;
  const rows: Array<{ text: string; y: number; from: number; to: number; entry: number }> = [];
  all.forEach((ls, i) => {
    const total = s.entries[i].text.length;
    const dur = Math.min(3, Math.max(0.9, total / 19));
    let start = ats[i] - 0.05;
    ls.forEach((line) => {
      const d = (dur * (line.length + 1)) / (total + ls.length);
      rows.push({ text: line, y, from: start, to: start + d, entry: i });
      start += d;
      y += 76;
    });
    y += 14;
  });
  const last = rows.filter((r) => r.entry === s.entries.length - 1);
  const lastEnd = last.length ? last[last.length - 1].to : 0;
  const under = interpolate(t, [lastEnd + 0.15, lastEnd + 0.6], [0, 1], { ...clamp, easing: Easing.out(Easing.quad) });
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <FolderDefs />
        <g transform="rotate(-1.5 540 730)">
          <Folder dim={0.35} />
          <Blinds t={t} id={`blinds-${ts.scene.id}`} />
        </g>
        <g transform={`translate(${interpolate(slide, [0, 1], [-700, 0])} ${interpolate(slide, [0, 1], [120, 0])}) rotate(${interpolate(slide, [0, 1], [-14, -3])} 540 750)`}>
          <path d={edge} fill="rgba(0,0,0,0.5)" transform="translate(14 18)" />
          <path d={edge} fill="#F7F1E1" />
          {Array.from({ length: 8 }, (_, i) => {
            const ly = (rows[i]?.y ?? (rows.length ? rows[rows.length - 1].y + (i - rows.length + 1) * 76 : NY + 150 + i * 76)) + 14;
            return ly < NY + NH - 20 ? <line key={i} x1={NX + 24} y1={ly} x2={NX + NW - 24} y2={ly} stroke="#9CB8D8" strokeOpacity={0.45} strokeWidth={2} /> : null;
          })}
          {rows.map((r, i) => {
            const p = interpolate(t, [r.from, r.to], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });
            if (p <= 0) return null;
            return (
              <g key={i}>
                <clipPath id={`nw${i}`}>
                  <rect x={NX + 30} y={r.y - 64} width={(NW - 40) * p} height={96} />
                </clipPath>
                <text x={NX + 52} y={r.y} fontFamily={HAND} fontWeight={700} fontSize={62} fill={BLUE_INK} clipPath={`url(#nw${i})`}>
                  {r.text}
                </text>
              </g>
            );
          })}
          {last.length && under > 0 ? (
            <path
              d={`M ${NX + 50} ${last[last.length - 1].y + 16} Q ${NX + 360} ${last[last.length - 1].y + 26} ${NX + 640} ${last[last.length - 1].y + 12}`}
              stroke={BLUE_INK}
              strokeWidth={6}
              strokeLinecap="round"
              fill="none"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1 - under}
            />
          ) : null}
        </g>
        {/* Beweisanhänger mit Schnur */}
        <g transform={`translate(${interpolate(slide, [0, 1], [-700, 0])} 0) rotate(8 820 360)`}>
          <path d="M 760 410 Q 790 380 812 352" stroke="#C9B48A" strokeWidth={4} fill="none" />
          <path d="M 790 300 L 960 300 L 980 330 L 960 360 L 790 360 Z" fill={MANILA} stroke={MANILA_DARK} strokeWidth={3} />
          <circle cx={958} cy={330} r={8} fill="#5A3A18" />
          <text x={808} y={340} fontFamily={TYPE} fontWeight={700} fontSize={26} fill={INK}>
            BEWEIS
          </text>
        </g>
        <text x={190} y={NY + 80} transform={`translate(${interpolate(slide, [0, 1], [-700, 0])} 0) rotate(-3 540 750)`} fontFamily={TYPE} fontSize={30} fill="#7A6A5A" letterSpacing={2}>
          {s.title.toUpperCase()}
        </text>
      </svg>
      <Sfx frame={1} name="swipe" volume={0.35} />
      {ats.map((a, i) => (
        <Sfx key={i} frame={voiceFrame(ts, a)} name="type" volume={0.12} />
      ))}
    </AbsoluteFill>
  );
};

export const DossierScene: React.FC<{ ts: TimelineScene }> = ({ ts }) => {
  const s = ts.scene as DossierScene;
  return s.mode === "note" ? <NoteView ts={ts} s={s} /> : <FileView ts={ts} s={s} />;
};
