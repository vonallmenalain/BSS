import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, random, useCurrentFrame } from "remotion";
import { useLook } from "../../looks";
import { Sfx, beats, voiceFrame } from "../../lib/sfx";
import type { TimelineScene } from "../../lib/timing";
import type { Scene as SceneData } from "../../schema";
import { Robed, Scroll, Stamp, clamp, usePop, useT } from "./kitA";

/*
 * Josia und das gefundene Buch (2 Könige 22–23). Ein König mit acht Jahren, eine Baustelle im
 * Tempel, Staub im Sonnenstrahl – und mitten im Schutt eine Schriftrolle: das Buch des
 * Gesetzes. Der Schreiber liest vor, der König zerreisst sein Gewand, das ganze Volk hört zu,
 * Klein und Gross, und tritt dem Bund bei. Alle Takte sind Phrasen der Stimme (`cues`).
 */

type TempleT = Extract<SceneData, { type: "templefind" }>;

const GOLD = "#F5C451";
const RIM = "#FFD58A";
/** Oberkante der Stufen – darauf stehen die Gestalten (über den Untertiteln) */
const STEP = 1160;

const Steps: React.FC = () => (
  <g>
    {[0, 1, 2].map((k) => (
      <g key={k}>
        <rect x={60 - k * 40} y={STEP + k * 46} width={960 + k * 80} height={46} fill={k === 0 ? "#6A4E32" : k === 1 ? "#58402A" : "#463222"} />
        <rect x={60 - k * 40} y={STEP + k * 46} width={960 + k * 80} height={5} fill="#C9A273" opacity={0.35} />
      </g>
    ))}
  </g>
);

/** Krone – Mitte bei (x, y), `s` gross. */
const Crown: React.FC<{ x: number; y: number; s: number; o?: number }> = ({ x, y, s, o = 1 }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} opacity={o}>
    <path d="M -100 40 L -112 -60 L -56 -6 L 0 -90 L 56 -6 L 112 -60 L 100 40 Z" fill="url(#tfGold)" stroke="#FFF0B8" strokeWidth={5} />
    <rect x={-104} y={36} width={208} height={30} rx={8} fill="#B98422" />
    {[-60, 0, 60].map((cx, i) => (
      <circle key={i} cx={cx} cy={51} r={9} fill={i === 1 ? "#C0283A" : "#3A7ACF"} />
    ))}
    {[-112, 0, 112].map((cx, i) => (
      <circle key={i} cx={cx} cy={i === 1 ? -90 : -60} r={11} fill="#FFF0B8" />
    ))}
  </g>
);

const Defs: React.FC = () => (
  <defs>
    <linearGradient id="tfGold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stopColor="#FFF0B8" />
      <stop offset="45%" stopColor={GOLD} />
      <stop offset="100%" stopColor="#A8741C" />
    </linearGradient>
    <radialGradient id="tfGlow">
      <stop offset="0%" stopColor="#FFF4C8" stopOpacity="0.9" />
      <stop offset="40%" stopColor={GOLD} stopOpacity="0.35" />
      <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
    </radialGradient>
  </defs>
);

/** Strahlen um einen Punkt. */
const Rays: React.FC<{ x: number; y: number; k: number; r0?: number; r1?: number; n?: number }> = ({ x, y, k, r0 = 90, r1 = 520, n = 16 }) => {
  const frame = useCurrentFrame();
  if (k <= 0.002) return null;
  return (
    <g opacity={k}>
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2 + frame / 100;
        return (
          <path
            key={i}
            d={`M ${x + Math.cos(a - 0.06) * r0} ${y + Math.sin(a - 0.06) * r0} L ${x + Math.cos(a) * r1} ${y + Math.sin(a) * r1} L ${x + Math.cos(a + 0.06) * r0} ${y + Math.sin(a + 0.06) * r0} Z`}
            fill="#FFE6A8"
            opacity={0.12}
          />
        );
      })}
    </g>
  );
};

