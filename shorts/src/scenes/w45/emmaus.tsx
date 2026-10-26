import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, random, useCurrentFrame } from "remotion";
import { useLook } from "../../looks";
import { Sfx, beat, beats, voiceFrame } from "../../lib/sfx";
import { FPS, type TimelineScene } from "../../lib/timing";
import type { Scene as SceneData } from "../../schema";

/*
 * Der Weg nach Emmaus (Lukas 24:13–35), von der Seite gesehen: zwei Jünger gehen in den
 * Sonnenuntergang, Jerusalem und die drei Kreuze bleiben hinter ihnen. Ein Dritter kommt dazu –
 * hell gekleidet, mit einem Tuch über dem Kopf, ohne Gesicht im Detail –, und über ihnen
 * leuchten die Schriften auf, die er ihnen erklärt. Am Abend ein Haus mit Licht, drinnen der
 * Tisch: Er bricht das Brot, und sein Platz ist leer. Zurück bleibt das Brennen im Herzen.
 *
 * Der Himmel kommt aus `DuskBg` und läuft mit der ganzen Folge; der Weg zieht im Takt des
 * globalen Frames vorbei, darum bleibt er über die Szenen hinweg stetig.
 */

type EmmausSceneT = Extract<SceneData, { type: "emmaus" }>;
type P = [number, number];

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = Easing.inOut(Easing.sin);
const fade = (t: number, at: number, d = 0.4) => interpolate(t, [at, at + d], [0, 1], clamp);

/** Füsse der Wanderer */
const GROUND = 1112;
/** So viele Bildpunkte zieht der Weg je Frame vorbei */
const SPEED = 3.2;
/** Ungefähr hier (globaler Frame) kommen sie im Dorf an – für die Wegleiste oben */
const ARRIVE = 930;

