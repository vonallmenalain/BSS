import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { HEIGHT, WIDTH } from "../../../lib/timing";

/*
 * Das Heiligtum in Schilo bei Nacht (1 Samuel 3): eine Halle aus Stein und Holz, in der Mitte
 * der gewebte Vorhang, hinter dem die Lade steht – ein schmaler Lichtsaum dringt unter ihm
 * hervor. Links Samuels Lager auf dem Boden, rechts die Tür zu Elis Kammer mit seinem Bett.
 * Oben ein hohes Fenster mit Sternen. Gegen Ende der Folge kommt der Morgen (3:15): Das
 * Fenster wird hell, die Halle wärmer. Leuchter, Figuren und Licht zeichnet die Szene davor.
 */

/** Boden der Halle – dieselbe Linie wie in der Szene */
export const LAMP_FLOOR = 1150;
/** Der Vorhang (x von … bis) und seine Oberkante */
export const VEIL = { x0: 300, x1: 740, top: 430 };
/** Elis Kammer: Türöffnung und Bett */
export const ELI_ROOM = { x0: 770, x1: 1080, top: 640, bedX0: 790, bedX1: 1050, bedTop: 1078 };
/** Samuels Matte */
export const MAT = { x0: 96, x1: 396 };

const hex = (s: string) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
export const mixHex = (a: string, b: string, k: number) => {
  const pa = hex(a);
  const pb = hex(b);
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * Math.max(0, Math.min(1, k)))).join(",")})`;
};

/** Wie weit der Morgen ist (0 = Nacht, 1 = Tag) – aus dem Fortschritt der Folge */
export const lampDawn = (p: number) => interpolate(p, [0.76, 0.93], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

export const LampBg: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = frame / Math.max(1, durationInFrames);
  const dawn = lampDawn(p);
  const m = (night: string, day: string) => mixHex(night, day, dawn);

  const blocks = useMemo(
    () =>
      Array.from({ length: 13 }, (_, r) =>
        Array.from({ length: 7 }, (_, c) => ({
          x: c * 170 - (r % 2) * 85 - 20,
          y: 250 + r * 70,
          v: random(`lb${r}-${c}`),
        })),
      ).flat(),
    [],
  );
  const stars = useMemo(() => Array.from({ length: 22 }, (_, i) => ({ x: 452 + random(`ls${i}`) * 176, y: 262 + random(`lsy${i}`) * 108, r: 1.2 + random(`lsr${i}`) * 2, ph: random(`lsp${i}`) * 6.28 })), []);
  const eliStars = useMemo(() => Array.from({ length: 7 }, (_, i) => ({ x: 948 + random(`le${i}`) * 66, y: 730 + random(`ley${i}`) * 66, ph: random(`lep${i}`) * 6.28 })), []);

  const sway = (i: number) => Math.sin(frame / 42 + i * 0.9) * 5;
  const folds = 11;
  const veilW = VEIL.x1 - VEIL.x0;

  return (
    <AbsoluteFill style={{ background: m("#0B0C1C", "#2A2430") }}>
      <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <linearGradient id="lbWall" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={m("#0C0E22", "#3A3140")} />
            <stop offset="55%" stopColor={m("#18172C", "#5A4844")} />
            <stop offset="100%" stopColor={m("#100F1E", "#3E3134")} />
          </linearGradient>
          <linearGradient id="lbWindow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={m("#0A1236", "#7FA4D8")} />
            <stop offset="100%" stopColor={m("#1A2150", "#FFC79A")} />
          </linearGradient>
          <linearGradient id="lbFloor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={m("#17142A", "#4A3A36")} />
            <stop offset="100%" stopColor={m("#07070F", "#1E1718")} />
          </linearGradient>
          <linearGradient id="lbVeil" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#1B2366" />
            <stop offset="35%" stopColor="#3A1E5C" />
            <stop offset="65%" stopColor="#5A1A36" />
            <stop offset="100%" stopColor="#1B2366" />
          </linearGradient>
          <linearGradient id="lbRoom" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={m("#05060F", "#2A2026")} />
            <stop offset="100%" stopColor={m("#0B0C1C", "#3A2C2E")} />
          </linearGradient>
          <radialGradient id="lbSeam" cx="0.5" cy="1" r="0.6">
            <stop offset="0%" stopColor="#FFE6A8" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#FFE6A8" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Wand aus Steinquadern */}
        <rect x={0} y={0} width={WIDTH} height={LAMP_FLOOR} fill="url(#lbWall)" />
        {blocks.map((b, i) => (
          <rect key={i} x={b.x} y={b.y} width={166} height={66} rx={4} fill={b.v > 0.6 ? "#FFFFFF" : "#000000"} opacity={0.025 + 0.03 * Math.abs(b.v - 0.6)} stroke="#05050C" strokeOpacity={0.55} strokeWidth={3} />
        ))}

        {/* Hohes Fenster mit Sternen */}
        <path d="M 440 380 L 440 300 Q 540 228 640 300 L 640 380 Z" fill="url(#lbWindow)" stroke="#06060E" strokeWidth={10} />
        {stars.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#F2F0FF" opacity={(0.45 + 0.45 * Math.sin(frame / 14 + s.ph)) * (1 - dawn)} />
        ))}
        <line x1={540} y1={262} x2={540} y2={380} stroke="#06060E" strokeWidth={8} />

        {/* Balken unter der Decke */}
        <rect x={0} y={200} width={WIDTH} height={30} fill={m("#120C0A", "#3A2618")} />
        {Array.from({ length: 9 }, (_, i) => (
          <rect key={i} x={i * 130 + 10} y={196} width={34} height={44} rx={4} fill={m("#1C120C", "#4A3020")} />
        ))}

        {/* Linke Säule */}
        <rect x={20} y={230} width={58} height={LAMP_FLOOR - 230} fill={m("#1A120E", "#4A3424")} />
        <rect x={20} y={230} width={10} height={LAMP_FLOOR - 230} fill="#FFFFFF" opacity={0.04} />
        <rect x={8} y={LAMP_FLOOR - 40} width={82} height={40} rx={4} fill={m("#4A3416", "#9A7034")} />

        {/* Der Vorhang vor der Lade: gewebt aus Blau, Purpur und Karmesin, mit Goldborte */}
        <rect x={VEIL.x0 - 16} y={VEIL.top - 22} width={veilW + 32} height={14} rx={7} fill="#7A5420" />
        {Array.from({ length: folds }, (_, i) => {
          const fx0 = VEIL.x0 + (i / folds) * veilW;
          const fx1 = VEIL.x0 + ((i + 1) / folds) * veilW;
          const s0 = i === 0 ? 0 : sway(i);
          const s1 = i === folds - 1 ? 0 : sway(i + 1);
          return (
            <g key={i}>
              <path d={`M ${fx0} ${VEIL.top} L ${fx1} ${VEIL.top} L ${fx1 + s1} ${LAMP_FLOOR - 6} L ${fx0 + s0} ${LAMP_FLOOR - 6} Z`} fill="url(#lbVeil)" />
              <path d={`M ${fx0} ${VEIL.top} L ${(fx0 + fx1) / 2} ${VEIL.top} L ${(fx0 + fx1) / 2 + (s0 + s1) / 2} ${LAMP_FLOOR - 6} L ${fx0 + s0} ${LAMP_FLOOR - 6} Z`} fill="#000" opacity={0.22} />
            </g>
          );
        })}
        {/* Borte oben und unten, darin ein Rautenmuster */}
        {[VEIL.top + 24, LAMP_FLOOR - 70].map((by, r) => (
          <g key={r}>
            <rect x={VEIL.x0} y={by - 16} width={veilW} height={32} fill="#2A1238" opacity={0.85} />
            {Array.from({ length: 14 }, (_, i) => (
              <path key={i} d={`M ${VEIL.x0 + 16 + i * 31} ${by} l 12 -10 l 12 10 l -12 10 Z`} fill="#D9A84A" opacity={0.7} />
            ))}
          </g>
        ))}
        {/* Flügel-Stickerei: angedeutete Cherubim */}
        {[0.3, 0.7].map((fx, i) => (
          <g key={i} transform={`translate(${VEIL.x0 + veilW * fx} 760)`} opacity={0.32}>
            <path d="M 0 0 C -40 -60, -110 -70, -150 -40 C -110 -40, -70 -20, -40 10 Z" fill="none" stroke="#E9C060" strokeWidth={4} />
            <path d="M 0 0 C 40 -60, 110 -70, 150 -40 C 110 -40, 70 -20, 40 10 Z" fill="none" stroke="#E9C060" strokeWidth={4} />
            <path d="M -30 -30 C -60 -70, -100 -90, -130 -84 M 30 -30 C 60 -70, 100 -90, 130 -84" fill="none" stroke="#E9C060" strokeWidth={3} />
          </g>
        ))}
        {/* Lichtsaum unter dem Vorhang */}
        <rect x={VEIL.x0} y={LAMP_FLOOR - 70} width={veilW} height={90} fill="url(#lbSeam)" opacity={0.6} />
        <rect x={VEIL.x0 + 6} y={LAMP_FLOOR - 7} width={veilW - 12} height={5} fill="#FFE6A8" opacity={0.55} />

        {/* Türpfosten und Elis Kammer */}
        <rect x={ELI_ROOM.x0} y={ELI_ROOM.top} width={WIDTH - ELI_ROOM.x0} height={LAMP_FLOOR - ELI_ROOM.top} fill="url(#lbRoom)" />
        <path d={`M ${ELI_ROOM.x0 - 26} ${LAMP_FLOOR} L ${ELI_ROOM.x0 - 26} ${ELI_ROOM.top - 10} L ${WIDTH} ${ELI_ROOM.top - 10} L ${WIDTH} ${ELI_ROOM.top + 16} L ${ELI_ROOM.x0} ${ELI_ROOM.top + 16} L ${ELI_ROOM.x0} ${LAMP_FLOOR} Z`} fill={m("#24160E", "#5A3E26")} />
        {/* kleines Fenster in der Kammer */}
        <rect x={940} y={722} width={84} height={84} rx={6} fill={m("#0E1640", "#F0B48A")} stroke="#05050C" strokeWidth={8} />
        {eliStars.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={1.6} fill="#F2F0FF" opacity={(0.4 + 0.4 * Math.sin(frame / 11 + s.ph)) * (1 - dawn)} />
        ))}
        <circle cx={1000} cy={748} r={13} fill="#F4F0DC" opacity={0.85 * (1 - dawn)} />
        <circle cx={1006} cy={744} r={11} fill={m("#0E1640", "#F0B48A")} opacity={0.9 * (1 - dawn)} />
        {/* Elis Bett */}
        <rect x={ELI_ROOM.bedX0} y={ELI_ROOM.bedTop} width={ELI_ROOM.bedX1 - ELI_ROOM.bedX0} height={22} rx={6} fill={m("#3A2416", "#6A4628")} />
        <rect x={ELI_ROOM.bedX0 + 6} y={ELI_ROOM.bedTop - 8} width={ELI_ROOM.bedX1 - ELI_ROOM.bedX0 - 12} height={12} rx={6} fill={m("#2A2A3E", "#6A6070")} />
        <rect x={ELI_ROOM.bedX1 - 70} y={ELI_ROOM.bedTop - 26} width={56} height={24} rx={10} fill={m("#3A3650", "#7A6E80")} />
        {[ELI_ROOM.bedX0 + 12, ELI_ROOM.bedX1 - 28].map((lx) => (
          <rect key={lx} x={lx} y={ELI_ROOM.bedTop + 20} width={16} height={LAMP_FLOOR - ELI_ROOM.bedTop - 20} fill={m("#24160E", "#4A3020")} />
        ))}

        {/* Boden aus Steinplatten, perspektivisch */}
        <rect x={0} y={LAMP_FLOOR} width={WIDTH} height={HEIGHT - LAMP_FLOOR} fill="url(#lbFloor)" />
        {Array.from({ length: 9 }, (_, i) => {
          const y = LAMP_FLOOR + 14 * (i + 1) ** 1.6;
          return <line key={i} x1={0} y1={y} x2={WIDTH} y2={y} stroke="#000" strokeWidth={3} opacity={0.35} />;
        })}
        {Array.from({ length: 15 }, (_, i) => {
          const x = -380 + i * 130;
          return <line key={i} x1={540 + (x - 540) * 0.35} y1={LAMP_FLOOR} x2={x} y2={HEIGHT} stroke="#000" strokeWidth={3} opacity={0.3} />;
        })}

        {/* Samuels Matte mit Kissen und Krug */}
        <rect x={MAT.x0} y={LAMP_FLOOR - 12} width={MAT.x1 - MAT.x0} height={16} rx={6} fill={m("#4A3018", "#8A6232")} />
        {Array.from({ length: 12 }, (_, i) => (
          <line key={i} x1={MAT.x0 + 12 + i * 24} y1={LAMP_FLOOR - 10} x2={MAT.x0 + 12 + i * 24} y2={LAMP_FLOOR + 2} stroke="#000" strokeWidth={2} opacity={0.25} />
        ))}
        <ellipse cx={MAT.x0 + 26} cy={LAMP_FLOOR - 18} rx={30} ry={12} fill={m("#5A4A3A", "#A08A6A")} />
        <g transform={`translate(${MAT.x0 - 34} ${LAMP_FLOOR})`}>
          <path d="M -16 0 C -22 -26, -18 -44, -8 -52 L -8 -62 L 8 -62 L 8 -52 C 18 -44, 22 -26, 16 0 Z" fill={m("#5A2E1A", "#A0583A")} />
          <rect x={-10} y={-66} width={20} height={6} rx={3} fill={m("#3A1E10", "#7A4026")} />
        </g>

        {/* Morgenlicht: ein warmer Schleier über allem */}
        {dawn > 0 ? <rect x={0} y={0} width={WIDTH} height={HEIGHT} fill="#FFB27A" opacity={0.1 * dawn} /> : null}
      </svg>
    </AbsoluteFill>
  );
};