/** Zeilen wie Schrift auf der Rolle (relativ zur Mitte der Rolle). */
const Lines: React.FC<{ w: number; h: number; n?: number; color?: string; reveal?: number }> = ({ w, h, n = 7, color = "#5A3A16", reveal = 1 }) => (
  <g>
    {Array.from({ length: n }, (_, r) => {
      const y = -h / 2 + h * 0.18 + (r * h * 0.66) / (n - 1);
      const len = (w * 0.7 - ((r * 37) % 5) * w * 0.04) * Math.max(0, Math.min(1, reveal * n - r));
      return <rect key={r} x={w * 0.35 - len} y={y} width={len} height={h * 0.035} rx={3} fill={color} opacity={0.75} />;
    })}
  </g>
);

/** Staubwolke, die aufsteigt; `k` 0 … 1 über ihr Leben. */
const DustPuff: React.FC<{ x: number; y: number; k: number; s?: number }> = ({ x, y, k, s = 1 }) => {
  if (k <= 0 || k >= 1) return null;
  return (
    <g opacity={Math.sin(k * Math.PI) * 0.7}>
      {Array.from({ length: 7 }, (_, i) => {
        const a = (i / 7) * Math.PI - Math.PI;
        const d = 40 + k * 120 * s;
        return <circle key={i} cx={x + Math.cos(a) * d} cy={y + Math.sin(a) * d * 0.6 - k * 60} r={(30 + k * 50) * s} fill="#C9AE8A" opacity={0.5} />;
      })}
    </g>
  );
};

/** Das Volk: Köpfe und Schultern von hinten, in Reihen – Gross und Klein. */
type Person = { x: number; y: number; s: number; child: boolean; enter: number; side: number };
const usePeople = (): Person[] =>
  useMemo(() => {
    const out: Person[] = [];
    const rows = [
      { y: 1050, n: 10, s: 0.62 },
      { y: 1140, n: 9, s: 0.78 },
      { y: 1250, n: 8, s: 0.95 },
    ];
    rows.forEach((row, r) => {
      for (let i = 0; i < row.n; i++) {
        const child = random(`tpc${r}-${i}`) > 0.68;
        const x = 70 + (i + (r % 2) * 0.5) * (940 / row.n) + (random(`tpx${r}-${i}`) - 0.5) * 30;
        out.push({ x, y: row.y + (child ? 26 * row.s : 0), s: row.s * (child ? 0.68 : 1), child, enter: random(`tpe${r}-${i}`), side: x < 540 ? -1 : 1 });
      }
    });
    return out;
  }, []);

const Bust: React.FC<{ p: Person; arms: number; glow: number; dx: number; o: number }> = ({ p, arms, glow, dx, o }) => {
  const fill = "#1A100A";
  return (
    <g transform={`translate(${p.x + dx} ${p.y}) scale(${p.s})`} opacity={o}>
      {glow > 0 ? <circle cx={0} cy={-80} r={90} fill="#FFD58A" opacity={0.25 * glow} /> : null}
      {arms > 0
        ? [-1, 1].map((sd) => (
            <path key={sd} d={`M ${sd * 42} -40 L ${sd * (48 + 16 * arms)} ${-40 - 110 * arms} L ${sd * (44 + 10 * arms)} ${-40 - 170 * arms}`} stroke={fill} strokeWidth={22} strokeLinecap="round" fill="none" />
          ))
        : null}
      <path d="M -66 60 C -66 0, -40 -30, 0 -30 C 40 -30, 66 0, 66 60 Z" fill={fill} />
      <circle cx={0} cy={-62} r={34} fill={fill} />
      <path d="M -36 -66 C -38 -104, 38 -104, 36 -66 L 40 -30 L -40 -30 Z" fill={fill} />
      <path d="M -66 58 C -66 0, -40 -30, 0 -30" stroke={RIM} strokeWidth={3} fill="none" opacity={0.35} />
    </g>
  );
};

/* ------------------------------------------------------------------ */
/* Etappen                                                             */
/* ------------------------------------------------------------------ */

