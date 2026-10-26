import React, { useMemo } from "react";
import { AbsoluteFill, random, useCurrentFrame } from "remotion";
import { FPS, HEIGHT, WIDTH } from "../../../lib/timing";

/*
 * Sendungsverfolgung: eine dunkle Stadtkarte wie in einer Tracking-App – Strassen als feine
 * Linien, ein Fluss, Pärke, ein paar pulsierende Stecknadeln und eine gelbe Route, die sich
 * langsam weiterschiebt. Die Karte zieht kaum merklich mit. Die Szene legt die App darüber.
 */

const C = { street: "#4FD1C5", river: "#3E7BFF", route: "#FFCC33" };

export const PostBg: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const streets = useMemo(() => {
    const out: string[] = [];
    // Waagrechte und senkrechte Strassen, leicht gebogen, in zwei Breiten
    for (let i = 0; i < 18; i++) {
      const y = -120 + i * 130 + random(`py${i}`) * 50;
      const b = (random(`pb${i}`) - 0.5) * 140;
      out.push(`M -200 ${y} Q ${WIDTH / 2} ${y + b} ${WIDTH + 200} ${y + random(`pe${i}`) * 60}`);
    }
    for (let i = 0; i < 11; i++) {
      const x = -100 + i * 125 + random(`px${i}`) * 50;
      const b = (random(`pq${i}`) - 0.5) * 160;
      out.push(`M ${x} -200 Q ${x + b} ${HEIGHT / 2} ${x + random(`pf${i}`) * 70} ${HEIGHT + 200}`);
    }
    return out;
  }, []);
  const parks = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => ({
        x: random(`kx${i}`) * WIDTH,
        y: random(`ky${i}`) * HEIGHT,
        rx: 60 + random(`kr${i}`) * 90,
        ry: 40 + random(`ks${i}`) * 70,
      })),
    [],
  );
  const pins = useMemo(
    () => Array.from({ length: 6 }, (_, i) => ({ x: 80 + random(`nx${i}`) * (WIDTH - 160), y: 300 + random(`ny${i}`) * 1400, p: random(`np${i}`) * 6.28 })),
    [],
  );
  const dx = -t * 5;
  const dy = -t * 3;
  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg, #0A1322 0%, #0D1A2D 45%, #0A1424 100%)" }}>
      <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", inset: 0 }}>
        <g transform={`translate(${dx} ${dy}) scale(1.06)`}>
          {parks.map((p, i) => (
            <ellipse key={i} cx={p.x} cy={p.y} rx={p.rx} ry={p.ry} fill={C.street} opacity={0.045} />
          ))}
          <path d={`M -200 1480 C 200 1300, 420 1640, 760 1420 S 1180 1180, 1400 1260`} stroke={C.river} strokeWidth={46} fill="none" opacity={0.14} strokeLinecap="round" />
          {streets.map((d, i) => (
            <path key={i} d={d} stroke={C.street} strokeWidth={i % 3 === 0 ? 7 : 3} fill="none" opacity={i % 3 === 0 ? 0.11 : 0.07} />
          ))}
          <path d="M 120 1820 C 260 1500, 180 1240, 420 1060 S 780 720, 900 380" stroke={C.route} strokeWidth={8} fill="none" strokeDasharray="18 16" strokeDashoffset={-frame * 1.4} opacity={0.32} strokeLinecap="round" />
          {pins.map((p, i) => {
            const pulse = 0.5 + 0.5 * Math.sin(t * 2.2 + p.p);
            return (
              <g key={i} transform={`translate(${p.x} ${p.y})`} opacity={0.5}>
                <circle r={22 + 18 * pulse} fill={C.street} opacity={0.12 * (1 - pulse * 0.6)} />
                <circle r={9} fill={C.street} opacity={0.7} />
              </g>
            );
          })}
        </g>
      </svg>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 80% 65% at 50% 40%, rgba(0,0,0,0) 45%, rgba(2,6,14,0.78) 100%)" }} />
    </AbsoluteFill>
  );
};
