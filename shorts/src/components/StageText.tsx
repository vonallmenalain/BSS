import React, { useMemo } from "react";
import { interpolate, spring, useCurrentFrame } from "remotion";
import { FPS, type Word } from "../lib/timing";
import { useLook } from "../looks";
import { theme } from "../theme";
import { buildChunks } from "./Captions";

/**
 * Grosse, mittige Textblöcke mit Wort-Highlighting – für Sätze, die im Bild die Hauptrolle spielen
 * (statt kleiner Untertitel unten). Zeigt nur die Wörter aus `include`.
 */
export const StageText: React.FC<{
  words: Word[];
  include: Set<number>;
  audioOffsetFrames: number;
  /** Ab dieser Zeit (s, Stimme) ausblenden – z.B. wenn danach ein Zitat erscheint */
  exitAt?: number;
  y?: number;
  fontSize?: number;
}> = ({ words, include, audioOffsetFrames, exitAt, y = 700, fontSize = 84 }) => {
  const frame = useCurrentFrame();
  const look = useLook();
  const t = (frame - audioOffsetFrames) / FPS;
  const hidden = useMemo(() => new Set(words.filter((w) => !include.has(w.index)).map((w) => w.index)), [words, include]);
  const chunks = useMemo(() => buildChunks(words, hidden).map((c) => c), [words, hidden]);

  // Für die Bühne: Blöcke bis zum nächsten Satzende zusammenfassen (ruhiger als 4-Wort-Häppchen)
  const sentences = useMemo(() => {
    const out: typeof chunks = [];
    let acc: (typeof chunks)[number] | null = null;
    for (const c of chunks) {
      acc = acc ? { words: [...acc.words, ...c.words], start: acc.start, end: c.end } : c;
      const last = acc.words[acc.words.length - 1];
      if (/[.!?;:]$/.test(last.text) || acc.words.length >= 8) {
        out.push(acc);
        acc = null;
      }
    }
    if (acc) out.push(acc);
    return out;
  }, [chunks]);

  const idx = sentences.findIndex((c, i) => {
    const next = sentences[i + 1];
    return t >= c.start - 0.12 && t < (next ? next.start - 0.12 : Infinity);
  });
  if (idx < 0) return null;
  const s = sentences[idx];
  const enter = spring({
    frame: frame - (audioOffsetFrames + Math.round((s.start - 0.12) * FPS)),
    fps: FPS,
    config: { damping: 20, stiffness: 160 },
  });
  const exit = exitAt === undefined ? 1 : interpolate(t, [exitAt - 0.35, exitAt], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div
      style={{
        position: "absolute",
        left: theme.layout.side,
        right: theme.layout.side,
        top: y - 260,
        height: 520,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        opacity: enter * exit,
        transform: `translateY(${interpolate(enter, [0, 1], [26, 0])}px)`,
      }}
    >
      <div style={{ fontFamily: theme.font.body, fontWeight: 800, fontSize, lineHeight: 1.14, letterSpacing: "-0.015em" }}>
        {s.words.map((w, i) => {
          const spoken = t >= w.start;
          const active = t >= w.start && t < w.end;
          return (
            <span
              key={w.index}
              style={{
                color: active ? look.accent : spoken ? look.text : "rgba(255,246,230,0.28)",
                textShadow: "0 6px 30px rgba(0,0,0,0.55)",
              }}
            >
              {w.text}
              {i < s.words.length - 1 ? " " : ""}
            </span>
          );
        })}
      </div>
    </div>
  );
};
