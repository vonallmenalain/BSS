import React from "react";
import { AbsoluteFill } from "remotion";
import type { TimelineScene } from "../../lib/timing";

/* Platzhalter – Nachrichtensender: drei Städte, drei Arten, eine Botschaft aufzunehmen (Apostelgeschichte 17). */
export const Scene: React.FC<{ ts: TimelineScene }> = () => <AbsoluteFill />;

/** Die Wörter, die nicht unten untertitelt werden, weil sie gross im Bild stehen. */
export const hidden = (ts: TimelineScene): Set<number> => new Set(ts.words.length ? [] : []);
