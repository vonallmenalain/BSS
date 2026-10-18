import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, random, spring, useCurrentFrame } from "remotion";
import { TRACK_TOP } from "../components/Backgrounds";
import { useLook } from "../looks";
import { Sword } from "../motifs/Figures";
import { Sfx, beats, voiceFrame } from "../lib/sfx";
import { FPS, type TimelineScene, findCue } from "../lib/timing";
import type { Scene } from "../schema";
import { theme } from "../theme";

/*
 * Stadion: Glaube als Staffelstab. Die Eltern halten ihren Bund, die Mütter geben einen Satz
 * mit, die Söhne nehmen den Stab und schliessen ihren eigenen Bund – und dann bist du dran.
 * Der Stab ist ein leuchtendes Licht.
 */

type RelaySceneT = Extract<Scene, { type: "relay" }>;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const GROUND = TRACK_TOP + 12;
/** Figuren gross genug, dass sie die Bühne füllen */
const K = 1.55;
const rad = (d: number) => (d * Math.PI) / 180;

/** Das Licht – der Staffelstab */
const Orb: React.FC<{ x: number; y: number; r?: number; pulse: number }> = ({ x, y, r = 22, pulse }) => (
  <g>
    <circle cx={x} cy={y} r={r * 4.2} fill="url(#orbHalo)" opacity={0.75 + 0.25 * pulse} />
    <circle cx={x} cy={y} r={r} fill="url(#orbCore)" />
  </g>
);

const OrbDefs: React.FC = () => (
  <defs>
    <radialGradient id="orbHalo">
      <stop offset="0%" stopColor="#FFE7A8" stopOpacity="0.9" />
      <stop offset="35%" stopColor="#FFB347" stopOpacity="0.35" />
      <stop offset="100%" stopColor="#FFB347" stopOpacity="0" />
    </radialGradient>
    <radialGradient id="orbCore">
      <stop offset="0%" stopColor="#FFFFFF" />
      <stop offset="60%" stopColor="#FFF0C2" />
      <stop offset="100%" stopColor="#FFC56B" />
    </radialGradient>
  </defs>
);

/** Lage der vorderen Hand im Koordinatensystem des Läufers (Ursprung am Boden) */
type Pose = { hand: [number, number] };

/**
 * Läufer von der Seite (Blick nach rechts). Ursprung = zwischen den Füssen am Boden.
 * `phase` treibt den Laufzyklus, `speed` 0 … 1 bestimmt, wie weit Arme und Beine ausholen.
 */
const Runner: React.FC<{ x: number; phase: number; speed: number; jersey: string; scale?: number; reach?: number; children?: (p: Pose) => React.ReactNode }> = ({
  x,
  phase,
  speed,
  jersey,
  scale = 1,
  reach = 0,
  children,
}) => {
  const limb = "#1C1530";
  const amp = 0.25 + 0.75 * speed;
  const bob = -12 * Math.abs(Math.cos(phase)) * amp;
  const lean = 9 * speed;
  const hip: [number, number] = [0, -175 + bob];
  const neck: [number, number] = [Math.sin(rad(lean)) * 115, hip[1] - Math.cos(rad(lean)) * 115];
  const leg = (ph: number) => {
    const thigh = 34 * Math.sin(ph) * amp;
    const bend = (18 + 62 * Math.max(0, Math.sin(ph + 1.25))) * amp;
    const knee: [number, number] = [hip[0] + Math.sin(rad(thigh)) * 88, hip[1] + Math.cos(rad(thigh)) * 88];
    const shin = thigh - bend;
    const foot: [number, number] = [knee[0] + Math.sin(rad(shin)) * 86, knee[1] + Math.cos(rad(shin)) * 86];
    return { knee, foot };
  };
  const arm = (ph: number, front: boolean) => {
    const upper = -40 * Math.sin(ph) * amp + (front ? reach * 75 : 0);
    const elbow: [number, number] = [neck[0] + Math.sin(rad(upper)) * 64, neck[1] + 8 + Math.cos(rad(upper)) * 64];
    const fore = upper + (front ? 95 - reach * 85 : 95) * (0.5 + 0.5 * amp);
    const hand: [number, number] = [elbow[0] + Math.sin(rad(fore)) * 58, elbow[1] + Math.cos(rad(fore)) * 58];
    return { elbow, hand };
  };
  const lb = leg(phase + Math.PI);
  const lf = leg(phase);
  const ab = arm(phase, false);
  const af = arm(phase + Math.PI, true);
  const head: [number, number] = [neck[0] + 6, neck[1] - 40];
  const seg = (a: [number, number], b: [number, number], c: [number, number], w: number, col: string) => (
    <path d={`M ${a[0]} ${a[1]} L ${b[0]} ${b[1]} L ${c[0]} ${c[1]}`} stroke={col} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" fill="none" />
  );
  return (
    <g transform={`translate(${x} ${GROUND}) scale(${scale})`}>
      <ellipse cx={0} cy={4} rx={70} ry={10} fill="#000" opacity={0.25} />
      {seg(hip, lb.knee, lb.foot, 24, "#2A2140")}
      {seg(neck, ab.elbow, ab.hand, 20, "#2A2140")}
      <path d={`M ${hip[0]} ${hip[1]} L ${neck[0]} ${neck[1]}`} stroke={jersey} strokeWidth={46} strokeLinecap="round" />
      {seg(hip, lf.knee, lf.foot, 24, limb)}
      <circle cx={head[0]} cy={head[1]} r={30} fill={limb} />
      {seg(neck, af.elbow, af.hand, 20, limb)}
      {children ? children({ hand: af.hand }) : null}
    </g>
  );
};

