import React from "react";
import { AbsoluteFill } from "remotion";
import type { TimelineScene } from "../../lib/timing";

/* Platzhalter – wird ersetzt. */
export const FireScene: React.FC<{ ts: TimelineScene }> = ({ ts }) => (
  <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", color: "white", fontSize: 60, fontFamily: "Inter" }}>
    {ts.scene.type}
  </AbsoluteFill>
);
