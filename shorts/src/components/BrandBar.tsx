import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { useLook } from "../looks";
import { theme } from "../theme";

/** Dezente Marke oben. Bewusst ohne Logo/Wortmarke der Kirche. */
export const BrandBar: React.FC<{ name: string; label?: string }> = ({ name, label }) => {
  const frame = useCurrentFrame();
  const look = useLook();
  const o = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  return (
    <div
      style={{
        position: "absolute",
        top: theme.layout.brandY - 30,
        left: theme.layout.side,
        right: theme.layout.side,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        opacity: o,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 14, height: 14, borderRadius: 7, background: look.accent, boxShadow: `0 0 18px ${look.accent}` }} />
        <span
          style={{
            fontFamily: theme.font.display,
            fontSize: 40,
            letterSpacing: "0.14em",
            color: look.text,
            textTransform: "uppercase",
          }}
        >
          {name}
        </span>
      </div>
      {label ? (
        <span style={{ fontFamily: theme.font.body, fontWeight: 700, fontSize: 30, color: look.dim, letterSpacing: "0.04em" }}>
          {label}
        </span>
      ) : null}
    </div>
  );
};

/** Kleine Quellenangabe unter der Marke, gehört zur Szene (blendet mit ihr über). */
export const RefLabel: React.FC<{ text?: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const look = useLook();
  if (!text) return null;
  const o = interpolate(frame, [6, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div
      style={{
        position: "absolute",
        top: theme.layout.refY - 20,
        left: theme.layout.side,
        fontFamily: theme.font.body,
        fontWeight: 700,
        fontSize: 28,
        letterSpacing: "0.22em",
        textTransform: "uppercase",
        color: look.accent,
        opacity: o * 0.9,
      }}
    >
      {text}
    </div>
  );
};
