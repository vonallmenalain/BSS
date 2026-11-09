import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { FPS, HEIGHT, WIDTH } from "../../../lib/timing";

/*
 * Salomos Thronsaal (1 Könige 3; Zedernholz und Elfenbein wie in 1 Könige 6–7 und 10): Wände
 * aus Zedernbrettern mit geschnitzten Blüten, zwei hohe Bogenfenster, durch die warmes Licht
 * schräg in den Saal fällt, Säulen aus Elfenbein mit goldenen Kapitellen, ein blaugrüner
 * Vorhang hinter dem Thron und ein glänzender Steinboden mit einem Läufer. Zwei Öllampen
 * flackern. Das Licht wird gegen Ende der Folge wärmer – dann, wenn die Wahrheit ans Licht
 * kommt. Thron, Figuren und Kind zeichnet die Szene davor.
 */

const CEIL = 250;
const FLOOR = 1240;

/** Eine geschnitzte Blüte (Rosette) – Mitte (x, y), Radius r. */
const Rosette: React.FC<{ x: number; y: number; r: number; o?: number }> = ({ x, y, r, o = 1 }) => (
  <g transform={`translate(${x} ${y})`} opacity={o}>
    {Array.from({ length: 8 }, (_, i) => (
      <ellipse key={i} cx={0} cy={-r * 0.55} rx={r * 0.24} ry={r * 0.5} transform={`rotate(${i * 45})`} fill="#C9993F" />
    ))}
    <circle r={r * 0.32} fill="#F2CF7A" />
    <circle r={r * 0.14} fill="#8A5A1E" />
  </g>
);

