/**
 * Looks: der visuelle Stil einer ganzen Episode. Jede Episode wählt einen (`look` im JSON) –
 * so sehen Shorts derselben Woche nicht gleich aus. Ein Look bestimmt Hintergrund,
 * Akzentfarben und Schriften; die Szenen holen sich das über `useLook()`.
 */
import React, { createContext, useContext } from "react";
import { theme } from "./theme";

export type LookId =
  | "dawn"
  | "arcade"
  | "chat"
  | "map"
  | "track"
  | "noir"
  | "show"
  | "journal"
  | "stone"
  | "ember"
  | "space"
  | "palace"
  | "dream"
  | "desert"
  | "temple"
  | "post"
  | "feed"
  | "kitchen"
  | "dusk"
  | "forest";

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
  /** Detektiv: dunkles Büro, Licht durch Jalousien */
  noir: {
    id: "noir",
    accent: "#FFD27A",
    accent2: "#E2483D",
    text: "#F4EFE6",
    dim: "rgba(244,239,230,0.6)",
    display: theme.font.display,
    label: theme.font.body,
    glow: "0 10px 40px rgba(0,0,0,0.7)",
  },
  /** Quizshow: Studio, Scheinwerfer, Buzzer */
  show: {
    id: "show",
    accent: "#FFE45C",
    accent2: "#39D5FF",
    text: "#FFFFFF",
    dim: "rgba(255,255,255,0.62)",
    display: theme.font.display,
    label: theme.font.body,
    glow: "0 0 24px rgba(255,228,92,0.45), 0 10px 40px rgba(0,0,0,0.55)",
  },
  /** Notizbuch auf dem Schreibtisch */
  journal: {
    id: "journal",
    accent: "#FFC94A",
    accent2: "#7CC6FE",
    text: "#FFFFFF",
    dim: "rgba(255,255,255,0.62)",
    display: theme.font.display,
    label: "Caveat",
    glow: "0 10px 40px rgba(0,0,0,0.5)",
  },
  /** Jerusalem bei Nacht: Steinmauer im Fackellicht */
  stone: {
    id: "stone",
    accent: "#F4B860",
    accent2: "#D0643F",
    text: "#FFF4E2",
    dim: "rgba(255,244,226,0.62)",
    display: theme.font.display,
    label: "Cinzel",
    glow: "0 0 30px rgba(244,184,96,0.35), 0 10px 40px rgba(0,0,0,0.7)",
  },
  /** Hof bei Nacht: Feuer, Funken, Glut */
  ember: {
    id: "ember",
    accent: "#FFA048",
    accent2: "#FFD36B",
    text: "#FFF1E0",
    dim: "rgba(255,241,224,0.6)",
    display: theme.font.display,
    label: theme.font.body,
    glow: "0 0 28px rgba(255,140,50,0.45), 0 10px 40px rgba(0,0,0,0.7)",
  },
  /** Weltraum: Sterne, Mars, Missionskontrolle */
  space: {
    id: "space",
    accent: "#FF8A4C",
    accent2: "#6EE7F9",
    text: "#FFFFFF",
    dim: "rgba(255,255,255,0.62)",
    display: theme.font.display,
    label: "Space Mono",
    glow: "0 0 24px rgba(110,231,249,0.35), 0 10px 40px rgba(0,0,0,0.6)",
  },
  /** Persischer Palast: Gold, Purpur, Säulen */
  palace: {
    id: "palace",
    accent: "#F5C451",
    accent2: "#C08CFF",
    text: "#FFF7E6",
    dim: "rgba(255,247,230,0.62)",
    display: theme.font.display,
    label: "Cinzel",
    glow: "0 0 26px rgba(245,196,81,0.4), 0 10px 40px rgba(0,0,0,0.6)",
  },
  /** Lehis Traum: Nebel, Licht des Baumes */
  dream: {
    id: "dream",
    accent: "#FFE9A3",
    accent2: "#9FD3FF",
    text: "#F6F8FF",
    dim: "rgba(246,248,255,0.62)",
    display: theme.font.display,
    label: theme.font.body,
    glow: "0 0 30px rgba(255,233,163,0.4), 0 10px 40px rgba(0,0,0,0.6)",
  },
  /** Wüste bei Nacht: Dünen, Sterne, Mondlicht (Matthäus 4) */
  desert: {
    id: "desert",
    accent: "#F7C873",
    accent2: "#9CC3FF",
    text: "#FFF6E8",
    dim: "rgba(255,246,232,0.62)",
    display: theme.font.display,
    label: "Cinzel",
    glow: "0 0 28px rgba(247,200,115,0.35), 0 10px 40px rgba(0,0,0,0.7)",
  },
  /** Tempel als Baustelle: Staub im Sonnenstrahl, Stein, Gerüst (2 Könige 22) */
  temple: {
    id: "temple",
    accent: "#FFD27F",
    accent2: "#D98A4A",
    text: "#FFF4E0",
    dim: "rgba(255,244,224,0.62)",
    display: theme.font.display,
    label: "Cinzel",
    glow: "0 0 30px rgba(255,210,127,0.35), 0 10px 40px rgba(0,0,0,0.7)",
  },
  /** Sendungsverfolgung: eine App über einer dunklen Karte */
  post: {
    id: "post",
    accent: "#FFCC33",
    accent2: "#4FD1C5",
    text: "#FFFFFF",
    dim: "rgba(255,255,255,0.62)",
    display: theme.font.display,
    label: theme.font.body,
    glow: "0 0 22px rgba(255,204,51,0.3), 0 10px 40px rgba(0,0,0,0.6)",
  },
  /** Kurzvideo-Feed spät in der Nacht: Bildschirmlicht im dunklen Zimmer */
  feed: {
    id: "feed",
    accent: "#FF3D71",
    accent2: "#8B7CFF",
    text: "#FFFFFF",
    dim: "rgba(255,255,255,0.6)",
    display: theme.font.display,
    label: theme.font.body,
    glow: "0 0 26px rgba(255,61,113,0.4), 0 10px 40px rgba(0,0,0,0.6)",
  },
  /** Kochshow: Studioküche, Teller, Menükarte */
  kitchen: {
    id: "kitchen",
    accent: "#FFB547",
    accent2: "#7BD389",
    text: "#FFF8EE",
    dim: "rgba(255,248,238,0.62)",
    display: theme.font.display,
    label: "Caveat",
    glow: "0 0 24px rgba(255,181,71,0.35), 0 10px 40px rgba(0,0,0,0.6)",
  },
  /** Abendweg nach Emmaus: Sonnenuntergang über den Hügeln (Lukas 24) */
  dusk: {
    id: "dusk",
    accent: "#FFC27A",
    accent2: "#FF8A5C",
    text: "#FFF7EC",
    dim: "rgba(255,247,236,0.65)",
    display: theme.font.display,
    label: "Cormorant Garamond",
    glow: "0 0 26px rgba(255,194,122,0.35), 0 10px 40px rgba(0,0,0,0.6)",
  },
  /** Wald bei Nacht bis zum Morgen: Bäume, Mond, Glühwürmchen (Enos 1) */
  forest: {
    id: "forest",
    accent: "#C7F59B",
    accent2: "#FFE08A",
    text: "#F4FFF0",
    dim: "rgba(244,255,240,0.62)",
    display: theme.font.display,
    label: theme.font.body,
    glow: "0 0 26px rgba(199,245,155,0.3), 0 10px 40px rgba(0,0,0,0.7)",
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
