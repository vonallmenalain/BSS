import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, random, spring, useCurrentFrame } from "remotion";
import { mix } from "../../lib/color";
import { Sfx, beat, voiceFrame } from "../../lib/sfx";
import { FPS, type TimelineScene } from "../../lib/timing";
import type { Scene } from "../../schema";
import { theme } from "../../theme";

/*
 * Dominosteine: eine Tat stösst die nächste an – Abinadi, Alma, die Wasser Mormon … bis zu
 * Helamans 2000 jungen Kriegern (Mosia 17–18, Alma 53). Die ganze Reihe steht in jeder Szene,
 * die Kamera folgt dem Stein, der gerade fällt; der Himmel dahinter wird von Szene zu Szene heller.
 *
 * Ein Stein kippt um seine rechte untere Kante und lehnt sich an den nächsten. Liegt der nächste
 * schon schräg, lehnt sich der vorige mit – der Winkel folgt aus der Berührung (siehe `restAngle`).
 */

type DominoesSceneT = Extract<Scene, { type: "dominoes" }>;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/* Masse eines Steins und der Reihe (Weltkoordinaten in px) */
const W = 150;
const H = 400;
const GAP = 170;
const PITCH = W + GAP;
const GROUND = 1120;
/** So lange kippt ein Stein, bis er anschlägt */
const FALL_SEC = 0.5;
const deg = (r: number) => (r * 180) / Math.PI;

/**
 * Winkel (Bogenmass, im Uhrzeigersinn), in dem ein gefallener Stein ruht: Seine obere rechte Ecke
 * liegt an der linken Fläche des nächsten Steins, der selbst um `next` geneigt ist.
 * Herleitung: h · sin(θ − φ) = p · cos φ − w. Ohne nächsten Stein liegt er flach.
 */
const restAngle = (next: number | null) => {
  if (next === null) return Math.PI / 2;
  const k = (PITCH * Math.cos(next) - W) / H;
  return next + Math.asin(Math.max(-1, Math.min(1, k)));
};

/** Umriss des Plateaus: flache Oberkante, darunter eine zerklüftete Felswand (Weltkoordinaten). */
const cliff = (n: number) => {
  const x0 = -900;
  const x1 = PITCH * (n + 4);
  const pts: string[] = [];
  for (let x = x1; x >= x0; x -= 60) {
    const k = random(`cl${x}`);
    pts.push(`L ${x} ${GROUND + 95 + k * 70 + Math.sin(x / 210) * 18}`);
  }
  return `M ${x0} ${GROUND} L ${x1} ${GROUND} ${pts.join(" ")} Z`;
};