/** Mutter (links, Blick nach rechts) und Sohn (rechts, Blick nach links) */
const Mother: React.FC<{ x: number; reach: number }> = ({ x, reach }) => (
  <g transform={`translate(${x} ${GROUND}) scale(${K}) translate(${-x} ${-GROUND})`}>
    <MotherShape x={x} reach={reach} />
  </g>
);
const MotherShape: React.FC<{ x: number; reach: number }> = ({ x, reach }) => {
  const c = "#1C1530";
  const handX = x + 70 + reach * 60;
  const handY = GROUND - 205 - reach * 25;
  return (
    <g>
      <path d={`M ${x - 55} ${GROUND} L ${x - 30} ${GROUND - 200} L ${x + 30} ${GROUND - 200} L ${x + 60} ${GROUND} Z`} fill="#7C3A6A" />
      <path d={`M ${x - 32} ${GROUND - 195} L ${x - 24} ${GROUND - 300} L ${x + 26} ${GROUND - 300} L ${x + 32} ${GROUND - 195} Z`} fill="#7C3A6A" />
      <circle cx={x + 4} cy={GROUND - 336} r={30} fill={c} />
      <path d={`M ${x - 30} ${GROUND - 330} Q ${x - 10} ${GROUND - 382} ${x + 30} ${GROUND - 352} L ${x - 40} ${GROUND - 270} Z`} fill="#B8679C" />
      <path d={`M ${x + 20} ${GROUND - 290} Q ${x + 50} ${GROUND - 240} ${handX} ${handY}`} stroke={c} strokeWidth={18} strokeLinecap="round" fill="none" />
    </g>
  );
};
const Boy: React.FC<{ x: number; reach: number; glow: number }> = ({ x, reach, glow }) => (
  <g transform={`translate(${x} ${GROUND}) scale(${K}) translate(${-x} ${-GROUND})`}>
    <BoyShape x={x} reach={reach} glow={glow} />
  </g>
);
const BoyShape: React.FC<{ x: number; reach: number; glow: number }> = ({ x, reach, glow }) => {
  const c = "#1C1530";
  return (
    <g>
      {glow > 0 ? <circle cx={x} cy={GROUND - 190} r={120} fill="url(#orbHalo)" opacity={glow * 0.7} /> : null}
      <path d={`M ${x - 14} ${GROUND - 120} L ${x - 24} ${GROUND} M ${x + 14} ${GROUND - 120} L ${x + 22} ${GROUND}`} stroke={c} strokeWidth={22} strokeLinecap="round" />
      <path d={`M ${x} ${GROUND - 125} L ${x - 4} ${GROUND - 225}`} stroke="#3F7FD0" strokeWidth={46} strokeLinecap="round" />
      <circle cx={x - 6} cy={GROUND - 262} r={26} fill={c} />
      <path d={`M ${x - 4} ${GROUND - 215} Q ${x - 40} ${GROUND - 190} ${x - 70 - reach * 30} ${GROUND - 200 - reach * 15}`} stroke={c} strokeWidth={17} strokeLinecap="round" fill="none" />
    </g>
  );
};