const Eight: React.FC<{ ts: TimelineScene; s: TempleT }> = ({ ts, s }) => {
  const look = useLook();
  const frame = useCurrentFrame();
  const t = useT(ts);
  const [acht, koenig] = beats(ts, s.cues, 2);
  const num = usePop(ts, acht - 0.1, { damping: 11, stiffness: 160 });
  const drop = interpolate(t, [koenig - 0.25, koenig + 0.35], [0, 1], { ...clamp, easing: Easing.bounce });
  const land = t >= koenig + 0.1;
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <Defs />
        <circle cx={540} cy={760} r={420} fill="url(#tfGlow)" opacity={0.35 + 0.35 * num} />
        <Rays x={540} y={760} k={land ? interpolate(t, [koenig + 0.1, koenig + 0.6], [0, 1], clamp) : 0} />
        <g transform={`translate(540 ${760}) scale(${interpolate(num, [0, 1], [0.4, 1])})`} opacity={Math.min(1, num * 1.5)}>
          <text x={0} y={190} textAnchor="middle" fontFamily={look.label} fontWeight={700} fontSize={560} fill="url(#tfGold)" stroke="#5A3A0E" strokeWidth={6} style={{ filter: "drop-shadow(0 20px 40px rgba(0,0,0,0.6))" }}>
            8
          </text>
        </g>
        <Crown x={540} y={interpolate(drop, [0, 1], [-200, 470])} s={1.05} o={t >= koenig - 0.3 ? 1 : 0} />
        <text x={540} y={1150} textAnchor="middle" fontFamily={look.label} fontWeight={700} fontSize={54} letterSpacing={10} fill={look.text} opacity={interpolate(t, [acht + 0.2, acht + 0.6], [0, 1], clamp)}>
          JAHRE ALT
        </text>
        {land ? <circle cx={540} cy={540} r={40 + (frame % 30)} fill="none" stroke="#FFF0B8" strokeWidth={3} opacity={0.2} /> : null}
      </svg>
      <Sfx frame={voiceFrame(ts, acht)} name="drum" volume={0.5} />
      <Sfx frame={voiceFrame(ts, koenig + 0.1)} name="chime" volume={0.55} />
    </AbsoluteFill>
  );
};

const King: React.FC<{ ts: TimelineScene; s: TempleT }> = ({ ts, s }) => {
  const look = useLook();
  const t = useT(ts);
  const [titel, recht] = beats(ts, s.cues, 2);
  const banner = usePop(ts, titel - 0.1);
  const path = interpolate(t, [recht - 0.1, recht + 1.2], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <Defs />
        {/* Thron */}
        <circle cx={540} cy={880} r={330} fill="url(#tfGlow)" opacity={0.3 + 0.4 * path} />
        <path d="M 400 1160 L 400 760 Q 400 660 540 640 Q 680 660 680 760 L 680 1160 Z" fill="url(#tfGold)" opacity={0.9} />
        <path d="M 428 1160 L 428 772 Q 428 690 540 672 Q 652 690 652 772 L 652 1160 Z" fill="#6E2A44" />
        <rect x={380} y={980} width={320} height={34} rx={10} fill="#B98422" />
        <Steps />
        {/* Der junge König vor dem Thron */}
        <Robed x={540} y={STEP} k={0.86} rim={GOLD} fill="#1A0E10" pose={{ crown: 1, hold: 0.3 * path }} />
        {/* Ein gerader Weg: weder nach rechts noch nach links (2 Könige 22:2) */}
        <g opacity={path}>
          <path d={`M 510 ${STEP - 20} L 510 ${STEP - 20 - 520 * path} L 470 ${STEP - 20 - 520 * path} L 540 ${STEP - 100 - 520 * path} L 610 ${STEP - 20 - 520 * path} L 570 ${STEP - 20 - 520 * path} L 570 ${STEP - 20} Z`} fill={GOLD} opacity={0.22} />
        </g>
      </svg>
      <div
        style={{
          position: "absolute",
          top: 300,
          left: 80,
          right: 80,
          textAlign: "center",
          opacity: Math.min(1, banner * 1.4),
          transform: `scale(${interpolate(banner, [0, 1], [0.8, 1])})`,
        }}
      >
        <div style={{ fontFamily: look.label, fontWeight: 700, fontSize: 120, letterSpacing: "0.12em", color: GOLD, textShadow: look.glow }}>JOSIA</div>
        <div style={{ fontFamily: look.label, fontWeight: 700, fontSize: 40, letterSpacing: "0.3em", color: look.text }}>KÖNIG VON JUDA</div>
      </div>
      <Sfx frame={voiceFrame(ts, titel)} name="chime" volume={0.4} />
      <Sfx frame={voiceFrame(ts, recht)} name="whoosh" volume={0.3} />
    </AbsoluteFill>
  );
};

