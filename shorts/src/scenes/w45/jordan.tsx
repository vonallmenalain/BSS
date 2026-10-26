import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, random, useCurrentFrame } from "remotion";
import { useLook } from "../../looks";
import { Sfx, beat, beats, voiceFrame } from "../../lib/sfx";
import { FPS, type TimelineScene } from "../../lib/timing";
import { type Scene as SceneData, normalize } from "../../schema";

/*
 * Kartentisch: Josua übernimmt (Josua 1, 3). Erst ein Stillleben – Moses Stab, sein Mantel, eine
 * Kerze –, dann die Lage auf Pergament: das Lager Israels im Osten, der Jordan über die Ufer
 * getreten, dahinter Jericho. Dreimal knallt der Befehl «Sei mutig und stark» als Stempel auf die
 * Karte, eine Rolle – das Buch der Weisung – kommt dazu, und am Ende staut sich der Fluss: Die
 * Priester mit der Lade stehen im trockenen Flussbett, und das Volk zieht hinüber.
 *
 * Bewusst nicht im Bild: was der Herr Josua über das Buch sagt (wann er darüber nachdenken soll) –
 * die Rolle trägt nur ihren Titel und unlesbare Zeilen.
 */

type JordanSceneT = Extract<SceneData, { type: "jordan" }>;
type P = [number, number];

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = Easing.inOut(Easing.sin);
const pop = (t: number, at: number, d = 0.22) => interpolate(t, [at, at + d], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.8)) });
const fade = (t: number, at: number, d = 0.35) => interpolate(t, [at, at + d], [0, 1], clamp);

/* Pergament auf dem Tisch */
const MX = 70;
const MY = 270;
const MW = 940;
const MH = 900;
const INK = "#3B2A1A";
const HAND = "Caveat";
const WATER = "#5E8FA6";
const WATER_DEEP = "#3E6E86";
const SAND = "#D8C08C";

/* Geografie (Koordinaten im Pergament) */
const CAMP: P = [790, 560];
const JOSUA: P = [742, 470];
const JERICHO: P = [196, 520];
const CROSS_Y = 560;
const DRY_TOP = 420;
const DRY_BOTTOM = 812;

/** Mitte des Flusses auf der Höhe y. */
const riverX = (y: number) => 478 + 44 * Math.sin(y / 150 + 0.6) + 16 * Math.sin(y / 53);

/** Ufer des Flusses als Fläche zwischen y0 und y1, `w` breit. */
const riverBand = (y0: number, y1: number, w: (y: number) => number) => {
  const n = 40;
  const left: string[] = [];
  const right: string[] = [];
  for (let i = 0; i <= n; i++) {
    const y = y0 + ((y1 - y0) * i) / n;
    left.push(`${(riverX(y) - w(y) / 2).toFixed(1)} ${y.toFixed(1)}`);
    right.unshift(`${(riverX(y) + w(y) / 2).toFixed(1)} ${y.toFixed(1)}`);
  }
  return `M ${left.join(" L ")} L ${right.join(" L ")} Z`;
};
const riverLine = (y0: number, y1: number, dx = 0) => {
  const pts: string[] = [];
  for (let i = 0; i <= 40; i++) {
    const y = y0 + ((y1 - y0) * i) / 40;
    pts.push(`${(riverX(y) + dx).toFixed(1)} ${y.toFixed(1)}`);
  }
  return `M ${pts.join(" L ")}`;
};

/** Raue Pergamentkante */
const parchmentPath = () => {
  const pts: string[] = [];
  const j = (k: string) => (random(`jo${k}`) - 0.5) * 16;
  const n = 26;
  for (let i = 0; i <= n; i++) pts.push(`${(i / n) * MW + j(`t${i}`)} ${8 + j(`ty${i}`)}`);
  for (let i = 0; i <= n; i++) pts.push(`${MW - 8 + j(`rx${i}`)} ${(i / n) * MH + j(`r${i}`)}`);
  for (let i = n; i >= 0; i--) pts.push(`${(i / n) * MW + j(`b${i}`)} ${MH - 8 + j(`by${i}`)}`);
  for (let i = n; i >= 0; i--) pts.push(`${8 + j(`lx${i}`)} ${(i / n) * MH + j(`l${i}`)}`);
  return `M ${pts.join(" L ")} Z`;
};

/** Die n-te Stelle (ab 0), an der eine Phrase gesprochen wird – «Sei mutig und stark» kommt zweimal. */
const nthBeat = (ts: TimelineScene, phrase: string, n: number, fallback: number) => {
  const target = normalize(phrase).split(" ").filter(Boolean);
  let count = 0;
  for (let i = 0; i + target.length <= ts.words.length; i++) {
    if (target.every((w, j) => ts.words[i + j].key === w)) {
      if (count === n) return ts.words[i].start;
      count++;
    }
  }
  return fallback;
};

/* ------------------------------------------------------------------ */
/* Bausteine                                                           */
/* ------------------------------------------------------------------ */

