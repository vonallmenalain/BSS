import React, { useMemo } from "react";
import { random } from "remotion";

/**
 * Raster aus n Punkten (ein Punkt = ein Mensch). Leuchtende Punkte in zufälliger,
 * aber deterministischer Reihenfolge – wichtig, damit jeder Render-Worker dasselbe Bild erzeugt.
 */
export const DotField: React.FC<{
  count: number;
  lit: number;
  x: number;
  y: number;
  w: number;
  h: number;
  dimOpacity?: number;
  /** 0..1 – kurzer Helligkeitsimpuls, z.B. wenn alle gezählt sind */
  pulse?: number;
  seed?: string;
  opacity?: number;
}> = ({ count, lit, x, y, w, h, dimOpacity = 0.14, pulse = 0, seed = "dots", opacity = 1 }) => {
  const { cols, rows, step, order } = useMemo(() => {
    const c = Math.round(Math.sqrt((count * w) / h));
    const r = Math.ceil(count / c);
    const st = Math.min(w / c, h / r);
    const idx = Array.from({ length: count }, (_, i) => i);
    // Fisher-Yates mit Remotion-random → stabile Reihenfolge
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(random(`${seed}-${i}`) * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    const rank = new Int32Array(count);
    idx.forEach((v, k) => (rank[v] = k));
    return { cols: c, rows: r, step: st, order: rank };
  }, [count, w, h, seed]);

  const ox = x + (w - cols * step) / 2 + step / 2;
  const oy = y + (h - rows * step) / 2 + step / 2;
  const r = step * 0.28;
  const litN = Math.round(lit);

  return (
    <g opacity={opacity}>
      {Array.from({ length: count }, (_, i) => {
        const on = order[i] < litN;
        const cx = ox + (i % cols) * step;
        const cy = oy + Math.floor(i / cols) * step;
        return (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={on ? r * (1.12 + pulse * 0.25) : r * 0.82}
            fill={on ? "#F6C86A" : "#FFF6E6"}
            opacity={on ? 0.92 : dimOpacity}
          />
        );
      })}
    </g>
  );
};
