import React from "react";
import { AbsoluteFill } from "remotion";
import type { TimelineScene } from "../../lib/timing";

/* Platzhalter – Thronsaal aus Zedernholz: zwei Frauen, ein Kind und Salomos Urteil (1 Könige 3). */
export const Scene: React.FC<{ ts: TimelineScene }> = () => <AbsoluteFill />;

/** Die Wörter, die nicht unten untertitelt werden, weil sie gross im Bild stehen. */
export const hidden = (ts: TimelineScene): Set<number> => new Set(ts.words.length ? [] : []);
