import React from "react";
import { AbsoluteFill } from "remotion";
import type { TimelineScene } from "../../lib/timing";

/* Platzhalter – Hoher Berg unter einem Himmel voller Welten: Mose erkennt die Fälschung (Mose 1). */
export const Scene: React.FC<{ ts: TimelineScene }> = () => <AbsoluteFill />;

/** Die Wörter, die nicht unten untertitelt werden, weil sie gross im Bild stehen. */
export const hidden = (ts: TimelineScene): Set<number> => new Set(ts.words.length ? [] : []);
