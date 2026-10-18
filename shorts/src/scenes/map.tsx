import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, random, useCurrentFrame } from "remotion";
import { useLook } from "../looks";
import { Sfx, beats, voiceFrame } from "../lib/sfx";
import { FPS, type TimelineScene } from "../lib/timing";
import type { Scene } from "../schema";

/*
 * Kartentisch: die Lockvogel-Taktik aus Alma 56:30–56 als Skizze auf Pergament.
 * Die Truppen sind Punktschwärme, die über die Karte ziehen – Etappe für Etappe, im Takt
 * der Stimme (`cues`). Die Karte ist ein Schema: Die Schriften nennen Richtungen und
 * Abläufe, keine Landkarte.
 */

type MapSceneT = Extract<Scene, { type: "map" }>;
type Stage = MapSceneT["stage"];
type P = [number, number];
type Unit = "blue" | "red" | "green";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const MX = 70;
const MY = 270;
const MW = 940;
const MH = 900;
const INK = "#3B2A1A";
const HAND = "Caveat";

const CITY: Record<string, { p: P; label: string; enemy?: boolean }> = {
  judaea: { p: [815, 640], label: "Judäa" },
  antiparah: { p: [470, 730], label: "Antiparah", enemy: true },
  sea: { p: [205, 650], label: "Stadt am Meer" },
};

const UNIT: Record<Unit, { n: number; r: number; color: string; rim: string; label: string; side: 1 | -1 }> = {
  blue: { n: 34, r: 36, color: "#2B5BA8", rim: "#173563", label: "Helaman + 2000", side: -1 },
  red: { n: 90, r: 64, color: "#B5302A", rim: "#6E1A16", label: "Lamaniten", side: 1 },
  green: { n: 46, r: 46, color: "#3C7A3A", rim: "#21461F", label: "Antipus", side: -1 },
};

const START: Record<Unit, P> = { blue: [715, 610], red: [470, 730], green: [835, 520] };

/** Wegpunkte je Etappe; jede Etappe beginnt, wo die vorige aufhört. */
const TRACK: Partial<Record<Stage, Partial<Record<Unit, P[]>>>> = {
  plan: { blue: [START.blue, [620, 606], [522, 612]] },
  bait: {
    blue: [[522, 612], [508, 540], [496, 470]],
    red: [START.red, [482, 655], [490, 590]],
    green: [START.green, [740, 600], [630, 650]],
  },
  chase: {
    blue: [[496, 470], [485, 330], [470, 190]],
    red: [[490, 590], [480, 440], [470, 318]],
    green: [[630, 650], [565, 560], [508, 452]],
  },
  battle: {
    blue: [[470, 190], [470, 238]],
    green: [[508, 452], [520, 482], [500, 418]],
  },
};
const ORDER: Stage[] = ["intro", "plan", "bait", "chase", "halt", "battle", "count"];

const endOf = (stage: Stage, u: Unit): P => {
  for (let i = ORDER.indexOf(stage); i >= 0; i--) {
    const pts = TRACK[ORDER[i]]?.[u];
    if (pts) return pts[pts.length - 1];
  }
  return START[u];
};
const startOf = (stage: Stage, u: Unit): P => {
  const i = ORDER.indexOf(stage);
  return i > 0 ? endOf(ORDER[i - 1], u) : START[u];
};

/** Punkt auf einem Linienzug nach Bogenlänge (p = 0 … 1). */
const along = (pts: P[], p: number): P => {
  if (pts.length === 1) return pts[0];
  const seg = pts.slice(1).map((q, i) => Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]));
  const total = seg.reduce((a, b) => a + b, 0) || 1;
  let d = Math.max(0, Math.min(1, p)) * total;
  for (let i = 0; i < seg.length; i++) {
    if (d <= seg[i] || i === seg.length - 1) {
      const k = seg[i] ? Math.min(1, d / seg[i]) : 1;
      return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k];
    }
    d -= seg[i];
  }
  return pts[pts.length - 1];
};