const Repair: React.FC<{ ts: TimelineScene; s: TempleT }> = ({ ts, s }) => {
  const look = useLook();
  const frame = useCurrentFrame();
  const t = useT(ts);
  const [aus, staub, findet] = beats(ts, s.cues, 3);
  const tag = usePop(ts, aus - 0.2);
  const glow = interpolate(t, [findet + 0.3, findet + 1.2], [0, 1], clamp);
  const hammer = (p: number) => Math.max(0, Math.sin(frame / 4 + p)) * 0.9;
  const puffs = [0, 0.5, 1.0, 1.6].map((d) => interpolate(t, [staub + d - 0.2, staub + d + 1.2], [0, 1], clamp));
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <Defs />
        {/* Gerüst rechts */}
        <g stroke="#4A2E14" strokeWidth={14} strokeLinecap="round">
          {[700, 860, 1010].map((x) => (
            <line key={x} x1={x} y1={560} x2={x} y2={STEP} />
          ))}
          {[640, 860].map((y) => (
            <line key={y} x1={680} y1={y} x2={1040} y2={y} strokeWidth={22} stroke="#7A5630" />
          ))}
          <line x1={700} y1={STEP} x2={860} y2={860} strokeWidth={8} />
          <line x1={860} y1={STEP} x2={1010} y2={860} strokeWidth={8} />
        </g>
        {/* Handwerker auf dem Gerüst */}
        <Robed x={790} y={860 - 11} k={0.55} rim={RIM} pose={{ reach: hammer(0), hood: true }} />
        <Robed x={940} y={640 - 11} k={0.5} dir={-1} rim={RIM} rimSide={-1} pose={{ raise: hammer(1.7) * 0.6 }} />
        {/* Steinträger links */}
        <g transform={`translate(${interpolate(frame, [0, ts.durationInFrames], [120, 330], clamp)} 0)`}>
          <Robed x={0} y={STEP} k={0.75} rim={RIM} pose={{ raise: 0.85, step: frame / 4 }} />
          <rect x={-60} y={STEP - 370} width={120} height={70} rx={6} fill="#9A7A52" stroke="#4A3826" strokeWidth={4} />
        </g>
        {/* Schutt in der Mitte – darin leuchtet etwas */}
        <circle cx={560} cy={STEP - 40} r={260} fill="url(#tfGlow)" opacity={glow} />
        <Rays x={560} y={STEP - 40} k={glow} r0={70} r1={420} />
        {Array.from({ length: 14 }, (_, i) => (
          <rect
            key={i}
            x={400 + random(`trx${i}`) * 300}
            y={STEP - 30 - random(`try${i}`) * 90}
            width={50 + random(`trw${i}`) * 60}
            height={30 + random(`trh${i}`) * 30}
            rx={6}
            fill={i % 3 ? "#7A5A3A" : "#5A422A"}
            stroke="#2A1C10"
            strokeWidth={3}
            transform={`rotate(${(random(`trr${i}`) - 0.5) * 40} ${430 + random(`trx${i}`) * 300} ${STEP - 30})`}
          />
        ))}
        {/* Hilkija beugt sich über den Fund */}
        <Robed x={420} y={STEP} k={0.8} rim={glow > 0 ? GOLD : RIM} pose={{ reach: glow * 0.9, bow: 0.4 + glow * 0.5 }} o={interpolate(t, [findet - 0.4, findet], [0, 1], clamp)} />
        <Steps />
        {puffs.map((k, i) => (
          <DustPuff key={i} x={[620, 860, 480, 760][i]} y={[STEP - 30, 860, STEP - 60, 640][i]} k={k} s={i % 2 ? 0.7 : 1} />
        ))}
        <g opacity={Math.min(1, tag * 1.4)} transform={`translate(540 360) scale(${interpolate(tag, [0, 1], [0.7, 1])})`}>
          <rect x={-230} y={-56} width={460} height={112} rx={20} fill="rgba(20,12,6,0.85)" stroke={GOLD} strokeWidth={4} />
          <text x={0} y={22} textAnchor="middle" fontFamily={look.label} fontWeight={700} fontSize={62} letterSpacing={6} fill={GOLD}>
            JAHR 18
          </text>
        </g>
      </svg>
      <Sfx frame={voiceFrame(ts, staub)} name="clash" volume={0.35} />
      <Sfx frame={voiceFrame(ts, findet + 0.4)} name="chime" volume={0.5} />
    </AbsoluteFill>
  );
};

