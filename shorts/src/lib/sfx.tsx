import React, { createContext, useContext } from "react";
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
  | "question"
  | "thud"
  | "warm"
  | "breath";

/**
 * Wie viele Effekte eine Folge hat (`sfx` im Episode-JSON).
 *
 * - `full`: jeder Effekt, wie ihn die Szene setzt – so klingen die Folgen bis Oktober 2026.
 * - `sparse`: nur die Effekte, die eine Szene mit `keep` als wichtig markiert, und die leise
 *   und tief: Glocken, Pixel-Töne und Münzen werden zum warmen Akkord, Klicks und Klirren zum
 *   dumpfen Klopfen, Wusch und Wisch zum Hauch. Die Kinetic-Zeilen bleiben stumm. Seit der Woche
 *   zum Schriftstudium – zu viele helle «Pings» störten.
 */
export type SfxMode = "full" | "sparse";

const SfxModeContext = createContext<SfxMode>("full");

export const SfxModeProvider: React.FC<{ mode: SfxMode; children: React.ReactNode }> = ({ mode, children }) => (
  <SfxModeContext.Provider value={mode}>{children}</SfxModeContext.Provider>
);

/** Was aus einem Effekt in einer sparsamen Folge wird. */
const SOFT: Partial<Record<SfxName, SfxName>> = {
  ding: "warm",
  chime: "warm",
  coin: "warm",
  levelup: "warm",
  unlock: "warm",
  question: "warm",
  blip: "thud",
  tick: "thud",
  pop: "thud",
  type: "thud",
  clash: "thud",
  glitch: "thud",
  swipe: "breath",
  whoosh: "breath",
};

/** Ein Effekt an einem Frame der Szene. `keep`: auch in einer sparsamen Folge hörbar. */
export const Sfx: React.FC<{ frame: number; name: SfxName; volume?: number; keep?: boolean }> = ({ frame, name, volume = 0.5, keep = false }) => {
  const mode = useContext(SfxModeContext);
  if (!Number.isFinite(frame) || frame < 0) return null;
  if (mode === "sparse" && !keep) return null;
  const sound = mode === "sparse" ? (SOFT[name] ?? name) : name;
  const level = mode === "sparse" ? Math.min(volume, 0.4) * 0.75 : volume;
  return (
    <Sequence from={Math.round(frame)} layout="none">
      <Audio src={staticFile(`sfx/${sound}.wav`)} volume={level} />
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