/** Fortschritt einer Bewegung von a bis b (Sekunden), mit optionaler Pause (Nacht). */
const moveP = (t: number, a: number, b: number, pause?: [number, number]) => {
  if (!pause) return interpolate(t, [a, b], [0, 1], { ...clamp, easing: Easing.inOut(Easing.sin) });
  const total = b - a - (pause[1] - pause[0]);
  const moved = Math.max(0, Math.min(t, pause[0]) - a) + Math.max(0, Math.min(t, b) - pause[1]);
  return Math.max(0, Math.min(1, moved / Math.max(0.1, total)));
};

type Plan = {
  pos: (u: Unit, t: number) => P;
  visible: Record<Unit, (t: number) => number>;
};

const buildPlan = (stage: Stage, b: number[], end: number): Plan => {
  const still = (u: Unit) => (_t: number) => startOf(stage, u);
  const on = () => 1;
  const pos: Record<Unit, (t: number) => P> = { blue: still("blue"), red: still("red"), green: still("green") };
  const visible: Record<Unit, (t: number) => number> = { blue: on, red: on, green: on };
  const tr = TRACK[stage] ?? {};
  switch (stage) {
    case "plan":
      pos.blue = (t) => along(tr.blue!, moveP(t, b[0], end));
      break;
    case "bait":
      pos.red = (t) => along(tr.red!, moveP(t, b[0], end));
      pos.blue = (t) => along(tr.blue!, moveP(t, b[0] + 0.3, end));
      pos.green = (t) => along(tr.green!, moveP(t, b[1], end + 0.5));
      visible.green = (t) => interpolate(t, [b[1] - 0.2, b[1] + 0.3], [0, 1], clamp);
      break;
    case "chase":
      (["blue", "red", "green"] as Unit[]).forEach((u) => {
        pos[u] = (t) => along(tr[u]!, moveP(t, 0, b[3], [b[1], b[2]]));
      });
      break;
    case "battle":
      pos.blue = (t) => along(tr.blue!, moveP(t, b[0], b[2]));
      pos.green = (t) => {
        const back = moveP(t, b[1], b[1] + 0.8);
        const again = moveP(t, b[2] + 0.2, b[3]);
        return again > 0 ? along([tr.green![1], tr.green![2]], again) : along([tr.green![0], tr.green![1]], back);
      };
      pos.red = (t) => {
        const p = moveP(t, b[2], b[2] + 0.6);
        return [470, 318 - 12 * p];
      };
      break;
    case "count":
      pos.blue = () => [470, 250];
      visible.red = () => 0.35;
      visible.green = () => 0.5;
      break;
    default:
      if (stage === "intro") {
        visible.green = (t) => interpolate(t, [0.9, 1.3], [0, 1], clamp);
        visible.blue = (t) => interpolate(t, [0.8, 1.2], [0, 1], clamp);
        visible.red = (t) => interpolate(t, [1.0, 1.4], [0, 1], clamp);
      }
  }
  return { pos: (u, t) => pos[u](t), visible };
};

/** Raue Pergamentkante */
const parchmentPath = () => {
  const pts: string[] = [];
  const j = (k: string) => (random(k) - 0.5) * 16;
  const n = 26;
  for (let i = 0; i <= n; i++) pts.push(`${(i / n) * MW + j(`t${i}`)} ${8 + j(`ty${i}`)}`);
  for (let i = 0; i <= n; i++) pts.push(`${MW - 8 + j(`rx${i}`)} ${(i / n) * MH + j(`r${i}`)}`);
  for (let i = n; i >= 0; i--) pts.push(`${(i / n) * MW + j(`b${i}`)} ${MH - 8 + j(`by${i}`)}`);
  for (let i = n; i >= 0; i--) pts.push(`${8 + j(`lx${i}`)} ${(i / n) * MH + j(`l${i}`)}`);
  return `M ${pts.join(" L ")} Z`;
};

