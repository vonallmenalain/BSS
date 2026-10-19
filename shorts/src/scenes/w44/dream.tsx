import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, random, useCurrentFrame } from "remotion";
import { useLook } from "../../looks";
import { Sfx, beat, beats, voiceFrame } from "../../lib/sfx";
import { FPS, type TimelineScene } from "../../lib/timing";
import type { Scene } from "../../schema";

/*
 * Lehis Traum (1 Nephi 8) als Spielfeld – wie die Lockvogel-Karte, nur im Traum: oben der Baum
 * mit weisser Frucht, ein schmaler Weg windet sich hinauf, daneben die eiserne Stange am Ufer
 * des Flusses (8:19–20), jenseits des Flusses schwebt das grosse und geräumige Gebäude (8:26).
 * Jede Gruppe ist ein Trupp kleiner Spielfiguren; am Ende ihres Laufs zeigt ein Abzeichen, wie
 * es ausging, und unten zählt eine Anzeigetafel mit.
 */

type DreamSceneT = Extract<Scene, { type: "dream" }>;
type Stage = DreamSceneT["stage"];
type P = [number, number];

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = Easing.inOut(Easing.sin);

/* Spielfeld */
const PX = 50;
const PY = 300;
const PW = 980;
const PH = 880;
const TREE: P = [470, 470];
const BUILDING = { x: 850, y: 470, w: 150, h: 320 };
const DOOR: P = [BUILDING.x + BUILDING.w / 2, BUILDING.y + BUILDING.h];

/* Gruppen: Farbe und wie es ausging */
const GROUPS = [
  { color: "#FF7B7B", sub: "GRUPPE 1", title: "VERIRRT", ok: false },
  { color: "#FFB547", sub: "ERREICHT – UND", title: "AUFGEGEBEN", ok: false },
  { color: "#6BF2A6", sub: "ERREICHT ✓", title: "GEBLIEBEN", ok: true },
  { color: "#C49BFF", sub: "GRUPPE 4", title: "IM GEBÄUDE", ok: false },
] as const;
const GROUP_OF: Partial<Record<Stage, number>> = { mist: 0, rod: 1, hold: 2, building: 3 };
const N = 7;

/* ---------- Geometrie: Weg, Stange, Fluss ---------- */

const cubic = (a: P, b: P, c: P, d: P, k: number): P => {
  const u = 1 - k;
  return [
    u * u * u * a[0] + 3 * u * u * k * b[0] + 3 * u * k * k * c[0] + k * k * k * d[0],
    u * u * u * a[1] + 3 * u * u * k * b[1] + 3 * u * k * k * c[1] + k * k * k * d[1],
  ];
};

/** Der Weg vom Start unten bis zum Fuss des Baumes. */
const PATH_SEGS: Array<[P, P, P, P]> = [
  [[430, 1060], [300, 990], [600, 935], [520, 860]],
  [[520, 860], [440, 790], [310, 735], [395, 680]],
  [[395, 680], [470, 640], [482, 625], [470, 598]],
];

