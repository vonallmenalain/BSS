import React from "react";

/** Stilisierte Silhouette eines jungen Kriegers mit Speer (Ursprung = Füsse, Höhe ≈ 300). */
export const Warrior: React.FC<{ x: number; y: number; scale?: number; rim?: number; fill?: string }> = ({
  x,
  y,
  scale = 1,
  rim = 1,
  fill = "#0A0912",
}) => {
  const body =
    "M -32 -178 Q 0 -192 32 -178 L 27 -112 L 34 -58 L 20 -58 L 17 0 L 5 0 L 3 -58 L -3 -58 L -5 0 L -17 0 L -20 -58 L -34 -58 L -27 -112 Z";
  const spear = (
    <>
      <rect x={36} y={-300} width={5} height={210} rx={2} />
      <path d="M 38.5 -330 L 47 -296 L 30 -296 Z" />
    </>
  );
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      {/* Goldener Randlicht-Versatz: dieselbe Form leicht nach oben/links, dahinter */}
      <g fill="#F6C86A" opacity={0.85 * rim} transform="translate(-2.5 -3)">
        <circle cx={0} cy={-210} r={22} />
        <path d={body} />
        {spear}
      </g>
      <g fill={fill}>
        <circle cx={0} cy={-210} r={22} />
        <path d={body} />
        {spear}
      </g>
    </g>
  );
};

/** Schwert mit Spitze nach unten (Ursprung = Mitte der Parierstange). */
export const Sword: React.FC<{ x: number; y: number; rotate?: number; scale?: number }> = ({ x, y, rotate = 0, scale = 1 }) => (
  <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`}>
    <defs>
      <linearGradient id="steel" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#6E7688" />
        <stop offset="45%" stopColor="#E3E8F0" />
        <stop offset="55%" stopColor="#B7BFCC" />
        <stop offset="100%" stopColor="#5B6273" />
      </linearGradient>
    </defs>
    <path d="M -15 6 L 15 6 L 12 320 L 0 372 L -12 320 Z" fill="url(#steel)" />
    <rect x={-1.2} y={14} width={2.4} height={290} fill="#5B6273" opacity={0.7} />
    <rect x={-62} y={-12} width={124} height={18} rx={8} fill="#D9A54E" />
    <rect x={-9} y={-96} width={18} height={86} rx={4} fill="#3A2A22" />
    {[-80, -62, -44, -26].map((yy) => (
      <rect key={yy} x={-9} y={yy} width={18} height={3} fill="#D9A54E" opacity={0.75} />
    ))}
    <circle cx={0} cy={-106} r={15} fill="#E7B65C" />
  </g>
);