const Castle: React.FC<{ p: P; label: string; enemy?: boolean; o: number }> = ({ p, label, enemy, o }) => (
  <g transform={`translate(${p[0]} ${p[1]})`} opacity={o}>
    <rect x={-30} y={-24} width={60} height={46} fill="#C9B184" stroke={INK} strokeWidth={3.5} />
    {[-26, -12, 2, 16].map((x) => (
      <rect key={x} x={x} y={-34} width={10} height={11} fill={INK} />
    ))}
    <rect x={-8} y={4} width={16} height={18} fill={INK} />
    {enemy ? (
      <g>
        <line x1={0} y1={-34} x2={0} y2={-74} stroke={INK} strokeWidth={3} />
        <path d="M 0 -74 L 30 -66 L 0 -56 Z" fill="#B5302A" />
      </g>
    ) : null}
    <text y={58} textAnchor="middle" fontFamily={HAND} fontWeight={700} fontSize={40} fill={INK}>
      {label}
    </text>
  </g>
);

const Tree: React.FC<{ x: number; y: number; s: number }> = ({ x, y, s }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <rect x={-2} y={8} width={4} height={10} fill="#5A4630" />
    <path d="M -14 10 L 0 -18 L 14 10 Z" fill="#5F7444" stroke="#3E4E2A" strokeWidth={1.5} />
  </g>
);

const Swarm: React.FC<{ u: Unit; plan: Plan; t: number; surround: number; gray: number }> = ({ u, plan, t, surround, gray }) => {
  const cfg = UNIT[u];
  const dots = useMemo(
    () =>
      Array.from({ length: cfg.n }, (_, i) => {
        const a = random(`${u}a${i}`) * Math.PI * 2;
        const r = cfg.r * Math.sqrt(random(`${u}r${i}`));
        return { dx: Math.cos(a) * r, dy: Math.sin(a) * r * 0.8, lag: random(`${u}l${i}`) * 0.55, ph: random(`${u}p${i}`) * 6.28 };
      }),
    [u, cfg.n, cfg.r],
  );
  const o = plan.visible[u](t);
  if (o <= 0.001) return null;
  const center = plan.pos("red", t);
  const fill = gray > 0 ? mixHex(cfg.color, "#8C8478", gray) : cfg.color;
  return (
    <g opacity={o}>
      {dots.map((d, i) => {
        let [x, y] = plan.pos(u, t - d.lag);
        x += d.dx + Math.sin(t * 3 + d.ph) * 2.2;
        y += d.dy + Math.cos(t * 2.6 + d.ph) * 2.2;
        if (surround > 0 && u !== "red") {
          // Ring um das Heer der Lamaniten: Blau oben, Grün unten
          const k = i / cfg.n;
          const ang = u === "blue" ? -Math.PI + k * Math.PI : k * Math.PI;
          const ring: P = [center[0] + Math.cos(ang) * 112, center[1] + Math.sin(ang) * 96];
          x += (ring[0] - x) * surround;
          y += (ring[1] - y) * surround;
        }
        return <circle key={i} cx={x} cy={y} r={u === "red" ? 6.5 : 7.5} fill={fill} stroke={cfg.rim} strokeWidth={1.6} />;
      })}
    </g>
  );
};

const mixHex = (a: string, b: string, p: number) => {
  const h = (s: string) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
  const [x, y] = [h(a), h(b)];
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * p)).join(",")})`;
};

const Stamp: React.FC<{ text: string; x: number; y: number; at: number; t: number; color: string; rotate?: number; size?: number }> = ({ text, x, y, at, t, color, rotate = -8, size = 64 }) => {
  const k = interpolate(t, [at, at + 0.18], [0, 1], { ...clamp, easing: Easing.out(Easing.back(2)) });
  if (k <= 0) return null;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${interpolate(k, [0, 1], [1.8, 1])})`} opacity={Math.min(1, k * 1.5) * 0.92}>
      <rect x={-text.length * size * 0.29 - 26} y={-size * 0.78} width={text.length * size * 0.58 + 52} height={size * 1.32} rx={10} fill="none" stroke={color} strokeWidth={7} />
      <text textAnchor="middle" y={size * 0.3} fontFamily="Anton" fontSize={size} fill={color} letterSpacing={3}>
        {text}
      </text>
    </g>
  );
};