const hex = (s: string) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
const mix = (a: string, b: string, k: number) => {
  const pa = hex(a);
  const pb = hex(b);
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * Math.max(0, Math.min(1, k)))).join(",")})`;
};
const NIGHT = "#0D0A16";

/* ------------------------------------------------------------------ */
/* Figuren                                                             */
/* ------------------------------------------------------------------ */

type WalkerProps = {
  x: number;
  /** Schrittphase (Bogenmass) */
  phase: number;
  /** 0 = steht, 1 = geht */
  walking: number;
  robe: string;
  mantle: string;
  head: string;
  /** Streiflicht von vorn (Sonne im Westen) */
  rim: string;
  /** Kopf gesenkt 0 … 1 */
  bow?: number;
  /** Arm nach vorn ausgestreckt (einladen) 0 … 1 */
  reach?: number;
  dir?: 1 | -1;
  o?: number;
  glow?: number;
  /** Glut in der Brust 0 … 1 */
  heart?: number;
  frame: number;
};

const WalkerShape: React.FC<{ robe: string; mantle: string; head: string; bow: number; reach: number; phase: number; walking: number; staff: boolean }> = ({ robe, mantle, head, bow, reach, phase, walking, staff }) => {
  const swing = Math.sin(phase) * walking;
  const hem = swing * 6;
  const hx = 8 + bow * 10;
  const hy = -272 + bow * 14;
  const hand: P = [40 + 60 * reach, -132 - 70 * reach];
  return (
    <g>
      {/* Füsse */}
      <ellipse cx={-14 + swing * 22} cy={-5} rx={15} ry={6} fill={robe} />
      <ellipse cx={10 - swing * 22} cy={-5} rx={15} ry={6} fill={robe} />
      {/* Gewand */}
      <path d={`M ${-40 + hem} -8 C -48 -92, -44 -172, -34 -230 C -26 -258, 26 -260, 34 -232 C 46 -172, 52 -96, ${46 + hem} -8 Z`} fill={robe} />
      {/* Mantel über der Schulter */}
      <path d={`M -36 -232 C -10 -252, 30 -244, 38 -224 L 26 -110 C 4 -100, -30 -112, ${-44 + hem * 0.5} -124 Z`} fill={mantle} />
      {/* Kopf mit Tuch */}
      <g transform={`rotate(${bow * 16} ${hx} ${hy + 20})`}>
        <circle cx={hx} cy={hy} r={25} fill={head} />
        <path d={`M ${hx - 30} ${hy + 30} C ${hx - 36} ${hy - 30}, ${hx + 22} ${hy - 44}, ${hx + 30} ${hy - 6} C ${hx + 32} ${hy + 4}, ${hx + 22} ${hy + 4}, ${hx + 18} ${hy - 6} C ${hx + 10} ${hy - 22}, ${hx - 12} ${hy - 20}, ${hx - 14} ${hy + 4} L ${hx - 8} ${hy + 34} Z`} fill={mantle} />
      </g>
      {/* Arm und Stab */}
      {staff ? <line x1={52 + swing * 6 + 30 * reach} y1={-238} x2={66 + swing * 16} y2={0} stroke="#3A2616" strokeWidth={6} strokeLinecap="round" opacity={1 - reach} /> : null}
      <path d={`M 18 -218 Q ${36 + 20 * reach} ${-168 - 40 * reach} ${hand[0]} ${hand[1]}`} stroke={mantle} strokeWidth={20} strokeLinecap="round" fill="none" />
    </g>
  );
};

const Walker: React.FC<WalkerProps & { staff?: boolean; k?: number }> = ({ x, phase, walking, robe, mantle, head, rim, bow = 0, reach = 0, dir = 1, o = 1, glow = 0, heart = 0, frame, staff = true, k = 1 }) => {
  if (o <= 0.01) return null;
  const bob = -Math.abs(Math.sin(phase)) * 5 * walking;
  const shape = { robe, mantle, head, bow, reach, phase, walking, staff };
  const rimShape = { robe: rim, mantle: rim, head: rim, bow, reach, phase, walking, staff: false };
  return (
    <g transform={`translate(${x} ${GROUND + bob}) scale(${dir * k} ${k})`} opacity={o}>
      <ellipse cx={0} cy={2} rx={70} ry={9} fill="#000" opacity={0.3} />
      {glow > 0 ? <ellipse cx={4} cy={-150} rx={120} ry={210} fill="url(#emGlow)" opacity={glow * (0.85 + 0.15 * Math.sin(frame / 9))} /> : null}
      <g transform="translate(4 -1)">
        <WalkerShape {...rimShape} />
      </g>
      <WalkerShape {...shape} />
      {heart > 0 ? <Heart x={6} y={-196} k={heart} frame={frame} /> : null}
    </g>
  );
};

/** Ein Brennen in der Brust: kleine Flamme mit warmem Hof */
const Heart: React.FC<{ x: number; y: number; k: number; frame: number }> = ({ x, y, k, frame }) => {
  const fl = 1 + 0.08 * Math.sin(frame / 2.6) + 0.05 * Math.sin(frame / 4.3);
  return (
    <g transform={`translate(${x} ${y})`} opacity={Math.min(1, k * 1.3)}>
      <circle r={70 * k} fill="url(#emHeart)" />
      <g transform={`scale(${(0.5 + 0.6 * k) * fl})`}>
        <path d="M 0 -30 C 14 -14, 18 4, 0 16 C -18 4, -14 -14, 0 -30 Z" fill="#FFB347" />
        <path d="M 0 -14 C 7 -6, 8 4, 0 10 C -8 4, -7 -6, 0 -14 Z" fill="#FFF1B8" />
      </g>
    </g>
  );
};

const DISCIPLE_A = { robe: "#5B3B2A", mantle: "#7A5236", head: "#4A3020" };
const DISCIPLE_B = { robe: "#3C4A5E", mantle: "#56677E", head: "#31384A" };
const STRANGER = { robe: "#EFE8D9", mantle: "#D9CDB6", head: "#E4DACA" };

const shade = (c: { robe: string; mantle: string; head: string }, light: number) => ({
  robe: mix(c.robe, NIGHT, 0.45 + 0.4 * (1 - light)),
  mantle: mix(c.mantle, NIGHT, 0.4 + 0.4 * (1 - light)),
  head: mix(c.head, NIGHT, 0.45 + 0.4 * (1 - light)),
});

/* ------------------------------------------------------------------ */
/* Landschaft vorne                                                    */
/* ------------------------------------------------------------------ */

const OliveTree: React.FC<{ x: number; y: number; s: number; color: string; trunk: string }> = ({ x, y, s, color, trunk }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path d="M -4 0 C -6 -20, -14 -34, -6 -52 M 4 0 C 6 -24, 16 -36, 8 -54" stroke={trunk} strokeWidth={7} fill="none" strokeLinecap="round" />
    {[
      [-30, -64, 30],
      [0, -82, 36],
      [30, -66, 30],
      [-12, -54, 24],
      [16, -52, 24],
    ].map(([cx, cy, r], i) => (
      <ellipse key={i} cx={cx} cy={cy} rx={r} ry={r * 0.72} fill={color} />
    ))}
  </g>
);

const Land: React.FC<{ scroll: number; light: number }> = ({ scroll, light }) => {
  const stones = useMemo(() => Array.from({ length: 26 }, (_, i) => ({ x: random(`es${i}`) * 1400, y: 1078 + random(`ey${i}`) * 66, r: 3 + random(`er${i}`) * 5 })), []);
  const tufts = useMemo(() => Array.from({ length: 22 }, (_, i) => ({ x: random(`et${i}`) * 1500, s: 0.7 + random(`ets${i}`) * 0.6 })), []);
  const dark = 1 - light;
  const hill = mix("#6E5642", NIGHT, 0.35 + 0.6 * dark);
  const tree = mix("#55603E", NIGHT, 0.35 + 0.6 * dark);
  const trunk = mix("#4A3A2A", NIGHT, 0.4 + 0.5 * dark);
  const road = mix("#C8A57A", "#221C2A", 0.15 + 0.75 * dark);
  const roadEdge = mix("#A07E58", "#18131F", 0.15 + 0.75 * dark);
  const front = mix("#3B2D22", NIGHT, 0.3 + 0.6 * dark);
  const wrap = (x: number, span: number) => ((x % span) + span) % span;
  const midOff = scroll * 0.42;
  const hillD = (() => {
    const pts: string[] = [];
    for (let i = 0; i <= 40; i++) {
      const x = -60 + i * 30;
      const xx = x + midOff;
      pts.push(`${x} ${(1060 - 22 * Math.sin(xx / 160) - 10 * Math.sin(xx / 61)).toFixed(1)}`);
    }
    return `M -60 1200 L ${pts.join(" L ")} L 1140 1200 Z`;
  })();
  return (
    <g>
      <path d={hillD} fill={hill} />
      {Array.from({ length: 8 }, (_, i) => {
        const x = wrap(i * 190 - midOff, 1520) - 220;
        const y = 1052 - 22 * Math.sin((x + midOff) / 160);
        return <OliveTree key={i} x={x} y={y + 8} s={0.8 + (i % 3) * 0.16} color={tree} trunk={trunk} />;
      })}
      {/* Weg */}
      <rect x={0} y={1068} width={1080} height={84} fill={road} />
      <rect x={0} y={1066} width={1080} height={5} fill={roadEdge} />
      {stones.map((st, i) => (
        <ellipse key={i} cx={wrap(st.x - scroll, 1400) - 160} cy={st.y} rx={st.r * 1.5} ry={st.r} fill={roadEdge} opacity={0.7} />
      ))}
      {/* Vordergrund */}
      <rect x={0} y={1150} width={1080} height={770} fill={front} />
      {tufts.map((tf, i) => {
        const x = wrap(tf.x - scroll * 1.3, 1500) - 200;
        return <path key={i} d={`M ${x} 1156 l -8 -${26 * tf.s} m 8 ${26 * tf.s} l 2 -${34 * tf.s} m -2 ${34 * tf.s} l 10 -${24 * tf.s}`} stroke={front} strokeWidth={4} fill="none" />;
      })}
    </g>
  );
};

/** Wegweiser am Strassenrand */
const Signpost: React.FC<{ x: number; o: number; light: number }> = ({ x, o, light }) =>
  o > 0.01 ? (
    <g transform={`translate(${x} 0)`} opacity={o}>
      <rect x={-7} y={880} width={14} height={232} fill={mix("#6B4A2A", NIGHT, 0.3 * (1 - light))} />
      <path d="M -10 900 L 196 900 L 226 932 L 196 964 L -10 964 Z" fill="#E9D7AE" stroke="#4A3520" strokeWidth={4} />
      <text x={96} y={946} textAnchor="middle" fontFamily="Cinzel" fontWeight={700} fontSize={30} fill="#3A2614">
        EMMAUS 11 KM
      </text>
      <path d="M 10 978 L -176 978 L -206 1008 L -176 1038 L 10 1038 Z" fill="#E0CB9E" stroke="#4A3520" strokeWidth={4} />
      <text x={-92} y={1020} textAnchor="middle" fontFamily="Cinzel" fontWeight={700} fontSize={28} fill="#3A2614">
        JERUSALEM
      </text>
    </g>
  ) : null;

/** Jerusalem und die drei Kreuze, klein auf den fernen Hügeln */
const City: React.FC<{ x: number; o: number }> = ({ x, o }) =>
  o > 0.01 ? (
    <g transform={`translate(${x} 0)`} opacity={o} fill="#24152A">
      <path d="M 0 1010 L 0 968 L 20 968 L 20 956 L 34 956 L 34 968 L 70 968 L 70 944 L 110 924 L 150 944 L 150 968 L 190 968 L 190 952 L 206 952 L 206 968 L 240 968 L 240 1010 Z" />
      <rect x={96} y={930} width={28} height={16} fill="#FFC27A" opacity={0.4} />
      <path d="M 280 1010 Q 330 960 380 1010 Z" />
      {[300, 330, 360].map((cx, i) => (
        <g key={i}>
          <rect x={cx - 2.5} y={i === 1 ? 930 : 942} width={5} height={i === 1 ? 52 : 42} />
          <rect x={cx - 12} y={i === 1 ? 942 : 952} width={24} height={4.5} />
        </g>
      ))}
    </g>
  ) : null;

/** Eine leuchtende Schriftrolle mit Namen */
const ScrollLight: React.FC<{ x: number; y: number; label: string; k: number; frame: number; i: number }> = ({ x, y, label, k, frame, i }) => {
  if (k <= 0.01) return null;
  const bob = Math.sin(frame / 18 + i * 2) * 8;
  return (
    <g transform={`translate(${x} ${y + bob + (1 - k) * 60}) scale(${0.7 + 0.3 * k})`} opacity={Math.min(1, k * 1.4)}>
      <ellipse rx={150} ry={86} fill="url(#emGlow)" opacity={0.9} />
      <rect x={-70} y={-38} width={140} height={76} fill="#F7EBCB" stroke="#B88A3A" strokeWidth={3} />
      {[-70, 70].map((rx) => (
        <rect key={rx} x={rx - 10} y={-48} width={20} height={96} rx={9} fill="#B07A3A" stroke="#6E4A1E" strokeWidth={2} />
      ))}
      {[0, 1, 2].map((l) => (
        <path key={l} d={`M -48 ${-14 + l * 16} q 16 -5 32 0 t 32 0 t 32 0`} stroke="#6E4A1E" strokeWidth={2.5} fill="none" opacity={0.5} />
      ))}
      <text y={84} textAnchor="middle" fontFamily="Cormorant Garamond" fontStyle="italic" fontWeight={600} fontSize={48} fill="#FFF3D6" stroke="#2A1A2E" strokeWidth={6} paintOrder="stroke">
        {label}
      </text>
    </g>
  );
};

/** Das Haus im Dorf, mit Licht im Fenster */
const House: React.FC<{ x: number; light: number; lamp: number; door: number }> = ({ x, light, lamp, door }) => {
  const wall = mix("#C9A57C", NIGHT, 0.2 + 0.5 * (1 - light));
  const wallDark = mix("#8A6C4C", NIGHT, 0.35 + 0.55 * (1 - light));
  return (
    <g transform={`translate(${x} ${GROUND}) scale(1.35) translate(0 ${-GROUND + 22})`}>
      {/* Nachbarhäuser */}
      <rect x={150} y={930} width={190} height={150} fill={wallDark} />
      <rect x={180} y={970} width={34} height={30} fill="#FFC870" opacity={0.25 + 0.6 * lamp} />
      <rect x={-140} y={870} width={280} height={220} fill={wall} />
      <rect x={-156} y={858} width={312} height={18} fill={wallDark} />
      {/* Fenster mit Lampenlicht */}
      <ellipse cx={58} cy={950} rx={110} ry={90} fill="url(#emWindow)" opacity={lamp} />
      <rect x={30} y={918} width={56} height={56} fill={mix("#2A1E16", "#FFC870", lamp)} stroke={wallDark} strokeWidth={6} />
      <line x1={58} y1={918} x2={58} y2={974} stroke={wallDark} strokeWidth={5} />
      {/* Tür */}
      <rect x={-92} y={960} width={70} height={130} fill="#2A1A10" />
      <rect x={-92} y={960} width={70} height={130} fill="#FFC870" opacity={0.5 * door} />
      <path d={`M -92 960 L ${-92 + 70 * (1 - door * 0.7)} 966 L ${-92 + 70 * (1 - door * 0.7)} 1084 L -92 1090 Z`} fill={mix("#6A4A2C", NIGHT, 0.4 * (1 - light))} />
      <rect x={-140} y={1088} width={280} height={8} fill={wallDark} />
    </g>
  );
};

/* ------------------------------------------------------------------ */
/* Drinnen: der Tisch                                                  */
/* ------------------------------------------------------------------ */

/** Gestalt hinter dem Tisch, von vorn, Brust aufwärts – ohne Gesicht. Ursprung: Tischkante in der Mitte der Figur */
const Seated: React.FC<{ x: number; c: { robe: string; mantle: string; head: string }; skin: string; beard: string; turn?: number; lift?: number; heart?: number; frame: number; o?: number }> = ({ x, c, skin, beard, turn = 0, lift = 0, heart = 0, frame, o = 1 }) => (
  <g transform={`translate(${x} 930)`} opacity={o}>
    <path d="M -120 0 C -118 -80, -84 -150, -44 -168 L 44 -168 C 84 -150, 118 -80, 120 0 Z" fill={c.robe} />
    <path d="M -46 -168 C -20 -150, 20 -150, 46 -168 L 30 -90 C 10 -80, -10 -80, -30 -90 Z" fill={c.mantle} opacity={0.8} />
    <g transform={`translate(${turn * 14} ${-lift * 10}) rotate(${turn * 10} 0 -180)`}>
      <ellipse cx={0} cy={-222} rx={40} ry={50} fill={skin} />
      <path d="M -36 -214 C -34 -170, -14 -158, 0 -158 C 14 -158, 34 -170, 36 -214 C 26 -196, 14 -190, 0 -190 C -14 -190, -26 -196, -36 -214 Z" fill={beard} />
      <ellipse cx={0} cy={-252} rx={40} ry={22} fill={c.mantle} opacity={0.35} />
      <path d="M -56 -170 C -66 -250, -36 -290, 0 -290 C 36 -290, 66 -250, 56 -170 C 44 -200, 40 -240, 0 -246 C -40 -240, -44 -200, -56 -170 Z" fill={c.mantle} />
    </g>
    {heart > 0 ? <Heart x={0} y={-104} k={heart} frame={frame} /> : null}
  </g>
);

const Interior: React.FC<{ frame: number; t: number; ts: TimelineScene; s: EmmausSceneT; b: number[] }> = ({ frame, t, s, b }) => {
  const bread = s.stage === "bread";
  const takeAt = b[0];
  const breakAt = b[1];
  const openAt = b[2];
  const take = bread ? interpolate(t, [takeAt - 0.1, takeAt + 0.7], [0, 1], { ...clamp, easing: ease }) : 0;
  const split = bread ? interpolate(t, [breakAt + 0.25, breakAt + 0.6], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.6)) }) : 1;
  const flash = bread ? interpolate(t, [openAt - 0.05, openAt + 0.15, openAt + 1.1], [0, 1, 0], clamp) : 0;
  const gone = bread ? interpolate(t, [openAt + 0.1, openAt + 1.0], [0, 1], { ...clamp, easing: ease }) : 1;
  const breadY = bread ? 930 - 120 * take * (1 - gone) : 930;
  const halves = 46 * split * (bread ? 1 - 0.3 * gone : 0.7);
  const lampFl = 0.85 + 0.1 * Math.sin(frame / 2.7) + 0.05 * Math.sin(frame / 5.3);
  const burn = s.stage === "burn";
  const heartK = burn ? interpolate(t, [b[1] - 0.2, b[1] + 0.9], [0, 1], { ...clamp, easing: ease }) : bread ? 0.15 * gone : 0;
  const scrollsK = burn ? fade(t, b[2] - 0.1, 0.6) : 0;
  const turn = burn ? interpolate(t, [b[0] - 0.2, b[0] + 0.5], [0, 1], { ...clamp, easing: ease }) : bread ? 0.6 * gone : 0;
  const disciples = (light: number) => [shade(DISCIPLE_A, light), shade(DISCIPLE_B, light)];
  const [ca, cb] = disciples(0.8);
  const crumbs = useMemo(() => Array.from({ length: 12 }, (_, i) => ({ a: -Math.PI * (0.1 + random(`cr${i}`) * 0.8), v: 60 + random(`cv${i}`) * 90 })), []);
  return (
    <g>
      {/* Raum */}
      <rect x={0} y={0} width={1080} height={1920} fill="url(#emRoom)" />
      {Array.from({ length: 9 }, (_, r) =>
        Array.from({ length: 6 }, (_, c) => (
          <rect key={`${r}-${c}`} x={(c * 200 + (r % 2) * 100) % 1180 - 100} y={300 + r * 80} width={196} height={76} fill="none" stroke="#1E120A" strokeWidth={3} opacity={0.35} />
        )),
      )}
      {/* Fenster mit Nacht */}
      <rect x={110} y={420} width={170} height={200} rx={8} fill="#0C1236" stroke="#1E120A" strokeWidth={10} />
      {[
        [150, 470],
        [230, 520],
        [190, 580],
      ].map(([sx, sy], i) => (
        <circle key={i} cx={sx} cy={sy} r={3} fill="#F3F0FF" opacity={0.6 + 0.4 * Math.sin(frame / 9 + i)} />
      ))}
      {/* Lampenlicht */}
      <circle cx={800} cy={860} r={520} fill="url(#emLamp)" opacity={lampFl} />
      {/* Die Schriften, die er erklärt hat */}
      {burn
        ? (["Mose", "Propheten", "alle Schriften"] as const).map((label, i) => (
            <g key={label}>
              {scrollsK > 0
                ? [250, 830].map((hx) => <line key={hx} x1={290 + i * 250} y1={420} x2={hx} y2={826} stroke="#FFD58A" strokeWidth={3} opacity={0.35 * scrollsK} strokeDasharray="4 10" />)
                : null}
              <ScrollLight x={290 + i * 250} y={380} label={label} k={scrollsK} frame={frame} i={i} />
            </g>
          ))
        : null}
      {/* Figuren hinter dem Tisch */}
      <Seated x={250} c={ca} skin="#B98660" beard="#4A2E1C" turn={turn} lift={bread ? gone : burn ? 1 : 0} heart={heartK} frame={frame} />
      <Seated x={830} c={cb} skin="#B07E5C" beard="#3A2A1E" turn={-turn} lift={bread ? gone : burn ? 1 : 0} heart={heartK} frame={frame} />
      {/* Er – und dann nur noch Licht */}
      <ellipse cx={540} cy={720} rx={210} ry={300} fill="url(#emGlow)" opacity={(bread ? 0.55 + 0.45 * gone : 0.45) * (burn ? 0.6 + 0.1 * Math.sin(frame / 8) : 1)} />
      {bread ? (
        <g opacity={1 - gone}>
          <Seated x={540} c={STRANGER} skin="#E6CBA8" beard="#7A5434" frame={frame} />
          {/* Hände mit dem Brot */}
          <path d={`M 470 860 Q 480 ${breadY - 10} ${506 - halves * 0.4} ${breadY + 10}`} stroke={STRANGER.mantle} strokeWidth={26} strokeLinecap="round" fill="none" />
          <path d={`M 610 860 Q 600 ${breadY - 10} ${574 + halves * 0.4} ${breadY + 10}`} stroke={STRANGER.mantle} strokeWidth={26} strokeLinecap="round" fill="none" />
        </g>
      ) : null}
      {/* Tisch */}
      <rect x={60} y={930} width={960} height={36} rx={6} fill="#6A4426" />
      <rect x={60} y={962} width={960} height={200} fill="#4A2E18" />
      <rect x={60} y={962} width={960} height={10} fill="#2E1C0E" opacity={0.6} />
      {/* Öllampe */}
      <g transform="translate(800 930)">
        <ellipse cx={0} cy={-10} rx={42} ry={16} fill="#B9814A" stroke="#5A3A1C" strokeWidth={3} />
        <path d="M 30 -14 L 52 -22 L 48 -10 Z" fill="#B9814A" stroke="#5A3A1C" strokeWidth={3} />
        <g transform={`translate(54 -24) scale(${lampFl})`}>
          <path d="M 0 -34 C 10 -20, 10 -6, 0 0 C -10 -6, -10 -20, 0 -34 Z" fill="#FFB347" />
          <path d="M 0 -20 C 5 -12, 5 -4, 0 0 C -5 -4, -5 -12, 0 -20 Z" fill="#FFF1B8" />
        </g>
      </g>
      {/* Brot – ganz, dann gebrochen */}
      <g transform={`translate(540 ${breadY})`}>
        {split > 0.02 && bread
          ? crumbs.map((cr, i) => {
              const k = interpolate(t, [breakAt + 0.25, breakAt + 0.9], [0, 1], clamp);
              return k > 0 && k < 1 ? <circle key={i} cx={Math.cos(cr.a) * cr.v * k} cy={Math.sin(cr.a) * cr.v * k + 120 * k * k} r={3.5} fill="#D9A45E" opacity={1 - k} /> : null;
            })
          : null}
        {[-1, 1].map((sd) => (
          <g key={sd} transform={`translate(${sd * halves} 0) rotate(${sd * 8 * split})`}>
            <path d={sd < 0 ? "M 0 -38 C -40 -40, -72 -26, -76 -6 C -78 8, -60 14, 0 14 Z" : "M 0 -38 C 40 -40, 72 -26, 76 -6 C 78 8, 60 14, 0 14 Z"} fill="#C98B47" stroke="#7A4E22" strokeWidth={4} />
            <path d={sd < 0 ? "M -16 -26 q -14 -6 -30 2" : "M 16 -26 q 14 -6 30 2"} stroke="#F2C989" strokeWidth={4} fill="none" strokeLinecap="round" />
            {split > 0.3 ? <path d="M 0 -38 L 0 14" stroke="#F5DDB0" strokeWidth={6} opacity={split} /> : null}
          </g>
        ))}
      </g>
      {/* Aufgehen der Augen */}
      {flash > 0 ? <rect x={0} y={0} width={1080} height={1920} fill="#FFF6DE" opacity={0.55 * flash} /> : null}
    </g>
  );
};

/* ------------------------------------------------------------------ */
/* Szene                                                               */
/* ------------------------------------------------------------------ */

export const Scene: React.FC<{ ts: TimelineScene }> = ({ ts }) => {
  const s = ts.scene as EmmausSceneT;
  const frame = useCurrentFrame();
  const look = useLook();
  const t = (frame - ts.audioOffsetFrames) / FPS;
  const b = beats(ts, s.cues, Math.max(4, s.cues.length));
  const f = (sec: number) => voiceFrame(ts, sec);
  const stage = s.stage;
  const global = ts.from + frame;
  const inside = stage === "bread" || stage === "burn";

  /* Licht vorne: aus dem Himmelswert der Szene, am Abend dunkler */
  const base = Math.max(0.15, Math.min(1, (s.sky - 0.1) / 0.6));
  const darkAt = stage === "evening" ? beat(ts, "Es wird schon dunkel", b[1] + 1) : 99;
  const light = stage === "evening" ? base - interpolate(t, [darkAt - 0.2, darkAt + 1.0], [0, 0.22], clamp) : base;

  /* Gehen: Am Abend bleiben sie stehen */
  const stopF0 = stage === "evening" ? f(b[0] - 0.4) : 1e9;
  const stopF1 = stage === "evening" ? f(b[0] + 1.4) : 1e9;
  const localDist = (() => {
    if (frame <= stopF0) return frame;
    const span = Math.max(1, stopF1 - stopF0);
    if (frame >= stopF1) return stopF0 + span / 2;
    const d = frame - stopF0;
    return stopF0 + d - (d * d) / (2 * span);
  })();
  const scroll = (ts.from + localDist) * SPEED;
  const walking = stage === "evening" ? interpolate(frame, [stopF0, stopF1], [1, 0], clamp) : 1;
  const phase = (ts.from + localDist) * 0.16;

  /* Figuren und ihre Plätze */
  const hook = s.hook;
  const sad = stage === "road" && !hook ? interpolate(t, [b[2] - 0.2, b[2] + 0.6], [0, 1], clamp) : stage === "road" ? 0.3 : stage === "stranger" ? interpolate(t, [b[0] + 1.0, b[0] + 2.4], [1, 0.4], clamp) : stage === "scriptures" ? interpolate(t, [b[0], b[2]], [0.4, 0], clamp) : 0;
  let xA = 340;
  let xB = 600;
  let xJ = -200;
  let oJ = 0;
  let glowJ = 0;
  let reachB = 0;
  let dirJ: 1 | -1 = 1;
  if (stage === "road") {
    const enter = hook ? interpolate(t, [b[0] - 0.6, b[0] + 0.6], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) }) : 1;
    xA = -120 + 460 * enter;
    xB = -40 + 640 * enter;
    if (hook) {
      xJ = interpolate(t, [b[2] - 0.3, b[2] + 2.0], [-90, 90], clamp);
      oJ = fade(t, b[2] - 0.3, 0.6) * 0.95;
      glowJ = oJ;
    }
  } else if (stage === "stranger") {
    const join = interpolate(t, [b[0] - 0.7, b[0] + 1.3], [0, 1], { ...clamp, easing: ease });
    xA = 330;
    xB = 600 + 120 * join;
    xJ = -110 + 635 * join;
    oJ = 1;
    glowJ = interpolate(t, [beat(ts, "Es ist Jesus", b[0] + 1.5) - 0.1, beat(ts, "Es ist Jesus", b[0] + 1.5) + 0.6], [0.25, 0.8], clamp);
  } else if (stage === "scriptures") {
    xA = 330;
    xB = 720;
    xJ = 525;
    oJ = 1;
    glowJ = 0.6 + 0.35 * fade(t, b[2] - 0.1, 0.6);
  } else if (stage === "evening") {
    xA = 330;
    xB = 540;
    // Er tut, als wolle er weitergehen – dann kehrt er um
    const turnAt = beat(ts, "Bleib bei uns", b[0] + 1.5);
    const past = interpolate(frame, [0, stopF1 + 6], [720, 900], { ...clamp, easing: Easing.out(Easing.quad) });
    xJ = past - interpolate(t, [turnAt + 0.4, turnAt + 1.6], [0, 200], { ...clamp, easing: ease });
    dirJ = t > turnAt + 0.3 ? -1 : 1;
    oJ = 1;
    glowJ = 0.55;
    reachB = interpolate(t, [turnAt - 0.25, turnAt + 0.2, turnAt + 1.6, turnAt + 2.0], [0, 1, 1, 0.3], clamp);
  }
  const walkJ = stage === "evening" ? (t > beat(ts, "Bleib bei uns", 2) + 0.4 && t < beat(ts, "Bleib bei uns", 2) + 1.6 ? 1 : Math.max(walking, interpolate(frame, [stopF1, stopF1 + 6], [1, 0], clamp))) : 1;
  const heartK = stage === "scriptures" ? 0.4 * fade(t, b[1], 1.2) : 0;

  /* Haus: kommt beim Gehen ins Bild und bleibt stehen */
  const houseStop = stage === "evening" ? (stopF0 + (stopF1 - stopF0) / 2) * SPEED : 0;
  const houseX = stage === "evening" ? 840 + houseStop - localDist * SPEED : 2000;
  const lamp = stage === "evening" ? 0.4 + 0.6 * fade(t, darkAt - 0.2, 0.8) : 0;

  /* Wegleiste */
  const routeO = stage === "road" ? (hook ? 0 : fade(t, b[1] - 0.1)) : inside ? 0 : 1;
  const routeK = stage === "evening" ? Math.min(1, Math.max((ts.from + frame) / ARRIVE, interpolate(frame, [stopF0, stopF1], [0.9, 1], clamp))) : Math.min(0.97, global / ARRIVE);

  const a = shade(DISCIPLE_A, light);
  const bb = shade(DISCIPLE_B, light);
  const rim = mix("#FFC27A", NIGHT, 0.2 + 0.6 * (1 - light));
  const signO = stage === "road" && hook ? fade(t, b[1] - 0.2, 0.3) : 0;
  const signX = 860 - (frame - Math.max(0, f(b[1] - 0.2))) * SPEED;
  const hopeAt = beat(ts, "Ihre Hoffnung ist weg", b[2] + 1.5);
  const cityX = stage === "road" && !hook ? 40 - frame * SPEED * 0.12 : -500;
  const cityO = stage === "road" && !hook ? fade(t, b[0] - 0.2, 0.8) * interpolate(t, [b[2] + 1, hopeAt + 1.5], [1, 0.5], clamp) : 0;
  const hopeless = stage === "road" && !hook ? fade(t, hopeAt - 0.1, 0.8) : 0;

  const scrolls = [
    { label: "Mose", x: 290, y: 600, at: b[0] + 0.4 },
    { label: "Propheten", x: 545, y: 520, at: b[1] + 0.1 },
    { label: "alle Schriften", x: 805, y: 610, at: b[1] + 0.8 },
  ];
  const rays = stage === "scriptures" ? fade(t, b[2] - 0.1, 0.5) : 0;

  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id="emGlow">
            <stop offset="0%" stopColor="#FFF6DA" stopOpacity="0.85" />
            <stop offset="45%" stopColor="#FFE3A8" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#FFE3A8" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="emHeart">
            <stop offset="0%" stopColor="#FFD08A" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#FF9A4C" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#FF9A4C" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="emWindow">
            <stop offset="0%" stopColor="#FFC870" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#FFC870" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="emLamp">
            <stop offset="0%" stopColor="#FFC47A" stopOpacity="0.5" />
            <stop offset="55%" stopColor="#E08A40" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#E08A40" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="emRoom" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#24140C" />
            <stop offset="45%" stopColor="#3A2214" />
            <stop offset="100%" stopColor="#1A0E08" />
          </linearGradient>
        </defs>
        {inside ? (
          <Interior frame={frame} t={t} ts={ts} s={s} b={b} />
        ) : (
          <g>
            <City x={cityX} o={cityO} />
            {stage === "evening" ? <House x={houseX} light={light} lamp={lamp} door={fade(t, darkAt + 0.6, 0.8)} /> : null}
            <Land scroll={scroll} light={light} />
            <Signpost x={signX} o={signO} light={light} />
            {/* Die Schriften leuchten über ihnen auf */}
            {stage === "scriptures"
              ? scrolls.map((sc, i) => (
                  <g key={sc.label}>
                    {rays > 0 ? <line x1={sc.x} y1={sc.y + 40} x2={xJ + 8} y2={GROUND - 320} stroke="#FFE3A8" strokeWidth={4} opacity={0.5 * rays} strokeDasharray="6 10" strokeDashoffset={-frame * 2} /> : null}
                    <ScrollLight x={sc.x} y={sc.y} label={sc.label} k={interpolate(t, [sc.at - 0.2, sc.at + 0.5], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) })} frame={frame} i={i} />
                  </g>
                ))
              : null}
            <Walker x={xA} phase={phase} walking={walking} {...a} rim={rim} bow={sad} heart={heartK} frame={frame} k={1.25} />
            <Walker x={xJ} phase={phase + 1.4} walking={walkJ} {...STRANGER} rim="#FFF4D8" o={oJ} glow={glowJ} dir={dirJ} frame={frame} staff={false} k={1.25} />
            <Walker x={xB} phase={phase + 2.6} walking={walking} {...bb} rim={rim} bow={sad} reach={reachB} heart={heartK} frame={frame} k={1.25} />
            {/* Sie erkennen ihn nicht */}
            {stage === "stranger"
              ? [xA, xB].map((x, i) => {
                  const q = fade(t, b[1] + i * 0.15, 0.3) * interpolate(t, [b[1] + 1.6, b[1] + 2.2], [1, 0.5], clamp);
                  return q > 0.01 ? (
                    <text key={i} x={x + 16} y={GROUND - 410} textAnchor="middle" fontFamily="Cormorant Garamond" fontStyle="italic" fontWeight={600} fontSize={84} fill="#FFE9C4" opacity={q} stroke="#2A1A2E" strokeWidth={6} paintOrder="stroke">
                      ?
                    </text>
                  ) : null;
                })
              : null}
            {/* Die Hoffnung ist weg: der Weg wird grauer */}
            {hopeless > 0 ? <rect x={0} y={250} width={1080} height={1670} fill="#1A1424" opacity={0.22 * hopeless} /> : null}
          </g>
        )}
      </svg>

      {/* Wegleiste Jerusalem → Emmaus */}
      {routeO > 0.01 ? (
        <div style={{ position: "absolute", left: 90, right: 90, top: 292, opacity: routeO }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "Cinzel", fontWeight: 700, fontSize: 34, letterSpacing: "0.12em", color: look.text, textShadow: "0 2px 12px rgba(0,0,0,0.6)" }}>
            <span>JERUSALEM</span>
            <span>EMMAUS</span>
          </div>
          <div style={{ position: "relative", marginTop: 14, height: 8, borderRadius: 4, background: "rgba(255,247,236,0.25)" }}>
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${routeK * 100}%`, borderRadius: 4, background: look.accent }} />
            <div style={{ position: "absolute", left: `calc(${routeK * 100}% - 13px)`, top: -9, width: 26, height: 26, borderRadius: 13, background: "#FFF7EC", boxShadow: `0 0 18px ${look.accent}` }} />
          </div>
          <div style={{ marginTop: 12, textAlign: "center", fontFamily: "Cormorant Garamond", fontStyle: "italic", fontWeight: 600, fontSize: 46, color: look.text, textShadow: "0 2px 14px rgba(0,0,0,0.7)" }}>
            {routeK >= 0.995 ? "angekommen" : `noch ${Math.max(1, Math.round(11 * (1 - routeK)))} km`}
          </div>
        </div>
      ) : null}

      {/* Geräusche */}
      {stage === "road" && hook ? (
        <>
          <Sfx frame={f(b[0] - 0.3)} name="whoosh" volume={0.3} />
          <Sfx frame={f(b[1])} name="pop" volume={0.35} />
          <Sfx frame={f(b[2])} name="chime" volume={0.35} />
        </>
      ) : null}
      {stage === "road" && !hook ? (
        <>
          <Sfx frame={f(b[0])} name="drum" volume={0.4} />
          <Sfx frame={f(b[1])} name="swipe" volume={0.25} />
        </>
      ) : null}
      {stage === "stranger" ? (
        <>
          <Sfx frame={f(b[0])} name="whoosh" volume={0.3} />
          <Sfx frame={f(beat(ts, "Es ist Jesus", b[0] + 1.5))} name="chime" volume={0.4} />
          <Sfx frame={f(b[1])} name="question" volume={0.3} />
        </>
      ) : null}
      {stage === "scriptures"
        ? scrolls.map((sc) => <Sfx key={sc.label} frame={f(sc.at)} name="ding" volume={0.3} />)
        : null}
      {stage === "evening" ? (
        <>
          <Sfx frame={f(beat(ts, "Bleib bei uns", 2))} name="pop" volume={0.3} />
          <Sfx frame={f(darkAt)} name="whoosh" volume={0.3} />
        </>
      ) : null}
      {stage === "bread" ? (
        <>
          <Sfx frame={f(b[0])} name="swipe" volume={0.25} />
          <Sfx frame={f(b[1] + 0.3)} name="pop" volume={0.4} />
          <Sfx frame={f(b[2])} name="chime" volume={0.5} />
        </>
      ) : null}
      {stage === "burn" ? (
        <>
          <Sfx frame={f(b[1])} name="whoosh" volume={0.3} />
          <Sfx frame={f(b[2])} name="chime" volume={0.4} />
        </>
      ) : null}
    </AbsoluteFill>
  );
};

/** Gesprochenes bleibt in den Untertiteln – im Bild stehen nur Namen und Wegweiser. */
export const hidden = (_ts: TimelineScene): Set<number> => new Set();
