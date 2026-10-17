/** Design-Tokens. Farben und Typo an einer Stelle, damit spätere Episoden konsistent bleiben. */
export const theme = {
  ivory: "#FFF6E6",
  ivoryDim: "rgba(255, 246, 230, 0.62)",
  gold: "#F6C86A",
  goldDeep: "#E39B3A",
  ember: "#C2453A",
  ink: "#070A18",
  font: {
    display: "Anton",
    body: "Inter",
    scripture: "Cormorant Garamond",
  },
  /** Vertikale Zonen (px) im 1080×1920-Raster */
  layout: {
    brandY: 96,
    refY: 176,
    stageTop: 250,
    stageBottom: 1180,
    captionY: 1330,
    horizonY: 1560,
    side: 72,
  },
} as const;

/**
 * Himmelsfarben entlang des Sonnenaufgangs (0 = Nacht, 1 = goldener Morgen).
 * Jede Stufe: oben, Mitte, Horizont.
 */
export const SKY_STOPS: Array<{ at: number; top: string; mid: string; horizon: string }> = [
  { at: 0, top: "#05071A", mid: "#0E1430", horizon: "#2A2147" },
  { at: 0.35, top: "#0C1335", mid: "#33275A", horizon: "#A9524C" },
  { at: 0.65, top: "#18265A", mid: "#6E446D", horizon: "#EE9150" },
  { at: 1, top: "#27417E", mid: "#B47468", horizon: "#FFCF86" },
];