type Poly = { pts: P[]; len: number[]; total: number };
const poly = (pts: P[]): Poly => {
  const len = [0];
  for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, len, total: len[len.length - 1] || 1 };
};
/** Punkt und Richtung nach Bogenlänge (k = 0 … 1). */
const at = (pl: Poly, k: number): { p: P; n: P } => {
  const d = Math.max(0, Math.min(1, k)) * pl.total;
  let i = 1;
  while (i < pl.len.length - 1 && pl.len[i] < d) i++;
  const a = pl.pts[i - 1];
  const b = pl.pts[i];
  const seg = pl.len[i] - pl.len[i - 1] || 1;
  const f = (d - pl.len[i - 1]) / seg;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const m = Math.hypot(dx, dy) || 1;
  // Rechts der Laufrichtung (y nach unten): (−dy, dx)
  return { p: [a[0] + dx * f, a[1] + dy * f], n: [-dy / m, dx / m] };
};
const toD = (pts: P[]) => `M ${pts.map((q) => `${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join(" L ")}`;

const PATH = poly(PATH_SEGS.flatMap((s, j) => Array.from({ length: 40 }, (_, i) => cubic(...s, (i + (j ? 1 : 0)) / 40)).concat(j === PATH_SEGS.length - 1 ? [s[3]] : [])));
/** Die Stange läuft rechts neben dem Weg – auf der Seite des Flusses. */
const ROD_OFF = 30;
const ROD = poly(PATH.pts.map((_, i) => {
  const { p, n } = at(PATH, PATH.len[i] / PATH.total);
  return [p[0] + n[0] * ROD_OFF, p[1] + n[1] * ROD_OFF] as P;
}));
const RIVER_D = "M 640 330 C 700 500, 600 690, 690 860 S 650 1100, 730 1180";

/* ---------- Kleine Bausteine ---------- */

const Pawn: React.FC<{ x: number; y: number; color: string; o?: number; glow?: number; s?: number }> = ({ x, y, color, o = 1, glow = 0, s = 1 }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} opacity={o}>
    {glow > 0 ? <circle cx={0} cy={2} r={24} fill={color} opacity={0.28 * glow} /> : null}
    <ellipse cx={0} cy={19} rx={11} ry={4} fill="#000" opacity={0.35} />
    <path d="M -10 18 Q -10 3 0 3 Q 10 3 10 18 Z" fill={color} stroke="#0B1030" strokeWidth={2.2} />
    <circle cx={0} cy={-5} r={7.5} fill={color} stroke="#0B1030" strokeWidth={2.2} />
  </g>
);

const Tree: React.FC<{ lit: number; frame: number }> = ({ lit, frame }) => {
  const [x, y] = TREE;
  const fruits = useMemo(
    () => Array.from({ length: 13 }, (_, i) => ({ a: random(`fa${i}`) * Math.PI * 2, r: 30 + random(`fr${i}`) * 78, p: random(`fp${i}`) * 6.28 })),
    [],
  );
  return (
    <g>
      <circle cx={x} cy={y} r={320} fill="url(#treeHalo)" opacity={0.35 + 0.65 * lit} />
      {Array.from({ length: 14 }, (_, i) => {
        const a = (i / 14) * Math.PI * 2 + frame / 150;
        const r0 = 130;
        const r1 = 330 + 30 * Math.sin(frame / 20 + i);
        return (
          <path
            key={i}
            d={`M ${x + Math.cos(a - 0.05) * r0} ${y + Math.sin(a - 0.05) * r0} L ${x + Math.cos(a) * r1} ${y + Math.sin(a) * r1} L ${x + Math.cos(a + 0.05) * r0} ${y + Math.sin(a + 0.05) * r0} Z`}
            fill="#FFF3C4"
            opacity={0.1 * lit}
          />
        );
      })}
      {/* Stamm und Wurzeln */}
      <path d={`M ${x - 13} ${y + 128} Q ${x - 6} ${y + 70} ${x - 10} ${y + 30} L ${x + 10} ${y + 30} Q ${x + 6} ${y + 70} ${x + 13} ${y + 128} Z`} fill="#6B5A44" stroke="#2B2218" strokeWidth={3} />
      <path d={`M ${x - 13} ${y + 126} q -16 6 -26 2 M ${x + 13} ${y + 126} q 16 6 26 2`} stroke="#6B5A44" strokeWidth={6} strokeLinecap="round" fill="none" />
      {/* Krone */}
      {[
        [0, -10, 96],
        [-70, 18, 62],
        [70, 18, 62],
        [-42, -52, 60],
        [44, -52, 60],
      ].map(([dx, dy, r], i) => (
        <circle key={i} cx={x + dx} cy={y + dy} r={r} fill="#24563F" stroke={lit > 0.5 ? "#BFF0D0" : "#4E8A6A"} strokeWidth={3} strokeOpacity={0.5 + 0.5 * lit} />
      ))}
      <circle cx={x} cy={y - 14} r={92} fill="#2E6B4F" opacity={0.85} />
      {/* Weisse Frucht */}
      {fruits.map((f, i) => {
        const fx = x + Math.cos(f.a) * f.r;
        const fy = y - 14 + Math.sin(f.a) * f.r * 0.75;
        const tw = 0.6 + 0.4 * Math.sin(frame / 9 + f.p);
        return (
          <g key={i}>
            <circle cx={fx} cy={fy} r={16} fill="#FFF6D6" opacity={(0.15 + 0.35 * lit) * tw} />
            <circle cx={fx} cy={fy} r={8} fill="#FFFFFF" opacity={0.55 + 0.45 * lit} />
          </g>
        );
      })}
    </g>
  );
};

/** Das grosse und geräumige Gebäude – es schwebt, ohne Fundament (1 Nephi 8:26). */
const Building: React.FC<{ o: number; mock: number; frame: number }> = ({ o, mock, frame }) => {
  if (o <= 0.001) return null;
  const { x, y, w, h } = BUILDING;
  const bob = Math.sin(frame / 24) * 6;
  const cols = 3;
  const rows = 6;
  return (
    <g opacity={o}>
      <ellipse cx={x + w / 2} cy={1010} rx={90} ry={14} fill="#000" opacity={0.35} />
      <g transform={`translate(0 ${bob})`}>
        {/* Dach und Säulen */}
        <path d={`M ${x - 14} ${y + 10} L ${x + w / 2} ${y - 44} L ${x + w + 14} ${y + 10} Z`} fill="#3A2F63" stroke="#C49BFF" strokeWidth={3} />
        <rect x={x} y={y + 10} width={w} height={h - 10} fill="#2A2350" stroke="#C49BFF" strokeWidth={3} />
        {Array.from({ length: rows * cols }, (_, i) => {
          const c = i % cols;
          const r = Math.floor(i / cols);
          const wx = x + 14 + c * ((w - 28) / cols) + 4;
          const wy = y + 30 + r * ((h - 70) / rows);
          const ww = (w - 28) / cols - 8;
          const wh = (h - 70) / rows - 12;
          const person = random(`bp${i}`) > 0.35;
          return (
            <g key={i}>
              <rect x={wx} y={wy} width={ww} height={wh} fill="#FFD98A" opacity={0.75 + 0.25 * Math.sin(frame / 13 + i)} />
              {person ? (
                <g>
                  <circle cx={wx + ww / 2} cy={wy + wh * 0.38} r={5} fill="#1A1433" />
                  <rect x={wx + ww / 2 - 6} y={wy + wh * 0.55} width={12} height={wh * 0.45} fill="#1A1433" />
                  {/* Zeigefinger Richtung Baum */}
                  {mock > 0 ? <line x1={wx + ww / 2 - 4} y1={wy + wh * 0.62} x2={wx + ww / 2 - 4 - 16 * mock} y2={wy + wh * 0.5} stroke="#1A1433" strokeWidth={3.5} strokeLinecap="round" /> : null}
                </g>
              ) : null}
            </g>
          );
        })}
        <rect x={DOOR[0] - 18} y={y + h - 44} width={36} height={44} fill="#FFE7A8" />
        {/* Sie lehnen sich hinaus und zeigen mit dem Finger (8:27) */}
        {mock > 0
          ? [1, 3, 5].map((r, i) => {
              const wy = y + 30 + r * ((h - 70) / rows) + 14;
              const lean = mock * (10 + 4 * Math.sin(frame / 5 + i));
              return (
                <g key={r} transform={`translate(${x - lean} ${wy})`} opacity={Math.min(1, mock * 1.5)}>
                  <rect x={-2} y={2} width={16} height={26} rx={5} fill="#1A1433" stroke="#C49BFF" strokeWidth={2} />
                  <circle cx={6} cy={-6} r={9} fill="#1A1433" stroke="#C49BFF" strokeWidth={2} />
                  <line x1={2} y1={8} x2={2 - 34 * mock} y2={2 + 3 * Math.sin(frame / 4 + i)} stroke="#1A1433" strokeWidth={6} strokeLinecap="round" />
                  <line x1={2} y1={8} x2={2 - 34 * mock} y2={2 + 3 * Math.sin(frame / 4 + i)} stroke="#C49BFF" strokeWidth={2} strokeLinecap="round" opacity={0.6} />
                </g>
              );
            })
          : null}
      </g>
    </g>
  );
};

/** Nebel der Finsternis: ein dunkles Band über der Mitte des Weges, darin wabernde Schwaden. */
const Mist: React.FC<{ k: number; t: number }> = ({ k, t }) => {
  const puffs = useMemo(
    () =>
      Array.from({ length: 46 }, (_, i) => ({
        x: 40 + random(`mx${i}`) * 860,
        y: 610 + random(`my${i}`) * 460,
        r: 130 + random(`mr${i}`) * 110,
        v: 6 + random(`mv${i}`) * 10,
        p: random(`mp${i}`) * 6.28,
        light: i % 4 === 0,
      })),
    [],
  );
  if (k <= 0.001) return null;
  return (
    <g>
      <rect x={PX} y={560} width={PW} height={560} fill="url(#mistVeil)" opacity={k} />
      {puffs.map((m, i) => {
        // Von der Seite herein, dann leises Wabern
        const enter = (1 - Math.min(1, k * 1.25)) * (i % 2 ? -420 : 420);
        const x = m.x + Math.sin(t * 0.45 + m.p) * m.v * 3 + enter;
        const y = m.y + Math.cos(t * 0.35 + m.p) * m.v * 1.5;
        return <circle key={i} cx={x} cy={y} r={m.r} fill={m.light ? "url(#mistLight)" : "url(#mistDark)"} opacity={k} />;
      })}
    </g>
  );
};

/** Abzeichen am Ende eines Laufs – wie bei einem Spiel. */
const Badge: React.FC<{ g: number; k: number }> = ({ g, k }) => {
  if (k <= 0) return null;
  const grp = GROUPS[g];
  const s = interpolate(k, [0, 1], [1.7, 1]);
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 880,
        display: "flex",
        justifyContent: "center",
        opacity: Math.min(1, k * 1.6),
        transform: `scale(${s}) rotate(-5deg)`,
      }}
    >
      <div style={{ padding: "14px 40px 18px", borderRadius: 22, background: "rgba(6,10,34,0.9)", border: `6px solid ${grp.color}`, boxShadow: `0 0 34px ${grp.color}`, textAlign: "center" }}>
        <div style={{ fontFamily: "Inter", fontWeight: 800, fontSize: 30, letterSpacing: "0.14em", color: grp.color }}>{grp.sub}</div>
        <div style={{ fontFamily: "Anton", fontSize: 88, lineHeight: 1.05, letterSpacing: "0.04em", color: "#FFFFFF", textShadow: `0 0 20px ${grp.color}` }}>{grp.title}</div>
      </div>
    </div>
  );
};

/* ---------- Szene ---------- */

export const DreamScene: React.FC<{ ts: TimelineScene }> = ({ ts }) => {
  const s = ts.scene as DreamSceneT;
  const frame = useCurrentFrame();
  const look = useLook();
  const t = (frame - ts.audioOffsetFrames) / FPS;
  const b = beats(ts, s.cues, Math.max(4, s.cues.length));
  const stage = s.stage;
  const g = GROUP_OF[stage] ?? -1;
  const hook = stage === "intro" && s.cues.length === 0;
  const f = (sec: number) => voiceFrame(ts, sec);

  /* --- Was wann zu sehen ist --- */
  const treeLit = stage === "intro" ? (hook ? 0.25 + 0.1 * Math.sin(frame / 12) : interpolate(t, [b[0] - 0.1, b[0] + 0.6], [0.3, 1], clamp)) : 1;
  const pathDraw = stage === "intro" ? (hook ? 0 : interpolate(t, [b[1] - 0.1, b[1] + 1.3], [0, 1], { ...clamp, easing: ease })) : 1;
  const rodDraw = stage === "intro" ? (hook ? 0 : interpolate(t, [b[2] - 0.1, b[2] + 1.1], [0, 1], { ...clamp, easing: ease })) : 1;
  const riverO = stage === "intro" ? (hook ? 0.35 : interpolate(t, [b[2] - 0.2, b[2] + 0.6], [0.35, 1], clamp)) : 1;
  const mist =
    stage === "mist"
      ? interpolate(t, [b[1] - 0.2, b[1] + 1.4], [0, 1], { ...clamp, easing: ease })
      : stage === "rod" || stage === "hold"
        ? 1
        : stage === "building"
          ? 0.45
          : 0;
  const buildingAt = stage === "rod" ? beat(ts, "Gebäude", b[2] - 0.8) - 0.3 : -99;
  const buildingO = stage === "rod" ? interpolate(t, [buildingAt, buildingAt + 0.6], [0, 1], clamp) : stage === "hold" || stage === "building" ? 1 : 0;
  const mockAt = stage === "rod" ? b[2] : stage === "hold" ? b[3] : 99;
  const mock = stage === "rod" || stage === "hold" ? interpolate(t, [mockAt - 0.1, mockAt + 0.4], [0, 1], clamp) : 0;
  const badgeAt = stage === "mist" ? b[2] + 0.7 : stage === "rod" ? b[3] + 0.9 : stage === "hold" ? b[3] + 0.5 : stage === "building" ? b[0] + 0.45 : 99;
  const badge = g >= 0 ? interpolate(t, [badgeAt, badgeAt + 0.22], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.6)) }) : 0;
  const hookAt = hook ? beat(ts, "Nur eine", 3.4) : 99;
  const groupsAt = hook ? beat(ts, "Vier Gruppen", 1.7) : -1;

  /* --- Figuren der laufenden Gruppe --- */
  const figures = useMemo(() => Array.from({ length: N }, (_, i) => ({ lag: i * 0.045, side: (random(`side${i}`) - 0.5) * 10, dir: random(`dir${i}`) > 0.5 ? 1 : -1, w: random(`w${i}`), exit: i })), []);
  const slot = (i: number): P => [TREE[0] + (i - 3) * 34, 646 - (3 - Math.abs(i - 3)) * 5];
  const startSlot = (i: number, grp = 0): P => [430 + (i - 3) * 13 + (grp - 1.5) * 0, 1072 + (i % 2) * 8];

  /** Fortschritt des vordersten auf dem Weg; geht über 1 hinaus, damit alle ankommen. */
  const leadP = (() => {
    switch (stage) {
      case "mist":
        return interpolate(t, [b[0] - 0.1, b[1] + 1.4], [0, 0.42], { ...clamp, easing: Easing.out(Easing.quad) });
      case "rod":
        return interpolate(t, [-0.2, b[1] + 0.5], [0, 1.3], { ...clamp, easing: ease });
      case "hold":
        return interpolate(t, [b[0] - 0.1, b[2] + 0.35], [0, 1.3], { ...clamp, easing: ease });
      default:
        return 0;
    }
  })();

  const pawns: Array<{ x: number; y: number; o: number; glow: number; color: string }> = [];
  if (g >= 0) {
    const color = GROUPS[g].color;
    figures.forEach((fg, i) => {
      if (stage === "building") {
        // Direkt hinüber zum Gebäude – ohne Weg, ohne Stange
        const k = interpolate(t, [-0.3 + i * 0.12, b[0] + 0.2 + i * 0.1], [0, 1], { ...clamp, easing: ease });
        const from = startSlot(i);
        const mid: P = [740, 950];
        const pt: P = k < 0.6 ? [from[0] + (mid[0] - from[0]) * (k / 0.6), from[1] + (mid[1] - from[1]) * (k / 0.6)] : [mid[0] + (DOOR[0] - mid[0]) * ((k - 0.6) / 0.4), mid[1] + (DOOR[1] - 10 - mid[1]) * ((k - 0.6) / 0.4)];
        pawns.push({ x: pt[0] + fg.side, y: pt[1], o: interpolate(k, [0.85, 1], [1, 0], clamp), glow: 0, color });
        return;
      }
      const q = leadP - fg.lag;
      const onRod = stage === "rod" || stage === "hold";
      const base = at(PATH, Math.max(0, Math.min(1, q)));
      // An der Stange: zwischen Weg und Stange, die Hand am Eisen
      const off = onRod ? ROD_OFF * 0.55 : fg.side;
      let x = base.p[0] + base.n[0] * off;
      let y = base.p[1] + base.n[1] * off;
      if (q <= 0) {
        const st = startSlot(i);
        x = st[0];
        y = st[1];
      }
      let o = 1;
      let glow = onRod ? 0.6 : 0;
      // Angekommen: um den Baum herum
      const arrive = interpolate(q, [1, 1.1], [0, 1], clamp);
      if (arrive > 0) {
        const sl = slot(i);
        x += (sl[0] - x) * arrive;
        y += (sl[1] - y) * arrive;
        glow = 1;
      }
      if (stage === "mist") {
        // Im Nebel vom Weg abkommen und verschwinden
        const lost = interpolate(t, [b[1] + 0.6, b[2] + 1.2], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
        x += fg.dir * lost * (90 + 120 * fg.w) + Math.sin(t * 2 + i) * 10 * lost;
        y += lost * (fg.w - 0.5) * 120;
        o = interpolate(t, [b[2] + 0.2, b[2] + 1.5 + fg.w * 0.6], [1, 0.08], clamp);
      }
      if (stage === "rod") {
        // Sie schämen sich – und gehen auf verbotenen Pfaden davon
        const leave = interpolate(t, [b[3] + i * 0.08, b[3] + 1.6 + i * 0.08], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
        if (leave > 0) {
          const ex = EXITS[fg.exit % EXITS.length];
          x += (ex[0] - x) * leave;
          y += (ex[1] - y) * leave;
          o = interpolate(leave, [0.55, 1], [1, 0], clamp);
          glow = Math.max(0, 1 - leave * 2);
        }
      }
      if (stage === "hold" && arrive > 0) glow = 0.8 + 0.2 * Math.sin(frame / 6 + i);
      pawns.push({ x, y, o, glow, color });
    });
  }

  /* --- Anzeigetafel: Stand der vier Gruppen --- */
  const statusOf = (k: number): "wait" | "go" | "ok" | "fail" => {
    if (g < 0 || k > g) return "wait";
    if (k < g) return GROUPS[k].ok ? "ok" : "fail";
    return badge > 0.5 ? (GROUPS[k].ok ? "ok" : "fail") : "go";
  };

  /* --- HUD rechts --- */
  const pill = (() => {
    if (g >= 0) return { text: (s.hud ?? `Gruppe ${g + 1}`).toUpperCase(), color: GROUPS[g].color, o: 1 };
    if (hook) return { text: "ZIEL: 1 VON 4", color: look.accent, o: interpolate(t, [hookAt, hookAt + 0.3], [0, 1], clamp) };
    return { text: "ZIEL: DER BAUM", color: look.accent, o: interpolate(t, [b[0], b[0] + 0.3], [0, 1], clamp) };
  })();

  const intro = stage === "intro" ? interpolate(frame, [0, 26], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) }) : 1;
  const zoom = hook ? interpolate(frame, [0, 150], [1.08, 1], { ...clamp, easing: Easing.out(Easing.cubic) }) : 1;
  const pathLabelO = stage === "intro" ? pathDraw : 0.55;
  const forbidden = stage === "rod" ? interpolate(t, [b[3] - 0.2, b[3] + 0.6], [0, 1], clamp) : 0;
  const lead = pawns[0];

  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <clipPath id="dreamPanel">
            <rect x={PX} y={PY} width={PW} height={PH} rx={36} />
          </clipPath>
          <linearGradient id="dreamField" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0F1A45" />
            <stop offset="55%" stopColor="#13214F" />
            <stop offset="100%" stopColor="#0B1435" />
          </linearGradient>
          <radialGradient id="treeHalo">
            <stop offset="0%" stopColor="#FFF3C4" stopOpacity="0.75" />
            <stop offset="45%" stopColor="#FFE9A3" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#FFE9A3" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="mistDark">
            <stop offset="0%" stopColor="#0B0F24" stopOpacity="0.7" />
            <stop offset="55%" stopColor="#141A36" stopOpacity="0.36" />
            <stop offset="100%" stopColor="#141A36" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="mistLight">
            <stop offset="0%" stopColor="#7A88B2" stopOpacity="0.42" />
            <stop offset="100%" stopColor="#6E7BA3" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="mistVeil" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#070A1C" stopOpacity="0" />
            <stop offset="28%" stopColor="#070A1C" stopOpacity="0.8" />
            <stop offset="75%" stopColor="#070A1C" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#070A1C" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="rodMetal" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#E3E8F2" />
            <stop offset="100%" stopColor="#8B94A8" />
          </linearGradient>
        </defs>

        <g opacity={intro} transform={`translate(540 760) scale(${zoom}) translate(-540 -760)`}>
          {/* Panel mit Spielfeld */}
          <rect x={PX} y={PY} width={PW} height={PH} rx={36} fill="url(#dreamField)" />
          <g clipPath="url(#dreamPanel)">
            {/* Ein weites Feld, «als wäre es eine Welt» (8:20) */}
            {Array.from({ length: 34 }, (_, i) => (
              <path key={i} d={`M ${PX + random(`gx${i}`) * PW} ${PY + 220 + random(`gy${i}`) * (PH - 240)} q 6 -12 12 0 q 6 -10 12 0`} stroke="#2B4A7A" strokeWidth={2.5} fill="none" opacity={0.5} />
            ))}
            {/* Fluss am Ufer der Stange */}
            <g opacity={riverO}>
              <path d={RIVER_D} stroke="#1D466F" strokeWidth={54} fill="none" strokeLinecap="round" />
              <path d={RIVER_D} stroke="#2C6496" strokeWidth={36} fill="none" strokeLinecap="round" />
              <path d={RIVER_D} stroke="#8CC3F0" strokeWidth={4} fill="none" strokeDasharray="18 46" strokeDashoffset={-frame * 2.2} opacity={0.7} />
            </g>
            <Tree lit={treeLit} frame={frame} />
            {/* Verbotene Pfade (8:28) */}
            {forbidden > 0
              ? EXITS.slice(0, 4).map((ex, i) => (
                  <path key={i} d={`M ${TREE[0] + (i - 1.5) * 40} 650 Q ${(TREE[0] + ex[0]) / 2} ${(650 + ex[1]) / 2 + 60} ${ex[0]} ${ex[1]}`} stroke="#FF8A8A" strokeWidth={4} strokeDasharray="6 12" fill="none" opacity={0.5 * forbidden} />
                ))
              : null}
            {/* Der schmale Weg */}
            <path d={toD(PATH.pts)} stroke="#6E5F42" strokeWidth={26} strokeLinecap="round" fill="none" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - pathDraw} />
            <path d={toD(PATH.pts)} stroke="#E9D9B0" strokeWidth={16} strokeLinecap="round" fill="none" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - pathDraw} />
            {/* Start */}
            <g opacity={stage === "intro" ? 0 : 0.8}>
              <circle cx={430} cy={1072} r={34} fill="none" stroke={look.accent2} strokeWidth={3} strokeDasharray="6 8" opacity={0.6} />
            </g>
            {/* Gruppe eins verschwindet im Nebel – sie zeichnet sich darunter */}
            {stage === "mist" ? pawns.map((pw, i) => <Pawn key={i} x={pw.x} y={pw.y} color={pw.color} o={pw.o} glow={pw.glow} />) : null}
            {/* Nebel der Finsternis */}
            <Mist k={mist} t={t} />
            {/* Das Gebäude schwebt darüber – in der Luft, hoch über der Erde */}
            <Building o={buildingO} mock={mock} frame={frame} />
            {/* Spott: Finger zeigen über den Fluss */}
            {mock > 0
              ? HAHA.map((h, i) => {
                  const k = interpolate(t, [mockAt + i * 0.35, mockAt + i * 0.35 + 0.25], [0, 1], { ...clamp, easing: Easing.out(Easing.back(2)) });
                  return (
                    <g key={i} transform={`translate(${h[0]} ${h[1]}) scale(${k}) rotate(${h[2]})`} opacity={k}>
                      <path d="M -62 -26 Q -62 -46 -40 -46 L 40 -46 Q 62 -46 62 -26 L 62 0 Q 62 20 40 20 L 18 20 L 34 40 L -2 20 L -40 20 Q -62 20 -62 0 Z" fill="#FFFFFF" stroke="#C49BFF" strokeWidth={4} />
                      <text y={-1} textAnchor="middle" fontFamily="Anton" fontSize={38} fill="#3A2F63">
                        HAHA
                      </text>
                    </g>
                  );
                })
              : null}
          </g>

          {/* Die eiserne Stange – auch im Nebel zu sehen */}
          <g clipPath="url(#dreamPanel)">
            <path d={toD(ROD.pts)} stroke="#2A2F3D" strokeWidth={10} strokeLinecap="round" fill="none" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - rodDraw} />
            <path d={toD(ROD.pts)} stroke="url(#rodMetal)" strokeWidth={6} strokeLinecap="round" fill="none" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - rodDraw} />
            {Array.from({ length: 11 }, (_, i) => {
              const k = (i + 0.5) / 11;
              if (k > rodDraw) return null;
              const { p } = at(ROD, k);
              const pop = interpolate(rodDraw - k, [0, 0.05], [0, 1], clamp);
              return <rect key={i} x={p[0] - 3.5} y={p[1] - 4} width={7} height={22 * pop} rx={2} fill="#9AA3B6" stroke="#2A2F3D" strokeWidth={1.5} />;
            })}
            {mist > 0.3 && (stage === "rod" || stage === "hold") ? (
              <path d={toD(ROD.pts)} stroke="#E3E8F2" strokeWidth={14} strokeLinecap="round" fill="none" opacity={0.12 + 0.06 * Math.sin(frame / 8)} />
            ) : null}

            {/* Vier Gruppen am Start (Einstieg) */}
            {stage === "intro"
              ? GROUPS.map((gr, k) => {
                  const ap = hook ? interpolate(t, [groupsAt + k * 0.18, groupsAt + k * 0.18 + 0.25], [0, 1], { ...clamp, easing: Easing.out(Easing.back(2)) }) : 1;
                  return (
                    <g key={k}>
                      {Array.from({ length: 4 }, (_, i) => {
                        const cx = 190 + k * 120 + (i % 2) * 26 - 13;
                        const cy = 1048 + Math.floor(i / 2) * 30 - 6;
                        return <Pawn key={i} x={cx} y={cy + (1 - ap) * 30} color={gr.color} o={Math.min(1, ap)} s={1.05} />;
                      })}
                      <text x={190 + k * 120} y={1118} textAnchor="middle" fontFamily="Anton" fontSize={30} fill={gr.color} opacity={Math.min(1, ap)}>
                        {k + 1}
                      </text>
                    </g>
                  );
                })
              : null}
            {stage === "intro" && hook ? (
              <g opacity={interpolate(t, [hookAt, hookAt + 0.3], [0, 1], clamp)}>
                <path d="M 370 990 C 360 860, 520 760, 470 610" stroke={look.accent} strokeWidth={5} strokeDasharray="4 14" strokeLinecap="round" fill="none" opacity={0.7} />
                <text x={370} y={980} textAnchor="middle" fontFamily="Anton" fontSize={110} fill={look.accent} opacity={0.8 + 0.2 * Math.sin(frame / 5)} stroke="#0B1030" strokeWidth={6} paintOrder="stroke">
                  ?
                </text>
              </g>
            ) : null}

            {/* Die laufende Gruppe */}
            {(stage === "mist" ? [] : pawns).map((pw, i) => (
              <Pawn key={i} x={pw.x} y={pw.y} color={pw.color} o={pw.o} glow={pw.glow} />
            ))}
            {/* Fragezeichen über den Verirrten */}
            {stage === "mist" && lead
              ? [0, 3, 5].map((i) => {
                  const pw = pawns[i];
                  const q = interpolate(t, [b[2] - 0.2, b[2] + 0.2], [0, 1], clamp) * pw.o;
                  return q > 0.02 ? (
                    <text key={i} x={pw.x} y={pw.y - 22} textAnchor="middle" fontFamily="Anton" fontSize={34} fill={GROUPS[0].color} opacity={q}>
                      ?
                    </text>
                  ) : null;
                })
              : null}
          </g>

          {/* Beschriftungen des Feldes */}
          <MapLabel x={TREE[0] + 140} y={TREE[1] + 40} text="Baum" anchor="start" o={stage === "intro" ? interpolate(t, [b[0], b[0] + 0.4], [0, 1], clamp) * (hook ? 0 : 1) : 0.55} />
          <MapLabel x={250} y={880} text="schmaler Weg" o={pathLabelO * (hook ? 0 : 1)} />
          <MapLabel x={585} y={790} text="eiserne Stange" o={(stage === "intro" ? rodDraw : 0.55) * (hook ? 0 : 1)} anchor="start" />
          <MapLabel x={745} y={1062} text="Fluss" anchor="start" o={riverO * 0.55 * (hook ? 0 : 1)} />
          <MapLabel x={BUILDING.x + BUILDING.w + 12} y={BUILDING.y + BUILDING.h + 46} text="grosses Gebäude" o={buildingO * 0.8} anchor="end" />
          {forbidden > 0 ? <MapLabel x={180} y={780} text="verbotene Pfade" o={forbidden * 0.8} color="#FF9C9C" /> : null}
          {/* Was da aufzieht */}
          {stage === "mist" ? (
            <g opacity={interpolate(t, [b[1], b[1] + 0.8, b[2] + 0.4, b[2] + 1.2], [0, 0.95, 0.95, 0.4], clamp)} transform="rotate(-4 205 740)">
              {["NEBEL DER", "FINSTERNIS"].map((line, i) => (
                <text key={i} x={205} y={725 + i * 50} textAnchor="middle" fontFamily="Anton" fontSize={46} letterSpacing="0.08em" fill="#B4BEDD" stroke="#070A1C" strokeWidth={6} paintOrder="stroke">
                  {line}
                </text>
              ))}
            </g>
          ) : null}

          {/* Rahmen wie ein Spielfeld */}
          <rect x={PX} y={PY} width={PW} height={PH} rx={36} fill="none" stroke={look.accent2} strokeWidth={3} opacity={0.55} />
          {[
            [PX - 10, PY - 10, 1, 1],
            [PX + PW + 10, PY - 10, -1, 1],
            [PX - 10, PY + PH + 10, 1, -1],
            [PX + PW + 10, PY + PH + 10, -1, -1],
          ].map(([cx, cy, sx, sy], i) => (
            <path key={i} d={`M ${cx} ${cy + sy * 44} L ${cx} ${cy} L ${cx + sx * 44} ${cy}`} stroke={look.accent} strokeWidth={6} fill="none" opacity={0.85} />
          ))}
        </g>
      </svg>

      {/* HUD */}
      <div
        style={{
          position: "absolute",
          left: PX + 26,
          right: 1080 - PX - PW + 26,
          top: PY - 36,
          height: 72,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 26px",
          borderRadius: 16,
          background: "rgba(6,10,34,0.9)",
          border: `2px solid ${look.accent}`,
          boxShadow: "0 0 24px rgba(255,233,163,0.25)",
          opacity: intro,
        }}
      >
        <span style={{ fontFamily: "Anton", fontSize: 38, letterSpacing: "0.08em", color: look.text }}>LEHIS TRAUM</span>
        <span style={{ fontFamily: "Anton", fontSize: 34, letterSpacing: "0.08em", color: "#0B1030", background: pill.color, padding: "3px 18px", borderRadius: 10, opacity: pill.o }}>{pill.text}</span>
      </div>

      {/* Anzeigetafel unten im Feld */}
      <div style={{ position: "absolute", left: 0, right: 0, top: PY + PH - 72, display: "flex", justifyContent: "center", gap: 14, opacity: intro * (stage === "intro" ? 0 : 1) }}>
        {GROUPS.map((gr, k) => {
          const st = statusOf(k);
          const cur = k === g;
          return (
            <div
              key={k}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 14px",
                borderRadius: 999,
                background: cur ? "rgba(6,10,34,0.95)" : "rgba(6,10,34,0.7)",
                border: `3px solid ${gr.color}`,
                opacity: st === "wait" ? 0.55 : 1,
                boxShadow: cur ? `0 0 16px ${gr.color}` : "none",
                fontFamily: "Inter",
                fontWeight: 800,
                fontSize: 24,
                color: "#FFFFFF",
              }}
            >
              <span style={{ width: 14, height: 14, borderRadius: 7, background: gr.color }} />
              {k + 1}
              <span style={{ color: st === "ok" ? "#6BF2A6" : st === "fail" ? "#FF7B7B" : "rgba(255,255,255,0.6)" }}>{st === "ok" ? "✓" : st === "fail" ? "✗" : st === "go" ? "▶" : "…"}</span>
            </div>
          );
        })}
      </div>

      {g >= 0 ? <Badge g={g} k={badge} /> : null}

      {/* Geräusche */}
      {stage === "intro" ? (
        hook ? (
          <>
            <Sfx frame={1} name="whoosh" volume={0.35} />
            {[0, 1, 2, 3].map((k) => (
              <Sfx key={k} frame={f(groupsAt + k * 0.18)} name="pop" volume={0.25} />
            ))}
            <Sfx frame={f(hookAt)} name="question" volume={0.4} />
          </>
        ) : (
          <>
            <Sfx frame={f(b[0])} name="chime" volume={0.4} />
            <Sfx frame={f(b[1])} name="whoosh" volume={0.35} />
            <Sfx frame={f(b[2])} name="unlock" volume={0.3} />
          </>
        )
      ) : null}
      {stage === "mist" ? (
        <>
          <Sfx frame={f(b[0])} name="blip" volume={0.3} />
          <Sfx frame={f(b[1])} name="whoosh" volume={0.45} />
          <Sfx frame={f(b[2])} name="glitch" volume={0.3} />
          <Sfx frame={f(badgeAt)} name="stamp" volume={0.5} />
        </>
      ) : null}
      {stage === "rod" ? (
        <>
          <Sfx frame={f(0)} name="blip" volume={0.3} />
          <Sfx frame={f(b[1])} name="chime" volume={0.4} />
          {HAHA.map((_, i) => (
            <Sfx key={i} frame={f(mockAt + i * 0.35)} name="pop" volume={0.3} />
          ))}
          <Sfx frame={f(b[3])} name="glitch" volume={0.3} />
          <Sfx frame={f(badgeAt)} name="stamp" volume={0.5} />
        </>
      ) : null}
      {stage === "hold" ? (
        <>
          <Sfx frame={f(b[0])} name="blip" volume={0.3} />
          <Sfx frame={f(b[1])} name="tick" volume={0.4} />
          <Sfx frame={f(b[2])} name="chime" volume={0.4} />
          {HAHA.map((_, i) => (
            <Sfx key={i} frame={f(mockAt + i * 0.35)} name="pop" volume={0.22} />
          ))}
          <Sfx frame={f(badgeAt)} name="levelup" volume={0.4} />
        </>
      ) : null}
      {stage === "building" ? (
        <>
          <Sfx frame={2} name="whoosh" volume={0.35} />
          <Sfx frame={f(badgeAt)} name="stamp" volume={0.5} />
        </>
      ) : null}
    </AbsoluteFill>
  );
};

/** Wohin die Gruppe zwei davongeht. */
const EXITS: P[] = [
  [110, 640],
  [120, 820],
  [160, 980],
  [90, 520],
  [210, 1120],
  [130, 900],
  [80, 720],
];
/** Spott aus dem Gebäude: [x, y, Drehung] */
const HAHA: Array<[number, number, number]> = [
  [712, 432, -8],
  [700, 572, 6],
  [718, 694, -4],
];

const MapLabel: React.FC<{ x: number; y: number; text: string; o: number; anchor?: "middle" | "start" | "end"; color?: string }> = ({ x, y, text, o, anchor = "middle", color = "#DCE6FF" }) =>
  o > 0.01 ? (
    <text x={x} y={y} textAnchor={anchor} fontFamily="Inter" fontWeight={800} fontSize={26} letterSpacing="0.06em" fill={color} opacity={o} stroke="#0B1030" strokeWidth={6} paintOrder="stroke">
      {text}
    </text>
  ) : null;