const Find: React.FC<{ ts: TimelineScene; s: TempleT }> = ({ ts, s }) => {
  const look = useLook();
  const frame = useCurrentFrame();
  const t = useT(ts);
  const [buch, gesetz, lange] = beats(ts, s.cues, 3);
  const lift = interpolate(t, [buch - 0.5, buch + 0.6], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const open = interpolate(t, [gesetz - 0.2, gesetz + 0.6], [0.06, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const title = usePop(ts, gesetz + 0.1);
  const stamp = usePop(ts, lange + 0.2, { damping: 10, stiffness: 220 });
  const dusty = interpolate(t, [lange - 0.1, lange + 0.8], [0, 1], clamp);
  const y = interpolate(lift, [0, 1], [1100, 700]);
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <Defs />
        <circle cx={540} cy={y} r={430} fill="url(#tfGlow)" opacity={0.55 * lift * (1 - dusty * 0.5)} />
        <Rays x={540} y={y} k={lift * (1 - dusty * 0.6)} r0={140} r1={620} />
        <Scroll x={540} y={y + Math.sin(frame / 20) * 6} w={760} h={420} open={open} id="tfScroll" tone="old">
          <Lines w={760} h={420} n={8} reveal={interpolate(open, [0.3, 1], [0, 1], clamp)} />
        </Scroll>
        {/* Staub, der von der Rolle fällt */}
        {Array.from({ length: 30 }, (_, i) => {
          const p = ((frame / 40 + random(`tfd${i}`)) % 1);
          return <circle key={i} cx={200 + random(`tfx${i}`) * 680} cy={y + 200 + p * 260} r={2 + random(`tfr${i}`) * 3} fill="#D9C2A0" opacity={(1 - p) * 0.6 * lift} />;
        })}
        {/* Grauer Schleier: lange nicht beachtet */}
        <rect x={150} y={y - 230} width={780} height={460} fill="#6E6458" opacity={0.35 * dusty} />
        <Stamp x={540} y={y + 10} text="VERGESSEN" color="#C9C0B4" pop={stamp} rot={-10} size={92} font={look.label} />
      </svg>
      <div
        style={{
          position: "absolute",
          top: 330,
          left: 60,
          right: 60,
          textAlign: "center",
          fontFamily: look.label,
          fontWeight: 700,
          fontSize: 56,
          letterSpacing: "0.05em",
          color: GOLD,
          textShadow: look.glow,
          opacity: Math.min(1, title * 1.4),
          transform: `translateY(${(1 - title) * 30}px)`,
        }}
      >
        DAS BUCH DES GESETZES
      </div>
      <Sfx frame={voiceFrame(ts, buch)} name="chime" volume={0.5} />
      <Sfx frame={voiceFrame(ts, gesetz)} name="swipe" volume={0.35} />
      <Sfx frame={voiceFrame(ts, lange + 0.2)} name="stamp" volume={0.45} />
    </AbsoluteFill>
  );
};

const Read: React.FC<{ ts: TimelineScene; s: TempleT }> = ({ ts, s }) => {
  const frame = useCurrentFrame();
  const t = useT(ts);
  const [liest, reisst, nicht] = beats(ts, s.cues, 3);
  const flow = interpolate(t, [liest - 0.2, reisst], [0, 1], clamp);
  const tear = interpolate(t, [reisst - 0.05, reisst + 0.35], [0, 1], clamp);
  const bow = interpolate(t, [nicht - 0.2, nicht + 0.8], [0, 1], clamp);
  const shake = tear > 0 && tear < 1 ? Math.sin(frame * 2.5) * 6 : 0;
  const KX = 760;
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <Defs />
        <rect width={1080} height={1920} fill="#0E0804" opacity={0.35 * bow} />
        {/* Schafan mit der Rolle */}
        <Robed x={300} y={STEP} k={0.95} rim={RIM} pose={{ reach: 0.85 }} />
        <Scroll x={440} y={STEP - 205} w={150} h={110} open={1} id="tfSmall" tone="old">
          <Lines w={150} h={110} n={5} />
        </Scroll>
        {/* Wörter fliegen zum König */}
        {Array.from({ length: 10 }, (_, i) => {
          const p = (flow * 3 + i / 10) % 1;
          if (flow <= 0 || flow >= 1) return null;
          const x = 470 + p * (KX - 520);
          const y = STEP - 220 - Math.sin(p * Math.PI) * 120 - (i % 3) * 18;
          return <rect key={i} x={x} y={y} width={26 + (i % 3) * 10} height={7} rx={3} fill={GOLD} opacity={Math.sin(p * Math.PI)} />;
        })}
        {/* Der König – er zerreisst sein Gewand */}
        <g transform={`translate(${shake} 0)`}>
          <Robed x={KX} y={STEP} k={1.02} dir={-1} rim={RIM} rimSide={-1} fill="#1A0E10" pose={{ crown: 1, bow: 0.15 + bow * 0.85, hold: tear * 0.6 }} />
          {tear > 0 ? (
            <path
              d={`M ${KX - 6} ${STEP - 245} l 14 30 l -18 26 l 16 30 l -14 28 l 18 34 l -16 30`}
              stroke="#E2483D"
              strokeWidth={5}
              fill="none"
              strokeDasharray={300}
              strokeDashoffset={300 * (1 - tear)}
              opacity={0.9}
            />
          ) : null}
        </g>
        <Steps />
      </svg>
      <Sfx frame={voiceFrame(ts, liest)} name="swipe" volume={0.3} />
      <Sfx frame={voiceFrame(ts, reisst)} name="clash" volume={0.5} />
    </AbsoluteFill>
  );
};

const People: React.FC<{ ts: TimelineScene; s: TempleT }> = ({ ts, s }) => {
  const frame = useCurrentFrame();
  const t = useT(ts);
  const [ruft, klein, wort] = beats(ts, s.cues, 3);
  const people = usePeople();
  const gather = interpolate(t, [ruft - 0.3, ruft + 1.6], [0, 1], clamp);
  const kids = interpolate(t, [klein - 0.1, klein + 0.4], [0, 1], clamp) * (1 - interpolate(t, [wort, wort + 0.6], [0, 0.6], clamp));
  const flow = interpolate(t, [wort - 0.1, wort + 0.4], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <Defs />
        {/* Oben auf den Stufen der König mit dem Buch */}
        <circle cx={540} cy={640} r={260} fill="url(#tfGlow)" opacity={0.45} />
        {[0, 1, 2].map((k) => (
          <rect key={k} x={300 - k * 60} y={820 + k * 40} width={480 + k * 120} height={40} fill={k === 0 ? "#7A5A3A" : "#6A4E32"} />
        ))}
        <Robed x={540} y={820} k={0.62} rim={RIM} fill="#1A0E10" pose={{ crown: 1, hold: 0.9 }} />
        <Scroll x={540} y={700} w={130} h={80} open={1} id="tfPeople" tone="old">
          <Lines w={130} h={80} n={4} />
        </Scroll>
        {/* Worte über das Volk */}
        {flow > 0
          ? Array.from({ length: 24 }, (_, i) => {
              const p = ((frame / 55 + i / 24) % 1) * flow;
              const ang = -Math.PI / 2 + ((i % 12) / 11 - 0.5) * 2.4;
              const d = 80 + p * 520;
              return <rect key={i} x={540 + Math.cos(ang) * d * 1.2} y={720 - Math.sin(ang) * d * 0.25 + p * 300} width={22 + (i % 3) * 8} height={6} rx={3} fill={GOLD} opacity={Math.sin(p * Math.PI) * 0.9} />;
            })
          : null}
        {/* Das Volk */}
        {people.map((p, i) => {
          const k = Math.max(0, Math.min(1, gather * 1.5 - p.enter * 0.5));
          const dx = (1 - Easing.out(Easing.cubic)(k)) * p.side * 700;
          return <Bust key={i} p={p} arms={0} glow={p.child ? kids : 0} dx={dx} o={k} />;
        })}
      </svg>
      <Sfx frame={voiceFrame(ts, ruft)} name="drum" volume={0.4} />
      <Sfx frame={voiceFrame(ts, wort)} name="chime" volume={0.35} />
    </AbsoluteFill>
  );
};

const Covenant: React.FC<{ ts: TimelineScene; s: TempleT }> = ({ ts, s }) => {
  const look = useLook();
  const frame = useCurrentFrame();
  const t = useT(ts);
  const [bund, volk] = beats(ts, s.cues, 2);
  const people = usePeople();
  const ring = interpolate(t, [bund - 0.1, bund + 0.8], [0, 1], clamp);
  const hands = interpolate(t, [volk - 0.2, volk + 0.9], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const label = usePop(ts, bund + 0.2);
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <Defs />
        {/* Die Säule, an der der König steht (2 Könige 23:3) */}
        <circle cx={540} cy={640} r={320} fill="url(#tfGlow)" opacity={0.3 + 0.5 * ring} />
        <rect x={600} y={420} width={110} height={440} fill="#9A7A52" />
        <rect x={588} y={404} width={134} height={30} rx={6} fill="#B9956A" />
        <rect x={588} y={850} width={134} height={26} rx={6} fill="#7A5A3A" />
        {[0, 1, 2].map((k) => (
          <rect key={k} x={300 - k * 60} y={870 + k * 40} width={480 + k * 120} height={40} fill={k === 0 ? "#7A5A3A" : "#6A4E32"} />
        ))}
        <Robed x={520} y={870} k={0.64} rim={RIM} fill="#1A0E10" pose={{ crown: 1, raise: ring * 0.9 }} />
        {/* Der Bund als goldener Ring */}
        <g opacity={ring}>
          <ellipse cx={540} cy={640} rx={250 * ring} ry={70 * ring} fill="none" stroke={GOLD} strokeWidth={10} />
          <ellipse cx={540} cy={640} rx={250 * ring + 16} ry={70 * ring + 6} fill="none" stroke="#FFF0B8" strokeWidth={3} opacity={0.5 + 0.5 * Math.sin(frame / 6)} />
        </g>
        {people.map((p, i) => (
          <Bust key={i} p={p} arms={Math.max(0, Math.min(1, hands * 1.6 - p.enter * 0.6))} glow={hands * 0.6} dx={0} o={1} />
        ))}
      </svg>
      <div
        style={{
          position: "absolute",
          top: 300,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: look.label,
          fontWeight: 700,
          fontSize: 76,
          letterSpacing: "0.2em",
          color: GOLD,
          textShadow: look.glow,
          opacity: Math.min(1, label * 1.4),
          transform: `scale(${interpolate(label, [0, 1], [1.3, 1])})`,
        }}
      >
        DER BUND
      </div>
      <Sfx frame={voiceFrame(ts, bund)} name="chime" volume={0.5} />
      <Sfx frame={voiceFrame(ts, volk)} name="levelup" volume={0.4} />
    </AbsoluteFill>
  );
};

export const Scene: React.FC<{ ts: TimelineScene }> = ({ ts }) => {
  const s = ts.scene as TempleT;
  switch (s.stage) {
    case "eight":
      return <Eight ts={ts} s={s} />;
    case "king":
      return <King ts={ts} s={s} />;
    case "repair":
      return <Repair ts={ts} s={s} />;
    case "find":
      return <Find ts={ts} s={s} />;
    case "read":
      return <Read ts={ts} s={s} />;
    case "people":
      return <People ts={ts} s={s} />;
    case "covenant":
      return <Covenant ts={ts} s={s} />;
  }
};

/** Alles wird untertitelt – die Bilder tragen nur Titel, keine gesprochenen Sätze. */
export const hidden = (_ts: TimelineScene): Set<number> => new Set();
