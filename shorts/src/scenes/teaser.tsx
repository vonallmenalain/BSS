import React from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame } from "remotion";
import { useLook } from "../looks";
import { Sfx } from "../lib/sfx";
import { FPS, type TimelineScene } from "../lib/timing";
import type { Scene } from "../schema";
import { theme } from "../theme";

/*
 * Vorschau auf die nächste Karte: Das Video endet nicht einfach, es zeigt, was gleich kommt –
 * eine Umfrage, ein Quiz, eine Aufgabe – und lädt mit einer Wisch-Geste dorthin ein.
 */

type TeaserScene = Extract<Scene, { type: "teaser" }>;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const TeaserScene: React.FC<{ ts: TimelineScene }> = ({ ts }) => {
  const s = ts.scene as TeaserScene;
  const frame = useCurrentFrame();
  const look = useLook();
  const inAt = 4;
  const card = spring({ frame: frame - inAt, fps: FPS, config: { damping: 15, stiffness: 120 } });
  const textLen = s.question.length + s.options.join("").length;
  const qSize = textLen > 150 ? 46 : textLen > 100 ? 50 : 56;
  const oSize = textLen > 150 ? 32 : 36;

  // Wisch-Geste: Punkt gleitet nach oben, wiederholt sich
  const gestureStart = Math.round(1.2 * FPS);
  const cycle = 42;
  const g = Math.max(0, frame - gestureStart) % cycle;
  const gp = interpolate(g, [0, 26], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const go = frame < gestureStart ? 0 : interpolate(g, [0, 4, 24, 34], [0, 1, 1, 0], clamp);
  const gy = 1700 - gp * 170;

  return (
    <AbsoluteFill>
      <Sfx frame={inAt} name="whoosh" volume={0.4} />
      <div
        style={{
          position: "absolute",
          left: 104,
          right: 104,
          top: 300,
          padding: "46px 48px 50px",
          borderRadius: 42,
          border: `3px solid ${look.accent}`,
          background: "rgba(10,14,30,0.92)",
          boxShadow: `0 30px 90px rgba(0,0,0,0.5), 0 0 40px ${look.accent}33`,
          opacity: card,
          transform: `translateY(${interpolate(card, [0, 1], [700, 0])}px) rotate(${interpolate(card, [0, 1], [-4, 0])}deg)`,
        }}
      >
        <div
          style={{
            display: "inline-block",
            padding: "12px 22px",
            borderRadius: 999,
            background: look.accent,
            color: "#0B0F1E",
            fontFamily: theme.font.body,
            fontWeight: 800,
            fontSize: 26,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
        >
          {s.label}
        </div>
        <div style={{ marginTop: 28, fontFamily: theme.font.body, fontWeight: 800, fontSize: qSize, lineHeight: 1.18, color: "#FFFFFF" }}>{s.question}</div>
        {s.options.length ? (
          <div style={{ marginTop: 34, display: "flex", flexDirection: "column", gap: 16 }}>
            {s.options.map((o, i) => {
              const at = inAt + 10 + i * 5;
              const sp = spring({ frame: frame - at, fps: FPS, config: { damping: 14, stiffness: 200 } });
              return (
                <React.Fragment key={i}>
                  <Sfx frame={at} name="tick" volume={0.35} />
                  <div
                    style={{
                      padding: "20px 28px",
                      borderRadius: 999,
                      border: "2px solid rgba(255,255,255,0.22)",
                      background: "rgba(255,255,255,0.05)",
                      fontFamily: theme.font.body,
                      fontWeight: 700,
                      fontSize: oSize,
                      lineHeight: 1.2,
                      color: "#FFFFFF",
                      opacity: sp,
                      transform: `translateX(${interpolate(sp, [0, 1], [60, 0])}px)`,
                    }}
                  >
                    {o}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        ) : null}
        {s.scale ? <ScaleDemo scale={s.scale} frame={frame} /> : null}
      </div>

      {/* Wisch weiter */}
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        {[0, 1, 2].map((k) => {
          const o = 0.25 + 0.75 * Math.max(0, Math.sin(frame / 6 - k * 0.9));
          const y = 1500 - k * 34;
          return <path key={k} d={`M ${540 - 34} ${y} L 540 ${y - 26} L ${540 + 34} ${y}`} stroke={look.accent} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={o * card} />;
        })}
        <line x1={540} y1={1700} x2={540} y2={gy} stroke="#FFFFFF" strokeOpacity={0.35 * go} strokeWidth={14} strokeLinecap="round" />
        <circle cx={540} cy={gy} r={30} fill="#FFFFFF" opacity={0.9 * go} />
        <circle cx={540} cy={gy} r={30 + 18 * gp} fill="none" stroke="#FFFFFF" strokeWidth={4} opacity={0.5 * go * (1 - gp)} />
      </svg>
      <div
        style={{
          position: "absolute",
          top: 1745,
          width: "100%",
          textAlign: "center",
          fontFamily: theme.font.body,
          fontWeight: 800,
          fontSize: 38,
          letterSpacing: "0.06em",
          color: look.accent,
          opacity: card,
          textShadow: "0 0 12px rgba(0,0,0,0.9), 0 2px 4px rgba(0,0,0,0.9)",
        }}
      >
        {s.hint}
      </div>
    </AbsoluteFill>
  );
};

/** Skala wie in der Umfrage-Karte: der Regler wandert hin und her */
const ScaleDemo: React.FC<{ scale: NonNullable<TeaserScene["scale"]>; frame: number }> = ({ scale, frame }) => {
  const look = useLook();
  const steps = scale.max - scale.min;
  const p = 0.5 + 0.42 * Math.sin(frame / 22);
  const W = 760;
  return (
    <div style={{ marginTop: 44 }}>
      <div style={{ position: "relative", height: 70 }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 30, height: 10, borderRadius: 5, background: "rgba(255,255,255,0.15)" }} />
        <div style={{ position: "absolute", left: 0, width: p * W, top: 30, height: 10, borderRadius: 5, background: look.accent }} />
        {Array.from({ length: steps + 1 }, (_, i) => (
          <div key={i} style={{ position: "absolute", left: (i / steps) * W - 3, top: 26, width: 6, height: 18, borderRadius: 3, background: "rgba(255,255,255,0.35)" }} />
        ))}
        <div style={{ position: "absolute", left: p * W - 30, top: 5, width: 60, height: 60, borderRadius: 30, background: "#FFFFFF", boxShadow: `0 0 20px ${look.accent}` }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, fontFamily: theme.font.body, fontWeight: 700, fontSize: 30, color: "rgba(255,255,255,0.7)" }}>
        <span>{scale.minLabel}</span>
        <span style={{ color: look.accent, fontWeight: 800, fontSize: 40 }}>{Math.round(scale.min + p * steps)}</span>
        <span>{scale.maxLabel}</span>
      </div>
    </div>
  );
};
