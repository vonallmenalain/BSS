import React from "react";
import { Audio, Sequence, staticFile } from "remotion";
import { FPS, type TimelineScene, cueTime } from "./timing";

/** Die Soundeffekte aus scripts/make-sfx.ts (public/sfx/<name>.wav). */
export type SfxName =
  | "pop"
  | "ding"
  | "type"
  | "blip"
  | "coin"
  | "levelup"
  | "unlock"
  | "whoosh"
  | "swipe"
  | "stamp"
  | "drum"
  | "clash"
  | "tick"
  | "glitch"
  | "chime"
  | "question";

/** Ein Effekt an einem Frame der Szene. */
export const Sfx: React.FC<{ frame: number; name: SfxName; volume?: number }> = ({ frame, name, volume = 0.5 }) => {
  if (!Number.isFinite(frame) || frame < 0) return null;
  return (
    <Sequence from={Math.round(frame)} layout="none">
      <Audio src={staticFile(`sfx/${name}.wav`)} volume={volume} />
    </Sequence>
  );
};

/** Sekunden ab Stimmeinsatz → Frame in der Szene. */
export const voiceFrame = (ts: TimelineScene, sec: number) => ts.audioOffsetFrames + Math.round(sec * FPS);

/** Zeitpunkt (Sekunden ab Stimmeinsatz), an dem eine Phrase gesprochen wird. */
export const beat = (ts: TimelineScene, phrase: string | undefined, fallback: number) => cueTime(ts.words, phrase, fallback);

/** Alle Takte einer Szene; fehlende Phrasen werden gleichmässig über die Sprechzeit verteilt. */
export const beats = (ts: TimelineScene, cues: readonly string[], count: number) =>
  Array.from({ length: count }, (_, i) =>
    beat(ts, cues[i], ts.speechStartSec + ((i + 1) / (count + 1)) * Math.max(1, ts.speechEndSec - ts.speechStartSec)),
  );
