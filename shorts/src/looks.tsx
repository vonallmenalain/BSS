/**
 * Looks: der visuelle Stil einer ganzen Episode. Jede Episode wählt einen (`look` im JSON) –
 * so sehen Shorts derselben Woche nicht gleich aus. Ein Look bestimmt Hintergrund,
 * Akzentfarben und Schriften; die Szenen holen sich das über `useLook()`.
 */
import React, { createContext, useContext } from "react";
import { theme } from "./theme";

export type LookId = "dawn" | "arcade" | "chat" | "map" | "track";

export type Look = {
  id: LookId;
  /** Hervorhebung: aktives Wort, aktuelle Zeile, Quellenangabe */
  accent: string;
  /** Zweite Farbe für Rahmen, Glühen, Akzente */
  accent2: string;
  text: string;
  dim: string;
  /** Schrift für grosse Zeilen */
  display: string;
  /** Schrift für kleine Beschriftungen (HUD, Chips) */
  label: string;
  /** Leuchten hinter grossen Zeilen (CSS text-shadow) */
  glow: string;
};

export const LOOKS: Record<LookId, Look> = {
  /** Sonnenaufgang – der ursprüngliche Stil */
  dawn: {
    id: "dawn",
    accent: theme.gold,
    accent2: theme.goldDeep,
    text: theme.ivory,
    dim: theme.ivoryDim,
    display: theme.font.display,
    label: theme.font.body,
    glow: "0 10px 40px rgba(0,0,0,0.5)",
  },
  /** Videospiel: Neon, Raster, Pixel-Schrift */
  arcade: {
    id: "arcade",
    accent: "#5CF3FF",
    accent2: "#FF4FD8",
    text: "#FFFFFF",
    dim: "rgba(255,255,255,0.62)",
    display: theme.font.display,
    label: '"Press Start 2P"',
    glow: "0 0 18px rgba(92,243,255,0.75), 0 0 46px rgba(255,79,216,0.45), 0 8px 30px rgba(0,0,0,0.6)",
  },
  /** Handy: Nachrichten in einem Chat */
  chat: {
    id: "chat",
    accent: "#FFD36E",
    accent2: "#4ADE80",
    text: "#FFFFFF",
    dim: "rgba(255,255,255,0.6)",
    display: theme.font.display,
    label: theme.font.body,
    glow: "0 10px 40px rgba(0,0,0,0.5)",
  },
  /** Kartentisch: Pergament, Tinte, Lampenlicht */
  map: {
    id: "map",
    accent: "#F2C46D",
    accent2: "#E0573F",
    text: "#FFF3DC",
    dim: "rgba(255,243,220,0.62)",
    display: theme.font.display,
    label: "Caveat",
    glow: "0 10px 40px rgba(0,0,0,0.6)",
  },
  /** Stadion in der Abenddämmerung */
  track: {
    id: "track",
    accent: "#FFB347",
    accent2: "#FFE07A",
    text: "#FFFFFF",
    dim: "rgba(255,255,255,0.62)",
    display: theme.font.display,
    label: theme.font.body,
    glow: "0 10px 40px rgba(0,0,0,0.55)",
  },
};

const LookContext = createContext<Look>(LOOKS.dawn);

export const LookProvider: React.FC<{ look: LookId; children: React.ReactNode }> = ({ look, children }) => (
  <LookContext.Provider value={LOOKS[look]}>{children}</LookContext.Provider>
);

export const useLook = () => useContext(LookContext);