const Tile: React.FC<{ x: number; angle: number; label: string; sub?: string; glow: number; lit: number }> = ({ x, angle, label, sub, glow, lit }) => {
  // Drehpunkt: rechte untere Kante
  const px = x + W;
  const fs = Math.min(104, (H - 70) / (0.47 * Math.max(3, label.length)));
  return (
    <g transform={`rotate(${deg(angle)} ${px} ${GROUND})`}>
      {glow > 0.01 ? <rect x={x - 26} y={GROUND - H - 26} width={W + 52} height={H + 52} rx={40} fill="url(#domGlow)" opacity={glow} /> : null}
      {/* Schatten-Kante (Tiefe) */}
      <rect x={x + 10} y={GROUND - H + 6} width={W} height={H - 6} rx={16} fill="#6B4A1E" opacity={0.55} />
      <rect x={x} y={GROUND - H} width={W} height={H} rx={16} fill="url(#domFace)" stroke={mix("#C98B2E", "#FFD27A", lit)} strokeWidth={5} />
      {/* Mittellinie und Augen wie bei einem Domino */}
      <line x1={x + 18} y1={GROUND - H / 2} x2={x + W - 18} y2={GROUND - H / 2} stroke="#C98B2E" strokeWidth={3} opacity={0.5} />
      {[0.12, 0.88].map((k, i) => (
        <circle key={i} cx={x + W / 2} cy={GROUND - H + H * k} r={9} fill="#B97E2A" opacity={0.55} />
      ))}
      {/* Beschriftung hochkant – beim Liegen wird sie waagrecht und lesbar */}
      <g transform={`rotate(-90 ${x + W / 2 - (sub ? 14 : 0)} ${GROUND - H / 2})`}>
        <text
          x={x + W / 2 - (sub ? 14 : 0)}
          y={GROUND - H / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily={theme.font.display}
          fontSize={fs}
          fill="#3A2408"
          letterSpacing={1}
        >
          {label.toUpperCase()}
        </text>
      </g>
      {sub ? (
        <g transform={`rotate(-90 ${x + W / 2 + 46} ${GROUND - H / 2})`}>
          <text
            x={x + W / 2 + 46}
            y={GROUND - H / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily={theme.font.body}
            fontWeight={700}
            fontSize={24}
            fill="#7A5524"
            letterSpacing={2}
          >
            {sub.toUpperCase()}
          </text>
        </g>
      ) : null}
    </g>
  );
};

export const DominoesScene: React.FC<{ ts: TimelineScene }> = ({ ts }) => {
  const s = ts.scene as DominoesSceneT;
  const frame = useCurrentFrame();
  const t = (frame - ts.audioOffsetFrames) / FPS;
  const n = s.pieces.length;

  // Wann jeder Stein kippt (Sekunden ab Stimmeinsatz); schon gefallene: lange vorher
  const fallAt = s.pieces.map((p, i) => (i < s.fallen ? -100 : p.at ? beat(ts, p.at, Infinity) : Infinity));
  // Fortschritt des Kippens 0 … 1 (beschleunigend wie ein echter Stein)
  const prog = fallAt.map((at) => (Number.isFinite(at) ? interpolate(t, [at, at + FALL_SEC], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) }) : 0));

  // Winkel von hinten nach vorn: Jeder Stein lehnt am nächsten, sobald er angeschlagen hat
  const angles = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    const rest = restAngle(i < n - 1 ? angles[i + 1] : null);
    angles[i] = prog[i] * rest;
  }
  // Der angestossene Stein wackelt kurz
  for (let i = 1; i < n; i++) {
    const hit = fallAt[i - 1] + FALL_SEC;
    const dt = t - hit;
    if (prog[i] === 0 && dt > 0 && dt < 0.8) angles[i] += Math.sin(dt * 28) * 0.035 * Math.exp(-dt * 5);
  }

  // Kamera: zielt auf den nächsten Stein, der noch steht – weich nachgeführt
  const focusAt = (time: number) => {
    let f = s.fallen;
    for (let i = 0; i < n; i++) if (fallAt[i] + FALL_SEC * 0.6 <= time) f = Math.min(n - 1, i + 1);
    return f;
  };
  // Mittelwert über ein kurzes Fenster statt Sprung
  const samples = 12;
  let focus = 0;
  for (let k = 0; k < samples; k++) focus += focusAt(t - (k / samples) * 0.9);
  focus /= samples;
  const camX = focus * PITCH - 540 + W / 2 + 70;

  // Grosse Beschriftung: der zuletzt genannte Stein
  let current = -1;
  for (let i = 0; i < n; i++) if (fallAt[i] <= t + 0.05) current = i;
  const currentAt = current >= 0 ? fallAt[current] : 0;
  const pop = current >= 0 && currentAt > -50 ? spring({ frame: frame - voiceFrame(ts, currentAt), fps: FPS, config: { damping: 12, stiffness: 170 } }) : current >= 0 ? 1 : 0;
  const big = current >= 0 ? s.pieces[current] : null;
  const last = current === n - 1;

  // Funken beim Anschlagen
  const sparks = useMemo(
    () => Array.from({ length: 16 }, (_, k) => ({ a: -Math.PI / 2 + (random(`da${k}`) - 0.5) * 2.4, v: 160 + random(`dv${k}`) * 320, r: 3 + random(`dr${k}`) * 5 })),
    [],
  );
  const lit = interpolate(s.sky, [0.2, 0.9], [0.2, 1], clamp);
  const breathe = 0.5 + 0.5 * Math.sin(frame / 14);

  return (
    <AbsoluteFill>
      {/* Grosse Zeile über der Reihe */}
      {big ? (
        <div style={{ position: "absolute", top: 300, left: 40, right: 40, textAlign: "center", opacity: Math.min(1, pop * 1.3), transform: `scale(${interpolate(pop, [0, 1], [0.6, 1])})` }}>
          <div
            style={{
              fontFamily: theme.font.display,
              fontSize: big.label.length > 6 ? 170 : 220,
              lineHeight: 1,
              textTransform: "uppercase",
              background: `linear-gradient(180deg, #FFF3D0 0%, ${theme.gold} 50%, ${theme.goldDeep} 100%)`,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              filter: `drop-shadow(0 8px ${last ? 60 : 36}px rgba(246,200,106,${last ? 0.7 : 0.4}))`,
            }}
          >
            {big.label}
          </div>
          {big.sub ? (
            <div style={{ marginTop: 14, fontFamily: theme.font.body, fontWeight: 800, fontSize: 40, letterSpacing: "0.3em", textTransform: "uppercase", color: theme.ivory, opacity: 0.85 }}>
              {big.sub}
            </div>
          ) : null}
        </div>
      ) : null}

      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <linearGradient id="domFace" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FFFDF6" />
            <stop offset="60%" stopColor="#FFF1D6" />
            <stop offset="100%" stopColor="#F2DDB4" />
          </linearGradient>
          <radialGradient id="domGlow">
            <stop offset="0%" stopColor="#FFD27A" stopOpacity="0.85" />
            <stop offset="70%" stopColor="#FFB04A" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#FFB04A" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="domCliff" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={mix("#2A1E2E", "#5A3A36", lit)} />
            <stop offset="18%" stopColor="#140E18" />
            <stop offset="100%" stopColor="#07050A" />
          </linearGradient>
          <linearGradient id="domRim" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#FFC877" stopOpacity="0" />
            <stop offset="50%" stopColor="#FFC877" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#FFC877" stopOpacity="0" />
          </linearGradient>
        </defs>

        <g transform={`translate(${-camX} 0)`}>
          {/* Ein Felsplateau über dem Tal: oben die Kante im Morgenlicht, vorn die Felswand – darunter bleibt der Blick ins Tal frei */}
          <path d={cliff(n)} fill="url(#domCliff)" />
          <path d={cliff(n)} fill="none" stroke="#000" strokeOpacity={0.35} strokeWidth={3} />
          <rect x={-900} y={GROUND - 2} width={PITCH * (n + 4) + 900} height={5} fill="url(#domRim)" opacity={0.25 + 0.6 * lit} />
          {s.pieces.map((p, i) => {
            const hitAt = fallAt[i] + FALL_SEC;
            const glow = prog[i] >= 1 ? (fallAt[i] < -50 ? 0.45 + 0.25 * breathe : interpolate(t, [hitAt, hitAt + 0.5], [0, 0.45 + 0.25 * breathe], clamp)) : 0;
            return <Tile key={i} x={i * PITCH} angle={angles[i]} label={p.label} sub={p.sub} glow={glow} lit={lit} />;
          })}

          {/* Funken an der Stelle, wo ein Stein anschlägt */}
          {s.pieces.map((_, i) => {
            const hitAt = fallAt[i] + FALL_SEC;
            const dt = t - hitAt;
            if (!Number.isFinite(dt) || fallAt[i] < -50 || dt < 0 || dt > 1) return null;
            const lastOne = i === n - 1;
            const cx = lastOne ? i * PITCH + W + H * 0.5 : i * PITCH + W + Math.sin(angles[i]) * H;
            const cy = lastOne ? GROUND - 8 : GROUND - Math.cos(angles[i]) * H;
            const scale = lastOne ? 1.8 : 1;
            return (
              <g key={i}>
                <circle cx={cx} cy={cy} r={(30 + 140 * dt) * scale} fill="#FFD27A" opacity={0.35 * (1 - dt)} />
                {sparks.map((sp, k) => (
                  <circle
                    key={k}
                    cx={cx + Math.cos(sp.a) * sp.v * dt * scale}
                    cy={cy + Math.sin(sp.a) * sp.v * dt * scale + 260 * dt * dt}
                    r={sp.r}
                    fill={k % 3 ? "#FFD27A" : "#FFF3D0"}
                    opacity={1 - dt}
                  />
                ))}
              </g>
            );
          })}
        </g>
      </svg>

      {s.pieces.map((p, i) => {
        if (fallAt[i] < -50 || !Number.isFinite(fallAt[i])) return null;
        const lastOne = i === n - 1;
        return (
          <React.Fragment key={i}>
            <Sfx frame={voiceFrame(ts, fallAt[i])} name="whoosh" volume={0.18} />
            <Sfx frame={voiceFrame(ts, fallAt[i] + FALL_SEC)} name="drum" volume={lastOne ? 0.55 : 0.4} />
            <Sfx frame={voiceFrame(ts, fallAt[i] + FALL_SEC)} name="tick" volume={0.3} />
            {lastOne ? <Sfx frame={voiceFrame(ts, fallAt[i] + FALL_SEC) + 3} name="chime" volume={0.35} /> : null}
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};
