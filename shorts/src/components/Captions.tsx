import React, { useMemo } from "react";
import { interpolate, spring, useCurrentFrame } from "remotion";
import { FPS, type Word } from "../lib/timing";
import { useLook } from "../looks";
import { theme } from "../theme";

type Chunk = { words: Word[]; start: number; end: number };

/**
 * Gruppiert sichtbare Wörter zu kurzen Untertitel-Blöcken (max. 4 Wörter,
 * Bruch nach Satzzeichen und an ausgeblendeten Stellen).
 */
export const buildChunks = (words: Word[], hidden: Set<number>): Chunk[] => {
  const chunks: Chunk[] = [];
  let cur: Word[] = [];
  const flush = () => {
    if (cur.length) chunks.push({ words: cur, start: cur[0].start, end: cur[cur.length - 1].end });
    cur = [];
  };
  words.forEach((w) => {
    if (hidden.has(w.index)) {
      flush();
      return;
    }
    cur.push(w);
    const strong = /[.!?;:]$/.test(w.text);
    const comma = /,$/.test(w.text);
    if (strong || cur.length >= 4 || (comma && cur.length >= 2)) flush();
  });
  flush();
  return chunks;
};

export const Captions: React.FC<{
  words: Word[];
  hidden: Set<number>;
  /** Frame, an dem die Stimme in der Szene startet */
  audioOffsetFrames: number;
}> = ({ words, hidden, audioOffsetFrames }) => {
  const frame = useCurrentFrame();
  const look = useLook();
  const chunks = useMemo(() => buildChunks(words, hidden), [words, hidden]);
  const t = (frame - audioOffsetFrames) / FPS;

  // Aktiver Block: von kurz vor dem ersten Wort bis zum Start des nächsten Blocks (max. +0.6 s nach Ende)
  const idx = chunks.findIndex((c, i) => {
    const next = chunks[i + 1];
    const until = next ? Math.min(next.start - 0.04, c.end + 0.6) : c.end + 0.6;
    return t >= c.start - 0.08 && t < until;
  });
  if (idx < 0) return null;
  const chunk = chunks[idx];
  const enterFrame = audioOffsetFrames + Math.round((chunk.start - 0.08) * FPS);
  const pop = spring({ frame: frame - enterFrame, fps: FPS, config: { damping: 18, stiffness: 220, mass: 0.6 } });

  return (
    <div
      style={{
        position: "absolute",
        left: theme.layout.side,
        right: theme.layout.side,
        top: theme.layout.captionY - 110,
        height: 220,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        transform: `scale(${interpolate(pop, [0, 1], [0.94, 1])})`,
        opacity: interpolate(pop, [0, 1], [0, 1]),
      }}
    >
      {/* Weicher dunkler Hof hinter dem Text: lesbar auch vor Sonne oder hellen Bildern */}
      <div
        style={{
          position: "absolute",
          inset: "-30px -20px",
          background: "radial-gradient(ellipse 46% 48% at 50% 50%, rgba(5,7,26,0.5) 0%, rgba(5,7,26,0) 100%)",
        }}
      />
      <div style={{ position: "relative", fontFamily: theme.font.body, fontWeight: 800, fontSize: 68, lineHeight: 1.18, letterSpacing: "-0.01em" }}>
        {chunk.words.map((w, i) => {
          const active = t >= w.start && t < w.end;
          const spoken = t >= w.end;
          return (
            <span
              key={w.index}
              style={{
                color: active ? look.accent : spoken ? look.text : "rgba(255,246,230,0.5)",
                textShadow: "0 4px 22px rgba(0,0,0,0.65), 0 1px 3px rgba(0,0,0,0.5)",
              }}
            >
              {w.text}
              {i < chunk.words.length - 1 ? " " : ""}
            </span>
          );
        })}
      </div>
    </div>
  );
};