export const CourtBg: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = frame / FPS;
  const p = frame / Math.max(1, durationInFrames);
  /* Gegen Ende (Urteil, Weisheit) wird das Licht wärmer und heller */
  const warm = interpolate(p, [0.62, 0.86], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const breathe = 0.88 + 0.12 * Math.sin(t * 0.6);

  const planks = useMemo(
    () => Array.from({ length: 19 }, (_, i) => ({ x: i * 60 - 30, tone: random(`cbp${i}`), grain: random(`cbg${i}`) })),
    [],
  );
  const dust = useMemo(
    () => Array.from({ length: 60 }, (_, i) => ({ u: random(`cbu${i}`), v: random(`cbv${i}`), r: 1.2 + random(`cbr${i}`) * 2.4, ph: random(`cbf${i}`) * 6.28, s: 5 + random(`cbs${i}`) * 12, side: i % 2 })),
    [],
  );

  /* Zwei Strahlen: vom linken Fenster nach rechts unten, vom rechten nach links unten */
  const beams = [
    { x0: 160, x1: 300, bx0: 330, bx1: 640 },
    { x0: 780, x1: 920, bx0: 440, bx1: 750 },
  ];
  const beamO = (0.16 + 0.1 * warm) * breathe;

  const lamp = (x: number, seed: number) => {
    const fl = 1 + 0.12 * Math.sin(t * 9 + seed) + 0.08 * Math.sin(t * 13.7 + seed * 2);
    return (
      <g key={x}>
        <circle cx={x} cy={890} r={90 * fl} fill="url(#cbLamp)" opacity={0.55} />
        {/* Ständer */}
        <rect x={x - 5} y={910} width={10} height={300} fill="#6A4A1E" />
        <path d={`M ${x - 40} ${1215} L ${x + 40} ${1215} L ${x + 18} ${1185} L ${x - 18} ${1185} Z`} fill="#8C6A2A" />
        <path d={`M ${x - 34} ${905} Q ${x} ${935} ${x + 34} ${905} Z`} fill="#B8893A" />
        {/* Flamme */}
        <g transform={`translate(${x} ${900}) scale(${fl})`}>
          <path d="M 0 -34 C 10 -18, 12 -4, 0 4 C -12 -4, -10 -18, 0 -34 Z" fill="#FFB347" />
          <path d="M 0 -20 C 5 -12, 6 -4, 0 1 C -6 -4, -5 -12, 0 -20 Z" fill="#FFF2C2" />
        </g>
      </g>
    );
  };

  return (
    <AbsoluteFill style={{ background: "#1A0F08" }}>
      <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <linearGradient id="cbPlankA" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#4A2A16" />
            <stop offset="50%" stopColor="#6A3E22" />
            <stop offset="100%" stopColor="#47280F" />
          </linearGradient>
          <linearGradient id="cbWallShade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0C0603" stopOpacity="0.75" />
            <stop offset="40%" stopColor="#0C0603" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#0C0603" stopOpacity="0.55" />
          </linearGradient>
          <linearGradient id="cbIvory" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#6E5E44" />
            <stop offset="30%" stopColor="#EFE3C8" />
            <stop offset="60%" stopColor="#D6C39C" />
            <stop offset="100%" stopColor="#5E4E36" />
          </linearGradient>
          <linearGradient id="cbGold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FFF0B8" />
            <stop offset="45%" stopColor="#E3B04F" />
            <stop offset="100%" stopColor="#8A5E1A" />
          </linearGradient>
          <linearGradient id="cbCurtain" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#0B2E2C" />
            <stop offset="18%" stopColor="#1F6560" />
            <stop offset="34%" stopColor="#123F3C" />
            <stop offset="52%" stopColor="#24706A" />
            <stop offset="68%" stopColor="#123F3C" />
            <stop offset="84%" stopColor="#1F6560" />
            <stop offset="100%" stopColor="#0B2E2C" />
          </linearGradient>
          <linearGradient id="cbWindow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFF6DA" />
            <stop offset="100%" stopColor="#FFD58A" />
          </linearGradient>
          <linearGradient id="cbBeam" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFE7B5" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#FFE7B5" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="cbFloor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5E4630" />
            <stop offset="100%" stopColor="#1A120B" />
          </linearGradient>
          <linearGradient id="cbRunner" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#5A1C1C" />
            <stop offset="50%" stopColor="#8C2E2A" />
            <stop offset="100%" stopColor="#5A1C1C" />
          </linearGradient>
          <radialGradient id="cbLamp">
            <stop offset="0%" stopColor="#FFD58A" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#FFD58A" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="cbWarm" cx="0.5" cy="0.45" r="0.6">
            <stop offset="0%" stopColor="#FFDCA0" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#FFDCA0" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Decke: Balken aus Zedernholz */}
        <rect x={0} y={0} width={WIDTH} height={CEIL} fill="#140A05" />
        {Array.from({ length: 10 }, (_, i) => (
          <rect key={i} x={i * 120 - 20} y={CEIL - 70} width={60} height={70} fill="#2E1A0E" />
        ))}
        <rect x={0} y={CEIL - 12} width={WIDTH} height={12} fill="url(#cbGold)" opacity={0.75} />

        {/* Wand: Zedernbretter */}
        {planks.map((pl, i) => (
          <g key={i}>
            <rect x={pl.x} y={CEIL} width={60} height={FLOOR - CEIL} fill="url(#cbPlankA)" opacity={0.75 + 0.25 * pl.tone} />
            <line x1={pl.x} y1={CEIL} x2={pl.x} y2={FLOOR} stroke="#200F06" strokeWidth={3} />
            <path d={`M ${pl.x + 18 + pl.grain * 20} ${CEIL + 80} q 8 160 -4 320 t 6 360`} stroke="#2E170A" strokeWidth={2} fill="none" opacity={0.5} />
          </g>
        ))}
        {/* Fries mit geschnitzten Blüten */}
        <rect x={0} y={CEIL + 18} width={WIDTH} height={64} fill="#3A2010" />
        <rect x={0} y={CEIL + 18} width={WIDTH} height={4} fill="#C9993F" opacity={0.7} />
        <rect x={0} y={CEIL + 78} width={WIDTH} height={4} fill="#C9993F" opacity={0.7} />
        {Array.from({ length: 13 }, (_, i) => (
          <Rosette key={i} x={i * 90 - 0} y={CEIL + 50} r={22} o={0.85} />
        ))}

        {/* Vorhang hinter dem Thron */}
        <g>
          <path d={`M 330 ${CEIL + 82} L 750 ${CEIL + 82} L 760 1040 Q 540 1070 320 1040 Z`} fill="url(#cbCurtain)" />
          {[0, 1, 2, 3, 4, 5, 6].map((k) => (
            <path key={k} d={`M ${360 + k * 60} ${CEIL + 90} Q ${350 + k * 62} 640 ${352 + k * 64} 1036`} stroke="#0A2624" strokeWidth={5} fill="none" opacity={0.5} />
          ))}
          <path d={`M 320 1040 Q 540 1070 760 1040`} stroke="url(#cbGold)" strokeWidth={10} fill="none" />
          {Array.from({ length: 22 }, (_, k) => (
            <line key={k} x1={330 + k * 20} y1={1044 + Math.sin((k / 21) * Math.PI) * 24} x2={330 + k * 20} y2={1064 + Math.sin((k / 21) * Math.PI) * 24} stroke="#E3B04F" strokeWidth={3} opacity={0.8} />
          ))}
          <rect x={310} y={CEIL + 82} width={460} height={26} fill="url(#cbGold)" opacity={0.9} />
        </g>

        {/* Bogenfenster */}
        {beams.map((b, i) => (
          <g key={i}>
            <path d={`M ${b.x0} 700 L ${b.x0} 440 Q ${(b.x0 + b.x1) / 2} 340 ${b.x1} 440 L ${b.x1} 700 Z`} fill="#2A1608" />
            <path d={`M ${b.x0 + 12} 690 L ${b.x0 + 12} 446 Q ${(b.x0 + b.x1) / 2} 356 ${b.x1 - 12} 446 L ${b.x1 - 12} 690 Z`} fill="url(#cbWindow)" opacity={(0.8 + 0.2 * warm) * breathe} />
            {/* Gitter */}
            {[0.33, 0.66].map((f) => (
              <line key={f} x1={b.x0 + (b.x1 - b.x0) * f} y1={380} x2={b.x0 + (b.x1 - b.x0) * f} y2={690} stroke="#4A2A12" strokeWidth={7} />
            ))}
            {[500, 590].map((y) => (
              <line key={y} x1={b.x0 + 12} y1={y} x2={b.x1 - 12} y2={y} stroke="#4A2A12" strokeWidth={7} />
            ))}
            <rect x={b.x0 - 14} y={700} width={b.x1 - b.x0 + 28} height={18} rx={4} fill="url(#cbGold)" opacity={0.8} />
          </g>
        ))}

        {/* Lampen zwischen Fenster und Säule */}
        {lamp(250, 0)}
        {lamp(830, 2.1)}

        <rect x={0} y={CEIL} width={WIDTH} height={FLOOR - CEIL} fill="url(#cbWallShade)" />

        {/* Boden: Stein, glänzend, mit Läufer */}
        <rect x={0} y={FLOOR} width={WIDTH} height={HEIGHT - FLOOR} fill="url(#cbFloor)" />
        {Array.from({ length: 7 }, (_, i) => (
          <line key={`h${i}`} x1={0} y1={FLOOR + 10 + i * i * 13} x2={WIDTH} y2={FLOOR + 10 + i * i * 13} stroke="#140C06" strokeWidth={3} opacity={0.6} />
        ))}
        {Array.from({ length: 15 }, (_, i) => {
          const x = (i - 7) * 80;
          return <line key={`v${i}`} x1={540 + x} y1={FLOOR} x2={540 + x * 3.4} y2={HEIGHT} stroke="#140C06" strokeWidth={3} opacity={0.5} />;
        })}
        <path d={`M 450 ${FLOOR} L 630 ${FLOOR} L 820 ${HEIGHT} L 260 ${HEIGHT} Z`} fill="url(#cbRunner)" opacity={0.85} />
        <path d={`M 450 ${FLOOR} L 260 ${HEIGHT}`} stroke="#D9A84A" strokeWidth={5} opacity={0.6} />
        <path d={`M 630 ${FLOOR} L 820 ${HEIGHT}`} stroke="#D9A84A" strokeWidth={5} opacity={0.6} />
        {/* Spiegelung der Fenster im Boden */}
        <ellipse cx={420} cy={FLOOR + 170} rx={220} ry={46} fill="#FFE7B5" opacity={0.08 + 0.06 * warm} />
        <ellipse cx={660} cy={FLOOR + 170} rx={220} ry={46} fill="#FFE7B5" opacity={0.08 + 0.06 * warm} />

        {/* Lichtstrahlen und Staub */}
        {beams.map((b, i) => (
          <path
            key={i}
            d={`M ${b.x0 + 12} 460 L ${b.x1 - 12} 460 L ${b.bx1} ${FLOOR + 120} L ${b.bx0} ${FLOOR + 120} Z`}
            fill="url(#cbBeam)"
            opacity={beamO}
            style={{ mixBlendMode: "screen" }}
          />
        ))}
        {dust.map((d, i) => {
          const b = beams[d.side];
          const v = (d.v + t * 0.01 * d.s) % 1;
          const y = 470 + v * (FLOOR - 470);
          const x0 = b.x0 + (b.bx0 - b.x0) * v;
          const x1 = b.x1 + (b.bx1 - b.x1) * v;
          const x = x0 + (x1 - x0) * d.u + Math.sin(t * 0.8 + d.ph) * 10;
          return <circle key={i} cx={x} cy={y} r={d.r} fill="#FFF1CC" opacity={(0.2 + 0.35 * Math.sin(t * 1.2 + d.ph) ** 2) * breathe} />;
        })}

        {/* Säulen aus Elfenbein */}
        {[18, 950].map((x, i) => (
          <g key={i}>
            <rect x={x} y={CEIL - 30} width={112} height={FLOOR - CEIL + 50} fill="url(#cbIvory)" />
            {[0.25, 0.5, 0.75].map((f) => (
              <line key={f} x1={x + 112 * f} y1={CEIL + 40} x2={x + 112 * f} y2={FLOOR - 10} stroke="#6E5E44" strokeWidth={3} opacity={0.45} />
            ))}
            {/* Kapitell wie eine Lotusblüte */}
            <path d={`M ${x - 22} ${CEIL + 40} Q ${x + 56} ${CEIL - 10} ${x + 134} ${CEIL + 40} L ${x + 112} ${CEIL + 70} L ${x} ${CEIL + 70} Z`} fill="url(#cbGold)" />
            <rect x={x - 16} y={CEIL - 52} width={144} height={30} rx={6} fill="url(#cbGold)" />
            <rect x={x - 16} y={FLOOR - 16} width={144} height={36} rx={6} fill="#8C6A2A" />
          </g>
        ))}
        <rect x={0} y={0} width={WIDTH} height={HEIGHT} fill="url(#cbWarm)" opacity={warm * 0.6} style={{ mixBlendMode: "screen" }} />
      </svg>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 90% 72% at 50% 46%, rgba(0,0,0,0) 52%, rgba(10,5,2,0.78) 100%)" }} />
    </AbsoluteFill>
  );
};