/** Bodenstreifen, die vorbeiziehen – so wirkt Laufen auf der Stelle wie Tempo */
const SpeedLines: React.FC<{ t: number; speed: number }> = ({ t, speed }) => {
  const lines = useMemo(() => Array.from({ length: 10 }, (_, i) => ({ y: GROUND + 8 + random(`sl${i}`) * 50, l: 60 + random(`sll${i}`) * 140, o: random(`slo${i}`) })), []);
  return (
    <g>
      {lines.map((ln, i) => {
        const x = 1180 - (((t * 900 * speed + ln.o * 1400) % 1400) + 0);
        return <rect key={i} x={x} y={ln.y} width={ln.l} height={5} rx={2} fill="#FFFFFF" opacity={0.35 * speed} />;
      })}
    </g>
  );
};

const Chip: React.FC<{ text: string; x: number; y: number; at: number; frame: number; ts: TimelineScene }> = ({ text, x, y, at, frame, ts }) => {
  const look = useLook();
  const sp = spring({ frame: frame - voiceFrame(ts, at), fps: FPS, config: { damping: 12, stiffness: 180 } });
  if (sp <= 0.001) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `translate(-50%, -50%) scale(${interpolate(sp, [0, 1], [0.3, 1])})`,
        opacity: sp,
        padding: "16px 30px",
        borderRadius: 999,
        background: look.accent,
        color: "#1A0F24",
        fontFamily: theme.font.body,
        fontWeight: 800,
        fontSize: 40,
        whiteSpace: "nowrap",
        boxShadow: `0 10px 30px rgba(0,0,0,0.35), 0 0 30px ${look.accent}88`,
      }}
    >
      {text}
    </div>
  );
};

/** Grosse Zeile oben, erscheint, wenn sie gesprochen wird */
const BigLine: React.FC<{ ts: TimelineScene; line?: string; frame: number; y?: number }> = ({ ts, line, frame, y = 360 }) => {
  const look = useLook();
  if (!line) return null;
  const cue = findCue(ts.words, line);
  const at = cue ? ts.words[cue.first].start : 0.2;
  const t = (frame - ts.audioOffsetFrames) / FPS;
  const sp = spring({ frame: frame - voiceFrame(ts, at - 0.05), fps: FPS, config: { damping: 16, stiffness: 140 } });
  const tokens = line.split(/\s+/);
  return (
    <div style={{ position: "absolute", top: y, left: 70, right: 70, textAlign: "center", opacity: sp, transform: `translateY(${interpolate(sp, [0, 1], [40, 0])}px)` }}>
      <div style={{ fontFamily: theme.font.body, fontWeight: 800, fontSize: line.length > 40 ? 70 : 84, lineHeight: 1.15, letterSpacing: "-0.01em" }}>
        {tokens.map((tok, i) => {
          const w = cue ? ts.words[cue.first + i] : null;
          const spoken = !w || t >= w.start;
          const active = w && t >= w.start && t < w.end;
          return (
            <span key={i} style={{ color: active ? look.accent : spoken ? "#FFFFFF" : "rgba(255,255,255,0.3)", textShadow: "0 8px 30px rgba(0,0,0,0.55)" }}>
              {tok}
              {i < tokens.length - 1 ? " " : ""}
            </span>
          );
        })}
      </div>
    </div>
  );
};