const Stamp: React.FC<{ text: string; x: number; y: number; at: number; t: number; color: string; rotate?: number; size?: number }> = ({ text, x, y, at, t, color, rotate = -8, size = 64 }) => {
  const k = interpolate(t, [at, at + 0.18], [0, 1], { ...clamp, easing: Easing.out(Easing.back(2)) });
  if (k <= 0) return null;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${interpolate(k, [0, 1], [1.8, 1])})`} opacity={Math.min(1, k * 1.5) * 0.93}>
      <rect x={-text.length * size * 0.29 - 26} y={-size * 0.78} width={text.length * size * 0.58 + 52} height={size * 1.32} rx={10} fill="rgba(242,226,190,0.55)" stroke={color} strokeWidth={7} />
      <text textAnchor="middle" y={size * 0.3} fontFamily="Anton" fontSize={size} fill={color} letterSpacing={3}>
        {text}
      </text>
    </g>
  );
};

const Label: React.FC<{ x: number; y: number; text: string; o: number; size?: number; color?: string; anchor?: "middle" | "start" | "end"; rotate?: number }> = ({ x, y, text, o, size = 40, color = INK, anchor = "middle", rotate = 0 }) =>
  o > 0.01 ? (
    <text x={x} y={y} textAnchor={anchor} fontFamily={HAND} fontWeight={700} fontSize={size} fill={color} opacity={o} stroke="#F0DFB8" strokeWidth={7} paintOrder="stroke" transform={rotate ? `rotate(${rotate} ${x} ${y})` : undefined}>
      {text}
    </text>
  ) : null;

const Tent: React.FC<{ x: number; y: number; s: number; o: number }> = ({ x, y, s, o }) =>
  o > 0.01 ? (
    <g transform={`translate(${x} ${y + (1 - o) * 14}) scale(${s})`} opacity={Math.min(1, o)}>
      <path d="M -20 12 L 0 -16 L 20 12 Z" fill="#C9A86B" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
      <path d="M 0 -16 L -4 12 L 4 12 Z" fill={INK} opacity={0.7} />
    </g>
  ) : null;

/** Jericho: eine Stadt mit doppelter Mauer und Türmen */
const Jericho: React.FC<{ k: number; frame: number }> = ({ k, frame }) => {
  if (k <= 0.01) return null;
  const [x, y] = JERICHO;
  return (
    <g transform={`translate(${x} ${y}) scale(${interpolate(k, [0, 1], [1.5, 1])})`} opacity={Math.min(1, k * 1.4)}>
      <ellipse cx={0} cy={8} rx={104} ry={70} fill="#C9AF7E" stroke={INK} strokeWidth={4} />
      <ellipse cx={0} cy={8} rx={88} ry={57} fill="none" stroke={INK} strokeWidth={2.5} strokeDasharray="10 7" />
      {[
        [-60, -10],
        [-18, -30],
        [30, -22],
        [62, 2],
        [-40, 26],
        [8, 22],
        [46, 34],
      ].map(([hx, hy], i) => (
        <g key={i}>
          <rect x={hx - 13} y={hy - 12} width={26} height={22} fill="#E8D3A4" stroke={INK} strokeWidth={2.5} />
          <rect x={hx - 3} y={hy - 2} width={6} height={12} fill={INK} />
        </g>
      ))}
      {[-100, -50, 0, 50, 100].map((tx, i) => {
        const ty = 8 + Math.sqrt(Math.max(0, 1 - (tx / 104) ** 2)) * (i % 2 ? 70 : -70);
        return (
          <g key={i} transform={`translate(${tx * 0.96} ${ty})`}>
            <rect x={-11} y={-20} width={22} height={28} fill="#BFA06A" stroke={INK} strokeWidth={3} />
            {[-11, -2, 7].map((cx) => (
              <rect key={cx} x={cx} y={-27} width={5} height={8} fill={INK} />
            ))}
          </g>
        );
      })}
      {/* Palmen – die Palmenstadt */}
      {[
        [-128, -40],
        [124, -34],
      ].map(([px, py], i) => (
        <g key={i} transform={`translate(${px} ${py})`}>
          <path d="M 0 30 Q 4 10 0 -10" stroke="#6B5030" strokeWidth={4} fill="none" />
          {[0, 1, 2, 3, 4].map((l) => (
            <path key={l} d={`M 0 -10 q ${-22 + l * 11} ${-12 + Math.abs(l - 2) * 4} ${-30 + l * 15} ${4 + Math.abs(l - 2) * 6}`} stroke="#4E6B36" strokeWidth={4} fill="none" strokeLinecap="round" transform={`rotate(${Math.sin(frame / 20 + i) * 3})`} />
          ))}
        </g>
      ))}
    </g>
  );
};

/** Die Bundeslade, getragen von vier Priestern (Draufsicht-Skizze) */
const Ark: React.FC<{ x: number; y: number; glow: number; frame: number }> = ({ x, y, glow, frame }) => (
  <g transform={`translate(${x} ${y})`}>
    {glow > 0 ? <circle r={70} fill="#FFE7A0" opacity={0.25 * glow + 0.06 * glow * Math.sin(frame / 6)} /> : null}
    <line x1={-46} y1={-12} x2={46} y2={-12} stroke="#7A5A22" strokeWidth={5} strokeLinecap="round" />
    <line x1={-46} y1={12} x2={46} y2={12} stroke="#7A5A22" strokeWidth={5} strokeLinecap="round" />
    <rect x={-22} y={-16} width={44} height={32} rx={4} fill="#E7B949" stroke="#8A6116" strokeWidth={3} />
    <path d="M -14 -16 L -8 -26 L 0 -18 L 8 -26 L 14 -16" fill="none" stroke="#8A6116" strokeWidth={2.5} />
    {[
      [-40, -24],
      [40, -24],
      [-40, 24],
      [40, 24],
    ].map(([px, py], i) => (
      <g key={i}>
        <ellipse cx={px} cy={py + (py > 0 ? 6 : -6)} rx={11} ry={8} fill="#F4F0E6" stroke={INK} strokeWidth={2.5} />
        <circle cx={px} cy={py} r={6.5} fill="#C9A06A" stroke={INK} strokeWidth={2} />
      </g>
    ))}
  </g>
);

/** Moses Stab – oben gebogen wie ein Hirtenstab */
const Staff: React.FC<{ glint: number }> = ({ glint }) => (
  <g>
    <path d="M 300 860 L 640 330 C 662 296, 712 300, 716 340 C 718 368, 694 380, 680 362" stroke="#2A1C10" strokeWidth={30} fill="none" strokeLinecap="round" opacity={0.35} transform="translate(12 16)" />
    <path d="M 300 860 L 640 330 C 662 296, 712 300, 716 340 C 718 368, 694 380, 680 362" stroke="#6E4A26" strokeWidth={24} fill="none" strokeLinecap="round" />
    <path d="M 300 860 L 640 330 C 662 296, 712 300, 716 340" stroke="#A87A46" strokeWidth={7} fill="none" strokeLinecap="round" opacity={0.7} transform="translate(-6 -2)" />
    {[0.18, 0.34, 0.5, 0.66].map((k, i) => (
      <path key={i} d={`M ${300 + 340 * k - 10} ${860 - 530 * k + 6} l 20 6`} stroke="#3E2A16" strokeWidth={3} opacity={0.6} />
    ))}
    {glint > 0 ? <circle cx={300 + 340 * glint} cy={860 - 530 * glint} r={18} fill="#FFF3C8" opacity={0.6 * Math.sin(Math.PI * Math.min(1, glint))} /> : null}
  </g>
);

const Candle: React.FC<{ x: number; y: number; frame: number; out: number }> = ({ x, y, frame, out }) => {
  const fl = 1 + 0.08 * Math.sin(frame / 2.3) + 0.05 * Math.sin(frame / 5.1);
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle cx={0} cy={-120} r={150} fill="url(#joCandle)" opacity={(0.75 + 0.15 * Math.sin(frame / 3)) * (1 - 0.6 * out)} />
      <ellipse cx={0} cy={6} rx={56} ry={14} fill="#6B4A2A" stroke={INK} strokeWidth={3} />
      <rect x={-24} y={-108} width={48} height={112} rx={6} fill="#F2E6C8" stroke={INK} strokeWidth={3} />
      <path d="M -24 -100 q 12 16 22 2 q 10 22 26 0" fill="#E7D6AE" stroke={INK} strokeWidth={2} />
      <line x1={0} y1={-108} x2={0} y2={-124} stroke={INK} strokeWidth={3} />
      <g transform={`translate(0 -124) scale(${fl * (1 - out)})`}>
        <path d="M 0 -52 C 16 -30, 16 -8, 0 0 C -16 -8, -16 -30, 0 -52 Z" fill="#FFB347" />
        <path d="M 0 -32 C 8 -20, 8 -6, 0 0 C -8 -6, -8 -20, 0 -32 Z" fill="#FFF1B8" />
      </g>
    </g>
  );
};

/** Gedankenblase von Josua zur Rolle */
const Thought: React.FC<{ from: P; to: P; k: number }> = ({ from, to, k }) =>
  k > 0.01 ? (
    <g opacity={Math.min(1, k * 1.5)}>
      {[0.2, 0.4, 0.6].map((f, i) => (
        <circle key={i} cx={from[0] + (to[0] - from[0]) * f} cy={from[1] + (to[1] - from[1]) * f} r={7 + i * 4} fill="#FFF8E8" stroke={INK} strokeWidth={3} opacity={interpolate(k, [i * 0.2, i * 0.2 + 0.3], [0, 1], clamp)} />
      ))}
    </g>
  ) : null;

/** Die Rolle «Buch der Weisung»: Titel und unlesbare Zeilen. `open` 0 … 1 */
const Scroll: React.FC<{ x: number; y: number; open: number; glow: number; frame: number }> = ({ x, y, open, glow, frame }) => {
  const w = 40 + 300 * open;
  return (
    <g transform={`translate(${x} ${y})`}>
      {glow > 0 ? <ellipse cx={0} cy={0} rx={w / 2 + 90} ry={150} fill="url(#joGlow)" opacity={glow * (0.85 + 0.15 * Math.sin(frame / 7))} /> : null}
      <rect x={-w / 2 + 8} y={-92} width={w - 16} height={184} fill="rgba(0,0,0,0.35)" transform="translate(10 14)" />
      <rect x={-w / 2} y={-92} width={w} height={184} fill="#F6E7C2" stroke={INK} strokeWidth={3} />
      {open > 0.4 ? (
        <g opacity={interpolate(open, [0.4, 0.9], [0, 1], clamp)}>
          <text x={0} y={-44} textAnchor="middle" fontFamily={HAND} fontWeight={700} fontSize={44} fill="#6B2E18">
            Buch der Weisung
          </text>
          {Array.from({ length: 5 }, (_, i) => (
            <path key={i} d={`M ${-w / 2 + 34} ${-6 + i * 22} q 20 -6 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t ${Math.max(0, w - 300) * 0.4} 0`} stroke={INK} strokeWidth={2.5} fill="none" opacity={0.45} />
          ))}
        </g>
      ) : null}
      {[-w / 2, w / 2].map((rx, i) => (
        <g key={i}>
          <rect x={rx - 13} y={-110} width={26} height={220} rx={12} fill="#8A5E30" stroke={INK} strokeWidth={3} />
          <circle cx={rx} cy={-114} r={11} fill="#5A3A1C" />
          <circle cx={rx} cy={114} r={11} fill="#5A3A1C" />
        </g>
      ))}
    </g>
  );
};

/* ------------------------------------------------------------------ */
/* Die Karte                                                           */
/* ------------------------------------------------------------------ */

type MapState = {
  /** Lager, Josua-Fähnchen */
  camp: number;
  /** Fluss gezeichnet (0 … 1) und Hochwasser (0 … 1) */
  river: number;
  flood: number;
  /** Jericho */
  jericho: number;
  /** Der Fluss staut sich und das Bett wird trocken (0 … 1) */
  dry: number;
};

const People: React.FC<{ t: number; from: number; to: number; frame: number }> = ({ t, from, to, frame }) => {
  const dots = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => ({
        lag: random(`pl${i}`) * 0.5,
        dy: (random(`py${i}`) - 0.5) * 120,
        ph: random(`pp${i}`) * 6.28,
      })),
    [],
  );
  const path: P[] = [
    [CAMP[0] - 20, CAMP[1]],
    [riverX(CROSS_Y) + 90, CROSS_Y],
    [riverX(CROSS_Y) - 90, CROSS_Y],
    [JERICHO[0] + 150, JERICHO[1] + 30],
  ];
  const along = (k: number): P => {
    const seg = Math.min(2, Math.floor(k * 3));
    const f = Math.max(0, Math.min(1, k * 3 - seg));
    const a = path[seg];
    const b = path[seg + 1];
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  };
  return (
    <g>
      {dots.map((d, i) => {
        const k = interpolate(t, [from + d.lag, to + d.lag], [0, 1], { ...clamp, easing: ease });
        if (k <= 0) return null;
        const [x, y] = along(k);
        const narrow = k > 0.3 && k < 0.7 ? 0.45 : 1;
        return <circle key={i} cx={x + Math.sin(frame / 4 + d.ph) * 2} cy={y + d.dy * narrow * 0.5} r={6.5} fill="#2B5BA8" stroke="#173563" strokeWidth={1.6} />;
      })}
    </g>
  );
};

const TheMap: React.FC<{ st: MapState; t: number; frame: number; dim: number; children?: React.ReactNode }> = ({ st, t, frame, dim, children }) => {
  const tents = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => ({
        x: CAMP[0] - 70 + (i % 4) * 46 + (random(`tx${i}`) - 0.5) * 14,
        y: CAMP[1] - 40 + Math.floor(i / 4) * 40 + (random(`ty${i}`) - 0.5) * 10,
        s: 0.85 + random(`ts${i}`) * 0.3,
      })),
    [],
  );
  const reeds = useMemo(() => Array.from({ length: 30 }, (_, i) => ({ y: 30 + i * 28 + random(`ry${i}`) * 10, side: i % 2 ? 1 : -1, s: 0.7 + random(`rs${i}`) * 0.5 })), []);
  const normalW = (y: number) => 26 + 6 * Math.sin(y / 40);
  const floodW = (y: number) => normalW(y) + st.flood * (96 + 18 * Math.sin(y / 70));
  const heap = st.dry;
  return (
    <g opacity={1 - 0.6 * dim}>
      {/* Gebirge Moab, im Osten der Nebo */}
      {[
        [860, 150, 1],
        [790, 190, 0.8],
        [900, 250, 0.7],
      ].map(([x, y, s], i) => (
        <path key={i} d={`M ${x - 60 * s} ${y + 40 * s} L ${x} ${y - 40 * s} L ${x + 60 * s} ${y + 40 * s}`} fill="none" stroke={INK} strokeWidth={3} opacity={0.5 * st.camp} />
      ))}
      <Label x={860} y={318} text="Nebo" o={0.6 * st.camp} size={32} />
      {/* Fluss */}
      <g opacity={st.river}>
        <path d={riverBand(0, MH, floodW)} fill={WATER} opacity={0.35 + 0.15 * st.flood} />
        {/* Trockenes Bett, wo das Wasser stehen bleibt */}
        {heap > 0 ? <path d={riverBand(DRY_TOP, DRY_BOTTOM, floodW)} fill={SAND} opacity={heap} /> : null}
        {heap > 0
          ? Array.from({ length: 14 }, (_, i) => {
              const y = DRY_TOP + 20 + i * 27;
              return <ellipse key={i} cx={riverX(y) + (random(`st${i}`) - 0.5) * 80} cy={y} rx={9} ry={6} fill="#B79E6A" stroke={INK} strokeWidth={1.5} opacity={heap} />;
            })
          : null}
        {/* Hauptlauf: oben bleibt Wasser, unten versiegt es */}
        <path d={riverBand(0, DRY_TOP + 2, normalW)} fill={WATER_DEEP} />
        <path d={riverBand(DRY_TOP, MH, normalW)} fill={WATER_DEEP} opacity={1 - heap} />
        <path d={riverLine(0, MH, -4)} stroke="#B9D7E3" strokeWidth={3} fill="none" strokeDasharray="14 30" strokeDashoffset={-frame * 2 * (1 - heap)} opacity={0.7 * (1 - heap * 0.8)} />
        {/* Hochwasser-Wellen */}
        {st.flood > 0
          ? Array.from({ length: 12 }, (_, i) => {
              const y = 40 + i * 72;
              const side = i % 2 ? 1 : -1;
              const o = st.flood * (y > DRY_TOP && y < DRY_BOTTOM ? 1 - heap : 1);
              return <path key={i} d={`M ${riverX(y) + side * (floodW(y) / 2 - 22)} ${y} q 10 -8 20 0 t 20 0`} stroke="#E3F0F5" strokeWidth={3} fill="none" opacity={0.75 * o} />;
            })
          : null}
        {/* Schilf am Ufer */}
        {reeds.map((r, i) => (
          <path key={i} d={`M ${riverX(r.y) + r.side * (floodW(r.y) / 2 + 6)} ${r.y} l ${r.side * 4} -16 m -${r.side * 4} 16 l ${r.side * -3} -12`} stroke="#5F7444" strokeWidth={2.5} opacity={0.75} />
        ))}
        {/* Das Wasser staut sich weit oben, bei Adam (Josua 3:16) */}
        {heap > 0 ? (
          <g opacity={heap}>
            <ellipse cx={riverX(150)} cy={150} rx={floodW(150) / 2 + 60 * heap} ry={70 + 40 * heap} fill={WATER} opacity={0.55} />
            <ellipse cx={riverX(150)} cy={150} rx={floodW(150) / 2 + 20 * heap} ry={40 + 30 * heap} fill={WATER_DEEP} />
            {[0, 1, 2].map((i) => (
              <path key={i} d={`M ${riverX(150) - 60 + i * 40} ${120 + i * 18} q 14 -14 28 0`} stroke="#E3F0F5" strokeWidth={3} fill="none" opacity={0.8} />
            ))}
          </g>
        ) : null}
        <Label x={riverX(90) + 110} y={92} text="Adam" o={heap * 0.85} size={34} anchor="start" />
        <Label x={riverX(230) - 70} y={250} text="Das Wasser staut sich" o={heap} size={38} anchor="end" rotate={-4} />
        {/* Salzmeer */}
        <ellipse cx={500} cy={MH + 10} rx={190} ry={70} fill={WATER} opacity={0.75} />
        <Label x={500} y={MH - 18} text="Salzmeer" o={0.8} size={32} />
        <Label x={riverX(360) + 64} y={360} text="Jordan" o={st.river * 0.9 * (1 - heap)} size={40} anchor="start" rotate={78} />
        <Label x={riverX(700) - 140} y={716} text="Hochwasser!" o={st.flood * (1 - heap)} size={38} color="#2C5D78" rotate={-6} />
      </g>
      {/* Lager Israels */}
      {tents.map((tn, i) => (
        <Tent key={i} x={tn.x} y={tn.y} s={tn.s} o={interpolate(st.camp, [i / 20, i / 20 + 0.25], [0, 1], clamp)} />
      ))}
      <Label x={CAMP[0] + 6} y={CAMP[1] + 116} text="Lager Israel" o={st.camp} />
      {/* Josua */}
      {st.camp > 0.2 ? (
        <g transform={`translate(${JOSUA[0]} ${JOSUA[1]}) scale(${interpolate(st.camp, [0.2, 0.6], [0, 1], { ...clamp, easing: Easing.out(Easing.back(2)) })})`}>
          <line x1={0} y1={0} x2={0} y2={-70} stroke={INK} strokeWidth={4} />
          <path d={`M 0 -70 L ${46 + Math.sin(frame / 6) * 3} -60 L 0 -48 Z`} fill="#2B5BA8" stroke={INK} strokeWidth={2.5} />
          <circle cx={0} cy={0} r={7} fill={INK} />
          <text x={-12} y={-80} textAnchor="end" fontFamily={HAND} fontWeight={700} fontSize={42} fill="#2B5BA8" stroke="#F0DFB8" strokeWidth={7} paintOrder="stroke">
            Josua
          </text>
        </g>
      ) : null}
      <Jericho k={st.jericho} frame={frame} />
      <Label x={JERICHO[0]} y={JERICHO[1] + 120} text="Jericho" o={Math.min(1, st.jericho * 1.3)} size={46} />
      {/* Kompass */}
      <g transform="translate(110 140)" opacity={0.85}>
        <circle r={40} fill="none" stroke={INK} strokeWidth={2.5} />
        <path d="M 0 -50 L 10 0 L 0 50 L -10 0 Z" fill={INK} opacity={0.85} />
        <text y={-58} textAnchor="middle" fontFamily={HAND} fontWeight={700} fontSize={30} fill={INK}>
          N
        </text>
      </g>
      {children}
    </g>
  );
};

/* ------------------------------------------------------------------ */
/* Szene                                                               */
/* ------------------------------------------------------------------ */

const PILL: Record<JordanSceneT["stage"], string> = {
  mourning: "ANFÜHRER: ?",
  map: "ZIEL: JERICHO",
  courage: "BEFEHL",
  book: "AUSRÜSTUNG: 1 BUCH",
  crossing: "JORDAN: HOCHWASSER",
};

export const Scene: React.FC<{ ts: TimelineScene }> = ({ ts }) => {
  const s = ts.scene as JordanSceneT;
  const frame = useCurrentFrame();
  const look = useLook();
  const t = (frame - ts.audioOffsetFrames) / FPS;
  const b = beats(ts, s.cues, Math.max(4, s.cues.length));
  const edge = useMemo(parchmentPath, []);
  const f = (sec: number) => voiceFrame(ts, sec);
  const stage = s.stage;

  /* Zustand der Karte je Etappe */
  const st: MapState = { camp: 1, river: 1, flood: 1, jericho: 1, dry: 0 };
  let floodAt = 99;
  if (stage === "map") {
    floodAt = beat(ts, "über die Ufer", b[1] + 0.9);
    st.camp = interpolate(t, [b[0] - 0.1, b[0] + 1.4], [0, 1], clamp);
    st.river = interpolate(t, [b[1] - 0.15, b[1] + 0.6], [0, 1], clamp);
    st.flood = interpolate(t, [floodAt - 0.1, floodAt + 0.9], [0, 1], { ...clamp, easing: ease });
    st.jericho = pop(t, b[2] - 0.05, 0.3);
  }
  // Promise-Modus: Die Rolle liegt schon, der Weg nach Jericho leuchtet auf
  const promise = stage === "book" && s.cues.length < 2;
  const stopAt = stage === "crossing" ? b[1] : 99;
  if (stage === "crossing") st.dry = interpolate(t, [stopAt - 0.1, stopAt + 1.1], [0, 1], { ...clamp, easing: ease });

  /* Kamera: am Fluss nah heran */
  const camK = stage === "crossing" ? interpolate(frame, [0, 34], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) }) : 0;
  const zoom = 1 + 0.3 * camK;
  const focus: P = [MW / 2 + (490 - MW / 2) * camK, MH / 2 + (CROSS_Y - 60 - MH / 2) * camK];
  const cam = `translate(${MW / 2} ${MH / 2}) scale(${zoom}) translate(${-focus[0]} ${-focus[1]})`;
  const unroll = stage === "mourning" ? interpolate(frame, [0, 22], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) }) : 1;

  /* Befehle: drei Stempel */
  const c1 = beat(ts, "Sei mutig und stark", b[0]);
  const c2 = beat(ts, "Sei nur mutig und sehr stark", b[1]);
  const c3 = nthBeat(ts, "Sei mutig und stark", 1, b[2] - 1.2);
  const angst = beat(ts, "hab keine Angst", b[2]);
  const mitDir = beat(ts, "ich bin mit dir", b[3]);
  const orders = stage === "courage" ? [c1, c2, c3].filter((c) => t >= c).length : 0;

  /* Buch */
  const scrollAt = promise ? -1 : b[0];
  const drop = stage === "book" ? (promise ? 1 : interpolate(t, [scrollAt - 0.25, scrollAt + 0.25], [0, 1], { ...clamp, easing: Easing.out(Easing.bounce) })) : 0;
  const unrolled = stage === "book" ? (promise ? 1 : interpolate(t, [b[1] - 0.15, b[1] + 0.5], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) })) : 0;
  const thinkAt = beat(ts, "nachdenken", b[1] + 1.4);
  const think = stage === "book" && !promise ? interpolate(t, [thinkAt - 0.3, thinkAt + 0.6], [0, 1], clamp) : 0;
  const act = stage === "book" && !promise ? interpolate(t, [b[2] - 0.1, b[2] + 0.9], [0, 1], { ...clamp, easing: ease }) : 0;
  const route = promise ? interpolate(t, [b[0] - 0.6, b[0] + 0.5], [0, 1], { ...clamp, easing: ease }) : 0;
  const SCROLL: P = [600, 240];

  /* Durchzug */
  const priestK = stage === "crossing" ? interpolate(t, [b[0] - 0.6, b[0] + 0.5], [0, 1], { ...clamp, easing: ease }) : 0;
  const priestMid = stage === "crossing" ? interpolate(t, [stopAt + 0.4, stopAt + 1.3], [0, 1], { ...clamp, easing: ease }) : 0;
  const rx = riverX(CROSS_Y);
  const arkX = rx + 150 - 110 * priestK - 40 * priestMid;
  const splash = stage === "crossing" ? interpolate(t, [b[0] + 0.3, b[0] + 0.6, b[0] + 1.2], [0, 1, 0], clamp) : 0;

  /* HUD */
  const pill = (() => {
    if (stage === "courage") return orders > 0 ? `BEFEHL ${orders}/3` : "BEFEHL";
    if (stage === "crossing") return st.dry > 0.5 ? "JORDAN: TROCKEN ✓" : PILL.crossing;
    if (stage === "book" && promise) return "STATUS: BEREIT ✓";
    if (stage === "mourning") return t >= b[1] ? "ANFÜHRER: ?" : "ANFÜHRER: MOSE";
    return PILL[stage];
  })();
  const pillOn = stage === "map" ? fade(t, b[2]) : stage === "book" && !promise ? fade(t, b[0]) : 1;

  const mourn = stage === "mourning";
  const qAt = b[1];
  const write = mourn ? interpolate(t, [b[0] - 0.2, b[0] + 0.8], [0, 1], clamp) : 0;

  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <clipPath id="joClip">
            <path d={edge} />
          </clipPath>
          <clipPath id="joUnroll">
            <rect x={(MW * (1 - unroll)) / 2} y={-20} width={MW * unroll} height={MH + 40} />
          </clipPath>
          <radialGradient id="joParch" cx="0.45" cy="0.4" r="0.85">
            <stop offset="0%" stopColor="#F2E2BE" />
            <stop offset="70%" stopColor="#E0C793" />
            <stop offset="100%" stopColor="#B99A62" />
          </radialGradient>
          <radialGradient id="joCandle">
            <stop offset="0%" stopColor="#FFE2A0" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#FFB347" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="joGlow">
            <stop offset="0%" stopColor="#FFF3C4" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#FFE7A0" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="joEdge" cx="0.5" cy="0.5" r="0.75">
            <stop offset="70%" stopColor="#5A3A16" stopOpacity="0" />
            <stop offset="100%" stopColor="#5A3A16" stopOpacity="0.45" />
          </radialGradient>
        </defs>
        <g transform={`translate(${MX} ${MY})`} clipPath="url(#joUnroll)">
          <path d={edge} fill="rgba(0,0,0,0.45)" transform="translate(10 14)" />
          <g clipPath="url(#joClip)">
            <rect width={MW} height={MH} fill="url(#joParch)" />
            {mourn ? (
              <g>
                {/* Stillleben: Stab, Mantel, Kerze */}
                <path d="M 120 900 C 140 760, 300 720, 420 760 C 520 790, 600 780, 700 820 C 800 860, 860 880, 900 900 Z" fill="#7A3E2A" opacity={0.85} />
                <path d="M 160 900 C 200 800, 330 780, 430 800" stroke="#B7653F" strokeWidth={6} fill="none" opacity={0.6} />
                <Staff glint={interpolate(t, [qAt - 0.3, qAt + 0.5], [0, 1], clamp)} />
                <Candle x={210} y={690} frame={frame} out={interpolate(t, [qAt + 0.2, qAt + 0.9], [0, 0.35], clamp)} />
                <g opacity={interpolate(write, [0, 0.4], [0, 1], clamp)}>
                  <text x={620} y={170} textAnchor="middle" fontFamily={HAND} fontWeight={700} fontSize={110} fill={INK}>
                    Mose
                  </text>
                  <text x={620} y={236} textAnchor="middle" fontFamily={HAND} fontWeight={700} fontSize={46} fill={INK} opacity={interpolate(write, [0.4, 1], [0, 0.8], clamp)}>
                    120 Jahre · Diener des Herrn
                  </text>
                  <path d="M 470 196 Q 620 186 770 198" stroke={INK} strokeWidth={4} fill="none" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - write} />
                </g>
                <Stamp text="UND JETZT?" x={560} y={560} at={qAt} t={t} color="#B5302A" rotate={-7} size={86} />
              </g>
            ) : (
              <g transform={cam}>
                <TheMap st={st} t={t} frame={frame} dim={stage === "courage" ? interpolate(frame, [0, 14], [0, 1], clamp) : 0}>
                  {/* Buch: Rolle, Gedanke, Weg */}
                  {stage === "book" ? (
                    <g>
                      {promise ? (
                        <g>
                          <path
                            d={`M ${CAMP[0] - 30} ${CAMP[1] - 10} C ${rx + 120} ${CROSS_Y - 60}, ${rx - 120} ${CROSS_Y - 60}, ${JERICHO[0] + 120} ${JERICHO[1] - 10}`}
                            stroke="#2B5BA8"
                            strokeWidth={7}
                            strokeLinecap="round"
                            fill="none"
                            pathLength={1}
                            strokeDasharray={`${route} 1`}
                            opacity={0.85}
                          />
                          {route > 0.98 ? <Stamp text="✓" x={JERICHO[0] + 20} y={JERICHO[1] - 135} at={b[0] + 0.45} t={t} color="#2E7D32" rotate={0} size={100} /> : null}
                          <Label x={JERICHO[0] + 40} y={JERICHO[1] - 250} text="es wird gelingen" o={fade(t, b[0] + 0.5)} size={46} color="#2E7D32" rotate={-5} />
                        </g>
                      ) : null}
                      <Thought from={[JOSUA[0] - 30, JOSUA[1] - 132]} to={[SCROLL[0] + 150, SCROLL[1] + 60]} k={think} />
                      {act > 0 ? (
                        <g>
                          <path d={`M ${SCROLL[0]} ${SCROLL[1] + 110} C ${SCROLL[0] + 40} ${SCROLL[1] + 220}, ${CAMP[0] - 80} ${CAMP[1] - 120}, ${CAMP[0] - 60} ${CAMP[1] - 50}`} stroke="#B5302A" strokeWidth={6} fill="none" strokeLinecap="round" pathLength={1} strokeDasharray={`${act} 1`} />
                          <path d={`M ${CAMP[0] - 60} ${CAMP[1] - 50} C ${CAMP[0] - 140} ${CAMP[1] - 10}, ${rx + 100} ${CROSS_Y}, ${rx + 60} ${CROSS_Y}`} stroke="#B5302A" strokeWidth={6} fill="none" strokeLinecap="round" strokeDasharray="6 14" opacity={interpolate(act, [0.6, 1], [0, 0.9], clamp)} />
                          <Label x={CAMP[0] - 170} y={CAMP[1] - 150} text="handeln" o={interpolate(act, [0.4, 1], [0, 1], clamp)} size={46} color="#B5302A" rotate={-8} />
                        </g>
                      ) : null}
                      <g transform={`translate(0 ${(1 - drop) * -560})`} opacity={stage === "book" ? Math.min(1, drop * 3) : 0}>
                        <Scroll x={SCROLL[0]} y={SCROLL[1]} open={unrolled} glow={promise ? 0.6 : interpolate(t, [b[1], b[1] + 0.6], [0, 0.8], clamp)} frame={frame} />
                      </g>
                    </g>
                  ) : null}
                  {/* Durchzug: Priester mit der Lade, dann das Volk */}
                  {stage === "crossing" ? (
                    <g>
                      <People t={t} from={b[2] - 0.5} to={b[2] + 1.7} frame={frame} />
                      {splash > 0
                        ? [0, 1, 2].map((i) => (
                            <circle key={i} cx={arkX} cy={CROSS_Y} r={30 + i * 26 + 30 * splash} fill="none" stroke="#E3F0F5" strokeWidth={4} opacity={splash * (1 - i * 0.25)} />
                          ))
                        : null}
                      <Ark x={arkX} y={CROSS_Y} glow={st.dry} frame={frame} />
                      <Label x={arkX + 10} y={CROSS_Y + 76} text="Priester mit der Lade" o={fade(t, b[0] - 0.4)} size={30} />
                      <Label x={rx + 70} y={CROSS_Y + 190} text="trocken hindurch" o={fade(t, b[2] + 0.4)} size={42} color="#2B5BA8" rotate={-4} anchor="start" />
                    </g>
                  ) : null}
                </TheMap>
              </g>
            )}
            <rect width={MW} height={MH} fill="url(#joEdge)" />
          </g>
          {/* Befehle als Stempel über der ganzen Karte */}
          {stage === "courage" ? (
            <g>
              <Stamp text="SEI MUTIG UND STARK" x={MW / 2} y={250} at={c1} t={t} color="#B5302A" rotate={-6} size={66} />
              <Stamp text="MUTIG UND SEHR STARK" x={MW / 2 + 10} y={455} at={c2} t={t} color="#B5302A" rotate={4} size={62} />
              <Stamp text="SEI MUTIG UND STARK" x={MW / 2 - 6} y={660} at={c3} t={t} color="#B5302A" rotate={-3} size={66} />
              <Label x={MW / 2 + 260} y={760} text="– keine Angst!" o={fade(t, angst)} size={48} color="#6B2E18" rotate={-4} />
              {t >= mitDir - 0.1 ? (
                <g opacity={fade(t, mitDir - 0.1, 0.5)}>
                  <ellipse cx={JOSUA[0]} cy={JOSUA[1] - 30} rx={150} ry={120} fill="url(#joGlow)" opacity={0.9 + 0.1 * Math.sin(frame / 5)} />
                  <text x={MW / 2} y={850} textAnchor="middle" fontFamily={HAND} fontWeight={700} fontSize={64} fill="#8A5A16" stroke="#F0DFB8" strokeWidth={8} paintOrder="stroke">
                    «Ich bin mit dir.»
                  </text>
                </g>
              ) : null}
            </g>
          ) : null}
        </g>
      </svg>

      {/* HUD oben auf der Karte */}
      <div
        style={{
          position: "absolute",
          left: MX + 26,
          right: 1080 - MX - MW + 26,
          top: MY - 34,
          height: 74,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 28px",
          borderRadius: 14,
          background: "rgba(20,14,8,0.88)",
          border: `2px solid ${look.accent}`,
          opacity: unroll,
        }}
      >
        <span style={{ fontFamily: "Anton", fontSize: 38, letterSpacing: "0.08em", color: look.text }}>MISSION: JORDAN</span>
        <span style={{ fontFamily: "Anton", fontSize: 32, letterSpacing: "0.08em", color: "#14100A", background: stage === "crossing" && st.dry > 0.5 ? "#8FD18B" : look.accent, padding: "4px 18px", borderRadius: 8, opacity: pillOn }}>
          {pill}
        </span>
      </div>
      <div style={{ position: "absolute", left: MX + 30, top: MY + MH - 56, fontFamily: HAND, fontWeight: 700, fontSize: 30, color: "rgba(59,42,26,0.6)", opacity: mourn ? 0 : 1 }}>
        Skizze – nicht massstabsgetreu
      </div>

      {/* Geräusche */}
      {stage === "mourning" ? (
        <>
          <Sfx frame={1} name="whoosh" volume={0.35} />
          <Sfx frame={f(b[0] + 0.1)} name="tick" volume={0.3} />
          <Sfx frame={f(qAt)} name="stamp" volume={0.6} />
          <Sfx frame={f(qAt + 0.12)} name="question" volume={0.35} />
        </>
      ) : null}
      {stage === "map" ? (
        <>
          {[0, 0.25, 0.5, 0.75].map((d) => (
            <Sfx key={d} frame={f(b[0] + d)} name="pop" volume={0.2} />
          ))}
          <Sfx frame={f(b[1])} name="whoosh" volume={0.35} />
          <Sfx frame={f(floodAt)} name="whoosh" volume={0.3} />
          <Sfx frame={f(b[2])} name="drum" volume={0.6} />
        </>
      ) : null}
      {stage === "courage" ? (
        <>
          {[c1, c2, c3].map((c, i) => (
            <Sfx key={i} frame={f(c)} name="stamp" volume={0.6} />
          ))}
          <Sfx frame={f(mitDir)} name="chime" volume={0.45} />
        </>
      ) : null}
      {stage === "book" && !promise ? (
        <>
          <Sfx frame={f(scrollAt - 0.2)} name="whoosh" volume={0.3} />
          <Sfx frame={f(scrollAt + 0.1)} name="drum" volume={0.5} />
          <Sfx frame={f(b[1])} name="swipe" volume={0.4} />
          <Sfx frame={f(thinkAt)} name="blip" volume={0.3} />
          <Sfx frame={f(b[2])} name="pop" volume={0.35} />
        </>
      ) : null}
      {promise ? (
        <>
          <Sfx frame={f(b[0] - 0.5)} name="swipe" volume={0.3} />
          <Sfx frame={f(b[0] + 0.45)} name="levelup" volume={0.4} />
        </>
      ) : null}
      {stage === "crossing" ? (
        <>
          <Sfx frame={f(b[0] + 0.3)} name="whoosh" volume={0.35} />
          <Sfx frame={f(stopAt)} name="unlock" volume={0.4} />
          <Sfx frame={f(stopAt + 0.3)} name="chime" volume={0.35} />
          <Sfx frame={f(b[2])} name="drum" volume={0.45} />
        </>
      ) : null}
    </AbsoluteFill>
  );
};

/** Alles Gesprochene steht unten in den Untertiteln – auf der Karte stehen nur Stichworte. */
export const hidden = (_ts: TimelineScene): Set<number> => new Set();