export const MapScene: React.FC<{ ts: TimelineScene }> = ({ ts }) => {
  const s = ts.scene as MapSceneT;
  const frame = useCurrentFrame();
  const look = useLook();
  const t = (frame - ts.audioOffsetFrames) / FPS;
  const end = ts.speechEndSec;
  const b = beats(ts, s.cues, Math.max(4, s.cues.length));
  const plan = buildPlan(s.stage, b, end);
  const edge = useMemo(parchmentPath, []);
  const trees = useMemo(
    () =>
      Array.from({ length: 46 }, (_, i) => ({
        x: 150 + random(`tx${i}`) * 700,
        y: 70 + random(`ty${i}`) * 260,
        s: 0.9 + random(`ts${i}`) * 0.7,
      })).sort((a, c) => a.y - c.y),
    [],
  );

  // Kamera: In der Pause vor der Entscheidung und in der Schlacht nah heran
  const focus: Record<Stage, [number, number, number]> = {
    intro: [470, 450, 1],
    plan: [470, 450, 1],
    bait: [470, 450, 1],
    chase: [470, 450, 1],
    halt: [480, 300, 1.55],
    battle: [480, 330, 1.55],
    count: [430, 270, 1.7],
  };
  const camIn = s.stage === "halt" ? interpolate(frame, [0, 36], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) }) : 1;
  const prevFocus = s.stage === "halt" ? focus.chase : s.stage === "count" ? focus.battle : focus[s.stage];
  const camT = s.stage === "count" ? interpolate(frame, [0, 40], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) }) : camIn;
  const [cx, cy, zoom] = focus[s.stage].map((v, i) => prevFocus[i] + (v - prevFocus[i]) * camT) as [number, number, number];
  const cam = `translate(${MW / 2} ${MH / 2}) scale(${zoom}) translate(${-cx} ${-cy})`;

  // Auftritt der Karte: Rolle öffnet sich (nur in der ersten Etappe)
  const unroll = s.stage === "intro" ? interpolate(frame, [0, 22], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) }) : 1;
  const labelO = (k: number) => (s.stage === "intro" ? interpolate(t, [0.4 + k * 0.18, 0.7 + k * 0.18], [0, 1], clamp) : 1);

  // HUD-Text je Etappe
  const dayLabel = (() => {
    if (s.stage === "chase") {
      if (t >= b[3]) return "TAG 3 · MORGEN";
      if (t >= b[2]) return "TAG 2";
      if (t >= b[1]) return "NACHT";
      return "TAG 1";
    }
    return s.hud ?? "";
  })();
  const night = s.stage === "chase" ? interpolate(t, [b[1] - 0.2, b[1] + 0.3, b[2] - 0.3, b[2] + 0.2], [0, 1, 1, 0], clamp) : 0;
  const halted = s.stage === "chase" ? interpolate(t, [b[3], b[3] + 0.3], [0, 1], clamp) : s.stage === "halt" ? 1 : 0;
  const surround = s.stage === "battle" ? interpolate(t, [b[3], b[3] + 0.9], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) }) : 0;
  const gray = s.stage === "battle" ? interpolate(t, [b[3] + 0.6, b[3] + 1.2], [0, 1], clamp) : s.stage === "count" ? 1 : 0;
  const greenFade = s.stage === "battle" ? interpolate(t, [b[1], b[1] + 0.6, b[2] + 0.2, b[2] + 0.8], [1, 0.55, 0.55, 1], clamp) : 1;

  // Spuren: frühere Etappen gestrichelt, die laufende wächst mit
  const trails = (u: Unit) => {
    const out: string[] = [];
    for (const st of ORDER.slice(0, ORDER.indexOf(s.stage))) {
      const pts = TRACK[st]?.[u];
      if (pts) out.push(pts.map((q) => q.join(" ")).join(" L "));
    }
    if (TRACK[s.stage]?.[u] && s.stage !== "battle") {
      const now: string[] = [];
      for (let k = 0; k <= 30; k++) {
        const tt = Math.min(t, end) * (k / 30);
        now.push(plan.pos(u, tt).join(" "));
      }
      out.push(now.join(" L "));
    }
    return out.map((d) => `M ${d}`);
  };

  const counter = s.stage === "count" ? Math.round(interpolate(t, [b[0] + 0.2, b[1] - 0.15], [0, 2000], { ...clamp, easing: Easing.out(Easing.quad) })) : 0;

  return (
    <AbsoluteFill>
      {/* Pergament */}
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <clipPath id="mapClip">
            <path d={edge} />
          </clipPath>
          <clipPath id="unroll">
            <rect x={(MW * (1 - unroll)) / 2} y={0} width={MW * unroll} height={MH} />
          </clipPath>
          <radialGradient id="parch" cx="0.45" cy="0.4" r="0.85">
            <stop offset="0%" stopColor="#F2E2BE" />
            <stop offset="70%" stopColor="#E0C793" />
            <stop offset="100%" stopColor="#B99A62" />
          </radialGradient>
          <linearGradient id="sea" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#7E9C9A" />
            <stop offset="100%" stopColor="#A9BFB6" stopOpacity="0.2" />
          </linearGradient>
        </defs>
        <g transform={`translate(${MX} ${MY})`} clipPath="url(#unroll)">
          <path d={edge} fill="rgba(0,0,0,0.45)" transform="translate(10 14)" />
          <g clipPath="url(#mapClip)">
            <rect width={MW} height={MH} fill="url(#parch)" />
            <g transform={cam}>
              {/* Meer im Westen */}
              <path d={`M 0 0 L 130 0 C 150 160, 110 300, 140 460 S 120 760, 150 ${MH} L 0 ${MH} Z`} fill="url(#sea)" />
              {Array.from({ length: 9 }, (_, i) => (
                <path key={i} d={`M ${30 + (i % 2) * 30} ${80 + i * 95} q 15 -10 30 0 t 30 0`} stroke="#58716F" strokeWidth={3} fill="none" opacity={0.6} />
              ))}
              <text x={60} y={470} fontFamily={HAND} fontWeight={700} fontSize={36} fill="#4A6563" transform="rotate(-90 60 470)" textAnchor="middle">
                Meer
              </text>
              {/* Wildnis im Norden */}
              {trees.map((tr, i) => (
                <g key={i} opacity={labelO(0)}>
                  <Tree x={tr.x} y={tr.y} s={tr.s} />
                </g>
              ))}
              <text x={720} y={360} fontFamily={HAND} fontWeight={700} fontSize={40} fill={INK} opacity={0.75 * labelO(1)} textAnchor="middle">
                Wildnis
              </text>
              {/* Kompass */}
              <g transform={`translate(840 110) rotate(${s.stage === "intro" ? interpolate(t, [0, 1.2], [-200, 0], clamp) : 0})`} opacity={labelO(1)}>
                <circle r={46} fill="none" stroke={INK} strokeWidth={2.5} />
                <path d="M 0 -58 L 11 0 L 0 58 L -11 0 Z" fill={INK} opacity={0.85} />
                <path d="M -58 0 L 0 -9 L 58 0 L 0 9 Z" fill={INK} opacity={0.45} />
                <text y={-66} textAnchor="middle" fontFamily={HAND} fontWeight={700} fontSize={34} fill={INK}>
                  N
                </text>
              </g>
              {/* Geplante Route (die Täuschung) */}
              {s.stage === "plan" || s.stage === "intro" ? (
                <path
                  d={`M ${START.blue.join(" ")} L 620 606 L 520 612 L 360 630 L ${CITY.sea.p[0] + 40} ${CITY.sea.p[1] - 6}`}
                  stroke={INK}
                  strokeWidth={4}
                  strokeDasharray="4 14"
                  strokeLinecap="round"
                  fill="none"
                  opacity={s.stage === "plan" ? interpolate(t, [b[0] - 0.1, b[0] + 0.6], [0, 0.75], clamp) : 0}
                />
              ) : null}
              {Object.entries(CITY).map(([k, c], i) => (
                <Castle key={k} p={c.p} label={c.label} enemy={c.enemy} o={labelO(2 + i)} />
              ))}
              {/* Spuren */}
              {(["red", "green", "blue"] as Unit[]).map((u) =>
                trails(u).map((d, i) => <path key={`${u}${i}`} d={d} stroke={UNIT[u].color} strokeWidth={5} strokeDasharray="2 12" strokeLinecap="round" fill="none" opacity={0.55} />),
              )}
              {/* Truppen */}
              <g opacity={greenFade}>
                <Swarm u="green" plan={plan} t={t} surround={surround} gray={0} />
              </g>
              <Swarm u="red" plan={plan} t={t} surround={0} gray={gray} />
              <Swarm u="blue" plan={plan} t={t} surround={surround} gray={0} />
              {/* Lagerfeuer in der Nacht */}
              {night > 0
                ? (["blue", "red", "green"] as Unit[]).map((u) => {
                    const [x, y] = plan.pos(u, t);
                    const fl = 0.8 + 0.2 * Math.sin(frame / 2 + x);
                    return (
                      <g key={u} opacity={night}>
                        <circle cx={x + 30} cy={y + 30} r={26 * fl} fill="#FFB347" opacity={0.35} />
                        <path d={`M ${x + 22} ${y + 38} Q ${x + 30} ${y + 12 - 6 * fl} ${x + 38} ${y + 38} Z`} fill="#FF8A3D" />
                      </g>
                    );
                  })
                : null}
              {/* Beschriftung der Truppen */}
              {(["blue", "red", "green"] as Unit[]).map((u) => {
                const o = plan.visible[u](t) * (s.stage === "count" && u !== "blue" ? 0 : 1) * (surround > 0.5 && u !== "red" ? 1 - surround : 1);
                if (o <= 0.01) return null;
                const [x, y] = plan.pos(u, t);
                const cfg = UNIT[u];
                const lx = x + cfg.side * (cfg.r + 26);
                return (
                  <text key={u} x={lx} y={y - cfg.r * 0.4} textAnchor={cfg.side > 0 ? "start" : "end"} fontFamily={HAND} fontWeight={700} fontSize={38} fill={cfg.rim} opacity={o} stroke="#F2E2BE" strokeWidth={8} paintOrder="stroke">
                    {u === "red" && gray > 0.5 ? "ergeben" : cfg.label}
                  </text>
                );
              })}
              {/* Proviant – nur zum Schein */}
              {s.stage === "plan" ? (
                <g opacity={interpolate(t, [b[1], b[1] + 0.25], [0, 1], clamp)} transform={`translate(${plan.pos("blue", t)[0] - 18} ${plan.pos("blue", t)[1] - 92})`}>
                  {[0, 26, 13].map((x, i) => (
                    <g key={i} transform={`translate(${x} ${i === 2 ? -22 : 0})`}>
                      <rect width={26} height={22} fill="#A57A44" stroke={INK} strokeWidth={2.5} />
                      <line x1={0} y1={11} x2={26} y2={11} stroke={INK} strokeWidth={2} />
                    </g>
                  ))}
                  <text x={78} y={6} fontFamily={HAND} fontWeight={700} fontSize={34} fill={INK}>
                    Proviant?
                  </text>
                </g>
              ) : null}
              {/* Alarm, als das Heer ausrückt */}
              {s.stage === "bait" ? (
                <text
                  x={CITY.antiparah.p[0] + 50}
                  y={CITY.antiparah.p[1] - 80}
                  fontFamily="Anton"
                  fontSize={96}
                  fill="#B5302A"
                  opacity={interpolate(t, [b[0], b[0] + 0.15, b[0] + 1.6, b[0] + 2], [0, 1, 1, 0], clamp)}
                  transform={`rotate(10 ${CITY.antiparah.p[0] + 50} ${CITY.antiparah.p[1] - 80})`}
                >
                  !
                </text>
              ) : null}
              {/* Fragezeichen: Warum bleiben sie stehen? */}
              {halted > 0 ? (
                <text
                  x={630}
                  y={235}
                  fontFamily={HAND}
                  fontWeight={700}
                  fontSize={150}
                  fill="#B5302A"
                  opacity={halted}
                  transform={`rotate(${8 + Math.sin(frame / 7) * 4} 630 235)`}
                >
                  ?
                </text>
              ) : null}
              {s.stage === "halt" ? (
                <g opacity={interpolate(t, [b[1] - 0.1, b[1] + 0.2], [0, 1], clamp)}>
                  <path d="M 300 120 Q 300 70 360 70 L 520 70 Q 580 70 580 120 Q 580 165 520 165 L 470 165 L 455 190 L 440 165 L 360 165 Q 300 165 300 120 Z" fill="#FFF8E8" stroke={INK} strokeWidth={4} transform="translate(-40 -40)" />
                  <text x={400} y={93} textAnchor="middle" fontFamily={HAND} fontWeight={700} fontSize={50} fill={INK}>
                    Sollen wir?
                  </text>
                </g>
              ) : null}
              {s.stage === "halt" ? (
                <text x={392} y={345} textAnchor="end" fontFamily={HAND} fontWeight={700} fontSize={46} fill="#B5302A" stroke="#F2E2BE" strokeWidth={8} paintOrder="stroke" opacity={interpolate(t, [b[0], b[0] + 0.3], [0, 1], clamp)}>
                  Falle?
                </text>
              ) : null}
              {/* Kampf: Funken an der Berührungslinie */}
              {s.stage === "battle"
                ? Array.from({ length: 8 }, (_, i) => {
                    const on = t > b[1] && t < b[3] + 0.6;
                    if (!on) return null;
                    const front = t > b[2] ? (i % 2 ? 268 : 372) : 372;
                    const x = 400 + ((i * 37) % 150);
                    const flick = Math.sin(frame * 1.3 + i * 2) > 0.2;
                    return flick ? (
                      <g key={i} transform={`translate(${x} ${front + ((i * 13) % 20)})`} stroke="#E0573F" strokeWidth={4}>
                        <line x1={-10} y1={0} x2={10} y2={0} />
                        <line x1={0} y1={-10} x2={0} y2={10} />
                        <line x1={-7} y1={-7} x2={7} y2={7} />
                      </g>
                    ) : null;
                  })
                : null}
              {s.stage === "battle" ? <Stamp text="ERGEBEN" x={470} y={318} at={b[3] + 0.9} t={t} color="#B5302A" size={58} /> : null}
              {s.stage === "count" ? <Stamp text="KEINER GEFALLEN" x={470} y={370} at={b[1]} t={t} color="#2B5BA8" rotate={-6} size={46} /> : null}
            </g>
            {/* Nacht über der ganzen Karte */}
            <rect width={MW} height={MH} fill="#0B1630" opacity={0.55 * night} />
            {night > 0
              ? Array.from({ length: 22 }, (_, i) => (
                  <circle key={i} cx={random(`ns${i}`) * MW} cy={random(`nsy${i}`) * MH * 0.6} r={2.5} fill="#FFF6D8" opacity={night * (0.5 + 0.5 * Math.sin(frame / 5 + i))} />
                ))
              : null}
            {night > 0 ? <circle cx={MW - 140} cy={170} r={44} fill="#FFF3C4" opacity={night * 0.9} /> : null}
            {/* Ränder abgedunkelt */}
            <rect width={MW} height={MH} fill="url(#edgeShade)" />
          </g>
          <defs>
            <radialGradient id="edgeShade" cx="0.5" cy="0.5" r="0.75">
              <stop offset="70%" stopColor="#5A3A16" stopOpacity="0" />
              <stop offset="100%" stopColor="#5A3A16" stopOpacity="0.45" />
            </radialGradient>
          </defs>
          {s.stage === "intro" && s.cues[0] ? <Stamp text="STRENG GEHEIM" x={MW / 2} y={MH / 2 + 60} at={b[0]} t={t} color="#B5302A" size={74} /> : null}
        </g>
      </svg>

      {/* HUD oben auf der Karte */}
      <div style={{ position: "absolute", left: MX + 26, right: 1080 - MX - MW + 26, top: MY - 34, height: 74, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 28px", borderRadius: 14, background: "rgba(20,14,8,0.88)", border: `2px solid ${look.accent}`, opacity: unroll }}>
        <span style={{ fontFamily: "Anton", fontSize: 38, letterSpacing: "0.08em", color: look.text }}>MISSION: LOCKVOGEL</span>
        {dayLabel ? (
          <span style={{ fontFamily: "Anton", fontSize: 34, letterSpacing: "0.08em", color: "#14100A", background: look.accent, padding: "4px 18px", borderRadius: 8 }}>{dayLabel}</span>
        ) : null}
      </div>
      {s.stage === "count" ? (
        <div style={{ position: "absolute", left: 0, right: 0, top: MY + MH - 150, textAlign: "center" }}>
          <span style={{ fontFamily: "Anton", fontSize: 92, color: counter >= 2000 ? "#2B5BA8" : INK, background: "rgba(242,226,190,0.92)", padding: "4px 34px", borderRadius: 18, border: `4px solid ${INK}` }}>
            {counter} / 2000 {counter >= 2000 ? "✓" : ""}
          </span>
        </div>
      ) : null}
      {/* Geräusche */}
      <Sounds stage={s.stage} ts={ts} b={b} hasCue={s.cues.length > 0} />
      <div style={{ position: "absolute", left: MX + 30, top: MY + MH - 56, fontFamily: HAND, fontWeight: 700, fontSize: 30, color: "rgba(59,42,26,0.6)", opacity: s.stage === "intro" ? labelO(5) : 1 }}>
        Skizze – nicht massstabsgetreu
      </div>
    </AbsoluteFill>
  );
};

const Sounds: React.FC<{ stage: Stage; ts: TimelineScene; b: number[]; hasCue: boolean }> = ({ stage, ts, b, hasCue }) => {
  const f = (sec: number) => voiceFrame(ts, sec);
  switch (stage) {
    case "intro":
      return (
        <>
          <Sfx frame={1} name="whoosh" volume={0.35} />
          {[0.45, 0.65, 0.85].map((x, i) => (
            <Sfx key={i} frame={f(x)} name="pop" volume={0.25} />
          ))}
          {hasCue ? <Sfx frame={f(b[0])} name="stamp" volume={0.6} /> : null}
        </>
      );
    case "plan":
      return <Sfx frame={f(b[1])} name="pop" volume={0.35} />;
    case "bait":
      return (
        <>
          <Sfx frame={f(b[0])} name="drum" volume={0.6} />
          <Sfx frame={f(b[0] + 0.25)} name="drum" volume={0.45} />
          <Sfx frame={f(b[1])} name="drum" volume={0.4} />
        </>
      );
    case "chase":
      return (
        <>
          {[0, 1, 2, 3].map((k) => (
            <Sfx key={k} frame={f(b[k])} name="tick" volume={0.45} />
          ))}
          <Sfx frame={f(b[3] + 0.1)} name="question" volume={0.4} />
        </>
      );
    case "halt":
      return <Sfx frame={f(b[1])} name="pop" volume={0.4} />;
    case "battle":
      return (
        <>
          <Sfx frame={f(b[0])} name="whoosh" volume={0.35} />
          <Sfx frame={f(b[1])} name="clash" volume={0.3} />
          <Sfx frame={f(b[2])} name="drum" volume={0.6} />
          <Sfx frame={f(b[2] + 0.1)} name="clash" volume={0.35} />
          <Sfx frame={f(b[3] + 0.9)} name="stamp" volume={0.6} />
        </>
      );
    case "count":
      return (
        <>
          {Array.from({ length: 10 }, (_, k) => (
            <Sfx key={k} frame={f(b[0] + 0.2 + k * ((b[1] - b[0] - 0.35) / 10))} name="tick" volume={0.3} />
          ))}
          <Sfx frame={f(b[1])} name="stamp" volume={0.55} />
          <Sfx frame={f(b[1] + 0.1)} name="chime" volume={0.3} />
        </>
      );
    default:
      return null;
  }
};