export const RelayScene: React.FC<{ ts: TimelineScene }> = ({ ts }) => {
  const s = ts.scene as RelaySceneT;
  const frame = useCurrentFrame();
  const look = useLook();
  const t = (frame - ts.audioOffsetFrames) / FPS;
  const ft = frame / FPS;
  const b = beats(ts, s.cues, Math.max(2, s.cues.length));
  const pulse = 0.5 + 0.5 * Math.sin(frame / 5);

  let art: React.ReactNode = null;
  let overlay: React.ReactNode = null;
  let sounds: React.ReactNode = null;

  if (s.stage === "sword") {
    // Schwert fällt und steckt im Boden, wird durchgestrichen, dann wird daraus ein Licht
    const drop = interpolate(frame, [0, 10], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
    // Die Klinge steckt zu einem Drittel im Boden
    const swordY = interpolate(drop, [0, 1], [-200, GROUND - 300]);
    const wobble = frame > 10 ? Math.sin((frame - 10) * 1.4) * 6 * Math.exp(-(frame - 10) / 8) : 0;
    const cross = interpolate(t, [b[0], b[0] + 0.35], [0, 1], clamp);
    const toLight = interpolate(t, [b[1] - 0.1, b[1] + 0.5], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
    const dust = interpolate(frame, [10, 30], [0, 1], clamp);
    art = (
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <OrbDefs />
        <clipPath id="aboveGround">
          <rect x={0} y={0} width={1080} height={GROUND} />
        </clipPath>
        <g opacity={1 - toLight} transform={`rotate(${wobble} 540 ${GROUND})`} clipPath="url(#aboveGround)">
          <Sword x={540} y={swordY} scale={1.35} />
        </g>
        {dust > 0 && dust < 1
          ? [-1, 1].map((d) => (
              <circle key={d} cx={540 + d * (30 + 90 * dust)} cy={GROUND - 10 - 30 * dust} r={20 + 30 * dust} fill="#D9B79A" opacity={0.5 * (1 - dust)} />
            ))
          : null}
        {cross > 0 ? (
          <g stroke="#FF4D4D" strokeWidth={26} strokeLinecap="round" opacity={1 - toLight}>
            <line x1={330} y1={560} x2={330 + 420 * Math.min(1, cross * 2)} y2={560 + 520 * Math.min(1, cross * 2)} />
            {cross > 0.5 ? <line x1={750} y1={560} x2={750 - 420 * (cross * 2 - 1)} y2={560 + 520 * (cross * 2 - 1)} /> : null}
          </g>
        ) : null}
        {toLight > 0 ? <Orb x={540} y={980} r={20 + 26 * toLight} pulse={pulse} /> : null}
        {toLight > 0.2 ? (
          <g opacity={interpolate(toLight, [0.2, 0.8], [0, 1], clamp)} transform={`translate(540 640) scale(${interpolate(toLight, [0.2, 1], [0.5, 1], clamp)})`}>
            <path d="M -230 -110 Q -230 -190 -150 -190 L 150 -190 Q 230 -190 230 -110 L 230 10 Q 230 90 150 90 L -40 90 L -110 160 L -100 90 L -150 90 Q -230 90 -230 10 Z" fill="#FFF6E0" stroke="#FFB347" strokeWidth={8} style={{ filter: "drop-shadow(0 0 30px rgba(255,179,71,0.7))" }} />
            {[-90, 0, 90].map((dx, i) => (
              <circle key={dx} cx={dx} cy={-50 - 14 * Math.max(0, Math.sin(frame / 4 - i))} r={26} fill="#E8743B" />
            ))}
          </g>
        ) : null}
      </svg>
    );
    sounds = (
      <>
        <Sfx frame={10} name="stamp" volume={0.6} />
        <Sfx frame={11} name="clash" volume={0.25} />
        <Sfx frame={voiceFrame(ts, b[0])} name="whoosh" volume={0.4} />
        <Sfx frame={voiceFrame(ts, b[1])} name="chime" volume={0.35} />
      </>
    );
  } else if (s.stage === "run") {
    const speed = 1;
    art = (
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <OrbDefs />
        <SpeedLines t={ft} speed={speed} />
        <Runner x={500} phase={ft * 9} speed={speed} jersey="#E8743B" scale={K}>
          {({ hand }) => <Orb x={hand[0]} y={hand[1]} pulse={pulse} />}
        </Runner>
      </svg>
    );
    overlay = s.chips.map((c, i) => <Chip key={i} text={c} x={540} y={370 + i * 110} at={b[i]} frame={frame} ts={ts} />);
    sounds = s.chips.map((_, i) => <Sfx key={i} frame={voiceFrame(ts, b[i])} name="pop" volume={0.4} />);
  } else if (s.stage === "mother") {
    const give = interpolate(t, [b[0] - 0.2, b[0] + 1.2], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
    const reach = interpolate(t, [b[0] - 0.8, b[0] - 0.2], [0, 1], clamp);
    const mx = 330;
    const bx = 760;
    const from: [number, number] = [mx + 130 * K, GROUND - 230 * K];
    const to: [number, number] = [bx - 100 * K, GROUND - 215 * K];
    const ox = from[0] + (to[0] - from[0]) * give;
    const oy = from[1] + (to[1] - from[1]) * give - Math.sin(Math.PI * give) * 90;
    art = (
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <OrbDefs />
        <Mother x={mx} reach={reach} />
        <Boy x={bx} reach={give} glow={interpolate(give, [0.8, 1], [0, 1], clamp)} />
        <Orb x={ox} y={oy} r={30} pulse={pulse} />
      </svg>
    );
    overlay = <BigLine ts={ts} line={s.line} frame={frame} />;
    sounds = <Sfx frame={voiceFrame(ts, b[0])} name="chime" volume={0.35} />;
  } else if (s.stage === "handoff") {
    // Läufer A holt auf, übergibt das Licht, Läufer B zieht davon
    const at = b[0];
    const ax = interpolate(t, [-0.4, at, at + 1.4], [110, 420, 300], clamp);
    const bxPos = interpolate(t, [-0.4, at - 0.2, at + 1.6], [660, 660, 820], { ...clamp, easing: Easing.in(Easing.quad) });
    const aSpeed = interpolate(t, [at, at + 1.2], [1, 0.25], clamp);
    const bSpeed = interpolate(t, [-0.4, at - 0.4, at + 0.4], [0.35, 0.6, 1], clamp);
    const pass = interpolate(t, [at - 0.15, at + 0.25], [0, 1], clamp);
    art = (
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <OrbDefs />
        <SpeedLines t={ft} speed={0.6 + 0.4 * bSpeed} />
        <g opacity={interpolate(t, [at + 0.6, at + 1.6], [1, 0.45], clamp)}>
          <Runner x={ax} phase={ft * 9} speed={aSpeed} jersey="#E8743B" scale={K} reach={interpolate(t, [at - 0.6, at], [0, 1], clamp) * (1 - pass * 0.6)}>
            {({ hand }) => (pass < 0.5 ? <Orb x={hand[0]} y={hand[1]} pulse={pulse} /> : null)}
          </Runner>
        </g>
        <Runner x={bxPos} phase={ft * 9 + 1.3} speed={bSpeed} jersey="#3F7FD0" scale={K}>
          {({ hand }) => (pass >= 0.5 ? <Orb x={hand[0]} y={hand[1]} pulse={pulse} /> : null)}
        </Runner>
      </svg>
    );
    overlay = (
      <>
        {s.chips.map((c, i) => (
          <Chip key={i} text={c} x={bxPos} y={420 + i * 110} at={b[i + 1]} frame={frame} ts={ts} />
        ))}
        <div style={{ position: "absolute", left: ax - 120, width: 240, top: GROUND - 640, textAlign: "center", fontFamily: theme.font.body, fontWeight: 800, fontSize: 38, color: look.dim }}>Eltern</div>
        <div style={{ position: "absolute", left: bxPos - 120, width: 240, top: GROUND - 640, textAlign: "center", fontFamily: theme.font.body, fontWeight: 800, fontSize: 38, color: "#FFFFFF" }}>Söhne</div>
      </>
    );
    sounds = (
      <>
        <Sfx frame={voiceFrame(ts, at)} name="whoosh" volume={0.45} />
        <Sfx frame={voiceFrame(ts, at) + 3} name="chime" volume={0.3} />
        {s.chips.map((_, i) => (
          <Sfx key={i} frame={voiceFrame(ts, b[i + 1])} name="pop" volume={0.4} />
        ))}
      </>
    );
  } else if (s.stage === "you") {
    // Der Läufer bleibt stehen, streckt das Licht nach vorn – es wird gross und gehört dir
    const stop = interpolate(t, [-0.4, 0.8], [1, 0], clamp);
    const offer = interpolate(t, [b[0] - 0.3, b[0] + 0.9], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
    const x = interpolate(t, [-0.4, 0.8], [300, 400], clamp);
    art = (
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <OrbDefs />
        <SpeedLines t={ft} speed={stop} />
        <g opacity={1 - offer * 0.6}>
          <Runner x={x} phase={ft * 9 * (0.3 + 0.7 * stop)} speed={0.15 + 0.85 * stop} jersey="#3F7FD0" scale={K} reach={offer}>
            {({ hand }) => (offer < 0.05 ? <Orb x={hand[0]} y={hand[1]} pulse={pulse} /> : null)}
          </Runner>
        </g>
        {offer >= 0.05 ? <Orb x={interpolate(offer, [0, 1], [x + 170, 540])} y={interpolate(offer, [0, 1], [GROUND - 370, 720])} r={interpolate(offer, [0, 1], [34, 150])} pulse={pulse} /> : null}
      </svg>
    );
    overlay = (
      <div style={{ position: "absolute", top: 650, width: "100%", textAlign: "center", fontFamily: look.display, fontSize: 150, lineHeight: 1, color: "#3A2208", opacity: interpolate(offer, [0.7, 1], [0, 1], clamp), transform: `scale(${interpolate(offer, [0.7, 1], [0.6, 1], clamp)})` }}>
        DU
      </div>
    );
    sounds = (
      <>
        <Sfx frame={voiceFrame(ts, b[0])} name="unlock" volume={0.3} />
        <Sfx frame={voiceFrame(ts, b[0] + 0.8)} name="chime" volume={0.35} />
      </>
    );
  }

  return (
    <AbsoluteFill>
      {art}
      {overlay}
      {s.stage !== "mother" ? <BigLine ts={ts} line={s.line} frame={frame} y={340} /> : null}
      {sounds}
    </AbsoluteFill>
  );
};
